-- 🚀 0078 — 성공 임계(success_threshold) + 잠시 멈춤 이력(challenge_pauses)
--
-- 배경 ① "완주"와 "성공"을 분리한다:
--   지금은 목표를 100% 채워야만 완주다. 100일 매일 하다에서 출장·병원으로 8일을 못 하면
--   92일을 걸었어도 실패로 찍힌다. 끝까지 간 사람에게 "실패"라고 말하는 건 이 앱의 정체성이 아니다.
--     완주 = 포기하지 않고 끝까지 감      → 박제·해냈어요 자격
--     성공 = 개설 시 정한 달성 임계를 채움 → 완주 화면·내기 정산·스폰서 기부·다짐 정산
--   그래서 challenges 에 개설 시 고정되는 성공 임계(100/95/90%)를 둔다.
--
-- 배경 ② "잠시 멈춤"이 지금 거짓말을 하고 있다:
--   방 UI 는 "인증 의무가 면제예요"라고 하는데 판정(mobile/lib/stats.ts)에는 paused 가 아예 없어
--   목표 일수가 1일도 줄지 않는다. 멈춘 만큼 목표에서 빼주려면 "총 며칠 멈췄나"를 알아야 하는데,
--   challenge_members.paused_until 은 **날짜 하나뿐이고 재개 시 null 로 지워져** 이력이 남지 않는다.
--   → 멈춤 구간(시작~끝)을 행으로 쌓는 이력 테이블이 필요하다.
--   이 숫자가 내기 정산 금액을 좌우하므로 **감사 가능해야 한다**(지우지 않고 쌓는다).
--
-- 🔒 판정 로직은 SQL 로 복제하지 않는다.
--   완주/성공 판정의 단일 진실원천은 mobile/lib/stats.ts 다. SQL 에 같은 계산을 심으면 진실이 둘이 된다
--   (0075 주석이 같은 이유로 완주 수를 DB 에서 세지 않는다). 여기서는 **재료(임계·멈춤 구간)만** 저장한다.
--
-- 재실행 안전 — add column if not exists / create table if not exists / drop policy if exists 후 create /
--               drop function if exists 후 create / revoke·grant 는 멱등.

-- ═════════════════════════════════════════════
-- ① challenges.success_threshold — 성공으로 인정할 달성률(%)
-- ═════════════════════════════════════════════
-- 기본 100 → 기존 하다·기존 클라의 동작이 **완전히 불변**이다. 백필 없음.
alter table public.challenges
  add column if not exists success_threshold smallint not null default 100;

alter table public.challenges drop constraint if exists challenges_success_threshold_check;
alter table public.challenges add constraint challenges_success_threshold_check
  check (success_threshold in (90, 95, 100));

comment on column public.challenges.success_threshold is
  '성공으로 인정할 달성률(%). 90/95/100, 기본 100. 개설 시 고정·변경 불가. 완주(끝까지 감)와 별개. 0078.';

-- ⚠️ 0070 의 개설자 UPDATE 컬럼 화이트리스트(현재 invitation_message 1개)에 이 컬럼을 **넣지 않는다.**
--   임계는 개설 시 고정이다. 진행 중에 개설자가 100 → 90 으로 낮출 수 있으면
--   그건 내기 정산·스폰서 기부 금액을 사후에 조작하는 것이고, 0070 이 start_date/end_date/goal_type 을
--   막은 이유("완주 조건 소급 변경 = 박제가 거짓이 된다")와 정확히 같은 부류다.
--   → challenges 는 이미 테이블 단위 UPDATE 가 회수된 상태이므로, 여기서 아무것도 grant 하지 않으면
--     authenticated 는 이 컬럼을 쓸 수 없다. **의도된 상태 — 추가 grant 금지.**

