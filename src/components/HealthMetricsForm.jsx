import React, { useState, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { DialInput } from './DialInput.jsx';
import { useToast } from './Toast.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

// 키/체중 기반 추정 기본값 — 0에서 시작 안 하게.
// Deurenberg formula 단순화 + 한국 성인 평균. 모르는 값은 합리적 평균.
function inferDefaults(user) {
  const h = +user?.height || 165;             // 모르면 한국 성인 평균 키
  const w = +user?.startWeight || 72;          // 모르면 평균 체중
  const bmi = w / ((h / 100) ** 2);
  const sex = user?.gender;
  const isM = sex === 'M';
  const ageNum = (() => {
    const g = user?.ageGroup || '40s';
    const m = g.match(/(\d+)/);
    return m ? +m[1] + 5 : 45;
  })();
  // 체지방률 — Deurenberg: 1.20×BMI + 0.23×age - 10.8×(male=1, female=0) - 5.4
  const bodyFatPct = Math.round(1.20 * bmi + 0.23 * ageNum - (isM ? 16.2 : 5.4));
  // 근육량 (kg) — 제지방량의 약 50%
  const leanMass = w * (1 - bodyFatPct / 100);
  const muscleKg = +(leanMass * 0.50).toFixed(1);
  // 허리둘레 — BMI 기반
  const waistCm = isM
    ? Math.round(70 + 2.0 * (bmi - 18))
    : Math.round(65 + 1.9 * (bmi - 18));
  return {
    bodyFatPct: Math.max(15, Math.min(45, bodyFatPct)),
    muscleKg: Math.max(20, Math.min(70, muscleKg)),
    waistCm: Math.max(60, Math.min(130, waistCm)),
    systolicBp: 122,    // 정상 평균
    diastolicBp: 78,
    sleepHours: 7.0,    // 권장 평균
    alt: 22,            // 정상 범위 중간 (<40)
    hba1c: 5.5,         // 정상 범위 중간 (<5.7)
  };
}

// 건강 지표 입력 — 체지방률·근육량·허리둘레·혈압·수면·컨디션
// 모든 수치는 다이얼 기본. 사용자가 만진(touched) field만 저장 → 안 만진 건 null.
export function HealthMetricsForm({ user, version, refresh }) {
  const toast = useToast();
  const allMetrics = useMemo(() => Storage.getHealthMetricsByUser(user.id), [user.id, version]);
  const last = allMetrics[allMetrics.length - 1] || {};
  const defaults = useMemo(() => inferDefaults(user), [user]);

  // 마지막 저장값 우선, 없으면 키/체중 기반 추정 default
  const [date, setDate] = useState(todayISO());
  const [bodyFatPct, setBodyFatPct] = useState(last.bodyFatPct || defaults.bodyFatPct);
  const [muscleKg, setMuscleKg] = useState(last.muscleKg || defaults.muscleKg);
  const [waistCm, setWaistCm] = useState(last.waistCm || defaults.waistCm);
  const [systolicBp, setSystolicBp] = useState(last.systolicBp || defaults.systolicBp);
  const [diastolicBp, setDiastolicBp] = useState(last.diastolicBp || defaults.diastolicBp);
  const [sleepHours, setSleepHours] = useState(last.sleepHours || defaults.sleepHours);
  const [alt, setAlt] = useState(last.alt || defaults.alt);
  const [hba1c, setHba1c] = useState(last.hba1c || defaults.hba1c);
  const [notes, setNotes] = useState('');

  // touched: 사용자가 그 다이얼을 의도적으로 만졌는지 — 안 만진 필드는 null로 저장
  const [touched, setTouched] = useState({});
  const mark = (k) => setTouched(t => ({ ...t, [k]: true }));

  const submit = () => {
    Storage.addHealthMetric({
      id: uid('hm'),
      userId: user.id,
      seed: false,
      date,
      bodyFatPct: touched.bodyFatPct ? +bodyFatPct.toFixed(1) : null,
      muscleKg: touched.muscleKg ? +muscleKg.toFixed(1) : null,
      waistCm: touched.waistCm ? +waistCm.toFixed(1) : null,
      systolicBp: touched.systolicBp ? Math.round(systolicBp) : null,
      diastolicBp: touched.diastolicBp ? Math.round(diastolicBp) : null,
      sleepHours: touched.sleepHours ? +sleepHours.toFixed(1) : null,
      alt: touched.alt ? Math.round(alt) : null,
      hba1c: touched.hba1c ? +hba1c.toFixed(1) : null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    });
    setNotes('');
    setTouched({});
    refresh();
    toast.success('건강 지표 기록됨');
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <div className="label">측정일</div>
            <input type="date" className="input" value={date} max={todayISO()}
                   onChange={e => setDate(e.target.value)} />
          </div>
          <button onClick={submit} className="btn-primary !py-2.5 !px-4 h-fit">저장</button>
        </div>

        <p className="text-xs text-ink-500 dark:text-slate-400">
          💡 기본값은 본인 키·체중 기반 추정값입니다. 측정한 항목만 다이얼을 움직여 본인 값으로 조정하세요. 변경한 항목만 저장됩니다.
        </p>

        {/* 체성분 (인바디) */}
        <details open className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            🧬 체성분 (인바디·체성분 측정기)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <DialInput label={`체지방률${touched.bodyFatPct ? '' : ' (추정)'}`} unit="%"
                       value={+bodyFatPct} onChange={(v) => { mark('bodyFatPct'); setBodyFatPct(v); }}
                       min={5} max={60} step={0.1} majorTick={5} highlight={touched.bodyFatPct} />
            <DialInput label={`근육량${touched.muscleKg ? '' : ' (추정)'}`} unit="kg"
                       value={+muscleKg} onChange={(v) => { mark('muscleKg'); setMuscleKg(v); }}
                       min={15} max={80} step={0.1} majorTick={5} highlight={touched.muscleKg} />
            <DialInput label={`허리둘레${touched.waistCm ? '' : ' (추정)'}`} unit="cm"
                       value={+waistCm} onChange={(v) => { mark('waistCm'); setWaistCm(v); }}
                       min={50} max={150} step={0.5} majorTick={5} highlight={touched.waistCm} />
          </div>
        </details>

        {/* 활력 */}
        <details className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            💗 활력 (혈압·수면)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <DialInput label={`수축기 혈압${touched.systolicBp ? '' : ' (정상 평균)'}`} unit="mmHg"
                       value={+systolicBp} onChange={(v) => { mark('systolicBp'); setSystolicBp(v); }}
                       min={70} max={200} step={1} majorTick={10} highlight={touched.systolicBp} />
            <DialInput label={`이완기 혈압${touched.diastolicBp ? '' : ' (정상 평균)'}`} unit="mmHg"
                       value={+diastolicBp} onChange={(v) => { mark('diastolicBp'); setDiastolicBp(v); }}
                       min={40} max={130} step={1} majorTick={10} highlight={touched.diastolicBp} />
            <DialInput label={`수면 시간${touched.sleepHours ? '' : ' (권장 평균)'}`} unit="시간"
                       value={+sleepHours} onChange={(v) => { mark('sleepHours'); setSleepHours(v); }}
                       min={3} max={14} step={0.5} majorTick={1} highlight={touched.sleepHours} />
          </div>
        </details>

        {/* 혈액 검사 */}
        <details className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            🩸 혈액 검사 (병원 검사 받았을 때)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <DialInput label={`ALT (간수치)${touched.alt ? '' : ' (정상 평균)'}`} unit="U/L"
                       value={+alt} onChange={(v) => { mark('alt'); setAlt(v); }}
                       min={5} max={200} step={1} majorTick={20} highlight={touched.alt} />
            <DialInput label={`HbA1c (당화혈색소)${touched.hba1c ? '' : ' (정상 평균)'}`} unit="%"
                       value={+hba1c} onChange={(v) => { mark('hba1c'); setHba1c(v); }}
                       min={4} max={15} step={0.1} majorTick={1} highlight={touched.hba1c} />
          </div>
        </details>

        <div>
          <div className="label">메모 (선택)</div>
          <input type="text" className="input" maxLength={100}
                 value={notes} onChange={e => setNotes(e.target.value)}
                 placeholder="예: 인바디 측정, 정기 검진" />
        </div>
      </div>

      {allMetrics.length > 0 && (
        <div className="rounded-xl bg-ink-100/50 dark:bg-slate-800/40 px-3 py-2 text-xs text-ink-500 dark:text-slate-400 flex items-center justify-between">
          <span>총 <b className="text-ink-700 dark:text-slate-200 tabular-nums">{allMetrics.length}</b>개 건강 지표</span>
          {allMetrics[allMetrics.length - 1]?.date && <span>마지막: {allMetrics[allMetrics.length - 1].date}</span>}
        </div>
      )}
    </div>
  );
}
