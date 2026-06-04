-- 0016: 완주 이야기 (해냈어요 탭) — v2.5 SNS-first 재설계
--
-- 박제 탭의 "완주 이야기 공유" → 이 테이블에 INSERT → 해냈어요 탭에 공개.
-- "자랑 X · 증언 ✓" 톤 — 시스템 통계는 자동 채움 (조작 불가),
-- 사진·소감·"가장 어려웠던 점" 은 사용자 옵션.
--
-- 공개 범위: public (해냈어요 탭에 노출) / allies (같은 챌린지 멤버만).

create table completion_stories (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,

  -- 시스템 통계 (자동 계산 — 사용자 입력 불가, 트리거가 채우고 보호)
  total_days      int not null,                  -- 챌린지 총 기간 (end - start + 1)
  proof_count     int not null,                  -- 본인 인증 횟수
  longest_streak  int not null,                  -- 최장 연속 일수
  completion_rate numeric(5,2) not null
                    check (completion_rate between 0 and 100),

  -- 사용자 옵션 — 6개 항목 모두 선택 (빈 항목은 상세 화면에 노출 X)
  story                 text check (story is null                 or char_length(story) <= 500),                  -- 한 줄 소감
  hardest               text check (hardest is null               or char_length(hardest) <= 1000),               -- 가장 어려웠던 점
  helped_when_giving_up text check (helped_when_giving_up is null or char_length(helped_when_giving_up) <= 1500), -- 포기하고 싶을 때 뭐가 도왔나
  advice_to_starters    text check (advice_to_starters is null    or char_length(advice_to_starters) <= 1000),    -- 시작하는 사람에게 한마디
  own_tip               text check (own_tip is null               or char_length(own_tip) <= 1000),               -- 나만의 방법·꿀팁
  what_changed          text check (what_changed is null          or char_length(what_changed) <= 1500),          -- 이 도전으로 무엇이 달라졌나
  photo_urls            text[] not null default '{}',                                                              -- 대표 사진 (R2 URL)

  -- 공개 범위
  visibility      text not null default 'public'
                    check (visibility in ('public','allies')),

  -- 메타
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 한 챌린지당 본인 1개
  unique (challenge_id, user_id)
);

-- ─── 시스템 통계 자동 채움 (BEFORE INSERT) ────────────
-- 사용자가 보낸 시스템 통계 컬럼은 무시하고 challenges + proofs 집계로 덮어쓴다.
-- 챌린지가 종료된 상태일 때만 작성 허용.

create or replace function fill_completion_story_stats()
returns trigger
language plpgsql
as $$
declare
  ch_start  date;
  ch_end    date;
  pc        int;
  ls        int;
begin
  -- 챌린지 정보
  select start_date, end_date into ch_start, ch_end
    from challenges where id = new.challenge_id;
  if not found then
    raise exception '챌린지를 찾을 수 없어요';
  end if;

  -- 완주 시점 검증 — end_date 가 오늘 이전이어야
  if ch_end > current_date then
    raise exception '아직 완주 전이에요 (end_date=%, today=%)', ch_end, current_date;
  end if;

  -- proof_count = 본인이 이 챌린지에 올린 인증 횟수
  select count(*) into pc
    from proofs
    where challenge_id = new.challenge_id and user_id = new.user_id;

  -- longest_streak = 일별 인증을 그룹화한 후 연속 일자의 최장
  -- (Asia/Seoul 기준 date 로 묶고 gaps-and-islands 패턴)
  with daily as (
    select distinct (created_at at time zone 'Asia/Seoul')::date as d
      from proofs
      where challenge_id = new.challenge_id and user_id = new.user_id
  ),
  grouped as (
    select d, d - (row_number() over (order by d))::int * interval '1 day' as grp
      from daily
  )
  select coalesce(max(c), 0) into ls
    from (select count(*) as c from grouped group by grp) s;

  -- 자동 채움 — 클라이언트 입력값을 덮어씀 (조작 방지)
  new.total_days := (ch_end - ch_start) + 1;
  new.proof_count := pc;
  new.longest_streak := ls;
  new.completion_rate := least(100.0,
    round((pc::numeric / nullif(new.total_days, 0)) * 100, 2));

  return new;
end;
$$;

create trigger trg_fill_completion_story_stats
  before insert on completion_stories
  for each row
  execute function fill_completion_story_stats();

-- ─── 시스템 통계 보호 (BEFORE UPDATE) ─────────────────
-- UPDATE 시 사용자가 시스템 통계 컬럼을 수정해도 OLD 값으로 되돌림.
-- 사진·소감·공개범위만 변경 가능.

create or replace function protect_completion_story_stats()
returns trigger
language plpgsql
as $$
begin
  new.total_days := old.total_days;
  new.proof_count := old.proof_count;
  new.longest_streak := old.longest_streak;
  new.completion_rate := old.completion_rate;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_protect_completion_story_stats
  before update on completion_stories
  for each row
  execute function protect_completion_story_stats();

-- ─── RLS ──────────────────────────────────────────────
alter table completion_stories enable row level security;

-- SELECT:
--   - 본인은 항상
--   - visibility='public' → 누구나
--   - visibility='allies' → 같은 챌린지 멤버만 (현재 같은 챌린지의 멤버 — 도전 인연 정의 베타 v2.5)
create policy completion_stories_select
  on completion_stories for select
  using (
    user_id = auth.uid()
    or visibility = 'public'
    or (
      visibility = 'allies'
      and exists (
        select 1 from challenge_members cm
        where cm.challenge_id = completion_stories.challenge_id
          and cm.user_id = auth.uid()
      )
    )
  );

-- INSERT: 본인만, 본인이 그 챌린지의 멤버이고 (포기 X), 챌린지가 종료된 상태 (트리거가 추가 검증)
create policy completion_stories_insert
  on completion_stories for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from challenge_members cm
      where cm.challenge_id = completion_stories.challenge_id
        and cm.user_id = auth.uid()
        and cm.gave_up_at is null
    )
  );

-- UPDATE: 본인만 (사진·소감·공개범위만 — 시스템 통계는 트리거가 보호)
create policy completion_stories_update
  on completion_stories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: 본인만
create policy completion_stories_delete
  on completion_stories for delete
  using (user_id = auth.uid());

-- ─── 인덱스 ───────────────────────────────────────────
create index idx_completion_stories_public_recent
  on completion_stories (created_at desc)
  where visibility = 'public';

create index idx_completion_stories_challenge
  on completion_stories (challenge_id);

create index idx_completion_stories_user
  on completion_stories (user_id);

-- ─── 적용 안내 ────────────────────────────────────────
-- Supabase SQL Editor 에서 이 파일 통째 실행.
-- 실행 후 확인:
--   select count(*) from completion_stories;  -- 0 이어야 함
--   select policyname from pg_policies where tablename = 'completion_stories';
--     -- completion_stories_select / _insert / _update / _delete 4개
