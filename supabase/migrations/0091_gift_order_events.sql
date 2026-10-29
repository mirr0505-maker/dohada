-- 🚀 0091 — 한잔 주문 감사 로그 + 운영자 환불용 조회 RPC (PHASE2_FINTECH_PLAN §9 WP1, D5·D6)
--
-- 왜: gift_orders 는 상태가 바뀔 때마다 한 행을 덮어쓴다. 실결제가 켜지면
--   "이 주문이 언제 누구 손에 paid→refunded 가 됐나"를 분쟁·정산 대사에서 꺼낼 수 있어야 한다.
--   쓰기는 Edge Function(service role) 전용 — 클라는 이 테이블을 읽지도 쓰지도 못한다.
--
-- 재실행 안전 — if not exists / drop … if exists 후 재생성.

-- ═════════════════════════════════════════════
-- ① gift_order_events — 상태 전이 1건 = 1행 (지우지 않는다)
-- ═════════════════════════════════════════════
create table if not exists public.gift_order_events (
  id          bigserial primary key,
  order_id    uuid not null references public.gift_orders(id) on delete restrict,
  from_status text,                 -- null = 주문 생성
  to_status   text not null,
  actor_id    uuid references public.users(id) on delete set null,   -- 시스템 자동 처리면 null
  actor_role  text not null check (actor_role in ('sender','recipient','admin','system')),
  reason      text,
  pg_payload  jsonb,                -- PG 응답 요약 (카드정보 아님 — 원칙 1)
  created_at  timestamptz not null default now()
);

comment on table public.gift_order_events is
  '한잔 주문 상태 전이 감사 로그. 쓰기 = Edge Function(service role) 전용, 조회 = admin RPC 전용. 삭제·수정하지 않는다.';

create index if not exists idx_gift_order_events_order
  on public.gift_order_events(order_id, created_at);

alter table public.gift_order_events enable row level security;
-- 정책 없음 + 권한 회수 = service role 외 전면 차단
revoke all on public.gift_order_events from anon, authenticated;
revoke all on sequence public.gift_order_events_id_seq from anon, authenticated;

-- ═════════════════════════════════════════════
-- ② admin_search_gift_orders — 환불할 주문 찾기 (주문번호 앞자리 · 보낸/받는 사람 닉네임)
--    🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 첫 줄 is_admin() 게이트 필수
-- ═════════════════════════════════════════════
drop function if exists public.admin_search_gift_orders(text);
create function public.admin_search_gift_orders(p_q text)
returns table (
  id                 uuid,
  order_type         text,
  status             text,
  product_tier       text,
  amount             integer,
  sender_nickname    text,
  recipient_nickname text,
  challenge_title    text,
  created_at         timestamptz,
  updated_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select o.id, o.order_type, o.status, o.product_tier, o.amount,
         s.nickname, r.nickname, c.title, o.created_at, o.updated_at
  from public.gift_orders o
  join public.users s on s.id = o.sender_id
  join public.users r on r.id = o.recipient_id
  join public.challenges c on c.id = o.challenge_id
  where o.id::text ilike p_q || '%'
     or s.nickname ilike '%' || p_q || '%'
     or r.nickname ilike '%' || p_q || '%'
  order by o.created_at desc
  limit 30;
end $$;

alter function public.admin_search_gift_orders(text) owner to postgres;
grant execute on function public.admin_search_gift_orders(text) to authenticated;

-- ═════════════════════════════════════════════
-- ③ admin_list_gift_events — 한 주문의 전이 이력 (환불 전 확인용)
-- ═════════════════════════════════════════════
drop function if exists public.admin_list_gift_events(uuid);
create function public.admin_list_gift_events(p_order_id uuid)
returns table (
  from_status text,
  to_status   text,
  actor_role  text,
  reason      text,
  created_at  timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select e.from_status, e.to_status, e.actor_role, e.reason, e.created_at
  from public.gift_order_events e
  where e.order_id = p_order_id
  order by e.created_at asc, e.id asc;
end $$;

alter function public.admin_list_gift_events(uuid) owner to postgres;
grant execute on function public.admin_list_gift_events(uuid) to authenticated;

-- 검증:
--   1) 일반 유저 키로 select from gift_order_events → permission denied
--   2) 일반 유저 키로 rpc admin_search_gift_orders('a') → 42501 admin only
--   3) admin 키로 rpc admin_list_gift_events(<주문>) → 이력 (EF 배포 후 새 전이부터 쌓임)
