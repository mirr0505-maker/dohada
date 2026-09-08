-- 🚀 0080 — 명사 승격을 '무대'로 잇기 (users.host_tier → challenges.host_tier 자동 반영)
--
-- 배경: host_tier 는 **서로 다른 두 축**으로 두 테이블에 있다. 축을 합치지는 않는다(설계상 다른 축이 맞다).
--   challenges.host_tier (0058) = "이 **하다**가 무대인가"  — 운영자 수동 지정(admin_set_host_tier)
--   users.host_tier      (0064) = "이 **사람**이 명사인가"  — 누적 1,000명 승격 심사(admin_review_promotion, 0067)
--
-- 그런데 지금 이 둘이 아무 데서도 이어져 있지 않다:
--   1,000명을 모아 명사로 승격돼도 그 사람이 여는 하다는 **광장 '무대' 섹션에 뜨지 않는다**
--   (광장 무대 = challenges.host_tier in ('figure','org') 로 고른다).
--   승격이 실제로 주는 건 아바타 금빛 링 하나뿐이고, 무대에 서려면 운영자가 하다마다 손으로 지정해야 했다.
--   앱 주인의 요구는 명확하다 — "광장에는 유명인 하다가 같이 나와야 한다."
--   → **사람이 명사가 되면 그 사람의 하다에 무대 표식이 따라 붙게** 두 지점만 잇는다.
--     ① 명사/조직이 새로 하다를 열 때(create_challenge) — 앞으로 만들 하다
--     ② 승격이 승인되는 순간(admin_review_promotion) — 이미 열어둔 하다에 소급
--
-- 🔒 무대는 kind='open' 하다에만 (0079 가드와 같은 이유):
--   challenges 의 비멤버 SELECT 는 open 일 때만 열린다(0003 challenges_open_read).
--   closed/cheered/solo 에 무대를 찍으면 **광장에 영영 안 보이는 무대**가 된다 = 조용한 실패.
--   그래서 아래 두 곳도 open 이 아니면 절대 찍지 않는다.
--
-- 📌 host_label 에 닉네임을 '복사'하는 이유 (의도된 트레이드오프 — 기록해 둔다):
--   비멤버는 users 행을 못 읽는다(users_self_read = 본인이거나 같은 하다 멤버일 때만, 0005:175).
--   → 광장 카드에 명사 이름을 띄울 수 있는 **유일한 경로가 challenges.host_label** 이다.
--   부작용: 나중에 닉네임을 바꾸면 이미 찍힌 host_label 은 옛 이름으로 남는다(stale).
--   **이건 감수한다** — 운영자가 admin_set_host_tier 로 언제든 고칠 수 있고,
--   대안은 "이름 없는 무대"뿐이라 더 나쁘다. (조인으로 실시간 해결하려면 users 의 RLS 를 넓혀야 하는데,
--   그건 광장 하나를 위해 사용자 신원 노출 범위를 여는 것 = 훨씬 큰 대가.)
--
-- 판정 로직(완주/성공)은 여기서 복제하지 않는다 — 단일 진실원천은 mobile/lib/stats.ts (0078 상단 원칙).
-- 컬럼·테이블·트리거 추가 없음. 아래 두 함수 교체가 전부다.
-- 재실행 안전 — create or replace (두 함수 모두 시그니처 불변이라 drop 불필요).

