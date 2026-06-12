-- 🚀 0034 — 포기한 챌린지 "조용한 보관 + 읽기 전용" (2026-06-12 결정)
--
-- AS-IS (0017): 포기자(gave_up_at not null)는 SELECT 까지 전면 차단 — 방 열람 자체가 불가.
-- TO-BE: 포기자도 자기 도전의 흔적을 "열람"은 가능 (조용한 보관함). 쓰기는 전면 차단 유지.
--   - SELECT 정책 10개: is_member_of* → is_viewer_of* (포기 여부 무관 멤버십) 로 교체
--   - INSERT/UPDATE/DELETE 정책: 변경 없음 — is_member_of*·can_create_in_challenge 가
--     gave_up_at is null 가드를 유지하므로 포기자는 대화·인증·기록·응원·댓글·평가 모두 불가
--     (완주 방의 마무리 유예보다 강한 잠금)
--
-- 재실행 안전 — drop if exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. 열람용 헬퍼 — 포기 여부 무관 "한때 멤버였는가"
-- ═════════════════════════════════════════════
create or replace function public.is_viewer_of(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = challenge_uuid
      and user_id = auth.uid()
  );
$$;
alter function public.is_viewer_of(uuid) owner to postgres;

create or replace function public.is_viewer_of_proof(proof_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.proofs p
    join public.challenge_members m on m.challenge_id = p.challenge_id
    where p.id = proof_uuid
      and m.user_id = auth.uid()
  );
$$;
alter function public.is_viewer_of_proof(uuid) owner to postgres;

create or replace function public.is_viewer_of_log(log_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.logs l
    join public.challenge_members m on m.challenge_id = l.challenge_id
    where l.id = log_uuid
      and m.user_id = auth.uid()
  );
$$;
alter function public.is_viewer_of_log(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 2. SELECT 정책 교체 (10개) — 열람은 viewer, 쓰기는 기존 그대로
-- ═════════════════════════════════════════════
drop policy if exists members_self_read on public.challenge_members;
create policy members_self_read on public.challenge_members
  for select using (public.is_viewer_of(challenge_id));

drop policy if exists challenges_member_read on public.challenges;
create policy challenges_member_read on public.challenges
  for select using (public.is_viewer_of(id));

drop policy if exists proofs_member_read on public.proofs;
create policy proofs_member_read on public.proofs
  for select using (public.is_viewer_of(challenge_id));

drop policy if exists cheers_member_read on public.cheers;
create policy cheers_member_read on public.cheers
  for select using (public.is_viewer_of_proof(proof_id));

drop policy if exists comments_member_read on public.comments;
create policy comments_member_read on public.comments
  for select using (public.is_viewer_of_proof(proof_id));

drop policy if exists votes_member_read on public.challenge_votes;
create policy votes_member_read on public.challenge_votes
  for select using (public.is_viewer_of(challenge_id));

drop policy if exists chat_member_read on public.chat_messages;
create policy chat_member_read on public.chat_messages
  for select using (public.is_viewer_of(challenge_id));

drop policy if exists logs_member_read on public.logs;
create policy logs_member_read on public.logs
  for select using (public.is_viewer_of(challenge_id));

drop policy if exists log_likes_member_read on public.log_likes;
create policy log_likes_member_read on public.log_likes
  for select using (public.is_viewer_of_log(log_id));

drop policy if exists log_comments_member_read on public.log_comments;
create policy log_comments_member_read on public.log_comments
  for select using (public.is_viewer_of_log(log_id));

-- 검증:
--   1) 포기 계정으로 해당 챌린지 SELECT → 보임 (proofs/chat/logs 포함)
--   2) 같은 계정으로 chat_messages INSERT → RLS 거부 (chat_self_insert 는 is_member_of 유지)
--   3) proofs INSERT → 거부 (can_create_in_challenge 의 gave_up 가드)
--   4) 무관한 제3자 → 여전히 안 보임 (viewer 도 멤버십 행 필요)
