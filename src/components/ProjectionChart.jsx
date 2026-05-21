import React, { useEffect, useMemo, useState } from 'react';
import { simulateTimeline, FREQ_BY_ID, bmiResponseFactor, bmi as calcBmi, USAGE_FREQUENCIES } from '../lib/stats.js';
import { fetchAvgLossCurve, fetchReboundCurve } from '../lib/supabaseStats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';

// 체중 추이 예측 그래프 — 약 사용 + 중단 후 회복 시각화
// props: startWeight (kg), height (cm), medication, frequency
export function ProjectionChart({ startWeight, height, medication = 'wegovy', frequency = 'weekly', compact = false }) {
  // 중단 시점 — 사용자 슬라이더 (4/12/24/48주 선택 또는 끝까지 사용)
  const [stopWeek, setStopWeek] = useState(24);
  const [showStopped, setShowStopped] = useState(true);

  // 1년(52주) 사용 + 중단 후 1년(52주) = 총 104주 시점들
  const usageWeeks = [0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 52];
  const reboundWeeks = [4, 8, 12, 24, 36, 48, 52];

  // Supabase RPC 우선, fallback localStorage simulateTimeline
  const [usageLoss, setUsageLoss] = useState(null);
  const [reboundData, setReboundData] = useState(null);

  const myBmi = useMemo(() => calcBmi(startWeight, height), [startWeight, height]);
  const freqFactor = FREQ_BY_ID[frequency]?.factor ?? 1.0;
  const bmiFactor = bmiResponseFactor(myBmi);
  const adjust = freqFactor * bmiFactor;

  useEffect(() => {
    if (!supabaseConfigured || !myBmi) return;
    let cancelled = false;
    const filter = { medication, bmiRange: [Math.max(15, myBmi - 4), Math.min(50, myBmi + 4)] };
    Promise.all([
      fetchAvgLossCurve(filter, usageWeeks.filter(w => w > 0)),
      fetchReboundCurve(medication, reboundWeeks),
    ]).then(([curve, rebound]) => {
      if (cancelled) return;
      if (curve && curve.some(c => c.n >= 5)) {
        // boundary monotonicity
        let prev = 0;
        const adjusted = curve.map(r => {
          const lossPct = Math.max(r.avg * adjust, prev * 0.98);
          prev = lossPct;
          return { week: r.week, lossPct, n: r.n };
        });
        setUsageLoss(adjusted);
      }
      if (rebound && rebound.some(r => r.n >= 5)) {
        setReboundData(rebound);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [medication, myBmi, frequency]);

  // localStorage fallback
  const localUsage = useMemo(() => {
    const t = simulateTimeline({ height, startWeight, medication, weeks: usageWeeks.filter(w => w > 0), frequency });
    return t.series.filter(s => s.lossPct != null).map(s => ({ week: s.week, lossPct: s.lossPct, n: s.n }));
  }, [height, startWeight, medication, frequency]);

  const finalUsage = usageLoss || localUsage;

  // 사용 중 weight 곡선 (week → kg)
  const usagePoints = useMemo(() => {
    const pts = [{ week: 0, weight: startWeight }];
    for (const u of finalUsage) {
      pts.push({ week: u.week, weight: startWeight * (1 - u.lossPct / 100) });
    }
    return pts;
  }, [finalUsage, startWeight]);

  // 중단 시점 체중 (interpolation)
  const stopWeight = useMemo(() => {
    if (!usagePoints.length) return startWeight;
    // stopWeek 양쪽 점 찾기
    for (let i = 0; i < usagePoints.length - 1; i++) {
      const a = usagePoints[i], b = usagePoints[i + 1];
      if (stopWeek >= a.week && stopWeek <= b.week) {
        const f = (stopWeek - a.week) / Math.max(1, b.week - a.week);
        return a.weight + (b.weight - a.weight) * f;
      }
    }
    return usagePoints[usagePoints.length - 1].weight;
  }, [usagePoints, stopWeek]);

  const lostKg = startWeight - stopWeight;

  // 중단 후 회복 — gainPct는 중단 시점 체중 기준 % 회복 (수정값)
  // reboundData가 avgGainPct (%) → stopWeight × (1 + gain/100)
  // 데이터 없으면 임상 추정 (24주 30%, 48주 50% 회복)
  const reboundPoints = useMemo(() => {
    const pts = [{ week: stopWeek, weight: stopWeight }];
    const FALLBACK_REGAIN = { 4: 0.08, 8: 0.15, 12: 0.22, 24: 0.35, 36: 0.45, 48: 0.55, 52: 0.58 };
    for (const w of reboundWeeks) {
      let regainRatio = null;
      if (reboundData) {
        const r = reboundData.find(x => x.week === w);
        if (r && r.avgRegainRatio != null) regainRatio = r.avgRegainRatio;
      }
      if (regainRatio == null) regainRatio = FALLBACK_REGAIN[w] ?? 0.4;
      const gainedKg = Math.max(0, lostKg * regainRatio);
      pts.push({ week: stopWeek + w, weight: stopWeight + gainedKg });
    }
    return pts;
  }, [stopWeek, stopWeight, lostKg, reboundData]);

  // 끝까지 사용 (52주) 곡선
  const continuousPoints = usagePoints;

  // ----- SVG 좌표 -----
  const W = 600, H = compact ? 240 : 300;
  const PAD = { top: 18, right: 20, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxWeek = 104;
  // y축: 최저 = stopWeight×0.9, 최고 = startWeight×1.08
  const allWeights = [...continuousPoints, ...reboundPoints].map(p => p.weight);
  const minW = Math.min(...allWeights, stopWeight) * 0.97;
  const maxW = Math.max(startWeight, ...allWeights) * 1.03;

  const xToPx = (week) => PAD.left + (week / maxWeek) * innerW;
  const yToPx = (w) => PAD.top + (1 - (w - minW) / (maxW - minW)) * innerH;

  const pathFrom = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(p.week).toFixed(1)} ${yToPx(p.weight).toFixed(1)}`).join(' ');

  // x축 tick
  const xTicks = [0, 12, 24, 48, 72, 104];
  // y축 tick (4분할)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const w = minW + (maxW - minW) * (i / 4);
    yTicks.push({ y: yToPx(w), label: w.toFixed(1) });
  }

  const stopX = xToPx(stopWeek);
  const stopY = yToPx(stopWeight);

  return (
    <div className="space-y-3">
      {/* 중단 시점 슬라이더 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1">
            중단 시점: <b className="text-brand-700 dark:text-brand-400">{stopWeek}주차</b> · 약 사용 후 체중 <b className="tabular-nums">{stopWeight.toFixed(1)} kg</b> (−{lostKg.toFixed(1)} kg)
          </div>
          <input type="range" min={4} max={52} step={4} value={stopWeek}
                 onChange={e => setStopWeek(+e.target.value)}
                 className="w-full accent-rose-500" />
          <div className="flex justify-between text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">
            <span>4주</span><span>24주</span><span>52주 (1년)</span>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={showStopped} onChange={e => setShowStopped(e.target.checked)}
                 className="accent-rose-500" />
          <span>중단 후 회복</span>
        </label>
      </div>

      {/* SVG 그래프 */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        {/* y grid */}
        {yTicks.map((t, i) => (
          <g key={'y'+i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.4" />
            <text x={PAD.left - 5} y={t.y + 4} fontSize="10" textAnchor="end" fill="#64748B">{t.label}</text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((w, i) => (
          <g key={'x'+i}>
            <line x1={xToPx(w)} y1={PAD.top} x2={xToPx(w)} y2={H - PAD.bottom}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.3" />
            <text x={xToPx(w)} y={H - PAD.bottom + 14} fontSize="10" textAnchor="middle" fill="#64748B">
              {w === 0 ? '시작' : w >= 52 ? `${(w/52).toFixed(0)}년` : `${w}주`}
            </text>
          </g>
        ))}
        {/* baseline (시작 체중) */}
        <line x1={PAD.left} y1={yToPx(startWeight)} x2={W - PAD.right} y2={yToPx(startWeight)}
              stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
        <text x={W - PAD.right} y={yToPx(startWeight) - 4}
              fontSize="9" textAnchor="end" fill="#64748B">시작 {startWeight} kg</text>

        {/* 사용 중 곡선 — solid brand */}
        <path d={pathFrom(continuousPoints)} fill="none"
              stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {continuousPoints.map((p, i) => (
          <circle key={'u'+i} cx={xToPx(p.week)} cy={yToPx(p.weight)} r="3" fill="#0EA5E9" />
        ))}

        {/* 중단 시점 marker (vertical line) */}
        <line x1={stopX} y1={PAD.top} x2={stopX} y2={H - PAD.bottom}
              stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.7" />
        <text x={stopX} y={PAD.top - 4} fontSize="10" textAnchor="middle" fill="#F43F5E" fontWeight="bold">
          중단
        </text>
        <circle cx={stopX} cy={stopY} r="5" fill="#F43F5E" stroke="white" strokeWidth="2" />

        {/* 중단 후 회복 곡선 — dashed rose */}
        {showStopped && (
          <>
            <path d={pathFrom(reboundPoints)} fill="none"
                  stroke="#F43F5E" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
            {reboundPoints.map((p, i) => (
              <circle key={'r'+i} cx={xToPx(p.week)} cy={yToPx(p.weight)} r="3" fill="#F43F5E" />
            ))}
            {/* 회복 끝 라벨 */}
            {(() => {
              const last = reboundPoints[reboundPoints.length - 1];
              const regain = last.weight - stopWeight;
              return (
                <text x={xToPx(last.week)} y={yToPx(last.weight) - 8}
                      fontSize="10" textAnchor="end" fill="#F43F5E" fontWeight="bold">
                  +{regain.toFixed(1)} kg 회복
                </text>
              );
            })()}
          </>
        )}
      </svg>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-[11px] text-ink-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#0EA5E9" strokeWidth="2.5" /></svg>
          약 사용 중 (예측)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#F43F5E" strokeWidth="2.5" strokeDasharray="5 4" /></svg>
          중단 후 회복
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" /></svg>
          시작 체중 baseline
        </span>
      </div>

      {/* 핵심 인사이트 */}
      <div className="rounded-lg bg-ink-100/50 dark:bg-slate-800/50 px-3 py-2.5 text-xs text-ink-700 dark:text-slate-300 leading-relaxed">
        💡 <b>{medication === 'wegovy' ? '위고비' : medication === 'mounjaro' ? '마운자로' : medication}</b> {USAGE_FREQUENCIES.find(f => f.id === frequency)?.label || frequency} 사용 시
        {stopWeek}주차 체중은 평균 <b className="tabular-nums">{stopWeight.toFixed(1)} kg</b> (−{lostKg.toFixed(1)} kg).
        {showStopped && reboundPoints.length > 1 && (() => {
          const finalW = reboundPoints[reboundPoints.length - 1].weight;
          const regain = finalW - stopWeight;
          const keptPct = lostKg > 0 ? Math.round((1 - regain / lostKg) * 100) : 0;
          return (
            <> 중단 후 1년 시점 평균 <b className="tabular-nums">{finalW.toFixed(1)} kg</b> (+{regain.toFixed(1)} kg 회복, 감량분 <b>{keptPct}%</b> 유지).</>
          );
        })()}
        <span className="block mt-1 text-[10px] opacity-70">
          ※ 비슷한 BMI·약·빈도 코호트 평균 기반. 개인차 큼. 운동/식이 지속이 유지율 50% 이상 차이.
        </span>
      </div>
    </div>
  );
}
