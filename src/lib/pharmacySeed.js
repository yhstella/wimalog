// 약국 가격 디렉토리 시드 — 한국 GLP-1 사용자 사이에서 알려진 약국 + 지역 clustering
// 실제 약국명은 익명화 처리 ("XX약국") 또는 일반 카테고리.
// 사용자 익명 제보로 보강되도록 설계. 처음에는 시드 데이터로 디렉토리가 비어 보이지 않게.
import { Storage } from './storage.js';
import { REFERENCE_PRICE_4W } from './constants.js';

// 한국에서 GLP-1을 처방·판매하는 클러스터 — 의원·약국이 한 지역에 모여 가격 경쟁이 일어나는 패턴
// 대학로·강남·종로 등 핵심 + 지방 광역시
const PHARMACY_CLUSTERS = [
  // 서울 대학로 — 다이어트 한약·비만 클리닉 밀집. 한국에서 가장 저렴한 편.
  { id: 'seoul-daehakro', region: '서울 대학로', priceMult: 0.78,
    landmark: '혜화역·대학로 비만 클리닉 클러스터',
    pharmacies: [
      { name: '혜화동 비만클리닉 인근 약국 A', medsHandled: ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound'], rep: 14 },
      { name: '대학로 비만클리닉 인근 약국 B', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 9 },
      { name: '명륜동 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'ozempic'], rep: 7 },
    ] },
  { id: 'seoul-gangnam', region: '서울 강남', priceMult: 1.10,
    landmark: '강남역·역삼동·논현동 비만 클리닉',
    pharmacies: [
      { name: '강남역 비만클리닉 인근 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound'], rep: 11 },
      { name: '역삼동 일반 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 8 },
      { name: '논현동 비만클리닉 인근 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 6 },
    ] },
  { id: 'seoul-jongno', region: '서울 종로', priceMult: 0.85,
    landmark: '광화문·종로3가 의원 밀집',
    pharmacies: [
      { name: '종로3가 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 6 },
      { name: '광화문 인근 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 5 },
    ] },
  { id: 'seoul-sinchon', region: '서울 신촌', priceMult: 0.95,
    landmark: '신촌·연대 대학가',
    pharmacies: [
      { name: '신촌역 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 5 },
      { name: '연대 후문 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 4 },
    ] },
  { id: 'seoul-songpa', region: '서울 송파', priceMult: 1.05,
    landmark: '잠실역·석촌·문정',
    pharmacies: [
      { name: '잠실역 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 5 },
      { name: '석촌역 인근 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 3 },
    ] },
  { id: 'gyeonggi-bundang', region: '경기 분당', priceMult: 1.00,
    landmark: '서현·정자·미금',
    pharmacies: [
      { name: '서현역 인근 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda', 'ozempic'], rep: 6 },
      { name: '정자동 일반 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 4 },
    ] },
  { id: 'gyeonggi-ilsan', region: '경기 일산', priceMult: 1.00,
    landmark: '주엽·정발산',
    pharmacies: [
      { name: '주엽역 인근 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 4 },
    ] },
  { id: 'gyeonggi-suwon', region: '경기 수원', priceMult: 0.98,
    landmark: '수원역·인계동',
    pharmacies: [
      { name: '수원역 인근 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 3 },
    ] },
  { id: 'busan', region: '부산', priceMult: 0.95,
    landmark: '서면·해운대·동래',
    pharmacies: [
      { name: '서면역 인근 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 5 },
      { name: '해운대 일반 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 4 },
    ] },
  { id: 'daegu', region: '대구', priceMult: 0.95,
    landmark: '동성로·반월당',
    pharmacies: [
      { name: '동성로 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 4 },
    ] },
  { id: 'incheon', region: '인천', priceMult: 1.00,
    landmark: '구월동·부평',
    pharmacies: [
      { name: '구월동 일반 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 3 },
    ] },
  { id: 'daejeon', region: '대전', priceMult: 0.95,
    landmark: '둔산동·유성',
    pharmacies: [
      { name: '둔산동 일반 약국', medsHandled: ['wegovy', 'mounjaro', 'saxenda'], rep: 3 },
    ] },
  // 광주
  { id: 'gwangju', region: '광주', priceMult: 0.95,
    landmark: '상무지구·충장로',
    pharmacies: [
      { name: '상무지구 일반 약국', medsHandled: ['wegovy', 'mounjaro'], rep: 3 },
    ] },
];

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(daysAgo) {
  const d = new Date(Date.now() - daysAgo * DAY_MS);
  return d.toISOString().slice(0, 10);
}

// 시드: 각 약국마다 rep 횟수만큼 가격 제보 생성
export function seedPharmacyReports(seed = 20260521) {
  const existing = Storage.getPharmacyReports();
  // 이미 시드된 데이터가 있고 30개 이상이면 skip
  if (existing.filter(r => r.seed).length >= 30) return;
  // 기존 시드 데이터 제거 (재seeding)
  Storage.setPharmacyReports(existing.filter(r => !r.seed));

  const rand = mulberry32(seed);
  const reports = Storage.getPharmacyReports();

  for (const cluster of PHARMACY_CLUSTERS) {
    for (const pharm of cluster.pharmacies) {
      for (let i = 0; i < pharm.rep; i++) {
        const med = pharm.medsHandled[Math.floor(rand() * pharm.medsHandled.length)];
        const dosesAvail = Object.keys(REFERENCE_PRICE_4W[med] || {});
        if (!dosesAvail.length) continue;
        const dose = dosesAvail[Math.floor(rand() * dosesAvail.length)];
        const base = REFERENCE_PRICE_4W[med][dose];
        // 약국별 ±15% 변동
        const indivMult = 0.92 + rand() * 0.16;
        const price = Math.round(base * cluster.priceMult * indivMult / 1000) * 1000;
        const daysAgo = Math.floor(rand() * 90); // 최근 3개월 내
        reports.push({
          id: `phr-seed-${cluster.id}-${pharm.name}-${i}`,
          region: cluster.region,
          pharmacyName: pharm.name,
          medication: med,
          dose,
          pricePer4W: price,
          purchaseDate: isoDate(daysAgo),
          submittedAt: isoDate(daysAgo),
          submittedBy: null, // 익명
          notes: '',
          seed: true,
        });
      }
    }
  }
  Storage.setPharmacyReports(reports);
}

export { PHARMACY_CLUSTERS };
