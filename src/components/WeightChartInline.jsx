import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { MED_BY_ID } from '../lib/constants.js';

// 약별 color coding — 그래프 시각 구분용 (카드/chip 5색 시스템과는 별개 axis)
const MED_COLORS = {
  wegovy:   '#0EA5E9',   // sky-500
  mounjaro: '#F59E0B',   // amber-500
  saxenda:  '#A855F7',   // purple-500
  ozempic:  '#06B6D4',   // cyan-500
  zepbound: '#EC4899',   // pink-500
  other:    '#94A3B8',   // slate
};
// 약별 라벨 (label에서 영문 brand 제거된 한글 짧은 이름)
const MED_SHORT = {
  wegovy: '위고비', mounjaro: '마운자로', saxenda: '삭센다', ozempic: '오젬픽', zepbound: '젭바운드',
};

// 우드래그 누적 증감 — N px마다 1 step
const DOSE_STEP_PX = 35;
// 활성 약 없을 때 우드래그로 약 선택 — 좌→위고비, 우→마운자로. 최소 가로 이동.
const PICK_MED_THRESHOLD_PX = 40;

// inline 체중 그래프 — WeightTab에 항상 표시.
// - 좌클릭/드래그: 선 그리기 (여러 날짜 한 번에 입력)
//   드래그 끝나면 모든 점을 weight_logs로 저장 + 다이얼은 마지막 점으로 sync
// - 다이얼에서 받은 currentWeight: today 위치에 큰 marker로 표시
// - 우클릭 + 드래그: 투약 기록 추가 (mousedown에서 시작, mouseup에서 방향 판정)
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

  // 그래프 크기 — 모바일 가독성 위해 키움 (320 → 440). viewBox 비율로 세로↑.
  const W = 600, H = 440;
  const PAD = { top: 22, right: 14, bottom: 36, left: 40 };
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
        const medId = course?.medication || 'other';
        return {
          ...d,
          medId,
          medShort: MED_SHORT[medId] || '',
          color: MED_COLORS[medId] || MED_COLORS.other,
        };
      });
  }, [user, refreshKey, weeksBack]);

  const activeCourses = useMemo(() => {
    if (!user) return [];
    return Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate);
  }, [user, refreshKey]);

  // Y축 scale — currentWeight를 deps에서 제거해서 입력해도 흔들리지 않음.
  // 최소 ±6kg 보장 → 빈/작은 데이터에서도 충분한 입력 공간 확보.
  // anchor 우선순위: startWeight → 최신 log → currentWeight → 70 (절대 fallback)
  // startWeight 없어도 logs 있으면 logs 평균 기반으로 안정 scale.
  const { yMin, yMax, yStep } = useMemo(() => {
    const ys = existingLogs.map(l => l.weight);
    const latestLog = existingLogs[existingLogs.length - 1]?.weight;
    const anchor = user?.startWeight ?? latestLog ?? (currentWeight ? +currentWeight : 70);
    if (anchor && !ys.includes(anchor)) ys.push(anchor);
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
      const ev = e.touches?.[0] || e;
      dragRef.current = {
        mode: 'right',
        startMs: xToDateMs(p.x),
        startX: p.x, startY: p.y,
        screenX: ev.clientX, screenY: ev.clientY,
      };
      setRightDragInfo({ x: p.x, y: p.y, dx: 0, dy: 0 });
    } else if (isWeightMode) {
      e.preventDefault();
      lastMoveRef.current = 0;
      // raw fractional ms — marker 위치 동기화용. round된 date는 저장용.
      const exactMs = startDate.getTime() + ((p.x - PAD.left) / dayWidth) * 86400000;
      const date = new Date(exactMs).toISOString().slice(0, 10);
      const weight = yToWeight(p.y);
      // lastPoint 별도 추적 — drawingPointsRef는 날짜순 sort라 release 위치 != points[last].
      // 우→좌 드래그 시 release point가 사라져서 dial이 click START 값으로 잘못 동기화되던 버그 fix.
      dragRef.current = { mode: 'left', lastPoint: { date, weight, exactMs } };
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
        dragRef.current.lastPoint = { date, weight, exactMs };
        setDrawingPoints(next);
        onWeightChange?.({ date, weight, exactMs });
      } else if (dragRef.current.mode === 'right') {
        const ev = e.touches?.[0] || e;
        const dx = ev.clientX - dragRef.current.screenX;
        const dy = dragRef.current.screenY - ev.clientY;
        setRightDragInfo({ x: dragRef.current.startX, y: dragRef.current.startY, dx, dy });
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
            // drawingPointsRef는 날짜순 sort — 우→좌 드래그일 때 points[last]가 release가
            // 아닌 click 시작점이 됨. dragRef.lastPoint(실제 release)를 dial 동기화용으로 사용.
            const last = drag.lastPoint || points[points.length - 1];
            onWeightChange?.({ date: last.date, weight: last.weight, savedCount: points.length });
          } catch (err) {
            console.error('[WeightChartInline] save failed', err);
          }
        }
      } else if (mode === 'right') {
        const ev = e.changedTouches?.[0] || e.touches?.[0] || e;
        const dy = drag.screenY != null ? drag.screenY - ev.clientY : 0;
        const dx = drag.screenX != null ? ev.clientX - drag.screenX : 0;
        setRightDragInfo(null);
        try {
          // 활성 약 없으면 가로 드래그로 약 선택 — 좌→위고비, 우→마운자로
          const allCourses = Storage.getMedCoursesByUser(user.id);
          const hasActive = allCourses.some(c => !c.endDate);
          const dateStr = new Date(drag.startMs).toISOString().slice(0, 10);
          if (!hasActive && Math.abs(dx) >= PICK_MED_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
            createCourseAndAddDose(dateStr, dx < 0 ? 'wegovy' : 'mounjaro');
          } else {
            const steps = Math.round(dy / DOSE_STEP_PX);
            addDoseAtDate(dateStr, steps);
          }
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

  // steps: 위로 드래그 누적 +N step, 아래 -N step, 0이면 같은 용량 유지
  const addDoseAtDate = (date, steps) => {
    const allCourses = Storage.getMedCoursesByUser(user.id);
    const active = allCourses.filter(c => !c.endDate);
    const course = active[0] || allCourses[allCourses.length - 1];
    if (!course) {
      alert('활성 약이 없어요.\n우클릭 + 가로로 길게 드래그하면 약을 선택할 수 있어요.\n· ← 좌: 위고비\n· → 우: 마운자로');
      return;
    }
    const med = MED_BY_ID[course.medication];
    if (!med?.doses?.length) return;
    const lastDose = Storage.getDosesByCourse(course.id).slice(-1)[0];
    const currentIdx = lastDose ? med.doses.indexOf(lastDose.dose) : 0;
    // 누적 step 적용 — clamp [0, doses.length - 1]
    const newIdx = Math.max(0, Math.min(med.doses.length - 1, currentIdx + (steps || 0)));
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
    onDoseAdded?.({ date, dose: newDose, medication: med.label.replace(/\s*\(.+\)/, ''), steps });
  };

  // 활성 약 없을 때 그래프에서 약 선택 → 신규 코스 생성 + 첫 dose 추가
  const createCourseAndAddDose = (date, medId) => {
    const med = MED_BY_ID[medId];
    if (!med?.doses?.length) return;
    const courseId = uid('mc');
    const firstDose = med.doses[0];
    Storage.addMedCourse({
      id: courseId,
      userId: user.id,
      seed: false,
      medication: medId,
      frequency: med.frequency === '매일' ? 'daily' : 'weekly',
      startDate: date,
      endDate: null,
      initialDose: firstDose,
      notes: '그래프에서 추가',
      discontinueReason: null,
      createdAt: new Date().toISOString(),
    });
    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId,
      seed: false,
      date,
      dose: firstDose,
      price: null, region: null, pharmacyName: null,
      notes: '그래프에서 추가',
      createdAt: new Date().toISOString(),
    });
    onDoseAdded?.({
      date, dose: firstDose,
      medication: med.label.replace(/\s*\(.+\)/, ''),
      createdCourse: true,
    });
  };

  // drag 중 실시간 미리보기 (어떤 약/용량으로 등록될지)
  const dosePreview = useMemo(() => {
    if (!rightDragInfo) return null;
    const allCourses = Storage.getMedCoursesByUser(user?.id);
    const active = allCourses.filter(c => !c.endDate);
    const course = active[0] || allCourses[allCourses.length - 1];
    const dx = rightDragInfo.dx || 0;
    const dy = rightDragInfo.dy || 0;
    // 활성 약이 없을 때 — 가로 드래그 방향으로 약 선택 미리보기
    if (!course) {
      if (Math.abs(dx) < PICK_MED_THRESHOLD_PX) {
        return {
          medShort: '←위고비 마운자로→',
          dose: '',
          color: '#94A3B8',
          isPick: true,
          notReady: true,
        };
      }
      const medId = dx < 0 ? 'wegovy' : 'mounjaro';
      const med = MED_BY_ID[medId];
      return {
        medShort: MED_SHORT[medId],
        dose: `${med.doses[0]} 시작`,
        color: MED_COLORS[medId],
        isPick: true,
      };
    }
    const med = MED_BY_ID[course.medication];
    if (!med?.doses?.length) return null;
    const lastDose = Storage.getDosesByCourse(course.id).slice(-1)[0];
    const currentIdx = lastDose ? med.doses.indexOf(lastDose.dose) : 0;
    const steps = Math.round(dy / DOSE_STEP_PX);
    const newIdx = Math.max(0, Math.min(med.doses.length - 1, currentIdx + steps));
    return {
      medShort: MED_SHORT[course.medication] || course.medication,
      dose: med.doses[newIdx],
      color: MED_COLORS[course.medication] || MED_COLORS.other,
      steps,
      currentDose: lastDose?.dose,
    };
  }, [rightDragInfo, user]);

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

  // 우드래그 시각화 — pick 모드일 때는 가로(dx), 일반 dose 모드일 때는 세로(dy) 강조
  const rightArrow = rightDragInfo
    ? {
        startX: rightDragInfo.x, startY: rightDragInfo.y,
        to: dosePreview?.isPick
          ? { x: rightDragInfo.x + (rightDragInfo.dx || 0), y: rightDragInfo.y }
          : { x: rightDragInfo.x, y: rightDragInfo.y - (rightDragInfo.dy || 0) },
        steps: Math.round((rightDragInfo.dy || 0) / DOSE_STEP_PX),
        isPick: dosePreview?.isPick,
      }
    : null;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${touchMode === 'dose'
        ? 'border-orange-300 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-900/10'
        : 'border-ink-200 dark:border-slate-700 bg-ink-100/20 dark:bg-slate-800/20'}`}>
      {/* 조작법 큰 안내 — 사용자가 한 눈에 이해 */}
      <div className="px-3 py-2.5 bg-gradient-to-r from-brand-50/60 to-orange-50/60 dark:from-brand-900/15 dark:to-orange-900/15 border-b border-ink-100 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500 text-white text-[10px] font-bold flex-shrink-0">L</span>
            <div className="leading-snug">
              <div className="font-bold text-brand-800 dark:text-brand-200">⚖️ 왼쪽 클릭 + 드래그</div>
              <div className="text-ink-600 dark:text-slate-400">체중 추이 그리기</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500 text-white text-[10px] font-bold flex-shrink-0">R</span>
            <div className="leading-snug">
              <div className="font-bold text-orange-800 dark:text-orange-200">💉 오른쪽 클릭 + 드래그</div>
              {activeCourses.length > 0 ? (
                <div className="text-ink-600 dark:text-slate-400">
                  위↑ <b className="text-emerald-600 dark:text-emerald-400">계속 증량</b> · 아래↓ <b className="text-rose-600 dark:text-rose-400">계속 감량</b>
                </div>
              ) : (
                <div className="text-ink-600 dark:text-slate-400">
                  가로로 길게 — ← <b className="text-sky-600 dark:text-sky-400">위고비</b> · <b className="text-amber-600 dark:text-amber-400">마운자로</b> →
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 모바일용 모드 토글 (작게, 화면 우측) */}
        <div className="sm:hidden mt-2 flex gap-1 justify-end">
          <span className="text-[10px] text-ink-500 dark:text-slate-500 self-center mr-1">모바일:</span>
          <button type="button" onClick={() => setTouchMode('weight')}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${touchMode === 'weight'
                    ? 'bg-brand-500 text-white'
                    : 'bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300'}`}>
            체중
          </button>
          <button type="button" onClick={() => setTouchMode('dose')}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${touchMode === 'dose'
                    ? 'bg-orange-500 text-white'
                    : 'bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300'}`}>
            투약
          </button>
        </div>
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

        {/* 기존 weight_logs — 시드 데이터는 옅은 회색·작게, 본인 입력은 brand 색·크게 (P8) */}
        {existingLogs.map((l, i) => {
          const isSeed = !!l.seed;
          return (
            <circle key={'l'+i}
                    cx={dateMsToX(Date.parse(l.date))}
                    cy={weightToY(l.weight)}
                    r={isSeed ? 2 : 3.5}
                    fill={isSeed ? '#CBD5E1' : '#2E9A58'}
                    opacity={isSeed ? 0.5 : 1}
                    stroke={isSeed ? undefined : 'white'}
                    strokeWidth={isSeed ? 0 : 1} />
          );
        })}

        {/* 기존 doses — 부근 체중 기록 점 가까운 높이에 "주사기 + 용량" 표시 + 약별 color */}
        {existingDoses.map((d, i) => {
          const x = dateMsToX(Date.parse(d.date));
          const doseMs = Date.parse(d.date);
          // 가장 가까운 체중 log 찾기 (3일 이내) → 그 Y 위치 사용
          const nearLog = existingLogs.reduce((best, l) => {
            const diff = Math.abs(Date.parse(l.date) - doseMs);
            if (diff > 3 * 86400000) return best;
            if (!best || diff < best.diff) return { log: l, diff };
            return best;
          }, null);
          // 체중 점 위 8px (안 가리도록)
          const baseY = nearLog ? weightToY(nearLog.log.weight) - 14 : H - PAD.bottom - 14;
          // 같은 날짜·같은 위치 dose 여러 개면 Y offset
          const stackIdx = existingDoses.slice(0, i).filter(o => Math.abs(dateMsToX(Date.parse(o.date)) - x) < 2).length;
          const labelY = baseY - stackIdx * 14;
          // 그래프 우측 끝 가까우면 좌측으로 라벨
          const rightSide = x < W - 80;
          return (
            <g key={'d'+i}>
              {/* 점선 vertical line — 약별 color로 옅게 */}
              <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                    stroke={d.color} strokeWidth="1" strokeDasharray="1 3" strokeOpacity="0.25" />
              {/* 주사기 모양 아이콘 + 용량 — 체중 점 부근 높이 */}
              <g transform={`translate(${x},${labelY})`}>
                {/* 주사기 mini SVG icon */}
                <g transform="translate(-7,-6)" fill={d.color}>
                  <rect x="0" y="3" width="9" height="3.5" rx="0.6" />
                  <rect x="9" y="4" width="2" height="1.5" />
                  <rect x="-2.5" y="2.5" width="2.5" height="4.5" rx="0.6" />
                </g>
                <text x={rightSide ? 6 : -6} y={3}
                      textAnchor={rightSide ? 'start' : 'end'}
                      fontSize="11" fontWeight="700" fill={d.color}
                      stroke="white" strokeWidth="3" paintOrder="stroke">
                  {d.dose}
                </text>
              </g>
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

        {/* 우드래그 미리보기 — 약명+용량 박스가 체중 부근 (drag 위치)에 따라옴 */}
        {rightArrow && dosePreview && (
          <g>
            {/* drag 시작점 → 현재 위치 점선 */}
            <line x1={rightArrow.startX} y1={rightArrow.startY}
                  x2={rightArrow.to.x} y2={rightArrow.to.y}
                  stroke={dosePreview.color} strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.7" />
            {/* 시작점 marker */}
            <circle cx={rightArrow.startX} cy={rightArrow.startY} r="4"
                    fill="white" stroke={dosePreview.color} strokeWidth="2" />
            {/* 약명+용량 박스 — drag 끝점 부근 */}
            {(() => {
              const boxX = rightArrow.to.x;
              const boxY = Math.max(PAD.top + 18, Math.min(H - PAD.bottom - 8, rightArrow.to.y));
              const stepArrow = !rightArrow.isPick && rightArrow.steps > 0 ? `↑${rightArrow.steps}`
                              : !rightArrow.isPick && rightArrow.steps < 0 ? `↓${Math.abs(rightArrow.steps)}`
                              : '';
              const boxText = dosePreview.dose
                ? `${dosePreview.medShort} ${dosePreview.dose}`
                : dosePreview.medShort;
              // pick 모드 안내 박스는 더 넓어야 — '←위고비 마운자로→' 같은 라벨이 12자
              const boxWidth = rightArrow.isPick ? 150 : 100;
              const rightSide = boxX < W - (boxWidth + 10);
              return (
                <g transform={`translate(${boxX}, ${boxY})`}>
                  <rect x={rightSide ? 10 : -(boxWidth + 10)} y={-13} width={boxWidth} height={26} rx={4}
                        fill="white" stroke={dosePreview.color} strokeWidth="2"
                        strokeDasharray={dosePreview.notReady ? '4 3' : undefined} />
                  <text x={rightSide ? 16 : -(boxWidth + 4)} y={4}
                        fontSize="11" fontWeight="700" fill={dosePreview.color}>
                    💉 {boxText}
                  </text>
                  {stepArrow && (
                    <text x={rightSide ? boxWidth : -18} y={4}
                          textAnchor="end"
                          fontSize="10" fontWeight="800"
                          fill={rightArrow.steps > 0 ? '#10B981' : '#EF4444'}>
                      {stepArrow}
                    </text>
                  )}
                </g>
              );
            })()}
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
      <div className="px-2 py-1 border-t border-ink-100 dark:border-slate-800 flex gap-3 flex-wrap text-[10px] text-ink-500 dark:text-slate-500 items-center">
        {/* 본인 기록(brand 색·큼) vs 시드 데이터(옅은 회색·작음) — P8 페르소나 피드백 */}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-500 border border-white"></span>본인 기록
        </span>
        {existingLogs.some(l => l.seed) && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 opacity-50"></span>예시 데이터
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-brand-500"></span>입력 중
        </span>
        {/* 약별 color — 사용 중 약만 노출 */}
        {(() => {
          const usedMeds = [...new Set(existingDoses.map(d => d.medId))];
          if (usedMeds.length === 0) return null;
          return usedMeds.map(medId => (
            <span key={medId} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: MED_COLORS[medId] }}></span>
              💉 {MED_SHORT[medId] || medId}
            </span>
          ));
        })()}
      </div>
      {activeCourses[0] && (
        <div className="px-2 py-1 border-t border-ink-100 dark:border-slate-800 text-[10px] text-ink-500 dark:text-slate-400">
          활성 약: <b>{MED_BY_ID[activeCourses[0].medication]?.label.replace(/\s*\(.+\)/, '')}</b>
        </div>
      )}
    </div>
  );
}
