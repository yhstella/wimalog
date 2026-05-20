-- 위마로그 운동 통계 RPC
-- 실행: schema 적용 후 SQL Editor에서 이 파일 실행
-- 목적: CohortLive '주당 평균 운동' 카드에 NA 대신 실제 값 표시

-- ============================================================
-- 운동 코호트 통계 — 최근 N일 활동 환자의 주당 평균 운동 시간
-- ============================================================
-- 정의:
--   - active_in_window: 최근 N일 운동 기록이 1건 이상인 환자
--   - avg_min_per_week: active 환자별 (총 운동 분 / N * 7)의 평균
--   - with_exercise_pct: 전체 환자 대비 active 환자 비율
create or replace function public.exercise_stats(days integer default 30)
returns table (
  n_total_patients integer,
  n_active_patients integer,
  avg_min_per_week numeric,
  median_min_per_week numeric,
  with_exercise_pct numeric
)
language sql stable as $$
  with per_patient as (
    select
      e.patient_id,
      sum(e.duration_min)::numeric / (days::numeric / 7.0) as min_per_week
    from public.exercises e
    where e.date >= current_date - days
      and e.duration_min > 0
    group by e.patient_id
  ),
  totals as (
    select count(*)::integer as total_patients from public.patients
  )
  select
    (select total_patients from totals) as n_total_patients,
    count(*)::integer as n_active_patients,
    round(avg(min_per_week)::numeric, 1) as avg_min_per_week,
    round(percentile_cont(0.5) within group (order by min_per_week)::numeric, 1) as median_min_per_week,
    round((count(*)::numeric / nullif((select total_patients from totals), 0)::numeric * 100), 1) as with_exercise_pct
  from per_patient;
$$;

grant execute on function public.exercise_stats to anon, authenticated;
