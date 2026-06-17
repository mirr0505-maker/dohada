-- 0049_proof_per_day_kst.sql
-- 🚀 하루 1회 인증 제약을 UTC → KST 기준으로 교정 + count형(0041) 하루 다회 허용
--
-- 배경(버그): 0001 의 uniq_proofs_per_day 가 UTC 날짜 기준이라, 앱의 KST "오늘"과 어긋남.
--   UTC 하루 = KST 09:00~다음날 08:59 한 칸 → 어제 09시 이후 인증 + 오늘 09시 이전 인증이
--   같은 UTC 날짜로 묶여 "duplicate key ... uniq_proofs_per_day" 로 인증이 막혔다(오전 인증 한정).
--   또한 count형은 "하루 다회 인증 OK"(0041) 인데 이 인덱스가 같은 날 2번째를 막았다.
-- 해결: 인덱스 식을 KST 날짜로 바꾸고, count형은 제외(부분 인덱스). 인덱스 식은 타 테이블을
--   참조할 수 없어 proofs 에 goal_type 스냅샷 컬럼을 둔다(트리거로 자동 채움 → 앱 코드 무변경).

alter table public.proofs add column if not exists goal_type text;

-- 기존 행 백필 (challenge 의 goal_type, 없으면 cadence)
update public.proofs p set goal_type = coalesce(c.goal_type, 'cadence')
  from public.challenges c where p.challenge_id = c.id and p.goal_type is null;
update public.proofs set goal_type = 'cadence' where goal_type is null;

-- 신규 insert 시 자동 채움 (클라는 goal_type 을 보내지 않음)
create or replace function public.set_proof_goal_type() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.goal_type is null then
    select coalesce(goal_type, 'cadence') into new.goal_type
      from public.challenges where id = new.challenge_id;
    new.goal_type := coalesce(new.goal_type, 'cadence');
  end if;
  return new;
end $$;
drop trigger if exists trg_set_proof_goal_type on public.proofs;
create trigger trg_set_proof_goal_type before insert on public.proofs
  for each row execute function public.set_proof_goal_type();

-- 안전장치: KST 기준 cadence 중복이 이미 있으면 데이터 삭제 없이 즉시 중단(롤백).
--   (앱 가드가 KST라 사실상 없지만, 인증/박제 데이터는 절대 삭제하지 않는다)
do $$ declare cnt int;
begin
  select count(*) into cnt from (
    select 1 from public.proofs where goal_type is distinct from 'count'
    group by challenge_id, user_id, ((created_at at time zone 'Asia/Seoul')::date)
    having count(*) > 1) d;
  if cnt > 0 then
    raise exception 'KST 기준 중복 인증 % 건 발견 — 수동 정리 후 재적용 (마이그레이션 중단)', cnt;
  end if;
end $$;

-- UTC 인덱스 제거 → KST 날짜 + count형 제외 부분 유니크 인덱스
drop index if exists public.uniq_proofs_per_day;
create unique index uniq_proofs_per_day
  on public.proofs(challenge_id, user_id, ((created_at at time zone 'Asia/Seoul')::date))
  where goal_type is distinct from 'count';
