import React, { useMemo, useState } from 'react';
import {
  fullCoachAnalysis, coachHeadline, coachIcon, coachTone, coachSubMessage,
} from '../lib/coach.js';

// "내 GLP-1 코치" — Dashboard 최상단 hero 카드
// "당신은 지금 X 상태입니다, Y 하세요" 가치 직접 노출
export function CoachReport({ user, navigate }) {
  const [showAllActions, setShowAllActions] = useState(false);
  const analysis = useMemo(() => fullCoachAnalysis(user), [user]);
  const { progress, plateau, summary, actions } = analysis;

  // 너무 이른 단계 — 안내 카드만
  if (progress?.stage === 'too-early') {
    return (
      <section className="card border-2 border-dashed border-ink-300 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📋</div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400">코치 리포트</div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-slate-100 mt-1">
              체중 기록 {2 - progress.logsCount}회 더 하면 분석 시작
            </h2>
            <p className="text-sm text-ink-600 dark:text-slate-300 mt-2 leading-relaxed">
              매주 본인 진척도 평가 + 코호트 비교 + 다음 액션 권유를 받으려면 최소 2회 이상 체중 기록이 필요합니다.
            </p>
            <button onClick={() => navigate?.('records')}
                    className="mt-3 btn-primary !py-2 !px-4 text-sm">
              체중 기록하러 가기 →
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 약 없는 사용자 — 일반 진척 카드
  if (progress?.stage === 'no-medication') {
    return null;  // Dashboard의 다른 위젯 (PurposeCard 등)이 안내
  }

  if (progress?.stage !== 'on-medication') return null;

  const headline = coachHeadline(analysis);
  const icon = coachIcon(analysis);
  const tone = coachTone(analysis);
  const subMsg = coachSubMessage(analysis);

  const toneClass = {
    emerald: 'border-emerald-300 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/15 dark:to-slate-900',
    brand:   'border-brand-300 dark:border-brand-800/50 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/15 dark:to-slate-900',
    amber:   'border-amber-300 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/15 dark:to-slate-900',
    rose:    'border-rose-300 dark:border-rose-800/50 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/15 dark:to-slate-900',
  }[tone];

  const headlineColor = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    brand:   'text-brand-700 dark:text-brand-400',
    amber:   'text-amber-700 dark:text-amber-400',
    rose:    'text-rose-700 dark:text-rose-400',
  }[tone];

  const visibleActions = showAllActions ? actions : actions.slice(0, 2);

  return (
    <section className={`rounded-2xl border-2 ${toneClass} p-5 sm:p-6`}>
      {/* 헤더 */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="text-3xl flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400">
            📋 이번 주 코치 리포트
          </div>
          <h2 className={`text-xl sm:text-2xl font-extrabold mt-1 leading-tight ${headlineColor}`}>
            {headline}
          </h2>
          {subMsg && (
            <p className="text-sm text-ink-700 dark:text-slate-300 mt-2 leading-relaxed">
              {subMsg}
            </p>
          )}
        </div>
      </div>

      {/* 이번 주 활동 요약 — 3 stat */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          <WeeklyStat label="이번 주 체중"
                      value={summary.weeklyDelta != null
                        ? `${summary.weeklyDelta >= 0 ? '+' : ''}${summary.weeklyDelta.toFixed(1)}`
                        : '—'}
                      unit="kg"
                      color={summary.weeklyDelta == null ? 'ink' : summary.weeklyDelta <= 0 ? 'emerald' : 'rose'} />
          <WeeklyStat label="운동" value={summary.exerciseMin} unit="분"
                      sub={`${summary.exerciseSessions}회`}
                      color={summary.exerciseMin >= 90 ? 'emerald' : summary.exerciseMin >= 30 ? 'amber' : 'ink'} />
          <WeeklyStat label="식단" value={summary.dietCount} unit="건"
                      color={summary.dietCount >= 5 ? 'emerald' : 'ink'} />
        </div>
      )}

      {/* 정체기 별도 분석 */}
      {plateau?.plateau && <PlateauPanel plateau={plateau} />}

      {/* 다음 액션 1-3개 */}
      {actions.length > 0 && (
        <div className="mt-5 pt-4 border-t border-ink-200/50 dark:border-slate-700/50">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400 mb-3">
            📝 다음 주 권장 액션
          </div>
          <div className="space-y-2.5">
            {visibleActions.map((a, i) => (
              <ActionRow key={i} action={a} index={i + 1} />
            ))}
          </div>
          {actions.length > 2 && !showAllActions && (
            <button onClick={() => setShowAllActions(true)}
                    className="mt-3 text-xs font-semibold text-ink-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition">
              {actions.length - 2}개 더 보기 →
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function WeeklyStat({ label, value, unit, sub, color = 'ink' }) {
  const colorClass = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    rose:    'text-rose-700 dark:text-rose-400',
    amber:   'text-amber-700 dark:text-amber-400',
    ink:     'text-ink-900 dark:text-slate-100',
  }[color];
  return (
    <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 px-2 py-2.5 text-center">
      <div className="text-[10px] text-ink-500 dark:text-slate-500 leading-tight">{label}</div>
      <div className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1 ${colorClass}`}>
        {value}<span className="text-xs ml-0.5">{unit}</span>
      </div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionRow({ action, index }) {
  const priorityColor = {
    high:   'border-rose-300 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-900/15',
    medium: 'border-amber-300 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/15',
    low:    'border-ink-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60',
  }[action.priority];
  return (
    <div className={`rounded-xl border ${priorityColor} p-3 flex gap-3`}>
      <div className="text-xl flex-shrink-0">{action.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink-900 dark:text-slate-100 leading-snug">
          {action.title}
        </div>
        <div className="text-xs text-ink-700 dark:text-slate-300 mt-1 leading-relaxed">
          {action.action}
        </div>
      </div>
    </div>
  );
}

function PlateauPanel({ plateau }) {
  return (
    <div className="mt-4 rounded-xl bg-amber-100/60 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700/50 p-3 sm:p-4">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base flex-shrink-0">⚠</span>
        <div>
          <div className="text-sm font-bold text-amber-900 dark:text-amber-100">정체기 감지</div>
          <div className="text-xs text-amber-800 dark:text-amber-200/80 mt-0.5">
            최근 3주 체중 변화 ±{plateau.range.toFixed(1)}kg ({plateau.recentCount}회 기록)
          </div>
        </div>
      </div>
      <div className="text-[11px] font-bold text-amber-800 dark:text-amber-200 mt-3 mb-1.5">가능한 원인</div>
      <div className="space-y-1.5">
        {plateau.causes.map((c, i) => (
          <div key={i} className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
            <span className="font-semibold">{c.icon} {c.label}</span>
            <div className="text-[11px] text-amber-800/80 dark:text-amber-200/70 mt-0.5">{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
