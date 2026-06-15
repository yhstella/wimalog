import React, { useMemo, useState } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { DialInput } from './DialInput.jsx';
import { MEDS, MED_BY_ID, DISCONTINUE_REASONS, REGION_SUGGESTIONS, DOSE_SCHEDULES, nextRecommendedStep } from '../lib/constants.js';
import { QuickDateInput } from './QuickDateInput.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function MedManager({ user }) {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const courses = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id, version]);
  const [showNewCourse, setShowNewCourse] = useState(false);

  const active = courses.filter(c => !c.endDate);
  const past = courses.filter(c => c.endDate);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-slate-100">약 관리</h1>
          <p className="text-sm text-ink-500 dark:text-slate-400 mt-1">
            현재 사용 중이거나 과거에 사용한 약을 사용 기간별로 관리합니다.
            여러 약을 동시에 사용 중이라면 각각 추가하세요.
          </p>
        </div>
        <button onClick={() => setShowNewCourse(true)} className="btn-primary">
          + 새 약 시작
        </button>
      </div>

      {showNewCourse && (
        <NewCourseForm
          user={user}
          onCancel={() => setShowNewCourse(false)}
          onSaved={() => { setShowNewCourse(false); refresh(); }}
        />
      )}

      {courses.length === 0 && !showNewCourse && (
        <div className="card text-center py-12">
          <div className="empty-illust animate-pulseGentle">💊</div>
          <div className="font-bold text-ink-900 dark:text-slate-100">아직 등록된 약이 없습니다</div>
          <p className="text-sm text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
            약 사용 중이라면 "+ 새 약 시작"을 눌러 등록하세요.<br />
            사용하지 않더라도 체중·운동·식단 기록과 통계 열람은 자유롭게 가능합니다.
          </p>
          <button onClick={() => setShowNewCourse(true)} className="btn-primary mt-4">
            + 약 시작하기
          </button>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="section-title mb-3">🟢 진행 중 ({active.length})</h2>
          <div className="space-y-3">
            {active.map(c => <CourseCard key={c.id} course={c} user={user} refresh={refresh} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="section-title mb-3">📚 과거 사용 이력 ({past.length})</h2>
          <div className="space-y-3">
            {past.map(c => <CourseCard key={c.id} course={c} user={user} refresh={refresh} collapsed />)}
          </div>
        </section>
      )}
    </div>
  );
}

