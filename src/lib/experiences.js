// 실사용 경험 모음 — 신규 진입자의 "낯섬"을 줄이기 위한 여정 단계별 대표 경험.
//
// ⚠️ 정직성 원칙 (위마로그 카피 톤):
//   - 이건 특정 개인을 사칭한 "검증된 후기"가 아니라, 공개 커뮤니티 후기·임상 보고에서
//     반복적으로 나타나는 *대표 패턴*을 한국어로 재구성한 것입니다.
//   - 타 사이트 글을 그대로 긁어오지 않았습니다. 실제 보고된 경험의 결을 종합했습니다.
//   - 표시 시 항상 "대표 사례 · 개인차 있음" 맥락을 함께 노출합니다 (BASIS_NOTE).
//
// 근거가 된 실제 패턴 (2026 리서치):
//   - "food noise"(음식 생각)가 며칠~몇 주 내 조용해진다는 보고가 가장 흔함 (semaglutide·tirzepatide)
//   - 1주차는 저용량 적응, 부작용(오심·변비)은 시작/증량 직후 며칠~2주, 소량·천천히·수분으로 완화
//   - 측정 가능한 감량은 보통 2~4주부터
//   - 정체기는 흔하며 식욕억제 효과가 시간이 지나며 둔화되는 것과 관련
//   - 중단 후 2년 시점 약 절반은 감량 유지/추가, 약 1/3은 평균 4%가량 회복 → 유지용량·운동이 관건
//   - 약 전환(세마↔티르제파타이드)·유지용량 감량은 흔한 실제 전략

export const EXP_STAGES = [
  { id: 'decision',  label: '시작 전',   icon: '🤔', blurb: '주사가 무섭고, 약에 의존하는 건 아닐까' },
  { id: 'firstweek', label: '첫 주',     icon: '🌱', blurb: '처음 며칠, 무엇이 달라지나' },
  { id: 'foodnoise', label: '식욕 변화', icon: '🔇', blurb: '머릿속 음식 생각이 조용해지는 순간' },
  { id: 'result',    label: '결과',      icon: '📉', blurb: '눈에 보이기 시작할 때' },
  { id: 'sideeffect',label: '부작용 넘기기', icon: '🤢', blurb: '오심·변비를 어떻게 지나갔나' },
  { id: 'plateau',   label: '정체기',    icon: '🪨', blurb: '안 빠지는 구간이 왔을 때' },
  { id: 'switch',    label: '약 전환',   icon: '🔁', blurb: '다른 약으로 바꾼 이유' },
  { id: 'cost',      label: '비용·처방', icon: '💳', blurb: '가격과 접근, 현실적인 이야기' },
  { id: 'maintain',  label: '유지·중단', icon: '🏁', blurb: '끊으면 다시 찔까' },
];

export const STAGE_BY_ID = Object.fromEntries(EXP_STAGES.map(s => [s.id, s]));

