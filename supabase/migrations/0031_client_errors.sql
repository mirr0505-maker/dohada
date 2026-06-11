-- 🚀 0031 — 클라이언트 에러 로그 (Sentry 대체 — 자체 수집)
--
-- Sentry 프로젝트/DSN 없이 앱 에러를 Supabase 에 직접 적재.
-- 조회는 운영자가 SQL Editor 에서 (SELECT 정책 없음 = 클라이언트 열람 불가).
--   select created_at, platform, is_fatal, message, context
--   from client_errors order by created_at desc limit 50;
--
-- 재실행 안전.

create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete set null,
  message    text not null check (char_length(message) <= 2000),
  stack      text check (char_length(stack) <= 8000),
  context    jsonb,
  platform   text,                                  -- ios / android
  is_fatal   boolean not null default false,        -- 전역 핸들러가 잡은 치명 에러 여부
  created_at timestamptz not null default now()
);

create index if not exists idx_client_errors_created
  on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- INSERT: 로그인 사용자만, 본인 id (또는 세션 조회 실패 시 null)
drop policy if exists ce_self_insert on public.client_errors;
create policy ce_self_insert on public.client_errors
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- SELECT/UPDATE/DELETE 정책 없음 → 클라이언트 접근 차단 (운영자는 SQL Editor)
