import React, { useState } from 'react';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { QuickSignupModal } from './Paywall.jsx';
import { AIPredictionPanel } from './AIPredictionPanel.jsx';

// AI 예측 페이지 — 사용자 지시로 단순화 (2026-05-23).
// 키·체중 입력 → AI 정확도 % → 정확도 상승 체크박스만 노출.
// 기본 정보 chip / 코호트 평균 / 분석 항목 / 점수 breakdown 모두 숨김.
// 랜딩페이지 Simulator와 sessionStorage('wimalog_sim_prefill')로 양방향 sync.
export function Statistics({ user, onSignup }) {
  const [showSignup, setShowSignup] = useState(false);
  const handleSignup = () => setShowSignup(true);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-slate-100">
          AI 예측
        </h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-1">
          본인 정보를 더 알려주면 예측 정확도가 올라갑니다.
        </p>
      </header>

      <AIPredictionPanel user={user} />

      {!user && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand-200 dark:border-brand-800/40 p-4 flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">👋</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-ink-900 dark:text-slate-100">
              본인 체중 추이까지 반영하려면 가입하세요
            </div>
            <div className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
              가입 후 체중·운동·식단을 기록하면 정확도가 추가로 올라갑니다.
            </div>
          </div>
          <button onClick={handleSignup} className="btn-primary !py-2 !px-3 text-sm flex-shrink-0">
            가입 →
          </button>
        </div>
      )}

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)}
                          onComplete={(id) => { setShowSignup(false); onSignup?.(id); }} />
      )}
    </div>
  );
}
