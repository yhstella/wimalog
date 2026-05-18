// 시드 데이터 v4 — 실제 임상 데이터 + 한국 약값 기반.
// References:
//   STEP-1: 위고비 68주 -14.9% (-12.5kg)
//   SURMOUNT-5: 마운자로 -20.2% (-22.8kg) vs 위고비 -13.7% (-15.0kg) at 72wk
//   SCALE: 삭센다 56주 -8.0%
//   Wegovy GI: nausea 44%, vomiting 24%, constipation 24%, diarrhea 30%
//   Mounjaro GI: nausea 12-31%, vomiting 8-15%
//   한국 약값 (2025-2026):
//     위고비 0.25mg 22만원 ~ 2.4mg 49만원
//     마운자로 2.5mg 28만원 ~ 10mg 80만원
//     삭센다 (월) 30-40만원
import { Storage, uid } from './storage.js';

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

// 약제별 프로파일 — 실제 임상값 기반
const MED_PROFILE = {
  wegovy: {
    label: '위고비',
    maxLossPct: 0.149,      // STEP-1 평균
    tauWeeks: 32,           // 도달까지 약 5-6개월
    intervalDays: 7,
    doses: ['0.25mg', '0.5mg', '1.0mg', '1.7mg', '2.4mg'],
    priceByDose: {
      '0.25mg': 250000, '0.5mg': 270000, '1.0mg': 320000,
      '1.7mg': 380000, '2.4mg': 470000,
    },
    sideRates: {  // 실 임상 STEP-1 부작용 발생률
      nausea: 0.44, vomiting: 0.24, constipation: 0.24, diarrhea: 0.30,
      fatigue: 0.11, dizziness: 0.08, abdomenPain: 0.20, hairLoss: 0.03,
      reflux: 0.10, headache: 0.14,
    },
  },
  mounjaro: {
    label: '마운자로',
    maxLossPct: 0.202,      // SURMOUNT-5 평균
    tauWeeks: 32,
    intervalDays: 7,
    doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    priceByDose: {
      '2.5mg': 290000, '5mg': 380000, '7.5mg': 540000,
      '10mg': 650000, '12.5mg': 750000, '15mg': 820000,
    },
    sideRates: {
      nausea: 0.31, vomiting: 0.15, constipation: 0.17, diarrhea: 0.23,
      fatigue: 0.09, dizziness: 0.06, abdomenPain: 0.12, hairLoss: 0.06,
      reflux: 0.08, headache: 0.10,
    },
  },
  saxenda: {
    label: '삭센다',
    maxLossPct: 0.080,      // SCALE
    tauWeeks: 28,
    intervalDays: 1,
    doses: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3.0mg'],
    priceByDose: {  // 매일 사용이라 1회분이 작음 (월 ~35만원 기준)
      '0.6mg': 9000, '1.2mg': 10000, '1.8mg': 11000,
      '2.4mg': 12000, '3.0mg': 12000,
    },
    sideRates: {
      nausea: 0.39, vomiting: 0.16, constipation: 0.19, diarrhea: 0.21,
      fatigue: 0.13, dizziness: 0.10, abdomenPain: 0.18, hairLoss: 0.04,
      reflux: 0.09, headache: 0.14,
    },
  },
  ozempic: {
    label: '오젬픽',
    maxLossPct: 0.110,
    tauWeeks: 30,
    intervalDays: 7,
    doses: ['0.25mg', '0.5mg', '1.0mg', '2.0mg'],
    priceByDose: {
      '0.25mg': 200000, '0.5mg': 230000, '1.0mg': 290000, '2.0mg': 380000,
    },
    sideRates: {
      nausea: 0.38, vomiting: 0.20, constipation: 0.22, diarrhea: 0.27,
      fatigue: 0.10, dizziness: 0.07, abdomenPain: 0.18, hairLoss: 0.03,
      reflux: 0.10, headache: 0.13,
    },
  },
  zepbound: {
    label: '젭바운드',
    maxLossPct: 0.195,
    tauWeeks: 32,
    intervalDays: 7,
    doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    priceByDose: {
      '2.5mg': 280000, '5mg': 360000, '7.5mg': 510000,
      '10mg': 620000, '12.5mg': 720000, '15mg': 790000,
    },
    sideRates: {
      nausea: 0.30, vomiting: 0.14, constipation: 0.16, diarrhea: 0.22,
      fatigue: 0.09, dizziness: 0.06, abdomenPain: 0.12, hairLoss: 0.06,
      reflux: 0.08, headache: 0.10,
    },
  },
};

