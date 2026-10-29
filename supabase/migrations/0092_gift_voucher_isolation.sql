-- 🚀 0092 — 교환권 격리: 보낸 사람이 받는 사람의 교환권(바코드 참조)을 못 읽게 (PHASE2_FINTECH_PLAN §9 WP1, D7)
--
-- 문제: RLS gift_orders_party_read(0032)는 보낸 사람·받는 사람 둘 다에게 "행 전체"를 연다.
--   RLS 는 행만 고를 뿐 컬럼은 못 막는다(메모 reference_rls-column-grant-gap).
--   실물 기프티콘이 켜지면 보낸 사람이 voucher_ref 로 바코드를 꺼내 쓸 수 있는 구조였다.
--   pg_payment_key(PG 환불 토큰)도 당사자 화면에 필요 없는 값이다.
--
-- 해법(0068 과 같은 컬럼 화이트리스트):
--   ① authenticated 의 테이블 단위 SELECT 를 회수하고, 두 컬럼을 뺀 나머지만 컬럼 단위로 다시 준다
--   ② 교환권은 받는 사람 본인 + 발급된 상태일 때만 my_gift_voucher() 로 꺼낸다
--
-- ⚠️ 배포 순서: 클라 OTA(select 목록에서 voucher_ref 제거)가 **먼저**다.
--   구 클라가 voucher_ref 를 select 하는 상태로 이 파일을 적용하면 수령 화면이 42501 로 깨진다.
--   (클라의 나머지 gift_orders 조회는 이미 두 컬럼을 안 읽는다 — 2026-10-29 전수 확인)
-- ⚠️ 앞으로 gift_orders 에 컬럼을 추가하면, 클라가 읽어야 하는 컬럼은 아래 grant 에 직접 넣어야 보인다.
--
-- 재실행 안전 — revoke/grant 는 멱등.

-- ═════════════════════════════════════════════
-- ① 컬럼 화이트리스트
-- ═════════════════════════════════════════════
revoke select on public.gift_orders from anon, authenticated;

grant select (
  id, order_type, challenge_id, sender_id, recipient_id, product_tier,
  amount, status, fail_reason, created_at, updated_at, proof_id, donation_mode
) on public.gift_orders to authenticated;
-- 빠진 것: voucher_ref(교환권) · pg_payment_key(PG 토큰). service role(Edge Function)은 영향 없음.
-- SQL 함수는 전부 SECURITY DEFINER(owner postgres)라 영향 없음 — 0033·0057·0060·0075 확인.

-- ═════════════════════════════════════════════
-- ② my_gift_voucher — 받는 사람 본인만, 발급된 뒤에만
-- ═════════════════════════════════════════════
drop function if exists public.my_gift_voucher(uuid);
create function public.my_gift_voucher(p_order_id uuid)
returns text
language sql security definer stable set search_path = public as $$
  select o.voucher_ref
  from public.gift_orders o
  where o.id = p_order_id
    and o.recipient_id = auth.uid()
    and o.status in ('issued', 'delivered', 'redeemed');
$$;

alter function public.my_gift_voucher(uuid) owner to postgres;
grant execute on function public.my_gift_voucher(uuid) to authenticated;

-- 검증 (적용 후):
--   1) select column_name from information_schema.column_privileges
--        where table_name='gift_orders' and grantee='authenticated' and privilege_type='SELECT';
--      → 13개, voucher_ref·pg_payment_key 없음
--   2) 보낸 사람 키로 rpc my_gift_voucher(<보낸 주문>) → null
--   3) 받는 사람 키로 같은 호출(발급 후) → 교환권 참조
