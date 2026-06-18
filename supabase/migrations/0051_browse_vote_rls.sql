-- 🚀 0051 — 하다 구경 평가(4가지) RLS 수정
--
-- 문제 (베타 관찰 2026-06-17): 하다 구경 카드에서 4가지 평가(✨😱🥹💫)를 누르면
--   다함께(closed)·응원받기(cheered)·나홀로(solo) 방에서 "new row violates row-level
--   security policy for table challenge_votes" 로 거부됨. 누구나(open)만 동작.
--
-- 원인: 0007 votes_self_insert 정책이 **멤버 OR open 챌린지**일 때만 INSERT 허용.
--   하다 구경(0050)은 전체 유형을 익명 노출 → 비멤버가 open 외 유형에 평가하면 RLS 거부.
--
-- 해결: 구경에 노출되는(browse_visible=true) 챌린지면 평가 INSERT 허용을 추가.
--   - user_id = auth.uid() 자기 행 강제는 유지(타인 명의 평가 방지)
--   - 멤버/open 경로는 그대로 유지(기존 둘러보기/방 동작 무탈)
--   - DELETE(평가 취소)는 0007 votes_self_delete(user_id=auth.uid())라 이미 동작 → 변경 없음
--   - 조회(my_votes·집계)는 browse_challenges RPC(security definer)가 담당 → SELECT 정책 안 건드림
--
-- 재실행 안전 (drop+recreate). 클라 변경·OTA 불필요(RLS만 수정).

drop policy if exists votes_self_insert on public.challenge_votes;
create policy votes_self_insert on public.challenge_votes
  for insert with check (
    user_id = auth.uid()
    and (
      public.is_member_of(challenge_id)
      or public.is_open_challenge(challenge_id)
      or exists (
        select 1 from public.challenges c
        where c.id = challenge_id and c.browse_visible = true
      )
    )
  );