// 지역별 가격 멀티플라이어 (서울 대학로/종로가 가장 저렴, 강남/지방이 비싼 편)
const REGION_PROFILE = [
  { region: '서울 대학로', weight: 0.18, mult: 0.78 },
  { region: '서울 종로',   weight: 0.10, mult: 0.85 },
  { region: '서울 강남',   weight: 0.15, mult: 1.10 },
  { region: '서울 송파',   weight: 0.07, mult: 1.05 },
  { region: '서울 신촌',   weight: 0.06, mult: 0.95 },
  { region: '경기 분당',   weight: 0.08, mult: 1.00 },
  { region: '경기 일산',   weight: 0.06, mult: 1.00 },
  { region: '경기 수원',   weight: 0.06, mult: 0.98 },
  { region: '부산',        weight: 0.08, mult: 0.95 },
  { region: '대구',        weight: 0.05, mult: 0.95 },
  { region: '인천',        weight: 0.05, mult: 1.00 },
  { region: '대전',        weight: 0.03, mult: 0.95 },
  { region: '광주',        weight: 0.02, mult: 0.95 },
  { region: '온라인',      weight: 0.01, mult: 0.85 },
];

const EXERCISE_PATTERN = [
  { id: 'walking',  weight: 0.40, durMean: 35 },
  { id: 'home',     weight: 0.18, durMean: 25 },
  { id: 'strength', weight: 0.12, durMean: 45 },
  { id: 'jogging',  weight: 0.08, durMean: 30 },
  { id: 'yoga',     weight: 0.08, durMean: 40 },
  { id: 'cycling',  weight: 0.06, durMean: 50 },
  { id: 'hiking',   weight: 0.04, durMean: 90 },
  { id: 'swimming', weight: 0.02, durMean: 40 },
  { id: 'sports',   weight: 0.02, durMean: 60 },
];

