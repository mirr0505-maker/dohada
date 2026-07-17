-- 🚀 0072 — 조직(org) 하다: 내기 구조적 차단 (ORG_HADA_PLAN.md Step 1-b · TO-BE 5)
--
-- 배경 (WORLDWIDE_EXECUTION_PLAN.md:170):
--   "내기 | 개인이라 기존 내기 파일럿 룰 승계 가능 | 절대 금지(기관의 도박성 유도 = 규제·평판 리스크)
--    → org 는 bet_tier 강제 null"
--   기관이 도박성 유도를 하는 그림 자체가 규제·평판 리스크다. 개인(individual/figure)의 내기와 달리
--   org 는 예외 없이 막는다.
--
-- 방어 2겹:
--   ① (여기) org 지정 시점 — admin_set_host_tier 가 bet_tier/bet_donation_mode 를 강제 null 로.
--   ② 주문 시점 — create-gift-order EF 가 host_tier='org' 이면 거부 (orderPolicy.ts).
--      클라 게이트(isBetVisible)는 EF 직호출을 못 막으므로 서버가 진짜 방어선이다.
--   ※ 개설자가 bet_tier 를 셀프 UPDATE 하는 경로는 0070(challenges 컬럼 GRANT)이 이미 막았다.
--
-- 재실행 안전.

-- ─── ① admin_set_host_tier() — org 지정 시 내기 설정 강제 해제 ─────────
-- 0069 ② 의 확장. host_tier/host_label 세팅 + 멤버 역할(role) 동기화는 0069 본문 그대로 승계하고,
-- org 일 때 bet_tier/bet_donation_mode = null 만 얹는다.
--   p_tier='org'                 → bet_tier·bet_donation_mode = null (내기 구조적 차단)
--                                  + creator 멤버 행 role='host'   (0069 — 도전자 집계에서 제외)
--   p_tier='individual'/'figure' → creator 멤버 행 role='member'    (0069 — 원복)
--
-- ⚠️ individual/figure 로 되돌릴 때 bet_tier 를 복원하지 않는다 — 원본 값을 어디에도 보관하지 않으므로
--    (org 지정 때 지웠고 이력 테이블이 없다) 복원할 근거가 없다. 내기를 다시 걸지는 개설자가 정할 일.
--
-- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 본문 첫 줄 is_admin() 검사 필수 (0059:6-10 최상위 불변식).
create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;

  update public.challenges
     set host_tier = p_tier,
         host_label = p_label,
         -- org 는 내기 금지 → 걸려 있던 설정을 지운다. 개인 티어는 기존 값 유지(위 ⚠️ 참조).
         bet_tier = case when p_tier = 'org' then null else bet_tier end,
         bet_donation_mode = case when p_tier = 'org' then null else bet_donation_mode end
   where id = p_challenge_id
  returning creator_id into v_creator_id;

  -- 없는 챌린지면 v_creator_id 가 null → 아래 update 가 아무 행도 안 잡는다(기존과 동일한 무동작).
  update public.challenge_members
     set role = case when p_tier = 'org' then 'host' else 'member' end
   where challenge_id = p_challenge_id
     and user_id = v_creator_id;
end $$;
alter function public.admin_set_host_tier(uuid, text, text) owner to postgres;
grant execute on function public.admin_set_host_tier(uuid, text, text) to authenticated;

-- ─── ② 기존 org 하다 백필 ──────────────────────────────────────────────
-- 이 마이그레이션 전에 org 로 지정된 하다에는 bet_tier 가 남아 있을 수 있다. 재실행 안전(멱등).
update public.challenges
   set bet_tier = null, bet_donation_mode = null
 where host_tier = 'org'
   and (bet_tier is not null or bet_donation_mode is not null);

-- 검증:
--   1) select id, host_tier, bet_tier, bet_donation_mode from public.challenges where host_tier='org';
--        → bet_tier·bet_donation_mode 전부 null
--   2) admin 계정: select admin_set_host_tier('<내기 걸린 challenge_id>', 'org', '환경부');
--        → host_tier='org' + bet_tier=null + 개설자 challenge_members.role='host'
--   3) 이어서: select admin_set_host_tier('<같은 id>', 'individual', null);
--        → role='member' 로 원복, bet_tier 는 null 유지(복원 안 함 — 의도된 동작)
--   4) 비-admin 계정: select admin_set_host_tier('<id>','org','환경부');   → 'admin only' exception
