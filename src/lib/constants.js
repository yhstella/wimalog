// 약제 옵션
export const MEDS = [
  { id: 'wegovy',   label: '위고비 (Wegovy)',     doses: ['0.25mg', '0.5mg', '1.0mg', '1.7mg', '2.4mg'], frequency: '주 1회' },
  { id: 'mounjaro', label: '마운자로 (Mounjaro)', doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'], frequency: '주 1회' },
  { id: 'saxenda',  label: '삭센다 (Saxenda)',    doses: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3.0mg'], frequency: '매일' },
  { id: 'ozempic',  label: '오젬픽 (Ozempic)',    doses: ['0.25mg', '0.5mg', '1.0mg', '2.0mg'], frequency: '주 1회' },
  { id: 'zepbound', label: '젭바운드 (Zepbound)', doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'], frequency: '주 1회' },
  { id: 'other',    label: '기타',                doses: ['저용량', '중용량', '고용량'], frequency: '' },
];

export const MED_BY_ID = Object.fromEntries(MEDS.map(m => [m.id, m]));

export const GENDERS = [
  { id: 'F', label: '여성' },
  { id: 'M', label: '남성' },
  { id: 'X', label: '응답 안 함' },
];

export const AGE_GROUPS = [
  { id: '20s', label: '20대' },
  { id: '30s', label: '30대' },
  { id: '40s', label: '40대' },
  { id: '50s', label: '50대' },
  { id: '60s+', label: '60대 이상' },
];

export const PURPOSES = [
  { id: 'weight',   label: '체중 감량' },
  { id: 'diabetes', label: '당뇨 관리' },
  { id: 'fatty',    label: '지방간/대사질환' },
  { id: 'doctor',   label: '의사 권유' },
  { id: 'other',    label: '기타' },
];

export const CONCERNS = [
  { id: 'effect',     label: '효과' },
  { id: 'sideeffect', label: '부작용' },
  { id: 'cost',       label: '비용' },
  { id: 'rebound',    label: '요요' },
  { id: 'longterm',   label: '장기 안전성' },
  { id: 'stopping',   label: '중단 후 변화' },
];

export const CONDITIONS = [
  { id: 'diabetes',     label: '당뇨' },
  { id: 'prediabetes',  label: '전당뇨' },
  { id: 'fattyLiver',   label: '지방간' },
  { id: 'hypertension', label: '고혈압' },
  { id: 'dyslipidemia', label: '이상지질혈증' },
  { id: 'thyroid',      label: '갑상선 질환' },
];

export const SIDE_EFFECTS = [
  { id: 'nausea',      label: '오심(메스꺼움)' },
  { id: 'vomiting',    label: '구토' },
  { id: 'constipation',label: '변비' },
  { id: 'diarrhea',    label: '설사' },
  { id: 'fatigue',     label: '피로감' },
  { id: 'dizziness',   label: '어지러움' },
  { id: 'abdomenPain', label: '복통' },
  { id: 'hairLoss',    label: '탈모' },
  { id: 'reflux',      label: '역류성' },
  { id: 'headache',    label: '두통' },
];

export const DISCONTINUE_REASONS = [
  { id: 'cost',       label: '비용 부담' },
  { id: 'sideeffect', label: '부작용' },
  { id: 'noeffect',   label: '효과 부족' },
  { id: 'goal',       label: '목표 도달' },
  { id: 'supply',     label: '공급 부족' },
  { id: 'doctor',     label: '의사 권유' },
  { id: 'other',      label: '기타' },
];

// 경고 증상 - 즉시 의료기관 문의 안내 대상
export const RED_FLAG_SYMPTOMS = [
  '심하고 지속되는 복통 (특히 등으로 뻗치는 통증)',
  '지속되는 구토와 탈수',
  '눈/피부 황달, 짙은 소변색',
  '심한 저혈당 증상 (식은땀, 의식 흐려짐)',
  '갑상선 부위 멍울, 쉰 목소리, 삼키기 어려움',
  '심한 알레르기 반응 (두드러기, 호흡곤란)',
];

// 운동 종류 — met = Metabolic Equivalent of Task (활동대사량). ACSM/Compendium 참고치.
// 강도 1~5 보정은 estimateCalories()에서 따로 적용.
export const EXERCISE_TYPES = [
  { id: 'walking',  label: '걷기',         met: 3.5 },
  { id: 'jogging',  label: '러닝/조깅',    met: 8.0 },
  { id: 'cycling',  label: '자전거',       met: 6.0 },
  { id: 'swimming', label: '수영',         met: 7.0 },
  { id: 'hiking',   label: '등산',         met: 7.0 },
  { id: 'strength', label: '근력 운동',    met: 5.0 },
  { id: 'yoga',     label: '요가/필라테스', met: 3.0 },
  { id: 'sports',   label: '구기/라켓',    met: 6.5 },
  { id: 'home',     label: '홈트',         met: 5.0 },
  { id: 'other',    label: '기타',         met: 4.0 },
];
export const EXERCISE_BY_ID = Object.fromEntries(EXERCISE_TYPES.map(e => [e.id, e]));

// kcal 추정 — Compendium 공식: kcal = MET × 체중(kg) × 시간(h).
// 강도 1~5 보정: 1=0.7, 2=0.85, 3=1.0, 4=1.2, 5=1.4 (저~고강도 효율 차이 반영)
const INTENSITY_FACTOR = { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.2, 5: 1.4 };
export function estimateExerciseCalories({ type, durationMin, intensity = 3, weightKg }) {
  if (!type || !durationMin || !weightKg) return null;
  const ex = EXERCISE_BY_ID[type];
  if (!ex) return null;
  const factor = INTENSITY_FACTOR[intensity] ?? 1.0;
  const kcal = ex.met * weightKg * (durationMin / 60) * factor;
  return Math.round(kcal);
}

// 식사 종류
export const MEAL_TYPES = [
  { id: 'breakfast', label: '아침' },
  { id: 'lunch',     label: '점심' },
  { id: 'dinner',    label: '저녁' },
  { id: 'snack',     label: '간식' },
];
export const MEAL_BY_ID = Object.fromEntries(MEAL_TYPES.map(m => [m.id, m]));

// 식단 패턴 (선택 태그)
export const DIET_PATTERNS = [
  { id: 'lowcarb',     label: '저탄수' },
  { id: 'highprotein', label: '고단백' },
  { id: 'lowfat',      label: '저지방' },
  { id: 'mediterranean', label: '지중해식' },
  { id: 'intermittent', label: '간헐적 단식' },
  { id: 'vegetarian',  label: '채식' },
  { id: 'normal',      label: '일반식' },
];

// 평소 식사 횟수
export const MEAL_FREQUENCIES = [
  { id: '1', label: '하루 1끼' },
  { id: '2', label: '하루 2끼' },
  { id: '3', label: '하루 3끼' },
  { id: '4+', label: '하루 4끼 이상' },
  { id: 'irregular', label: '불규칙' },
];

// 간식 빈도
export const SNACK_FREQUENCIES = [
  { id: 'never',  label: '거의 안 함' },
  { id: 'rare',   label: '주 1-2회' },
  { id: 'often',  label: '주 3-5회' },
  { id: 'daily',  label: '매일' },
];

// 야식 빈도
export const LATE_NIGHT_EATING = [
  { id: 'never',  label: '없음' },
  { id: 'rare',   label: '월 1-2회' },
  { id: 'sometimes', label: '주 1-2회' },
  { id: 'often',  label: '주 3회 이상' },
];

// 자주 등장하는 한국 구매 지역 (자동완성 힌트)
export const REGION_SUGGESTIONS = [
  '서울 대학로', '서울 강남', '서울 종로', '서울 신촌', '서울 송파',
  '경기 분당', '경기 일산', '경기 수원',
  '부산', '대구', '인천', '광주', '대전', '울산',
  '해외 직구', '온라인',
];
