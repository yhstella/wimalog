import React from 'react';

// 빠른 날짜 입력 — 캘린더 안 띄우고 한 탭으로 N일전 선택.
// 추가로 좌우 화살표로 1일씩, "직접 입력"으로 native date도 fallback.
// props: value (YYYY-MM-DD), onChange(YYYY-MM-DD), max (YYYY-MM-DD, 보통 오늘)
export function QuickDateInput({ value, onChange, max, presets = [0, 1, 2, 7, 14, 30] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const cur = value ? Date.parse(value) : todayMs;
  const daysAgo = Math.round((todayMs - cur) / 86400000);
  const maxMs = max ? Date.parse(max) : todayMs;

  const setDaysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    onChange(d.toISOString().slice(0, 10));
  };
  const shift = (delta) => {
    const next = new Date(cur);
    next.setDate(next.getDate() + delta);
    if (next.getTime() > maxMs) return;
    onChange(next.toISOString().slice(0, 10));
  };

  const presetLabel = (n) => n === 0 ? '오늘' : n === 1 ? '어제' : n === 2 ? '그저께' : `-${n}일`;

  // 표시 라벨 — '오늘' / 'N일 전' / 날짜
  const display = daysAgo === 0 ? '오늘'
                : daysAgo === 1 ? '어제'
                : daysAgo === 2 ? '그저께'
                : daysAgo > 0   ? `${daysAgo}일 전`
                : `${-daysAgo}일 후`;

  return (
    <div className="space-y-2">
      {/* preset 버튼들 */}
      <div className="flex gap-1 flex-wrap">
        {presets.map(n => (
          <button key={n} type="button" onClick={() => setDaysAgo(n)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
                              ${daysAgo === n
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
            {presetLabel(n)}
          </button>
        ))}
      </div>
      {/* 좌우 화살표 + 현재 날짜 표시 */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="하루 전"
                className="w-9 h-9 rounded-lg border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-ink-100 dark:hover:bg-slate-700 text-ink-700 dark:text-slate-300 font-bold">
          ◀
        </button>
        <div className="flex-1 text-center px-2 py-1.5 rounded-lg bg-ink-100/60 dark:bg-slate-800/60 text-sm font-semibold tabular-nums text-ink-900 dark:text-slate-100">
          {value} <span className="text-xs text-ink-500 dark:text-slate-400 font-normal">· {display}</span>
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="하루 후"
                disabled={cur >= maxMs}
                className="w-9 h-9 rounded-lg border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-ink-100 dark:hover:bg-slate-700 text-ink-700 dark:text-slate-300 font-bold disabled:opacity-40">
          ▶
        </button>
      </div>
    </div>
  );
}
