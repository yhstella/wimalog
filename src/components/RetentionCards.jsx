import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';

// Streak + Weekly Summary + Badges — 리텐션 시스템
// 매일 기록을 유도하고 성취감을 부여

export function StreakCard({ user, navigate }) {
  const streak = useMemo(() => calcStreak(user.id), [user.id]);
  if (streak.current === 0) {
    return (
      <div className="card !p-4 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border border-amber-200 dark:border-amber-900/40">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div className="flex-1">
            <div className="font-bold text-ink-900 dark:text-slate-100">기록 스트릭을 시작해 보세요</div>
            <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">매일 체중을 기록하면 정확한 진척도를 볼 수 있어요</div>
          </div>
          <button onClick={() => navigate('records')} className="btn-primary !py-2 !px-3 text-xs">
            오늘 기록 →
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="card !p-4 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border border-amber-200 dark:border-amber-900/40">
      <div className="flex items-center gap-3">
        <div className="text-4xl animate-pulseGentle">🔥</div>
        <div className="flex-1">
          <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 tabular-nums">
            {streak.current}일 연속
          </div>
          <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
            최장 {streak.longest}일 · 이번 주 {streak.thisWeekDays}일 기록
          </div>
        </div>
        {streak.current >= 7 && (
          <span className="chip-brand">{streak.current >= 30 ? '🏆 한 달!' : '🎉 1주!'}</span>
        )}
      </div>
    </div>
  );
}

function calcStreak(userId) {
  const logs = Storage.getLogsByUser(userId);
  if (!logs.length) return { current: 0, longest: 0, thisWeekDays: 0 };

  const uniqueDays = [...new Set(logs.map(l => l.date))].sort();

  // 현재 연속 (오늘부터 거꾸로)
  const today = new Date(); today.setHours(0,0,0,0);
  let current = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (uniqueDays.includes(d)) current++;
    else break;
  }
  // 최장
  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]).getTime();
    const cur  = new Date(uniqueDays[i]).getTime();
    if (cur - prev === 86400000) {
      run++; if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  // 이번 주
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const thisWeekDays = uniqueDays.filter(d => d >= weekAgo).length;
  return { current, longest, thisWeekDays };
}

// 주간 요약 — "이번 주 기록 / 변화 / 부작용 / 운동"
export function WeeklySummaryCard({ user, navigate }) {
  const summary = useMemo(() => calcWeeklySummary(user.id, user), [user.id, user]);
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="section-title">이번 주 요약</h2>
          <p className="section-subtitle">최근 7일 활동</p>
        </div>
        <button onClick={() => navigate('records')} className="btn-ghost text-xs">+ 더 기록</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumTile label="체중 변화" value={summary.weightChange != null
          ? `${summary.weightChange >= 0 ? '+' : ''}${summary.weightChange.toFixed(1)} kg`
          : '—'}
          tone={summary.weightChange != null && summary.weightChange < 0 ? 'brand' : 'neutral'} />
        <SumTile label="체중 기록" value={`${summary.weightLogs}회`} />
        <SumTile label="운동 시간" value={`${summary.exMinutes}분`} sub={`${summary.exSessions}회`} />
        <SumTile label="투약" value={`${summary.doses}회`} />
      </div>
      {summary.tip && (
        <div className="mt-3 text-sm text-ink-700 dark:text-slate-300 rounded-xl bg-brand-50 dark:bg-brand-900/20 px-3 py-2">
          💡 {summary.tip}
        </div>
      )}
    </div>
  );
}

