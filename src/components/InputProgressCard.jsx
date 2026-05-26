import React, { useMemo } from 'react';
import { inputDepth } from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';
import { calculateAccuracy } from '../lib/accuracy.js';

// 랜딩 Simulator와 동일 sessionStorage 키 — 같은 시뮬레이터 입력값 공유
const SIM_PREFILL_KEY = 'wimalog_sim_prefill';

// 완료된 각 마일스톤에 본인 데이터 요약 — '입력하면 무엇이 달라졌나' 시각화
function buildUnlockedSummary(user) {
  if (!user) return {};
  const logs = Storage.getLogsByUser(user.id);
  const courses = Storage.getMedCoursesByUser(user.id);
  const doses = Storage.getDosesByUser(user.id);
  const exercises = Storage.getExercisesByUser(user.id);
  const diets = Storage.getDietsByUser(user.id);
  const health = Storage.getHealthMetricsByUser(user.id);
  const inbody = health.filter(h => h.category === 'inbody');
  const blood = health.filter(h => h.category === 'blood');
  const bp = health.filter(h => h.category === 'bp');
  const alcohol = health.filter(h => h.category === 'alcohol');
  const sleep = health.filter(h => h.category === 'sleep');

  const lastLog = logs[logs.length - 1];
  const lossKg = lastLog && user.startWeight ? user.startWeight - lastLog.weight : null;
  const activeMed = courses.find(c => !c.endDate) || courses[0];

  // 최근 8주 운동 시간 평균
  const cutoffMs = Date.now() - 56 * 86400000;
  const recentEx = exercises.filter(e => Date.parse(e.date) >= cutoffMs);
  const weeklyExMin = recentEx.length
    ? Math.round(recentEx.reduce((s, e) => s + (e.durationMin || 0), 0) / 8)
    : 0;
  const exTypes = new Set(exercises.map(e => e.type)).size;

  // 평균 단백질
  const avgProtein = diets.length
    ? Math.round(diets.filter(d => d.proteinG).reduce((s, d) => s + d.proteinG, 0) / Math.max(1, diets.filter(d => d.proteinG).length))
    : 0;

  // 평균 가격
  const dosesWithPrice = doses.filter(d => d.price);
  const avgPrice = dosesWithPrice.length
    ? Math.round(dosesWithPrice.reduce((s, d) => s + d.price, 0) / dosesWithPrice.length / 10000)
    : 0;

  // 최신 인바디
  const lastInbody = inbody[inbody.length - 1];
  const lastBlood = blood[blood.length - 1];
  const lastBp = bp[bp.length - 1];
  const lastAlcohol = alcohol[alcohol.length - 1];
  const lastSleep = sleep[sleep.length - 1];

  return {
    weight: lossKg != null ? `시작 ${user.startWeight}kg → 현재 ${lastLog.weight}kg (${lossKg >= 0 ? '-' : '+'}${Math.abs(lossKg).toFixed(1)} kg) · 본인 추세선 차트에 표시` : null,
    course: activeMed ? `${MED_BY_ID[activeMed.medication]?.label.replace(/\s*\(.+\)/, '')} 사용자 코호트와 비교 중` : null,
    dose: avgPrice ? `평균 ${avgPrice}만원/회 · ${dosesWithPrice.length}건 기준 · 지역별 비교 가능` : (doses.length ? `${doses.length}회 투약 · 가격 입력하면 비용 비교 활성화` : null),
    exercise: weeklyExMin ? `주당 평균 ${weeklyExMin}분 (${exTypes}종) · 비슷한 운동량 사용자와 감량률 비교` : null,
    diet: avgProtein ? `평균 단백질 ${avgProtein}g · 투약 직후 vs 평소 식이 비교 활성화` : (diets.length ? `${diets.length}회 식단 · 단백질도 입력하면 분석 활성화` : null),
    inbody: lastInbody ? `체지방 ${lastInbody.bodyFatPct}% · 근육 ${lastInbody.muscleKg}kg · 마른비만 분석 활성화` : null,
    blood: lastBlood ? `ALT ${lastBlood.alt || '?'} · HbA1c ${lastBlood.hba1c || '?'}% · 지방간 코호트 비교 중` : null,
    bp: lastBp ? `${lastBp.sbp}/${lastBp.dbp} mmHg · 대사증후군 동반자 코호트 비교 중` : null,
    alcohol: lastAlcohol ? `주 ${lastAlcohol.drinksPerWeek || 0}잔 · 갈망 변화 추적 중` : null,
    sleep: lastSleep ? `평균 ${lastSleep.sleepHours}시간 · 스트레스 vs 정체기 상관 분석` : null,
    history: logs.length >= 12 ? `12주차 본인 추이 차트에 표시 (총 ${logs.length}회 기록)` : null,
  };
}

