import React, { useMemo, useState } from 'react';

// 라인 차트 (단일 또는 다중 시리즈)
// 단일: data: [{ x, y, label? }]
// 다중: series: [{ name, color, data: [{ x, y, label? }] }, ...]
export function LineChart({
  data, series, height = 220, yLabel = 'kg',
  target = null, color = '#2E9A58',
  yMin: yMinProp, yMax: yMaxProp,
}) {
  const padding = { top: 16, right: 20, bottom: 30, left: 40 };
  const width = 600;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const [hoverIdx, setHoverIdx] = useState(null);

  // series 정규화: data prop이 오면 단일 시리즈로
  const allSeries = useMemo(() => {
    if (series && series.length) return series;
    if (data && data.length) return [{ name: '값', color, data }];
    return [];
  }, [data, series, color]);

  // X 도메인은 가장 긴 시리즈 기준 (인덱스)
  const maxLen = Math.max(0, ...allSeries.map(s => s.data.length));

  const { yMin, yMax } = useMemo(() => {
    const ys = [];
    allSeries.forEach(s => s.data.forEach(d => { if (d.y != null) ys.push(d.y); }));
    if (target != null) ys.push(target);
    if (!ys.length) return { yMin: 0, yMax: 1 };
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.15;
    return {
      yMin: yMinProp != null ? yMinProp : yMin - pad,
      yMax: yMaxProp != null ? yMaxProp : yMax + pad,
    };
  }, [allSeries, target, yMinProp, yMaxProp]);

  if (!maxLen) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-ink-500 dark:text-slate-400 text-sm">
        <div className="text-3xl mb-2">📈</div>
        <div>아직 기록이 없습니다</div>
      </div>
    );
  }

  const xPos = (i) => padding.left + (maxLen === 1 ? innerW / 2 : (i / (maxLen - 1)) * innerW);
  const yPos = (v) => padding.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (yMax - yMin) * (i / 4);
    yTicks.push({ y: padding.top + (1 - i / 4) * innerH, label: v.toFixed(1) });
  }

  const targetY = target != null ? yPos(target) : null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none"
           onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          {allSeries.map((s, i) => (
            <linearGradient key={i} id={`lc-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Y 그리드 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} y1={t.y} x2={width - padding.right} y2={t.y}
                  className="stroke-ink-100 dark:stroke-slate-700" strokeDasharray="3 3" />
            <text x={padding.left - 6} y={t.y + 4} fontSize="10" textAnchor="end"
                  className="fill-ink-500 dark:fill-slate-500">{t.label}</text>
          </g>
        ))}

        {targetY != null && (
          <g>
            <line x1={padding.left} y1={targetY} x2={width - padding.right} y2={targetY}
                  stroke="#EAB308" strokeDasharray="6 4" strokeWidth="1.5" />
            <text x={width - padding.right} y={targetY - 4} fontSize="10" textAnchor="end"
                  className="fill-amber-700 dark:fill-amber-400">
              목표 {target.toFixed(1)}
            </text>
          </g>
        )}

        {/* 시리즈 (뒷 시리즈가 먼저, 강조선이 앞에) */}
        {allSeries.map((s, si) => {
          const pts = s.data.map((d, i) => d.y != null
            ? { x: xPos(i), y: yPos(d.y), raw: d, idx: i }
            : null
          ).filter(Boolean);
          if (!pts.length) return null;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          const area = allSeries.length === 1
            ? `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`
            : null;
          return (
            <g key={si}>
              {area && <path d={area} fill={`url(#lc-grad-${si})`} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round"
                    strokeDasharray={s.dashed ? '6 4' : null} />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === p.idx ? 5 : 3.5}
                        fill="white" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          );
        })}

        {/* hover 막대 */}
        {Array.from({ length: maxLen }).map((_, i) => (
          <rect key={i}
                x={xPos(i) - innerW / maxLen / 2}
                y={padding.top}
                width={innerW / maxLen}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onTouchStart={() => setHoverIdx(i)} />
        ))}

        {hoverIdx != null && (
          <line x1={xPos(hoverIdx)} y1={padding.top} x2={xPos(hoverIdx)} y2={padding.top + innerH}
                stroke="#94A3B8" strokeOpacity="0.5" strokeDasharray="2 2" />
        )}

        {/* X축 라벨 (첫·중·끝) */}
        {[0, Math.floor(maxLen / 2), maxLen - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => {
          const label = allSeries[0]?.data[i]?.label;
          if (!label) return null;
          return (
            <text key={i} x={xPos(i)} y={height - 8} fontSize="10" textAnchor="middle"
                  className="fill-ink-500 dark:fill-slate-500">{label}</text>
          );
        })}
      </svg>

      {/* 범례 + hover 값 */}
      <div className="flex justify-between items-center gap-2 mt-1 flex-wrap min-h-[20px]">
        {allSeries.length > 1 && (
          <div className="flex gap-3 text-xs">
            {allSeries.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-ink-700 dark:text-slate-300">
                <span className="inline-block w-3 h-1 rounded" style={{ background: s.color }} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
        {hoverIdx != null && (
          <div className="text-xs text-ink-700 dark:text-slate-200 ml-auto">
            {allSeries.map((s, i) => s.data[hoverIdx] && s.data[hoverIdx].y != null && (
              <span key={i} className="ml-2">
                <span style={{ color: s.color }}>●</span> {s.name}: <b className="tabular-nums">{s.data[hoverIdx].y.toFixed(1)} {yLabel}</b>
              </span>
            ))}
            {allSeries[0]?.data[hoverIdx]?.label && (
              <span className="text-ink-500 dark:text-slate-500 ml-2">({allSeries[0].data[hoverIdx].label})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 가로 바 차트 — N 카운트는 더 이상 노출하지 않음 (percentage only)
export function HBarChart({ data, color = '#2E9A58', max = null }) {
  if (!data?.length) return <div className="text-sm text-ink-500 dark:text-slate-400">데이터 분석 중입니다</div>;
  const m = max ?? Math.max(...data.map(d => d.value), 0.001);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink-700 dark:text-slate-300">{d.label}</span>
            <span className="text-ink-500 dark:text-slate-500 tabular-nums">
              {(d.value * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${Math.max(2, (d.value / m) * 100)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 그룹 바 차트 — N 카운트는 더 이상 노출하지 않음
export function GroupBarChart({ data, valueLabel = '%', height = 200, color = '#2E9A58' }) {
  if (!data?.length) return null;
  const filtered = data.filter(d => d.value != null);
  const max = Math.max(...filtered.map(d => Math.abs(d.value)), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value != null ? Math.abs(d.value) / max * (height - 30) : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs font-semibold text-ink-900 dark:text-slate-100 tabular-nums h-5">
                {d.value != null ? d.value.toFixed(1) + valueLabel : '—'}
              </div>
              <div className="w-full rounded-t-lg transition-all"
                   style={{ height: h, background: d.value != null ? (d.color || color) : '#CBD5E1' }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-xs text-ink-700 dark:text-slate-300 leading-tight">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
