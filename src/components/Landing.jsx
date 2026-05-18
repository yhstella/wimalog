import React, { useState } from 'react';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { QuickSignupModal } from './Paywall.jsx';
import { Simulator } from './Simulator.jsx';
import { CohortLive } from './CohortLive.jsx';
import { RecentPagesRow } from './RecentPages.jsx';

export function Landing({ navigate, onSignup }) {
  const [showSignup, setShowSignup] = useState(false);
  const handleSignup = () => setShowSignup(true);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero — 차별화 명시 (단순 tracker가 아닌 리얼데이터 비교 플랫폼) */}
      <section className="text-center pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 chip-brand mb-3">
          <span>🇰🇷</span>
          <span>한국 GLP-1 리얼데이터 플랫폼 · 베타</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-ink-900 dark:text-slate-100 leading-tight">
          위고비·마운자로,<br />
          <span className="text-brand-600 dark:text-brand-400">나와 비슷한 사람</span>은 얼마나 빠졌을까?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-ink-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          단순 기록 앱이 아닌 <b className="text-ink-900 dark:text-slate-100">한국 사용자 익명 코호트 비교 플랫폼</b>.
          마른 비만·지방간·격주 사용 등 한국 실사용 맥락 반영 — 가입 없이 즉시 시뮬레이션부터.
        </p>
      </section>

      {/* 최근 본 페이지 (재방문자) */}
      <RecentPagesRow navigate={navigate} />

      {/* 시뮬레이터 — 첫 인터랙션 */}
      <section className="max-w-2xl mx-auto" id="simulator-anchor">
        <Simulator onSignup={handleSignup} />
      </section>

      {/* 위마로그 코호트 LIVE — 우리 데이터 강조 (가짜 사이트 느낌 방지) */}
      <CohortLive navigate={navigate} onSignup={handleSignup} />

      {/* 약별 빠른 진입 */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-slate-100">약별 정보</h2>
          <button onClick={() => navigate('compare')} className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline">
            5개 약 한눈 비교 →
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            ['wegovy', '위고비'],
            ['mounjaro', '마운자로'],
            ['saxenda', '삭센다'],
            ['ozempic', '오젬픽'],
            ['zepbound', '젭바운드'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => navigate(`drug/${id}`)}
                    className="card !p-3 text-center hover:shadow-cardHover hover:border-brand-300 transition group">
              <div className="text-xl mb-1">💉</div>
              <div className="font-semibold text-sm text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {label}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 상황별 가이드 — 핵심 6개만 */}
      <section>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-slate-100 mb-3">상황별 가이드</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <PersonaCardLink icon="💉" title="매주 풀 dose가 부담?"
                            desc="격주·간헐·저용량 — 한국 실사용 패턴"
                            onClick={() => navigate('guide/usage-patterns')} />
          <PersonaCardLink icon="🫀" title="지방간 동반"
                            desc="간수치·내장지방 개선이 목적"
                            onClick={() => navigate('guide/fatty-liver')} />
          <PersonaCardLink icon="🦴" title="마른 비만·근감소"
                            desc="BMI 정상이어도 근손실 우려"
                            onClick={() => navigate('guide/sarcopenia')} />
          <PersonaCardLink icon="🍺" title="음주·알코올 사용장애"
                            desc="GLP-1이 알코올 갈망도 줄임 (2025 임상)"
                            onClick={() => navigate('guide/alcohol')} />
          <PersonaCardLink icon="📉" title="중단 후 요요 걱정"
                            desc="6개월 회복률 + 운동 효과"
                            onClick={() => navigate('guide/after-stop')} />
          <PersonaCardLink icon="📅" title="첫 한 달 가이드"
                            desc="주차별 시작·적응·증량 결정"
                            onClick={() => navigate('guide/first-month')} />
        </div>
      </section>

      {/* 부작용 + 계산기 — 한 줄 통합 */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink-900 dark:text-slate-100 mb-2">⚠ 부작용 정보</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'nausea', label: '오심', icon: '🤢' },
                { id: 'vomiting', label: '구토', icon: '🤮' },
                { id: 'constipation', label: '변비', icon: '🚽' },
                { id: 'diarrhea', label: '설사', icon: '💧' },
                { id: 'fatigue', label: '피로', icon: '😴' },
                { id: 'headache', label: '두통', icon: '🤕' },
              ].map(s => (
                <button key={s.id} onClick={() => navigate(`effect/${s.id}`)}
                        className="rounded-lg border border-ink-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/15 transition py-2 text-center group">
                  <div className="text-base">{s.icon}</div>
                  <div className="text-[11px] font-medium text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900 dark:text-slate-100 mb-2">🧮 계산기</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cost', label: '약 비용', icon: '💰' },
                { id: 'bmr', label: '기초대사량', icon: '🔥' },
                { id: 'target', label: '목표 체중', icon: '🎯' },
              ].map(c => (
                <button key={c.id} onClick={() => navigate(`calc/${c.id}`)}
                        className="rounded-lg border border-ink-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/15 transition py-2 text-center group">
                  <div className="text-base">{c.icon}</div>
                  <div className="text-[11px] font-medium text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">{c.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white p-6 text-center">
        <h2 className="text-xl font-extrabold">내 데이터로 더 정확한 비교</h2>
        <p className="mt-2 text-slate-300 text-xs">
          나와 같은 약·BMI·성별 사용자 평균 · 약 중단 후 회복률 · 지역별 가격
        </p>
        <button onClick={handleSignup}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold hover:bg-brand-600 transition">
          1분 가입 →
        </button>
      </section>

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal
          onClose={() => setShowSignup(false)}
          onComplete={(userId) => { setShowSignup(false); onSignup?.(userId); }}
        />
      )}
    </div>
  );
}

function PersonaCardLink({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick}
            className="card flex gap-3 !p-3 text-left hover:shadow-cardHover hover:border-brand-300 dark:hover:border-brand-700 transition w-full">
      <div className="text-xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-ink-900 dark:text-slate-100 flex items-center justify-between gap-2">
          <span>{title}</span>
          <span className="text-brand-500 dark:text-brand-400 text-xs">→</span>
        </div>
        <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">{desc}</div>
      </div>
    </button>
  );
}
