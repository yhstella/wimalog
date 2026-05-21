import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';
import { SIDE_EFFECTS } from '../lib/constants.js';
import { SIDE_EFFECT_CONTENT } from '../lib/content.js';
import { sideEffectRates } from '../lib/stats.js';
import { snapshotSideEffectRates } from '../lib/snapshot.js';

// 본인 부작용 패턴 분석:
// - 최근 4주 보고한 부작용
// - 각 부작용의 본인 발생률 vs 코호트 평균
// - 가장 흔한 본인 부작용 → 즉시 관리 팁 + 가이드 링크
// - "당신만 겪는" 부작용 vs "다들 겪는" 부작용 구분
export function SideEffectInsightWidget({ user, navigate }) {
  const insights = useMemo(() => {
    const logs = Storage.getLogsByUser(user.id);
    if (logs.length === 0) return null;

    // 최근 12주 logs
    const cutoffMs = Date.now() - 12 * 7 * 86400000;
    const recent = logs.filter(l => {
      const d = new Date(l.date);
      return d.getTime() > cutoffMs;
    });
    if (recent.length === 0) return null;

    // 본인 부작용별 발생 횟수
    const myCount = {};
    for (const l of recent) {
      for (const [id, v] of Object.entries(l.sideEffects || {})) {
        if (v) myCount[id] = (myCount[id] || 0) + 1;
      }
    }
    if (Object.keys(myCount).length === 0) return null;

    const myTotalLogs = recent.length;

    // 사용 중 약 (활성 코스)
    const courses = Storage.getMedCoursesByUser(user.id);
    const activeCourse = courses.find(c => !c.endDate);
    const medication = activeCourse?.medication || null;

    // 코호트 부작용률 — snapshot 우선, fallback localStorage
    const cohortRates = medication
      ? (snapshotSideEffectRates(medication) || sideEffectRates({ medication }))
      : sideEffectRates({});

    // 본인 vs 코호트 비교
    const items = Object.entries(myCount).map(([id, count]) => {
      const myRate = count / myTotalLogs;
      const cohortRate = cohortRates.find(r => r.id === id)?.rate ?? 0;
      const label = SIDE_EFFECTS.find(s => s.id === id)?.label || id;
      // 본인이 코호트보다 더 자주 = high. 더 적으면 lower. 비슷하면 normal.
      const ratio = cohortRate > 0 ? myRate / cohortRate : 1;
      let comparison;
      if (ratio > 1.4) comparison = 'higher';
      else if (ratio < 0.7) comparison = 'lower';
      else comparison = 'similar';
      return { id, label, myCount: count, myRate, cohortRate, ratio, comparison };
    });

    items.sort((a, b) => b.myCount - a.myCount);
    return { items, totalLogs: myTotalLogs, medication, activeCourse };
  }, [user.id]);

  if (!insights) return null;

  const { items, totalLogs, medication } = insights;
  const top = items[0];
  const topContent = SIDE_EFFECT_CONTENT[top?.id];

  return (
    <section className="card" id="side-effect-insight">
      <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
        <div>
          <h2 className="section-title">부작용 인사이트</h2>
          <p className="section-subtitle">
            최근 12주 본인 기록 {totalLogs}건 vs 코호트 평균
            {medication && <> · {medication}</>}
          </p>
        </div>
        <button onClick={() => navigate(`guide/side-effect-timeline`)}
                className="text-xs text-brand-700 dark:text-brand-400 hover:underline">
          시점별 변화 가이드 →
        </button>
      </div>

      {/* 본인 vs 코호트 막대 비교 */}
      <div className="space-y-2.5">
        {items.slice(0, 5).map(item => {
          const myPct = Math.round(item.myRate * 100);
          const cohortPct = Math.round(item.cohortRate * 100);
          const color = item.comparison === 'higher'
            ? 'bg-rose-500'
            : item.comparison === 'lower'
              ? 'bg-emerald-500'
              : 'bg-brand-500';
          return (
            <button key={item.id}
                    onClick={() => navigate(`effect/${item.id}`)}
                    className="w-full text-left rounded-lg hover:bg-ink-100/40 dark:hover:bg-slate-800/40 -mx-2 px-2 py-1.5 transition">
              <div className="flex justify-between text-sm mb-1 gap-2 flex-wrap">
                <span className="text-ink-900 dark:text-slate-100 font-medium">
                  {item.label}
                  <span className="ml-2 text-[10px] font-normal text-ink-500">
                    {item.comparison === 'higher' && <span className="text-rose-600 dark:text-rose-400">평균보다 자주</span>}
                    {item.comparison === 'lower'  && <span className="text-emerald-600 dark:text-emerald-400">평균보다 덜</span>}
                    {item.comparison === 'similar' && <span>비슷</span>}
                  </span>
                </span>
                <span className="tabular-nums text-xs text-ink-500 dark:text-slate-400">
                  본인 <b className="text-ink-900 dark:text-slate-100">{myPct}%</b>
                  <span className="mx-1">·</span>
                  코호트 {cohortPct}%
                </span>
              </div>
              {/* 본인 막대 (위) */}
              <div className="h-1.5 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden mb-0.5">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, myPct)}%` }} />
              </div>
              {/* 코호트 막대 (아래, 옅게) */}
              <div className="h-1 bg-ink-100/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-ink-400 dark:bg-slate-600"
                     style={{ width: `${Math.min(100, cohortPct)}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* 가장 흔한 본인 부작용 → 관리 팁 */}
      {topContent && top.myCount >= 2 && (
        <div className="mt-4 pt-3 border-t border-ink-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">
            💡 가장 자주 보고하신 <b className="text-brand-700 dark:text-brand-400">{top.label}</b> 자가 관리
          </div>
          <ul className="space-y-1 text-xs text-ink-700 dark:text-slate-300 leading-relaxed">
            {topContent.selfCare?.slice(0, 4).map((tip, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-brand-500 flex-shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {topContent.seeDoctor && topContent.seeDoctor.length > 0 && (
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[11px] font-medium text-rose-700 dark:text-rose-400">
                ⚠ 의사 상담이 필요한 경우 ({topContent.seeDoctor.length}가지)
              </summary>
              <ul className="mt-1.5 space-y-1 text-xs text-ink-700 dark:text-slate-300 pl-3">
                {topContent.seeDoctor.map((s, i) => (
                  <li key={i} className="list-disc list-inside leading-relaxed">{s}</li>
                ))}
              </ul>
            </details>
          )}
          <button onClick={() => navigate(`effect/${top.id}`)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400 hover:underline">
            {top.label} 상세 페이지 →
          </button>
        </div>
      )}

      {/* 본인이 다 평균보다 적게 겪고 있으면 칭찬 */}
      {items.every(i => i.comparison !== 'higher') && items.length >= 2 && (
        <div className="mt-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/15 border border-emerald-200/40 dark:border-emerald-800/30 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          ✨ 본인의 부작용 발생률이 코호트 평균보다 전반적으로 낮습니다 — 잘 적응하고 계세요.
        </div>
      )}
    </section>
  );
}
