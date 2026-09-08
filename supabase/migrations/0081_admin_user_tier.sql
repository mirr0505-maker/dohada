-- 🚀 0081 — 운영자가 **사람을 직접 명사/조직으로 지정**하는 경로 (+ 사람 검색)
--
-- 배경 (왜 필요한가):
--   지금 users.host_tier 가 'figure' 로 올라가는 길은 **단 하나** — admin_review_promotion(0067·0080) 뿐이고,
--   그 함수는 "누적 1,000명을 넘은 open 하다"를 전제로 한다(자격 재검증 v_threshold=1000).
--   → **운영팀이 밖에서 섭외해 데려온 명사를 올릴 방법이 없다.** 그 사람은 아직 1,000명짜리 하다가 없으니까.
--     (users 테이블을 SQL Editor 에서 직접 update 하면 users.host_tier 만 바뀌고
--      이미 열어둔 하다에 대한 소급·알림이 전부 빠진다 = 반쪽 승격.)
--   앱 주인의 요구: "반드시 1,000명 넘는 것만 아니고, 운영팀이 지정해서 올릴 수 있게."
--
-- 📌 두 경로는 **공존**한다. 기존 1,000명 심사 큐(admin_review_promotion)는 손대지 않는다.
--   자라난 사람 → 심사 큐(축복).      섭외한 사람 → 직접 지정(이 파일).
--   대신 **승격의 결과는 완전히 같아야 한다** — 소급 조건·host_label·role·알림을 0080 과 문자 그대로 맞춘다.
--   (두 경로가 다르게 동작하면 "어떻게 승격됐는지"에 따라 무대가 달라지는 설명 불가능한 상태가 된다.)
--
-- 🔒 최상위 불변식(0059:6-10): 아래 두 함수는 SECURITY DEFINER 라 RLS 를 우회한다
--   → 본문 첫 줄에서 public.is_admin() 을 검사하고 아니면 즉시 raise. 없으면 아무 로그인 사용자나
--     전 사용자 이메일을 긁고 남을 명사로 만들 수 있다 = 치명적. 클라 게이트는 UX 용일 뿐 신뢰하지 않는다.
--
-- 판정 로직(완주/성공)은 여기서 복제하지 않는다 — 단일 진실원천은 mobile/lib/stats.ts (0078·0080 상단 원칙).
-- 컬럼·테이블·트리거 추가 없음. 아래 함수 2개가 전부다.
-- 재실행 안전 — drop if exists (시그니처 명시) 후 create.

-- ═════════════════════════════════════════════
-- ① admin_search_users — 사람 검색
--    운영 콘솔에는 하다 제목 검색(admin_search_challenges, 0059 ⑧)뿐이라 **사람을 찾는 수단이 없다.**
--    사람을 지정하려면 먼저 사람을 특정할 수 있어야 한다.
--
--    ⚠️ email 은 PII 다. 그럼에도 반환하는 이유: 닉네임은 중복될 수 있어(users.nickname 에 unique 없음)
--      "김민수" 3명 중 누가 섭외한 그 사람인지 가릴 유일한 식별자가 이메일이다.
--      이 함수는 **admin 게이트 뒤에서만 열린다** — 개설자 신원을 그대로 내보내는
--      admin_list_reports(신고자·작성자 닉네임)·admin_list_promotion_queue(creator_nickname) 와
--      정확히 같은 보호 수준이며, 그 이상으로 넓히지 않는다(authenticated 에게 직접 노출되는 뷰 없음).
-- ═════════════════════════════════════════════
drop function if exists public.admin_search_users(text);

