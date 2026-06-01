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
--   1) 집계 RPC 13개를 SECURITY DEFINER로 전환 (집계값만 반환하므로 PII 누출 없음).
--      → 함수는 owner(postgres) 권한으로 모든 행을 집계, anon은 함수 결과만 받음.
--   2) 모든 테이블의 `public read using(true)` 정책 제거.
--      → anon 직접 SELECT(테이블 덤프) 차단. 본인 데이터 read/write는 own-write
--        정책(for all using auth.uid()=...)으로 그대로 유지.
--
-- 실행: Supabase Dashboard → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- 적용 후 확인: 로그아웃 상태에서 사이트 통계가 정상 표시되면 성공.
-- ============================================================

-- ── 1. 집계 RPC → SECURITY DEFINER + search_path 고정 (인젝션 방지) ──
-- 002_stats.sql
alter function public.avg_loss_curve(text, text, text, numeric, numeric, integer[]) security definer;
alter function public.avg_loss_curve(text, text, text, numeric, numeric, integer[]) set search_path = public, pg_temp;

alter function public.side_effect_rates(text) security definer;
alter function public.side_effect_rates(text) set search_path = public, pg_temp;

alter function public.price_stats(text) security definer;
alter function public.price_stats(text) set search_path = public, pg_temp;

alter function public.top_recent_medications(integer) security definer;
alter function public.top_recent_medications(integer) set search_path = public, pg_temp;

alter function public.platform_scale() security definer;
alter function public.platform_scale() set search_path = public, pg_temp;

alter function public.success_rate_at_week(text, integer, numeric) security definer;
alter function public.success_rate_at_week(text, integer, numeric) set search_path = public, pg_temp;

-- 004_exercise_stats.sql
alter function public.exercise_stats(integer) security definer;
alter function public.exercise_stats(integer) set search_path = public, pg_temp;

-- 005_rebound_stats.sql
alter function public.discontinuation_stats(text) security definer;
alter function public.discontinuation_stats(text) set search_path = public, pg_temp;

alter function public.rebound_curve(text, integer[]) security definer;
alter function public.rebound_curve(text, integer[]) set search_path = public, pg_temp;

alter function public.rebound_by_exercise(text, integer, integer) security definer;
alter function public.rebound_by_exercise(text, integer, integer) set search_path = public, pg_temp;

-- 007_pharmacy_reports.sql
alter function public.pharmacies_by_region(text) security definer;
alter function public.pharmacies_by_region(text) set search_path = public, pg_temp;

alter function public.region_pharmacy_detail(text) security definer;
alter function public.region_pharmacy_detail(text) set search_path = public, pg_temp;

alter function public.pharmacy_summary() security definer;
alter function public.pharmacy_summary() set search_path = public, pg_temp;

-- ── 2. 테이블 직접 SELECT(덤프) 차단 — public read 정책 제거 ──
-- 본인 데이터 read/write는 "own write" (for all using auth.uid()=...) 정책이 담당하므로
-- 로그인 사용자의 본인 행 접근은 영향 없음. 익명 통계는 위 RPC가 담당.
drop policy if exists "public read patients"            on public.patients;
drop policy if exists "public read med_courses"         on public.med_courses;
drop policy if exists "public read doses"               on public.doses;
drop policy if exists "public read weight_logs"         on public.weight_logs;
drop policy if exists "public read exercises"           on public.exercises;
drop policy if exists "public read diets"               on public.diets;
drop policy if exists "public read pharmacy reports"    on public.pharmacy_reports;

-- pharmacy_reports: 제보(insert)는 누구나 가능 유지, 읽기는 RPC로만.
-- (007의 "anyone can submit pharmacy reports" insert 정책은 그대로 둠)

-- ── 3. 검증 쿼리 (선택) ──
-- 아래를 anon 키로 호출하면 []가 나와야 정상 (덤프 차단 확인):
--   select * from public.weight_logs limit 1;
-- 아래 RPC는 정상적으로 집계가 나와야 함:
--   select * from public.platform_scale();
