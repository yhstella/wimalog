import React, { useState } from 'react';
import { GUIDE_CONTENT } from '../../lib/content.js';
import { QuickSignupModal } from '../Paywall.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';
import { SimulatorCTA } from '../SimulatorCTA.jsx';

export function GuidePage({ guideId, navigate, onSignup, user }) {
  const guide = GUIDE_CONTENT[guideId];
  const [showSignup, setShowSignup] = useState(false);

  if (!guide) return <div className="card text-center py-10">가이드를 찾을 수 없습니다</div>;

  const handleSignup = () => {
    if (user) navigate('dashboard');
    else setShowSignup(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-slate-100">
          {guide.title}
        </h1>
        <p className="text-base text-ink-500 dark:text-slate-400 mt-2 leading-relaxed">
          {guide.summary}
        </p>
      </header>

      {/* 시뮬레이터 빠른 진입 — P3 페르소나 (마른 비만/지방간/알코올 등 한국 특수) */}
      <SimulatorCTA navigate={navigate} user={user} context="guide" />

      {guide.sections.map((section, i) => (
        <section key={i} className="card">
          <h2 className="section-title">{section.title}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
            {section.body.map((b, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-brand-500 flex-shrink-0">●</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* CTA — 로그인 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 text-center">
        <p className="text-base font-semibold leading-relaxed">{guide.cta}</p>
        <button onClick={handleSignup}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-white text-brand-700 px-6 py-3 font-bold hover:bg-brand-50 transition">
          {user ? '내 대시보드 →' : '1분 가입하고 데이터 보기 →'}
        </button>
      </section>

      <ShareButtons title={`${guide.title} — 위마로그`} text={guide.summary} />

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)} onComplete={(id) => { setShowSignup(false); onSignup?.(id); }} />
      )}
    </div>
  );
}
