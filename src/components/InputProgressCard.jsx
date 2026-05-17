import React, { useMemo } from 'react';
import { inputDepth } from '../lib/stats.js';

// 입력 깊이에 따라 잠금 해제되는 인사이트를 보여주는 카드.
// 사용자의 핵심 동기: "더 자세히 입력하면 더 많은 데이터를 조회할 수 있다"
export function InputProgressCard({ user, navigate }) {
  const data = useMemo(() => inputDepth(user), [user]);
  if (!user) return null;

  const completed = data.milestones.filter(m => m.done >= m.need);
  const remaining = data.milestones.filter(m => m.done < m.need);
  const allDone = remaining.length === 0;

  // 다음 1~2개 마일스톤만 강조 (압박감 ↓)
  const nextTwo = remaining.slice(0, 2);

  return (
    <div className="card border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-900/20 dark:via-slate-900 dark:to-slate-900">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔓</span>
            <h2 className="font-bold text-ink-900 dark:text-slate-100">자세히 입력할수록 더 많은 데이터가 열려요</h2>
          </div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
            {allDone
              ? '모든 데이터 인사이트가 열렸어요. 계속 기록을 이어가세요.'
              : <>지금까지 <b className="text-brand-700 dark:text-brand-400">{completed.length}/{data.milestones.length}</b>개 인사이트 잠금 해제</>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
            {data.score}<span className="text-base">%</span>
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500">데이터 활용도</div>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
             style={{ width: `${data.score}%` }} />
      </div>

      {/* 다음 잠금 해제 — 2개만 강조 */}
      {nextTwo.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 uppercase tracking-wider">다음 잠금 해제</div>
          {nextTwo.map(m => {
            const left = Math.max(0, m.need - m.done);
            const pct = Math.min(100, (m.done / m.need) * 100);
            return (
              <button key={m.key}
                      onClick={() => navigate?.('records')}
                      className="w-full text-left rounded-xl bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition border border-ink-200 dark:border-slate-700 hover:border-brand-300 p-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm text-ink-900 dark:text-slate-100">
                        {m.label} <span className="text-brand-700 dark:text-brand-400">{left}회 더</span>
                      </span>
                      <span className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums flex-shrink-0">
                        {m.done}/{m.need}
                      </span>
                    </div>
                    <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">
                      → {m.unlocks}
                    </div>
                    <div className="mt-1.5 h-1 bg-ink-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 잠금 해제 완료 인사이트 — 접힌 형태로 압축 */}
      {completed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {completed.map(m => (
            <span key={m.key} title={m.unlocks}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <span>✓</span>
              <span>{m.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
