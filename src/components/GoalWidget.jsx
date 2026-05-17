import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';

export function GoalWidget({ user, navigate }) {
  const logs = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);

  const calc = useMemo(() => {
    if (logs.length < 2) return null;
    const last = logs[logs.length - 1];
    const remaining = +(last.weight - user.targetWeight).toFixed(1);
    if (remaining <= 0) return { done: true, remaining: 0 };

    const oneMonthAgo = Date.now() - 28 * 86400000;
    const recent = logs.filter(l => Date.parse(l.date) >= oneMonthAgo);
    if (recent.length < 2) return { done: false, remaining, weeksAhead: null };

    const first = recent[0];
    const days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
    if (days < 7) return { done: false, remaining, weeksAhead: null };

    const weeklyLoss = (first.weight - last.weight) / (days / 7);
    if (weeklyLoss <= 0.05) return { done: false, remaining, weeksAhead: null, stalling: true };

    const weeksAhead = Math.ceil(remaining / weeklyLoss);
    const targetDate = new Date(Date.now() + weeksAhead * 7 * 86400000);
    return {
      done: false,
      remaining,
      weeklyLoss: +weeklyLoss.toFixed(2),
      weeksAhead,
      targetDate: targetDate.toISOString().slice(0, 10),
      monthsAhead: +(weeksAhead / 4.33).toFixed(1),
    };
  }, [logs, user]);

  if (!calc) {
    return (
      <div className="card !p-4">
        <div className="font-bold text-ink-900 dark:text-slate-100">🎯 목표까지 얼마나?</div>
        <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
          체중 기록이 더 쌓이면 예상 도달일을 계산해 드려요
        </p>
        <button onClick={() => navigate('records')} className="btn-primary !py-2 !px-3 text-sm mt-3">
          체중 기록하기
        </button>
      </div>
    );
  }

  if (calc.done) {
    return (
      <div className="card !p-4 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="font-bold flex items-center gap-2">🎉 목표 달성!</div>
        <p className="text-sm mt-1 opacity-90">
          목표 체중 {user.targetWeight} kg에 도달했습니다. 유지 단계 가이드를 확인하세요.
        </p>
        <button onClick={() => navigate('guide/after-stop')}
                className="mt-3 inline-flex items-center rounded-lg bg-white text-brand-700 px-3 py-1.5 text-sm font-semibold">
          유지 가이드 →
        </button>
      </div>
    );
  }

  if (calc.stalling) {
    return (
      <div className="card !p-4 border border-amber-300 dark:border-amber-700">
        <div className="font-bold text-ink-900 dark:text-slate-100">🎯 목표까지 {calc.remaining} kg</div>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          최근 4주 감량 속도가 거의 멈춰 있어요 (주당 0.05kg 미만).
        </p>
        <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
          식이 + 운동 점검, 의료진과 용량 상의를 권장합니다.
        </p>
      </div>
    );
  }

  if (calc.weeksAhead == null) {
    return (
      <div className="card !p-4">
        <div className="font-bold text-ink-900 dark:text-slate-100">🎯 목표까지 {calc.remaining} kg</div>
        <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
          최근 4주 기록이 더 쌓이면 예상 도달일을 계산해 드려요
        </p>
      </div>
    );
  }

  return (
    <div className="card !p-4 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 border border-brand-200 dark:border-brand-800/40">
      <div className="font-bold text-ink-900 dark:text-slate-100 flex items-center justify-between">
        <span>🎯 목표 도달까지</span>
        <span className="text-xs font-normal text-ink-500 dark:text-slate-400">최근 4주 속도 기준</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-brand-700 dark:text-brand-400 tabular-nums">
          약 {calc.monthsAhead}개월
        </div>
        <div className="text-sm text-ink-500 dark:text-slate-400">({calc.weeksAhead}주)</div>
      </div>
      <div className="text-sm text-ink-700 dark:text-slate-300 mt-1">
        예상 도달일 <b className="tabular-nums">{calc.targetDate}</b>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
          <div className="text-ink-500 dark:text-slate-400">남은 양</div>
          <div className="font-bold text-ink-900 dark:text-slate-100 tabular-nums">{calc.remaining} kg</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
          <div className="text-ink-500 dark:text-slate-400">주 평균</div>
          <div className="font-bold text-ink-900 dark:text-slate-100 tabular-nums">{calc.weeklyLoss} kg</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
          <div className="text-ink-500 dark:text-slate-400">목표</div>
          <div className="font-bold text-ink-900 dark:text-slate-100 tabular-nums">{user.targetWeight} kg</div>
        </div>
      </div>
      <p className="text-[10px] text-ink-500 dark:text-slate-500 mt-2">
        ⚠ 약 효과는 점차 둔해질 수 있어 후반엔 더 오래 걸릴 수 있어요.
      </p>
    </div>
  );
}
