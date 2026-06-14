-- 🚀 0044 — 인증 연속 일수(streak) 저장 + 마일스톤 메달
--
-- 배경: 인증 연속 성공을 축하하는 표식. 사람(아바타/닉네임) 아닌 "인증 게시글"에 부착 →
--   비교·줄세우기가 아니라 자기 여정의 자축 (조용한 SNS 정체성). 유튜브 골드 버튼처럼 콘텐츠에 박힘.
--   마일스톤: 3·7·21·49·99·180·365·730일 (클라가 streak_count 가 이 값일 때만 메달 노출).
--
-- streak_count = 같은 챌린지에서 KST 연속 일자에 인증한 날 수 (이 인증의 날 기준).
--   같은 날 2번째+ 인증은 0 — 그날 마커는 첫 인증이 가짐 (메달 중복 방지). 박제처럼 인증 시점에 고정.
--
-- 재실행 안전 — add column if not exists / create or replace / drop trigger if exists.

alter table public.proofs add column if not exists streak_count integer not null default 0;

-- 인증 INSERT 직전(BEFORE) — 같은 (challenge, user) 의 KST 연속 일자 수를 계산해 NEW.streak_count 에 박음
create or replace function public.set_proof_streak()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_today date;
  v_day   date;
  v_streak int := 0;
begin
  v_today := ((new.created_at at time zone 'UTC') + interval '9 hours')::date;   -- KST 날짜

  -- 같은 날 이미 인증이 있으면 그날 마커는 이미 존재 → 0 (메달 중복 방지)
  if exists (
    select 1 from public.proofs p
    where p.challenge_id = new.challenge_id and p.user_id = new.user_id
      and (((p.created_at at time zone 'UTC') + interval '9 hours')::date) = v_today
  ) then
    new.streak_count := 0;
    return new;
  end if;

  -- 어제부터 거꾸로 연속 일자 카운트 (새 인증=오늘은 마지막에 +1)
  v_day := v_today - 1;
  loop
    if exists (
      select 1 from public.proofs p
      where p.challenge_id = new.challenge_id and p.user_id = new.user_id
        and (((p.created_at at time zone 'UTC') + interval '9 hours')::date) = v_day
    ) then
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  new.streak_count := v_streak + 1;
  return new;
end $$;
alter function public.set_proof_streak() owner to postgres;

drop trigger if exists trg_set_proof_streak on public.proofs;
create trigger trg_set_proof_streak
  before insert on public.proofs
  for each row execute procedure public.set_proof_streak();

-- ─── 기존 인증 백필 (gaps-and-islands) ───
-- 각 KST 날의 "첫 인증"만 그날의 연속일수를 가짐 (같은 날 2번째+ 인증은 default 0 유지).
with day_first as (
  select distinct on (challenge_id, user_id, (((created_at at time zone 'UTC') + interval '9 hours')::date))
    id, challenge_id, user_id,
    (((created_at at time zone 'UTC') + interval '9 hours')::date) as kst_day
  from public.proofs
  order by challenge_id, user_id,
           (((created_at at time zone 'UTC') + interval '9 hours')::date),
           created_at
),
islands as (
  -- 연속 날짜는 (kst_day - 행번호) 가 일정 → 그룹키(grp)로 묶임
  select id, challenge_id, user_id, kst_day,
    kst_day - (row_number() over (partition by challenge_id, user_id order by kst_day))::int as grp
  from day_first
),
counted as (
  select id,
    row_number() over (partition by challenge_id, user_id, grp order by kst_day) as streak
  from islands
)
update public.proofs p
  set streak_count = c.streak
  from counted c
  where c.id = p.id;

-- 검증:
--   1) 빈 챌린지에서 3일 연속 인증 → 3일째 인증 streak_count=3 (1,2일째는 1,2)
--   2) 하루 2번 인증 → 첫 인증만 그날 streak, 2번째는 0
--   3) 하루 건너뛰고 인증 → streak_count=1 로 리셋
--   4) select user_id, streak_count, created_at from proofs where challenge_id='...' order by created_at;  로 백필 확인
