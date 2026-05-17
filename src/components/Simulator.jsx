import React, { useMemo, useState, useEffect } from 'react';
import { simulateOutcome, bmi, bmiCategory } from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { MEDS, MED_BY_ID } from '../lib/constants.js';

// 슬라이더 + 즉시 예측 결과 위젯
// P1(처음 접속), P4(주변 못 물어보는 사람)을 위한 핵심 위젯
export function Simulator({ onSignup, compact = false }) {
  const [height, setHeight] = useState(162);
  const [startWeight, setStartWeight] = useState(78);
  const [medication, setMedication] = useState('wegovy');
  // 시드가 비동기로 끝나면 재계산
  const [seedTick, setSeedTick] = useState(0);
  useEffect(() => {
    if (Storage.isSeeded()) return;
    const id = setInterval(() => {
      if (Storage.isSeeded()) { setSeedTick(t => t + 1); clearInterval(id); }
    }, 400);
    return () => clearInterval(id);
  }, []);

  const myBmi = useMemo(() => bmi(startWeight, height), [startWeight, height]);
  const result = useMemo(
    () => simulateOutcome({ height, startWeight, medication }),
    [height, startWeight, medication, seedTick]
  );

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5 sm:p-6 shadow-cardHover">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🔮</span>
        <div className="font-bold text-lg">내가 쓰면 어떻게 될까?</div>
      </div>
      <div className="text-xs text-brand-50 mb-4 opacity-90">
        {compact
          ? '실제 사용자 데이터로 즉시 예측 — 가입 없이도 사용 가능'
          : '키·체중·약을 선택하면 비슷한 사용자들의 평균 결과를 즉시 보여줍니다'}
      </div>

      <div className="space-y-3">
        <Slider label="키 (cm)" value={height} min={140} max={200} step={1}
                onChange={setHeight} fmt={(v) => `${v} cm`} />
        <Slider label="시작 체중 (kg)" value={startWeight} min={45} max={150} step={0.5}
                onChange={setStartWeight} fmt={(v) => `${v.toFixed(1)} kg`} />
        <div>
          <div className="text-xs font-semibold mb-1.5 opacity-90">약</div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {MEDS.filter(m => m.id !== 'other').map(m => (
              <button key={m.id} type="button" onClick={() => setMedication(m.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition border
                                  ${medication === m.id
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}>
                {m.label.replace(/\s*\(.+\)/, '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {myBmi != null && (
        <div className="mt-4 text-xs opacity-80">
          현재 BMI <b className="tabular-nums">{myBmi.toFixed(1)}</b> · {bmiCategory(myBmi)}
        </div>
      )}

      {/* 예측 결과 — 항상 표시 (좁은 코호트 → 약 전체 → 전체 fallback) */}
      <div className="mt-4 rounded-xl bg-white/15 backdrop-blur p-4 text-center">
        <div className="text-xs opacity-80">비슷한 사용자의 12주 평균</div>
        {result.lossPct != null ? (
          <>
            <div className="mt-1">
              <div className="text-4xl sm:text-5xl font-extrabold tabular-nums leading-none animate-celebrate" key={`${result.lossPct.toFixed(1)}`}>
                −{result.lossPct.toFixed(1)}%
              </div>
              <div className="text-base mt-1">
                약 <b className="tabular-nums">{Math.abs(result.lossKg).toFixed(1)} kg</b> 감량
                <span className="opacity-70 ml-1">→ {(startWeight + result.lossKg).toFixed(1)} kg</span>
              </div>
            </div>

            {/* 성공률 — percentage 핵심 표시 */}
            {result.successRate > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="text-2xl font-extrabold tabular-nums">
                  {Math.round(result.successRate * 100)}%
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  비슷한 조건의 사용자 중 <b>5% 이상</b> 감량한 비율
                </div>
              </div>
            )}

            {/* fallback 안내 — 부드럽게 */}
            {result.fallback && result.level !== 'none' && (
              <div className="text-[10px] opacity-70 mt-2">
                ※ {result.level === 'medOnly'
                      ? `${MED_BY_ID[medication]?.label.replace(/\s*\(.+\)/, '')} 사용자 전체 평균 기준`
                      : '전체 사용자 평균 기준'}
                {' '}— 본인 조건에 더 가까운 데이터는 가입 후 표시됩니다
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 py-3">
            <div className="inline-flex items-center gap-2 text-sm opacity-90">
              <span className="inline-block w-3 h-3 rounded-full bg-white/60 animate-pulse" />
              데이터 준비 중…
            </div>
          </div>
        )}
      </div>

      {onSignup && (
        <button onClick={onSignup}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-brand-700 px-5 py-3 font-bold hover:bg-brand-50 transition">
          이 결과를 내 데이터로 확인 →
        </button>
      )}
      <p className="text-[10px] text-center mt-2 opacity-70">
        ⚠ 자가보고 기반 평균. 개인 반응은 다를 수 있으며, 약제 사용은 의료진과 상의해야 합니다.
      </p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1.5">
        <span className="opacity-90">{label}</span>
        <span className="tabular-nums">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step}
             value={value} onChange={e => onChange(+e.target.value)}
             className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
             style={{
               backgroundImage: `linear-gradient(to right, white 0%, white ${((value-min)/(max-min))*100}%, rgba(255,255,255,0.2) ${((value-min)/(max-min))*100}%)`,
             }} />
    </div>
  );
}
