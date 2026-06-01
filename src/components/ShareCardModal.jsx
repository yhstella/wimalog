import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { primaryCourse, personalSummaryForCourse } from '../lib/stats.js';
import { snapshotAvgLossCurve } from '../lib/snapshot.js';
import { MED_BY_ID } from '../lib/constants.js';
import { useToast } from './Toast.jsx';

// 결과 공유 카드 — 본인 데이터를 익명 PNG로 생성 → 카톡/저장/시스템 공유.
// 유입(바이럴) + 리텐션(성취 자랑) + 데이터 강점(코호트 비교)을 한 번에.
// ⚠ PII 절대 없음 — 닉네임·이메일 X, 숫자만. (보안 락다운과 동일 원칙)
const MED_SHORT = { wegovy: '위고비', mounjaro: '마운자로', saxenda: '삭센다', ozempic: '오젬픽', zepbound: '젭바운드' };
const W = 1080, H = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 카드에 들어갈 데이터 계산 — real(실데이터) vs projection(예상) 분기
function buildCardData(user) {
  const logs = Storage.getLogsByUser(user.id);
  const courses = Storage.getMedCoursesByUser(user.id);
  const course = primaryCourse(courses);
  const summary = course ? personalSummaryForCourse(user, logs, course) : null;
  const medId = course?.medication || 'wegovy';
  const medLabel = MED_SHORT[medId] || medId;

  // 실데이터: 로그 2회+ & 의미있는 감량
  const hasReal = !!(summary && logs.length >= 2 && summary.lossKg != null && Math.abs(summary.lossKg) >= 0.1 && course);
  if (hasReal) {
    // 같은 주차 코호트 평균 (snapshot — 즉시, 네트워크 없음)
    let cohortPct = null;
    const targetWk = Math.max(4, summary.weeks || 12);
    const rows = snapshotAvgLossCurve(medId, [4, 8, 12, 16, 24, 36, 48]);
    if (rows?.length) {
      const closest = [...rows].filter(r => r.avg != null)
        .sort((a, b) => Math.abs(a.week - targetWk) - Math.abs(b.week - targetWk))[0];
      if (closest) cohortPct = Math.abs(closest.avg);
    }
    return {
      mode: 'real', medLabel,
      weeks: summary.weeks,
      lossKg: summary.lossKg,
      lossPct: Math.abs(summary.lossPct),
      startWeight: summary.startWeight,
      currentWeight: summary.currentWeight,
      cohortPct,
    };
  }

  // projection: 본인 시작 체중 + snapshot 24주 평균
  const startWeight = user.startWeight || 78;
  const rows = snapshotAvgLossCurve(medId, [24]);
  const projPct = rows?.[0]?.avg != null ? Math.abs(rows[0].avg) : 10;
  const projKg = +(startWeight * projPct / 100).toFixed(1);
  return {
    mode: 'projection', medLabel,
    projKg, projPct, startWeight,
  };
}

