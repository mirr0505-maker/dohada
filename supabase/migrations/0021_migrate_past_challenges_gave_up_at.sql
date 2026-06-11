-- 0021_migrate_past_challenges_gave_up_at.sql
-- v2.5: 이전에 개설자 본인이 포기했으나 challenges.gave_up_at 컬럼 신설 전이라 NULL로 방치된 챌린지들의 gave_up_at 값을 보정합니다.
update public.challenges c
set gave_up_at = m.gave_up_at
from public.challenge_members m
where m.challenge_id = c.id
  and m.user_id = c.creator_id
  and m.gave_up_at is not null
  and c.gave_up_at is null;
