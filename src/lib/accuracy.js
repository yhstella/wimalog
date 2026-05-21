// AI 예측 정확도 계산 단일 source
// Simulator + Statistics + 다른 곳에서 공통 사용.
// 입력 정보 양 + 본인 추이 누적 → 0~100%
import { Storage } from './storage.js';

// 정확도 가중치 (총 100%)
// base 40 (키·체중·약·빈도 — 비가입자에도 채워짐)
// +10 가입 (본인 추이 가능해짐)
// +8 성별, +8 나이대
// +14 운동량 (가장 강한 보정자)
// +6 지방간, +6 당뇨 (동반질환)
// +8 본인 weight log 4건 이상 (실측 누적)
export const ACCURACY_WEIGHTS = {
  base: 40,
  signedIn: 10,
  gender: 8,
  ageGroup: 8,
  exerciseLevel: 14,
  fattyLiver: 6,
  diabetes: 6,
  logsAccumulated: 8,
};

// 정확도 계산 — user + 추가 입력
export function calculateAccuracy({ user, exerciseLevel, hasFattyLiver, hasDiabetes }) {
  let score = ACCURACY_WEIGHTS.base;
  if (user) {
    score += ACCURACY_WEIGHTS.signedIn;
    if (user.gender && user.gender !== 'X') score += ACCURACY_WEIGHTS.gender;
    if (user.ageGroup) score += ACCURACY_WEIGHTS.ageGroup;
    // 동반질환은 user.conditions에서도 체크
    const cond = user.conditions || {};
    if (hasFattyLiver || cond.fattyLiver) score += ACCURACY_WEIGHTS.fattyLiver;
    if (hasDiabetes || cond.diabetes || cond.prediabetes) score += ACCURACY_WEIGHTS.diabetes;
    // 본인 체중 log 4건 이상이면 보정
    try {
      const logs = Storage.getLogsByUser(user.id);
      if (logs.length >= 4) score += ACCURACY_WEIGHTS.logsAccumulated;
    } catch {}
  }
  if (exerciseLevel) score += ACCURACY_WEIGHTS.exerciseLevel;
  return Math.min(100, score);
}

// 각 항목별 기여도 (UI 표시용) — '+N%' chip
export function accuracyBreakdown({ user, exerciseLevel, hasFattyLiver, hasDiabetes }) {
  const cond = user?.conditions || {};
  let logs = [];
  try { if (user) logs = Storage.getLogsByUser(user.id); } catch {}
  return [
    { key: 'base',         label: '기본 (키·체중·약)',     weight: ACCURACY_WEIGHTS.base,         filled: true },
    { key: 'signedIn',     label: '가입',                  weight: ACCURACY_WEIGHTS.signedIn,     filled: !!user },
    { key: 'gender',       label: '성별',                  weight: ACCURACY_WEIGHTS.gender,       filled: !!user && user.gender && user.gender !== 'X' },
    { key: 'ageGroup',     label: '나이대',                weight: ACCURACY_WEIGHTS.ageGroup,     filled: !!user && !!user.ageGroup },
    { key: 'exerciseLevel',label: '운동량',                weight: ACCURACY_WEIGHTS.exerciseLevel,filled: !!exerciseLevel },
    { key: 'fattyLiver',   label: '지방간 여부',           weight: ACCURACY_WEIGHTS.fattyLiver,   filled: !!hasFattyLiver || !!cond.fattyLiver },
    { key: 'diabetes',     label: '당뇨/전당뇨',           weight: ACCURACY_WEIGHTS.diabetes,     filled: !!hasDiabetes || !!cond.diabetes || !!cond.prediabetes },
    { key: 'logsAccumulated', label: '체중 4회+ 기록',    weight: ACCURACY_WEIGHTS.logsAccumulated, filled: logs.length >= 4 },
  ];
}
