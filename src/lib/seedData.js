// 결정론적 시드 데이터 생성기. 통계가 처음부터 의미있게 보이도록 가상 데이터 생성.
// 새 모델: User + MedCourse[] + DoseEntry[] + WeeklyLog[] + ExerciseEntry[] + DietEntry[]
import { Storage, uid } from './storage.js';

// 시드 가능한 PRNG (Mulberry32)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rand, arr, weights) {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}
function gauss(rand, mean, sd) {
  const u = 1 - rand(), v = 1 - rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const MED_PROFILE = {
  wegovy:   { maxLossPct: 0.15, tauWeeks: 30, sideRate: 1.00, doses: ['0.25mg', '0.5mg', '1.0mg', '1.7mg', '2.4mg'], priceMean: 50000, freq: 'weekly' },
  mounjaro: { maxLossPct: 0.20, tauWeeks: 32, sideRate: 0.95, doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'], priceMean: 70000, freq: 'weekly' },
  saxenda:  { maxLossPct: 0.07, tauWeeks: 28, sideRate: 1.05, doses: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3.0mg'], priceMean: 8000, freq: 'daily' },
  ozempic:  { maxLossPct: 0.12, tauWeeks: 30, sideRate: 0.95, doses: ['0.25mg', '0.5mg', '1.0mg', '2.0mg'], priceMean: 55000, freq: 'weekly' },
  zepbound: { maxLossPct: 0.19, tauWeeks: 32, sideRate: 0.95, doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'], priceMean: 65000, freq: 'weekly' },
  other:    { maxLossPct: 0.10, tauWeeks: 28, sideRate: 1.00, doses: ['저용량', '중용량', '고용량'], priceMean: 40000, freq: 'weekly' },
};

const SIDE_BASE_RATES = {
  nausea: 0.45, vomiting: 0.12, constipation: 0.30, diarrhea: 0.17,
  fatigue: 0.22, dizziness: 0.10, abdomenPain: 0.14, hairLoss: 0.08,
  reflux: 0.18, headache: 0.13,
};

const REGIONS = ['서울 대학로', '서울 강남', '서울 종로', '경기 분당', '경기 일산', '부산', '대구', '온라인'];
const REGION_WEIGHTS = [0.30, 0.20, 0.10, 0.10, 0.08, 0.10, 0.07, 0.05]; // 대학로 비중 높게

const EXERCISE_PATTERN = [
  { id: 'walking',  weight: 0.35, durMean: 35 },
  { id: 'home',     weight: 0.18, durMean: 25 },
  { id: 'strength', weight: 0.12, durMean: 45 },
  { id: 'jogging',  weight: 0.10, durMean: 30 },
  { id: 'yoga',     weight: 0.08, durMean: 40 },
  { id: 'cycling',  weight: 0.07, durMean: 50 },
  { id: 'hiking',   weight: 0.05, durMean: 90 },
  { id: 'swimming', weight: 0.03, durMean: 40 },
  { id: 'sports',   weight: 0.02, durMean: 60 },
];

const SAMPLE_MEALS = {
  breakfast: ['요거트+그래놀라', '오트밀', '계란+토스트', '닭가슴살 샐러드', '단백질 쉐이크', '바나나+우유', '두유+삶은 계란'],
  lunch:     ['샐러드+닭가슴살', '연어 포케', '비빔밥(소량)', '두부 덮밥', '월남쌈', '닭곰탕', '현미밥+생선구이'],
  dinner:    ['두부 스테이크', '계란찜+나물', '연어구이', '닭가슴살+브로콜리', '미역국+생선', '쌈채소+제육(소량)', '저녁 거름'],
  snack:     ['그릭요거트', '아몬드 한 줌', '단백질바', '치즈+귤', '두유', '없음'],
};
const DIET_PATTERNS_KEYS = ['lowcarb', 'highprotein', 'lowfat', 'mediterranean', 'intermittent', 'vegetarian', 'normal'];

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function generateOne(rand, index, out) {
  const gender = pick(rand, ['F', 'M'], [0.72, 0.28]);
  const ageGroup = pick(rand, ['20s', '30s', '40s', '50s', '60s+'], [0.10, 0.34, 0.34, 0.17, 0.05]);
  const heightMean = gender === 'F' ? 161 : 173;
  const height = Math.round(clamp(gauss(rand, heightMean, 6), 145, 195));

  const startBMI = clamp(gauss(rand, 31.5, 3.2), 25, 45);
  const startWeight = +(startBMI * (height / 100) ** 2).toFixed(1);
  const targetWeight = +(startWeight * (1 - clamp(gauss(rand, 0.18, 0.05), 0.08, 0.30))).toFixed(1);

  // 약 사용 여부 - 비사용자 비중 늘림 (걱정 많은 사람도 가입)
  const isUser = rand() < 0.80;
  // 다중 약 사용 가능성 (활성 사용자 중 20%가 2번째 코스 보유)
  const numCourses = isUser ? (rand() < 0.20 ? 2 : 1) : 0;

  // 운동 의지(0~1) — rebound 속도, 부작용 영향 등에 활용
  const exerciseDedication = clamp(gauss(rand, 0.45, 0.25), 0.05, 0.95);
  // 식이 의지 — rebound에도 영향
  const dietDedication = clamp(gauss(rand, 0.40, 0.25), 0.05, 0.95);

  const userId = uid('seed');
  const user = {
    id: userId,
    seed: true,
    nickname: '익명' + (index + 1),
    gender, ageGroup, height,
    startWeight, targetWeight,
    conditions: {
      diabetes:     rand() < 0.18,
      prediabetes:  rand() < 0.20,
      fattyLiver:   rand() < 0.35,
      hypertension: rand() < 0.22,
      dyslipidemia: rand() < 0.30,
      thyroid:      rand() < 0.08,
    },
    purpose: pick(rand, ['weight', 'diabetes', 'fatty', 'doctor', 'other'], [0.70, 0.10, 0.10, 0.07, 0.03]),
    concerns: ['effect', 'sideeffect', 'cost', 'rebound'].filter(() => rand() < 0.4),
    consents: { privacy: true, sensitiveData: true, anonymizedShare: true },
    createdAt: new Date(Date.parse(daysAgo(Math.round(gauss(rand, 30, 20))))).toISOString(),
    // 시드 시뮬레이션용 (퍼블릭 통계에 노출 안 됨)
    _exerciseDedication: exerciseDedication,
    _dietDedication: dietDedication,
  };
  out.users.push(user);

  // 비사용자: 체중 기록 + 운동/식단 일부만
  if (!isUser) {
    generateWeightAndLifestyle(rand, user, 8, null, out);
    return;
  }

  // 약 코스 생성
  const meds = ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound', 'other'];
  const medWeights = [0.45, 0.25, 0.15, 0.08, 0.05, 0.02];
  const courses = [];
  let totalSpanWeeks = 0;

  for (let i = 0; i < numCourses; i++) {
    const med = pick(rand, meds, medWeights);
    const profile = MED_PROFILE[med];
    const weeks = Math.round(clamp(gauss(rand, 18, 10), 4, 48));
    totalSpanWeeks += weeks;
    const courseStart = daysAgo(totalSpanWeeks * 7);
    const responseFactor = clamp(gauss(rand, 1.0, 0.30), 0.4, 1.7);
    const sideSeverity = clamp(gauss(rand, 1.0, 0.35), 0.2, 2.0);
    const isFirstCourse = i === 0; // 가장 최근 코스
    const discontinueChance = 0.04 + (responseFactor < 0.7 ? 0.10 : 0) + (sideSeverity > 1.5 ? 0.10 : 0);
    const discontinued = !isFirstCourse || (rand() < discontinueChance && weeks > 4);
    const discontinueWeek = discontinued ? Math.round(4 + rand() * (weeks - 4)) : null;

    const course = {
      id: uid('mc'),
      userId,
      seed: true,
      medication: med,
      startDate: courseStart,
      endDate: discontinued ? daysAgo(totalSpanWeeks * 7 - discontinueWeek * 7) : null,
      initialDose: profile.doses[0],
      notes: numCourses > 1 ? (i === 0 ? '현재 라운드' : `${i + 1}번째 라운드`) : '',
      discontinueReason: discontinued
        ? pick(rand, ['cost', 'sideeffect', 'noeffect', 'goal', 'supply', 'doctor', 'other'],
                      [0.30, 0.30, 0.15, 0.08, 0.07, 0.05, 0.05])
        : null,
      createdAt: new Date(Date.parse(courseStart)).toISOString(),
      // 헬퍼 (시드 모델 내부에서만 사용)
      _profile: profile,
      _weeks: weeks,
      _responseFactor: responseFactor,
      _sideSeverity: sideSeverity,
      _discontinueWeek: discontinueWeek,
    };
    courses.push(course);
  }

  // 코스를 시간순(과거 → 현재)으로 정렬
  courses.sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const c of courses) {
    out.medCourses.push({
      id: c.id, userId: c.userId, seed: c.seed,
      medication: c.medication, startDate: c.startDate, endDate: c.endDate,
      initialDose: c.initialDose, notes: c.notes,
      discontinueReason: c.discontinueReason, createdAt: c.createdAt,
    });
    // 투약 기록 생성
    generateDoses(rand, user, c, out);
  }

  // 체중 + 증상 로그 (가장 오래된 코스 시작일부터)
  const firstStart = courses[0].startDate;
  const totalWeeks = Math.ceil((Date.now() - new Date(firstStart).getTime()) / (1000 * 60 * 60 * 24 * 7));
  generateWeightAndLifestyle(rand, user, totalWeeks, courses, out);
}

function generateDoses(rand, user, course, out) {
  const p = course._profile;
  const startMs = new Date(course.startDate).getTime();
  const endMs = course.endDate ? new Date(course.endDate).getTime() : Date.now();
  const intervalDays = p.freq === 'daily' ? 1 : 7;
  let day = 0;
  let doseIdx = 0;
  // 4주마다 다음 용량으로 escalation
  while (true) {
    const dateMs = startMs + day * 24 * 60 * 60 * 1000;
    if (dateMs > endMs) break;
    const date = new Date(dateMs).toISOString().slice(0, 10);
    const escalationWeek = Math.floor(day / 7 / 4);
    doseIdx = Math.min(escalationWeek, p.doses.length - 1);
    const region = pick(rand, REGIONS, REGION_WEIGHTS);
    const priceVar = clamp(gauss(rand, 1.0, 0.2), 0.7, 1.4);
    const regionDiscount = region === '서울 대학로' ? 0.75 : region === '온라인' ? 0.85 : 1.0;
    const price = Math.round(p.priceMean * priceVar * regionDiscount / 1000) * 1000;
    out.doses.push({
      id: uid('dose'),
      userId: user.id,
      courseId: course.id,
      seed: true,
      date,
      dose: p.doses[doseIdx],
      price,
      region,
      pharmacyName: '',
      notes: '',
      createdAt: new Date(dateMs).toISOString(),
    });
    day += intervalDays;
    if (day > 365) break; // safety cap
  }
}

function generateWeightAndLifestyle(rand, user, weeks, courses, out) {
  // 체중 곡선:
  // - 활성 코스 중: 점진적 감량 (지수 감쇠 모델)
  // - 중단 후: rebound 모델 (6개월에 약 50% 회복, 운동·식이 의지가 회복 속도 늦춤)
  let prevWeight = user.startWeight;
  // 직전 활성 코스 종료 정보 (rebound 기준점)
  let lastStopInfo = null; // { stopWeight, stopMs }

  // 회복(rebound) 속도: 운동·식이 의지가 높으면 더 느리게 회복
  // 기본: 주당 약 2.7% 잔여손실 회복 → 6개월에 약 50% 회복
  // (1 - exp(-rate*weeks)) = 0.5 이 26주에 → rate ≈ ln(2)/26 ≈ 0.0267
  const baseReboundRate = 0.027;
  const reboundRate = baseReboundRate *
    (1 - user._exerciseDedication * 0.45 - user._dietDedication * 0.30);
  // 운동·식이 둘 다 만점이면 rebound가 약 25%만 → 6개월에 12.5% 회복

  for (let w = 0; w <= weeks; w++) {
    const date = daysAgo((weeks - w) * 7);
    const dateMs = Date.parse(date);

    let weight;
    if (courses) {
      const active = courses.find(c => {
        const s = Date.parse(c.startDate);
        const e = c._discontinueWeek != null
          ? s + c._discontinueWeek * 7 * 24 * 60 * 60 * 1000
          : Date.now();
        return dateMs >= s && dateMs <= e;
      });
      if (active) {
        // 활성 코스 중 — 감량
        const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 24 * 60 * 60 * 1000)));
        const userMaxLossPct = active._profile.maxLossPct * active._responseFactor;
        const expected = user.startWeight - user.startWeight * userMaxLossPct * (1 - Math.exp(-courseWeek / active._profile.tauWeeks));
        const noise = gauss(rand, 0, 0.4);
        weight = clamp(expected + noise, user.startWeight * 0.55, user.startWeight * 1.05);
        lastStopInfo = null;
      } else {
        // 중단 후 — rebound
        // 가장 최근 종료된 코스 + 그 시점 체중 찾기
        if (!lastStopInfo) {
          const justEnded = [...courses]
            .filter(c => c._discontinueWeek != null
                       && (Date.parse(c.startDate) + c._discontinueWeek * 7 * 24 * 60 * 60 * 1000) <= dateMs)
            .sort((a, b) => (Date.parse(b.startDate) + b._discontinueWeek*7*86400000)
                          - (Date.parse(a.startDate) + a._discontinueWeek*7*86400000))[0];
          if (justEnded) {
            const stopMs = Date.parse(justEnded.startDate) + justEnded._discontinueWeek * 7 * 24 * 60 * 60 * 1000;
            lastStopInfo = { stopWeight: prevWeight, stopMs };
          }
        }
        if (lastStopInfo) {
          const weeksSinceStop = Math.max(0, (dateMs - lastStopInfo.stopMs) / (7 * 24 * 60 * 60 * 1000));
          // 회복할 수 있는 최대량 = (startWeight - stopWeight)
          const maxRecovery = user.startWeight - lastStopInfo.stopWeight;
          const recovered = maxRecovery * (1 - Math.exp(-reboundRate * weeksSinceStop));
          const expected = lastStopInfo.stopWeight + recovered;
          const noise = gauss(rand, 0, 0.35);
          weight = clamp(expected + noise, user.startWeight * 0.55, user.startWeight * 1.10);
        } else {
          // 코스 시작 전: 시작 체중 부근
          weight = user.startWeight + gauss(rand, 0, 0.5);
        }
      }
    } else {
      // 비사용자: 약간 증가 추세 (시작 시점 대비 슬로우 게인)
      weight = prevWeight + gauss(rand, 0.05, 0.4);
    }
    weight = +clamp(weight, user.startWeight * 0.55, user.startWeight * 1.10).toFixed(1);
    const smoothed = w === 0 ? user.startWeight : +(prevWeight * 0.2 + weight * 0.8).toFixed(1);
    prevWeight = smoothed;

    // 부작용: 활성 코스 + 초반에 집중
    const sideEffects = {};
    const active = courses?.find(c => {
      const s = Date.parse(c.startDate);
      const e = c._discontinueWeek != null
        ? s + c._discontinueWeek * 7 * 24 * 60 * 60 * 1000
        : Date.now();
      return dateMs >= s && dateMs <= e;
    });
    if (active) {
      const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 24 * 60 * 60 * 1000)));
      const phaseFactor = courseWeek === 0 ? 0.3 : courseWeek < 4 ? 1.0 : courseWeek < 12 ? 0.6 : 0.3;
      for (const [k, base] of Object.entries(SIDE_BASE_RATES)) {
        sideEffects[k] = rand() < base * active._profile.sideRate * active._sideSeverity * phaseFactor * 0.5;
      }
    }

    out.logs.push({
      id: uid('log'),
      userId: user.id,
      seed: true,
      date,
      weekIndex: w,
      weight: smoothed,
      appetiteChange: clamp(Math.round(gauss(rand, active ? 4 : 3, 1)), 1, 5),
      satiety:        clamp(Math.round(gauss(rand, active ? 4 : 3, 1)), 1, 5),
      sideEffects,
      mealReduction:  clamp(Math.round(gauss(rand, active ? 3.5 : 2.5, 1)), 1, 5),
      notes: '',
      createdAt: new Date(dateMs).toISOString(),
    });

    // 운동 기록: 사용자 운동 의지에 비례 (의지 1.0 → 평균 주 5회, 0.0 → 평균 주 0.5회)
    const exerciseCount = Math.max(0, Math.round(gauss(rand, 0.5 + user._exerciseDedication * 4.5, 1.2)));
    for (let i = 0; i < exerciseCount; i++) {
      const e = pick(rand, EXERCISE_PATTERN, EXERCISE_PATTERN.map(x => x.weight));
      const dayOffset = Math.floor(rand() * 7);
      const exerciseDate = new Date(dateMs - dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      out.exercises.push({
        id: uid('ex'),
        userId: user.id,
        seed: true,
        date: exerciseDate,
        type: e.id,
        durationMin: Math.max(10, Math.round(gauss(rand, e.durMean, e.durMean * 0.3))),
        intensity: clamp(Math.round(gauss(rand, 2 + user._exerciseDedication * 2, 1)), 1, 5),
        notes: '',
        createdAt: new Date(dateMs).toISOString(),
      });
    }

    // 식단 기록: 식단 의지에 따라
    if (rand() < user._dietDedication * 0.8) {
      const pattern = pick(rand, DIET_PATTERNS_KEYS, [0.20, 0.30, 0.05, 0.05, 0.15, 0.05, 0.20]);
      for (const mealType of ['breakfast', 'lunch', 'dinner']) {
        if (rand() > 0.6) continue;
        const dayOffset = Math.floor(rand() * 7);
        const dietDate = new Date(dateMs - dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const sample = SAMPLE_MEALS[mealType];
        out.diets.push({
          id: uid('diet'),
          userId: user.id,
          seed: true,
          date: dietDate,
          mealType,
          description: sample[Math.floor(rand() * sample.length)],
          proteinG: rand() < 0.3 ? Math.round(gauss(rand, 25, 10)) : null,
          estCalories: rand() < 0.2 ? Math.round(gauss(rand, 400, 150)) : null,
          pattern: rand() < 0.5 ? pattern : null,
          createdAt: new Date(dateMs).toISOString(),
        });
      }
    }
  }
}

