import React from 'react';

// 데이터 0인 신규 가입자 dashboard 첫 화면.
// PurposeCard 다음에 배치 — 가입 직후 무엇부터 입력하면 좋은지 1탭 진입 카드 3개.
export function EmptyDashboard({ user, navigate }) {
  const visitPurpose = user?.visitPurpose || 'using';

  // visitPurpose별 가장 먼저 권장할 액션 3개
  const ACTIONS = {
    using: [
      { id: 'weight', icon: '⚖️', title: '오늘 체중 기록', desc: '1분. 그래프 자동 그려져요', cta: 'records' },
      { id: 'med',    icon: '💊', title: '사용 중인 약 등록', desc: '약·용량·시작일 입력', cta: 'records', tab: 'dose' },
      { id: 'exercise', icon: '🏃', title: '오늘 운동 기록', desc: '걷기 10분이라도 OK', cta: 'records', tab: 'exercise' },
    ],
    planning: [
      { id: 'sim',  icon: '🔮', title: '본인 조건 시뮬레이션', desc: '5개 약 비교 + 예상 감량', cta: 'landing' },
      { id: 'guide', icon: '📅', title: '첫 한 달 가이드', desc: '주차별 시작 전 점검', cta: 'guide/first-month' },
      { id: 'weight', icon: '⚖️', title: '시작 전 체중 기록', desc: '약 시작 후 변화 측정 baseline', cta: 'records' },
    ],
    stopped: [
      { id: 'guide', icon: '📉', title: '중단 후 요요 관리', desc: '운동 지속이 회복률 절반', cta: 'guide/after-stop' },
      { id: 'weight', icon: '⚖️', title: '현재 체중 기록', desc: '중단 후 추이 추적', cta: 'records' },
      { id: 'exercise', icon: '🏃', title: '오늘 운동 기록', desc: '주 90분+ 운동 그룹은 회복률 −50%', cta: 'records', tab: 'exercise' },
    ],
    sideeffect: [
      { id: 'weight', icon: '⚖️', title: '체중 + 부작용 기록', desc: '날짜별 증상 추적', cta: 'records' },
      { id: 'guide', icon: '🩺', title: '부작용 대처 가이드', desc: '의사 상담 기준', cta: 'info' },
      { id: 'health', icon: '💪', title: '건강지표 기록', desc: '혈압·수면·인바디 추가하면 패턴 분석', cta: 'records', tab: 'health' },
    ],
  };

  const actions = ACTIONS[visitPurpose] || ACTIONS.using;
  const go = (a) => {
    if (a.tab) { try { sessionStorage.setItem('wimalog_records_tab', a.tab); } catch {} }
    navigate(a.cta);
  };

  return (
    <div className="card border-2 border-dashed border-brand-300 dark:border-brand-700/50 bg-gradient-to-br from-brand-50/30 to-white dark:from-brand-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl">🚀</div>
        <div className="flex-1">
          <h2 className="font-bold text-ink-900 dark:text-slate-100 text-lg">
            지금 시작하면 좋은 것
          </h2>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
            아직 기록이 없어요. 아래 3가지 중 하나라도 입력하면 본인 데이터 + 코호트 비교가 즉시 활성화됩니다.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {actions.map(a => (
          <button key={a.id} onClick={() => go(a)}
                  className="text-left rounded-xl border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-400 hover:shadow-cardHover transition p-4">
            <div className="text-2xl mb-2">{a.icon}</div>
            <div className="font-bold text-sm text-ink-900 dark:text-slate-100">{a.title}</div>
            <div className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-snug">{a.desc}</div>
            <div className="text-xs text-brand-700 dark:text-brand-400 mt-2 font-semibold">시작 →</div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-ink-500 dark:text-slate-500 leading-relaxed text-center">
        💡 1주 기록만으로도 본인 추세선이 그려지고, 비슷한 사용자 N명과 자동 비교돼요.
      </p>
    </div>
  );
}
