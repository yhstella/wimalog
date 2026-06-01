-- 위마로그 보안 강화 v1 — DB 덤프(데이터 복사) 차단
-- ============================================================
-- 배경:
--   기존엔 patients/doses/weight_logs 등 모든 테이블에 `for select using (true)`가
--   걸려 있어, 브라우저 번들에 노출되는 anon 키만 있으면 누구나 REST API로
--   전체 행을 덤프할 수 있었음 (= 누적 리얼데이터 = 우리 해자가 통째로 복사 가능).
--
--   통계는 전부 집계 RPC 함수(avg_loss_curve 등)로 제공되는데, 이 함수들이
--   SECURITY INVOKER(기본값)라 anon이 호출하면 RLS를 받음 → 그래서 지금까지
--   public-read 정책이 "있어야만" 통계가 돌던 구조였음.
--
-- 수정:
--   1) 존재하는 집계 RPC를 SECURITY DEFINER로 전환 (집계값만 반환 → PII 누출 없음).
--   2) 존재하는 테이블에서 'public read%' 정책만 제거 (own write 정책은 보존).
--
-- 실행: Supabase Dashboard → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- 적용 후 확인: 로그아웃 상태에서 사이트 통계가 정상 표시되면 성공.
--
-- 방탄 설계: 일부 마이그레이션(004/005/007 등)이 미적용인 DB에서도
--   - 없는 함수는 pg_proc 조회로 자동 skip
--   - 없는 테이블은 to_regclass 가드로 자동 skip
--   - own write 정책은 이름 필터('public read%')로 보존
-- ============================================================
do $$
declare
  fn  text;
  r   record;
  tbl text;
  pol record;
  fnnames text[] := array[
    'avg_loss_curve','side_effect_rates','price_stats','top_recent_medications',
    'platform_scale','success_rate_at_week','exercise_stats','discontinuation_stats',
    'rebound_curve','rebound_by_exercise','pharmacies_by_region','region_pharmacy_detail',
    'pharmacy_summary'
  ];
  tbls text[] := array[
    'patients','med_courses','doses','weight_logs','exercises','diets','pharmacy_reports'
  ];
begin
  -- 1) 존재하는 집계 RPC만 SECURITY DEFINER + search_path 고정
  foreach fn in array fnnames loop
    for r in
      select p.oid, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('alter function public.%I(%s) security definer', fn, r.args);
      execute format('alter function public.%I(%s) set search_path = public, pg_temp', fn, r.args);
      raise notice 'fn altered: %(%)', fn, r.args;
    end loop;
  end loop;

  -- 2) 존재하는 테이블에서 'public read%' 정책만 제거 (own write 정책은 보존)
  foreach tbl in array tbls loop
    if to_regclass('public.' || tbl) is not null then
      for pol in
        select polname
        from pg_policy
        where polrelid = ('public.' || tbl)::regclass
          and polname ilike 'public read%'
      loop
        execute format('drop policy if exists %I on public.%I', pol.polname, tbl);
        raise notice 'policy dropped: % on %', pol.polname, tbl;
      end loop;
    end if;
  end loop;
end $$;

-- ── 롤백 (통계가 비면) ──
-- create policy "public read patients"    on public.patients    for select using (true);
-- create policy "public read med_courses" on public.med_courses for select using (true);
-- create policy "public read doses"       on public.doses       for select using (true);
-- create policy "public read weight_logs" on public.weight_logs for select using (true);
-- create policy "public read exercises"   on public.exercises   for select using (true);
-- create policy "public read diets"       on public.diets       for select using (true);
