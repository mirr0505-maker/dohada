-- 🚀 0033 — 응원 한잔 알림 + 기부 집계 (Phase 2 Stage 1.5)
--
-- 알림 3종 + 환불 1종 (모두 notification_queue 경유 — 푸시·알림함 동일 소스 원칙):
--   paid      → 받는 사람에게 "OO님이 ☕ 한잔을 보냈어요" (수령 화면 딥링크)
--   delivered → 보낸 사람에게 "OO님이 한잔을 받았어요 ☕"   (피드백 루프)
--   donated   → 보낸 사람에게 "OO님이 한잔을 기부로 돌렸어요 💚"
--   auto_refund → 보낸 사람에게 "발급 실패로 자동 환불되었어요"
-- flush-notifications 는 미지정 kind 를 preview 기반 일반 발송으로 폴백 — 수정 불필요.
--
-- 재실행 안전 — drop if exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. notification_queue — kind 확장 + 한잔 주문 참조
-- ═════════════════════════════════════════════
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in (
    'chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice','proof','log',
    'gift','gift_received','gift_donated','gift_refund'
  ));

alter table public.notification_queue
  add column if not exists gift_order_id uuid references public.gift_orders(id) on delete cascade;

-- ═════════════════════════════════════════════
-- 2. gift_orders 상태 변경 → 알림 enqueue
-- ═════════════════════════════════════════════
create or replace function public.enqueue_gift_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_sender_nick    text;
  v_recipient_nick text;
  v_tier text := case new.product_tier
                   when 'one_cup' then '☕ 한잔'
                   when 'hearty_cup' then '🍰 든든한 한잔'
                   else '🎁 거하게 한잔' end;
begin
  if new.status = old.status then return new; end if;

  if new.status = 'paid' then
    -- 받는 사람에게: 한잔 도착
    select nickname into v_sender_nick from public.users where id = new.sender_id;
    insert into public.notification_queue (user_id, kind, challenge_id, gift_order_id, actor_id, preview, scheduled_for)
    values (new.recipient_id, 'gift', new.challenge_id, new.id, new.sender_id,
            coalesce(v_sender_nick,'동료') || '님이 ' || v_tier || '을 보냈어요', now());

  elsif new.status = 'delivered' then
    -- 보낸 사람에게: 받았어요 피드백
    select nickname into v_recipient_nick from public.users where id = new.recipient_id;
    insert into public.notification_queue (user_id, kind, challenge_id, gift_order_id, actor_id, preview, scheduled_for)
    values (new.sender_id, 'gift_received', new.challenge_id, new.id, new.recipient_id,
            coalesce(v_recipient_nick,'동료') || '님이 ' || v_tier || '을 받았어요 ☕', now());

  elsif new.status = 'donated' then
    -- 보낸 사람에게: 기부했어요 피드백
    select nickname into v_recipient_nick from public.users where id = new.recipient_id;
    insert into public.notification_queue (user_id, kind, challenge_id, gift_order_id, actor_id, preview, scheduled_for)
    values (new.sender_id, 'gift_donated', new.challenge_id, new.id, new.recipient_id,
            coalesce(v_recipient_nick,'동료') || '님이 ' || v_tier || '을 기부로 돌렸어요 💚', now());

  elsif new.status = 'auto_refund' then
    -- 보낸 사람에게: 자동 환불 (돈 이벤트는 반드시 통지)
    insert into public.notification_queue (user_id, kind, challenge_id, gift_order_id, actor_id, preview, scheduled_for)
    values (new.sender_id, 'gift_refund', new.challenge_id, new.id, null,
            v_tier || ' 발급이 실패해 자동 환불되었어요', now());
  end if;

  return new;
end $$;

drop trigger if exists trg_enqueue_gift on public.gift_orders;
create trigger trg_enqueue_gift
  after update on public.gift_orders
  for each row execute procedure public.enqueue_gift_notif();

-- ═════════════════════════════════════════════
-- 3. 기부 집계 RPC — ImpactModal "함께 만든 기부" (개인 식별 없는 방 단위 합계)
--    gift_orders RLS 는 당사자만 조회라 멤버 전체 집계는 security definer 로만.
-- ═════════════════════════════════════════════
create or replace function public.challenge_donation_stats(p_challenge_id uuid)
returns integer
language sql security definer stable set search_path = public
as $$
  select count(*)::integer from public.gift_orders
  where challenge_id = p_challenge_id and status = 'donated';
$$;

-- 검증:
--   1) confirm-gift-payment 로 paid 전이 → notification_queue 에 kind='gift' 1행 (수신자)
--   2) claim-gift 받기 → 'gift_received' (발신자) / 기부 → 'gift_donated' (발신자)
--   3) challenge_donation_stats(방ID) — donated 주문 수와 일치
