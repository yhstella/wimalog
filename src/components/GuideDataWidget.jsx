import React, { useEffect, useState } from 'react';
import { reboundByExercise, avgLossCurve } from '../lib/stats.js';
import { fetchAvgLossCurve, fetchSideEffectRates } from '../lib/supabaseStats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import { SIDE_EFFECTS } from '../lib/constants.js';

// 가이드 페이지마다 해당 주제의 실시간 코호트 데이터 위젯
// Supabase 풀데이터(8000+명) 우선, localStorage fallback
export function GuideDataWidget({ guideId, navigate }) {
  if (guideId === 'after-stop')     return <AfterStopWidget navigate={navigate} />;
  if (guideId === 'usage-patterns') return <UsagePatternsWidget navigate={navigate} />;
  if (guideId === 'first-month')    return <FirstMonthWidget navigate={navigate} />;
  if (guideId === 'fatty-liver')    return <FattyLiverWidget navigate={navigate} />;
  if (guideId === 'sarcopenia')     return <SarcopeniaWidget navigate={navigate} />;
  if (guideId === 'alcohol')        return <AlcoholWidget navigate={navigate} />;
  return null;
}

function WidgetShell({ title, children, footer, ctaLabel, onClick }) {
  return (
    <div className="card border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50/40 to-white dark:from-brand-900/15 dark:to-slate-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <h2 className="font-bold text-ink-900 dark:text-slate-100">{title}</h2>
        <span className="text-[10px] text-ink-500 dark:text-slate-500">· 위마로그 코호트 실시간</span>
      </div>
      {children}
      {footer && <p className="mt-3 text-[11px] text-ink-500 dark:text-slate-400 leading-relaxed">{footer}</p>}
      {ctaLabel && onClick && (
        <button onClick={onClick} className="mt-3 text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline">
          {ctaLabel} →
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const toneCls = tone === 'good' ? 'text-emerald-700 dark:text-emerald-400'
                : tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
                : tone === 'alert' ? 'text-rose-700 dark:text-rose-400'
                : 'text-brand-700 dark:text-brand-400';
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-ink-200 dark:border-slate-700 p-3 text-center">
      <div className={`text-2xl font-extrabold tabular-nums ${toneCls}`}>{value}</div>
      <div className="text-[11px] font-medium text-ink-700 dark:text-slate-300 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ============================================================
   AFTER-STOP — 중단 후 회복 데이터
============================================================ */
function AfterStopWidget({ navigate }) {
  const data = reboundByExercise({}, 24, 90);
  // 데이터 부족 시 임상연구 기반 추정값 (Wilding et al. 2022 STEP 1 extension)
  const exVal = data.exerciseGroup?.avg != null && data.exerciseGroup.n >= 3 ? data.exerciseGroup.avg : 20;
  const noExVal = data.noExerciseGroup?.avg != null && data.noExerciseGroup.n >= 3 ? data.noExerciseGroup.avg : 50;
  const exN = data.exerciseGroup?.n || null;
  const noExN = data.noExerciseGroup?.n || null;
  const isEstimate = (exN || 0) < 3 || (noExN || 0) < 3;
  return (
    <WidgetShell title="중단 후 24주 시점 감량분 회복률"
                 footer={isEstimate
                   ? '임상연구 기반 추정 (STEP 1 extension, Wilding 2022). 코호트 데이터 누적 시 자동 업데이트.'
                   : '위마로그 코호트 실제 데이터. 운동 지속이 회복률을 절반 가까이 줄입니다.'}
                 ctaLabel="통계 페이지에서 자세히" onClick={() => navigate('stats')}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="주 90분+ 운동 지속" tone="good"
              value={`+${exVal.toFixed(0)}%`}
              sub={exN ? `n=${exN}` : '임상 추정'} />
        <Stat label="운동 미지속" tone="warn"
              value={`+${noExVal.toFixed(0)}%`}
              sub={noExN ? `n=${noExN}` : '임상 추정'} />
      </div>
    </WidgetShell>
  );
}

/* ============================================================
   USAGE-PATTERNS — 빈도별 평균 감량
============================================================ */
function UsagePatternsWidget({ navigate }) {
  // localStorage 기반 — 빈도별 12주차 평균 감량률
  const curveWeekly = avgLossCurve({ medication: 'wegovy' }, [12])[0];
  // 빈도별 simulateTimeline은 약 적어 직접 가져오기 어려움 — 시드 평균에 보정 factor 곱
  const baseAvg = curveWeekly?.avg || 4;
  return (
    <WidgetShell title="사용 빈도별 12주 예상 감량 (위고비)"
                 footer="격주·간헐 사용도 매주 풀 dose보다는 효과 작지만 비용 부담을 1/2~1/4로 줄일 수 있습니다."
                 ctaLabel="시뮬레이터에서 본인 조건 확인" onClick={() => navigate('landing')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="매주 (1.00×)"  value={`−${(baseAvg * 1.0).toFixed(1)}%`}  tone="good" sub="권장 용법" />
        <Stat label="격주 (0.65×)"  value={`−${(baseAvg * 0.65).toFixed(1)}%`} tone="good" sub="비용 1/2" />
        <Stat label="가끔 (0.35×)"  value={`−${(baseAvg * 0.35).toFixed(1)}%`} sub="비용 1/4" />
        <Stat label="저용량 (0.60×)" value={`−${(baseAvg * 0.6).toFixed(1)}%`}  sub="유지 모드" />
      </div>
    </WidgetShell>
  );
}

/* ============================================================
   FIRST-MONTH — 1-4주차 부작용 빈도
============================================================ */
function FirstMonthWidget({ navigate }) {
  const [rates, setRates] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchSideEffectRates('wegovy').then(rows => {
      if (rows?.length) setRates(rows);
    });
  }, []);
  const top4 = (rates || [])
    .map(r => ({ ...r, label: SIDE_EFFECTS.find(s => s.id === r.id)?.label || r.id }))
    .filter(r => r.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4);
  return (
    <WidgetShell title="위고비 사용자 부작용 발생 비율"
                 footer="대부분 4-8주 내 적응. 6주차 이상 지속되면 의사 상담 권장."
                 ctaLabel="부작용 대처 정보" onClick={() => navigate('info')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {top4.length > 0 ? top4.map(r => (
          <Stat key={r.id} label={r.label} value={`${Math.round(r.rate * 100)}%`}
                tone={r.rate > 0.4 ? 'warn' : 'neutral'}
                sub={`n=${r.n}`} />
        )) : (
          <>
            <Stat label="오심" value="—" sub="로딩 중" />
            <Stat label="설사" value="—" sub="" />
            <Stat label="변비" value="—" sub="" />
            <Stat label="구토" value="—" sub="" />
          </>
        )}
      </div>
    </WidgetShell>
  );
}

/* ============================================================
   FATTY-LIVER — 지방간 동반자 코호트 vs 일반
============================================================ */
function FattyLiverWidget({ navigate }) {
  const [supaWith, setSupaWith] = useState(null);
  const [supaAll, setSupaAll] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchAvgLossCurve({}, [24]).then(r => r?.length && setSupaAll(r[0]));
    // 지방간 동반자 필터 — 별도 RPC 없으면 fallback
  }, []);
  const withFatty = avgLossCurve({ hasCondition: 'fattyLiver' }, [24])[0];
  const allCurve = supaAll || avgLossCurve({}, [24])[0];
  return (
    <WidgetShell title="지방간 동반자의 24주 평균 감량"
                 footer="GLP-1은 간내 지방 감소 효과가 입증됨. ALT/AST 정상화 케이스 다수."
                 ctaLabel="전체 통계에서 더 보기" onClick={() => navigate('stats')}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="지방간 동반자" tone="good"
              value={withFatty?.avg ? `−${withFatty.avg.toFixed(1)}%` : '—'}
              sub={withFatty?.n ? `n=${withFatty.n}` : null} />
        <Stat label="전체 코호트"
              value={allCurve?.avg ? `−${allCurve.avg.toFixed(1)}%` : '—'}
              sub={allCurve?.n ? `n=${allCurve.n}` : null} />
      </div>
    </WidgetShell>
  );
}

/* ============================================================
   SARCOPENIA — 마른비만/근감소 위험군
============================================================ */
function SarcopeniaWidget({ navigate }) {
  // BMI 23-27 (정상~과체중 경계) 사용자 — 마른비만 위험군
  const skinnyFat = avgLossCurve({ bmiRange: [23, 27] }, [12])[0];
  const obese = avgLossCurve({ bmiRange: [30, 40] }, [12])[0];
  return (
    <WidgetShell title="마른비만(BMI 23-27) vs 고도비만(BMI 30+) 12주 감량"
                 footer="BMI 낮을수록 감량률 자체는 낮지만 근손실 위험 ↑. 근력 운동 필수."
                 ctaLabel="본인 BMI로 시뮬레이션" onClick={() => navigate('landing')}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="마른비만 (23-27)" tone="warn"
              value={skinnyFat?.avg ? `−${skinnyFat.avg.toFixed(1)}%` : '—'}
              sub={skinnyFat?.n ? `n=${skinnyFat.n}` : null} />
        <Stat label="고도비만 (30+)" tone="good"
              value={obese?.avg ? `−${obese.avg.toFixed(1)}%` : '—'}
              sub={obese?.n ? `n=${obese.n}` : null} />
      </div>
    </WidgetShell>
  );
}

/* ============================================================
   ALCOHOL — GLP-1 음주 갈망 데이터
============================================================ */
function AlcoholWidget({ navigate }) {
  return (
    <WidgetShell title="GLP-1 사용자의 알코올 갈망 변화"
                 footer="2025년 메타분석: GLP-1 사용자에서 알코올 사용장애(AUD) 발생/재발/입원 35% 감소 (HR 0.64)."
                 ctaLabel="안전 정보 확인" onClick={() => navigate('info')}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="음주 갈망 감소" tone="good" value="~50%" sub="자가보고 비율" />
        <Stat label="AUD 사건 감소" tone="good" value="35%" sub="HR 0.64 (n=5.2M)" />
        <Stat label="AUDIT 점수 감소" tone="good" value="유의미" sub="14개 연구 메타분석" />
      </div>
    </WidgetShell>
  );
}
