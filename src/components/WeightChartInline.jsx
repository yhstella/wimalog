import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';

// inline 체중 그래프 — WeightTab에 항상 표시.
// - 좌클릭/드래그: 선 그리기 (여러 날짜 한 번에 입력)
//   드래그 끝나면 모든 점을 weight_logs로 저장 + 다이얼은 마지막 점으로 sync
// - 다이얼에서 받은 currentWeight: today 위치에 큰 marker로 표시
// - 우클릭 + 드래그: 약 처방 추가 (mousedown에서 시작, mouseup에서 방향 판정)
//   위로 = 용량 증량, 아래로 = 감량, 정지 = 같은 용량
// - 활성 약 코스 있어야 우클릭 dose 가능.
// currentDateMs: 부모가 클릭한 raw ms를 그대로 받음 (round 안 함) — marker 위치 정확 동기화
// currentDate (string): 저장용 round된 ISO 날짜. currentDateMs 없을 때 fallback.
export function WeightChartInline({ user, currentWeight, currentDate, currentDateMs, onWeightChange, onDoseAdded, refreshKey, weeksBack = 8 }) {
  const svgRef = useRef(null);
  const dragRef = useRef({ mode: null, startMs: 0 });
  const drawingPointsRef = useRef([]);
  const lastMoveRef = useRef(0);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [rightDragInfo, setRightDragInfo] = useState(null);
  // 모바일용 모드 토글
  const [touchMode, setTouchMode] = useState('weight');

  // 그래프 크기 — 모바일 가독성 위해 키움 (220 → 320)
  const W = 600, H = 320;
  const PAD = { top: 20, right: 14, bottom: 32, left: 38 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const startDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() - weeksBack * 7); return d; }, [today, weeksBack]);
  const days = weeksBack * 7;
  const dayWidth = innerW / days;

  const existingLogs = useMemo(() => {
    if (!user) return [];
    return Storage.getLogsByUser(user.id)
      .filter(l => Date.parse(l.date) >= startDate.getTime() && Date.parse(l.date) <= today.getTime() + 86400000);
  }, [user, refreshKey, weeksBack]);

  const existingDoses = useMemo(() => {
    if (!user) return [];
    const courses = Storage.getMedCoursesByUser(user.id);
    const courseById = new Map(courses.map(c => [c.id, c]));
    return Storage.getDosesByUser(user.id)
      .filter(d => Date.parse(d.date) >= startDate.getTime() && Date.parse(d.date) <= today.getTime() + 86400000)
      .map(d => {
        const course = courseById.get(d.courseId);
        const medLabel = course ? (MED_BY_ID[course.medication]?.label.replace(/\s*\(.+\)/, '') || '') : '';
        return { ...d, medLabel };
      });
  }, [user, refreshKey, weeksBack]);

  const activeCourses = useMemo(() => {
    if (!user) return [];
    return Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate);
  }, [user, refreshKey]);

  // Y축 scale — currentWeight를 deps에서 제거해서 입력해도 흔들리지 않음.
  // 최소 ±6kg 보장 → 빈/작은 데이터에서도 충분한 입력 공간 확보, 첫 입력과 후속 입력 동일 scale.
  const { yMin, yMax, yStep } = useMemo(() => {
    const ys = existingLogs.map(l => l.weight);
    // startWeight를 anchor로 항상 포함 — 첫 mount 시 currentWeight 없어도 안정 scale
    const anchor = user?.startWeight ?? (currentWeight ? +currentWeight : 70);
    if (anchor) ys.push(anchor);
    if (!ys.length) return { yMin: anchor - 6, yMax: anchor + 6, yStep: 2 };
    const min = Math.min(...ys), max = Math.max(...ys);
    const center = (min + max) / 2;
    // 데이터 range가 12kg 이상이면 그것 사용, 아니면 최소 12kg 보장
    const halfRange = Math.max(6, (max - min) / 2 + 1.5);
    const lo = Math.max(30, center - halfRange);
    const hi = Math.min(250, center + halfRange);
    const span = hi - lo;
    const step = span < 8 ? 1 : span < 18 ? 2 : span < 45 ? 5 : 10;
    return {
      yMin: Math.floor(lo / step) * step,
      yMax: Math.ceil(hi / step) * step,
      yStep: step,
    };
  }, [existingLogs, user]);

  const dateMsToX = (ms) => PAD.left + ((ms - startDate.getTime()) / 86400000) * dayWidth;
  const weightToY = (w) => PAD.top + (yMax - w) / (yMax - yMin) * innerH;
  const xToDateMs = (x) => startDate.getTime() + Math.round((x - PAD.left) / dayWidth) * 86400000;
  const yToWeight = (y) => +Math.max(yMin, Math.min(yMax, yMax - (y - PAD.top) / innerH * (yMax - yMin))).toFixed(1);

  const getSvgPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    const ev = e.touches?.[0] || e;
    pt.x = ev.clientX; pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  };

  // pointer down — 마우스 좌/우 버튼 OR 터치 모드 따라 분기
  const onPointerDown = (e) => {
    const p = getSvgPoint(e);
    if (!p || p.x < PAD.left || p.x > W - PAD.right || p.y < PAD.top || p.y > H - PAD.bottom) return;
    const isTouch = e.touches && e.touches.length > 0;
    // 터치는 touchMode 따름, 마우스는 button 따름
    const isDoseMode = isTouch ? touchMode === 'dose' : e.button === 2;
    const isWeightMode = isTouch ? touchMode === 'weight' : (e.button === 0 || e.button === undefined);

    if (isDoseMode) {
      e.preventDefault();
      const screenY = (e.touches?.[0] || e).clientY;
      dragRef.current = { mode: 'right', startMs: xToDateMs(p.x), startX: p.x, startY: p.y, screenY };
      setRightDragInfo({ x: p.x, y: p.y, dy: 0 });
    } else if (isWeightMode) {
      e.preventDefault();
      dragRef.current = { mode: 'left' };
      lastMoveRef.current = 0;
      // raw fractional ms — marker 위치 동기화용. round된 date는 저장용.
      const exactMs = startDate.getTime() + ((p.x - PAD.left) / dayWidth) * 86400000;
      const date = new Date(exactMs).toISOString().slice(0, 10);
      const weight = yToWeight(p.y);
      drawingPointsRef.current = [{ date, weight }];
      setDrawingPoints([{ date, weight }]);
      onWeightChange?.({ date, weight, exactMs });
    }
  };

  // pointer move/up — 모드별 처리
  // throttle 32ms (~30fps) + ref 기반 누적으로 setState updater 안 side effect 제거 (ErrorBoundary 회피)
  useEffect(() => {
    const THROTTLE_MS = 32;
    const onMove = (e) => {
      if (!dragRef.current.mode) return;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - lastMoveRef.current < THROTTLE_MS) return;
      lastMoveRef.current = now;
      const p = getSvgPoint(e);
      if (!p) return;
      if (dragRef.current.mode === 'left') {
        if (p.x < PAD.left - 5 || p.x > W - PAD.right + 5) return;
        const exactMs = startDate.getTime() + ((p.x - PAD.left) / dayWidth) * 86400000;
        const date = new Date(exactMs).toISOString().slice(0, 10);
        const weight = yToWeight(p.y);
        const filtered = drawingPointsRef.current.filter(x => x.date !== date);
        const next = [...filtered, { date, weight }].sort((a, b) => a.date.localeCompare(b.date));
        drawingPointsRef.current = next;
        setDrawingPoints(next);
        onWeightChange?.({ date, weight, exactMs });
      } else if (dragRef.current.mode === 'right') {
        const screenY = (e.touches?.[0] || e).clientY;
        const dy = dragRef.current.screenY - screenY;
        setRightDragInfo({ x: dragRef.current.startX, y: dragRef.current.startY, dy });
      }
    };
    const onUp = (e) => {
      const drag = dragRef.current;
      const mode = drag.mode;
      if (!mode) return;
      dragRef.current = { mode: null };
      if (mode === 'left') {
        const points = drawingPointsRef.current;
        drawingPointsRef.current = [];
        setDrawingPoints([]);
        if (points.length >= 2) {
          try {
            for (const pt of points) {
              Storage.addLog({
                id: uid('log'),
                userId: user.id,
                date: pt.date,
                weight: pt.weight,
                appetiteChange: 3, satiety: 3, mealReduction: 3,
                sideEffects: {},
                notes: '곡선 입력',
                createdAt: new Date().toISOString(),
              });
            }
            const last = points[points.length - 1];
            onWeightChange?.({ date: last.date, weight: last.weight, savedCount: points.length });
          } catch (err) {
            console.error('[WeightChartInline] save failed', err);
          }
        }
      } else if (mode === 'right') {
        const screenY = (e.changedTouches?.[0] || e.touches?.[0] || e).clientY;
        const dy = drag.screenY != null ? drag.screenY - screenY : 0;
        const direction = dy > 25 ? 1 : dy < -25 ? -1 : 0;
        setRightDragInfo(null);
        try {
          addDoseAtDate(new Date(drag.startMs).toISOString().slice(0, 10), direction);
        } catch (err) {
          console.error('[WeightChartInline] dose save failed', err);
        }
      }
    };
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
  }, [yMin, yMax, user, activeCourses, PAD.left, PAD.right, W, dayWidth, startDate, innerH, PAD.top, onWeightChange, onDoseAdded]);

  // 우클릭 컨텍스트메뉴 막기
  const onContextMenu = (e) => {
    e.preventDefault();
  };

  const addDoseAtDate = (date, direction) => {
    // useMemo가 stale일 수 있어 fresh fetch — 약 방금 등록한 사용자가 즉시 우클릭하는 케이스 대응
    const allCourses = Storage.getMedCoursesByUser(user.id);
    const active = allCourses.filter(c => !c.endDate);
    const course = active[0] || allCourses[allCourses.length - 1];  // active 없어도 가장 최근 코스 사용
    if (!course) {
      alert('약을 먼저 등록해야 그래프에서 처방을 추가할 수 있어요. (메뉴 → 약)');
      return;
    }
    const med = MED_BY_ID[course.medication];
    if (!med?.doses?.length) return;
    const lastDose = Storage.getDosesByCourse(course.id).slice(-1)[0];
    const currentIdx = lastDose ? med.doses.indexOf(lastDose.dose) : 0;
    let newIdx = currentIdx;
    if (direction > 0) newIdx = Math.min(med.doses.length - 1, currentIdx + 1);
    else if (direction < 0) newIdx = Math.max(0, currentIdx - 1);
    const newDose = med.doses[newIdx];

    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId: course.id,
      seed: false,
      date,
      dose: newDose,
      price: lastDose?.price || null,
      region: lastDose?.region || null,
      pharmacyName: null,
      notes: '그래프 입력',
      createdAt: new Date().toISOString(),
    });
    onDoseAdded?.({ date, dose: newDose, medication: med.label.replace(/\s*\(.+\)/, ''), direction });
  };

  const xTicks = [];
  for (let i = 0; i <= weeksBack; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i * 7);
    xTicks.push({ x: dateMsToX(d.getTime()), label: i === weeksBack ? '오늘' : `${weeksBack - i}주전` });
  }
  const yTicks = [];
  for (let w = yMin; w <= yMax + 0.001; w += yStep) {
    yTicks.push({ y: weightToY(w), label: yStep < 1 ? w.toFixed(1) : Math.round(w) });
  }

  // marker 위치 — raw ms 우선(round 안 함), 없으면 round된 date string fallback
  // 다이얼 변경 시 X 유지(같은 ms), 그래프 클릭 시 클릭한 정확한 X로 즉시 동기화
  const markerMs = currentDateMs != null ? currentDateMs : (currentDate ? Date.parse(currentDate) : null);
  const currentX = markerMs != null
    ? PAD.left + (markerMs - startDate.getTime()) / 86400000 * dayWidth
    : null;
  const currentY = currentWeight ? weightToY(+currentWeight) : null;

  // 그리고 있는 path
  const drawingPath = drawingPoints.length >= 2
    ? 'M ' + drawingPoints.map(p => `${dateMsToX(Date.parse(p.date))} ${weightToY(p.weight)}`).join(' L ')
    : '';

  // 우드래그 시각화
  const rightArrow = rightDragInfo
    ? { from: { x: rightDragInfo.x, y: rightDragInfo.y },
        to:   { x: rightDragInfo.x, y: rightDragInfo.y - rightDragInfo.dy },
        direction: rightDragInfo.dy > 25 ? 1 : rightDragInfo.dy < -25 ? -1 : 0 }
    : null;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${touchMode === 'dose'
        ? 'border-orange-300 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-900/10'
        : 'border-ink-200 dark:border-slate-700 bg-ink-100/20 dark:bg-slate-800/20'}`}>
      {/* 모바일용 모드 토글 + 안내 */}
      <div className="px-2 py-1.5 border-b border-ink-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          <button type="button" onClick={() => setTouchMode('weight')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${touchMode === 'weight'
                    ? 'bg-brand-500 text-white'
                    : 'bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300'}`}>
            ⚖️ 체중
          </button>
          <button type="button" onClick={() => setTouchMode('dose')}
                  disabled={!activeCourses.length}
                  title={!activeCourses.length ? '활성 약 필요' : ''}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${touchMode === 'dose'
                    ? 'bg-orange-500 text-white'
                    : 'bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300'}`}>
            💊 처방
          </button>
        </div>
        <span className="text-[10px] text-ink-500 dark:text-slate-400 flex-1 text-right">
          {touchMode === 'weight'
            ? <>드래그 = 선 그리기</>
            : <>드래그 위↑ <b className="text-emerald-600">증량</b> · 아래↓ <b className="text-rose-600">감량</b></>}
        </span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
           className="w-full block cursor-crosshair touch-none select-none"
           onMouseDown={onPointerDown} onTouchStart={onPointerDown}
           onContextMenu={onContextMenu}>
        {yTicks.map((t, i) => (
          <g key={'y'+i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.4" />
            <text x={PAD.left - 5} y={t.y + 4} fontSize="11" textAnchor="end" fill="#64748B">{t.label}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={'x'+i}>
            <line x1={t.x} y1={PAD.top} x2={t.x} y2={H - PAD.bottom}
                  stroke="#CBD5E1" strokeDasharray="2 3" strokeOpacity="0.3" />
            <text x={t.x} y={H - PAD.bottom + 14} fontSize="11" textAnchor="middle" fill="#64748B">{t.label}</text>
          </g>
        ))}

        {/* 기존 weight_logs */}
        {existingLogs.map((l, i) => (
          <circle key={'l'+i}
                  cx={dateMsToX(Date.parse(l.date))}
                  cy={weightToY(l.weight)}
                  r="3" fill="#94A3B8" />
        ))}

        {/* 기존 doses — 점선 전체 + marker/라벨은 X축 위쪽 (보기 좋은 위치) */}
        {existingDoses.map((d, i) => {
          const x = dateMsToX(Date.parse(d.date));
          // 같은 날짜 dose 여러 개면 Y offset (위로 stack)
          const stackIdx = existingDoses.slice(0, i).filter(o => Math.abs(dateMsToX(Date.parse(o.date)) - x) < 2).length;
          // X축 바로 위 (그래프 하단 영역) — 너무 최상단 안 가게
          const labelY = H - PAD.bottom - 10 - stackIdx * 12;
          const label = d.medLabel && d.dose ? `${d.medLabel} ${d.dose}` : (d.dose || '');
          // 그래프 우측 끝 가까우면 좌측으로 라벨
          const rightSide = x < W - 90;
          return (
            <g key={'d'+i}>
              <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                    stroke="#F97316" strokeWidth="1" strokeDasharray="1 2" strokeOpacity="0.5" />
              <circle cx={x} cy={labelY} r="3.5" fill="#F97316" />
              {label && (
                <text x={x + (rightSide ? 6 : -6)} y={labelY + 3.5}
                      textAnchor={rightSide ? 'start' : 'end'}
                      fontSize="10" fontWeight="600" fill="#C2410C"
                      stroke="white" strokeWidth="3" paintOrder="stroke">
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* 좌드래그 그리고 있는 선 */}
        {drawingPath && (
          <path d={drawingPath} fill="none" stroke="#2E9A58" strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" />
        )}
        {drawingPoints.map((p, i) => (
          <circle key={'dp'+i}
                  cx={dateMsToX(Date.parse(p.date))}
                  cy={weightToY(p.weight)}
                  r="3" fill="#2E9A58" stroke="white" strokeWidth="1.5" />
        ))}

        {/* 우드래그 화살표 (방향 시각화) */}
        {rightArrow && (
          <g>
            <line x1={rightArrow.from.x} y1={rightArrow.from.y}
                  x2={rightArrow.to.x} y2={rightArrow.to.y}
                  stroke={rightArrow.direction > 0 ? '#10B981' : rightArrow.direction < 0 ? '#EF4444' : '#94A3B8'}
                  strokeWidth="2" strokeDasharray="2 2" />
            <circle cx={rightArrow.from.x} cy={rightArrow.from.y} r="4"
                    fill="none" stroke={rightArrow.direction > 0 ? '#10B981' : rightArrow.direction < 0 ? '#EF4444' : '#94A3B8'} strokeWidth="2" />
            <text x={rightArrow.from.x + 8} y={rightArrow.from.y - 6} fontSize="11" fontWeight="bold"
                  fill={rightArrow.direction > 0 ? '#10B981' : rightArrow.direction < 0 ? '#EF4444' : '#64748B'}>
              {rightArrow.direction > 0 ? '↑ 증량' : rightArrow.direction < 0 ? '↓ 감량' : '· 동일'}
            </text>
          </g>
        )}

        {/* 현재 입력 중인 marker */}
        {currentX != null && currentY != null && !drawingPath && (
          <g>
            <circle cx={currentX} cy={currentY} r="7" fill="#2E9A58" fillOpacity="0.3" />
            <circle cx={currentX} cy={currentY} r="4" fill="#2E9A58" stroke="white" strokeWidth="2" />
            <text x={currentX} y={currentY - 10} fontSize="10" textAnchor="middle" fill="#2E9A58" fontWeight="bold">
              {currentWeight}kg
            </text>
          </g>
        )}
      </svg>
      <div className="px-2 py-1 border-t border-ink-100 dark:border-slate-800 flex gap-3 flex-wrap text-[10px] text-ink-500 dark:text-slate-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1"></span>기존 체중</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"></span>처방</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-brand-500 mr-1"></span>입력 중</span>
        <span className="ml-auto hidden sm:inline opacity-70">데스크탑: 좌클릭/우클릭으로 모드 자동 선택</span>
      </div>
      {activeCourses[0] && (
        <div className="px-2 py-1 border-t border-ink-100 dark:border-slate-800 text-[10px] text-ink-500 dark:text-slate-400">
          활성 약: <b>{MED_BY_ID[activeCourses[0].medication]?.label.replace(/\s*\(.+\)/, '')}</b>
        </div>
      )}
    </div>
  );
}
