-- 🚀 0002 — 방 종류(폐쇄/단독) + 잠시 멈춤
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.

-- ─────────────────────────────────────────────
-- 1. challenges.kind  (방 종류)
--    'closed' = 폐쇄형 (현재 멤버만, 초대로 참여)
--    'solo'   = 단독 (creator 본인만, 동료 없음)
-- ─────────────────────────────────────────────
alter table public.challenges
  add column if not exists kind text not null default 'closed'
  check (kind in ('closed', 'solo'));

-- ─────────────────────────────────────────────
-- 2. challenge_members.paused_until  (잠시 멈춤 종료일)
--    NULL = 정상.  미래 날짜 = 그 날짜까지 인증 의무 면제.
-- ─────────────────────────────────────────────
alter table public.challenge_members
  add column if not exists paused_until date;

-- ─────────────────────────────────────────────
-- 3. RLS — solo 챌린지는 creator 만 조회 가능
--    기존 challenges_member_read 정책에 더해 creator 단독 접근 가능.
--    (challenge_members 트리거가 creator 를 자동 가입시키므로 사실상 동일하지만
--     명시적으로 적어두면 의도가 명확.)
-- ─────────────────────────────────────────────
-- 기존 정책은 그대로 둠. 멤버 = creator (solo) → 자동으로 통과.
