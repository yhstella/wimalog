import React, { useMemo, useState } from 'react';
import { SIDE_EFFECT_CONTENT, DRUG_CONTENT, GUIDE_CONTENT } from '../../lib/content.js';
import { sideEffectRates, sideEffectTiming, avgLossCurve } from '../../lib/stats.js';
import { QuickSignupModal } from '../Paywall.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';
// InterestButton 제거 — '저도 겪고 있어요' 1탭 수집은 비즈니스 핵심 X
import { TestimonialBox } from '../TestimonialBox.jsx';
import { SimulatorCTA } from '../SimulatorCTA.jsx';

// 부작용별 상세 페이지 — SEO + 약별 발생률 + 시점 분포 + 자가 관리
export function SideEffectPage({ effectId, navigate, user, onSignup }) {
  const content = SIDE_EFFECT_CONTENT[effectId];
  const [showSignup, setShowSignup] = useState(false);

  if (!content) return <div className="card text-center py-10">부작용 정보를 찾을 수 없습니다</div>;

  // 약별 이 부작용 발생률
  const drugRates = useMemo(() => {
    return Object.keys(DRUG_CONTENT).map(medId => {
      const drug = DRUG_CONTENT[medId];
      const found = drug.sideEffectsTop.find(s => s.id === effectId);
      const rates = sideEffectRates({ medication: medId });
      const realRate = rates.find(r => r.id === effectId)?.rate;
      return {
        id: medId,
        label: drug.label,
        rate: realRate ?? found?.rate ?? 0,
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [effectId]);

  // 시점 분포 (전체 코호트)
  const timing = useMemo(() => sideEffectTiming({}, effectId), [effectId]);

  // 약별 시점 분포 + 코호트 평균 감량
  const drugTiming = useMemo(() => {
    return Object.keys(DRUG_CONTENT).map(medId => {
      const t = sideEffectTiming({ medication: medId }, effectId);
      return {
        id: medId,
        label: DRUG_CONTENT[medId].label,
        n: t.n,
        avgOnset: t.avgOnset,
        avgDuration: t.avgDuration,
      };
    }).filter(x => x.n >= 3);
  }, [effectId]);

  const handleSignup = () => setShowSignup(true);

  const maxBucket = Math.max(...(timing.distribution?.map(b => b.count) || [0]), 1);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-slate-100">
          {content.label}
        </h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">{content.summary}</p>
      </header>

      {/* 시뮬레이터 빠른 진입 — P2 페르소나 */}
      <SimulatorCTA navigate={navigate} user={user} context="effect" />

      {/* 핵심 숫자 */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card text-center !p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">평균 발생 시점</div>
          <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 mt-1">
            {timing.avgOnset != null ? `${timing.avgOnset.toFixed(1)}주차` : content.timing}
          </div>
        </div>
        <div className="card text-center !p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">평균 지속 기간</div>
          <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 mt-1">
            {timing.avgDuration != null ? `${timing.avgDuration.toFixed(1)}주` : content.duration}
          </div>
        </div>
      </section>

      {/* 약별 발생률 비교 */}
      <section className="card">
        <h2 className="section-title">약별 발생률</h2>
        <p className="section-subtitle">어떤 약에서 가장 흔한가</p>
        <div className="mt-3 space-y-2">
          {drugRates.map(d => (
            <button key={d.id} onClick={() => navigate(`drug/${d.id}`)}
                    className="w-full text-left group hover:bg-ink-100/40 dark:hover:bg-slate-800/40 -mx-2 px-2 py-1.5 rounded-lg transition">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                  {d.label} <span className="text-[10px] text-ink-300 dark:text-slate-600">▸</span>
                </span>
                <span className="text-ink-500 dark:text-slate-400 tabular-nums">{(d.rate * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, d.rate * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 약별 시점 분포 비교 표 */}
      {drugTiming.length > 0 && (
        <section className="card">
          <h2 className="section-title">약별 {content.label} 발생 패턴</h2>
          <p className="section-subtitle">언제 시작하고 얼마나 지속되는지 약마다 다름</p>
          <div className="overflow-x-auto -mx-2 mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 dark:text-slate-400 border-b border-ink-100 dark:border-slate-800">
                  <th className="py-2 pr-2">약</th>
                  <th className="py-2 px-2 text-right">평균 발생 시점</th>
                  <th className="py-2 px-2 text-right">평균 지속</th>
                </tr>
              </thead>
              <tbody>
                {drugTiming.map(d => (
                  <tr key={d.id} className="border-b border-ink-100 dark:border-slate-800">
                    <td className="py-1.5 pr-2">
                      <button onClick={() => navigate(`drug/${d.id}`)}
                              className="text-left font-medium text-ink-900 dark:text-slate-100 hover:text-brand-700 dark:hover:text-brand-400">
                        {d.label} <span className="text-[10px] text-ink-300 dark:text-slate-600">▸</span>
                      </button>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {d.avgOnset != null ? `${d.avgOnset.toFixed(1)}주차` : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {d.avgDuration != null ? `${d.avgDuration.toFixed(1)}주` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 시점 분포 (실시간) */}
      {timing.n > 0 && (
        <section className="card">
          <h2 className="section-title">언제 처음 나타날까?</h2>
          <p className="section-subtitle">위마로그 사용자 보고 기준</p>
          <div className="mt-4 flex items-end gap-2 h-32">
            {timing.distribution.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-ink-500 dark:text-slate-500 tabular-nums">{b.count}</div>
                <div className="w-full rounded-t-lg bg-rose-400 dark:bg-rose-500 transition-all"
                     style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count > 0 ? '4px' : '0' }} />
                <div className="text-[10px] text-ink-700 dark:text-slate-400 text-center">{b.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 왜 발생하는가 */}
      <section className="card">
        <h2 className="section-title">왜 발생하나요?</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300">
          {content.why.map((w, i) => <li key={i} className="flex gap-2"><span className="text-brand-500">●</span><span>{w}</span></li>)}
        </ul>
      </section>

      {/* 자가 관리 */}
      <section className="card border border-brand-200 dark:border-brand-800/40 bg-brand-50/40 dark:bg-brand-900/15">
        <h2 className="section-title">자가 관리법</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300">
          {content.selfCare.map((s, i) => <li key={i} className="flex gap-2"><span className="text-brand-500">✓</span><span>{s}</span></li>)}
        </ul>
      </section>

      {/* 사용자 적응형 후기 — 실제 사용 코호트의 짧은 경험담 */}
      {content.testimonials?.length > 0 && (
        <section className="card">
          <h2 className="section-title">실제 사용자 경험 — {content.label} 어떻게 견뎠나</h2>
          <p className="section-subtitle">위마로그 코호트의 짧은 후기 — "끊을까 했는데 적응됐다"는 패턴이 가장 흔합니다</p>
          <div className="mt-3 space-y-2.5">
            {content.testimonials.map((t, i) => {
              const vibeColor = {
                adapt:     'border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/15',
                pattern:   'border-sky-300 dark:border-sky-800/50 bg-sky-50/50 dark:bg-sky-900/15',
                'dose-up': 'border-amber-300 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/15',
                'dose-down': 'border-amber-300 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/15',
                switch:    'border-brand-300 dark:border-brand-800/50 bg-brand-50/50 dark:bg-brand-900/15',
                manage:    'border-brand-300 dark:border-brand-800/50 bg-brand-50/50 dark:bg-brand-900/15',
                lifestyle: 'border-brand-300 dark:border-brand-800/50 bg-brand-50/50 dark:bg-brand-900/15',
                temporary: 'border-ink-300 dark:border-slate-700 bg-ink-100/40 dark:bg-slate-800/40',
              }[t.vibe] || 'border-ink-200 dark:border-slate-700';
              const vibeIcon = {
                adapt: '✨', pattern: '🔁', 'dose-up': '⬆️', 'dose-down': '⬇️',
                switch: '🔀', manage: '💊', lifestyle: '🏃', temporary: '⏳',
              }[t.vibe] || '💬';
              return (
                <blockquote key={i} className={`rounded-xl border-l-4 px-4 py-3 ${vibeColor}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{vibeIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 dark:text-slate-100 leading-relaxed">"{t.text}"</p>
                      <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1.5">— {t.tag}</div>
                    </div>
                  </div>
                </blockquote>
              );
            })}
          </div>
          <p className="helptext mt-3">
            ※ 익명 후기 모음. 개인차가 크므로 본인 상황에 그대로 적용하지 마세요.
            본인 후기는 가입 후 기록 + 메모로 남길 수 있습니다.
          </p>
        </section>
      )}

      {/* 한 줄 후기 (가입자) */}
      <TestimonialBox topicId={`effect:${effectId}`} user={user} />

      {/* 의사 상담 기준 */}
      <section className="card border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-900/15">
        <h2 className="section-title">⚠️ 의사 상담이 필요한 경우</h2>
        <ul className="mt-3 space-y-1 text-sm text-rose-900 dark:text-rose-200 list-disc list-inside">
          {content.seeDoctor.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      {/* FAQ */}
      {content.faqs?.length > 0 && (
        <section className="card" id="faq">
          <h2 className="section-title">자주 묻는 질문 — {content.label}</h2>
          <div className="mt-3 space-y-2">
            {content.faqs.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} />
            ))}
          </div>
        </section>
      )}

      {/* CTA — 로그인 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 text-white p-6 text-center">
        <h2 className="text-xl font-bold">
          {user ? `${content.label} 본인 기록 보기` : `${content.label}으로 고민 중이세요?`}
        </h2>
        <p className="mt-2 text-slate-300 text-sm leading-relaxed">
          {user
            ? '기록 탭에서 부작용을 입력하면 비슷한 사용자 회복 패턴이 자동 비교됩니다.'
            : <>실사용자 익명 데이터 기반 — 본인 조건 입력하면 부작용 시점·회복 패턴을 바로 확인하세요.</>}
        </p>
        <button onClick={() => user ? navigate('records') : handleSignup()}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-500 px-6 py-3 font-bold hover:bg-brand-600 transition">
          {user ? '기록하러 가기 →' : '내 감량 곡선 보기 →'}
        </button>
      </section>

      <ShareButtons title={`${content.label} — 위마로그`}
                    text={`${content.label}는 평균 ${content.timing} 나타납니다. 자가 관리법과 의사 상담 기준 확인.`} />

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)} onComplete={(id) => { setShowSignup(false); onSignup?.(id); }} />
      )}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-ink-200 dark:border-slate-700 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex justify-between items-center text-left px-4 py-3 hover:bg-ink-100/40 dark:hover:bg-slate-800/40 transition">
        <span className="font-semibold text-sm text-ink-900 dark:text-slate-100">{q}</span>
        <span className="text-ink-500 dark:text-slate-400 flex-shrink-0 ml-2">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-ink-100 dark:border-slate-800 text-sm text-ink-700 dark:text-slate-300 leading-relaxed bg-ink-100/30 dark:bg-slate-800/30">
          {a}
        </div>
      )}
    </div>
  );
}
