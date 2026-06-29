import React, { useMemo, useState } from 'react';
import {
  EXP_STAGES, STAGE_BY_ID, EXPERIENCES, EXPERIENCE_COUNT, BASIS_NOTE,
  LANDING_STAGE_ORDER, experiencesForDrug,
} from '../lib/experiences.js';

// 실사용 경험 — 신규 진입자의 "낯섬"을 줄이는 프리미엄 카드 섹션.
// variant:
//   'landing' — 랜딩 사회적 증거. 단계 필터 + 가로 스냅 스크롤. 감정 비트 우선.
//   'drug'    — 약 상세 페이지. 해당 약 + 일반 경험.
//   'full'    — 전체(단계 필터 + 그리드).
// 정직성: 특정 개인의 검증된 후기가 아니라 공개 후기·임상 보고의 대표 패턴 (BASIS_NOTE).

function QuoteCard({ exp, className = '' }) {
  const stage = STAGE_BY_ID[exp.stage];
  return (
    <figure
      className={`relative overflow-hidden rounded-2xl border border-ink-200/80 dark:border-slate-700/70
                  bg-gradient-to-br from-white to-ink-100/50 dark:from-slate-900 dark:to-slate-800/60
                  p-4 sm:p-5 shadow-card ${className}`}>
      {/* 큰 장식 인용부호 */}
      <span aria-hidden
            className="pointer-events-none absolute -top-3 right-2 text-7xl font-serif leading-none
                       text-brand-200/70 dark:text-brand-800/40 select-none">”</span>

      <blockquote className="relative text-[13.5px] sm:text-sm leading-relaxed text-ink-800 dark:text-slate-200">
        {exp.text}
      </blockquote>

      <figcaption className="mt-3 pt-3 border-t border-ink-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/25 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
          <span aria-hidden>{stage?.icon}</span>{stage?.label}
        </span>
        <span className="text-[11px] text-ink-500 dark:text-slate-400">
          {exp.who}{exp.when ? ` · ${exp.when}` : ''}
        </span>
      </figcaption>
    </figure>
  );
}

export function RealExperiences({ variant = 'full', drug = null, defaultStage = 'all', navigate, className = '' }) {
  const [stage, setStage] = useState(defaultStage);
  const STEP = variant === 'landing' ? 8 : 9;
  const [visible, setVisible] = useState(STEP);

  // 후보 풀
  const pool = useMemo(() => {
    if (variant === 'drug' && drug) return experiencesForDrug(drug);
    return EXPERIENCES;
  }, [variant, drug]);

  // 단계 필터 적용 + 정렬(랜딩은 감정 비트 우선)
  const list = useMemo(() => {
    let arr = stage === 'all' ? pool : pool.filter(e => e.stage === stage);
    if (variant === 'landing' && stage === 'all') {
      const rank = Object.fromEntries(LANDING_STAGE_ORDER.map((s, i) => [s, i]));
      arr = [...arr].sort((a, b) => (rank[a.stage] ?? 99) - (rank[b.stage] ?? 99));
    }
    return arr;
  }, [pool, stage, variant]);

  // 표시할 단계칩만 (풀에 존재하는 단계)
  const stagesPresent = useMemo(() => {
    const set = new Set(pool.map(e => e.stage));
    return EXP_STAGES.filter(s => set.has(s.id));
  }, [pool]);

  const isLanding = variant === 'landing';
  const shown = list.slice(0, visible);
  const onFilter = (s) => { setStage(s); setVisible(STEP); };

  return (
    <section className={className} aria-label="실사용 경험">
      {/* 헤더 — 낯섬 직격 카피 */}
      <div className="flex items-end justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2">
            <span aria-hidden>💬</span> 실제로 어떤 경험을 할까
          </h2>
        </div>
        <span className="chip flex-shrink-0 tabular-nums">{EXPERIENCE_COUNT.toLocaleString()}개</span>
      </div>
      <p className="section-subtitle mb-3 leading-relaxed">
        {isLanding
          ? '처음이라 낯설다면 — 시작 전 두려움부터 식욕 변화·부작용·정체기까지, 사람들이 공통적으로 겪는 이야기예요.'
          : '시작 전 고민부터 유지·중단까지, 단계별로 흔히 보고되는 경험을 모았어요.'}
      </p>

      {/* 단계 필터 칩 */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-1">
        <FilterPill active={stage === 'all'} onClick={() => onFilter('all')} label="전체" />
        {stagesPresent.map(s => (
          <FilterPill key={s.id} active={stage === s.id} onClick={() => onFilter(s.id)}
                      icon={s.icon} label={s.label} />
        ))}
      </div>

      {/* 카드 — 랜딩: 가로 스냅 스크롤 / 그 외: 그리드 */}
      {isLanding ? (
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 snap-x snap-mandatory">
          {shown.map(exp => (
            <QuoteCard key={exp.id} exp={exp}
                       className="snap-start shrink-0 w-[280px] sm:w-[320px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map(exp => <QuoteCard key={exp.id} exp={exp} />)}
        </div>
      )}

      {shown.length === 0 && (
        <div className="card !py-6 text-center text-sm text-ink-500 dark:text-slate-400">
          이 단계의 경험은 아직 정리 중이에요.
        </div>
      )}

      {/* 더 보기 */}
      {visible < list.length && (
        <div className="mt-3 text-center">
          <button onClick={() => setVisible(v => v + STEP * 2)}
                  className="btn-secondary !py-2 !px-5 text-sm">
            더 보기 <span className="text-ink-400 dark:text-slate-500 tabular-nums">({list.length - visible})</span>
          </button>
        </div>
      )}

      {/* 정직성 푸터 */}
      <p className="mt-2 text-[11px] text-ink-400 dark:text-slate-500 leading-relaxed">
        ※ {BASIS_NOTE}
      </p>

      {/* 랜딩 — 시뮬레이터/가입 연결 */}
      {isLanding && navigate && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('guide/first-month')}
                  className="btn-secondary !py-2 !px-4 text-sm">📅 첫 한 달 가이드</button>
          <button onClick={() => navigate('guide/side-effect-timeline')}
                  className="btn-ghost !px-3 text-sm">🗓️ 부작용 시점별 변화</button>
        </div>
      )}
    </section>
  );
}

function FilterPill({ active, onClick, icon, label }) {
  return (
    <button type="button" onClick={onClick}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 min-h-[36px] text-xs font-semibold border transition whitespace-nowrap
                        ${active
                          ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-ink-600 dark:text-slate-300 border-ink-200 dark:border-slate-700 hover:border-brand-300'}`}>
      {icon && <span aria-hidden>{icon}</span>}{label}
    </button>
  );
}
