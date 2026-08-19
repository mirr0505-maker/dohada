-- 🚀 0077 — 사용자별 기준 시간대(하루 경계) — A안 1단계
--
-- 배경(버그): 하루 경계가 앱 전체에 KST 하드코딩이라, 해외 거주·출장 사용자는 인증을 놓친다.
--   런던(BST) 기준 KST 자정 = 현지 오후 4시 → 오후 4시 이후 인증이 "내일"로 저장된다.
--   → 그날은 미인증으로 남고, 다음 날엔 1일 1회 제약에 막힌다 = 이틀이 하루로 뭉개짐.
--     연속(streak)이 끊기고 완주 목표 일수도 깎인다. (해외 거주 베타 사용자 피드백)
--
-- 해결: users.timezone(IANA) 을 두고 "그 사람의 날짜"로 판정한다.
--   ⚠️ 유니크 인덱스 식은 다른 테이블(users)을 참조할 수 없다(immutable 식만 허용 — 0049 교훈).
--      그래서 proofs.local_date 컬럼에 **저장 시점의 작성자 기준 날짜**를 트리거로 박고,
--      유니크 인덱스·연속 트리거를 그 컬럼으로 옮긴다.
--
-- 과거 데이터는 재해석하지 않는다 — 기존 인증의 local_date 는 KST 로 백필(박제 원칙, 수칙 3).
--
-- 이 마이그레이션이 바꾸는 판정: ① 하루 1회 인증 제약 ② 연속 인증 일수 ③ 인증 가능 기간.
--   알림 조용시간·하루 노트(daily_notes.note_date) 는 2단계 — 지금은 KST 그대로여도 앱은 정상 동작한다.
--
-- 재실행 안전 — add column if not exists / create or replace / drop … if exists.

-- ═════════════════════════════════════════════
-- ① users.timezone — 기준 시간대 (내 정보 → 하루 기준선)
-- ═════════════════════════════════════════════
alter table public.users add column if not exists timezone text not null default 'Asia/Seoul';
alter table public.users add column if not exists timezone_updated_at timestamptz;

comment on column public.users.timezone is
  '하루 경계 기준 시간대(IANA). 인증 날짜·연속 일수·인증 가능 기간 판정에 쓰인다. 기본 Asia/Seoul.';

-- 0068 이 users 의 테이블 단위 UPDATE 를 회수하고 컬럼 화이트리스트만 돌려줬다.
-- 새 컬럼은 그 목록에 없으므로 여기서 명시적으로 열어준다 (권한 상승과 무관한 개인 설정).
grant update (timezone) on public.users to authenticated;

-- 유효하지 않은 시간대 문자열이 들어오면 이후 모든 날짜 판정이 예외로 터진다 → 쓰기 시점에 막는다.
-- 겸사겸사 변경 빈도 제한: 하루 1회.
--   (경계를 앞뒤로 밀어 "놓친 하루"를 되살리는 어뷰징 차단 — 여행·귀국에는 하루 1회로 충분)
create or replace function public.validate_user_timezone()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.timezone is distinct from old.timezone then
    -- 실제로 해석되는 시간대인지 확인 (알 수 없으면 postgres 가 예외를 던진다)
    begin
      perform now() at time zone new.timezone;
    exception when others then
      raise exception '알 수 없는 시간대예요: %', new.timezone;
    end;
    if old.timezone_updated_at is not null
       and old.timezone_updated_at > now() - interval '24 hours' then
      raise exception '기준 시간대는 하루에 한 번만 바꿀 수 있어요.';
    end if;
    new.timezone_updated_at := now();
  end if;
  return new;
end $$;
alter function public.validate_user_timezone() owner to postgres;

drop trigger if exists trg_validate_user_timezone on public.users;
create trigger trg_validate_user_timezone
  before update on public.users
  for each row execute function public.validate_user_timezone();

-- 판정 함수들이 공통으로 쓰는 헬퍼. users 는 RLS 가 걸려 있으므로 security definer.
create or replace function public.user_timezone(p_user uuid)
returns text language sql security definer stable set search_path = public
as $$
  select coalesce(nullif(u.timezone, ''), 'Asia/Seoul') from public.users u where u.id = p_user;
