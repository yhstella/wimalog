-- ============================================================
-- 010. Web Push 구독 저장
-- ============================================================
-- 클라이언트가 pushManager.subscribe 후 endpoint+키를 여기 upsert.
-- 발송 서버(/api/send-push)가 service_role로 읽어 web-push 전송.
--
-- 보안: endpoint+키는 민감(타인 기기로 푸시 가능) → public read 정책 없음(008 철학).
--   anon은 insert/upsert/delete만. 읽기는 service_role(발송 함수)만.
--
-- 실행: Supabase Dashboard → SQL Editor → 붙여넣고 Run.
-- 미적용이어도 사이트 정상 — 구독은 되지만 발송 대상 목록에 안 들어감(조용히 skip).
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key,                       -- 브라우저 push 서비스 endpoint (고유)
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete set null,  -- 익명 OK
  user_agent text,
  created_at timestamptz default now(),
  last_sent_at timestamptz
);
create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- 누구나 자기 구독 등록/갱신/해제 (upsert를 위해 insert+update 필요)
drop policy if exists "anyone insert push sub" on public.push_subscriptions;
create policy "anyone insert push sub" on public.push_subscriptions
  for insert with check (true);

drop policy if exists "anyone update push sub" on public.push_subscriptions;
create policy "anyone update push sub" on public.push_subscriptions
  for update using (true);

drop policy if exists "anyone delete push sub" on public.push_subscriptions;
create policy "anyone delete push sub" on public.push_subscriptions
  for delete using (true);

-- ⚠ select 정책 없음 — anon이 endpoint 목록을 덤프하지 못함. 발송 함수는 service_role로 우회.
