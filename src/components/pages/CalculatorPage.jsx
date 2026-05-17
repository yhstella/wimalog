import React, { useState, useMemo } from 'react';
import { bmi, bmiCategory } from '../../lib/stats.js';
import { DRUG_CONTENT } from '../../lib/content.js';

// 계산기: 비용 / BMR / 목표체중 — SEO 랜딩 + 가입 유도
export function CalculatorPage({ kind, navigate, user }) {
  if (kind === 'cost') return <CostCalculator navigate={navigate} />;
  if (kind === 'bmr')  return <BMRCalculator user={user} />;
  if (kind === 'target') return <TargetCalculator user={user} />;
  return <div className="card text-center py-10">계산기를 찾을 수 없습니다</div>;
}

function CostCalculator({ navigate }) {
  const [med, setMed] = useState('wegovy');
  const [months, setMonths] = useState(6);
  const drug = DRUG_CONTENT[med];
  // 평균 가격 (각 약 priceRange 중간값 추정)
  const avgPriceByMed = {
    wegovy: 320000, mounjaro: 450000, saxenda: 350000,
    ozempic: 280000, zepbound: 480000,
  };
  const total = avgPriceByMed[med] * months;
  const cheapTotal = total * 0.78; // 대학로 등 저렴 지역 적용 시
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">💰 약 비용 계산기</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          약별 평균 가격과 기간을 곱해 예상 총 비용을 계산합니다.
        </p>
      </header>

      <div className="card space-y-4">
        <div>
          <div className="label">약</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.keys(DRUG_CONTENT).map(id => (
              <button key={id} type="button" onClick={() => setMed(id)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium border transition
                                  ${med === id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                {DRUG_CONTENT[id].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">사용 기간 (개월)</div>
          <input type="range" min={1} max={24} step={1}
                 value={months} onChange={e => setMonths(+e.target.value)}
                 className="w-full" />
          <div className="text-center text-2xl font-bold mt-1 tabular-nums text-ink-900 dark:text-slate-100">
            {months} 개월
          </div>
        </div>
      </div>

      <div className="card text-center">
        <div className="text-xs text-ink-500 dark:text-slate-400">{drug.label} {months}개월 예상 비용</div>
        <div className="text-4xl font-extrabold text-brand-600 dark:text-brand-400 mt-2 tabular-nums">
          {total.toLocaleString()}원
        </div>
        <div className="text-xs text-ink-500 dark:text-slate-400 mt-2">
          서울 대학로 등 저렴 지역 이용 시 약 <b>{Math.round(cheapTotal).toLocaleString()}원</b>
        </div>
        <div className="mt-4 text-sm text-ink-700 dark:text-slate-300">
          {drug.priceRange} 기준 평균값. 실제 가격은 용량·지역·약국에 따라 다릅니다.
        </div>
      </div>

      <button onClick={() => navigate('stats')} className="btn-secondary w-full">
        지역별 실제 가격 통계 →
      </button>
    </div>
  );
}

function BMRCalculator({ user }) {
  const [gender, setGender] = useState(user?.gender || 'F');
  const [age, setAge] = useState(40);
  const [height, setHeight] = useState(user?.height || 162);
  const [weight, setWeight] = useState(user?.startWeight || 70);
  const [activity, setActivity] = useState(1.375);

  const bmr = gender === 'F'
    ? 655 + 9.6 * weight + 1.8 * height - 4.7 * age
    : 66 + 13.7 * weight + 5 * height - 6.8 * age;
  const tdee = bmr * activity;
  const deficit = Math.round(tdee * 0.80);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">🔥 칼로리 계산기</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          기초대사량(BMR)·일일 소비(TDEE)·감량 목표 칼로리를 계산합니다.
        </p>
      </header>

      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">성별</div>
            <div className="flex gap-1">
              {[
                { id: 'F', label: '여' },
                { id: 'M', label: '남' },
              ].map(o => (
                <button key={o.id} onClick={() => setGender(o.id)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition
                                    ${gender === o.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">나이</div>
            <input type="number" className="input" value={age} onChange={e => setAge(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">키 (cm)</div>
            <input type="number" className="input" value={height} onChange={e => setHeight(+e.target.value)} />
          </div>
          <div>
            <div className="label">체중 (kg)</div>
            <input type="number" className="input" value={weight} onChange={e => setWeight(+e.target.value)} />
          </div>
        </div>
        <div>
          <div className="label">활동 수준</div>
          <select className="input" value={activity} onChange={e => setActivity(+e.target.value)}>
            <option value={1.2}>거의 안 움직임 (재택·앉아서 일)</option>
            <option value={1.375}>가벼운 활동 (주 1-3회 운동)</option>
            <option value={1.55}>보통 활동 (주 3-5회 운동)</option>
            <option value={1.725}>활발 (주 6-7회 운동)</option>
            <option value={1.9}>매우 활발 (육체 노동)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center !p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">기초대사량</div>
          <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 tabular-nums mt-1">
            {Math.round(bmr)}
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500">kcal</div>
        </div>
        <div className="card text-center !p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">일일 소비</div>
          <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 tabular-nums mt-1">
            {Math.round(tdee)}
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500">kcal/일</div>
        </div>
        <div className="card text-center !p-4 ring-2 ring-brand-300">
          <div className="text-xs text-brand-700 dark:text-brand-400 font-semibold">감량 목표</div>
          <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums mt-1">
            {deficit}
          </div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500">kcal/일 (TDEE의 80%)</div>
        </div>
      </div>

      <div className="card text-sm text-ink-700 dark:text-slate-300 space-y-1">
        <p>💡 감량기 권장: <b>TDEE의 80%</b> (너무 적게 먹으면 근손실+정체기)</p>
        <p>💡 단백질: 체중 1kg당 <b>1.2-1.6g</b> (감량기엔 더 많이)</p>
        <p>💡 1주 0.5-1kg 감량이 안전한 페이스</p>
      </div>
    </div>
  );
}

function TargetCalculator({ user }) {
  const [height, setHeight] = useState(user?.height || 162);
  const [current, setCurrent] = useState(user?.startWeight || 75);
  const myBmi = bmi(current, height);

  // 추천 목표 BMI (정상 23 기준)
  const targetByBmi = (b) => +(b * (height / 100) ** 2).toFixed(1);
  const targets = [
    { bmi: 23, label: '정상 상한', kg: targetByBmi(23) },
    { bmi: 22, label: '정상 중간', kg: targetByBmi(22) },
    { bmi: 21, label: '정상 하한', kg: targetByBmi(21) },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">🎯 목표 체중 계산기</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          BMI 기준 정상 체중 범위와 5-10-15-20% 감량 시 도달 체중.
        </p>
      </header>

      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">키 (cm)</div>
            <input type="number" className="input" value={height} onChange={e => setHeight(+e.target.value)} />
          </div>
          <div>
            <div className="label">현재 체중 (kg)</div>
            <input type="number" className="input" step="0.1" value={current} onChange={e => setCurrent(+e.target.value)} />
          </div>
        </div>
        {myBmi != null && (
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 px-4 py-3 text-sm">
            현재 BMI <b className="text-brand-700 dark:text-brand-400 tabular-nums">{myBmi.toFixed(1)}</b>
            <span className="ml-2 chip-brand">{bmiCategory(myBmi)}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">BMI 기준 정상 체중 범위</h2>
        <div className="mt-3 space-y-2">
          {targets.map(t => (
            <div key={t.bmi} className="flex justify-between text-sm py-2 border-b border-ink-100 dark:border-slate-800">
              <span className="text-ink-700 dark:text-slate-300">BMI {t.bmi} ({t.label})</span>
              <span className="font-semibold text-ink-900 dark:text-slate-100 tabular-nums">
                {t.kg} kg <span className="text-ink-500 dark:text-slate-400 text-xs">({(current - t.kg) > 0 ? `${(current - t.kg).toFixed(1)} kg 감량` : '도달'})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">% 감량별 도달 체중</h2>
        <div className="mt-3 space-y-2">
          {[5, 10, 15, 20].map(p => {
            const target = +(current * (1 - p / 100)).toFixed(1);
            return (
              <div key={p} className="flex justify-between text-sm py-2 border-b border-ink-100 dark:border-slate-800">
                <span className="text-ink-700 dark:text-slate-300">−{p}% 감량</span>
                <span className="font-semibold text-ink-900 dark:text-slate-100 tabular-nums">
                  {target} kg <span className="text-ink-500 dark:text-slate-400 text-xs">(−{(current - target).toFixed(1)} kg)</span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="helptext mt-3">
          💡 비약물 감량은 보통 연 5-7%. 위고비는 평균 15%, 마운자로는 20% 정도 도달합니다.
        </p>
      </div>
    </div>
  );
}
