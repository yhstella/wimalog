import React, { useMemo } from 'react';
import { inputDepth } from '../lib/stats.js';

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
            <span className="text-xl">🤖</span>
            <h2 className="font-bold text-ink-900 dark:text-slate-100">AI 예측 정밀도</h2>
          </div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
            {allDone
              ? '모든 데이터가 입력됐어요. 본인 코호트 매칭이 가장 정밀한 수준입니다.'
              : purposeHint}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
            {data.score}<span className="text-base">%</span>
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500">
            {completed.length}/{data.milestones.length} 잠금 해제
          </div>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
             style={{ width: `${data.score}%` }} />
      </div>

      {/* 다음 잠금 해제 — visitPurpose 우선순위로 정렬된 3개 */}
      {nextThree.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 uppercase tracking-wider">
            다음 단계 — 정밀도 +{nextThree.reduce((s, m) => s + m.boost, 0)}% 가능
          </div>
          {nextThree.map(m => {
            const left = Math.max(0, m.need - m.done);
            const pct = Math.min(100, (m.done / m.need) * 100);
            // 이 마일스톤이 줄 정밀도 증가량 (남은 부분만 반영)
            const potentialBoost = Math.round(m.boost * (1 - m.done / m.need));
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
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        +{potentialBoost}% 정밀도
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
