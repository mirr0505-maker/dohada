-- 🚀 0073 — 초대 미리보기에 주최 계층 노출 (ORG_HADA_PLAN.md Step 2 · TO-BE 4)
--
-- 배경 (ORG_HADA_PLAN.md §2.5):
--   HostBadge 사용처가 방 현황 탭 + 홈 JoinCard(open 전용) 2곳뿐이라, 조직 하다가 closed/cheered 면
--   카톡 초대 링크로 들어온 사람은 🏛️ 를 한 번도 못 보고 '함께 하기' 를 누른다.
--   닉네임·아바타에는 사칭 방어가 전무해 배지가 유일한 신뢰 방어선인데(§5 잔여 리스크),
--   정작 합류를 결정하는 화면에 그 방어선이 도달하지 않는다.
--
-- 변경 = get_invite_info 반환에 host_tier / host_label 두 키만 추가.
--   ✅ 기존 반환 키·순서·이름 전부 보존 (클라가 전부 사용 중)
--   ✅ 반환 타입이 jsonb 그대로라 drop function 불필요 — create or replace 로 충분
--   🔒 SECURITY DEFINER 이므로 creator_id 등 내부 ID 는 계속 반환하지 않는다 (0023:51 원칙).
--      host_tier/host_label 은 운영자가 큐레이션해 부여한 '공개용 표식'이라 노출이 목적 그 자체.
--
-- 본문은 0041(최신 정의) 그대로 승계 + 위 두 키만 얹음. 재실행 안전.

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
--   1) org 하다: select get_invite_info('<id>') → host_tier='org', host_label='환경부'
--   2) 일반 하다: host_tier='individual', host_label=null (클라 HostBadge 가 알아서 미노출)
--   3) 기존 키(goal_type·bet_tier·intro_image_url·category…) 전부 그대로 반환되는지 확인
--   4) creator_id 는 여전히 미반환 (내부 ID 비노출)
