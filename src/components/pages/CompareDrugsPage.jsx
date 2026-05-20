import React, { useEffect, useMemo, useState } from 'react';
import { DRUG_CONTENT } from '../../lib/content.js';
import { compareMedications, sideEffectRates, priceStats } from '../../lib/stats.js';
import { fetchAvgLossCurve, fetchSideEffectRates, fetchPriceStats } from '../../lib/supabaseStats.js';
import { supabaseConfigured } from '../../lib/supabaseClient.js';
import { QuickSignupModal } from '../Paywall.jsx';
import { ShareButtons } from '../Share.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';

// 약 5종 한 테이블에 비교 — "위고비 vs 마운자로 vs 삭센다" 검색 유입 핵심
export function CompareDrugsPage({ navigate, user }) {
  const [showSignup, setShowSignup] = useState(false);
  const refWeight = user?.startWeight ?? 80;

  // localStorage 기반 (fallback)
  const localCompare12 = useMemo(() => compareMedications({}, 12), []);
  const localSideByMed = useMemo(() => {
    const result = {};
    for (const id of Object.keys(DRUG_CONTENT)) {
      const rates = sideEffectRates({ medication: id });
      result[id] = Object.fromEntries(rates.map(r => [r.id, r.rate]));
    }
    return result;
  }, []);
  const localPriceByMed = useMemo(() => {
    const result = {};
    for (const id of Object.keys(DRUG_CONTENT)) {
      const p = priceStats({ medication: id });
      result[id] = p.avg;
    }
    return result;
  }, []);

  // Supabase 8000+명 풀데이터 — 약별 12주 감량/부작용/가격 동시 fetch
  const [supaCompare12, setSupaCompare12] = useState(null);
  const [supaSideByMed, setSupaSideByMed] = useState(null);
  const [supaPriceByMed, setSupaPriceByMed] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    const medIds = Object.keys(DRUG_CONTENT);
    Promise.all(medIds.map(id => Promise.all([
      fetchAvgLossCurve({ medication: id }, [12]),
      fetchSideEffectRates(id),
      fetchPriceStats(id),
    ]))).then(results => {
      if (cancelled) return;
      const cmp = [], sides = {}, prices = {};
      medIds.forEach((id, i) => {
        const [curve, side, price] = results[i];
        const c12 = curve?.[0];
        cmp.push({ id, label: DRUG_CONTENT[id].label, n: c12?.n || 0, avg: c12?.avg ?? null, median: c12?.median ?? null });
        sides[id] = Object.fromEntries((side || []).map(r => [r.id, r.rate]));
        prices[id] = price?.avg ?? null;
      });
      if (cmp.some(c => c.n > 0)) setSupaCompare12(cmp);
      if (medIds.some(id => Object.keys(sides[id] || {}).length)) setSupaSideByMed(sides);
      if (medIds.some(id => prices[id] != null)) setSupaPriceByMed(prices);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const compare12 = supaCompare12 || localCompare12;
  const sideByMed = supaSideByMed || localSideByMed;
  const priceByMed = supaPriceByMed || localPriceByMed;

  const drugs = Object.values(DRUG_CONTENT);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-slate-100">
          약별 한눈에 비교
        </h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          위고비·마운자로·삭센다·오젬픽·젭바운드를 효과·부작용·가격으로 비교합니다.
        </p>
      </header>

      {/* 한눈 비교 표 */}
      <section className="card overflow-x-auto">
        <h2 className="section-title mb-3">핵심 지표</h2>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-ink-500 dark:text-slate-400 border-b border-ink-100 dark:border-slate-800">
              <th className="py-2 pr-2">약</th>
              <th className="py-2 px-2 text-right">12주 감량</th>
              <th className="py-2 px-2 text-right">최종 효과</th>
              <th className="py-2 px-2 text-right">오심</th>
              <th className="py-2 px-2 text-right">평균 가격(1회)</th>
              <th className="py-2 px-2">주기</th>
            </tr>
          </thead>
          <tbody>
            {drugs.map(d => {
              const c12 = compare12.find(c => c.id === d.id);
              const kg12 = c12?.avg != null ? (refWeight * c12.avg / 100).toFixed(1) : null;
              return (
                <tr key={d.id} className="border-b border-ink-100 dark:border-slate-800 hover:bg-ink-100/30 dark:hover:bg-slate-800/30">
                  <td className="py-2 pr-2">
                    <button onClick={() => navigate(`drug/${d.id}`)}
                            className="font-bold text-ink-900 dark:text-slate-100 hover:text-brand-700 dark:hover:text-brand-400">
                      {d.label} <span className="text-[10px] text-ink-300 dark:text-slate-600">▸</span>
                    </button>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {kg12 ? <span className="font-semibold text-brand-700 dark:text-brand-400">−{kg12} kg</span> : '—'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink-700 dark:text-slate-300">{d.efficacy.headlineKg}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {Math.round((sideByMed[d.id]?.nausea ?? 0) * 100)}%
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {priceByMed[d.id] ? `${Math.round(priceByMed[d.id]).toLocaleString()}원` : '—'}
                  </td>
                  <td className="py-2 px-2 text-xs text-ink-500 dark:text-slate-400">{d.frequency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="helptext mt-3">
          12주 감량은 본인 시작 체중 <b>{refWeight} kg</b> 기준 환산. 최종 효과는 임상시험 결과 (68-72주).
        </p>
      </section>

      {/* 어떤 약이 나에게 맞을까 */}
      <section className="card">
        <h2 className="section-title">어떤 약이 나에게 맞을까?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <RecCard color="brand"
            title="가장 강한 효과 원함"
            recommendation="마운자로 / 젭바운드"
            reason="이중 작용제로 -20% 이상 가능"
            onClick={() => navigate('drug/mounjaro')} />
          <RecCard
            title="가장 검증된 약"
            recommendation="위고비"
            reason="비만 치료 표준, 심혈관 위험 감소 입증"
            onClick={() => navigate('drug/wegovy')} />
          <RecCard
            title="비용 부담 최소"
            recommendation="삭센다 또는 위고비 저용량"
            reason="삭센다 월 30만원대, 위고비 0.25mg 25만원"
            onClick={() => navigate('drug/saxenda')} />
          <RecCard
            title="당뇨 + 비만 동반"
            recommendation="오젬픽 (당뇨) 또는 마운자로"
            reason="혈당 + 체중 동시 관리"
            onClick={() => navigate('drug/ozempic')} />
        </div>
        <p className="helptext mt-3">⚠️ 최종 약 선택은 반드시 담당 의료진과 상의해야 합니다.</p>
      </section>

      {/* CTA — 로그인 분기 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 text-center">
        <h2 className="text-xl font-bold">
          {user ? '본인 약 등록하고 비교 시작' : '고민 중인 약을 알려주세요'}
        </h2>
        <p className="mt-2 text-brand-50 text-sm">
          {user
            ? '약 탭에서 본인이 사용하는 약을 등록하면 비슷한 사용자 데이터와 자동 비교.'
            : '1분 가입 후 약 시작 시 비슷한 사용자 데이터와 본인 진척도가 자동 비교됩니다.'}
        </p>
        <button onClick={() => user ? navigate('meds') : setShowSignup(true)}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-white text-brand-700 px-6 py-3 font-bold hover:bg-brand-50 transition">
          {user ? '약 관리로 →' : '1분 가입 →'}
        </button>
      </section>

      <ShareButtons title="약별 한눈에 비교 — 위마로그"
                    text="위고비·마운자로·삭센다·오젬픽·젭바운드 효과·부작용·가격 비교" />

      <MedicalDisclaimer />

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)}
                          onComplete={(id) => { setShowSignup(false); }} />
      )}
    </div>
  );
}

function RecCard({ title, recommendation, reason, onClick, color }) {
  return (
    <button onClick={onClick}
            className={`text-left rounded-xl p-4 border transition w-full
                        ${color === 'brand'
                          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-800/40'
                          : 'bg-white dark:bg-slate-800 border-ink-200 dark:border-slate-700 hover:border-brand-300'}`}>
      <div className="text-xs text-ink-500 dark:text-slate-400">{title}</div>
      <div className="font-bold text-ink-900 dark:text-slate-100 mt-1">{recommendation}</div>
      <div className="text-xs text-ink-700 dark:text-slate-300 mt-1">{reason}</div>
      <div className="text-xs text-brand-700 dark:text-brand-400 mt-2">자세히 보기 →</div>
    </button>
  );
}
