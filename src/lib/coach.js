// 위마로그 코치 엔진 — 진척도 평가 + 정체기 감지 + 다음 액션
// "당신은 지금 X 상태입니다, Y 하세요"
import { Storage } from './storage.js';
import { snapshotAvgLossCurve } from './snapshot.js';
import { MED_BY_ID } from './constants.js';

const DAY_MS = 86400000;

// ============================================================
// 1) 진척도 평가 — 본인 N주차 vs 코호트 평균
// ============================================================
export function analyzeProgress(user) {
  if (!user) return { stage: 'no-user' };
  const logs = Storage.getLogsByUser(user.id);
  if (logs.length < 2) return { stage: 'too-early', logsCount: logs.length };

  const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const firstLog = sortedLogs[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];
  const startWeight = user.startWeight || firstLog.weight;
  const currentWeight = lastLog.weight;
  const lossKg = startWeight - currentWeight;
  const lossPct = startWeight > 0 ? (lossKg / startWeight) * 100 : 0;

  // 활성 약 코스 — 없으면 가장 최근
  const courses = Storage.getMedCoursesByUser(user.id);
  const activeCourse = courses.find(c => !c.endDate) || courses[courses.length - 1];
  if (!activeCourse) {
    return {
      stage: 'no-medication',
      lossKg, lossPct, startWeight, currentWeight,
      logsCount: logs.length,
    };
  }

  const weeksOnMed = Math.max(1, Math.floor((Date.now() - new Date(activeCourse.startDate).getTime()) / (7 * DAY_MS)));

  // 코호트 평균 — 본인 진행 주차에 가장 가까운 시점
  const cohortRows = snapshotAvgLossCurve(activeCourse.medication, [4, 8, 12, 16, 24, 36, 48, 52]);
  let cohortPct = null;
  let cohortWeek = null;
  let cohortN = null;
  if (cohortRows && cohortRows.length > 0) {
    const closest = cohortRows.reduce((best, r) => {
      if (r.avg == null) return best;
      if (!best) return r;
      return Math.abs(r.week - weeksOnMed) < Math.abs(best.week - weeksOnMed) ? r : best;
    }, null);
    if (closest) {
      cohortPct = closest.avg;
      cohortWeek = closest.week;
      cohortN = closest.n;
    }
  }

  // 페이스 판정
  let pace = 'unknown';
  let paceRatio = null;
  if (cohortPct != null && Math.abs(cohortPct) > 0.5) {
    paceRatio = lossPct / cohortPct;
    if (paceRatio >= 1.15) pace = 'fast';
    else if (paceRatio >= 0.85) pace = 'normal';
    else pace = 'slow';
  }

  // 시점별 phase
  let phase;
  if (weeksOnMed <= 4) phase = 'adapting';        // 적응기
  else if (weeksOnMed <= 16) phase = 'accelerating'; // 가속기
  else if (weeksOnMed <= 36) phase = 'steady';      // 안정기
  else phase = 'late';                              // 후기 (유지/중단 결정)

  return {
    stage: 'on-medication',
    weeksOnMed,
    startWeight, currentWeight, lossKg, lossPct,
    cohortPct, cohortWeek, cohortN, pace, paceRatio,
    phase,
    medication: activeCourse.medication,
    medLabel: MED_BY_ID[activeCourse.medication]?.label.replace(/\s*\(.+\)/, '') || activeCourse.medication,
    logsCount: logs.length,
  };
}

