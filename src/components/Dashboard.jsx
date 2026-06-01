import React, { useMemo, useState, useEffect } from 'react';
import { Storage } from '../lib/storage.js';
import {
  personalSummary, personalSummaryForCourse, primaryCourse,
  bmiCategory, weeksSinceStart,
} from '../lib/stats.js';
import { LineChart } from './Chart.jsx';
import { MED_BY_ID, SIDE_EFFECTS } from '../lib/constants.js';
import { QuickWeightCard, QuickDoseCard } from './QuickEntry.jsx';
import { useToast } from './Toast.jsx';
// RetentionCards 제거 — 스트릭·배지·주간요약·중단자 패널은 비즈니스 핵심 X.
import { WelcomeTour } from './WelcomeTour.jsx';
import { InputProgressCard } from './InputProgressCard.jsx';
import { NotificationBanner } from './NotificationBanner.jsx';
import { PurposeCard } from './PurposeCard.jsx';
import { UnlockedInsights } from './UnlockedInsights.jsx';
import { EmptyDashboard } from './EmptyDashboard.jsx';
import { MilestoneCard } from './MilestoneCard.jsx';
import { CostInsightCard } from './CostInsightCard.jsx';
import { CoachReport } from './CoachReport.jsx';
import { InitialSetup } from './InitialSetup.jsx';
import { ShareButtons } from './Share.jsx';
import { EarlyStageBanner } from './EarlyStageBanner.jsx';
import { SideEffectQuickWidget } from './SideEffectQuickWidget.jsx';
// MotivationBanner 제거 — 감성 카피, 비즈니스 핵심 X

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

  // 코호트 비교 계산 제거 — 코호트 테이블 카드를 Dashboard에서 제거(→ CoachReport + /stats)했으므로
  // 관련 dead 계산(similar/localCurve/snapCurve/cohortCurve/rebound 등) 일괄 정리.

  // 체중 차트
  const chartData = useMemo(() => logs.map(l => ({
    x: l.date, y: l.weight, label: shortDate(l.date),
  })), [logs]);

  // 최근 4회 기록에서 보고된 부작용 — SideEffectQuickWidget 조건부 노출용
  const recentSideEffects = useMemo(() => {
    if (!logs.length) return [];
    const recent = logs.slice(-4);
    const reported = new Set();
    recent.forEach(l => Object.entries(l.sideEffects || {}).forEach(([k, v]) => v && reported.add(k)));
    return SIDE_EFFECTS.filter(s => reported.has(s.id));
  }, [logs]);

  const activeMeds = courses.filter(c => !c.endDate);
  const isDietOnly = courses.length === 0 && (exercises.length > 0 || diets.length > 0 || logs.length >= 3);

  // 약 시작 후 경과 주 — 부작용 위젯 조건부(초기 8주)용
  const weeksOnActiveMed = useMemo(() => {
    if (!current?.startDate) return 0;
    return Math.max(0, Math.floor((Date.now() - Date.parse(current.startDate)) / (7 * 86400000)));
  }, [current]);

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
  // 명시적 플래그 기반 — initialSetupComplete=true면 안 보임, false/null이면 보임.
  // - OAuth 신규 가입: syncOAuthUser가 false 부여 → 노출 ✓
  // - InitialSetup 통과: true로 업데이트 → 안 노출 ✓
  // - QuickSignup 가입: true 부여 (키·체중·목적 받았으므로) → 안 노출 ✓
  // - 옛 user (플래그 없음): startWeight·logs 있으면 통과 간주 (legacy fallback)
  const needsInitialSetup =
    liveUser.initialSetupComplete === false ||
    (liveUser.initialSetupComplete == null && !liveUser.startWeight && logs.length === 0);
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => navigate('records')} className="btn-secondary !py-1.5 !px-3 text-xs">
            상세 기록 →
          </button>
          {/* PDF·공유는 아이콘만 — 매일 쓰는 버튼이 아니므로 시각 비중 최소화 (Dashboard 다이어트) */}
          <button onClick={() => navigate('doctor-report')}
                  title="진료용 12주 PDF 리포트"
                  aria-label="진료용 PDF"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base text-ink-600 dark:text-slate-400 hover:bg-ink-100 dark:hover:bg-slate-800 transition">
            📄
          </button>
          <DashboardShareButton user={liveUser} iconOnly />
        </div>
      </div>

      {/* 🎯 코치 리포트 — 최상단 hero. logs >= 2 + active course면 노출.
          신규(logs < 2) 또는 약 없음이면 MilestoneCard·PurposeCard로 자연 대체. */}
      <CoachReport user={liveUser} navigate={navigate} />

      {/* 마일스톤 카드 — 가입 후 경과 시점별 보상 (신규~2주 사용자 중심) */}
      {(() => {
        const ageDays = liveUser?.createdAt
          ? Math.floor((Date.now() - new Date(liveUser.createdAt).getTime()) / 86400000)
          : 0;
        // 코치 리포트가 의미있게 작동하는 시점 (14일 이상 + logs 2+)에는 마일스톤 숨김 (중복 방지)
        if (ageDays > 14 && logs.length >= 2) return null;
        return <MilestoneCard user={liveUser} navigate={navigate} />;
      })()}

      {/* visitPurpose 분기 — 사용 중이 아닌 사용자에게만 (사용 중은 CoachReport가 더 강함) */}
      {liveUser.visitPurpose !== 'using' && <PurposeCard user={liveUser} navigate={navigate} />}
      {/* needsProfile 안내 제거 — AccuracyCard(통계)에서 즉시 입력 가능 */}

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

      {/* 시작 용량 단계 위로 — 좌절 이탈 방지 (P42·P50) */}
      <EarlyStageBanner user={liveUser} />

      {/* 부작용 즉답 — 최근 부작용 보고했거나 초기 8주 사용자만 (확립된 사용자에겐 노이즈) */}
      {activeMeds.length > 0 && (recentSideEffects.length > 0 || weeksOnActiveMed <= 8) && (
        <SideEffectQuickWidget navigate={navigate} />
      )}

      {/* 신규 사용자(14일 미만) 입력 보상 — 단, Next-Action 투어가 떠 있으면 InputProgressCard는
          숨김 (둘 다 "이걸 입력하세요" 중복). 투어 닫거나 완료한 뒤에만 노출. */}
      {(() => {
        const ageDays = user?.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000) : 0;
        if (ageDays >= 14) return null;
        return (
          <>
            {!showTour && <InputProgressCard user={user} navigate={navigate} />}
            <NotificationBanner user={user} />
          </>
        );
      })()}

      {/* 건강지표 입력 시 자동 unlock — 항상 노출 (건강지표 입력자에만 보임) */}
      <UnlockedInsights user={user} />

      {/* ===== 내 진행 — 누적 감량 + 미니 stat + 체중 차트 1카드 통합 (Dashboard 다이어트) =====
          기존 Summary 4카드 + 체중차트 + 코호트 테이블 카드가 같은 질문을 반복하던 걸 합침.
          코호트 페이스는 CoachReport가 이미 보여주므로 여기선 "전체 통계 →" link만. */}
      {summary ? (
        <div className="card !p-5 sm:!p-6 border-2 border-brand-200 dark:border-brand-800/40 bg-gradient-to-br from-brand-50/60 to-white dark:from-brand-900/15 dark:to-slate-900">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-ink-500 dark:text-slate-400 font-medium">
                {current ? '현재 약 누적 감량' : '시작 대비 감량'}
              </div>
              <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                <div className={`text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight ${summary.lossKg > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {summary.lossKg > 0 ? '−' : '+'}{Math.abs(summary.lossKg).toFixed(1)}
                  <span className="text-xl ml-1">kg</span>
                </div>
                <div className="text-sm text-ink-500 dark:text-slate-400 tabular-nums">
                  ({Math.abs(summary.lossPct).toFixed(1)}%)
                </div>
              </div>
            </div>
            <button onClick={() => navigate('stats')} className="btn-secondary !py-1.5 !px-3 text-xs flex-shrink-0">
              코호트 비교 →
            </button>
          </div>

          {/* 미니 stat 3 — thin row */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="현재 BMI" value={summary.curBmi?.toFixed(1) ?? '—'} sub={summary.curBmi ? bmiCategory(summary.curBmi) : ''} />
            <MiniStat label="목표까지" value={summary.targetRemaining > 0 ? `${summary.targetRemaining.toFixed(1)}kg` : '도달 🎉'} sub={`목표 ${user.targetWeight}kg`} />
            <MiniStat label="기록" value={`${logs.length}회`} sub={`${summary.weeks}주차`} />
          </div>

          {/* 체중 차트 — 같은 카드 안에 시각 증거 */}
          <div className="mt-4 pt-4 border-t border-ink-100 dark:border-slate-800">
            <LineChart data={chartData} target={user.targetWeight} height={220} />
            <p className="text-[10px] text-ink-400 dark:text-slate-600 text-center mt-1">
              시작 {user.startWeight}kg → 목표 {user.targetWeight}kg
            </p>
          </div>
        </div>
      ) : (
        <div className="card text-center py-10">
          <div className="empty-illust">📝</div>
          <div className="text-ink-700 dark:text-slate-300 font-semibold">아직 체중 기록이 없습니다</div>
          <div className="text-sm text-ink-500 dark:text-slate-400 mt-1">위의 빠른 기록 카드에서 첫 체중을 입력해 보세요</div>
        </div>
      )}

      {/* 현재 사용 중인 약 — 1줄 compact */}
      {activeMeds.length > 0 && (
        <div className="card !py-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold text-ink-900 dark:text-slate-100">진행 중인 약</h2>
            <button onClick={() => navigate('meds')} className="btn-ghost text-xs">관리 →</button>
          </div>
          <div className="space-y-1.5">
            {activeMeds.map(c => {
              const cDoses = doses.filter(d => d.courseId === c.id);
              const lastDose = cDoses[cDoses.length - 1];
              const weeks = weeksSinceStart(new Date(), c.startDate);
              return (
                <div key={c.id} className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-ink-900 dark:text-slate-100">{MED_BY_ID[c.medication]?.label.replace(/\s*\(.+\)/, '')}</span>
                  <span className="text-xs text-ink-500 dark:text-slate-400 tabular-nums">
                    {weeks}주차 · {cDoses.length}회{lastDose && <> · {lastDose.dose}</>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 코호트 비교 테이블 카드 제거 — CoachReport가 본인 vs 코호트 페이스를 이미 보여줌.
          상세 테이블은 /stats. 위 '내 진행' 카드의 "코호트 비교 →" link로 이동.
          stallAlert 카드 제거 — CoachReport 정체기 panel 중복.
          SideEffectInsightWidget 제거 — /stats로 이동, Dashboard 노이즈 감소. */}

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

      {/* 정체기 감지 카드 제거 — CoachReport 정체기 panel이 이미 처리.
          부작용 인사이트(SideEffectInsightWidget) 제거 — /stats로 이동, Dashboard 노이즈 감소. */}

      {/* 누적 약값 분석 (1달+) — 비용민감 사용자에게 가치, 조건부 노출이라 유지 */}
      <CostInsightCard user={user} navigate={navigate} />
    </div>
  );
}

function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Dashboard 상단 공유 버튼 — 클릭 시 popover로 ShareButtons 노출 (P15 페르소나)
function DashboardShareButton({ user, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
              aria-label="공유"
              className={iconOnly
                ? 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-base text-ink-600 dark:text-slate-400 hover:bg-ink-100 dark:hover:bg-slate-800 transition'
                : 'inline-flex items-center gap-1 !py-1.5 !px-3 text-xs rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 font-semibold transition border border-emerald-200 dark:border-emerald-800/40'}>
        {iconOnly ? '📤' : '📤 공유'}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-4 animate-slideUp">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-bold text-ink-900 dark:text-slate-100">위마로그 공유하기</div>
              <button onClick={() => setOpen(false)} className="btn-ghost !p-1.5 text-base">✕</button>
            </div>
            <ShareButtons
              title="위마로그 — 위고비·마운자로 리얼데이터"
              text={`${user.nickname || '나'}님이 추천 — 실사용자 익명 데이터 기반 GLP-1 체중 감량 예측`}
              url="https://wimalog.kr/" />
          </div>
        </div>
      )}
    </div>
  );
}

// '내 진행' 카드 안의 thin stat — 큰 카드 대신 한 줄로 압축 (Dashboard 다이어트)
function MiniStat({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white/70 dark:bg-slate-800/50 py-2 px-1">
      <div className="text-[10px] text-ink-500 dark:text-slate-400">{label}</div>
      <div className="text-base font-bold tabular-nums text-ink-900 dark:text-slate-100 mt-0.5 leading-none">{value}</div>
      {sub && <div className="text-[9px] text-ink-400 dark:text-slate-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
