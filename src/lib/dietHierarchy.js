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
