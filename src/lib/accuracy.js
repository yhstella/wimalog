// AI 예측 정확도 — 정밀 세분화
// 총 100% = Static(기본 정보 47) + Dynamic(누적 데이터 53)
import { Storage } from './storage.js';

// === Static — 일회성 입력. 가입 시 / 프로필에서 채움 ===
const STATIC = {
  height:        5,   // 키 (시뮬레이터 슬라이더 / 가입 모달)
  startWeight:   5,   // 시작 체중
  medication:    7,   // 사용 약
  frequency:     5,   // 사용 빈도 (매주/격주/가끔/저용량)
  signedIn:      5,   // 가입 자체 — 본인 추이 가능해짐
  gender:        5,   // 성별
  ageGroup:      5,   // 나이대
  fattyLiver:    4,   // 지방간 동반
  diabetes:      4,   // 당뇨/전당뇨
  thyroid:       2,   // 갑상선 (드물지만 GLP-1 신중 사용)
};   // 47

// === Dynamic — 누적 데이터. 입력할수록 단계별 가산 ===
// 각 항목: [{count: N, addPct: P}, ...] — 누적 카운트가 N 이상일 때 P% 추가
const DYNAMIC = {
  weightLogs: {
    label: '체중 기록 (누적)',
    max: 18,
    tiers: [
      { count: 4,  addPct: 8,  hint: '4주 연속' },
      { count: 8,  addPct: 4,  hint: '8주 누적' },
      { count: 16, addPct: 3,  hint: '4개월 누적' },
      { count: 24, addPct: 3,  hint: '6개월 누적' },
    ],
  },
  exercises30d: {
    label: '운동 (최근 1개월)',
    max: 13,
    tiers: [
      { count: 5,  addPct: 8,  hint: '월 5회+' },
      { count: 10, addPct: 5,  hint: '월 10회+ (꾸준)' },
    ],
  },
  diets30d: {
    label: '식단 (최근 1개월)',
    max: 8,
    tiers: [
      { count: 5,  addPct: 5,  hint: '월 5회+' },
      { count: 10, addPct: 3,  hint: '월 10회+' },
    ],
  },
  sideEffects30d: {
    label: '부작용 기록 (최근 1개월)',
    max: 4,
    tiers: [
      { count: 3, addPct: 4, hint: '월 3건+' },
    ],
  },
  healthMetrics: {
    label: '혈액검사·인바디 (누적)',
    max: 8,
    tiers: [
      { count: 1, addPct: 5, hint: '1건' },
      { count: 3, addPct: 3, hint: '3건+ (시점 비교 가능)' },
    ],
  },
  doses: {
    label: '투약 기록 (누적)',
    max: 8,
    tiers: [
      { count: 4, addPct: 5, hint: '4회+' },
      { count: 8, addPct: 3, hint: '8회+ (증량·유지 패턴)' },
    ],
  },
};  // 53

const SIDE_EFFECTS_30D_MS = 30 * 86400000;

