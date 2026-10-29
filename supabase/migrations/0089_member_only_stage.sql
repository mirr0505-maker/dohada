-- 🚀 0089 — 구성원 전용 조직 하다(참여 코드) + 광장 쇼윈도 (ORG_HADA_PLAN §10.3 묶음 B)
--
-- 배경 (2026-10-28 결정 5): 조직 하다는 두 모드 — 누구나 합류(open) / 구성원 전용(closed + 참여 코드).
--   **둘 다 광장에 노출**한다("어느 기업이 하는지 보여야 한다"). 구성원 전용은 코드 없이 합류 불가.
--
-- 왜 closed 인가: open 방은 RLS 헬퍼 is_open_challenge(0005·0007)가 비멤버에게 인증·기록·대화·댓글을 연다.
--   구성원 전용을 open 으로 만들면 그 정책 5개를 다 고쳐야 한다(회귀 위험). closed 는 이미 멤버만 읽는다
--   → 광장 노출만 SECURITY DEFINER RPC(stage_challenges)로 카드 정보만 내보내면 된다(하다 구경 0050 과 같은 패턴).
--
-- 이 파일:
--   ① challenges.join_code_hash — 참여 코드(bcrypt). 평문은 어디에도 남기지 않는다(개설자도 다시 못 본다 → 새로 정하기만)
--   ② challenge_requires_code() — SECURITY DEFINER 헬퍼. ⚠️ RLS 정책 안 서브쿼리는 호출자 권한이라 비멤버가
--      closed 방 행을 못 읽어 조건이 무력해진다(0051→0052 사고) → 반드시 헬퍼로.
--   ③ set_join_code — 개설자 + closed + org 만
--   ④ join_member_only — 코드 확인 후 합류 (실패 사유를 문자열로)
--   ⑤ members_self_insert — 코드 방은 직접 insert 거부 (초대 링크만으로 우회 불가)
--   ⑥ create_challenge — org 개설자의 closed 하다도 무대·주최자(role=host) 자동 부여 (0080 본문 승계, 조건 한 줄)
--   ⑦ admin_set_host_tier — org 는 open·closed 허용 (figure 는 open 만 그대로)
--   ⑧ get_invite_info — requires_code 추가 (0078 본문 승계)
--   ⑨ stage_challenges() — 광장 무대 목록 (open 무대 + closed 조직 무대, 카드 정보만)
--
-- [불변] 개인 하다·기존 open 무대의 동작은 바뀌지 않는다. join_code_hash 는 기본 null.
-- 재실행 안전 — if not exists / create or replace / drop policy if exists.

-- ═════════════════════════════════════════════
-- ① 참여 코드 컬럼
-- ═════════════════════════════════════════════
alter table public.challenges add column if not exists join_code_hash text;
-- 클라 쓰기 권한 없음(0070 이 challenges insert/update 를 회수, invitation_message 만 허용) → set_join_code 로만.

