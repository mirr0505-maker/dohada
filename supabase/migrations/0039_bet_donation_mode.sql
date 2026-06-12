-- 🚀 0039 — 내기 기부 모드 (commitment / pledge / always)
--
-- 배경: 내기 한잔에 기부 모드 3종 도입 (PHASE2 2.1, 사용자 확정):
--   commitment(본전·기본) / pledge(완주 기부 서약: 완주=기부·실패=환불) / always(무조건 기부)
--   ⑤a(나와의 내기)는 개설자가 주문 단위로 선택, ⑤c(다인)는 챌린지 설정을 각 주문이 복사.
--   정산 로직 단일 소스 = betSettlement.ts settleBet(donationMode) / claimPolicy.ts validateBetClaim.
--
-- 재실행 안전 — add column if not exists / drop+add constraint.

alter table public.gift_orders
  add column if not exists donation_mode text not null default 'commitment';

alter table public.gift_orders drop constraint if exists gift_orders_donation_mode_check;
alter table public.gift_orders
  add constraint gift_orders_donation_mode_check
  check (donation_mode in ('commitment','pledge','always'));

comment on column public.gift_orders.donation_mode is
  '내기 기부 모드 — commitment(본전)/pledge(완주 기부 서약)/always(무조건 기부). 응원(cheer)은 commitment 고정(무의미).';

-- 정산 환불 상태 'refunded' 추가 — auto_refund(발급 실패 환불)와 구분.
--   pledge 모드 미완주 / 다인 전원 미완주 → refunded (정산 결과, 발급 실패 아님).
alter table public.gift_orders drop constraint if exists gift_orders_status_check;
alter table public.gift_orders add constraint gift_orders_status_check check (status in (
  'created','canceled','pay_failed',
  'paid',
  'issued','issue_failed','auto_refund',
  'delivered','donated','redeemed',
  'refunded'                                  -- 정산 환불 (신규)
));

-- 검증:
--   1) 기존 주문(컬럼 신설 전) → 기본값 commitment 로 채워짐
--   2) donation_mode='foo' INSERT → check 위반 거부
--   3) status='refunded' 전이 허용
