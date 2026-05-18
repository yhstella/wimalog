#!/usr/bin/env node
// Supabase에 가상 환자 3000명+ 시드
// 실행: node scripts/seed-supabase.js
// 필요: .env.local 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (RLS 우회 위해 service_role)
// 한 번만 실행. 재실행 시 기존 seed 데이터 삭제 후 다시 생성.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';

config({ path: '.env.local' });
config({ path: '.env' });

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('❌ .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요');
  console.error('   Supabase Dashboard → Settings → API → service_role secret');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const PATIENT_COUNT = parseInt(process.env.SEED_COUNT || '3000', 10);
const SEED = 20260518;

// ============================================================
// PRNG (deterministic)
// ============================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
function pick(arr, weights) {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function gauss(mean, sd) {
  const u = 1 - rand(), v = 1 - rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ============================================================
// 약별 임상 프로파일 (seedData.js와 동일)
// ============================================================
const MED_PROFILE = {
  wegovy:   { maxLossPct: 0.149, tauWeeks: 32, intervalDays: 7, doses: ['0.25mg','0.5mg','1.0mg','1.7mg','2.4mg'],
              priceByDose: { '0.25mg':250000,'0.5mg':270000,'1.0mg':320000,'1.7mg':380000,'2.4mg':470000 },
              sideRates: { nausea:0.44, vomiting:0.24, diarrhea:0.30, constipation:0.24, headache:0.14, abdomenPain:0.20, fatigue:0.11, dizziness:0.08, reflux:0.10, hairLoss:0.03 } },
  mounjaro: { maxLossPct: 0.209, tauWeeks: 32, intervalDays: 7, doses: ['2.5mg','5mg','7.5mg','10mg','12.5mg','15mg'],
              priceByDose: { '2.5mg':290000,'5mg':380000,'7.5mg':540000,'10mg':650000,'12.5mg':750000,'15mg':820000 },
              sideRates: { nausea:0.31, vomiting:0.15, diarrhea:0.23, constipation:0.17, headache:0.10, abdomenPain:0.12, fatigue:0.09, dizziness:0.06, reflux:0.08, hairLoss:0.06 } },
  saxenda:  { maxLossPct: 0.080, tauWeeks: 28, intervalDays: 1, doses: ['0.6mg','1.2mg','1.8mg','2.4mg','3.0mg'],
              priceByDose: { '0.6mg':9000,'1.2mg':10000,'1.8mg':11000,'2.4mg':12000,'3.0mg':12000 },
              sideRates: { nausea:0.39, vomiting:0.16, diarrhea:0.21, constipation:0.19, headache:0.14, abdomenPain:0.18, fatigue:0.13, dizziness:0.10, reflux:0.09, hairLoss:0.04 } },
  ozempic:  { maxLossPct: 0.110, tauWeeks: 30, intervalDays: 7, doses: ['0.25mg','0.5mg','1.0mg','2.0mg'],
              priceByDose: { '0.25mg':200000,'0.5mg':230000,'1.0mg':290000,'2.0mg':380000 },
              sideRates: { nausea:0.38, vomiting:0.20, diarrhea:0.27, constipation:0.22, headache:0.13, abdomenPain:0.18, fatigue:0.10, dizziness:0.07, reflux:0.10, hairLoss:0.03 } },
  zepbound: { maxLossPct: 0.195, tauWeeks: 32, intervalDays: 7, doses: ['2.5mg','5mg','7.5mg','10mg','12.5mg','15mg'],
              priceByDose: { '2.5mg':280000,'5mg':360000,'7.5mg':510000,'10mg':620000,'12.5mg':720000,'15mg':790000 },
              sideRates: { nausea:0.30, vomiting:0.14, diarrhea:0.22, constipation:0.16, headache:0.10, abdomenPain:0.12, fatigue:0.09, dizziness:0.06, reflux:0.08, hairLoss:0.06 } },
};

const REGION_PROFILE = [
  { region:'서울 대학로', weight:0.18, mult:0.78 },
  { region:'서울 종로',   weight:0.10, mult:0.85 },
  { region:'서울 강남',   weight:0.15, mult:1.10 },
  { region:'서울 송파',   weight:0.07, mult:1.05 },
  { region:'서울 신촌',   weight:0.06, mult:0.95 },
  { region:'경기 분당',   weight:0.08, mult:1.00 },
  { region:'경기 일산',   weight:0.06, mult:1.00 },
  { region:'경기 수원',   weight:0.06, mult:0.98 },
  { region:'부산',        weight:0.08, mult:0.95 },
  { region:'대구',        weight:0.05, mult:0.95 },
  { region:'인천',        weight:0.05, mult:1.00 },
  { region:'대전',        weight:0.03, mult:0.95 },
  { region:'광주',        weight:0.02, mult:0.95 },
  { region:'온라인',      weight:0.01, mult:0.85 },
];

const EXERCISE_PATTERN = [
  { id:'walking', weight:0.40, durMean:35 },
  { id:'home',    weight:0.18, durMean:25 },
  { id:'strength',weight:0.12, durMean:45 },
  { id:'jogging', weight:0.08, durMean:30 },
  { id:'yoga',    weight:0.08, durMean:40 },
  { id:'cycling', weight:0.06, durMean:50 },
  { id:'hiking',  weight:0.04, durMean:90 },
  { id:'swimming',weight:0.02, durMean:40 },
  { id:'sports',  weight:0.02, durMean:60 },
];

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 환자 1명 생성 (모든 관련 데이터)
// ============================================================
function generatePatient(idx) {
  const gender = pick(['F','M'], [0.72, 0.28]);
  const ageGroup = pick(['20s','30s','40s','50s','60s+'], [0.10, 0.34, 0.34, 0.17, 0.05]);
  const heightMean = gender === 'F' ? 161 : 173;
  const height = Math.round(clamp(gauss(heightMean, 6), 145, 195));
  const startBMI = clamp(gauss(31.5, 3.2), 25, 45);
  const startWeight = +(startBMI * (height / 100) ** 2).toFixed(1);
  const targetWeight = +(startWeight * (1 - clamp(gauss(0.18, 0.05), 0.08, 0.30))).toFixed(1);
  const isUser = rand() < 0.80;
  const numCourses = isUser ? (rand() < 0.18 ? 2 : 1) : 0;
  const exDedication = clamp(gauss(0.45, 0.25), 0.05, 0.95);
  const dietDedication = clamp(gauss(0.40, 0.25), 0.05, 0.95);

  const patientId = randomUUID();
  const patient = {
    id: patientId,
    seed: true,
    auth_user_id: null,
    nickname: '익명' + (idx + 1),
    gender, age_group: ageGroup, height,
    start_weight: startWeight, target_weight: targetWeight,
    conditions: {
      diabetes:     rand() < 0.18,
      prediabetes:  rand() < 0.20,
      fattyLiver:   rand() < 0.32,
      hypertension: rand() < 0.22,
      dyslipidemia: rand() < 0.28,
      thyroid:      rand() < 0.07,
    },
    purpose: pick(['weight','diabetes','fatty','doctor','other'], [0.70, 0.10, 0.10, 0.07, 0.03]),
    created_at: new Date(Date.parse(daysAgo(Math.round(gauss(60, 30))))).toISOString(),
  };

  const courses = [];
  const doses = [];
  const weight_logs = [];
  const exercises = [];
  const diets = [];

  // 사용 기간 tier — long-term 비율 ↑
  const meds = ['wegovy','mounjaro','saxenda','ozempic','zepbound'];
  const medWeights = [0.45, 0.27, 0.15, 0.08, 0.05];
  const frequencies = ['weekly','biweekly','occasional','intro'];
  const freqWeights = [0.55, 0.20, 0.10, 0.15];

  let totalSpan = 0;
  const courseMeta = [];
  for (let i = 0; i < numCourses; i++) {
    const med = pick(meds, medWeights);
    const profile = MED_PROFILE[med];
    const tier = rand();
    const weeks = tier < 0.20 ? Math.round(clamp(gauss(8, 3), 3, 12))
                : tier < 0.55 ? Math.round(clamp(gauss(20, 5), 12, 30))
                              : Math.round(clamp(gauss(46, 5), 30, 56));
    totalSpan += weeks;
    const courseStart = daysAgo(totalSpan * 7);
    const responseFactor = clamp(gauss(1.0, 0.30), 0.4, 1.7);
    const sideSeverity = clamp(gauss(1.0, 0.45), 0.2, 2.2);
    const frequency = pick(frequencies, freqWeights);
    const isCurrent = i === 0;
    const discontinueChance = 0.04 + (responseFactor < 0.7 ? 0.10 : 0) + (sideSeverity > 1.5 ? 0.10 : 0);
    const discontinued = !isCurrent || (rand() < discontinueChance && weeks > 4);
    const discontinueWeek = discontinued ? Math.round(4 + rand() * (weeks - 4)) : null;
    const willExperience = {};
    for (const [k, base] of Object.entries(profile.sideRates)) {
      willExperience[k] = rand() < clamp(base * sideSeverity, 0.02, 0.95);
    }

    const courseId = randomUUID();
    courses.push({
      id: courseId, patient_id: patientId,
      medication: med, frequency,
      start_date: courseStart,
      end_date: discontinued ? daysAgo(totalSpan * 7 - discontinueWeek * 7) : null,
      initial_dose: profile.doses[0],
      discontinue_reason: discontinued
        ? pick(['cost','sideeffect','noeffect','goal','supply','doctor','other'], [0.30,0.30,0.15,0.08,0.07,0.05,0.05])
        : null,
      notes: numCourses > 1 ? (i === 0 ? '현재' : `이전 라운드 ${i+1}`) : null,
      created_at: new Date(Date.parse(courseStart)).toISOString(),
    });
    courseMeta.push({ id: courseId, med, profile, weeks, responseFactor, sideSeverity, frequency, discontinueWeek, startDate: courseStart, willExperience });

    // doses
    const startMs = Date.parse(courseStart);
    const endMs = discontinued ? Date.parse(daysAgo(totalSpan * 7 - discontinueWeek * 7)) : Date.now();
    const stride = profile.intervalDays === 1 ? 7 : profile.intervalDays;
    const doseCountPerEntry = profile.intervalDays === 1 ? 7 : 1;
    let day = 0;
    while (true) {
      const dateMs = startMs + day * 86400000;
      if (dateMs > endMs) break;
      const escalationStep = Math.floor(day / 28);
      const doseIdx = Math.min(escalationStep, profile.doses.length - 1);
      const dose = profile.doses[doseIdx];
      const regionEntry = pick(REGION_PROFILE.map(r => r), REGION_PROFILE.map(r => r.weight));
      const basePrice = profile.priceByDose[dose] || 30000;
      const indiv = clamp(gauss(1.0, 0.10), 0.85, 1.2);
      const price = Math.round(basePrice * regionEntry.mult * indiv * doseCountPerEntry / 1000) * 1000;
      doses.push({
        id: randomUUID(), patient_id: patientId, course_id: courseId,
        date: new Date(dateMs).toISOString().slice(0, 10),
        dose, price, region: regionEntry.region,
        created_at: new Date(dateMs).toISOString(),
      });
      day += stride;
      if (day > 400) break;
    }
  }

  // weight_logs (주차별 시계열)
  courses.sort((a, b) => a.start_date.localeCompare(b.start_date));
  const baseReboundRate = 0.027;
  const reboundRate = baseReboundRate * (1 - exDedication * 0.45 - dietDedication * 0.30);
  const weeks = courses.length
    ? Math.min(56, Math.ceil((Date.now() - Date.parse(courses[0].start_date)) / (7 * 86400000)))
    : 8;
  const firstMs = courses.length ? Date.parse(courses[0].start_date) : Date.parse(daysAgo(weeks * 7));
  let prevWeight = startWeight;
  let lastStop = null;

  for (let w = 0; w <= weeks; w++) {
    const dateMs = firstMs + w * 7 * 86400000;
    const date = new Date(dateMs).toISOString().slice(0, 10);

    let weight;
    const active = courseMeta.find(c => {
      const s = Date.parse(c.startDate);
      const e = c.discontinueWeek != null ? s + c.discontinueWeek * 7 * 86400000 : Date.now();
      return dateMs >= s && dateMs <= e;
    });
    if (active) {
      const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 86400000)));
      const userMaxLossPct = active.profile.maxLossPct * active.responseFactor;
      const expected = startWeight - startWeight * userMaxLossPct * (1 - Math.exp(-courseWeek / active.profile.tauWeeks));
      weight = clamp(expected + gauss(0, 0.4), startWeight * 0.55, startWeight * 1.05);
      lastStop = null;
    } else if (courses.length) {
      if (!lastStop) {
        const justEnded = courseMeta
          .filter(c => c.discontinueWeek != null && (Date.parse(c.startDate) + c.discontinueWeek * 7 * 86400000) <= dateMs)
          .sort((a, b) => (Date.parse(b.startDate) + b.discontinueWeek * 7 * 86400000) - (Date.parse(a.startDate) + a.discontinueWeek * 7 * 86400000))[0];
        if (justEnded) {
          lastStop = { stopWeight: prevWeight, stopMs: Date.parse(justEnded.startDate) + justEnded.discontinueWeek * 7 * 86400000 };
        }
      }
      if (lastStop) {
        const wksSinceStop = Math.max(0, (dateMs - lastStop.stopMs) / (7 * 86400000));
        const maxRecovery = startWeight - lastStop.stopWeight;
        const recovered = maxRecovery * (1 - Math.exp(-reboundRate * wksSinceStop));
        weight = clamp(lastStop.stopWeight + recovered + gauss(0, 0.35), startWeight * 0.55, startWeight * 1.10);
      } else {
        weight = startWeight + gauss(0, 0.5);
      }
    } else {
      weight = prevWeight + gauss(0.05, 0.4);
    }
    weight = +clamp(weight, startWeight * 0.55, startWeight * 1.10).toFixed(1);
    const smoothed = w === 0 ? startWeight : +(prevWeight * 0.2 + weight * 0.8).toFixed(1);
    prevWeight = smoothed;

    const sideEffects = {};
    if (active) {
      const courseWeek = Math.max(0, Math.floor((dateMs - Date.parse(active.startDate)) / (7 * 86400000)));
      const phaseFactor = courseWeek === 0 ? 0.4 : courseWeek < 4 ? 0.75 : courseWeek < 8 ? 0.50 : courseWeek < 12 ? 0.30 : 0.15;
      for (const k of Object.keys(active.willExperience)) {
        if (!active.willExperience[k]) { sideEffects[k] = false; continue; }
        sideEffects[k] = rand() < phaseFactor;
      }
    }

    weight_logs.push({
      id: randomUUID(), patient_id: patientId, date,
      weight: smoothed,
      appetite_change: clamp(Math.round(gauss(active ? 4 : 3, 1)), 1, 5),
      satiety:         clamp(Math.round(gauss(active ? 4 : 3, 1)), 1, 5),
      meal_reduction:  clamp(Math.round(gauss(active ? 3.5 : 2.5, 1)), 1, 5),
      side_effects: sideEffects,
      created_at: new Date(dateMs).toISOString(),
    });

    // 운동 — 매주 평균 ~3회
    const exerciseCount = Math.max(0, Math.round(gauss(0.3 + exDedication * 3.5, 1.0)));
    for (let i = 0; i < exerciseCount; i++) {
      const e = pick(EXERCISE_PATTERN, EXERCISE_PATTERN.map(x => x.weight));
      const dayOffset = Math.floor(rand() * 7);
      exercises.push({
        id: randomUUID(), patient_id: patientId,
        date: new Date(dateMs - dayOffset * 86400000).toISOString().slice(0, 10),
        type: e.id,
        duration_min: Math.max(10, Math.round(gauss(e.durMean, e.durMean * 0.3))),
        intensity: clamp(Math.round(gauss(2 + exDedication * 2, 1)), 1, 5),
        created_at: new Date(dateMs).toISOString(),
      });
    }

    // 식단
    if (rand() < dietDedication * 0.6) {
      const SAMPLE = ['요거트+그래놀라','오트밀','계란+토스트','닭가슴살 샐러드','단백질 쉐이크','두부 덮밥','연어 포케','비빔밥(소량)','월남쌈','닭곰탕','두부 스테이크','계란찜+나물','연어구이','닭가슴살+브로콜리','저녁 거름','그릭요거트','아몬드 한 줌','단백질바'];
      const mealTypes = ['breakfast','lunch','dinner','snack'];
      const mealType = pick(mealTypes, [0.25, 0.3, 0.3, 0.15]);
      const dayOffset = Math.floor(rand() * 7);
      diets.push({
        id: randomUUID(), patient_id: patientId,
        date: new Date(dateMs - dayOffset * 86400000).toISOString().slice(0, 10),
        meal_type: mealType,
        description: SAMPLE[Math.floor(rand() * SAMPLE.length)],
        protein_g: rand() < 0.4 ? Math.round(gauss(25, 10)) : null,
        est_calories: rand() < 0.3 ? Math.round(gauss(400, 150)) : null,
        created_at: new Date(dateMs).toISOString(),
      });
    }
  }

  return { patient, courses, doses, weight_logs, exercises, diets };
}

