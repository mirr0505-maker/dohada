-- 🚀 0005 — RLS 무한 재귀 수정 (홈 화면 다운 사고 핫픽스)
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
--       (재실행 안전 — 모든 DROP IF EXISTS / CREATE OR REPLACE)
--
-- 원인:
--   0001 의 members_self_read 가 자기 자신 (challenge_members) 을 SELECT →
--   PostgreSQL 이 그 SELECT 에 또 RLS 적용 → 무한 재귀.
--   파급으로 challenges/proofs/cheers/comments 의 멤버 체크 정책 모두 죽음.
--
-- 해결:
--   SECURITY DEFINER 함수로 RLS 우회하여 멤버/공개 여부 체크.
--   auth.uid() 는 security definer 안에서도 호출자의 UID 그대로 보존됨 (Supabase 공식 패턴).
--   set search_path = public 으로 table-shadowing 공격 차단.

-- ═════════════════════════════════════════════
-- 1. Helper 함수 4개
-- ═════════════════════════════════════════════

-- 내가 이 챌린지의 멤버인가?
create or replace function public.is_member_of(challenge_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = challenge_uuid and user_id = auth.uid()
  );
$$;

-- 이 챌린지가 공개(open)인가?
create or replace function public.is_open_challenge(challenge_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = challenge_uuid and kind = 'open'
  );
$$;

-- 이 인증의 챌린지에 내가 멤버인가? (cheers / comments 용)
create or replace function public.is_member_of_proof(proof_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.proofs p
    join public.challenge_members m on m.challenge_id = p.challenge_id
    where p.id = proof_uuid and m.user_id = auth.uid()
  );
$$;

-- 이 인증이 공개 챌린지에 속하나? (cheers / comments 용)
create or replace function public.is_open_proof(proof_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.proofs p
    join public.challenges c on c.id = p.challenge_id
    where p.id = proof_uuid and c.kind = 'open'
  );
$$;

-- 이 사용자와 내가 같은 챌린지 멤버인가? (users 정책용)
create or replace function public.shares_challenge_with(other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.challenge_members me
    join public.challenge_members other
      on me.challenge_id = other.challenge_id
    where me.user_id = auth.uid()
      and other.user_id = other_user_id
  );
$$;

-- ═════════════════════════════════════════════
-- 2. challenge_members 정책 재작성 (직접 재귀 제거)
-- ═════════════════════════════════════════════
drop policy if exists members_self_read on public.challenge_members;
drop policy if exists members_open_read on public.challenge_members;

create policy members_self_read on public.challenge_members
  for select using (public.is_member_of(challenge_id));

create policy members_open_read on public.challenge_members
  for select using (public.is_open_challenge(challenge_id));

-- ═════════════════════════════════════════════
-- 3. challenges 정책 재작성 (간접 재귀 제거)
-- ═════════════════════════════════════════════
drop policy if exists challenges_member_read on public.challenges;

create policy challenges_member_read on public.challenges
  for select using (public.is_member_of(id));
-- challenges_open_read (kind = 'open') 은 자기 row 만 보므로 재귀 없음 → 0003 그대로 유지

-- ═════════════════════════════════════════════
-- 4. proofs 정책 재작성
-- ═════════════════════════════════════════════
drop policy if exists proofs_member_read on public.proofs;
drop policy if exists proofs_open_read on public.proofs;
drop policy if exists proofs_self_insert on public.proofs;

create policy proofs_member_read on public.proofs
  for select using (public.is_member_of(challenge_id));

create policy proofs_open_read on public.proofs
  for select using (public.is_open_challenge(challenge_id));

create policy proofs_self_insert on public.proofs
  for insert with check (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );
-- proofs_self_delete (user_id = auth.uid()) 은 재귀 없음 → 0001 그대로 유지

-- ═════════════════════════════════════════════
-- 5. cheers 정책 재작성
-- ═════════════════════════════════════════════
drop policy if exists cheers_member_read on public.cheers;
drop policy if exists cheers_open_read on public.cheers;

create policy cheers_member_read on public.cheers
  for select using (public.is_member_of_proof(proof_id));

create policy cheers_open_read on public.cheers
  for select using (public.is_open_proof(proof_id));
-- cheers_self_insert / cheers_self_delete 는 단순 auth.uid() 체크라 0001 그대로

-- ═════════════════════════════════════════════
-- 6. comments 정책 재작성
-- ═════════════════════════════════════════════
drop policy if exists comments_member_read on public.comments;
drop policy if exists comments_open_read on public.comments;
drop policy if exists comments_self_insert on public.comments;

create policy comments_member_read on public.comments
  for select using (public.is_member_of_proof(proof_id));

create policy comments_open_read on public.comments
  for select using (public.is_open_proof(proof_id));

create policy comments_self_insert on public.comments
  for insert with check (
    user_id = auth.uid() and public.is_member_of_proof(proof_id)
  );
-- comments_self_delete 는 단순 auth.uid() 체크라 0004 그대로

-- ═════════════════════════════════════════════
-- 7. users 정책 재작성
-- ═════════════════════════════════════════════
drop policy if exists users_self_read on public.users;

create policy users_self_read on public.users
  for select using (
    id = auth.uid() or public.shares_challenge_with(id)
  );
-- users_self_write / users_self_insert 는 단순 auth.uid() 체크라 0001 그대로