// ============================================================
// 2) 정체기 감지 — 최근 3주(21일) 체중 변화 max-min < 0.5kg
// ============================================================
export function detectPlateau(user) {
  if (!user) return { plateau: false };
  const logs = Storage.getLogsByUser(user.id);
  if (logs.length < 4) return { plateau: false, reason: 'insufficient-data' };

  const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const cutoff21 = Date.now() - 21 * DAY_MS;
  const recent3w = sortedLogs.filter(l => Date.parse(l.date) >= cutoff21);
  if (recent3w.length < 3) return { plateau: false, reason: 'insufficient-recent-logs' };

  const weights = recent3w.map(l => l.weight);
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  const range = max - min;

  if (range > 0.5) return { plateau: false, range, recentCount: recent3w.length };

  // 정체 — 원인 후보 분석
  const causes = [];

  // 1. 운동 패턴 비교 (최근 3주 vs 직전 3주)
  const ex = Storage.getExercisesByUser(user.id);
  const cutoff42 = Date.now() - 42 * DAY_MS;
  const recentEx = ex.filter(e => Date.parse(e.date) >= cutoff21);
  const prevEx = ex.filter(e => {
    const t = Date.parse(e.date);
    return t >= cutoff42 && t < cutoff21;
  });
  const recentExMin = recentEx.reduce((s, e) => s + (e.durationMin || 0), 0);
  const prevExMin = prevEx.reduce((s, e) => s + (e.durationMin || 0), 0);

  if (prevExMin > 60 && recentExMin < prevExMin * 0.5) {
    const reductionPct = Math.round((1 - recentExMin / prevExMin) * 100);
    causes.push({
      type: 'exercise',
      icon: '🏃',
      label: '운동 시간 감소',
      detail: `직전 3주 ${prevExMin}분 → 최근 3주 ${recentExMin}분 (${reductionPct}% 감소)`,
      action: '주 3회 30분 이상 운동 재시작',
    });
  } else if (recentExMin < 60 && prevExMin < 60) {
    causes.push({
      type: 'exercise',
      icon: '🏃',
      label: '운동량 부족',
      detail: `최근 3주 ${recentExMin}분 — 권장 270분(주 90분) 미달`,
      action: '걷기 30분/일부터 시작',
    });
  }

  // 2. 약 빈도 점검
  const doses = Storage.getDosesByUser(user.id);
  const recentDoses = doses.filter(d => Date.parse(d.date) >= cutoff21);
  const courses = Storage.getMedCoursesByUser(user.id);
  const activeCourse = courses.find(c => !c.endDate);
  if (activeCourse) {
    const expectedDoses = activeCourse.frequency === 'weekly' ? 3
      : activeCourse.frequency === 'biweekly' ? 1
      : activeCourse.frequency === 'occasional' ? 1
      : activeCourse.frequency === 'intro' ? 3
      : 3;
    if (recentDoses.length === 0) {
      causes.push({
        type: 'dose',
        icon: '💉',
        label: '최근 3주 투약 기록 없음',
        detail: '주사를 빼먹었거나 기록만 빠뜨렸을 수 있음',
        action: '투약 일정 점검. 빠뜨린 경우 다음 주사일 정상 진행',
      });
    } else if (recentDoses.length < expectedDoses * 0.5) {
      causes.push({
        type: 'dose',
        icon: '💉',
        label: '투약 빈도 낮음',
        detail: `최근 3주 ${recentDoses.length}회 (예상 ${expectedDoses}회)`,
        action: '주사일 빼먹지 않도록 알림 설정',
      });
    }
  }

  // 3. 식단 단백질
  const diets = Storage.getDietsByUser(user.id);
  const recentDiets = diets.filter(d => Date.parse(d.date) >= cutoff21);
  if (recentDiets.length >= 5) {
    const proteinValues = recentDiets.map(d => d.proteinG).filter(p => p > 0);
    if (proteinValues.length >= 3) {
      const avgProtein = proteinValues.reduce((s, p) => s + p, 0) / proteinValues.length;
      // 권장 체중당 1.2g/일, 한 끼 평균 30-40g
      const targetPerMeal = Math.max(25, Math.round((user.startWeight || 70) * 1.2 / 3));
      if (avgProtein < targetPerMeal * 0.7) {
        causes.push({
          type: 'diet',
          icon: '🍽️',
          label: '단백질 섭취 부족 가능성',
          detail: `최근 식단 평균 단백질 ${avgProtein.toFixed(0)}g/끼 (권장 ${targetPerMeal}g/끼)`,
          action: '닭가슴살·생선·계란·두부 등 끼니마다 보강',
        });
      }
    }
  }

  // 원인 못 찾으면 자연 정체기로 가정
  if (causes.length === 0) {
    causes.push({
      type: 'natural',
      icon: '⏳',
      label: '자연 정체기 가능성',
      detail: 'GLP-1 사용자 60% 이상이 3-6개월 사이 정체 경험 — 보통 1-2개월 내 자연 회복',
      action: '단백질·운동 의식적 강화 + 2-4주 더 관찰. 6주 더 정체 시 의사와 용량 상의',
    });
  }

  return {
    plateau: true,
    range, recentCount: recent3w.length,
    causes,
  };
}

