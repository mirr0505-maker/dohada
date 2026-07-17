-- 🚀 0069 — 조직(org) 하다: 주최자를 도전자 집계에서 제외 (challenge_members.role)
--
-- 배경 (docs/ORG_HADA_PLAN.md §2.3 · WORLDWIDE_EXECUTION_PLAN.md:177):
--   create_challenge 는 개설자를 무조건 challenge_members 에 넣는다(0041:92-93, 0001:172).
--   그래서 조직 계정(host_tier='org')이 매일 인증을 안 하면 '완주 실패' 로 집계되고
--   현황 탭 분모·인포바 📸 N/N·박제·내하다 배지가 전부 오염된다 = 개설자=도전자 가정이 깨짐.
--
-- 해법: 멤버 행에 역할(role)을 둔다.
--   - role='host'  → 주최자. 도전자가 아니므로 완주·멤버·인증 집계에서 제외한다.
--   - 행 자체는 남긴다 — 대화·공지·초대에 is_member_of RLS 가 필요하기 때문.
--     (gave_up_at 재활용은 '포기' 시맨틱이 붙어 부적절 → 별도 컬럼)
--   - 선례: cheered 방의 응원자(isCheerer, v2.17) — 한 방 안에서 역할이 갈리는 구조는 이미 있다.
--
-- create_challenge 는 건드리지 않는다 — org 는 개설 후 운영자가 지정하는 구조(셀프서비스 없음, 0058:7).
-- 기존 RLS·트리거도 그대로 (role 은 집계용 표식일 뿐 권한 축이 아니다).
-- 재실행 안전.

-- ─── ① challenge_members.role ─────────────────────────────────────────
-- 기본값 'member' → 기존 모든 멤버 행은 도전자로 남는다(무변경).
alter table public.challenge_members
  add column if not exists role text not null default 'member';

do $$ begin
  alter table public.challenge_members
    add constraint challenge_members_role_check check (role in ('member', 'host'));
exception when duplicate_object then null;   -- 재실행 시 이미 있으면 무시
end $$;

-- ─── ①-b role 셀프 지정 차단 (0068 과 같은 부류) ──────────────────────
-- members_self_update(0012)는 `with check (user_id = auth.uid())` 로 "내 행"만 강제할 뿐
-- "어느 컬럼을 쓰냐"는 못 막는다(RLS 는 행을 고르는 장치라서 — 컬럼 제한은 GRANT 의 일).
-- 그대로 두면 아무나 자기 멤버십 행에 role='host' 를 심어
--   ① 인원 분모에서 사라지고 ② 완주 실패 판정을 회피하고 ③ 현황 탭에 '🏛️ 주최' 사칭 태그를 단다.
-- = 집계 무결성이 존재 이유인 컬럼이 셀프 지정 가능하면 의미가 없다.
--
-- 클라가 challenge_members 에 실제로 쓰는 경로는 이게 전부다 (전수 grep 확인):
--   INSERT: invite.ts joinChallenge — (challenge_id, user_id) 뿐. joined_at·role 은 기본값.
--   UPDATE: db.ts 잠시멈춤(paused_until) · 멈춤해제(paused_until=null) · 포기(gave_up_at) — 이 3개뿐.
-- role 은 양쪽 화이트리스트에 없다 → 운영자 RPC(admin_set_host_tier)로만 바뀐다.
-- create_challenge 의 개설자 자동 가입은 SECURITY DEFINER(owner postgres)라 영향 없다(0043:51 주석).
-- service_role 은 건드리지 않는다. DELETE 는 행 단위라 그대로(members_self_delete).
revoke update, insert on public.challenge_members from authenticated;
revoke update, insert on public.challenge_members from anon;
grant update (paused_until, gave_up_at) on public.challenge_members to authenticated;
grant insert (challenge_id, user_id) on public.challenge_members to authenticated;

-- ─── ② admin_set_host_tier() — org 지정 시 creator 를 role='host' 로 ──
-- 0059 ⑦ 의 확장. host_tier/host_label 세팅은 동일하고, 멤버 역할 동기화만 추가.
--   p_tier='org'                → creator 멤버 행 role='host'  (도전자 집계에서 제외)
--   p_tier='individual'/'figure' → creator 멤버 행 role='member' (원복 — org 해제 시 되돌아가야 함)
-- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 본문 첫 줄 is_admin() 검사 필수 (0059:6-10 최상위 불변식).
create or replace function public.admin_set_host_tier(p_challenge_id uuid, p_tier text, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_creator_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;   -- 🔒 게이트
  if p_tier not in ('individual', 'figure', 'org') then raise exception 'invalid host_tier: %', p_tier; end if;

  update public.challenges
     set host_tier = p_tier, host_label = p_label
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

-- 검증:
--   1) select role from public.challenge_members limit 5;                      → 전부 'member' (기본값)
--   2) 비-admin 계정: select admin_set_host_tier('<id>','org','환경부');        → 'admin only' exception
--   3) admin 계정:
--      select admin_set_host_tier('<challenge_id>', 'org', '환경부');
--        → challenges.host_tier='org' + 개설자 challenge_members.role='host'
--      select admin_set_host_tier('<challenge_id>', 'individual', null);
--        → 개설자 role='member' 로 원복
--   4) update challenge_members set role='bogus' …;                            → check 제약 위반(23514)
