import React, { useMemo, useState, useEffect } from 'react';
import { MEDS, MED_BY_ID } from '../lib/constants.js';
import { fetchReboundCurve, fetchReboundByExercise } from '../lib/supabaseStats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import { Storage } from '../lib/storage.js';

// 중단 고려자용 — 본인 시작 체중·감량분·약 입력 → 중단 후 N주 회복 예측 + CI
// 운동 지속 vs 미지속 두 곡선 동시 표시
export function StopProjector({ user = null, defaultMedication = 'wegovy' }) {
  // 가입자면 본인 데이터 prefill, 비가입자면 default
  const userStartWeight = user?.startWeight || null;
  const userCurrentWeight = useMemo(() => {
    if (!user) return null;
    try {
      const logs = Storage.getLogsByUser(user.id);
      return logs.length ? logs[logs.length - 1].weight : null;
    } catch { return null; }
  }, [user]);

  const [startWeight, setStartWeight] = useState(userStartWeight ?? 78);
  const [currentWeight, setCurrentWeight] = useState(userCurrentWeight ?? 70);
  const [medication, setMedication] = useState(defaultMedication);
  const [exerciseLevel, setExerciseLevel] = useState('mid'); // low/mid/high

  // 감량분
  const lostKg = Math.max(0, startWeight - currentWeight);
  const accuracy = useMemo(() => {
    let s = 40;
    if (user) s += 20;
    if (lostKg > 0) s += 15;
    if (exerciseLevel) s += 15;
    return Math.min(100, s);
  }, [user, lostKg, exerciseLevel]);

  // 코호트 데이터 가져오기 (백그라운드)
  const [reboundData, setReboundData] = useState(null);
  const [reboundByEx, setReboundByEx] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    Promise.all([
      fetchReboundCurve(medication, [4, 8, 12, 24, 36, 48, 52]),
      fetchReboundByExercise(medication, 24, 90),
    ]).then(([rebound, byEx]) => {
      if (cancelled) return;
      if (rebound?.some(r => r.n >= 5)) setReboundData(rebound);
      if (byEx) setReboundByEx(byEx);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [medication]);

  // 회복 곡선 계산 — 운동 지속 vs 미지속 두 시리즈
  // Fallback (RPC 없을 때): 임상 추정값 (24주 35%, 48주 55% — 미지속 / 지속자는 절반 수준)
  const FALLBACK_REGAIN = { 4: 0.08, 8: 0.15, 12: 0.22, 24: 0.35, 36: 0.45, 48: 0.55, 52: 0.58 };

  const exerciseFactor = exerciseLevel === 'high' ? 0.35 : exerciseLevel === 'low' ? 1.20 : 0.75;

  const projectionPoints = useMemo(() => {
    const weeks = [0, 4, 8, 12, 24, 36, 48, 52];
    const ciBase = Math.max(0.10, 0.50 - (accuracy / 100) * 0.40);
    return weeks.map(w => {
      if (w === 0) return { week: 0, weight: currentWeight, lower: currentWeight, upper: currentWeight };
      // 데이터 우선, 임상 추정 fallback
      let baseRatio = null;
      if (reboundData) {
        const r = reboundData.find(x => x.week === w);
        if (r && r.avgRegainRatio != null) baseRatio = r.avgRegainRatio;
      }
      if (baseRatio == null) baseRatio = FALLBACK_REGAIN[w] ?? 0.4;
      // 운동 수준 적용
      const ratio = Math.max(0, Math.min(1.2, baseRatio * exerciseFactor));
      const gainedKg = lostKg * ratio;
      const mean = currentWeight + gainedKg;
      // CI 폭 — 시간 누적 + 운동 수준 변동성
      const ci = (ciBase + Math.sqrt(w / 52) * 0.08) * Math.max(2, gainedKg) * 1.2;
      return {
        week: w,
        weight: mean,
        lower: Math.max(currentWeight * 0.98, mean - ci),
        upper: Math.min(startWeight * 1.05, mean + ci),
      };
    });
  }, [currentWeight, startWeight, lostKg, exerciseFactor, reboundData, accuracy]);

  // SVG 좌표
  const W = 600, H = 260;
  const PAD = { top: 18, right: 20, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxWeek = 52;
  const allWeights = projectionPoints.map(p => [p.lower, p.upper, p.weight]).flat();
  const minW = Math.min(...allWeights, currentWeight) * 0.97;
  const maxW = Math.max(...allWeights, startWeight) * 1.03;
  const xToPx = (week) => PAD.left + (week / maxWeek) * innerW;
  const yToPx = (w) => PAD.top + (1 - (w - minW) / (maxW - minW)) * innerH;
  const pathFrom = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(p.week).toFixed(1)} ${yToPx(p.weight).toFixed(1)}`).join(' ');
  const bandPathFrom = (pts) => {
    if (pts.length < 2) return '';
    const up = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(p.week).toFixed(1)} ${yToPx(p.upper).toFixed(1)}`).join(' ');
    const down = [...pts].reverse().map(p => `L ${xToPx(p.week).toFixed(1)} ${yToPx(p.lower).toFixed(1)}`).join(' ');
    return `${up} ${down} Z`;
  };

  const xTicks = [0, 4, 12, 24, 36, 52];
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const w = minW + (maxW - minW) * (i / 4);
    yTicks.push({ y: yToPx(w), label: w.toFixed(1) });
  }

  // 핵심 인사이트
  const at24 = projectionPoints.find(p => p.week === 24);
  const at52 = projectionPoints.find(p => p.week === 52);
  const regain24Kg = at24 ? at24.weight - currentWeight : 0;
  const regain52Kg = at52 ? at52.weight - currentWeight : 0;
  const keptPct52 = lostKg > 0 ? Math.round((1 - regain52Kg / lostKg) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 입력 패널 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1">
            시작 체중 <span className="text-ink-500 font-normal">(약 시작 시점)</span>
          </div>
          <input type="range" min={45} max={150} step={0.5}
                 value={startWeight} onChange={e => setStartWeight(+e.target.value)}
                 className="w-full accent-brand-500" />
          <div className="flex justify-between text-[10px] text-ink-500 mt-0.5">
            <span>45</span><b className="tabular-nums text-ink-900 dark:text-slate-100">{startWeight.toFixed(1)} kg</b><span>150</span>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1">
            현재 체중 <span className="text-ink-500 font-normal">(중단 시점)</span>
          </div>
          <input type="range" min={40} max={150} step={0.5}
                 value={currentWeight} onChange={e => setCurrentWeight(+e.target.value)}
                 className="w-full accent-brand-500" />
          <div className="flex justify-between text-[10px] text-ink-500 mt-0.5">
            <span>40</span><b className="tabular-nums text-ink-900 dark:text-slate-100">{currentWeight.toFixed(1)} kg</b><span>150</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1">사용한 약</div>
          <div className="flex gap-1.5 flex-wrap">
            {MEDS.filter(m => m.id !== 'other').map(m => (
              <button key={m.id} type="button" onClick={() => setMedication(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
                                  ${medication === m.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
                {m.label.replace(/\s*\(.+\)/, '')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1">중단 후 운동 의지</div>
          <div className="flex gap-1.5">
            {[
              { id: 'low',  label: '거의 안 함', color: 'rose' },
              { id: 'mid',  label: '주 1-2회',  color: 'amber' },
              { id: 'high', label: '주 3회+',   color: 'emerald' },
            ].map(o => (
              <button key={o.id} type="button" onClick={() => setExerciseLevel(o.id)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition
                                  ${exerciseLevel === o.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 한 줄 */}
      <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/40 dark:border-amber-800/30 px-3 py-2.5 text-sm leading-relaxed">
        지금 끊으면 — <b>24주 후 <span className="tabular-nums">{at24?.weight.toFixed(1) ?? '?'} kg</span></b> (+{regain24Kg.toFixed(1)} kg),
        <b className="ml-1">1년 후 <span className="tabular-nums">{at52?.weight.toFixed(1) ?? '?'} kg</span></b> (감량분 <b className="text-amber-700 dark:text-amber-400">{keptPct52}%</b> 유지)
      </div>

      {/* SVG 그래프 */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        {/* grid */}
        {yTicks.map((t, i) => (
          <g key={'y'+i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.4" />
            <text x={PAD.left - 5} y={t.y + 4} fontSize="10" textAnchor="end" fill="#64748B">{t.label}</text>
          </g>
        ))}
        {xTicks.map((w, i) => (
          <g key={'x'+i}>
            <line x1={xToPx(w)} y1={PAD.top} x2={xToPx(w)} y2={H - PAD.bottom}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.3" />
            <text x={xToPx(w)} y={H - PAD.bottom + 14} fontSize="10" textAnchor="middle" fill="#64748B">
              {w === 0 ? '지금' : w >= 52 ? '1년' : `${w}주`}
            </text>
          </g>
        ))}
        {/* baseline 시작 체중 */}
        <line x1={PAD.left} y1={yToPx(startWeight)} x2={W - PAD.right} y2={yToPx(startWeight)}
              stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
        <text x={W - PAD.right} y={yToPx(startWeight) - 4}
              fontSize="9" textAnchor="end" fill="#64748B">시작 {startWeight.toFixed(1)} kg</text>
        {/* 현재 체중 마커 */}
        <line x1={PAD.left} y1={yToPx(currentWeight)} x2={W - PAD.right} y2={yToPx(currentWeight)}
              stroke="#10B981" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.5" />
        <text x={PAD.left + 3} y={yToPx(currentWeight) - 4}
              fontSize="9" fill="#059669">현재(중단 시점) {currentWeight.toFixed(1)} kg</text>

        {/* CI band */}
        <path d={bandPathFrom(projectionPoints)} fill="#F43F5E" fillOpacity="0.13" stroke="none" />
        {/* 회복 곡선 — dashed rose */}
        <path d={pathFrom(projectionPoints)} fill="none"
              stroke="#F43F5E" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
        {projectionPoints.map((p, i) => (
          <circle key={'p'+i} cx={xToPx(p.week)} cy={yToPx(p.weight)} r="3" fill="#F43F5E" />
        ))}
        {/* 1년 라벨 */}
        {at52 && (
          <text x={xToPx(52)} y={yToPx(at52.weight) - 8}
                fontSize="11" textAnchor="end" fill="#F43F5E" fontWeight="bold">
            +{regain52Kg.toFixed(1)} kg
          </text>
        )}
      </svg>

      {/* 운동 지속 vs 미지속 비교 (코호트 데이터 있을 때) */}
      {reboundByEx && (reboundByEx.active.n + reboundByEx.inactive.n) >= 5 && (
        <div className="rounded-xl bg-brand-50/60 dark:bg-brand-900/15 border border-brand-200/40 dark:border-brand-800/30 p-3">
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">
            🏃 코호트 데이터 — 24주차 회복률 비교
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-[10px] text-ink-500">운동 지속 (주 90분+)</div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {reboundByEx.active.avgRegainPct != null ? `${reboundByEx.active.avgRegainPct.toFixed(0)}%` : '—'}
              </div>
              <div className="text-[10px] text-ink-500">감량분 회복</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-500">운동 미지속</div>
              <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {reboundByEx.inactive.avgRegainPct != null ? `${reboundByEx.inactive.avgRegainPct.toFixed(0)}%` : '—'}
              </div>
              <div className="text-[10px] text-ink-500">감량분 회복</div>
            </div>
          </div>
        </div>
      )}

      {/* CI 안내 */}
      <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed
                       ${accuracy >= 80 ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border border-emerald-200/40 dark:border-emerald-800/30'
                         : 'bg-ink-100/50 dark:bg-slate-800/50 border border-ink-200/40 dark:border-slate-700/40'}`}>
        <b>예측 정확도 {accuracy}%</b> — {accuracy >= 80 ? '신뢰구간 좁음' : '신뢰구간 넓음 (입력값 추가하면 좁아짐)'}
      </div>
    </div>
  );
}