// === 본체 ===
export function calculateAccuracy({ user, simulator = {} }) {
  let score = 0;
  const filled = {};

  // STATIC — 시뮬레이터/user/추가 입력 기반
  if (simulator.height || user?.height) { score += STATIC.height; filled.height = true; }
  if (simulator.startWeight || user?.startWeight) { score += STATIC.startWeight; filled.startWeight = true; }
  if (simulator.medication) { score += STATIC.medication; filled.medication = true; }
  if (simulator.frequency) { score += STATIC.frequency; filled.frequency = true; }
  if (user) { score += STATIC.signedIn; filled.signedIn = true; }
  if (user?.gender && user.gender !== 'X') { score += STATIC.gender; filled.gender = true; }
  if (user?.ageGroup) { score += STATIC.ageGroup; filled.ageGroup = true; }
  const cond = user?.conditions || {};
  if (cond.fattyLiver) { score += STATIC.fattyLiver; filled.fattyLiver = true; }
  if (cond.diabetes || cond.prediabetes) { score += STATIC.diabetes; filled.diabetes = true; }
  if (cond.thyroid) { score += STATIC.thyroid; filled.thyroid = true; }

  // DYNAMIC — 가입자만 누적 가능
  const dynamicProgress = {};
  if (user) {
    const now = Date.now();
    const cutoff30 = now - SIDE_EFFECTS_30D_MS;

    const logs = safeGet(() => Storage.getLogsByUser(user.id), []);
    const ex = safeGet(() => Storage.getExercisesByUser(user.id), []);
    const diets = safeGet(() => Storage.getDietsByUser(user.id), []);
    const health = safeGet(() => Storage.getHealthMetricsByUser?.(user.id), []);
    const doses = safeGet(() => Storage.getDosesByUser(user.id), []);
    const sideEffectLogs30d = logs.filter(l => {
      if (Date.parse(l.date) < cutoff30) return false;
      const se = l.sideEffects || {};
      return Object.values(se).some(v => v);
    });
    const ex30d = ex.filter(e => Date.parse(e.date) >= cutoff30);
    const diets30d = diets.filter(d => Date.parse(d.date) >= cutoff30);

    const counts = {
      weightLogs: logs.length,
      exercises30d: ex30d.length,
      diets30d: diets30d.length,
      sideEffects30d: sideEffectLogs30d.length,
      healthMetrics: health.length,
      doses: doses.length,
    };

    for (const [key, spec] of Object.entries(DYNAMIC)) {
      let gained = 0;
      for (const tier of spec.tiers) {
        if (counts[key] >= tier.count) gained += tier.addPct;
      }
      score += gained;
      dynamicProgress[key] = { count: counts[key], gained, max: spec.max };
    }
  }

  return {
    score: Math.min(100, score),
    filled,
    dynamicProgress,
  };
}

function safeGet(fn, fallback) {
  try { const v = fn(); return v || fallback; } catch { return fallback; }
}

// UI 표시용 항목별 breakdown
export function accuracyBreakdown({ user, simulator = {} }) {
  const { filled, dynamicProgress } = calculateAccuracy({ user, simulator });
  const staticItems = [
    { key: 'height',       label: '키',                weight: STATIC.height,       filled: filled.height,       category: 'static' },
    { key: 'startWeight',  label: '시작 체중',         weight: STATIC.startWeight,  filled: filled.startWeight,  category: 'static' },
    { key: 'medication',   label: '사용 약',           weight: STATIC.medication,   filled: filled.medication,   category: 'static' },
    { key: 'frequency',    label: '사용 빈도',         weight: STATIC.frequency,    filled: filled.frequency,    category: 'static' },
    { key: 'signedIn',     label: '가입',              weight: STATIC.signedIn,     filled: filled.signedIn,     category: 'static' },
    { key: 'gender',       label: '성별',              weight: STATIC.gender,       filled: filled.gender,       category: 'static' },
    { key: 'ageGroup',     label: '나이대',            weight: STATIC.ageGroup,     filled: filled.ageGroup,     category: 'static' },
    { key: 'fattyLiver',   label: '지방간',            weight: STATIC.fattyLiver,   filled: filled.fattyLiver,   category: 'static' },
    { key: 'diabetes',     label: '당뇨/전당뇨',       weight: STATIC.diabetes,     filled: filled.diabetes,     category: 'static' },
    { key: 'thyroid',      label: '갑상선 질환',       weight: STATIC.thyroid,      filled: filled.thyroid,      category: 'static' },
  ];
  const dynamicItems = Object.entries(DYNAMIC).map(([key, spec]) => {
    const p = dynamicProgress[key];
    return {
      key, label: spec.label, weight: spec.max,
      filled: p ? p.gained >= spec.max : false,
      gained: p?.gained || 0,
      count: p?.count || 0,
      tiers: spec.tiers,
      category: 'dynamic',
    };
  });
  return { staticItems, dynamicItems };
}

// 단순 점수만 필요한 호출자용
export function accuracyScore(args) {
  return calculateAccuracy(args).score;
}

export { STATIC as STATIC_WEIGHTS, DYNAMIC as DYNAMIC_WEIGHTS };