-- ═════════════════════════════════════════════
-- ① create_challenge — 개설자가 이미 명사/조직이면 무대 표식을 자동으로
--    0078 의 15-인자 본문을 그대로 승계하고, 개설자 티어를 읽어 찍는 부분만 더한다.
--    인자 목록·기본값·기존 검증(내기 kind 제한 / count 유형 / 성공 임계)은 하나도 바뀌지 않는다.
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

  if p_kind = 'open' and v_creator_tier in ('figure', 'org') then
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
-- ② admin_review_promotion — 승격되는 순간, 이미 열어둔 하다에 소급 적용
--    0067 본문을 그대로 승계하고, users.host_tier='figure' 를 찍은 자리 바로 뒤에 소급 update 만 더한다.
--    🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 본문 첫 줄 is_admin() 검사 필수 (0059 최상위 불변식).
--    보류(p_approve=false)·자격미달·이미 figure 분기에서는 그 전에 return/raise 로 빠지므로 아무것도 찍히지 않는다.
-- ═════════════════════════════════════════════
create or replace function public.admin_review_promotion(p_challenge_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  -- 승격 임계 — 추후 상향 가능 (숫자를 한 곳에만 두기 위한 상수)
  v_threshold constant int := 1000;
  v_kind text; v_creator uuid; v_title text; v_count int;
  v_creator_name text;   -- 🚀 0080: 소급 host_label 로 복사할 닉네임
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  select kind, creator_id, title into v_kind, v_creator, v_title
    from public.challenges where id = p_challenge_id;
  if v_kind is null then raise exception 'challenge not found'; end if;
  if v_kind <> 'open' then raise exception 'only open challenges'; end if;

  -- 보류 — 큐에서만 빼고 아무 것도 바꾸지 않는다 (되돌리려면 컬럼을 false 로)
  if not p_approve then
    update public.challenges set promotion_declined = true where id = p_challenge_id;
    return;
  end if;

  -- 자격 재검증 — 큐를 본 시점과 누르는 시점 사이에 조건이 달라질 수 있다. 자격 없는 승격 차단.
  select count(*) into v_count from public.challenge_members where challenge_id = p_challenge_id;
  if v_count < v_threshold then raise exception 'not eligible'; end if;

  -- org(조직)는 덮어쓰지 않고, 이미 figure 면 재승격 없음 → not found 로 알림 중복도 막힌다
  update public.users set host_tier = 'figure', host_since = now()
    where id = v_creator and host_tier = 'individual';
  if not found then return; end if;

  -- 🚀 0080: 승격 순간, 이 사람이 **이미 열어둔** 하다에도 무대 표식을 소급한다.
  --   승격 전에 만든 하다가 광장 무대에서 빠지면 "승격됐는데 내 하다는 왜 안 보이지"가 된다.
  --   조건을 하나씩 좁히는 이유:
  --     kind='open'                → 무대는 open 에만 (비멤버 SELECT 가 open 에만 열림 — 0079 와 같은 이유)
  --     end_date >= current_date   → 이미 끝난 하다를 지금 와서 무대에 올릴 이유가 없다
  --     gave_up_at is null         → 개설자가 접은 하다 제외
  --     host_tier = 'individual'   → ⚠️ 이미 무대인 하다는 **덮어쓰지 않는다**.
  --       운영자가 손으로 'org' 로 지정해 둔 하다를 승격이 'figure' 로 깎아버리면 안 된다
  --       (바로 위 update 가 users 쪽에서 org 를 보호하는 것과 정확히 같은 결).
  select nickname into v_creator_name from public.users where id = v_creator;
  update public.challenges
     set host_tier  = 'figure',
         host_label = v_creator_name   -- 📌 닉네임 복사 (상단 트레이드오프 주석 참조 — stale 감수)
   where creator_id = v_creator
     and kind = 'open'
     and end_date >= current_date
     and gave_up_at is null
     and host_tier = 'individual';
  -- role 은 건드리지 않는다 — figure 는 도전자 본인이라 'member' 가 맞다 (org 만 'host', 0069).

  -- kind 'host_promoted' 는 0064 에 이미 있다 — CHECK 제약을 건드리지 않는다
  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
    values (v_creator, 'host_promoted', p_challenge_id,
      -- 숫자를 박지 않는다: 심사 시점엔 이미 임계를 훌쩍 넘겨 있을 수 있고(1,200명…), 임계 자체도 나중에 오를 수 있다.
      '「' || v_title || '」에 정말 많은 동료가 함께했어요 — 이제 유명인이에요. 아바타에 금빛 테두리가 생겼어요', now());
end $$;

alter function public.admin_review_promotion(uuid, boolean) owner to postgres;
grant execute on function public.admin_review_promotion(uuid, boolean) to authenticated;

-- 검증:
--   0) [기존 불변] 평범한 계정(users.host_tier='individual')으로 하다 생성 →
--      challenges.host_tier='individual', host_label is null, 개설자 멤버 role='member'. (0078 과 완전 동일)
--      구 클라의 14인자 명명 호출도 그대로 동작(p_success_threshold 기본 100).
--
--   1) [명사가 open 하다 개설 → 자동 무대]
--        update public.users set host_tier='figure' where email='<명사 이메일>';
--      그 계정으로 앱에서 '누구나' 하다 생성 후:
--        select kind, host_tier, host_label from public.challenges order by created_at desc limit 1;
--      → 'open' / 'figure' / '<그 사람 nickname>'
--        select role from public.challenge_members
--          where challenge_id='<새 하다 id>' and user_id='<그 사람 id>';
--      → 'member'  (figure 는 도전자 본인이므로 집계에 남는다)
--
--   2) [조직이 open 하다 개설] users.host_tier='org' 계정으로 '누구나' 생성 →
--      challenges.host_tier='org' + host_label='<조직 닉네임>' + 개설자 멤버 role='host'
--      (도전자 집계에서 제외 — 0069 와 동일한 규칙)
--
--   3) [open 아니면 절대 안 찍힘] 같은 명사 계정으로 나홀로/응원받기/다함께 하다 생성 →
--      host_tier='individual', host_label is null, role='member'.
--      (0079 와 같은 이유 — 비멤버가 못 읽어 광장에 뜨지 않을 무대는 만들지 않는다)
--
--   4) [승격 소급] 아직 individual 인 개설자가 open 하다를 여러 개 열어둔 상태에서
--        select admin_review_promotion('<1,000명 넘은 open id>', true);
--      → users.host_tier='figure' + host_since set + host_promoted 알림 정확히 1건 (0067 동작 그대로)
--      → 그 사람의 **끝나지 않은 open 하다 전부** 무대로 갱신:
--        select id, title, kind, end_date, gave_up_at, host_tier, host_label
--          from public.challenges where creator_id='<그 사람 id>' order by created_at;
--        기대: kind='open' + end_date >= current_date + gave_up_at is null 인 행만 'figure'/'<nickname>'.
--              이미 끝난 하다 / 접은 하다 / closed·cheered·solo 하다 → 'individual' 그대로.
--
--   5) [org 보호 — 덮어쓰기 금지] 승격 전에 운영자가 그 사람의 어떤 open 하다를 손으로 지정해 둔 경우:
--        select admin_set_host_tier('<그 하다 id>', 'org', '환경부');
--      → 이후 admin_review_promotion(…, true) 를 실행해도 그 하다는 host_tier='org', host_label='환경부' 유지
--        (host_tier='individual' 조건이 걸러낸다). 나머지 individual 하다만 'figure' 가 된다.
--
--   6) [보류·자격미달·재승격은 무동작]
--        admin_review_promotion(id, false) → promotion_declined=true 뿐. users.host_tier 불변 +
--          그 사람 하다의 challenges.host_tier 전부 불변 + 알림 0건.
--        누적 999명 open 에 (id, true) → 'not eligible' 예외, 아무것도 안 찍힘.
--        이미 figure 인 사람에게 재호출 → `if not found then return` 로 빠져 소급 update 도 알림도 없음.
--        solo/cheered/closed id → 'only open challenges' / 없는 id → 'challenge not found' (0067 그대로)
--
--   7) [게이트 유지] 비-admin 계정으로 admin_review_promotion 호출 → 'admin only' 예외(42501).
--
--   8) [닉네임 stale] 명사가 나중에 닉네임을 바꿔도 이미 찍힌 host_label 은 옛 이름 — 의도된 동작.
--      고치려면: select admin_set_host_tier('<하다 id>', 'figure', '<새 이름>');
