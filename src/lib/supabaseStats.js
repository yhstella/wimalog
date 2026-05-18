// Supabase RPC 호출 wrapper — 진짜 3000명+ 코호트 통계
// supabase 미설정 시 null 반환 → 컴포넌트가 localStorage 시드로 fallback
import { supabase, supabaseConfigured } from './supabaseClient.js';

const CACHE = new Map();        // key -> { data, ts }
const CACHE_TTL_MS = 60 * 1000; // 1분 캐시

async function cachedRpc(name, params = {}) {
  if (!supabaseConfigured) return null;
  const key = name + ':' + JSON.stringify(params);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  try {
    const { data, error } = await supabase.rpc(name, params);
    if (error) {
      console.warn(`[supabase rpc] ${name}`, error);
      return null;
    }
    CACHE.set(key, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.warn(`[supabase rpc] ${name} threw`, e);
    return null;
  }
}

export function clearStatsCache() { CACHE.clear(); }

// ============================================================
// 플랫폼 전체 규모 (CohortLive 헤더)
// ============================================================
export async function fetchPlatformScale() {
  const rows = await cachedRpc('platform_scale', {});
  if (!rows?.length) return null;
  const r = rows[0];
  return {
    totalPatients: r.total_patients,
    totalCourses: r.total_courses,
    totalDoses: r.total_doses,
    totalWeightLogs: r.total_weight_logs,
    activeUsers7d: r.active_users_7d,
    newPatients7d: r.new_patients_7d,
  };
}

// ============================================================
// 평균 감량 곡선 (주차별)
// ============================================================
export async function fetchAvgLossCurve(filter = {}, weeks = [12, 24, 48]) {
  const params = {
    med: filter.medication || null,
    gender_f: filter.gender || null,
    age_grp: filter.ageGroup || null,
    bmi_min: filter.bmiRange?.[0] || null,
    bmi_max: filter.bmiRange?.[1] || null,
    weeks_arr: weeks,
  };
  const rows = await cachedRpc('avg_loss_curve', params);
  if (!rows) return null;
  return rows.map(r => ({
    week: r.week,
    n: r.n,
    avg: r.avg_loss_pct != null ? Number(r.avg_loss_pct) : null,
    median: r.median_loss_pct != null ? Number(r.median_loss_pct) : null,
  }));
}

// ============================================================
// 약별 부작용 발생률
// ============================================================
export async function fetchSideEffectRates(medication = null) {
  const rows = await cachedRpc('side_effect_rates', { med: medication });
  if (!rows) return null;
  return rows.map(r => ({
    id: r.side_id,
    count: r.reported_count,
    n: r.total_courses,
    rate: r.rate != null ? Number(r.rate) : 0,
  }));
}

// ============================================================
// 약별 가격 통계 (지역별)
// ============================================================
export async function fetchPriceStats(medication = null) {
  const rows = await cachedRpc('price_stats', { med: medication });
  if (!rows) return null;
  return {
    byRegion: rows.map(r => ({
      region: r.region,
      n: r.n,
      avg: Number(r.avg_price),
      median: Number(r.median_price),
    })),
    avg: rows.length ? rows.reduce((s, r) => s + Number(r.avg_price) * r.n, 0) / rows.reduce((s, r) => s + r.n, 0) : null,
    n: rows.reduce((s, r) => s + r.n, 0),
  };
}

// ============================================================
// 최근 N일 가장 많이 시작한 약
// ============================================================
export async function fetchTopRecentMedications(days = 30) {
  const rows = await cachedRpc('top_recent_medications', { days });
  if (!rows) return null;
  return rows.map(r => ({
    id: r.medication,
    count: r.start_count,
  }));
}

// ============================================================
// 임계 이상 감량한 비율 (성공률)
// ============================================================
export async function fetchSuccessRate(medication = null, week = 12, thresholdPct = 5) {
  const rows = await cachedRpc('success_rate_at_week', {
    med: medication, week_n: week, threshold_pct: thresholdPct,
  });
  if (!rows?.length) return null;
  const r = rows[0];
  return {
    n: r.n,
    successCount: r.success_count,
    rate: r.rate != null ? Number(r.rate) : 0,
  };
}