function drawCard(ctx, d) {
  // 배경 그라데이션 (brand green)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2E9A58');
  g.addColorStop(1, '#176B3A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const PAD = 80;
  // 상단 배지
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, PAD, PAD, 150, 80, 24); ctx.fill();
  ctx.fillStyle = '#176B3A';
  ctx.font = '700 44px "Pretendard", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('위마', PAD + 75, PAD + 42);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '500 34px "Pretendard", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('위고비·마운자로 리얼데이터', PAD + 175, PAD + 42);

  ctx.textAlign = 'center';
  if (d.mode === 'real') {
    // 라벨
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 46px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`${d.medLabel} ${d.weeks}주차 누적 감량`, W / 2, 340);
    // 큰 숫자
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 260px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`−${Math.abs(d.lossKg).toFixed(1)}`, W / 2 - 60, 500);
    ctx.font = '700 90px "Pretendard", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('kg', W / 2 + 200, 530);
    ctx.textAlign = 'center';
    // 서브
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '500 40px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`${d.startWeight}kg → ${d.currentWeight}kg  ·  −${d.lossPct.toFixed(1)}%`, W / 2, 640);

    // 코호트 비교 카드
    if (d.cohortPct != null) {
      const cx = PAD, cy = 720, cw = W - PAD * 2, ch = 200;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, cx, cy, cw, ch, 32); ctx.fill();
      const max = Math.max(d.lossPct, d.cohortPct, 1);
      const barX = cx + 220, barMaxW = cw - 320;
      // 나
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 38px "Pretendard", system-ui, sans-serif';
      ctx.fillText('나', cx + 50, cy + 60);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, barX, cy + 38, Math.max(20, barMaxW * d.lossPct / max), 44, 22); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right';
      ctx.fillText(`−${d.lossPct.toFixed(1)}%`, cx + cw - 50, cy + 60);
      // 비슷한 사람
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '500 34px "Pretendard", system-ui, sans-serif';
      ctx.fillText('비슷한 사람 평균', cx + 50, cy + 145);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      roundRect(ctx, barX, cy + 123, Math.max(20, barMaxW * d.cohortPct / max), 44, 22); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'right';
      ctx.fillText(`−${d.cohortPct.toFixed(1)}%`, cx + cw - 50, cy + 145);
      ctx.textAlign = 'center';
    }
  } else {
    // projection
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 46px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`${d.medLabel} 6개월 예상 감량`, W / 2, 360);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 260px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`−${d.projKg.toFixed(1)}`, W / 2 - 60, 540);
    ctx.font = '700 90px "Pretendard", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('kg', W / 2 + 200, 570);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '500 40px "Pretendard", system-ui, sans-serif';
    ctx.fillText(`${d.startWeight}kg 기준 · −${d.projPct.toFixed(1)}% (예시 예측)`, W / 2, 690);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '500 34px "Pretendard", system-ui, sans-serif';
    ctx.fillText('본인 정보를 입력할수록 예측이 정밀해져요', W / 2, 770);
  }

  // 푸터
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 40px "Pretendard", system-ui, sans-serif';
  ctx.fillText('실사용자 데이터 기반  ·  wimalog.kr', W / 2, H - 90);
}

export function ShareCardModal({ user, onClose }) {
  const canvasRef = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = useMemo(() => buildCardData(user), [user]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    // 폰트 로드 후 한 번 더 그려 한글 글리프 보장
    const render = () => drawCard(ctx, data);
    render();
    if (document.fonts?.ready) document.fonts.ready.then(render).catch(() => {});
  }, [data]);

  const toBlob = () => new Promise(res => canvasRef.current.toBlob(res, 'image/png', 0.95));

  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      const file = new File([blob], 'wimalog-result.png', { type: 'image/png' });
      const shareText = data.mode === 'real'
        ? `위마로그로 ${data.medLabel} ${data.weeks}주 −${Math.abs(data.lossKg).toFixed(1)}kg!`
        : `위마로그 — 나는 얼마나 빠질까? ${data.medLabel} 예측 보기`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '위마로그', text: `${shareText}\nhttps://wimalog.kr` });
      } else {
        downloadImage(blob);
        toast?.show?.({ kind: 'success', msg: '이미지 저장됨 — 카톡·인스타에 올려보세요' });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast?.show?.({ kind: 'error', msg: '공유 실패 — 저장 후 직접 올려주세요' });
    } finally { setBusy(false); }
  };

  const downloadImage = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wimalog-result.png';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const saveImage = async () => {
    setBusy(true);
    try { downloadImage(await toBlob()); toast?.show?.({ kind: 'success', msg: '이미지 저장됨' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto animate-slideUp">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800 px-5 py-3 flex justify-between items-center">
          <div>
            <div className="font-bold text-ink-900 dark:text-slate-100">📸 결과 카드</div>
            <div className="text-xs text-ink-500 dark:text-slate-500">익명 — 숫자만, 닉네임 노출 X</div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-2 text-base">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <canvas ref={canvasRef} width={W} height={H}
                  className="w-full rounded-2xl shadow-md aspect-square" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveImage} disabled={busy} className="btn-secondary !py-3 disabled:opacity-50">
              💾 이미지 저장
            </button>
            <button onClick={shareImage} disabled={busy} className="btn-primary !py-3 disabled:opacity-50">
              📤 공유하기
            </button>
          </div>
          <p className="text-[11px] text-ink-500 dark:text-slate-500 text-center leading-relaxed">
            {data.mode === 'real'
              ? '본인 실제 기록 기반 카드입니다. 닉네임·개인정보는 포함되지 않아요.'
              : '체중을 2회 이상 기록하면 본인 실제 결과 카드로 바뀝니다.'}
          </p>
        </div>
      </div>
    </div>
  );
}
