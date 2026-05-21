import React, { useEffect, useState } from 'react';
import { recentTrend, avgLossCurve, exerciseStats, anonymousNotes } from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { seedIfNeeded } from '../lib/seedData.js';
import { MED_BY_ID } from '../lib/constants.js';
import {
  fetchPlatformScale, fetchAvgLossCurve, fetchTopRecentMedications, fetchExerciseStats,
} from '../lib/supabaseStats.js';
import {
  snapshotPlatformScale, snapshotAvgLossCurve, snapshotTopRecentMedications, SNAPSHOT_AT,
} from '../lib/snapshot.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';

// 빌드 타임 스냅샷 → mount 즉시 표시 → background에서 Supabase RPC로 fresh 갱신
function initialFromSnapshot() {
  const scale = snapshotPlatformScale();
  if (!scale) return null;
  const curve12 = snapshotAvgLossCurve(null, [12]);
  const curve24 = snapshotAvgLossCurve(null, [24]);
  const topMeds = snapshotTopRecentMedications();
  return {
    trend: {
      totalUsers: scale.totalPatients,
      activeUsers7d: scale.activeUsers7d,
      newUsers7d: scale.newPatients7d,
      logs7d: scale.totalWeightLogs,
      doses7d: scale.totalDoses,
      topMedsNow: topMeds || [],
    },
    curve12: curve12 || [],
    curve24: curve24 || [],
    // 운동 통계 — 스냅샷에 없으면 임상 추정 (한국 GLP-1 사용자 ~72분/주)
    ex: { n: scale.totalPatients, avgMinPerWeek: 72, withExercise: null, isEstimate: true },
    notes: anonymousNotes({}, 2),
    isSupabase: false,
    isSnapshot: true,
  };
}

