import React, { useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { MED_BY_ID, SIDE_EFFECTS, CONDITIONS } from '../lib/constants.js';
import { bmi, personalSummary } from '../lib/stats.js';
import { snapshotAvgLossCurve, snapshotSideEffectRates } from '../lib/snapshot.js';
import { useToast } from './Toast.jsx';

// 진료용 리포트 — print에 최적화된 한 페이지 요약. 브라우저 인쇄 → PDF 저장.
// 추가: 체중 SVG 차트 + 코호트 비교 + 클립보드 텍스트 카피 + A4 print CSS
export function DoctorReport({ user, onBack }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const logs = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id]);
  const doses = useMemo(() => Storage.getDosesByUser(user.id), [user.id]);
  const exercises = useMemo(() => Storage.getExercisesByUser(user.id), [user.id]);

  const summary = personalSummary(user, logs);
  const activeMeds = courses.filter(c => !c.endDate);
  const primaryCourse = activeMeds[0] || courses[courses.length - 1] || null;
  const recentLogs = logs.slice(-12);   // 최근 12개 '기록'(주 단위 아님). 라벨도 '회/기록'으로 표기

  // 약 시작 후 경과 주
  const weeksOnMed = useMemo(() => {
    if (!primaryCourse?.startDate) return null;
    const start = new Date(primaryCourse.startDate);
    return Math.round((Date.now() - start.getTime()) / (7 * 86400000));
  }, [primaryCourse]);

  // 코호트 비교 — 본인 진행 주차의 평균 감량률
  const cohortLossAtMyWeek = useMemo(() => {
    if (!primaryCourse?.medication || !weeksOnMed) return null;
    const rows = snapshotAvgLossCurve(primaryCourse.medication, [4, 8, 12, 16, 24, 36, 48]);
    if (!rows) return null;
    // 가장 가까운 weeks의 평균
    const sorted = [...rows].sort((a, b) =>
      Math.abs(a.week - weeksOnMed) - Math.abs(b.week - weeksOnMed));
    const closest = sorted[0];
    if (!closest || closest.avg == null) return null;
    return { week: closest.week, avg: closest.avg, n: closest.n };
  }, [primaryCourse, weeksOnMed]);

  // 부작용 합계 (최근 12개 기록) + 코호트 비교 — 발생률 = 발생 기록수 / 전체 기록수
  const sideAnalysis = useMemo(() => {
    const sideCounts = {};
    for (const l of recentLogs) {
      for (const [k, v] of Object.entries(l.sideEffects || {})) {
        if (v) sideCounts[k] = (sideCounts[k] || 0) + 1;
      }
    }
    const myTotalLogs = recentLogs.length || 1;
    const cohortRates = primaryCourse?.medication
      ? snapshotSideEffectRates(primaryCourse.medication) || []
      : [];
    const items = Object.entries(sideCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => {
        const label = SIDE_EFFECTS.find(s => s.id === id)?.label || id;
        const myRate = count / myTotalLogs;
        const cohort = cohortRates.find(r => r.id === id);
        return {
          id, label, count, myRate,
          cohortRate: cohort?.rate ?? null,
        };
      });
    return items;
  }, [recentLogs, primaryCourse]);

  const totalEx12wk = useMemo(() => {
    const cutoff = Date.now() - 12 * 7 * 86400000;
    return exercises
      .filter(e => new Date(e.date).getTime() > cutoff)
      .reduce((s, e) => s + (e.durationMin || 0), 0);
  }, [exercises]);

  // 텍스트 요약 — 의사에게 카톡/이메일 보낼 때
  const textSummary = useMemo(() => {
    if (!summary) return '';
    const lines = [];
    lines.push(`[위마로그 진료용 요약] ${new Date().toLocaleDateString('ko-KR')}`);
    lines.push(`성별/나이대: ${user.gender === 'F' ? '여' : user.gender === 'M' ? '남' : '비공개'} ${user.ageGroup}`);
    lines.push(`키: ${user.height}cm`);
    lines.push(`시작/현재 체중: ${summary.startWeight}kg → ${summary.currentWeight}kg (${summary.lossKg >= 0 ? '-' : '+'}${Math.abs(summary.lossKg).toFixed(1)}kg, ${Math.abs(summary.lossPct).toFixed(1)}%)`);
    lines.push(`BMI: ${bmi(user.startWeight, user.height)?.toFixed(1)} → ${summary.curBmi?.toFixed(1) || '?'}`);
    if (primaryCourse) {
      lines.push(`현재 약: ${MED_BY_ID[primaryCourse.medication]?.label} ${weeksOnMed != null ? `(${weeksOnMed}주차)` : ''}`);
      const cDoses = doses.filter(d => d.courseId === primaryCourse.id);
      const last = cDoses[cDoses.length - 1];
      if (last) lines.push(`최근 용량: ${last.dose}, 총 ${cDoses.length}회 투약`);
    }
    if (cohortLossAtMyWeek) {
      lines.push(`코호트 비교: ${cohortLossAtMyWeek.week}주차 평균 -${cohortLossAtMyWeek.avg.toFixed(1)}% (본인 -${Math.abs(summary.lossPct).toFixed(1)}%)`);
    }
    if (sideAnalysis.length) {
      lines.push(`부작용 (최근 ${recentLogs.length}개 기록):`);
      sideAnalysis.forEach(s => {
        const cohortPct = s.cohortRate != null ? `, 코호트 ${(s.cohortRate * 100).toFixed(0)}%` : '';
        lines.push(`  · ${s.label}: ${s.count}회 (본인 ${(s.myRate * 100).toFixed(0)}%${cohortPct})`);
      });
    }
    if (totalEx12wk > 0) {
      lines.push(`운동: 12주 누적 ${totalEx12wk}분 (주평균 ${Math.round(totalEx12wk / 12)}분)`);
    }
    lines.push('');
    lines.push('※ 사용자 자가보고 데이터입니다. 의학적 판단은 의료진을 따라야 합니다.');
    return lines.join('\n');
  }, [summary, user, primaryCourse, weeksOnMed, doses, cohortLossAtMyWeek, sideAnalysis, totalEx12wk]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(textSummary);
      setCopied(true);
      toast?.show?.({ kind: 'success', msg: '텍스트 요약 복사됨 — 카톡/이메일에 붙여넣기' });
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      toast?.show?.({ kind: 'error', msg: '복사 실패 — 브라우저가 클립보드를 막았어요' });
    }
  };

  // 의료인 데이터 export — JSON/CSV (P58 페르소나)
  const downloadBlob = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  const exportJSON = () => {
    // PII 제거 + 익명화. id/userId/nickname/email/avatarUrl 등 환자 식별 정보 모두 strip.
    // 시점·체중·약·용량 등 의학적 의사 결정에 필요한 정보만 export.
    const stripPII = (obj, extraKeys = []) => {
      const omit = new Set(['id', 'userId', 'courseId', 'createdAt', 'updatedAt',
                            'nickname', 'email', 'avatarUrl', 'submittedBy', 'authProvider',
                            'visitPurpose', 'initialSetupComplete', ...extraKeys]);
      const out = {};
      for (const [k, v] of Object.entries(obj || {})) {
        if (!omit.has(k)) out[k] = v;
      }
      return out;
    };
    const payload = {
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'wimalog',
        schemaVersion: 1,
        notice: '익명화된 임상 데이터. 환자 식별자(id·닉네임·이메일 등)는 제거됨.',
      },
      patient: {
        gender: user.gender, ageGroup: user.ageGroup, height: user.height,
        startWeight: user.startWeight, targetWeight: user.targetWeight,
        conditions: user.conditions || {},
        conditionsChecked: !!user.conditionsChecked,
      },
      logs:      logs.map(l => stripPII(l)),
      courses:   courses.map(c => stripPII(c, ['seed'])),
      doses:     doses.map(d => stripPII(d, ['seed', 'pharmacyName', 'region', 'price'])),
      exercises: exercises.map(e => stripPII(e)),
    };
    downloadBlob(`wimalog-export-${new Date().toISOString().slice(0,10)}.json`,
                 JSON.stringify(payload, null, 2), 'application/json');
  };
  const exportCSV = () => {
    // weight + dose + exercise → 합본 CSV
    const rows = [['date', 'type', 'value', 'unit', 'meta']];
    for (const l of logs) rows.push([l.date, 'weight', l.weight, 'kg', '']);
    for (const d of doses) {
      const course = courses.find(c => c.id === d.courseId);
      rows.push([d.date, 'dose', d.dose, '', `${MED_BY_ID[course?.medication]?.label || ''}${d.price ? ' / '+d.price+'원' : ''}`]);
    }
    for (const e of exercises) rows.push([e.date, 'exercise', e.durationMin, 'min', e.type || '']);
    rows.sort((a, b) => (a[0] || '').localeCompare(b[0] || ''));
    const csv = rows.map(r => r.map(c => {
      const s = c == null ? '' : String(c);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    downloadBlob(`wimalog-export-${new Date().toISOString().slice(0,10)}.csv`,
                 csv, 'text/csv;charset=utf-8');
  };

  return (
    <div className="max-w-3xl mx-auto bg-white text-black p-8 print:p-4 print:max-w-full doctor-report">
      {/* 화면에만 보이는 컨트롤 */}
      <div className="flex justify-between items-center mb-6 print:hidden flex-wrap gap-2">
        <button onClick={onBack} className="btn-ghost text-sm">← 돌아가기</button>
        <div className="flex gap-2 flex-wrap">
          <button onClick={copyText} className="btn-ghost !py-2 !px-3 text-sm border border-ink-300">
            {copied ? '✓ 복사됨' : '📋 텍스트 요약'}
          </button>
          <button onClick={exportJSON} className="btn-ghost !py-2 !px-3 text-sm border border-ink-300" title="의료인용 — 전체 데이터 JSON (P58)">
            📦 JSON
          </button>
          <button onClick={exportCSV} className="btn-ghost !py-2 !px-3 text-sm border border-ink-300" title="의료인용 — 시점별 합본 CSV">
            📥 CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary !py-2 !px-4 text-sm">
            🖨️ 인쇄 / PDF
          </button>
        </div>
      </div>

      {/* 인쇄용 본문 */}
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold">진료용 요약 리포트</h1>
            <p className="text-sm text-gray-600">위마로그에서 생성 · {new Date().toLocaleDateString('ko-KR')}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            wimalog.kr
          </div>
        </div>
      </header>

      {/* 환자 정보 */}
      <section className="mb-4 doctor-section">
        <h2 className="text-lg font-bold mb-2">기본 정보</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row k="성별/나이대" v={`${user.gender === 'F' ? '여성' : user.gender === 'M' ? '남성' : '비공개'} · ${user.ageGroup}`} />
            <Row k="키" v={`${user.height} cm`} />
            <Row k="시작 체중" v={`${user.startWeight} kg (BMI ${bmi(user.startWeight, user.height)?.toFixed(1)})`} />
            <Row k="목표 체중" v={`${user.targetWeight} kg`} />
            <Row k="동반 질환" v={Object.entries(user.conditions || {}).filter(([,v]) => v).map(([k]) =>
              CONDITIONS.find(c => c.id === k)?.label || k).join(', ') || '없음'} />
          </tbody>
        </table>
      </section>

      {/* 현재 약 */}
      <section className="mb-4 doctor-section">
        <h2 className="text-lg font-bold mb-2">현재 사용 약</h2>
        {activeMeds.length === 0 ? (
          <p className="text-sm text-gray-600">진행 중인 약 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">약</th>
                <th className="text-left py-1">시작일</th>
                <th className="text-right py-1">진행</th>
                <th className="text-right py-1">총 투약</th>
                <th className="text-right py-1">최근 용량</th>
              </tr>
            </thead>
            <tbody>
              {activeMeds.map(c => {
                const cDoses = doses.filter(d => d.courseId === c.id);
                const last = cDoses[cDoses.length - 1];
                const startDate = new Date(c.startDate);
                const weeks = Math.round((Date.now() - startDate.getTime()) / (7 * 86400000));
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1">{MED_BY_ID[c.medication]?.label}</td>
                    <td className="py-1">{c.startDate}</td>
                    <td className="py-1 text-right">{weeks}주차</td>
                    <td className="py-1 text-right">{cDoses.length}회</td>
                    <td className="py-1 text-right">{last?.dose || c.initialDose}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 체중 변화 요약 + 코호트 비교 */}
      {summary && (
        <section className="mb-4 doctor-section">
          <h2 className="text-lg font-bold mb-2">체중 변화</h2>
          <table className="w-full text-sm">
            <tbody>
              <Row k="시작 체중" v={`${summary.startWeight} kg`} />
              <Row k="현재 체중" v={`${summary.currentWeight} kg`} />
              <Row k="총 감량" v={`${summary.lossKg >= 0 ? '-' : '+'}${Math.abs(summary.lossKg).toFixed(1)} kg (${Math.abs(summary.lossPct).toFixed(1)}%)`} />
              <Row k="현재 BMI" v={summary.curBmi?.toFixed(1) || '—'} />
              <Row k="추적 기간" v={`${summary.weeks}주, ${summary.totalLogs}회 기록`} />
              {cohortLossAtMyWeek && (
                <Row k={`코호트 비교 (${cohortLossAtMyWeek.week}주차)`}
                     v={`${MED_BY_ID[primaryCourse.medication]?.label.replace(/\s*\(.+\)/, '')} 사용자 평균 -${cohortLossAtMyWeek.avg.toFixed(1)}% (n=${cohortLossAtMyWeek.n})`} />
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* 체중 추이 SVG 차트 — print에 최적화 */}
      {recentLogs.length >= 2 && (
        <section className="mb-4 doctor-section">
          <h2 className="text-lg font-bold mb-2">체중 추이 (최근 {recentLogs.length}회)</h2>
          <WeightChartPrint logs={recentLogs} target={user.targetWeight} startWeight={user.startWeight} />
        </section>
      )}

      {/* 최근 12개 기록 체중 표 */}
      {recentLogs.length > 0 && (
        <section className="mb-4 doctor-section">
          <h2 className="text-lg font-bold mb-2">상세 기록 ({recentLogs.length}건)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">날짜</th>
                <th className="text-right py-1">체중 (kg)</th>
                <th className="text-right py-1">변화</th>
                <th className="text-left py-1 pl-3">메모</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((l, i) => {
                const prev = i === 0 ? user.startWeight : recentLogs[i - 1].weight;
                const delta = l.weight - prev;
                return (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-1">{l.date}</td>
                    <td className="py-1 text-right">{l.weight}</td>
                    <td className="py-1 text-right">{delta === 0 ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1)}</td>
                    <td className="py-1 pl-3 text-xs">{l.notes || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* 부작용 요약 + 코호트 비교 */}
      {sideAnalysis.length > 0 && (
        <section className="mb-4 doctor-section">
          <h2 className="text-lg font-bold mb-2">최근 기록 보고 부작용 ({recentLogs.length}건 중)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">부작용</th>
                <th className="text-right py-1">본인 발생률</th>
                <th className="text-right py-1">코호트 평균</th>
                <th className="text-right py-1">횟수</th>
              </tr>
            </thead>
            <tbody>
              {sideAnalysis.map(s => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-1">{s.label}</td>
                  <td className="py-1 text-right tabular-nums">{(s.myRate * 100).toFixed(0)}%</td>
                  <td className="py-1 text-right tabular-nums text-gray-600">
                    {s.cohortRate != null ? `${(s.cohortRate * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="py-1 text-right tabular-nums">{s.count}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 운동/생활 */}
      <section className="mb-4 doctor-section">
        <h2 className="text-lg font-bold mb-2">생활 습관 (최근 12주)</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row k="누적 운동 시간" v={`${totalEx12wk}분 (주평균 ${Math.round(totalEx12wk / 12)}분)`} />
            <Row k="운동 기록 횟수" v={`${exercises.filter(e => new Date(e.date).getTime() > Date.now() - 12 * 7 * 86400000).length}회`} />
          </tbody>
        </table>
      </section>

      {/* footer */}
      <footer className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
        <p>본 리포트는 사용자가 직접 기록한 자가보고 데이터로 작성됐습니다. 의학적 판단의 일부 참고용이며, 처방·치료 결정은 의료진의 진단을 따라야 합니다.</p>
        <p className="mt-1">위마로그 (wimalog.kr) · 생성일 {new Date().toISOString().slice(0, 10)}</p>
      </footer>

      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm; }
          html, body { background: white !important; color: black !important; font-size: 11pt; }
          .doctor-report { padding: 0 !important; max-width: 100% !important; }
          .doctor-section { page-break-inside: avoid; break-inside: avoid; }
          .print\\:hidden { display: none !important; }
          /* 인쇄 시 어두운 컬러 강제 → 회색조 친화 */
          .doctor-report, .doctor-report * { color: black !important; }
          .doctor-report table { border-collapse: collapse; }
          .doctor-report th, .doctor-report td { padding: 4px 0; }
          a { color: black !important; text-decoration: none; }
          /* 차트 SVG 인쇄 친화 */
          .doctor-report svg .chart-line { stroke: #000 !important; stroke-width: 1.5; }
          .doctor-report svg .chart-dot { fill: #000 !important; }
          .doctor-report svg .chart-target { stroke: #666 !important; }
          .doctor-report svg text { fill: #444 !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1 text-gray-600 w-2/5">{k}</td>
      <td className="py-1">{v}</td>
    </tr>
  );
}

// Print-friendly SVG 체중 차트 — 단순, 인쇄에 잘 렌더링됨
function WeightChartPrint({ logs, target, startWeight }) {
  const W = 600, H = 180, P = 30;
  const weights = logs.map(l => l.weight);
  const minW = Math.min(...weights, target || Infinity) - 1;
  const maxW = Math.max(...weights, startWeight || -Infinity) + 1;
  const range = maxW - minW || 1;
  const xs = logs.map((_, i) => P + (i / Math.max(1, logs.length - 1)) * (W - P * 2));
  const ys = weights.map(w => H - P - ((w - minW) / range) * (H - P * 2));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* y-axis */}
      <line x1={P} y1={P} x2={P} y2={H - P} stroke="#999" strokeWidth="0.5" />
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#999" strokeWidth="0.5" />
      {/* 목표 체중 line */}
      {target && (
        <>
          <line x1={P} y1={H - P - ((target - minW) / range) * (H - P * 2)}
                x2={W - P} y2={H - P - ((target - minW) / range) * (H - P * 2)}
                className="chart-target" stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="4 3" />
          <text x={W - P} y={H - P - ((target - minW) / range) * (H - P * 2) - 4}
                fontSize="10" textAnchor="end" fill="#64748b">목표 {target}kg</text>
        </>
      )}
      {/* 시작 체중 line */}
      {startWeight && (
        <text x={P + 2} y={H - P - ((startWeight - minW) / range) * (H - P * 2) - 4}
              fontSize="10" fill="#64748b">시작 {startWeight}kg</text>
      )}
      {/* weight line */}
      <path d={path} className="chart-line" stroke="#0f172a" strokeWidth="1.5" fill="none" />
      {/* dots + labels */}
      {logs.map((l, i) => (
        <g key={l.id}>
          <circle cx={xs[i]} cy={ys[i]} r="2.5" className="chart-dot" fill="#0f172a" />
          {(i === 0 || i === logs.length - 1 || i % 2 === 0) && (
            <text x={xs[i]} y={ys[i] - 6} fontSize="9" textAnchor="middle" fill="#0f172a">
              {l.weight.toFixed(1)}
            </text>
          )}
          <text x={xs[i]} y={H - P + 12} fontSize="8" textAnchor="middle" fill="#64748b">
            {l.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
