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
export function WeightChartInline({ user, currentWeight, currentDate, onWeightChange, onDoseAdded, refreshKey, weeksBack = 8 }) {
  const svgRef = useRef(null);
  const dragRef = useRef({ mode: null, startMs: 0 });
  const [drawingPoints, setDrawingPoints] = useState([]);  // 좌드래그 중 점들
  const [rightDragInfo, setRightDragInfo] = useState(null);  // 우드래그 시각화

  const W = 600, H = 220;
  const PAD = { top: 16, right: 12, bottom: 28, left: 32 };
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
    return Storage.getDosesByUser(user.id)
      .filter(d => Date.parse(d.date) >= startDate.getTime() && Date.parse(d.date) <= today.getTime() + 86400000);
  }, [user, refreshKey, weeksBack]);

  const activeCourses = useMemo(() => {
    if (!user) return [];
    return Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate);
  }, [user, refreshKey]);

  const { yMin, yMax } = useMemo(() => {
    const ys = existingLogs.map(l => l.weight);
    if (currentWeight) ys.push(+currentWeight);
    if (user?.startWeight) ys.push(user.startWeight);
    if (!ys.length) return { yMin: 50, yMax: 100 };
    const min = Math.min(...ys), max = Math.max(...ys);
    return { yMin: Math.max(35, Math.floor(min - 3)), yMax: Math.min(250, Math.ceil(max + 3)) };
  }, [existingLogs, currentWeight, user]);

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

  // pointer down — button에 따라 모드 분기
  const onPointerDown = (e) => {
    const p = getSvgPoint(e);
    if (!p || p.x < PAD.left || p.x > W - PAD.right || p.y < PAD.top || p.y > H - PAD.bottom) return;
    if (e.button === 2) {
      // 우클릭 시작 — 방향 추적용
      e.preventDefault();
      dragRef.current = { mode: 'right', startMs: xToDateMs(p.x), startX: p.x, startY: p.y, screenY: e.clientY };
      setRightDragInfo({ x: p.x, y: p.y, dy: 0 });
    } else if (e.button === 0 || e.button === undefined) {
      // 좌클릭 또는 터치 — 선 그리기 시작
      e.preventDefault();
      dragRef.current = { mode: 'left' };
      const date = new Date(xToDateMs(p.x)).toISOString().slice(0, 10);
      const weight = yToWeight(p.y);
      setDrawingPoints([{ date, weight }]);
      onWeightChange?.({ date, weight });
    }
  };

  // pointer move — 모드별 처리
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.mode) return;
      const p = getSvgPoint(e);
      if (!p) return;
      if (dragRef.current.mode === 'left') {
        const date = new Date(xToDateMs(p.x)).toISOString().slice(0, 10);
        const weight = yToWeight(p.y);
        setDrawingPoints(prev => {
          // 같은 날짜 중복 제거 + 정렬
          const filtered = prev.filter(x => x.date !== date);
          return [...filtered, { date, weight }].sort((a, b) => a.date.localeCompare(b.date));
        });
        onWeightChange?.({ date, weight });
      } else if (dragRef.current.mode === 'right') {
        const screenY = (e.touches?.[0] || e).clientY;
        const dy = dragRef.current.screenY - screenY;
        setRightDragInfo({ x: dragRef.current.startX, y: dragRef.current.startY, dy });
      }
    };
    const onUp = (e) => {
      const mode = dragRef.current.mode;
      if (!mode) return;
      if (mode === 'left') {
        // 그린 점들 일괄 저장
        setDrawingPoints(prev => {
          if (prev.length >= 2) {
            // 여러 점이면 모두 저장
            for (const pt of prev) {
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
            // refresh를 위해 onDoseAdded 같은 hook 호출 — 부모가 refresh 트리거
            onWeightChange?.({ date: prev[prev.length - 1].date, weight: prev[prev.length - 1].weight, savedCount: prev.length });
          }
          return [];  // 점 그리기 초기화
        });
      } else if (mode === 'right') {
        // 우클릭 방향 판정 → dose 추가
        const screenY = (e.touches?.[0] || e).clientY;
        const dy = dragRef.current.screenY - screenY;
        const direction = dy > 25 ? 1 : dy < -25 ? -1 : 0;
        addDoseAtDate(new Date(dragRef.current.startMs).toISOString().slice(0, 10), direction);
        setRightDragInfo(null);
      }
      dragRef.current = { mode: null };
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
  }, [yMin, yMax, user, activeCourses]);

  // 우클릭 컨텍스트메뉴 막기
  const onContextMenu = (e) => {
    e.preventDefault();
  };

  const addDoseAtDate = (date, direction) => {
    if (!activeCourses.length) {
      alert('약을 먼저 등록해야 그래프에서 처방을 추가할 수 있어요. (메뉴 → 약)');
      return;
    }
    const course = activeCourses[0];
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
  for (let w = Math.ceil(yMin / 5) * 5; w <= yMax; w += 5) {
    yTicks.push({ y: weightToY(w), label: w });
  }

  const currentX = currentDate ? dateMsToX(Date.parse(currentDate)) : null;
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
    <div className="rounded-xl border border-ink-200 dark:border-slate-700 bg-ink-100/20 dark:bg-slate-800/20 overflow-hidden">
      <div className="px-2 py-1 text-[10px] text-ink-500 dark:text-slate-400 border-b border-ink-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
        <span>📈 최근 {weeksBack}주 · <b>좌드래그</b> 선 그리기 · <b>우드래그</b> 처방 추가 (위↑증량/아래↓감량)</span>
        {activeCourses[0] && (
          <span className="text-[10px] opacity-70">활성: {MED_BY_ID[activeCourses[0].medication]?.label.replace(/\s*\(.+\)/, '')}</span>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
           className="w-full block cursor-crosshair touch-none select-none"
           onMouseDown={onPointerDown} onTouchStart={onPointerDown}
           onContextMenu={onContextMenu}>
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
            <text x={t.x} y={H - PAD.bottom + 12} fontSize="9" textAnchor="middle" fill="#64748B">{t.label}</text>
          </g>
        ))}

        {/* 기존 weight_logs */}
        {existingLogs.map((l, i) => (
          <circle key={'l'+i}
                  cx={dateMsToX(Date.parse(l.date))}
                  cy={weightToY(l.weight)}
                  r="3" fill="#94A3B8" />
        ))}

        {/* 기존 doses */}
        {existingDoses.map((d, i) => (
          <g key={'d'+i}>
            <line x1={dateMsToX(Date.parse(d.date))} y1={PAD.top}
                  x2={dateMsToX(Date.parse(d.date))} y2={H - PAD.bottom}
                  stroke="#F97316" strokeWidth="1" strokeDasharray="1 2" strokeOpacity="0.5" />
            <circle cx={dateMsToX(Date.parse(d.date))} cy={PAD.top + 4} r="3" fill="#F97316" />
          </g>
        ))}

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
      <div className="px-2 py-1 text-[10px] text-ink-500 dark:text-slate-500 border-t border-ink-100 dark:border-slate-800 flex gap-3 flex-wrap">
        <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1"></span>기존 체중</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"></span>처방</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-brand-500 mr-1"></span>입력 중</span>
      </div>
    </div>
  );
}
