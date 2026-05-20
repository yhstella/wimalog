import React, { useState } from 'react';

const DISMISSED_KEY = 'gl_tour_dismissed';

// 신규 가입자 첫 진입 시: "본인 상황 선택" → 맞춤 페이지로 안내
export function WelcomeTour({ user, navigate }) {
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY));

  if (dismissed) return null;
  // 가입 모달에서 이미 visitPurpose 선택했으면 WelcomeTour 안 띄움 (Dashboard PurposeCard로 대체)
  if (user?.visitPurpose) return null;

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const goTo = (route) => {
    close();
    navigate(route);
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 animate-slideUp">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-bold text-ink-900 dark:text-slate-100">환영합니다, {user.nickname}님 🎉</div>
            <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">본인 상황을 알려주시면 맞춤 정보를 보여드려요</div>
          </div>
          <button onClick={close} aria-label="닫기" className="btn-ghost !p-2">✕</button>
        </div>

        <div className="space-y-2">
          {[
            { id: 'planning',   label: '약을 시작할까 고민 중',  emoji: '🤔', next: 'compare' },
            { id: 'starting',   label: '곧 처방받을 예정',       emoji: '📋', next: 'guide/prescription' },
            { id: 'using',      label: '이미 사용 중',           emoji: '💉', next: 'meds' },
            { id: 'stopped',    label: '약을 끊었거나 끊을 예정', emoji: '📉', next: 'guide/after-stop' },
            { id: 'diet',       label: '약 없이 다이어트만',      emoji: '🥗', next: 'guide/diet-only' },
            { id: 'sideeffect', label: '부작용이 걱정돼요',       emoji: '😟', next: 'effect/nausea' },
          ].map(o => (
            <button key={o.id} onClick={() => goTo(o.next)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-ink-300 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition text-left">
              <span className="text-xl">{o.emoji}</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-slate-100 flex-1">{o.label}</span>
              <span className="text-brand-500">→</span>
            </button>
          ))}
        </div>

        <button onClick={close} className="w-full text-xs text-ink-500 dark:text-slate-500 underline mt-4 py-1">
          나중에 둘러볼게요
        </button>
      </div>
    </div>
  );
}