create function public.admin_search_users(p_q text)
returns table (
  id         uuid,
  nickname   text,
  email      text,        -- ⚠️ PII — admin 게이트 뒤에서만 (위 주석 참조)
  host_tier  text,        -- 사용자 단위 티어 (0064) — 이미 명사인지 한눈에
  early_tier text,        -- 창립 표식 (0066) — 개발자·베타테스터 구분용
  created_at timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  return query
  select u.id, u.nickname, u.email, u.host_tier, u.early_tier, u.created_at
  from public.users u
  where (u.nickname ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%')
    -- 탈퇴 계정 제외 — 0053 에서 nickname='탈퇴한 사람' / email=null 로 익명화되고 auth 는 ban 된다.
    -- 지정 대상이 아닐뿐더러, 검색에 뜨면 '탈퇴한 사람'이 우르르 잡혀 사람 특정을 방해한다.
    and u.deleted_at is null
  order by u.created_at desc
  limit 30;
end $$;

alter function public.admin_search_users(text) owner to postgres;
grant execute on function public.admin_search_users(text) to authenticated;

-- ═════════════════════════════════════════════
-- ② admin_set_user_host_tier — 사람 티어 직접 지정 (인원 조건 없음)
--    ⭐ **인원 조건이 없는 것이 이 함수의 존재 이유다.** 1,000명 자격 검증은 admin_review_promotion 의 몫.
--    승격 시 소급/라벨/역할/알림은 0080 의 admin_review_promotion 과 동일하게 맞춘다.
-- ═════════════════════════════════════════════
drop function if exists public.admin_set_user_host_tier(uuid, text);

create function public.admin_set_user_host_tier(p_user_id uuid, p_tier text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev_tier text;
  v_nickname  text;
  v_challenge_id uuid;   -- 알림에 달아줄 하다 (없으면 null — 컬럼은 nullable, 0009:79)
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  if p_tier not in ('individual', 'figure', 'org') then
    raise exception 'invalid host_tier: %', p_tier;
  end if;

  select host_tier, nickname into v_prev_tier, v_nickname
    from public.users where id = p_user_id;
  -- 없는 사용자는 조용히 넘어가지 않는다 — 운영자가 잘못된 id 를 붙였는데 "성공"으로 보이면
  -- 지정이 안 된 줄 모르고 넘어간다(조용한 실패 금지).
  if v_prev_tier is null then raise exception 'user not found'; end if;

  -- 이미 같은 티어면 무동작 — 두 번 눌러도 알림이 두 번 가거나 소급이 다시 돌지 않게.
  -- (0080 의 `if not found then return` 과 같은 역할)
  if v_prev_tier = p_tier then return; end if;

  update public.users
     set host_tier  = p_tier,
         -- 승격일 때만 승격 시각을 새로 찍는다. 강등(individual)에서는 **host_since 를 지우지 않는다** —
         -- "언제 명사였는가"는 지워야 할 오류가 아니라 남겨야 할 기록이다(0064:134 '승격 시각, 영구 기록').
         host_since = case when p_tier in ('figure', 'org') then now() else host_since end
   where id = p_user_id;

  -- ─── 강등(individual)은 여기서 끝 ─────────────────────────────────────
  -- ⚠️ 강등은 users 만 바꾸고 **challenges 는 일절 건드리지 않는다.** (의도된 결정 — 되돌리기 금지)
  --   이유: 이 사람의 하다 중에는 운영자가 admin_set_host_tier 로 손수 'org'(예: '환경부') 지정해 둔 것이
  --   섞여 있을 수 있다. 사람 티어를 내렸다고 그 하다들까지 일괄 individual 로 쓸어버리면
  --   개별 지정 이력이 한 번에 증발한다 = 복구 불가능한 사고. 승격 소급이 `host_tier='individual'` 조건으로
  --   기존 지정을 보호하는 것과 정확히 같은 결이다.
  --   개별 하다를 내려야 하면 admin_set_host_tier('<하다 id>', 'individual', null) 로 하나씩.
  if p_tier = 'individual' then return; end if;

  -- ─── 승격(figure/org): 이미 열어둔 하다에 무대 표식 소급 ──────────────
  -- ⚠️ 조건은 0080 admin_review_promotion 의 소급 update 와 **문자 그대로 동일**해야 한다.
  --   두 승격 경로가 서로 다른 하다를 무대에 올리면 설명할 수 없는 상태가 된다.
  --     kind='open'                → 무대는 open 에만. 비멤버 SELECT 가 open 에만 열려 있어(0003 challenges_open_read)
  --                                  다른 kind 에 찍으면 광장에 영영 안 보이는 무대가 된다 = 조용한 실패 (0079 와 같은 이유)
  --     end_date >= current_date   → 이미 끝난 하다를 지금 와서 무대에 올릴 이유가 없다
  --     gave_up_at is null         → 개설자가 접은 하다 제외
  --     host_tier = 'individual'   → ⚠️ 이미 무대인 하다는 덮어쓰지 않는다.
  --                                  운영자가 손으로 'org' 로 지정해 둔 하다를 'figure' 로 깎으면 안 된다.
  update public.challenges
     set host_tier  = p_tier,
         host_label = v_nickname   -- 📌 닉네임 복사 (0080 상단 트레이드오프 주석 참조 — stale 감수)
   where creator_id = p_user_id
     and kind = 'open'
     and end_date >= current_date
     and gave_up_at is null
     and host_tier = 'individual';

  -- 조직(org)이면 위에서 갱신된 하다의 **개설자 멤버 행**도 role='host' 로 (0069).
  --   org 주최자는 도전자가 아니다 → 완주·인증·분모 집계에서 빠져야 한다.
  --   명사(figure)는 본인이 직접 도전하는 사람이므로 'member' 그대로 둔다(0080:181 과 동일).
  if p_tier = 'org' then
    update public.challenge_members m
       set role = 'host'
     where m.user_id = p_user_id
       and exists (
         select 1 from public.challenges c
          where c.id = m.challenge_id
            and c.creator_id = p_user_id
            and c.kind = 'open'
            and c.host_tier = p_tier            -- 바로 위에서 org 로 갱신된 하다만
            and c.host_label = v_nickname
            and c.end_date >= current_date
            and c.gave_up_at is null
       );
  end if;

  -- ─── 알림 1건 (승격일 때만) ───────────────────────────────────────────
  -- challenge_id 는 소급 대상 중 **가장 최근 진행 중 open 하다**. 하나도 없으면 null 로 둔다
  -- (컬럼 nullable — 아직 하다를 안 연 섭외 명사도 승격 사실은 알아야 한다).
  select c.id into v_challenge_id
    from public.challenges c
   where c.creator_id = p_user_id
     and c.kind = 'open'
     and c.end_date >= current_date
     and c.gave_up_at is null
   order by c.created_at desc
   limit 1;

  -- ⚠️ notification_queue_kind_check 는 **전체 kind 목록을 다시 쓰는 구조**라 건드리지 않는다 —
  --   재정의하면서 빠뜨린 kind 가 있으면 그 알림이 통째로 23514 로 죽는다.
  --   'host_promoted' 는 0064 에서 이미 목록에 있다.
  insert into public.notification_queue (user_id, kind, challenge_id, preview, scheduled_for)
    values (p_user_id, 'host_promoted', v_challenge_id,
      -- 문구 톤은 0067·0080 을 따른다. 다만 여기엔 "1,000명 하다"라는 근거가 없으므로(섭외 경로)
      -- 인원 이야기를 하지 않고 결과만 전한다.
      case when p_tier = 'org'
        then '이제 공식 주최자예요 — 여는 하다에 🏛️ 표식이 붙어요'
        else '이제 유명인이에요 — 아바타에 금빛 테두리가 생겼어요'
      end, now());
end $$;

alter function public.admin_set_user_host_tier(uuid, text) owner to postgres;
grant execute on function public.admin_set_user_host_tier(uuid, text) to authenticated;

-- 검증:
--   1) [사람 검색] admin 계정으로
--        select * from admin_search_users('김');      → nickname ilike 매칭 ≤30, 최신 가입 순
--        select * from admin_search_users('gmail');   → email ilike 로도 잡힘(닉네임 중복 시 특정 수단)
--      탈퇴 계정(users.deleted_at is not null, nickname='탈퇴한 사람')은 **한 건도 안 나온다**:
--        update public.users set deleted_at = now() where id = '<테스트 id>';
--        select * from admin_search_users('탈퇴');    → 0행
--
--   2) [직접 지정 → 소급] 아직 individual 인 사람이 진행 중 open 하다를 여러 개 열어둔 상태에서
--        select admin_set_user_host_tier('<user id>', 'figure');
--      → select host_tier, host_since from public.users where id='<user id>';   → 'figure' + host_since set
--      → select id, title, kind, end_date, gave_up_at, host_tier, host_label
--           from public.challenges where creator_id='<user id>' order by created_at;
--        기대: kind='open' + end_date >= current_date + gave_up_at is null 인 행만 'figure'/'<nickname>'.
--              끝난 하다 / 접은 하다 / closed·cheered·solo → 'individual' 그대로. (0080 4) 와 동일 결과)
--      → select count(*) from public.notification_queue
--           where user_id='<user id>' and kind='host_promoted';                 → 정확히 1건
--        같은 호출 반복 → `이미 같은 tier` 로 return → 여전히 1건(중복 없음), 소급도 재실행 안 됨.
--
--   3) [org 지정] select admin_set_user_host_tier('<user id>', 'org');
--      → 진행 중 open 하다 host_tier='org' + host_label='<nickname>'
--      → select role from public.challenge_members
--           where user_id='<user id>' and challenge_id='<그 하다 id>';           → 'host' (0069, 집계 제외)
--      figure 로 지정한 경우엔 role='member' 그대로여야 한다.
--
--   4) [org 지정된 하다 보호 — 덮어쓰기 금지] 지정 전에 운영자가 그 사람의 어떤 open 하다를 손수 지정:
--        select admin_set_host_tier('<그 하다 id>', 'org', '환경부');
--      이후 select admin_set_user_host_tier('<user id>', 'figure');
--      → 그 하다는 host_tier='org', host_label='환경부' **유지**(host_tier='individual' 조건이 걸러냄).
--        나머지 individual 하다만 'figure' 가 된다.
--
--   5) [강등은 challenges 불변] 위 상태에서
--        select admin_set_user_host_tier('<user id>', 'individual');
--      → users.host_tier='individual' + **host_since 는 그대로 남아 있다**(기록).
--      → select id, host_tier, host_label from public.challenges where creator_id='<user id>';
--        기대: **한 행도 안 바뀐다** — 방금 figure 로 찍힌 하다도, '환경부'로 지정한 하다도 그대로.
--        (개별 하다를 내리려면 admin_set_host_tier('<하다 id>','individual',null))
--      → host_promoted 알림도 추가되지 않는다(승격일 때만 보낸다).
--
--   6) [예외] admin_set_user_host_tier('<없는 uuid>', 'figure')  → 'user not found'
--             admin_set_user_host_tier('<user id>', 'bogus')     → 'invalid host_tier: bogus'
--
--   7) [게이트] 비-admin 계정으로
--        select * from admin_search_users('김');                 → 'admin only' 예외(42501)
--        select admin_set_user_host_tier('<user id>','figure');  → 'admin only' 예외(42501)
--
--   8) [기존 경로 불변] admin_review_promotion(0080) 은 손대지 않았다 —
--        select * from admin_list_promotion_queue();  → 1,000명 큐 그대로 동작.
--        단, 이 파일로 직접 figure 를 준 사람의 하다는 큐 조건(u.host_tier='individual')에서 빠진다(정상).
