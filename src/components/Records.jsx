import React, { useMemo, useState, useEffect } from 'react';
import { Storage, uid } from '../lib/storage.js';
import {
  SIDE_EFFECTS, EXERCISE_TYPES, EXERCISE_BY_ID, MEAL_TYPES, MEAL_BY_ID,
  DIET_PATTERNS, MED_BY_ID, REGION_SUGGESTIONS, estimateExerciseCalories,
} from '../lib/constants.js';
import { RedFlagBanner } from './SafetyBanner.jsx';
import { useToast } from './Toast.jsx';
import { DietHierarchyPicker } from './DietHierarchyPicker.jsx';
import { DialInput } from './DialInput.jsx';
import { WeightCurveInput } from './WeightCurveInput.jsx';
import { WeightChartInline } from './WeightChartInline.jsx';
import { HealthMetricsForm } from './HealthMetricsForm.jsx';
import { QuickDateInput } from './QuickDateInput.jsx';
// MotivationBanner 제거 — 감성 카피, 비즈니스 핵심 X

const todayISO = () => new Date().toISOString().slice(0, 10);

const TABS = [
  { id: 'weight',   label: '체중·증상', icon: '⚖️' },
  { id: 'dose',     label: '투약',     icon: '💊' },
  { id: 'exercise', label: '운동',     icon: '🏃' },
  { id: 'diet',     label: '식단',     icon: '🍽️' },
  { id: 'health',   label: '건강 지표', icon: '🩺' },
];

export function Records({ user, navigate, initialTab = 'weight' }) {
  const [tab, setTab] = useState(initialTab);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900 dark:text-slate-100">기록</h1>
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
      {tab === 'health'   && <HealthMetricsForm user={user} version={version} refresh={refresh} />}
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
  // exactMs: 그래프 클릭한 raw fractional ms — marker 위치 정확 동기화용. round 안 됨.
  const [exactMs, setExactMs] = useState(null);
  const [weight, setWeight] = useState(String(defaultWeight));
  const [appetiteChange, setAppetiteChange] = useState(3);
  const [satiety, setSatiety] = useState(3);
  const [mealReduction, setMealReduction] = useState(3);
  const [sideEffects, setSideEffects] = useState({});
  const [notes, setNotes] = useState('');
  // 부담 줄이기 — 체중만 핵심, 나머지는 펼쳐서 입력
  const [showDetail, setShowDetail] = useState(false);
  const [showCurve, setShowCurve] = useState(false);

  const toggleSide = (id) => setSideEffects(s => ({ ...s, [id]: !s[id] }));
  const totalSideCount = Object.values(sideEffects).filter(Boolean).length;

  const submit = () => {
    if (!weight || +weight < 30 || +weight > 250) return;
    // 같은 날짜 기록이 이미 있으면 덮어쓰기 (중복 row 누적 방지)
    const existing = allLogs.find(l => l.date === date);
    if (existing) {
      Storage.updateLog({ ...existing, weight: +weight, appetiteChange, satiety, mealReduction, sideEffects, notes: notes.trim() });
    } else {
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
    }
    const delta = lastLog ? +weight - lastLog.weight : 0;
    setSideEffects({});
    setNotes('');
    setShowDetail(false);
    refresh();
    toast.success(`체중 ${(+weight).toFixed(1)} kg ${existing ? '수정됨' : '기록됨'}${!existing && lastLog ? ` · 지난 기록 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg` : ''}`);
  };

  // 최근 기록 리스트에서 항목 수정 — 폼에 값 로드 후 맨 위로
  const editLog = (log) => {
    setDate(log.date);
    setExactMs(null);
    setWeight(String(log.weight));
    setSideEffects(log.sideEffects || {});
    setAppetiteChange(log.appetiteChange ?? 3);
    setSatiety(log.satiety ?? 3);
    setMealReduction(log.mealReduction ?? 3);
    setNotes(log.notes || '');
    if (Object.values(log.sideEffects || {}).some(Boolean) || log.notes) setShowDetail(true);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    toast.info(`${log.date} 기록을 불러왔어요 — 수정 후 저장하면 덮어써집니다`);
  };

  const deleteLog = (log) => {
    if (!window.confirm(`${log.date} · ${log.weight}kg 기록을 삭제할까요?`)) return;
    Storage.deleteLog(log.id);
    refresh();
    toast.success('기록을 삭제했어요');
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        {/* 날짜 + 저장 */}
        <div>
          <div className="label">날짜</div>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 min-w-0">
              <QuickDateInput value={date} max={todayISO()}
                              onChange={(d) => { setDate(d); setExactMs(null); }} />
            </div>
            <button onClick={submit} disabled={!weight} className="btn-primary !py-2.5 !px-4 self-stretch">저장</button>
          </div>
        </div>

        {/* 다이얼 메인 — 체중 입력 핵심 UI */}
        <div className="rounded-xl border-2 border-brand-200 dark:border-brand-800/40 p-3 bg-brand-50/30 dark:bg-brand-900/10">
          <DialInput label="체중" unit="kg"
                     value={+weight || defaultWeight}
                     onChange={(v) => setWeight(String(v))}
                     min={30} max={250} step={0.1} majorTick={1} highlight />
        </div>

        {/* inline 그래프 — 항상 표시, 다이얼과 양방향 sync */}
        <WeightChartInline user={user}
                           currentWeight={weight}
                           currentDate={date}
                           currentDateMs={exactMs}
                           refreshKey={version}
                           onWeightChange={({ date: d, weight: w, exactMs: ms, savedCount }) => {
                             setDate(d);
                             setWeight(String(w));
                             if (ms != null) setExactMs(ms);
                             if (savedCount) {
                               refresh();
                               toast.success(`${savedCount}개 체중 기록 저장됨 (곡선 입력)`);
                             }
                           }}
                           onDoseAdded={({ date: d, dose, medication, direction }) => {
                             refresh();
                             const dirLabel = direction > 0 ? '증량' : direction < 0 ? '감량' : '';
                             toast.success(`${medication} ${dose}${dirLabel ? ` (${dirLabel})` : ''} · ${d} 처방 추가됨`);
                           }} />
        {lastLog && +weight && +weight !== lastLog.weight && (
          <p className="helptext !mt-1">지난 기록 대비 {(+weight - lastLog.weight) >= 0 ? '+' : ''}{(+weight - lastLog.weight).toFixed(1)} kg</p>
        )}

        {/* 펼치기 토글 — 부작용/식욕/메모 (선택) */}
        <button type="button" onClick={() => setShowDetail(s => !s)}
                className="w-full mt-2 py-2 rounded-lg text-xs font-medium text-ink-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-400 border border-dashed border-ink-200 dark:border-slate-700 hover:border-brand-300 transition">
          {showDetail ? '− 상세 접기' : `+ 부작용·식욕·메모 추가하기 (선택)${totalSideCount > 0 ? ` · 부작용 ${totalSideCount}개 선택됨` : ''}`}
        </button>

        {showDetail && (
          <div className="space-y-4 pt-3 border-t border-ink-100 dark:border-slate-800">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Scale label="식욕 변화" value={appetiteChange} onChange={setAppetiteChange}
                     minLabel="평소" maxLabel="크게 감소" />
              <Scale label="포만감" value={satiety} onChange={setSatiety}
                     minLabel="평소" maxLabel="금방 배부름" />
              <Scale label="식사량 감소" value={mealReduction} onChange={setMealReduction}
                     minLabel="평소" maxLabel="크게 감소" />
            </div>

            <div>
              <div className="label">메모</div>
              <textarea className="input min-h-[60px] resize-none" maxLength={300}
                        value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="이번 주 컨디션·특이사항" />
            </div>
          </div>
        )}
      </div>

      {totalSideCount >= 3 && <RedFlagBanner />}

      {/* 체중 곡선 그리기 모달 */}
      {showCurve && (
        <WeightCurveInput
          user={user}
          onClose={() => setShowCurve(false)}
          onSaved={(n) => { refresh(); toast.success(`${n}개 체중 기록 저장됨`); }}
        />
      )}

      <RecentWeightList logs={allLogs} onEdit={editLog} onDelete={deleteLog} />
    </div>
  );
}

