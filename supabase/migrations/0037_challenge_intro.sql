-- 🚀 0037 — 챌린지 안내문(소개글 + 이미지) — 나홀로 제외 모든 방
--
-- 배경: 누구나(open)는 홈에서, 응원받기(cheered)·다함께(closed)는 초대 링크에서
--   합류 여부를 결정한다. 그 전에 "이게 어떤 도전인지" 알 수 있게 안내문을 보여준다.
--   description(텍스트)은 이미 있으나 생성 마법사가 수집하지 않았고, 이미지 컬럼이 없었다.
--   → intro_image_url 컬럼 추가 + create_challenge / get_invite_info 가 함께 다루게 확장.
--
-- 재실행 안전 — add column if not exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. 안내문 이미지 컬럼 (보관함에서 올린 이미지의 R2 URL)
-- ═════════════════════════════════════════════
alter table public.challenges
  add column if not exists intro_image_url text;

-- ═════════════════════════════════════════════
-- 2. create_challenge — 안내문 이미지 파라미터 추가 (description 은 기존부터 지원)
--    기존 9-인자 시그니처를 교체. p_intro_image_url 는 default null 이라 하위호환.
-- ═════════════════════════════════════════════
drop function if exists public.create_challenge(text, text, text, date, date, int, int, text, text);

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
  p_intro_image_url text default null
) returns public.challenges
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type, intro_image_url
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type, p_intro_image_url
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text, text) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text, text) to authenticated;

-- ═════════════════════════════════════════════
-- 3. get_invite_info — 초대 미리보기에 안내문(description + 이미지) 추가
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
--   1) create_challenge(... , p_description := '소개', p_intro_image_url := 'https://...') → 행에 저장
--   2) select public.get_invite_info('<uuid>') → description / intro_image_url 포함