const ANON_NOTES_TEMPLATES = [
  '오심 심했는데 2주 지나니 괜찮아짐',
  '식욕이 확실히 줄었어요',
  '1주차에 -2kg, 신기',
  '변비가 좀 있긴 한데 견딜 만함',
  '운동 같이 하니까 효과 더 좋은 듯',
  '용량 올리니까 부작용 다시 생김',
  '단백질 챙겨먹고 있어요',
  '주말에 약속 많은 게 제일 큰 적',
  '한 달 됐는데 옷이 헐렁',
  '아침 식욕이 거의 없어짐',
  '저녁에 갑자기 배고픔 있음',
  '대학로에서 더 싸게 처방받음',
  '3주차 정체기 오는 듯',
  '근손실 걱정돼서 단백질 보충제 같이',
  '에너지 떨어진 느낌',
];

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// 한 사용자 + 그의 약 코스/투약/체중/운동/식단 생성
function generateOne(rand, index, out) {
  const gender = pick(rand, ['F', 'M'], [0.72, 0.28]);
  const ageGroup = pick(rand, ['20s', '30s', '40s', '50s', '60s+'], [0.10, 0.34, 0.34, 0.17, 0.05]);
  const heightMean = gender === 'F' ? 161 : 173;
  const height = Math.round(clamp(gauss(rand, heightMean, 6), 145, 195));

  const startBMI = clamp(gauss(rand, 31.5, 3.2), 25, 45);
  const startWeight = +(startBMI * (height / 100) ** 2).toFixed(1);
  const targetWeight = +(startWeight * (1 - clamp(gauss(rand, 0.18, 0.05), 0.08, 0.30))).toFixed(1);

  // 약 사용 여부 (80%)
  const isUser = rand() < 0.80;
  const numCourses = isUser ? (rand() < 0.18 ? 2 : 1) : 0;

  const exerciseDedication = clamp(gauss(rand, 0.45, 0.25), 0.05, 0.95);
  const dietDedication     = clamp(gauss(rand, 0.40, 0.25), 0.05, 0.95);

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
      fattyLiver:   rand() < 0.32,
      hypertension: rand() < 0.22,
      dyslipidemia: rand() < 0.28,
      thyroid:      rand() < 0.07,
    },
    purpose: pick(rand, ['weight', 'diabetes', 'fatty', 'doctor', 'other'], [0.70, 0.10, 0.10, 0.07, 0.03]),
    concerns: ['effect', 'sideeffect', 'cost', 'rebound'].filter(() => rand() < 0.4),
    consents: { privacy: true, sensitiveData: true, anonymizedShare: true },
    createdAt: new Date(Date.parse(daysAgo(Math.round(gauss(rand, 30, 20))))).toISOString(),
    _exerciseDedication: exerciseDedication,
    _dietDedication: dietDedication,
  };
  out.users.push(user);

  if (!isUser) {
    // 비사용자: 체중 + 일부 운동/식단
    generateLifestyle(rand, user, null, out, { exReduce: 0.3, dietReduce: 0.3 });
    return;
  }

  // 약제 분포
  const meds = ['wegovy', 'mounjaro', 'saxenda', 'ozempic', 'zepbound'];
  const medWeights = [0.45, 0.27, 0.15, 0.08, 0.05];

  const courses = [];
  let totalSpanWeeks = 0;
  for (let i = 0; i < numCourses; i++) {
    const med = pick(rand, meds, medWeights);
    const profile = MED_PROFILE[med];
    // 사용 기간 분포 — long-term 사용자(1년+) 비율 늘려 통계 신뢰도 ↑
    // 30%는 short(4-12주), 40%는 mid(12-30주), 30%는 long(30-52주)
    const tier = rand();
    let weeks;
    if (tier < 0.30) weeks = Math.round(clamp(gauss(rand, 8, 3), 3, 12));
    else if (tier < 0.70) weeks = Math.round(clamp(gauss(rand, 20, 5), 12, 30));
    else weeks = Math.round(clamp(gauss(rand, 42, 6), 30, 56));
    totalSpanWeeks += weeks;
    const courseStart = daysAgo(totalSpanWeeks * 7);
    const responseFactor = clamp(gauss(rand, 1.0, 0.30), 0.4, 1.7);
    // 부작용 감수성 — 사용자별 0.5~2.0 (한 번이라도 보고할지 결정)
    const sideSeverity = clamp(gauss(rand, 1.0, 0.45), 0.2, 2.2);
    const isCurrent = i === 0;
    const discontinueChance = 0.04 + (responseFactor < 0.7 ? 0.10 : 0) + (sideSeverity > 1.5 ? 0.10 : 0);
    const discontinued = !isCurrent || (rand() < discontinueChance && weeks > 4);
    const discontinueWeek = discontinued ? Math.round(4 + rand() * (weeks - 4)) : null;

    courses.push({
      id: uid('mc'),
      userId,
      seed: true,
      medication: med,
      startDate: courseStart,
      endDate: discontinued ? daysAgo(totalSpanWeeks * 7 - discontinueWeek * 7) : null,
      initialDose: profile.doses[0],
      notes: numCourses > 1 ? (i === 0 ? '현재' : `이전 라운드`) : '',
      discontinueReason: discontinued
        ? pick(rand, ['cost', 'sideeffect', 'noeffect', 'goal', 'supply', 'doctor', 'other'],
                      [0.30, 0.30, 0.15, 0.08, 0.07, 0.05, 0.05])
        : null,
      createdAt: new Date(Date.parse(courseStart)).toISOString(),
      _profile: profile,
      _weeks: weeks,
      _responseFactor: responseFactor,
      _sideSeverity: sideSeverity,
      _discontinueWeek: discontinueWeek,
    });
  }
  courses.sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const c of courses) {
    // 사용자별로 미리 "이 코스에서 어떤 부작용을 경험할지" 결정 (임상 prevalence 일치)
    // 임상 prevalence = base rate × sideSeverity (0.5~2.0이므로 평균 1.0)
    // clamp 0.02 ~ 0.95
    c._willExperience = {};
    for (const [k, base] of Object.entries(c._profile.sideRates)) {
      const personalProb = clamp(base * c._sideSeverity, 0.02, 0.95);
      c._willExperience[k] = rand() < personalProb;
    }
    // 코스 메타데이터 저장 (시뮬레이션 필드 제거)
    out.medCourses.push({
      id: c.id, userId: c.userId, seed: c.seed,
      medication: c.medication, startDate: c.startDate, endDate: c.endDate,
      initialDose: c.initialDose, notes: c.notes,
      discontinueReason: c.discontinueReason, createdAt: c.createdAt,
    });
    generateDoses(rand, user, c, out);
  }
  generateLifestyle(rand, user, courses, out, { exReduce: 1, dietReduce: 1 });
}

