import React, { useEffect, useState } from 'react';
import { overallSummary, compareMedications, priceStats, recentTrend, anonymousNotes } from '../lib/stats.js';
import { MED_BY_ID } from '../lib/constants.js';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { LockedOverlay, QuickSignupModal } from './Paywall.jsx';
import { GroupBarChart } from './Chart.jsx';
import { Simulator } from './Simulator.jsx';

export function Landing({ navigate, onSignup }) {
  const [summary, setSummary] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  const [medCmp, setMedCmp] = useState(null);
  const [priceTop, setPriceTop] = useState(null);
  const [trend, setTrend] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    setSummary(overallSummary());
    setMedCmp(compareMedications({}, 12));
    const p = priceStats({});
    setPriceTop({ avg: p.avg, topRegion: p.byRegion[0] });
    setTrend(recentTrend());
    setNotes(anonymousNotes({}, 4));
  }, []);

  const handleSignup = () => setShowSignup(true);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Hero */}
      <section className="text-center pt-4 sm:pt-10">
        <div className="inline-flex items-center gap-2 chip-brand mb-4">
          <span>🟢</span>
          <span>GLP-1 사용자 리얼데이터 플랫폼 · 베타</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-ink-900 dark:text-slate-100 leading-tight">
          위고비·마운자로,<br />
          <span className="text-brand-600 dark:text-brand-400">나와 비슷한 사람</span>은 얼마나 빠졌을까?
        </h1>
        <p className="mt-4 text-base sm:text-lg text-ink-500 dark:text-slate-400 max-w-2xl mx-auto">
          체중·약·부작용을 익명으로 기록하고 실제 사용자 데이터와 비교합니다.<br className="hidden sm:block" />
          가입 없이 먼저 <b className="text-ink-700 dark:text-slate-200">"내가 쓰면 어떻게 될까?"</b>를 확인해 보세요.
        </p>
      </section>

      {/* 시뮬레이터 — 가입 없이 즉시 사용 가능한 핵심 위젯 */}
      <section className="max-w-2xl mx-auto">
        <Simulator onSignup={handleSignup} />
      </section>

      {/* 커뮤니티 신호 */}
      {trend && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="등록 사용자" value={`${trend.totalUsers.toLocaleString()}명`}
                    sub={trend.newUsers7d > 0 ? `이번 주 +${trend.newUsers7d}` : null} />
          <StatTile label="이번 주 활동자" value={`${trend.activeUsers7d}명`} sub="최근 7일 기록" />
          <StatTile label="이번 주 투약 기록" value={`${trend.doses7d.toLocaleString()}건`} sub="최근 7일" />
          <StatTile label="이번 주 체중 기록" value={`${trend.logs7d.toLocaleString()}건`} sub="최근 7일" highlight />
        </section>
      )}

      {/* 가장 많이 쓰는 약 (실시간) */}
      {trend?.topMedsNow?.length > 0 && (
        <section className="card">
          <div className="flex justify-between items-end mb-3 flex-wrap gap-2">
            <div>
              <h2 className="section-title">최근 한 달 새로 시작한 약</h2>
              <p className="section-subtitle">사용자들이 지금 가장 많이 시작하는 약</p>
            </div>
          </div>
          <div className="space-y-2">
            {trend.topMedsNow.map((m, i) => {
              const maxCount = trend.topMedsNow[0].count;
              return (
                <div key={m.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink-700 dark:text-slate-300">
                      {i === 0 && '🏆 '}{m.label}
                    </span>
                    <span className="tabular-nums text-ink-500 dark:text-slate-400">{m.count}건</span>
                  </div>
                  <div className="h-2 bg-ink-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500"
                         style={{ width: `${(m.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 약제 비교 — 블러로 호기심 유도 */}
      {medCmp && (
        <section className="card">
          <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
            <div>
              <h2 className="section-title">위고비 vs 마운자로 vs ...</h2>
              <p className="section-subtitle">실제 사용자 데이터로 비교한 12주 평균 감량률</p>
            </div>
            <button onClick={handleSignup} className="btn-primary !py-2 !px-3 text-xs">지금 보기</button>
          </div>
          <LockedOverlay
            reason="free"
            title="가입자만 볼 수 있어요"
            message="5개 약제의 실제 감량률 차이를 비교합니다"
            onUnlock={handleSignup}
            minHeight={220}
          >
            <GroupBarChart
              data={medCmp.map(m => ({
                label: m.label.replace(/\s*\(.*\)/, ''),
                value: m.avg,
                n: m.n,
              }))}
              valueLabel="%"
            />
          </LockedOverlay>
        </section>
      )}

      {/* 익명 후기 */}
      {notes.length > 0 && (
        <section>
          <div className="text-center mb-4">
            <h2 className="section-title">실제 사용자들의 익명 메모</h2>
            <p className="section-subtitle mt-1">최근 기록 중 일부</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map((n, i) => (
              <div key={i} className="card !p-4">
                <div className="text-xs text-ink-500 dark:text-slate-400 mb-1.5 flex gap-2">
                  <span>{n.date}</span>
                  {n.medication && (
                    <span className="chip-brand text-[10px] !py-0">
                      {MED_BY_ID[n.medication]?.label.replace(/\s*\(.+\)/, '')}
                    </span>
                  )}
                  <span>· {n.gender === 'F' ? '여' : n.gender === 'M' ? '남' : ''}{n.ageGroup}</span>
                </div>
                <p className="text-sm text-ink-700 dark:text-slate-300 leading-snug">"{n.notes}"</p>
                <div className="text-xs text-ink-500 dark:text-slate-500 mt-2 tabular-nums">현재 {n.weight} kg</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 가격 미리보기 */}
      {priceTop?.topRegion && (
        <section className="card !p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-ink-500 dark:text-slate-400">가장 저렴한 지역</div>
              <div className="text-lg font-bold text-ink-900 dark:text-slate-100">
                {priceTop.topRegion.region}{' '}
                <span className="text-brand-600 dark:text-brand-400 tabular-nums">
                  {Math.round(priceTop.topRegion.avg).toLocaleString()}원
                </span>
              </div>
              <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
                전체 평균 {Math.round(priceTop.avg).toLocaleString()}원 대비{' '}
                {Math.round((1 - priceTop.topRegion.avg / priceTop.avg) * 100)}% 저렴
              </div>
            </div>
            <button onClick={handleSignup} className="btn-secondary !py-2 !px-3 text-xs">
              나머지 지역 보기 →
            </button>
          </div>
        </section>
      )}

      {/* 누가 잘 맞을까? - 페르소나별 안내 */}
      <section>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-ink-900 dark:text-slate-100">이런 분께 추천해요</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PersonaCard icon="🤔" title="처음 알게 된 분"
                       desc="가입 없이 위 시뮬레이터로 예상 효과를 먼저 확인하세요." />
          <PersonaCard icon="😟" title="부작용으로 고민 중"
                       desc="같은 부작용을 겪은 사용자들의 발생 시점과 지속 기간 데이터를 봅니다." />
          <PersonaCard icon="📈" title="감량 방법이 궁금"
                       desc="잘 빠진 상위 25%의 운동·식단 패턴을 비교합니다." />
          <PersonaCard icon="💬" title="주변에 물어보기 어려운 분"
                       desc="실명 없이 익명 통계만으로 다른 사용자들의 데이터를 봅니다." />
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-3">
        <h2 className="section-title">자주 묻는 질문</h2>
        <FAQ q="아직 약을 시작하지 않았어요. 가입할 수 있나요?">
          네. 약 없이도 체중·운동·식단을 기록하고, 다른 사용자들의 약별 효과·부작용 통계를 참고할 수 있습니다.
        </FAQ>
        <FAQ q="제 데이터가 다른 사람에게 보이나요?">
          개인 식별 정보 없이 익명 통계의 일부로만 집계됩니다. 닉네임·메모·구매 정보는 본인만 볼 수 있습니다.
        </FAQ>
        <FAQ q="약을 끊으면 다시 찌나요?">
          평균적으로 6개월 안에 빠진 양의 30~50%가 회복되는 경향이 있습니다. 가입 후 통계 페이지에서
          운동 지속 그룹의 회복률이 얼마나 낮은지 확인할 수 있습니다.
        </FAQ>
        <FAQ q="유료 기능이 있나요?">
          기본 통계와 본인 기록은 무료입니다. 진료용 PDF 리포트, AI 주간 분석 등 일부 고급 기능은
          곧 Premium으로 출시 예정입니다.
        </FAQ>
      </section>

      {/* 하단 큰 CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-900 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white p-8 text-center">
        <h2 className="text-2xl font-extrabold">지금 1분만 투자하세요</h2>
        <p className="mt-2 text-slate-300 text-sm">
          {trend ? `${trend.totalUsers}명 사용자` : '실제 사용자'}의 12주 평균 감량률 · 5개 약제 비교 · 약 중단 후 회복률 · 지역별 가격
        </p>
        <button onClick={handleSignup}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-bold hover:bg-brand-600 transition">
          1분 가입하고 전체 데이터 보기 →
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

function StatTile({ label, value, sub, highlight }) {
  return (
    <div className={`card text-center !p-4 ${highlight ? 'ring-2 ring-brand-300 dark:ring-brand-700' : ''}`}>
      <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${highlight ? 'text-brand-600 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {value}
      </div>
      <div className="text-xs sm:text-sm text-ink-500 dark:text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function PersonaCard({ icon, title, desc }) {
  return (
    <div className="card flex gap-3 !p-4">
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div>
        <div className="font-bold text-ink-900 dark:text-slate-100">{title}</div>
        <div className="text-sm text-ink-500 dark:text-slate-400 mt-1 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

function FAQ({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card !py-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex justify-between items-center text-left">
        <span className="font-semibold text-ink-900 dark:text-slate-100">{q}</span>
        <span className="text-ink-500 dark:text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">{children}</div>}
    </div>
  );
}