// ============================================================
// 3) 주간 요약 — 이번 주 (최근 7일) 활동
// ============================================================
export function weeklySummary(user) {
  if (!user) return null;
  const cutoff7 = Date.now() - 7 * DAY_MS;
  const cutoff14 = Date.now() - 14 * DAY_MS;

  const logs = Storage.getLogsByUser(user.id);
  const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const recentLogs = sortedLogs.filter(l => Date.parse(l.date) >= cutoff7);
  const prevLogs = sortedLogs.filter(l => {
    const t = Date.parse(l.date);
    return t >= cutoff14 && t < cutoff7;
  });

  const lastWeight = recentLogs[recentLogs.length - 1]?.weight ?? null;
  const firstWeight = recentLogs[0]?.weight ?? null;
  const prevLastWeight = prevLogs[prevLogs.length - 1]?.weight ?? null;
  // 이번 주 변화 = 최근 - (직전 주 마지막 또는 이번 주 첫 logs)
  let weeklyDelta = null;
  if (lastWeight != null && prevLastWeight != null) weeklyDelta = lastWeight - prevLastWeight;
  else if (lastWeight != null && firstWeight != null && recentLogs.length >= 2) weeklyDelta = lastWeight - firstWeight;

  const ex = Storage.getExercisesByUser(user.id);
  const recentEx = ex.filter(e => Date.parse(e.date) >= cutoff7);
  const exMin = recentEx.reduce((s, e) => s + (e.durationMin || 0), 0);

  const diets = Storage.getDietsByUser(user.id);
  const recentDiets = diets.filter(d => Date.parse(d.date) >= cutoff7);

  const sideEffectEntries = recentLogs.reduce((s, l) => {
    const se = l.sideEffects || {};
    return s + Object.values(se).filter(v => v).length;
  }, 0);

  return {
    weeklyDelta,
    weeklyLogCount: recentLogs.length,
    exerciseMin: exMin,
    exerciseSessions: recentEx.length,
    dietCount: recentDiets.length,
    sideEffectCount: sideEffectEntries,
  };
}

// ============================================================
// 4) 다음 액션 — 진척도 + 정체 + 입력 패턴 → 권장 1-3개
// ============================================================
export function nextActions({ progress, plateau, summary }) {
  const actions = [];

  // 정체기면 cause 기반 액션 (high priority)
  if (plateau?.plateau) {
    plateau.causes.slice(0, 2).forEach(c => {
      actions.push({
        type: 'plateau',
        icon: c.icon,
        title: c.label,
        action: c.action,
        priority: 'high',
      });
    });
  }

  // 페이스 기반
  if (progress?.stage === 'on-medication') {
    if (progress.pace === 'slow') {
      const slowerPct = progress.paceRatio != null
        ? Math.round((1 - progress.paceRatio) * 100)
        : null;
      actions.push({
        type: 'pace-slow',
        icon: '🐢',
        title: slowerPct ? `코호트 평균보다 ${slowerPct}% 느린 페이스` : '코호트 평균보다 느린 페이스',
        action: '운동·식이 점검 → 4주 더 관찰. 변화 없으면 의사와 용량 조정 상의',
        priority: 'medium',
      });
    } else if (progress.pace === 'fast') {
      actions.push({
        type: 'pace-fast',
        icon: '🚀',
        title: '코호트 평균보다 빠른 페이스',
        action: '근손실·탈수 주의 — 단백질 1.5g/체중kg/일 + 수분 충분히',
        priority: 'low',
      });
    } else if (progress.pace === 'normal' && !plateau?.plateau) {
      actions.push({
        type: 'pace-normal',
        icon: '✨',
        title: '코호트 평균 페이스로 진행 중',
        action: '현재 패턴 유지. 다음 주 체중·운동 기록 계속',
        priority: 'low',
      });
    }
  }

  // 입력 권장
  if (summary?.weeklyLogCount === 0 && progress?.stage === 'on-medication') {
    actions.push({
      type: 'input-weight',
      icon: '⚖️',
      title: '이번 주 체중 기록 0회',
      action: '주 1회라도 체중 입력해야 트렌드 분석 가능',
      priority: 'high',
    });
  }
  if (summary?.exerciseMin < 60 && summary?.weeklyLogCount > 0 && progress?.stage === 'on-medication') {
    actions.push({
      type: 'input-exercise',
      icon: '🏃',
      title: '이번 주 운동 60분 미만',
      action: '주 90분 이상 운동 사용자는 감량 유지율이 50% 이상 높음',
      priority: 'medium',
    });
  }

  // 적응기 부작용 안내
  if (progress?.phase === 'adapting' && summary?.sideEffectCount === 0) {
    actions.push({
      type: 'side-effect-input',
      icon: '⚠️',
      title: '적응기 부작용 기록 권장',
      action: '오심·구토·변비 등 — 기록 → 시점 평균과 비교 가능',
      priority: 'low',
    });
  }

  return actions.slice(0, 3);  // 최대 3개
}

