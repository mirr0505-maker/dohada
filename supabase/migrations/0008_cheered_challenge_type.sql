-- 🚀 0008 — '응원받기 (cheered)' 방 타입 추가
--
-- 미르 의도: "내가 도전하는데 내 지인들이 응원해주는 방"
--   - 도전자 = creator 1명 (인증·기록 가능)
--   - 응원자 = 초대된 지인 N명 (채팅·응원·댓글·선물만)
--   - 둘러보기 노출 X (지인 전용)
--   - 통합기획서 페르소나 2 (워킹맘 혈당 + 가족 응원) 직답
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.

-- ═════════════════════════════════════════════
-- 1. kind check 갱신 — 'cheered' 추가
-- ═════════════════════════════════════════════
alter table public.challenges
  drop constraint if exists challenges_kind_check;

alter table public.challenges
  add constraint challenges_kind_check
  check (kind in ('closed', 'solo', 'open', 'cheered'));

-- ═════════════════════════════════════════════
-- 2. helper 함수 — cheered 방이고 호출자가 creator 인가?
-- ═════════════════════════════════════════════
create or replace function public.can_create_in_challenge(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  -- cheered 방이면 creator 만, 다른 방은 멤버면 누구나
  select case
    when (select kind from public.challenges where id = challenge_uuid) = 'cheered'
      then exists (
        select 1 from public.challenges
        where id = challenge_uuid and creator_id = auth.uid()
      )
    else exists (
      select 1 from public.challenge_members
      where challenge_id = challenge_uuid and user_id = auth.uid()
    )
  end;
$$;

-- ═════════════════════════════════════════════
-- 3. proofs INSERT 정책 갱신 — cheered 방은 creator 만 인증
-- ═════════════════════════════════════════════
drop policy if exists proofs_self_insert on public.proofs;

create policy proofs_self_insert on public.proofs
  for insert with check (
    user_id = auth.uid()
    and public.can_create_in_challenge(challenge_id)
  );

-- ═════════════════════════════════════════════
-- 4. logs INSERT 정책 갱신 — cheered 방은 creator 만 기록
-- ═════════════════════════════════════════════
drop policy if exists logs_self_insert on public.logs;

create policy logs_self_insert on public.logs
  for insert with check (
    user_id = auth.uid()
    and public.can_create_in_challenge(challenge_id)
  );

-- ═════════════════════════════════════════════
-- 5. 나머지 정책은 그대로 유지
--    - chat_messages: 모든 멤버 (응원자도 채팅 가능)
--    - cheers / comments / challenge_votes / log_likes / log_comments:
--      모든 멤버 (응원자도 응원·댓글 가능)
--    - challenge_members INSERT: members_self_insert 그대로
--      → cheered 방은 creator 가 초대하면 자동 가입 (closed 와 같음)
-- ═════════════════════════════════════════════
