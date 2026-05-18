-- v3 — patients/courses에 더 자세한 항목 추가
-- 실행: Supabase SQL Editor에서 1회 실행

-- patients 추가 컬럼
alter table public.patients
  add column if not exists occupation text,                  -- 직업 카테고리
  add column if not exists exercise_dedication numeric(3,2), -- 운동 의지 0-1
  add column if not exists diet_dedication     numeric(3,2), -- 식이 의지 0-1
  add column if not exists smoker  boolean default false,
  add column if not exists drinker_level text;               -- 'none'|'light'|'moderate'|'heavy'

-- med_courses 추가 컬럼
alter table public.med_courses
  add column if not exists satisfaction smallint check (satisfaction between 1 and 5),  -- 만족도
  add column if not exists cost_burden  smallint check (cost_burden between 1 and 5),   -- 비용 부담도
  add column if not exists side_severity numeric(3,2);                                  -- 부작용 강도 0.2-2.2

-- weight_logs 추가 컬럼 — 컨디션/수면
alter table public.weight_logs
  add column if not exists sleep_hours numeric(3,1),       -- 수면 시간
  add column if not exists stress_level smallint check (stress_level between 1 and 5),
  add column if not exists mood smallint check (mood between 1 and 5);

-- exercises 추가 컬럼
alter table public.exercises
  add column if not exists calories_burned integer,
  add column if not exists location text;                  -- 'home'|'gym'|'outdoor'|'park' 등

-- diets 추가 컬럼
alter table public.diets
  add column if not exists category text,                  -- 'healthy'|'balanced'|'treat'|'light'
  add column if not exists fat_g integer,
  add column if not exists carbs_g integer;
