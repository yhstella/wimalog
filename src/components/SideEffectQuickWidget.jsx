import React from 'react';
import { SIDE_EFFECT_CONTENT } from '../lib/content.js';

// 부작용 즉답 위젯 — "지금 X 어떻게 해결?" 한 탭으로 해당 페이지로 이동.
// 자주 발생하는 Top 6 부작용 chip 노출. 클릭 시 effect/{id} 페이지.
// P41 페르소나 피드백 (28F 메스꺼움 심함 — 즉답 동선 부재).
const QUICK_EFFECTS = [
  { id: 'nausea',      icon: '🤢', label: '메스꺼움' },
  { id: 'vomiting',    icon: '🤮', label: '구토' },
  { id: 'constipation',icon: '💩', label: '변비' },
  { id: 'diarrhea',    icon: '💧', label: '설사' },
  { id: 'fatigue',     icon: '😴', label: '피로감' },
  { id: 'headache',    icon: '🤕', label: '두통' },
];

export function SideEffectQuickWidget({ navigate }) {
  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <div className="text-sm font-bold text-ink-900 dark:text-slate-100">⚡ 지금 부작용 어떻게?</div>
          <div className="text-[11px] text-ink-500 dark:text-slate-400">자주 묻는 부작용 — 한 탭으로 즉시 가이드</div>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {QUICK_EFFECTS.map(e => {
          const info = SIDE_EFFECT_CONTENT[e.id];
          return (
            <button key={e.id} onClick={() => navigate?.(`effect/${e.id}`)}
                    title={info?.summary}
                    className="rounded-lg border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/15 transition px-2 py-2 flex flex-col items-center gap-0.5">
              <span className="text-base leading-none">{e.icon}</span>
              <span className="text-[10px] font-medium text-ink-700 dark:text-slate-300 truncate w-full text-center">{e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
