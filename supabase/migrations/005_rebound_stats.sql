-- 위마로그 중단·회복 통계 RPC
-- 실행: SQL Editor에서 이 파일 실행
-- 목적: Statistics/PurposeCard/GuideDataWidget의 중단 관련 통계를 Supabase 풀데이터(8000+명) 기반으로

-- ============================================================
-- 1. 약별 중단 통계 (중단율 + 중단 사유 분포)
-- ============================================================
create or replace function public.discontinuation_stats(med text default null)
returns table (
  total_courses integer,
  discontinued_count integer,
  discontinue_rate numeric,
  reason_id text,
  reason_count integer,
  reason_pct numeric
)
language sql stable as $$
  with base as (
    select * from public.med_courses
    where med is null or medication = med
  ),
  totals as (
    select
      count(*)::integer as total_courses,
      count(*) filter (where end_date is not null)::integer as discontinued_count
    from base
  )
  select
    t.total_courses,
    t.discontinued_count,
    round((t.discontinued_count::numeric / nullif(t.total_courses, 0)::numeric), 4) as discontinue_rate,
    coalesce(b.discontinue_reason, 'unknown') as reason_id,
    count(*) filter (where b.end_date is not null)::integer as reason_count,
    round((count(*) filter (where b.end_date is not null)::numeric / nullif(t.discontinued_count, 0)::numeric), 4) as reason_pct
  from totals t
  cross join base b
  where b.end_date is not null
  group by t.total_courses, t.discontinued_count, b.discontinue_reason;
$$;

grant execute on function public.discontinuation_stats to anon, authenticated;

-- ============================================================
-- 2. 중단 후 회복 곡선 (N주차별 평균 회복률)
-- ============================================================
-- regain ratio = max(0, 중단후weight - 중단시점weight) / 감량분(lost_kg)
create or replace function public.rebound_curve(
  med text default null,
  weeks_arr integer[] default array[2, 4, 8, 12, 24, 36, 48]
)
returns table (
  week integer,
  n integer,
  avg_gain_pct numeric,
  avg_regain_ratio numeric
)
language plpgsql stable as $$
declare
  w integer;
begin
  for w in select unnest(weeks_arr) loop
    return query
    with stopped_courses as (
      select
        c.id, c.patient_id, c.end_date, c.start_date,
        p.start_weight,
        -- 중단 시점 체중 (end_date 전후 14일 내 가장 가까운 log)
        (select wl.weight from public.weight_logs wl
         where wl.patient_id = p.id
           and wl.date between c.end_date - interval '14 days' and c.end_date + interval '14 days'
         order by abs(extract(epoch from (wl.date - c.end_date))) asc limit 1) as stop_weight,
        -- 시작 시점 체중
        (select wl.weight from public.weight_logs wl
         where wl.patient_id = p.id
           and wl.date between c.start_date - interval '14 days' and c.start_date + interval '14 days'
         order by wl.date asc limit 1) as start_log_weight
      from public.med_courses c
      join public.patients p on p.id = c.patient_id
      where c.end_date is not null
        and (med is null or c.medication = med)
    ),
    with_loss as (
      select
        id, patient_id, end_date, stop_weight,
        coalesce(start_log_weight, start_weight) - stop_weight as lost_kg
      from stopped_courses
      where stop_weight is not null
    ),
    rebound_vals as (
      select
        sc.id,
        sc.stop_weight,
        sc.lost_kg,
        -- 중단 후 w주차에 가장 가까운 (이후) log의 weight
        (select wl.weight from public.weight_logs wl
         where wl.patient_id = sc.patient_id
           and wl.date >= sc.end_date + (w * 7)
         order by wl.date asc limit 1) as target_weight
      from with_loss sc
      where sc.lost_kg > 0
    ),
    calcs as (
      select
        (target_weight - stop_weight) / nullif(stop_weight, 0) * 100 as gain_pct,
        greatest(0, target_weight - stop_weight) / nullif(lost_kg, 0) as regain_ratio
      from rebound_vals
      where target_weight is not null
    )
    select
      w as week,
      count(*)::integer as n,
      round(avg(gain_pct)::numeric, 2) as avg_gain_pct,
      round(avg(regain_ratio)::numeric, 4) as avg_regain_ratio
    from calcs;
  end loop;
end;
$$;

grant execute on function public.rebound_curve to anon, authenticated;

-- ============================================================
-- 3. 운동량 기준 회복 그룹 비교 (active vs inactive at week N)
-- ============================================================
create or replace function public.rebound_by_exercise(
  med text default null,
  target_week integer default 24,
  threshold_min integer default 90
)
returns table (
  group_id text,
  n integer,
  avg_regain_pct numeric
)
language sql stable as $$
  with stopped_courses as (
    select
      c.id, c.patient_id, c.end_date, c.start_date,
      p.start_weight,
      (select wl.weight from public.weight_logs wl
       where wl.patient_id = p.id
         and wl.date between c.end_date - interval '14 days' and c.end_date + interval '14 days'
       order by abs(extract(epoch from (wl.date - c.end_date))) asc limit 1) as stop_weight,
      (select wl.weight from public.weight_logs wl
       where wl.patient_id = p.id
         and wl.date between c.start_date - interval '14 days' and c.start_date + interval '14 days'
       order by wl.date asc limit 1) as start_log_weight,
      -- 중단 후 평균 주당 운동 분
      (select coalesce(avg(weekly), 0) from (
         select sum(duration_min)::numeric as weekly
         from public.exercises e
         where e.patient_id = p.id and e.date > c.end_date
         group by date_trunc('week', e.date)
       ) wks) as ex_min_per_week
    from public.med_courses c
    join public.patients p on p.id = c.patient_id
    where c.end_date is not null
      and (med is null or c.medication = med)
  ),
  with_target as (
    select
      sc.id, sc.stop_weight, sc.ex_min_per_week,
      coalesce(sc.start_log_weight, sc.start_weight) - sc.stop_weight as lost_kg,
      (select wl.weight from public.weight_logs wl
       where wl.patient_id = sc.patient_id
         and wl.date >= sc.end_date + (target_week * 7)
       order by wl.date asc limit 1) as target_weight
    from stopped_courses sc
    where sc.stop_weight is not null
  ),
  ratios as (
    select
      case when ex_min_per_week >= threshold_min then 'active' else 'inactive' end as grp,
      greatest(0, target_weight - stop_weight) / nullif(lost_kg, 0) as regain_ratio
    from with_target
    where lost_kg > 0 and target_weight is not null
  )
  select
    grp as group_id,
    count(*)::integer as n,
    round((avg(regain_ratio) * 100)::numeric, 2) as avg_regain_pct
  from ratios
  group by grp;
$$;

grant execute on function public.rebound_by_exercise to anon, authenticated;