// ============================================================
// 메인 — 시드 데이터 생성 + Supabase insert (batch)
// ============================================================
async function main() {
  console.log(`📊 Supabase에 ${PATIENT_COUNT}명 가상 환자 시드 시작...`);
  console.log(`   URL: ${URL}`);

  // 1. 기존 seed 데이터 삭제
  console.log('🧹 기존 seed 데이터 삭제 중...');
  const { error: delErr } = await sb.from('patients').delete().eq('seed', true);
  if (delErr) console.warn('   삭제 경고:', delErr.message);

  // 2. 생성 + batch insert
  const BATCH = 50;
  let totalCourses = 0, totalDoses = 0, totalLogs = 0, totalEx = 0, totalDiets = 0;

  for (let start = 0; start < PATIENT_COUNT; start += BATCH) {
    const end = Math.min(start + BATCH, PATIENT_COUNT);
    const patientsBatch = [];
    const coursesBatch = [];
    const dosesBatch = [];
    const logsBatch = [];
    const exBatch = [];
    const dietsBatch = [];

    for (let i = start; i < end; i++) {
      const { patient, courses, doses, weight_logs, exercises, diets } = generatePatient(i);
      patientsBatch.push(patient);
      coursesBatch.push(...courses);
      dosesBatch.push(...doses);
      logsBatch.push(...weight_logs);
      exBatch.push(...exercises);
      dietsBatch.push(...diets);
    }

    // FK 순서 — patients → med_courses → doses/weight_logs/exercises/diets
    const ins = async (table, rows) => {
      if (!rows.length) return;
      const chunks = [];
      for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
      for (const c of chunks) {
        const { error } = await sb.from(table).insert(c);
        if (error) throw new Error(`${table} insert 실패: ${error.message}`);
      }
    };
    await ins('patients', patientsBatch);
    await ins('med_courses', coursesBatch);
    await ins('doses', dosesBatch);
    await ins('weight_logs', logsBatch);
    await ins('exercises', exBatch);
    await ins('diets', dietsBatch);

    totalCourses += coursesBatch.length;
    totalDoses += dosesBatch.length;
    totalLogs += logsBatch.length;
    totalEx += exBatch.length;
    totalDiets += dietsBatch.length;

    process.stdout.write(`\r   ${end}/${PATIENT_COUNT}명 완료 (${Math.round(end/PATIENT_COUNT*100)}%) — logs ${totalLogs.toLocaleString()}건`);
  }
  console.log('');
  console.log(`✅ 시드 완료:`);
  console.log(`   환자        ${PATIENT_COUNT.toLocaleString()}명`);
  console.log(`   약 코스     ${totalCourses.toLocaleString()}개`);
  console.log(`   투약 기록   ${totalDoses.toLocaleString()}건`);
  console.log(`   체중 로그   ${totalLogs.toLocaleString()}건`);
  console.log(`   운동 기록   ${totalEx.toLocaleString()}건`);
  console.log(`   식단 기록   ${totalDiets.toLocaleString()}건`);
  console.log(`   합계        ${(totalCourses + totalDoses + totalLogs + totalEx + totalDiets + PATIENT_COUNT).toLocaleString()} rows`);
}

main().catch(e => { console.error('❌ 실패:', e.message); process.exit(1); });
