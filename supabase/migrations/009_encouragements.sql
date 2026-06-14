-- ============================================================
-- 009. 응원의 한마디 wall (공개 익명 응원)
-- ============================================================
-- 목적: GLP-1 여정은 외롭다. 짧은 익명 응원을 모아 두 청중에 닿게 한다.
--   · 어른(신뢰): 신선한 실사용자 응원 = 사회적 증거 → 랜딩에 노출
--   · 아이(동기): "누군가 날 응원했어요" → 재방문 트리거
-- 설계 제약(안전장치): 한 줄(≤80자)만, 답글·DM 없음, 신고/숨김 모더레이션.
--
-- 보안(008 철학 유지): 테이블 직접 public-read 정책을 두지 않는다.
--   → 최근 N개는 recent_encouragements() RPC(SECURITY DEFINER)로만 노출.
--   → anon이 전체 행을 덤프하지 못함. 통계 RPC와 동일한 해자 보호.
--
-- 실행: Supabase Dashboard → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- 미적용이어도 사이트는 정상 — 컴포넌트가 localStorage seed로 graceful fallback.
-- ============================================================

create table if not exists public.encouragements (
  id uuid primary key default gen_random_uuid(),
  seed boolean default false,
  text text not null check (char_length(text) between 2 and 80),
  gender text check (gender in ('F','M','X')),
  age_group text,                                   -- '20s'..'60s+' (소프트, 검증 X)
  hidden boolean default false,                     -- admin/임계 신고 시 숨김
  reported_count smallint default 0,
  submitted_by uuid references auth.users(id) on delete set null,  -- 익명 OK (null 허용)
  submitted_at timestamptz default now()
);
create index if not exists idx_enc_recent on public.encouragements(submitted_at desc) where hidden = false;

alter table public.encouragements enable row level security;

-- Insert: 누구나 가능하되 seed=true 위조 차단 (실제 seed는 아래 INSERT가 직접 넣음)
drop policy if exists "anyone can post encouragement" on public.encouragements;
create policy "anyone can post encouragement" on public.encouragements
  for insert with check (seed = false);

-- Update/Delete: 본인 글만 (anon 글은 수정 불가 — 신고 RPC로만 가림)
drop policy if exists "owner can update own encouragement" on public.encouragements;
create policy "owner can update own encouragement" on public.encouragements
  for update using (auth.uid() = submitted_by);

drop policy if exists "owner can delete own encouragement" on public.encouragements;
create policy "owner can delete own encouragement" on public.encouragements
  for delete using (auth.uid() = submitted_by);

-- ⚠ public-read 정책 일부러 없음 — 아래 RPC로만 읽는다 (전체 덤프 차단).

-- ============================================================
-- RPC: 최근 응원 N개 (숨김·신고 누적 제외)
-- ============================================================
create or replace function public.recent_encouragements(lim integer default 12)
returns table (
  id uuid,
  text text,
  gender text,
  age_group text,
  submitted_at timestamptz,
  is_seed boolean
) language sql stable security definer set search_path = public, pg_temp as $$
  select id, text, gender, age_group, submitted_at, seed
  from public.encouragements
  where hidden = false and reported_count < 3
  order by submitted_at desc
  limit greatest(1, least(lim, 50));
$$;

-- ============================================================
-- RPC: 응원 신고 (reported_count++). 임계 3 이상이면 자동 숨김 처리됨.
-- ============================================================
create or replace function public.report_encouragement(eid uuid)
returns void language sql volatile security definer set search_path = public, pg_temp as $$
  update public.encouragements
  set reported_count = reported_count + 1,
      hidden = (reported_count + 1 >= 3)
  where id = eid;
$$;

-- ============================================================
-- RPC: 총 응원 수 (노출용 카운터)
-- ============================================================
create or replace function public.encouragement_count()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::bigint from public.encouragements where hidden = false;
$$;

grant execute on function public.recent_encouragements(integer) to anon, authenticated;
grant execute on function public.report_encouragement(uuid) to anon, authenticated;
grant execute on function public.encouragement_count() to anon, authenticated;

-- ============================================================
-- 시드 — wall이 cold start에 비지 않도록. 실제 응원과 자연스럽게 섞임.
-- ============================================================
insert into public.encouragements (seed, text, gender, age_group, submitted_at) values
  (true, '3주차 정체기였는데 여기 보고 다시 힘내요', 'F', '40s', now() - interval '2 days'),
  (true, '오심 2주 지나니 정말 살 만해요. 화이팅!', 'M', '30s', now() - interval '3 days'),
  (true, '−5kg 찍었어요! 다들 할 수 있어요', 'F', '30s', now() - interval '5 days'),
  (true, '격주로 줄여도 유지되네요. 포기 안 하길 잘했어요', 'F', '50s', now() - interval '6 days'),
  (true, '첫 주사 무서웠는데 막상 해보니 괜찮아요', 'F', '20s', now() - interval '8 days'),
  (true, '같이 기록하니 덜 외로워요', 'M', '40s', now() - interval '10 days')
on conflict do nothing;
