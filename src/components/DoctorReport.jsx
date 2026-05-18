import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';
import { bmi, personalSummary } from '../lib/stats.js';

// 진료용 리포트 — print에 최적화된 한 페이지 요약. 브라우저 인쇄 → PDF 저장.
export function DoctorReport({ user, onBack }) {
  const logs = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id]);
  const doses = useMemo(() => Storage.getDosesByUser(user.id), [user.id]);
  const exercises = useMemo(() => Storage.getExercisesByUser(user.id), [user.id]);

  const summary = personalSummary(user, logs);
  const activeMeds = courses.filter(c => !c.endDate);
  const last12Weeks = logs.slice(-12);

  // 부작용 합계 (최근 12주)
  const sideCounts = {};
  for (const l of last12Weeks) {
    for (const [k, v] of Object.entries(l.sideEffects || {})) {
      if (v) sideCounts[k] = (sideCounts[k] || 0) + 1;
    }
  }
  const topSides = Object.entries(sideCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalEx12wk = exercises.slice(-84 * 7 /* approx */).reduce((s, e) => s + (e.durationMin || 0), 0);

  return (
    <div className="max-w-3xl mx-auto bg-white text-black p-8 print:p-4 print:max-w-full">
      {/* 화면에만 보이는 컨트롤 */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button onClick={onBack} className="btn-ghost text-sm">← 돌아가기</button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-primary !py-2 !px-4 text-sm">
            🖨️ 인쇄 (PDF 저장)
          </button>
        </div>
      </div>

      {/* 인쇄용 본문 */}
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold">진료용 12주 리포트</h1>
            <p className="text-sm text-gray-600">위마로그에서 생성 · {new Date().toLocaleDateString('ko-KR')}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            wimalog.kr
          </div>
        </div>
      </header>

      {/* 환자 정보 */}
      <section className="mb-4">
        <h2 className="text-lg font-bold mb-2">기본 정보</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row k="성별/나이대" v={`${user.gender === 'F' ? '여성' : user.gender === 'M' ? '남성' : '비공개'} · ${user.ageGroup}`} />
            <Row k="키" v={`${user.height} cm`} />
            <Row k="시작 체중" v={`${user.startWeight} kg (BMI ${bmi(user.startWeight, user.height)?.toFixed(1)})`} />
            <Row k="목표 체중" v={`${user.targetWeight} kg`} />
            <Row k="동반 질환" v={Object.entries(user.conditions || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || '없음'} />
          </tbody>
        </table>
      </section>

      {/* 현재 약 */}
      <section className="mb-4">
        <h2 className="text-lg font-bold mb-2">현재 사용 약</h2>
        {activeMeds.length === 0 ? (
          <p className="text-sm text-gray-600">진행 중인 약 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">약</th>
                <th className="text-left py-1">시작일</th>
                <th className="text-right py-1">총 투약</th>
                <th className="text-right py-1">최근 용량</th>
              </tr>
            </thead>
            <tbody>
              {activeMeds.map(c => {
                const cDoses = doses.filter(d => d.courseId === c.id);
                const last = cDoses[cDoses.length - 1];
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1">{MED_BY_ID[c.medication]?.label}</td>
                    <td className="py-1">{c.startDate}</td>
                    <td className="py-1 text-right">{cDoses.length}회</td>
                    <td className="py-1 text-right">{last?.dose || c.initialDose}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 체중 변화 요약 */}
      {summary && (
        <section className="mb-4">
          <h2 className="text-lg font-bold mb-2">체중 변화</h2>
          <table className="w-full text-sm">
            <tbody>
              <Row k="시작 체중" v={`${summary.startWeight} kg`} />
              <Row k="현재 체중" v={`${summary.currentWeight} kg`} />
              <Row k="총 감량" v={`${summary.lossKg >= 0 ? '-' : '+'}${Math.abs(summary.lossKg).toFixed(1)} kg (${Math.abs(summary.lossPct).toFixed(1)}%)`} />
              <Row k="현재 BMI" v={summary.curBmi?.toFixed(1) || '—'} />
              <Row k="추적 기간" v={`${summary.weeks}주, ${summary.totalLogs}회 기록`} />
            </tbody>
          </table>
        </section>
      )}

      {/* 최근 12주 체중 기록 표 */}
      {last12Weeks.length > 0 && (
        <section className="mb-4">
          <h2 className="text-lg font-bold mb-2">최근 체중 기록 ({last12Weeks.length}건)</h2>
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
              {last12Weeks.map((l, i) => {
                const prev = i === 0 ? user.startWeight : last12Weeks[i - 1].weight;
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

      {/* 부작용 요약 */}
      {topSides.length > 0 && (
        <section className="mb-4">
          <h2 className="text-lg font-bold mb-2">최근 12주 보고 부작용</h2>
          <table className="w-full text-sm">
            <tbody>
              {topSides.map(([k, count]) => (
                <Row key={k} k={k} v={`${count}회 보고`} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 운동/생활 */}
      <section className="mb-4">
        <h2 className="text-lg font-bold mb-2">생활 습관</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row k="누적 운동 시간 (12주)" v={`${totalEx12wk}분 (주 ${Math.round(totalEx12wk / 12)}분)`} />
            <Row k="운동 기록 횟수" v={`${exercises.length}회`} />
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
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
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
