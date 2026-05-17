// 액세스 등급 시스템. 통계/기능별로 어떤 등급이 필요한지 명시합니다.
// anonymous: 비가입자 (랜딩만)
// free: 가입한 무료 사용자 (대부분의 통계 + 본인 기록)
// premium: 유료 사용자 (진료용 리포트, AI 분석, 정밀 매칭)

export const TIERS = {
  anonymous: 0,
  free: 1,
  premium: 2,
};

export function currentTier(user) {
  if (!user) return 'anonymous';
  if (user.premium) return 'premium';
  return 'free';
}

export function hasAccess(tier, required) {
  return TIERS[tier] >= TIERS[required];
}

// 화면별 잠금 정책
export const POLICY = {
  // 평균 감량 곡선
  lossCurveFullWeeks: 'free',   // 12주 이상 모두 보기
  lossCurvePartial:   'anonymous', // 4주차까지는 비가입자도 보기

  // 약제별 비교 차트
  medicationCompare: 'free',

  // 지역별 가격 상세 표
  priceAllRegions: 'free',
  priceTopRegion:  'anonymous', // 상위 1개만 비가입자 노출

  // 부작용 발생률
  sideEffectAll:    'free',
  sideEffectTop3:   'anonymous',

  // 중단률
  discontinuation: 'free',

  // 운동 패턴 통계
  exercisePattern: 'free',

  // 코호트 비교 (나와 비슷한 사용자)
  similarCohort:   'free',

  // 진료용 PDF 리포트
  doctorReport: 'premium',

  // AI 주간 리포트
  aiWeeklyReport: 'premium',

  // 약가 가성비 분석
  costEfficiency: 'premium',

  // 이상 신호 알림
  trendAlerts: 'premium',
};

// 헬퍼: 어떤 정책에 접근 가능한가?
export function can(user, policyKey) {
  const required = POLICY[policyKey];
  if (!required) return true;
  return hasAccess(currentTier(user), required);
}
