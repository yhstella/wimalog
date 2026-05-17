import React, { useMemo, useState } from 'react';
import { Storage, uid } from '../lib/storage.js';
import {
  SIDE_EFFECTS, EXERCISE_TYPES, EXERCISE_BY_ID, MEAL_TYPES, MEAL_BY_ID,
  DIET_PATTERNS, MED_BY_ID, REGION_SUGGESTIONS,
} from '../lib/constants.js';
import { RedFlagBanner } from './SafetyBanner.jsx';
import { useToast } from './Toast.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

const TABS = [
  { id: 'weight',   label: '체중·증상', icon: '⚖️' },
  { id: 'dose',     label: '투약',     icon: '💊' },
  { id: 'exercise', label: '운동',     icon: '🏃' },
  { id: 'diet',     label: '식단',     icon: '🍽️' },
];

export function Records({ user, navigate, initialTab = 'weight' }) {
  const [tab, setTab] = useState(initialTab);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">기록</h1>
        <p className="text-sm text-ink-500 mt-1">
          빈 항목은 그냥 두셔도 됩니다. 모두 1분 안에 끝납니다.
        </p>
      </div>

      <div className="flex gap-1 bg-ink-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition
                              ${tab === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'weight'   && <WeightTab user={user} version={version} refresh={refresh} navigate={navigate} />}
      {tab === 'dose'     && <DoseTab user={user} version={version} refresh={refresh} navigate={navigate} />}
      {tab === 'exercise' && <ExerciseTab user={user} version={version} refresh={refresh} />}
      {tab === 'diet'     && <DietTab user={user} version={version} refresh={refresh} />}
    </div>
  );
}

