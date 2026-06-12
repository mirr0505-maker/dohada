-- 🚀 0038 — 안내문(description) 길이 제약 완화 200 → 1000
--
-- 배경: 0001 에서 challenges.description 에 char_length <= 200 제약이 있었는데,
--   그동안 생성 마법사가 description 을 저장하지 않아(null) 드러나지 않았다.
--   0037 안내문 기능으로 실제 텍스트를 저장하면서 200자 초과 안내문이
--   challenges_description_check 위반으로 "만들기 실패"가 발생.
--   안내문은 합류 전 소개글이라 200자(한글 ~100자)는 짧다 → 1000자로 상향
--   (클라 입력 maxLength=1000 과 일치).
--
-- 재실행 안전 — drop if exists / add.

alter table public.challenges drop constraint if exists challenges_description_check;
alter table public.challenges
  add constraint challenges_description_check
  check (description is null or char_length(description) <= 1000);

-- 검증:
--   1) 길이 300 안내문으로 create_challenge → 정상 저장 (이전엔 실패)
--   2) 길이 1001 → 여전히 거부
