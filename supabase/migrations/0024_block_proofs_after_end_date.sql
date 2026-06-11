-- 🚀 0024 — 종료된 챌린지의 새 인증 차단 (완주 후 통계 왜곡 방지)
--
-- AS-IS: proofs INSERT 정책이 멤버십·can_create_in_challenge 만 검사 → 챌린지 end_date 가 지나도 새 인증 가능
-- TO-BE: end_date 까지만 인증 허용. 종료 후엔 새 인증 INSERT 거부.
--        (기록·채팅·응원·평가 등은 회고 자료로 가치 있어 그대로 허용)
--
-- 재실행 안전 — drop if exists / create or replace.

-- ═════════════════════════════════════════════
-- 1. is_within_challenge_period(challenge_uuid) 헬퍼
--    오늘 (KST 기준) 이 챌린지의 start_date ~ end_date 사이인지.
--    프로필 단순화: server time 의 date 비교 (UTC). 베타 단계 충분.
--    추후 정밀화: AT TIME ZONE 'Asia/Seoul' 비교로 개선 가능.
-- ═════════════════════════════════════════════
create or replace function public.is_within_challenge_period(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = challenge_uuid
      and current_date <= end_date
      and current_date >= start_date
  );
$$;
alter function public.is_within_challenge_period(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 2. proofs_self_insert 정책 강화
--    AS-IS: user_id = auth.uid() AND can_create_in_challenge(...)
--    TO-BE: + is_within_challenge_period(challenge_id)
-- ═════════════════════════════════════════════
drop policy if exists proofs_self_insert on public.proofs;
create policy proofs_self_insert on public.proofs
  for insert with check (
    user_id = auth.uid()
    and public.can_create_in_challenge(challenge_id)
    and public.is_within_challenge_period(challenge_id)
  );

-- ═════════════════════════════════════════════
-- 검증:
--   - 종료된 챌린지 ID 로 직접 insert 시도 → RLS 거부
--   - 진행 중 챌린지 ID 로 인증 → 정상 통과
--   select policyname, with_check from pg_policies
--   where schemaname='public' and tablename='proofs' and cmd='INSERT';
-- ═════════════════════════════════════════════