/* ============================================================
   체중·증상 탭
============================================================ */
function WeightTab({ user, version, refresh, navigate }) {
  const toast = useToast();
  const allLogs = useMemo(() => Storage.getLogsByUser(user.id), [user.id, version]);
  const lastLog = allLogs[allLogs.length - 1];
  const defaultWeight = lastLog?.weight ?? user.startWeight;

  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState(String(defaultWeight));
  const [appetiteChange, setAppetiteChange] = useState(3);
  const [satiety, setSatiety] = useState(3);
  const [mealReduction, setMealReduction] = useState(3);
  const [sideEffects, setSideEffects] = useState({});
  const [notes, setNotes] = useState('');

  const toggleSide = (id) => setSideEffects(s => ({ ...s, [id]: !s[id] }));
  const totalSideCount = Object.values(sideEffects).filter(Boolean).length;

  const submit = () => {
    if (!weight || +weight < 30 || +weight > 250) return;
    Storage.addLog({
      id: uid('log'),
      userId: user.id,
      date,
      weight: +weight,
      appetiteChange, satiety, mealReduction,
      sideEffects,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
    const delta = lastLog ? +weight - lastLog.weight : 0;
    setSideEffects({});
    setNotes('');
    refresh();
    toast.success(`체중 ${(+weight).toFixed(1)} kg 기록됨${lastLog ? ` · 지난 기록 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}`);
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">기록 날짜</div>
            <input type="date" className="input" value={date} max={todayISO()}
                   onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">체중 (kg)</div>
            <input type="number" inputMode="decimal" min={30} max={250} step="0.1"
                   className="input" value={weight}
                   onChange={e => setWeight(e.target.value)} />
            {lastLog && +weight && (
              <p className="helptext">지난 기록 대비 {(+weight - lastLog.weight).toFixed(1)} kg</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Scale label="식욕 변화" value={appetiteChange} onChange={setAppetiteChange}
                 minLabel="평소" maxLabel="크게 감소" />
          <Scale label="포만감" value={satiety} onChange={setSatiety}
                 minLabel="평소" maxLabel="금방 배부름" />
          <Scale label="식사량 감소" value={mealReduction} onChange={setMealReduction}
                 minLabel="평소" maxLabel="크게 감소" />
        </div>

        <div>
          <div className="label flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              부작용 {totalSideCount > 0 && <span className="chip">{totalSideCount}개</span>}
            </div>
            <div className="flex gap-1">
              {lastLog && Object.values(lastLog.sideEffects || {}).filter(Boolean).length > 0 && (
                <button type="button"
                        onClick={() => setSideEffects({ ...lastLog.sideEffects })}
                        className="text-xs px-2 py-1 rounded-lg border border-brand-300 text-brand-700 hover:bg-brand-50 transition">
                  ↩ 지난번 그대로
                </button>
              )}
              {totalSideCount > 0 && (
                <button type="button"
                        onClick={() => setSideEffects({})}
                        className="text-xs px-2 py-1 rounded-lg border border-ink-300 text-ink-500 hover:bg-ink-100 transition">
                  모두 해제
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SIDE_EFFECTS.map(s => (
              <button key={s.id} type="button" onClick={() => toggleSide(s.id)}
                      className={`px-3 py-2 rounded-xl text-sm border transition text-left
                                  ${sideEffects[s.id]
                                    ? 'bg-rose-500 text-white border-rose-500'
                                    : 'bg-white text-ink-700 border-ink-300 hover:border-rose-300'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">메모 (선택)</div>
          <textarea className="input min-h-[60px] resize-none" maxLength={300}
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="이번 주 컨디션, 특이사항 등" />
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={!weight} className="btn-primary">기록 저장</button>
        </div>
      </div>

      {totalSideCount >= 3 && <RedFlagBanner />}

      <RecentList
        items={allLogs.slice().reverse().slice(0, 10)}
        empty="아직 체중 기록이 없습니다."
        render={(l) => (
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900 tabular-nums">{l.weight} kg</span>
                <span className="text-xs text-ink-500">{l.date}</span>
              </div>
              {Object.values(l.sideEffects || {}).filter(Boolean).length > 0 && (
                <div className="text-xs text-rose-600 mt-0.5">
                  부작용 {Object.values(l.sideEffects).filter(Boolean).length}개
                </div>
              )}
              {l.notes && <div className="text-xs text-ink-500 mt-0.5 truncate">{l.notes}</div>}
            </div>
            <button onClick={() => { Storage.deleteLog(l.id); refresh(); }}
                    className="text-xs text-rose-600 hover:underline">삭제</button>
          </div>
        )}
      />
    </div>
  );
}

/* ============================================================
   투약 탭
============================================================ */
function DoseTab({ user, version, refresh, navigate }) {
  const toast = useToast();
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate),
                          [user.id, version]);
  const allDoses = useMemo(() => Storage.getDosesByUser(user.id), [user.id, version]);

  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const course = courses.find(c => c.id === courseId) || courses[0];
  const med = course ? MED_BY_ID[course.medication] : null;
  const lastDose = useMemo(() => allDoses.filter(d => d.courseId === course?.id).slice(-1)[0], [allDoses, course]);

  const [date, setDate] = useState(todayISO());
  const [dose, setDose] = useState('');
  const [price, setPrice] = useState('');
  const [region, setRegion] = useState('');

  // 코스가 바뀌면 기본값 갱신
  React.useEffect(() => {
    if (course) {
      setDose(lastDose?.dose || course.initialDose || med?.doses[0] || '');
      setPrice(lastDose?.price || '');
      setRegion(lastDose?.region || '');
    }
  }, [course?.id]);

  if (courses.length === 0) {
    return (
      <div className="card text-center py-10">
        <div className="text-4xl mb-2">💊</div>
        <div className="font-bold text-ink-900">진행 중인 약 코스가 없습니다</div>
        <p className="text-sm text-ink-500 mt-1 mb-4">
          투약 기록을 남기려면 먼저 약 관리 페이지에서 코스를 시작하세요.
        </p>
        <button onClick={() => navigate('meds')} className="btn-primary">약 관리로 이동</button>
      </div>
    );
  }

  const submit = () => {
    if (!dose) return;
    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId: course.id,
      seed: false,
      date,
      dose,
      price: +price || null,
      region: region.trim() || null,
      pharmacyName: null,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    setPrice('');
    refresh();
    toast.success(`${MED_BY_ID[course.medication]?.label.replace(/\s*\(.+\)/, '')} ${dose} 투약 기록됨`);
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        {courses.length > 1 && (
          <div>
            <div className="label">기록 대상 코스</div>
            <div className="flex gap-2 flex-wrap">
              {courses.map(c => (
                <button key={c.id} type="button" onClick={() => setCourseId(c.id)}
                        className={`px-3 py-2 rounded-xl text-sm border transition
                                    ${course?.id === c.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white text-ink-700 border-ink-300'}`}>
                  {MED_BY_ID[c.medication]?.label} {c.notes && `· ${c.notes}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">투약일</div>
            <input type="date" className="input" max={todayISO()}
                   value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">용량 — {med?.label}</div>
            <div className="flex gap-1.5 flex-wrap">
              {med?.doses.map(d => (
                <button key={d} type="button" onClick={() => setDose(d)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
                                    ${dose === d
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white text-ink-700 border-ink-300'}`}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">구매 가격 (원, 1회분)</div>
            <input type="number" inputMode="numeric" className="input"
                   value={price} onChange={e => setPrice(e.target.value)}
                   placeholder="예: 50000" />
          </div>
          <div>
            <div className="label">구매 지역</div>
            <input type="text" className="input" list="dose-region-suggestions" maxLength={30}
                   value={region} onChange={e => setRegion(e.target.value)}
                   placeholder="예: 서울 대학로" />
            <datalist id="dose-region-suggestions">
              {REGION_SUGGESTIONS.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={!dose} className="btn-primary">투약 기록 저장</button>
        </div>
      </div>

      <RecentList
        items={allDoses.slice().reverse().slice(0, 10)}
        empty="아직 투약 기록이 없습니다."
        render={(d) => {
          const c = courses.find(c => c.id === d.courseId);
          return (
            <div className="flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink-900">{d.dose}</span>
                  {c && <span className="text-xs text-ink-500">· {MED_BY_ID[c.medication]?.label.replace(/\s*\(.+\)/, '')}</span>}
                  <span className="text-xs text-ink-500">· {d.date}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {d.region && <>{d.region} · </>}
                  {d.price ? `${d.price.toLocaleString()}원` : '가격 미기록'}
                </div>
              </div>
              <button onClick={() => { Storage.deleteDose(d.id); refresh(); }}
                      className="text-xs text-rose-600 hover:underline">삭제</button>
            </div>
          );
        }}
      />
    </div>
  );
}

/* ============================================================
   운동 탭
============================================================ */
function ExerciseTab({ user, version, refresh }) {
  const toast = useToast();
  const allEx = useMemo(() => Storage.getExercisesByUser(user.id), [user.id, version]);
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState('walking');
  const [durationMin, setDurationMin] = useState(30);
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (!durationMin || durationMin < 1) return;
    Storage.addExercise({
      id: uid('ex'),
      userId: user.id,
      seed: false,
      date,
      type,
      durationMin: +durationMin,
      intensity,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
    setNotes('');
    refresh();
    toast.success(`${EXERCISE_BY_ID[type]?.label} ${durationMin}분 기록됨`);
  };

  const quickRepeat = (ex) => {
    Storage.addExercise({
      id: uid('ex'),
      userId: user.id,
      seed: false,
      date: todayISO(),
      type: ex.type,
      durationMin: ex.durationMin,
      intensity: ex.intensity,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    refresh();
    toast.success(`${EXERCISE_BY_ID[ex.type]?.label} ${ex.durationMin}분 추가됨`);
  };

  // 이번 주 합계
  const thisWeekTotal = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const start = oneWeekAgo.toISOString().slice(0, 10);
    const week = allEx.filter(e => e.date >= start);
    return {
      sessions: week.length,
      minutes: week.reduce((s, e) => s + (e.durationMin || 0), 0),
    };
  }, [allEx]);

  // 자주 한 운동 Top 3 (최근 30일)
  const favorites = useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const start = oneMonthAgo.toISOString().slice(0, 10);
    const recent = allEx.filter(e => e.date >= start);
    const map = new Map();
    for (const e of recent) {
      const key = `${e.type}|${e.durationMin}|${e.intensity}`;
      if (!map.has(key)) map.set(key, { ...e, count: 0 });
      map.get(key).count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [allEx]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="이번 주 세션" value={`${thisWeekTotal.sessions}회`} />
        <SummaryTile label="이번 주 운동 시간" value={`${thisWeekTotal.minutes}분`} />
      </div>

      {favorites.length > 0 && (
        <div className="card !p-3">
          <div className="text-xs font-semibold text-ink-500 mb-2">
            ⚡ 자주 한 운동 — 한 번 클릭으로 오늘 기록
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {favorites.map((f, i) => (
              <button key={i} onClick={() => quickRepeat(f)}
                      className="flex-shrink-0 px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 transition text-left">
                <div className="font-semibold text-sm text-brand-700">
                  {EXERCISE_BY_ID[f.type]?.label}
                </div>
                <div className="text-xs text-brand-600">
                  {f.durationMin}분 · 강도 {f.intensity}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">날짜</div>
            <input type="date" className="input" max={todayISO()}
                   value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">시간 (분)</div>
            <input type="number" inputMode="numeric" min={1} max={600} step="5"
                   className="input" value={durationMin}
                   onChange={e => setDurationMin(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="label">종류</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {EXERCISE_TYPES.map(o => (
              <button key={o.id} type="button" onClick={() => setType(o.id)}
                      className={`px-2 py-2 rounded-xl text-xs font-medium border transition
                                  ${type === o.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white text-ink-700 border-ink-300 hover:border-brand-400'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <Scale label="강도" value={intensity} onChange={setIntensity}
               minLabel="가벼움" maxLabel="격렬함" />

        <div>
          <div className="label">메모 (선택)</div>
          <input type="text" className="input" maxLength={100}
                 value={notes} onChange={e => setNotes(e.target.value)}
                 placeholder="예: 한강 산책, 5km, 무릎 통증 없음" />
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={!durationMin} className="btn-primary">운동 기록 저장</button>
        </div>
      </div>

      <RecentList
        items={allEx.slice().reverse().slice(0, 10)}
        empty="아직 운동 기록이 없습니다."
        render={(e) => (
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{EXERCISE_BY_ID[e.type]?.label || e.type}</span>
                <span className="text-xs text-ink-500">{e.durationMin}분 · 강도 {e.intensity}/5</span>
              </div>
              <div className="text-xs text-ink-500 mt-0.5">
                {e.date}{e.notes && ` · ${e.notes}`}
              </div>
            </div>
            <button onClick={() => { Storage.deleteExercise(e.id); refresh(); }}
                    className="text-xs text-rose-600 hover:underline">삭제</button>
          </div>
        )}
      />
    </div>
  );
}

/* ============================================================
   식단 탭
============================================================ */
function DietTab({ user, version, refresh }) {
  const toast = useToast();
  const allDiets = useMemo(() => Storage.getDietsByUser(user.id), [user.id, version]);
  const allDoses = useMemo(() => Storage.getDosesByUser(user.id), [user.id, version]);
  // 마지막 투약 시점 → "오늘 기록 시" 자동 컨텍스트
  const lastDose = allDoses[allDoses.length - 1];
  const daysSinceLastDose = lastDose
    ? Math.floor((Date.now() - new Date(lastDose.date).getTime()) / 86400000)
    : null;
  const phaseLabel = daysSinceLastDose == null
    ? null
    : daysSinceLastDose <= 2 ? `💉 투약 직후 (${daysSinceLastDose}일째)`
    : daysSinceLastDose <= 6 ? `🕓 투약 중간 (${daysSinceLastDose}일째)`
    : `🌿 다음 투약 직전 (${daysSinceLastDose}일째)`;

  const [date, setDate] = useState(todayISO());
  const [mealType, setMealType] = useState('lunch');
  const [description, setDescription] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [estCalories, setEstCalories] = useState('');
  const [pattern, setPattern] = useState('');

  const submit = () => {
    if (!description.trim()) return;
    const savedDesc = description.trim();
    Storage.addDiet({
      id: uid('diet'),
      userId: user.id,
      seed: false,
      date,
      mealType,
      description: savedDesc,
      proteinG: +proteinG || null,
      estCalories: +estCalories || null,
      pattern: pattern || null,
      createdAt: new Date().toISOString(),
    });
    setDescription('');
    setProteinG('');
    setEstCalories('');
    refresh();
    toast.success(`${MEAL_BY_ID[mealType]?.label} '${savedDesc.slice(0, 20)}' 기록됨`);
  };

  const quickAdd = (item) => {
    Storage.addDiet({
      id: uid('diet'),
      userId: user.id,
      seed: false,
      date: todayISO(),
      mealType: item.mealType,
      description: item.description,
      proteinG: item.proteinG || null,
      estCalories: item.estCalories || null,
      pattern: item.pattern || null,
      createdAt: new Date().toISOString(),
    });
    refresh();
    toast.success(`${MEAL_BY_ID[item.mealType]?.label} '${item.description.slice(0, 20)}' 추가됨`);
  };

  // 자주 먹는 메뉴 Top 5 (최근 60일)
  const favorites = useMemo(() => {
    const sixtyAgo = new Date();
    sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const start = sixtyAgo.toISOString().slice(0, 10);
    const recent = allDiets.filter(d => d.date >= start);
    const map = new Map();
    for (const d of recent) {
      const key = `${d.mealType}|${d.description}`;
      if (!map.has(key)) map.set(key, { ...d, count: 0 });
      map.get(key).count++;
    }
    return [...map.values()].filter(x => x.count >= 1).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allDiets]);

  return (
    <div className="space-y-4">
      {favorites.length > 0 && (
        <div className="card !p-3">
          <div className="text-xs font-semibold text-ink-500 mb-2">
            ⚡ 자주 먹는 메뉴 — 클릭으로 오늘 추가
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {favorites.map((f, i) => (
              <button key={i} onClick={() => quickAdd(f)}
                      className="flex-shrink-0 max-w-[220px] px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 transition text-left">
                <div className="text-xs text-brand-600">
                  {MEAL_BY_ID[f.mealType]?.label}{f.count > 1 && ` · ${f.count}회`}
                </div>
                <div className="font-semibold text-sm text-brand-700 truncate">
                  {f.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        {phaseLabel && (
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
            {phaseLabel} — 식이 패턴이 시간에 따라 어떻게 다른지 자동으로 분석돼요
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">날짜</div>
            <input type="date" className="input" max={todayISO()}
                   value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">식사</div>
            <div className="flex gap-1.5">
              {MEAL_TYPES.map(o => (
                <button key={o.id} type="button" onClick={() => setMealType(o.id)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition
                                    ${mealType === o.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="label">메뉴 / 메모</div>
          <textarea className="input min-h-[60px] resize-none" maxLength={200}
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="예: 닭가슴살 샐러드 + 그릭요거트" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">단백질 (g, 선택)</div>
            <input type="number" inputMode="numeric" className="input"
                   value={proteinG} onChange={e => setProteinG(e.target.value)}
                   placeholder="예: 25" />
          </div>
          <div>
            <div className="label">추정 칼로리 (선택)</div>
            <input type="number" inputMode="numeric" className="input"
                   value={estCalories} onChange={e => setEstCalories(e.target.value)}
                   placeholder="예: 400" />
          </div>
        </div>

        <div>
          <div className="label">식이 패턴 (선택)</div>
          <div className="flex gap-1.5 flex-wrap">
            {DIET_PATTERNS.map(o => (
              <button key={o.id} type="button"
                      onClick={() => setPattern(p => p === o.id ? '' : o.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                                  ${pattern === o.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white text-ink-700 border-ink-300'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={!description.trim()} className="btn-primary">식단 저장</button>
        </div>
      </div>

      <RecentList
        items={allDiets.slice().reverse().slice(0, 10)}
        empty="아직 식단 기록이 없습니다."
        render={(d) => (
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="chip">{MEAL_BY_ID[d.mealType]?.label || d.mealType}</span>
                <span className="text-xs text-ink-500">{d.date}</span>
              </div>
              <div className="font-medium text-sm text-ink-900 mt-0.5 truncate">{d.description}</div>
              <div className="text-xs text-ink-500 mt-0.5">
                {d.proteinG ? `단백질 ${d.proteinG}g` : ''}
                {d.estCalories ? ` · ${d.estCalories}kcal` : ''}
              </div>
            </div>
            <button onClick={() => { Storage.deleteDiet(d.id); refresh(); }}
                    className="text-xs text-rose-600 hover:underline">삭제</button>
          </div>
        )}
      />
    </div>
  );
}

/* ============================================================
   shared
============================================================ */
function Scale({ label, value, onChange, minLabel, maxLabel }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition
                              ${value === n
                                ? 'bg-brand-500 text-white'
                                : 'bg-ink-100 text-ink-700 hover:bg-ink-300/60'}`}>{n}</button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-ink-500 mt-1">
        <span>1 {minLabel}</span><span>5 {maxLabel}</span>
      </div>
    </div>
  );
}

function RecentList({ items, empty, render }) {
  if (!items.length) {
    return <div className="card text-center py-6 text-sm text-ink-500">{empty}</div>;
  }
  return (
    <div className="card !p-0">
      <div className="text-xs font-semibold text-ink-500 px-4 py-2 border-b border-ink-100">최근 기록</div>
      <ul className="divide-y divide-ink-100">
        {items.map(item => (
          <li key={item.id} className="px-4 py-3">{render(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="card !p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-2xl font-extrabold text-ink-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
