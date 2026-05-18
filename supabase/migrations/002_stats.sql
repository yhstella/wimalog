-- 위마로그 통계 뷰 + RPC 함수
-- 실행: schema 적용 후 SQL Editor에서 이 파일 실행

-- ============================================================
-- 코호트 평균 감량률 (주차별, BMI/약/성별/연령대 필터)
-- ============================================================
create or replace function public.avg_loss_curve(
  med text default null,
  gender_f text default null,
  age_grp text default null,
  bmi_min numeric default null,
  bmi_max numeric default null,
  weeks_arr integer[] default array[1,2,4,8,12,16,24,36,48]
)
returns table (
  week integer,
  n integer,
  avg_loss_pct numeric,
  median_loss_pct numeric
)
language plpgsql stable as $$
declare
  w integer;
begin
  for w in select unnest(weeks_arr) loop
    return query
    with course_lossvals as (
      select
        c.id,
        p.id as pid,
        p.start_weight,
        (
          select wl.weight from public.weight_logs wl
          where wl.patient_id = p.id and wl.date >= c.start_date + (w * 7 - 14)
          order by wl.date asc limit 1
        ) as target_weight,
        (
          select wl.weight from public.weight_logs wl
          where wl.patient_id = p.id
            and wl.date between c.start_date - interval '14 days' and c.start_date + interval '14 days'
          order by wl.date asc limit 1
        ) as start_log_weight
      from public.med_courses c
      join public.patients p on p.id = c.patient_id
      where (med is null or c.medication = med)
        and (gender_f is null or p.gender = gender_f)
        and (age_grp is null or p.age_group = age_grp)
        and (bmi_min is null or (p.start_weight / nullif(power(p.height/100.0, 2), 0)) >= bmi_min)
        and (bmi_max is null or (p.start_weight / nullif(power(p.height/100.0, 2), 0)) <  bmi_max)
        and (c.end_date is null or c.end_date >= c.start_date + (w * 7))  -- 해당 주차까지 추적 가능
    ),
    losspct as (
      select
        case
          when start_log_weight is not null then (start_log_weight - target_weight) / start_log_weight * 100
          else (start_weight - target_weight) / start_weight * 100
        end as lp
      from course_lossvals
      where target_weight is not null
    )
    select
      w as week,
      count(*)::integer as n,
      round(avg(lp)::numeric, 2) as avg_loss_pct,
      round(percentile_cont(0.5) within group (order by lp)::numeric, 2) as median_loss_pct
    from losspct;
  end loop;
end;
$$;

-- ============================================================
-- 약별 부작용 발생률 (코스 중 1회 이상 보고 비율)
-- ============================================================
create or replace function public.side_effect_rates(med text default null)
returns table (
  side_id text,
  reported_count integer,
  total_courses integer,
  rate numeric
)
language sql stable as $$
  with side_keys as (
    select unnest(array['nausea','vomiting','diarrhea','constipation','headache','abdomenPain','fatigue','dizziness','reflux','hairLoss']) as k
  ),
  filtered_courses as (
    select c.id, c.start_date,
           coalesce(c.end_date, current_date) as end_date
    from public.med_courses c
    where med is null or c.medication = med
  ),
  reports as (
    select
      sk.k as side_id,
      fc.id as course_id,
      bool_or(coalesce((wl.side_effects ->> sk.k)::boolean, false)) as reported
    from filtered_courses fc
    cross join side_keys sk
    left join public.weight_logs wl
      on wl.patient_id = (select patient_id from public.med_courses where id = fc.id limit 1)
     and wl.date between fc.start_date and fc.end_date
    group by sk.k, fc.id
  )
  select
    side_id,
    count(*) filter (where reported)::integer as reported_count,
    count(*)::integer as total_courses,
    round((count(*) filter (where reported)::numeric / nullif(count(*), 0)::numeric), 4) as rate
  from reports
  group by side_id;
$$;

-- ============================================================
-- 약별 가격 통계 (지역별)
-- ============================================================
create or replace function public.price_stats(med text default null)
returns table (
  region text,
  n integer,
  avg_price numeric,
  median_price numeric
)
language sql stable as $$
  select
    d.region,
    count(*)::integer as n,
    round(avg(d.price)::numeric, 0) as avg_price,
    round(percentile_cont(0.5) within group (order by d.price)::numeric, 0) as median_price
  from public.doses d
  join public.med_courses c on c.id = d.course_id
  where d.price > 0
    and (med is null or c.medication = med)
  group by d.region
  having count(*) >= 3
  order by avg_price asc;
$$;

-- ============================================================
-- 최근 30일 가장 많이 시작한 약 ranking
-- ============================================================
create or replace function public.top_recent_medications(days integer default 30)
returns table (
  medication text,
  start_count integer
)
language sql stable as $$
  select medication, count(*)::integer as start_count
  from public.med_courses
  where start_date >= current_date - days
  group by medication
  order by start_count desc;
$$;

-- ============================================================
-- 플랫폼 전체 규모 (CohortLive에서 사용)
-- ============================================================
create or replace function public.platform_scale()
returns table (
  total_patients integer,
  total_courses integer,
  total_doses integer,
  total_weight_logs integer,
  active_users_7d integer,
  new_patients_7d integer
)
language sql stable as $$
  select
    (select count(*) from public.patients)::integer,
    (select count(*) from public.med_courses)::integer,
    (select count(*) from public.doses)::integer,
    (select count(*) from public.weight_logs)::integer,
    (select count(distinct patient_id) from public.weight_logs where date >= current_date - 7)::integer,
    (select count(*) from public.patients where created_at >= current_date - 7)::integer;
$$;

-- ============================================================
-- 부작용 임계 이상 감량 비율 (success rate)
-- ============================================================
create or replace function public.success_rate_at_week(
  med text default null,
  week_n integer default 12,
  threshold_pct numeric default 5
)
returns table (
  n integer,
  success_count integer,
  rate numeric
)
language sql stable as $$
  with losspct as (
    select
      case
        when start_log.weight is not null then (start_log.weight - target_log.weight) / start_log.weight * 100
        else (p.start_weight - target_log.weight) / p.start_weight * 100
      end as lp
    from public.med_courses c
    join public.patients p on p.id = c.patient_id
    left join lateral (
      select weight from public.weight_logs wl
      where wl.patient_id = p.id
        and wl.date between c.start_date - interval '14 days' and c.start_date + interval '14 days'
      order by wl.date asc limit 1
    ) start_log on true
    left join lateral (
      select weight from public.weight_logs wl
      where wl.patient_id = p.id
        and wl.date >= c.start_date + (week_n * 7 - 14)
      order by wl.date asc limit 1
    ) target_log on true
    where target_log.weight is not null
      and (med is null or c.medication = med)
      and (c.end_date is null or c.end_date >= c.start_date + (week_n * 7))
  )
  select
    count(*)::integer as n,
    count(*) filter (where lp >= threshold_pct)::integer as success_count,
    round((count(*) filter (where lp >= threshold_pct)::numeric / nullif(count(*), 0)::numeric), 4) as rate
  from losspct;
$$;

-- 함수 호출 권한 (anon role도 호출 가능 — public stats)
grant execute on function public.avg_loss_curve to anon, authenticated;
grant execute on function public.side_effect_rates to anon, authenticated;
grant execute on function public.price_stats to anon, authenticated;
grant execute on function public.top_recent_medications to anon, authenticated;
grant execute on function public.platform_scale to anon, authenticated;
grant execute on function public.success_rate_at_week to anon, authenticated;
