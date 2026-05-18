import React, { useMemo } from 'react';
import { drugStartTrend } from '../lib/stats.js';
import { MED_BY_ID } from '../lib/constants.js';

const COLORS = {
  wegovy: '#2E9A58',
  mounjaro: '#D97706',
  saxenda: '#3B82F6',
  ozempic: '#8B5CF6',
  zepbound: '#EF4444',
};

export function DrugStartTrendChart({ navigate }) {
  const data = useMemo(() => drugStartTrend(6), []);
  const maxTotal = Math.max(...data.map(d => Object.values(d.counts).reduce((s, x) => s + x, 0)), 1);

  return (
    <div className="card">
      <h2 className="section-title">📈 최근 6개월 약별 시작 사용자 추이</h2>
      <p className="section-subtitle">월별 신규 시작 사용자 수</p>
      <div className="mt-4 flex items-end gap-2 h-40">
        {data.map((b, i) => {
          const total = Object.values(b.counts).reduce((s, x) => s + x, 0);
          const heightPct = (total / maxTotal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums">{total}</div>
              <div className="w-full flex flex-col-reverse rounded-t-lg overflow-hidden" style={{ height: `${Math.max(2, heightPct)}%`, minHeight: '4px' }}>
                {Object.entries(b.counts).sort((a, b) => b[1] - a[1]).map(([medId, count]) => (
                  <div key={medId}
                       title={`${MED_BY_ID[medId]?.label} ${count}건`}
                       style={{ background: COLORS[medId] || '#94A3B8', height: `${(count / total) * 100}%` }} />
                ))}
              </div>
              <div className="text-[10px] text-ink-700 dark:text-slate-400 text-center">{b.label.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-4 text-xs">
        {Object.entries(COLORS).map(([id, color]) => (
          <button key={id} onClick={() => navigate(`drug/${id}`)}
                  className="flex items-center gap-1.5 hover:underline text-ink-700 dark:text-slate-300">
            <span className="inline-block w-3 h-3 rounded" style={{ background: color }} />
            <span>{MED_BY_ID[id]?.label.replace(/\s*\(.+\)/, '')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
