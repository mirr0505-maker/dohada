-- 🚀 0041 — 목표 횟수형 도전 (goal_type='count')
--
-- 배경 (베타 피드백): 100대명산·제주올레 완주·둘레길/자전거길 스탬프처럼
--   "매일 인증"이 아니라 "기간 내 N개 달성"하는 도전이 있다 (주말에 몰아서, 하루 2개도).
--
-- 유형:
--   cadence (기존): 기간 × 빈도(daily/weekly3/weekly1)로 목표 인증 수 산출. 일일/주기 의무.
--   count   (신규): target_count 개를, 기간 내 언제든(몰아서 OK) 달성하면 완주.
--                   조기 완주 인정(종료일 안 기다림), 일일 의무 없음, 늦합류해도 목표 고정.
--
-- 결정 (사용자 확정 2026-06-13): count 유형은 베타에서 내기 비활성(응원만) — 서버에서 강제.
-- 재실행 안전 — add column if not exists / drop+recreate.

-- ═════════════════════════════════════════════
-- 1. 목표 유형 컬럼
-- ═════════════════════════════════════════════
alter table public.challenges
  add column if not exists goal_type text not null default 'cadence';
alter table public.challenges drop constraint if exists challenges_goal_type_check;
alter table public.challenges add constraint challenges_goal_type_check
  check (goal_type in ('cadence','count'));

alter table public.challenges
  add column if not exists target_count int;            -- count 유형의 목표 개수 (cadence 는 null)
alter table public.challenges drop constraint if exists challenges_target_count_check;
alter table public.challenges add constraint challenges_target_count_check
  check (
    (goal_type = 'count' and target_count is not null and target_count >= 1)
    or (goal_type <> 'count' and target_count is null)
  );

comment on column public.challenges.goal_type is
  'cadence=주기형(기간×빈도) / count=목표 횟수형(기간 내 N개 달성). 0041.';
comment on column public.challenges.target_count is
  'count 유형의 목표 개수 (cadence 는 null). 0041.';

-- ═════════════════════════════════════════════
-- 2. create_challenge — goal_type·target_count 추가 (0040 의 12-인자 → 14-인자)
--    count 유형은 target_count 보존 + 내기 강제 비활성(응원만).
-- ═════════════════════════════════════════════
drop function if exists public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text);

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
  p_target_count    int  default null
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- count 유형은 내기 비활성 (베타: 목표형 betOutcome 미지원 — 응원만)
  if v_goal_type = 'count' then
    v_bet_tier := null;
  end if;

  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type, intro_image_url,
    bet_tier, bet_donation_mode, goal_type, target_count
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type, p_intro_image_url,
    v_bet_tier, coalesce(p_bet_donation_mode, 'commitment'), v_goal_type, v_target_count
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text, text, int) to authenticated;

-- ═════════════════════════════════════════════
-- 3. get_invite_info — 초대 미리보기에 목표 유형 노출 (합류 전 "목표 N개" 표시)
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
--   1) count create_challenge(... p_goal_type:='count', p_target_count:=16) → goal_type='count', target_count=16, bet_tier=null
--   2) count + p_bet_tier 줘도 → bet_tier null (강제 비활성)
--   3) cadence 생성 → goal_type='cadence', target_count null (기존과 동일)
--   4) get_invite_info(count방) → goal_type/target_count 포함