// visitPurpose별 안내 문구
const PURPOSE_HINT = {
  using:      '약 사용 데이터가 정확할수록 본인 코호트 매칭이 정밀해져요',
  planning:   '시작 전 baseline(인바디·식단·운동)을 기록하면 변화 측정이 정확해져요',
  stopped:    '운동·식단을 기록하면 중단 후 유지 패턴이 비슷한 사용자를 자동 매칭해요',
  sideeffect: '수면·혈압·음주를 함께 기록하면 부작용 원인 패턴 분석이 가능해져요',
};

// 입력 깊이에 따라 잠금 해제되는 인사이트를 보여주는 카드.
// visitPurpose별 우선순위로 다음 액션 노출 → 사용자가 가장 유용한 데이터부터 채우게 유도
export function InputProgressCard({ user, navigate }) {
  const data = useMemo(() => inputDepth(user), [user]);
  const unlocked = useMemo(() => buildUnlockedSummary(user), [user]);
  // 통합 정확도 — /stats 페이지의 AIPredictionPanel과 동일 수치 사용
  const accuracy = useMemo(() => {
    let sim = {};
    try {
      const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
      if (raw) sim = JSON.parse(raw) || {};
    } catch {}
    return calculateAccuracy({ user, simulator: sim }).score;
  }, [user]);
  if (!user) return null;

  const completed = data.milestones.filter(m => m.done >= m.need);
  const remaining = data.milestones.filter(m => m.done < m.need);
  const allDone = remaining.length === 0;

  // 다음 3개 마일스톤 노출 (visitPurpose 우선순위 적용된 순서)
  const nextThree = remaining.slice(0, 3);
  const purposeHint = PURPOSE_HINT[user.visitPurpose] || PURPOSE_HINT.using;

  return (
    <div className="card border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-900/20 dark:via-slate-900 dark:to-slate-900">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h2 className="font-bold text-ink-900 dark:text-slate-100">AI 예측 정확도</h2>
          </div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
            {allDone
              ? '모든 데이터가 입력됐어요. 본인 코호트 매칭이 가장 정밀한 수준입니다.'
              : purposeHint}
          </p>
        </div>
        <button onClick={() => navigate?.('stats')} className="text-right flex-shrink-0 group">
          <div className="text-3xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400 group-hover:text-brand-700">
            {accuracy}<span className="text-base">%</span>
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500 group-hover:underline">
            AI 예측 페이지 →
          </div>
        </button>
      </div>

      {/* 진행 바 — 통합 정확도 50~90 범위 기준 */}
      <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
             style={{ width: `${accuracy}%` }} />
      </div>

      {/* 다음 잠금 해제 — visitPurpose 우선순위로 정렬된 3개 */}
      {nextThree.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 uppercase tracking-wider">
            다음 입력 단계
          </div>
          {nextThree.map(m => {
            const left = Math.max(0, m.need - m.done);
            const pct = Math.min(100, (m.done / m.need) * 100);
            return (
              <button key={m.key}
                      onClick={() => navigate?.('records')}
                      className="w-full text-left rounded-xl bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition border border-ink-200 dark:border-slate-700 hover:border-brand-300 p-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink-900 dark:text-slate-100">
                        {m.label} <span className="text-brand-700 dark:text-brand-400">{left}회 더</span>
                      </span>
                    </div>
                    <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">
                      → {m.unlocks}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-ink-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums flex-shrink-0">
                        {m.done}/{m.need}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 잠금 해제된 인사이트 — 본인 데이터로 무엇이 보이는지 카드로 표시 */}
      {completed.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2">
            ✓ 잠금 해제됨 — 본인 데이터로 보이는 것
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {completed.map(m => {
              const summary = unlocked[m.key];
              return (
                <div key={m.key}
                     className="rounded-lg bg-emerald-50/70 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                  {summary && (
                    <div className="text-[11px] text-ink-700 dark:text-slate-300 mt-1 leading-relaxed">
                      {summary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
