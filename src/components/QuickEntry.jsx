import React, { useMemo, useState } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { SIDE_EFFECTS, MED_BY_ID } from '../lib/constants.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ============================================================
   QuickWeightCard — 1탭으로 오늘 체중 기록
   - 마지막 체중 기준 +/- 0.1kg 버튼
   - 부작용 '지난번 그대로' 적용 버튼
   - 인라인 저장 + 짧은 피드백
============================================================ */
export function QuickWeightCard({ user, onSaved }) {
  const logs = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);
  const lastLog = logs[logs.length - 1];
  const baseWeight = lastLog?.weight ?? user.startWeight;

  const [weight, setWeight] = useState(baseWeight);
  const [sideEffects, setSideEffects] = useState({});
  const [showSides, setShowSides] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // 오늘 이미 기록했는지
  const today = todayISO();
  const todayLog = logs.find(l => l.date === today);
  const lastSidesCount = lastLog ? Object.values(lastLog.sideEffects || {}).filter(Boolean).length : 0;

  const adjust = (delta) => setWeight(w => +(Math.max(30, Math.min(250, +w + delta))).toFixed(1));

  const copyLastSides = () => {
    if (lastLog?.sideEffects) {
      setSideEffects({ ...lastLog.sideEffects });
      setShowSides(true);
    }
  };

  const toggleSide = (id) => setSideEffects(s => ({ ...s, [id]: !s[id] }));

  const save = () => {
    Storage.addLog({
      id: uid('log'),
      userId: user.id,
      date: today,
      weight: +weight,
      appetiteChange: lastLog?.appetiteChange ?? 3,
      satiety: lastLog?.satiety ?? 3,
      sideEffects,
      mealReduction: lastLog?.mealReduction ?? 3,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
    const msg = lastLog
      ? `${(+weight).toFixed(1)} kg 기록됨 · 지난번 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg`
      : `${(+weight).toFixed(1)} kg 기록됨`;
    onSaved?.(msg);
  };

  const delta = +weight - baseWeight;
  const totalSides = Object.values(sideEffects).filter(Boolean).length;

  return (
    <div className="card !p-4 bg-gradient-to-br from-brand-50 to-white border border-brand-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-ink-900">⚡ 오늘 빠른 기록</div>
          <div className="text-xs text-ink-500">
            {todayLog ? (
              <span className="text-amber-700">오늘 이미 기록됨 ({todayLog.weight} kg) · 추가 입력 가능</span>
            ) : (
              <>이전 기록: {baseWeight} kg ({lastLog?.date || '온보딩'})</>
            )}
          </div>
        </div>
      </div>

      {/* 체중 +/- 위젯 */}
      <div className="flex items-center justify-center gap-2 my-3">
        <button onClick={() => adjust(-0.5)} className="w-10 h-10 rounded-full bg-white border border-ink-300 text-ink-700 font-bold text-lg hover:border-brand-400 active:scale-95 transition">−</button>
        <button onClick={() => adjust(-0.1)} className="w-8 h-8 rounded-full bg-white border border-ink-200 text-ink-500 text-sm hover:border-brand-400 active:scale-95 transition">·</button>
        <div className="mx-3 text-center min-w-[110px]">
          <input
            type="number" inputMode="decimal" min={30} max={250} step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full text-3xl font-extrabold text-center tabular-nums text-ink-900 bg-transparent border-none focus:outline-none focus:ring-0"
          />
          <div className="text-xs text-ink-500 -mt-1">kg</div>
        </div>
        <button onClick={() => adjust(0.1)} className="w-8 h-8 rounded-full bg-white border border-ink-200 text-ink-500 text-sm hover:border-brand-400 active:scale-95 transition">·</button>
        <button onClick={() => adjust(0.5)} className="w-10 h-10 rounded-full bg-white border border-ink-300 text-ink-700 font-bold text-lg hover:border-brand-400 active:scale-95 transition">+</button>
      </div>

      <div className="text-center text-xs text-ink-500 mb-3">
        {delta === 0 ? '변화 없음' : (
          <span className={delta < 0 ? 'text-brand-600 font-semibold' : 'text-rose-600 font-semibold'}>
            {delta < 0 ? '−' : '+'}{Math.abs(delta).toFixed(1)} kg (마지막 기록 대비)
          </span>
        )}
      </div>

      {/* 부작용 */}
      <div className="border-t border-ink-100 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-700">
            부작용 {totalSides > 0 && <span className="chip ml-1">{totalSides}개</span>}
          </div>
          <div className="flex gap-1">
            {lastSidesCount > 0 && (
              <button onClick={copyLastSides}
                      className="text-xs px-2 py-1 rounded-lg bg-white border border-brand-300 text-brand-700 hover:bg-brand-50 transition">
                ↩ 지난번 그대로 ({lastSidesCount})
              </button>
            )}
            <button onClick={() => setShowSides(s => !s)}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-ink-300 text-ink-500 hover:bg-ink-100 transition">
              {showSides ? '접기' : '펼치기'}
            </button>
          </div>
        </div>
        {showSides && (
          <div className="flex flex-wrap gap-1.5">
            {SIDE_EFFECTS.map(s => (
              <button key={s.id} type="button" onClick={() => toggleSide(s.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
                                  ${sideEffects[s.id]
                                    ? 'bg-rose-500 text-white border-rose-500'
                                    : 'bg-white text-ink-700 border-ink-300'}`}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 저장 */}
      <button onClick={save} disabled={savedAt != null}
              className="btn-primary w-full !py-2.5 mt-3 text-sm">
        {savedAt != null ? '✓ 저장됨' : '💾 오늘 기록 저장'}
      </button>
    </div>
  );
}

/* ============================================================
   QuickDoseCard — 진행 중 약 코스의 빠른 투약 기록 + 투약일 알림
============================================================ */
export function QuickDoseCard({ user, onSaved, onOpenMeds }) {
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id).filter(c => !c.endDate),
                          [user.id]);
  if (!courses.length) return null;

  return (
    <div className="card !p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold text-ink-900">💊 진행 중 약</div>
        <button onClick={onOpenMeds} className="btn-ghost text-xs">관리 →</button>
      </div>
      <div className="space-y-2">
        {courses.map(c => (
          <DoseReminderRow key={c.id} course={c} user={user} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}

function DoseReminderRow({ course, user, onSaved }) {
  const med = MED_BY_ID[course.medication];
  const allDoses = useMemo(() => Storage.getDosesByCourse(course.id), [course.id]);
  const lastDose = allDoses[allDoses.length - 1];
  const frequency = med?.frequency === '매일' ? 1 : 7;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysSinceLast = lastDose
    ? Math.floor((today - new Date(lastDose.date)) / (24 * 60 * 60 * 1000))
    : null;
  const dueIn = lastDose ? frequency - daysSinceLast : 0;
  const isDue = dueIn <= 0;
  const isUpcoming = dueIn === 1;

  const [showQuick, setShowQuick] = useState(false);

  const quickSave = () => {
    const doseStr = lastDose?.dose || course.initialDose || med?.doses[0] || '';
    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId: course.id,
      seed: false,
      date: today.toISOString().slice(0, 10),
      dose: doseStr,
      price: lastDose?.price || null,
      region: lastDose?.region || null,
      pharmacyName: null,
      notes: '오늘 빠른 기록',
      createdAt: new Date().toISOString(),
    });
    setShowQuick(false);
    onSaved?.(`${med?.label.replace(/\s*\(.+\)/, '') ?? ''} ${doseStr} 투약 기록됨`);
  };

  return (
    <div className={`p-3 rounded-xl border ${isDue ? 'bg-amber-50 border-amber-200' : 'bg-white border-ink-100'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-900">
            {med?.label}
            {course.notes && <span className="text-xs font-normal text-ink-500 ml-1.5">· {course.notes}</span>}
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {lastDose ? (
              <>최근 투약 {lastDose.date} ({lastDose.dose})</>
            ) : (
              <>아직 투약 기록 없음</>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {isDue && (
            <span className="chip bg-amber-200 text-amber-900 mr-1">⏰ 투약일</span>
          )}
          {!isDue && isUpcoming && (
            <span className="text-xs text-ink-500 mr-1">내일 투약</span>
          )}
        </div>
      </div>

      {/* 빠른 투약 액션 */}
      <div className="flex gap-2 mt-2">
        {lastDose ? (
          <button onClick={quickSave}
                  className={`flex-1 text-xs py-2 rounded-lg font-semibold transition
                              ${isDue
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
            ↩ 같은 용량({lastDose.dose})으로 오늘 투약 기록
          </button>
        ) : (
          <button onClick={() => setShowQuick(s => !s)}
                  className="flex-1 text-xs py-2 rounded-lg font-semibold bg-brand-500 text-white">
            첫 투약 기록 추가
          </button>
        )}
      </div>
    </div>
  );
}
