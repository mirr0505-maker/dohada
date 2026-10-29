-- 🚀 0090 — 개인사업자 + 모임(임의 단체) 트랙 (ORG_HADA_PLAN §10 후속, 2026-10-29 결정)
--
-- 결정:
--   ① 개인사업자(sole) = 조직 트랙. 개인 메일(naver·gmail) 허용, 사업자번호 필수. 운영자가 국세청 상태조회로 확인 후 승인
--   ② 모임(group) = 밴드·카페·오픈톡 같은 임의 단체. 개인 메일 허용, 활동 링크 필수, 운영자 승인(대표 메일로 의견 교환)
--      - 배지는 공식(🏛️)과 다르다 → users/challenges.host_tier 에 'group' 추가 (공식의 신뢰도 보호)
--      - **구성원 전용(closed)만** 연다 — 질병 카페처럼 "우리끼리"가 목적이고, open 방은 비멤버에게 내용이 보인다
--      - 누구나 합류는 개인 소모임용(모임장 개인 계정) 그대로. 대규모는 기존 장치(50·100 넛지·승격 심사)로 운영진 판단
--
-- 이 파일:
--   ① host_tier 제약에 'group' · org_type 제약에 'sole','group' · proofs 에 'activity_link'
--   ② org_applications.activity_url
--   ③ submit_org_application 6인자(활동 링크) — 개인 메일은 sole/group 만 허용 (5인자는 호환 래퍼)
--   ④ my_org_status · admin_list_org_applications 에 activity_url
--   ⑤ admin_approve_org_application — group 은 사람 계층 'group' + 알림, 그 외는 기존 org 경로
--   ⑥ set_join_code · stage_challenges · is_recruiting · create_challenge 에 group 반영
-- 재실행 안전 — drop … if exists / create or replace.

-- ═════════════════════════════════════════════
-- ① 제약 확장
-- ═════════════════════════════════════════════
alter table public.users drop constraint if exists users_host_tier_check;
alter table public.users add constraint users_host_tier_check check (host_tier in ('individual', 'figure', 'org', 'group'));
alter table public.challenges drop constraint if exists challenges_host_tier_check;
alter table public.challenges add constraint challenges_host_tier_check check (host_tier in ('individual', 'figure', 'org', 'group'));

alter table public.org_applications drop constraint if exists org_applications_org_type_check;
alter table public.org_applications add constraint org_applications_org_type_check
  check (org_type in ('company', 'sole', 'nonprofit', 'public', 'group'));
alter table public.org_verifications drop constraint if exists org_verifications_org_type_check;
alter table public.org_verifications add constraint org_verifications_org_type_check
  check (org_type in ('company', 'sole', 'nonprofit', 'public', 'group'));

alter table public.org_verifications drop constraint if exists org_verifications_proofs_check;
alter table public.org_verifications add constraint org_verifications_proofs_check check (
  proofs <@ array['biz_reg', 'nts_status', 'corp_registry', 'unique_no',
                  'official_letter', 'employment', 'domain_email', 'activity_link']::text[]
  and cardinality(proofs) >= 1
);

-- ═════════════════════════════════════════════
-- ② 활동 링크 (모임: 밴드·카페·오픈톡 주소)
-- ═════════════════════════════════════════════
alter table public.org_applications add column if not exists activity_url text;

