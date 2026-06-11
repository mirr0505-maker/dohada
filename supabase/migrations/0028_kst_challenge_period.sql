-- 🚀 0028 — is_within_challenge_period KST 정밀화 (0024 의 "추후 정밀화" 이행)
--
-- AS-IS: current_date (서버 UTC) 기준 — KST 00~09시 사이 클라이언트(KST 판정)와 어긋남.
--        예: KST 6/12 02:00 에 6/11 종료 챌린지 → 클라는 차단, DB 는 아직 허용.
-- TO-BE: Asia/Seoul 기준 오늘 날짜로 판정 — 클라·서버 종료 판정 일치.
--
-- 재실행 안전 — create or replace.

create or replace function public.is_within_challenge_period(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = challenge_uuid
      and (now() at time zone 'Asia/Seoul')::date <= end_date
      and (now() at time zone 'Asia/Seoul')::date >= start_date
  );
$$;
alter function public.is_within_challenge_period(uuid) owner to postgres;

-- 검증:
--   select public.is_within_challenge_period('<진행중 챌린지 id>');  → true
--   select public.is_within_challenge_period('<어제 종료 챌린지 id>'); → false (KST 자정 직후에도)
