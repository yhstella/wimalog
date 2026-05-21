import React, { useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { reseed } from '../lib/seedData.js';
import { CONDITIONS, MEAL_FREQUENCIES, SNACK_FREQUENCIES, LATE_NIGHT_EATING, DIET_PATTERNS } from '../lib/constants.js';
import { useToast } from './Toast.jsx';

export function Profile({ user, navigate, onLogout, refresh }) {
  const toast = useToast();
  const logs      = useMemo(() => Storage.getLogsByUser(user.id), [user.id]);
  const courses   = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id]);
  const doses     = useMemo(() => Storage.getDosesByUser(user.id), [user.id]);
  const exercises = useMemo(() => Storage.getExercisesByUser(user.id), [user.id]);
  const diets     = useMemo(() => Storage.getDietsByUser(user.id), [user.id]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nickname: user.nickname || '',
    height: user.height || '',
    gender: user.gender || 'X',
    ageGroup: user.ageGroup || '30s',
    startWeight: user.startWeight || '',
    targetWeight: user.targetWeight || '',
    conditions: { ...(user.conditions || {}) },
  });

  const save = () => {
    Storage.upsertUser({
      ...user,
      nickname: form.nickname || '나',
      height: +form.height || user.height || null,
      gender: form.gender || user.gender,
      ageGroup: form.ageGroup || user.ageGroup,
      startWeight: +form.startWeight || user.startWeight,
      targetWeight: +form.targetWeight || user.targetWeight,
      conditions: form.conditions,
    });
    setEditing(false);
    refresh();
    toast.success('기본 정보 저장됨');
  };

  const toggleCondition = (id) => setForm(f => ({
    ...f, conditions: { ...f.conditions, [id]: !f.conditions[id] },
  }));

  const exportData = () => {
    const data = Storage.exportUserData(user.id);
    download(`wimalog-${user.id}-${todayStr()}.json`,
             new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['date', 'weight', 'appetiteChange', 'satiety', 'mealReduction',
                     ...['nausea','vomiting','constipation','diarrhea','fatigue','dizziness','abdomenPain','hairLoss','reflux','headache'].map(s => `se_${s}`),
                     'notes'];
    const rows = logs.map(l => [
      l.date, l.weight, l.appetiteChange, l.satiety, l.mealReduction,
      ...['nausea','vomiting','constipation','diarrhea','fatigue','dizziness','abdomenPain','hairLoss','reflux','headache']
        .map(s => l.sideEffects?.[s] ? 1 : 0),
      csvEscape(l.notes || ''),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    download(`wimalog-weights-${user.id}-${todayStr()}.csv`,
             new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  };

  const exportDoseCSV = () => {
    if (!doses.length) return;
    const headers = ['date', 'medication', 'dose', 'price', 'region', 'pharmacyName', 'notes'];
    const courseById = new Map(courses.map(c => [c.id, c]));
    const rows = doses.map(d => [
      d.date,
      courseById.get(d.courseId)?.medication || '',
      d.dose,
      d.price || '',
      csvEscape(d.region || ''),
      csvEscape(d.pharmacyName || ''),
      csvEscape(d.notes || ''),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    download(`wimalog-doses-${user.id}-${todayStr()}.csv`,
             new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  };

  const deleteAccount = () => {
    if (!confirm('정말 모든 데이터를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    Storage.deleteUser(user.id);
    onLogout();
  };

  const handleReseed = () => {
    if (!confirm('시드(샘플) 데이터를 재생성합니다. 본인 데이터는 보존됩니다.')) return;
    reseed();
    refresh();
    toast.success('시드 데이터 재생성 완료');
  };

  const activeMeds = courses.filter(c => !c.endDate);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-extrabold text-ink-900">프로필</h1>

      <div className="card space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="section-title">기본 정보</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary !py-2 !px-3 text-xs">수정</button>
          )}
        </div>

        {!editing ? (
          <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <ReadRow k="닉네임" v={user.nickname} />
            <ReadRow k="성별/나이" v={`${user.gender === 'F' ? '여' : user.gender === 'M' ? '남' : '비공개'} · ${user.ageGroup}`} />
            <ReadRow k="키" v={user.height ? `${user.height} cm` : '미입력'} />
            <ReadRow k="시작 체중" v={user.startWeight ? `${user.startWeight} kg` : '미입력'} />
            <ReadRow k="목표 체중" v={user.targetWeight ? `${user.targetWeight} kg` : '미입력'} />
            <ReadRow k="동반 질환"
                     v={Object.entries(user.conditions || {}).filter(([, v]) => v).map(([k]) => CONDITIONS.find(c => c.id === k)?.label).filter(Boolean).join(', ') || '없음'} />
          </dl>
        ) : (
          <div className="space-y-3">
            <Row label="닉네임">
              <input className="input" value={form.nickname}
                     onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
            </Row>
            <Row label="키 (cm)">
              <input type="number" inputMode="decimal" step="0.1" min={130} max={220} className="input"
                     value={form.height}
                     onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                     placeholder="예: 165" />
            </Row>
            <Row label="성별">
              <div className="flex gap-1">
                {[{ id: 'F', label: '여' }, { id: 'M', label: '남' }, { id: 'X', label: '비공개' }].map(o => (
                  <button key={o.id} type="button"
                          onClick={() => setForm(f => ({ ...f, gender: o.id }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                                      ${form.gender === o.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink-700 border-ink-300'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="나이대">
              <div className="grid grid-cols-5 gap-1">
                {[{id:'20s',label:'20대'},{id:'30s',label:'30대'},{id:'40s',label:'40대'},{id:'50s',label:'50대'},{id:'60s+',label:'60+'}].map(o => (
                  <button key={o.id} type="button"
                          onClick={() => setForm(f => ({ ...f, ageGroup: o.id }))}
                          className={`py-2 rounded-lg text-xs font-medium border transition
                                      ${form.ageGroup === o.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink-700 border-ink-300'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="시작 체중 (kg)">
                <input type="number" inputMode="decimal" step="0.1" min={30} max={250} className="input"
                       value={form.startWeight}
                       onChange={e => setForm(f => ({ ...f, startWeight: e.target.value }))}
                       placeholder="예: 75" />
              </Row>
              <Row label="목표 체중 (kg)">
                <input type="number" inputMode="decimal" step="0.1" min={30} max={250} className="input"
                       value={form.targetWeight}
                       onChange={e => setForm(f => ({ ...f, targetWeight: e.target.value }))}
                       placeholder="예: 65" />
              </Row>
            </div>
            <Row label="동반 질환">
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map(c => (
                  <button key={c.id} type="button" onClick={() => toggleCondition(c.id)}
                          className={`px-3 py-2 rounded-xl text-sm border transition
                                      ${form.conditions[c.id]
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white text-ink-700 border-ink-300'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Row>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">취소</button>
              <button onClick={save} className="btn-primary">저장</button>
            </div>
          </div>
        )}
      </div>

      {/* 평소 식이습관 */}
      <BaselineDietCard user={user} refresh={refresh} toast={toast} />

      {/* 약 정보 — 별도 페이지로 안내 */}
      <div className="card flex justify-between items-center gap-3">
        <div>
          <h2 className="section-title">약 관리</h2>
          <p className="section-subtitle">
            {activeMeds.length > 0
              ? `진행 중 ${activeMeds.length}개 · 누적 ${courses.length}개 사용 이력`
              : courses.length > 0
                ? `진행 중 없음 · 과거 ${courses.length}개 사용 이력`
                : '아직 등록된 약이 없습니다'}
          </p>
        </div>
        <button onClick={() => navigate('meds')} className="btn-secondary !py-2 !px-3 text-sm">약 관리 →</button>
      </div>

      {/* 진료용 리포트 */}
      <div className="card flex justify-between items-center gap-3 border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-900/15">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="section-title !mb-0">📄 진료용 12주 리포트</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              Free
            </span>
          </div>
          <p className="section-subtitle">병원 방문 시 인쇄 또는 PDF로 저장해 가져가세요</p>
        </div>
        <button onClick={() => navigate('doctor-report')} className="btn-primary !py-2 !px-3 text-sm">
          리포트 보기 →
        </button>
      </div>

      {/* 추천인 시스템 — 본인 코드 + 다른 사람 초대 (Free 베타) */}
      <ReferralCard user={user} />

      {/* 알림 설정 — 베타 placeholder */}
      <NotificationSettings user={user} />

      {/* 데이터 관리 */}
      <div className="card space-y-3">
        <h2 className="section-title">데이터 관리</h2>
        <p className="section-subtitle">개인 정보는 본인 브라우저, 익명 통계는 안전한 서버에 저장됩니다.</p>
        <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-sm">
          <ReadRow k="체중·증상 기록" v={`${logs.length}건`} />
          <ReadRow k="약 사용 이력" v={`${courses.length}개`} />
          <ReadRow k="투약 기록" v={`${doses.length}건`} />
          <ReadRow k="운동 기록" v={`${exercises.length}건`} />
          <ReadRow k="식단 기록" v={`${diets.length}건`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          <button onClick={exportCSV} disabled={!logs.length} className="btn-secondary text-sm">
            📥 체중 CSV
          </button>
          <button onClick={exportDoseCSV} disabled={!doses.length} className="btn-secondary text-sm">
            📥 투약 CSV
          </button>
          <button onClick={exportData} className="btn-secondary text-sm">
            📦 전체 JSON
          </button>
        </div>
      </div>

      {/* 개발자 도구 */}
      <div className="card space-y-3">
        <h2 className="section-title">개발자 도구</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={handleReseed} className="btn-secondary">샘플 데이터 재생성</button>
          <button onClick={deleteAccount} className="btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50">
            계정/내 데이터 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadRow({ k, v }) {
  return (
    <>
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-ink-900 text-right font-medium tabular-nums">{v}</dd>
    </>
  );
}

// 추천인 카드 — 본인 코드 + 친구 초대 (베타 placeholder)
function ReferralCard({ user }) {
  const [copied, setCopied] = React.useState(false);
  // 사용자 ID 기반 짧은 추천 코드 생성 (해시 단순화)
  const referralCode = React.useMemo(() => {
    if (!user?.id) return null;
    const str = user.id.slice(-8).toUpperCase();
    return str.replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'WIMA' + Math.floor(Math.random() * 10000);
  }, [user?.id]);
  const link = `https://wimalog.kr/?ref=${referralCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="card border border-violet-200 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-900/15">
      <div className="flex items-start gap-3">
        <div className="text-2xl">🎁</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="section-title !mb-0">친구·동료 초대</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              Free 베타
            </span>
          </div>
          <p className="section-subtitle">
            추후 Premium 출시 시 추천자·신규 가입자 모두에게 Premium 1개월 무료 제공 검토 중
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <code className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800/40 text-sm font-mono text-violet-700 dark:text-violet-300">
              {referralCode}
            </code>
            <button onClick={copy}
                    className="text-xs px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-bold transition">
              {copied ? '✓ 링크 복사됨' : '🔗 초대 링크 복사'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 알림 설정 — 추후 실구현 placeholder
function NotificationSettings({ user }) {
  const [prefs, setPrefs] = React.useState({
    weeklyReport: false,
    doseReminder: false,
    visitReminder: false,
  });
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="text-2xl">🔔</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="section-title !mb-0">알림 설정</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              곧 출시
            </span>
          </div>
          <p className="section-subtitle">이메일·카카오톡 알림으로 기록 누락 방지 + 진료·약 떨어질 시점 안내</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-sm text-ink-700 dark:text-slate-300">📊 주간 진척도 요약 (월요일 아침)</span>
              <input type="checkbox" checked={prefs.weeklyReport}
                     onChange={e => setPrefs(p => ({ ...p, weeklyReport: e.target.checked }))}
                     className="accent-brand-500 w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-sm text-ink-700 dark:text-slate-300">💉 다음 투약일 D-1 알림</span>
              <input type="checkbox" checked={prefs.doseReminder}
                     onChange={e => setPrefs(p => ({ ...p, doseReminder: e.target.checked }))}
                     className="accent-brand-500 w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-sm text-ink-700 dark:text-slate-300">🏥 진료 1주 전 리포트 출력 안내</span>
              <input type="checkbox" checked={prefs.visitReminder}
                     onChange={e => setPrefs(p => ({ ...p, visitReminder: e.target.checked }))}
                     className="accent-brand-500 w-4 h-4" />
            </label>
          </div>
          <p className="text-[10px] text-ink-500 dark:text-slate-500 mt-3 leading-relaxed">
            ※ 현재는 설정 저장만 가능. 실제 알림 전송은 곧 출시 예정.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(s) {
  if (s == null) return '';
  return `"${String(s).replace(/"/g, '""')}"`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
   평소 식이습관 카드 (가입 후 추가 입력)
============================================================ */
function BaselineDietCard({ user, refresh, toast }) {
  const baseline = user.baselineDiet || {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    mealsPerDay: baseline.mealsPerDay || '',
    snackFreq: baseline.snackFreq || '',
    lateNight: baseline.lateNight || '',
    patterns: baseline.patterns || [],
    afterDose: baseline.afterDose || '', // 주사 후 식이 메모 (자유 텍스트)
    notes: baseline.notes || '',
  });

  const togglePattern = (id) => setForm(f => ({
    ...f,
    patterns: f.patterns.includes(id) ? f.patterns.filter(p => p !== id) : [...f.patterns, id],
  }));

  const save = () => {
    Storage.upsertUser({
      ...user,
      baselineDiet: {
        mealsPerDay: form.mealsPerDay || null,
        snackFreq: form.snackFreq || null,
        lateNight: form.lateNight || null,
        patterns: form.patterns,
        afterDose: form.afterDose.trim() || null,
        notes: form.notes.trim() || null,
        updatedAt: new Date().toISOString(),
      },
    });
    setEditing(false);
    refresh();
    toast.success('식이습관 저장됨');
  };

  const hasAnyData = baseline.mealsPerDay || baseline.snackFreq || baseline.patterns?.length;

  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title">🍽️ 식이습관</h2>
          <p className="section-subtitle">평소·주사 후 식이 패턴을 입력하면 통계가 더 정확해져요</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary !py-2 !px-3 text-xs">
            {hasAnyData ? '수정' : '+ 입력하기'}
          </button>
        )}
      </div>

      {!editing ? (
        hasAnyData ? (
          <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {baseline.mealsPerDay && (
              <ReadRowSafe k="평소 식사" v={MEAL_FREQUENCIES.find(o => o.id === baseline.mealsPerDay)?.label} />
            )}
            {baseline.snackFreq && (
              <ReadRowSafe k="간식" v={SNACK_FREQUENCIES.find(o => o.id === baseline.snackFreq)?.label} />
            )}
            {baseline.lateNight && (
              <ReadRowSafe k="야식" v={LATE_NIGHT_EATING.find(o => o.id === baseline.lateNight)?.label} />
            )}
            {baseline.patterns?.length > 0 && (
              <>
                <dt className="text-ink-500 dark:text-slate-400">식이 패턴</dt>
                <dd className="text-right">
                  {baseline.patterns.map(p =>
                    <span key={p} className="chip-brand text-[10px] ml-1">
                      {DIET_PATTERNS.find(o => o.id === p)?.label}
                    </span>
                  )}
                </dd>
              </>
            )}
            {baseline.afterDose && (
              <>
                <dt className="text-ink-500 dark:text-slate-400 col-span-2">주사 후 식이 변화</dt>
                <dd className="col-span-2 text-ink-900 dark:text-slate-100 text-sm leading-snug">
                  "{baseline.afterDose}"
                </dd>
              </>
            )}
            {baseline.notes && (
              <>
                <dt className="text-ink-500 dark:text-slate-400 col-span-2">메모</dt>
                <dd className="col-span-2 text-ink-700 dark:text-slate-300 text-sm leading-snug">
                  {baseline.notes}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <div className="text-sm text-ink-500 dark:text-slate-400 text-center py-3">
            아직 식이습관 정보가 없습니다. 추가하면 약 사용 전후 식이 변화 분석이 가능해져요.
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div>
            <div className="label">평소 하루 식사 횟수</div>
            <div className="grid grid-cols-5 gap-1">
              {MEAL_FREQUENCIES.map(o => (
                <button key={o.id} type="button"
                        onClick={() => setForm(f => ({ ...f, mealsPerDay: o.id }))}
                        className={`py-2 px-1 rounded-lg text-[10px] font-medium border transition
                                    ${form.mealsPerDay === o.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {o.label.replace('하루 ', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">간식 빈도</div>
              <div className="space-y-1.5">
                {SNACK_FREQUENCIES.map(o => (
                  <button key={o.id} type="button"
                          onClick={() => setForm(f => ({ ...f, snackFreq: o.id }))}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-medium border transition text-left
                                      ${form.snackFreq === o.id
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label">야식 빈도</div>
              <div className="space-y-1.5">
                {LATE_NIGHT_EATING.map(o => (
                  <button key={o.id} type="button"
                          onClick={() => setForm(f => ({ ...f, lateNight: o.id }))}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-medium border transition text-left
                                      ${form.lateNight === o.id
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="label">평소 식이 패턴 (다중 선택)</div>
            <div className="flex flex-wrap gap-1.5">
              {DIET_PATTERNS.map(o => (
                <button key={o.id} type="button" onClick={() => togglePattern(o.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                                    ${form.patterns.includes(o.id)
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">주사 후 식이 변화 (선택)</div>
            <textarea className="input min-h-[60px] resize-none" maxLength={200}
                      value={form.afterDose} onChange={e => setForm(f => ({ ...f, afterDose: e.target.value }))}
                      placeholder="예: 투약 직후 2-3일은 거의 안 먹게 됨, 단백질 위주로 챙김" />
          </div>

          <div>
            <div className="label">기타 메모 (선택)</div>
            <textarea className="input min-h-[40px] resize-none" maxLength={300}
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="알레르기, 못 먹는 음식, 평소 즐겨먹는 음식 등" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditing(false)} className="btn-secondary">취소</button>
            <button onClick={save} className="btn-primary">저장</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadRowSafe({ k, v }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-ink-500 dark:text-slate-400">{k}</dt>
      <dd className="text-ink-900 dark:text-slate-100 text-right font-medium">{v}</dd>
    </>
  );
}
