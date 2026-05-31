-- 🚀 0009 — 조용 알림 4원칙
--
-- 미르 의도: SNS 의 기본인 실시간 알림은 가되, 중독 메커니즘이 되는 도파민 루프는 차단.
--
-- 4원칙:
--   1. 묶음 + 지연: 응원/좋아요는 1시간 단위 묶음 ('지난 1시간 동료 3명이 응원했어요')
--   2. 즉시: 채팅 / 댓글 / 기록 댓글 (대화 흐름)
--   3. 조용한 시간: 22시~다음날 8시 KST 는 자동 보류 → 8시에 묶음 발송
--   4. 일별 상한: 사용자당 하루 최대 5건 (그 외는 인앱 배지)
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.

-- ═════════════════════════════════════════════
-- 1. device_tokens — Expo Push Token 저장 (user 별 다중 device 가능)
-- ═════════════════════════════════════════════
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  expo_token  text not null,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, expo_token)
);

alter table public.device_tokens enable row level security;

drop policy if exists tokens_self_read on public.device_tokens;
drop policy if exists tokens_self_upsert on public.device_tokens;
drop policy if exists tokens_self_delete on public.device_tokens;

create policy tokens_self_read on public.device_tokens
  for select using (user_id = auth.uid());
create policy tokens_self_upsert on public.device_tokens
  for insert with check (user_id = auth.uid());
create policy tokens_self_update on public.device_tokens
  for update using (user_id = auth.uid());
create policy tokens_self_delete on public.device_tokens
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 2. notification_prefs — user 별 토글
-- ═════════════════════════════════════════════
create table if not exists public.notification_prefs (
  user_id              uuid primary key references public.users(id) on delete cascade,
  chat_enabled         boolean not null default true,
  comment_enabled      boolean not null default true,
  cheer_batch_enabled  boolean not null default true,
  daily_enabled        boolean not null default true,
  updated_at           timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists prefs_self_read on public.notification_prefs;
drop policy if exists prefs_self_upsert on public.notification_prefs;
drop policy if exists prefs_self_update on public.notification_prefs;

create policy prefs_self_read on public.notification_prefs
  for select using (user_id = auth.uid());
create policy prefs_self_upsert on public.notification_prefs
  for insert with check (user_id = auth.uid());
create policy prefs_self_update on public.notification_prefs
  for update using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 3. notification_queue — 발송 대기열 (묶음·지연 처리용)
--    kind:
--      'chat'         → 즉시 (다음 cron tick)
--      'comment'      → 즉시
--      'log_comment'  → 즉시
--      'cheer_batch'  → 1시간 묶음 (같은 user + 같은 proof 의 cheer 모아서 1건)
--      'log_like_batch' → 1시간 묶음
-- ═════════════════════════════════════════════
create table if not exists public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  kind          text not null check (kind in ('chat','comment','log_comment','cheer_batch','log_like_batch')),
  challenge_id  uuid references public.challenges(id) on delete cascade,
  proof_id      uuid references public.proofs(id) on delete cascade,
  log_id        uuid references public.logs(id) on delete cascade,
  -- 발신자 (집계용)
  actor_id      uuid references public.users(id) on delete set null,
  -- 미리보기 텍스트 (제목/본문 조립용)
  preview       text,
  -- 발송 처리 상태
  scheduled_for timestamptz not null default now(),    -- 묶음의 경우 미래 시점
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_queue_pending
  on public.notification_queue (user_id, kind, scheduled_for)
  where sent_at is null;

-- queue 는 service role 만 접근 (사용자 직접 R/W X)
alter table public.notification_queue enable row level security;

-- ═════════════════════════════════════════════
-- 4. 트리거 함수 — INSERT 발생 시 queue 에 enqueue
-- ═════════════════════════════════════════════

-- 4-1. chat_messages INSERT → 방의 다른 멤버 모두에게 enqueue
create or replace function public.enqueue_chat_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_title text;
  v_nick  text;
begin
  select title into v_title from public.challenges where id = new.challenge_id;
  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, actor_id, preview, scheduled_for)
  select m.user_id, 'chat', new.challenge_id, new.user_id,
         coalesce(v_nick,'동료') || ': ' || left(new.content, 60),
         now()
  from public.challenge_members m
  where m.challenge_id = new.challenge_id
    and m.user_id <> new.user_id;
  return new;
