import React, { useRef, useState, useEffect } from 'react';

// 가로 ruler 다이얼 — 드래그로 값 조절, 마우스/터치 모두 지원
// "저울 다이얼" 느낌: 중앙에 굵은 indicator, 좌우로 tick 표시
//
// props:
//   value, onChange, min, max, step
//   unit (예: 'g', 'kcal', 'kg'), label
//   majorTick (예: 10), minorTick (예: 1) — tick 간격
export function DialInput({
  value, onChange,
  min = 0, max = 100, step = 1,
  unit = '', label,
  majorTick = 10, minorTick = 1,
  highlight = false,
}) {
  const railRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startVal: 0 });
  const [hoverDelta, setHoverDelta] = useState(0);

  // tick 사이 픽셀 폭 (값 1단위당)
  const PX_PER_STEP = 8;

  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v / step) * step));

  // 드래그 시작
  const onPointerDown = (e) => {
    e.preventDefault();
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    dragRef.current = { active: true, startX: x, startVal: value };
    document.body.style.cursor = 'grabbing';
  };

  // 드래그 진행
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const delta = (dragRef.current.startX - x) / PX_PER_STEP * step;
      onChange(clamp(dragRef.current.startVal + delta));
    };
    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
        document.body.style.cursor = '';
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
  }, [onChange, step, min, max]);

  // 휠 (데스크탑)
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    onChange(clamp(value + delta));
  };

  // 빠른 ± 버튼
  const bump = (n) => onChange(clamp(value + n * step));

  // tick 생성 — 현재 값 기준 ±25 step 범위 표시
  const RANGE = 25;
  const ticks = [];
  for (let i = -RANGE; i <= RANGE; i++) {
    const v = value + i * step;
    if (v < min || v > max) continue;
    const major = (v % majorTick) === 0;
    ticks.push({ v, offset: i * PX_PER_STEP, major });
  }

  return (
    <div className="select-none">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-ink-500 dark:text-slate-400">{label}</span>
          <span className={`text-xs ${highlight ? 'text-brand-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-500'}`}>
            드래그 · 휠 · ± 버튼
          </span>
        </div>
      )}

      {/* 현재 값 표시 */}
      <div className={`text-center text-3xl font-extrabold tabular-nums ${highlight ? 'text-brand-700 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {Number(value).toFixed(step < 1 ? 1 : 0)}<span className="text-base font-bold opacity-70 ml-1">{unit}</span>
      </div>

      {/* 다이얼 — 가로 ruler */}
      <div className="relative mt-2 rounded-xl bg-gradient-to-b from-ink-100 to-white dark:from-slate-800 dark:to-slate-900 border border-ink-200 dark:border-slate-700 overflow-hidden">
        {/* 중앙 indicator (선택된 값 위치) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-brand-500 z-10 pointer-events-none"
             style={{ transform: 'translateX(-50%)' }}>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand-500" />
        </div>
        {/* tick 영역 — 드래그 가능 */}
        <div ref={railRef}
             onMouseDown={onPointerDown} onTouchStart={onPointerDown}
             onWheel={onWheel}
             className="relative h-14 cursor-grab active:cursor-grabbing touch-none">
          <div className="absolute inset-0 flex items-center justify-center">
            {ticks.map((t, i) => (
              <div key={i}
                   className={`absolute ${t.major ? 'h-8 w-px bg-ink-400 dark:bg-slate-500' : 'h-4 w-px bg-ink-300 dark:bg-slate-600'}`}
                   style={{ left: `calc(50% + ${t.offset}px)`, transform: 'translateX(-50%)' }}>
                {t.major && (
                  <span className="absolute top-9 left-1/2 -translate-x-1/2 text-[9px] text-ink-500 dark:text-slate-500 tabular-nums whitespace-nowrap">
                    {t.v}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ± 버튼 */}
      <div className="flex justify-center gap-1.5 mt-2">
        <button onClick={() => bump(-10)} className="px-2 py-1 rounded-md text-xs bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-200">−{10*step}</button>
        <button onClick={() => bump(-1)}  className="px-2 py-1 rounded-md text-xs bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-200">−{step}</button>
        <button onClick={() => bump(1)}   className="px-2 py-1 rounded-md text-xs bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-200">+{step}</button>
        <button onClick={() => bump(10)}  className="px-2 py-1 rounded-md text-xs bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-200">+{10*step}</button>
      </div>
    </div>
  );
}
