-- 🚀 0036 — 나와의 내기 (self-bet) 알림 정합 (Phase 2 Stage 5 ⑤a)
--
-- 배경: 나와의 내기는 gift_orders 를 sender_id = recipient_id (본인=본인) 로 재사용한다.
--   0033 의 enqueue_gift_notif 는 응원 한잔 기준이라 self-order 에 대해
--   "내가 나에게 보냈어요 / 내가 받았어요" 같은 자기 알림을 만들어버린다 (노이즈).
--   solo = 알림 0건 원칙(2.6)과 정합하도록 self-order 는 알림을 만들지 않는다.
--   정산(받기/기부)은 사용자가 방 현황 탭에서 직접 하므로 알림이 필요 없다.
--
-- 스키마 변경 없음 — gift_orders 는 이미 order_type='bet' / grand_cup 티어를 지원(0032).
-- 재실행 안전 — create or replace.

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

  -- 🚀 나와의 내기 등 self-order(본인=본인)는 알림 생성 안 함 (자기 알림 노이즈 방지)
  if new.sender_id = new.recipient_id then return new; end if;

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

-- 검증:
--   1) self-bet 주문(sender=recipient) paid/donated/delivered 전이 → notification_queue 0행
--   2) 응원 한잔(sender≠recipient) 알림은 기존과 동일하게 생성
