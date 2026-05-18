// 통계 계산. 모든 함수는 순수 함수이며, users/logs/medCourses/doses 등을 인자로 받습니다.
import { Storage } from './storage.js';
import { SIDE_EFFECTS, MED_BY_ID, DISCONTINUE_REASONS } from './constants.js';

export function bmi(weight, heightCm) {
  if (!weight || !heightCm) return null;
  return weight / ((heightCm / 100) ** 2);
}

export function bmiCategory(b) {
  if (b == null) return null;
  if (b < 18.5) return '저체중';
  if (b < 23)   return '정상';
  if (b < 25)   return '과체중';
  if (b < 30)   return '비만 1단계';
  if (b < 35)   return '비만 2단계';
  return '고도비만';
}

export function bookendLogs(logs) {
  if (!logs?.length) return { first: null, last: null };
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

export function weeksSinceStart(refDate, sinceDate) {
  if (!sinceDate) return 0;
  const ref = (refDate instanceof Date ? refDate : new Date()).getTime();
  const ms = ref - new Date(sinceDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
}

// 사용자의 가장 최근 활성 코스 (없으면 가장 최근 종료 코스)
export function primaryCourse(courses) {
  if (!courses?.length) return null;
  const active = courses.filter(c => !c.endDate);
  if (active.length) {
    return [...active].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  }
  return [...courses].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function loadAll() {
  const users = Storage.getUsers();
  const logs = Storage.getLogs();
  const courses = Storage.getMedCourses();
  const doses = Storage.getDoses();
  const exercises = Storage.getExercises();
  const diets = Storage.getDiets();
  const logsByUser = new Map();
  for (const l of logs) {
    if (!logsByUser.has(l.userId)) logsByUser.set(l.userId, []);
    logsByUser.get(l.userId).push(l);
  }
  const coursesByUser = new Map();
  for (const c of courses) {
    if (!coursesByUser.has(c.userId)) coursesByUser.set(c.userId, []);
    coursesByUser.get(c.userId).push(c);
  }
  const dosesByCourse = new Map();
  for (const d of doses) {
    if (!dosesByCourse.has(d.courseId)) dosesByCourse.set(d.courseId, []);
    dosesByCourse.get(d.courseId).push(d);
  }
  return { users, logs, courses, doses, exercises, diets, logsByUser, coursesByUser, dosesByCourse };
}

// 매칭: filter 객체로 코스 단위 검색. user는 코스 소유자.
// 코호트 단위 = "특정 약을 사용한 코스"
function matchesCourseFilter(course, user, filter) {
  if (filter.medication && filter.medication !== 'all' && course.medication !== filter.medication) return false;
  if (filter.gender && filter.gender !== 'all' && user.gender !== filter.gender) return false;
  if (filter.ageGroup && filter.ageGroup !== 'all' && user.ageGroup !== filter.ageGroup) return false;
  if (filter.hasCondition && !user.conditions?.[filter.hasCondition]) return false;
  if (filter.bmiRange) {
    const b = bmi(user.startWeight, user.height);
    const [lo, hi] = filter.bmiRange;
    if (b < lo || b >= hi) return false;
  }
  return true;
}

// 코스 시작 시점부터의 주차별 감량률: 코스 startDate 이후 logs에서, 코스 시점 weight 대비
function lossPctAtWeekForCourse(course, userLogs, user, targetWeek) {
  if (!userLogs?.length) return null;
  const sorted = [...userLogs].sort((a, b) => a.date.localeCompare(b.date));
  const start = new Date(course.startDate).getTime();
  const end = course.endDate ? new Date(course.endDate).getTime() : Date.now();
  // 시작점 기준 weight (코스 시작 ±2주 내 가장 가까운 로그) - 없으면 user.startWeight
  const startWeight = (() => {
    const within = sorted.filter(l => {
      const t = new Date(l.date).getTime();
      return Math.abs(t - start) <= 14 * 24 * 60 * 60 * 1000;
    });
    if (within.length) return within[0].weight;
    // fallback: 코스 시작 이전 가장 최근 log
    const before = sorted.filter(l => new Date(l.date).getTime() <= start).pop();
    return before?.weight ?? user.startWeight;
  })();
  if (!startWeight) return null;
  // targetWeek에 도달한 첫 로그
  const targetMs = start + targetWeek * 7 * 24 * 60 * 60 * 1000;
  if (targetMs > end) return null;
  const reached = sorted.find(l => new Date(l.date).getTime() >= targetMs);
  if (!reached) return null;
  return ((startWeight - reached.weight) / startWeight) * 100;
}

export function similarFilter(me, currentCourse) {
  if (!me) return {};
  const f = {
    gender: me.gender,
    ageGroup: me.ageGroup,
  };
  if (currentCourse) f.medication = currentCourse.medication;
  const b = bmi(me.startWeight, me.height);
  if (b) f.bmiRange = [Math.max(15, b - 3), Math.min(50, b + 3)];
  return f;
}

// 필터에 매칭되는 코스 + 소유자 정보
function matchedCourses(filter) {
  const { users, courses, logsByUser } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  return courses
    .map(c => ({ course: c, user: userById.get(c.userId), logs: logsByUser.get(c.userId) || [] }))
    .filter(x => x.user && matchesCourseFilter(x.course, x.user, filter));
}

export function cohortSize(filter) {
  return matchedCourses(filter).length;
}

export function avgLossCurve(filter, weeks = [1, 2, 4, 8, 12, 16, 24, 36, 48]) {
  const matched = matchedCourses(filter);
  return weeks.map(w => {
    const vals = [];
    for (const m of matched) {
      const v = lossPctAtWeekForCourse(m.course, m.logs, m.user, w);
      if (v != null) vals.push(v);
    }
    // 상위 25% (감량률 큰 순)
    const sortedDesc = [...vals].sort((a, b) => b - a);
    const topNCount = Math.max(1, Math.floor(sortedDesc.length / 4));
    const topVals = sortedDesc.slice(0, topNCount);
    const topAvg = topVals.length ? topVals.reduce((s, x) => s + x, 0) / topVals.length : null;
    return {
      week: w,
      n: vals.length,
      avg: vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null,
      median: vals.length ? median(vals) : null,
      p25: vals.length ? quantile(vals, 0.25) : null,
      p75: vals.length ? quantile(vals, 0.75) : null,
      top25Avg: topAvg,
    };
  });
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function quantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos), rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

// 부작용 발생률: 매칭된 코스의 시작~종료 구간 logs에서 한 번이라도 보고된 비율 (코스 단위)
export function sideEffectRates(filter) {
  const matched = matchedCourses(filter);
  const result = SIDE_EFFECTS.map(s => ({ id: s.id, label: s.label, count: 0 }));
  const idx = Object.fromEntries(result.map((r, i) => [r.id, i]));
  for (const m of matched) {
    const start = new Date(m.course.startDate).getTime();
    const end = m.course.endDate ? new Date(m.course.endDate).getTime() : Date.now();
    const reported = new Set();
    for (const l of m.logs) {
      const t = new Date(l.date).getTime();
      if (t < start || t > end) continue;
      for (const id of Object.keys(l.sideEffects || {})) {
        if (l.sideEffects[id]) reported.add(id);
      }
    }
    for (const id of reported) {
      if (idx[id] != null) result[idx[id]].count++;
    }
  }
  const n = matched.length;
  return result.map(r => ({ ...r, rate: n ? r.count / n : 0, n }));
}

export function discontinuationStats(filter) {
  const matched = matchedCourses(filter);
  const n = matched.length;
  const stopped = matched.filter(m => m.course.endDate);
  const reasonCounts = {};
  for (const m of stopped) {
    const r = m.course.discontinueReason || 'other';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  }
  return {
    n,
    discontinued: stopped.length,
    rate: n ? stopped.length / n : 0,
    reasons: DISCONTINUE_REASONS.map(r => ({
      id: r.id, label: r.label,
      count: reasonCounts[r.id] || 0,
      rate: stopped.length ? (reasonCounts[r.id] || 0) / stopped.length : 0,
    })),
  };
}

export function compareMedications(baseFilter, week = 12) {
  const meds = ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound'];
  return meds.map(medId => {
    const f = { ...baseFilter, medication: medId };
    const curve = avgLossCurve(f, [week]);
    const point = curve[0];
    return {
      id: medId,
      label: MED_BY_ID[medId]?.label || medId,
      n: point.n,
      avg: point.avg,
      median: point.median,
    };
  });
}

// 약제별 평균 가격 (지역별)
export function priceStats(filter) {
  const { doses, courses, users, dosesByCourse } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  // 매칭되는 코스의 dose만
  const matched = courses
    .filter(c => {
      const u = userById.get(c.userId);
      return u && matchesCourseFilter(c, u, filter);
    });
  const allDoses = [];
  for (const c of matched) {
    const ds = (dosesByCourse.get(c.id) || []).filter(d => d.price > 0);
    allDoses.push(...ds);
  }
  if (!allDoses.length) return { n: 0, avg: null, median: null, byRegion: [] };
  const prices = allDoses.map(d => d.price);
  const byRegion = {};
  for (const d of allDoses) {
    const r = d.region || '미기록';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(d.price);
  }
  const byRegionArr = Object.entries(byRegion)
    .map(([region, vals]) => ({
      region,
      n: vals.length,
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      median: median(vals),
    }))
    .filter(r => r.n >= 3)
    .sort((a, b) => a.avg - b.avg);
  return {
    n: allDoses.length,
    avg: prices.reduce((s, v) => s + v, 0) / prices.length,
    median: median(prices),
    byRegion: byRegionArr,
  };
}

// 코호트 운동 시간 분포 (히스토그램)
export function exerciseDistribution(filter) {
  const { users, courses, exercises } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  const cohortUsers = new Set(
    courses.filter(c => {
      const u = userById.get(c.userId);
      return u && matchesCourseFilter(c, u, filter);
    }).map(c => c.userId)
  );
  // 사용자별 주당 평균 운동 분
  const perUserMin = [];
  for (const uid of cohortUsers) {
    const ex = exercises.filter(e => e.userId === uid);
    if (!ex.length) { perUserMin.push(0); continue; }
    const dateSet = new Set(ex.map(e => e.date));
    const totalMin = ex.reduce((s, e) => s + (e.durationMin || 0), 0);
    const weeks = Math.max(1, dateSet.size / 7);
    perUserMin.push(totalMin / weeks);
  }
  // 버킷: 0, 1-30, 31-60, 61-120, 121-180, 181+
  const buckets = [
    { label: '0분 (안 함)', range: [0, 0.01], count: 0 },
    { label: '1-30분', range: [0.01, 30.01], count: 0 },
    { label: '31-60분', range: [30.01, 60.01], count: 0 },
    { label: '61-120분', range: [60.01, 120.01], count: 0 },
    { label: '121-180분', range: [120.01, 180.01], count: 0 },
    { label: '181분+', range: [180.01, Infinity], count: 0 },
  ];
  for (const m of perUserMin) {
    const b = buckets.find(x => m >= x.range[0] && m < x.range[1]);
    if (b) b.count++;
  }
  return { n: perUserMin.length, buckets };
}

// 운동 시간 분포 (코호트의 주당 평균 분)
export function exerciseStats(filter) {
  const { users, courses, exercises } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  // 코호트의 사용자 ID
  const cohortUsers = new Set(
    courses.filter(c => {
      const u = userById.get(c.userId);
      return u && matchesCourseFilter(c, u, filter);
    }).map(c => c.userId)
  );
  if (!cohortUsers.size) return { n: 0, avgMinPerWeek: null };
  // 사용자별 주당 평균 분
  const perUser = [];
  for (const uid of cohortUsers) {
    const ex = exercises.filter(e => e.userId === uid);
    if (!ex.length) { perUser.push(0); continue; }
    const minByWeek = {};
    for (const e of ex) {
      const wk = Math.floor(new Date(e.date).getTime() / (7 * 24 * 60 * 60 * 1000));
      minByWeek[wk] = (minByWeek[wk] || 0) + (e.durationMin || 0);
    }
    const totalWeeks = Object.keys(minByWeek).length || 1;
    const avg = Object.values(minByWeek).reduce((s, v) => s + v, 0) / totalWeeks;
    perUser.push(avg);
  }
  return {
    n: cohortUsers.size,
    avgMinPerWeek: perUser.reduce((s, v) => s + v, 0) / perUser.length,
    withExercise: perUser.filter(v => v > 0).length,
  };
}

// ============================================================
// REBOUND: 약 중단 후 체중 회복률
// ============================================================

// 중단된 코스 + 중단 시점 체중 추출
function stoppedCoursesWithStopWeight(filter) {
  const { users, courses, logsByUser, exercises } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  const result = [];
  for (const c of courses) {
    if (!c.endDate) continue;
    const u = userById.get(c.userId);
    if (!u) continue;
    if (!matchesCourseFilter(c, u, filter)) continue;
    const sorted = [...(logsByUser.get(u.id) || [])].sort((a, b) => a.date.localeCompare(b.date));
    const stopMs = new Date(c.endDate).getTime();
    // 중단 시점 ±14일 내 가장 가까운 log
    const candidates = sorted.filter(l => Math.abs(new Date(l.date).getTime() - stopMs) <= 14 * 86400000);
    if (!candidates.length) continue;
    const stopLog = candidates.sort((a, b) =>
      Math.abs(new Date(a.date).getTime() - stopMs) - Math.abs(new Date(b.date).getTime() - stopMs)
    )[0];
    // 코스 시작 시점 체중 (loss 계산용)
    const startMs = new Date(c.startDate).getTime();
    const startCandidates = sorted.filter(l => Math.abs(new Date(l.date).getTime() - startMs) <= 14 * 86400000);
    const startLog = startCandidates[0] || { weight: u.startWeight };
    // 운동 빈도 (코스 종료 후 12주간 주당 평균 분)
    const oneYearAfter = stopMs + 84 * 86400000;
    const exAfter = (exercises.filter(e => e.userId === u.id && Date.parse(e.date) >= stopMs && Date.parse(e.date) < oneYearAfter));
    const exMinutesPerWeek = exAfter.length
      ? (exAfter.reduce((s, e) => s + (e.durationMin || 0), 0) / 12)
      : 0;
    result.push({
      course: c,
      user: u,
      logs: sorted,
      stopMs,
      stopWeight: stopLog.weight,
      startWeight: startLog.weight,
      lostKg: startLog.weight - stopLog.weight,
      exMinutesPerWeek,
    });
  }
  return result;
}

// 중단 후 N주차 체중 회복 곡선
// y축: 중단 시점 대비 현재 체중 (양수 = 다시 늘어남, %)
// 또한 "감량분 대비 회복률"도 계산
export function reboundCurve(filter, weeks = [2, 4, 8, 12, 24, 36, 48]) {
  const stopped = stoppedCoursesWithStopWeight(filter);
  return weeks.map(w => {
    const gainPctVals = [];      // 중단 시점 대비 % 증가
    const regainRatioVals = [];  // 감량분 회복률 (regained / lostKg)
    for (const m of stopped) {
      if (m.lostKg <= 0) continue;
      const targetMs = m.stopMs + w * 7 * 86400000;
      const reached = m.logs.find(l => new Date(l.date).getTime() >= targetMs);
      if (!reached) continue;
      const gain = reached.weight - m.stopWeight;
      gainPctVals.push((gain / m.stopWeight) * 100);
      regainRatioVals.push(Math.max(0, gain) / m.lostKg);
    }
    return {
      week: w,
      n: gainPctVals.length,
      avgGainPct: gainPctVals.length ? gainPctVals.reduce((s, x) => s + x, 0) / gainPctVals.length : null,
      medianGainPct: gainPctVals.length ? median(gainPctVals) : null,
      avgRegainRatio: regainRatioVals.length ? regainRatioVals.reduce((s, x) => s + x, 0) / regainRatioVals.length : null,
    };
  });
}

// 운동 지속 vs 미지속의 rebound 비교 (24주 기준)
export function reboundByExercise(filter, targetWeek = 24, exerciseThresholdMin = 90) {
  const stopped = stoppedCoursesWithStopWeight(filter);
  const groups = { active: [], inactive: [] };
  for (const m of stopped) {
    if (m.lostKg <= 0) continue;
    const targetMs = m.stopMs + targetWeek * 7 * 86400000;
    const reached = m.logs.find(l => new Date(l.date).getTime() >= targetMs);
    if (!reached) continue;
    const ratio = Math.max(0, reached.weight - m.stopWeight) / m.lostKg;
    const grp = m.exMinutesPerWeek >= exerciseThresholdMin ? 'active' : 'inactive';
    groups[grp].push(ratio);
  }
  const summarize = (arr) => arr.length ? {
    n: arr.length,
    avgRegainPct: (arr.reduce((s, x) => s + x, 0) / arr.length) * 100,
  } : { n: 0, avgRegainPct: null };
  return {
    targetWeek,
    threshold: exerciseThresholdMin,
    active: summarize(groups.active),
    inactive: summarize(groups.inactive),
  };
}

// 약제별 rebound 비교 (24주차 회복률)
export function reboundByMedication(baseFilter, targetWeek = 24) {
  const meds = ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound'];
  return meds.map(medId => {
    const f = { ...baseFilter, medication: medId };
    const curve = reboundCurve(f, [targetWeek]);
    return {
      id: medId,
      label: MED_BY_ID[medId]?.label || medId,
      n: curve[0].n,
      avgRegainRatio: curve[0].avgRegainRatio,  // 0~1
    };
  });
}

// ============================================================
// 시뮬레이터: "나와 비슷한 사람"의 12주 예상 감량률
// ============================================================
// 항상 결과를 반환한다 (좁은 코호트 → 약 전체 → 전체 평균 순으로 fallback)
export function simulateOutcome({ height, startWeight, gender, ageGroup, medication, weeks = 12 }) {
  const b = bmi(startWeight, height);
  const tightFilter = {};
  if (medication) tightFilter.medication = medication;
  if (gender) tightFilter.gender = gender;
  if (ageGroup) tightFilter.ageGroup = ageGroup;
  if (b) tightFilter.bmiRange = [Math.max(15, b - 3), Math.min(50, b + 3)];

  const computeFor = (filter, level) => {
    const curve = avgLossCurve(filter, [weeks]);
    const point = curve[0];
    if (point?.avg == null) return null;
    // 임계 % 이상 감량한 비율
    const thresholdPct = 5;
    const matched = matchedCourses(filter);
    const lossVals = [];
    for (const m of matched) {
      const v = lossPctAtWeekForCourse(m.course, m.logs, m.user, weeks);
      if (v != null) lossVals.push(v);
    }
    const successRate = lossVals.length
      ? lossVals.filter(v => v >= thresholdPct).length / lossVals.length
      : 0;
    return {
      level,                                         // 'tight' | 'medOnly' | 'overall'
      lossPct: point.avg,
      lossKg: startWeight * point.avg / 100,
      medianPct: point.median,
      successRate,                                   // 5% 이상 감량 비율
      thresholdPct,
      n: point.n,
    };
  };

  const tight = computeFor(tightFilter, 'tight');
  if (tight && tight.n >= 5) return { ...tight, fallback: false };
  const medOnly = medication ? computeFor({ medication }, 'medOnly') : null;
  if (medOnly && medOnly.n >= 5) return { ...medOnly, fallback: true };
  const overall = computeFor({}, 'overall');
  if (overall) return { ...overall, fallback: true };
  return { level: 'none', lossPct: null, lossKg: null, successRate: 0, n: 0, fallback: true };
}

// 사용 빈도별 효과 factor (매주 풀 dose 기준 1.0)
// 한국 실사용 패턴 반영 — 격주/간헐 사용도 흔함
export const USAGE_FREQUENCIES = [
  { id: 'weekly',     label: '매주',         shortLabel: '매주',     factor: 1.00, desc: '주 1회 권장 용법' },
  { id: 'biweekly',   label: '격주 (2주 1회)', shortLabel: '격주',     factor: 0.65, desc: '비용·부작용 때문에 격주로 사용하는 경우' },
  { id: 'occasional', label: '가끔 (월 1-2회)', shortLabel: '가끔',     factor: 0.35, desc: '식욕 조절 목적 간헐적 사용' },
  { id: 'intro',      label: '저용량 유지',     shortLabel: '저용량',   factor: 0.60, desc: '시작 용량 그대로 (증량 안 함)' },
];
const FREQ_BY_ID = Object.fromEntries(USAGE_FREQUENCIES.map(f => [f.id, f]));

// BMI 응답률 보정 (BMI 낮은 사람은 코호트 평균보다 적게 빠짐)
function bmiResponseFactor(b) {
  if (b == null) return 1.0;
  if (b >= 30) return 1.0;
  if (b >= 27.5) return 0.90;
  if (b >= 25) return 0.75;
  if (b >= 23) return 0.60;
  return 0.50;
}

// 다기간 시뮬레이션 — 3개월/6개월/1년 한 번에
// 위마로그 코호트 데이터에서 직접 추출 (임상 fallback 제거)
// BMI/빈도 보정만 후처리
export function simulateTimeline({ height, startWeight, medication, weeks = [12, 24, 48], frequency = 'weekly' }) {
  const b = bmi(startWeight, height);
  const tightFilter = {};
  if (medication) tightFilter.medication = medication;
  if (b) tightFilter.bmiRange = [Math.max(15, b - 4), Math.min(50, b + 4)];

  const freqFactor = FREQ_BY_ID[frequency]?.factor ?? 1.0;
  const bmiFactor = bmiResponseFactor(b);
  const adjustFactor = freqFactor * bmiFactor;

  const computeFor = (filter) => {
    const curve = avgLossCurve(filter, weeks);
    return weeks.map((w, i) => {
      const point = curve[i];
      if (!point || point.avg == null) return null;
      return {
        week: w,
        lossPct: point.avg,
        lossKg: startWeight * point.avg / 100,
        medianPct: point.median,
        n: point.n,
        source: 'cohort',
      };
    });
  };
  // 좁은 코호트 우선, 부족하면 약 전체로 fallback (모두 시드에서 추출)
  let series = computeFor(tightFilter);
  if (!series.some(s => s && s.n >= 5)) {
    series = computeFor(medication ? { medication } : {});
  }

  // 빈도/BMI 보정 후처리 (각 시점)
  let prev = 0;
  series = series.map((s, i) => {
    if (!s) return { week: weeks[i], lossPct: null, lossKg: null, n: 0, source: 'cohort' };
    const lossPct = s.lossPct * adjustFactor;
    // monotonicity 유지 (다음 시점은 이전보다 같거나 크게)
    const guarded = Math.max(lossPct, prev * 0.98);
    prev = guarded;
    return {
      ...s,
      lossPct: guarded,
      lossKg: startWeight * guarded / 100,
    };
  });
  return {
    series,
    adjustFactor,
    freqFactor,
    bmiFactor,
    frequency,
  };
}

// 약제별 빠른 프로필 (비용 + 상위 부작용) — Simulator 결과 카드에서 사용
// 시드 코호트에서 직접 추출 — 우리 사이트 데이터 반영
export function medQuickProfile(medication) {
  if (!medication) return null;
  const filter = { medication };
  // 부작용: 시드 코호트의 실제 발생률 (sideEffectRates는 코스 중 1회 이상 보고 비율)
  const allSides = sideEffectRates(filter);
  const sides = allSides
    .filter(s => s.rate > 0.05)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map(s => ({ label: s.label, rate: s.rate }));
  // 비용: priceStats에서 1회분 평균 → 주1회 사용으로 환산
  const price = priceStats(filter);
  let monthlyAvg = null;
  if (price.avg != null && price.n >= 5) {
    const med = MED_BY_ID[medication];
    // 위고비·마운자로·오젬픽·젭바운드: 주1회 → 월 4회
    // 삭센다: 매일이지만 dose entry는 7일 묶음 → 1회 entry = 1주치
    const perMonth = 4;
    monthlyAvg = Math.round(price.avg * perMonth / 10000) * 10000;
  }
  return {
    topSideEffects: sides,
    monthlyAvgKrw: monthlyAvg,
  };
}

// 임계값(percent) 이상 감량한 비율 (코호트 단위)
export function successRateAtWeek(filter, thresholdPct = 5, week = 12) {
  const matched = matchedCourses(filter);
  const lossVals = [];
  for (const m of matched) {
    const v = lossPctAtWeekForCourse(m.course, m.logs, m.user, week);
    if (v != null) lossVals.push(v);
  }
  if (!lossVals.length) return { n: 0, rate: 0, thresholdPct };
  const count = lossVals.filter(v => v >= thresholdPct).length;
  return { n: lossVals.length, rate: count / lossVals.length, thresholdPct };
}

// 익명 기록 총량 (랜딩 hero 신뢰도용)
export function platformScale() {
  const users = Storage.getUsers();
  const logs = Storage.getLogs();
  const doses = Storage.getDoses();
  const exercises = Storage.getExercises();
  const diets = Storage.getDiets();
  const courses = Storage.getMedCourses();
  return {
    users: users.length,
    realUsers: users.filter(u => !u.seed).length,
    records: logs.length + doses.length + exercises.length + diets.length,
    weights: logs.length,
    doses: doses.length,
    exercises: exercises.length,
    diets: diets.length,
    courses: courses.length,
  };
}

// 사용자 입력 깊이 점수 (0-100) + 잠금 해제 단계
// 입력 종류가 다양할수록 AI 예측 정확도 ↑
export function inputDepth(user) {
  if (!user) return { score: 0, level: 0, milestones: [] };
  const logs = Storage.getLogsByUser(user.id);
  const courses = Storage.getMedCoursesByUser(user.id);
  const doses = Storage.getDosesByUser(user.id);
  const exercises = Storage.getExercisesByUser(user.id);
  const diets = Storage.getDietsByUser(user.id);
  const health = Storage.getHealthMetricsByUser(user.id);
  const inbody = health.filter(h => h.category === 'inbody').length;
  const blood = health.filter(h => h.category === 'blood').length;
  const bp = health.filter(h => h.category === 'bp').length;
  const alcohol = health.filter(h => h.category === 'alcohol').length;
  const sleep = health.filter(h => h.category === 'sleep').length;
  // 마일스톤: 각각의 기록 카운트와 잠금 해제 인사이트
  const milestones = [
    {
      key: 'weight',  icon: '⚖️', label: '체중 기록',
      done: logs.length, need: 5, unlocks: '본인 추세선이 차트에 표시',
    },
    {
      key: 'course',  icon: '💊', label: '약 코스 등록',
      done: courses.length, need: 1, unlocks: '같은 약 사용자와 비교',
    },
    {
      key: 'dose',    icon: '💉', label: '투약 기록',
      done: doses.length, need: 3, unlocks: '지역별 가격 비교 + 누적 비용',
    },
    {
      key: 'exercise',icon: '🏃', label: '운동 기록',
      done: exercises.length, need: 5, unlocks: '같은 운동량 코호트와 감량률 비교',
    },
    {
      key: 'diet',    icon: '🍽️', label: '식단 기록',
      done: diets.length, need: 5, unlocks: '투약 직후 vs 평소 식이 비교 활성화',
    },
    {
      key: 'inbody',  icon: '💪', label: '인바디 기록',
      done: inbody, need: 1, unlocks: '근손실/마른비만 분석 활성화',
    },
    {
      key: 'blood',   icon: '🩸', label: '혈액검사 기록',
      done: blood, need: 1, unlocks: 'ALT/AST/HbA1c 추이 → 지방간 코호트와 비교',
    },
    {
      key: 'bp',      icon: '❤️', label: '혈압 기록',
      done: bp, need: 1, unlocks: '대사증후군 동반자 코호트 비교',
    },
    {
      key: 'alcohol', icon: '🍺', label: '음주 기록',
      done: alcohol, need: 1, unlocks: '알코올 갈망 변화 → GLP-1 효과 분석',
    },
    {
      key: 'sleep',   icon: '😴', label: '수면·스트레스 기록',
      done: sleep, need: 1, unlocks: '스트레스 vs 정체기 상관관계 분석',
    },
    {
      key: 'history', icon: '📈', label: '체중 12주 기록',
      done: logs.length, need: 12, unlocks: '12주차 본인 백분위 표시 (상위 N%)',
    },
  ];
  const score = milestones.reduce((s, m) => s + Math.min(1, m.done / m.need) * (100 / milestones.length), 0);
  const completed = milestones.filter(m => m.done >= m.need).length;
  return { score: Math.round(score), level: completed, milestones };
}

// ============================================================
// 부작용 시점 분포: 각 부작용이 코스 시작 후 어느 주차에 발생하는지
// ============================================================
export function sideEffectTiming(filter, sideEffectId) {
  const { users, courses, logsByUser } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  // 매칭되는 코스 + 로그
  const matched = courses
    .map(c => ({ course: c, user: userById.get(c.userId), logs: logsByUser.get(c.userId) || [] }))
    .filter(x => x.user && matchesCourseFilter(x.course, x.user, filter));
  // 각 코스에서 해당 부작용이 처음 발생한 주차
  const onsetWeeks = []; // 첫 발생 주차
  const durationCounts = []; // 몇 주간 보고됐는지
  for (const m of matched) {
    const start = new Date(m.course.startDate).getTime();
    const end = m.course.endDate ? new Date(m.course.endDate).getTime() : Date.now();
    const inCourse = m.logs.filter(l => {
      const t = new Date(l.date).getTime();
      return t >= start && t <= end && l.sideEffects?.[sideEffectId];
    });
    if (!inCourse.length) continue;
    const firstMs = new Date(inCourse[0].date).getTime();
    const lastMs = new Date(inCourse[inCourse.length - 1].date).getTime();
    onsetWeeks.push(Math.floor((firstMs - start) / (7 * 86400000)));
    durationCounts.push(Math.max(1, Math.round((lastMs - firstMs) / (7 * 86400000)) + 1));
  }
  if (!onsetWeeks.length) return { n: 0, distribution: [], avgOnset: null, avgDuration: null };
  // 구간 분포: 0-1, 2-3, 4-7, 8-11, 12+
  const buckets = [
    { label: '0-1주', count: 0, range: [0, 2] },
    { label: '2-3주', count: 0, range: [2, 4] },
    { label: '4-7주', count: 0, range: [4, 8] },
    { label: '8-11주', count: 0, range: [8, 12] },
    { label: '12주+', count: 0, range: [12, Infinity] },
  ];
  for (const w of onsetWeeks) {
    const b = buckets.find(x => w >= x.range[0] && w < x.range[1]);
    if (b) b.count++;
  }
  return {
    n: onsetWeeks.length,
    distribution: buckets.map(b => ({ label: b.label, count: b.count, rate: b.count / onsetWeeks.length })),
    avgOnset: onsetWeeks.reduce((s, x) => s + x, 0) / onsetWeeks.length,
    avgDuration: durationCounts.reduce((s, x) => s + x, 0) / durationCounts.length,
  };
}

// ============================================================
// 성공 패턴: 상위 25% 감량자의 평균 운동/식단/패턴
// ============================================================
export function successPattern(filter, atWeek = 12) {
  const { users, courses, logsByUser, exercises, diets } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  const matched = courses
    .map(c => ({ course: c, user: userById.get(c.userId), logs: logsByUser.get(c.userId) || [] }))
    .filter(x => x.user && matchesCourseFilter(x.course, x.user, filter));

  const entries = matched.map(m => {
    const lossPct = lossPctAtWeekForCourse(m.course, m.logs, m.user, atWeek);
    return { ...m, lossPct };
  }).filter(e => e.lossPct != null && e.lossPct > 0);

  if (entries.length < 4) return null;

  entries.sort((a, b) => b.lossPct - a.lossPct);
  const topN = Math.max(2, Math.floor(entries.length * 0.25));
  const top = entries.slice(0, topN);
  const rest = entries.slice(topN);

  const summarize = (group) => {
    // 그룹의 평균 주당 운동 시간
    const exMins = [];
    const proteinScores = [];
    for (const e of group) {
      const start = new Date(e.course.startDate).getTime();
      const endMs = Math.min(start + atWeek * 7 * 86400000, e.course.endDate ? new Date(e.course.endDate).getTime() : Date.now());
      const userEx = exercises.filter(x => x.userId === e.user.id
        && Date.parse(x.date) >= start && Date.parse(x.date) <= endMs);
      const userDiet = diets.filter(d => d.userId === e.user.id
        && Date.parse(d.date) >= start && Date.parse(d.date) <= endMs);
      // 주당 평균 분
      const wks = Math.max(1, atWeek);
      exMins.push(userEx.reduce((s, x) => s + (x.durationMin || 0), 0) / wks);
      // 단백질 기록 비율 (단순)
      proteinScores.push(userDiet.filter(d => d.proteinG && d.proteinG >= 20).length / Math.max(1, userDiet.length));
    }
    return {
      n: group.length,
      avgLossPct: group.reduce((s, e) => s + e.lossPct, 0) / group.length,
      avgExerciseMinPerWeek: exMins.reduce((s, x) => s + x, 0) / Math.max(1, exMins.length),
      proteinFocusRate: proteinScores.reduce((s, x) => s + x, 0) / Math.max(1, proteinScores.length),
    };
  };

  return {
    top: summarize(top),
    rest: summarize(rest),
  };
}

// 본인 백분위 (감량률 기준)
export function personalPercentile(filter, myLossPct, atWeek = 12) {
  const matched = matchedCourses(filter);
  const lossPcts = matched
    .map(m => lossPctAtWeekForCourse(m.course, m.logs, m.user, atWeek))
    .filter(v => v != null);
  if (lossPcts.length < 5 || myLossPct == null) return null;
  const below = lossPcts.filter(v => v < myLossPct).length;
  return {
    percentile: Math.round((below / lossPcts.length) * 100),
    n: lossPcts.length,
  };
}

// ============================================================
// 최근 트렌드 (커뮤니티 신호)
// ============================================================
export function recentTrend() {
  const { users, logs, courses, doses } = loadAll();
  const now = Date.now();
  const days7Ago = now - 7 * 86400000;
  const days30Ago = now - 30 * 86400000;
  return {
    totalUsers: users.length,
    newUsers7d: users.filter(u => Date.parse(u.createdAt) >= days7Ago).length,
    activeUsers7d: new Set(logs.filter(l => Date.parse(l.date) >= days7Ago).map(l => l.userId)).size,
    activeUsers30d: new Set(logs.filter(l => Date.parse(l.date) >= days30Ago).map(l => l.userId)).size,
    newCourses7d: courses.filter(c => Date.parse(c.startDate) >= days7Ago).length,
    logs7d: logs.filter(l => Date.parse(l.date) >= days7Ago).length,
    doses7d: doses.filter(d => Date.parse(d.date) >= days7Ago).length,
    // 활발히 사용되는 약 (지난 30일 시작 코스 기준)
    topMedsNow: topMedications(courses, days30Ago),
  };
}

function topMedications(courses, sinceMs) {
  const counts = {};
  for (const c of courses) {
    if (Date.parse(c.startDate) >= sinceMs) {
      counts[c.medication] = (counts[c.medication] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, label: MED_BY_ID[id]?.label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// 익명 메모 모음 (notes 필드 있는 logs 중 최근 + 길이 있는 것)
export function anonymousNotes(filter, limit = 5) {
  const { users, logs, courses } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  const courseByUser = new Map();
  for (const c of courses) {
    if (!courseByUser.has(c.userId)) courseByUser.set(c.userId, []);
    courseByUser.get(c.userId).push(c);
  }
  const matchedUserIds = new Set();
  for (const c of courses) {
    const u = userById.get(c.userId);
    if (u && matchesCourseFilter(c, u, filter)) matchedUserIds.add(c.userId);
  }
  return logs
    .filter(l => matchedUserIds.has(l.userId) && l.notes && l.notes.length > 10 && l.notes !== '온보딩 초기 기록')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map(l => {
      const u = userById.get(l.userId);
      const c = courseByUser.get(l.userId)?.find(c => !c.endDate);
      return {
        date: l.date,
        notes: l.notes,
        weight: l.weight,
        gender: u?.gender,
        ageGroup: u?.ageGroup,
        medication: c?.medication ?? null,
      };
    });
}

// ============================================================
// 식이 phase: 식단 기록 시점이 가장 최근 투약으로부터 며칠 후인지
// 0-2일: 'fresh'(주사 직후), 3-6일: 'mid', 7일+ 또는 약 없음: 'baseline'
// ============================================================
export function dietPhaseFor(dietEntry, userId, allDoses) {
  const dietMs = Date.parse(dietEntry.date);
  const userDoses = allDoses
    .filter(d => d.userId === userId && Date.parse(d.date) <= dietMs)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!userDoses.length) return { phase: 'baseline', daysSinceDose: null };
  const lastDose = userDoses[0];
  const days = Math.floor((dietMs - Date.parse(lastDose.date)) / 86400000);
  if (days <= 2) return { phase: 'fresh', daysSinceDose: days };
  if (days <= 6) return { phase: 'mid', daysSinceDose: days };
  return { phase: 'baseline', daysSinceDose: days };
}

// 사용자별 식이 phase 분포 (평소 vs 투약 직후 vs 중간)
// 단백질 평균, 칼로리 평균 등 phase별 비교
export function dietByPhase(userId) {
  const diets = Storage.getDietsByUser(userId);
  const doses = Storage.getDoses();
  const phases = { fresh: [], mid: [], baseline: [] };
  for (const d of diets) {
    const p = dietPhaseFor(d, userId, doses);
    phases[p.phase].push(d);
  }
  const summarize = (arr) => {
    const proteinVals = arr.filter(d => d.proteinG).map(d => d.proteinG);
    const calVals = arr.filter(d => d.estCalories).map(d => d.estCalories);
    return {
      n: arr.length,
      avgProtein: proteinVals.length ? proteinVals.reduce((s, x) => s + x, 0) / proteinVals.length : null,
      avgCalories: calVals.length ? calVals.reduce((s, x) => s + x, 0) / calVals.length : null,
      // 식사 종류 분포
      byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
    };
  };
  const result = {
    fresh:    summarize(phases.fresh),
    mid:      summarize(phases.mid),
    baseline: summarize(phases.baseline),
  };
  // byMeal 채우기
  for (const k of ['fresh', 'mid', 'baseline']) {
    for (const d of phases[k]) {
      if (result[k].byMeal[d.mealType] != null) result[k].byMeal[d.mealType]++;
    }
  }
  return result;
}

// 코호트 식이 phase 비교 (cohort 전체에서 phase별 평균 단백질/칼로리)
export function cohortDietByPhase(filter) {
  const { users, courses, diets, doses } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  // 매칭되는 사용자 ID 집합
  const matchedUserIds = new Set();
  for (const c of courses) {
    const u = userById.get(c.userId);
    if (u && matchesCourseFilter(c, u, filter)) matchedUserIds.add(c.userId);
  }
  const phases = { fresh: [], mid: [], baseline: [] };
  for (const d of diets) {
    if (!matchedUserIds.has(d.userId)) continue;
    const p = dietPhaseFor(d, d.userId, doses);
    phases[p.phase].push(d);
  }
  const summarize = (arr) => {
    const proteinVals = arr.filter(d => d.proteinG).map(d => d.proteinG);
    const calVals = arr.filter(d => d.estCalories).map(d => d.estCalories);
    return {
      n: arr.length,
      uniqueUsers: new Set(arr.map(d => d.userId)).size,
      avgProtein: proteinVals.length ? proteinVals.reduce((s, x) => s + x, 0) / proteinVals.length : null,
      avgCalories: calVals.length ? calVals.reduce((s, x) => s + x, 0) / calVals.length : null,
    };
  };
  return {
    fresh:    summarize(phases.fresh),
    mid:      summarize(phases.mid),
    baseline: summarize(phases.baseline),
  };
}

// 최근 6개월 약별 신규 시작 사용자 (월별)
export function drugStartTrend(months = 6) {
  const { courses } = loadAll();
  const now = new Date(); now.setDate(1); now.setHours(0,0,0,0);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ label, monthMs: d.getTime(), counts: {} });
  }
  for (const c of courses) {
    const ms = Date.parse(c.startDate);
    for (let i = 0; i < buckets.length; i++) {
      const nextMs = i < buckets.length - 1 ? buckets[i + 1].monthMs : now.getTime() + 31 * 86400000;
      if (ms >= buckets[i].monthMs && ms < nextMs) {
        buckets[i].counts[c.medication] = (buckets[i].counts[c.medication] || 0) + 1;
        break;
      }
    }
  }
  return buckets;
}

// 약 사용자 인구통계 (성별/나이대/동반질환 분포)
export function userDemographics(filter) {
  const { users, courses } = loadAll();
  const userById = new Map(users.map(u => [u.id, u]));
  const matchedUserIds = new Set();
  for (const c of courses) {
    const u = userById.get(c.userId);
    if (u && matchesCourseFilter(c, u, filter)) matchedUserIds.add(c.userId);
  }
  const matched = users.filter(u => matchedUserIds.has(u.id));
  const total = matched.length;
  if (!total) return null;

  const byGender = { F: 0, M: 0 };
  const byAge = {};
  const byCondition = { diabetes: 0, prediabetes: 0, fattyLiver: 0, hypertension: 0, dyslipidemia: 0, thyroid: 0 };
  const startBmis = [];

  for (const u of matched) {
    if (byGender[u.gender] != null) byGender[u.gender]++;
    byAge[u.ageGroup] = (byAge[u.ageGroup] || 0) + 1;
    for (const k of Object.keys(byCondition)) {
      if (u.conditions?.[k]) byCondition[k]++;
    }
    const b = bmi(u.startWeight, u.height);
    if (b) startBmis.push(b);
  }

  return {
    total,
    genderPct: {
      F: total ? byGender.F / total : 0,
      M: total ? byGender.M / total : 0,
    },
    ageDist: Object.entries(byAge)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count, pct: count / total })),
    conditionPct: Object.entries(byCondition)
      .map(([id, count]) => ({ id, count, pct: count / total }))
      .filter(c => c.pct > 0.05)
      .sort((a, b) => b.pct - a.pct),
    avgStartBmi: startBmis.length ? startBmis.reduce((s, b) => s + b, 0) / startBmis.length : null,
  };
}

