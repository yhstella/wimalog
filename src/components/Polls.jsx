import React, { useMemo, useState, useEffect } from 'react';
import { POLLS } from '../lib/content.js';

// Quick Polls — 1탭 의견 수집. 로컬 저장 + 집계 즉시 표시.
const STORAGE_KEY = 'gl_polls';

function loadPolls() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function savePolls(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 시드: 각 poll에 100건 가상 응답 (분포)
const SEED_RESPONSES = {
  considering: { wegovy: 320, mounjaro: 280, saxenda: 120, ozempic: 60, zepbound: 80, none: 140 },
  concern:     { effect: 180, sideeffect: 320, cost: 240, rebound: 160, safety: 100 },
  situation:   { 'none-yet': 240, planning: 180, using: 380, stopped: 120, 'diet-only': 80 },
};

function ensureSeed() {
  const data = loadPolls();
  if (!data._seeded) {
    for (const [pollId, counts] of Object.entries(SEED_RESPONSES)) {
      if (!data[pollId]) data[pollId] = { counts };
    }
    data._seeded = true;
    savePolls(data);
  }
}

export function PollSection() {
  useEffect(ensureSeed, []);
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="section-title">📊 1탭 설문 — 다른 사람들 결과 즉시 보기</h2>
        <p className="section-subtitle">선택하면 본인 응답이 합산되고 분포가 바로 보입니다</p>
      </div>
      {POLLS.map(poll => <PollItem key={poll.id} poll={poll} />)}
    </div>
  );
}

function PollItem({ poll }) {
  const [data, setData] = useState(() => loadPolls()[poll.id] || { counts: {} });
  const [myChoice, setMyChoice] = useState(() => {
    try { return localStorage.getItem(`gl_poll_${poll.id}_mine`) || null; }
    catch { return null; }
  });

  const total = useMemo(
    () => Object.values(data.counts || {}).reduce((s, x) => s + x, 0),
    [data]
  );

  const choose = (optId) => {
    const all = loadPolls();
    const cur = all[poll.id] || { counts: {} };
    // 이전 선택 취소 + 새 선택 추가 (한 사람당 1표)
    if (myChoice) cur.counts[myChoice] = Math.max(0, (cur.counts[myChoice] || 0) - 1);
    cur.counts[optId] = (cur.counts[optId] || 0) + 1;
    all[poll.id] = cur;
    savePolls(all);
    localStorage.setItem(`gl_poll_${poll.id}_mine`, optId);
    setData(cur);
    setMyChoice(optId);
  };

  return (
    <div className="border-t border-ink-100 dark:border-slate-800 pt-4 first:border-t-0 first:pt-0">
      <div className="font-semibold text-ink-900 dark:text-slate-100 mb-2">{poll.question}</div>
      <div className="space-y-1.5">
        {poll.options.map(opt => {
          const count = data.counts?.[opt.id] || 0;
          const pct = total ? (count / total) * 100 : 0;
          const isMine = myChoice === opt.id;
          return (
            <button key={opt.id} onClick={() => choose(opt.id)}
                    className={`w-full text-left relative overflow-hidden rounded-lg border transition
                                ${isMine
                                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                  : 'border-ink-200 dark:border-slate-700 hover:border-brand-300'}`}>
              <div className="absolute inset-0 origin-left transition-all"
                   style={{
                     width: `${pct}%`,
                     background: isMine ? 'rgba(46,154,88,0.18)' : 'rgba(46,154,88,0.08)',
                   }} />
              <div className="relative flex justify-between items-center px-3 py-2">
                <span className={`text-sm ${isMine ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-ink-700 dark:text-slate-300'}`}>
                  {isMine && '✓ '}{opt.label}
                </span>
                <span className="text-xs tabular-nums text-ink-500 dark:text-slate-400">
                  {pct.toFixed(0)}% ({count})
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-2 text-right">총 {total}명 응답</div>
    </div>
  );
}
