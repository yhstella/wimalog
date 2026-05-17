import React, { useMemo, useState } from 'react';
import { SIDE_EFFECT_CONTENT, DRUG_CONTENT } from '../../lib/content.js';
import { sideEffectRates, sideEffectTiming } from '../../lib/stats.js';
import { QuickSignupModal } from '../Paywall.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';

// 부작용별 상세 페이지 — SEO + 약별 발생률 + 시점 분포 + 자가 관리
export function SideEffectPage({ effectId, navigate, onSignup }) {
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

      {/* 시점 분포 (실시간) */}
      {timing.n > 0 && (
        <section className="card">
          <h2 className="section-title">언제 처음 나타날까?</h2>
          <p className="section-subtitle">위마로그 사용자 {timing.n}건 기준</p>
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

      {/* 의사 상담 기준 */}
      <section className="card border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-900/15">
        <h2 className="section-title">⚠️ 의사 상담이 필요한 경우</h2>
        <ul className="mt-3 space-y-1 text-sm text-rose-900 dark:text-rose-200 list-disc list-inside">
          {content.seeDoctor.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 text-white p-6 text-center">
        <h2 className="text-xl font-bold">{content.label}으로 고민 중이세요?</h2>
        <p className="mt-2 text-slate-300 text-sm">
          본인의 약·용량·기간과 함께 기록하면 비슷한 사용자의 회복 패턴을 볼 수 있어요.
        </p>
        <button onClick={handleSignup}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-500 px-6 py-3 font-bold hover:bg-brand-600 transition">
          1분 가입하기 →
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
