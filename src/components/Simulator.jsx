import React, { useMemo, useState, useEffect } from 'react';
import { simulateTimeline, medQuickProfile, bmi, bmiCategory, USAGE_FREQUENCIES } from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { MEDS, MED_BY_ID } from '../lib/constants.js';

// 슬라이더 + 즉시 예측 결과 위젯
// P1(처음 접속), P4(주변 못 물어보는 사람)을 위한 핵심 위젯
// 3시점(3개월/6개월/1년) + 약별 비용/부작용 + 사용 빈도(매주/격주/가끔) 한국 실사용 반영
// 입력값은 sessionStorage에 저장 — 가입 모달에서 prefill되어 두 번 입력 마찰 제거
const SIM_PREFILL_KEY = 'wimalog_sim_prefill';

export function Simulator({ onSignup, compact = false, user = null }) {
  // sessionStorage에서 이전 값 복원
  const loaded = (() => {
    try {
      const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const [height, setHeight] = useState(loaded?.height || 162);
  const [startWeight, setStartWeight] = useState(loaded?.startWeight || 78);
  const [medication, setMedication] = useState(loaded?.medication || 'wegovy');
  const [frequency, setFrequency] = useState(loaded?.frequency || 'weekly');

  // 입력값 바뀔 때마다 sessionStorage에 저장 (디바운스 없이도 작아서 부담 없음)
  useEffect(() => {
    try {
      sessionStorage.setItem(SIM_PREFILL_KEY, JSON.stringify({ height, startWeight, medication, frequency }));
    } catch {}
  }, [height, startWeight, medication, frequency]);
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
  const timeline = useMemo(
    () => simulateTimeline({ height, startWeight, medication, frequency }),
    [height, startWeight, medication, frequency, seedTick]
  );
  const profile = useMemo(() => medQuickProfile(medication, frequency), [medication, frequency, seedTick]);

  const medLabel = MED_BY_ID[medication]?.label.replace(/\s*\(.+\)/, '') || '';
  const freqLabel = USAGE_FREQUENCIES.find(f => f.id === frequency)?.shortLabel || '매주';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5 sm:p-6 shadow-cardHover">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xl">🔮</span>
        <div className="font-bold text-lg">내가 쓰면 어떻게 될까?</div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
          🤖 AI 예측
        </span>
      </div>
      <div className="text-xs text-brand-50 mb-4 opacity-90 leading-relaxed">
        {compact
          ? 'AI가 11,000명+ 익명 코호트에서 본인과 비슷한 사용자 결과를 즉시 예측 — 가입 없이 가능'
          : 'AI가 11,000명+ 익명 코호트에서 본인 키·체중·약·빈도와 비슷한 사용자를 찾아 3개월/6개월/1년 감량·비용·부작용을 예측합니다'}
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
        <div>
          <div className="text-xs font-semibold mb-1.5 opacity-90 flex items-center gap-1.5">
            <span>사용 빈도</span>
            <span className="text-[10px] font-normal opacity-70">— 한국은 격주·간헐 사용도 흔함</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {USAGE_FREQUENCIES.map(f => (
              <button key={f.id} type="button" onClick={() => setFrequency(f.id)}
                      title={f.desc}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition border
                                  ${frequency === f.id
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}>
                {f.shortLabel}
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

      {/* 3시점 감량 결과 — 빈도/BMI 보정된 한국 실사용 추정치 */}
      <div className="mt-4">
        <div className="text-xs opacity-80 mb-2 text-center">{medLabel} · {freqLabel} 사용 시 예상 감량</div>
        {timeline.series?.some(s => s?.lossPct != null) ? (
          <div className="grid grid-cols-3 gap-2">
            {timeline.series.map((s, i) => {
              if (!s || s.lossPct == null) {
                return (
                  <div key={i} className="rounded-xl bg-white/10 p-3 text-center">
                    <div className="text-[10px] opacity-70">
                      {[12, 24, 48][i] === 12 ? '3개월' : [12, 24, 48][i] === 24 ? '6개월' : '1년'}
                    </div>
                    <div className="text-xl font-extrabold mt-1 opacity-50">—</div>
                  </div>
                );
              }
              const label = s.week === 12 ? '3개월' : s.week === 24 ? '6개월' : '1년';
              const isHighlight = s.week === 48; // 1년 강조
              const kg = Math.abs(s.lossKg);
              const target = (startWeight - kg).toFixed(1);
              return (
                <div key={i}
                     className={`rounded-xl p-3 text-center ${isHighlight ? 'bg-white text-brand-700 shadow-lg' : 'bg-white/15 backdrop-blur'}`}>
                  <div className={`text-[10px] ${isHighlight ? 'opacity-100 font-semibold' : 'opacity-80'}`}>{label}</div>
                  <div className={`font-extrabold tabular-nums leading-none mt-1 ${isHighlight ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
                    −{s.lossPct.toFixed(1)}<span className="text-xs">%</span>
                  </div>
                  <div className={`text-xs mt-1 tabular-nums ${isHighlight ? 'font-semibold' : 'opacity-90'}`}>
                    −{kg.toFixed(1)} kg
                  </div>
                  <div className={`text-[10px] ${isHighlight ? 'opacity-70' : 'opacity-60'} tabular-nums`}>
                    → {target} kg
                  </div>
                  {s.n > 0 && (
                    <div className={`text-[9px] mt-1 ${isHighlight ? 'opacity-60' : 'opacity-60'} tabular-nums`}>
                      n={s.n}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-white/15 backdrop-blur p-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm opacity-90">
              <span className="inline-block w-3 h-3 rounded-full bg-white/60 animate-pulse" />
              데이터 준비 중…
            </div>
          </div>
        )}
      </div>

      {/* 약 빠른 프로필 — 비용 + 주요 부작용 */}
      {profile && (profile.monthlyAvgKrw || profile.topSideEffects?.length) && (
        <div className="mt-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
          <div className="grid grid-cols-2 gap-3 items-start">
            {/* 비용 */}
            <div>
              <div className="text-[10px] opacity-70 mb-0.5">💰 월 평균 비용</div>
              {profile.monthlyAvgKrw != null ? (
                <div className="text-base font-bold tabular-nums leading-tight">
                  {(profile.monthlyAvgKrw / 10000).toFixed(0)}만원
                  <span className="text-[10px] font-normal opacity-70 ml-1">/월</span>
                </div>
              ) : (
                <div className="text-xs opacity-60">데이터 준비 중</div>
              )}
            </div>
            {/* 주요 부작용 — 상위 2개만 */}
            <div>
              <div className="text-[10px] opacity-70 mb-0.5">⚠ 주요 부작용</div>
              {profile.topSideEffects?.length > 0 ? (
                <div className="space-y-0.5">
                  {profile.topSideEffects.slice(0, 2).map((s, i) => (
                    <div key={i} className="text-xs leading-tight">
                      {s.label.replace('(메스꺼움)', '')} <span className="opacity-70 tabular-nums">{Math.round(s.rate * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs opacity-60">데이터 준비 중</div>
              )}
            </div>
          </div>
        </div>
      )}

      {onSignup && (
        <button onClick={onSignup}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-brand-700 px-5 py-3 font-bold hover:bg-brand-50 transition">
          {user ? '내 대시보드 보기 →' : '내 데이터로 더 정확하게 보기 →'}
        </button>
      )}
      <div className="mt-3 rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">🤖</span>
          <p className="text-[11px] leading-relaxed">
            <b>입력이 자세할수록 AI 예측이 정확해져요.</b><br />
            {user
              ? <>본인 체중 추이·운동·식단·부작용·동반질환을 더 입력할수록 본인 조건에 맞춘 정밀 예측으로 바뀝니다.</>
              : <>지금은 키·체중·약·빈도만 사용 중 — 가입 후 본인 체중 추이·운동·식단·부작용·동반질환까지 추가하면 본인 조건에 맞춘 정밀 예측으로 바뀝니다.</>
            }
          </p>
        </div>
      </div>
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
