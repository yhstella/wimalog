import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { bmi, bmiCategory } from '../lib/stats.js';
import { GENDERS, AGE_GROUPS } from '../lib/constants.js';
import { MedicalDisclaimer } from './SafetyBanner.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

// 토스 스타일 온보딩
// - 한 화면 = 한 질문/액션
// - 단일 선택은 자동 진행 (220ms 후)
// - 숫자 입력은 자동 포커스 + Enter로 다음
// - 단계 사이 슬라이드 인 애니메이션
// - 진행률 막대로 위치 명시
const STEPS = ['gender', 'age', 'height', 'startWeight', 'currentWeight', 'targetWeight', 'consent'];

export function Onboarding({ navigate, onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back
  const [data, setData] = useState({
    gender: '', ageGroup: '', height: '',
    startWeight: '', currentWeight: '', targetWeight: '',
    consent: false,
  });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const goNext = () => {
    setDirection(1);
    if (stepIdx < STEPS.length - 1) setStepIdx(s => s + 1);
    else complete();
  };
  const goBack = () => {
    setDirection(-1);
    if (stepIdx > 0) setStepIdx(s => s - 1);
    else navigate('landing');
  };

  // 자동 진행 헬퍼 (단일 선택 후 살짝 딜레이)
  const pickAndAdvance = (k, v) => {
    set(k, v);
    setTimeout(goNext, 220);
  };

  const canNext = useMemo(() => {
    switch (STEPS[stepIdx]) {
      case 'gender':        return !!data.gender;
      case 'age':           return !!data.ageGroup;
      case 'height':        return +data.height >= 130 && +data.height <= 220;
      case 'startWeight':   return +data.startWeight >= 35 && +data.startWeight <= 250;
      case 'currentWeight': return +data.currentWeight >= 35 && +data.currentWeight <= 250;
      case 'targetWeight':  return +data.targetWeight >= 35 && +data.targetWeight <= 250;
      case 'consent':       return data.consent;
      default: return false;
    }
  }, [stepIdx, data]);

  const complete = () => {
    if (!canNext) return;
    const userId = uid('u');
    Storage.upsertUser({
      id: userId,
      seed: false,
      nickname: '나',
      gender: data.gender,
      ageGroup: data.ageGroup,
      height: +data.height,
      startWeight: +data.startWeight,
      targetWeight: +data.targetWeight,
      conditions: {},
      purpose: 'weight',
      concerns: [],
      consents: { privacy: true, sensitiveData: true, anonymizedShare: true },
      createdAt: new Date().toISOString(),
    });
    if (+data.currentWeight) {
      Storage.addLog({
        id: uid('log'),
        userId,
        date: todayISO(),
        weight: +data.currentWeight,
        appetiteChange: 3, satiety: 3,
        sideEffects: {}, mealReduction: 3,
        notes: '온보딩 초기 기록',
        createdAt: new Date().toISOString(),
      });
    }
    Storage.setSession(userId);
    onComplete(userId);
  };

  // ESC = 뒤로, Enter = 다음
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && canNext) {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stepId = STEPS[stepIdx];

  return (
    <div className="max-w-md mx-auto pt-2">
      {/* 상단: 진행률 + 뒤로 */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={goBack} className="btn-ghost !p-2 -ml-2 text-xl" aria-label="뒤로">←</button>
        <div className="flex-1 h-1.5 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 transition-all duration-300"
               style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="text-xs text-ink-500 dark:text-slate-500 tabular-nums w-10 text-right">
          {stepIdx + 1}/{STEPS.length}
        </div>
      </div>

      {/* 스텝 */}
      <div key={stepIdx} className={direction === 1 ? 'animate-slideUp' : 'animate-fadeIn'}>
        {stepId === 'gender' && (
          <StepShell title="성별을 알려주세요" sub="익명 통계 비교에 사용됩니다">
            <div className="grid grid-cols-1 gap-3">
              {GENDERS.map(o => (
                <BigChoice key={o.id} selected={data.gender === o.id}
                           onClick={() => pickAndAdvance('gender', o.id)}>
                  {o.label}
                </BigChoice>
              ))}
            </div>
          </StepShell>
        )}

        {stepId === 'age' && (
          <StepShell title="나이대를 알려주세요" sub="개인 정보는 저장되지 않습니다">
            <div className="grid grid-cols-1 gap-3">
              {AGE_GROUPS.map(o => (
                <BigChoice key={o.id} selected={data.ageGroup === o.id}
                           onClick={() => pickAndAdvance('ageGroup', o.id)}>
                  {o.label}
                </BigChoice>
              ))}
            </div>
          </StepShell>
        )}

        {stepId === 'height' && (
          <StepShell title="키를 알려주세요" sub="BMI 계산에 필요합니다">
            <BigNumberInput value={data.height} onChange={v => set('height', v)}
                            placeholder="162" suffix="cm" min={130} max={220}
                            onEnter={canNext ? goNext : null} />
            <BigBottomCTA onClick={goNext} disabled={!canNext} />
          </StepShell>
        )}

        {stepId === 'startWeight' && (
          <StepShell title="시작 체중은 얼마인가요?" sub="현재 또는 약 시작 직전 체중">
            <BigNumberInput value={data.startWeight} onChange={v => {
                              set('startWeight', v);
                              if (!data.currentWeight) set('currentWeight', v);
                            }}
                            placeholder="78.0" suffix="kg" min={35} max={250} step={0.1}
                            onEnter={canNext ? goNext : null} />
            {data.height && +data.startWeight > 0 && (
              <div className="text-center mt-3">
                <span className="chip-brand">
                  BMI {bmi(+data.startWeight, +data.height)?.toFixed(1)} · {bmiCategory(bmi(+data.startWeight, +data.height))}
                </span>
              </div>
            )}
            <BigBottomCTA onClick={goNext} disabled={!canNext} />
          </StepShell>
        )}

        {stepId === 'currentWeight' && (
          <StepShell title="현재 체중은요?" sub="시작 체중과 같으면 그대로 두세요">
            <BigNumberInput value={data.currentWeight} onChange={v => set('currentWeight', v)}
                            placeholder={data.startWeight || '78.0'} suffix="kg" min={35} max={250} step={0.1}
                            onEnter={canNext ? goNext : null} />
            {+data.currentWeight > 0 && +data.startWeight > 0 && (
              <div className="text-center mt-3 text-sm">
                {+data.currentWeight === +data.startWeight ? (
                  <span className="text-ink-500 dark:text-slate-400">시작 체중과 동일</span>
                ) : (
                  <span className={+data.currentWeight < +data.startWeight ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-rose-500'}>
                    시작 대비 {(+data.currentWeight - +data.startWeight).toFixed(1)} kg
                  </span>
                )}
              </div>
            )}
            <BigBottomCTA onClick={goNext} disabled={!canNext} />
          </StepShell>
        )}

        {stepId === 'targetWeight' && (
          <StepShell title="목표 체중은 얼마예요?" sub="언제든 바꿀 수 있어요">
            <BigNumberInput value={data.targetWeight} onChange={v => set('targetWeight', v)}
                            placeholder={data.startWeight ? Math.round(+data.startWeight * 0.85) : '65'}
                            suffix="kg" min={35} max={250} step={0.1}
                            onEnter={canNext ? goNext : null} />
            {/* 추천 칩 */}
            {+data.startWeight > 0 && (
              <div className="flex gap-2 justify-center mt-3 flex-wrap">
                {[0.95, 0.90, 0.85, 0.80, 0.75].map(r => {
                  const v = (+data.startWeight * r).toFixed(1);
                  const pct = Math.round((1 - r) * 100);
                  return (
                    <button key={r} type="button" onClick={() => set('targetWeight', v)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                                        ${+data.targetWeight === +v
                                          ? 'bg-brand-500 text-white border-brand-500'
                                          : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
                      −{pct}% ({v}kg)
                    </button>
                  );
                })}
              </div>
            )}
            <BigBottomCTA onClick={goNext} disabled={!canNext} />
          </StepShell>
        )}

        {stepId === 'consent' && (
          <StepShell title="마지막으로 동의해 주세요" sub="모든 데이터는 본인 브라우저에만 저장됩니다">
            <label className="block p-5 rounded-2xl border-2 border-ink-300 dark:border-slate-700 cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 transition has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/20 has-[:checked]:border-brand-500">
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 w-5 h-5 accent-brand-500 flex-shrink-0"
                       checked={data.consent}
                       onChange={e => set('consent', e.target.checked)} />
                <div className="flex-1">
                  <div className="font-bold text-ink-900 dark:text-slate-100">(필수) 개인정보·민감정보·익명 통계 활용에 모두 동의합니다</div>
                  <div className="text-xs text-ink-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    체중·약 사용·동반질환·부작용 등 민감정보를 본인 식별 없는 형태로
                    통계에 포함하는 것에 동의합니다. 언제든 계정 삭제로 모든 데이터를 지울 수 있어요.
                  </div>
                </div>
              </div>
            </label>

            <div className="mt-4">
              <MedicalDisclaimer />
            </div>
            <BigBottomCTA onClick={complete} disabled={!canNext} label="시작하기" />
          </StepShell>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   하위 컴포넌트들
============================================================ */
function StepShell({ title, sub, children }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-slate-100 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-ink-500 dark:text-slate-400 mt-1.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function BigChoice({ children, selected, onClick }) {
  return (
    <button onClick={onClick}
            className={`w-full px-5 py-4 rounded-2xl text-left font-semibold transition border-2 active:scale-[.98]
                        ${selected
                          ? 'bg-brand-500 text-white border-brand-500 shadow-card'
                          : 'bg-white dark:bg-slate-800 text-ink-900 dark:text-slate-100 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
      <span className="text-base">{children}</span>
    </button>
  );
}

function BigNumberInput({ value, onChange, placeholder, suffix, min, max, step = 1, onEnter }) {
  const ref = useRef(null);
  // 자동 포커스
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex items-baseline justify-center gap-2 py-6">
      <input ref={ref}
             type="number" inputMode="decimal" min={min} max={max} step={step}
             value={value} onChange={e => onChange(e.target.value)}
             onKeyDown={e => {
               if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
             }}
             placeholder={placeholder}
             className="w-40 text-5xl sm:text-6xl font-extrabold text-center tabular-nums bg-transparent border-none focus:outline-none focus:ring-0 text-ink-900 dark:text-slate-100 placeholder:text-ink-300 dark:placeholder:text-slate-700" />
      <span className="text-2xl text-ink-500 dark:text-slate-400 font-semibold">{suffix}</span>
    </div>
  );
}

function BigBottomCTA({ onClick, disabled, label = '다음' }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 py-4 text-white font-bold text-base shadow-card hover:bg-brand-600 active:scale-[.99] transition disabled:bg-ink-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed">
      {label} →
    </button>
  );
}