function CourseCard({ course, user, refresh, collapsed: initiallyCollapsed = false }) {
  const med = MED_BY_ID[course.medication];
  const [version, setVersion] = useState(0);
  const localRefresh = () => { setVersion(v => v + 1); refresh(); };
  const doses = useMemo(() => Storage.getDosesByCourse(course.id), [course.id, version]);
  const [expanded, setExpanded] = useState(!initiallyCollapsed);
  const [showDoseForm, setShowDoseForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);

  const weeks = Math.floor(
    ((course.endDate ? new Date(course.endDate) : new Date()) - new Date(course.startDate))
    / (1000 * 60 * 60 * 24 * 7)
  );
  const totalSpent = doses.reduce((s, d) => s + (d.price || 0), 0);
  const avgPrice = doses.filter(d => d.price).length
    ? Math.round(totalSpent / doses.filter(d => d.price).length)
    : null;

  const lastDose = doses[doses.length - 1];

  return (
    <div className="card !p-0 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
              className="w-full text-left p-4 hover:bg-ink-100/40 transition flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-ink-900">{med?.label || course.medication}</div>
            {!course.endDate ? (
              <span className="chip-brand">진행 중 · {weeks}주</span>
            ) : (
              <span className="chip">종료 · {weeks}주 사용</span>
            )}
            {course.notes && <span className="text-xs text-ink-500">· {course.notes}</span>}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {course.startDate} {course.endDate ? `→ ${course.endDate}` : '~ 진행 중'}
            {' · '}
            {doses.length}회 투약
            {avgPrice != null && ` · 평균 ${avgPrice.toLocaleString()}원/회`}
            {totalSpent > 0 && ` · 누적 ${totalSpent.toLocaleString()}원`}
          </div>
        </div>
        <div className="text-ink-400 flex-shrink-0">{expanded ? '−' : '+'}</div>
      </button>

      {expanded && (
        <div className="border-t border-ink-100 p-4 space-y-4">
          {/* 최근 투약 표시 */}
          {lastDose && (
            <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm">
              <div className="text-ink-700">
                <b>최근 투약</b> · {lastDose.date} · <b className="text-brand-700">{lastDose.dose}</b>
                {lastDose.region && <> · {lastDose.region}</>}
                {lastDose.price > 0 && <> · {lastDose.price.toLocaleString()}원</>}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowDoseForm(s => !s)} className="btn-primary !py-2 !px-3 text-sm">
              {showDoseForm ? '취소' : '+ 처방 기록 추가'}
            </button>
            {!course.endDate && (
              <button onClick={() => setShowSwitch(s => !s)} className="btn-secondary !py-2 !px-3 text-sm">
                {showSwitch ? '닫기' : '↔ 약물 변경'}
              </button>
            )}
            <button onClick={() => setShowEdit(s => !s)} className="btn-secondary !py-2 !px-3 text-sm">
              {showEdit ? '닫기' : '편집'}
            </button>
          </div>

          {showDoseForm && (
            <NewDoseForm course={course} user={user} onSaved={() => { setShowDoseForm(false); localRefresh(); }} />
          )}

          {showSwitch && (
            <SwitchMedForm course={course} user={user}
                           onCancel={() => setShowSwitch(false)}
                           onSaved={() => { setShowSwitch(false); localRefresh(); }} />
          )}

          {showEdit && (
            <CourseEditForm course={course} onSaved={() => { setShowEdit(false); localRefresh(); }}
                            onDelete={() => { setShowEdit(false); localRefresh(); }} />
          )}

          {/* 추천 투약 일정 — 활성 코스만 */}
          {!course.endDate && (
            <RecommendedScheduleCard course={course} lastDose={lastDose} />
          )}

          {/* 투약 기록 표 */}
          {doses.length > 0 && (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-500 text-xs">
                    <th className="py-2 px-4 font-medium">날짜</th>
                    <th className="py-2 px-2 font-medium">용량</th>
                    <th className="py-2 px-2 font-medium">지역</th>
                    <th className="py-2 px-2 font-medium text-right">가격</th>
                    <th className="py-2 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {doses.slice().reverse().slice(0, 10).map(d => (
                    <tr key={d.id} className="border-t border-ink-100">
                      <td className="py-2 px-4 tabular-nums">{d.date}</td>
                      <td className="py-2 px-2 font-semibold">{d.dose}</td>
                      <td className="py-2 px-2 text-ink-500">{d.region || '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{d.price ? d.price.toLocaleString() : '—'}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => {
                          if (confirm('이 투약 기록을 삭제하시겠습니까?')) {
                            Storage.deleteDose(d.id);
                            localRefresh();
                          }
                        }} className="text-xs text-rose-600 hover:underline">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {doses.length > 10 && (
                <div className="text-xs text-ink-500 text-center py-2">
                  최근 10건만 표시 · 총 {doses.length}건
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 사용 빈도 옵션 — stats.js의 USAGE_FREQUENCIES와 동일 구조 (여기서 직접 정의해 import 줄임)
const FREQ_OPTIONS = [
  { id: 'weekly',     label: '매주',     desc: '주 1회 권장 용법' },
  { id: 'biweekly',   label: '격주',     desc: '2주에 1회 사용' },
  { id: 'occasional', label: '가끔',     desc: '월 1-2회 사용' },
  { id: 'intro',      label: '저용량 유지', desc: '시작 용량 그대로' },
];

// 약물 변경 — 기존 코스를 변경일에 종료 + 새 약 코스를 같은 날 시작.
// "두 단계를 한 폼에 묶기" — 사용자가 일일이 종료→신규 등록을 안 해도 됨.
function SwitchMedForm({ course, user, onCancel, onSaved }) {
  const currentMed = MED_BY_ID[course.medication];
  const currentLabel = currentMed?.label.replace(/\s*\(.+\)/, '') || course.medication;
  const otherMedOptions = MEDS.filter(m => m.id !== course.medication && m.id !== 'other');
  const defaultNewMed = course.medication === 'wegovy' ? 'mounjaro' : 'wegovy';
  const [newMedId, setNewMedId] = useState(defaultNewMed);
  const [switchDate, setSwitchDate] = useState(todayISO());
  const newMed = MED_BY_ID[newMedId];
  const [newDose, setNewDose] = useState(newMed?.doses[0] || '');
  const [notes, setNotes] = useState('');

  // newMedId 바뀌면 newDose 첫 용량으로 reset
  const onNewMedChange = (id) => {
    setNewMedId(id);
    const m = MED_BY_ID[id];
    setNewDose(m?.doses[0] || '');
  };

  const save = () => {
    if (!newDose) return;
    // 1) 기존 코스 변경일에 종료
    //   ⚠ updateMedCourse는 객체 1개를 받아 item.id로 탐색 — id 문자열을 넘기면 무산됐었음(데이터 오염 fix)
    Storage.updateMedCourse({ ...course, endDate: switchDate, discontinueReason: 'switch' });
    // 2) 새 코스 시작
    const newCourseId = uid('mc');
    Storage.addMedCourse({
      id: newCourseId,
      userId: user.id,
      seed: false,
      medication: newMedId,
      frequency: newMed?.frequency === '매일' ? 'daily' : 'weekly',
      startDate: switchDate,
      endDate: null,
      initialDose: newDose,
      notes: notes.trim() || `${currentLabel}에서 변경`,
      discontinueReason: null,
      createdAt: new Date().toISOString(),
    });
    // 3) 새 코스 시작일에 첫 dose 자동 추가
    Storage.addDose({
      id: uid('dose'),
      userId: user.id,
      courseId: newCourseId,
      seed: false,
      date: switchDate,
      dose: newDose,
      price: null, region: null, pharmacyName: null,
      notes: '약물 변경 시 시작',
      createdAt: new Date().toISOString(),
    });
    onSaved();
  };

  return (
    <div className="space-y-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40">
      <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
        ↔ <b>{currentLabel}</b>에서 다른 약으로 변경. 기존 코스는 변경일에 종료되고, 새 약 코스가 같은 날 시작됩니다.
      </div>
      <div>
        <div className="label">변경할 약</div>
        <div className="flex gap-1.5 flex-wrap">
          {otherMedOptions.map(m => (
            <button key={m.id} type="button" onClick={() => onNewMedChange(m.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition
                                ${newMedId === m.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {m.label.replace(/\s*\(.+\)/, '')}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="label">변경일</div>
        <QuickDateInput value={switchDate} max={todayISO()} onChange={setSwitchDate} />
      </div>
      <div>
        <div className="label">시작 용량</div>
        <div className="flex gap-1.5 flex-wrap">
          {newMed?.doses.map(d => (
            <button key={d} type="button" onClick={() => setNewDose(d)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
                                ${newDose === d
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white text-ink-700 border-ink-300'}`}>{d}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="label">메모 (선택)</div>
        <input type="text" className="input" maxLength={60}
               value={notes} onChange={e => setNotes(e.target.value)}
               placeholder={`예: 부작용으로 ${currentLabel}에서 변경`} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary !py-2 text-sm">취소</button>
        <button onClick={save} disabled={!newDose} className="btn-primary !py-2 text-sm">
          ↔ 변경 적용
        </button>
      </div>
    </div>
  );
}

// 추천 투약 일정 — 약별 표준 escalation 기반 다음 단계 안내
function RecommendedScheduleCard({ course, lastDose }) {
  const schedule = DOSE_SCHEDULES[course.medication];
  if (!schedule) return null;
  const currentDose = lastDose?.dose || course.initialDose;
  const rec = nextRecommendedStep(course.medication, course.startDate, currentDose);
  if (!rec) return null;

  // 다음 증량까지 남은 일수
  let daysLeft = null;
  if (rec.nextDate) {
    const ms = Date.parse(rec.nextDate) - Date.now();
    daysLeft = Math.ceil(ms / 86400000);
  }

  return (
    <div className="rounded-xl bg-sky-50/60 dark:bg-sky-900/15 border border-sky-200 dark:border-sky-800/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-bold text-sky-800 dark:text-sky-200">📅 추천 투약 일정 (임상 표준)</div>
        <div className="text-[10px] text-ink-500 dark:text-slate-500">의사 권유에 따라 다를 수 있음</div>
      </div>
      {rec.isMaintenance ? (
        <div className="text-sm text-ink-900 dark:text-slate-100">
          현재 <b>{rec.current.dose}</b> 유지 단계 — 더 이상 증량 권장 없음
        </div>
      ) : (
        <div className="text-sm text-ink-900 dark:text-slate-100 leading-relaxed">
          현재 <b>{rec.current.dose}</b> ({rec.current.weeks}주 유지) →
          {rec.next ? (
            <> 다음: <b className="text-brand-700 dark:text-brand-400">{rec.next.dose}</b> · 권장 증량일 <b className="tabular-nums">{rec.nextDate}</b>
              {daysLeft != null && (
                <span className={`ml-1 text-xs ${daysLeft <= 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-ink-500'}`}>
                  ({daysLeft <= 0 ? '지금 증량 가능' : `D-${daysLeft}`})
                </span>
              )}
            </>
          ) : ' 유지 단계 진입'}
        </div>
      )}
      {/* 전체 일정 미리보기 */}
      <div className="flex flex-wrap gap-1 pt-1">
        {schedule.map((s, i) => {
          const isCurrent = s.dose === currentDose;
          const isPassed = schedule.findIndex(x => x.dose === currentDose) > i;
          return (
            <span key={i}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border
                              ${isCurrent ? 'bg-brand-500 text-white border-brand-500'
                                : isPassed ? 'bg-ink-100 dark:bg-slate-800 text-ink-500 dark:text-slate-500 border-ink-200 dark:border-slate-700 line-through'
                                : 'bg-white dark:bg-slate-900 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
              {s.dose}{s.optional ? '*' : ''}{s.maintenance ? ' (유지)' : ''}
            </span>
          );
        })}
      </div>
      {schedule.some(s => s.optional) && (
        <div className="text-[10px] text-ink-500 dark:text-slate-500">* 선택적 단계 — 의사 판단</div>
      )}
    </div>
  );
}

function NewCourseForm({ user, onCancel, onSaved }) {
  const [med, setMed] = useState('wegovy');
  const [startDate, setStartDate] = useState(todayISO());
  const [stillUsing, setStillUsing] = useState(true);   // 진행 중 vs 종료
  const [endDate, setEndDate] = useState(todayISO());
  const [frequency, setFrequency] = useState('weekly');
  const [initialDose, setInitialDose] = useState(MED_BY_ID.wegovy.doses[0]);
  const [notes, setNotes] = useState('');

  const m = MED_BY_ID[med];

  const save = () => {
    Storage.addMedCourse({
      id: uid('mc'),
      userId: user.id,
      seed: false,
      medication: med,
      frequency,
      startDate,
      endDate: stillUsing ? null : endDate,
      initialDose,
      notes: notes.trim(),
      discontinueReason: null,
      createdAt: new Date().toISOString(),
    });
    onSaved();
  };

  return (
    <div className="card space-y-4 border-2 border-brand-200">
      <h3 className="font-bold text-ink-900">새 약 등록</h3>

      <div>
        <div className="label">약제</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MEDS.map(o => (
            <button key={o.id} type="button"
                    onClick={() => { setMed(o.id); setInitialDose(MED_BY_ID[o.id].doses[0]); }}
                    className={`px-3 py-2 rounded-xl text-sm border transition text-left
                                ${med === o.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white text-ink-700 border-ink-300 hover:border-brand-400'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 사용 빈도 chip — 한국 실사용 반영 */}
      <div>
        <div className="label">사용 빈도</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FREQ_OPTIONS.map(f => (
            <button key={f.id} type="button"
                    onClick={() => setFrequency(f.id)}
                    title={f.desc}
                    className={`px-3 py-2 rounded-xl text-sm border transition
                                ${frequency === f.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white text-ink-700 border-ink-300 hover:border-brand-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 사용 기간 — 시작일 + 진행 중/종료 토글 */}
      <div>
        <div className="label">시작일</div>
        <QuickDateInput value={startDate} max={todayISO()} onChange={setStartDate} />
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-brand-500"
                 checked={stillUsing} onChange={e => setStillUsing(e.target.checked)} />
          <span>현재도 사용 중 (종료 안 함)</span>
        </label>
        {!stillUsing && (
          <div className="mt-2">
            <div className="text-xs text-ink-500 dark:text-slate-400 mb-1">종료일</div>
            <QuickDateInput value={endDate} max={todayISO()} onChange={setEndDate} />
          </div>
        )}
      </div>

      <div>
        <div className="label">시작 용량</div>
        <select className="input" value={initialDose}
                onChange={e => setInitialDose(e.target.value)}>
          {m.doses.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <div className="label">메모 (선택)</div>
        <input type="text" className="input" maxLength={50}
               value={notes} onChange={e => setNotes(e.target.value)}
               placeholder="예: OO병원 처방, 첫 사용" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="btn-secondary">취소</button>
        <button onClick={save} className="btn-primary">등록</button>
      </div>
    </div>
  );
}

function NewDoseForm({ course, user, onSaved }) {
  const med = MED_BY_ID[course.medication];
  const lastDose = useMemo(() => Storage.getDosesByCourse(course.id).slice(-1)[0], [course.id]);
  const [date, setDate] = useState(todayISO());
  const [dose, setDose] = useState(lastDose?.dose || course.initialDose || med?.doses[0] || '');
  const [price, setPrice] = useState(lastDose?.price || '');
  const [region, setRegion] = useState(lastDose?.region || '');
  const [pharmacyName, setPharmacyName] = useState('');
  const [notes, setNotes] = useState('');

  const save = () => {
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
      pharmacyName: pharmacyName.trim() || null,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
    onSaved();
  };

  return (
    <div className="space-y-3 p-3 rounded-xl bg-ink-100/40 border border-ink-200">
      <div className="rounded-lg bg-brand-50 dark:bg-brand-900/15 px-3 py-2 text-[11px] text-brand-800 dark:text-brand-200 leading-relaxed">
        💡 <b>1회 처방 = 4주치 박스(1팩)</b>. 매주 사용 시 한 박스가 4주 분량입니다. 가격은 박스 단위로 입력해 주세요.
      </div>
      <div>
        <div className="label">처방일</div>
        <QuickDateInput value={date} max={todayISO()} onChange={setDate} />
      </div>
      <div>
        <div className="label">용량</div>
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label">박스 가격 (원, 4주치)</div>
          <input type="number" inputMode="numeric" className="input"
                 value={price} onChange={e => setPrice(e.target.value)}
                 placeholder="예: 350000" />
          <details className="mt-1 text-[10px]">
            <summary className="cursor-pointer text-ink-500 hover:text-brand-700">🎛 만원 단위 다이얼</summary>
            <div className="mt-1 p-2 rounded-lg border border-ink-200 dark:border-slate-700">
              <DialInput value={Math.round((+price || 0) / 10000)}
                         onChange={(v) => setPrice(String(v * 10000))}
                         min={0} max={120} step={1} majorTick={10} unit="만원" />
            </div>
          </details>
        </div>
        <div>
          <div className="label">구매 지역</div>
          <input type="text" className="input" list="region-suggestions" maxLength={30}
                 value={region} onChange={e => setRegion(e.target.value)}
                 placeholder="예: 서울 대학로" />
          <datalist id="region-suggestions">
            {REGION_SUGGESTIONS.map(r => <option key={r} value={r} />)}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label">약국/병원 (선택)</div>
          <input type="text" className="input" maxLength={30}
                 value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} />
        </div>
        <div>
          <div className="label">메모 (선택)</div>
          <input type="text" className="input" maxLength={50}
                 value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={save} disabled={!dose} className="btn-primary !py-2 !px-3 text-sm">저장</button>
      </div>
    </div>
  );
}

function CourseEditForm({ course, onSaved, onDelete }) {
  const [endDate, setEndDate] = useState(course.endDate || '');
  const [discontinueReason, setDiscontinueReason] = useState(course.discontinueReason || '');
  const [notes, setNotes] = useState(course.notes || '');

  const save = () => {
    Storage.updateMedCourse({
      ...course,
      endDate: endDate || null,
      discontinueReason: endDate ? (discontinueReason || null) : null,
      notes: notes.trim(),
    });
    onSaved();
  };

  const removeCourse = () => {
    if (!confirm('이 약 사용 기록과 모든 투약 기록을 삭제합니다. 계속하시겠습니까?')) return;
    Storage.deleteMedCourse(course.id);
    onDelete();
  };

  return (
    <div className="space-y-3 p-3 rounded-xl bg-ink-100/40 border border-ink-200">
      <div>
        <div className="label">메모</div>
        <input type="text" className="input" maxLength={50}
               value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div>
        <div className="label">종료일 (중단 시 — 비우면 진행 중)</div>
        <QuickDateInput value={endDate} max={todayISO()} onChange={setEndDate} />
        {endDate && (
          <div className="mt-3">
            <div className="label">중단 이유</div>
            <select className="input" value={discontinueReason}
                    onChange={e => setDiscontinueReason(e.target.value)}>
              <option value="">선택</option>
              {DISCONTINUE_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2">
        <button onClick={removeCourse} className="text-xs text-rose-600 hover:underline">삭제</button>
        <button onClick={save} className="btn-primary !py-2 !px-3 text-sm">저장</button>
      </div>
    </div>
  );
}
