import React, { useEffect, useMemo, useState } from 'react';
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT } from '../../lib/content.js';
import { PEN_INFO, REFERENCE_PRICE_4W } from '../../lib/constants.js';
import { avgLossCurve, cohortSize, sideEffectRates, anonymousNotes, priceStats, userDemographics } from '../../lib/stats.js';
import { fetchAvgLossCurve, fetchSideEffectRates, fetchPriceStats } from '../../lib/supabaseStats.js';
import { supabaseConfigured } from '../../lib/supabaseClient.js';
import { Storage } from '../../lib/storage.js';
import { LineChart, HBarChart } from '../Chart.jsx';
import { QuickSignupModal } from '../Paywall.jsx';
import { MedicalDisclaimer, RedFlagBanner } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';
// InterestButton 제거 — '관심 있어요' 1탭 수집은 비즈니스 핵심 X
import { TestimonialBox } from '../TestimonialBox.jsx';
import { SimulatorCTA } from '../SimulatorCTA.jsx';

// 약별 상세 페이지 — SEO 랜딩 + 실시간 통계 + 가입 CTA
export function DrugInfoPage({ medId, navigate, user, onSignup }) {
  const drug = DRUG_CONTENT[medId];
  const [showSignup, setShowSignup] = useState(false);

  if (!drug) return <div className="card text-center py-10">약 정보를 찾을 수 없습니다</div>;

  // 실시간 통계 (이 약에 한정) — localStorage fallback
  const filter = { medication: medId };
  const localCohortN = useMemo(() => cohortSize(filter), [medId]);
  const localCurve = useMemo(() => avgLossCurve(filter, [4, 8, 12, 16, 24, 36, 48]), [medId]);
  const localSideRates = useMemo(() => sideEffectRates(filter), [medId]);
  const notes = useMemo(() => anonymousNotes(filter, 3), [medId]);
  const localPrices = useMemo(() => priceStats(filter), [medId]);
  const demographics = useMemo(() => userDemographics(filter), [medId]);

  // Supabase 풀데이터 — 약별 12-48주 감량, 부작용, 가격
  const [supaCurve, setSupaCurve] = useState(null);
  const [supaSideRates, setSupaSideRates] = useState(null);
  const [supaPrices, setSupaPrices] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    Promise.all([
      fetchAvgLossCurve(filter, [4, 8, 12, 16, 24, 36, 48]),
      fetchSideEffectRates(medId),
      fetchPriceStats(medId),
    ]).then(([c, s, p]) => {
      if (cancelled) return;
      if (c && c.some(x => x.n > 0)) setSupaCurve(c);
      if (s && s.length) setSupaSideRates(s);
      if (p && p.byRegion?.length) setSupaPrices(p);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [medId]);

  const curve = supaCurve || localCurve;
  const sideRates = supaSideRates || localSideRates;
  const prices = supaPrices || localPrices;
  // cohort N — Supabase의 12주 n 우선, 없으면 localStorage
  const cohortN = supaCurve?.find(c => c.week === 12)?.n
    || supaCurve?.reduce((m, c) => Math.max(m, c.n || 0), 0)
    || localCohortN;

  // 참고 체중 (사용자 기준)
  const refWeight = user?.startWeight ?? 80;
  const lineData = curve.filter(c => c.avg != null).map(c => ({
    x: c.week, y: refWeight * c.avg / 100, label: `${c.week}주`,
  }));

  const handleSignup = () => setShowSignup(true);
  const onSignupComplete = (id) => {
    setShowSignup(false);
    onSignup?.(id);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-slate-100">
            {drug.label} <span className="text-ink-500 dark:text-slate-500 text-lg font-normal">({drug.en})</span>
          </h1>
        </div>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          {drug.generic} · {drug.company} · {drug.type} · {drug.frequency}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="chip-brand">{drug.indication}</span>
        </div>
      </header>

      {/* 시뮬레이터 빠른 진입 — P1 페르소나 */}
      <SimulatorCTA navigate={navigate} user={user} context="drug" />

      {/* 효과 헤드라인 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5 sm:p-6">
        <h2 className="text-xs uppercase tracking-wider opacity-80">{drug.label} 효과 · 평균 체중 감량</h2>
        <div className="text-4xl sm:text-5xl font-extrabold mt-1 tabular-nums">{drug.efficacy.headlineKg}</div>
        <div className="text-base mt-1 opacity-90">{drug.efficacy.headlinePct} · {drug.efficacy.trial}</div>
        <p className="mt-3 text-sm opacity-80 leading-relaxed">{drug.efficacy.caveat}</p>
      </section>

      {/* 빠른 anchor links — 검색 의도 매칭 */}
      <nav className="card !p-3">
        <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">자주 검색되는 정보</div>
        <div className="flex flex-wrap gap-2">
          {[
            { hash: '#mechanism',  label: `${drug.label} 효과 원리` },
            { hash: '#price',      label: `${drug.label} 가격` },
            { hash: '#side',       label: `${drug.label} 부작용` },
            { hash: '#tips',       label: `${drug.label} 사용 팁` },
            { hash: '#warnings',   label: `${drug.label} 주의사항` },
          ].map(a => (
            <a key={a.hash} href={a.hash}
               className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition">
              {a.label}
            </a>
          ))}
        </div>
      </nav>

      {/* 우리 사용자 데이터 (실시간) */}
      <section className="card">
        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
          <div>
            <h2 className="section-title">위마로그 사용자 실제 곡선</h2>
            <p className="section-subtitle">본인 시작 체중 {refWeight}kg 기준 환산</p>
          </div>
          <button onClick={handleSignup} className="btn-primary !py-2 !px-3 text-sm">
            내 데이터 추가 →
          </button>
        </div>
        {lineData.length > 0 ? (
          <LineChart series={[
            { name: '평균', color: '#2E9A58', data: lineData },
          ]} yLabel="kg" height={220} />
        ) : (
          <div className="text-sm text-ink-500 dark:text-slate-400 py-6 text-center">아직 충분한 데이터가 쌓이지 않았어요</div>
        )}
      </section>

      {/* 작용 기전 */}
      <section className="card" id="mechanism">
        <h2 className="section-title">{drug.label}는 어떻게 작용하나요?</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300">
          {drug.mechanism.map((m, i) => (
            <li key={i} className="flex gap-2"><span className="text-brand-500">●</span><span>{m}</span></li>
          ))}
        </ul>
      </section>

      {/* 용량 + 가격 — 4주분(1박스) 기준 표준화 */}
      <section className="card" id="price">
        <h2 className="section-title">{drug.label} 가격 · 용량 (4주분 기준)</h2>
        {PEN_INFO[medId]?.note && (
          <div className="mt-2 rounded-lg bg-brand-50 dark:bg-brand-900/15 px-3 py-2 text-xs text-ink-700 dark:text-slate-300 leading-relaxed">
            💉 {PEN_INFO[medId].note}
          </div>
        )}
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-slate-400">투약 주기</span>
            <span className="font-medium text-ink-900 dark:text-slate-100">{drug.frequency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-slate-400">처방 단위</span>
            <span className="font-medium text-ink-900 dark:text-slate-100">{PEN_INFO[medId]?.perBoxText || '4주분'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-slate-400">증량 일정</span>
            <span className="font-medium text-ink-900 dark:text-slate-100 text-right">{drug.doseSchedule}</span>
          </div>
        </div>

        {/* 용량별 정가 reference — 약국에서 묻기 전 미리 비교용 */}
        {REFERENCE_PRICE_4W[medId] && (
          <div className="mt-4 pt-3 border-t border-ink-100 dark:border-slate-800">
            <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">
              용량별 약국 평균 (4주분 / 1박스)
            </div>
            <div className="space-y-1">
              {Object.entries(REFERENCE_PRICE_4W[medId]).map(([dose, price]) => (
                <div key={dose} className="flex justify-between text-sm">
                  <span className="text-ink-700 dark:text-slate-300 tabular-nums">{dose}</span>
                  <span className="tabular-nums text-ink-900 dark:text-slate-100 font-medium">
                    {(price / 10000).toFixed(0)}만원
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-ink-500 dark:text-slate-500 leading-relaxed">
              ⚠ 약국별 ±30% 변동. 정확한 가격은 약국에 직접 문의 또는
              <button onClick={() => navigate('pharmacies')} className="underline text-brand-700 dark:text-brand-400 ml-0.5">
                약국별 최근 가격
              </button>
              에서 확인하세요.
            </div>
          </div>
        )}

        {prices?.byRegion?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-ink-100 dark:border-slate-800">
            <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">
              지역별 평균 (사용자 보고 · 4주분 기준)
            </div>
            <div className="space-y-1">
              {prices.byRegion.slice(0, 5).map(r => (
                <div key={r.region} className="flex justify-between text-sm">
                  <span className="text-ink-700 dark:text-slate-300">{r.region}</span>
                  <span className="tabular-nums text-ink-900 dark:text-slate-100">{Math.round(r.avg).toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 부작용 Top 5 + 클릭으로 상세 페이지 */}
      <section className="card" id="side">
        <h2 className="section-title">{drug.label} 부작용 — Top 5</h2>
        <p className="section-subtitle">막대를 클릭하면 부작용별 상세 페이지로 이동합니다</p>
        <div className="mt-4 space-y-2">
          {drug.sideEffectsTop.map(s => {
            const real = sideRates.find(r => r.id === s.id);
            const displayRate = real?.rate ?? s.rate;
            return (
              <button key={s.id} onClick={() => navigate(`effect/${s.id}`)}
                      className="w-full text-left group hover:bg-ink-100/40 dark:hover:bg-slate-800/40 -mx-2 px-2 py-1.5 rounded-lg transition">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ink-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                    {SIDE_EFFECT_CONTENT[s.id]?.label || s.label} <span className="text-[10px] text-ink-300 dark:text-slate-600">▸</span>
                  </span>
                  <span className="text-ink-500 dark:text-slate-400 tabular-nums">{(displayRate * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-rose-500"
                       style={{ width: `${Math.min(100, displayRate * 100)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 사용자 인구통계 (이 약 쓰는 사람들의 특성) */}
      {demographics && demographics.total > 0 && (
        <section className="card">
          <h2 className="section-title">{drug.label}를 쓰는 사람들</h2>
          <p className="section-subtitle">코호트 특성 분포</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">성별</div>
              <div className="space-y-1.5">
                <DemoRow label="여성" pct={demographics.genderPct.F} />
                <DemoRow label="남성" pct={demographics.genderPct.M} />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">나이대 분포</div>
              <div className="space-y-1.5">
                {demographics.ageDist.slice(0, 4).map(a => (
                  <DemoRow key={a.id} label={a.id} pct={a.pct} />
                ))}
              </div>
            </div>
          </div>
          {demographics.conditionPct.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">동반 질환</div>
              <div className="space-y-1.5">
                {demographics.conditionPct.slice(0, 4).map(c => (
                  <DemoRow key={c.id} label={
                    c.id === 'diabetes' ? '당뇨' :
                    c.id === 'prediabetes' ? '전당뇨' :
                    c.id === 'fattyLiver' ? '지방간' :
                    c.id === 'hypertension' ? '고혈압' :
                    c.id === 'dyslipidemia' ? '이상지질혈증' : c.id
                  } pct={c.pct} />
                ))}
              </div>
            </div>
          )}
          {demographics.avgStartBmi && (
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-slate-800 text-sm text-ink-700 dark:text-slate-300">
              평균 시작 BMI: <b className="text-brand-700 dark:text-brand-400 tabular-nums">{demographics.avgStartBmi.toFixed(1)}</b>
            </div>
          )}
        </section>
      )}

      {/* 다른 약과 빠른 비교 (inline) */}
      <section className="card">
        <h2 className="section-title">다른 약과 비교</h2>
        <p className="section-subtitle">{drug.label}와 비슷한 GLP-1 약 한눈에 보기</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {Object.values(DRUG_CONTENT).filter(d => d.id !== drug.id).map(d => (
            <button key={d.id} onClick={() => navigate(`drug/${d.id}`)}
                    className="text-left rounded-xl border border-ink-200 dark:border-slate-700 p-3 hover:border-brand-300 dark:hover:border-brand-700 transition">
              <div className="text-xs text-ink-500 dark:text-slate-400">{d.label}</div>
              <div className="text-sm font-bold text-brand-700 dark:text-brand-400 tabular-nums mt-0.5">
                {d.efficacy.headlineKg}
              </div>
              <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{d.frequency}</div>
            </button>
          ))}
        </div>
        <button onClick={() => navigate('compare')}
                className="btn-secondary w-full mt-3 text-sm">
          📋 5개 약 전체 비교 표 →
        </button>
      </section>

      {/* 한 줄 후기 (가입자 작성 + 익명 노출) */}
      <TestimonialBox topicId={`drug:${drug.id}`} user={user} />

      {/* 익명 사용자 메모 (체중 기록 시 작성된 것) */}
      {notes.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{drug.label} 체중 기록 메모</h2>
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="card !p-4">
                <p className="text-sm text-ink-700 dark:text-slate-300">"{n.notes}"</p>
                <div className="text-xs text-ink-500 dark:text-slate-500 mt-2">
                  {n.date} · {n.gender === 'F' ? '여성' : '남성'} {n.ageGroup}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 장단점 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card">
          <h3 className="font-bold text-ink-900 dark:text-slate-100">👍 장점</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700 dark:text-slate-300">
            {drug.pros.map((p, i) => <li key={i}>· {p}</li>)}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-bold text-ink-900 dark:text-slate-100">👎 단점</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700 dark:text-slate-300">
            {drug.cons.map((c, i) => <li key={i}>· {c}</li>)}
          </ul>
        </div>
      </section>

      {/* 사용 팁 */}
      <section className="card" id="tips">
        <h2 className="section-title">{drug.label} 사용 팁</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300">
          {drug.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="text-amber-500">💡</span><span>{t}</span></li>)}
        </ul>
      </section>

      {/* 주의사항 */}
      <section className="card border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/15" id="warnings">
        <h2 className="section-title">⚠️ {drug.label} 사용 전 주의사항</h2>
        <ul className="mt-3 space-y-1 text-sm text-rose-900 dark:text-rose-200 list-disc list-inside">
          {drug.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </section>

      <RedFlagBanner />

      {/* FAQ — Google FAQPage 검색 결과 노출 */}
      {drug.faqs?.length > 0 && (
        <section className="card" id="faq">
          <h2 className="section-title">자주 묻는 질문 — {drug.label}</h2>
          <div className="mt-3 space-y-2">
            {drug.faqs.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} />
            ))}
          </div>
        </section>
      )}

      {/* CTA — 로그인 상태 따라 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 text-white p-6 text-center">
        <h2 className="text-xl font-bold">
          {user ? `${drug.label} 본인 데이터 보기` : `${drug.label} 사용 중이거나 고민 중이신가요?`}
        </h2>
        <p className="mt-2 text-slate-300 text-sm leading-relaxed">
          {user
            ? '대시보드에서 본인 진척도 + 비슷한 사용자 비교를 확인하세요.'
            : <>이미 <b className="text-white">8,600명+</b> 한국 사용자 데이터 보유 — 본인 키·체중·약 입력하면 비슷한 사용자의 주차별 감량 곡선이 바로 나옵니다.</>}
        </p>
        <button onClick={() => user ? navigate('dashboard') : handleSignup()}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-500 px-6 py-3 font-bold hover:bg-brand-600 transition">
          {user ? '내 대시보드 →' : '🔮 내 예상 감량 보기 →'}
        </button>
      </section>

      <ShareButtons title={`${drug.label} 효과와 부작용 — 위마로그`}
                    text={`${drug.label} 평균 ${drug.efficacy.headlineKg} 감량. 실제 사용자 데이터.`} />

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)} onComplete={onSignupComplete} />
      )}
    </div>
  );
}

function DemoRow({ label, pct }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-ink-700 dark:text-slate-300">{label}</span>
        <span className="text-ink-500 dark:text-slate-400 tabular-nums">{(pct * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, pct * 100)}%` }} />
      </div>
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
