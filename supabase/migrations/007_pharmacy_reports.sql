-- ============================================================
-- 007. 약국 가격 디렉토리 (공개 익명 제보)
-- ============================================================
-- 한국 의료법상 의원·처방 안내는 불가하나, 약국 가격은 공개 정보.
-- 사용자가 직접 제보한 약국 가격을 익명으로 디렉토리화.
-- Insert: 누구나 (signed out 포함). Select: 누구나 (디렉토리는 공개).
-- Update/Delete: 본인 제보만 (auth_user_id match) 또는 admin.

create table if not exists public.pharmacy_reports (
  id uuid primary key default gen_random_uuid(),
  seed boolean default false,
  region text not null,                            -- '서울 대학로', '서울 강남' 등
  region_id text,                                  -- 'seoul-daehakro' 등 — slug for URL
  pharmacy_name text not null,
  medication text not null check (medication in ('wegovy','mounjaro','saxenda','ozempic','zepbound')),
  dose text not null,                              -- '0.25mg', '5mg' 등
  price_per_4w integer not null check (price_per_4w >= 10000 and price_per_4w <= 5000000),
  purchase_date date,
  notes text,
  submitted_by uuid references auth.users(id) on delete set null,   -- 익명 OK (null 허용)
  submitted_at timestamptz default now(),
  -- 신뢰도 — 향후 추첨 인증·전화 검증 등에 활용
  trust_score smallint default 0
);
create index if not exists idx_phr_region on public.pharmacy_reports(region);
create index if not exists idx_phr_med on public.pharmacy_reports(medication);
create index if not exists idx_phr_pharmacy on public.pharmacy_reports(region, pharmacy_name);
create index if not exists idx_phr_submitted on public.pharmacy_reports(submitted_at desc);

-- RLS — 디렉토리는 누구나 read/write 가능
alter table public.pharmacy_reports enable row level security;

drop policy if exists "public read pharmacy reports" on public.pharmacy_reports;
create policy "public read pharmacy reports" on public.pharmacy_reports
  for select using (true);

drop policy if exists "anyone can submit pharmacy reports" on public.pharmacy_reports;
create policy "anyone can submit pharmacy reports" on public.pharmacy_reports
  for insert with check (true);

drop policy if exists "owner can update own report" on public.pharmacy_reports;
create policy "owner can update own report" on public.pharmacy_reports
  for update using (auth.uid() = submitted_by);

drop policy if exists "owner can delete own report" on public.pharmacy_reports;
create policy "owner can delete own report" on public.pharmacy_reports
  for delete using (auth.uid() = submitted_by);

-- ============================================================
-- RPC: 지역별 약국 리스트 + 약국별 평균 가격
-- ============================================================
create or replace function public.pharmacies_by_region(med text default null)
returns table (
  region text,
  region_id text,
  pharmacy_name text,
  report_count bigint,
  med_count bigint,
  avg_price numeric,
  median_price numeric,
  last_report_at timestamptz
) language sql stable as $$
  select
    region,
    region_id,
    pharmacy_name,
    count(*)::bigint as report_count,
    count(distinct medication)::bigint as med_count,
    avg(price_per_4w)::numeric as avg_price,
    percentile_cont(0.5) within group (order by price_per_4w)::numeric as median_price,
    max(submitted_at) as last_report_at
  from public.pharmacy_reports
  where (med is null or medication = med)
  group by region, region_id, pharmacy_name
  order by region, report_count desc;
$$;

-- ============================================================
-- RPC: 특정 지역 상세 — 약국 × 약·용량별 가격
-- ============================================================
create or replace function public.region_pharmacy_detail(region_param text)
returns table (
  pharmacy_name text,
  medication text,
  dose text,
  n bigint,
  avg_price numeric,
  median_price numeric,
  min_price integer,
  max_price integer,
  last_report_at timestamptz
) language sql stable as $$
  select
    pharmacy_name,
    medication,
    dose,
    count(*)::bigint as n,
    avg(price_per_4w)::numeric as avg_price,
    percentile_cont(0.5) within group (order by price_per_4w)::numeric as median_price,
    min(price_per_4w) as min_price,
    max(price_per_4w) as max_price,
    max(submitted_at) as last_report_at
  from public.pharmacy_reports
  where region = region_param
  group by pharmacy_name, medication, dose
  order by pharmacy_name, medication, dose;
$$;

-- ============================================================
-- RPC: 디렉토리 전체 요약
-- ============================================================
create or replace function public.pharmacy_summary()
returns table (
  total_reports bigint,
  total_regions bigint,
  total_pharmacies bigint,
  recent_30d bigint
) language sql stable as $$
  select
    count(*)::bigint as total_reports,
    count(distinct region)::bigint as total_regions,
    count(distinct (region, pharmacy_name))::bigint as total_pharmacies,
    count(*) filter (where submitted_at > now() - interval '30 days')::bigint as recent_30d
  from public.pharmacy_reports;
$$;

grant execute on function public.pharmacies_by_region(text) to anon, authenticated;
grant execute on function public.region_pharmacy_detail(text) to anon, authenticated;
grant execute on function public.pharmacy_summary() to anon, authenticated;
