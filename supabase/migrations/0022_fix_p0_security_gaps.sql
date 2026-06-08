-- 🚀 0022 — P0 보안 결함 일괄 패치 (베타 출시 전 정밀 보강판)
--
-- CODE_AUDIT_2026_06_08.md 의 P0-1 ~ P0-6 결함을 한 번에 해소합니다.
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
-- 재실행 안전 — drop if exists / create or replace / if not exists 사용.
--
-- 변경 요약 (코드 감사 P0 매핑):
--   1) (P0-2) challenges UPDATE 정책 신설 — 개설자만 update
--   2) (P0-2 보강) challenges.invitation_message 길이 check 제약 (500자)
--   3) (P0-2 보강) gave_up_at set-once 트리거 — 한번 종료되면 되돌릴 수 없음
--                  (CLAUDE.md 박제=영구 정신과 일관)
--   4) (P0-5) can_create_in_challenge 헬퍼에 gave_up_at 가드 추가
--   5) (P0-5) cheers_self_insert 정책 강화 — 멤버·오픈 가드 추가
--   6) (P0-4) chat_self_insert 에 is_notice 위장 차단 가드
--   7) (P0-3) enqueue_chat_notif 트리거 — is_notice 메시지 skip + gave_up 멤버 제외
--   8) (P0-6) send_creator_notice — 길이 검증 + 60s 쿨다운 + advisory lock
--   9) (P0-1) notify_creator_gave_up RPC 신설 — 클라이언트 직접 INSERT 대체
--
-- 의존성 (0005·0017 정의):
--   public.is_member_of(uuid)         — gave_up_at is null 가드 포함 (0017)
--   public.is_member_of_proof(uuid)   — gave_up_at is null 가드 포함 (0017)
--   public.is_open_proof(uuid)        — open 챌린지 proof 여부 (0005)

-- ═════════════════════════════════════════════
-- 0. 사전 점검 — 의존 헬퍼가 모두 정의되어 있는지 확인
--    하나라도 없으면 마이그레이션 중단 (잘못된 적용 순서 방지).
-- ═════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='is_member_of') then
    raise exception '0022 의존성 누락: is_member_of(uuid) — 먼저 0005·0017 적용 필요';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='is_member_of_proof') then
    raise exception '0022 의존성 누락: is_member_of_proof(uuid) — 먼저 0005·0017 적용 필요';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='is_open_proof') then
    raise exception '0022 의존성 누락: is_open_proof(uuid) — 먼저 0003·0005 적용 필요';
  end if;
end$$;

-- ═════════════════════════════════════════════
-- 1. (P0-2) challenges UPDATE 정책 추가
--    invitation_message · gave_up_at · 향후 챌린지 메타 수정 모두 개설자 한정.
--    NOTE: with check 가 신규 row 의 creator_id 도 강제 → 소유권 이전 방지.
-- ═════════════════════════════════════════════
drop policy if exists challenges_creator_update on public.challenges;
create policy challenges_creator_update on public.challenges
  for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- ═════════════════════════════════════════════
-- 2. (P0-2 보강) invitation_message 길이 제약 (방어선)
--    클라이언트 200자 + DB 500자 다층 방어. 직접 API 호출 시 폭증 방지.
-- ═════════════════════════════════════════════
alter table public.challenges
  drop constraint if exists challenges_invitation_message_length;
alter table public.challenges
  add constraint challenges_invitation_message_length
  check (invitation_message is null or char_length(invitation_message) <= 500);

-- ═════════════════════════════════════════════
-- 3. (P0-2 보강) gave_up_at set-once 트리거
--    한번 종료된 챌린지는 다시 살릴 수 없음 (CLAUDE.md "박제=영구" 정신).
--    악의 또는 실수로 챌린지를 닫았다 열었다 반복하며 멤버에게 푸시 폭격 방지.
-- ═════════════════════════════════════════════
create or replace function public.enforce_challenge_gave_up_set_once()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.gave_up_at is not null and new.gave_up_at is null then
    raise exception '종료된 챌린지의 gave_up_at 은 되돌릴 수 없습니다.';
  end if;
  return new;
end $$;

drop trigger if exists trg_challenge_gave_up_set_once on public.challenges;
create trigger trg_challenge_gave_up_set_once
  before update on public.challenges
  for each row execute procedure public.enforce_challenge_gave_up_set_once();