// 전체 요약 (랜딩페이지)
export function overallSummary() {
  const { users, logs } = loadAll();
  const totalUsers = users.length;
  const totalLogs = logs.length;
  const curve = avgLossCurve({}, [4, 12, 24]);
  return { totalUsers, totalLogs, curve };
}

// 사용자 본인 변화 요약 (특정 코스 기준)
export function personalSummaryForCourse(user, logs, course) {
  if (!user || !logs?.length) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const start = course?.startDate ? new Date(course.startDate).getTime() : null;
  const end = course?.endDate ? new Date(course.endDate).getTime() : Date.now();
  // 코스 시점 weight
  const startWeight = (() => {
    if (!start) return user.startWeight;
    const within = sorted.filter(l => Math.abs(new Date(l.date).getTime() - start) <= 14 * 24 * 60 * 60 * 1000);
    if (within.length) return within[0].weight;
    return user.startWeight;
  })();
  // 코스 구간 내 최신 weight
  const inRange = sorted.filter(l => {
    const t = new Date(l.date).getTime();
    return (!start || t >= start) && t <= end;
  });
  const last = inRange[inRange.length - 1] || sorted[sorted.length - 1];
  if (!last) return null;
  const cur = last.weight;
  const lossKg = +(startWeight - cur).toFixed(1);
  const lossPct = ((startWeight - cur) / startWeight) * 100;
  const weeks = course?.startDate ? weeksSinceStart(course.endDate ? new Date(course.endDate) : new Date(), course.startDate) : weeksSinceStart(new Date(), sorted[0].date);
  return {
    weeks,
    startWeight,
    currentWeight: cur,
    lossKg, lossPct,
    startBmi: bmi(startWeight, user.height),
    curBmi: bmi(cur, user.height),
    targetRemaining: +(cur - user.targetWeight).toFixed(1),
    totalLogs: inRange.length,
  };
}

// 사용자 본인 변화 요약 (코스 없이, 전체 로그 기준)
export function personalSummary(user, logs) {
  if (!user || !logs?.length) return null;
  const { first, last } = bookendLogs(logs);
  const start = user.startWeight;
  const cur = last.weight;
  const lossKg = +(start - cur).toFixed(1);
  const lossPct = ((start - cur) / start) * 100;
  return {
    weeks: weeksSinceStart(new Date(), first.date),
    startWeight: start,
    currentWeight: cur,
    lossKg, lossPct,
    startBmi: bmi(start, user.height),
    curBmi: bmi(cur, user.height),
    targetRemaining: +(cur - user.targetWeight).toFixed(1),
    totalLogs: logs.length,
  };
}