// 약 코스의 투약 기록 (간격 + 가격 + 지역 + 용량 증량)
function generateDoses(rand, user, course, out) {
  const p = course._profile;
  const startMs = new Date(course.startDate).getTime();
  const endMs = course.endDate ? new Date(course.endDate).getTime() : Date.now();
  const intervalMs = p.intervalDays * 86400000;

  // 매일 투약(삭센다)은 표본 부담 큼 → 7일 단위로 묶어 저장 (사용자가 보기에 평균값)
  const stride = p.intervalDays === 1 ? 7 : p.intervalDays;
  const doseCountPerEntry = p.intervalDays === 1 ? 7 : 1;

  let day = 0;
  while (true) {
    const dateMs = startMs + day * 86400000;
    if (dateMs > endMs) break;
    const date = new Date(dateMs).toISOString().slice(0, 10);

    // 4주마다 용량 증량 (5번째 dose 이후엔 유지)
    const escalationStep = Math.floor(day / 28);
    const doseIdx = Math.min(escalationStep, p.doses.length - 1);
    const dose = p.doses[doseIdx];

    // 가격: 약+용량 기본가 × 지역 멀티 × 개인 변동(±15%)
    const regionEntry = pick(rand, REGION_PROFILE.map(r => r), REGION_PROFILE.map(r => r.weight));
    const basePrice = p.priceByDose[dose] || 30000;
    const indiv = clamp(gauss(rand, 1.0, 0.10), 0.85, 1.2);
    const price = Math.round(basePrice * regionEntry.mult * indiv * doseCountPerEntry / 1000) * 1000;

    out.doses.push({
      id: uid('dose'),
      userId: user.id,
      courseId: course.id,
      seed: true,
      date,
      dose,
      price,
      region: regionEntry.region,
      pharmacyName: '',
      notes: '',
      createdAt: new Date(dateMs).toISOString(),
    });
    day += stride;
    if (day > 400) break;
  }
}

