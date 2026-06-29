import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';
import { snapshotAvgLossCurve } from '../lib/snapshot.js';
import { MED_BY_ID } from '../lib/constants.js';

// 마일스톤 카드 — 1주/2주/4주/12주/24주/52주 시점에 의미있는 보상 메시지
// 가입 직후 빈 대시보드의 페널티 해소 + 누적 데이터 가치 인지
export function MilestoneCard({ user, navigate }) {
  const data = useMemo(() => {
    if (!user?.createdAt) return null;
    const logs = Storage.getLogsByUser(user.id);
    const doses = Storage.getDosesByUser(user.id);
    const courses = Storage.getMedCoursesByUser(user.id);
    const exercises = Storage.getExercisesByUser(user.id);

    // 가입 후 경과 일 (가입 당일 = 0)
    const ageDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
    // 0일도 표시 — 가입 직후 첫 인상 보상

    // 현재 체중
    const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const startWeight = sortedLogs[0]?.weight || user.startWeight;
    const currentWeight = sortedLogs[sortedLogs.length - 1]?.weight || startWeight;
    const lostKg = startWeight ? startWeight - currentWeight : 0;
    const lostPct = startWeight ? (lostKg / startWeight) * 100 : 0;

    // 활성 약 코스
    const activeCourse = courses.find(c => !c.endDate);
    let cohortAvgPct = null;
    let cohortN = null;
    if (activeCourse?.medication) {
      // 본인 진행 주차 가까운 코호트 평균
      const weeks = Math.max(1, Math.floor(ageDays / 7));
      const closestWeeks = [4, 8, 12, 16, 24, 36, 48];
      const matchWeek = closestWeeks.reduce((best, w) =>
        Math.abs(w - weeks) < Math.abs(best - weeks) ? w : best, 12);
      const curve = snapshotAvgLossCurve(activeCourse.medication, [matchWeek]);
      if (curve?.[0]?.avg != null) {
        cohortAvgPct = curve[0].avg;
        cohortN = curve[0].n;
      }
    }

    // 운동 / 약 카운트
    const exMins = exercises.reduce((s, e) => s + (e.durationMin || 0), 0);
    const doseCount = doses.length;

    return {
      ageDays, ageWeeks: Math.floor(ageDays / 7),
      startWeight, currentWeight, lostKg, lostPct,
      logCount: logs.length, doseCount, exMins,
      activeCourse, cohortAvgPct, cohortN,
    };
  }, [user]);

  if (!data) return null;
  const { ageDays, ageWeeks, lostKg, lostPct, logCount, doseCount, exMins, activeCourse, cohortAvgPct, cohortN } = data;

  // 마일스톤 결정
  const milestone = pickMilestone(ageDays);
  if (!milestone) return null;

  // 코호트 비교 한 줄
  const cohortMsg = cohortAvgPct != null && cohortN >= 5 && lostPct !== 0 ? (() => {
    const myAbsPct = Math.abs(lostPct);
    const cohortAbs = Math.abs(cohortAvgPct);
    if (myAbsPct > cohortAbs * 1.1) return { tone: 'good', text: '비슷한 사용자 평균보다 빠른 페이스' };
    if (myAbsPct < cohortAbs * 0.7) return { tone: 'slow', text: '비슷한 사용자 평균보다 느린 페이스 (정상 범위)' };
    return { tone: 'normal', text: '비슷한 사용자 평균 페이스' };
  })() : null;

  const toneClass = {
    good: 'text-emerald-700 dark:text-emerald-400',
    slow: 'text-amber-700 dark:text-amber-400',
    normal: 'text-ink-700 dark:text-slate-300',
  };

  return (
    <section className={`card border-l-4 ${milestone.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0">{milestone.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-500">
            {milestone.label}
          </div>
          <div className="text-base sm:text-lg font-bold text-ink-900 dark:text-slate-100 mt-0.5">
            {milestone.title.replace('{weeks}', String(ageWeeks)).replace('{days}', String(ageDays))}
          </div>
          {/* 핵심 수치 — 누적 감량 */}
          {lostKg !== 0 && (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <span>
                누적 <b className={`tabular-nums ${lostKg > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {lostKg > 0 ? '−' : '+'}{Math.abs(lostKg).toFixed(1)} kg
                </b>
                <span className="ml-1 text-ink-500">({Math.abs(lostPct).toFixed(1)}%)</span>
              </span>
              {activeCourse && (
                <span className="text-ink-500">
                  {MED_BY_ID[activeCourse.medication]?.label.replace(/\s*\(.+\)/, '')} {ageWeeks}주차
                </span>
              )}
            </div>
          )}
          {/* 코호트 비교 */}
          {cohortMsg && (
            <div className={`mt-1 text-xs ${toneClass[cohortMsg.tone]}`}>
              {cohortMsg.tone === 'good' && '✨ '}
              {cohortMsg.text}
              <span className="text-ink-500 dark:text-slate-500 ml-1">
                · 비슷한 사용자 {cohortN}명 평균 -{Math.abs(cohortAvgPct).toFixed(1)}%
              </span>
            </div>
          )}
          {/* 누적 활동 */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500 dark:text-slate-500">
            <span>📝 체중 기록 <b className="text-ink-700 dark:text-slate-300">{logCount}회</b></span>
            {doseCount > 0 && <span>💉 투약 <b className="text-ink-700 dark:text-slate-300">{doseCount}회</b></span>}
            {exMins > 0 && <span>🏃 운동 <b className="text-ink-700 dark:text-slate-300">{exMins}분</b></span>}
          </div>
          {/* 격려 카피 */}
          <p className="mt-2 text-xs text-ink-600 dark:text-slate-400 leading-relaxed">
            {milestone.message}
          </p>
          {/* 콘텐츠 엔진 — 의미있는 감량(≥1kg) 달성 시 응원 작성 유도.
              감정적 고점에서 한마디를 남기게 해 wall을 자생적으로 채운다. */}
          {lostKg >= 1 && (
            <button
              onClick={() => {
                document.getElementById('encouragement-wall')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { try { window.dispatchEvent(new CustomEvent('wimalog:encourage-focus')); } catch {} }, 350);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/30 transition">
              💬 −{Math.abs(lostKg).toFixed(1)}kg 달성! 같은 길 걷는 분들께 한마디
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// 마일스톤 시점 — 가입 후 일수
function pickMilestone(ageDays) {
  if (ageDays === 0) {
    return { label: '환영', icon: '🌱', borderColor: 'border-brand-400',
      title: '오늘 위마로그 시작',
      message: '오른쪽 위 빠른 기록에서 체중을 입력해 보세요. 매일 30초만 투자해도 1주차부터 본인 트렌드가 보이기 시작합니다.' };
  }
  if (ageDays <= 1) {
    return { label: '1일째', icon: '🌱', borderColor: 'border-brand-400',
      title: '첫 기록을 시작했네요',
      message: '내일도 같은 시간에 체중 한 번 기록하면 첫 변화 추이가 보입니다.' };
  }
  if (ageDays <= 7) {
    return { label: `${ageDays}일째`, icon: '✨', borderColor: 'border-emerald-400',
      title: '첫 주 진행 중',
      message: '데이터가 누적되면 나와 비슷한 사용자와의 비교가 의미있어집니다. 매일 체중 기록을 유지해 주세요.' };
  }
  if (ageDays <= 14) {
    return { label: '1주 + α', icon: '🌿', borderColor: 'border-emerald-500',
      title: '1주차 완료 — 패턴이 보이기 시작',
      message: '부작용 인사이트 위젯이 의미있는 비교를 시작할 수 있습니다. 통계 페이지의 본인 vs 비슷한 사용자 차트를 확인해 보세요.' };
  }
  if (ageDays <= 30) {
    return { label: '한 달', icon: '📊', borderColor: 'border-amber-500',
      title: '1달 누적 — 진료 리포트 준비됨',
      message: '진료용 PDF를 출력해 다음 진료 때 의사에게 보여줄 수 있습니다. 프로필 → 진료용 리포트.' };
  }
  if (ageDays <= 90) {
    return { label: '3개월', icon: '🎯', borderColor: 'border-brand-500',
      title: '3개월 — 비슷한 사용자 비교가 가장 정확해지는 시점',
      message: '12주차 비슷한 사용자 평균과의 비교로 본인 페이스 객관화 가능. 중단 고려 시 통계 페이지의 본인 맞춤 예측을 확인하세요.' };
  }
  if (ageDays <= 180) {
    return { label: '6개월', icon: '🏆', borderColor: 'border-amber-600',
      title: '6개월 — 효과 평가 시점',
      message: '대부분의 임상 가이드는 6개월 시점에 5% 이상 감량을 효과 기준으로 봅니다. 유지 vs 중단 결정을 의사와 상의해 보세요.' };
  }
  if (ageDays <= 365) {
    return { label: '1년', icon: '🌟', borderColor: 'border-brand-500',
      title: '1년 — 장기 사용자 데이터 자산',
      message: '1년 누적 데이터는 본인의 가장 정확한 referrence가 됩니다. 유지 용량 검토 또는 단계적 중단 시나리오를 통계 페이지에서 시뮬레이션하세요.' };
  }
  return { label: `${Math.floor(ageDays / 365)}년+`, icon: '🌟', borderColor: 'border-brand-500',
    title: '장기 사용자 — 깊은 데이터 자산',
    message: '1년+ 누적 데이터를 보유한 사용자입니다. 의사와 함께 장기 전략을 검토해 보세요.' };
}
