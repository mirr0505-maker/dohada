-- 🚀 0003 — 공개(open) 챌린지 + 둘러보기
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
--
-- 변경:
--   1) challenges.kind 에 'open' 허용
--   2) RLS 정책 추가: kind='open' 은 비멤버도 SELECT 가능 (challenges/members/proofs/cheers)
--   3) 비멤버가 자기 자신을 challenge_members 에 INSERT 가능 (참여하기) — 단 solo 챌린지엔 못 들어감

-- ─────────────────────────────────────────────
-- 1. kind check 제약 갱신
-- ─────────────────────────────────────────────
alter table public.challenges
  drop constraint if exists challenges_kind_check;

alter table public.challenges
  add constraint challenges_kind_check
  check (kind in ('closed', 'solo', 'open'));

-- ─────────────────────────────────────────────
-- 2. RLS — open 챌린지는 누구나 SELECT
-- ─────────────────────────────────────────────

-- challenges: 멤버 OR open
create policy challenges_open_read on public.challenges
  for select using (kind = 'open');

-- challenge_members: open 챌린지의 멤버 목록은 누구나
create policy members_open_read on public.challenge_members
  for select using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.kind = 'open'
    )
  );

-- proofs: open 챌린지의 인증은 누구나 SELECT (둘러보기 미리보기, 챌린지 방 진입 시 인증 피드)
create policy proofs_open_read on public.proofs
  for select using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.kind = 'open'
    )
  );

-- cheers: open 챌린지 응원도 누구나 (응원 카운트 표시)
create policy cheers_open_read on public.cheers
  for select using (
    exists (
      select 1
      from public.proofs p
      join public.challenges c on c.id = p.challenge_id
      where p.id = proof_id and c.kind = 'open'
    )
  );

-- ─────────────────────────────────────────────
-- 3. 비멤버 참여 — solo 챌린지는 막기
-- ─────────────────────────────────────────────
drop policy if exists members_self_insert on public.challenge_members;

create policy members_self_insert on public.challenge_members
  for insert with check (
    user_id = auth.uid()
    and not exists (
      -- solo 챌린지에는 creator 외 누구도 가입 불가
      select 1 from public.challenges c
      where c.id = challenge_id
        and c.kind = 'solo'
        and c.creator_id <> auth.uid()
    )
  );
