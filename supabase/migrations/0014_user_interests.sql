-- 0014_user_interests.sql
-- v2.3: 관심 분류 시스템 — Hybrid (명시 등록 + 자동 추론)
-- 본인이 등록한 관심 카테고리/소분류 = open 챌린지 매칭 기준.
-- 자동 추론은 클라이언트에서 본인 챌린지 카테고리와 union.

create table if not exists public.user_interests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  category_id     int  not null references public.categories(id) on delete cascade,
  subcategory_id  int       references public.subcategories(id) on delete cascade,   -- null = 대분류 전체
  created_at      timestamptz not null default now(),
  unique (user_id, category_id, subcategory_id)
);

create index if not exists idx_user_interests_user on public.user_interests(user_id);
create index if not exists idx_user_interests_category on public.user_interests(category_id);

alter table public.user_interests enable row level security;

drop policy if exists interests_self_select on public.user_interests;
drop policy if exists interests_self_insert on public.user_interests;
drop policy if exists interests_self_delete on public.user_interests;

create policy interests_self_select on public.user_interests
  for select using (user_id = auth.uid());

create policy interests_self_insert on public.user_interests
  for insert with check (user_id = auth.uid());

create policy interests_self_delete on public.user_interests
  for delete using (user_id = auth.uid());
