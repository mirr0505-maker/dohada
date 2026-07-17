-- 🚀 0067 — 승격 심사 (자동 승격 폐지) + 운영 콘솔 목록 개편
--
-- 개념 분리 (이게 핵심):
--   면제(recruit_cap_exempt, 0064) = "기간 50% 벽에서 안 멈추고 **계속 자라게**" — 성장의 조건.
--   승격 심사(0067)               = "1,000명을 넘은 하다를 **축복할지 운영자가 결정**" — 축복의 조건.
--   둘은 별개다. ⚠️ 승격 심사는 면제를 요구하지 않는다 — 면제 없이 바이럴로 1,000을 넘긴 하다도
--   심사 대상이어야 한다(요구하면 그게 구멍). 면제는 심사 큐에서 **표시만** 한다.
--
-- 심사 대기 중에도 참가자 수는 계속 늘어난다(카운트는 라이브 조회). 승인 시점에 링·칭호 부여.
--
-- 재실행 안전 — drop if exists / add column if not exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. 자동 승격 폐지 — 승격은 이제 운영자 심사(admin_review_promotion)로만
-- ═════════════════════════════════════════════
-- 이유: 0064 의 트리거는 challenge_members INSERT 시점에만 평가된다.
--   → 이미 1,000명을 넘긴 하다에 면제를 **나중에** 주면, 그 뒤 새 합류가 없는 한 승격이 영영 오지 않는다
--     (트리거를 깨울 이벤트가 없음). "면제를 늦게 주면 승격이 사라지는" 타이밍 구멍.
--   → 승격은 사람이 축복하는 일이므로 이벤트 타이밍이 아니라 운영자 판단 시점에 일어나야 한다.
drop trigger if exists trg_host_promotion on public.challenge_members;
drop function if exists public.enqueue_host_promotion();

-- ═════════════════════════════════════════════
-- 2. 보류 플래그 — 심사에서 "승격 안 함"으로 판단한 하다가 큐에 영원히 남지 않도록
-- ═════════════════════════════════════════════
alter table public.challenges add column if not exists promotion_declined boolean not null default false;

-- ═════════════════════════════════════════════
-- 3. 승격 심사 큐 — 1,000명을 넘긴 누구나 하다 (개설자가 아직 individual 인 것만)
-- ═════════════════════════════════════════════
drop function if exists public.admin_list_promotion_queue(int, int);

