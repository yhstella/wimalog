import React, { useState, useEffect } from 'react';
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT, GUIDE_CONTENT } from '../lib/content.js';

const KEY = 'gl_recent_routes';
const MAX = 6;

export function recordVisit(route) {
  // 의미있는 콘텐츠 페이지만 기록
  if (!route.startsWith('drug/') && !route.startsWith('effect/')
      && !route.startsWith('guide/') && !route.startsWith('calc/')
      && route !== 'compare') return;
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    const filtered = arr.filter(r => r.route !== route);
    filtered.unshift({ route, t: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {}
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

function labelFor(route) {
  if (route.startsWith('drug/')) {
    const d = DRUG_CONTENT[route.slice(5)];
    return d ? { icon: '💉', label: d.label, sub: '약 상세' } : null;
  }
  if (route.startsWith('effect/')) {
    const s = SIDE_EFFECT_CONTENT[route.slice(7)];
    return s ? { icon: '⚠️', label: s.label, sub: '부작용' } : null;
  }
  if (route.startsWith('guide/')) {
    const g = GUIDE_CONTENT[route.slice(6)];
    return g ? { icon: '📘', label: g.title, sub: '가이드' } : null;
  }
  if (route.startsWith('calc/')) {
    const labels = { 'calc/cost': '약 비용', 'calc/bmr': '칼로리', 'calc/target': '목표 체중' };
    return { icon: '🧮', label: labels[route] || '계산기', sub: '계산기' };
  }
  if (route === 'compare') return { icon: '⚖️', label: '약 비교', sub: '5개 약' };
  return null;
}

export function RecentPagesRow({ navigate }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    setItems(loadRecent().slice(0, MAX).map(r => ({ ...r, ...labelFor(r.route) })).filter(x => x.label));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="card !p-3">
      <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">↩ 최근 본 페이지</div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {items.map(it => (
          <button key={it.route} onClick={() => navigate(it.route)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-100/60 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition text-sm">
            <span>{it.icon}</span>
            <span className="font-semibold text-ink-700 dark:text-slate-300">{it.label}</span>
            <span className="text-[10px] text-ink-500 dark:text-slate-500">· {it.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
