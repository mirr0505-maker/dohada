-- 🚀 0006 — 트리거 의존 제거 + create_challenge RPC
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
-- (재실행 안전 — drop if exists / create or replace)
--
-- 원인:
--   auto_join_creator 트리거(SECURITY DEFINER) 가 owner 의 BYPASSRLS 권한에
--   의존하는데 Supabase 환경에서 일관되게 동작하지 않음 →
--   challenges INSERT 가 RLS 위반으로 거부됨 (실제 실패는 트리거 안 challenge_members
--   INSERT 일 가능성 높으나 PostgreSQL 이 메인 테이블명으로 에러 표시).
--
-- 해결:
--   트리거 + 함수 완전 제거.
--   create_challenge RPC 가 challenges + challenge_members 두 INSERT 를
--   하나의 트랜잭션 안에서 원자적으로 수행. SECURITY DEFINER + owner postgres 로
--   RLS 우회 보장.
--
-- 변경:
--   1) trg_auto_join_creator + auto_join_creator 삭제
--   2) create_challenge RPC 신규
--   3) members_self_insert 정책 단순화 — solo 가입 차단은 앱 레벨

-- ═════════════════════════════════════════════
-- 1. 기존 트리거 + 함수 제거
-- ═════════════════════════════════════════════
drop trigger if exists trg_auto_join_creator on public.challenges;
drop function if exists public.auto_join_creator();

-- ═════════════════════════════════════════════
-- 2. members_self_insert 정책 단순화 (이미 0005 후속으로 적용했을 수 있음)
-- ═════════════════════════════════════════════
drop policy if exists members_self_insert on public.challenge_members;
create policy members_self_insert on public.challenge_members
  for insert with check (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 3. create_challenge RPC — 챌린지 + 자동 가입을 원자적으로
-- ═════════════════════════════════════════════
create or replace function public.create_challenge(
  p_title text,
  p_description text,
  p_kind text,
  p_start_date date,
  p_end_date date
) returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 챌린지 INSERT — SECURITY DEFINER + owner postgres = RLS 우회
  insert into public.challenges (creator_id, title, description, kind, start_date, end_date)
  values (v_uid, p_title, p_description, p_kind, p_start_date, p_end_date)
  returning * into v_row;

  -- 생성자 자동 가입
  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

-- 명시적 postgres 소유 → 슈퍼유저 BYPASSRLS 보장
alter function public.create_challenge(text, text, text, date, date) owner to postgres;

-- 인증된 사용자만 호출 가능
grant execute on function public.create_challenge(text, text, text, date, date) to authenticated;
