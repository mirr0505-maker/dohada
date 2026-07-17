-- 🚀 0064 — 유명인 자동 승격 + 모집 캡 면제 (사용자 단위 host_tier)
--
-- 배경 (사용자 방향): 유명인(figure)은 "만드는 것"이 아니라 "자라나는 것".
--   누구나(open) 하다가 누적 참여 1,000명에 도달하면 그 하다의 개설자가 자동으로 figure 로 승격된다.
--   승격은 영구 — 강등 없음(한 번 1,000명을 모은 사실은 사라지지 않는다).
--
-- ⚠️ 0043 캡과의 관계: open 방은 기간 50% 경과 시 자동 모집 마감이라 1,000명 도달이 구조적으로 불가능하다.
--   그래서 성장은 **운영자가 수동으로 "모집 캡 면제"를 부여한 하다에서만** 일어난다.
--   → 면제 안 준 일반 open 방의 모집·마감·넛지 동작은 이 마이그레이션 전후로 100% 동일하다(정체성 보존).
--
-- 축 구분:
--   challenges.host_tier (0058) = **하다 단위** 무대 배지 (운영 수동 지정). 여기서 건드리지 않는다.
--   users.host_tier      (0064) = **사용자 단위** 티어 (자동 승격). 아바타 금빛 테두리 + 닉네임 옆 마크.
--
-- 재실행 안전 — add column if not exists / create or replace / drop if exists.

-- ═════════════════════════════════════════════
-- 1. 모집 캡 면제 컬럼 — 운영자가 "키우기로 한" 하다에만 true
-- ═════════════════════════════════════════════
alter table public.challenges add column if not exists recruit_cap_exempt boolean not null default false;

-- ═════════════════════════════════════════════
-- 2. 0043 함수 4개 — 면제를 존중하도록 수정 (비면제 방 동작은 기존 그대로)
-- ═════════════════════════════════════════════

-- 신규 합류 가능 여부 — open + 미포기 + 수동잠금 아님 + (면제 OR 기간 50% 경과 전)
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
      -- 🚀 0064: 면제 방은 기간 50% 자동 마감을 받지 않는다(1,000명까지 자라야 하므로).
      --   면제가 아니면 기존(0043) 조건 그대로 — 일반 open 방 동작 불변.
      and (c.recruit_cap_exempt or now() < public.recruit_close_at(c.start_date, c.end_date))
  );
$$;
alter function public.is_recruiting(uuid) owner to postgres;

-- 인원 임계 알림 — 활성 멤버 50명·100명 도달 시 개설자에게 1회씩 (open 전용)
create or replace function public.enqueue_recruit_milestone()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kind text; v_creator uuid; v_title text; v_warn smallint; v_count int; v_exempt boolean;
begin
  select kind, creator_id, title, recruit_warn_level, recruit_cap_exempt
    into v_kind, v_creator, v_title, v_warn, v_exempt
    from public.challenges where id = new.challenge_id;
  if v_kind <> 'open' then return new; end if;
  -- 🚀 0064: 면제 방(=키우기로 한 하다)에 "모집을 잠그시겠어요?" 넛지는 모순 → 발송 안 함.
  if v_exempt then return new; end if;

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

-- 기간 50% 자동 마감 알림 (cron 이 호출) — 면제 방은 자동 마감 자체가 없으므로 대상에서 제외
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
      and not c.recruit_cap_exempt                               -- 🚀 0064: 면제 방은 자동 마감 없음 → 안내 대상 아님
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

