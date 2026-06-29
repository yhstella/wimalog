// 실사용 경험 대량 생성기 — 주제별 '완결 문장' 조각을 같은 주제 안에서 조합해
// 1000+개의 자연스러운 대표 경험을 만든다.
//
// 설계 원칙:
//   - 각 조각은 그 자체로 완결된 자연스러운 한국어 문장 → 이어 붙여도 조사/문법이 깨지지 않음
//   - 같은 theme 안에서만 조합 → 의미가 어긋나지 않음 (주사공포 도입 + 식욕 결말 같은 incoherence 방지)
//   - profile(성별·나이대·약·시점)은 본문과 분리 → 본문은 약/용량을 가급적 안 박아 조합 자유도↑
//   - 시드 PRNG로 결정적 생성(렌더마다 안 바뀜), 본문 기준 dedup
//
// 정직성: 이건 특정 개인의 검증 후기가 아니라 공개 후기·임상 보고의 대표 패턴을
//   한국어로 재구성·확장한 것. 표시 시 BASIS_NOTE 항상 노출 (experiences.js).

// ── 시드 PRNG (mulberry32) ──
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 약·용량·시점 ──
const DRUG_DOSES = {
  wegovy:   ['0.25mg', '0.5mg', '1.0mg', '1.7mg', '2.4mg'],
  mounjaro: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
  saxenda:  ['0.6mg', '1.2mg', '1.8mg', '3.0mg'],
  ozempic:  ['0.25mg', '0.5mg', '1.0mg'],
  zepbound: ['5mg', '10mg', '15mg'],
};
// 시작/중기/후기 용량 인덱스 가이드
const DOSE_TIER = {
  early: 0, mid: 0.45, late: 0.8,
};
function doseFor(drug, tier) {
  const arr = DRUG_DOSES[drug] || DRUG_DOSES.wegovy;
  const idx = Math.min(arr.length - 1, Math.round((arr.length - 1) * DOSE_TIER[tier]));
  return arr[idx];
}

const GENDERS = [['여성', 0.62], ['남성', 0.38]];
const AGES = [['20대', 0.12], ['30대', 0.3], ['40대', 0.3], ['50대', 0.2], ['60대', 0.08]];
const DRUGS_GENERAL = [['wegovy', 0.42], ['mounjaro', 0.4], ['saxenda', 0.1], ['ozempic', 0.04], ['zepbound', 0.04]];

