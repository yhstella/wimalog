import React, { useEffect, useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { Simulator } from './Simulator.jsx';
import { anonymousNotes, sideEffectRates, reboundCurve, similarFilter, primaryCourse } from '../lib/stats.js';
import { fetchAvgLossCurve, fetchSideEffectRates, fetchReboundCurve } from '../lib/supabaseStats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import { SIDE_EFFECTS } from '../lib/constants.js';

// 가입 시 선택한 visitPurpose에 따라 dashboard 첫 카드 분기
// using / planning / stopped / sideeffect — 각각 다른 첫 경험
export function PurposeCard({ user, navigate }) {
  const purpose = user?.visitPurpose;
  if (!purpose) return null;

  if (purpose === 'using')      return <UsingCard user={user} navigate={navigate} />;
  if (purpose === 'planning')   return <PlanningCard user={user} navigate={navigate} />;
  if (purpose === 'stopped')    return <StoppedCard user={user} navigate={navigate} />;
  if (purpose === 'sideeffect') return <SideEffectCard user={user} navigate={navigate} />;
  return null;
}

/* ============================================================
   USING — 현 사용자: 이전 체중 변화 + 약 사용력 기록 onboarding
============================================================ */
function UsingCard({ user, navigate }) {
  const logs = Storage.getLogsByUser(user.id);
  const courses = Storage.getMedCoursesByUser(user.id);
  const hasWeightHistory = logs.length >= 3;
  const hasMedHistory = courses.length > 0;

  return (
    <div className="card border-2 border-brand-300 dark:border-brand-700/50 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900">
      <div className="flex items-start gap-3">
        <div className="text-3xl">💉</div>
        <div className="flex-1">
          <h2 className="font-bold text-ink-900 dark:text-slate-100 text-lg">
            지금까지의 사용 기록을 채워주세요
          </h2>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
            이전 체중 변화와 약 사용력을 기록할수록 본인 맞춤 통계가 더 정확해져요
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ActionTile
          done={hasWeightHistory}
          icon="⚖️"
          title="이전 체중 변화 기록"
          desc={hasWeightHistory ? `${logs.length}회 기록됨 ✓` : '그래프 드래그로 한 번에 여러 날짜 입력 가능'}
          onClick={() => navigate('records')}
        />
        <ActionTile
          done={hasMedHistory}
          icon="💊"
          title="약 사용력 기록"
          desc={hasMedHistory ? `${courses.length}개 코스 ✓` : '시작일·약·용량 입력. 격주·간헐 사용도 OK'}
          onClick={() => { try { sessionStorage.setItem('wimalog_records_tab', 'dose'); } catch {} navigate('records'); }}
        />
      </div>

      <p className="mt-3 text-[11px] text-ink-500 dark:text-slate-500 leading-relaxed">
        💡 이전 체중 측정값이 있다면 그래프를 좌클릭 드래그로 한 번에 그려 넣을 수 있어요.
        약 사용일이 정확할수록 비슷한 코호트와의 비교가 정밀해집니다.
      </p>
    </div>
  );
}

/* ============================================================
   PLANNING — 사용 예정자: 예상 체중변화 + 약 비교 + 가이드
============================================================ */
function PlanningCard({ user, navigate }) {
  return (
    <div className="space-y-3">
      <div className="card border-2 border-brand-300 dark:border-brand-700/50 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">🔮</div>
          <div className="flex-1">
            <h2 className="font-bold text-ink-900 dark:text-slate-100 text-lg">
              본인 조건의 예상 변화
            </h2>
            <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
              비슷한 키·체중의 사용자 코호트 기준 예측. 약·빈도를 바꿔 비교해 보세요.
            </p>
          </div>
        </div>
        <Simulator onSignup={() => {}} user={user} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <GuideTile icon="📅" title="첫 한 달 가이드" desc="주차별 시작·적응·증량"
                   onClick={() => navigate('guide/first-month')} />
        <GuideTile icon="⚖️" title="5개 약 한눈 비교" desc="가격·효과·부작용"
                   onClick={() => navigate('compare')} />
        <GuideTile icon="📋" title="시작 전 점검" desc="동반질환 + 의사 상담"
                   onClick={() => navigate('guide/first-month')} />
      </div>
    </div>
  );
}

/* ============================================================
   STOPPED — 중단 고려 중: 예상 변화 + 경험담 공유
============================================================ */
function StoppedCard({ user, navigate }) {
  const myCourse = useMemo(() => primaryCourse(Storage.getMedCoursesByUser(user.id)), [user.id]);
  const filter = useMemo(() => similarFilter(user, myCourse), [user, myCourse]);
  // 중단 후 회복 곡선 (localStorage fallback)
  const localRebound = useMemo(() => reboundCurve(filter, [4, 8, 12, 24, 48]), [filter]);
  // Supabase 8000+명 풀데이터 우선
  const [supaRebound, setSupaRebound] = useState(null);
  useEffect(() => {
    fetchReboundCurve(filter.medication, [4, 8, 12, 24, 48]).then(rows => {
      if (rows && rows.some(r => r.n > 0)) setSupaRebound(rows);
    }).catch(() => {});
  }, [filter.medication]);
  const rebound = supaRebound ? supaRebound.map(r => ({ week: r.week, n: r.n, avgRegain: r.avgGainPct })) : localRebound;
  // 중단/운동/식단 경험담
  const notes = useMemo(() => anonymousNotes(filter, 6), [filter]);

  const reboundAt24 = rebound?.find(r => r.week === 24);

  return (
    <div className="card border-2 border-amber-300 dark:border-amber-700/50 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">⏸️</div>
        <div className="flex-1">
          <h2 className="font-bold text-ink-900 dark:text-slate-100 text-lg">
            중단을 고려 중이세요?
          </h2>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
            비슷한 사용자의 중단 후 변화와 경험담을 모았어요. 끊는 방식과 운동·식단이 차이를 만듭니다.
          </p>
        </div>
      </div>

      {reboundAt24?.avgRegain != null && (
        <div className="rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/40 p-3 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold mb-1">
            중단 후 6개월 평균 변화
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-ink-900 dark:text-slate-100 tabular-nums">
              {reboundAt24.avgRegain > 0 ? '+' : ''}{reboundAt24.avgRegain.toFixed(1)} kg
            </div>
            <div className="text-xs text-ink-500 dark:text-slate-400">
              · 비슷한 사용자 {reboundAt24.n}명 기준
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <GuideTile icon="📉" title="중단 후 요요 관리" desc="6개월 회복률 + 운동 효과"
                   onClick={() => navigate('guide/after-stop')} />
        <GuideTile icon="🏃" title="유지 운동 패턴" desc="중단 후 체중 유지하는 운동량"
                   onClick={() => navigate('guide/after-stop')} />
      </div>

      {notes.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-ink-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            중단·식단·운동 경험담
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {notes.slice(0, 4).map((n, i) => (
              <div key={i} className="rounded-lg bg-ink-100/60 dark:bg-slate-800/60 px-3 py-2">
                <p className="text-xs text-ink-700 dark:text-slate-300 leading-snug">"{n.notes}"</p>
                <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1">
                  {n.gender === 'F' ? '여' : n.gender === 'M' ? '남' : ''}{n.ageGroup} · {n.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SIDEEFFECT — 부작용 경험자: 부작용 사례 비율 + 경험담
============================================================ */
function SideEffectCard({ user, navigate }) {
  const myCourse = useMemo(() => primaryCourse(Storage.getMedCoursesByUser(user.id)), [user.id]);
  const filter = useMemo(() => similarFilter(user, myCourse), [user, myCourse]);
  // localStorage 시드 기준 부작용율
  const localRates = useMemo(() => sideEffectRates(filter), [filter]);
  // Supabase 풀데이터 (8000+명) 우선
  const [supaRates, setSupaRates] = useState(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchSideEffectRates(filter.medication).then(rows => {
      if (rows?.length) setSupaRates(rows);
    });
  }, [filter.medication]);
  const rates = supaRates || localRates;

  const top4 = (rates || [])
    .map(r => ({ ...r, label: SIDE_EFFECTS.find(s => s.id === r.id)?.label || r.id }))
    .filter(r => r.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4);

  const notes = useMemo(() => anonymousNotes(filter, 6), [filter]);
  const sideEffectNotes = notes.filter(n => /부작용|메스|구토|두통|어지러|피로|변비|설사/.test(n.notes)).slice(0, 4);

  return (
    <div className="card border-2 border-rose-300 dark:border-rose-700/50 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">⚠️</div>
        <div className="flex-1">
          <h2 className="font-bold text-ink-900 dark:text-slate-100 text-lg">
            본인 조건의 부작용 비율
          </h2>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
            비슷한 사용자에서 가장 흔한 부작용과 실제 경험담입니다.
            {supaRates && <span> · 8,000명+ 코호트 기준</span>}
          </p>
        </div>
      </div>

      {top4.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {top4.map(s => (
            <div key={s.id} className="rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/40 p-2.5 text-center">
              <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                {Math.round(s.rate * 100)}%
              </div>
              <div className="text-[11px] font-semibold text-ink-700 dark:text-slate-300 mt-0.5">
                {s.label}
              </div>
              {s.n && <div className="text-[10px] text-ink-500 dark:text-slate-500">n={s.n}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <GuideTile icon="🩺" title="부작용 대처 가이드" desc="언제 의사 상담이 필요한가"
                   onClick={() => navigate('info')} />
        <GuideTile icon="📊" title="약별 부작용 비교" desc="5개 약의 부작용 차이"
                   onClick={() => navigate('compare')} />
      </div>

      {sideEffectNotes.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-ink-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            부작용 경험담
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sideEffectNotes.map((n, i) => (
              <div key={i} className="rounded-lg bg-ink-100/60 dark:bg-slate-800/60 px-3 py-2">
                <p className="text-xs text-ink-700 dark:text-slate-300 leading-snug">"{n.notes}"</p>
                <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1">
                  {n.gender === 'F' ? '여' : n.gender === 'M' ? '남' : ''}{n.ageGroup} · {n.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   공통 작은 컴포넌트
============================================================ */
function ActionTile({ done, icon, title, desc, onClick }) {
  return (
    <button onClick={onClick}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition
                        ${done
                          ? 'border-brand-300 dark:border-brand-700 bg-brand-50/60 dark:bg-brand-900/30'
                          : 'border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300'}`}>
      <span className="text-xl flex-shrink-0">{done ? '✅' : icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold text-sm ${done ? 'text-brand-700 dark:text-brand-300' : 'text-ink-900 dark:text-slate-100'}`}>
          {title}
        </div>
        <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">{desc}</div>
      </div>
    </button>
  );
}

function GuideTile({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick}
            className="flex items-start gap-2.5 p-3 rounded-xl border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300 hover:shadow-card transition text-left">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-ink-900 dark:text-slate-100">{title}</div>
        <div className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">{desc}</div>
      </div>
    </button>
  );
}
