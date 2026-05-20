import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';

// 건강지표 입력 시 자동으로 unlock되는 본인 vs 표준/코호트 비교 카드들
// 입력 안 된 항목은 노출 안 됨 → 사용자가 입력하면 즉시 새 인사이트 등장
export function UnlockedInsights({ user }) {
  const cards = useMemo(() => buildCards(user), [user]);
  if (!user || cards.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔬</span>
        <h2 className="font-bold text-ink-900 dark:text-slate-100">건강지표 인사이트</h2>
        <span className="text-[10px] text-ink-500 dark:text-slate-500">· 본인 데이터 기반 자동 분석</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {cards.map((c, i) => <InsightCard key={i} {...c} />)}
      </div>
    </div>
  );
}

function InsightCard({ icon, title, items, verdict, verdictTone }) {
  const toneClass = verdictTone === 'good'
    ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200'
    : verdictTone === 'warn'
    ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200'
    : verdictTone === 'alert'
    ? 'bg-rose-50 dark:bg-rose-900/15 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200'
    : 'bg-ink-100 dark:bg-slate-800 border-ink-200 dark:border-slate-700 text-ink-700 dark:text-slate-300';
  return (
    <div className="rounded-xl border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center gap-1.5 text-sm font-bold text-ink-900 dark:text-slate-100 mb-2">
        <span>{icon}</span><span>{title}</span>
      </div>
      <div className="space-y-1 text-xs text-ink-700 dark:text-slate-300">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between items-baseline gap-2">
            <span>{it.label}</span>
            <span className="font-semibold tabular-nums text-ink-900 dark:text-slate-100">{it.value}</span>
          </div>
        ))}
      </div>
      {verdict && (
        <div className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${toneClass}`}>
          {verdict}
        </div>
      )}
    </div>
  );
}

function buildCards(user) {
  const cards = [];
  const health = Storage.getHealthMetricsByUser(user.id);

  // ====== 인바디 ======
  const inbody = health.filter(h => h.category === 'inbody');
  const lastInbody = inbody[inbody.length - 1];
  if (lastInbody) {
    const items = [];
    let verdict = null, tone = 'neutral';
    // 체지방률 표준 (한국): 남 15-25%, 여 20-30%
    if (lastInbody.bodyFatPct != null) {
      const isM = user.gender === 'M';
      const normalMax = isM ? 25 : 30;
      const normalMin = isM ? 15 : 20;
      items.push({
        label: `체지방률 (정상 ${normalMin}-${normalMax}%)`,
        value: `${lastInbody.bodyFatPct}%`,
      });
      if (lastInbody.bodyFatPct > normalMax + 5) { verdict = '⚠ 체지방 높음 — 근력 운동 + 단백질 권장'; tone = 'warn'; }
      else if (lastInbody.bodyFatPct >= normalMin && lastInbody.bodyFatPct <= normalMax) { verdict = '✓ 체지방 정상 범위'; tone = 'good'; }
    }
    if (lastInbody.muscleKg != null) {
      items.push({ label: '근육량', value: `${lastInbody.muscleKg} kg` });
    }
    if (lastInbody.waistCm != null) {
      const waistRisk = user.gender === 'M' ? 90 : 85;  // 한국인 복부비만 기준
      items.push({ label: `허리둘레 (위험 ${waistRisk}cm+)`, value: `${lastInbody.waistCm} cm` });
      if (lastInbody.waistCm >= waistRisk && tone !== 'warn') {
        verdict = (verdict ? verdict + ' · ' : '') + '⚠ 복부비만 기준 초과';
        tone = 'warn';
      }
    }
    if (items.length) cards.push({ icon: '💪', title: '인바디', items, verdict, verdictTone: tone });
  }

  // ====== 혈액검사 ======
  const blood = health.filter(h => h.category === 'blood');
  const lastBlood = blood[blood.length - 1];
  if (lastBlood) {
    const items = [];
    let verdict = null, tone = 'neutral';
    if (lastBlood.alt != null) {
      items.push({ label: 'ALT (정상 <40 U/L)', value: lastBlood.alt });
      if (lastBlood.alt > 40) { verdict = '⚠ ALT 상승 — 지방간 가능성, 의사 상담 권장'; tone = 'warn'; }
    }
    if (lastBlood.hba1c != null) {
      items.push({ label: 'HbA1c (정상 <5.7%)', value: `${lastBlood.hba1c}%` });
      if (lastBlood.hba1c >= 6.5) { verdict = '⚠ 당뇨 진단 기준 — 의사 상담 필수'; tone = 'alert'; }
      else if (lastBlood.hba1c >= 5.7) {
        verdict = (verdict ? verdict + ' · ' : '') + '⚠ 전당뇨 범위 (5.7-6.4%)';
        if (tone !== 'alert') tone = 'warn';
      }
    }
    if (items.length && !verdict) { verdict = '✓ 정상 범위'; tone = 'good'; }
    if (items.length) cards.push({ icon: '🩸', title: '혈액검사', items, verdict, verdictTone: tone });
  }

  // ====== 혈압 ======
  const bp = health.filter(h => h.category === 'bp');
  const lastBp = bp[bp.length - 1];
  if (lastBp && lastBp.sbp && lastBp.dbp) {
    const items = [
      { label: '수축기 (정상 <120)', value: `${lastBp.sbp} mmHg` },
      { label: '이완기 (정상 <80)', value: `${lastBp.dbp} mmHg` },
    ];
    let verdict, tone;
    if (lastBp.sbp >= 140 || lastBp.dbp >= 90) { verdict = '⚠ 고혈압 진단 기준 — 의사 상담'; tone = 'alert'; }
    else if (lastBp.sbp >= 130 || lastBp.dbp >= 85) { verdict = '⚠ 고혈압 전단계 — 식이/운동 점검'; tone = 'warn'; }
    else { verdict = '✓ 정상 혈압'; tone = 'good'; }
    cards.push({ icon: '❤️', title: '혈압', items, verdict, verdictTone: tone });
  }

  // ====== 음주 ======
  const alcohol = health.filter(h => h.category === 'alcohol');
  const lastAlcohol = alcohol[alcohol.length - 1];
  if (lastAlcohol) {
    const items = [];
    let verdict = null, tone = 'neutral';
    if (lastAlcohol.drinksPerWeek != null) {
      const weekRisk = user.gender === 'M' ? 14 : 7;  // WHO 권장 한계 (잔/주)
      items.push({ label: `주당 음주 (권장 ≤${weekRisk}잔)`, value: `${lastAlcohol.drinksPerWeek}잔` });
      if (lastAlcohol.drinksPerWeek > weekRisk) { verdict = '⚠ WHO 권장 초과'; tone = 'warn'; }
    }
    if (lastAlcohol.cravingChange != null) {
      const labels = ['크게 감소', '감소', '약간 감소', '비슷', '평소'];
      items.push({ label: '약 시작 후 갈망', value: labels[lastAlcohol.cravingChange - 1] || '—' });
      if (lastAlcohol.cravingChange <= 2 && tone !== 'warn') {
        verdict = (verdict ? verdict + ' · ' : '') + '✓ GLP-1 알코올 갈망 감소 효과 확인';
        tone = 'good';
      }
    }
    if (items.length) cards.push({ icon: '🍺', title: '음주', items, verdict, verdictTone: tone });
  }

  // ====== 수면·스트레스 ======
  const sleep = health.filter(h => h.category === 'sleep');
  const lastSleep = sleep[sleep.length - 1];
  if (lastSleep) {
    const items = [];
    let verdict = null, tone = 'neutral';
    if (lastSleep.sleepHours != null) {
      items.push({ label: '수면 시간 (권장 7-9시간)', value: `${lastSleep.sleepHours}시간` });
      if (lastSleep.sleepHours < 6) { verdict = '⚠ 수면 부족 — 정체기 위험 증가'; tone = 'warn'; }
      else if (lastSleep.sleepHours >= 7 && lastSleep.sleepHours <= 9) { verdict = '✓ 적정 수면'; tone = 'good'; }
    }
    if (lastSleep.stressLevel != null) {
      items.push({ label: '스트레스 (1-5)', value: `${lastSleep.stressLevel}/5` });
      if (lastSleep.stressLevel >= 4 && tone !== 'warn') {
        verdict = (verdict ? verdict + ' · ' : '') + '⚠ 높은 스트레스 — 코르티솔 ↑ 감량 둔화 위험';
        tone = 'warn';
      }
    }
    if (items.length) cards.push({ icon: '😴', title: '수면·스트레스', items, verdict, verdictTone: tone });
  }

  return cards;
}
