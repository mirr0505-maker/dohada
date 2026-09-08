-- 🚀 0083 — 공식(org) 무대는 조직 계정의 하다에만 (admin_set_host_tier 가드 ②)
--
-- 배경 (사용자 방향): 조직 하다는 **그 조직의 공식 계정**이 열어야 한다.
--   기업·정부기관의 하다가 담당자 개인 계정에 묶이면, 담당자가 퇴사하는 순간 그 하다는 갈 곳이 없다.
--   그리고 이건 취향이 아니라 구조다 — 0022 challenges_creator_update 가
--     `using (creator_id = auth.uid()) with check (creator_id = auth.uid())`
--   이라 **creator_id 는 누구에게도 넘길 수 없다.** 소유권 이전이 코드상 불가능하므로
--   계정 자체가 조직 소유여야 한다 (ORG_HADA_PLAN 결정 ②).
--
-- 그런데 challenges.host_tier='org' 를 찍는 경로 넷 중 셋은 이미 이 원칙을 지키고 있었다:
--   · create_challenge(0080)          — 개설자 users.host_tier 가 figure/org 일 때만 자동 부여 ✅
--   · admin_set_user_host_tier(0081)  — 그 사람을 org 로 만들 때만 소급 ✅
--   · admin_review_promotion(0080)    — 'figure' 만 찍음 ✅
--   · admin_set_host_tier(0079)       — ❌ 개설자를 아예 안 본다  ← 이 마이그레이션이 닫는 구멍
--
-- ⚠️ 가드는 **'org 로 들어가는 전환'에만** 건다. 이미 org 인 하다의 표시명 수정은 계속 허용한다.
--   목적은 "개인 계정에 새 공식 하다가 생기는 것"을 막는 것이지 "이미 선 무대를 얼리는 것"이 아니다.
--   (예: 가드 이전에 세운 씨앗 무대의 host_label 을 나중에 고칠 수 있어야 한다.)
--
-- ⚠️ figure(명사)에는 걸지 않는다 — 명사는 개인이라 '전용 계정' 논리가 성립하지 않고,
--   운영팀이 게스트 명사의 하다 하나만 무대에 올리고 싶을 때가 있다.
-- ⚠️ individual 로 되돌리는 건 언제나 허용한다(0079 와 같은 결 — 원복 경로를 막으면 안 된다).
--
-- [불변] 기존 데이터는 한 행도 바뀌지 않는다. 앞으로의 지정만 달라진다.
-- 0079 본문을 그대로 승계하고 가드 한 덩어리만 더한다. 재실행 안전 — create or replace.

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

  -- 🚀 0079 가드 ① — 무대(명사/조직)는 누구나(open) 하다에만.
  --   individual 로 되돌리는 건 kind 와 무관하게 허용해야 한다(잘못 지정된 걸 원복하는 길을 막으면 안 된다).
  if p_tier in ('figure', 'org') and v_kind <> 'open' then
    raise exception
      '무대(명사·공식)는 누구나(open) 하다에만 지정할 수 있어요. 이 하다는 %입니다. '
      '누구나 방이 아니면 비멤버가 볼 수 없어(RLS) 광장에 뜨지 않습니다.', v_kind;
  end if;

  -- 🚀 0083 가드 ② — 공식(org)은 조직 계정의 하다에만.
  --   `v_prev_tier is distinct from 'org'` = **org 로 새로 들어가는 전환일 때만** 검사한다.
  --   이미 org 인 하다는 통과 → 표시명(host_label) 수정이 계속 가능하다.
  if p_tier = 'org' and v_prev_tier is distinct from 'org' then
    select host_tier into v_creator_tier from public.users where id = v_creator_id;
    if v_creator_tier is distinct from 'org' then
      raise exception
        '공식(조직) 무대는 조직 계정이 연 하다에만 지정할 수 있어요. '
        '이 하다의 개설자는 조직 계정이 아닙니다. 운영자 콘솔 「사람 티어 지정」에서 '
        '그 계정을 먼저 공식으로 바꾸면, 그 계정의 누구나 하다는 자동으로 무대가 됩니다. '
        '(개설자를 나중에 조직으로 넘길 수 없어서 — creator_id 이전은 구조상 불가능합니다)';
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

-- 검증:
--   1) [차단] 개인 계정이 연 open 하다에 org 지정:
--        select admin_set_host_tier('<개인 계정의 open 하다>', 'org', '아무개');
--      → exception "공식(조직) 무대는 조직 계정이 연 하다에만 …"
--   2) [기존 무대 불변] 가드 이전에 세운 씨앗(개설자가 개인 계정, host_tier 이미 'org'):
--        select host_tier, host_label from public.challenges where id='<씨앗 id>';   -- org / 두하다 운영팀
--        select admin_set_host_tier('<씨앗 id>', 'org', '두하다 운영팀 v2');
--      → **성공** (이미 org → 전환이 아니므로 가드를 타지 않는다). 표시명만 바뀐다.
--   3) [정상 경로] 조직 전용 계정:
--        select admin_set_user_host_tier('<조직 계정 id>', 'org');   -- 0081
--        → 그 계정의 진행 중 open 하다는 이미 자동으로 org (소급). 이후 새로 만드는 하다도 자동(0080).
--        → admin_set_host_tier(org) 를 쓸 일 자체가 거의 없어진다.
--   4) [명사는 무관] 개인 계정의 open 하다에 figure 지정 → 성공 (가드 대상 아님).
--   5) [원복] 어떤 하다든 individual 로 내리기 → 성공 (kind·계정 무관).
--   6) [게이트 유지] 비-admin 호출 → 'admin only'.
