// 약국 가격 디렉토리 Supabase wrapper — RPC 호출 (실패 시 null, 컴포넌트가 localStorage fallback)
import { supabase, supabaseConfigured } from './supabaseClient.js';

const CACHE = new Map();
const TTL = 60 * 1000;

async function cachedRpc(name, params = {}) {
  if (!supabaseConfigured) return null;
  const key = name + ':' + JSON.stringify(params);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  try {
    const { data, error } = await supabase.rpc(name, params);
    if (error) {
      // 테이블 없음 (migration 안 됨) → 조용히 null
      if (!/does not exist/i.test(error.message)) {
        console.warn(`[pharmacy rpc] ${name}`, error.message);
      }
      return null;
    }
    if (data != null) CACHE.set(key, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.warn(`[pharmacy rpc] ${name} threw`, e);
    return null;
  }
}

// 지역별 약국 + 평균 가격
export async function fetchPharmaciesByRegion(filter = {}) {
  const rows = await cachedRpc('pharmacies_by_region', { med: filter.medication || null });
  if (!rows) return null;
  // 컴포넌트가 기대하는 shape으로 변환
  const byRegion = new Map();
  for (const r of rows) {
    const key = r.region_id || r.region;
    if (!byRegion.has(key)) {
      byRegion.set(key, {
        region: r.region, regionId: r.region_id || key,
        reportCount: 0, pharmacies: [],
      });
    }
    const reg = byRegion.get(key);
    reg.reportCount += Number(r.report_count) || 0;
    reg.pharmacies.push({
      name: r.pharmacy_name,
      reportCount: Number(r.report_count) || 0,
      lastReportAt: r.last_report_at ? r.last_report_at.slice(0, 10) : null,
      medsHandled: [],   // pharmacies_by_region이 med 정보 없으므로 빈 배열 (UI에서 안 씀)
      avgPrice: r.avg_price != null ? Math.round(Number(r.avg_price)) : null,
      medianPrice: r.median_price != null ? Math.round(Number(r.median_price)) : null,
    });
  }
  return [...byRegion.values()];
}

// 특정 지역 상세
export async function fetchRegionDetail(regionLabel) {
  const rows = await cachedRpc('region_pharmacy_detail', { region_param: regionLabel });
  if (!rows) return null;
  // 약국별 그룹화
  const byPharm = new Map();
  for (const r of rows) {
    if (!byPharm.has(r.pharmacy_name)) {
      byPharm.set(r.pharmacy_name, { name: r.pharmacy_name, reportCount: 0, lastReportAt: null, offerings: [] });
    }
    const p = byPharm.get(r.pharmacy_name);
    const n = Number(r.n) || 0;
    p.reportCount += n;
    if (!p.lastReportAt || (r.last_report_at && r.last_report_at > p.lastReportAt)) {
      p.lastReportAt = r.last_report_at ? r.last_report_at.slice(0, 10) : p.lastReportAt;
    }
    p.offerings.push({
      medication: r.medication, dose: r.dose, n,
      avg: r.avg_price != null ? Math.round(Number(r.avg_price)) : null,
      median: r.median_price != null ? Math.round(Number(r.median_price)) : null,
      min: r.min_price, max: r.max_price,
    });
  }
  const pharmacies = [...byPharm.values()].sort((a, b) => b.reportCount - a.reportCount);
  return {
    region: regionLabel,
    totalReports: pharmacies.reduce((s, p) => s + p.reportCount, 0),
    pharmacies,
  };
}

// 디렉토리 요약
export async function fetchPharmacySummary() {
  const rows = await cachedRpc('pharmacy_summary');
  if (!rows?.[0]) return null;
  const r = rows[0];
  return {
    totalReports: Number(r.total_reports) || 0,
    totalRegions: Number(r.total_regions) || 0,
    totalPharmacies: Number(r.total_pharmacies) || 0,
    recent30: Number(r.recent_30d) || 0,
  };
}

// 익명 제보 insert
export async function submitPharmacyReport(report) {
  if (!supabaseConfigured) return { ok: false, error: 'supabase 미설정' };
  try {
    const { error } = await supabase.from('pharmacy_reports').insert({
      seed: false,
      region: report.region,
      region_id: report.regionId || null,
      pharmacy_name: report.pharmacyName,
      medication: report.medication,
      dose: report.dose,
      price_per_4w: report.pricePer4W,
      purchase_date: report.purchaseDate || null,
      notes: report.notes || null,
      submitted_by: report.submittedBy || null,
    });
    if (error) {
      console.warn('[pharmacy submit]', error.message);
      return { ok: false, error: error.message };
    }
    CACHE.clear();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
