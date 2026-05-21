import React, { useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { calculateAccuracy, accuracyBreakdown } from '../lib/accuracy.js';

// Statistics 페이지 상단 AI 정확도 카드 — 정밀 세분화 버전
// Static (47): 키·체중·약·빈도·가입·성별·나이대·동반질환 — 한 번 입력
// Dynamic (53): 체중·운동·식단·부작용·검사·투약 — 누적 단계별 가산
export function AccuracyCard({ user, navigate }) {
  const [version, setVersion] = useState(0);

  // simulator props는 hero/대시보드에서 가져오지 않음 — 본인 user 기반만 (Statistics 페이지 컨텍스트)
  // 사용 약·빈도는 활성 코스에서 추론
  const simulator = useMemo(() => {
    if (!user) return {};
    const courses = Storage.getMedCoursesByUser(user.id);
    const active = courses.find(c => !c.endDate) || courses[courses.length - 1];
    return {
      height: user.height,
      startWeight: user.startWeight,
      medication: active?.medication,
      frequency: active?.frequency || 'weekly',
    };
  }, [user, version]);

  const { score, filled, dynamicProgress } = useMemo(
    () => calculateAccuracy({ user, simulator }),
    [user, simulator, version],
  );
  const { staticItems, dynamicItems } = useMemo(
    () => accuracyBreakdown({ user, simulator }),
    [user, simulator, version],
  );

  const totalGainable = [...staticItems, ...dynamicItems]
    .reduce((s, b) => s + (b.filled ? 0 : (b.weight - (b.gained || 0))), 0);

  // 입력 핸들러
  const updateUser = (partial) => {
    if (!user) return;
    Storage.upsertUser({ ...user, ...partial });
    setVersion(v => v + 1);
  };
  const toggleCondition = (key) => {
    if (!user) return;
    const newCond = { ...(user.conditions || {}), [key]: !user.conditions?.[key] };
    updateUser({ conditions: newCond });
  };

  // 색상 tone
  const tone = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'rose';
  const toneClasses = {
    emerald: 'from-emerald-50 to-white dark:from-emerald-900/15 dark:to-slate-900 border-emerald-200 dark:border-emerald-800/40',
    amber:   'from-amber-50 to-white dark:from-amber-900/15 dark:to-slate-900 border-amber-200 dark:border-amber-800/40',
    rose:    'from-rose-50 to-white dark:from-rose-900/15 dark:to-slate-900 border-rose-200 dark:border-rose-800/40',
  };
  const numberColor = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber:   'text-amber-700 dark:text-amber-400',
    rose:    'text-rose-700 dark:text-rose-400',
  };

  return (
    <section className={`rounded-2xl border-2 bg-gradient-to-br ${toneClasses[tone]} p-5 sm:p-6`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400">🎯 AI 예측 정확도</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight ${numberColor[tone]}`}>
              {score}<span className="text-2xl">%</span>
            </span>
            {!user && (
              <span className="text-xs text-ink-500 dark:text-slate-400">· 비가입자 기본</span>
            )}
          </div>
          <p className="text-sm text-ink-600 dark:text-slate-300 mt-2 leading-relaxed">
            {score < 50 && '기본 코호트 평균 — 본인 정보 입력 시 빠르게 정밀화됩니다.'}
            {score >= 50 && score < 75 && '본인 조건 일부 반영 중 — 운동·식단·검사 누적이 가장 효과적입니다.'}
            {score >= 75 && score < 90 && '높은 정확도 — 매주 체중 기록을 누적하면 추세까지 반영.'}
            {score >= 90 && '거의 모든 데이터 입력 완료 — 본인 trend로 정밀 예측.'}
          </p>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="mt-4 h-3 rounded-full bg-white/60 dark:bg-slate-800/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500
                        ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}
             style={{ width: `${score}%` }} />
      </div>

      {/* === Static 항목 — 기본 정보 (47%) === */}
      <div className="mt-5 pt-4 border-t border-ink-200/40 dark:border-slate-700/40">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <div className="text-xs font-bold text-ink-700 dark:text-slate-300">📋 기본 정보 <span className="text-ink-500 font-normal">(최대 47%)</span></div>
          <span className="text-[10px] tabular-nums text-ink-500 dark:text-slate-500">
            {staticItems.filter(b => b.filled).reduce((s, b) => s + b.weight, 0)} / 47
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {staticItems.map(item => (
            <StaticChip key={item.key} item={item}
                        onClickInput={() => {
                          if (item.key === 'gender' || item.key === 'ageGroup') return; // 그리드 아래 input
                          if (item.key === 'fattyLiver') toggleCondition('fattyLiver');
                          if (item.key === 'diabetes') toggleCondition('diabetes');
                          if (item.key === 'thyroid') toggleCondition('thyroid');
                          if ((item.key === 'height' || item.key === 'startWeight' || item.key === 'medication') && navigate) {
                            navigate(item.key === 'medication' ? 'meds' : 'profile');
                          }
                        }} />
          ))}
        </div>

        {/* 가입자 — 성별·나이대 빠른 입력 */}
        {user && (!filled.gender || !filled.ageGroup) && (
          <div className="mt-3 space-y-2">
            {!filled.gender && (
              <QuickInputRow label="성별" gain={5}>
                {[{id:'F',label:'여성'},{id:'M',label:'남성'}].map(o => (
                  <button key={o.id} onClick={() => updateUser({ gender: o.id })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/15 transition">
                    {o.label}
                  </button>
                ))}
              </QuickInputRow>
            )}
            {!filled.ageGroup && (
              <QuickInputRow label="나이대" gain={5}>
                <div className="grid grid-cols-5 gap-1">
                  {[{id:'20s',label:'20대'},{id:'30s',label:'30대'},{id:'40s',label:'40대'},{id:'50s',label:'50대'},{id:'60s+',label:'60+'}].map(o => (
                    <button key={o.id} onClick={() => updateUser({ ageGroup: o.id })}
                            className="px-1 py-1.5 rounded-lg text-[11px] font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-400 transition">
                      {o.label}
                    </button>
                  ))}
                </div>
              </QuickInputRow>
            )}
          </div>
        )}
      </div>

      {/* === Dynamic — 누적 데이터 (53%) === */}
      {user && (
        <div className="mt-5 pt-4 border-t border-ink-200/40 dark:border-slate-700/40">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <div className="text-xs font-bold text-ink-700 dark:text-slate-300">📊 누적 데이터 <span className="text-ink-500 font-normal">(최대 53%)</span></div>
            <span className="text-[10px] tabular-nums text-ink-500 dark:text-slate-500">
              {dynamicItems.reduce((s, b) => s + (b.gained || 0), 0)} / 53
            </span>
          </div>
          <div className="space-y-2">
            {dynamicItems.map(item => (
              <DynamicRow key={item.key} item={item} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* 비가입자 안내 */}
      {!user && (
        <div className="mt-4 pt-4 border-t border-ink-200/40 dark:border-slate-700/40 text-xs text-ink-600 dark:text-slate-400 leading-relaxed">
          <b>가입하면</b> 성별·나이대·동반질환·운동·식단·체중 추이·검사·투약 누적까지 반영되어
          정확도가 <b className="text-brand-600 dark:text-brand-400">최대 100%</b>까지 올라갑니다.
        </div>
      )}
    </section>
  );
}

// Static chip — 채워졌는지 + 가중치
function StaticChip({ item, onClickInput }) {
  const isClickable = !item.filled && (
    item.key === 'fattyLiver' || item.key === 'diabetes' || item.key === 'thyroid'
    || item.key === 'height' || item.key === 'startWeight' || item.key === 'medication'
  );
  return (
    <button
      type="button"
      onClick={isClickable ? onClickInput : undefined}
      disabled={!isClickable}
      className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition
                  ${item.filled
                    ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                    : isClickable
                      ? 'bg-white dark:bg-slate-800 border-ink-300 dark:border-slate-700 text-ink-600 dark:text-slate-400 hover:border-brand-400 cursor-pointer'
                      : 'bg-white/60 dark:bg-slate-800/60 border-ink-200 dark:border-slate-700 text-ink-400 dark:text-slate-500'}`}>
      <span className="flex items-center gap-1 truncate">
        <span className="text-[10px]">{item.filled ? '✓' : '○'}</span>
        <span className="truncate">{item.label}</span>
      </span>
      <span className={`tabular-nums text-[10px] font-bold flex-shrink-0
                        ${item.filled ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink-500'}`}>
        +{item.weight}
      </span>
    </button>
  );
}

// Dynamic row — 누적 기반, tier 표시
function DynamicRow({ item, navigate }) {
  const filledPct = (item.gained / item.weight) * 100;
  const remaining = item.weight - item.gained;
  // 다음 tier 안내
  const nextTier = item.tiers.find(t => t.count > item.count);
  const recordPaths = {
    weightLogs:    'records',
    exercises30d:  'records',
    diets30d:      'records',
    sideEffects30d:'records',
    healthMetrics: 'records',
    doses:         'records',
  };
  return (
    <div className="rounded-lg bg-white/80 dark:bg-slate-800/60 border border-ink-200 dark:border-slate-700 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-900 dark:text-slate-100">
          <span>{item.gained >= item.weight ? '✓' : '○'}</span>
          <span>{item.label}</span>
          <span className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums">
            {item.count}건
          </span>
        </div>
        <span className={`text-[10px] font-bold tabular-nums
                          ${item.gained >= item.weight ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink-500 dark:text-slate-400'}`}>
          +{item.gained}/{item.weight}
        </span>
      </div>
      {/* progress bar */}
      <div className="h-1.5 bg-ink-100 dark:bg-slate-900 rounded-full overflow-hidden mb-1.5">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-300"
             style={{ width: `${Math.min(100, filledPct)}%` }} />
      </div>
      {/* 다음 단계 안내 + 빠른 진입 */}
      {nextTier && (
        <div className="flex justify-between items-center text-[10px] gap-2">
          <span className="text-ink-500 dark:text-slate-500">
            {nextTier.hint} (+{nextTier.addPct}%)까지 <b className="tabular-nums">{nextTier.count - item.count}</b>건 남음
          </span>
          <button onClick={() => navigate?.(recordPaths[item.key])}
                  className="text-brand-700 dark:text-brand-400 hover:underline text-[10px] font-semibold">
            기록 →
          </button>
        </div>
      )}
    </div>
  );
}

function QuickInputRow({ label, gain, children }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-white/70 dark:bg-slate-800/60 border border-ink-200 dark:border-slate-700 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-700 dark:text-slate-300 font-medium">{label}</span>
        <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
          +{gain}%
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}