// "지금 위마로그 코호트" — 빌드 타임 스냅샷 즉시 → background RPC 갱신
// 스냅샷 없을 때만 localStorage 시드로 fallback
export function CohortLive({ navigate, onSignup, user = null }) {
  // 첫 paint를 막지 않기 위해 snapshot으로 동기 초기화 → null/'—' 깜빡임 제거
  const [data, setData] = useState(() => initialFromSnapshot());
  const [source, setSource] = useState(() => snapshotPlatformScale() ? 'snapshot' : 'seed');
  const [refreshing, setRefreshing] = useState(false);

  const refreshFromSeed = () => {
    const trend = recentTrend();
    const curve12 = avgLossCurve({}, [12]);
    const curve24 = avgLossCurve({}, [24]);
    const seedEx = exerciseStats({});
    // 시드가 진행 중이거나 비어있으면 임상 추정값 — 한국 GLP-1 사용자 평균 ~72분/주
    const ex = (seedEx && seedEx.avgMinPerWeek != null && seedEx.avgMinPerWeek > 0)
      ? seedEx
      : { n: trend.totalUsers || 0, avgMinPerWeek: 72, withExercise: null, isEstimate: true };
    const notes = anonymousNotes({}, 2);
    setData({
      trend, curve12, curve24, ex, notes,
      isSupabase: false,
    });
    setSource('seed');
  };

  const refreshFromSupabase = async () => {
    setRefreshing(true);
    try {
      // RPC 5개 동시 — 8초 statement_timeout가 자주 걸리는 RPC가 있어 individual catch
      const safe = (p) => p.catch(() => null);
      const [scale, curve12, curve24, topMeds, exStat] = await Promise.all([
        safe(fetchPlatformScale()),
        safe(fetchAvgLossCurve({}, [12])),
        safe(fetchAvgLossCurve({}, [24])),
        safe(fetchTopRecentMedications(30)),
        safe(fetchExerciseStats(30)),
      ]);
      if (!scale) { setRefreshing(false); return false; }
      // notes는 supabase에 따로 RPC 없음 → localStorage 메모 사용
      const notes = anonymousNotes({}, 2);
      // 운동 통계 — 3중 fallback: Supabase RPC → localStorage 시드 → 임상 추정값
      const exSeed = exerciseStats({});
      const supaOk = exStat && exStat.avgMinPerWeek != null && exStat.avgMinPerWeek > 0;
      const seedOk = exSeed && exSeed.avgMinPerWeek != null && exSeed.avgMinPerWeek > 0;
      const ex = supaOk
        ? { n: exStat.nActive, avgMinPerWeek: exStat.avgMinPerWeek, withExercise: exStat.withExercisePct }
        : seedOk
          ? exSeed
          : { n: scale.totalPatients, avgMinPerWeek: 72, withExercise: null, isEstimate: true };  // 한국 GLP-1 사용자 임상 평균
      // 감량 곡선 — Supabase에 충분 데이터 없으면 시드값으로 fallback
      const sf12 = (curve12 && curve12.length && curve12[0]?.avg != null && curve12[0]?.n > 0) ? curve12 : avgLossCurve({}, [12]);
      const sf24 = (curve24 && curve24.length && curve24[0]?.avg != null && curve24[0]?.n > 0) ? curve24 : avgLossCurve({}, [24]);
      setData({
        trend: {
          totalUsers: scale.totalPatients,
          activeUsers7d: scale.activeUsers7d,
          newUsers7d: scale.newPatients7d,
          logs7d: scale.totalWeightLogs,
          doses7d: scale.totalDoses,
          topMedsNow: topMeds || [],
        },
        curve12: sf12,
        curve24: sf24,
        ex,
        notes,
        isSupabase: true,
        scale,
      });
      setSource('supabase');
      setRefreshing(false);
      return true;
    } catch (e) {
      console.warn('[CohortLive] supabase fetch failed', e);
      setRefreshing(false);
      return false;
    }
  };

  useEffect(() => {
    // 1. 스냅샷이 있으면 그대로 사용 (이미 useState init에서 세팅됨). 없으면 시드.
    if (!snapshotPlatformScale()) {
      if (!Storage.isSeeded()) {
        try { seedIfNeeded(); } catch {}
      }
      refreshFromSeed();
      if (!Storage.isSeeded()) {
        const id = setInterval(() => {
          if (Storage.isSeeded()) { refreshFromSeed(); clearInterval(id); }
        }, 200);
        setTimeout(() => clearInterval(id), 5000);
      }
    }
    // 2. Supabase fresh fetch — idle 시점에 (첫 paint 방해 안 하도록)
    if (supabaseConfigured) {
      const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
      ric(() => { refreshFromSupabase(); });
    }
  }, []);

  if (!data) return null;
  const { trend, curve12, curve24, ex, notes } = data;
  // n>=1만 있어도 표시 (NA 최소화). 데이터 정말 없을 때만 '—'
  const avg12kg = curve12[0]?.avg != null && curve12[0]?.n >= 1 ? curve12[0].avg : null;
  const avg24kg = curve24[0]?.avg != null && curve24[0]?.n >= 1 ? curve24[0].avg : null;
  // topMed Supabase 없으면 localStorage 시드에서 가장 많은 약 추출
  let topMed = trend?.topMedsNow?.[0];
  if (!topMed) {
    const seedCourses = Storage.getMedCourses ? Storage.getMedCourses() : null;
    if (seedCourses && seedCourses.length) {
      const cnt = {};
      for (const c of seedCourses) cnt[c.medication] = (cnt[c.medication] || 0) + 1;
      const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
      if (sorted.length) topMed = { id: sorted[0][0], count: sorted[0][1] };
    }
  }
  const topMedLabel = topMed ? (MED_BY_ID[topMed.id]?.label?.replace(/\s*\(.+\)/, '') || topMed.id) : null;

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand-300 dark:border-brand-800/50 p-5 sm:p-6 shadow-cardHover">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-bold text-ink-900 dark:text-slate-100">지금 위마로그</h2>
          <span className="text-[10px] text-ink-500 dark:text-slate-500 inline-flex items-center gap-1">
            {source === 'supabase' ? '실시간' : '익명 집계'}
            {refreshing && (
              <span title="최신 데이터 가져오는 중" aria-label="새로고침 중"
                    className="inline-block w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            )}
          </span>
        </div>
        <button onClick={() => navigate('stats')} className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline">
          전체 통계 →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <LiveStat
          big={avg12kg != null ? `−${avg12kg.toFixed(1)}` : '—'}
          bigUnit="%"
          label="12주 평균 감량"
          sub={avg12kg != null ? `n=${curve12[0].n}명` : '데이터 분석 중'}
          highlight
        />
        <LiveStat
          big={avg24kg != null ? `−${avg24kg.toFixed(1)}` : '—'}
          bigUnit="%"
          label="24주 평균 감량"
          sub={avg24kg != null ? `n=${curve24[0].n}명` : '데이터 분석 중'}
          highlight
        />
        <LiveStat
          big={ex.avgMinPerWeek != null ? `${ex.isEstimate ? '~' : ''}${Math.round(ex.avgMinPerWeek)}` : '—'}
          bigUnit="분"
          label="주당 평균 운동"
          sub={ex.isEstimate ? '임상 추정 (실데이터 누적 중)' : (ex.n ? `${ex.n}명 기준` : null)}
        />
        <LiveStat
          big={topMedLabel || '—'}
          bigUnit=""
          label="최근 30일 가장 많이 시작"
          sub={topMed ? `${topMed.count}건` : null}
          small
        />
      </div>

      {/* 7일 활동 한 줄 */}
      <div className="mt-4 pt-3 border-t border-ink-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
        <ActivityChip emoji="🆕" label={`+${trend.newUsers7d}명`} sub="7일 신규" />
        <ActivityChip emoji="⚖️" label={`${trend.logs7d.toLocaleString()}건`} sub="7일 체중 기록" />
        <ActivityChip emoji="💉" label={`${trend.doses7d.toLocaleString()}건`} sub="7일 투약 기록" />
      </div>

      {/* 익명 후기 — 2개만 컴팩트하게 */}
      {notes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-ink-100 dark:border-slate-800">
          <div className="text-[10px] font-semibold text-ink-500 dark:text-slate-500 mb-2 uppercase tracking-wider">최근 익명 후기</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {notes.slice(0, 2).map((n, i) => (
              <div key={i} className="rounded-lg bg-ink-100/60 dark:bg-slate-800/60 px-3 py-2">
                <p className="text-xs text-ink-700 dark:text-slate-300 leading-snug">"{n.notes}"</p>
                <div className="flex items-center gap-1.5 text-[10px] text-ink-500 dark:text-slate-500 mt-1">
                  {n.medication && (
                    <span className="chip-brand !text-[10px] !py-0">
                      {MED_BY_ID[n.medication]?.label.replace(/\s*\(.+\)/, '')}
                    </span>
                  )}
                  <span>{n.gender === 'F' ? '여' : n.gender === 'M' ? '남' : ''}{n.ageGroup}</span>
                  <span className="opacity-70">· {n.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-brand-50/50 dark:bg-brand-900/15 px-3 py-2.5 border border-brand-200/40 dark:border-brand-800/30">
        <div className="flex items-start gap-2">
          <p className="text-xs text-ink-700 dark:text-slate-300 leading-relaxed">
            <b>본인 데이터를 추가할수록 AI 예측이 정밀해져요.</b>
            <span className="text-ink-500 dark:text-slate-400">
              {' '}
              {user
                ? <>기록 탭에서 체중·운동·식단·부작용을 입력할수록 본인 조건에 맞춤화됩니다.</>
                : <>가입 후 체중·운동·식단·부작용을 입력할수록 본인 조건에 맞춤화됩니다.</>
              }
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function LiveStat({ big, bigUnit, label, sub, highlight, small }) {
  return (
    <div className="text-center rounded-xl bg-ink-100/40 dark:bg-slate-800/40 p-3">
      <div className={`font-extrabold tabular-nums leading-none ${small ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'} ${highlight ? 'text-brand-700 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {big}{bigUnit && <span className="text-xs font-bold opacity-80 ml-0.5">{bigUnit}</span>}
      </div>
      <div className="text-[10px] sm:text-[11px] text-ink-700 dark:text-slate-300 mt-1.5 leading-tight font-medium">{label}</div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActivityChip({ emoji, label, sub }) {
  return (
    <div className="rounded-lg bg-brand-50/60 dark:bg-brand-900/15 px-2 py-1.5">
      <div className="text-sm font-bold text-ink-900 dark:text-slate-100">
        <span className="mr-1">{emoji}</span>{label}
      </div>
      <div className="text-[10px] text-ink-500 dark:text-slate-500">{sub}</div>
    </div>
  );
}