$$;
alter function public.user_timezone(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- ② proofs.local_date — 작성자 기준 "인증한 날"
-- ═════════════════════════════════════════════
alter table public.proofs add column if not exists local_date date;

comment on column public.proofs.local_date is
  '인증한 날 (작성자의 기준 시간대 기준). 하루 1회 제약·연속 일수의 근거. 저장 시점에 트리거가 박는다.';

-- 기존 인증 백필 — KST (지금까지의 판정 그대로, 과거를 다시 쓰지 않는다)
update public.proofs
  set local_date = (created_at at time zone 'Asia/Seoul')::date
  where local_date is null;

-- 인증 INSERT 직전 — 작성자의 기준 시간대로 날짜를 계산해 박는다.
--   트리거 이름 순서가 곧 실행 순서다: goal_type(g) → local_date(l) → streak(s).
--   연속 트리거가 local_date 를 읽으므로 이 순서가 지켜져야 한다.
create or replace function public.set_proof_local_date()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_tz text;
begin
  -- 클라는 local_date 를 보낼 수 없다(0071 컬럼 화이트리스트) — 서버가 항상 정한다.
  v_tz := coalesce(public.user_timezone(new.user_id), 'Asia/Seoul');
  begin
    new.local_date := (new.created_at at time zone v_tz)::date;
  exception when others then
    new.local_date := (new.created_at at time zone 'Asia/Seoul')::date;   -- 최후 폴백
  end;
  return new;
end $$;
alter function public.set_proof_local_date() owner to postgres;

drop trigger if exists trg_set_proof_local_date on public.proofs;
create trigger trg_set_proof_local_date
  before insert on public.proofs
  for each row execute function public.set_proof_local_date();

alter table public.proofs alter column local_date set not null;

-- ═════════════════════════════════════════════
-- ③ 연속 인증 일수(0044) — KST 계산식 → local_date
-- ═════════════════════════════════════════════
-- 판정 규칙은 그대로다(같은 날 2번째 인증은 0, 어제부터 거꾸로 연속 카운트). 날짜의 출처만 바뀐다.
create or replace function public.set_proof_streak()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_today date;
  v_day   date;
  v_streak int := 0;
begin
  v_today := new.local_date;   -- 작성자 기준 "오늘" (trg_set_proof_local_date 가 먼저 박아둔 값)

  -- 같은 날 이미 인증이 있으면 그날 마커는 이미 존재 → 0 (메달 중복 방지)
  if exists (
    select 1 from public.proofs p
    where p.challenge_id = new.challenge_id and p.user_id = new.user_id
      and p.local_date = v_today
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
        and p.local_date = v_day
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

-- ═════════════════════════════════════════════
-- ④ 하루 1회 인증 유니크 인덱스(0049) — KST 식 → local_date
-- ═════════════════════════════════════════════
-- 안전장치: local_date 기준 cadence 중복이 있으면 데이터를 건드리지 않고 즉시 중단(롤백).
--   (백필이 KST 라 기존 인덱스와 같은 기준 — 정상이면 0 건)
do $$ declare cnt int;
begin
  select count(*) into cnt from (
    select 1 from public.proofs where goal_type is distinct from 'count'
    group by challenge_id, user_id, local_date having count(*) > 1) d;
  if cnt > 0 then
    raise exception 'local_date 기준 중복 인증 % 건 발견 — 수동 정리 후 재적용 (마이그레이션 중단)', cnt;
  end if;
end $$;

drop index if exists public.uniq_proofs_per_day;
create unique index uniq_proofs_per_day
  on public.proofs(challenge_id, user_id, local_date)
  where goal_type is distinct from 'count';

-- ═════════════════════════════════════════════
-- ⑤ 인증 가능 기간(0028) — KST → 인증하는 사람의 기준 시간대
-- ═════════════════════════════════════════════
-- 이게 없으면 런던 사용자는 마지막 날 저녁(KST 다음날)에 종료 후로 판정돼 인증이 거부된다.
create or replace function public.is_within_challenge_period(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = challenge_uuid
      and (now() at time zone coalesce(public.user_timezone(auth.uid()), 'Asia/Seoul'))::date
          between c.start_date and c.end_date
  );
$$;

-- ═════════════════════════════════════════════
-- ⑥ 하루 리듬 note_date(0056) — KST → 작성자의 기준 시간대
-- ═════════════════════════════════════════════
-- 클라가 "오늘의 다짐/회고"를 조회할 땐 자기 기준 날짜로 찾는다. 서버 기본값이 KST 로 남으면
-- 런던 사용자는 저녁에 쓴 회고를 같은 화면에서 다시 못 찾는다(날짜가 하루 어긋남).
-- note_date 는 여전히 서버가 정한다 — 클라는 못 보낸다(0071 컬럼 화이트리스트).
alter table public.daily_notes
  alter column note_date set default
    (now() at time zone coalesce(public.user_timezone(auth.uid()), 'Asia/Seoul'))::date;

-- ═════════════════════════════════════════════
-- 검증 (운영 DB SQL Editor)
-- ═════════════════════════════════════════════
--   1) 백필 확인 — 0 건이어야 한다:
--      select count(*) from proofs where local_date is null;
--   2) 기존 KST 기준과 일치하는가 (과거 재해석 없음) — 0 건이어야 한다:
--      select count(*) from proofs where local_date <> (created_at at time zone 'Asia/Seoul')::date;
--   3) 시간대 변경 반영 — 런던으로 바꾼 계정이 현지 저녁에 인증 → local_date 가 현지 날짜인가:
--      select local_date, created_at, streak_count from proofs order by created_at desc limit 5;
--   4) 하루 1회 제약이 살아있는가 — 같은 날 두 번째 인증(cadence) → uniq_proofs_per_day 위반
--   5) 하루 1회 변경 제한 — 앱에서 시간대를 두 번 연속 바꾸면 두 번째가 거부되는가
--   6) 인덱스 정의 확인:
--      select indexdef from pg_indexes where indexname = 'uniq_proofs_per_day';