// 체중/부작용 로그 + 운동/식단
// exReduce / dietReduce: 0~1 — 시드 크기 조절 (1000명 데이터 localStorage 한계 회피)
function generateLifestyle(rand, user, courses, out, opts = {}) {
  const { exReduce = 1, dietReduce = 1 } = opts;
  const baseReboundRate = 0.027;
  const reboundRate = baseReboundRate
    * (1 - user._exerciseDedication * 0.45 - user._dietDedication * 0.30);

  // 추적 주차: 가장 오래된 코스 시작 ~ 현재
  // 비사용자는 createdAt 이후 8주만
  let weeks;
  let firstMs;
  if (courses && courses.length) {
    firstMs = Date.parse(courses[0].startDate);
    weeks = Math.ceil((Date.now() - firstMs) / (7 * 86400000));
  } else {
    weeks = 8;
    firstMs = Date.parse(daysAgo(weeks * 7));
  }
  weeks = clamp(weeks, 1, 56);

  let prevWeight = user.startWeight;
  let lastStop = null;

  for (let w = 0; w <= weeks; w++) {
    const dateMs = firstMs + w * 7 * 86400000;
    const date = new Date(dateMs).toISOString().slice(0, 10);

    let weight;
    if (courses) {
      const active = courses.find(c => {
        const s = Date.parse(c.startDate);
        const e = c._discontinueWeek != null
          ? s + c._discontinueWeek * 7 * 86400000
          : Date.now();
        return dateMs >= s && dateMs <= e;
      });
      if (active) {
        const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 86400000)));
        const userMaxLossPct = active._profile.maxLossPct * active._responseFactor;
        const expected = user.startWeight
          - user.startWeight * userMaxLossPct * (1 - Math.exp(-courseWeek / active._profile.tauWeeks));
        weight = clamp(expected + gauss(rand, 0, 0.4), user.startWeight * 0.55, user.startWeight * 1.05);
        lastStop = null;
      } else {
        if (!lastStop) {
          const justEnded = [...courses]
            .filter(c => c._discontinueWeek != null
              && (Date.parse(c.startDate) + c._discontinueWeek * 7 * 86400000) <= dateMs)
            .sort((a, b) => (Date.parse(b.startDate) + b._discontinueWeek * 7 * 86400000)
                          - (Date.parse(a.startDate) + a._discontinueWeek * 7 * 86400000))[0];
          if (justEnded) {
            const stopMs = Date.parse(justEnded.startDate) + justEnded._discontinueWeek * 7 * 86400000;
            lastStop = { stopWeight: prevWeight, stopMs };
          }
        }
        if (lastStop) {
          const wksSinceStop = Math.max(0, (dateMs - lastStop.stopMs) / (7 * 86400000));
          const maxRecovery = user.startWeight - lastStop.stopWeight;
          const recovered = maxRecovery * (1 - Math.exp(-reboundRate * wksSinceStop));
          weight = clamp(lastStop.stopWeight + recovered + gauss(rand, 0, 0.35),
                          user.startWeight * 0.55, user.startWeight * 1.10);
        } else {
          weight = user.startWeight + gauss(rand, 0, 0.5);
        }
      }
    } else {
      weight = prevWeight + gauss(rand, 0.05, 0.4);
    }
    weight = +clamp(weight, user.startWeight * 0.55, user.startWeight * 1.10).toFixed(1);
    const smoothed = w === 0 ? user.startWeight : +(prevWeight * 0.2 + weight * 0.8).toFixed(1);
    prevWeight = smoothed;

    // 부작용: 활성 코스의 약별 실제 발생률 + 초기 phase 가중
    const sideEffects = {};
    const active = courses?.find(c => {
      const s = Date.parse(c.startDate);
      const e = c._discontinueWeek != null
        ? s + c._discontinueWeek * 7 * 86400000
        : Date.now();
      return dateMs >= s && dateMs <= e;
    });
    if (active) {
      const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 86400000)));
      // willExperience로 미리 결정된 부작용만 보고 — 누적 prevalence가 임상값에 일치
      // phase factor: 부작용 보고 시점은 초반/증량 시기에 집중
      const phaseFactor = courseWeek === 0 ? 0.4
        : courseWeek < 4 ? 0.75
        : courseWeek < 8 ? 0.50
        : courseWeek < 12 ? 0.30
        : 0.15;
      const willExperience = active._willExperience || {};
      for (const k of Object.keys(willExperience)) {
        if (!willExperience[k]) { sideEffects[k] = false; continue; }
        // 경험할 부작용 — phase에 따라 보고. 평균적으로 코스 중 4-6번 보고
        sideEffects[k] = rand() < phaseFactor;
      }
    }

    out.logs.push({
      id: uid('log'),
      userId: user.id,
      seed: true,
      date,
      weight: smoothed,
      appetiteChange: clamp(Math.round(gauss(rand, active ? 4 : 3, 1)), 1, 5),
      satiety:        clamp(Math.round(gauss(rand, active ? 4 : 3, 1)), 1, 5),
      sideEffects,
      mealReduction:  clamp(Math.round(gauss(rand, active ? 3.5 : 2.5, 1)), 1, 5),
      // 일부 사용자만 메모 (커뮤니티 신호용)
      notes: (rand() < 0.04 && w > 0) ? ANON_NOTES_TEMPLATES[Math.floor(rand() * ANON_NOTES_TEMPLATES.length)] : '',
      createdAt: new Date(dateMs).toISOString(),
    });

    // 운동: 사용자별 dedication × 표본 축소율
    const exerciseCount = Math.max(0, Math.round(
      gauss(rand, (0.3 + user._exerciseDedication * 3.5) * exReduce, 1.0)
    ));
    for (let i = 0; i < exerciseCount; i++) {
      const e = pick(rand, EXERCISE_PATTERN, EXERCISE_PATTERN.map(x => x.weight));
      const dayOffset = Math.floor(rand() * 7);
      const exerciseDate = new Date(dateMs - dayOffset * 86400000).toISOString().slice(0, 10);
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

    // 식단: 식이 의지에 비례 + 표본 축소
    if (rand() < user._dietDedication * 0.6 * dietReduce) {
      const SAMPLE = ['요거트+그래놀라', '오트밀', '계란+토스트', '닭가슴살 샐러드', '단백질 쉐이크',
                       '두부 덮밥', '연어 포케', '비빔밥(소량)', '월남쌈', '닭곰탕',
                       '두부 스테이크', '계란찜+나물', '연어구이', '닭가슴살+브로콜리', '저녁 거름',
                       '그릭요거트', '아몬드 한 줌', '단백질바'];
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      const mealType = pick(rand, mealTypes, [0.25, 0.3, 0.3, 0.15]);
      const dayOffset = Math.floor(rand() * 7);
      const dietDate = new Date(dateMs - dayOffset * 86400000).toISOString().slice(0, 10);
      out.diets.push({
        id: uid('diet'),
        userId: user.id,
        seed: true,
        date: dietDate,
        mealType,
        description: SAMPLE[Math.floor(rand() * SAMPLE.length)],
        proteinG: rand() < 0.4 ? Math.round(gauss(rand, 25, 10)) : null,
        estCalories: rand() < 0.3 ? Math.round(gauss(rand, 400, 150)) : null,
        pattern: null,
        createdAt: new Date(dateMs).toISOString(),
      });
    }
  }
}

