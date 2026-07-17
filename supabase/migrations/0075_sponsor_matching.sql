-- 🚀 0075 — 완주 매칭 기부 (docs/ORG_HADA_PLAN.md §4 Step 4-a · TO-BE 6)
--
-- 조직이 "완주자 1명당 N원을 ○○에 기부" 를 약정하면, 앱은 **약정과 완주 수를 표시만** 한다.
-- (WORLDWIDE_EXECUTION_PLAN.md:192 — MVP 는 수동 운영: 조직이 완주 수를 보고 오프라인으로 직접 기부)
--
-- 🔒 앱으로 돈이 1원도 흐르지 않는다:
--   · gift_orders(0032) 를 타지 않는다. 참여자↔돈 이전 0 → 결제·도박·전자금융·경품 규제 전부 무관
--     + PG·본인인증이 아직 mock 인 현 상태와도 무충돌.
--   · 송금·기부 실행 기능이 없다. 여기 추가되는 것은 '약정 문구' 두 컬럼과 그 설정 수단뿐이다.
--   · ⚠️ 표시광고법: 약정의 주체는 **조직**이다. 앱의 보증이 아니므로 카피 주어가 주최자여야 한다
--     ("환경부에서 … 기부하기로 했어요" ⭕ / "기부됩니다" ❌).
--
-- 완주 수는 DB 에서 세지 않는다 — 완주 판정의 단일 소스는 mobile/lib/stats.ts(goalStatus)이고,
-- 여기에 판정을 복제하면 진실이 둘이 된다(KST·frequency·늦합류 비례·count 조기완주가 갈라짐).
-- 표시용 집계는 방 화면이 이미 fetch 하는 멤버·인증으로 클라가 한다(stats.ts countCompleters).
--
-- 재실행 안전 — add column if not exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. 약정 컬럼 2개
-- ═════════════════════════════════════════════
-- 네이밍은 기존 관례 승계 — 한 기능의 컬럼은 접두사로 묶는다(bet_tier·bet_donation_mode, host_tier·host_label).
alter table public.challenges
  add column if not exists sponsor_amount_per_completer int,   -- 완주자 1명당 금액(원). null = 약정 없음
  add column if not exists sponsor_beneficiary text;           -- 기부처 표시명 (예: '유니세프'). null 가능

do $$ begin
  alter table public.challenges
    add constraint challenges_sponsor_amount_positive
    check (sponsor_amount_per_completer is null or sponsor_amount_per_completer > 0);
exception when duplicate_object then null;   -- 재실행 시 이미 있으면 무시
end $$;

-- ⚠️ 신규 컬럼에 grant 를 주지 않는다 — 0070 의 의도된 상태를 그대로 승계한다.
--   0070 이 challenges 의 UPDATE 를 테이블 단위로 회수하고 invitation_message 하나만 되돌려줬다
--   (`grant update (invitation_message) on public.challenges to authenticated;` — 0070:46).
--   따라서 이 두 컬럼은 authenticated 에게 닫혀 있고, 아래 운영자 RPC(SECURITY DEFINER)로만 바뀐다.
--   grant 를 주면 아무 개설자나 자기 하다에 '완주자 1명당 100만원 기부' 를 셀프로 붙일 수 있다
--   = host_tier 셀프 부여(0070:10-14)와 같은 부류의 허위 표식이고, 여기선 금액까지 걸린 허위 약정이 된다.