/* 최근 체중 기록 — 수정/삭제 가능 (CRUD의 R/U/D 보강. UX 감사 최우선 발견) */
function RecentWeightList({ logs, onEdit, onDelete }) {
  // 최신순 7개
  const recent = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7);
  if (recent.length === 0) {
    return (
      <div className="card !py-4 text-center text-sm text-ink-500 dark:text-slate-400">
        아직 체중 기록이 없어요. 위에서 첫 기록을 저장해 보세요.
      </div>
    );
  }
  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-ink-900 dark:text-slate-100">최근 기록</h3>
        <span className="text-xs text-ink-400 dark:text-slate-500">총 {logs.length}회 · 탭하여 수정</span>
      </div>
      <div className="divide-y divide-ink-100 dark:divide-slate-800">
        {recent.map((log, i) => {
          const prev = recent[i + 1];
          const delta = prev ? log.weight - prev.weight : null;
          const sides = Object.values(log.sideEffects || {}).filter(Boolean).length;
          return (
            <div key={log.id} className="flex items-center gap-2 py-2.5">
              <button onClick={() => onEdit(log)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-ink-100/50 dark:hover:bg-slate-800/50 transition">
                <span className="text-xs text-ink-500 dark:text-slate-400 tabular-nums w-16 flex-shrink-0">{log.date?.slice(5)}</span>
                <span className="font-bold text-ink-900 dark:text-slate-100 tabular-nums">{log.weight}<span className="text-xs font-normal text-ink-400 ml-0.5">kg</span></span>
                {delta != null && delta !== 0 && (
                  <span className={`text-xs tabular-nums ${delta < 0 ? 'text-brand-600 dark:text-brand-400' : 'text-rose-500'}`}>
                    {delta < 0 ? '−' : '+'}{Math.abs(delta).toFixed(1)}
                  </span>
                )}
                {sides > 0 && <span className="text-[10px] text-rose-500">부작용 {sides}</span>}
              </button>
              <button onClick={() => onDelete(log)}
                      aria-label="삭제"
                      className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg text-ink-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition">
                🗑
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   투약 탭 — 새로운 UX:
   - 코스 개념 숨김 (자동 처리)
   - 첫 투약: 약/용량/가격/지역 선택만
   - 이후 투약: 같은 약/용량으로 자동 채움 + "오늘/+7일/직접" 빠른 날짜 칩
   - 위고비/마운자로 = 주 1회 이상 간격, 삭센다 = 매일 가능 (간격 제약)
============================================================ */
function DoseTab({ user, version, refresh, navigate }) {
  const toast = useToast();
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id, version]);
  const allDoses = useMemo(() => Storage.getDosesByUser(user.id), [user.id, version]);
  const activeCourses = courses.filter(c => !c.endDate);

  // 가장 최근 투약 (사용자가 마지막으로 쓴 약)
  const lastDose = allDoses[allDoses.length - 1];
  const lastDoseCourse = lastDose ? courses.find(c => c.id === lastDose.courseId) : null;
  const lastMedId = lastDoseCourse?.medication;
  const lastMed = lastMedId ? MED_BY_ID[lastMedId] : null;

  // 같은 약으로 이어 투약 (자동 채움) — useState 위에서 미리 계산
  const med = lastMed || MED_BY_ID[activeCourses[0]?.medication] || MED_BY_ID.wegovy;
  const medId = lastMedId || activeCourses[0]?.medication || 'wegovy';

  const minIntervalDays = med?.frequency === '매일' ? 1 : 7;
  const lastDoseMs = lastDose ? new Date(lastDose.date).getTime() : null;
  const earliestNextMs = lastDoseMs ? lastDoseMs + minIntervalDays * 86400000 : Date.now();
  const earliestNextDate = new Date(earliestNextMs).toISOString().slice(0, 10);
  const todayDate = todayISO();
  const recommendedDate = todayDate >= earliestNextDate ? todayDate : earliestNextDate;

  // 모든 hooks는 early return 위에 (React Hooks 규칙)
  const [date, setDate] = useState(recommendedDate);
  const [dose, setDose] = useState(lastDose?.dose || med?.doses[0] || '');
  const [price, setPrice] = useState(lastDose?.price ?? '');
  const [region, setRegion] = useState(lastDose?.region ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [switchMed, setSwitchMed] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState(medId);

  // 첫 사용자 — 약 선택 화면 표시 (모든 hooks 호출 후)
  if (!lastDose && activeCourses.length === 0) {
    return <FirstDosePicker user={user} refresh={refresh} toast={toast} navigate={navigate} />;
  }

  const courseForLog = activeCourses.find(c => c.medication === medId) || activeCourses[0] || lastDoseCourse;

  // 약 변경 시 default 갱신
  const activeMed = MED_BY_ID[selectedMedId] || med;
  const isIntervalShort = lastDoseMs && date < earliestNextDate;

  const submit = () => {
    if (!dose) return;
    if (isIntervalShort && selectedMedId === medId) {
      toast.error(`${activeMed.label}은 최소 ${minIntervalDays}일 간격이 필요합니다 (${earliestNextDate} 이후)`);
      return;
    }
    // 약 변경 시: 새 코스 자동 생성
    let targetCourseId = courseForLog?.id;
    if (selectedMedId !== medId || !targetCourseId) {
      const newCourse = {
        id: uid('mc'),
        userId: user.id,
        seed: false,
        medication: selectedMedId,
        startDate: date,
        endDate: null,
        initialDose: dose,
        notes: '',
        discontinueReason: null,
        createdAt: new Date().toISOString(),
      };
      Storage.addMedCourse(newCourse);
      targetCourseId = newCourse.id;
    }
    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId: targetCourseId,
      seed: false,
      date,
      dose,
      price: +price || null,
      region: region.trim() || null,
      pharmacyName: null,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    refresh();
    toast.success(`${activeMed.label.replace(/\s*\(.+\)/, '')} ${dose} · ${date} 기록됨`);
  };

  // 빠른 날짜 칩 옵션
  const dateChips = [];
  if (todayDate >= earliestNextDate) {
    dateChips.push({ label: '오늘', value: todayDate });
  }
  dateChips.push({ label: lastDoseMs ? `+${minIntervalDays}일 (예정일)` : '추천일', value: earliestNextDate });
  if (minIntervalDays === 7) {
    dateChips.push({ label: '+8일', value: new Date(earliestNextMs + 86400000).toISOString().slice(0, 10) });
    dateChips.push({ label: '+10일', value: new Date(earliestNextMs + 3 * 86400000).toISOString().slice(0, 10) });
  }

  return (
    <div className="space-y-4">
      {lastDose && !switchMed && (
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-ink-700 dark:text-slate-300">
              지난 투약 <b>{lastMed?.label.replace(/\s*\(.+\)/, '')} {lastDose.dose}</b> · {lastDose.date}
              {lastDose.price > 0 && <> · {lastDose.price.toLocaleString()}원</>}
            </div>
            <button onClick={() => setSwitchMed(true)}
                    className="text-xs text-brand-700 dark:text-brand-400 underline">
              다른 약으로 변경
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        {/* 약 선택 (변경 시에만) */}
        {switchMed && (
          <div>
            <div className="label">약</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.keys(MED_PROFILE_DOSES).map(id => (
                <button key={id} type="button"
                        onClick={() => {
                          setSelectedMedId(id);
                          setDose(MED_BY_ID[id].doses[0]);
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition
                                    ${selectedMedId === id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {MED_BY_ID[id]?.label.replace(/\s*\(.+\)/, '')}
                </button>
              ))}
            </div>
            <button onClick={() => { setSwitchMed(false); setSelectedMedId(medId); }}
                    className="text-xs text-ink-500 dark:text-slate-500 underline mt-2">
              이전 약 그대로
            </button>
          </div>
        )}

        {/* 빠른 날짜 칩 + 직접 입력 */}
        <div>
          <div className="label flex items-center justify-between">
            <span>투약일</span>
            {minIntervalDays > 1 && (
              <span className="text-[10px] text-ink-500 dark:text-slate-500 font-normal">
                {activeMed?.label.replace(/\s*\(.+\)/, '')} 최소 {minIntervalDays}일 간격
              </span>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {dateChips.map((c, i) => (
              <button key={i} type="button" onClick={() => setDate(c.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition
                                  ${date === c.value
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
                {c.label}
              </button>
            ))}
            <input type="date" className="input !w-auto !py-1.5 !px-2 text-xs"
                   max={todayISO()}
                   value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {isIntervalShort && selectedMedId === medId && (
            <div className="text-xs text-rose-600 dark:text-rose-400">
              ⚠ 이전 투약({lastDose.date})으로부터 {minIntervalDays}일이 지나지 않았어요. {earliestNextDate} 이후로 선택.
            </div>
          )}
        </div>

        {/* 용량 — 항상 큰 버튼 */}
        <div>
          <div className="label">용량 — {activeMed?.label.replace(/\s*\(.+\)/, '')}</div>
          <div className="flex gap-1.5 flex-wrap">
            {activeMed?.doses.map(d => (
              <button key={d} type="button" onClick={() => setDose(d)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition
                                  ${dose === d
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
                {d}
              </button>
            ))}
          </div>
          {lastDose?.dose === dose && (
            <p className="helptext">↩ 지난번과 같은 용량</p>
          )}
        </div>

        {/* 가격·지역 (접힘) */}
        <div>
          <button type="button" onClick={() => setShowAdvanced(s => !s)}
                  className="text-xs text-brand-700 dark:text-brand-400 underline">
            {showAdvanced ? '가격/지역 숨기기' : '+ 가격·지역 입력 (선택)'}
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="label">가격 (원)</div>
                <input type="number" inputMode="numeric" className="input"
                       value={price} onChange={e => setPrice(e.target.value)}
                       placeholder="예: 380000" />
              </div>
              <div>
                <div className="label">지역</div>
                <input type="text" className="input" list="dose-region-suggestions" maxLength={30}
                       value={region} onChange={e => setRegion(e.target.value)}
                       placeholder="예: 서울 대학로" />
                <datalist id="dose-region-suggestions">
                  {REGION_SUGGESTIONS.map(r => <option key={r} value={r} />)}
                </datalist>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={!dose || (isIntervalShort && selectedMedId === medId)}
                  className="btn-primary !py-3 !px-6 text-base">
            ✓ 투약 기록
          </button>
        </div>
      </div>

      <RecentStat count={allDoses.length} label="투약 기록" lastDate={lastDose?.date} />
    </div>
  );
}

// 첫 투약 시: 약 선택 + 시작
const MED_PROFILE_DOSES = {
  wegovy: true, mounjaro: true, saxenda: true, ozempic: true, zepbound: true,
};

function FirstDosePicker({ user, refresh, toast, navigate }) {
  const [picked, setPicked] = useState(null);
  if (!picked) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-3">💊</div>
        <div className="font-bold text-ink-900 dark:text-slate-100 text-lg mb-1">어떤 약을 시작하셨나요?</div>
        <div className="text-sm text-ink-500 dark:text-slate-400 mb-5">선택 후 첫 투약을 기록해요</div>
        <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
          {Object.keys(MED_PROFILE_DOSES).map(id => {
            const m = MED_BY_ID[id];
            return (
              <button key={id} onClick={() => setPicked(id)}
                      className="px-4 py-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-ink-300 dark:border-slate-700 hover:border-brand-400 transition">
                <div className="font-bold text-ink-900 dark:text-slate-100">{m.label.replace(/\s*\(.+\)/, '')}</div>
                <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{m.frequency}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // 약 선택 후 — 첫 투약 폼
  return <FirstDoseForm user={user} medId={picked} onCancel={() => setPicked(null)}
                         navigate={navigate}
                         onSaved={() => { refresh(); toast.success('첫 투약 기록 완료'); }} />;
}

function FirstDoseForm({ user, medId, onCancel, onSaved, navigate }) {
  const med = MED_BY_ID[medId];
  const [date, setDate] = useState(todayISO());
  const [dose, setDose] = useState(med.doses[0]);
  const [price, setPrice] = useState('');
  const [region, setRegion] = useState('');

  const submit = () => {
    if (!dose) return;
    const courseId = uid('mc');
    Storage.addMedCourse({
      id: courseId, userId: user.id, seed: false,
      medication: medId, startDate: date, endDate: null,
      initialDose: dose, notes: '',
      discontinueReason: null, createdAt: new Date().toISOString(),
    });
    Storage.addDose({
      id: uid('dose'), userId: user.id, courseId, seed: false,
      date, dose,
      price: +price || null, region: region.trim() || null,
      pharmacyName: null, notes: '',
      createdAt: new Date().toISOString(),
    });
    // 첫 약 시작자에게 첫 한 달 가이드 제안
    if (navigate && confirm('첫 투약 기록 완료! 🎉\n\n첫 한 달 가이드를 확인하시겠어요? (주차별 무엇이 일어나고 어떻게 대처하는지)')) {
      navigate('guide/first-month');
      return;
    }
    onSaved();
  };

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <div className="font-bold text-ink-900 dark:text-slate-100">
          {med.label.replace(/\s*\(.+\)/, '')} 첫 투약
        </div>
        <button onClick={onCancel} className="btn-ghost text-xs">← 약 다시 선택</button>
      </div>

      <div>
        <div className="label">시작일</div>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {[
            { label: '오늘', v: todayISO() },
            { label: '어제', v: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
            { label: '3일 전', v: new Date(Date.now() - 3*86400000).toISOString().slice(0, 10) },
            { label: '1주 전', v: new Date(Date.now() - 7*86400000).toISOString().slice(0, 10) },
          ].map(c => (
            <button key={c.label} type="button" onClick={() => setDate(c.v)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition
                                ${date === c.v
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
              {c.label}
            </button>
          ))}
          <input type="date" className="input !w-auto !py-1.5 !px-2 text-xs"
                 max={todayISO()}
                 value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="label">용량</div>
        <div className="flex gap-1.5 flex-wrap">
          {med.doses.map(d => (
            <button key={d} type="button" onClick={() => setDose(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition
                                ${dose === d
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
              {d}
            </button>
          ))}
        </div>
        <p className="helptext">처음엔 보통 가장 낮은 용량부터 시작합니다</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label">가격 (원, 선택)</div>
          <input type="number" inputMode="numeric" className="input"
                 value={price} onChange={e => setPrice(e.target.value)}
                 placeholder="예: 380000" />
        </div>
        <div>
          <div className="label">지역 (선택)</div>
          <input type="text" className="input" list="first-region-suggestions" maxLength={30}
                 value={region} onChange={e => setRegion(e.target.value)}
                 placeholder="예: 서울 대학로" />
          <datalist id="first-region-suggestions">
            {REGION_SUGGESTIONS.map(r => <option key={r} value={r} />)}
          </datalist>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={submit} disabled={!dose} className="btn-primary !py-3 !px-6 text-base">
          ✓ 첫 투약 기록
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   운동 탭
============================================================ */
function ExerciseTab({ user, version, refresh }) {
  const toast = useToast();
  const allEx = useMemo(() => Storage.getExercisesByUser(user.id), [user.id, version]);
  // 자동완성 — 마지막 운동의 type/duration/intensity로 prefill
  const lastEx = allEx[allEx.length - 1];
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState(lastEx?.type || 'walking');
  const [durationMin, setDurationMin] = useState(lastEx?.durationMin || 30);
  const [intensity, setIntensity] = useState(lastEx?.intensity || 3);
  const [notes, setNotes] = useState('');
  // type 변경 시 같은 type의 마지막 기록으로 duration/intensity 자동 갱신
  useEffect(() => {
    const sameType = allEx.filter(e => e.type === type);
    const last = sameType[sameType.length - 1];
    if (last) {
      setDurationMin(last.durationMin);
      setIntensity(last.intensity);
    }
  }, [type]);

  // 사용자 체중 — 최신 log 우선, 없으면 startWeight
  const allLogs = useMemo(() => Storage.getLogsByUser(user.id), [user.id, version]);
  const currentWeightKg = allLogs[allLogs.length - 1]?.weight || user.startWeight || 70;

  // 실시간 칼로리 추정
  const estKcal = useMemo(() => estimateExerciseCalories({
    type, durationMin: +durationMin, intensity, weightKg: currentWeightKg,
  }), [type, durationMin, intensity, currentWeightKg]);

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
      estKcal: estKcal || null,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
    setNotes('');
    refresh();
    toast.success(`${EXERCISE_BY_ID[type]?.label} ${durationMin}분 · ${estKcal || '?'} kcal 기록됨`);
  };

  const quickRepeat = (ex) => {
    const kcal = estimateExerciseCalories({
      type: ex.type, durationMin: ex.durationMin, intensity: ex.intensity, weightKg: currentWeightKg,
    });
    Storage.addExercise({
      id: uid('ex'),
      userId: user.id,
      seed: false,
      date: todayISO(),
      type: ex.type,
      durationMin: ex.durationMin,
      intensity: ex.intensity,
      estKcal: kcal || null,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    refresh();
    toast.success(`${EXERCISE_BY_ID[ex.type]?.label} ${ex.durationMin}분 · ${kcal || '?'} kcal 추가됨`);
  };

  // 이번 주 합계 — 세션·분·칼로리 (기록에 estKcal 없으면 즉석 계산)
  const thisWeekTotal = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const start = oneWeekAgo.toISOString().slice(0, 10);
    const week = allEx.filter(e => e.date >= start);
    const kcal = week.reduce((s, e) => {
      const k = e.estKcal ?? estimateExerciseCalories({
        type: e.type, durationMin: e.durationMin, intensity: e.intensity, weightKg: currentWeightKg,
      }) ?? 0;
      return s + k;
    }, 0);
    return {
      sessions: week.length,
      minutes: week.reduce((s, e) => s + (e.durationMin || 0), 0),
      kcal: Math.round(kcal),
    };
  }, [allEx, currentWeightKg]);

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
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="이번 주 세션" value={`${thisWeekTotal.sessions}회`} />
        <SummaryTile label="시간" value={`${thisWeekTotal.minutes}분`} />
        <SummaryTile label="소모 kcal" value={`${thisWeekTotal.kcal.toLocaleString()}`} />
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
            <div className="flex gap-1 mb-1.5 flex-wrap">
              {[15, 30, 45, 60, 90].map(m => (
                <button key={m} type="button" onClick={() => setDurationMin(m)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition
                                    ${+durationMin === m
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {m}분
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-ink-200 dark:border-slate-700 p-3">
              <DialInput value={+durationMin || 30} onChange={(v) => setDurationMin(String(v))}
                         min={1} max={300} step={5} unit="분" majorTick={30} highlight />
            </div>
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

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {estKcal != null && (
            <div className="text-sm">
              <span className="text-ink-500 dark:text-slate-400">예상 소모:</span>
              <span className="ml-1.5 font-bold text-brand-700 dark:text-brand-400 tabular-nums">~{estKcal} kcal</span>
              <span className="text-[10px] text-ink-500 dark:text-slate-500 ml-1.5">
                (체중 {currentWeightKg}kg 기준)
              </span>
            </div>
          )}
          <button onClick={submit} disabled={!durationMin} className="btn-primary ml-auto">운동 기록 저장</button>
        </div>
      </div>

      <RecentStat count={allEx.length} label="운동 세션" lastDate={allEx[allEx.length - 1]?.date} />
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

  // 자동완성 — 같은 mealType의 마지막 식단으로 pattern·proteinG·estCalories prefill
  const lastDiet = allDiets[allDiets.length - 1];
  const [date, setDate] = useState(todayISO());
  const [mealType, setMealType] = useState(lastDiet?.mealType || 'lunch');
  const [description, setDescription] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [estCalories, setEstCalories] = useState('');
  const [pattern, setPattern] = useState(lastDiet?.pattern || '');
  // mealType 바꿀 때 같은 mealType의 마지막 pattern prefill (단, 사용자가 메뉴를 입력하지 않았을 때만)
  useEffect(() => {
    if (description.trim()) return;
    const sameMeal = allDiets.filter(d => d.mealType === mealType);
    const last = sameMeal[sameMeal.length - 1];
    if (last) {
      setPattern(last.pattern || '');
    }
  }, [mealType]);

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
          <div className="label">메뉴 — 4단계 클릭으로 선택</div>
          <DietHierarchyPicker value={description}
                               onChange={(menu, nutri) => {
                                 setDescription(menu);
                                 if (nutri) {
                                   setProteinG(String(nutri.protein));
                                   setEstCalories(String(nutri.kcal));
                                 }
                               }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
            <DialInput label="단백질 (g)" unit="g"
                       value={+proteinG || 0}
                       onChange={(v) => setProteinG(String(v))}
                       min={0} max={150} step={1} majorTick={10} highlight />
          </div>
          <div className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
            <DialInput label="추정 칼로리" unit="kcal"
                       value={+estCalories || 0}
                       onChange={(v) => setEstCalories(String(v))}
                       min={0} max={2000} step={10} majorTick={100} />
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

      <RecentStat count={allDiets.length} label="식단 기록" lastDate={allDiets[allDiets.length - 1]?.date} />
    </div>
  );
}

/* ============================================================
   건강 지표 탭 — 인바디·혈액검사·혈압·음주 (덜 자주 입력, 가이드 페르소나 직접 연결)
============================================================ */
function HealthTab({ user, version, refresh, navigate }) {
  const toast = useToast();
  const allMetrics = useMemo(() => Storage.getHealthMetricsByUser(user.id), [user.id, version]);
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState('inbody');
  // 인바디
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [muscleKg, setMuscleKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  // 혈액검사
  const [alt, setAlt] = useState('');
  const [ast, setAst] = useState('');
  const [hba1c, setHba1c] = useState('');
  const [totalChol, setTotalChol] = useState('');
  // 혈압
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  // 음주
  const [alcoholDrinksPerWeek, setAlcoholDrinksPerWeek] = useState('');
  const [alcoholCravingChange, setAlcoholCravingChange] = useState(3);
  // 수면
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState(3);

  const CATEGORIES = [
    { id: 'inbody',   label: '인바디',     icon: '💪', desc: '체지방률·근육량·허리둘레' },
    { id: 'blood',    label: '혈액검사',   icon: '🩸', desc: 'ALT·AST·HbA1c·콜레스테롤' },
    { id: 'bp',       label: '혈압',       icon: '❤️', desc: '수축기·이완기' },
    { id: 'alcohol',  label: '음주',       icon: '🍺', desc: '주당 잔수·갈망 변화' },
    { id: 'sleep',    label: '수면·스트레스', icon: '😴', desc: '수면 시간·스트레스' },
  ];

  const submit = () => {
    let payload = null;
    if (category === 'inbody') {
      if (!bodyFatPct && !muscleKg && !waistCm) { toast.error('한 개 이상 입력해 주세요'); return; }
      payload = { bodyFatPct: +bodyFatPct || null, muscleKg: +muscleKg || null, waistCm: +waistCm || null };
    } else if (category === 'blood') {
      if (!alt && !ast && !hba1c && !totalChol) { toast.error('한 개 이상 입력해 주세요'); return; }
      payload = { alt: +alt || null, ast: +ast || null, hba1c: +hba1c || null, totalChol: +totalChol || null };
    } else if (category === 'bp') {
      if (!sbp || !dbp) { toast.error('수축기·이완기 모두 입력해 주세요'); return; }
      payload = { sbp: +sbp, dbp: +dbp };
    } else if (category === 'alcohol') {
      if (!alcoholDrinksPerWeek && alcoholCravingChange === 3) { toast.error('주당 잔수 또는 갈망 변화 입력'); return; }
      payload = { drinksPerWeek: +alcoholDrinksPerWeek || 0, cravingChange: alcoholCravingChange };
    } else if (category === 'sleep') {
      if (!sleepHours && stressLevel === 3) { toast.error('수면 시간 또는 스트레스 입력'); return; }
      payload = { sleepHours: +sleepHours || null, stressLevel };
    }
    Storage.addHealthMetric({
      id: uid('hm'),
      userId: user.id,
      seed: false,
      date,
      category,
      ...payload,
      createdAt: new Date().toISOString(),
    });
    // reset
    setBodyFatPct(''); setMuscleKg(''); setWaistCm('');
    setAlt(''); setAst(''); setHba1c(''); setTotalChol('');
    setSbp(''); setDbp('');
    setAlcoholDrinksPerWeek(''); setAlcoholCravingChange(3);
    setSleepHours(''); setStressLevel(3);
    refresh();
    toast.success(`${CATEGORIES.find(c => c.id === category).label} 기록됨`);
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <div className="label">날짜</div>
          <input type="date" className="input max-w-[180px]" value={date} max={todayISO()}
                 onChange={e => setDate(e.target.value)} />
        </div>

        <div>
          <div className="label">카테고리</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                      className={`px-2 py-2 rounded-xl text-xs font-medium border transition text-left
                                  ${category === c.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-300'}`}>
                <div className="text-base">{c.icon}</div>
                <div className="mt-0.5">{c.label}</div>
              </button>
            ))}
          </div>
          <p className="helptext !mt-2">{CATEGORIES.find(c => c.id === category)?.desc}</p>
        </div>

        {category === 'inbody' && (
          <div className="grid grid-cols-3 gap-3">
            <NumField label="체지방률" suffix="%" value={bodyFatPct} onChange={setBodyFatPct} placeholder="28.5" />
            <NumField label="근육량" suffix="kg" value={muscleKg} onChange={setMuscleKg} placeholder="42.0" />
            <NumField label="허리둘레" suffix="cm" value={waistCm} onChange={setWaistCm} placeholder="82" />
          </div>
        )}

        {category === 'blood' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="ALT" suffix="U/L" value={alt} onChange={setAlt} placeholder="25" />
            <NumField label="AST" suffix="U/L" value={ast} onChange={setAst} placeholder="22" />
            <NumField label="HbA1c" suffix="%" value={hba1c} onChange={setHba1c} placeholder="5.7" />
            <NumField label="총콜레스테롤" suffix="mg/dL" value={totalChol} onChange={setTotalChol} placeholder="180" />
          </div>
        )}

        {category === 'bp' && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="수축기" suffix="mmHg" value={sbp} onChange={setSbp} placeholder="120" />
            <NumField label="이완기" suffix="mmHg" value={dbp} onChange={setDbp} placeholder="80" />
          </div>
        )}

        {category === 'alcohol' && (
          <div className="space-y-3">
            <NumField label="주당 음주 잔수 (소주 기준)" suffix="잔" value={alcoholDrinksPerWeek}
                      onChange={setAlcoholDrinksPerWeek} placeholder="7" />
            <Scale label="알코올 갈망 변화 (약 시작 전 대비)" value={alcoholCravingChange}
                   onChange={setAlcoholCravingChange} minLabel="크게 감소" maxLabel="평소" />
            <button onClick={() => navigate('guide/alcohol')}
                    className="w-full text-xs text-brand-700 dark:text-brand-400 hover:underline py-1">
              → GLP-1과 알코올 사용장애 가이드 보기
            </button>
          </div>
        )}

        {category === 'sleep' && (
          <div className="space-y-3">
            <NumField label="수면 시간" suffix="시간" value={sleepHours} onChange={setSleepHours} placeholder="7.5" />
            <Scale label="스트레스" value={stressLevel} onChange={setStressLevel}
                   minLabel="없음" maxLabel="매우 심함" />
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={submit} className="btn-primary">기록 저장</button>
        </div>
      </div>

      <div className="rounded-xl bg-brand-50/60 dark:bg-brand-900/20 border border-brand-200/50 dark:border-brand-800/40 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">🤖</span>
          <p className="text-xs text-ink-700 dark:text-slate-300 leading-relaxed">
            <b>건강 지표를 추가할수록 AI 예측이 더 정밀해져요.</b> 인바디는 마른비만/근손실, 혈액검사는 지방간, 음주는 알코올 갈망 패턴 분석에 직접 활용됩니다.
          </p>
        </div>
      </div>

      <RecentList
        items={allMetrics.slice().reverse().slice(0, 15)}
        empty="아직 건강 지표 기록이 없습니다."
        render={(m) => {
          const cat = CATEGORIES.find(c => c.id === m.category);
          const parts = [];
          if (m.category === 'inbody') {
            if (m.bodyFatPct) parts.push(`체지방 ${m.bodyFatPct}%`);
            if (m.muscleKg) parts.push(`근육 ${m.muscleKg}kg`);
            if (m.waistCm) parts.push(`허리 ${m.waistCm}cm`);
          } else if (m.category === 'blood') {
            if (m.alt) parts.push(`ALT ${m.alt}`);
            if (m.ast) parts.push(`AST ${m.ast}`);
            if (m.hba1c) parts.push(`HbA1c ${m.hba1c}%`);
            if (m.totalChol) parts.push(`콜레스테롤 ${m.totalChol}`);
          } else if (m.category === 'bp') {
            parts.push(`${m.sbp}/${m.dbp} mmHg`);
          } else if (m.category === 'alcohol') {
            if (m.drinksPerWeek) parts.push(`주 ${m.drinksPerWeek}잔`);
            if (m.cravingChange != null) parts.push(`갈망 ${m.cravingChange}/5`);
          } else if (m.category === 'sleep') {
            if (m.sleepHours) parts.push(`수면 ${m.sleepHours}시간`);
            if (m.stressLevel != null) parts.push(`스트레스 ${m.stressLevel}/5`);
          }
          return (
            <div className="flex justify-between items-center gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-base">{cat?.icon}</span>
                <div>
                  <div className="font-semibold text-sm text-ink-900 dark:text-slate-100">
                    {cat?.label} <span className="text-xs text-ink-500 dark:text-slate-500 ml-1">{m.date}</span>
                  </div>
                  <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">{parts.join(' · ')}</div>
                </div>
              </div>
              <button onClick={() => { Storage.deleteHealthMetric(m.id); refresh(); }}
                      className="text-xs text-rose-600 hover:underline">삭제</button>
            </div>
          );
        }}
      />
    </div>
  );
}

function NumField({ label, suffix, value, onChange, placeholder }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="relative">
        <input type="number" inputMode="decimal" step="0.1"
               className="input pr-12" value={value}
               onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500 dark:text-slate-500 pointer-events-none">{suffix}</span>}
      </div>
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

// 컴팩트 통계 — 저장된 기록 수만 한 줄로 표시 (전체 목록은 통계/대시보드에서 확인)
function RecentStat({ count, label, lastDate }) {
  if (!count) return null;
  return (
    <div className="rounded-xl bg-ink-100/50 dark:bg-slate-800/40 px-3 py-2 text-xs text-ink-500 dark:text-slate-400 flex items-center justify-between">
      <span>총 <b className="text-ink-700 dark:text-slate-200 tabular-nums">{count}</b>개 {label}</span>
      {lastDate && <span>마지막: {lastDate}</span>}
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