-- ═════════════════════════════════════════════
-- 4. (P0-5) can_create_in_challenge 갱신 — gave_up_at 가드 추가
--    0008 원본은 멤버십·creator 만 검증. 포기 멤버 / 종료된 챌린지도 INSERT 가능했음.
--    0017 의 is_member_of 갱신과 일관된 톤으로 보강.
-- ═════════════════════════════════════════════
create or replace function public.can_create_in_challenge(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select case
    when (select kind from public.challenges
            where id = challenge_uuid and gave_up_at is null) = 'cheered'
      then exists (
        select 1 from public.challenges c
        join public.challenge_members m
          on m.challenge_id = c.id and m.user_id = c.creator_id
        where c.id = challenge_uuid
          and c.creator_id = auth.uid()
          and c.gave_up_at is null
          and m.gave_up_at is null
      )
    else exists (
      select 1 from public.challenge_members m
      join public.challenges c on c.id = m.challenge_id
      where m.challenge_id = challenge_uuid
        and m.user_id = auth.uid()
        and m.gave_up_at is null
        and c.gave_up_at is null
    )
  end;
$$;
alter function public.can_create_in_challenge(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 5. (P0-5) cheers_self_insert 정책 강화
--    AS-IS: user_id = auth.uid() 만 → 누구나 임의 proof 에 응원 INSERT 가능
--    TO-BE: + 활성 멤버 (gave_up_at is null 자동 보장) OR open 챌린지의 proof
-- ═════════════════════════════════════════════
drop policy if exists cheers_self_insert on public.cheers;
create policy cheers_self_insert on public.cheers
  for insert with check (
    user_id = auth.uid()
    and (public.is_member_of_proof(proof_id) or public.is_open_proof(proof_id))
  );

-- ═════════════════════════════════════════════
-- 6. (P0-4) chat_self_insert — is_notice 위장 차단
--    AS-IS: 멤버면 is_notice 컬럼 임의 값 INSERT 가능 → 가짜 공지 위장
--    TO-BE: is_notice = true 는 챌린지 개설자만. coalesce 로 NULL=false 처리.
-- ═════════════════════════════════════════════
drop policy if exists chat_self_insert on public.chat_messages;
create policy chat_self_insert on public.chat_messages
  for insert with check (
    user_id = auth.uid()
    and public.is_member_of(challenge_id)
    and (
      coalesce(is_notice, false) = false
      or exists (
        select 1 from public.challenges c
        where c.id = challenge_id and c.creator_id = auth.uid()
      )
    )
  );

-- ═════════════════════════════════════════════
-- 7. (P0-3) enqueue_chat_notif 트리거 — is_notice skip + 포기 멤버 제외
--    AS-IS: chat_messages INSERT 마다 'chat' 큐 적재. 공지(is_notice=true) 도 적재돼
--           send_creator_notice 의 'creator_notice' 큐와 이중 발송.
--    TO-BE: is_notice=true 면 트리거 skip. 포기 멤버는 알림 제외.
-- ═════════════════════════════════════════════
create or replace function public.enqueue_chat_notif()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_nick text;
begin
  if new.is_notice then
    return new;   -- 공지는 send_creator_notice 가 별도 enqueue → 트리거는 skip
  end if;

  select nickname into v_nick from public.users where id = new.user_id;
  insert into public.notification_queue (user_id, kind, challenge_id, actor_id, preview, scheduled_for)
  select m.user_id, 'chat', new.challenge_id, new.user_id,
         coalesce(v_nick,'동료') || ': ' || left(new.content, 60),
         now()
  from public.challenge_members m
  where m.challenge_id = new.challenge_id
    and m.user_id <> new.user_id
    and m.gave_up_at is null;
  return new;
end $$;
alter function public.enqueue_chat_notif() owner to postgres;

-- ═════════════════════════════════════════════
-- 8. (P0-6) send_creator_notice — 길이 검증 + 60s 쿨다운 + advisory lock
--    AS-IS: 무검증 → 알림 폭격 가능
--    TO-BE: 1~200자 + 60초 쿨다운 + 같은 챌린지 동시 호출 직렬화 (advisory lock).
--    트랜잭션 단위 lock 이므로 RPC 종료 시 자동 해제.
-- ═════════════════════════════════════════════
create or replace function public.send_creator_notice(
  p_challenge_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_creator_nick text;
  v_msg text := coalesce(trim(p_message), '');
  v_challenge_gave_up_at timestamptz;
begin
  -- 0-1. 길이 검증
  if char_length(v_msg) < 1 or char_length(v_msg) > 200 then
    raise exception '메시지는 1자 이상 200자 이내여야 합니다.';
  end if;

  -- 0-2. 동시 호출 직렬화 (transaction-scoped advisory lock)
  perform pg_advisory_xact_lock(
    hashtext('send_creator_notice:' || p_challenge_id::text)
  );

  -- 1. 챌린지 존재 + 종료 안 됨 + 호출자=개설자
  select creator_id, gave_up_at
    into v_creator_id, v_challenge_gave_up_at
    from public.challenges where id = p_challenge_id;
  if v_creator_id is null then
    raise exception '챌린지를 찾을 수 없습니다.';
  end if;
  if v_creator_id <> auth.uid() then
    raise exception '개설자만 전체 알림을 보낼 수 있습니다.';
  end if;
  if v_challenge_gave_up_at is not null then
    raise exception '종료된 챌린지에는 공지를 보낼 수 없습니다.';
  end if;

  -- 2. 60초 쿨다운
  if exists (
    select 1 from public.chat_messages
    where challenge_id = p_challenge_id
      and user_id = auth.uid()
      and is_notice = true
      and created_at > now() - interval '60 seconds'
  ) then
    raise exception '잠시 후 다시 시도해주세요 (60초 쿨다운).';
  end if;

  select nickname into v_creator_nick from public.users where id = auth.uid();

  -- 3. chat_messages 인서트 (트리거 7번 변경으로 'chat' 중복 enqueue 안 됨)
  insert into public.chat_messages (challenge_id, user_id, content, is_notice)
  values (p_challenge_id, auth.uid(), v_msg, true);

  -- 4. 멤버 전원에게 'creator_notice' 큐 적재 (본인 제외, 포기 멤버 제외)
  insert into public.notification_queue (user_id, kind, challenge_id, actor_id, preview, scheduled_for)
  select m.user_id, 'creator_notice', p_challenge_id, auth.uid(),
         coalesce(v_creator_nick, '개설자') || ': ' || left(v_msg, 100),
         now()
  from public.challenge_members m
  where m.challenge_id = p_challenge_id
    and m.user_id <> auth.uid()
    and m.gave_up_at is null;
end;
$$;
alter function public.send_creator_notice(uuid, text) owner to postgres;

-- ═════════════════════════════════════════════
-- 9. (P0-1) notify_creator_gave_up RPC 신설
--    AS-IS: 클라이언트가 challenges.update(gave_up_at) + notification_queue.insert
--           둘 다 RLS 거부로 silent fail
--    TO-BE: security definer RPC 1회 호출로 두 작업을 원자적으로 처리.
--    개설자 검증 → challenges.gave_up_at 갱신 → 멤버 전원에게 종료 알림 큐 적재.
--    이미 종료된 챌린지 재호출은 no-op (idempotent).
-- ═════════════════════════════════════════════
create or replace function public.notify_creator_gave_up(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_creator_nick text;
  v_already_gave_up timestamptz;
begin
  -- 동시 호출 직렬화
  perform pg_advisory_xact_lock(
    hashtext('notify_creator_gave_up:' || p_challenge_id::text)
  );

  -- 1. 개설자 검증
  select creator_id, gave_up_at into v_creator_id, v_already_gave_up
    from public.challenges where id = p_challenge_id;
  if v_creator_id is null then
    raise exception '챌린지를 찾을 수 없습니다.';
  end if;
  if v_creator_id <> auth.uid() then
    raise exception '개설자만 챌린지를 종료할 수 있습니다.';
  end if;
  if v_already_gave_up is not null then
    return;       -- 이미 종료된 챌린지에 재호출 → no-op (멱등성)
  end if;

  -- 2. challenges.gave_up_at 갱신 (P0-2 정책 + set-once 트리거 통해 통과)
  update public.challenges
    set gave_up_at = now()
  where id = p_challenge_id
    and gave_up_at is null;

  -- 3. 멤버 전원에게 종료 알림 큐 적재 (본인 제외, 포기 멤버 제외)
  select nickname into v_creator_nick from public.users where id = auth.uid();
  insert into public.notification_queue (user_id, kind, challenge_id, actor_id, preview, scheduled_for)
  select m.user_id, 'creator_notice', p_challenge_id, auth.uid(),
         '📢 챌린지 종료: ' || coalesce(v_creator_nick, '개설자') || '님이 도전을 포기하여 방이 종료되었습니다.',
         now()
  from public.challenge_members m
  where m.challenge_id = p_challenge_id
    and m.user_id <> auth.uid()
    and m.gave_up_at is null;
end;
$$;
alter function public.notify_creator_gave_up(uuid) owner to postgres;
grant execute on function public.notify_creator_gave_up(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- 검증 쿼리 — 마이그레이션 적용 후 SQL Editor 에서 별도 실행하여 확인.
-- (마이그레이션 본체에 포함하지 않음 — 주석으로만 명시)
-- ═════════════════════════════════════════════
-- (1) 정책 6 종이 등록됐는지:
--   select tablename, cmd, policyname from pg_policies
--   where schemaname='public'
--     and (
--       (tablename='challenges'      and cmd='UPDATE') or
--       (tablename='cheers'          and cmd='INSERT') or
--       (tablename='chat_messages'   and cmd='INSERT')
--     );
-- (2) RPC 두 개가 등록됐는지:
--   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public'
--     and proname in ('notify_creator_gave_up','send_creator_notice');
-- (3) gave_up_at set-once 트리거 동작 확인:
--   select tgname from pg_trigger where tgname='trg_challenge_gave_up_set_once';
