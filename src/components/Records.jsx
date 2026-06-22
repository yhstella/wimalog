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
  // deep-link 탭 힌트 — EmptyDashboard/PurposeCard 등이 sessionStorage로 지정 (라우터가 ?query 미지원이라)
  const [tab, setTab] = useState(() => {
    try {
      const hint = sessionStorage.getItem('wimalog_records_tab');
      if (hint && TABS.some(t => t.id === hint)) { sessionStorage.removeItem('wimalog_records_tab'); return hint; }
    } catch {}
    return initialTab;
  });
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
                          className={`px-3 min-h-[44px] inline-flex items-center rounded-xl text-sm border transition text-left
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

/* 최근 기록 리스트 (투약/운동/식단 공용) — 탭하여 수정, 🗑 삭제(44px).
   RecentWeightList와 동일한 인터랙션. renderRow는 한 행의 본문을 그림. */
function RecentEntryList({ title, items, totalCount, onEdit, onDelete, renderRow, emptyText, editingId }) {
  if (!items.length) {
    return (
      <div className="card !py-4 text-center text-sm text-ink-500 dark:text-slate-400">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-ink-900 dark:text-slate-100">{title}</h3>
        <span className="text-xs text-ink-400 dark:text-slate-500">총 {totalCount}회 · 탭하여 수정</span>
      </div>
      <div className="divide-y divide-ink-100 dark:divide-slate-800">
        {items.map(item => (
          <div key={item.id}
               className={`flex items-center gap-2 py-2.5 ${editingId === item.id ? 'bg-amber-50/60 dark:bg-amber-900/10 -mx-1 px-1 rounded-lg' : ''}`}>
            <button onClick={() => onEdit(item)}
                    className="flex-1 min-w-0 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-ink-100/50 dark:hover:bg-slate-800/50 transition">
              {renderRow(item)}
            </button>
            <button onClick={() => onDelete(item)}
                    aria-label="삭제"
                    className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg text-ink-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition">
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 수정 모드 안내 배너 — 폼 상단. 저장 시 덮어쓰기, 취소로 신규 입력 복귀 */
function EditingBanner({ label, onCancel }) {
  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 text-xs flex items-center justify-between gap-2">
      <span className="text-amber-800 dark:text-amber-300 font-semibold">✏️ {label} 수정 중 — 저장하면 덮어써집니다</span>
      <button type="button" onClick={onCancel}
              className="text-amber-700 dark:text-amber-400 underline flex-shrink-0 min-h-[32px] px-1">취소</button>
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
  const [editingId, setEditingId] = useState(null);

  // 첫 사용자 — 약 선택 화면 표시 (모든 hooks 호출 후)
  if (!lastDose && activeCourses.length === 0) {
    return <FirstDosePicker user={user} refresh={refresh} toast={toast} navigate={navigate} />;
  }

  const courseForLog = activeCourses.find(c => c.medication === medId) || activeCourses[0] || lastDoseCourse;

  // 약 변경 시 default 갱신
  const activeMed = MED_BY_ID[selectedMedId] || med;
  const isIntervalShort = lastDoseMs && date < earliestNextDate;

  // 기존 투약 기록 수정 — 약/코스는 그대로, 날짜·용량·가격·지역만 갱신 (간격 제약 미적용)
  const editDose = (d) => {
    setEditingId(d.id);
    setDate(d.date);
    setDose(d.dose);
    setPrice(d.price ?? '');
    setRegion(d.region ?? '');
    setShowAdvanced(d.price != null || !!d.region);
    setSwitchMed(false);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    toast.info(`${d.date} 투약 기록을 불러왔어요`);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDate(recommendedDate);
    setDose(lastDose?.dose || med?.doses[0] || '');
    setPrice(lastDose?.price ?? '');
    setRegion(lastDose?.region ?? '');
  };
  const deleteDose = (d) => {
    if (!window.confirm(`${d.date} · ${d.dose} 투약 기록을 삭제할까요?`)) return;
    Storage.deleteDose(d.id);
    if (editingId === d.id) cancelEdit();
    refresh();
    toast.success('투약 기록을 삭제했어요');
  };

  const submit = () => {
    if (!dose) return;
    // 수정 모드 — 기존 dose row 덮어쓰기 (코스/약 변경 로직·간격 제약 우회)
    if (editingId) {
      Storage.updateDose({ id: editingId, date, dose, price: +price || null, region: region.trim() || null });
      setEditingId(null);
      refresh();
      toast.success(`투약 기록 수정됨 · ${date} ${dose}`);
      return;
    }
    if (isIntervalShort && selectedMedId === medId) {
      toast.error(`${activeMed.label}은 최소 ${minIntervalDays}일 간격이 필요합니다 (${earliestNextDate} 이후)`);
      return;
    }
    // 약 변경 시: 기존 활성 코스 종료(두 약 동시 '진행 중' 방지) + 새 코스 자동 생성
    let targetCourseId = courseForLog?.id;
    if (selectedMedId !== medId || !targetCourseId) {
      if (selectedMedId !== medId) {
        const oldActive = activeCourses.find(c => c.medication === medId);
        if (oldActive) Storage.updateMedCourse({ ...oldActive, endDate: date, discontinueReason: 'switch' });
      }
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
      {lastDose && !switchMed && !editingId && (
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
        {editingId && <EditingBanner label="투약 기록" onCancel={cancelEdit} />}
        {/* 약 선택 (변경 시에만, 수정 모드 아님) */}
        {switchMed && !editingId && (
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
          {!editingId && isIntervalShort && selectedMedId === medId && (
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

        <div className="flex justify-end gap-2">
          {editingId && (
            <button onClick={cancelEdit} className="btn-ghost !py-3 !px-4 text-base">취소</button>
          )}
          <button onClick={submit} disabled={!dose || (!editingId && isIntervalShort && selectedMedId === medId)}
                  className="btn-primary !py-3 !px-6 text-base">
            {editingId ? '✓ 수정 저장' : '✓ 투약 기록'}
          </button>
        </div>
      </div>

      <RecentEntryList
        title="최근 투약"
        totalCount={allDoses.length}
        editingId={editingId}
        items={[...allDoses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7)}
        emptyText="아직 투약 기록이 없어요."
        onEdit={editDose}
        onDelete={deleteDose}
        renderRow={(d) => {
          const c = courses.find(x => x.id === d.courseId);
          const m = c ? MED_BY_ID[c.medication] : null;
          return (
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-500 dark:text-slate-400 tabular-nums w-12 flex-shrink-0">{d.date?.slice(5)}</span>
              <span className="font-semibold text-sm text-ink-900 dark:text-slate-100 truncate">
                {m?.label.replace(/\s*\(.+\)/, '') || '투약'}
                <span className="text-brand-700 dark:text-brand-400 ml-1.5">{d.dose}</span>
              </span>
              {d.price > 0 && (
                <span className="text-xs text-ink-400 dark:text-slate-500 tabular-nums ml-auto flex-shrink-0">{d.price.toLocaleString()}원</span>
              )}
            </div>
          );
        }}
      />
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
  const [editingId, setEditingId] = useState(null);
  // type 변경 시 같은 type의 마지막 기록으로 duration/intensity 자동 갱신
  // (수정 모드에선 불러온 값을 덮어쓰지 않도록 건너뜀)
  useEffect(() => {
    if (editingId) return;
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
    if (editingId) {
      Storage.updateExercise({
        id: editingId, date, type, durationMin: +durationMin, intensity,
        estKcal: estKcal || null, notes: notes.trim(),
      });
      setEditingId(null);
      setNotes('');
      refresh();
      toast.success(`운동 기록 수정됨 · ${EXERCISE_BY_ID[type]?.label} ${durationMin}분`);
      return;
    }
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

  // 기존 운동 기록 수정/삭제
  const editEx = (ex) => {
    setEditingId(ex.id);
    setDate(ex.date);
    setType(ex.type);
    setDurationMin(ex.durationMin);
    setIntensity(ex.intensity);
    setNotes(ex.notes || '');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    toast.info(`${ex.date} 운동 기록을 불러왔어요`);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setNotes('');
    setDate(todayISO());
  };
  const deleteEx = (ex) => {
    if (!window.confirm(`${ex.date} · ${EXERCISE_BY_ID[ex.type]?.label} ${ex.durationMin}분 기록을 삭제할까요?`)) return;
    Storage.deleteExercise(ex.id);
    if (editingId === ex.id) cancelEdit();
    refresh();
    toast.success('운동 기록을 삭제했어요');
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
        {editingId && <EditingBanner label="운동 기록" onCancel={cancelEdit} />}
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
          <div className="flex gap-2 ml-auto">
            {editingId && (
              <button onClick={cancelEdit} className="btn-ghost">취소</button>
            )}
            <button onClick={submit} disabled={!durationMin} className="btn-primary">
              {editingId ? '수정 저장' : '운동 기록 저장'}
            </button>
          </div>
        </div>
      </div>

      <RecentEntryList
        title="최근 운동"
        totalCount={allEx.length}
        editingId={editingId}
        items={[...allEx].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7)}
        emptyText="아직 운동 기록이 없어요."
        onEdit={editEx}
        onDelete={deleteEx}
        renderRow={(ex) => (
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-500 dark:text-slate-400 tabular-nums w-12 flex-shrink-0">{ex.date?.slice(5)}</span>
            <span className="font-semibold text-sm text-ink-900 dark:text-slate-100 truncate">
              {EXERCISE_BY_ID[ex.type]?.label}
              <span className="text-ink-400 dark:text-slate-500 font-normal ml-1.5">{ex.durationMin}분</span>
            </span>
            {ex.estKcal > 0 && (
              <span className="text-xs text-brand-600 dark:text-brand-400 tabular-nums ml-auto flex-shrink-0">{ex.estKcal} kcal</span>
            )}
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

  // 자동완성 — 같은 mealType의 마지막 식단으로 pattern·proteinG·estCalories prefill
  const lastDiet = allDiets[allDiets.length - 1];
  const [date, setDate] = useState(todayISO());
  const [mealType, setMealType] = useState(lastDiet?.mealType || 'lunch');
  const [description, setDescription] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [estCalories, setEstCalories] = useState('');
  const [pattern, setPattern] = useState(lastDiet?.pattern || '');
  const [editingId, setEditingId] = useState(null);
  // mealType 바꿀 때 같은 mealType의 마지막 pattern prefill (단, 사용자가 메뉴를 입력하지 않았을 때만)
  useEffect(() => {
    if (editingId || description.trim()) return;
    const sameMeal = allDiets.filter(d => d.mealType === mealType);
    const last = sameMeal[sameMeal.length - 1];
    if (last) {
      setPattern(last.pattern || '');
    }
  }, [mealType]);

  const submit = () => {
    if (!description.trim()) return;
    const savedDesc = description.trim();
    if (editingId) {
      Storage.updateDiet({
        id: editingId, date, mealType, description: savedDesc,
        proteinG: +proteinG || null, estCalories: +estCalories || null, pattern: pattern || null,
      });
      setEditingId(null);
      setDescription('');
      setProteinG('');
      setEstCalories('');
      refresh();
      toast.success(`식단 기록 수정됨 · '${savedDesc.slice(0, 20)}'`);
      return;
    }
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

  // 기존 식단 기록 수정/삭제
  const editDiet = (d) => {
    setEditingId(d.id);
    setDate(d.date);
    setMealType(d.mealType);
    setDescription(d.description || '');
    setProteinG(d.proteinG != null ? String(d.proteinG) : '');
    setEstCalories(d.estCalories != null ? String(d.estCalories) : '');
    setPattern(d.pattern || '');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    toast.info(`${d.date} 식단 기록을 불러왔어요`);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setProteinG('');
    setEstCalories('');
    setDate(todayISO());
  };
  const deleteDietEntry = (d) => {
    if (!window.confirm(`${d.date} · ${(d.description || '').slice(0, 20)} 기록을 삭제할까요?`)) return;
    Storage.deleteDiet(d.id);
    if (editingId === d.id) cancelEdit();
    refresh();
    toast.success('식단 기록을 삭제했어요');
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
        {editingId && <EditingBanner label="식단 기록" onCancel={cancelEdit} />}
        {phaseLabel && !editingId && (
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

        <div className="flex justify-end gap-2">
          {editingId && (
            <button onClick={cancelEdit} className="btn-ghost">취소</button>
          )}
          <button onClick={submit} disabled={!description.trim()} className="btn-primary">
            {editingId ? '수정 저장' : '식단 저장'}
          </button>
        </div>
      </div>

      <RecentEntryList
        title="최근 식단"
        totalCount={allDiets.length}
        editingId={editingId}
        items={[...allDiets].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 7)}
        emptyText="아직 식단 기록이 없어요."
        onEdit={editDiet}
        onDelete={deleteDietEntry}
        renderRow={(d) => (
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-500 dark:text-slate-400 tabular-nums w-12 flex-shrink-0">{d.date?.slice(5)}</span>
            <span className="text-[10px] text-ink-500 dark:text-slate-500 flex-shrink-0">{MEAL_BY_ID[d.mealType]?.label}</span>
            <span className="font-semibold text-sm text-ink-900 dark:text-slate-100 truncate">{d.description}</span>
            {d.estCalories > 0 && (
              <span className="text-xs text-brand-600 dark:text-brand-400 tabular-nums ml-auto flex-shrink-0">{d.estCalories} kcal</span>
            )}
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

function SummaryTile({ label, value }) {
  return (
    <div className="card !p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-2xl font-extrabold text-ink-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
