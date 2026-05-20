import React, { useMemo } from 'react';

// 페이지 곳곳에 노출되는 부드러운 다이어트 격려 메시지
// 건강 우선, 너무 독하지 않게. 사용자 상황(weight 변화/주차/단계)에 따라 분기.
const MESSAGES = {
  // 신규 가입자
  newUser: [
    '💚 작은 한 걸음이 큰 변화로 — 오늘 체중 한 번이면 충분해요',
    '🌱 무리하지 마세요. 꾸준한 기록이 가장 강력한 약입니다',
    '✨ 오늘부터 1주만 기록해도 본인 패턴이 보여요',
  ],
  // 잘 빠지는 중 (진행 중)
  progressing: [
    '🎉 잘하고 계세요! 이 속도면 목표 도달이 머지않아요',
    '🌟 한 주 한 주 쌓이는 변화 — 본인을 칭찬해 주세요',
    '💪 몸이 가벼워지는 게 느껴지죠? 단백질 충분히, 수분도 잊지 마세요',
    '🌿 빠른 속도보다 안전한 속도가 중요해요. 잘 가고 있어요',
  ],
  // 정체기
  plateau: [
    '🧘 정체기는 누구나 와요. 몸이 적응 중이라는 신호',
    '💧 수분·수면·스트레스 점검 + 단백질 +20g 시도해 보세요',
    '🚶 평소보다 활동량 +10% — 작은 변화가 정체 돌파 단서',
    '🌸 체중계 숫자보다 옷 핏·체성분 변화를 보세요',
  ],
  // 늘었음 / 후퇴
  setback: [
    '🌤️ 한 번의 변동은 흐름이 아니에요. 내일부터 다시',
    '💚 몸이 회복 중일 수도. 수면·물·식이 차분히 점검',
    '🌱 작은 후퇴는 자연스러워요. 본인 페이스 유지가 핵심',
  ],
  // 운동 격려
  exercise: [
    '🏃 오늘 10분만 걸어도 내일이 달라요',
    '💪 근력 운동 한 세트가 근손실을 막아줍니다',
    '🌳 걷기는 가장 가성비 좋은 운동 — 부담 없이 시작하세요',
  ],
  // 식단 격려
  diet: [
    '🥗 단백질 한 그릇이 식욕을 잡아줘요',
    '🍵 식사 천천히 — 포만감이 더 깊게 느껴져요',
    '🥦 채소 한 줌이 다음 식사를 가볍게 만들어요',
  ],
  // 부작용 경험자
  sideEffect: [
    '🌿 부작용은 대부분 4-8주에 호전돼요. 무리하지 말고 자가관리부터',
    '💧 메스꺼움엔 천천히·소량씩·기름진 음식 피하기가 가장 빠른 해결',
    '🩺 6주 이상 지속되면 의사와 용량 조절을 상의하세요',
  ],
  // 중단 고려/이후
  stopping: [
    '🌱 천천히 줄이기가 갑작스러운 중단보다 안전해요',
    '🏃 운동 지속이 요요 방지에 가장 강력한 무기',
    '💚 중단 후 6개월이 가장 중요 — 식이·운동 패턴 유지하세요',
  ],
};

// 사용자 컨텍스트로 적절한 메시지 선택
function pickContext(opts = {}) {
  const { visitPurpose, weeklyDelta, weeks, hasStall, hasSetback } = opts;
  if (hasSetback) return 'setback';
  if (hasStall) return 'plateau';
  if (visitPurpose === 'sideeffect') return 'sideEffect';
  if (visitPurpose === 'stopped') return 'stopping';
  if (weeks != null && weeks < 2) return 'newUser';
  if (weeklyDelta != null && weeklyDelta < -0.2) return 'progressing';
  // default cycle: 운동/식단/일반
  return Math.random() < 0.4 ? 'exercise' : Math.random() < 0.5 ? 'diet' : 'progressing';
}

export function MotivationBanner({ user, weeklyDelta, weeks, hasStall, hasSetback, tone = 'default' }) {
  const ctx = useMemo(() => pickContext({
    visitPurpose: user?.visitPurpose,
    weeklyDelta, weeks, hasStall, hasSetback,
  }), [user?.visitPurpose, weeklyDelta, weeks, hasStall, hasSetback]);
  const pool = MESSAGES[ctx] || MESSAGES.progressing;
  // user.id를 seed로 안정적 선택 (같은 사용자 + 같은 컨텍스트면 같은 메시지)
  const idHash = (user?.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const msg = pool[idHash % pool.length];

  const toneCls = tone === 'inline'
    ? 'text-xs text-ink-600 dark:text-slate-400 italic'
    : 'rounded-xl bg-brand-50/60 dark:bg-brand-900/15 border border-brand-200/40 dark:border-brand-800/30 px-3 py-2 text-xs text-brand-800 dark:text-brand-200';

  return <div className={toneCls}>{msg}</div>;
}

// 페이지 fixed footer/header용 짧은 단일 멘트 (예: 시뮬레이터 페이지 하단)
export function MotivationLine({ purpose }) {
  const pool = MESSAGES[purpose === 'sideeffect' ? 'sideEffect'
                       : purpose === 'stopped' ? 'stopping'
                       : 'progressing'];
  const msg = pool[Math.floor(Date.now() / 86400000) % pool.length];  // 하루마다 변경
  return <p className="text-[11px] text-ink-500 dark:text-slate-500 text-center italic">{msg}</p>;
}