// ── 조각 라이브러리: stage → themes[] → { drug?, openers, middles, closers, when(fn) } ──
// when(drug) → 시점/용량 문자열. drug 고정 theme은 drug 필드로 지정.
const STAGE_FRAGMENTS = {
  decision: {
    whenFor: () => '시작 전',
    doseTier: null,
    themes: [
      { key: '주사공포',
        openers: ['주사 맞는 게 제일 무서웠어요.', '바늘 공포증이 있어서 펜 주사를 한참 망설였어요.', '“주사”라는 말에 시작을 몇 번이나 미뤘어요.', '펜으로 직접 놓는다는 게 부담이었어요.', '주사라면 질색이라 고민이 길었어요.'],
        middles: ['막상 놔보니 바늘이 가늘어서 모기 물린 정도였어요.', '배에 놓으니 따끔하지도 않게 들어갔어요.', '생각보다 통증이 거의 없어서 허무할 정도였어요.', '허벅지에 놓는 게 저는 제일 편했어요.', '주 1회라 부담이 덜했어요.'],
        closers: ['첫 회만 넘기니 그다음부턴 아무렇지 않았어요.', '이제는 별생각 없이 루틴처럼 놓습니다.', '괜히 겁먹었다 싶을 만큼 금방 익숙해졌어요.', '지금은 오히려 덤덤하게 놓아요.'] },
      { key: '약의존걱정',
        openers: ['“평생 맞아야 하는 거 아니냐”가 제일 걸렸어요.', '약에 의존하게 될까 봐 망설였어요.', '끊으면 다 도로 찐다는 말에 겁이 났어요.', '약으로 빼는 게 맞나 싶어 오래 고민했어요.'],
        middles: ['의사가 목표에 도달하면 용량을 줄이거나 간격을 늘린다고 했어요.', '유지 용량으로 낮추는 전략이 있다고 들었어요.', '끊은 사람의 절반 가까이는 유지한다는 데이터를 봤어요.', '운동을 같이 붙이면 된다고 하더라고요.'],
        closers: ['그래서 일단 해보기로 마음먹었어요.', '막연한 걱정이 한결 가벼워졌어요.', '생각을 바꾸니 시작이 쉬워졌어요.'] },
      { key: '결심계기',
        openers: ['다이어트를 수십 번 실패하고 마지막이라는 마음으로 시작했어요.', '건강검진에서 지방간·혈당 얘기를 듣고 결심했어요.', '무릎이 아파서 체중부터 줄이라는 말에 시작했어요.', '결혼·행사 앞두고 큰맘 먹고 시작했어요.'],
        middles: ['의지 문제가 아니라 식욕 자체를 못 이겼던 거였어요.', '혼자 굶는 다이어트는 늘 요요로 끝났었어요.', '“나잇살”이라며 포기하던 차였어요.', '운동만으로는 한계가 있었어요.'],
        closers: ['약의 도움을 받는 것도 방법이라고 생각을 바꿨어요.', '이번엔 좀 다를 것 같다는 기대가 생겼어요.', '늦기 전에 시작하길 잘했어요.'] },
      { key: '효과의구심',
        openers: ['광고처럼 진짜 빠질까 반신반의했어요.', '남들 후기가 과장 아닐까 의심했어요.', '나한테도 들을까 싶어 기대를 안 했어요.'],
        middles: ['큰 기대 없이 시작했는데 첫 달부터 반응이 왔어요.', '드라마틱하진 않아도 꾸준히 줄긴 했어요.', '직접 겪어보니 이해가 됐어요.'],
        closers: ['지금은 일찍 시작할 걸 싶어요.', '의심했던 게 머쓱할 정도예요.'] },
    ],
  },
  firstweek: {
    whenFor: (d) => `1주차 · ${doseFor(d, 'early')}`,
    themes: [
      { key: '초기적응',
        openers: ['첫 주는 체중이 거의 그대로였어요.', '첫 주는 적응 단계라 욕심 안 냈어요.', '처음 일주일은 큰 변화를 못 느꼈어요.', '저용량으로 시작해 천천히 갔어요.'],
        middles: ['대신 폭식하던 게 줄고 “한 입만 더”가 사라졌어요.', '식사량이 자연스럽게 줄어드는 느낌이었어요.', '군것질에 손이 덜 가기 시작했어요.', '배부른 신호가 조금 빨라졌어요.'],
        closers: ['적응 단계로 여기고 물을 자주 마시며 지나갔어요.', '조급해하지 않은 게 잘한 것 같아요.', '몸이 약에 익숙해지는 시간으로 봤어요.'] },
      { key: '빠른반응',
        openers: ['저는 첫 주사 이틀 만에 배고픔이 확 줄었어요.', '첫날부터 식욕이 눈에 띄게 줄었어요.', '시작하자마자 반응이 와서 놀랐어요.'],
        middles: ['사람마다 반응 시점이 다르다는데 저는 빠른 편이었어요.', '한 끼에 반 공기도 다 못 먹었어요.', '평소 좋아하던 음식이 안 당겼어요.'],
        closers: ['너무 안 먹게 될까 봐 단백질은 챙겼어요.', '물 자주 마시며 천천히 적응했어요.', '신기하면서도 조심스럽게 시작했어요.'] },
      { key: '루틴만들기',
        openers: ['매일/매주 같은 시간에 맞추는 루틴을 잡았어요.', '주사 요일을 정해두니 잊지 않게 됐어요.', '냉장 보관·교체 주기를 챙기는 게 처음엔 낯설었어요.'],
        middles: ['양치처럼 습관이 되니 괜찮아졌어요.', '알림을 맞춰두니 빠뜨릴 일이 없었어요.', '저녁 시간에 맞추는 게 저한테 맞았어요.'],
        closers: ['지금은 자연스러운 일과가 됐어요.', '루틴이 잡히니 한결 수월했어요.'] },
    ],
  },
  foodnoise: {
    whenFor: (d) => `${['3주차', '4주차', '6주차'][0]} · ${doseFor(d, 'mid')}`,
    whenPool: ['3주차', '4주차', '6주차', '두 달차'],
    themes: [
      { key: '음식생각감소',
        openers: ['제일 신기했던 건 “음식 생각”이 사라진 거예요.', '머릿속 음식 소음이 조용해진 게 가장 컸어요.', '종일 뭐 먹을지 떠오르던 게 뚝 끊겼어요.', '식탐이라는 게 이렇게 줄 수 있구나 싶었어요.'],
        middles: ['식탁에서 반쯤 먹으면 더 안 들어가요.', '배부른 신호가 빨리 와요.', '예전 같으면 더 먹었을 텐데 자연스럽게 멈춰져요.', '간식 생각이 거의 안 나요.'],
        closers: ['의지로 참는 게 아니라 그냥 안 당기는 게 신기했어요.', '스트레스 폭식이 사라진 게 제일 좋아요.', '식사가 단순해지니 마음이 편해졌어요.'] },
      { key: '단것싫어짐',
        openers: ['단 게 그렇게 좋았는데 이제는 “있어도 그만”이에요.', '달고 기름진 음식이 부담스러워졌어요.', '디저트 욕구가 확 줄었어요.'],
        middles: ['치킨도 두세 조각이면 충분해요.', '커피도 달지 않게 바꾸게 됐어요.', '한 입 먹으면 금방 질려요.'],
        closers: ['입맛 자체가 바뀐 느낌이에요.', '굳이 참지 않아도 되니 편해요.'] },
      { key: '술담배감소',
        openers: ['식욕뿐 아니라 술 생각도 같이 줄었어요.', '신기하게 음주 욕구가 줄었어요.', '회식 자리에서도 덜 마시게 됐어요.'],
        middles: ['“굳이?” 싶어지더라고요.', '한 잔만 마셔도 충분해졌어요.', '예전만큼 술이 당기지 않았어요.'],
        closers: ['비슷한 얘기를 하는 사람을 꽤 봤어요.', '덤으로 얻은 변화라 반가웠어요.'] },
    ],
  },
  result: {
    whenPool: ['3개월', '4개월', '6개월', '5개월'],
    whenFor: (d) => `3개월 · ${doseFor(d, 'late')}`,
    themes: [
      { key: '가시적결과',
        openers: ['3개월에 제법 빠졌어요.', '두 달 만에 옷이 헐거워졌어요.', '반년 동안 꾸준히 줄었어요.', '체중계 숫자가 처음으로 의미 있게 움직였어요.'],
        middles: ['드라마틱하진 않아도 꾸준히 줄었어요.', '얼굴선부터 달라지기 시작했어요.', '한 달에 2~3kg씩 욕심 안 내고 갔어요.', '계단 오를 때 숨이 덜 차요.'],
        closers: ['꾸준함이 답이었던 것 같아요.', '주변에서 먼저 알아봐 줬어요.', '작은 변화가 쌓이는 재미가 있었어요.'] },
      { key: '용량절제',
        openers: ['최고 용량까지 안 올리고도 만족스러웠어요.', '중간 용량에서 충분히 빠졌어요.', '무리하게 증량하지 않았어요.'],
        middles: ['굳이 무리해서 올릴 필요는 없더라고요.', '낮은 용량으로 천천히 가도 결과는 비슷했어요.', '몸 상태 보며 천천히 조절했어요.'],
        closers: ['비용도 아끼고 부작용도 덜했어요.', '내 페이스대로 간 게 잘 맞았어요.'] },
      { key: '건강지표개선',
        openers: ['체중보다 간수치랑 공복혈당이 같이 내려간 게 더 기뻤어요.', '지방간 때문에 시작했는데 수치가 좋아졌어요.', '혈압이 같이 내려간 게 반가웠어요.'],
        middles: ['건강검진 결과가 눈에 띄게 달라졌어요.', '약 줄여도 된다는 얘기를 들었어요.', '컨디션 자체가 가벼워졌어요.'],
        closers: ['목표를 제대로 이룬 셈이에요.', '체중은 결과 중 하나일 뿐이었어요.'] },
    ],
  },
  sideeffect: {
    whenPool: ['1~2주차', '증량 직후', '6주차', '초기'],
    whenFor: (d) => `1~2주차 · ${doseFor(d, 'early')}`,
    themes: [
      { key: '오심적응',
        openers: ['처음 1~2주는 정말 끊을까 했어요.', '시작하고 메스꺼움이 제일 힘들었어요.', '울렁거림 때문에 고비가 있었어요.'],
        middles: ['식사를 절반으로 줄이고 기름진 걸 피하고 천천히 먹었어요.', '조금씩 자주 먹는 식으로 바꿨어요.', '생강차랑 미지근한 물이 도움이 됐어요.'],
        closers: ['3주차부터 신기하게 가라앉았어요.', '지금은 거의 못 느껴요.', '넘기고 나니 별것 아니었어요.'] },
      { key: '증량부작용',
        openers: ['용량 올릴 때마다 며칠씩 다시 메스꺼웠어요.', '증량 직후가 늘 고비였어요.', '올릴 때마다 적응을 다시 했어요.'],
        middles: ['4~5일 지나면 또 적응이 됐어요.', '증량 주에는 약속을 안 잡았어요.', '천천히 올리니 견딜 만했어요.'],
        closers: ['몸을 좀 사리는 게 요령이더라고요.', '패턴을 알고 나니 덜 불안했어요.'] },
      { key: '변비',
        openers: ['변비가 제일 오래 갔어요.', '먹는 양이 줄어서인지 변비가 왔어요.', '화장실 가는 게 뜸해졌어요.'],
        middles: ['물을 의식적으로 1.5L씩 마시고 채소를 늘렸어요.', '가벼운 산책을 매일 했어요.', '유산균과 식이섬유를 챙겼어요.'],
        closers: ['2주쯤 지나니 정상으로 돌아왔어요.', '수분이 핵심이었어요.'] },
      { key: '피로기타',
        openers: ['초반에 기운이 좀 없었어요.', '두통이 며칠 있었어요.', '어지러움이 잠깐 있었어요.'],
        middles: ['단백질이랑 수분을 의식적으로 챙겼어요.', '식사 시간을 거르지 않으려 했어요.', '무리한 일정을 줄였어요.'],
        closers: ['1~2주 지나니 괜찮아졌어요.', '몸이 적응하면서 사라졌어요.'] },
    ],
  },
  plateau: {
    whenPool: ['4개월차', '5개월차', '정체기'],
    whenFor: (d) => `4개월차 · ${doseFor(d, 'mid')}`,
    themes: [
      { key: '정체',
        openers: ['잘 빠지다 갑자기 2~3주 멈췄어요.', '중반부터 체중이 안 움직였어요.', '한동안 정체기가 왔어요.', '같은 용량인데 어느 순간 멈췄어요.'],
        middles: ['초반 식욕억제가 둔해지는 시기라고 하더라고요.', '단백질을 늘리고 운동 시간을 살짝 늘렸어요.', '식단을 다시 점검했어요.', '수면·스트레스부터 챙겼어요.'],
        closers: ['다시 조금씩 움직이기 시작했어요.', '조급해하지 않으려 했어요.', '정체기도 과정이라 생각했어요.', '의사와 용량 조정을 상의했어요.'] },
      { key: '다른지표',
        openers: ['체중은 멈췄는데 인바디는 좋아지고 있었어요.', '숫자가 안 줄어 답답했어요.', '체중계만 보면 조급했어요.', '체중은 그대로인데 옷은 헐거워졌어요.'],
        middles: ['체지방이랑 허리둘레는 계속 줄고 있었어요.', '근육은 유지되고 있었어요.', '옷 핏은 계속 달라졌어요.', '체성분이 좋아지고 있었어요.'],
        closers: ['체중계 하나에만 매달리지 않기로 했어요.', '여러 지표를 같이 보니 마음이 놓였어요.', '시야를 넓히니 덜 조급했어요.'] },
      { key: '습관점검',
        openers: ['정체기에 식습관이 느슨해졌다는 걸 알았어요.', '운동을 게을리한 게 보였어요.', '술자리가 늘어난 시기와 겹쳤어요.'],
        middles: ['기록을 다시 들여다보니 원인이 보였어요.', '기본으로 돌아가 식단을 정리했어요.', '주당 운동 횟수를 다시 늘렸어요.'],
        closers: ['습관을 다잡으니 다시 빠지기 시작했어요.', '기록이 점검에 큰 도움이 됐어요.'] },
    ],
  },
  switch: {
    whenPool: ['위고비→마운자로', '마운자로→삭센다', '삭센다→위고비', '약 전환'],
    whenFor: () => '약 전환',
    themes: [
      { key: '효과전환',
        openers: ['처음 약으로 초반엔 빠지다 정체가 길어졌어요.', '효과가 약해진 것 같아 약을 바꿨어요.', '나한테 더 맞는 약을 찾고 싶었어요.', '같은 용량인데 반응이 둔해져 전환을 고민했어요.'],
        middles: ['바꾸니 다시 반응이 왔어요.', '사람마다 잘 맞는 약이 다른 것 같아요.', '전환 후 식욕 변화가 더 뚜렷했어요.', '새 약에 적응하는 데 1~2주 걸렸어요.'],
        closers: ['전환은 의사와 상의해 천천히 했어요.', '바꾸길 잘했다 싶어요.', '조급해하지 않고 갈아탔어요.'] },
      { key: '비용전환',
        openers: ['효과는 좋았지만 비용이 부담돼 약을 내렸어요.', '장기적으로 가격이 부담이었어요.', '유지 단계라 비용을 줄이고 싶었어요.', '목표를 거의 이뤄 더 저렴한 쪽으로 옮겼어요.'],
        middles: ['감량 속도는 좀 느려도 유지에는 충분했어요.', '매일 맞는 약으로 바꿨어요.', '용량을 낮춰 비용을 줄였어요.', '효과 대비 비용을 다시 따져봤어요.'],
        closers: ['비용과 효과의 균형을 찾았어요.', '내 상황에 맞춘 선택이었어요.', '지속 가능한 쪽을 골랐어요.'] },
      { key: '부작용전환',
        openers: ['부작용이 너무 심해서 다른 약을 시도했어요.', '한 약이 안 맞아 메스꺼움이 오래 갔어요.', '몸에 더 잘 맞는 약을 찾고 싶었어요.'],
        middles: ['바꾸니 속이 한결 편했어요.', '같은 계열이어도 체감이 달랐어요.', '용법이 달라 적응 기간이 필요했어요.'],
        closers: ['나한테 맞는 약을 찾은 게 컸어요.', '포기하지 않고 조정한 보람이 있었어요.'] },
    ],
  },
  cost: {
    whenPool: ['처방 경험', '비용 현실'],
    whenFor: () => '비용·처방',
    themes: [
      { key: '비대면처방',
        openers: ['바빠서 비대면 진료로 받았어요.', '병원 가기 어려워 화상 진료로 시작했어요.', '처음이라 절차가 복잡할 줄 알았어요.', '집 근처에 의원이 없어 원격으로 시작했어요.'],
        middles: ['약은 택배로 받았어요.', '생각보다 절차가 간단했어요.', '상담도 꼼꼼히 받았어요.', '초진 때 금기·주의사항을 확인받았어요.'],
        closers: ['다만 가격은 약국·지역마다 차이가 커서 비교는 필수예요.', '접근성은 확실히 좋아졌어요.', '정기적으로 경과는 점검하기로 했어요.'] },
      { key: '비용현실',
        openers: ['용량이 올라갈수록 가격이 가파르게 뛰었어요.', '보험이 안 돼서 부담이 컸어요.', '한 달 약값이 만만치 않았어요.', '생각보다 유지 비용이 길게 들어갔어요.'],
        middles: ['목표에 도달하면 유지 용량으로 내릴 계획을 세웠어요.', '약국마다 가격을 비교하고 다녔어요.', '4주분 단위로 계획을 잡았어요.', '할인·재고를 미리 확인하고 갔어요.'],
        closers: ['비용 계획을 처음부터 세운 게 도움이 됐어요.', '미리 알아본 게 후회를 줄였어요.', '예산을 정해두니 마음이 편했어요.'] },
      { key: '약국탐색',
        openers: ['같은 약인데 약국마다 값이 달라서 놀랐어요.', '재고가 없어 몇 군데를 돌았어요.', '처방받고도 약 구하기가 번거로웠어요.'],
        middles: ['지역 카페·커뮤니티에서 가격 정보를 모았어요.', '미리 전화로 재고를 확인했어요.', '대학로·강남 쪽이 선택지가 많았어요.'],
        closers: ['발품이 곧 비용 절약이었어요.', '정보 공유가 큰 도움이 됐어요.'] },
    ],
  },
  maintain: {
    whenPool: ['목표 도달 후', '중단 후', '유지 중', '장기 관점'],
    whenFor: (d) => `유지 중 · ${doseFor(d, 'early')}`,
    themes: [
      { key: '유지용량',
        openers: ['목표 체중 찍고 바로 끊는 대신 저용량으로 유지 중이에요.', '간격을 늘려가며 유지하고 있어요.', '유지 단계로 넘어갔어요.'],
        middles: ['운동 습관을 같이 붙여뒀어요.', '식욕이 조금 돌아와도 흔들리지 않았어요.', '단백질·근력운동을 챙겼어요.'],
        closers: ['유지가 생각보다 안정적이에요.', '천천히 줄이는 전략이 맞았어요.'] },
      { key: '요요관리',
        openers: ['끊고 두세 달 지나니 식욕이 조금씩 돌아왔어요.', '중단 후 약간 다시 찌긴 했어요.', '완전히 끊고 지켜봤어요.', '중단 후 체중을 매주 체크했어요.'],
        middles: ['운동을 유지한 덕에 예전만큼은 아니었어요.', '식습관을 잡아둔 게 컸어요.', '필요하면 다시 저용량을 고려하기로 했어요.', '단백질·근력운동을 계속했어요.'],
        closers: ['완전 중단은 신중하게 하기로 했어요.', '관리가 결국 핵심이었어요.', '약 없이도 흔들리지 않으려 노력했어요.'] },
      { key: '장기관점',
        openers: ['“끊으면 도로아미타불”이라고만 생각했어요.', '평생 약이라는 말에 부담이 컸어요.', '장기적으로 어떻게 갈지 고민이 많았어요.'],
        middles: ['끊은 사람의 절반 가까이는 유지하거나 더 빠진다는 데이터를 봤어요.', '유지 전략이 핵심이라는 걸 알게 됐어요.', '약은 도구일 뿐이라고 생각하게 됐어요.'],
        closers: ['마음이 한결 편해졌어요.', '길게 보고 관리하기로 했어요.'] },
    ],
  },
};

