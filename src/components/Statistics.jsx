import React, { useEffect, useMemo, useState } from 'react';
import { fetchAvgLossCurve, fetchSideEffectRates, fetchPriceStats, fetchPlatformScale,
         fetchDiscontinuationStats, fetchReboundCurve } from '../lib/supabaseStats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import {
  avgLossCurve, cohortSize, sideEffectRates, discontinuationStats,
  compareMedications, similarFilter, priceStats, exerciseStats, primaryCourse,
  reboundCurve, reboundByExercise, reboundByMedication,
  personalSummaryForCourse, sideEffectTiming, successPattern, personalPercentile,
  cohortDietByPhase, exerciseDistribution, relaxFilter,
} from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { LineChart, HBarChart, GroupBarChart } from './Chart.jsx';
import { MEDS, GENDERS, AGE_GROUPS, CONDITIONS, SIDE_EFFECTS } from '../lib/constants.js';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { LockedOverlay, LockHint, PremiumBadge, FreeBadge, FuturePricingHint, QuickSignupModal } from './Paywall.jsx';
import { can } from '../lib/access.js';
import { StopProjector } from './StopProjector.jsx';

const BMI_RANGES = [
  { id: 'all',   label: '전체',  range: null },
  { id: 'r25',   label: '25–28', range: [25, 28] },
  { id: 'r28',   label: '28–30', range: [28, 30] },
  { id: 'r30',   label: '30–33', range: [30, 33] },
  { id: 'r33',   label: '33–37', range: [33, 37] },
  { id: 'r37',   label: '37+',   range: [37, 99] },
];

