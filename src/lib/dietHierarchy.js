// 식단 4단계 계층 데이터 — 카테고리 → 종류 → 메뉴
// 사용자 자유 입력 부담을 줄이기 위한 클릭 선택 구조
export const DIET_HIERARCHY = {
  healthy: {
    label: '건강식',
    icon: '🥗',
    desc: '단백질·채소 위주',
    color: 'emerald',
    subcategories: {
      salad:       { label: '샐러드',     icon: '🥗', items: ['닭가슴살 샐러드', '연어 샐러드', '시저 샐러드', '그릭 샐러드', '오리엔탈 샐러드', '코울슬로'] },
      protein:     { label: '단백질 위주', icon: '🍗', items: ['닭가슴살 (구이)', '연어구이', '두부 스테이크', '계란찜', '계란 프라이', '단백질 쉐이크', '그릭요거트', '저지방 우유'] },
      bowl:        { label: '곡물 볼',    icon: '🍚', items: ['연어 포케', '두부 덮밥', '닭가슴살+퀴노아', '오트밀', '곤약밥', '현미밥'] },
      light_korean:{ label: '한식 라이트', icon: '🍲', items: ['닭곰탕', '월남쌈', '비빔밥(소량)', '나물 정식', '미역국', '버섯국'] },
      snack:       { label: '건강 간식',   icon: '🥜', items: ['아몬드 한 줌', '단백질바', '그릭요거트', '과일 (사과/베리)', '바나나'] },
    },
  },
  balanced: {
    label: '일반식',
    icon: '🍱',
    desc: '평소 한식·양식',
    color: 'amber',
    subcategories: {
      korean:  { label: '한식',     icon: '🍚', items: ['김밥', '제육볶음', '비빔밥', '백반', '국밥', '김치찌개', '된장찌개', '돼지국밥'] },
      western: { label: '양식',     icon: '🍝', items: ['파스타', '스테이크', '리조또', '크림 스프', '오믈렛', '샌드위치'] },
      asian:   { label: '아시안',   icon: '🍜', items: ['일식 정식', '중식 (적당량)', '베트남 쌀국수', '월남쌈', '카레', '돈가스'] },
      light_snack: { label: '간식', icon: '🍪', items: ['크래커', '치즈', '쿠키 1-2개', '견과류'] },
    },
  },
  treat: {
    label: '단·튀김 음식',
    icon: '🍕',
    desc: '정크푸드·디저트',
    color: 'rose',
    subcategories: {
      fast:    { label: '패스트푸드', icon: '🍔', items: ['햄버거', '피자', '치킨', '튀김', '핫도그', '감자튀김', '나초'] },
      sweet:   { label: '단 디저트', icon: '🍰', items: ['케이크', '아이스크림', '도넛', '쿠키', '초콜릿', '마카롱', '와플'] },
      drink:   { label: '단 음료', icon: '🥤', items: ['콜라', '주스', '에이드', '카페모카', '버블티', '믹스커피', '비타민음료'] },
      noodle:  { label: '면 위주', icon: '🍜', items: ['라면', '짜장면', '짬뽕', '우동', '컵라면', '비빔면'] },
      alcohol: { label: '술', icon: '🍺', items: ['맥주', '소주', '와인', '막걸리', '하이볼', '칵테일'] },
    },
  },
  light: {
    label: '가볍게',
    icon: '🥤',
    desc: '거르기·음료만',
    color: 'sky',
    subcategories: {
      drink_only: { label: '음료만',  icon: '☕', items: ['아메리카노', '녹차', '단백질 쉐이크', '미숫가루', '두유', '저지방 우유'] },
      fruit_only: { label: '과일만',  icon: '🍎', items: ['바나나', '사과', '베리류', '오렌지', '키위', '토마토'] },
      skip:       { label: '거르기',  icon: '🚫', items: ['아침 거름', '점심 거름', '저녁 거름', '간식 거름', '간헐적 단식'] },
    },
  },
};

