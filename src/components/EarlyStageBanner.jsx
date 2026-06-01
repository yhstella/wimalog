import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';

// 시작 용량 단계 사용자에게 "정상 범위" 위로 메시지 — P42·P50 페르소나.
// 4주 0kg, 1주 식욕 변화 미미 등은 시작 용량(0.25mg/2.5mg/0.6mg)에서 정상.
// 신규 사용자가 이탈하기 전에 위로 + 동기 부여.
export function EarlyStageBanner({ user }) {
  const data = useMemo(() => {
    const courses = Storage.getMedCoursesByUser(user.id);
    const active = courses.find(c => !c.endDate);
    if (!active) return null;

    const med = MED_BY_ID[active.medication];
    const doses = Storage.getDosesByCourse(active.id);
    const lastDose = doses[doses.length - 1];
    const currentDose = lastDose?.dose || active.initialDose;
    const isStartDose = med?.doses?.[0] === currentDose;
    if (!isStartDose) return null; // 시작 용량 아니면 banner 안 보임

    const courseStart = Date.parse(active.startDate);
    // 미래 날짜 코스(예: 곧 시작 예정)는 0주 처리. 음수 weeksUsing은 banner 의미 없음.
    const weeksUsing = Math.max(0, Math.floor((Date.now() - courseStart) / (7 * 86400000)));
    if (weeksUsing > 5) return null; // 5주 넘으면 시작 용량 단계 아님

    // 본인 감량 (시작 체중 - 최신 체중)
    const logs = Storage.getLogsByUser(user.id);
    const sorted = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const baseline = sorted[0]?.weight || user.startWeight;
    const current = sorted[sorted.length - 1]?.weight || baseline;
    const lostKg = baseline - current;

    return {
      medLabel: med?.label.replace(/\s*\(.+\)/, '') || '약',
      currentDose,
      weeksUsing,
      lostKg,
    };
  }, [user]);

  if (!data) return null;

  const { medLabel, currentDose, weeksUsing, lostKg } = data;
  // 메시지 결정
  let icon = '🌱';
  let title, body;
  if (weeksUsing <= 1) {
    title = '시작 첫 주는 큰 변화를 기대하지 마세요';
    body = `시작 용량(${currentDose})은 적응을 위한 단계 — 식욕 변화가 거의 없거나 부작용만 있는 게 정상입니다. 4주차에 증량하면 그때부터 본격적 감량이 시작돼요.`;
  } else if (weeksUsing <= 4) {
    if (lostKg < 1) {
      title = '4주 0~1kg은 정상 범위';
      body = `시작 용량(${currentDose})에서 4주 0~1kg 감량은 70% 사용자가 경험하는 정상 범위입니다. 좌절하지 마세요 — 증량 후 본격 감량이 옵니다.`;
    } else {
      icon = '✨';
      title = `${lostKg.toFixed(1)} kg 감량 — 시작 단계로는 좋은 추세`;
      body = `${currentDose} ${weeksUsing}주차에 ${lostKg.toFixed(1)} kg은 평균 이상의 반응입니다. 증량 시 더 가속될 수 있어요.`;
    }
  } else {
    title = '증량 시점이 가까워졌어요';
    body = `${medLabel} 표준 일정상 4주 후 증량 권장. 부작용이 견딜 만하다면 의사와 다음 단계 상의.`;
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/15 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/40 p-4 flex items-start gap-3">
      <div className="text-3xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">{title}</div>
        <p className="text-xs text-ink-700 dark:text-slate-300 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
