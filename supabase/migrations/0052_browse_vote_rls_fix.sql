-- 🚀 0052 — 하다 구경 평가 RLS 재수정 (0051 보완 — 실효성 없던 버그)
--
-- 문제: 0051 은 votes_self_insert 에 inline `exists(select 1 from challenges
--   where id = challenge_id and browse_visible = true)` 를 넣었으나, 이 서브쿼리는
--   **호출자(비멤버) 권한으로 평가**되어 challenges 의 SELECT RLS(challenges_member_read =
--   멤버만)에 막힘 → 비멤버는 closed/cheered/solo 행을 아예 못 봐서 exists=false →
--   여전히 평가 INSERT 거부. (open=is_open_challenge, 내가 멤버인 방=is_member_of 로만 통과)
--
-- 해결: browse_visible 판정을 **SECURITY DEFINER 헬퍼**로 — challenges RLS 우회.
--   (is_member_of / is_open_challenge 가 비멤버에도 동작하는 것과 동일한 방식)
--
-- 재실행 안전. DB(RLS)만 수정 — 클라/OTA 불필요.

-- 1. browse_visible 판정 헬퍼 (RLS 우회 — 행 가시성과 무관하게 컬럼값만 확인)
create or replace function public.is_browse_visible(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select browse_visible from public.challenges where id = challenge_uuid),
    false
  );
$$;
alter function public.is_browse_visible(uuid) owner to postgres;

-- 2. 평가 INSERT 정책 — 멤버 OR 누구나(open) OR 구경 노출(browse_visible)
drop policy if exists votes_self_insert on public.challenge_votes;
create policy votes_self_insert on public.challenge_votes
  for insert with check (
    user_id = auth.uid()
    and (
      public.is_member_of(challenge_id)
      or public.is_open_challenge(challenge_id)
      or public.is_browse_visible(challenge_id)
    )
  );
