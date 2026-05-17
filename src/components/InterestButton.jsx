import React, { useState, useEffect } from 'react';
import { useToast } from './Toast.jsx';

// 1탭 관심 표시 — 약/부작용/가이드별. 가입 없이도 의견 집계 가능.
const KEY = 'gl_interest';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// 시드: 각 topic에 가상 관심 수
const SEED = {
  'drug:wegovy': 480,
  'drug:mounjaro': 520,
  'drug:saxenda': 220,
  'drug:ozempic': 130,
  'drug:zepbound': 95,
  'effect:nausea': 380,
  'effect:vomiting': 180,
  'effect:constipation': 210,
  'effect:diarrhea': 160,
  'effect:fatigue': 145,
  'effect:headache': 95,
  'guide:before-use': 290,
  'guide:after-stop': 230,
  'guide:diet-only': 175,
  'guide:meal-timing': 120,
};

function ensureSeed() {
  const d = load();
  if (!d._seeded) {
    Object.assign(d, SEED);
    d._seeded = true;
    save(d);
  }
}

export function InterestButton({ topicId, label = '관심 있어요' }) {
  const toast = useToast();
  useEffect(ensureSeed, []);
  const [count, setCount] = useState(() => load()[topicId] || 0);
  const [pressed, setPressed] = useState(() => {
    try { return localStorage.getItem(`${KEY}_${topicId}_mine`) === '1'; }
    catch { return false; }
  });

  const toggle = () => {
    const all = load();
    if (pressed) {
      all[topicId] = Math.max(0, (all[topicId] || 0) - 1);
      localStorage.removeItem(`${KEY}_${topicId}_mine`);
      setPressed(false);
      toast.info('관심 표시 해제');
    } else {
      all[topicId] = (all[topicId] || 0) + 1;
      localStorage.setItem(`${KEY}_${topicId}_mine`, '1');
      setPressed(true);
      toast.success('관심 표시됨 — 다른 사용자에게도 보입니다');
    }
    save(all);
    setCount(all[topicId]);
  };

  return (
    <button onClick={toggle}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition border-2
                        ${pressed
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-400'}`}>
      <span className={pressed ? 'animate-pulseGentle' : ''}>❤️</span>
      <span>{label}</span>
      <span className="text-xs tabular-nums opacity-80">{count.toLocaleString()}</span>
    </button>
  );
}