export function Statistics({ user, navigate, onSignup }) {
  const [showSignup, setShowSignup] = useState(false);
  const [platformScale, setPlatformScale] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    let tries = 0;
    const tryFetch = async () => {
      try {
        const r = await fetchPlatformScale();
        if (!cancelled && r) setPlatformScale(r);
        else if (!cancelled && ++tries < 3) setTimeout(tryFetch, 1500);
      } catch {
        if (!cancelled && ++tries < 3) setTimeout(tryFetch, 1500);
      }
    };
    tryFetch();
    return () => { cancelled = true; };
  }, []);
  const myCourse = useMemo(() => user ? primaryCourse(Storage.getMedCoursesByUser(user.id)) : null, [user]);

  const [filter, setFilter] = useState(() => user ? {
    ...similarFilter(user, myCourse),
    _similarApplied: !!myCourse,
  } : {
    medication: 'all', gender: 'all', ageGroup: 'all', bmiRange: null, hasCondition: '',
  });

  const rawFilter = useMemo(() => {
    const f = { ...filter };
    delete f._similarApplied;
    if (f.medication === 'all') delete f.medication;
    if (f.gender === 'all') delete f.gender;
    if (f.ageGroup === 'all') delete f.ageGroup;
    if (!f.hasCondition) delete f.hasCondition;
    return f;
  }, [filter]);

  // 필터 자동 완화 — 데이터 부족 시 한 단계씩 (BMI 확장 → 동반질환 제거 → 나이대/성별 제거)
  // localStorage 기반 — Supabase 결과가 충분하면 아래서 덮어씀
  const relaxed = useMemo(() => relaxFilter(rawFilter, 30), [rawFilter]);
  const cleanFilter = relaxed.filter;

  // Supabase 풀 데이터 (8000+명) — RPC 호출, 결과 있으면 localStorage보다 우선
  const [supaCurve, setSupaCurve] = useState(null);
  const [supaSides, setSupaSides] = useState(null);
  const [supaPrice, setSupaPrice] = useState(null);
  const [supaStop, setSupaStop] = useState(null);
  const [supaRebound, setSupaRebound] = useState(null);
  // cleanFilter 변경 시 Supabase fetch (cleanFilter는 객체라 JSON.stringify로 deps)
  const filterKey = JSON.stringify(cleanFilter);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    Promise.all([
      fetchAvgLossCurve(cleanFilter, [1, 2, 4, 8, 12, 16, 24, 36, 48]),
      fetchSideEffectRates(cleanFilter.medication),
      fetchPriceStats(cleanFilter.medication),
      fetchDiscontinuationStats(cleanFilter.medication),
      fetchReboundCurve(cleanFilter.medication, [2, 4, 8, 12, 24, 36, 48]),
    ]).then(([curve, sides, price, stop, rebound]) => {
      if (cancelled) return;
      if (curve && curve.some(c => c.n > 0)) setSupaCurve(curve);
      if (sides && sides.length) setSupaSides(sides);
      if (price && price.byRegion?.length) setSupaPrice(price);
      if (stop && stop.n > 0) setSupaStop(stop);
      if (rebound && rebound.some(r => r.n > 0)) setSupaRebound(rebound);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [filterKey]);

  const localCurve = useMemo(() => avgLossCurve(cleanFilter), [cleanFilter]);
  const curve = supaCurve || localCurve;
  // n: Supabase의 1주차 n (대표 cohort size), 없으면 relaxed.n
  const supaCohortN = supaCurve?.find(c => c.week === 1)?.n
    || supaCurve?.reduce((m, c) => Math.max(m, c.n || 0), 0);
  const n = supaCohortN || relaxed.n;

  const localSides = useMemo(() => sideEffectRates(cleanFilter), [cleanFilter]);
  const sideRates  = supaSides
    ? supaSides.map(s => ({ id: s.id, rate: s.rate, n: s.n }))
    : localSides;
  const localStop = useMemo(() => discontinuationStats(cleanFilter), [cleanFilter]);
  // Supabase rate/reasons shape으로 변환 + localStop 구조에 맞춤
  const stopStats = supaStop
    ? {
        n: supaStop.n,
        discontinued: supaStop.discontinued,
        rate: supaStop.rate,
        reasons: localStop.reasons.map(r => {
          const s = supaStop.reasons.find(x => x.id === r.id);
          return s ? { ...r, count: s.count, rate: s.rate } : r;
        }),
      }
    : localStop;
  const localPrice = useMemo(() => priceStats(cleanFilter), [cleanFilter]);
  const priceData  = supaPrice || localPrice;
  const exData     = useMemo(() => exerciseStats(cleanFilter), [cleanFilter]);
  // 코호트 너무 좁으면 (n<10) 자동으로 wide filter — '0분 100%' 같은 왜곡 방지
  const exDist = useMemo(() => {
    const tight = exerciseDistribution(cleanFilter);
    if (tight.n >= 10) return tight;
    return { ...exerciseDistribution({}), _widened: true };
  }, [cleanFilter]);
  const localRebound = useMemo(() => reboundCurve(cleanFilter), [cleanFilter]);
  // Supabase rebound는 avgGainPct/avgRegainRatio shape — 기존 localRebound shape에 매핑
  const reboundData = supaRebound
    ? supaRebound.map(r => ({
        week: r.week, n: r.n,
        avgGainPct: r.avgGainPct,
        avgRegainRatio: r.avgRegainRatio,
        medianGainPct: null,
      }))
    : localRebound;
  const reboundByEx = useMemo(() => reboundByExercise(cleanFilter, 24), [cleanFilter]);
  const reboundByMed = useMemo(() => {
    const base = { ...cleanFilter };
    delete base.medication;
    return reboundByMedication(base, 24);
  }, [cleanFilter]);
  const medCompare = useMemo(() => {
    const base = { ...cleanFilter };
    delete base.medication;
    return compareMedications(base, 12);
  }, [cleanFilter]);

  // 본인 코호트 비교용 (가입자 + 코스 있음)
  const myLogs = useMemo(() => user ? Storage.getLogsByUser(user.id) : [], [user]);
  const myPersonalCurve = useMemo(() => {
    if (!user || !myCourse) return [];
    const summary = personalSummaryForCourse(user, myLogs, myCourse);
    if (!summary) return [];
    // 약 시작 시점부터 본인 weekly weight 계산
    const sortedLogs = [...myLogs].sort((a, b) => a.date.localeCompare(b.date));
    const startMs = new Date(myCourse.startDate).getTime();
    const points = sortedLogs
      .map(l => {
        const wk = Math.floor((new Date(l.date).getTime() - startMs) / (7 * 86400000));
        if (wk < 0) return null;
        return { wk, weight: l.weight };
      })
      .filter(Boolean);
    if (!points.length) return [];
    return curve.map(c => {
      const reached = points.find(p => p.wk >= c.week);
      if (!reached) return { week: c.week, lossPct: null };
      return {
        week: c.week,
        lossPct: ((summary.startWeight - reached.weight) / summary.startWeight) * 100,
      };
    });
  }, [user, myCourse, myLogs, curve]);

  // 가입자 본인 시작 체중 기준 kg 환산 (없으면 평균 80kg 가정)
  const refWeight = user?.startWeight ?? 80;
  const lineData = useMemo(() =>
    curve.filter(c => c.avg != null).map(c => ({
      x: c.week, y: -refWeight * c.avg / 100, label: `${c.week}주`,
    })), [curve, refWeight]);
  const topLineData = useMemo(() =>
    curve.filter(c => c.top25Avg != null).map(c => ({
      x: c.week, y: -refWeight * c.top25Avg / 100, label: `${c.week}주`,
    })), [curve, refWeight]);

  const set = (k, v) => setFilter(f => ({ ...f, [k]: v, _similarApplied: false }));

  const applySimilar = () => {
    if (!user) return;
    setFilter({ ...similarFilter(user, myCourse), _similarApplied: true });
  };
  const resetFilter = () => setFilter({ medication: 'all', gender: 'all', ageGroup: 'all', bmiRange: null, hasCondition: '' });

  const handleSignup = () => setShowSignup(true);
  const onSignupComplete = (userId) => {
    setShowSignup(false);
    onSignup?.(userId);
  };

  // Supabase 실시간 통계 (현재 필터로 조회) — 페이지 상단 요약 카드
  const [supaSummary, setSupaSummary] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const [scale, curve12, curve24] = await Promise.all([
          fetchPlatformScale(),
          fetchAvgLossCurve(cleanFilter, [12]),
          fetchAvgLossCurve(cleanFilter, [24]),
        ]);
        if (cancelled) return;
        setSupaSummary({
          totalPatients: scale?.totalPatients ?? null,
          avg12: curve12?.[0],
          avg24: curve24?.[0],
        });
      } catch (e) {
        console.warn('[Statistics] supabase fetch failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [cleanFilter]);

  // 비가입자에겐 처음 4주차까지만 표시
  const visibleCurve = !user ? curve.slice(0, 3) : curve;
  const hiddenCurveCount = !user ? curve.length - 3 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-2 items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-slate-100">통계</h1>
          <p className="text-sm text-ink-500 dark:text-slate-400 mt-1">
            필터된 사용자 코호트의 익명 데이터입니다.
          </p>
        </div>
        <div className="flex gap-2">
          {user && (
            <button onClick={applySimilar}
                    className={`btn-secondary !py-2 !px-3 text-xs ${filter._similarApplied ? 'border-brand-400 bg-brand-50' : ''}`}>
              나와 비슷한 사용자만
            </button>
          )}
          <button onClick={resetFilter} className="btn-ghost text-xs">초기화</button>
        </div>
      </div>

      {!user && (
        <div className="rounded-2xl border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 p-4 flex items-start gap-3">
          <div className="text-2xl">👋</div>
          <div className="flex-1">
            <div className="font-bold text-ink-900 dark:text-slate-100">지금 보고 계신 것은 전체 데이터의 일부입니다</div>
            <div className="text-sm text-ink-500 dark:text-slate-400 mt-1">
              본인 키·체중·약만 입력하면 실사용자 익명 데이터의 전체 평균 곡선·약제 비교·지역별 가격·부작용 발생률을 모두 보여드려요.
            </div>
          </div>
          <button onClick={handleSignup} className="btn-primary !py-2 !px-3 text-sm flex-shrink-0">
            내 감량 곡선 보기 →
          </button>
        </div>
      )}

      {/* Supabase 실시간 코호트 요약 — DB 11000명+ 진짜 통계 */}
      {supaSummary && supaSummary.totalPatients > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-bold text-ink-900 dark:text-slate-100">실시간 DB 통계</h2>
            <span className="text-[10px] text-ink-500 dark:text-slate-500">위마로그 익명 코호트</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="text-center rounded-xl bg-ink-100/40 dark:bg-slate-800/40 p-3">
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-ink-900 dark:text-slate-100">
                {supaSummary.totalPatients.toLocaleString()}<span className="text-xs font-bold opacity-70 ml-0.5">명</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-ink-500 dark:text-slate-400 mt-1">전체 코호트</div>
            </div>
            <div className="text-center rounded-xl bg-ink-100/40 dark:bg-slate-800/40 p-3">
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-brand-700 dark:text-brand-400">
                {supaSummary.avg12?.avg != null ? `−${Number(supaSummary.avg12.avg).toFixed(1)}` : '—'}
                <span className="text-xs font-bold opacity-70 ml-0.5">%</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-ink-500 dark:text-slate-400 mt-1">12주 평균 감량</div>
              {supaSummary.avg12?.n != null && (
                <div className="text-[9px] text-ink-500 dark:text-slate-500">n={supaSummary.avg12.n}</div>
              )}
            </div>
            <div className="text-center rounded-xl bg-ink-100/40 dark:bg-slate-800/40 p-3">
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-brand-700 dark:text-brand-400">
                {supaSummary.avg24?.avg != null ? `−${Number(supaSummary.avg24.avg).toFixed(1)}` : '—'}
                <span className="text-xs font-bold opacity-70 ml-0.5">%</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-ink-500 dark:text-slate-400 mt-1">24주 평균 감량</div>
              {supaSummary.avg24?.n != null && (
                <div className="text-[9px] text-ink-500 dark:text-slate-500">n={supaSummary.avg24.n}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 콘텐츠 페이지 빠른 진입 (검색 친화) */}
      <div className="flex gap-2 flex-wrap text-xs">
        <button onClick={() => navigate('compare')} className="px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 font-semibold transition">
          ⚖️ 5개 약 비교
        </button>
        <button onClick={() => navigate('drug/wegovy')} className="px-3 py-1.5 rounded-full bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-300/40 transition">
          💉 위고비 상세
        </button>
        <button onClick={() => navigate('drug/mounjaro')} className="px-3 py-1.5 rounded-full bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-300/40 transition">
          💉 마운자로 상세
        </button>
        <button onClick={() => navigate('guide/before-use')} className="px-3 py-1.5 rounded-full bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-300/40 transition">
          📋 시작 전 점검
        </button>
        <button onClick={() => navigate('calc/cost')} className="px-3 py-1.5 rounded-full bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-ink-300/40 transition">
          💰 비용 계산기
        </button>
      </div>

      {/* 세그먼트별 빠른 진입 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => set('medication', 'wegovy')}
                className="card !p-3 text-center hover:shadow-cardHover transition group">
          <div className="text-xl">💉</div>
          <div className="text-xs font-semibold mt-1 text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">위고비 사용자</div>
        </button>
        <button onClick={() => set('medication', 'mounjaro')}
                className="card !p-3 text-center hover:shadow-cardHover transition group">
          <div className="text-xl">💉</div>
          <div className="text-xs font-semibold mt-1 text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">마운자로 사용자</div>
        </button>
        <button onClick={() => navigate('guide/after-stop')}
                className="card !p-3 text-center hover:shadow-cardHover transition group">
          <div className="text-xl">📉</div>
          <div className="text-xs font-semibold mt-1 text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">중단자 가이드</div>
        </button>
        <button onClick={() => navigate('guide/diet-only')}
                className="card !p-3 text-center hover:shadow-cardHover transition group">
          <div className="text-xl">🥗</div>
          <div className="text-xs font-semibold mt-1 text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">다이어트만</div>
        </button>
      </div>

      {/* 필터 */}
      <div className="card space-y-3">
        <FilterRow label="약제">
          <FilterChips
            options={[{ id: 'all', label: '전체' }, ...MEDS.map(m => ({ id: m.id, label: m.label }))]}
            value={filter.medication ?? 'all'}
            onChange={v => set('medication', v)}
          />
        </FilterRow>
        <FilterRow label="성별">
          <FilterChips
            options={[{ id: 'all', label: '전체' }, ...GENDERS]}
            value={filter.gender ?? 'all'}
            onChange={v => set('gender', v)}
          />
        </FilterRow>
        <FilterRow label="나이대">
          <FilterChips
            options={[{ id: 'all', label: '전체' }, ...AGE_GROUPS]}
            value={filter.ageGroup ?? 'all'}
            onChange={v => set('ageGroup', v)}
          />
        </FilterRow>
        <FilterRow label="시작 BMI">
          <FilterChips
            options={BMI_RANGES}
            value={
              filter.bmiRange == null ? 'all' :
              BMI_RANGES.find(r => r.range && r.range[0] === filter.bmiRange[0])?.id ?? 'all'
            }
            onChange={v => {
              const r = BMI_RANGES.find(x => x.id === v);
              set('bmiRange', r?.range ?? null);
            }}
          />
        </FilterRow>
        <FilterRow label="동반질환">
          <FilterChips
            options={[{ id: '', label: '전체' }, ...CONDITIONS]}
            value={filter.hasCondition ?? ''}
            onChange={v => set('hasCondition', v)}
          />
        </FilterRow>
      </div>

      {/* 전체 코호트 규모 — 사용자에게 모집단 크기 명확히 */}
      {platformScale && (
        <div className="rounded-xl bg-brand-50 dark:bg-brand-900/15 border border-brand-200 dark:border-brand-800/40 px-4 py-3 text-sm text-ink-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
          <span className="text-base">💚</span>
          <span>
            위마로그 익명 코호트 <b className="text-brand-700 dark:text-brand-400 tabular-nums">{platformScale.totalPatients.toLocaleString()}명</b>
            {' · '}체중 기록 <b className="tabular-nums">{platformScale.totalWeightLogs.toLocaleString()}건</b>
            {' · '}투약 기록 <b className="tabular-nums">{platformScale.totalDoses.toLocaleString()}건</b>
          </span>
        </div>
      )}

      {/* 자동 완화 안내 — Supabase 풀데이터에 충분히 있으면(>=30명) 안 뜸 */}
      {!supaCurve && relaxed.stage !== 'original' && relaxed.originalN < 30 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          🔍 정확히 일치하는 사용자가 적어, 필터를 자동으로 완화하여 통계를 보여드립니다.
          {relaxed.relaxedFields.length > 0 && (
            <span className="block mt-1 text-xs opacity-80">
              완화: {relaxed.relaxedFields.map(f => ({
                hasCondition: '동반질환', ageGroup: '나이대', gender: '성별',
                bmiRange: 'BMI', bmiRangeWidened: 'BMI 범위 확장',
                medication: '약', all: '모두',
              }[f] || f)).join(' · ')}
            </span>
          )}
        </div>
      )}

      {/* 평균 감량 곡선 — 본인 라인 + 코호트 평균 라인 */}
      <div className="card">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="section-title flex items-center gap-2 flex-wrap">
              주차별 평균 감량 (kg)
              {!user && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  🔒 4주차 미리보기
                </span>
              )}
            </h2>
            <p className="section-subtitle">
              본인 시작 체중 <b>{refWeight} kg</b> 기준으로 환산
              {!user && <> · <b className="text-brand-600 dark:text-brand-400">가입하면 48주까지 전체 곡선</b></>}
              {myPersonalCurve.length > 0 && <> · <b className="text-rose-600 dark:text-rose-400">빨간 선 = 본인</b></>}
            </p>
          </div>
        </div>
        {lineData.length > 0 ? (
          <LineChart
            series={[
              { name: '코호트 평균', color: '#2E9A58',
                data: (!user ? lineData.slice(0, 3) : lineData) },
              ...(user && topLineData.length > 0 ? [{
                name: '상위 25%', color: '#D97706', dashed: true,
                data: topLineData,
              }] : []),
              ...(myPersonalCurve.length > 0 ? [{
                name: '나', color: '#E11D48',
                data: myPersonalCurve.map(p => ({
                  x: p.week, y: refWeight * p.lossPct / 100, label: `${p.week}주`,
                })),
              }] : []),
            ]}
            yLabel="kg" height={240}
          />
        ) : (
          <div className="text-sm text-ink-500 dark:text-slate-400 py-6 text-center">
            📊 데이터가 계속 모이는 중입니다 — 필터를 더 일반적으로 설정해 보세요
          </div>
        )}
        <div className="mt-4 overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="py-2 px-2 font-medium">주차</th>
                <th className="py-2 px-2 font-medium text-right">평균</th>
                <th className="py-2 px-2 font-medium text-right">중앙값</th>
                {user && <th className="py-2 px-2 font-medium text-right">25–75%</th>}
                <th className="py-2 px-2 font-medium text-right" title="해당 주차까지 추적된 코호트 비율">추적률</th>
              </tr>
            </thead>
            <tbody>
              {visibleCurve.map(c => {
                const avgKg = c.avg != null ? refWeight * c.avg / 100 : null;
                const medianKg = c.median != null ? refWeight * c.median / 100 : null;
                const p25Kg = c.p25 != null ? refWeight * c.p25 / 100 : null;
                const p75Kg = c.p75 != null ? refWeight * c.p75 / 100 : null;
                const trackPct = n > 0 ? Math.round((c.n / n) * 100) : 0;
                return (
                  <tr key={c.week} className="border-t border-ink-100 dark:border-slate-800">
                    <td className="py-1.5 px-2">{c.week}주</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {avgKg != null
                        ? <><span className="font-semibold text-ink-900 dark:text-slate-100">−{avgKg.toFixed(1)} kg</span> <span className="text-ink-300 dark:text-slate-600 text-xs">({c.avg.toFixed(1)}%)</span></>
                        : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-500 dark:text-slate-500">
                      {medianKg != null ? `−${medianKg.toFixed(1)} kg` : '—'}
                    </td>
                    {user && (
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-500 dark:text-slate-500">
                        {p25Kg != null ? `−${p25Kg.toFixed(1)}~−${p75Kg.toFixed(1)} kg` : '—'}
                      </td>
                    )}
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-500 dark:text-slate-500">{trackPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hiddenCurveCount > 0 && (
            <div className="mt-3">
              <LockHint count={hiddenCurveCount} label="8주~48주차 감량률 더 보기" onUnlock={handleSignup} />
            </div>
          )}
        </div>
      </div>

      {/* 약제 비교 — 비가입자엔 잠금 */}
      <div className="card">
        <div className="mb-4 flex justify-between items-start flex-wrap gap-2">
          <div>
            <h2 className="section-title">약제별 12주 평균 감량률</h2>
            <p className="section-subtitle">
              동일 필터(약제 제외) 하에서 약제별 비교. 특정 약을 권장하는 정보가 아닙니다.
            </p>
          </div>
        </div>
        {can(user, 'medicationCompare') ? (
          <GroupBarChart
            data={medCompare.map(m => ({
              label: m.label.replace(/\s*\(.*\)/, ''),
              value: m.avg != null ? m.avg : null,
              n: m.n,
            }))}
            valueLabel="%"
          />
        ) : (
          <LockedOverlay
            reason="free"
            title="약제별 비교는 가입자 전용"
            message="위고비 vs 마운자로 vs 삭센다 등 5개 약제의 12주 감량률을 비교합니다."
            onUnlock={handleSignup}
            minHeight={220}
          >
            <GroupBarChart
              data={medCompare.map(m => ({
                label: m.label.replace(/\s*\(.*\)/, ''),
                value: m.avg != null ? m.avg : null,
                n: m.n,
              }))}
              valueLabel="%"
            />
          </LockedOverlay>
        )}
      </div>

      {/* === 본인 맞춤 중단 후 예측 — 시뮬레이터 패턴 (모든 사용자 노출) === */}
      <div className="card border-2 border-rose-200 dark:border-rose-900/40">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">🔮</div>
          <div className="flex-1 min-w-0">
            <h2 className="section-title">지금 끊으면 어떻게 될까? — 본인 맞춤 예측</h2>
            <p className="section-subtitle">
              본인 시작 체중·현재 체중·약·운동 의지를 입력하면 중단 후 4주~1년 회복 곡선을 즉시 예측합니다.
              {can(user, 'discontinuation') ? '' : ' — 가입자 전용 데이터 일부 포함.'}
            </p>
          </div>
        </div>
        <StopProjector user={user} />
      </div>

      {/* === 약 중단 후 체중 회복 (Rebound) — 코호트 평균 === */}
      {reboundData.some(r => r.n >= 3) && (
        <div className="card border-2 border-amber-200 dark:border-amber-900/40">
          <div className="flex items-start gap-3 mb-2">
            <div className="text-2xl">📉➡️📈</div>
            <div>
              <h2 className="section-title">코호트 평균 — 약 중단 후 회복률</h2>
              <p className="section-subtitle">
                중단된 사용자 전체 평균 회복 곡선입니다.
                개인차가 크며, 운동·식이 지속 여부가 큰 영향을 줍니다.
              </p>
            </div>
          </div>

          {can(user, 'discontinuation') ? (
            <>
              {/* 회복 곡선 */}
              <div className="mt-4">
                <LineChart
                  series={[{
                    name: '평균 회복률 (감량분 대비)', color: '#D97706',
                    data: reboundData.filter(r => r.avgRegainRatio != null).map(r => ({
                      x: r.week, y: r.avgRegainRatio * 100, label: `${r.week}주`,
                    })),
                  }]}
                  yLabel="%" height={220}
                />
                <p className="helptext mt-2">
                  💡 <b>"감량분 대비 회복률"</b> = 약으로 빠진 살의 몇 %가 다시 돌아왔는지.
                  예: 10kg 빠졌는데 4kg 다시 찐 경우 40%.
                </p>
              </div>

              {/* 표 */}
              <div className="mt-4 overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-500 dark:text-slate-400">
                      <th className="py-2 px-2 font-medium">중단 후</th>
                      <th className="py-2 px-2 font-medium text-right">평균 체중 증가</th>
                      <th className="py-2 px-2 font-medium text-right">감량분 회복률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reboundData.map(r => (
                      <tr key={r.week} className="border-t border-ink-100 dark:border-slate-800">
                        <td className="py-1.5 px-2">{r.week}주</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {r.avgGainPct != null
                            ? <span className={r.avgGainPct > 1 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-ink-700 dark:text-slate-300'}>
                                +{r.avgGainPct.toFixed(1)}%
                              </span>
                            : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-ink-700 dark:text-slate-300">
                          {r.avgRegainRatio != null
                            ? `${(r.avgRegainRatio * 100).toFixed(0)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 운동 지속 vs 미지속 비교 */}
              {(reboundByEx.active.n + reboundByEx.inactive.n) >= 5 && (
                <div className="mt-5 rounded-xl bg-brand-50 dark:bg-brand-900/20 p-4 border border-brand-200 dark:border-brand-800/30">
                  <h3 className="font-bold text-ink-900 dark:text-slate-100">🏃 운동 지속이 만든 차이</h3>
                  <p className="text-sm text-ink-500 dark:text-slate-400 mt-1">
                    중단 후 24주차 기준. 운동 ≥ 주 {Math.round(reboundByEx.threshold/60)}시간 vs 미만 비교.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 text-center">
                      <div className="text-xs text-ink-500 dark:text-slate-400">운동 지속 사용자</div>
                      <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums mt-1">
                        {reboundByEx.active.avgRegainPct != null
                          ? `${reboundByEx.active.avgRegainPct.toFixed(0)}%`
                          : '—'}
                      </div>
                      <div className="text-[10px] text-ink-500 dark:text-slate-500">평균 회복률</div>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-3 text-center">
                      <div className="text-xs text-ink-500 dark:text-slate-400">운동 미지속</div>
                      <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
                        {reboundByEx.inactive.avgRegainPct != null
                          ? `${reboundByEx.inactive.avgRegainPct.toFixed(0)}%`
                          : '—'}
                      </div>
                      <div className="text-[10px] text-ink-500 dark:text-slate-500">평균 회복률</div>
                    </div>
                  </div>
                  {reboundByEx.active.avgRegainPct != null && reboundByEx.inactive.avgRegainPct != null && (
                    <div className="text-xs text-ink-700 dark:text-slate-300 mt-3 text-center">
                      → 운동 지속 그룹의 회복률이 <b className="text-brand-700 dark:text-brand-400">
                        {Math.max(0, Math.round(reboundByEx.inactive.avgRegainPct - reboundByEx.active.avgRegainPct))}%p
                      </b> 낮습니다.
                    </div>
                  )}
                </div>
              )}

              {/* 약제별 24주차 회복률 비교 */}
              {reboundByMed.some(m => m.n >= 3) && (
                <div className="mt-4">
                  <h3 className="font-semibold text-ink-900 dark:text-slate-100 mb-2">약제별 24주차 회복률</h3>
                  <GroupBarChart
                    data={reboundByMed.map(m => ({
                      label: m.label.replace(/\s*\(.+\)/, ''),
                      value: m.avgRegainRatio != null ? m.avgRegainRatio * 100 : null,
                      n: m.n,
                      color: '#D97706',
                    }))}
                    valueLabel="%"
                  />
                </div>
              )}
            </>
          ) : (
            <LockedOverlay reason="free"
                           title="중단 후 체중 변화는 가입자 전용"
                           message="실제 사용자들이 약 중단 후 6개월에 몇 % 다시 찌는지 확인하세요"
                           onUnlock={handleSignup} minHeight={300}>
              <div className="mt-4">
                <LineChart
                  series={[{ name: '회복률', color: '#D97706',
                    data: reboundData.filter(r => r.avgRegainRatio != null).map(r => ({
                      x: r.week, y: r.avgRegainRatio * 100, label: `${r.week}주`,
                    })),
                  }]}
                  yLabel="%" height={200}
                />
              </div>
            </LockedOverlay>
          )}
        </div>
      )}

      {/* 가격/지역 */}
      {priceData.n > 0 && (
        <div className="card">
          <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
            <div>
              <h2 className="section-title">약 가격 (지역별 · 4주분 기준)</h2>
              <p className="section-subtitle">
                1박스(4주분) 가격. n≥3인 지역만 표시
                {!user && <> · <b className="text-brand-600">전체 평균 + 1개 지역만 공개</b></>}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-500">전체 평균 (4주분)</div>
              <div className="text-2xl font-extrabold tabular-nums text-ink-900">
                {Math.round(priceData.avg).toLocaleString()}원
              </div>
            </div>
          </div>
          {priceData.byRegion.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-500">
                      <th className="py-2 px-2 font-medium">지역</th>
                      <th className="py-2 px-2 font-medium text-right">평균 (4주분)</th>
                      {user && <th className="py-2 px-2 font-medium text-right">중앙값</th>}
                      <th className="py-2 px-2 font-medium text-right">투약 건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(user ? priceData.byRegion : priceData.byRegion.slice(0, 1)).map(r => (
                      <tr key={r.region} className="border-t border-ink-100">
                        <td className="py-1.5 px-2">{r.region}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                          {Math.round(r.avg).toLocaleString()}원
                        </td>
                        {user && (
                          <td className="py-1.5 px-2 text-right tabular-nums text-ink-500">
                            {Math.round(r.median).toLocaleString()}원
                          </td>
                        )}
                        <td className="py-1.5 px-2 text-right tabular-nums text-ink-500">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!user && priceData.byRegion.length > 1 && (
                <div className="mt-3">
                  <LockHint count={priceData.byRegion.length - 1}
                            label={`${priceData.byRegion.length - 1}개 지역 가격 더 보기`}
                            onUnlock={handleSignup} />
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-ink-500">지역별 데이터가 부족합니다</div>
          )}
        </div>
      )}

      {/* 운동 통계 — 비가입자엔 잠금 */}
      {exData.n > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div>
              <h2 className="section-title">운동 패턴</h2>
              <p className="section-subtitle">필터된 코호트의 주당 운동 시간 분포</p>
            </div>
          </div>
          {can(user, 'exercisePattern') ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <Tile label="주당 평균 운동" value={`${Math.round(exData.avgMinPerWeek || 0)}분`} />
                <Tile label="운동 기록 사용자" value={`${Math.round((exData.withExercise / Math.max(1, exData.n)) * 100)}%`} />
                <Tile label="WHO 권장 달성" value={`${Math.round((exDist?.buckets?.slice(3).reduce((s,b)=>s+b.count,0) || 0) / Math.max(1, exDist?.n || 1) * 100)}%`} />
              </div>
              {/* 히스토그램 */}
              {exDist && exDist.n > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">코호트의 주당 운동 시간 분포</div>
                  <div className="space-y-1.5">
                    {exDist.buckets.map(b => {
                      const max = Math.max(...exDist.buckets.map(x => x.count), 1);
                      const pct = (b.count / exDist.n) * 100;
                      return (
                        <div key={b.label}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-ink-700 dark:text-slate-300">{b.label}</span>
                            <span className="text-ink-500 dark:text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.count/max)*100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="helptext mt-3">💡 WHO 권장: 주 150분 이상 (61분+ 그룹). 약 효과 극대화 + 요요 방지 핵심.</p>
                </div>
              )}
            </>
          ) : (
            <LockedOverlay reason="free"
                           title="운동 패턴은 가입자 전용"
                           message="감량 성공률 높은 사용자의 운동 패턴까지 함께 봅니다"
                           onUnlock={handleSignup} minHeight={120}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Tile label="주당 평균 운동" value="?? 분" />
                <Tile label="운동 기록 사용자" value="??/??명" />
              </div>
            </LockedOverlay>
          )}
        </div>
      )}

      {/* 부작용 - 클릭하면 상세 모달 */}
      <div className="card">
        <div className="mb-4 flex justify-between items-start flex-wrap gap-2">
          <div>
            <h2 className="section-title">부작용 발생률 + 시점 분포</h2>
            <p className="section-subtitle">
              해당 사용 기간 중 한 번이라도 보고된 비율 — <b className="text-brand-600 dark:text-brand-400">막대를 클릭</b>하면 발생 시점/지속 기간 상세
              {!user && <> · <b>상위 3개만 미리 보기</b></>}
            </p>
          </div>
        </div>
        <ClickableSideEffectList
          rates={user ? sideRates : sideRates.slice().sort((a, b) => b.rate - a.rate).slice(0, 3)}
          filter={cleanFilter}
          canDrill={!!user}
          onLockedClick={handleSignup}
        />
        {!user && sideRates.length > 3 && (
          <div className="mt-3">
            <LockHint count={sideRates.length - 3}
                      label="나머지 부작용 + 시점·지속 분포 보기"
                      onUnlock={handleSignup} />
          </div>
        )}
      </div>

      {/* 성공 패턴 (P3 핵심) */}
      <SuccessPatternCard filter={cleanFilter} user={user} myCourse={myCourse} myLogs={myLogs}
                          onUnlock={handleSignup} />

      {/* 투약 직후 vs 평소 식이 비교 */}
      <DietPhaseCard filter={cleanFilter} user={user} onUnlock={handleSignup} />


      {/* 중단률 — 비가입자엔 잠금 */}
      <div className="card">
        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
          <div>
            <h2 className="section-title">중단률 + 중단 이유</h2>
            <p className="section-subtitle">필터된 사용자 기준</p>
          </div>
          {can(user, 'discontinuation') && (
            <div className="text-right">
              <div className="text-3xl font-extrabold text-ink-900 tabular-nums">
                {(stopStats.rate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-ink-500">중단 사례</div>
            </div>
          )}
        </div>
        {can(user, 'discontinuation') ? (
          <HBarChart data={stopStats.reasons.map(r => ({
            label: r.label, value: r.rate, count: r.count, n: stopStats.discontinued,
          }))} color="#475569" max={1} />
        ) : (
          <LockedOverlay reason="free"
                         title="중단률 데이터는 가입자 전용"
                         message="실제 사용자의 중단률과 이유 분포를 봅니다"
                         onUnlock={handleSignup} minHeight={200}>
            <HBarChart data={stopStats.reasons.map(r => ({
              label: r.label, value: r.rate, count: r.count, n: stopStats.discontinued,
            }))} color="#475569" max={1} />
          </LockedOverlay>
        )}
      </div>

      {/* Free / Premium 기능 안내 */}
      {user && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 dark:from-emerald-900/15 dark:via-slate-900 dark:to-amber-900/15 border-2 border-emerald-200 dark:border-emerald-800/40 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="text-2xl">✨</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-ink-900 dark:text-slate-100">기능 안내</h2>
                <FreeBadge />
              </div>
              <p className="text-sm text-ink-500 dark:text-slate-400 mt-0.5">
                현재 모든 기능 무료 · 추후 일부 기능 유료화 검토 중
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PlanFeatureCard icon="📄" title="진료용 12주 리포트" planLabel="Free"
                         desc="병원 방문 전 체중·약·부작용 요약 + 차트 + 코호트 비교를 한 페이지 PDF로. 클립보드 텍스트 카피도 가능."
                         action="profile/doctor-report" />
            <PlanFeatureCard icon="🏪" title="약국 가격 디렉토리" planLabel="Free"
                         desc="13개 지역 약국별 4주분 가격 + 익명 제보로 글로벌 디렉토리." />
            <PlanFeatureCard icon="🔮" title="중단 후 본인 맞춤 예측" planLabel="Free"
                         desc="입력 정보 따라 신뢰구간 좁아지는 본인 맞춤 회복 곡선. Taper · 운동 비교 모드." />
            <PlanFeatureCard icon="📊" title="부작용 인사이트 위젯" planLabel="Free"
                         desc="본인 vs 코호트 부작용 발생률 + 자가관리 팁 + 의사 상담 기준." />
            <PlanFeatureCard icon="🤖" title="AI 주간 리포트" planLabel="Premium 예정"
                         desc="이번 주 트렌드 + 정체기 예측 + 약제 효과 분석. 추후 유료화 검토 중." />
            <PlanFeatureCard icon="🔔" title="이상 신호 알림" planLabel="Premium 예정"
                         desc="체중 정체·부작용 급증 자동 감지 + 진료 권유 알림. 추후 유료화 검토 중." />
          </div>
          <div className="mt-4">
            <FuturePricingHint />
          </div>
        </div>
      )}

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal
          onClose={() => setShowSignup(false)}
          onComplete={onSignupComplete}
        />
      )}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-xs font-semibold text-ink-500 w-16 pt-1.5 flex-shrink-0">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                            ${value === o.id
                              ? 'bg-brand-500 text-white border-brand-500'
                              : 'bg-white text-ink-700 border-ink-300 hover:border-brand-400'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl bg-ink-100/50 p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-xl font-bold tabular-nums text-ink-900 mt-0.5">{value}</div>
    </div>
  );
}

function PlanFeatureCard({ icon, title, desc, planLabel, action }) {
  const isFree = planLabel === 'Free';
  return (
    <div className={`rounded-xl border p-3 flex gap-3
                     ${isFree ? 'bg-white dark:bg-slate-900 border-emerald-200/60 dark:border-emerald-800/30'
                              : 'bg-white/60 dark:bg-slate-900/60 border-amber-200/60 dark:border-amber-800/30'}`}>
      <div className="text-xl flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-ink-900 dark:text-slate-100">{title}</div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
                            ${isFree ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                     : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
            {planLabel}
          </span>
        </div>
        <div className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

/* ============================================================
   부작용 상세 모달 (P2)
============================================================ */
function ClickableSideEffectList({ rates, filter, canDrill, onLockedClick }) {
  const [openId, setOpenId] = useState(null);
  const max = Math.max(...rates.map(r => r.value ?? r.rate), 0.001);
  return (
    <>
      <div className="space-y-2">
        {rates.map(s => (
          <button key={s.id}
                  onClick={() => canDrill ? setOpenId(s.id) : onLockedClick?.()}
                  className="w-full text-left group hover:bg-ink-100/40 dark:hover:bg-slate-800/40 -mx-2 px-2 py-1.5 rounded-lg transition">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                {s.label} {canDrill && <span className="text-[10px] text-ink-300 dark:text-slate-600">▸</span>}
              </span>
              <span className="text-ink-500 dark:text-slate-400 tabular-nums">
                {(s.rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-rose-500 transition-all group-hover:bg-rose-600"
                   style={{ width: `${Math.max(2, (s.rate / max) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
      {openId && (
        <SideEffectDetailModal
          sideEffectId={openId}
          filter={filter}
          baseRate={rates.find(r => r.id === openId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function SideEffectDetailModal({ sideEffectId, filter, baseRate, onClose }) {
  const meta = SIDE_EFFECTS.find(s => s.id === sideEffectId);
  const timing = useMemo(() => sideEffectTiming(filter, sideEffectId), [filter, sideEffectId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const maxBucket = Math.max(...timing.distribution.map(b => b.count), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800 px-5 py-3 flex justify-between items-center">
          <div>
            <div className="font-bold text-ink-900 dark:text-slate-100">{meta?.label}</div>
            <div className="text-xs text-ink-500 dark:text-slate-400">
              필터된 코호트의 발생 패턴
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="btn-ghost !p-2">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* 핵심 숫자 */}
          <div className="grid grid-cols-3 gap-2">
            <Tile label="전체 발생률" value={`${(baseRate.rate * 100).toFixed(0)}%`} />
            <Tile label="평균 발생 시점" value={timing.avgOnset != null ? `${timing.avgOnset.toFixed(1)}주차` : '—'} />
            <Tile label="평균 지속" value={timing.avgDuration != null ? `${timing.avgDuration.toFixed(1)}주` : '—'} />
          </div>

          {/* 시점 분포 히스토그램 */}
          {timing.n > 0 && (
            <div>
              <div className="text-sm font-semibold text-ink-700 dark:text-slate-300 mb-2">
                약 시작 후 언제 처음 나타났나?
              </div>
              <div className="flex items-end gap-2 h-32">
                {timing.distribution.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums">{b.count}</div>
                    <div className="w-full rounded-t-lg bg-rose-400 dark:bg-rose-500 transition-all"
                         style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count > 0 ? '4px' : '0' }} />
                    <div className="text-[10px] text-ink-700 dark:text-slate-400 text-center">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 친절한 해석 */}
          {timing.n > 0 && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-900 dark:text-rose-200 leading-relaxed">
              {timing.avgOnset != null && timing.avgOnset < 4 ? (
                <>대부분 <b>약 시작 후 {Math.round(timing.avgOnset)}주차 안</b>에 처음 나타납니다.
                보통 용량 증량 시기에 집중되며, 시간이 지나며 줄어드는 경향이 있어요.</>
              ) : (
                <>이 증상은 약 시작 후 <b>약 {Math.round(timing.avgOnset || 0)}주차</b> 무렵에 보고됩니다.
                개인차가 크므로 본인 경과를 함께 기록해 보세요.</>
              )}
            </div>
          )}

          {/* 안전 안내 */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200">
            💡 증상이 심하거나 2주 이상 지속되면 의료진과 상의해 주세요.
            특히 <b>심한 복통, 지속 구토, 황달</b> 등이 있다면 즉시 의료기관에 문의하세요.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   성공 패턴 카드 (P3)
============================================================ */
function SuccessPatternCard({ filter, user, myCourse, myLogs, onUnlock }) {
  const data = useMemo(() => successPattern(filter, 12), [filter]);
  const myLossPct = useMemo(() => {
    if (!user || !myCourse) return null;
    const summary = personalSummaryForCourse(user, myLogs, myCourse);
    return summary?.lossPct;
  }, [user, myCourse, myLogs]);
  const myPercentile = useMemo(
    () => myLossPct != null ? personalPercentile(filter, myLossPct, 12) : null,
    [filter, myLossPct]
  );

  if (!data) return null;

  const diff = {
    loss: data.top.avgLossPct - data.rest.avgLossPct,
    exMin: data.top.avgExerciseMinPerWeek - data.rest.avgExerciseMinPerWeek,
    protein: data.top.proteinFocusRate - data.rest.proteinFocusRate,
  };

  return (
    <div className="card border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50/60 to-white dark:from-brand-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">🏆</div>
        <div className="flex-1">
          <h2 className="section-title">잘 빠진 상위 25% 사용자의 패턴</h2>
          <p className="section-subtitle">12주차 감량률 상위 그룹과 나머지 그룹의 평균 비교</p>
        </div>
      </div>

      {can(user, 'similarCohort') ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <CompareTile
              label="12주 감량률"
              top={`-${data.top.avgLossPct.toFixed(1)}%`}
              rest={`-${data.rest.avgLossPct.toFixed(1)}%`}
              diff={`+${diff.loss.toFixed(1)}%p`}
              accent />
            <CompareTile
              label="주당 운동 시간"
              top={`${Math.round(data.top.avgExerciseMinPerWeek)}분`}
              rest={`${Math.round(data.rest.avgExerciseMinPerWeek)}분`}
              diff={`+${Math.round(diff.exMin)}분`}
              positive={diff.exMin > 0} />
            <CompareTile
              label="고단백 식단 비율"
              top={`${Math.round(data.top.proteinFocusRate * 100)}%`}
              rest={`${Math.round(data.rest.proteinFocusRate * 100)}%`}
              diff={`+${Math.round(diff.protein * 100)}%p`}
              positive={diff.protein > 0} />
          </div>

          {myPercentile && (
            <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 p-4">
              <div className="text-xs text-ink-500 dark:text-slate-400">내 12주차 위치</div>
              <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 tabular-nums">
                상위 {100 - myPercentile.percentile}%
              </div>
              <div className="mt-2 h-2 bg-ink-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500"
                     style={{ width: `${myPercentile.percentile}%` }} />
              </div>
            </div>
          )}

          <p className="text-xs text-ink-500 dark:text-slate-400 mt-3 leading-snug">
            💡 상위 25% 그룹은 평균 주 {Math.round(data.top.avgExerciseMinPerWeek)}분 운동, 고단백 식단 비율 {Math.round(data.top.proteinFocusRate*100)}%.
            운동·식단을 함께 기록할수록 본인 패턴이 더 잘 분석됩니다.
          </p>
        </>
      ) : (
        <LockedOverlay reason="free"
                       title="성공 패턴은 가입자 전용"
                       message="잘 빠진 상위 25%의 운동·식단 패턴을 확인하세요"
                       onUnlock={onUnlock} minHeight={200}>
          <div className="grid grid-cols-3 gap-3">
            <CompareTile label="12주 감량률" top="-X%" rest="-Y%" diff="" accent />
            <CompareTile label="주당 운동" top="?? 분" rest="?? 분" diff="" />
            <CompareTile label="단백질 식단" top="??%" rest="??%" diff="" />
          </div>
        </LockedOverlay>
      )}
    </div>
  );
}

/* ============================================================
   투약 직후 vs 평소 식이 비교 (자동 분류)
============================================================ */
function DietPhaseCard({ filter, user, onUnlock }) {
  const data = useMemo(() => cohortDietByPhase(filter), [filter]);
  const total = data.fresh.n + data.mid.n + data.baseline.n;

  if (total < 10) return null;

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">🍽️➡️💉</div>
        <div>
          <h2 className="section-title">투약 직후 vs 평소 식이</h2>
          <p className="section-subtitle">
            식단 기록 시점이 마지막 투약으로부터 며칠 후인지 자동 분류해 비교
          </p>
        </div>
      </div>

      {can(user, 'exercisePattern') ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <PhaseTile
              icon="💉"
              label="투약 직후 (0-2일)"
              data={data.fresh}
              tone="brand"
            />
            <PhaseTile
              icon="🕓"
              label="중간 (3-6일)"
              data={data.mid}
              tone="amber"
            />
            <PhaseTile
              icon="🌿"
              label="평소 (7일+)"
              data={data.baseline}
              tone="slate"
            />
          </div>

          {/* 인사이트 */}
          {data.fresh.avgCalories != null && data.baseline.avgCalories != null && (
            <div className="mt-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 p-4 text-sm">
              💡 <b>투약 직후</b>에는 평소 대비{' '}
              <b className="text-brand-700 dark:text-brand-400">
                {Math.round(((data.baseline.avgCalories - data.fresh.avgCalories) / data.baseline.avgCalories) * 100)}%
              </b>
              {' '}적게 먹는 경향이 관찰됩니다.
              {data.fresh.avgProtein != null && data.baseline.avgProtein != null && data.fresh.avgProtein > data.baseline.avgProtein && (
                <> 단백질 섭취는 <b className="text-brand-700 dark:text-brand-400">+{Math.round(data.fresh.avgProtein - data.baseline.avgProtein)}g</b> 증가.</>
              )}
            </div>
          )}

          <p className="helptext mt-2">
            식단 기록 시 마지막 투약 시점이 자동으로 계산됩니다. 약 없는 사용자는 모두 '평소'로 분류돼요.
          </p>
        </>
      ) : (
        <LockedOverlay reason="free"
                       title="식이 패턴 비교는 가입자 전용"
                       message="투약 직후와 평소 식이가 어떻게 다른지 보세요"
                       onUnlock={onUnlock} minHeight={200}>
          <div className="grid grid-cols-3 gap-3">
            <PhaseTile icon="💉" label="투약 직후" data={{ n: 0 }} tone="brand" />
            <PhaseTile icon="🕓" label="중간" data={{ n: 0 }} tone="amber" />
            <PhaseTile icon="🌿" label="평소" data={{ n: 0 }} tone="slate" />
          </div>
        </LockedOverlay>
      )}
    </div>
  );
}

function PhaseTile({ icon, label, data, tone }) {
  const toneClass = tone === 'brand'
    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
    : tone === 'amber'
    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
    : 'bg-ink-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300';
  return (
    <div className={`rounded-xl p-3 ${toneClass}`}>
      <div className="text-lg">{icon}</div>
      <div className="text-[10px] font-semibold mt-0.5 leading-tight">{label}</div>
      <div className="text-xs tabular-nums mt-2 space-y-0.5">
        {data.avgCalories != null && (
          <div><span className="opacity-70">평균</span> <b>{Math.round(data.avgCalories)}</b> kcal</div>
        )}
        {data.avgProtein != null && (
          <div><span className="opacity-70">단백질</span> <b>{Math.round(data.avgProtein)}</b> g</div>
        )}
      </div>
    </div>
  );
}

function CompareTile({ label, top, rest, diff, accent, positive }) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 p-3 text-center">
      <div className="text-[10px] text-ink-500 dark:text-slate-400">{label}</div>
      <div className={`text-xl font-extrabold tabular-nums mt-0.5 ${accent ? 'text-brand-600 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {top}
      </div>
      <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">상위 25%</div>
      <div className="border-t border-ink-100 dark:border-slate-700 mt-1.5 pt-1.5">
        <div className="text-sm text-ink-500 dark:text-slate-400 tabular-nums">{rest}</div>
        <div className="text-[10px] text-ink-500 dark:text-slate-500">나머지</div>
      </div>
      {diff && (
        <div className={`text-[10px] font-semibold mt-1 ${positive !== false ? 'text-brand-600 dark:text-brand-400' : 'text-ink-500'}`}>
          {diff}
        </div>
      )}
    </div>
  );
}

