-- 🚀 0023 — get_invite_info RPC 신설 (P1-9 해소)
--
-- AS-IS: invite/[id].tsx 가 challenges 를 직접 SELECT (db.ts fetchChallengeDetailForInvite).
--        challenges 의 SELECT RLS 는 멤버 or open 한정 → closed/cheered 챌린지의 초대 링크를
--        카톡으로 받은 비멤버는 PGRST116(0 rows)으로 "참여할 수 없어요" 오류를 봄.
-- TO-BE: security definer RPC 로 초대 카드에 필요한 최소 필드만 안전하게 반환.
--        solo 챌린지는 거부 (외부 초대 불가). 종료된 챌린지도 거부.
--
-- 호출: supabase.rpc('get_invite_info', { p_challenge_id: '<uuid>' })
-- 반환: jsonb {id, title, kind, start_date, end_date, invitation_message, member_count, creator_nickname, category}

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
  -- 1. 챌린지 조회 (RLS 우회 — security definer)
  select c.id, c.title, c.kind, c.start_date, c.end_date,
         c.invitation_message, c.gave_up_at, c.creator_id, c.category_id,
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

  -- 2. 활성 멤버 수
  select count(*)::int into v_member_count
    from public.challenge_members
   where challenge_id = p_challenge_id
     and gave_up_at is null;

  -- 3. 안전 필드만 반환 (creator_id 등 내부 ID 노출 금지)
  return jsonb_build_object(
    'id',                 v_row.id,
    'title',              v_row.title,
    'kind',               v_row.kind,
    'start_date',         v_row.start_date,
    'end_date',           v_row.end_date,
    'invitation_message', v_row.invitation_message,
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

-- 적용 후 검증:
--   select public.get_invite_info('<적당한 challenge uuid>'::uuid);
