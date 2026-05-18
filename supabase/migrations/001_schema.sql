-- 위마로그 Supabase 스키마 v1
-- 실행 방법: Supabase Dashboard → SQL Editor → 이 파일 내용 붙여넣고 Run

-- ============================================================
-- 1. 환자 demographic 테이블
-- ============================================================
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  seed boolean default false,                      -- 가상 환자(true) vs 실제 가입자(false)
  auth_user_id uuid references auth.users(id) on delete cascade,  -- 실제 가입자 연결 (seed=false)
  nickname text,
  gender text check (gender in ('F','M','X')),
  age_group text check (age_group in ('20s','30s','40s','50s','60s+')),
  height numeric(5,1),                             -- cm
  start_weight numeric(5,1),                       -- kg
  target_weight numeric(5,1),                      -- kg
  conditions jsonb default '{}'::jsonb,            -- { diabetes:true, fattyLiver:true, ... }
  purpose text,                                    -- 'weight'|'diabetes'|'fatty'|'doctor'|'other'
  created_at timestamptz default now()
);
create index if not exists idx_patients_seed on public.patients(seed);
create index if not exists idx_patients_gender_age on public.patients(gender, age_group);

-- ============================================================
-- 2. 약 코스 (사용 기간 단위)
-- ============================================================
create table if not exists public.med_courses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication text not null check (medication in ('wegovy','mounjaro','saxenda','ozempic','zepbound','other')),
  frequency text default 'weekly' check (frequency in ('weekly','biweekly','occasional','intro')),
  start_date date not null,
  end_date date,                                   -- null이면 진행 중
  initial_dose text,
  discontinue_reason text,                         -- 'cost'|'sideeffect'|'noeffect'|'goal'|'supply'|'doctor'|'other'
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_courses_patient on public.med_courses(patient_id);
create index if not exists idx_courses_medication on public.med_courses(medication);

-- ============================================================
-- 3. 투약 기록 (1회분 단위)
-- ============================================================
create table if not exists public.doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  course_id uuid references public.med_courses(id) on delete cascade,
  date date not null,
  dose text not null,                              -- '0.25mg', '1.0mg' 등
  price integer,                                   -- 원 단위
  region text,                                     -- '서울 강남' 등
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_doses_patient on public.doses(patient_id);
create index if not exists idx_doses_course on public.doses(course_id);
create index if not exists idx_doses_region on public.doses(region);

-- ============================================================
-- 4. 체중·증상 시계열 로그 (주간 또는 임의 시점)
-- ============================================================
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null,
  weight numeric(5,1) not null,                    -- kg
  appetite_change smallint check (appetite_change between 1 and 5),
  satiety smallint check (satiety between 1 and 5),
  meal_reduction smallint check (meal_reduction between 1 and 5),
  side_effects jsonb default '{}'::jsonb,          -- { nausea:true, vomiting:false, ... }
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_weight_patient_date on public.weight_logs(patient_id, date);

-- ============================================================
-- 5. 운동 기록 (선택적)
-- ============================================================
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null,
  type text,                                       -- 'walking'|'home'|'strength'|...
  duration_min integer,
  intensity smallint check (intensity between 1 and 5),
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_exercises_patient on public.exercises(patient_id);

-- ============================================================
-- 6. 식단 기록 (선택적)
-- ============================================================
create table if not exists public.diets (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null,
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text,
  protein_g integer,
  est_calories integer,
  created_at timestamptz default now()
);
create index if not exists idx_diets_patient on public.diets(patient_id);

-- ============================================================
-- 7. Row Level Security — 익명 사용자도 통계용 SELECT 가능
-- ============================================================
-- 시드 데이터 통계 노출은 OK. 실제 가입자 데이터는 본인만 수정 가능.

alter table public.patients      enable row level security;
alter table public.med_courses   enable row level security;
alter table public.doses         enable row level security;
alter table public.weight_logs   enable row level security;
alter table public.exercises     enable row level security;
alter table public.diets         enable row level security;

-- 누구나 익명 통계용 SELECT 허용 (개인 식별 정보는 schema 자체에서 제한)
drop policy if exists "public read patients"      on public.patients;
drop policy if exists "public read med_courses"   on public.med_courses;
drop policy if exists "public read doses"         on public.doses;
drop policy if exists "public read weight_logs"   on public.weight_logs;
drop policy if exists "public read exercises"     on public.exercises;
drop policy if exists "public read diets"         on public.diets;

create policy "public read patients"      on public.patients      for select using (true);
create policy "public read med_courses"   on public.med_courses   for select using (true);
create policy "public read doses"         on public.doses         for select using (true);
create policy "public read weight_logs"   on public.weight_logs   for select using (true);
create policy "public read exercises"     on public.exercises     for select using (true);
create policy "public read diets"         on public.diets         for select using (true);

-- 본인 데이터만 INSERT/UPDATE/DELETE (가입자 자기 데이터)
drop policy if exists "own write patients" on public.patients;
create policy "own write patients" on public.patients
  for all using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);

-- 다른 테이블은 patient_id가 본인 소유 patient를 가리키는지 체크
drop policy if exists "own write med_courses" on public.med_courses;
create policy "own write med_courses" on public.med_courses
  for all using (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  );

drop policy if exists "own write doses" on public.doses;
create policy "own write doses" on public.doses
  for all using (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  );

drop policy if exists "own write weight_logs" on public.weight_logs;
create policy "own write weight_logs" on public.weight_logs
  for all using (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  );

drop policy if exists "own write exercises" on public.exercises;
create policy "own write exercises" on public.exercises
  for all using (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  );

drop policy if exists "own write diets" on public.diets;
create policy "own write diets" on public.diets
  for all using (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.patients p where p.id = patient_id and p.auth_user_id = auth.uid())
  );
