// 정적 스냅샷 액세서 — 빌드 타임에 Supabase RPC를 미리 호출해 만든 snapshot.generated.js를 읽어
// supabaseStats.js의 fetchXxx() 시그니처와 동일한 형태로 반환.
// 컴포넌트는 첫 렌더에서 이걸 동기로 가져와 즉시 표시 → background에서 fetchXxx로 fresh 갱신.
import { SNAPSHOT, SNAPSHOT_AT } from './snapshot.generated.js';

export { SNAPSHOT_AT };
export const isSnapshotEmpty = SNAPSHOT?.empty === true;

// fetchPlatformScale shape
export function snapshotPlatformScale() {
  const r = SNAPSHOT?.platformScale?.[0];
  if (!r) return null;
  return {
    totalPatients: r.total_patients,
    totalCourses: r.total_courses,
    totalDoses: r.total_doses,
    totalWeightLogs: r.total_weight_logs,
    activeUsers7d: r.active_users_7d,
    newPatients7d: r.new_patients_7d,
  };
}

// fetchAvgLossCurve shape — week 배열 filter
export function snapshotAvgLossCurve(medication = null, weeks = [12, 24]) {
  const source = medication
    ? SNAPSHOT?.byMed?.[medication]?.curve
    : SNAPSHOT?.globalCurve;
  if (!source) return null;
  const rows = source.filter(r => weeks.includes(r.week));
  return rows.map(r => ({
    week: r.week,
    n: r.n,
    avg: r.avg_loss_pct != null ? Number(r.avg_loss_pct) : null,
    median: r.median_loss_pct != null ? Number(r.median_loss_pct) : null,
  }));
}

// fetchSideEffectRates shape
export function snapshotSideEffectRates(medication) {
  const rows = SNAPSHOT?.byMed?.[medication]?.sideEffects;
  if (!rows) return null;
  return rows.map(r => ({
    id: r.side_id,
    count: r.reported_count,
    n: r.total_courses,
    rate: r.rate != null ? Number(r.rate) : 0,
  }));
}

// fetchPriceStats shape
export function snapshotPriceStats(medication) {
  const rows = SNAPSHOT?.byMed?.[medication]?.prices;
  if (!rows) return null;
  // '온라인' 제외 (한국 GLP-1 온라인 판매 불법 — 이전 라운드 사용자 지적)
  const filtered = rows.filter(r => r.region !== '온라인');
  if (!filtered.length) return null;
  return {
    byRegion: filtered.map(r => ({
      region: r.region,
      n: r.n,
      avg: Number(r.avg_price),
      median: Number(r.median_price),
    })),
    avg: filtered.reduce((s, r) => s + Number(r.avg_price) * r.n, 0) / filtered.reduce((s, r) => s + r.n, 0),
    n: filtered.reduce((s, r) => s + r.n, 0),
  };
}

// fetchTopRecentMedications shape
export function snapshotTopRecentMedications() {
  const rows = SNAPSHOT?.topMedsRecent;
  if (!rows) return null;
  return rows.map(r => ({ id: r.medication, count: r.start_count }));
}
