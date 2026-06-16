-- 🚀 0048 — 다짐(pledge) INSERT 를 cheered 방에서 도전자(개설자)만 허용
--
-- 배경: cheered(응원받기) = 도전자 1명만 도전, 나머지는 응원 동료(응원·댓글·채팅·선물만).
--   proofs/logs 는 0008 의 can_create_in_challenge() 로 "cheered → creator 만, 그 외 → 멤버"
--   를 이미 강제하지만, 0046 의 pledges_self_insert 는 is_member_of() 만 검사해서
--   cheered 응원 동료도 DB 레벨에선 다짐을 만들 수 있는 방어선 공백이 있었음.
--   (UI 는 isPledgeSubject = solo/cheered ? isCreator : isMember 로 막혀 있으나,
--    조작된 클라이언트 우회 가능 → 인증/기록과 동일한 잣대로 서버에서도 차단.)
--
-- 변경: pledges INSERT 정책의 is_member_of → can_create_in_challenge 로 교체.
--   - cheered  : creator 만 다짐 작성 (응원 동료는 거부)
--   - closed/open/solo : 멤버면 누구나 (기존과 동일 — can_create_in_challenge 의 else 분기)
--   UPDATE/DELETE 는 그대로(본인 행 한정) — 응원 동료는 INSERT 가 막혀 다짐 자체가 없으므로 무관.
--   (proofs/logs 도 INSERT 만 게이트하는 것과 동일 패턴)
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run. 재실행 안전.
-- 전제: 0008(can_create_in_challenge) · 0046(pledges) 이 먼저 적용돼 있어야 함.

drop policy if exists pledges_self_insert on public.pledges;
create policy pledges_self_insert on public.pledges
  for insert with check (
    user_id = auth.uid() and public.can_create_in_challenge(challenge_id)
  );

-- 검증:
--   1) cheered 방 개설자가 다짐 insert → 성공
--   2) cheered 방 응원 동료가 다짐 insert → RLS 거부 (이전엔 통과되던 케이스)
--   3) 다함께(closed)·누구나(open) 방 멤버가 다짐 insert → 성공 (기존 동작 유지)
--   4) 비멤버 insert → RLS 거부 (can_create_in_challenge 의 멤버십 검사로 동일하게 차단)
