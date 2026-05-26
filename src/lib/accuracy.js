// AI 예측 정확도 — Dynamic 비중 강화 + 동반질환 "없음" 명시 메커니즘
// 사용자 지적: "지방간이 없으면 그냥 없는건데 별도 기록 방법 없으면 가중치 못 받음"
// 해결: user.conditionsChecked = true 플래그 — 점검 완료 시 명시적 "없음"도 가중치 받음
import { Storage } from './storage.js';

// === Static — 일회성 입력 (총 30%) ===
// 사용자 의견 반영: 대부분 측면이 dynamic이 맞음. Static은 30%로 축소.
const STATIC = {
  height:        3,
  startWeight:   3,
  medication:    5,
  frequency:     3,
  signedIn:      4,
  visitPurpose:  3,   // 약 사용 중/시작 예정/중단 고려 등 — 매칭 코호트 결정
  gender:        3,
  ageGroup:      3,
  // 동반질환은 "확인 완료" 플래그 기반 — 있음/없음 둘 다 시그널
  conditionsChecked: 3,
};   // 30

// === Dynamic — 누적 데이터 단계별 (총 70%) ===
const DYNAMIC = {
  weightLogs: {
    label: '체중 기록 (누적)',
    max: 22,
    tiers: [
      { count: 4,  addPct: 8,  hint: '4주 연속' },
      { count: 8,  addPct: 5,  hint: '8주 누적' },
      { count: 16, addPct: 5,  hint: '4개월 누적' },
      { count: 24, addPct: 4,  hint: '6개월 누적' },
    ],
  },
  exercises30d: {
    label: '운동 (최근 1개월)',
    max: 15,
    tiers: [
      { count: 5,  addPct: 7,  hint: '월 5회+' },
      { count: 10, addPct: 5,  hint: '월 10회+' },
      { count: 20, addPct: 3,  hint: '월 20회+ (생활화)' },
    ],
  },
  diets30d: {
    label: '식단 (최근 1개월)',
    max: 10,
    tiers: [
      { count: 5,  addPct: 5,  hint: '월 5회+' },
      { count: 10, addPct: 3,  hint: '월 10회+' },
      { count: 20, addPct: 2,  hint: '월 20회+' },
    ],
  },
  sideEffects30d: {
    label: '부작용 기록 (최근 1개월)',
    max: 7,
    tiers: [
      { count: 3, addPct: 4, hint: '월 3건+' },
      { count: 6, addPct: 3, hint: '월 6건+' },
    ],
  },
  healthMetrics: {
    label: '혈액검사·인바디 (누적)',
    max: 9,
    tiers: [
      { count: 1, addPct: 4, hint: '1건' },
      { count: 3, addPct: 3, hint: '3건+ (시점 비교)' },
      { count: 5, addPct: 2, hint: '5건+ (장기 추세)' },
    ],
  },
  doses: {
    label: '투약 기록 (누적)',
    max: 7,
    tiers: [
      { count: 4, addPct: 4, hint: '4회+' },
      { count: 8, addPct: 3, hint: '8회+ (증량·유지 패턴)' },
    ],
  },
};  // 70

const DAYS_30_MS = 30 * 86400000;

// 본체
// 표시 정확도: 50% 베이스라인(동전 던지기) + 입력 가중치의 절반.
// 사용자 어떤 정보도 없어도 최소 50% — "AI 예측이 무작위보다 못하다"는 인상 방지.
export function calculateAccuracy({ user, simulator = {} }) {
  let score = 0;
  const filled = {};

  // STATIC. simulator(sessionStorage) 우선, 없으면 user 값 — 비가입자가 시뮬레이터에서
  // 입력한 gender/ageGroup도 정확도에 반영되도록.
  if (simulator.height || user?.height) { score += STATIC.height; filled.height = true; }
  if (simulator.startWeight || user?.startWeight) { score += STATIC.startWeight; filled.startWeight = true; }
  if (simulator.medication) { score += STATIC.medication; filled.medication = true; }
  if (simulator.frequency) { score += STATIC.frequency; filled.frequency = true; }
  if (user) { score += STATIC.signedIn; filled.signedIn = true; }
  if (user?.visitPurpose) { score += STATIC.visitPurpose; filled.visitPurpose = true; }
  const effectiveGender = user?.gender || simulator.gender;
  if (effectiveGender && effectiveGender !== 'X') { score += STATIC.gender; filled.gender = true; }
  const effectiveAge = user?.ageGroup || simulator.ageGroup;
  if (effectiveAge) { score += STATIC.ageGroup; filled.ageGroup = true; }
  // ⭐ 동반질환 "확인 완료" 플래그 — 있음/없음 둘 다 시그널로 인정
  if (user?.conditionsChecked) { score += STATIC.conditionsChecked; filled.conditionsChecked = true; }

  // DYNAMIC
  const dynamicProgress = {};
  if (user) {
    const cutoff30 = Date.now() - DAYS_30_MS;
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

  const rawScore = Math.min(100, score);
  // 50% 베이스라인(동전 던지기) + 가중치 * 0.4. 입력 없으면 50%, 모두 입력 시 90%.
  // 100%는 생물학적 예측에서 불가능 — 상한 90%로 솔직하게.
  const displayScore = 50 + Math.round(rawScore * 0.4);

  return {
    score: displayScore,
    rawScore,
    filled,
    dynamicProgress,
  };
}

function safeGet(fn, fallback) {
  try { const v = fn(); return v || fallback; } catch { return fallback; }
}

// UI 표시용
export function accuracyBreakdown({ user, simulator = {} }) {
  const { filled, dynamicProgress } = calculateAccuracy({ user, simulator });
  const staticItems = [
    { key: 'height',           label: '키',                weight: STATIC.height,           filled: filled.height,           category: 'static' },
    { key: 'startWeight',      label: '시작 체중',         weight: STATIC.startWeight,      filled: filled.startWeight,      category: 'static' },
    { key: 'medication',       label: '사용 약',           weight: STATIC.medication,       filled: filled.medication,       category: 'static' },
    { key: 'frequency',        label: '사용 빈도',         weight: STATIC.frequency,        filled: filled.frequency,        category: 'static' },
    { key: 'signedIn',         label: '가입',              weight: STATIC.signedIn,         filled: filled.signedIn,         category: 'static' },
    { key: 'visitPurpose',     label: '현재 단계',         weight: STATIC.visitPurpose,     filled: filled.visitPurpose,     category: 'static' },
    { key: 'gender',           label: '성별',              weight: STATIC.gender,           filled: filled.gender,           category: 'static' },
    { key: 'ageGroup',         label: '나이대',            weight: STATIC.ageGroup,         filled: filled.ageGroup,         category: 'static' },
    { key: 'conditionsChecked',label: '동반질환 확인',     weight: STATIC.conditionsChecked,filled: filled.conditionsChecked,category: 'static' },
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

export function accuracyScore(args) {
  return calculateAccuracy(args).score;
}

export { STATIC as STATIC_WEIGHTS, DYNAMIC as DYNAMIC_WEIGHTS };
