import React, { useMemo, useState, useEffect } from 'react';
import { Storage } from '../lib/storage.js';
import {
  personalSummary, personalSummaryForCourse, primaryCourse,
  similarFilter, avgLossCurve, cohortSize, bmiCategory, weeksSinceStart,
  reboundCurve, reboundByExercise,
} from '../lib/stats.js';
import { LineChart } from './Chart.jsx';
import { MED_BY_ID, SIDE_EFFECTS } from '../lib/constants.js';
import { QuickWeightCard, QuickDoseCard } from './QuickEntry.jsx';
import { PremiumBadge } from './Paywall.jsx';
import { useToast } from './Toast.jsx';
import { StreakCard, WeeklySummaryCard, BadgesRow, DiscontinuerPanel } from './RetentionCards.jsx';
import { WelcomeTour } from './WelcomeTour.jsx';
import { GoalWidget } from './GoalWidget.jsx';
import { InputProgressCard } from './InputProgressCard.jsx';
import { NotificationBanner } from './NotificationBanner.jsx';
import { PurposeCard } from './PurposeCard.jsx';
import { UnlockedInsights } from './UnlockedInsights.jsx';
import { EmptyDashboard } from './EmptyDashboard.jsx';
import { InitialSetup } from './InitialSetup.jsx';
import { MotivationBanner } from './MotivationBanner.jsx';

const NEXT_ACTION_DISMISSED_KEY = 'gl_nextaction_dismissed';