export function seedIfNeeded(count = 150, seed = 20260518) {
  if (Storage.isSeeded()) return;
  const rand = mulberry32(seed);
  const out = {
    users: Storage.getUsers(),
    logs: Storage.getLogs(),
    medCourses: Storage.getMedCourses(),
    doses: Storage.getDoses(),
    exercises: Storage.getExercises(),
    diets: Storage.getDiets(),
  };
  for (let i = 0; i < count; i++) generateOne(rand, i, out);
  Storage.setUsers(out.users);
  Storage.setLogs(out.logs);
  Storage.setMedCourses(out.medCourses);
  // raw collection setters
  localStorage.setItem('gl_doses',     JSON.stringify(out.doses));
  localStorage.setItem('gl_exercises', JSON.stringify(out.exercises));
  localStorage.setItem('gl_diets',     JSON.stringify(out.diets));
  Storage.markSeeded();
}

export function reseed(count = 150) {
  // 시드 데이터만 삭제 후 재생성
  Storage.setUsers(Storage.getUsers().filter(u => !u.seed));
  Storage.setLogs(Storage.getLogs().filter(l => !l.seed));
  Storage.setMedCourses(Storage.getMedCourses().filter(c => !c.seed));
  localStorage.setItem('gl_doses',     JSON.stringify(Storage.getDoses().filter(d => !d.seed)));
  localStorage.setItem('gl_exercises', JSON.stringify(Storage.getExercises().filter(e => !e.seed)));
  localStorage.setItem('gl_diets',     JSON.stringify(Storage.getDiets().filter(d => !d.seed)));
  Storage.resetSeed();
  seedIfNeeded(count);
}
