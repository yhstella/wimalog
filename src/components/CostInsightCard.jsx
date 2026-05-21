import React, { useMemo } from 'react';
import { Storage } from '../lib/storage.js';
import { snapshotPriceStats } from '../lib/snapshot.js';

// 누적 약값 / 1kg당 비용 / 연간 추정 — 6달+ 사용자에게 가장 가치 큼
// 가입 30일 미만이면 표시 X (데이터 부족)
export function CostInsightCard({ user, navigate }) {
  const data = useMemo(() => {
    if (!user?.createdAt) return null;
    const ageDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
    if (ageDays < 30) return null;  // 1달 미만은 의미 없음

    const doses = Storage.getDosesByUser(user.id);
    const logs = Storage.getLogsByUser(user.id);
    const courses = Storage.getMedCoursesByUser(user.id);

    // 누적 비용 (가격 입력된 dose만)
    const dosesWithPrice = doses.filter(d => d.price > 0);
    if (!dosesWithPrice.length) return null;
    const totalCost = dosesWithPrice.reduce((s, d) => s + d.price, 0);

    // 누적 감량 kg
    const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const startWeight = sortedLogs[0]?.weight || user.startWeight;
    const currentWeight = sortedLogs[sortedLogs.length - 1]?.weight || startWeight;
    const lostKg = startWeight && currentWeight ? startWeight - currentWeight : 0;
    const costPerKg = lostKg > 0 ? Math.round(totalCost / lostKg) : null;

    // 일평균 약값 (가입 후 경과일 기준) → 연환산
    const dailyAvg = totalCost / ageDays;
    const annualProjection = Math.round(dailyAvg * 365);

    // 활성 약 — 코호트 평균 가격 (snapshot)
    const activeCourse = courses.find(c => !c.endDate);
    let cohortAvgBoxKrw = null;
    let savingsPct = null;
    if (activeCourse?.medication) {
      const ps = snapshotPriceStats(activeCourse.medication);
      if (ps?.avg) {
        cohortAvgBoxKrw = Math.round(ps.avg);
        // 본인 4주분 평균 price (가장 최근 4건 평균)
        const recentDoses = dosesWithPrice.slice(-4);
        const myAvgBox = recentDoses.reduce((s, d) => s + d.price, 0) / recentDoses.length;
        savingsPct = ((cohortAvgBoxKrw - myAvgBox) / cohortAvgBoxKrw) * 100;
      }
    }

    return {
      ageDays, totalCost, lostKg, costPerKg, annualProjection,
      doseCount: dosesWithPrice.length, cohortAvgBoxKrw, savingsPct,
    };
  }, [user]);

  if (!data) return null;
  const { ageDays, totalCost, lostKg, costPerKg, annualProjection, doseCount, savingsPct } = data;

  return (
    <section className="card border-l-4 border-amber-500">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl flex-shrink-0">💰</div>
        <div className="flex-1">
          <h3 className="font-bold text-ink-900 dark:text-slate-100">누적 약값 분석</h3>
          <p className="text-xs text-ink-500 dark:text-slate-400">
            가입 후 {ageDays}일 · {doseCount}회 투약 기록 기준
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/40 dark:border-amber-800/30 p-3">
          <div className="text-[10px] text-ink-500 uppercase tracking-wide">누적 약값</div>
          <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
            {(totalCost / 10000).toFixed(0)}만원
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5">전체 기록</div>
        </div>
        <div className="rounded-xl bg-brand-50/60 dark:bg-brand-900/15 border border-brand-200/40 dark:border-brand-800/30 p-3">
          <div className="text-[10px] text-ink-500 uppercase tracking-wide">1kg 감량당 비용</div>
          <div className="text-xl font-extrabold text-brand-700 dark:text-brand-400 tabular-nums mt-1">
            {costPerKg ? `${(costPerKg / 10000).toFixed(1)}만원` : '—'}
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5">
            {lostKg > 0 ? `누적 ${lostKg.toFixed(1)}kg` : '기록 부족'}
          </div>
        </div>
        <div className="rounded-xl bg-rose-50/60 dark:bg-rose-900/15 border border-rose-200/40 dark:border-rose-800/30 p-3">
          <div className="text-[10px] text-ink-500 uppercase tracking-wide">연간 추정</div>
          <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 tabular-nums mt-1">
            {(annualProjection / 10000).toFixed(0)}만원
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5">현재 페이스 기준</div>
        </div>
      </div>

      {/* 코호트 비교 */}
      {savingsPct != null && (
        <div className="mt-3 rounded-lg bg-ink-100/40 dark:bg-slate-800/40 px-3 py-2 text-xs leading-relaxed">
          📊 본인 평균 약값은 코호트 평균 대비{' '}
          {savingsPct > 5 ? (
            <b className="text-emerald-700 dark:text-emerald-400">{savingsPct.toFixed(0)}% 저렴</b>
          ) : savingsPct < -5 ? (
            <b className="text-rose-700 dark:text-rose-400">{Math.abs(savingsPct).toFixed(0)}% 비쌈</b>
          ) : (
            <b>비슷</b>
          )}
          {savingsPct < -5 && (
            <button onClick={() => navigate('pharmacies')}
                    className="ml-2 text-brand-700 dark:text-brand-400 underline">
              더 저렴한 약국 찾기 →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
