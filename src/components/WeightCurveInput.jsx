import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';

// SVG 차트 위에 드래그로 체중 곡선 그리기 — 여러 날 일괄 입력
// 가로: 날짜 (기간 선택), 세로: 체중 (kg 범위)
// 마우스/터치 드래그로 path 그리기 → 일정 간격으로 샘플링 → 각 날짜에 weight_log 자동 생성
export function WeightCurveInput({ user, onClose, onSaved }) {
  const svgRef = useRef(null);
  const drawingRef = useRef({ active: false });
  // 기본 기간: 최근 8주
  const [weeksBack, setWeeksBack] = useState(8);
  // 체중 범위 (기존 startWeight ±20kg)
  const startWeight = user?.startWeight || 75;
  const [yMin, setYMin] = useState(Math.max(40, startWeight - 15));
  const [yMax, setYMax] = useState(startWeight + 5);
  // 그린 점들 — { date: 'YYYY-MM-DD', weight: 75.5 }
  const [points, setPoints] = useState([]);
  const [mode, setMode] = useState('draw'); // 'draw' | 'preview'

  // 차트 크기
  const W = 600, H = 280;
  const PAD = { top: 20, right: 16, bottom: 36, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // 가로 축 — 날짜 단위 (1일 = 픽셀 폭)
  const days = weeksBack * 7;
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const startDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() - days); return d; }, [today, days]);
  const dayWidth = innerW / days;

  // 좌표 변환
  const xToDateMs = (x) => startDate.getTime() + Math.round((x - PAD.left) / dayWidth) * 86400000;
  const yToWeight = (y) => {
    const pct = (y - PAD.top) / innerH;
    return clamp(yMax - pct * (yMax - yMin), yMin, yMax);
  };
  const dateMsToX = (ms) => PAD.left + ((ms - startDate.getTime()) / 86400000) * dayWidth;
  const weightToY = (w) => PAD.top + (yMax - w) / (yMax - yMin) * innerH;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // 포인터 좌표 → SVG 좌표
  const getSvgPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    const ev = e.touches?.[0] || e;
    pt.x = ev.clientX; pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // 그리기 시작
  const onPointerDown = (e) => {
    e.preventDefault();
    const p = getSvgPoint(e);
    if (!p) return;
    drawingRef.current = { active: true };
    addPoint(p);
  };

  const addPoint = (p) => {
    if (p.x < PAD.left || p.x > W - PAD.right) return;
    if (p.y < PAD.top  || p.y > H - PAD.bottom) return;
    const ms = xToDateMs(p.x);
    const date = new Date(ms).toISOString().slice(0, 10);
    const weight = +yToWeight(p.y).toFixed(1);
    setPoints(prev => {
      // 같은 날짜는 덮어쓰기
      const filtered = prev.filter(x => x.date !== date);
      return [...filtered, { date, weight }].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!drawingRef.current.active) return;
      const p = getSvgPoint(e);
      if (p) addPoint(p);
    };
    const onUp = () => { drawingRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [yMin, yMax, weeksBack]);

  const undoLast = () => setPoints(prev => prev.slice(0, -1));
  const reset = () => setPoints([]);

  const saveAll = () => {
    if (!points.length) return;
    // 한 점만 입력해도 OK. 여러 개면 각각 별도 log
    for (const p of points) {
      Storage.addLog({
        id: uid('log'),
        userId: user.id,
        date: p.date,
        weight: p.weight,
        appetiteChange: 3, satiety: 3, mealReduction: 3,
        sideEffects: {},
        notes: '곡선 입력',
        createdAt: new Date().toISOString(),
      });
    }
    onSaved?.(points.length);
    onClose?.();
  };

  // 기존 로그 표시 (회색 점)
  const existingLogs = useMemo(() => {
    if (!user) return [];
    return Storage.getLogsByUser(user.id)
      .filter(l => Date.parse(l.date) >= startDate.getTime() && Date.parse(l.date) <= today.getTime());
  }, [user, weeksBack]);

  // 그린 path
  const path = points.length
    ? 'M ' + points.map(p => `${dateMsToX(Date.parse(p.date))} ${weightToY(p.weight)}`).join(' L ')
    : '';

  // 가로축 tick (주 단위)
  const xTicks = [];
  for (let i = 0; i <= weeksBack; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i * 7);
    xTicks.push({ x: dateMsToX(d.getTime()), label: i === weeksBack ? '오늘' : `${weeksBack - i}주전` });
  }
  // 세로축 tick (5kg 단위)
  const yTicks = [];
  for (let w = Math.ceil(yMin / 5) * 5; w <= yMax; w += 5) {
    yTicks.push({ y: weightToY(w), label: w });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800 px-5 py-3 flex justify-between items-center z-10">
          <div>
            <div className="font-bold text-ink-900 dark:text-slate-100">✏️ 체중 곡선 그리기</div>
            <div className="text-xs text-ink-500 dark:text-slate-400">그래프 위를 클릭·드래그해서 곡선을 그리세요</div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="btn-ghost !p-2">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 기간 + 범위 조절 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-500 dark:text-slate-400">기간:</span>
            {[4, 8, 12, 24].map(w => (
              <button key={w} onClick={() => setWeeksBack(w)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${weeksBack === w ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-300 dark:border-slate-700 text-ink-700 dark:text-slate-300'}`}>
                {w}주
              </button>
            ))}
            <span className="ml-auto text-xs text-ink-500 dark:text-slate-400">
              범위: <b className="tabular-nums">{yMin}-{yMax} kg</b>
            </span>
          </div>

          {/* SVG 차트 */}
          <div className="rounded-xl border-2 border-ink-200 dark:border-slate-700 overflow-hidden bg-ink-100/30 dark:bg-slate-800/30">
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
                 className="w-full block cursor-crosshair touch-none"
                 onMouseDown={onPointerDown} onTouchStart={onPointerDown}>
              {/* 격자 */}
              {yTicks.map((t, i) => (
                <g key={'y'+i}>
                  <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                        stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.4" />
                  <text x={PAD.left - 4} y={t.y + 3} fontSize="9" textAnchor="end" fill="#64748B">{t.label}</text>
                </g>
              ))}
              {xTicks.map((t, i) => (
                <g key={'x'+i}>
                  <line x1={t.x} y1={PAD.top} x2={t.x} y2={H - PAD.bottom}
                        stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.3" />
                  <text x={t.x} y={H - PAD.bottom + 14} fontSize="9" textAnchor="middle" fill="#64748B">{t.label}</text>
                </g>
              ))}

              {/* 기존 로그 (회색 점) */}
              {existingLogs.map((l, i) => (
                <circle key={i}
                        cx={dateMsToX(Date.parse(l.date))}
                        cy={weightToY(l.weight)}
                        r="3" fill="#94A3B8" />
              ))}

              {/* 그린 path */}
              {path && (
                <path d={path} fill="none" stroke="#2E9A58" strokeWidth="2.5"
                      strokeLinejoin="round" strokeLinecap="round" />
              )}
              {/* 그린 점들 */}
              {points.map((p, i) => (
                <circle key={i}
                        cx={dateMsToX(Date.parse(p.date))}
                        cy={weightToY(p.weight)}
                        r="4" fill="#2E9A58" stroke="white" strokeWidth="2" />
              ))}
            </svg>
          </div>

          {/* 입력 결과 미리보기 */}
          <div className="text-xs text-ink-700 dark:text-slate-300">
            {points.length === 0
              ? <span className="text-ink-500 dark:text-slate-500">그래프 위에 클릭·드래그하세요. (회색 점은 기존 기록)</span>
              : <span><b className="text-brand-700 dark:text-brand-400">{points.length}개</b> 데이터 점 — 저장하면 각 날짜에 체중이 기록됩니다.</span>
            }
          </div>

          {/* 액션 */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={undoLast} disabled={!points.length}
                    className="btn-secondary !py-2 text-sm disabled:opacity-50">↶ 마지막 점 취소</button>
            <button onClick={reset} disabled={!points.length}
                    className="btn-secondary !py-2 text-sm disabled:opacity-50">모두 지우기</button>
            <div className="flex-1" />
            <button onClick={onClose} className="btn-secondary !py-2 text-sm">닫기</button>
            <button onClick={saveAll} disabled={!points.length}
                    className="btn-primary !py-2 text-sm disabled:opacity-50">
              {points.length}개 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