-- ═════════════════════════════════════════════
-- ② challenge_pauses — 잠시 멈춤 이력 (감사 가능한 원장)
-- ═════════════════════════════════════════════
-- 한 행 = 멈춤 구간 하나. end_date 는 **끝날 포함**(그날까지 멈춤).
-- 재개하면 새 행을 쓰는 게 아니라 그 행의 end_date 를 오늘로 앞당겨 구간을 줄인다.
create table if not exists public.challenge_pauses (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,                  -- 끝날 포함 (start_date = end_date 면 하루 멈춤)
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

-- 조회는 항상 "이 방의 이 사람" 단위 (현황 탭이 멤버별 분모를 그린다)
create index if not exists idx_challenge_pauses_challenge_user
  on public.challenge_pauses (challenge_id, user_id);

comment on table public.challenge_pauses is
  '잠시 멈춤 이력. paused_until(날짜 1개)로는 총 멈춤일을 알 수 없어 구간을 행으로 쌓는다. '
  '내기 정산 금액의 근거라 삭제하지 않는다(DELETE 정책 없음). 0078.';

-- 자동 만료·TTL 은 넣지 않는다 (박제 테이블은 아니지만, 애초에 자동삭제 로직 자체를 만들지 않는다 — 수칙 3의 결).

alter table public.challenge_pauses enable row level security;

-- 조회: 같은 방 열람자(포기 여부 무관 — pledges/proofs SELECT 와 동일 기준).
--   현황 탭이 **동료의 분모**를 그리려면 동료의 멈춤 구간을 읽어야 한다.
--   🔒 정책 안에서 challenge_members 를 직접 서브쿼리하면 호출자 권한으로 평가돼 그 테이블 RLS 에 막힌다
--      (0051→0052 사고). 교차 테이블 조건은 반드시 SECURITY DEFINER 헬퍼로.
drop policy if exists challenge_pauses_select on public.challenge_pauses;
create policy challenge_pauses_select on public.challenge_pauses
  for select using (public.is_viewer_of(challenge_id));

-- 등록: 활성 멤버가 본인 이름으로만
drop policy if exists challenge_pauses_self_insert on public.challenge_pauses;
create policy challenge_pauses_self_insert on public.challenge_pauses
  for insert with check (
    public.is_member_of(challenge_id) and user_id = auth.uid()
  );

-- 수정: 본인 행만 (재개 시 end_date 를 앞당겨 구간을 줄이는 용도)
drop policy if exists challenge_pauses_self_update on public.challenge_pauses;
create policy challenge_pauses_self_update on public.challenge_pauses
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE 정책은 만들지 않는다 — 이력은 지우지 않는다(정산 근거).

-- ─── 컬럼 권한 (RLS 는 '행'만 고르고 컬럼은 못 막는다 — 컬럼 제한은 GRANT 의 일. 0068~0070 교훈) ───
--   신규 테이블은 Supabase 기본 권한으로 authenticated 에게 전 컬럼이 열린 채 생성된다 → 좁힌다.
--   update 화이트리스트에 user_id 를 **넣지 않는다** — 넣으면 자기 멈춤 행을 남의 것으로 바꿔치기해
--   동료의 목표 분모를 깎을 수 있다. challenge_id·start_date 도 사후 변경 대상이 아니다.
--   SELECT 는 회수하지 않는다(RLS 가 행을 고른다). service_role 도 건드리지 않는다.
revoke insert, update on public.challenge_pauses from authenticated;
revoke insert, update on public.challenge_pauses from anon;
grant insert (challenge_id, user_id, start_date, end_date) on public.challenge_pauses to authenticated;
grant update (end_date) on public.challenge_pauses to authenticated;

-- ═════════════════════════════════════════════
-- ③ create_challenge — p_success_threshold 추가 (0041 의 14-인자 → 15-인자)
--    0041 본문을 그대로 승계하고 인자 1개만 맨 뒤에 더한다.
--    default 를 주므로 **구 클라(14인자 명명 호출)는 그대로 동작한다** — 임계 100 = 지금과 같은 판정.
-- ═════════════════════════════════════════════
-- 구 시그니처를 정확히 지정해 지운다. 오버로드가 둘 다 남으면 PostgREST 가 모호성으로 실패한다.
drop function if exists public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int);

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

  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type, intro_image_url,
    bet_tier, bet_donation_mode, goal_type, target_count, success_threshold
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type, p_intro_image_url,
    v_bet_tier, coalesce(p_bet_donation_mode, 'commitment'), v_goal_type, v_target_count, v_success_threshold
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int, int) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int, int) to authenticated;

-- ═════════════════════════════════════════════
-- ④ get_invite_info — success_threshold 키 추가
--    0076(최신 정의) 본문을 그대로 승계 + 키 1개만 추가 — 기존 반환 키·이름 전부 보존(클라가 전부 사용 중)
--    ✅ 반환 타입이 jsonb 그대로라 drop function 불필요
--    🔒 creator_id 는 계속 미반환 (0023:51 원칙)
-- ═════════════════════════════════════════════
create or replace function public.get_invite_info(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
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
         c.gave_up_at, c.creator_id, c.category_id,
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
    'member_count',       v_member_count,
    'creator_nickname',   coalesce(v_row.creator_nickname, '도전자'),
    'category', case
      when v_row.category_id is null then null
      else jsonb_build_object('emoji', v_row.category_emoji, 'name', v_row.category_name)
    end
  );
end;
$$;

alter function public.get_invite_info(uuid) owner to postgres;
grant execute on function public.get_invite_info(uuid) to authenticated, anon;

-- 검증:
--   1) [기존 불변] 구 클라 그대로 하다 생성(14인자 명명 호출) → success_threshold = 100.
--   2) [신규] create_challenge(... p_success_threshold := 90) → 90 저장. 91 을 주면 raise exception.
--   3) [소급 조작 차단] 앱(authenticated) 세션에서
--        supabase.from('challenges').update({ success_threshold: 90 }).eq('id', <내가 만든 하다>)
--      → 42501 permission denied for table challenges (0070 이 UPDATE 를 회수한 상태 유지).
--   4) [초대] get_invite_info(<하다 id>) → success_threshold 포함 + 기존 키
--      (recruit_cap_exempt·host_tier·sponsor_*·goal_type·bet_*·intro_image_url·category…) 전부 그대로.
--      creator_id 는 여전히 미반환.
--   5) [멈춤 이력] 같은 방 멤버가 challenge_pauses insert(본인) → 성공 / 비멤버 insert → RLS 거부 /
--      남의 행 update → RLS 거부 / 본인 행의 user_id 변경 시도 → 42501(컬럼 grant 없음) /
--      delete 시도 → 정책 없어 거부 / end_date < start_date → CHECK 위반.
--   6) 부여 권한 확인:
--      select privilege_type, column_name from information_schema.column_privileges
--        where table_name = 'challenge_pauses' and grantee = 'authenticated'
--        and privilege_type in ('INSERT','UPDATE');
--      -- 기대: INSERT = challenge_id·user_id·start_date·end_date / UPDATE = end_date 뿐.
