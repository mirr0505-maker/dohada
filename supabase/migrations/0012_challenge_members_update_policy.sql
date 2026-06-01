-- 0012_challenge_members_update_policy.sql
-- v2.2 도전 포기 도입 시 발견: challenge_members 의 UPDATE policy 가 빠져있었음.
-- paused_until (잠시 멈춤) + gave_up_at (도전 포기) 둘 다 본인만 update 가능해야.
-- 기존 SELECT/INSERT/DELETE 정책만 있고 UPDATE 누락 — silent fail 발생.

drop policy if exists members_self_update on public.challenge_members;
create policy members_self_update on public.challenge_members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
