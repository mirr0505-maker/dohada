-- 🚀 0043 — 누구나(open) 방 모집 마감: 개설자 수동 잠금 + 인원 임계 알림(50/100) + 기간 50% 자동 마감
--
-- 배경 (사용자 방향): 누구나 방은 "서로를 목격하는 동료" 경험이 핵심이라 군중이 되면 정체성이 무너짐.
--   강제 캡 대신 ① 개설자가 언제든 모집을 잠글 수 있게 하고 ② 50명·100명 도달 시 1회씩 넛지 알림,
--   ③ 도전 기간 50%가 지나면 자동으로 모집 마감(누구나 영역에서 제거 + closed처럼 기존 멤버끼리 진행).
--   "모집 마감" ≠ "종료": 신규 합류만 막히고 기존 멤버의 인증·기록·대화·응원·완주는 그대로.
--
-- 범위: open(누구나) 전용. solo·cheered·closed 는 공개 모집이 아니라 영향 없음.
-- 공식미션(조직 주최, 수만 명 전제)은 별도 트랙 — 여기 캡/마감 안 걸림.
--
-- 재실행 안전 — add column if not exists / create or replace / drop if exists.

-- ═════════════════════════════════════════════
-- 1. 컬럼 — 수동 잠금 / 임계 알림 단계 / 자동마감 알림 1회 플래그
-- ═════════════════════════════════════════════
alter table public.challenges add column if not exists recruit_locked boolean not null default false;
alter table public.challenges add column if not exists recruit_warn_level smallint not null default 0;       -- 0 / 50 / 100 (1회성 기록)
alter table public.challenges add column if not exists recruit_autoclose_notified boolean not null default false;

-- ═════════════════════════════════════════════
-- 2. 모집 마감 시점(KST) — 시작일 00:00 ~ 종료일 24:00 구간의 중간 지점
-- ═════════════════════════════════════════════
create or replace function public.recruit_close_at(p_start date, p_end date)
returns timestamptz
language sql immutable set search_path = public
as $$
  -- KST 자정 기준. end_date 는 그날 24시(=+1일 00:00)까지 운영이므로 (end+1) 로 잡는다.
  select ((p_start::timestamp) at time zone 'Asia/Seoul')
    + ((((p_end + 1)::timestamp) at time zone 'Asia/Seoul') - ((p_start::timestamp) at time zone 'Asia/Seoul')) / 2;
$$;
alter function public.recruit_close_at(date, date) owner to postgres;

-- 신규 합류 가능 여부 — open + 미포기 + 수동잠금 아님 + 기간 50% 경과 전
create or replace function public.is_recruiting(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = challenge_uuid
      and c.kind = 'open'
      and c.gave_up_at is null
      and not c.recruit_locked
      and now() < public.recruit_close_at(c.start_date, c.end_date)
  );