export function seedIfNeeded(count = 1031, seed = 20260518) {
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

  try {
    Storage.setUsers(out.users);
    Storage.setLogs(out.logs);
    Storage.setMedCourses(out.medCourses);
    localStorage.setItem('gl_doses',     JSON.stringify(out.doses));
    localStorage.setItem('gl_exercises', JSON.stringify(out.exercises));
    localStorage.setItem('gl_diets',     JSON.stringify(out.diets));
    Storage.markSeeded();
  } catch (e) {
    // QuotaExceededError — exercises/diets를 더 줄여서 재시도
    console.warn('Seed too large, retrying with smaller exercise/diet sample', e);
    Storage.setLogs([]);
    localStorage.removeItem('gl_exercises');
    localStorage.removeItem('gl_diets');
    Storage.setLogs(out.logs);
    // 운동/식단 50%만
    const exHalf = out.exercises.filter((_, i) => i % 2 === 0);
    const dietHalf = out.diets.filter((_, i) => i % 2 === 0);
    localStorage.setItem('gl_exercises', JSON.stringify(exHalf));
    localStorage.setItem('gl_diets', JSON.stringify(dietHalf));
    Storage.markSeeded();
  }
}

export function reseed(count = 1031) {
  Storage.setUsers(Storage.getUsers().filter(u => !u.seed));
  Storage.setLogs(Storage.getLogs().filter(l => !l.seed));
  Storage.setMedCourses(Storage.getMedCourses().filter(c => !c.seed));
  localStorage.setItem('gl_doses',     JSON.stringify(Storage.getDoses().filter(d => !d.seed)));
  localStorage.setItem('gl_exercises', JSON.stringify(Storage.getExercises().filter(e => !e.seed)));
  localStorage.setItem('gl_diets',     JSON.stringify(Storage.getDiets().filter(d => !d.seed)));
  Storage.resetSeed();
  seedIfNeeded(count);
}
