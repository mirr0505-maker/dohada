-- 🚀 회원 탈퇴(계정 삭제) — 익명화 + 비활성 모델 표식 (LAUNCH_CHECKLIST #4)
--
-- 왜 하드삭제가 아니라 익명화인가:
--   public.users → auth.users 및 모든 콘텐츠 FK 가 on delete cascade.
--   auth.users 를 하드삭제하면 그 사람이 개설한 방·올린 인증·댓글까지 연쇄 삭제 =
--   "동료가 보던 박제"가 통째로 파괴된다 (박제 영구·동료 보호 정체성 위반).
--   그래서 탈퇴 = users 익명화 + 개인정보(PII) 삭제 + auth ban (재로그인 영구 차단).
--
--   실제 익명화·PII 삭제·ban 은 delete-account Edge Function(service role)이 수행한다.
--   이 마이그레이션은 "탈퇴한 계정" 을 식별하는 표식 컬럼만 추가한다.

alter table public.users
  add column if not exists deleted_at timestamptz;

comment on column public.users.deleted_at is
  '계정 삭제(탈퇴) 시각. set 되면 익명화된 비활성 계정(auth ban + PII 제거). '
  '공유 콘텐츠(인증·댓글·기록·대화·완주이야기)는 보존되고 작성자만 "탈퇴한 사람"으로 표시.';