// who: 대표 프로필(성별·나이대·약·용량·시점). 특정 실존 인물이 아님.
export const EXPERIENCES = [
  // ── 시작 전 ──
  { id: 'e01', stage: 'decision', drug: 'wegovy', who: '30대 여성', when: '시작 전', theme: '주사 공포',
    text: '주사가 제일 무서웠어요. 막상 펜으로 놔보니 모기 물린 정도라 허무할 만큼 안 아팠고, 첫 회만 넘기니 그 다음부턴 별 생각 없이 했습니다.' },
  { id: 'e02', stage: 'decision', drug: null, who: '40대 남성', when: '시작 전', theme: '약 의존 걱정',
    text: '“평생 맞아야 하는 거 아니냐”가 제일 걸렸어요. 의사가 목표 체중 도달하면 용량 줄이거나 간격 늘리는 식으로 조정한다고 해서 일단 해보기로.' },
  { id: 'e03', stage: 'decision', drug: 'mounjaro', who: '40대 여성', when: '시작 전', theme: '결심 계기',
    text: '다이어트를 수십 번 실패하고 마지막이라는 마음으로 시작했어요. 의지 문제가 아니라 식욕 자체를 못 이겼던 거였다는 걸 나중에 알았습니다.' },

  // ── 첫 주 ──
  { id: 'e04', stage: 'firstweek', drug: 'wegovy', who: '30대 여성', when: '1주차 · 0.25mg', theme: '첫 며칠',
    text: '0.25mg 첫 주는 체중은 거의 그대로였어요. 대신 며칠 지나니 폭식하던 게 줄고 “한 입만 더”가 사라지는 느낌. 적응 단계라 욕심 안 냈습니다.' },
  { id: 'e05', stage: 'firstweek', drug: 'mounjaro', who: '30대 남성', when: '1주차 · 2.5mg', theme: '빠른 반응',
    text: '저는 첫 주사 이틀 만에 배고픔이 확 줄었어요. 사람마다 반응 시점이 다르다는데 저는 빠른 편이었던 듯. 물 자주 마시면서 천천히 적응했습니다.' },
  { id: 'e06', stage: 'firstweek', drug: 'saxenda', who: '50대 여성', when: '1주차 · 매일', theme: '매일 주사 부담',
    text: '매일 맞는 게 처음엔 번거로웠는데 양치처럼 루틴이 되니 괜찮아졌어요. 저녁 같은 시간에 맞추니 잊지도 않고.' },

  // ── 식욕 변화 (food noise) ──
  { id: 'e07', stage: 'foodnoise', drug: 'wegovy', who: '40대 여성', when: '3~4주차 · 0.5mg', theme: '머릿속이 조용해짐',
    text: '제일 신기했던 건 “음식 생각”이 사라진 거예요. 평소엔 일하다가도 뭐 먹을지 계속 떠올랐는데, 그 소음이 뚝 끊긴 느낌. 식탁에서 반쯤 먹으면 더 안 들어가요.' },
  { id: 'e08', stage: 'foodnoise', drug: 'mounjaro', who: '30대 여성', when: '6주차 · 5mg', theme: '단 게 싫어짐',
    text: '단 게 그렇게 좋았는데 이제는 “있어도 그만” 느낌이에요. 치킨도 두 조각이면 충분. 의지로 참는 게 아니라 그냥 안 당기는 게 신기했습니다.' },
  { id: 'e09', stage: 'foodnoise', drug: null, who: '40대 남성', when: '진행 중', theme: '술 생각도 줄음',
    text: '식욕뿐 아니라 술 생각도 같이 줄었어요. 예전 같으면 매일 맥주였는데 “굳이?” 싶어지더라고요. 비슷한 얘기 하는 사람 꽤 봤습니다.' },

  // ── 결과 ──
  { id: 'e10', stage: 'result', drug: 'wegovy', who: '40대 여성', when: '3개월 · 1.0mg', theme: '첫 눈에 보임',
    text: '3개월에 -7kg. 드라마틱하진 않아도 옷이 헐거워지고 얼굴선이 보이기 시작했어요. 한 달에 2~3kg씩, 욕심 안 내고 꾸준히가 답이었습니다.' },
  { id: 'e11', stage: 'result', drug: 'mounjaro', who: '30대 여성', when: '6개월 · 10mg', theme: '15mg 안 가도 됨',
    text: '최고 용량까지 안 올리고 10mg에서 만족스러운 결과가 나왔어요. 6개월 -12kg. 굳이 무리해서 증량할 필요는 없더라고요.' },
  { id: 'e12', stage: 'result', drug: 'wegovy', who: '50대 여성', when: '4개월', theme: '간수치도 좋아짐',
    text: '체중도 체중인데 건강검진에서 간수치(ALT)랑 공복혈당이 같이 내려간 게 더 기뻤어요. 지방간 때문에 시작했던 거라 목표를 이룬 셈.' },

  // ── 부작용 넘기기 ──
  { id: 'e13', stage: 'sideeffect', drug: 'wegovy', who: '40대 여성', when: '1~2주차', theme: '오심 적응',
    text: '처음 1~2주는 정말 끊을까 했어요. 근데 식사를 절반으로 줄이고 기름진 거 피하고 천천히 먹으니 3주차부터 신기하게 가라앉았습니다. 지금은 거의 못 느껴요.' },
  { id: 'e14', stage: 'sideeffect', drug: 'mounjaro', who: '40대 남성', when: '증량 직후', theme: '증량 때마다 재발',
    text: '용량 올릴 때마다 며칠씩 다시 메스꺼웠어요. 근데 4~5일 지나면 또 적응. 증량 시기엔 약속 잡지 말고 몸 사리는 게 요령이더라고요.' },
  { id: 'e15', stage: 'sideeffect', drug: 'wegovy', who: '30대 여성', when: '6주차', theme: '변비 해결',
    text: '변비가 제일 오래 갔어요. 물 1.5L씩 의식적으로 마시고 채소 늘리니 2주 만에 정상. 먹는 양이 주니 변량 자체가 적어지는 거였더라고요.' },

  // ── 정체기 ──
  { id: 'e16', stage: 'plateau', drug: 'mounjaro', who: '40대 여성', when: '5개월차', theme: '안 빠지는 구간',
    text: '4개월쯤 잘 빠지다 갑자기 2~3주 멈췄어요. 초반 식욕억제가 강하던 게 좀 둔해지는 시기라고. 단백질 늘리고 운동 시간 살짝 늘리니 다시 움직였습니다.' },
  { id: 'e17', stage: 'plateau', drug: 'wegovy', who: '30대 여성', when: '정체기', theme: '체중계 말고 다른 지표',
    text: '체중이 멈췄을 때 인바디 보니 근육은 유지되고 체지방·허리둘레는 줄어 있었어요. 숫자 하나에만 매달리지 말자고 마음먹으니 덜 조급했습니다.' },

  // ── 약 전환 ──
  { id: 'e18', stage: 'switch', drug: 'mounjaro', who: '40대 여성', when: '위고비→마운자로', theme: '효과 부족으로 전환',
    text: '위고비로 초반엔 빠지다 정체가 길어져서 마운자로로 바꿨어요. 사람마다 잘 맞는 약이 다른 것 같아요. 전환은 의사랑 상의해서 천천히.' },
  { id: 'e19', stage: 'switch', drug: 'saxenda', who: '50대 여성', when: '마운자로→삭센다', theme: '비용 때문에 전환',
    text: '효과는 좋았지만 비용이 부담돼서 매일 맞는 삭센다로 내렸어요. 감량 속도는 좀 느려도 유지에는 충분하다고 판단했습니다.' },

  // ── 비용·처방 ──
  { id: 'e20', stage: 'cost', drug: 'wegovy', who: '30대 남성', when: '처방 경험', theme: '비대면 처방',
    text: '바빠서 비대면 진료로 받고 약은 택배로 왔어요. 생각보다 절차가 간단했고, 다만 가격은 약국·지역마다 차이가 꽤 나서 비교는 필수.' },
  { id: 'e21', stage: 'cost', drug: 'mounjaro', who: '40대 여성', when: '비용 현실', theme: '용량 올릴수록 비쌈',
    text: '용량 올라갈수록 가격이 가파르게 뛰어요. 보험도 안 되고. 그래서 목표 도달하면 유지용량으로 내려서 비용을 낮추는 계획을 처음부터 세웠습니다.' },

  // ── 유지·중단 ──
  { id: 'e22', stage: 'maintain', drug: null, who: '40대 여성', when: '목표 도달 후', theme: '유지용량으로',
    text: '목표 체중 찍고 바로 끊는 대신 저용량·간격 늘리기로 유지 중이에요. 운동 습관을 같이 붙여두니 식욕이 조금 돌아와도 흔들리지 않더라고요.' },
  { id: 'e23', stage: 'maintain', drug: 'wegovy', who: '30대 여성', when: '중단 후', theme: '요요 관리',
    text: '끊고 두세 달 지나니 식욕이 조금씩 돌아왔어요. 약간 다시 찌긴 했는데 운동을 유지한 덕에 예전만큼은 아니었습니다. 완전 중단은 신중하게.' },
  { id: 'e24', stage: 'maintain', drug: null, who: '50대 남성', when: '장기 관점', theme: '평생 vs 전략',
    text: '“끊으면 도로아미타불”이라고만 생각했는데, 끊은 사람 중 절반 가까이는 유지하거나 더 빠진다는 데이터를 보고 마음이 편해졌어요. 유지 전략이 핵심.' },
];

// 표시용 정직성 노출 문구 (컴포넌트 푸터/툴팁)
export const BASIS_NOTE =
  '공개 커뮤니티 후기·임상 보고에서 반복되는 대표 패턴을 정리한 사례입니다. 특정 개인의 검증된 후기가 아니며, 효과·부작용은 개인차가 큽니다.';

// 신규 진입자(낯섬 제거)에 가장 효과적인 순서 — 감정 비트 우선
export const LANDING_STAGE_ORDER = ['decision', 'foodnoise', 'firstweek', 'sideeffect', 'result', 'plateau', 'maintain', 'switch', 'cost'];

export function experiencesByStage(stage) {
  return EXPERIENCES.filter(e => e.stage === stage);
}

export function experiencesForDrug(drug) {
  return EXPERIENCES.filter(e => e.drug === drug || e.drug === null);
}
