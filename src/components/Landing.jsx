import React, { useState, useEffect } from 'react';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { QuickSignupModal } from './Paywall.jsx';
import { Simulator } from './Simulator.jsx';
import { CohortLive } from './CohortLive.jsx';
import { RecentPagesRow } from './RecentPages.jsx';

const SIM_PREFILL_KEY = 'wimalog_sim_prefill';

export function Landing({ navigate, onSignup, user }) {
  const [showSignup, setShowSignup] = useState(false);
  const [showFull, setShowFull] = useState(false);   // 신규 사용자에게는 가이드/계산기 숨김
  // Simulator 입력 echo — sessionStorage 폴링으로 가벼운 sync
  const [prefill, setPrefill] = useState(null);
  useEffect(() => {
    if (user) return;
    const read = () => {
      try {
        const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
        setPrefill(raw ? JSON.parse(raw) : null);
      } catch {}
    };
    read();
    const id = setInterval(read, 1500);
    return () => clearInterval(id);
  }, [user]);

  // 로그인 사용자가 클릭하면 가입 모달 대신 dashboard로 이동
  const handleSignup = () => {
    if (user) navigate('dashboard');
    else setShowSignup(true);
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero — TOSS 톤: 큰 숫자 + 짧은 메시지 + 단일 액션 */}
      <section className="text-center pt-2 sm:pt-6">
        <div className="inline-flex items-center gap-1.5 chip-brand mb-4">
          <span>🇰🇷</span>
          <span>한국 GLP-1 리얼데이터</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-ink-900 dark:text-slate-100 leading-[1.15] tracking-tight">
          위고비·마운자로,<br />
          <span className="text-brand-600 dark:text-brand-400">나와 비슷한 사람</span>은<br className="sm:hidden" /> 얼마나 빠졌을까?
        </h1>
        <p className="mt-4 text-sm sm:text-base text-ink-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          실사용자 익명 데이터 기반 AI 예측 — 키·체중·약을 입력하면 비슷한 사용자의 1년 감량 곡선이 바로 나와요.
        </p>
      </section>

      {/* 최근 본 페이지 (재방문자) */}
      <RecentPagesRow navigate={navigate} />

      {/* 시뮬레이터 — 첫 인터랙션 */}
      <section className="max-w-2xl mx-auto" id="simulator-anchor">
        <Simulator onSignup={handleSignup} user={user} />
      </section>

      {/* 신규 사용자용 강한 후속 CTA — 입력값 echo + 가입 유도 */}
      {!user && prefill && (
        <section className="max-w-2xl mx-auto -mt-4">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed border-amber-300 dark:border-amber-700/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">✨</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-snug">
                  방금 입력한 <span className="tabular-nums">{prefill.height}cm · {prefill.startWeight}kg</span> 조건의 상세 예측을 볼까요?
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-200/80 mt-1 leading-relaxed">
                  가입하면 <b>나와 비슷한 실사용자</b>의 주차별 감량·부작용·중단 후 회복 곡선이 실시간으로 정밀화됩니다.
                </div>
                <button onClick={handleSignup}
                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-sm font-bold transition shadow-sm">
                  내 감량 곡선 보기 →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 위마로그 코호트 LIVE — 우리 데이터 강조 (가짜 사이트 느낌 방지) */}
      <CohortLive navigate={navigate} onSignup={handleSignup} user={user} />

      {/* 약국 가격 디렉토리 진입 — 다른 사이트엔 없는 차별점 */}
      <section>
        <button onClick={() => navigate('pharmacies')}
                className="w-full card !p-4 sm:!p-5 text-left hover:shadow-cardHover hover:border-brand-300 dark:hover:border-brand-700 transition group">
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0">🏪</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink-900 dark:text-slate-100 flex items-center justify-between gap-2">
                <span>한국 GLP-1 약국 가격 디렉토리</span>
                <span className="text-brand-500 group-hover:translate-x-0.5 transition">→</span>
              </div>
              <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
                서울 대학로·강남·종로 등 약국별 위고비·마운자로 4주분 최근 가격 — 사용자 익명 제보
              </p>
            </div>
          </div>
        </button>
      </section>

      {/* 약별 빠른 진입 */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-slate-100">약별 정보</h2>
          <button onClick={() => navigate('compare')} className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline">
            5개 약 한눈 비교 →
          </button>
        </div>
        {/* 사용량 비율 반영: 위고비·마운자로 4 (큼), 삭센다 2 (중간), 오젬픽·젭바운드 각 1 (작음) */}
        <div className="grid grid-cols-12 gap-2">
          {[
            ['wegovy',   '위고비',   'col-span-4', 'text-3xl', 'text-base'],
            ['mounjaro', '마운자로', 'col-span-4', 'text-3xl', 'text-base'],
            ['saxenda',  '삭센다',   'col-span-2', 'text-xl',  'text-sm'],
            ['ozempic',  '오젬픽',   'col-span-1', 'text-sm',  'text-[10px]'],
            ['zepbound', '젭바운드', 'col-span-1', 'text-sm',  'text-[10px]'],
          ].map(([id, label, colCls, iconCls, textCls]) => (
            <button key={id} onClick={() => navigate(`drug/${id}`)}
                    className={`${colCls} card !p-2 sm:!p-3 text-center hover:shadow-cardHover hover:border-brand-300 transition group flex flex-col items-center justify-center min-w-0`}>
              <div className={`${iconCls} mb-0.5`}>💉</div>
              <div className={`${textCls} font-semibold text-ink-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate w-full`}>
                {label}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 가이드·부작용·계산기 — 신규 사용자에겐 접어두고 가입에 집중 */}
      {!user && !showFull && (
        <section className="text-center">
          <button onClick={() => setShowFull(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 dark:bg-slate-800 hover:bg-ink-300/40 dark:hover:bg-slate-700 px-4 py-2 text-sm font-medium text-ink-700 dark:text-slate-300 transition">
            가이드·부작용·계산기 더 보기
            <span className="text-brand-500">↓</span>
          </button>
        </section>
      )}

      {/* 상황별 가이드 — 핵심 6개만 */}
      {(user || showFull) && (
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
          <PersonaCardLink icon="⏳" title="언제 끊을까"
                            desc="목표 도달·부작용·비용 시나리오"
                            onClick={() => navigate('guide/when-to-stop')} />
          <PersonaCardLink icon="💉" title="유지 용량 전략"
                            desc="저용량·격주로 효과 유지하는 법"
                            onClick={() => navigate('guide/maintenance-dose')} />
          <PersonaCardLink icon="📊" title="장기 사용 (1년+)"
                            desc="6개월·1년 시점 평가 + 안전성"
                            onClick={() => navigate('guide/long-term-use')} />
          <PersonaCardLink icon="🗓️" title="부작용 시점별 변화"
                            desc="주차별 발생·완화 패턴"
                            onClick={() => navigate('guide/side-effect-timeline')} />
        </div>
      </section>
      )}

      {/* 부작용 + 계산기 — 한 줄 통합 */}
      {(user || showFull) && (
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
      )}

      {/* 하단 CTA — 로그인 상태 따라 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white p-6 text-center">
        <h2 className="text-xl font-extrabold">
          {user ? `${user.nickname || '나'}님 환영합니다 👋` : '내 감량 곡선 자세히 보기'}
        </h2>
        <p className="mt-2 text-slate-300 text-xs leading-relaxed">
          {user
            ? '대시보드에서 본인 데이터 + 비슷한 사용자 평균을 확인하세요'
            : <>실사용자 익명 데이터 기반 — 가입하면 <b className="text-white">나와 같은 BMI·약·빈도</b> 사용자의 주차별 곡선 + 부작용 시점 + 중단 후 회복률 실시간 확인</>}
        </p>
        <button onClick={() => user ? navigate('dashboard') : handleSignup()}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold hover:bg-brand-600 transition">
          {user ? '내 대시보드 →' : '내 감량 곡선 보기 →'}
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
