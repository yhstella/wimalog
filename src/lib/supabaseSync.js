// OAuth 가입자 입력 데이터를 Supabase에 자동 동기화
// storage.js의 emit 이벤트를 구독해 백그라운드 push
// 익명 사용자(localStorage 전용)는 sync 안 함
import { supabase, supabaseConfigured } from './supabaseClient.js';
import { Storage, onStorageEvent } from './storage.js';

// OAuth 사용자 ID는 auth.js에서 'oauth-{auth_user_uuid}' 형태로 만들어짐
function authUserIdOf(wimaUserId) {
  if (!wimaUserId?.startsWith('oauth-')) return null;
  return wimaUserId.slice(6);
}

// patient row 캐시 (auth_user_id → patient.id)
const patientCache = new Map();

async function ensurePatient(user) {
  if (!supabaseConfigured) return null;
  const authUserId = authUserIdOf(user.id);
  if (!authUserId) return null;  // 익명 사용자 sync 안 함
  if (patientCache.has(authUserId)) return patientCache.get(authUserId);

  // 이미 있는지 조회
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (existing) {
    patientCache.set(authUserId, existing.id);
    return existing.id;
  }

  // 없으면 patients row 생성
  const { data: created, error } = await supabase
    .from('patients')
    .insert({
      auth_user_id: authUserId,
      seed: false,
      nickname: user.nickname,
      gender: user.gender,
      age_group: user.ageGroup,
      height: user.height || null,
      start_weight: user.startWeight || null,
      target_weight: user.targetWeight || null,
      conditions: user.conditions || {},
      purpose: user.purpose,
    })
    .select('id')
    .single();
  if (error) {
    console.warn('[sync] patient insert', error);
    return null;
  }
  patientCache.set(authUserId, created.id);
  return created.id;
}

// 테이블별 변환 함수 (wimalog 객체 → Supabase row)
const TRANSFORMERS = {
  patients: (item) => null,  // upsertUser는 ensurePatient에서 처리
  weight_logs: (item, patientId) => ({
    id: item.id,
    patient_id: patientId,
    date: item.date,
    weight: item.weight,
    appetite_change: item.appetiteChange ?? null,
    satiety: item.satiety ?? null,
    meal_reduction: item.mealReduction ?? null,
    side_effects: item.sideEffects || {},
    notes: item.notes || null,
  }),
  med_courses: (item, patientId) => ({
    id: item.id,
    patient_id: patientId,
    medication: item.medication,
    frequency: item.frequency || 'weekly',
    start_date: item.startDate,
    end_date: item.endDate || null,
    initial_dose: item.initialDose || null,
    discontinue_reason: item.discontinueReason || null,
    notes: item.notes || null,
  }),
  doses: (item, patientId) => ({
    id: item.id,
    patient_id: patientId,
    course_id: item.courseId || null,
    date: item.date,
    dose: item.dose,
    price: item.price || null,
    region: item.region || null,
    notes: item.notes || null,
  }),
  exercises: (item, patientId) => ({
    id: item.id,
    patient_id: patientId,
    date: item.date,
    type: item.type,
    duration_min: item.durationMin || null,
    intensity: item.intensity ?? null,
    notes: item.notes || null,
  }),
  diets: (item, patientId) => ({
    id: item.id,
    patient_id: patientId,
    date: item.date,
    meal_type: item.mealType,
    description: item.description || null,
    protein_g: item.proteinG ?? null,
    est_calories: item.estCalories ?? null,
  }),
};

// item.userId로 user 객체 가져옴 → ensurePatient → insert/update/delete
async function syncItem(kind, table, item) {
  if (!supabaseConfigured) return;
  if (table === 'patients') {
    // user 자체 — ensurePatient로 처리
    if (kind === 'add' || kind === 'update') {
      await ensurePatient(item);
    }
    return;
  }
  const transformer = TRANSFORMERS[table];
  if (!transformer) return;
  const user = item.userId ? Storage.getUser(item.userId) : null;
  if (!user) return;
  const patientId = await ensurePatient(user);
  if (!patientId) return;  // 익명 사용자 — sync skip

  try {
    if (kind === 'add') {
      const row = transformer(item, patientId);
      const { error } = await supabase.from(table).insert(row);
      if (error && error.code !== '23505') console.warn(`[sync] ${table} add`, error);  // 23505 = duplicate, OK
    } else if (kind === 'update') {
      const row = transformer(item, patientId);
      await supabase.from(table).update(row).eq('id', item.id);
    } else if (kind === 'remove') {
      await supabase.from(table).delete().eq('id', item.id);
    }
  } catch (e) {
    console.warn(`[sync] ${kind} ${table}`, e);
  }
}

let initialized = false;
export function startSupabaseSync() {
  if (initialized || !supabaseConfigured) return;
  initialized = true;
  onStorageEvent('add',    (table, item) => syncItem('add',    table, item));
  onStorageEvent('update', (table, item) => syncItem('update', table, item));
  onStorageEvent('remove', (table, item) => syncItem('remove', table, item));
  console.log('[sync] Supabase storage sync started');
}

// 페이지 로드 시 기존 localStorage 데이터를 Supabase로 일괄 동기화
// (OAuth 로그인 직후 first sync — 기존 익명 데이터를 보존하려면 호출)
export async function backfillUser(user) {
  if (!supabaseConfigured) return;
  const patientId = await ensurePatient(user);
  if (!patientId) return;

  const tables = [
    { name: 'weight_logs', getItems: () => Storage.getLogsByUser(user.id) },
    { name: 'med_courses', getItems: () => Storage.getMedCoursesByUser(user.id) },
    { name: 'doses',       getItems: () => Storage.getDosesByUser(user.id) },
    { name: 'exercises',   getItems: () => Storage.getExercisesByUser(user.id) },
    { name: 'diets',       getItems: () => Storage.getDietsByUser(user.id) },
  ];

  for (const t of tables) {
    const items = t.getItems().filter(x => !x.seed);
    if (!items.length) continue;
    const transformer = TRANSFORMERS[t.name];
    const rows = items.map(it => transformer(it, patientId));
    const { error } = await supabase.from(t.name).upsert(rows, { onConflict: 'id' });
    if (error) console.warn(`[sync] backfill ${t.name}`, error);
  }
  console.log('[sync] backfill complete for', user.nickname);
}
