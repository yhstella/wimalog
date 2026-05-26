import React, { useEffect, useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { calculateAccuracy } from '../lib/accuracy.js';
import { MEDS, GENDERS, AGE_GROUPS, CONDITIONS } from '../lib/constants.js';

// AI 예측 페이지의 단일 카드.
// - 키·체중 input은 랜딩페이지 Simulator와 sessionStorage('wimalog_sim_prefill')로 양방향 동기화
// - 정확도 % 표시
// - 추가 정보 입력은 체크박스 row 형태. 클릭하면 inline 입력 펼침. 입력 완료 시 ☑ + 정확도 상승
const SIM_PREFILL_KEY = 'wimalog_sim_prefill';
const FREQ_OPTIONS = [
  { id: 'weekly',     label: '매주' },
  { id: 'biweekly',   label: '격주' },
  { id: 'occasional', label: '가끔' },
];

function loadSim(user) {
  let stored = null;
  try {
    const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {}
  return {
    height: user?.height ?? stored?.height ?? 162,
    startWeight: user?.startWeight ?? stored?.startWeight ?? 78,
    medication: stored?.medication || 'wegovy',
    frequency: stored?.frequency || 'weekly',
    gender: user?.gender ?? stored?.gender ?? null,
    ageGroup: user?.ageGroup ?? stored?.ageGroup ?? null,
    hasFattyLiver: stored?.hasFattyLiver || !!user?.conditions?.fattyLiver || false,
    hasDiabetes:   stored?.hasDiabetes   || !!user?.conditions?.diabetes   || false,
  };
}

function saveSim(state) {
  try { sessionStorage.setItem(SIM_PREFILL_KEY, JSON.stringify(state)); } catch {}
}

export function AIPredictionPanel({ user }) {
  const [sim, setSim] = useState(() => loadSim(user));
  const [open, setOpen] = useState(null);
  const [version, setVersion] = useState(0);

  // user prop은 parent가 갱신해주지 않으면 stale — updateUser 후에도 checkbox 상태가 안 바뀌는
  // 버그 원인. version tick마다 Storage에서 fresh user를 다시 읽어 모든 derived 값이 갱신됨.
  const liveUser = useMemo(
    () => user ? (Storage.getUser(user.id) || user) : null,
    [user, version],
  );

  // 랜딩 Simulator와 sync — sessionStorage 폴링 (Simulator도 같은 키 사용)
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setSim(prev => {
          const merged = { ...prev, ...parsed };
          return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged;
        });
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { saveSim(sim); }, [sim]);

  const setSimField = (k, v) => setSim(s => ({ ...s, [k]: v }));
  const updateUser = (partial) => {
    if (!liveUser) return;
    Storage.upsertUser({ ...liveUser, ...partial });
    setVersion(v => v + 1);
  };

  // 가입자: 키·체중 변경 시 user에도 반영. 비가입자: sessionStorage만.
  const setHeight = (v) => {
    const n = +v || 0;
    setSimField('height', n);
    if (user && n >= 100 && n <= 220) updateUser({ height: n });
  };
  const setStartWeight = (v) => {
    const n = +v || 0;
    setSimField('startWeight', n);
    if (user && n >= 30 && n <= 250) updateUser({ startWeight: n });
  };

  // 입력 초기화 — sessionStorage 시뮬레이터 prefill + 가입자라면 demographic·동반질환도 wipe.
  // 키·체중·약·빈도는 placeholder 기본값(162/78/wegovy/weekly)으로 돌려 50% 베이스라인 근처로 리셋.
  const resetInputs = () => {
    try { sessionStorage.removeItem(SIM_PREFILL_KEY); } catch {}
    setSim({
      height: liveUser?.height ?? 162,
      startWeight: liveUser?.startWeight ?? 78,
      medication: 'wegovy',
      frequency: 'weekly',
      gender: null,
      ageGroup: null,
      hasFattyLiver: false,
      hasDiabetes: false,
    });
    setOpen(null);
    if (liveUser) {
      Storage.upsertUser({
        ...liveUser,
        gender: null,
        ageGroup: null,
        conditions: {},
        conditionsChecked: false,
      });
      setVersion(v => v + 1);
    }
  };

  const { score } = useMemo(
    () => calculateAccuracy({ user: liveUser, simulator: sim }),
    [liveUser, sim],
  );

  // 표시 점수는 50~90 범위 (50% 베이스라인 + 입력 가중치 * 0.4). 임계점도 그 범위 기준.
  const tone = score >= 80 ? 'emerald' : score >= 65 ? 'amber' : 'rose';
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
  const barColor = {
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-500',
    rose:    'bg-rose-500',
  };

  // 정확도 상승 체크박스. displayed = 50 + raw * 0.4. badge gain은 raw * 0.4 반올림.
  const rows = [
    {
      key: 'medication', label: '사용 약 선택', gain: 2,
      checked: !!sim.medication,
      render: () => (
        <div className="flex flex-wrap gap-1.5">
          {MEDS.filter(m => m.id !== 'other').map(m => (
            <button key={m.id} onClick={() => { setSimField('medication', m.id); setOpen(null); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition
                                ${sim.medication === m.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {m.label.replace(/\s*\(.+\)/, '')}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'frequency', label: '사용 빈도 선택', gain: 1,
      checked: !!sim.frequency,
      render: () => (
        <div className="flex flex-wrap gap-1.5">
          {FREQ_OPTIONS.map(f => (
            <button key={f.id} onClick={() => { setSimField('frequency', f.id); setOpen(null); }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition
                                ${sim.frequency === f.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'gender', label: '성별 알려주기', gain: 1,
      checked: !!sim.gender && sim.gender !== 'X',
      render: () => (
        <div className="flex flex-wrap gap-1.5">
          {GENDERS.filter(g => g.id !== 'X').map(g => (
            <button key={g.id} onClick={() => {
                      setSimField('gender', g.id);
                      if (user) updateUser({ gender: g.id });
                      setOpen(null);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition
                                ${sim.gender === g.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {g.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'ageGroup', label: '나이대 알려주기', gain: 1,
      checked: !!sim.ageGroup,
      render: () => (
        <div className="grid grid-cols-5 gap-1.5">
          {AGE_GROUPS.map(a => (
            <button key={a.id} onClick={() => {
                      setSimField('ageGroup', a.id);
                      if (user) updateUser({ ageGroup: a.id });
                      setOpen(null);
                    }}
                    className={`px-1 py-2 rounded-lg text-xs font-medium border transition
                                ${sim.ageGroup === a.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {a.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'conditionsChecked', label: '동반질환 확인', gain: 1,
      checked: !!liveUser?.conditionsChecked,
      disabled: !liveUser,
      hint: !liveUser ? '가입 후 입력 가능' : null,
      render: () => <ConditionsPicker user={liveUser} onComplete={(cond) => {
        updateUser({ conditions: cond, conditionsChecked: true });
        setOpen(null);
      }} />,
    },
    {
      key: 'signedIn', label: '가입하기 (본인 추이 누적)', gain: 2,
      checked: !!liveUser,
      disabled: !!liveUser,
      hint: liveUser ? '완료' : '본인 체중·운동·식단 누적 시 정확도 추가 상승',
      render: () => null,
    },
  ];

  return (
    <section className={`rounded-2xl border-2 bg-gradient-to-br ${toneClasses[tone]} p-5 sm:p-6`}>
      {/* 헤더 + 입력 초기화 */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-slate-400">
          🎯 AI 예측 정확도
        </div>
        <button onClick={resetInputs}
                className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white/70 dark:bg-slate-800/70 border border-ink-300 dark:border-slate-700 text-ink-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition">
          ↺ 입력 초기화
        </button>
      </div>

      {/* 키·체중 입력 — Simulator와 동기화 */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberInput
          label="키 (cm)" value={sim.height} min={100} max={220} step={1}
          onChange={setHeight} />
        <NumberInput
          label="체중 (kg)" value={sim.startWeight} min={30} max={250} step={0.5}
          onChange={setStartWeight} />
      </div>
      <p className="mt-1.5 text-[10px] text-ink-500 dark:text-slate-500">
        랜딩페이지 시뮬레이터와 자동 동기화돼요
      </p>

      {/* 큰 정확도 % */}
      <div className="mt-4 flex items-baseline gap-2 flex-wrap">
        <span className={`text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight ${numberColor[tone]}`}>
          {score}<span className="text-2xl">%</span>
        </span>
        <span className="text-xs text-ink-500 dark:text-slate-400">AI 예측 정확도</span>
      </div>

      {/* 프로그레스 바 */}
      <div className="mt-3 h-3 rounded-full bg-white/60 dark:bg-slate-800/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor[tone]}`}
             style={{ width: `${score}%` }} />
      </div>

      {/* 정확도 상승 체크박스 */}
      <div className="mt-5 pt-4 border-t border-ink-200/40 dark:border-slate-700/40">
        <div className="text-xs font-bold text-ink-700 dark:text-slate-300 mb-2">
          정확도 더 올리기
        </div>
        <div className="space-y-1.5">
          {rows.map(r => (
            <CheckRow key={r.key} row={r}
                      isOpen={open === r.key}
                      onToggle={() => {
                        if (r.disabled) return;
                        setOpen(o => o === r.key ? null : r.key);
                      }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NumberInput({ label, value, min, max, step, onChange }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-ink-600 dark:text-slate-400">{label}</span>
      <input type="number" inputMode="decimal"
             className="input mt-1 tabular-nums"
             value={value} min={min} max={max} step={step}
             onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function CheckRow({ row, isOpen, onToggle }) {
  return (
    <div className="rounded-lg border bg-white/80 dark:bg-slate-800/60 border-ink-200 dark:border-slate-700">
      <button type="button" onClick={onToggle}
              disabled={row.disabled && !isOpen}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition
                          ${row.disabled ? 'opacity-70' : 'hover:bg-ink-100/40 dark:hover:bg-slate-700/40'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold flex-shrink-0
                            ${row.checked
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white dark:bg-slate-900 border-ink-300 dark:border-slate-600 text-transparent'}`}>
            ✓
          </span>
          <span className="text-sm font-medium text-ink-900 dark:text-slate-100 truncate">{row.label}</span>
        </div>
        <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0
                          ${row.checked
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'}`}>
          +{row.gain}%
        </span>
      </button>
      {isOpen && row.render() && (
        <div className="px-3 py-3 border-t border-ink-200/60 dark:border-slate-700/60">
          {row.render()}
        </div>
      )}
      {row.hint && !isOpen && (
        <div className="px-3 pb-2 -mt-1 text-[10px] text-ink-500 dark:text-slate-500">
          {row.hint}
        </div>
      )}
    </div>
  );
}

function ConditionsPicker({ user, onComplete }) {
  const [cond, setCond] = useState(() => Object.fromEntries(
    CONDITIONS.map(c => [c.id, !!user?.conditions?.[c.id]])
  ));
  return (
    <div>
      <div className="text-[11px] text-ink-500 dark:text-slate-500 mb-2">
        해당사항만 클릭. 없으면 그대로 완료
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
        {CONDITIONS.map(c => (
          <button key={c.id} type="button"
                  onClick={() => setCond(s => ({ ...s, [c.id]: !s[c.id] }))}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition text-left
                              ${cond[c.id]
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-white dark:bg-slate-900 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
            {cond[c.id] ? '✓ ' : ''}{c.label}
          </button>
        ))}
      </div>
      <button onClick={() => onComplete(cond)}
              className="w-full text-xs font-bold py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition">
        확인 완료
      </button>
    </div>
  );
}
