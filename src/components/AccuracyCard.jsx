import React, { useMemo, useState, useEffect } from 'react';
import { Storage } from '../lib/storage.js';
import { calculateAccuracy, accuracyBreakdown } from '../lib/accuracy.js';

// Statistics 페이지 상단 AI 정확도 카드
// - 현재 정확도 큰 숫자 + 색상 (rose < 60 / amber < 80 / emerald >= 80)
// - 입력 안 된 항목 클릭 가능 → 실시간 +N% 시각화
// - 본인 정보 입력은 user 객체에 즉시 반영 (Storage.upsertUser)
export function AccuracyCard({ user, refresh }) {
  // 추가 입력 (Statistics 페이지 안에서 즉시 입력 가능)
  const [version, setVersion] = useState(0);
  const [exerciseLevel, setExerciseLevel] = useState(user?.exerciseLevel || null);

  // user 객체에서 직접 읽기 (다른 페이지에서 입력해도 반영)
  const cond = user?.conditions || {};
  const hasFattyLiver = !!cond.fattyLiver;
  const hasDiabetes = !!cond.diabetes || !!cond.prediabetes;

  // 정확도 계산 — user 변경 + version 변경 시 재계산
  const accuracy = useMemo(
    () => calculateAccuracy({ user, exerciseLevel, hasFattyLiver, hasDiabetes }),
    [user, exerciseLevel, hasFattyLiver, hasDiabetes, version],
  );
  const breakdown = useMemo(
    () => accuracyBreakdown({ user, exerciseLevel, hasFattyLiver, hasDiabetes }),
    [user, exerciseLevel, hasFattyLiver, hasDiabetes, version],
  );

  const missingItems = breakdown.filter(b => !b.filled);
  const totalGainable = missingItems.reduce((s, b) => s + b.weight, 0);

  // 입력 핸들러 — user.conditions / gender / ageGroup 즉시 업데이트
  const updateUser = (partial) => {
    if (!user) return;
    const updates = { ...user, ...partial };
    Storage.upsertUser(updates);
    setVersion(v => v + 1);  // 즉시 재계산 (user prop은 stale일 수 있음)
    refresh?.();
  };
  const toggleCondition = (key) => {
    if (!user) return;
    const newCond = { ...(user.conditions || {}), [key]: !user.conditions?.[key] };
    updateUser({ conditions: newCond });
  };

  // 색상
  const tone = accuracy >= 80 ? 'emerald' : accuracy >= 60 ? 'amber' : 'rose';
  const toneClasses = {
    emerald: 'from-emerald-50 to-white dark:from-emerald-900/15 dark:to-slate-900 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400',
    amber:   'from-amber-50 to-white dark:from-amber-900/15 dark:to-slate-900 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400',
    rose:    'from-rose-50 to-white dark:from-rose-900/15 dark:to-slate-900 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400',
  };

  return (
    <section className={`rounded-2xl border-2 bg-gradient-to-br ${toneClasses[tone]} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider opacity-80">🎯 AI 예측 정확도</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight`}>
              {accuracy}<span className="text-2xl">%</span>
            </span>
            {!user && (
              <span className="text-xs text-ink-500 dark:text-slate-400">
                · 비가입자 기본
              </span>
            )}
          </div>
          <p className="text-sm text-ink-600 dark:text-slate-300 mt-2 leading-relaxed">
            {accuracy < 60 && '기본 코호트 평균 수준 — 추가 입력으로 본인 조건에 가까워집니다.'}
            {accuracy >= 60 && accuracy < 80 && '본인 조건 매칭 중 — 운동·동반질환·체중 추이로 더 정밀하게.'}
            {accuracy >= 80 && accuracy < 95 && '높은 정확도 — 체중 기록을 더 누적하면 본인 trend 반영됩니다.'}
            {accuracy >= 95 && '거의 모든 정보 입력 완료 — 본인 데이터 추이로 정밀 예측.'}
          </p>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="mt-4 h-3 rounded-full bg-white/60 dark:bg-slate-800/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500
                        ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}
             style={{ width: `${accuracy}%` }} />
      </div>

      {/* 누락 항목 — 클릭으로 즉시 +N% */}
      {user && missingItems.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ink-200/40 dark:border-slate-700/40">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <div className="text-xs font-semibold text-ink-700 dark:text-slate-300">
              아래 입력 시 정확도가 즉시 올라갑니다
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800/80 text-ink-700 dark:text-slate-300">
              +{totalGainable}% 가능
            </span>
          </div>
          <div className="space-y-2.5">
            {/* 성별 */}
            {breakdown.find(b => b.key === 'gender' && !b.filled) && (
              <AccRow label="성별" gain={ACCURACY_WEIGHTS_HELP('gender')}>
                <div className="flex gap-1.5">
                  {[{id:'F',label:'여성'},{id:'M',label:'남성'}].map(o => (
                    <button key={o.id} onClick={() => updateUser({ gender: o.id })}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/15 transition">
                      {o.label}
                    </button>
                  ))}
                </div>
              </AccRow>
            )}
            {/* 나이대 */}
            {breakdown.find(b => b.key === 'ageGroup' && !b.filled) && (
              <AccRow label="나이대" gain={ACCURACY_WEIGHTS_HELP('ageGroup')}>
                <div className="grid grid-cols-5 gap-1">
                  {[{id:'20s',label:'20대'},{id:'30s',label:'30대'},{id:'40s',label:'40대'},{id:'50s',label:'50대'},{id:'60s+',label:'60+'}].map(o => (
                    <button key={o.id} onClick={() => updateUser({ ageGroup: o.id })}
                            className="px-1 py-1.5 rounded-lg text-[11px] font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 transition">
                      {o.label}
                    </button>
                  ))}
                </div>
              </AccRow>
            )}
            {/* 운동량 */}
            {breakdown.find(b => b.key === 'exerciseLevel' && !b.filled) && (
              <AccRow label="평소 운동량" gain={ACCURACY_WEIGHTS_HELP('exerciseLevel')}>
                <div className="flex gap-1.5">
                  {[
                    { id: 'low',  label: '거의 안 함' },
                    { id: 'mid',  label: '주 1-2회' },
                    { id: 'high', label: '주 3회+' },
                  ].map(o => (
                    <button key={o.id} onClick={() => { setExerciseLevel(o.id); updateUser({ exerciseLevel: o.id }); }}
                            className="px-2 py-1.5 rounded-lg text-[11px] font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 transition flex-1">
                      {o.label}
                    </button>
                  ))}
                </div>
              </AccRow>
            )}
            {/* 동반질환 */}
            {(breakdown.find(b => b.key === 'fattyLiver' && !b.filled) || breakdown.find(b => b.key === 'diabetes' && !b.filled)) && (
              <AccRow label="동반질환" gain={ACCURACY_WEIGHTS_HELP('fattyLiver') + ACCURACY_WEIGHTS_HELP('diabetes')}>
                <div className="flex gap-1.5 flex-wrap">
                  {!cond.fattyLiver && (
                    <button onClick={() => toggleCondition('fattyLiver')}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 transition">
                      🫀 지방간 있음
                    </button>
                  )}
                  {!cond.diabetes && !cond.prediabetes && (
                    <button onClick={() => toggleCondition('diabetes')}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 transition">
                      🩸 당뇨/전당뇨
                    </button>
                  )}
                </div>
              </AccRow>
            )}
            {/* 체중 누적 — 액션 안내 */}
            {breakdown.find(b => b.key === 'logsAccumulated' && !b.filled) && (
              <AccRow label="체중 4회+ 기록 누적" gain={ACCURACY_WEIGHTS_HELP('logsAccumulated')} info>
                <span className="text-[11px] text-ink-500 dark:text-slate-500">
                  기록 탭에서 매주 1회씩 체중을 입력하면 자동으로 +8%
                </span>
              </AccRow>
            )}
          </div>
        </div>
      )}

      {!user && (
        <div className="mt-4 pt-4 border-t border-ink-200/40 dark:border-slate-700/40 text-xs text-ink-600 dark:text-slate-400">
          가입하면 성별·나이대·운동·동반질환·본인 체중 추이까지 반영되어 정확도가 <b>최대 100%</b>까지 올라갑니다.
        </div>
      )}
    </section>
  );
}

// 가중치 lookup (UI 표시용)
function ACCURACY_WEIGHTS_HELP(key) {
  const w = {
    base: 40, signedIn: 10, gender: 8, ageGroup: 8, exerciseLevel: 14,
    fattyLiver: 6, diabetes: 6, logsAccumulated: 8,
  };
  return w[key] || 0;
}

function AccRow({ label, gain, children, info }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-ink-700 dark:text-slate-300 font-medium whitespace-nowrap">{label}</span>
        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full
                          ${info ? 'bg-ink-100 dark:bg-slate-800 text-ink-500 dark:text-slate-400'
                                 : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
          {info ? '+' : '+'}{gain}%
        </span>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
