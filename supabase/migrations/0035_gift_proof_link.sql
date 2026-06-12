-- 🚀 0035 — 응원 한잔 ↔ 인증 연결 (어느 인증 카드에서 보낸 한잔인지)
--
-- 용도 (2026-06-12 수령 UX v2):
--   본인 인증 카드에 "☕ 한잔 도착" 버튼을 띄우려면 한잔이 어느 인증에 온 것인지 알아야 함.
--   proof 가 없는 옛 주문·삭제된 인증은 인증 탭 상단 폴백 배너로 노출.
--
-- 재실행 안전.

alter table public.gift_orders
  add column if not exists proof_id uuid references public.proofs(id) on delete set null;

comment on column public.gift_orders.proof_id is
  '한잔을 보낸 인증 카드 (응원 한잔 전용, nullable). 인증 삭제 시 null 로 보존.';

-- 본인 인증 카드별 도착 한잔 조회용
create index if not exists idx_gift_orders_recipient_proof
  on public.gift_orders(recipient_id, challenge_id, proof_id);