-- ═════════════════════════════════════════════
-- 2. admin_set_sponsor_matching() — 약정 설정/해제 (운영자 전용)
-- ═════════════════════════════════════════════
-- admin_set_host_tier 를 또 확장하지 않고 별도 RPC 로 둔다 — 배지 지정과 후원 약정은 다른 일이고,
-- 그 함수는 이미 0059→0069→0072→0074 로 네 번 확장돼 한 호출이 너무 많은 일을 한다(확장할 때마다 본문 전체를 옮겨야 한다).
--
-- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 본문 첫 줄 is_admin() 검사 필수 (0059:6-10 최상위 불변식).
--
-- ⚠️ 강등(org → individual/figure)은 이 값을 지우지 않는다 — admin_set_host_tier(0074) 본문을 또 복사해 오지 않기 위한 선택.
--    대신 **표시 게이트가 host_tier='org'** 라(StatusTab·초대 미리보기) 강등하면 약정은 노출되지 않는다.
--    값은 행에 남지만 어디에도 안 보이고, 다시 org 로 지정하면 복구된다.
create or replace function public.admin_set_sponsor_matching(
  p_challenge_id uuid,
  p_amount       int,     -- 완주자 1명당 금액(원). null = 약정 해제
  p_beneficiary  text     -- 기부처 표시명. 비어 있으면 null (금액만 약정)
) returns void language plpgsql security definer set search_path = public as $$
declare v_host_tier text;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;   -- 🔒 게이트

  select host_tier into v_host_tier from public.challenges where id = p_challenge_id;
  if v_host_tier is null then raise exception 'challenge not found'; end if;
  -- 매칭 기부 = 조직 후원. 개인·명사 하다에 붙이면 "○○에서 기부하기로 했어요" 라는 카피의 주어가 성립하지 않는다.
  if v_host_tier <> 'org' then raise exception 'only org challenges'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'amount must be positive'; end if;

  update public.challenges
     set sponsor_amount_per_completer = p_amount,
         -- 약정 해제(금액 null)면 기부처도 함께 지운다 — 금액 없는 기부처는 표시할 자리가 없다.
         sponsor_beneficiary = case when p_amount is null then null
                                    else nullif(btrim(p_beneficiary), '') end
   where id = p_challenge_id;
end $$;
alter function public.admin_set_sponsor_matching(uuid, int, text) owner to postgres;
grant execute on function public.admin_set_sponsor_matching(uuid, int, text) to authenticated;

-- ═════════════════════════════════════════════
-- 3. get_invite_info() — 초대 미리보기에 약정 노출
-- ═════════════════════════════════════════════
-- 매칭 기부는 "이 하다에 합류하면 내 완주가 기부로 이어진다" 는 정보라 **합류 결정에 직접 영향**을 준다
-- → 0073 이 host_tier/host_label 을 여기에 얹은 것과 같은 이유(합류를 누르기 직전이 그 정보가 필요한 지점).
--
--   ✅ 0073(최신 정의) 본문을 그대로 승계 + 키 2개만 추가 — 기존 반환 키·이름 전부 보존(클라가 전부 사용 중)
--   ✅ 반환 타입이 jsonb 그대로라 drop function 불필요
--   🔒 creator_id 는 계속 미반환 (0023:51 원칙)
--   · 완주 수는 여기서 안 준다 — 세려면 SQL 에 완주 판정을 복제해야 하고(위 머리말), 합류 결정에 필요한 건
--     '약정이 있다' 는 사실이다. 진행 중인 완주 수는 방(현황 탭)에서 본다.
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
    -- 🚀 0075: 완주 매칭 기부 약정 (조직의 약속 — 앱의 보증이 아니다)
    'sponsor_amount_per_completer', v_row.sponsor_amount_per_completer,
    'sponsor_beneficiary',          v_row.sponsor_beneficiary,
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
--   1) [권한] 비-admin 계정: select admin_set_sponsor_matching('<id>', 1000, '유니세프'); → 'admin only'(42501)
--   2) [org 전용] admin 계정 + host_tier='individual' 인 하다 → 'only org challenges' 예외
--   3) [설정] admin 계정 + org 하다:
--        select admin_set_sponsor_matching('<org id>', 1000, '유니세프');
--        → sponsor_amount_per_completer=1000, sponsor_beneficiary='유니세프'
--   4) [해제] select admin_set_sponsor_matching('<org id>', null, '유니세프');
--        → 두 컬럼 모두 null (금액이 null 이면 기부처도 지운다)
--   5) [금액 검증] select admin_set_sponsor_matching('<org id>', 0, null); → 'amount must be positive'
--      update challenges set sponsor_amount_per_completer = -1 …;          → check 위반(23514)
--   6) [셀프 차단] 앱(authenticated 세션)에서
--        supabase.from('challenges').update({ sponsor_amount_per_completer: 1000000 }).eq('id', <내 하다>)
--      → 42501 permission denied for table challenges (0070 의 컬럼 GRANT — 신규 컬럼은 grant 안 함)
--   7) [초대] select get_invite_info('<org id>');
--      → sponsor_amount_per_completer / sponsor_beneficiary 반환 + 기존 키(host_tier·goal_type·bet_tier·
--        intro_image_url·category…) 전부 그대로. creator_id 는 여전히 미반환.
