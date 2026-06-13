-- 🚀 0042 — 비멤버(누구나 챌린지 미리보기) 읽기 전용화
--
-- 배경 (사용자 피드백): 홈 '관심 도전'·둘러보기에서 비멤버가 누구나(open) 방에 들어오면
--   응원(cheers)·기록 좋아요(log_likes)까지 가능했음 — 0022·0007 이 'or is_open_*' 로
--   "지나가는 사람도 open 챌린지 응원" 을 허용했기 때문. 의도된 설계였으나,
--   "비멤버는 인증·기록 열람만, 나머지는 합류 후" 로 정책 변경 (클라 UI 게이팅과 이중 잠금).
--
-- 변경: cheers_self_insert / log_likes_self_insert 에서 'or is_open_*' 제거 → 활성 멤버 전용.
-- 변경 없음(이미 멤버 전용): comments(인증 댓글, 0005) · log_comments(기록 댓글, 0007)
--                          · logs(기록, 0007) · chat_messages(대화, 0007)
-- 변경 없음(의도대로 비멤버 허용): challenge_votes(둘러보기 챌린지 평가) — 비멤버 평가가 본래 목적
-- 재실행 안전.

-- 응원 — 활성 멤버만 (0022 의 'or is_open_proof' 제거)
drop policy if exists cheers_self_insert on public.cheers;
create policy cheers_self_insert on public.cheers
  for insert with check (
    user_id = auth.uid() and public.is_member_of_proof(proof_id)
  );

-- 기록 좋아요 — 활성 멤버만 (0007 의 'or is_open_log' 제거)
drop policy if exists log_likes_self_insert on public.log_likes;
create policy log_likes_self_insert on public.log_likes
  for insert with check (
    user_id = auth.uid() and public.is_member_of_log(log_id)
  );

-- 검증:
--   1) 비멤버가 open 챌린지 인증에 응원 INSERT → RLS 거부
--   2) 비멤버가 open 챌린지 기록에 좋아요 INSERT → RLS 거부
--   3) 활성 멤버 응원/좋아요 → 정상 (is_member_of_* 통과)
--   4) 둘러보기 challenge_votes 평가 → 비멤버도 여전히 가능 (이 마이그레이션이 안 건드림)
