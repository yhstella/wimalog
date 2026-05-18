import React from 'react';

// SEO 페이지(drug/effect/guide)에서 시뮬레이터로 빠른 진입 — P1/P2/P3 페르소나
// 본문 위에 작게 표시. 로그인 사용자는 대시보드로 우회.
export function SimulatorCTA({ navigate, user, context }) {
  const handleClick = () => {
    if (user) {
      navigate('dashboard');
    } else {
      navigate('landing');
      // landing은 hash 변경만으로 가서, simulator 앵커로 스크롤 필요
      setTimeout(() => {
        const el = document.getElementById('simulator-anchor');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  };

  const msg = user
    ? '내 대시보드에서 본인 데이터 + 비슷한 사용자 비교'
    : context === 'drug'
        ? '본인 키·체중·약·빈도로 3개월/6개월/1년 감량 추정 →'
        : context === 'effect'
        ? '본인 약·빈도로 부작용 발생률 추정 →'
        : context === 'guide'
        ? '본인 케이스로 예상 결과 시뮬레이션 →'
        : '본인 조건으로 예상 결과 보기 →';

  return (
    <button onClick={handleClick}
            className="w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white px-4 py-3 text-sm font-semibold transition shadow flex items-center justify-between gap-2 group">
      <span className="flex items-center gap-2">
        <span className="text-base">🔮</span>
        <span className="text-left">{msg}</span>
      </span>
      <span className="text-base group-hover:translate-x-0.5 transition">→</span>
    </button>
  );
}