-- ═════════════════════════════════════════════
-- ② 헬퍼 — 이 방은 참여 코드가 있어야 합류하는가
-- ═════════════════════════════════════════════
create or replace function public.challenge_requires_code(challenge_uuid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges where id = challenge_uuid and join_code_hash is not null);
$$;
alter function public.challenge_requires_code(uuid) owner to postgres;
grant execute on function public.challenge_requires_code(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- ③ set_join_code — 개설자가 코드를 정하거나 새로 정한다 (대소문자 무시: 대문자로 맞춰 해시)
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
  if c.kind <> 'closed' or c.host_tier <> 'org' then raise exception '참여 코드는 조직의 구성원 전용 하다에만 쓸 수 있어요.'; end if;
  if v_code !~ '^[A-Z0-9]{4,12}$' then raise exception '참여 코드는 영문·숫자 4~12자예요.'; end if;

  update public.challenges set join_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf'))
   where id = p_challenge_id;
end $$;
alter function public.set_join_code(uuid, text) owner to postgres;
grant execute on function public.set_join_code(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- ④ join_member_only — 코드 확인 후 합류
--   반환: 'joined' | 'already_member' | 'wrong_code' | 'ended' | 'locked' | 'gave_up' | 'not_member_only'
--   예외 대신 문자열 — 앱이 사유별 안내를 띄운다.
-- ═════════════════════════════════════════════
create or replace function public.join_member_only(p_challenge_id uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c record;
  m record;
begin
  if v_uid is null then raise exception '로그인이 필요해요.' using errcode = '42501'; end if;

  select kind, gave_up_at, end_date, recruit_locked, join_code_hash into c
    from public.challenges where id = p_challenge_id;
  if not found or c.join_code_hash is null then return 'not_member_only'; end if;

  select gave_up_at into m from public.challenge_members where challenge_id = p_challenge_id and user_id = v_uid;
  if found then
    return case when m.gave_up_at is null then 'already_member' else 'gave_up' end;
  end if;

  if c.gave_up_at is not null or c.end_date < (now() at time zone coalesce(public.user_timezone(v_uid), 'Asia/Seoul'))::date then return 'ended'; end if;
  if c.recruit_locked then return 'locked'; end if;
  if extensions.crypt(upper(btrim(coalesce(p_code, ''))), c.join_code_hash) <> c.join_code_hash then return 'wrong_code'; end if;

  insert into public.challenge_members (challenge_id, user_id) values (p_challenge_id, v_uid);
  return 'joined';
end $$;
alter function public.join_member_only(uuid, text) owner to postgres;
grant execute on function public.join_member_only(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- ⑤ members_self_insert — 0043/0082 조건 그대로 + 코드 방 직접 insert 거부
--   (기존 open 조건의 inline exists 는 open 방이 비멤버에게 보여서 동작한다 — 손대지 않는다)
-- ═════════════════════════════════════════════
drop policy if exists members_self_insert on public.challenge_members;
create policy members_self_insert on public.challenge_members
  for insert with check (
    user_id = auth.uid()
    and (
      not exists (select 1 from public.challenges c where c.id = challenge_id and c.kind = 'open')
      or public.is_recruiting(challenge_id)
    )
    and not public.challenge_requires_code(challenge_id)   -- 🚀 0089: 코드 방은 join_member_only 로만
  );

-- ═════════════════════════════════════════════
-- ⑦ admin_set_host_tier — 0083 본문 승계, 가드 ①만 완화 (org 는 closed 도 허용)
-- ═════════════════════════════════════════════
create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator_id   uuid;
  v_kind         text;
  v_prev_tier    text;
  v_creator_tier text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;

  select kind, host_tier, creator_id
    into v_kind, v_prev_tier, v_creator_id
    from public.challenges where id = p_challenge_id;
  if v_kind is null then
    raise exception '없는 하다입니다: %', p_challenge_id;
  end if;

  -- 가드 ① (0079 → 0089) — 명사는 누구나(open)만, 조직은 누구나·구성원 전용(closed).
  --   closed 조직 무대는 stage_challenges RPC 가 카드만 광장에 내보낸다. individual 원복은 kind 무관.
  if (p_tier = 'figure' and v_kind <> 'open')
     or (p_tier = 'org' and v_kind not in ('open', 'closed')) then
    raise exception '이 하다(%)에는 % 무대를 지정할 수 없어요. 명사는 누구나 하다, 조직은 누구나·구성원 전용 하다만.', v_kind, p_tier;
  end if;

  -- 가드 ② (0083) — 공식(org)은 조직 계정의 하다에만. org 로 새로 들어가는 전환일 때만 검사.
  if p_tier = 'org' and v_prev_tier is distinct from 'org' then
    select host_tier into v_creator_tier from public.users where id = v_creator_id;
    if v_creator_tier is distinct from 'org' then
      raise exception
        '공식(조직) 무대는 조직 계정이 연 하다에만 지정할 수 있어요. '
        '이 하다의 개설자는 조직 계정이 아닙니다. 운영자 콘솔 「사람 티어 지정」에서 '
        '그 계정을 먼저 공식으로 바꾸세요. (creator_id 이전은 구조상 불가능합니다)';
    end if;
  end if;

  update public.challenges
     set host_tier = p_tier, host_label = p_label
   where id = p_challenge_id;

  -- p_tier='org' 면 개설자를 도전자 집계에서 빼고(role='host'), 해제 시 원복한다 (0069)
  update public.challenge_members
     set role = case when p_tier = 'org' then 'host' else 'member' end
   where challenge_id = p_challenge_id
     and user_id = v_creator_id;
end $$;
alter function public.admin_set_host_tier(uuid, text, text) owner to postgres;
grant execute on function public.admin_set_host_tier(uuid, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- ⑨ stage_challenges — 광장 무대 (명사·조직). 카드 정보만, 최신순 고정(줄세우기 금지).
--   closed 조직 하다는 비멤버가 행을 못 읽으므로 SECURITY DEFINER 로 화이트리스트 컬럼만 내보낸다.
--   ⚠️ 참여 코드 해시·멤버 user_id 목록은 내보내지 않는다(인원 수·내 참여 여부만 계산해서).
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
    -- 주최자(role='host', 0069)는 도전자가 아니라 인원에서 뺀다 — 방 화면 memberCount 와 같은 기준
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
  where c.host_tier in ('figure', 'org')
    and c.gave_up_at is null
    and c.end_date >= (now() at time zone coalesce(public.user_timezone(auth.uid()), 'Asia/Seoul'))::date
    and (c.kind = 'open' or (c.kind = 'closed' and c.host_tier = 'org'))
  order by c.created_at desc
  limit 50;
$$;
alter function public.stage_challenges() owner to postgres;
grant execute on function public.stage_challenges() to authenticated;

-- ═════════════════════════════════════════════
-- ⑥ create_challenge — 0080 본문 승계, 무대 부여 조건만 확장 (인자·기본값·검증 불변)
-- ═════════════════════════════════════════════
create or replace function public.create_challenge(
  p_title          text,
  p_description    text,
  p_kind           text,
  p_start_date     date,
  p_end_date       date,
  p_category_id    int  default null,
  p_subcategory_id int  default null,
  p_frequency      text default 'daily',
  p_proof_type     text default 'photo',
  p_intro_image_url text default null,
  p_bet_tier        text default null,
  p_bet_donation_mode text default 'commitment',
  p_goal_type       text default 'cadence',
  p_target_count    int  default null,
  p_success_threshold int default 100
) returns public.challenges
language plpgsql security definer set search_path = public
as $$
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
  if (p_kind = 'open' and v_creator_tier in ('figure', 'org'))
     or (p_kind = 'closed' and v_creator_tier = 'org') then
    v_host_tier  := v_creator_tier;
    v_host_label := v_creator_name;   -- 📌 닉네임 복사 (상단 트레이드오프 주석 참조 — stale 감수)
    -- 조직(org) 주최자는 도전자가 아니다 → 완주·인증 집계에서 빼려면 role='host' (0069).
    -- 명사(figure)는 본인이 직접 도전하는 사람이므로 'member' 그대로 둔다.
    if v_creator_tier = 'org' then
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
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int, int) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int, int) to authenticated;

-- ═════════════════════════════════════════════
-- ⑧ get_invite_info — 0078 본문 승계 + requires_code (시그니처 불변 → create or replace)
-- ═════════════════════════════════════════════
create or replace function public.get_invite_info(p_challenge_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
  v_member_count int;
begin
  select c.id, c.title, c.kind, c.start_date, c.end_date,
         c.invitation_message, c.description, c.intro_image_url,
         c.bet_tier, c.bet_donation_mode,
         c.goal_type, c.target_count,
         c.host_tier, c.host_label,
         c.sponsor_amount_per_completer, c.sponsor_beneficiary,
         c.recruit_cap_exempt,
         c.success_threshold,
         c.gave_up_at, c.creator_id, c.category_id, c.join_code_hash,
         u.nickname as creator_nickname,
         cat.emoji  as category_emoji,
         cat.name   as category_name
    into v_row
    from public.challenges c
    left join public.users u on u.id = c.creator_id
    left join public.categories cat on cat.id = c.category_id
    where c.id = p_challenge_id;

  if not found then
    raise exception '챌린지를 찾을 수 없습니다.';
  end if;
  if v_row.kind = 'solo' then
    raise exception '나홀로 도전은 초대를 받을 수 없습니다.';
  end if;
  if v_row.gave_up_at is not null then
    raise exception '종료된 챌린지입니다.';
  end if;

  select count(*)::int into v_member_count
    from public.challenge_members
   where challenge_id = p_challenge_id
     and gave_up_at is null;

  return jsonb_build_object(
    'id',                 v_row.id,
    'title',              v_row.title,
    'kind',               v_row.kind,
    'start_date',         v_row.start_date,
    'end_date',           v_row.end_date,
    'invitation_message', v_row.invitation_message,
    'description',        v_row.description,
    'intro_image_url',    v_row.intro_image_url,
    'bet_tier',           v_row.bet_tier,
    'bet_donation_mode',  v_row.bet_donation_mode,
    'goal_type',          v_row.goal_type,
    'target_count',       v_row.target_count,
    'host_tier',          v_row.host_tier,
    'host_label',         v_row.host_label,
    'sponsor_amount_per_completer', v_row.sponsor_amount_per_completer,
    'sponsor_beneficiary',          v_row.sponsor_beneficiary,
    -- 0076: 모집 캡 면제값 — 클라 isRecruiting 이 open 하다의 기간 50% 자동마감을 건너뛸지 판단
    'recruit_cap_exempt', coalesce(v_row.recruit_cap_exempt, false),
    -- 🚀 0078: 성공 임계 — 합류 전에 "며칠까지 봐주는 하다인지" 보이게
    'success_threshold',  coalesce(v_row.success_threshold, 100),
    -- 🚀 0089: 구성원 전용 — 참여 코드가 있어야 합류 (초대 화면이 코드 입력칸을 띄운다)
    'requires_code',      v_row.join_code_hash is not null,
    'member_count',       v_member_count,
    'creator_nickname',   coalesce(v_row.creator_nickname, '도전자'),
    'category', case
      when v_row.category_id is null then null
      else jsonb_build_object('emoji', v_row.category_emoji, 'name', v_row.category_name)
    end
  );
end;
$function$;
alter function public.get_invite_info(uuid) owner to postgres;
grant execute on function public.get_invite_info(uuid) to authenticated, anon;

-- 검증:
--   1) [코드] 조직 계정으로 구성원 전용 하다 생성 → set_join_code(id,'walk2026')
--        select host_tier, join_code_hash is not null from challenges where id=…;     → org / true
--        select role from challenge_members where challenge_id=… and user_id=<조직>;   → host
--   2) [직접 insert 차단] 비멤버가 insert into challenge_members(challenge_id,user_id) values (…, auth.uid()) → RLS 거부
--   3) [합류] join_member_only(id,'WRONG') → 'wrong_code' · join_member_only(id,'Walk2026') → 'joined' (대소문자 무시)
--        다시 호출 → 'already_member'
--   4) [쇼윈도] 비멤버로 select * from stage_challenges() → 그 closed 하다 1행, requires_code=true, 해시·멤버 목록 없음
--   5) [불변] 개인 closed 하다에 set_join_code → '조직의 구성원 전용 하다에만' 거부 · 기존 open 무대 목록 그대로
