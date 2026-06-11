-- 🚀 0026 — 인증(proof)·기록(log) 업로드 알림
--
-- AS-IS: 댓글·대화·응원·공지만 알림. 동료가 인증/기록을 올려도 조용.
-- TO-BE: 같은 챌린지의 "다른 활성 멤버"(응원자 포함, 포기자 제외)에게 즉시 알림.
--        대화(chat)와 동일한 즉시 발송 — flush-notifications 의 조용시간(22~06시)·일 상한 그대로 적용.
--        solo 방은 멤버가 본인 1명뿐 → 수신자 0명 (구조적으로 알림 발생 X).
--        개설자가 포기(gave_up_at)한 방도 알림 X.
--
-- 재실행 안전 — drop if exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. kind check 확장 — 'proof' / 'log' 추가
-- ═════════════════════════════════════════════
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in ('chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice','proof','log'));

-- ═════════════════════════════════════════════
-- 2. proofs INSERT → 방의 다른 활성 멤버 모두에게 즉시 enqueue
-- ═════════════════════════════════════════════
create or replace function public.enqueue_proof_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_nick  text;
  v_title text;
begin
  -- 포기된 방은 알림 skip
  select title into v_title from public.challenges
    where id = new.challenge_id and gave_up_at is null;
  if v_title is null then return new; end if;

  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, proof_id, actor_id, preview, scheduled_for)
  select m.user_id, 'proof', new.challenge_id, new.id, new.user_id,
         coalesce(v_nick,'동료') || '님이 「' || v_title || '」 오늘 인증을 남겼어요',
         now()
  from public.challenge_members m
  where m.challenge_id = new.challenge_id
    and m.user_id <> new.user_id
    and m.gave_up_at is null;
  return new;
end $$;

drop trigger if exists trg_enqueue_proof on public.proofs;
create trigger trg_enqueue_proof
  after insert on public.proofs
  for each row execute procedure public.enqueue_proof_notif();

-- ═════════════════════════════════════════════
-- 3. logs INSERT → 방의 다른 활성 멤버 모두에게 즉시 enqueue
-- ═════════════════════════════════════════════
create or replace function public.enqueue_log_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_nick  text;
  v_title text;
begin
  select title into v_title from public.challenges
    where id = new.challenge_id and gave_up_at is null;
  if v_title is null then return new; end if;

  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, log_id, actor_id, preview, scheduled_for)
  select m.user_id, 'log', new.challenge_id, new.id, new.user_id,
         coalesce(v_nick,'동료') || '님의 새 기록: ' || left(new.title, 40),
         now()
  from public.challenge_members m
  where m.challenge_id = new.challenge_id
    and m.user_id <> new.user_id
    and m.gave_up_at is null;
  return new;
end $$;

drop trigger if exists trg_enqueue_log on public.logs;
create trigger trg_enqueue_log
  after insert on public.logs
  for each row execute procedure public.enqueue_log_notif();

-- 검증:
--   1) 2인 챌린지에서 A 가 인증 업로드 → select * from notification_queue
--      where kind='proof' order by created_at desc limit 5;  → B 행 1건
--   2) solo 챌린지에서 인증 업로드 → proof 행 0건 (수신자 없음)
--   3) 기록 업로드 → kind='log' 행 생성, preview 에 닉네임+기록 제목