function weightedPick(rng, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// stage별 후보 본문(텍스트) 전부 생성 → theme 안에서 opener×(middle?)×closer 조합
function buildTexts(stageKey) {
  const cfg = STAGE_FRAGMENTS[stageKey];
  const out = [];
  for (const t of cfg.themes) {
    for (const o of t.openers) {
      for (const c of t.closers) {
        // 3문장 (opener + middle + closer)
        for (const m of t.middles) {
          out.push({ theme: t.key, text: `${o} ${m} ${c}` });
        }
        // 2문장 (opener + closer) — 리듬 변화
        out.push({ theme: t.key, text: `${o} ${c}` });
      }
    }
  }
  return out;
}

// 전체 생성
export function generateExperiences({ target = 1000, seed = 20260630, excludeTexts = [] } = {}) {
  const rng = mulberry32(seed);
  const stageKeys = Object.keys(STAGE_FRAGMENTS);
  const exclude = new Set(excludeTexts);

  // stage별 후보 셔플
  const byStage = {};
  for (const sk of stageKeys) {
    const arr = buildTexts(sk).filter(x => !exclude.has(x.text));
    // Fisher–Yates (seeded)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    byStage[sk] = arr;
  }

  const quota = Math.ceil(target / stageKeys.length);
  const seen = new Set();
  const result = [];
  let n = 0;
  const idx = Object.fromEntries(stageKeys.map(k => [k, 0]));
  const takenPerStage = Object.fromEntries(stageKeys.map(k => [k, 0]));

  const emit = (sk, cand) => {
    const cfg = STAGE_FRAGMENTS[sk];
    const drug = weightedPick(rng, DRUGS_GENERAL);
    const gender = weightedPick(rng, GENDERS);
    const age = weightedPick(rng, AGES);
    const when = cfg.whenPool
      ? (cfg.doseTier === null || !DRUG_DOSES[drug]
          ? pick(rng, cfg.whenPool)
          : `${pick(rng, cfg.whenPool)} · ${doseFor(drug, sk === 'result' || sk === 'plateau' ? 'late' : sk === 'foodnoise' ? 'mid' : 'early')}`)
      : cfg.whenFor(drug);
    result.push({
      id: `g${(++n).toString().padStart(4, '0')}`,
      stage: sk,
      drug: sk === 'cost' ? null : drug,   // 비용 경험은 약 무관(일반)
      who: `${age} ${gender}`,
      when,
      theme: cand.theme,
      text: cand.text,
      _gen: true,
    });
    takenPerStage[sk]++;
  };

  // Phase 1: stage 균형(quota) 라운드로빈
  let progress = true;
  while (result.length < target && progress) {
    progress = false;
    for (const sk of stageKeys) {
      if (result.length >= target || takenPerStage[sk] >= quota) continue;
      const pool = byStage[sk];
      while (idx[sk] < pool.length) {
        const cand = pool[idx[sk]++];
        if (seen.has(cand.text)) continue;
        seen.add(cand.text); emit(sk, cand); progress = true; break;
      }
    }
  }
  // Phase 2: 아직 target 미달이면 남은 후보로 무제한 채움 (작은 stage 부족분을 큰 stage가 메움)
  progress = true;
  while (result.length < target && progress) {
    progress = false;
    for (const sk of stageKeys) {
      if (result.length >= target) break;
      const pool = byStage[sk];
      while (idx[sk] < pool.length) {
        const cand = pool[idx[sk]++];
        if (seen.has(cand.text)) continue;
        seen.add(cand.text); emit(sk, cand); progress = true; break;
      }
    }
  }
  return result;
}
