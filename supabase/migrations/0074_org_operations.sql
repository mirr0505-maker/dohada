-- 🚀 0074 — 조직(org) 하다 운영 동선 (ORG_HADA_PLAN.md Step 3 + 열린질문 #4)
--
-- 세 갈래:
--   ① 지정 사실 통지  — admin_set_host_tier 가 주최자에게 알림 1건 (TO-BE 3).
--                       지금까지는 UPDATE 만 해서 조직은 자기 하다가 공식이 된 걸 앱을 열어봐야 알았다.
--   ② org 모집 캡 면제 — 0043 의 "기간 50% 자동 마감"은 *"서로를 목격하는 동료"* 를 지키는 장치인데
--                       조직 하다는 애초에 광장이라 전제가 다르다 (열린질문 #4).
--   ③ 콘솔에서 찾기   — 운영자가 지정한 하다(명사/공식)를 kind 무관 목록에 남긴다.
--
-- 재실행 안전 — create or replace / drop if exists 후 create.

-- ═════════════════════════════════════════════
-- 1. 알림 kind 확장 — host_assigned (무대 지정 안내)
-- ═════════════════════════════════════════════
-- ⚠️ 이 CHECK 는 **전체 목록을 다시 쓰는 구조**다. 기존 kind 를 하나라도 빠뜨리면 그 kind 의 알림이
--    통째로 23514(check violation)로 실패한다. 0064 의 목록(= 0033 gift 4종 + 0043 recruit 2종 포함)을
--    그대로 승계하고 host_assigned 만 얹는다.
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in (
    'chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice','proof','log',
    'gift','gift_received','gift_donated','gift_refund',
    'recruit_milestone','recruit_autoclosed',
    'host_promoted',
    'host_assigned'      -- 🚀 0074: 하다가 명사/공식 무대로 지정됨 (개설자에게 1건)
  ));

-- ═════════════════════════════════════════════
-- 2. admin_set_host_tier() — 지정 사실을 주최자에게 알린다
-- ═════════════════════════════════════════════
-- 0072 본문을 그대로 승계한다:
--   · 🔒 첫 줄 is_admin() 게이트          (0059:6-10 최상위 불변식 — SECURITY DEFINER 라 RLS 우회)
--   · 티어 화이트리스트 검사
--   · org → bet_tier / bet_donation_mode 강제 null   (0072 — 기관의 도박성 유도 차단)
--   · creator 멤버 행 role 동기화 org→'host' / 개인→'member'  (0069 — 도전자 집계에서 제외)
-- 여기서 얹는 것은 알림 적재 하나뿐.
--
-- ⚠️ individual 로 되돌릴 때는 알림 없음 — 강등을 통보하지 않는다.
--    (0072 의 "bet_tier 는 복원하지 않는다" 주석도 그대로 유효 — 원본 값을 보관하는 곳이 없다.)
create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator_id uuid;
  v_title      text;
  v_prev_tier  text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;

  -- 이전 티어 — 같은 티어를 다시 눌렀을 때 알림이 중복 적재되지 않게 한다(멱등)
  select host_tier into v_prev_tier from public.challenges where id = p_challenge_id;

  update public.challenges
     set host_tier = p_tier,
         host_label = p_label,
         -- org 는 내기 금지 → 걸려 있던 설정을 지운다. 개인 티어는 기존 값 유지(위 ⚠️ 참조).
         bet_tier = case when p_tier = 'org' then null else bet_tier end,
         bet_donation_mode = case when p_tier = 'org' then null else bet_donation_mode end
   where id = p_challenge_id
  returning creator_id, title into v_creator_id, v_title;

  -- 없는 챌린지면 v_creator_id 가 null → 아래 update 가 아무 행도 안 잡는다(기존과 동일한 무동작).
  update public.challenge_members
     set role = case when p_tier = 'org' then 'host' else 'member' end
   where challenge_id = p_challenge_id
     and user_id = v_creator_id;

  -- 🚀 0074: 지정 사실 통지 — 승격(축복)만 알리고 강등(individual)은 알리지 않는다.
  if v_creator_id is not null and p_tier <> 'individual' and v_prev_tier is distinct from p_tier then
    insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
      values (v_creator_id, 'host_assigned', p_challenge_id,
        '「' || v_title || '」이(가) ' ||
        case when p_tier = 'org' then '🏛️ 공식 하다로 지정됐어요' else '⭐ 명사 하다로 지정됐어요' end ||
        ' — 현황 탭에서 주최자 배지를 확인해 보세요', now());
  end if;
end $$;
alter function public.admin_set_host_tier(uuid, text, text) owner to postgres;
grant execute on function public.admin_set_host_tier(uuid, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- 3. is_recruiting() — 조직 하다는 모집 캡 면제 (열린질문 #4)
-- ═════════════════════════════════════════════
-- 0064 본문 승계 + org 분기만 추가.
--   · 0043 캡(기간 50% 자동 마감)은 "서로를 목격하는 동료"를 지키는 장치 → **조직 하다는 애초에 광장**이라
--     전제가 성립하지 않는다. 그래서 org 는 recruit_cap_exempt 를 받은 것과 같이 취급하고, kind 도 안 따진다.
--   · ⚠️ 면제하는 것은 **캡뿐**이다. 포기(gave_up_at)한 방과 개설자가 손수 잠근(recruit_locked) 방은
--     여전히 모집 중이 아니다 — 둘은 캡이 아니라 주최자/방의 상태이며, 이걸 뚫으면 버려진 방이
--     신규 합류를 받거나 잠금 토글(set_recruit_lock)이 무력해진다.
--   · [불변] org 아닌 방의 판정은 이 마이그레이션 전후로 100% 동일하다.
-- ⚠️ 클라 mobile/lib/stats.ts isRecruiting 과 미러 — 한쪽만 고치면 "클라는 마감인데 DB 는 합류 허용" 불일치.
create or replace function public.is_recruiting(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = challenge_uuid
      and c.gave_up_at is null
      and not c.recruit_locked
      and (
        -- 🚀 0074: 조직 하다 = 광장 → 캡 무관, kind 무관 (closed 조직 하다도 이 함수엔 '모집 중')
        c.host_tier = 'org'
        or (
          c.kind = 'open'
          -- 🚀 0064: 면제 방은 기간 50% 자동 마감을 받지 않는다(1,000명까지 자라야 하므로).
          --   면제가 아니면 기존(0043) 조건 그대로 — 일반 open 방 동작 불변.
          and (c.recruit_cap_exempt or now() < public.recruit_close_at(c.start_date, c.end_date))
        )
      )
  );
$$;
alter function public.is_recruiting(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 4. admin_set_recruit_exempt() — 조직 하다는 kind 무관 면제 허용
-- ═════════════════════════════════════════════
-- 0064 본문 승계 + org 예외. 조직은 closed 하다를 흔히 쓰는데 kind<>'open' 거부(0064:209)에 막혀
-- 면제를 줄 수가 없었다. org 가 아닌 방의 기존 제약(open 전용)은 그대로.
create or replace function public.admin_set_recruit_exempt(p_challenge_id uuid, p_exempt boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_kind text; v_host_tier text;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트
  select kind, host_tier into v_kind, v_host_tier from public.challenges where id = p_challenge_id;
  if v_kind is null then raise exception 'challenge not found'; end if;
  -- 캡(0043) 자체가 open 전용이라 면제도 open 에만 의미가 있다 — 단 조직 하다(광장)는 kind 무관(0074).
  if v_kind <> 'open' and v_host_tier <> 'org' then raise exception 'only open challenges'; end if;
  update public.challenges set recruit_cap_exempt = p_exempt where id = p_challenge_id;
end $$;
alter function public.admin_set_recruit_exempt(uuid, boolean) owner to postgres;
grant execute on function public.admin_set_recruit_exempt(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 5. set_recruit_lock() — 조직 하다는 잠금 해제에 기간 제한 없음
-- ═════════════════════════════════════════════
-- 0064 본문 승계 + org 예외.
--   "다시 열기는 50% 전까지"(0043 결정 #1) 가드는 **캡의 일부**다 — 자동 마감된 방을 되살리지 못하게 하는 것.
--   org 를 캡에서 면제(§3)해 놓고 이 가드를 남기면, 조직이 모집을 한 번 잠근 뒤 50% 가 지나면
--   **영영 다시 열 수 없다**(캡이 없어 자동 마감된 적도 없는데). 0064 가 면제 방(v_exempt)에 준 예외와 같은 이유.
create or replace function public.set_recruit_lock(p_challenge_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_creator uuid; v_kind text; v_start date; v_end date; v_exempt boolean; v_host_tier text;
begin
  select creator_id, kind, start_date, end_date, recruit_cap_exempt, host_tier
    into v_creator, v_kind, v_start, v_end, v_exempt, v_host_tier
    from public.challenges where id = p_challenge_id;
  if v_creator is null then raise exception 'challenge not found'; end if;
  if v_creator <> auth.uid() then raise exception 'not creator' using errcode = '42501'; end if;
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;

  -- 다시 열기는 기간 50% 경과 전에만 — 자동 마감 후엔 고정 (0043 결정 #1)
  -- 🚀 0064: 면제 방은 애초에 자동 마감이 없으므로 이 가드를 건너뛴다(언제든 잠금/해제 가능).
  -- 🚀 0074: 조직 하다도 같은 이유로 건너뛴다(캡 면제 = 자동 마감 없음).
  if p_locked = false and not v_exempt and v_host_tier <> 'org'
     and now() >= public.recruit_close_at(v_start, v_end) then
    raise exception 'auto_closed';
  end if;

  update public.challenges set recruit_locked = p_locked where id = p_challenge_id;
end $$;
alter function public.set_recruit_lock(uuid, boolean) owner to postgres;
grant execute on function public.set_recruit_lock(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 6. admin_list_growing_challenges() — 지정한 하다는 kind 무관 목록에 남긴다
-- ═════════════════════════════════════════════
-- 0067 본문 승계 + org/figure 분기. 조직의 closed/cheered 하다는 kind='open' 필터(0065:42 → 0067:147)에
-- 걸려 **제목 검색으로만** 도달했다 → 운영자가 자기가 지정한 방을 다시 찾아 관리할 수 없었다.
-- [불변] 기존 open 면제 후보 조건(모집 중 + 미면제 + 100명↑)은 그대로 — 한쪽 갈래일 뿐이다.
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
  where
    -- ⓐ 면제 후보 (0067 그대로) — 지금 면제를 줄지 판단할 누구나 하다
    (
      c.kind = 'open'                                                     -- 캡·면제는 누구나 하다 전용 (0043·0064)
      and now() < public.recruit_close_at(c.start_date, c.end_date)       -- 아직 모집 중(기간 50% 전) — 지나면 면제해도 늦다
      and not c.recruit_cap_exempt                                        -- 이미 면제된 방은 exempt 목록에서 본다
      and (select count(*) from public.challenge_members m where m.challenge_id = c.id) >= v_min_members
    )
    -- ⓑ 🚀 0074: 이미 지정한 하다 — kind·규모 무관. 운영자가 다시 찾아 관리(표시명 수정·면제·해제)해야 한다.
    or c.host_tier <> 'individual'
  order by member_count desc
  limit p_limit offset p_offset;
end $$;

alter function public.admin_list_growing_challenges(int, int) owner to postgres;
grant execute on function public.admin_list_growing_challenges(int, int) to authenticated;

-- 검증:
--   1) [알림] admin 계정: select admin_set_host_tier('<id>', 'org', '환경부');
--      → challenges.host_tier='org' + bet_tier/bet_donation_mode=null + 개설자 challenge_members.role='host'
--        + notification_queue 에 host_assigned 정확히 1건(user_id=개설자, challenge_id=그 하다).
--   2) [멱등] 같은 호출 반복 → host_assigned 여전히 1건 (v_prev_tier = p_tier 라 적재 안 함).
--      'figure' 로 바꾸면 → 티어가 달라졌으므로 1건 추가(⭐ 문구).
--   3) [강등 무통지] select admin_set_host_tier('<같은 id>', 'individual', null);
--      → role='member' 원복, bet_tier 는 null 유지(복원 안 함 — 0072 의도), host_assigned 알림 **추가 없음**.
--   4) [권한] 비-admin 계정: select admin_set_host_tier('<id>','org','환경부'); → 'admin only' 예외.
--   5) [kind CHECK] insert into notification_queue(user_id,kind,challenge_id,preview,scheduled_for)
--      values (…, 'gift', …) 등 기존 kind 전부 여전히 통과(23514 없음).
--   6) [캡 면제] org 지정한 open 하다: 기간 50% 지난 뒤 합류 INSERT → 성공(is_recruiting=true).
--      org 지정한 closed 하다: select is_recruiting('<id>'); → true.
--      [불변] org 아닌 open 방: 기간 50% 후 합류 INSERT → 여전히 거부.
--   7) [캡 아닌 것은 면제 안 됨] org 지정한 open 하다에 set_recruit_lock(id,true) → is_recruiting=false.
--      개설자가 포기(gave_up_at)한 org 하다 → is_recruiting=false.
--      이어서 개설자가 set_recruit_lock(id,false) 를 50% 후에 호출 → 예외 없이 해제(org 라 가드 건너뜀).
--      [불변] org 아닌 미면제 open 방에 같은 호출 → 여전히 'auto_closed' 예외.
--   8) [면제 RPC] admin_set_recruit_exempt('<org closed id>', true) → 성공.
--      admin_set_recruit_exempt('<individual closed id>', true) → 'only open challenges' 예외(불변).
--   9) [콘솔] admin_list_growing_challenges() → 기존 open 후보 + host_tier<>'individual' 인 하다 전부
--      (kind='closed' 인 org 하다도 보임). 비-admin → 'admin only' 예외(42501).