-- ═════════════════════════════════════════════
-- ③ submit_org_application — 6인자
-- ═════════════════════════════════════════════
create or replace function public.submit_org_application(
  p_org_type        text,
  p_legal_name      text,
  p_registration_no text,
  p_contact_name    text,
  p_contact_phone   text,
  p_activity_url    text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_account text;
  v_status  text;
  v_reg     text := nullif(regexp_replace(coalesce(p_registration_no, ''), '\D', '', 'g'), '');
  v_url     text := nullif(btrim(coalesce(p_activity_url, '')), '');
begin
  if v_uid is null then raise exception '로그인이 필요해요.' using errcode = '42501'; end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then raise exception '메일 정보가 없는 계정이에요.'; end if;

  -- 개인 메일은 개인사업자·모임만 (그 외 조직은 조직 도메인 메일이 소유 증명이다)
  if public.is_personal_email_domain(v_email) and p_org_type not in ('sole', 'group') then
    raise exception '개인 메일(gmail·naver 등)로는 조직 가입을 할 수 없어요. 조직 메일을 써 주세요. 개인사업자·모임은 해당 유형을 골라 주세요.';
  end if;
  if p_org_type = 'sole' and (v_reg is null or length(v_reg) <> 10) then
    raise exception '개인사업자는 사업자등록번호 10자리가 필요해요.';
  end if;
  if p_org_type = 'group' and v_url is null then
    raise exception '모임은 활동 중인 밴드·카페·오픈톡 주소를 적어 주세요.';
  end if;

  -- 이미 개인 계정으로 쓰이는 메일이면 거부 — 개인 활동이 조직·모임 이름으로 둔갑하지 않게
  select account_type into v_account from public.users where id = v_uid;
  if v_account = 'personal' then
    raise exception '이 메일은 이미 개인 계정으로 쓰이고 있어요. 다른 메일을 써 주세요.';
  end if;

  select status into v_status from public.org_applications where user_id = v_uid;
  if v_status = 'approved' then raise exception '이미 승인된 계정이에요.'; end if;

  insert into public.users (id, email, nickname, account_type)
    values (v_uid, v_email, btrim(p_legal_name), 'org')
  on conflict (id) do update set nickname = excluded.nickname, account_type = 'org';

  insert into public.org_applications
    (user_id, org_type, legal_name, registration_no, contact_name, contact_phone, contact_email, activity_url,
     status, note, created_at, reviewed_at, reviewed_by)
  values
    (v_uid, p_org_type, btrim(p_legal_name), v_reg, btrim(p_contact_name),
     nullif(btrim(coalesce(p_contact_phone, '')), ''), v_email, v_url,
     'pending', null, now(), null, null)
  on conflict (user_id) do update set
    org_type = excluded.org_type, legal_name = excluded.legal_name, registration_no = excluded.registration_no,
    contact_name = excluded.contact_name, contact_phone = excluded.contact_phone, contact_email = excluded.contact_email,
    activity_url = excluded.activity_url,
    status = 'pending', note = null, created_at = now(), reviewed_at = null, reviewed_by = null;

  return 'pending';
end $$;
alter function public.submit_org_application(text, text, text, text, text, text) owner to postgres;
grant execute on function public.submit_org_application(text, text, text, text, text, text) to authenticated;

-- 구 앱(0087 OTA) 호환 — 5인자 호출은 활동 링크 없이 6인자로 넘긴다. 다음 OTA 가 퍼진 뒤 지워도 된다.
create or replace function public.submit_org_application(
  p_org_type text, p_legal_name text, p_registration_no text, p_contact_name text, p_contact_phone text
) returns text language sql security definer set search_path = public as $$
  select public.submit_org_application(p_org_type, p_legal_name, p_registration_no, p_contact_name, p_contact_phone, null);
$$;
alter function public.submit_org_application(text, text, text, text, text) owner to postgres;
grant execute on function public.submit_org_application(text, text, text, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- ④ 조회 RPC 에 activity_url
-- ═════════════════════════════════════════════
create or replace function public.my_org_status()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'account_type', u.account_type, 'host_tier', u.host_tier, 'nickname', u.nickname,
    'status', a.status, 'note', a.note, 'org_type', a.org_type, 'legal_name', a.legal_name,
    'registration_no', a.registration_no, 'contact_name', a.contact_name, 'contact_phone', a.contact_phone,
    'activity_url', a.activity_url
  )
  from (select auth.uid() as id) me
  left join public.users u on u.id = me.id
  left join public.org_applications a on a.user_id = me.id;
$$;

drop function if exists public.admin_list_org_applications(text);
create or replace function public.admin_list_org_applications(p_status text default 'pending')
returns table (
  user_id uuid, org_type text, legal_name text, registration_no text,
  contact_name text, contact_phone text, contact_email text, activity_url text,
  status text, note text, created_at timestamptz, reviewed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트
  return query
    select a.user_id, a.org_type, a.legal_name, a.registration_no,
           a.contact_name, a.contact_phone, a.contact_email, a.activity_url,
           a.status, a.note, a.created_at, a.reviewed_at
      from public.org_applications a
     where p_status is null or a.status = p_status
     order by a.created_at asc;
end $$;
alter function public.admin_list_org_applications(text) owner to postgres;
grant execute on function public.admin_list_org_applications(text) to authenticated;

-- ═════════════════════════════════════════════
-- ⑤ 승인 — 유형별로 확인한 것을 기록하고 계층을 부여 (한 트랜잭션)
--   기업·비영리·공공 = 조직 메일(domain_email) → org
--   개인사업자       = 국세청 상태조회(nts_status) → org (공식 배지 — 실재하는 사업자)
--   모임             = 활동 링크(activity_link) → group (모임 배지 — 공식과 구분)
-- ═════════════════════════════════════════════
create or replace function public.admin_approve_org_application(p_user_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.org_applications%rowtype;
  v_personal boolean;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  select * into a from public.org_applications where user_id = p_user_id;
  if not found then raise exception '가입 신청을 찾을 수 없어요.'; end if;
  if a.status = 'approved' then return; end if;   -- 두 번 눌러도 무동작

  v_personal := public.is_personal_email_domain(a.contact_email);

  perform public.admin_record_org_verification(
    p_user_id, a.org_type, a.legal_name, a.registration_no,
    case when v_personal then null else lower(split_part(a.contact_email, '@', 2)) end,
    case a.org_type
      when 'sole'  then array['nts_status']::text[]
      when 'group' then array['activity_link']::text[]
      else array['domain_email']::text[]
    end,
    a.contact_name, null, a.contact_email,
    coalesce(p_note, '') || case when a.activity_url is not null then ' · 활동 ' || a.activity_url else '' end
  );

  if a.org_type = 'group' then
    -- 모임은 0081 경로(org 전용 소급·알림)를 타지 않는다 — 기존 하다가 없는 새 계정이라 소급할 것도 없다.
    update public.users set host_tier = 'group', host_since = now()
     where id = p_user_id and host_tier = 'individual';
    insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
      values (p_user_id, 'host_promoted', null, '모임 주최자로 열렸어요 — 구성원 전용 하다를 열 수 있어요', now());
  else
    perform public.admin_set_user_host_tier(p_user_id, 'org');
  end if;

  update public.org_applications
     set status = 'approved', note = p_note, reviewed_at = now(), reviewed_by = auth.uid()
   where user_id = p_user_id;
end $$;
alter function public.admin_approve_org_application(uuid, text) owner to postgres;
grant execute on function public.admin_approve_org_application(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- ⑥-a set_join_code — 조직·모임의 구성원 전용 하다
-- ═════════════════════════════════════════════
create or replace function public.set_join_code(p_challenge_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  select creator_id, kind, host_tier into c from public.challenges where id = p_challenge_id;
  if not found then raise exception '하다를 찾을 수 없어요.'; end if;
  if c.creator_id is distinct from auth.uid() then raise exception '개설자만 참여 코드를 정할 수 있어요.' using errcode = '42501'; end if;
  if c.kind <> 'closed' or c.host_tier not in ('org', 'group') then raise exception '참여 코드는 조직·모임의 구성원 전용 하다에만 쓸 수 있어요.'; end if;
  if v_code !~ '^[A-Z0-9]{4,12}$' then raise exception '참여 코드는 영문·숫자 4~12자예요.'; end if;

  update public.challenges set join_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf'))
   where id = p_challenge_id;
end $$;

-- ═════════════════════════════════════════════
-- ⑥-b stage_challenges — 모임의 구성원 전용 하다도 광장에 (카드만)
-- ═════════════════════════════════════════════
create or replace function public.stage_challenges()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'creator_id', c.creator_id, 'title', c.title, 'description', c.description,
    'intro_image_url', c.intro_image_url, 'kind', c.kind,
    'start_date', c.start_date, 'end_date', c.end_date, 'created_at', c.created_at,
    'host_tier', c.host_tier, 'host_label', c.host_label,
    'recruit_locked', c.recruit_locked, 'recruit_cap_exempt', c.recruit_cap_exempt, 'gave_up_at', c.gave_up_at,
    'requires_code', c.join_code_hash is not null,
    'category', case when cat.id is null then null
                  else jsonb_build_object('emoji', cat.emoji, 'name', cat.name, 'is_impact', cat.is_impact) end,
    'subcategory', case when sub.id is null then null else jsonb_build_object('name', sub.name) end,
    'member_count', (select count(*) from public.challenge_members m
                      where m.challenge_id = c.id and m.gave_up_at is null and m.role <> 'host'),
    'is_joined', exists (select 1 from public.challenge_members m
                          where m.challenge_id = c.id and m.user_id = auth.uid() and m.gave_up_at is null),
    'votes', coalesce((select jsonb_object_agg(v.vote_type, v.n)
                         from (select vote_type, count(*) as n from public.challenge_votes
                                where challenge_id = c.id group by vote_type) v), '{}'::jsonb),
    'my_votes', coalesce((select jsonb_agg(vote_type) from public.challenge_votes
                           where challenge_id = c.id and user_id = auth.uid()), '[]'::jsonb)
  )
  from public.challenges c
  left join public.categories cat on cat.id = c.category_id
  left join public.subcategories sub on sub.id = c.subcategory_id
  where c.host_tier in ('figure', 'org', 'group')
    and c.gave_up_at is null
    and c.end_date >= (now() at time zone coalesce(public.user_timezone(auth.uid()), 'Asia/Seoul'))::date
    and (c.kind = 'open' or (c.kind = 'closed' and c.host_tier in ('org', 'group')))
  order by c.created_at desc
  limit 50;
$$;

-- ═════════════════════════════════════════════
-- ⑥-c is_recruiting — 0082 본문 승계, 조직 갈래에 모임 추가
-- ═════════════════════════════════════════════
create or replace function public.is_recruiting(challenge_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.challenges c
    where c.id = challenge_uuid
      and c.gave_up_at is null
      and not c.recruit_locked
      and (
        -- 0074: 조직 하다 = 광장 → 캡 무관, kind 무관 (closed 조직 하다도 이 함수엔 '모집 중')
        c.host_tier in ('org', 'group')   -- 🚀 0090: 모임도 캡 무관(구성원 전용이라 수동 잠금만)
        or (
          c.kind = 'open'
          and (
            -- 0064: 면제 방은 기간 50% 자동 마감을 받지 않는다(1,000명까지 자라야 하므로).
            c.recruit_cap_exempt
            -- 🚀 0082: 명사 무대도 면제 — 광장에 떠 있는데 못 들어가는 방을 만들지 않는다.
            or c.host_tier = 'figure'
            -- 면제도 무대도 아니면 기존(0043) 조건 그대로 — 일반 open 방 동작 불변.
            or now() < public.recruit_close_at(c.start_date, c.end_date)
          )
        )
      )
  );
$function$;

-- ═════════════════════════════════════════════
-- ⑥-d create_challenge — 0089 본문 승계: 모임은 closed 만 + 주최자(role=host)
-- ═════════════════════════════════════════════
create or replace function public.create_challenge(p_title text, p_description text, p_kind text, p_start_date date, p_end_date date, p_category_id integer DEFAULT NULL::integer, p_subcategory_id integer DEFAULT NULL::integer, p_frequency text DEFAULT 'daily'::text, p_proof_type text DEFAULT 'photo'::text, p_intro_image_url text DEFAULT NULL::text, p_bet_tier text DEFAULT NULL::text, p_bet_donation_mode text DEFAULT 'commitment'::text, p_goal_type text DEFAULT 'cadence'::text, p_target_count integer DEFAULT NULL::integer, p_success_threshold integer DEFAULT 100)
 RETURNS challenges
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
  -- 내기는 다함께·누구나만 — 그 외 kind 는 무시(null)
  v_bet_tier text := case when p_kind in ('closed','open') then p_bet_tier else null end;
  -- count 유형만 target_count 보존, 그 외엔 null 강제
  v_goal_type   text := case when p_goal_type = 'count' then 'count' else 'cadence' end;
  v_target_count int := case when p_goal_type = 'count' then p_target_count else null end;
  -- 성공 임계 — 구 클라는 아예 안 보내므로 null 이면 100(기존 동작)
  v_success_threshold smallint := coalesce(p_success_threshold, 100)::smallint;
  -- 🚀 0080: 개설자의 **사용자 티어**(0064) — 이 하다에 무대 표식을 붙일지 결정
  v_creator_tier text;
  v_creator_name text;
  v_host_tier    text := 'individual';   -- 기본 = 무대 아님 (기존 동작 그대로)
  v_host_label   text := null;
  v_member_role  text := 'member';       -- org 주최자만 'host' (0069)
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- count 유형은 내기 비활성 (베타: 목표형 betOutcome 미지원 — 응원만)
  if v_goal_type = 'count' then
    v_bet_tier := null;
  end if;
  -- CHECK 제약에 더해 명시적으로 — 오타가 42501 대신 읽히는 메시지로 돌아오게
  if v_success_threshold not in (90, 95, 100) then
    raise exception '성공 임계는 90, 95, 100 중 하나여야 합니다 (받은 값: %)', v_success_threshold;
  end if;

  -- 🚀 0080: 명사/조직이 여는 하다는 개설 시점에 곧바로 무대가 된다.
  --   ⚠️ kind='open' 일 때만 — 그 외 kind 는 비멤버가 못 읽어(RLS) 광장에 뜨지 않는다(0079 와 같은 이유).
  --      "지정은 됐는데 아무 데도 안 보이는" 무대를 애초에 만들지 않는다.
  select host_tier, nickname into v_creator_tier, v_creator_name
    from public.users where id = v_uid;

  -- 🚀 0089: 조직(org)은 구성원 전용(closed) 하다도 무대로 연다 — 광장 쇼윈도는 stage_challenges RPC 가
  --   카드 정보만 내보내므로(방 내용은 멤버만) closed 여도 "안 보이는 무대"가 되지 않는다. 명사(figure)는 open 만 그대로.
  -- 🚀 0090: 모임(group)은 구성원 전용(closed)만 연다 — 결정(2026-10-29). 누구나 합류는 모임장 개인 계정으로.
  if v_creator_tier = 'group' and p_kind <> 'closed' then
    raise exception '모임 계정은 구성원 전용 하다만 열 수 있어요.';
  end if;

  if (p_kind = 'open' and v_creator_tier in ('figure', 'org'))
     or (p_kind = 'closed' and v_creator_tier in ('org', 'group')) then
    v_host_tier  := v_creator_tier;
    v_host_label := v_creator_name;   -- 📌 닉네임 복사 (상단 트레이드오프 주석 참조 — stale 감수)
    -- 조직(org) 주최자는 도전자가 아니다 → 완주·인증 집계에서 빼려면 role='host' (0069).
    -- 명사(figure)는 본인이 직접 도전하는 사람이므로 'member' 그대로 둔다.
    if v_creator_tier in ('org', 'group') then   -- 🚀 0090: 모임 계정도 도전자가 아니라 주최자
      v_member_role := 'host';
    end if;
  end if;

  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type, intro_image_url,
    bet_tier, bet_donation_mode, goal_type, target_count, success_threshold,
    host_tier, host_label
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type, p_intro_image_url,
    v_bet_tier, coalesce(p_bet_donation_mode, 'commitment'), v_goal_type, v_target_count, v_success_threshold,
    v_host_tier, v_host_label
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id, role)
  values (v_row.id, v_uid, v_member_role);

  return v_row;
end $function$;

-- 검증:
--   1) [개인사업자] naver 메일 + org_type 'sole' + 번호 10자리 → submit 성공 · 번호 없으면 거부
--      naver 메일 + 'company' → 개인 메일 거부 (기존 동작)
--   2) [모임] gmail + 'group' + 활동 링크 → 성공 · 링크 없으면 거부
--   3) [승인] group → users.host_tier='group', org_verifications.proofs={activity_link}, 알림 1건
--             sole  → users.host_tier='org',  proofs={nts_status}, official_domain null
--   4) [모임 개설] group 계정으로 open 생성 → '구성원 전용 하다만' 거부 · closed → host_tier group, role host
--   5) [광장] stage_challenges() 에 group closed 하다 카드 포함 (requires_code=true)