end $$;

drop trigger if exists trg_enqueue_chat on public.chat_messages;
create trigger trg_enqueue_chat
  after insert on public.chat_messages
  for each row execute procedure public.enqueue_chat_notif();

-- 4-2. comments INSERT → 인증 작성자에게 enqueue (본인이 본인 댓글이면 skip)
create or replace function public.enqueue_comment_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_proof_user uuid;
  v_challenge  uuid;
  v_nick text;
begin
  select user_id, challenge_id into v_proof_user, v_challenge
    from public.proofs where id = new.proof_id;
  if v_proof_user is null or v_proof_user = new.user_id then return new; end if;
  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, proof_id, actor_id, preview, scheduled_for)
  values (v_proof_user, 'comment', v_challenge, new.proof_id, new.user_id,
          coalesce(v_nick,'동료') || ': ' || left(new.content, 60),
          now());
  return new;
end $$;

drop trigger if exists trg_enqueue_comment on public.comments;
create trigger trg_enqueue_comment
  after insert on public.comments
  for each row execute procedure public.enqueue_comment_notif();

-- 4-3. cheers INSERT → 인증 작성자에게 묶음 enqueue (1시간 지연)
create or replace function public.enqueue_cheer_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_proof_user uuid;
  v_challenge  uuid;
begin
  select user_id, challenge_id into v_proof_user, v_challenge
    from public.proofs where id = new.proof_id;
  if v_proof_user is null or v_proof_user = new.user_id then return new; end if;
  insert into public.notification_queue (user_id, kind, challenge_id, proof_id, actor_id, preview, scheduled_for)
  values (v_proof_user, 'cheer_batch', v_challenge, new.proof_id, new.user_id,
          null,    -- flush 시 동료 N명 응원해줬어요 형태로 조립
          now() + interval '1 hour');
  return new;
end $$;

drop trigger if exists trg_enqueue_cheer on public.cheers;
create trigger trg_enqueue_cheer
  after insert on public.cheers
  for each row execute procedure public.enqueue_cheer_notif();

-- 4-4. log_comments INSERT → 기록 작성자에게 enqueue (본인 skip)
create or replace function public.enqueue_log_comment_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_log_user uuid;
  v_challenge uuid;
  v_nick text;
begin
  select user_id, challenge_id into v_log_user, v_challenge
    from public.logs where id = new.log_id;
  if v_log_user is null or v_log_user = new.user_id then return new; end if;
  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, log_id, actor_id, preview, scheduled_for)
  values (v_log_user, 'log_comment', v_challenge, new.log_id, new.user_id,
          coalesce(v_nick,'동료') || ': ' || left(new.content, 60),
          now());
  return new;
end $$;

drop trigger if exists trg_enqueue_log_comment on public.log_comments;
create trigger trg_enqueue_log_comment
  after insert on public.log_comments
  for each row execute procedure public.enqueue_log_comment_notif();

-- 4-5. log_likes INSERT → 기록 작성자에게 묶음 (1시간 지연)
create or replace function public.enqueue_log_like_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_log_user uuid;
  v_challenge uuid;
begin
  select user_id, challenge_id into v_log_user, v_challenge
    from public.logs where id = new.log_id;
  if v_log_user is null or v_log_user = new.user_id then return new; end if;
  insert into public.notification_queue (user_id, kind, challenge_id, log_id, actor_id, preview, scheduled_for)
  values (v_log_user, 'log_like_batch', v_challenge, new.log_id, new.user_id,
          null, now() + interval '1 hour');
  return new;
end $$;

drop trigger if exists trg_enqueue_log_like on public.log_likes;
create trigger trg_enqueue_log_like
  after insert on public.log_likes
  for each row execute procedure public.enqueue_log_like_notif();

-- ═════════════════════════════════════════════
-- 5. owner 를 postgres 로 — security definer + bypassrls 보장
-- ═════════════════════════════════════════════
alter function public.enqueue_chat_notif()        owner to postgres;
alter function public.enqueue_comment_notif()     owner to postgres;
alter function public.enqueue_cheer_notif()       owner to postgres;
alter function public.enqueue_log_comment_notif() owner to postgres;
alter function public.enqueue_log_like_notif()    owner to postgres;
