-- 🚀 0040 — 다인 내기(⑤c): 챌린지 단위 내기 설정 (다함께·누구나)
--
-- 설계 (PHASE2 2.1, 사용자 확정):
--   다함께(closed)·누구나(open) 방은 개설 시 내기를 걸 수 있고(bet_tier),
--   참여자 전원이 같은 티어·기부모드로 각자 선주문 결제한다.
--   solo·cheered 는 per-주문(⑤a)이라 챌린지 단위 설정을 두지 않음(null 유지).
--   내기 걸린 방은 성인만 합류(클라 joinChallenge + 본 RPC 외 INSERT 경로에서 검사).
--
-- 재실행 안전 — add column if not exists / drop+recreate.

-- ═════════════════════════════════════════════
-- 1. 챌린지 단위 내기 설정 컬럼
-- ═════════════════════════════════════════════
alter table public.challenges
  add column if not exists bet_tier text;                                  -- null = 내기 없음
alter table public.challenges drop constraint if exists challenges_bet_tier_check;
alter table public.challenges add constraint challenges_bet_tier_check
  check (bet_tier is null or bet_tier in ('one_cup','hearty_cup','grand_cup'));

alter table public.challenges
  add column if not exists bet_donation_mode text not null default 'commitment';
alter table public.challenges drop constraint if exists challenges_bet_donation_mode_check;
alter table public.challenges add constraint challenges_bet_donation_mode_check
  check (bet_donation_mode in ('commitment','pledge','always'));

comment on column public.challenges.bet_tier is
  '다인 내기 티어 (다함께·누구나 전용, null=내기 없음). solo·cheered 는 per-주문(gift_orders)이라 항상 null.';

-- ═════════════════════════════════════════════
-- 2. create_challenge — 내기 설정 파라미터 추가 (0037 의 10-인자 → 12-인자)
--    bet_tier 는 다함께·누구나에서만 적용(그 외 kind 는 null 강제).
-- ═════════════════════════════════════════════
drop function if exists public.create_challenge(text, text, text, date, date, int, int, text, text, text);

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
  p_bet_donation_mode text default 'commitment'
) returns public.challenges
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
  -- 내기는 다함께·누구나만 — 그 외는 무시(null)
  v_bet_tier text := case when p_kind in ('closed','open') then p_bet_tier else null end;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type, intro_image_url,
    bet_tier, bet_donation_mode
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type, p_intro_image_url,
    v_bet_tier, coalesce(p_bet_donation_mode, 'commitment')
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text, text, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- 3. get_invite_info — 초대 미리보기에 내기 정보 추가 (합류 전 "내기 걸림·성인 인증 필요" 표시)
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
--   1) closed 방 create_challenge(... p_bet_tier := 'one_cup') → bet_tier='one_cup'
--   2) solo 방에 p_bet_tier 줘도 → null (kind 제한)
--   3) get_invite_info(내기방) → bet_tier 포함