-- 개설자 모집 잠금/해제 RPC — 해제는 자동마감(50%) 전에만. 단 면제 방은 자동마감이 없어 언제든 가능.
create or replace function public.set_recruit_lock(p_challenge_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_creator uuid; v_kind text; v_start date; v_end date; v_exempt boolean;
begin
  select creator_id, kind, start_date, end_date, recruit_cap_exempt
    into v_creator, v_kind, v_start, v_end, v_exempt
    from public.challenges where id = p_challenge_id;
  if v_creator is null then raise exception 'challenge not found'; end if;
  if v_creator <> auth.uid() then raise exception 'not creator' using errcode = '42501'; end if;
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;

  -- 다시 열기는 기간 50% 경과 전에만 — 자동 마감 후엔 고정 (0043 결정 #1)
  -- 🚀 0064: 면제 방은 애초에 자동 마감이 없으므로 이 가드를 건너뛴다(언제든 잠금/해제 가능).
  if p_locked = false and not v_exempt and now() >= public.recruit_close_at(v_start, v_end) then
    raise exception 'auto_closed';
  end if;

  update public.challenges set recruit_locked = p_locked where id = p_challenge_id;
end $$;
alter function public.set_recruit_lock(uuid, boolean) owner to postgres;
grant execute on function public.set_recruit_lock(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 3. 사용자 단위 티어 — 아바타 금빛 테두리 + 닉네임 옆 마크의 단일 소스
--    (users RLS 는 건드리지 않는다 — 기존 select 정책 경로로 함께 노출)
-- ═════════════════════════════════════════════
alter table public.users add column if not exists host_tier text not null default 'individual'
  check (host_tier in ('individual', 'figure', 'org'));
alter table public.users add column if not exists host_since timestamptz;   -- 승격 시각 (영구 기록)

-- ═════════════════════════════════════════════
-- 4. 자동 승격 트리거 — 면제된 open 하다의 누적 참여가 1,000명을 넘으면 개설자를 figure 로
--    (0043 의 임계 넛지 트리거와 별개 함수 — 관심사 분리: 저쪽은 "잠글까요?", 이쪽은 "자라났어요")
-- ═════════════════════════════════════════════
create or replace function public.enqueue_host_promotion()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  -- 승격 임계 — 추후 상향 가능 (숫자를 코드 한 곳에만 두기 위한 상수)
  v_threshold constant int := 1000;
  v_kind text; v_exempt boolean; v_creator uuid; v_title text;
  v_count int; v_creator_tier text;
begin
  select kind, recruit_cap_exempt, creator_id, title
    into v_kind, v_exempt, v_creator, v_title
    from public.challenges where id = new.challenge_id;

  -- 성장은 "운영자가 키우기로 한 누구나 하다"에서만 일어난다
  if v_kind <> 'open' or not coalesce(v_exempt, false) then return new; end if;

  -- 누적 참여자 — 포기(gave_up_at) 필터 없음. all-time 단조 증가라 1,000 을 한 번만 넘는다
  -- (활성 수로 세면 이탈/재합류에 따라 임계를 오르내리며 재승격·재알림이 흔들린다)
  select count(*) into v_count from public.challenge_members
    where challenge_id = new.challenge_id;
  if v_count < v_threshold then return new; end if;

  -- org(조직)는 덮어쓰지 않고, 이미 figure 면 재승격·재알림 없음
  select host_tier into v_creator_tier from public.users where id = v_creator;
  if v_creator_tier is distinct from 'individual' then return new; end if;

  update public.users
    set host_tier = 'figure', host_since = now()
    where id = v_creator and host_tier = 'individual';
  if not found then return new; end if;   -- 동시 삽입 경합 시 승격은 1회만 → 알림도 1회만

  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
    values (v_creator, 'host_promoted', new.challenge_id,
      '「' || v_title || '」에 1,000명이 함께했어요 — 이제 유명인이에요. 아바타에 금빛 테두리가 생겼어요', now());

  return new;
end $$;
alter function public.enqueue_host_promotion() owner to postgres;

drop trigger if exists trg_host_promotion on public.challenge_members;
create trigger trg_host_promotion
  after insert on public.challenge_members
  for each row execute procedure public.enqueue_host_promotion();

-- ═════════════════════════════════════════════
-- 5. 알림 kind 확장 — host_promoted (유명인 승격 안내)
-- ═════════════════════════════════════════════
-- ⚠️ 기존 전체 목록(0033 gift 4종 + 0043 recruit 2종 포함)을 모두 유지한 채 host_promoted 만 추가.
--    누락 시 기존 알림 행이 제약 위반(23514) → ALTER 실패.
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in (
    'chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice','proof','log',
    'gift','gift_received','gift_donated','gift_refund',
    'recruit_milestone','recruit_autoclosed',
    'host_promoted'
  ));

-- ═════════════════════════════════════════════
-- 6. 운영자 RPC — 모집 캡 면제 부여/해제 (0059 admin RPC 패턴)
-- ═════════════════════════════════════════════
create or replace function public.admin_set_recruit_exempt(p_challenge_id uuid, p_exempt boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트
  select kind into v_kind from public.challenges where id = p_challenge_id;
  if v_kind is null then raise exception 'challenge not found'; end if;
  -- 캡(0043) 자체가 open 전용이라 면제도 open 에만 의미가 있다
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;
  update public.challenges set recruit_cap_exempt = p_exempt where id = p_challenge_id;
end $$;
alter function public.admin_set_recruit_exempt(uuid, boolean) owner to postgres;
grant execute on function public.admin_set_recruit_exempt(uuid, boolean) to authenticated;

-- ─── admin_search_challenges() 재생성 — recruit_cap_exempt 노출 (운영 콘솔 토글 현재값) ──
-- 반환 타입이 바뀌므로 drop 후 create (create or replace 불가)
drop function if exists public.admin_search_challenges(text);

create function public.admin_search_challenges(p_q text)
returns table (
  id                 uuid,
  title              text,
  kind               text,
  host_tier          text,
  host_label         text,
  recruit_cap_exempt boolean,   -- 🚀 0064: 모집 캡 면제 현재값
  created_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  return query
  select c.id, c.title, c.kind, c.host_tier, c.host_label, c.recruit_cap_exempt, c.created_at
  from public.challenges c
  where c.title ilike '%' || p_q || '%'
  order by c.created_at desc
  limit 30;
end $$;
alter function public.admin_search_challenges(text) owner to postgres;
grant execute on function public.admin_search_challenges(text) to authenticated;

-- ═════════════════════════════════════════════
-- 7. parang_posts() 재생성 — author_host_tier 추가 (0063 본체 + 작성자 티어)
-- ═════════════════════════════════════════════
-- ⚠️ 익명 글은 author_nickname/author_avatar 와 똑같이 author_host_tier 도 null.
--    티어는 희소해서(유명인 소수) 그 자체가 신원 힌트가 된다 → 익명 글엔 절대 내리지 않는다.
drop function if exists public.parang_posts();

create function public.parang_posts()
returns table (
  post_type         text,
  post_id           uuid,
  challenge_id      uuid,
  title             text,
  body              text,
  photo_url         text,
  photo_urls        text[],
  author_nickname   text,
  author_avatar     text,
  author_host_tier  text,        -- 🚀 0064: 작성자 사용자 티어 (익명이면 null)
  reference_count   int,
  courage_count     int,
  comment_count     int,
  mine_couraged     boolean,
  created_at        timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select * from (
    -- 인증(proof) 크로스포스트
    select
      'proof'::text     as post_type,
      p.id              as post_id,
      p.challenge_id    as challenge_id,
      c.title           as title,
      p.caption         as body,
      p.photo_url       as photo_url,
      case
        when p.photo_urls is not null and array_length(p.photo_urls, 1) > 0 then p.photo_urls
        when p.photo_url is not null then array[p.photo_url]
        else '{}'::text[]
      end               as photo_urls,
      case when p.parang_anon then null else u.nickname   end as author_nickname,
      case when p.parang_anon then null else u.avatar_url end as author_avatar,
      case when p.parang_anon then null else u.host_tier  end as author_host_tier,
      c.reference_count as reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'proof' and r.target_id = p.id) as courage_count,
      (select count(*)::int from public.parang_comments cc
         where cc.target_type = 'proof' and cc.target_id = p.id and cc.hidden = false) as comment_count,
      exists (select 1 from public.parang_reactions r
         where r.target_type = 'proof' and r.target_id = p.id
           and r.user_id = auth.uid()) as mine_couraged,
      p.created_at      as created_at
    from public.proofs p
    join public.challenges c on c.id = p.challenge_id
    join public.users u      on u.id = p.user_id
    where p.share_to_parang = true and p.hidden = false

    union all

    -- 기록(log) 크로스포스트
    select
      'log'::text,
      l.id,
      l.challenge_id,
      c.title,
      l.content,
      l.photo_url,
      case
        when l.photo_urls is not null and array_length(l.photo_urls, 1) > 0 then l.photo_urls
        when l.photo_url is not null then array[l.photo_url]
        else '{}'::text[]
      end,
      case when l.parang_anon then null else u.nickname   end,
      case when l.parang_anon then null else u.avatar_url end,
      case when l.parang_anon then null else u.host_tier  end,
      c.reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'log' and r.target_id = l.id),
      (select count(*)::int from public.parang_comments cc
         where cc.target_type = 'log' and cc.target_id = l.id and cc.hidden = false),
      exists (select 1 from public.parang_reactions r
         where r.target_type = 'log' and r.target_id = l.id
           and r.user_id = auth.uid()),
      l.created_at
    from public.logs l
    join public.challenges c on c.id = l.challenge_id
    join public.users u      on u.id = l.user_id
    where l.share_to_parang = true and l.hidden = false
  ) posts
  order by created_at desc
  limit 30;
$$;

alter function public.parang_posts() owner to postgres;
grant execute on function public.parang_posts() to authenticated;

-- 검증:
--   1) [불변] 면제 아닌 open 방: 기간 50% 지난 뒤 합류 INSERT → 여전히 RLS 거부(is_recruiting=false).
--      50/100번째 합류 → recruit_milestone 그대로 1건씩. notify_recruit_autoclose() → recruit_autoclosed 그대로.
--      set_recruit_lock(id, false) 를 50% 후 호출 → 여전히 'auto_closed' 예외.
--   2) [면제] admin_set_recruit_exempt('<open id>', true) 후 기간 50% 지난 방에 합류 INSERT → 성공.
--      같은 방의 50/100번째 합류 → recruit_milestone 미발송. notify_recruit_autoclose() → 대상 제외.
--      set_recruit_lock(id, false) 를 50% 후 호출해도 예외 없이 해제됨.
--   3) [승격] 면제된 open 방에 1,000번째 challenge_members INSERT →
--      users.host_tier='figure' + host_since set + notification_queue 에 host_promoted 정확히 1건.
--   4) [멱등] 1,001번째 이후 INSERT → 개설자가 이미 figure 라 추가 알림 없음(host_promoted 여전히 1건).
--      개설자가 org 인 경우 → 덮어쓰지 않음(host_tier='org' 유지, 알림 없음).
--   5) [권한] 비-admin 계정으로 select admin_set_recruit_exempt('<id>', true); → 'admin only' 예외.
--      solo/cheered/closed id 로 admin 호출 → 'only open challenges' 예외.
--   6) [익명] parang_anon=true 로 나눈 공명 글 → parang_posts().author_host_tier is null
--      (author_nickname/avatar 와 동일). 비익명 글 → 작성자 users.host_tier 값.
