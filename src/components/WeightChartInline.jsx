import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';

// inline 체중 그래프 — WeightTab에 항상 표시.
// - 좌클릭/드래그: 해당 날짜·체중 점 추가 (onWeightChange로 부모 다이얼 sync)
// - 다이얼에서 받은 currentWeight: today 위치에 큰 marker로 표시
// - 우클릭+드래그: 약 처방 추가 (위로 = 용량 증량, 아래로 = 감량, 정지 = 동일)
// 약 코스가 있어야 우클릭 dose 가능.
export function WeightChartInline({ user, currentWeight, currentDate, onWeightChange, onDoseAdded, refreshKey, weeksBack = 8 }) {
  const svgRef = useRef(null);
  const drawingRef = useRef({ active: false, button: 0 });
  const rightStartRef = useRef(null);  // 우클릭 시작 좌표

  // 차트 크기 (반응형 viewBox)
  const W = 600, H = 220;
  const PAD = { top: 16, right: 12, bottom: 28, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const startDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() - weeksBack * 7); return d; }, [today, weeksBack]);
  const days = weeksBack * 7;
  const dayWidth = innerW / days;

  // 기존 로그 + 약 코스 (refreshKey로 갱신)
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

  // 활성 코스 (우클릭 dose 추가용)
  const activeCourses = useMemo(() => {
    if (!user) return [];
    return Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate);
  }, [user, refreshKey]);

  // y 범위: 로그 + currentWeight 기반 자동
  const { yMin, yMax } = useMemo(() => {
    const ys = existingLogs.map(l => l.weight);
    if (currentWeight) ys.push(+currentWeight);
    if (user?.startWeight) ys.push(user.startWeight);
    if (!ys.length) return { yMin: 50, yMax: 100 };
    const min = Math.min(...ys), max = Math.max(...ys);
    return { yMin: Math.max(35, Math.floor(min - 3)), yMax: Math.min(250, Math.ceil(max + 3)) };
  }, [existingLogs, currentWeight, user]);

  // 좌표 변환
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

  // 좌클릭/드래그 → 체중 점 추가 (저장 X, 미리보기만 — 부모 onWeightChange가 currentWeight 업데이트)
  const onPointerDown = (e) => {
    if (e.button === 2) return;  // 우클릭은 contextmenu에서 처리
    e.preventDefault();
    const p = getSvgPoint(e);
    if (!p || p.x < PAD.left || p.x > W - PAD.right || p.y < PAD.top || p.y > H - PAD.bottom) return;
    drawingRef.current = { active: true, button: e.button ?? 0 };
    pickPoint(p);
  };

  const pickPoint = (p) => {
    const ms = xToDateMs(p.x);
    const date = new Date(ms).toISOString().slice(0, 10);
    const weight = yToWeight(p.y);
    // 부모 다이얼/날짜 동기화
    onWeightChange?.({ date, weight });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!drawingRef.current.active) return;
      const p = getSvgPoint(e);
      if (p) pickPoint(p);
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
  }, [yMin, yMax]);

  // 우클릭 — 약 처방 추가
  const onContextMenu = (e) => {
    e.preventDefault();
    if (!activeCourses.length) {
      alert('약을 먼저 등록해야 그래프에서 처방을 추가할 수 있어요. (메뉴 → 약)');
      return;
    }
    const p = getSvgPoint(e);
    if (!p) return;
    rightStartRef.current = { x: p.x, y: p.y, screenY: e.clientY };
    addDoseAtPoint(p, 0);
  };

  const addDoseAtPoint = (p, direction) => {
    const course = activeCourses[0];  // 가장 최근 활성 코스
    const med = MED_BY_ID[course.medication];
    if (!med?.doses?.length) return;

    // 직전 dose 용량 + 방향
    const lastDose = Storage.getDosesByCourse(course.id).slice(-1)[0];
    const currentIdx = lastDose ? med.doses.indexOf(lastDose.dose) : 0;
    let newIdx = currentIdx;
    if (direction > 0) newIdx = Math.min(med.doses.length - 1, currentIdx + 1);
    else if (direction < 0) newIdx = Math.max(0, currentIdx - 1);
    const newDose = med.doses[newIdx];

    const ms = xToDateMs(p.x);
    const date = new Date(ms).toISOString().slice(0, 10);
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

  // 우클릭 후 mouseup으로 방향 결정
  useEffect(() => {
    const onUp = (e) => {
      if (e.button !== 2 || !rightStartRef.current) return;
      const dy = rightStartRef.current.screenY - e.clientY;  // 위 = 양수
      const direction = dy > 30 ? 1 : dy < -30 ? -1 : 0;
      // 마지막에 만든 dose의 방향이 0이므로, 0이 아니면 dose 갱신 (방향 적용)
      if (direction !== 0) {
        // 가장 최근 추가된 dose가 방향에 따라 변경되어야 함 — 간단하게 새로 추가 + 직전 메모 X
        // 실제로는 onContextMenu에서 이미 dose 추가 → 방향 다르면 직전 dose 삭제 + 새 dose 추가
        // 단순화: 방향이 있으면 그 방향 dose 추가만 (즉 2개 입력 가능 — 사용자 의도 분리)
        // 깔끔하게: 직전 dose 삭제 → 새 dose (방향 적용)
        const doses = Storage.getDosesByUser(user.id);
        const last = doses[doses.length - 1];
        if (last && last.notes === '그래프 입력') {
          Storage.deleteDose(last.id);
          const p = { x: dateMsToX(Date.parse(last.date)), y: 0 };
          addDoseAtPoint(p, direction);
        }
      }
      rightStartRef.current = null;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [user, activeCourses]);

  // SVG ticks
  const xTicks = [];
  for (let i = 0; i <= weeksBack; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i * 7);
    xTicks.push({ x: dateMsToX(d.getTime()), label: i === weeksBack ? '오늘' : `${weeksBack - i}주전` });
  }
  const yTicks = [];
  for (let w = Math.ceil(yMin / 5) * 5; w <= yMax; w += 5) {
    yTicks.push({ y: weightToY(w), label: w });
  }

  // 현재 입력 중인 체중 + 날짜 marker
  const currentX = currentDate ? dateMsToX(Date.parse(currentDate)) : null;
  const currentY = currentWeight ? weightToY(+currentWeight) : null;

  return (
    <div className="rounded-xl border border-ink-200 dark:border-slate-700 bg-ink-100/20 dark:bg-slate-800/20 overflow-hidden">
      <div className="px-2 py-1 text-[10px] text-ink-500 dark:text-slate-400 border-b border-ink-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
        <span>📈 최근 {weeksBack}주 — 좌클릭 점찍기 · 우클릭 처방 추가</span>
        {activeCourses[0] && (
          <span className="text-[10px] opacity-70">활성: {MED_BY_ID[activeCourses[0].medication]?.label.replace(/\s*\(.+\)/, '')}</span>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
           className="w-full block cursor-crosshair touch-none select-none"
           onMouseDown={onPointerDown} onTouchStart={onPointerDown}
           onContextMenu={onContextMenu}>
        {/* Grid */}
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

        {/* 기존 weight_logs (회색 점) */}
        {existingLogs.map((l, i) => (
          <circle key={'l'+i}
                  cx={dateMsToX(Date.parse(l.date))}
                  cy={weightToY(l.weight)}
                  r="3" fill="#94A3B8" />
        ))}

        {/* 기존 doses (수직선 + 약 표시) */}
        {existingDoses.map((d, i) => (
          <g key={'d'+i}>
            <line x1={dateMsToX(Date.parse(d.date))} y1={PAD.top}
                  x2={dateMsToX(Date.parse(d.date))} y2={H - PAD.bottom}
                  stroke="#F97316" strokeWidth="1" strokeDasharray="1 2" strokeOpacity="0.5" />
            <circle cx={dateMsToX(Date.parse(d.date))} cy={PAD.top + 4} r="3" fill="#F97316" />
          </g>
        ))}

        {/* 현재 입력 중인 marker */}
        {currentX != null && currentY != null && (
          <g>
            <circle cx={currentX} cy={currentY} r="7" fill="#2E9A58" fillOpacity="0.3" />
            <circle cx={currentX} cy={currentY} r="4" fill="#2E9A58" stroke="white" strokeWidth="2" />
            <text x={currentX} y={currentY - 10} fontSize="10" textAnchor="middle" fill="#2E9A58" fontWeight="bold">
              {currentWeight}kg
            </text>
          </g>
        )}
      </svg>
      <div className="px-2 py-1 text-[10px] text-ink-500 dark:text-slate-500 border-t border-ink-100 dark:border-slate-800 flex gap-3">
        <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1"></span>기존 체중</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"></span>처방</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-brand-500 mr-1"></span>입력 중</span>
      </div>
    </div>
  );
}
