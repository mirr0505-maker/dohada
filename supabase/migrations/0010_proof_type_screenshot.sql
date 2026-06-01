-- 0010_proof_type_screenshot.sql
-- v2.2: 인증 방식 = 카메라 + 보관함 스크린샷 양쪽 허용 (MVP_SCOPE §3.5 갱신)
-- challenges.proof_type 의 check 제약을 'photo' → ('photo','screenshot') 확장.
-- 운동·등산·사이클·걷기 앱 자체 기록 화면을 인증 증거로 활용하는 페르소나 직답.
-- 재실행 안전: drop constraint if exists.

alter table public.challenges drop constraint if exists challenges_proof_type_check;

alter table public.challenges
  add constraint challenges_proof_type_check
  check (proof_type in ('photo', 'screenshot'));