$$;
alter function public.is_recruiting(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 3. 합류 INSERT 가드 — open 방은 모집 중일 때만 신규 합류 (클라 joinChallenge 와 이중 잠금)
--    (개설자 자동 가입은 create_challenge RPC = SECURITY DEFINER 라 RLS 우회 → 영향 없음)
-- ═════════════════════════════════════════════
drop policy if exists members_self_insert on public.challenge_members;
create policy members_self_insert on public.challenge_members
  for insert with check (
    user_id = auth.uid()
    and (
      not exists (select 1 from public.challenges c where c.id = challenge_id and c.kind = 'open')
      or public.is_recruiting(challenge_id)
    )
  );

-- ═════════════════════════════════════════════
-- 4. 인원 임계 알림 — 활성 멤버 50명·100명 도달 시 개설자에게 1회씩 (open 전용)
-- ═════════════════════════════════════════════
create or replace function public.enqueue_recruit_milestone()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kind text; v_creator uuid; v_title text; v_warn smallint; v_count int;
begin
  select kind, creator_id, title, recruit_warn_level
    into v_kind, v_creator, v_title, v_warn
    from public.challenges where id = new.challenge_id;
  if v_kind <> 'open' then return new; end if;

  -- 활성 멤버 수 (포기 제외)
  select count(*) into v_count from public.challenge_members
    where challenge_id = new.challenge_id and gave_up_at is null;

  if v_count >= 100 and v_warn < 100 then
    update public.challenges set recruit_warn_level = 100 where id = new.challenge_id;
    insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
      values (v_creator, 'recruit_milestone', new.challenge_id,
        '「' || v_title || '」 100명 참가 도달 — 계속 모집할지, 지금 잠글지 결정해 주세요', now());
  elsif v_count >= 50 and v_warn < 50 then
    update public.challenges set recruit_warn_level = 50 where id = new.challenge_id;
    insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
      values (v_creator, 'recruit_milestone', new.challenge_id,
        '「' || v_title || '」 50명 참가 도달 — 모집을 잠그시겠어요? (다음은 100명에 한 번 더 알림)', now());
  end if;
  return new;
end $$;
alter function public.enqueue_recruit_milestone() owner to postgres;

drop trigger if exists trg_recruit_milestone on public.challenge_members;
create trigger trg_recruit_milestone
  after insert on public.challenge_members
  for each row execute procedure public.enqueue_recruit_milestone();

-- ═════════════════════════════════════════════
-- 5. 기간 50% 자동 마감 알림 — 마감 동작 자체는 날짜로 파생(is_recruiting)이라 cron 불필요.
--    알림만 스케줄러(flush-notifications cron)에서 1회 발송하도록 이 함수를 호출한다.
-- ═════════════════════════════════════════════
create or replace function public.notify_recruit_autoclose()
returns void language plpgsql security definer set search_path = public
as $$
begin
  with closed as (
    select c.id, c.creator_id, c.title
    from public.challenges c
    where c.kind = 'open'
      and c.gave_up_at is null
      and not c.recruit_autoclose_notified
      and not c.recruit_locked                                   -- 이미 수동 잠근 방은 자동마감 안내 불필요
      and now() >= public.recruit_close_at(c.start_date, c.end_date)
      and now() <  (((c.end_date + 1)::timestamp) at time zone 'Asia/Seoul')   -- 종료(박제)는 별개 흐름
  )
  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
  select creator_id, 'recruit_autoclosed', id,
    '「' || title || '」 도전 기간 절반이 지나 모집이 자동 마감됐어요 (이제 다함께처럼 진행돼요)', now()
  from closed;

  update public.challenges set recruit_autoclose_notified = true
    where id in (select id from closed);
end $$;
alter function public.notify_recruit_autoclose() owner to postgres;
grant execute on function public.notify_recruit_autoclose() to service_role;

-- ═════════════════════════════════════════════
-- 6. 개설자 모집 잠금/해제 RPC — 해제는 자동마감(50%) 전에만 (그 후엔 고정)
-- ═════════════════════════════════════════════
create or replace function public.set_recruit_lock(p_challenge_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_creator uuid; v_kind text; v_start date; v_end date;
begin
  select creator_id, kind, start_date, end_date
    into v_creator, v_kind, v_start, v_end
    from public.challenges where id = p_challenge_id;
  if v_creator is null then raise exception 'challenge not found'; end if;
  if v_creator <> auth.uid() then raise exception 'not creator' using errcode = '42501'; end if;
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;

  -- 다시 열기는 기간 50% 경과 전에만 — 자동 마감 후엔 고정 (결정 #1)
  if p_locked = false and now() >= public.recruit_close_at(v_start, v_end) then
    raise exception 'auto_closed';
  end if;

  update public.challenges set recruit_locked = p_locked where id = p_challenge_id;
end $$;
alter function public.set_recruit_lock(uuid, boolean) owner to postgres;
grant execute on function public.set_recruit_lock(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 7. 알림 kind 확장 — recruit_milestone(임계 넛지) / recruit_autoclosed(자동마감 안내)
-- ═════════════════════════════════════════════
-- ⚠️ 기존 전체 목록(0033 = gift 계열 포함)을 모두 유지한 채 recruit 2종만 추가해야 함.
--    누락 시 기존 gift 알림 행이 제약 위반(23514) → ALTER 실패.
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in (
    'chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice','proof','log',
    'gift','gift_received','gift_donated','gift_refund',
    'recruit_milestone','recruit_autoclosed'
  ));

-- 검증:
--   1) open 방에 50번째 활성 멤버 insert → notification_queue 에 개설자 대상 recruit_milestone 1건 + challenges.recruit_warn_level=50
--   2) 100번째 → recruit_milestone 1건 더 + warn_level=100. 그 사이 추가 insert 로는 중복 발송 X
--   3) set_recruit_lock(id, true) 후 비멤버 합류 INSERT → RLS(members_self_insert) 거부
--   4) 기간 50% 지난 open 방 합류 INSERT → is_recruiting=false 라 거부
--   5) select public.notify_recruit_autoclose(); → 50% 지난 미알림 방마다 recruit_autoclosed 1건 + 플래그 set
--   6) closed/solo/cheered 방 합류·임계 → 영향 없음 (open 조건 가드)
