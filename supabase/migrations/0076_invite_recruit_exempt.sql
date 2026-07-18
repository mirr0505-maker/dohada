-- 🚀 0076 — 초대 미리보기(get_invite_info)에 모집 캡 면제값(recruit_cap_exempt) 노출
--
-- 버그: 클라 mobile/lib/stats.ts isRecruiting 이 recruit_cap_exempt 를 보게 고쳤는데,
--   joinChallenge(mobile/lib/invite.ts)는 그 판정을 get_invite_info RPC 결과로 하므로
--   RPC 가 recruit_cap_exempt 를 안 주면 면제(0064)받은 open 하다에서 클라만 여전히 "모집 마감"으로
--   신규 합류를 막는다(DB is_recruiting 은 허용). 첫 명사/조직 온보딩(=면제를 주는 순간) 바로 표면화.
--
--   ✅ 0075(최신 정의) 본문을 그대로 승계 + 키 1개만 추가 — 기존 반환 키·이름 전부 보존(클라가 전부 사용 중)
--   ✅ 반환 타입이 jsonb 그대로라 drop function 불필요
--   🔒 creator_id 는 계속 미반환 (0023:51 원칙)
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
    -- 🚀 0076: 모집 캡 면제값 — 클라 isRecruiting 이 open 하다의 기간 50% 자동마감을 건너뛸지 판단
    'recruit_cap_exempt', coalesce(v_row.recruit_cap_exempt, false),
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
--   1) [면제 노출] select get_invite_info('<recruit_cap_exempt=true 인 open id>');
--      → recruit_cap_exempt=true + 기존 키(host_tier·goal_type·bet_tier·sponsor_*·intro_image_url·category…) 전부 그대로.
--   2) [기본값] 면제 안 준 방 → recruit_cap_exempt=false. creator_id 는 여전히 미반환.