export function Dashboard({ user, navigate }) {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const toast = useToast();

  const logs      = useMemo(() => Storage.getLogsByUser(user.id), [user.id, version]);
  const courses   = useMemo(() => Storage.getMedCoursesByUser(user.id), [user.id, version]);
  const doses     = useMemo(() => Storage.getDosesByUser(user.id), [user.id, version]);
  const exercises = useMemo(() => Storage.getExercisesByUser(user.id), [user.id, version]);
  const diets     = useMemo(() => Storage.getDietsByUser(user.id), [user.id, version]);

  const current   = useMemo(() => primaryCourse(courses), [courses]);
  const summary   = useMemo(() => current
    ? personalSummaryForCourse(user, logs, current)
    : personalSummary(user, logs), [user, logs, current]);

  // 비교 코호트
  const similar   = useMemo(() => similarFilter(user, current), [user, current]);
  const cohortN   = useMemo(() => cohortSize(similar), [similar]);
  const cohortCurve = useMemo(() => avgLossCurve(similar), [similar]);

  // 본인 코호트 기반 rebound 예상 (약 사용 중일 때만 노출)
  // similar 필터가 너무 좁으면 표본 부족 → 약제만 매칭하는 fallback 사용
  const reboundFilter = useMemo(() => {
    if (!current) return null;
    const tight = reboundCurve(similar, [24]);
    if (tight[0]?.n >= 3) return similar;
    // fallback: 약제만
    return { medication: current.medication };
  }, [current, similar]);
  const rebound = useMemo(() => reboundFilter ? reboundCurve(reboundFilter, [12, 24, 48]) : null, [reboundFilter]);
  const reboundEx = useMemo(() => reboundFilter ? reboundByExercise(reboundFilter, 24) : null, [reboundFilter]);

  // 체중 차트
  const chartData = useMemo(() => logs.map(l => ({
    x: l.date, y: l.weight, label: shortDate(l.date),
  })), [logs]);

  const thisWeek = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const start = oneWeekAgo.toISOString().slice(0, 10);
    return {
      exMinutes: exercises.filter(e => e.date >= start).reduce((s, e) => s + (e.durationMin || 0), 0),
      exSessions: exercises.filter(e => e.date >= start).length,
      mealCount: diets.filter(d => d.date >= start).length,
      doseCount: doses.filter(d => d.date >= start).length,
    };
  }, [exercises, diets, doses]);

  const recentSideEffects = useMemo(() => {
    if (!logs.length) return [];
    const recent = logs.slice(-4);
    const reported = new Set();
    recent.forEach(l => Object.entries(l.sideEffects || {}).forEach(([k, v]) => v && reported.add(k)));
    return SIDE_EFFECTS.filter(s => reported.has(s.id));
  }, [logs]);

  const activeMeds = courses.filter(c => !c.endDate);
  const isDietOnly = courses.length === 0 && (exercises.length > 0 || diets.length > 0 || logs.length >= 3);

  // 정체기 감지: 최근 4주 동안 체중 변화 ±0.3kg 미만
  const stallAlert = useMemo(() => {
    if (logs.length < 4) return null;
    const recent4 = logs.slice(-4);
    const min = Math.min(...recent4.map(l => l.weight));
    const max = Math.max(...recent4.map(l => l.weight));
    if (max - min < 0.4 && current && !current.endDate) {
      return { range: max - min, weeks: recent4.length };
    }
    return null;
  }, [logs, current]);

  // Next-Action 가이드 (한 번 dismiss하면 안 보임)
  const [dismissedTour, setDismissedTour] = useState(() => !!localStorage.getItem(NEXT_ACTION_DISMISSED_KEY));
  const tourTasks = useMemo(() => [
    {
      id: 'med', icon: '💊', title: '약 등록하기', desc: '위고비·마운자로 등을 시작했나요? 약과 투약 가격을 기록해 보세요.',
      done: courses.length > 0,
      cta: '약 관리로', onClick: () => navigate('meds'),
    },
    {
      id: 'weight', icon: '⚖️', title: '오늘 체중 기록', desc: '대시보드 위 빠른 기록 카드에서 1탭으로 가능합니다.',
      done: logs.length >= 2,  // 온보딩에서 1개는 자동 생성
      cta: null,
    },
    {
      id: 'exercise', icon: '🏃', title: '오늘 운동 기록', desc: '걷기 30분이라도 좋아요. 운동은 중단 후 요요 방지의 핵심입니다.',
      done: exercises.length > 0,
      cta: '운동 기록', onClick: () => navigate('records'),
    },
    {
      id: 'stats', icon: '📊', title: '비슷한 사용자 통계 보기',
      desc: `같은 약·BMI·성별 코호트의 평균 감량률 + 약 중단 후 회복률까지 확인하세요.`,
      done: false,
      cta: '통계 보기', onClick: () => navigate('stats'),
    },
  ], [courses.length, logs.length, exercises.length, navigate]);

  const completed = tourTasks.filter(t => t.done).length;
  const showTour = !dismissedTour && completed < tourTasks.length;

  // user prop은 App.jsx에서 캐싱되므로 version dep으로 fresh fetch
  const liveUser = useMemo(() => Storage.getUser(user.id), [user.id, version]) || user;
  // OAuth 가입자는 profileIncomplete=true (height/startWeight 없음)
  const needsProfile = liveUser.profileIncomplete || !liveUser.height || !liveUser.startWeight;
  // 신규 가입자 — 체중 log 0 또는 방문 목적 미입력 → InitialSetup만 표시 (다른 위젯 모두 숨김)
  const needsInitialSetup = !liveUser.visitPurpose || logs.length === 0;
  if (needsInitialSetup) {
    return <InitialSetup user={liveUser} onDone={refresh} />;
  }

  return (
    <div className="space-y-6">
      <WelcomeTour user={liveUser} navigate={navigate} />

      {/* 짧은 인사말 — InitialSetup 완료 직후 사용자 맞이 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink-900 dark:text-slate-100 truncate">
            {liveUser.nickname}님, 안녕하세요 👋
          </h1>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
            {activeMeds.length > 0 ? (
              <>현재 약: {activeMeds.map(c => MED_BY_ID[c.medication]?.label.replace(/\s*\(.+\)/, '')).join(', ')}</>
            ) : courses.length > 0 ? (
              <>약 사용 중단 · 체중·운동·식단 기록만 진행 중</>
            ) : (
              <>약 미사용 · 체중·운동·식단만 기록 중</>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate('records')} className="btn-secondary !py-1.5 !px-3 text-xs">
            상세 기록 →
          </button>
        </div>
      </div>

      {/* 부드러운 격려 메시지 — 사용자 컨텍스트에 따라 분기 */}
      <MotivationBanner user={liveUser}
                        weeks={summary?.weeks}
                        hasStall={!!stallAlert} />

      {/* 1순위: visitPurpose 분기 — 입력한 단계에 따라 맞춤 첫 경험 */}
      <PurposeCard user={liveUser} navigate={navigate} />

      {/* 2순위: 키·성별·나이대 안내 (분기 본 후 보강 유도) — 작게 */}
      {needsProfile && (
        <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <b>키·성별·나이대</b> 추가 입력 → BMI 자동 계산 + 비슷한 코호트 매칭 정밀도 ↑
          </div>
          <button onClick={() => navigate('profile')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition">
            30초 추가 →
          </button>
        </div>
      )}

      {/* 데이터 0인 신규 가입자 — '지금 시작하면 좋은 것' 3개 액션 */}
      {logs.length === 0 && courses.length === 0 && (
        <EmptyDashboard user={user} navigate={navigate} />
      )}

      {/* Next-Action 가이드 (신규 가입자) */}
      {showTour && (
        <div className="card border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold text-ink-900 dark:text-slate-100">🎯 다음 할 일</div>
              <div className="text-xs text-ink-500 dark:text-slate-400">
                {completed}/{tourTasks.length} 완료 — 시작하면 통계가 점점 정확해져요
              </div>
            </div>
            <button onClick={() => {
              localStorage.setItem(NEXT_ACTION_DISMISSED_KEY, '1');
              setDismissedTour(true);
            }} className="btn-ghost !p-1 text-xs">닫기</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tourTasks.map(t => (
              <button key={t.id} onClick={t.onClick}
                      disabled={!t.onClick}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition
                                  ${t.done
                                    ? 'border-brand-300 dark:border-brand-700 bg-brand-50/60 dark:bg-brand-900/30'
                                    : 'border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300'}`}>
                <span className="text-xl flex-shrink-0">{t.done ? '✅' : t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold text-sm ${t.done ? 'text-brand-700 dark:text-brand-300 line-through' : 'text-ink-900 dark:text-slate-100'}`}>
                    {t.title}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-snug">{t.desc}</div>
                </div>
                {t.cta && !t.done && (
                  <span className="text-xs text-brand-700 dark:text-brand-400 font-semibold flex-shrink-0 self-center">→</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Entry */}
      <div className={`grid grid-cols-1 ${activeMeds.length > 0 ? 'sm:grid-cols-2' : ''} gap-4`}>
        <QuickWeightCard user={user} onSaved={(msg) => { refresh(); toast.success(msg || '체중 기록됨'); }} />
        {activeMeds.length > 0 && (
          <QuickDoseCard user={user}
                          onSaved={(msg) => { refresh(); toast.success(msg || '투약 기록됨'); }}
                          onOpenMeds={() => navigate('meds')} />
        )}
      </div>

      {/* 입력 보상 — 자세히 입력할수록 더 많은 데이터 잠금 해제 */}
      <InputProgressCard user={user} navigate={navigate} />

      {/* 건강지표 입력 시 자동 unlock되는 본인 vs 표준 비교 카드 */}
      <UnlockedInsights user={user} />

      {/* Notification banner (한 번만) */}
      <NotificationBanner user={user} />

      {/* Streak + Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StreakCard user={user} navigate={navigate} />
        <BadgesRow user={user} />
      </div>

      {/* 요약 카드 */}
      {summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label={current ? '현재 약 누적 감량' : '시작 대비 감량'}
            value={`${summary.lossKg >= 0 ? '-' : '+'}${Math.abs(summary.lossKg).toFixed(1)} kg`}
            sub={`${Math.abs(summary.lossPct).toFixed(1)}%`}
            highlight={summary.lossKg > 0}
          />
          <SummaryCard
            label="현재 BMI"
            value={summary.curBmi?.toFixed(1) ?? '—'}
            sub={summary.curBmi ? bmiCategory(summary.curBmi) : ''}
          />
          <SummaryCard
            label="목표까지"
            value={summary.targetRemaining > 0 ? `${summary.targetRemaining.toFixed(1)} kg` : '도달 🎉'}
            sub={`목표 ${user.targetWeight} kg`}
          />
          <SummaryCard
            label="기록"
            value={`${logs.length}회`}
            sub={`${summary.weeks}주차`}
          />
        </div>
      ) : (
        <div className="card text-center py-10">
          <div className="empty-illust">📝</div>
          <div className="text-ink-700 dark:text-slate-300 font-semibold">아직 체중 기록이 없습니다</div>
          <div className="text-sm text-ink-500 dark:text-slate-400 mt-1">위의 빠른 기록 카드에서 첫 체중을 입력해 보세요</div>
        </div>
      )}

      {/* 목표 예측 + 주간 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GoalWidget user={user} navigate={navigate} />
        <WeeklySummaryCard user={user} navigate={navigate} />
      </div>

      {/* 중단자 패널 */}
      <DiscontinuerPanel user={user} navigate={navigate} />

      {/* 이번 주 활동 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniTile icon="💊" label="이번 주 투약" value={`${thisWeek.doseCount}회`} onClick={() => navigate('records')} />
        <MiniTile icon="🏃" label="이번 주 운동" value={`${thisWeek.exMinutes}분`} sub={`${thisWeek.exSessions}회`} onClick={() => navigate('records')} />
        <MiniTile icon="🍽️" label="이번 주 식단" value={`${thisWeek.mealCount}건`} onClick={() => navigate('records')} />
        <MiniTile icon="💰" label="누적 약 비용" value={`${(doses.reduce((s, d) => s + (d.price || 0), 0)).toLocaleString()}원`} onClick={() => navigate('meds')} />
      </div>

      {/* 체중 차트 */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="section-title">체중 추이</h2>
            <p className="section-subtitle">시작 {user.startWeight} kg → 목표 {user.targetWeight} kg</p>
          </div>
        </div>
        <LineChart data={chartData} target={user.targetWeight} height={240} />
      </div>

      {/* 현재 사용 중인 약 */}
      {activeMeds.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-title">진행 중인 약 ({activeMeds.length})</h2>
            <button onClick={() => navigate('meds')} className="btn-ghost text-xs">관리 →</button>
          </div>
          <div className="space-y-2">
            {activeMeds.map(c => {
              const cDoses = doses.filter(d => d.courseId === c.id);
              const lastDose = cDoses[cDoses.length - 1];
              const weeks = weeksSinceStart(new Date(), c.startDate);
              return (
                <div key={c.id} className="flex justify-between items-center p-3 rounded-xl bg-brand-50/50 dark:bg-brand-900/20">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900 dark:text-slate-100">{MED_BY_ID[c.medication]?.label}</div>
                    <div className="text-xs text-ink-500 dark:text-slate-400">
                      {weeks}주차 · {cDoses.length}회 투약
                      {lastDose && <> · 최근 {lastDose.date} {lastDose.dose}</>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 비슷한 사용자 비교 */}
      <div className="card">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 className="section-title">나와 비슷한 사용자 비교</h2>
            <p className="section-subtitle">
              {current
                ? <>같은 약제·성별·비슷한 BMI 코호트와 비교</>
                : <>약 시작 후 비교가 활성화됩니다. 통계 페이지에서 자유롭게 둘러볼 수 있어요.</>}
            </p>
          </div>
          <button onClick={() => navigate('stats')} className="btn-secondary !py-2 !px-3 text-xs">
            전체 통계 →
          </button>
        </div>
        {current && cohortN > 0 ? (
          <CohortTable cohortCurve={cohortCurve} mine={summary} startWeight={summary?.startWeight ?? user.startWeight} />
        ) : (
          <button onClick={() => navigate('stats')} className="w-full text-sm text-brand-700 dark:text-brand-400 underline py-2">
            통계 페이지로 이동
          </button>
        )}
      </div>

      {/* 약 중단 후 예상 (rebound) — 약 사용 중일 때 핵심 */}
      {rebound && rebound.some(r => r.avgRegainRatio != null) && (
        <div className="card border border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-900/10 dark:to-slate-900">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h2 className="section-title">"약을 끊으면 어떻게 될까?"</h2>
              <p className="section-subtitle mt-0.5">
                비슷한 코호트가 약 중단 후 평균적으로 다시 찐 비율
              </p>
            </div>
            <button onClick={() => navigate('stats')} className="btn-ghost text-xs flex-shrink-0">자세히 →</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {rebound.map(r => (
              <div key={r.week} className="rounded-xl bg-white dark:bg-slate-800 p-3 text-center">
                <div className="text-xs text-ink-500 dark:text-slate-400">중단 후 {r.week}주</div>
                <div className="text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400 mt-1">
                  {r.avgRegainRatio != null ? `${Math.round(r.avgRegainRatio * 100)}%` : '—'}
                </div>
                <div className="text-[10px] text-ink-500 dark:text-slate-500">감량분 회복</div>
              </div>
            ))}
          </div>
          {reboundEx && reboundEx.active.n >= 2 && reboundEx.inactive.n >= 2 && reboundEx.active.avgRegainPct != null && reboundEx.inactive.avgRegainPct != null && (
            <div className="text-xs text-ink-700 dark:text-slate-300 mt-3 text-center">
              💪 같은 코호트 중 <b>운동 지속</b> 그룹은 회복률이{' '}
              <b className="text-brand-700 dark:text-brand-400">
                {Math.max(0, Math.round(reboundEx.inactive.avgRegainPct - reboundEx.active.avgRegainPct))}%p
              </b>{' '}낮습니다.
              <br />→ 지금부터 운동 습관을 만들면 요요를 크게 줄일 수 있어요.
            </div>
          )}
        </div>
      )}

      {/* 다이어트만 사용자 전용 안내 */}
      {isDietOnly && (
        <div className="card border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/15">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🥗</div>
            <div className="flex-1">
              <h2 className="section-title">약 없이 다이어트 중</h2>
              <p className="section-subtitle">기록 잘 하고 계세요. 약 없이도 의미있는 진척!</p>
            </div>
            <button onClick={() => navigate('guide/diet-only')} className="btn-ghost text-xs">가이드 →</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
              <div className="text-xs text-ink-500 dark:text-slate-400">체중 기록</div>
              <div className="text-lg font-bold text-ink-900 dark:text-slate-100">{logs.length}회</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
              <div className="text-xs text-ink-500 dark:text-slate-400">운동 기록</div>
              <div className="text-lg font-bold text-ink-900 dark:text-slate-100">{exercises.length}회</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-800 p-2">
              <div className="text-xs text-ink-500 dark:text-slate-400">식단 기록</div>
              <div className="text-lg font-bold text-ink-900 dark:text-slate-100">{diets.length}건</div>
            </div>
          </div>
          <button onClick={() => navigate('calc/bmr')} className="btn-secondary w-full mt-3 text-sm">
            🔥 칼로리 계산기 → 목표 칼로리 확인
          </button>
        </div>
      )}

      {/* 정체기 감지 */}
      {stallAlert && (
        <div className="card border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/15">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📉</div>
            <div className="flex-1">
              <h2 className="section-title">정체기 가능성</h2>
              <p className="text-sm text-ink-700 dark:text-slate-300 mt-1">
                최근 4번 체중 기록의 변동이 <b>{stallAlert.range.toFixed(1)} kg</b>밖에 안 됩니다.
                약 효과가 둔해지는 시점일 수 있어요.
              </p>
              <ul className="text-sm text-ink-700 dark:text-slate-300 mt-2 space-y-1 list-disc list-inside">
                <li>주당 운동 시간 늘리기 (이번 주 {thisWeek.exMinutes}분 → +50%)</li>
                <li>단백질 섭취 점검 — 근손실 방지</li>
                <li>의료진과 용량 조정 상의</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 최근 부작용 + 안전 */}
      {recentSideEffects.length > 0 && (
        <div className="card">
          <h2 className="section-title">최근 4주 보고한 증상</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentSideEffects.map(s => <span key={s.id} className="chip">{s.label}</span>)}
          </div>
          <p className="helptext">
            증상이 심하거나 장기간 지속되면 의료진과 상의해 주세요.
            <button onClick={() => navigate('info')} className="text-brand-600 dark:text-brand-400 underline ml-1">안전 정보 보기</button>
          </p>
        </div>
      )}
    </div>
  );
}

function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function SummaryCard({ label, value, sub, highlight }) {
  return (
    <div className="card !p-4">
      <div className="text-xs text-ink-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-0.5 ${highlight ? 'text-brand-600 dark:text-brand-400' : 'text-ink-900 dark:text-slate-100'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniTile({ icon, label, value, sub, onClick }) {
  return (
    <button onClick={onClick} className="card !p-3 text-left hover:shadow-cardHover transition">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="text-xs text-ink-500 dark:text-slate-400">{label}</div>
      </div>
      <div className="text-lg font-bold tabular-nums text-ink-900 dark:text-slate-100 mt-1">{value}</div>
      {sub && <div className="text-[10px] text-ink-500 dark:text-slate-500">{sub}</div>}
    </button>
  );
}

function CohortTable({ cohortCurve, mine, startWeight }) {
  const myWeeks = mine?.weeks ?? 0;
  const toKg = (pct) => pct != null && startWeight ? (startWeight * pct / 100) : null;
  const cohortMax = Math.max(...cohortCurve.map(c => c.n || 0), 1);
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-500 dark:text-slate-400">
            <th className="py-2 px-2 font-medium">주차</th>
            <th className="py-2 px-2 font-medium text-right">코호트 평균</th>
            <th className="py-2 px-2 font-medium text-right">중앙값</th>
            <th className="py-2 px-2 font-medium text-right" title="해당 주차까지 추적된 코호트 비율">추적률</th>
          </tr>
        </thead>
        <tbody>
          {cohortCurve.map(c => {
            const reached = myWeeks >= c.week;
            const avgKg = toKg(c.avg);
            const medianKg = toKg(c.median);
            const trackPct = Math.round((c.n / cohortMax) * 100);
            return (
              <tr key={c.week} className={`border-t border-ink-100 dark:border-slate-800 ${reached ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''}`}>
                <td className="py-2 px-2">
                  {c.week}주{reached && <span className="ml-1 text-[10px] text-brand-700 dark:text-brand-400">↑</span>}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {avgKg != null ? (
                    <>
                      <span className="text-ink-900 dark:text-slate-100 font-semibold">−{avgKg.toFixed(1)} kg</span>
                      <span className="text-ink-300 dark:text-slate-600 text-xs ml-1">({c.avg.toFixed(1)}%)</span>
                    </>
                  ) : '—'}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-ink-500 dark:text-slate-500">
                  {medianKg != null ? `−${medianKg.toFixed(1)} kg` : '—'}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-ink-500 dark:text-slate-500">{trackPct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {startWeight && (
        <p className="text-[10px] text-ink-500 dark:text-slate-500 mt-2 text-right">
          본인 시작 체중 {startWeight} kg 기준 환산
        </p>
      )}
    </div>
  );
}
