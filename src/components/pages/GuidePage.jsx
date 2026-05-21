import React, { useState } from 'react';
import { GUIDE_CONTENT } from '../../lib/content.js';
import { QuickSignupModal } from '../Paywall.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';
import { SimulatorCTA } from '../SimulatorCTA.jsx';
import { GuideDataWidget } from '../GuideDataWidget.jsx';

// 가이드별 관련 페이지 cross-link — SEO + dwell time 동시 개선
const CROSS_LINKS = {
  'before-use': {
    drugs: ['wegovy', 'mounjaro'],
    effects: ['nausea', 'constipation'],
    calcs: ['target', 'cost'],
    guides: ['first-month', 'usage-patterns'],
  },
  'first-month': {
    drugs: ['wegovy', 'mounjaro'],
    effects: ['nausea', 'vomiting', 'fatigue'],
    calcs: ['cost'],
    guides: ['side-effect-timeline', 'usage-patterns'],
  },
  'after-stop': {
    drugs: ['wegovy', 'mounjaro'],
    effects: [],
    calcs: ['cost'],
    guides: ['when-to-stop', 'maintenance-dose', 'long-term-use'],
  },
  'long-term-use': {
    drugs: ['wegovy', 'mounjaro', 'zepbound'],
    effects: ['hairLoss'],
    calcs: ['cost'],
    guides: ['maintenance-dose', 'when-to-stop', 'after-stop'],
  },
  'when-to-stop': {
    drugs: ['wegovy', 'mounjaro'],
    effects: [],
    calcs: ['cost'],
    guides: ['after-stop', 'maintenance-dose', 'long-term-use'],
  },
  'maintenance-dose': {
    drugs: ['wegovy', 'mounjaro'],
    effects: [],
    calcs: ['cost'],
    guides: ['when-to-stop', 'long-term-use', 'after-stop'],
  },
  'side-effect-timeline': {
    drugs: ['wegovy', 'mounjaro'],
    effects: ['nausea', 'vomiting', 'constipation', 'fatigue', 'hairLoss'],
    calcs: [],
    guides: ['first-month', 'nausea-foods'],
  },
  'usage-patterns': {
    drugs: ['wegovy', 'mounjaro', 'saxenda'],
    effects: ['nausea'],
    calcs: ['cost'],
    guides: ['first-month', 'maintenance-dose'],
  },
  'fatty-liver': {
    drugs: ['wegovy', 'mounjaro'],
    effects: [],
    calcs: ['bmr', 'target'],
    guides: ['before-use', 'usage-patterns'],
  },
  'sarcopenia': {
    drugs: ['mounjaro'],
    effects: ['hairLoss'],
    calcs: ['bmr'],
    guides: ['exercise-types', 'before-use'],
  },
  'alcohol': {
    drugs: ['wegovy'],
    effects: [],
    calcs: [],
    guides: ['before-use'],
  },
  'nausea-foods': {
    drugs: ['wegovy', 'mounjaro'],
    effects: ['nausea', 'vomiting'],
    calcs: [],
    guides: ['side-effect-timeline', 'meal-timing'],
  },
  'exercise-types': {
    drugs: ['mounjaro'],
    effects: ['fatigue'],
    calcs: ['bmr'],
    guides: ['sarcopenia', 'after-stop'],
  },
  'injection-tips': {
    drugs: ['wegovy', 'mounjaro', 'saxenda'],
    effects: [],
    calcs: [],
    guides: ['first-month'],
  },
  'meal-timing': {
    drugs: ['wegovy', 'mounjaro'],
    effects: ['nausea', 'reflux'],
    calcs: ['bmr'],
    guides: ['nausea-foods', 'first-month'],
  },
  'prescription': {
    drugs: ['wegovy', 'mounjaro'],
    effects: [],
    calcs: ['cost'],
    guides: ['before-use'],
  },
  'diet-only': {
    drugs: [],
    effects: [],
    calcs: ['bmr', 'target'],
    guides: ['exercise-types'],
  },
};

const DRUG_LABELS = { wegovy: '위고비', mounjaro: '마운자로', saxenda: '삭센다', ozempic: '오젬픽', zepbound: '젭바운드' };
const EFFECT_LABELS = { nausea: '오심', vomiting: '구토', constipation: '변비', diarrhea: '설사', fatigue: '피로', headache: '두통', dizziness: '어지러움', abdomenPain: '복통', hairLoss: '탈모', reflux: '역류성' };
const CALC_LABELS = { cost: '약 비용 계산기', bmr: '기초대사량 계산기', target: '목표 체중 계산기' };

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

      {/* 실시간 코호트 데이터 위젯 — 가이드별 통계 시각화 */}
      <GuideDataWidget guideId={guideId} navigate={navigate} />

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

      {/* 관련 페이지 cross-link — SEO + dwell time */}
      {CROSS_LINKS[guideId] && (() => {
        const links = CROSS_LINKS[guideId];
        const hasAny = links.drugs.length + links.effects.length + links.calcs.length + links.guides.length > 0;
        if (!hasAny) return null;
        return (
          <section className="card">
            <h2 className="section-title">관련 페이지</h2>
            <p className="section-subtitle">이 가이드와 함께 보면 좋은 페이지</p>
            <div className="mt-3 space-y-3">
              {links.drugs.length > 0 && (
                <CrossLinkRow icon="💉" title="관련 약" items={links.drugs}
                              onClick={(id) => navigate(`drug/${id}`)} labelMap={DRUG_LABELS} />
              )}
              {links.effects.length > 0 && (
                <CrossLinkRow icon="⚠" title="관련 부작용" items={links.effects}
                              onClick={(id) => navigate(`effect/${id}`)} labelMap={EFFECT_LABELS} />
              )}
              {links.calcs.length > 0 && (
                <CrossLinkRow icon="🧮" title="관련 계산기" items={links.calcs}
                              onClick={(id) => navigate(`calc/${id}`)} labelMap={CALC_LABELS} />
              )}
              {links.guides.length > 0 && (
                <CrossLinkRow icon="📚" title="관련 가이드" items={links.guides}
                              onClick={(id) => navigate(`guide/${id}`)}
                              labelMap={Object.fromEntries(Object.entries(GUIDE_CONTENT).map(([k, v]) => [k, v.title.split(' — ')[0].split(',')[0]]))} />
              )}
            </div>
          </section>
        );
      })()}

      {/* CTA — 로그인 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 text-center">
        <p className="text-base font-semibold leading-relaxed">{guide.cta}</p>
        {!user && (
          <p className="mt-2 text-brand-50 text-xs">
            실사용자 익명 데이터 기반 AI 예측
          </p>
        )}
        <button onClick={handleSignup}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-white text-brand-700 px-6 py-3 font-bold hover:bg-brand-50 transition">
          {user ? '내 대시보드 →' : '내 감량 곡선 보기 →'}
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

function CrossLinkRow({ icon, title, items, onClick, labelMap }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-1.5">{icon} {title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(id => (
          <button key={id} onClick={() => onClick(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/15 hover:text-brand-700 dark:hover:text-brand-400 transition">
            {labelMap[id] || id} →
          </button>
        ))}
      </div>
    </div>
  );
}
