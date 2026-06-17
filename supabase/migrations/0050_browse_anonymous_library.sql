-- 🚀 0050 — 하다 구경 (익명 발상 라이브러리) + 따라하기 참조 카운트
--
-- 배경: discover(둘러보기)가 진입점 0개로 묻혀 4가지 평가(✨😱🥹💫)까지 통째로 사장됨.
--   재설계 = 익명 "하다 구경": 개설자·참여자 신원을 지우고 제목/내용/인증방식/타입만 정형화 노출,
--   4평가로 '발상'에 반응, "따라하기"로 내 하다로 복제, 참조 횟수를 조용한 사회적 증거로 표시.
--
-- 결정 (사용자 확정 2026-06-17):
--   ① 범위 = 전체 유형 익명 노출(C) — 익명이라 신원 특정 불가 + 흔한 도전은 군중에 묻힘
--   ② 분류 4종(solo/cheered/closed/open)을 카드에서 뚜렷이 구분 (kind 반환)
--   ③ 참조 = 1인1회 (challenge_references PK 중복방지) → 캐시 컬럼 reference_count 로 표시
--   ④ 안내문 이미지 = 디폴트 노출, 개설자 opt-out 시 숨김 (browse_image_visible)
--   ⑤ 가드 (a) 전체 구경 노출 opt-out (browse_visible, 디폴트 ON) — 미성년 포함 누구나 끌 수 있음
--          (b) 미성년 제외 — 단, 가입 시 생년 미수집이라 "결제 본인인증에서 만 19세 미만으로
--              확정된 개설자"만 제외 가능(실질 거의 0명). 진짜 미성년 보호는 (a) opt-out + 익명화가 담당.
--              가입 시 생년 수집은 별도 결정(백로그) — 이 파일엔 영향 없음.
--
-- ⚠️ 마이그레이션 먼저 — 이 파일 적용 후 db.ts/화면 OTA.
-- 재실행 안전 (if not exists / create or replace / drop+recreate).

-- ═════════════════════════════════════════════
-- 1. 따라하기 참조 기록 (1인1회) + 표시용 캐시 컬럼
-- ═════════════════════════════════════════════
create table if not exists public.challenge_references (
  source_challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id             uuid not null references public.users(id)      on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (source_challenge_id, user_id)        -- 1인1회 보장
);
alter table public.challenge_references enable row level security;

-- 본인 행만 INSERT. 직접 SELECT 정책은 두지 않음(누가 몇 번 베꼈나 추적·게임화 방지)
-- → 노출은 아래 reference_count 캐시 컬럼으로만.
drop policy if exists ref_insert_self on public.challenge_references;
create policy ref_insert_self on public.challenge_references
  for insert with check (auth.uid() = user_id);

alter table public.challenges
  add column if not exists reference_count int not null default 0;   -- 표시용 캐시 (정렬엔 안 씀)

-- 참조 1건 생길 때 캐시 +1
create or replace function public.bump_reference_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.challenges
     set reference_count = reference_count + 1
   where id = new.source_challenge_id;
  return new;
end $$;

drop trigger if exists trg_bump_reference on public.challenge_references;
create trigger trg_bump_reference
  after insert on public.challenge_references
  for each row execute function public.bump_reference_count();

-- 따라하기 호출 (멱등 — 1인1회, 중복 호출은 무해하게 무시)
-- 호출 시점 = 따라한 새 하다가 '실제로 생성 완료'된 직후 (탭만 하고 안 만들면 카운트 X = 정직)
create or replace function public.reference_challenge(p_challenge_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.challenge_references (source_challenge_id, user_id)
  values (p_challenge_id, auth.uid())
  on conflict do nothing;
$$;
grant execute on function public.reference_challenge(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- 2. 구경 노출 opt-out (둘 다 디폴트 ON — 개설자가 끄면 숨김)
--    수정 권한은 0022 challenges_creator_update(개설자 한정)가 이미 보장.
-- ═════════════════════════════════════════════
alter table public.challenges
  add column if not exists browse_visible       boolean not null default true,  -- 전체 노출
  add column if not exists browse_image_visible boolean not null default true;  -- 안내문 이미지만

-- ═════════════════════════════════════════════
-- 3. 익명 구경 목록 RPC — 신원 컬럼 일절 미반환 (creator_id·user_id 없음)
--    RLS를 우회(security definer)하되 반환 컬럼을 화이트리스트로 통제해 신원 누수를 구조적으로 차단.
--    4평가 집계·내 평가까지 한 함수 안에서 — challenge_votes RLS를 넓히지 않음.
-- ═════════════════════════════════════════════
create or replace function public.browse_challenges(p_limit int default 60)
returns table (
  id uuid, kind text, title text, description text, intro_image_url text,
  goal_type text, target_count int, frequency text,
  start_date date, end_date date,
  category_id int, category_name text, category_emoji text, category_is_impact boolean,
  reference_count int, created_at timestamptz,
  votes jsonb, my_votes text[]
)
language sql security definer stable set search_path = public as $$
  select
    c.id, c.kind, c.title, c.description,
    case when c.browse_image_visible then c.intro_image_url else null end,
    c.goal_type, c.target_count, c.frequency,
    c.start_date, c.end_date,
    c.category_id, cat.name, cat.emoji, cat.is_impact,
    c.reference_count, c.created_at,
    coalesce((
      select jsonb_object_agg(t.vote_type, t.cnt)
        from (select vote_type, count(*) as cnt
                from public.challenge_votes
               where challenge_id = c.id
               group by vote_type) t
    ), '{}'::jsonb),
    coalesce((
      select array_agg(vote_type)
        from public.challenge_votes
       where challenge_id = c.id and user_id = auth.uid()
    ), '{}'::text[])
  from public.challenges c
  left join public.categories cat on cat.id = c.category_id
  where c.browse_visible = true
    and c.gave_up_at is null                        -- 종료/포기된 방은 구경 제외 (기본값 — 필요 시 완화)
    -- 미성년 가드(부분): 결제 본인인증에서 만 19세 미만으로 '확정된' 개설자만 제외.
    -- 미인증 유저는 연령 미상이라 못 거름 → 실질 미성년 보호는 browse_visible opt-out + 익명화가 담당.
    and not exists (
      select 1 from public.user_verifications uv
       where uv.user_id = c.creator_id
         and uv.birth_date > ((now() at time zone 'Asia/Seoul')::date - interval '19 years')::date
    )
  order by c.created_at desc                         -- 최신순 (참조수·평가수 desc 정렬 금지 — 줄세우기 방지)
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.browse_challenges(int) to authenticated;
