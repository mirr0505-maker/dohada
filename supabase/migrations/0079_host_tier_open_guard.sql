-- 🚀 0079 — 무대(명사·조직) 지정은 '누구나(open)' 하다에만 (admin_set_host_tier 가드)
--
-- 배경: 새 '광장' 탭이 무대(host_tier='figure'|'org') 하다를 최상단 상설 섹션으로 노출한다.
--   그런데 challenges 의 비멤버 SELECT 는 **kind='open' 일 때만** 허용된다(0003:25 challenges_open_read).
--   → 다함께(closed)·응원받기(cheered)·나홀로(solo) 하다에 무대를 지정하면 그 하다는
--     **광장에 영영 보이지 않는다.** 지정은 성공했는데 아무 데도 안 뜨는 = 조용히 실패하는 함정.
--   운영자는 "지정했는데 왜 안 보이지"로 시간을 태우게 되고, 원인은 RLS 라 화면상 단서가 없다.
--
-- 그래서 지정 시점에 막는다. 무대는 성격상으로도 open 이어야 한다 —
--   0074 주석: "조직 하다는 애초에 광장이라 전제가 다르다"(그래서 모집 캡도 면제받는다).
--   초대로만 들어가는 닫힌 방을 '공식 무대'라 부르는 건 무대의 정의와도 어긋난다.
--
-- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 본문 첫 줄 is_admin() 검사 필수 (0059:6-10 최상위 불변식).
--
-- 0069 의 본문(멤버 role 동기화 포함)을 그대로 승계하고 **가드 한 덩어리만** 더한다.
-- 재실행 안전 — create or replace.

create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator_id uuid;
  v_kind       text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;

  select kind into v_kind from public.challenges where id = p_challenge_id;
  if v_kind is null then
    raise exception '없는 하다입니다: %', p_challenge_id;
  end if;

  -- 🚀 0079 가드 — 무대(명사/조직)는 누구나(open) 하다에만.
  --   individual 로 되돌리는 건 kind 와 무관하게 허용해야 한다(잘못 지정된 걸 원복하는 길을 막으면 안 된다).
  if p_tier in ('figure', 'org') and v_kind <> 'open' then
    raise exception
      '무대(명사·공식)는 누구나(open) 하다에만 지정할 수 있어요. 이 하다는 %입니다. '
      '누구나 방이 아니면 비멤버가 볼 수 없어(RLS) 광장에 뜨지 않습니다.', v_kind;
  end if;

  update public.challenges
     set host_tier = p_tier, host_label = p_label
   where id = p_challenge_id
  returning creator_id into v_creator_id;

  -- p_tier='org' 면 개설자를 도전자 집계에서 빼고(role='host'), 해제 시 원복한다 (0069)
  update public.challenge_members
     set role = case when p_tier = 'org' then 'host' else 'member' end
   where challenge_id = p_challenge_id
     and user_id = v_creator_id;
end $$;
alter function public.admin_set_host_tier(uuid, text, text) owner to postgres;
grant execute on function public.admin_set_host_tier(uuid, text, text) to authenticated;

-- 검증:
--   1) [차단] admin 계정, kind='closed' 인 하다:
--        select admin_set_host_tier('<closed_id>', 'org', '환경부');
--      → exception "무대(명사·공식)는 누구나(open) 하다에만 …" (지정 안 됨)
--   2) [허용] kind='open' 인 하다:
--        select admin_set_host_tier('<open_id>', 'org', '환경부');
--      → host_tier='org' + 개설자 challenge_members.role='host'  (0069 동작 그대로)
--   3) [원복 가능] 위 closed 하다에 실수로 예전에 무대가 붙어 있었다면:
--        select admin_set_host_tier('<closed_id>', 'individual', null);   → kind 무관 허용
--   4) [없는 하다] select admin_set_host_tier(gen_random_uuid(), 'org', 'x'); → '없는 하다입니다' exception
--      (기존엔 조용한 무동작이었다 — 운영자가 오타를 눈치채지 못하던 것도 같이 고친다)
--   5) [게이트 유지] 비-admin 계정으로 호출 → 'admin only' exception
