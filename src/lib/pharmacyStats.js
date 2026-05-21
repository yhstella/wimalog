// 약국 가격 디렉토리 통계 — 지역·약국·약별 집계
import { Storage } from './storage.js';
import { PHARMACY_CLUSTERS } from './pharmacySeed.js';

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

// 지역별 약국 리스트 + 각 약국의 보고 통계
// returns [{ region, regionId, pharmacies: [{ name, reportCount, lastReportAt, medsHandled, avgPrice, medianPrice }] }]
export function pharmaciesByRegion(filter = {}) {
  const reports = Storage.getPharmacyReports();
  const filtered = filter.medication
    ? reports.filter(r => r.medication === filter.medication)
    : reports;

  // PHARMACY_CLUSTERS 기준으로 그룹화 — 시드된 약국이 디렉토리 골격, 사용자 제보가 보강
  const result = [];
  for (const cluster of PHARMACY_CLUSTERS) {
    const inRegion = filtered.filter(r => r.region === cluster.region);
    if (!inRegion.length) {
      // 보고 0건이어도 클러스터는 표시 — 디렉토리 모양 유지
      result.push({
        region: cluster.region, regionId: cluster.id,
        reportCount: 0, pharmacies: cluster.pharmacies.map(p => ({
          name: p.name, reportCount: 0, lastReportAt: null,
          medsHandled: p.medsHandled, avgPrice: null, medianPrice: null,
        })),
      });
      continue;
    }
    // 약국별 그룹화
    const byPharm = new Map();
    for (const r of inRegion) {
      if (!byPharm.has(r.pharmacyName)) byPharm.set(r.pharmacyName, []);
      byPharm.get(r.pharmacyName).push(r);
    }
    const pharmacies = [];
    for (const [name, list] of byPharm.entries()) {
      const prices = list.map(r => r.pricePer4W).filter(p => p > 0);
      const meds = [...new Set(list.map(r => r.medication))];
      pharmacies.push({
        name,
        reportCount: list.length,
        lastReportAt: list.map(r => r.submittedAt).sort().slice(-1)[0],
        medsHandled: meds,
        avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
        medianPrice: median(prices),
      });
    }
    // 보고 많은 순
    pharmacies.sort((a, b) => b.reportCount - a.reportCount);
    result.push({
      region: cluster.region, regionId: cluster.id,
      reportCount: inRegion.length, pharmacies,
    });
  }
  return result;
}

// 특정 지역 디테일 — 약국 모두 + 약별 가격 분포
export function regionDetail(regionId, filter = {}) {
  const cluster = PHARMACY_CLUSTERS.find(c => c.id === regionId);
  if (!cluster) return null;
  const reports = Storage.getPharmacyReports();
  const inRegion = reports.filter(r =>
    r.region === cluster.region &&
    (!filter.medication || r.medication === filter.medication),
  );

  // 약국별 — 약·용량별 그룹
  const byPharm = new Map();
  for (const r of inRegion) {
    if (!byPharm.has(r.pharmacyName)) byPharm.set(r.pharmacyName, []);
    byPharm.get(r.pharmacyName).push(r);
  }
  const pharmacies = [];
  for (const [name, list] of byPharm.entries()) {
    // 약·용량별 평균
    const byMedDose = new Map();
    for (const r of list) {
      const key = `${r.medication}::${r.dose}`;
      if (!byMedDose.has(key)) byMedDose.set(key, []);
      byMedDose.get(key).push(r.pricePer4W);
    }
    const offerings = [];
    for (const [key, prices] of byMedDose.entries()) {
      const [medication, dose] = key.split('::');
      offerings.push({
        medication, dose,
        n: prices.length,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        median: median(prices),
        min: Math.min(...prices),
        max: Math.max(...prices),
      });
    }
    pharmacies.push({
      name,
      reportCount: list.length,
      lastReportAt: list.map(r => r.submittedAt).sort().slice(-1)[0],
      offerings: offerings.sort((a, b) => a.medication.localeCompare(b.medication) || a.dose.localeCompare(b.dose)),
    });
  }
  pharmacies.sort((a, b) => b.reportCount - a.reportCount);

  return {
    region: cluster.region, regionId: cluster.id,
    totalReports: inRegion.length,
    pharmacies,
  };
}

// 약국 가격 디렉토리 전체 요약 (랜딩에 노출용)
export function pharmacyDirectorySummary() {
  const reports = Storage.getPharmacyReports();
  const regions = new Set(reports.map(r => r.region));
  const pharmacies = new Set(reports.map(r => r.pharmacyName));
  const recent30 = reports.filter(r => {
    const d = new Date(r.submittedAt);
    return Date.now() - d.getTime() < 30 * 86400000;
  }).length;
  return {
    totalReports: reports.length,
    totalRegions: regions.size,
    totalPharmacies: pharmacies.size,
    recent30,
  };
}

// 특정 약의 가격 — 약국 디렉토리 관점 (최저가 약국, 평균, 분포)
export function pharmacyPricesForMed(medication) {
  const reports = Storage.getPharmacyReports().filter(r => r.medication === medication);
  if (!reports.length) return null;
  const byPharm = new Map();
  for (const r of reports) {
    const key = `${r.region}::${r.pharmacyName}`;
    if (!byPharm.has(key)) byPharm.set(key, []);
    byPharm.get(key).push(r.pricePer4W);
  }
  const list = [];
  for (const [key, prices] of byPharm.entries()) {
    const [region, pharmacyName] = key.split('::');
    list.push({
      region, pharmacyName, n: prices.length,
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      median: median(prices),
      min: Math.min(...prices),
    });
  }
  list.sort((a, b) => a.median - b.median);
  return list;
}