create function public.admin_list_promotion_queue(p_limit int default 10, p_offset int default 0)
returns table (
  id                 uuid,
  title              text,
  creator_id         uuid,
  creator_nickname   text,        -- 운영자가 "누구를 승격시키는지" 봐야 하므로 개설자 신원 노출
  member_count       int,         -- 누적 참여 (포기 포함 — 0064 승격 임계와 같은 기준)
  recruit_cap_exempt boolean,     -- ⚠️ 조건 아님, 표시만 (면제 없이 자란 하다도 심사 대상)
  created_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
-- RETURNS TABLE 의 컬럼(member_count 등)은 plpgsql 에서 OUT 변수로도 잡힌다.
-- order by member_count 가 출력 별칭이 아닌 그 변수(NULL)로 해석되면 정렬이 조용히 사라지므로 못박는다.
#variable_conflict use_column
begin
  -- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 게이트 없으면 아무 로그인 사용자나 전체 하다 열람
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;

  return query
  select c.id, c.title, c.creator_id, u.nickname,
         -- ⚠️ 별칭 필수 — 없으면 아래 order by member_count 가 출력 컬럼이 아니라 OUT 변수(NULL)로 잡혀 정렬이 사라진다
         (select count(*)::int from public.challenge_members m where m.challenge_id = c.id) as member_count,
         c.recruit_cap_exempt,
         c.created_at
  from public.challenges c
  join public.users u on u.id = c.creator_id
  where c.kind = 'open'                    -- 승격은 누구나 하다에서만 자란다 (0064)
    and u.host_tier = 'individual'         -- 이미 figure/org 인 개설자는 심사 대상 아님
    and not c.promotion_declined           -- 보류한 하다는 큐에서 제외
    and (select count(*) from public.challenge_members m where m.challenge_id = c.id) >= 1000
  order by member_count desc
  limit p_limit offset p_offset;
end $$;

alter function public.admin_list_promotion_queue(int, int) owner to postgres;
grant execute on function public.admin_list_promotion_queue(int, int) to authenticated;

-- ═════════════════════════════════════════════
-- 4. 심사 액션 — 승인(개설자 figure 승격 + 알림) / 보류(큐에서 제외)
-- ═════════════════════════════════════════════
create or replace function public.admin_review_promotion(p_challenge_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  -- 승격 임계 — 추후 상향 가능 (숫자를 한 곳에만 두기 위한 상수)
  v_threshold constant int := 1000;
  v_kind text; v_creator uuid; v_title text; v_count int;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  select kind, creator_id, title into v_kind, v_creator, v_title
    from public.challenges where id = p_challenge_id;
  if v_kind is null then raise exception 'challenge not found'; end if;
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;

  -- 보류 — 큐에서만 빼고 아무 것도 바꾸지 않는다 (되돌리려면 컬럼을 false 로)
  if not p_approve then
    update public.challenges set promotion_declined = true where id = p_challenge_id;
    return;
  end if;

  -- 자격 재검증 — 큐를 본 시점과 누르는 시점 사이에 조건이 달라질 수 있다. 자격 없는 승격 차단.
  select count(*) into v_count from public.challenge_members where challenge_id = p_challenge_id;
  if v_count < v_threshold then raise exception 'not eligible'; end if;

  -- org(조직)는 덮어쓰지 않고, 이미 figure 면 재승격 없음 → not found 로 알림 중복도 막힌다
  update public.users set host_tier = 'figure', host_since = now()
    where id = v_creator and host_tier = 'individual';
  if not found then return; end if;

  -- kind 'host_promoted' 는 0064 에 이미 있다 — CHECK 제약을 건드리지 않는다
  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
    values (v_creator, 'host_promoted', p_challenge_id,
      -- 숫자를 박지 않는다: 심사 시점엔 이미 임계를 훌쩍 넘겨 있을 수 있고(1,200명…), 임계 자체도 나중에 오를 수 있다.
      '「' || v_title || '」에 정말 많은 동료가 함께했어요 — 이제 유명인이에요. 아바타에 금빛 테두리가 생겼어요', now());
end $$;

alter function public.admin_review_promotion(uuid, boolean) owner to postgres;
grant execute on function public.admin_review_promotion(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 5. 면제 후보 목록 교체 — "지금 면제를 줄지 판단할" 하다만
-- ═════════════════════════════════════════════
-- 0065 는 open 전체를 누적순으로 나열해 이미 면제된 방·모집이 끝난 방까지 섞여 판단이 흐려졌다.
--   → 면제가 **의미 있는 순간**(아직 모집 중 + 미면제 + 이미 규모가 붙은 하다)만 남긴다.
-- 반환 타입은 0065 와 동일하지만 인자(limit/offset)가 늘어 시그니처가 바뀌므로 drop 후 create.
drop function if exists public.admin_list_growing_challenges();
drop function if exists public.admin_list_growing_challenges(int, int);

create function public.admin_list_growing_challenges(p_limit int default 10, p_offset int default 0)
returns table (
  id                 uuid,
  title              text,
  kind               text,
  host_tier          text,
  host_label         text,
  recruit_cap_exempt boolean,
  member_count       int,          -- 누적 참여 (포기 포함 — 승격 임계와 같은 기준)
  created_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
-- order by member_count 가 OUT 변수(NULL)로 해석돼 정렬이 사라지는 것 방지 (0065 와 같은 이유)
#variable_conflict use_column
declare
  -- 후보 최소 규모 — 규모가 커지면 올리면 된다 (지금은 100명이면 "자라고 있다"고 본다)
  v_min_members constant int := 100;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select c.id, c.title, c.kind, c.host_tier, c.host_label, c.recruit_cap_exempt,
         -- ⚠️ 별칭 필수 — 없으면 order by member_count 가 OUT 변수(NULL)로 잡혀 정렬이 사라진다
         (select count(*)::int from public.challenge_members m where m.challenge_id = c.id) as member_count,
         c.created_at
  from public.challenges c
  where c.kind = 'open'                                                   -- 캡·면제는 누구나 하다 전용 (0043·0064)
    and now() < public.recruit_close_at(c.start_date, c.end_date)         -- 아직 모집 중(기간 50% 전) — 지나면 면제해도 늦다
    and not c.recruit_cap_exempt                                          -- 이미 면제된 방은 아래 exempt 목록에서 본다
    and (select count(*) from public.challenge_members m where m.challenge_id = c.id) >= v_min_members
  order by member_count desc
  limit p_limit offset p_offset;
end $$;

alter function public.admin_list_growing_challenges(int, int) owner to postgres;
grant execute on function public.admin_list_growing_challenges(int, int) to authenticated;

-- ═════════════════════════════════════════════
-- 6. 면제된 하다 목록 — 모니터링·해제용
-- ═════════════════════════════════════════════
-- 이유: 면제를 주는 순간 그 하다는 후보 목록(5)에서 사라진다 → 제목을 정확히 기억해 검색하지 않는 한
--   다시 찾을 방법이 없다. "내가 무엇을 키우고 있는지"를 항상 볼 수 있어야 해제도 가능하다.
drop function if exists public.admin_list_exempt_challenges(int, int);

create function public.admin_list_exempt_challenges(p_limit int default 10, p_offset int default 0)
returns table (
  id                 uuid,
  title              text,
  kind               text,
  host_tier          text,
  host_label         text,
  recruit_cap_exempt boolean,
  member_count       int,
  created_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select c.id, c.title, c.kind, c.host_tier, c.host_label, c.recruit_cap_exempt,
         -- ⚠️ 별칭 필수 — 없으면 order by member_count 가 OUT 변수(NULL)로 잡혀 정렬이 사라진다
         (select count(*)::int from public.challenge_members m where m.challenge_id = c.id) as member_count,
         c.created_at
  from public.challenges c
  where c.kind = 'open'
    and c.recruit_cap_exempt                                             -- 지금 자라고 있는 하다 전부
  order by member_count desc
  limit p_limit offset p_offset;
end $$;

alter function public.admin_list_exempt_challenges(int, int) owner to postgres;
grant execute on function public.admin_list_exempt_challenges(int, int) to authenticated;

-- 검증:
--   1) [폐지] 면제된 open 방에 1,000번째 challenge_members INSERT →
--      users.host_tier 는 'individual' 그대로, host_promoted 알림 0건 (자동 승격 사라짐).
--      select tgname from pg_trigger where tgname='trg_host_promotion'; → 0행.
--   2) [면제 무관] 면제 **안 준** open 방의 누적이 1,000 이상이면 → admin_list_promotion_queue() 에 나타남
--      (recruit_cap_exempt=false 로 표시만 됨). 면제를 조건에 넣었다면 여기서 누락됐을 것 = 구멍.
--   3) [승인] admin_review_promotion('<1,000명 넘은 open id>', true) →
--      개설자 users.host_tier='figure' + host_since set + host_promoted 알림 정확히 1건.
--      같은 호출 반복 → 이미 figure 라 not found → 추가 알림 없음(1건 유지). 큐에서도 사라짐.
--      개설자가 org 인 경우 → 애초에 큐에 없고, 직접 호출해도 덮어쓰지 않음(알림 없음).
--   4) [자격] 누적 999명인 open 방에 admin_review_promotion(id, true) → 'not eligible' 예외.
--      solo/cheered/closed id → 'only open challenges' 예외. 없는 id → 'challenge not found' 예외.
--   5) [보류] admin_review_promotion(id, false) → promotion_declined=true, host_tier 불변, 알림 0건.
--      이후 admin_list_promotion_queue() 에서 그 하다가 사라짐(재등장 안 함).
--   6) [후보] admin_list_growing_challenges() → 전부 kind='open' + recruit_cap_exempt=false +
--      member_count>=100 + 아직 모집 중. 면제를 주면 즉시 이 목록에서 사라지고
--      admin_list_exempt_challenges() 에 나타남. 해제하면 반대로 되돌아옴.
--   7) [권한] 비-admin 계정으로 위 4개 RPC 호출 → 전부 'admin only' 예외(42501).
--   8) [페이지] admin_list_promotion_queue(10, 0) 과 (10, 10) 의 행이 겹치지 않고 member_count desc 로 이어짐.
