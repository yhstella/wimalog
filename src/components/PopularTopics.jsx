import React, { useEffect, useState, useMemo } from 'react';
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT } from '../lib/content.js';

const KEY = 'gl_interest';

function loadInterest() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

// Landing에 노출: 지금 가장 많이 본 약/부작용/가이드
export function PopularTopics({ navigate }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // 페이지 진입 시 한 번만 로드 (rerender 위해)
    const i = setInterval(() => setTick(t => t + 1), 20000);
    return () => clearInterval(i);
  }, []);

  const data = useMemo(() => loadInterest(), [tick]);

  const drugs = Object.keys(DRUG_CONTENT)
    .map(id => ({ id, label: DRUG_CONTENT[id].label, count: data[`drug:${id}`] || 0, route: `drug/${id}` }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const effects = Object.keys(SIDE_EFFECT_CONTENT)
    .map(id => ({ id, label: SIDE_EFFECT_CONTENT[id].label, count: data[`effect:${id}`] || 0, route: `effect/${id}` }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card title="🔥 지금 관심 많은 약" items={drugs} navigate={navigate} accent="brand" />
      <Card title="😟 가장 많이 보는 부작용" items={effects} navigate={navigate} accent="rose" />
    </section>
  );
}

function Card({ title, items, navigate, accent }) {
  const max = Math.max(...items.map(i => i.count), 1);
  const accentClass = accent === 'rose' ? 'bg-rose-500' : 'bg-brand-500';
  return (
    <div className="card !p-4">
      <div className="font-bold text-ink-900 dark:text-slate-100 mb-3">{title}</div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <button key={it.id} onClick={() => navigate(it.route)}
                  className="w-full text-left group hover:bg-ink-100/30 dark:hover:bg-slate-800/30 -mx-2 px-2 py-1.5 rounded-lg transition">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className={`text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400 ${i === 0 ? 'font-bold' : ''}`}>
                {i === 0 && '🥇 '}{i === 1 && '🥈 '}{i === 2 && '🥉 '}{i > 2 && `${i + 1}. `}
                {it.label}
              </span>
              <span className="text-xs tabular-nums text-ink-500 dark:text-slate-400">{it.count.toLocaleString()}명</span>
            </div>
            <div className="h-1.5 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${(it.count / max) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
