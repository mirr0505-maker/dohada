-- 0011_give_up_membership.sql
-- v2.2: 도전 포기 (soft delete) — 잠시 멈춤과 본질이 다른 액션.
-- 잠시 멈춤(paused_until) = 며칠 쉬었다 재개.  포기(gave_up_at) = 영구 중단, 본인 화면 hide.
-- 데이터(인증/응원/댓글/기록) 는 보존 — Phase 2 박제 도입 시 재활용 가능.

alter table public.challenge_members
  add column if not exists gave_up_at timestamptz;

-- 인덱스: 본인 챌린지 목록 fetch 시 gave_up_at is null 필터 빠르게
create index if not exists idx_challenge_members_active
  on public.challenge_members(user_id, challenge_id)
  where gave_up_at is null;
