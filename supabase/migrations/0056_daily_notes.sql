-- 🚀 0056 — 하루의 리듬(아침 다짐·저녁 회고) + 지금 함께(presence)
--
-- 정체성: "인증하면 끝"을 구조적으로 깨서 하루 접점을 아침(다짐)·인증·저녁(회고) 3개로.
--   저밀도에서도 앱을 "살아있게" — 최근 30분 활동 파생 presence 카운트(신원 없음).
--
-- daily_notes = 전역 노트(challenge_id 는 MVP 항상 null, 미래 방별 노트용 예약).
--   1인 1일 kind별 1개(upsert) — 아침 다짐(intention) / 저녁 회고(reflection).
--   note_date 는 서버가 KST(Asia/Seoul)로 결정 → 클라가 날짜 안 넘겨도 하루 경계 일관(0049 교훈).
--
-- RLS(0046 pledges 패턴 미러): 전역 노트라 "동료" = 나와 하다를 공유하는 사람.
--   판정은 기존 SECURITY DEFINER 헬퍼 shares_challenge_with(user_id)(0005·0017,
--   활성 멤버십 공유 여부)만 사용 — 정책 안 서브쿼리 금지(0052 교훈).
--
-- 재실행 안전 — create table if not exists / create or replace / drop policy if exists.

-- ═════════════════════════════════════════════
-- 1. daily_notes — 아침 다짐·저녁 회고
-- ═════════════════════════════════════════════
create table if not exists public.daily_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete cascade,  -- MVP 항상 null(방별 노트 예약)
  kind         text not null check (kind in ('intention', 'reflection')),  -- 아침 다짐 / 저녁 회고
  content      text not null check (char_length(content) <= 200),
  note_date    date not null default (now() at time zone 'Asia/Seoul')::date,  -- 🚀 KST 기준 하루 경계
  visibility   text not null default 'fellow' check (visibility in ('fellow', 'private')),
  created_at   timestamptz not null default now(),
  -- 1인 1일 kind별 1개 (upsert 대상). challenge_id 는 MVP 항상 null 이라 유일성에서 제외.
  unique (user_id, kind, note_date)
);

create index if not exists idx_daily_notes_user_date on public.daily_notes (user_id, note_date);
create index if not exists idx_daily_notes_kind_date on public.daily_notes (kind, note_date);

alter table public.daily_notes enable row level security;

-- 조회: 본인 노트 전부 OR (fellow 공개 AND 작성자가 나와 하다를 공유하는 동료)
drop policy if exists daily_notes_select on public.daily_notes;
create policy daily_notes_select on public.daily_notes
  for select using (
    user_id = auth.uid()
    or (visibility = 'fellow' and public.shares_challenge_with(user_id))
  );

-- 등록: 본인 이름으로만
drop policy if exists daily_notes_self_insert on public.daily_notes;
create policy daily_notes_self_insert on public.daily_notes
  for insert with check (user_id = auth.uid());

-- 수정: 본인 노트만 (upsert 덮어쓰기 · visibility 토글)
drop policy if exists daily_notes_self_update on public.daily_notes;
create policy daily_notes_self_update on public.daily_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 삭제: 본인 노트만
drop policy if exists daily_notes_self_delete on public.daily_notes;
create policy daily_notes_self_delete on public.daily_notes
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 2. presence_now() — 지금 함께 (신원 없이 int 하나만)
--    의미: 내가 활성 멤버인 챌린지들의 다른 멤버 중, 최근 30분 내 활동한 distinct user 수(본인 제외).
--    활동 신호 = proofs(인증) + cheers(응원). daily_notes 는 전역이라 challenge 스코프가 애매 → 제외.
--    롤링 30분 창이라 타임존 무관. ⚠️ 어떤 신원 컬럼도 반환하지 않음(int only).
-- ═════════════════════════════════════════════
create or replace function public.presence_now()
returns int
language sql
security definer
stable
set search_path = public
as $$
  with my_challenges as (
    -- 내가 활성 멤버(포기 X)인 챌린지들
    select challenge_id
    from public.challenge_members
    where user_id = auth.uid()
      and gave_up_at is null
  ),
  recent_actors as (
    -- 최근 30분 내 인증한 사람
    select p.user_id
    from public.proofs p
    join my_challenges mc on mc.challenge_id = p.challenge_id
    where p.created_at >= now() - interval '30 minutes'
    union
    -- 최근 30분 내 응원한 사람 (응원 대상 인증이 내 챌린지들 안일 때)
    select ch.user_id
    from public.cheers ch
    join public.proofs p on p.id = ch.proof_id
    join my_challenges mc on mc.challenge_id = p.challenge_id
    where ch.created_at >= now() - interval '30 minutes'
  )
  select count(distinct user_id)::int
  from recent_actors
  where user_id <> auth.uid();     -- 본인 제외
$$;

grant execute on function public.presence_now() to authenticated;

-- 검증:
--   1) 동료가 fellow 회고 작성 → 나에게 SELECT 노출, private 은 본인만
--   2) 나와 하다 공유 안 하는 사람의 fellow 노트 → SELECT 거부(shares_challenge_with false)
--   3) 같은 user·kind·note_date 재 insert → unique 충돌(upsert onConflict 로 덮어쓰기)
--   4) 남의 이름으로 insert / 남의 노트 update·delete → RLS 거부
--   5) presence_now() → 최근 30분 인증·응원한 동료 수(본인 제외) int, 신원 미반환. 0명이면 0.
