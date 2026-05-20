import React, { useState, useMemo } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { DialInput } from './DialInput.jsx';
import { useToast } from './Toast.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

// 건강 지표 입력 — 체지방률, 근육량, 허리둘레, 혈압, 수면, 컨디션
// 모든 수치는 다이얼 기본. 입력 안 하면 null로 저장.
export function HealthMetricsForm({ user, version, refresh }) {
  const toast = useToast();
  const allMetrics = useMemo(() => Storage.getHealthMetricsByUser(user.id), [user.id, version]);
  const last = allMetrics[allMetrics.length - 1] || {};

  const [date, setDate] = useState(todayISO());
  // 체성분 (인바디)
  const [bodyFatPct, setBodyFatPct] = useState(last.bodyFatPct || 0);
  const [muscleKg, setMuscleKg] = useState(last.muscleKg || 0);
  const [waistCm, setWaistCm] = useState(last.waistCm || 0);
  // 활력
  const [systolicBp, setSystolicBp] = useState(last.systolicBp || 0);
  const [diastolicBp, setDiastolicBp] = useState(last.diastolicBp || 0);
  const [sleepHours, setSleepHours] = useState(last.sleepHours || 0);
  // 혈액 검사 (검사 받았을 때만)
  const [alt, setAlt] = useState(last.alt || 0);
  const [hba1c, setHba1c] = useState(last.hba1c || 0);
  const [notes, setNotes] = useState('');

  const submit = () => {
    Storage.addHealthMetric({
      id: uid('hm'),
      userId: user.id,
      seed: false,
      date,
      bodyFatPct: bodyFatPct > 0 ? +bodyFatPct.toFixed(1) : null,
      muscleKg: muscleKg > 0 ? +muscleKg.toFixed(1) : null,
      waistCm: waistCm > 0 ? +waistCm.toFixed(1) : null,
      systolicBp: systolicBp > 0 ? Math.round(systolicBp) : null,
      diastolicBp: diastolicBp > 0 ? Math.round(diastolicBp) : null,
      sleepHours: sleepHours > 0 ? +sleepHours.toFixed(1) : null,
      alt: alt > 0 ? Math.round(alt) : null,
      hba1c: hba1c > 0 ? +hba1c.toFixed(1) : null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    });
    setNotes('');
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
          💡 측정한 항목만 입력하세요. 0인 항목은 저장 안 됩니다.
        </p>

        {/* 체성분 (인바디) */}
        <details open className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            🧬 체성분 (인바디·체성분 측정기)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <DialInput label="체지방률" unit="%"
                       value={+bodyFatPct} onChange={setBodyFatPct}
                       min={0} max={60} step={0.1} majorTick={5} />
            <DialInput label="근육량" unit="kg"
                       value={+muscleKg} onChange={setMuscleKg}
                       min={0} max={80} step={0.1} majorTick={5} />
            <DialInput label="허리둘레" unit="cm"
                       value={+waistCm} onChange={setWaistCm}
                       min={0} max={150} step={0.5} majorTick={5} />
          </div>
        </details>

        {/* 활력 */}
        <details className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            💗 활력 (혈압·수면)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <DialInput label="수축기 혈압" unit="mmHg"
                       value={+systolicBp} onChange={setSystolicBp}
                       min={0} max={200} step={1} majorTick={10} />
            <DialInput label="이완기 혈압" unit="mmHg"
                       value={+diastolicBp} onChange={setDiastolicBp}
                       min={0} max={130} step={1} majorTick={10} />
            <DialInput label="수면 시간" unit="시간"
                       value={+sleepHours} onChange={setSleepHours}
                       min={0} max={14} step={0.5} majorTick={1} />
          </div>
        </details>

        {/* 혈액 검사 */}
        <details className="rounded-xl border border-ink-200 dark:border-slate-700 p-3">
          <summary className="cursor-pointer font-semibold text-sm text-ink-900 dark:text-slate-100">
            🩸 혈액 검사 (병원 검사 받았을 때)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <DialInput label="ALT (간수치)" unit="U/L"
                       value={+alt} onChange={setAlt}
                       min={0} max={200} step={1} majorTick={20} />
            <DialInput label="HbA1c (당화혈색소)" unit="%"
                       value={+hba1c} onChange={setHba1c}
                       min={0} max={15} step={0.1} majorTick={1} />
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
