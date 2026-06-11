-- 🚀 0032 — Phase 2 핀테크 Stage 1: 휴대폰 본인인증 + 응원 한잔 주문 (실돈 0원 골격)
--
-- 설계 근거: PHASE2_FINTECH_PLAN.md v0.4
--   - 본인인증 결과는 users 가 아니라 별도 테이블 — users 는 같은 방 멤버에게
--     전 컬럼 SELECT 가 열려 있어(0001 users_self_read) 생년월일·전화번호가 노출되기 때문.
--   - gift_orders 쓰기는 service role(Edge Function) 전용 — 클라이언트가 금액·상태를
--     직접 조작할 수 없게 RLS 에 INSERT/UPDATE 정책 자체를 만들지 않는다.
--   - 상태 전이 검증은 supabase/functions/_shared/payments/giftStateMachine.ts 단일 소스.
--     (쓰기 경로가 Edge Function 하나뿐이라 DB 트리거 이중 구현은 하지 않음)
--
-- 재실행 안전 — drop if exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. user_verifications — 휴대폰 본인인증 결과 (본인만 조회)
-- ═════════════════════════════════════════════
create table if not exists public.user_verifications (
  user_id     uuid primary key references public.users(id) on delete cascade,
  birth_date  date not null,
  phone       text not null,
  di          text not null unique,   -- 본인확인기관 중복가입확인정보 — 1인 다계정 돈기능 차단
  verified_at timestamptz not null default now()
);

comment on table public.user_verifications is
  '휴대폰 본인인증(PASS/NICE/KCB) 결과. 돈 기능(응원 한잔/내기 한잔) 첫 사용 시 1회. 쓰기는 verify-identity Edge Function 전용.';

alter table public.user_verifications enable row level security;

-- 본인만 SELECT. INSERT/UPDATE/DELETE 정책 없음 = service role 외 전면 차단.
drop policy if exists verif_self_read on public.user_verifications;
create policy verif_self_read on public.user_verifications
  for select using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 2. 성인 인증 판정 helper — KST 기준 만 19세
-- ═════════════════════════════════════════════
create or replace function public.is_adult_verified(p_user_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.user_verifications v
    where v.user_id = p_user_id
      -- 만 19세: KST 오늘 날짜 기준 생일이 19년 이상 지났는가
      and v.birth_date <= ((now() at time zone 'Asia/Seoul')::date - interval '19 years')::date
  );
$$;

-- 내기 한잔 방 단위 허용 판정 — 활성 멤버(포기자 제외) 전원이 성인 인증 완료여야 true.
-- 미인증 멤버 1명이라도 있으면 false (미인증 = 미성년자로 간주, 보수적 차단).
-- 개별 멤버의 생년월일은 노출하지 않고 boolean 만 반환.
create or replace function public.challenge_bet_allowed(p_challenge_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select not exists (
    select 1 from public.challenge_members m
    where m.challenge_id = p_challenge_id
      and m.gave_up_at is null
      and not public.is_adult_verified(m.user_id)
  );
$$;

-- ═════════════════════════════════════════════
-- 3. gift_orders — 응원 한잔/내기 한잔 주문 (상태머신)
-- ═════════════════════════════════════════════
create table if not exists public.gift_orders (
  id            uuid primary key default gen_random_uuid(),
  order_type    text not null check (order_type in ('cheer','bet')),
  challenge_id  uuid not null references public.challenges(id) on delete restrict,
  sender_id     uuid not null references public.users(id) on delete restrict,
  recipient_id  uuid not null references public.users(id) on delete restrict,
  product_tier  text not null check (product_tier in ('one_cup','hearty_cup','grand_cup')),
  amount        integer not null check (amount > 0),    -- 서버 카탈로그 가격 (클라 입력 불신)
  status        text not null default 'created' check (status in (
                  'created','canceled','pay_failed',          -- 결제 전/실패
                  'paid',                                     -- PG 승인 + 금액 대조 통과
                  'issued','issue_failed','auto_refund',      -- 기프티콘 발급 단계
                  'delivered','donated','redeemed'            -- 수령 / 기부 전환 / 사용
                )),
  pg_payment_key text,            -- PG 결제키 (카드정보 아님 — 환불 시 참조용 토큰)
  voucher_ref    text,            -- 발급된 교환권 참조 (Stage 1 은 MOCK-)
  fail_reason    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.gift_orders is
  '응원 한잔/내기 한잔 주문. 카드·계좌 정보 저장 금지 원칙 — PG 토큰과 주문 정보만. 쓰기는 Edge Function 전용.';

-- 일일 발신 한도 카운트 + 내역 조회용
create index if not exists idx_gift_orders_sender_day
  on public.gift_orders(sender_id, created_at desc);
create index if not exists idx_gift_orders_recipient
  on public.gift_orders(recipient_id, created_at desc);

alter table public.gift_orders enable row level security;

-- 보낸 사람/받는 사람만 조회. 쓰기 정책 없음 = service role(Edge Function) 전용.
drop policy if exists gift_orders_party_read on public.gift_orders;
create policy gift_orders_party_read on public.gift_orders
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

-- 검증:
--   1) 본인인증 없는 유저로 is_adult_verified(uid) → false
--   2) user_verifications 에 만 19세 이상 birth_date upsert(service role) 후 → true
--   3) 같은 방에 미인증 멤버 1명 추가 → challenge_bet_allowed(방) = false
--   4) 일반 유저 키로 gift_orders INSERT 시도 → RLS 거부 (정책 없음)
--   5) sender/recipient 아닌 제3자 SELECT → 0 rows
