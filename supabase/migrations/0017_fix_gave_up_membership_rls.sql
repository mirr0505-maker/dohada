-- 🚀 0017_fix_gave_up_membership_rls.sql
-- 🚀 기능명: 도전 포기한 멤버 RLS 접근 제한
-- 설명: 도전 포기(gave_up_at is not null)한 챌린지의 정보 및 관련 데이터(인증, 기록 등)가
--       포기한 본인의 RLS 조회 결과에서 완전히 숨겨지도록(hide) 헬퍼 함수를 수정합니다.

-- 🚀 is_member_of 헬퍼 갱신: 내가 이 챌린지의 활성 멤버인가?
create or replace function public.is_member_of(challenge_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = challenge_uuid 
      and user_id = auth.uid() 
      and gave_up_at is null
  );
$$;

-- 🚀 is_member_of_proof 헬퍼 갱신: 이 인증의 챌린지에 내가 활성 멤버인가?
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
    where p.id = proof_uuid 
      and m.user_id = auth.uid() 
      and m.gave_up_at is null
  );
$$;

-- 🚀 is_member_of_log 헬퍼 갱신: 이 기록(log)의 챌린지에 내가 활성 멤버인가?
create or replace function public.is_member_of_log(log_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 
    from public.logs l
    join public.challenge_members m on m.challenge_id = l.challenge_id
    where l.id = log_uuid 
      and m.user_id = auth.uid() 
      and m.gave_up_at is null
  );
$$;

-- 🚀 shares_challenge_with 헬퍼 갱신: 이 사용자와 내가 같은 활성 챌린지 멤버인가?
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
      and me.gave_up_at is null
  );
$$;
