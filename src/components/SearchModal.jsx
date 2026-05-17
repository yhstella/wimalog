import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT, GUIDE_CONTENT } from '../lib/content.js';

const ALL_ITEMS = [
  ...Object.values(DRUG_CONTENT).map(d => ({
    type: 'drug', icon: '💉', label: d.label, sub: d.en + ' · ' + d.efficacy.headlineKg,
    route: `drug/${d.id}`, keywords: [d.label, d.en, d.generic, '약', '효과', '가격', '부작용'].join(' ').toLowerCase(),
  })),
  ...Object.values(SIDE_EFFECT_CONTENT).map(s => ({
    type: 'effect', icon: '⚠️', label: s.label, sub: s.summary,
    route: `effect/${s.id}`, keywords: [s.label, ...(s.keywords || [])].join(' ').toLowerCase(),
  })),
  ...Object.values(GUIDE_CONTENT).map(g => ({
    type: 'guide', icon: '📘', label: g.title, sub: g.summary,
    route: `guide/${g.id}`, keywords: [g.title, g.summary, '가이드'].join(' ').toLowerCase(),
  })),
  { type: 'tool', icon: '💰', label: '약 비용 계산기', sub: '약·기간으로 총 예상 비용', route: 'calc/cost', keywords: '비용 가격 계산기 cost' },
  { type: 'tool', icon: '🔥', label: '칼로리 계산기', sub: 'BMR/TDEE/감량 목표', route: 'calc/bmr', keywords: '칼로리 BMR TDEE 기초대사량 calorie' },
  { type: 'tool', icon: '🎯', label: '목표 체중 계산기', sub: 'BMI 정상 체중', route: 'calc/target', keywords: '목표 체중 BMI 정상' },
  { type: 'page', icon: '📊', label: '전체 통계', sub: '코호트 평균 감량률·부작용·가격', route: 'stats', keywords: '통계 평균' },
  { type: 'page', icon: '⚖️', label: '5개 약 한눈 비교', sub: '효과·부작용·가격 비교 표', route: 'compare', keywords: '비교 compare' },
  { type: 'page', icon: '🛡️', label: '안전 정보 + FAQ', sub: '자주 묻는 질문 30개+', route: 'info', keywords: '안전 FAQ 자주 묻는 질문' },
];

const TYPE_COLOR = {
  drug: 'text-brand-700 dark:text-brand-400',
  effect: 'text-rose-600 dark:text-rose-400',
  guide: 'text-amber-700 dark:text-amber-400',
  tool: 'text-blue-600 dark:text-blue-400',
  page: 'text-ink-700 dark:text-slate-300',
};

export function SearchModal({ navigate, onClose }) {
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return ALL_ITEMS.slice(0, 10);
    return ALL_ITEMS.filter(it => it.keywords.includes(query) || it.label.toLowerCase().includes(query))
      .slice(0, 15);
  }, [q]);

  useEffect(() => { setHighlight(0); }, [q]);

  const go = (it) => {
    navigate(it.route);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlight]) go(results[highlight]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/60 backdrop-blur-sm pt-20 p-4"
         onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100 dark:border-slate-800">
          <span className="text-xl">🔍</span>
          <input ref={inputRef} type="text"
                 value={q} onChange={e => setQ(e.target.value)}
                 onKeyDown={onKey}
                 placeholder="약·부작용·가이드·계산기 검색..."
                 className="flex-1 bg-transparent border-none focus:outline-none text-ink-900 dark:text-slate-100 placeholder:text-ink-500 dark:placeholder:text-slate-500" />
          <kbd className="text-[10px] px-2 py-1 rounded bg-ink-100 dark:bg-slate-800 text-ink-500 dark:text-slate-400">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="text-center text-sm text-ink-500 dark:text-slate-400 py-8">검색 결과가 없어요</div>
          ) : results.map((it, i) => (
            <button key={`${it.type}-${it.route}`} onClick={() => go(it)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition
                                ${highlight === i ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-ink-100/40 dark:hover:bg-slate-800/40'}`}>
              <span className="text-xl flex-shrink-0">{it.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${TYPE_COLOR[it.type]}`}>{it.label}</span>
                  <span className="text-[10px] text-ink-500 dark:text-slate-500 uppercase">{it.type}</span>
                </div>
                <div className="text-xs text-ink-500 dark:text-slate-400 truncate mt-0.5">{it.sub}</div>
              </div>
              {highlight === i && <span className="text-brand-500 self-center">↵</span>}
            </button>
          ))}
        </div>
        <div className="border-t border-ink-100 dark:border-slate-800 px-4 py-2 flex justify-between text-[10px] text-ink-500 dark:text-slate-500">
          <span>↑↓ 이동 · Enter 선택 · ESC 닫기</span>
          <span>{results.length}개 결과</span>
        </div>
      </div>
    </div>
  );
}

export function SearchTrigger({ navigate }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="검색 열기"
              className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-slate-800 transition text-ink-500 dark:text-slate-400">
        <span className="text-base">🔍</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 text-ink-500 dark:text-slate-400">/</kbd>
      </button>
      {open && <SearchModal navigate={navigate} onClose={() => setOpen(false)} />}
    </>
  );
}