function SumTile({ label, value, sub, tone }) {
  return (
    <div className={`rounded-xl p-3 ${tone === 'brand' ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-ink-100/50 dark:bg-slate-800'}`}>
      <div className="text-[10px] text-ink-500 dark:text-slate-400">{label}</div>
      <div className={`text-xl font-extrabold tabular-nums mt-0.5 ${tone === 'brand' ? 'text-brand-700 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

function calcWeeklySummary(userId, user) {
  const now = Date.now();
  const weekAgoMs = now - 7 * 86400000;
  const weekAgoStr = new Date(weekAgoMs).toISOString().slice(0, 10);

  const logs = Storage.getLogsByUser(userId).filter(l => l.date >= weekAgoStr);
  const exercises = Storage.getExercisesByUser(userId).filter(e => e.date >= weekAgoStr);
  const doses = Storage.getDosesByUser(userId).filter(d => d.date >= weekAgoStr);

  let weightChange = null;
  if (logs.length >= 2) {
    weightChange = logs[logs.length - 1].weight - logs[0].weight;
  } else if (logs.length === 1 && user.startWeight) {
    weightChange = logs[0].weight - user.startWeight;
  }
  const exMinutes = exercises.reduce((s, e) => s + (e.durationMin || 0), 0);

  // 인사이트 tip
  let tip = null;
  if (weightChange != null && weightChange > 0.5) {
    tip = '체중이 올랐어요. 식이·수면·스트레스 점검 + 운동 +20분 권장';
  } else if (weightChange != null && weightChange < -0.5) {
    tip = '좋은 페이스! 단백질 충분히 + 수분 늘려 근손실 방지';
  } else if (exMinutes < 60 && doses.length > 0) {
    tip = '약 효과를 극대화하려면 주 150분 운동을 목표로';
  } else if (logs.length < 3) {
    tip = '체중을 더 자주 기록하면 정체기/효과를 빨리 감지할 수 있어요';
  }

  return {
    weightChange,
    weightLogs: logs.length,
    exMinutes,
    exSessions: exercises.length,
    doses: doses.length,
    tip,
  };
}

// 배지 시스템 — 단순한 성취감
export function BadgesRow({ user }) {
  const badges = useMemo(() => calcBadges(user.id), [user.id]);
  if (!badges.length) return null;
  return (
    <div className="card !p-3">
      <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">🏅 획득한 배지</div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {badges.map(b => (
          <div key={b.id} className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/30">
            <div className="text-xl">{b.icon}</div>
            <div className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 mt-0.5">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calcBadges(userId) {
  const logs = Storage.getLogsByUser(userId);
  const exercises = Storage.getExercisesByUser(userId);
  const courses = Storage.getMedCoursesByUser(userId);
  const doses = Storage.getDosesByUser(userId);

  const badges = [];
  if (logs.length >= 1) badges.push({ id: 'first-log', icon: '✏️', label: '첫 기록' });
  if (logs.length >= 7) badges.push({ id: 'week', icon: '📅', label: '1주 기록' });
  if (logs.length >= 30) badges.push({ id: 'month', icon: '🗓️', label: '한 달' });
  if (courses.length >= 1) badges.push({ id: 'med', icon: '💊', label: '약 시작' });
  if (doses.length >= 4) badges.push({ id: 'consistent-dose', icon: '🎯', label: '꾸준한 투약' });
  if (exercises.length >= 10) badges.push({ id: 'mover', icon: '🏃', label: '활동가' });

  const streak = calcStreak(userId);
  if (streak.current >= 7) badges.push({ id: 'streak7', icon: '🔥', label: '7일 연속' });
  if (streak.current >= 30) badges.push({ id: 'streak30', icon: '⚡', label: '30일 연속' });

  return badges;
}

// 중단자 전용 패널 — 회복률 추적 + 운동 권장
export function DiscontinuerPanel({ user, navigate }) {
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id]);
  const logs = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);
  const stopped = courses.filter(c => c.endDate)
                          .sort((a, b) => b.endDate.localeCompare(a.endDate));
  if (!stopped.length || courses.some(c => !c.endDate)) return null; // 진행 중 코스 있으면 불필요

  const lastStop = stopped[0];
  const stopMs = new Date(lastStop.endDate).getTime();
  const daysSinceStop = Math.floor((Date.now() - stopMs) / 86400000);

  // 중단 시점 체중 vs 현재 체중
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const stopWeight = sorted.find(l => Math.abs(new Date(l.date).getTime() - stopMs) <= 14 * 86400000)?.weight
    ?? user.startWeight;
  const currentWeight = sorted[sorted.length - 1]?.weight ?? stopWeight;
  const regainKg = +(currentWeight - stopWeight).toFixed(1);

  return (
    <div className="card border-2 border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3">
        <div className="text-3xl">📉</div>
        <div className="flex-1">
          <h2 className="section-title">중단 후 추적 ({daysSinceStop}일째)</h2>
          <p className="section-subtitle">마지막 약: {lastStop.startDate} ~ {lastStop.endDate}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <SumTile label="중단 시점" value={`${stopWeight.toFixed(1)} kg`} />
        <SumTile label="현재" value={`${currentWeight.toFixed(1)} kg`} />
        <SumTile label="변화"
          value={`${regainKg >= 0 ? '+' : ''}${regainKg.toFixed(1)} kg`}
          tone={regainKg < 0.5 ? 'brand' : 'neutral'} />
      </div>
      <button onClick={() => navigate('guide/after-stop')} className="btn-secondary w-full mt-4 text-sm">
        🏃 요요 방지 가이드 보기
      </button>
    </div>
  );
}