// ============================================================
// 통합 — 전체 코치 분석 결과 한 번에
// ============================================================
export function fullCoachAnalysis(user) {
  const progress = analyzeProgress(user);
  const plateau = detectPlateau(user);
  const summary = weeklySummary(user);
  const actions = nextActions({ progress, plateau, summary });
  return { progress, plateau, summary, actions };
}

// ============================================================
// 헤드라인 — "당신은 지금 X 상태입니다" 한 줄
// ============================================================
export function coachHeadline({ progress, plateau }) {
  if (!progress || progress.stage === 'no-user') return '코치 데이터 없음';
  if (progress.stage === 'too-early') {
    return progress.logsCount === 0
      ? '첫 체중 기록부터 시작해 보세요'
      : `2회+ 체중 기록 시 코치 분석 시작 (현재 ${progress.logsCount}회)`;
  }
  if (progress.stage === 'no-medication') {
    return '약 코스 등록 시 코치 분석 시작';
  }
  // 유지 단계 (late phase + plateau + 충분한 누적 감량) — "유지 단계 = 성공" 인정 (P52 페르소나)
  if (progress.phase === 'late' && plateau?.plateau && Math.abs(progress.lossPct) >= 8) {
    return '🌳 유지 단계 — 안정화 성공';
  }
  if (plateau?.plateau) {
    return `정체기 감지 — 최근 3주 ±${plateau.range.toFixed(1)}kg`;
  }
  if (progress.pace === 'fast') return '코호트 평균보다 빠른 페이스';
  if (progress.pace === 'slow') return '코호트 평균보다 느린 페이스';
  if (progress.pace === 'normal') return '코호트 평균 페이스로 진행 중';
  return `${progress.weeksOnMed}주차 진행 중`;
}

// 헤드라인 이모지
export function coachIcon({ progress, plateau }) {
  if (plateau?.plateau) return '⚠';
  if (progress?.pace === 'fast') return '🚀';
  if (progress?.pace === 'slow') return '🐢';
  if (progress?.pace === 'normal') return '✨';
  return '📋';
}

// 헤드라인 톤
export function coachTone({ progress, plateau }) {
  if (plateau?.plateau) return 'amber';
  if (progress?.pace === 'fast') return 'emerald';
  if (progress?.pace === 'slow') return 'amber';
  if (progress?.pace === 'normal') return 'brand';
  return 'brand';
}

// 상세 부 메시지 — 헤드라인 아래 한 문장
export function coachSubMessage({ progress, plateau }) {
  if (!progress || progress.stage !== 'on-medication') return '';
  const { weeksOnMed, lossPct, cohortPct, cohortWeek, medLabel, phase } = progress;
  // 유지 단계 메시지 (P52)
  if (phase === 'late' && plateau?.plateau && Math.abs(lossPct) >= 8) {
    return `${medLabel} ${weeksOnMed}주차 · 누적 -${Math.abs(lossPct).toFixed(1)}% · 더 안 빠지는 게 자연스러운 다음 단계입니다`;
  }
  if (cohortPct == null) {
    return `${medLabel} ${weeksOnMed}주차 · 누적 ${Math.abs(lossPct).toFixed(1)}%`;
  }
  return `${medLabel} ${weeksOnMed}주차 · 본인 -${Math.abs(lossPct).toFixed(1)}% vs ${cohortWeek}주차 코호트 평균 -${Math.abs(cohortPct).toFixed(1)}%`;
}