// 자유 입력 (계층 외)
export const FREE_INPUT_CATEGORY = { label: '직접 입력', icon: '✏️', desc: '메뉴를 직접 적기' };

// 메뉴별 영양 정보 (단백질g / 칼로리kcal per "적당히" 1인분)
// 출처: 한국영양학회 식품성분DB, USDA, 일반 한식 평균
export const MENU_NUTRITION = {
  // 건강식
  '닭가슴살 (구이)': { protein: 35, kcal: 165 },
  '닭가슴살 샐러드': { protein: 32, kcal: 280 },
  '연어구이': { protein: 28, kcal: 250 },
  '연어 샐러드': { protein: 25, kcal: 320 },
  '연어 포케': { protein: 28, kcal: 480 },
  '두부 스테이크': { protein: 18, kcal: 200 },
  '두부 덮밥': { protein: 18, kcal: 450 },
  '계란찜': { protein: 12, kcal: 130 },
  '계란 프라이': { protein: 6, kcal: 90 },
  '단백질 쉐이크': { protein: 25, kcal: 180 },
  '단백질바': { protein: 18, kcal: 220 },
  '그릭요거트': { protein: 15, kcal: 130 },
  '저지방 우유': { protein: 8, kcal: 100 },
  '두유': { protein: 7, kcal: 90 },
  '닭가슴살+퀴노아': { protein: 38, kcal: 450 },
  '오트밀': { protein: 8, kcal: 150 },
  '곤약밥': { protein: 3, kcal: 90 },
  '현미밥': { protein: 5, kcal: 220 },
  '시저 샐러드': { protein: 12, kcal: 350 },
  '그릭 샐러드': { protein: 10, kcal: 280 },
  '오리엔탈 샐러드': { protein: 8, kcal: 250 },
  '코울슬로': { protein: 3, kcal: 180 },
  '닭곰탕': { protein: 30, kcal: 380 },
  '월남쌈': { protein: 18, kcal: 320 },
  '비빔밥(소량)': { protein: 15, kcal: 380 },
  '나물 정식': { protein: 12, kcal: 320 },
  '미역국': { protein: 5, kcal: 80 },
  '버섯국': { protein: 6, kcal: 100 },
  '아몬드 한 줌': { protein: 6, kcal: 170 },
  '과일 (사과/베리)': { protein: 1, kcal: 90 },
  '바나나': { protein: 1, kcal: 110 },
  // 일반식
  '김밥': { protein: 8, kcal: 480 },
  '제육볶음': { protein: 25, kcal: 650 },
  '비빔밥': { protein: 18, kcal: 580 },
  '백반': { protein: 22, kcal: 700 },
  '국밥': { protein: 24, kcal: 600 },
  '김치찌개': { protein: 18, kcal: 500 },
  '된장찌개': { protein: 15, kcal: 380 },
  '돼지국밥': { protein: 28, kcal: 700 },
  '파스타': { protein: 15, kcal: 650 },
  '스테이크': { protein: 45, kcal: 600 },
  '리조또': { protein: 14, kcal: 520 },
  '크림 스프': { protein: 8, kcal: 320 },
  '오믈렛': { protein: 18, kcal: 320 },
  '샌드위치': { protein: 16, kcal: 450 },
  '일식 정식': { protein: 22, kcal: 600 },
  '중식 (적당량)': { protein: 18, kcal: 700 },
  '베트남 쌀국수': { protein: 22, kcal: 480 },
  '카레': { protein: 18, kcal: 650 },
  '돈가스': { protein: 28, kcal: 850 },
  '크래커': { protein: 3, kcal: 150 },
  '치즈': { protein: 7, kcal: 110 },
  '쿠키 1-2개': { protein: 1, kcal: 100 },
  '견과류': { protein: 6, kcal: 170 },
  // 단·튀김
  '햄버거': { protein: 18, kcal: 550 },
  '피자': { protein: 14, kcal: 600 },
  '치킨': { protein: 28, kcal: 850 },
  '튀김': { protein: 8, kcal: 500 },
  '핫도그': { protein: 12, kcal: 380 },
  '감자튀김': { protein: 4, kcal: 380 },
  '나초': { protein: 6, kcal: 450 },
  '케이크': { protein: 4, kcal: 380 },
  '아이스크림': { protein: 4, kcal: 280 },
  '도넛': { protein: 4, kcal: 280 },
  '쿠키': { protein: 2, kcal: 150 },
  '초콜릿': { protein: 2, kcal: 220 },
  '마카롱': { protein: 2, kcal: 100 },
  '와플': { protein: 6, kcal: 350 },
  '콜라': { protein: 0, kcal: 140 },
  '주스': { protein: 1, kcal: 130 },
  '에이드': { protein: 0, kcal: 180 },
  '카페모카': { protein: 5, kcal: 280 },
  '버블티': { protein: 3, kcal: 320 },
  '믹스커피': { protein: 1, kcal: 80 },
  '비타민음료': { protein: 0, kcal: 90 },
  '라면': { protein: 10, kcal: 500 },
  '짜장면': { protein: 14, kcal: 700 },
  '짬뽕': { protein: 18, kcal: 650 },
  '우동': { protein: 12, kcal: 480 },
  '컵라면': { protein: 8, kcal: 400 },
  '비빔면': { protein: 10, kcal: 550 },
  '맥주': { protein: 1, kcal: 200 },
  '소주': { protein: 0, kcal: 350 },
  '와인': { protein: 0, kcal: 250 },
  '막걸리': { protein: 2, kcal: 280 },
  '하이볼': { protein: 0, kcal: 200 },
  '칵테일': { protein: 0, kcal: 280 },
  // 가볍게
  '아메리카노': { protein: 0, kcal: 5 },
  '녹차': { protein: 0, kcal: 0 },
  '미숫가루': { protein: 8, kcal: 200 },
  '사과': { protein: 0, kcal: 80 },
  '베리류': { protein: 1, kcal: 60 },
  '오렌지': { protein: 1, kcal: 70 },
  '키위': { protein: 1, kcal: 60 },
  '토마토': { protein: 1, kcal: 30 },
  '아침 거름': { protein: 0, kcal: 0 },
  '점심 거름': { protein: 0, kcal: 0 },
  '저녁 거름': { protein: 0, kcal: 0 },
  '간식 거름': { protein: 0, kcal: 0 },
  '간헐적 단식': { protein: 0, kcal: 0 },
};

// 카테고리별 default (메뉴 매칭 안 될 때)
export const CATEGORY_DEFAULT_NUTRITION = {
  healthy:  { protein: 22, kcal: 350 },
  balanced: { protein: 16, kcal: 580 },
  treat:    { protein: 10, kcal: 650 },
  light:    { protein: 4,  kcal: 80 },
};

// 양 분류 — 약간/적당히/많이
export const PORTION_OPTIONS = [
  { id: 'small',  label: '약간',   icon: '🤏', factor: 0.5 },
  { id: 'normal', label: '적당히', icon: '🍽️', factor: 1.0 },
  { id: 'large',  label: '많이',   icon: '🍴', factor: 1.7 },
];

// 메뉴 + 양 → 영양 자동 계산
export function nutritionForMenu(menu, portion = 'normal', categoryId = null) {
  const base = MENU_NUTRITION[menu]
            || (categoryId && CATEGORY_DEFAULT_NUTRITION[categoryId])
            || { protein: 15, kcal: 400 };
  const opt = PORTION_OPTIONS.find(p => p.id === portion);
  const f = opt?.factor ?? 1.0;
  return {
    protein: Math.round(base.protein * f),
    kcal: Math.round(base.kcal * f),
  };
}
