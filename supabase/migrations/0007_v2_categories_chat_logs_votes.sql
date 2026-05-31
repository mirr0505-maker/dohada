-- 🚀 0007 — MVP v2 재설계 — 카테고리·평가·대화·기록 도메인 도입
--
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
--       (재실행 안전 — drop if exists / create or replace / on conflict do nothing)
--
-- 추가 도메인:
--   1) categories + subcategories  (10 대분류 + 소분류 seed)
--   2) challenges 확장: category_id, subcategory, frequency, proof_type
--   3) cheers 확장: cheer_type ('fire'|'clap'|'muscle'|'heart')
--   4) challenge_votes (둘러보기 4가지 평가 ✨😱🥹💫)
--   5) chat_messages (방 대화 탭)
--   6) logs + log_likes + log_comments (방 기록/Vlog 탭)
--
-- RLS:
--   - categories / subcategories: 모두 SELECT (public)
--   - cheers / votes / chat / logs / log_*: 멤버만, open 챌린지는 비멤버도 SELECT
--   - 본인만 INSERT/DELETE
--   - 0005 의 helper (is_member_of / is_open_challenge / is_member_of_proof / is_open_proof) 재사용

-- ═════════════════════════════════════════════
-- 1. categories (10 대분류)
-- ═════════════════════════════════════════════
create table if not exists public.categories (
  id        int primary key,
  slug      text unique not null,
  emoji     text not null,
  name      text not null,
  copy      text not null,                  -- "건강을 가꾸는 사람들"
  is_impact boolean not null default false,
  sort_order int not null
);

alter table public.categories enable row level security;
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

insert into public.categories (id, slug, emoji, name, copy, is_impact, sort_order) values
  (1, 'health',    '💪', '건강',     '건강을 가꾸는 사람들',          false, 10),
  (2, 'exercise',  '🏃', '운동',     '몸을 단련하는 사람들',          false, 20),
  (3, 'learn',     '📚', '학습',     '배움을 쌓는 사람들',            false, 30),
  (4, 'create',    '🎨', '창작',     '새로움을 만드는 사람들',        false, 40),
  (5, 'self',      '💼', '자기계발', '꾸준함을 쌓는 사람들',          false, 50),
  (6, 'money',     '💰', '재테크',   '미래를 준비하는 사람들',        false, 60),
  (7, 'life',      '🌍', '라이프',   '일상을 가꾸는 사람들',          false, 70),
  (8, 'relation',  '🤝', '관계',     '마음을 나누는 사람들',          false, 80),
  (9, 'impact',    '🌍', '임팩트',   '세상에 변화를 만드는 사람들',   true,  90),
  (10, 'other',    '✨', '기타',     '새로운 길을 여는 사람들',       false, 100)
on conflict (id) do update set
  slug=excluded.slug, emoji=excluded.emoji, name=excluded.name,
  copy=excluded.copy, is_impact=excluded.is_impact, sort_order=excluded.sort_order;

-- ═════════════════════════════════════════════
-- 2. subcategories (소분류 seed)
-- ═════════════════════════════════════════════
create table if not exists public.subcategories (
  id          int primary key,
  category_id int not null references public.categories(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0
);

alter table public.subcategories enable row level security;
drop policy if exists subcategories_read on public.subcategories;
create policy subcategories_read on public.subcategories for select using (true);

create index if not exists idx_subcategories_category on public.subcategories(category_id);

insert into public.subcategories (id, category_id, name, sort_order) values
  -- 건강
  (101, 1, '금연',     10),(102, 1, '금주',     20),(103, 1, '다이어트', 30),
  (104, 1, '영양',     40),(105, 1, '수면',     50),(106, 1, '정신건강', 60),
  (107, 1, '명상',     70),
  -- 운동
  (201, 2, '러닝',     10),(202, 2, '헬스',     20),(203, 2, '등산',     30),
  (204, 2, '자전거',   40),(205, 2, '수영',     50),(206, 2, '요가',     60),
  (207, 2, '필라테스', 70),(208, 2, '구기종목', 80),
  -- 학습
  (301, 3, '독서',     10),(302, 3, '외국어',   20),(303, 3, '자격증',   30),
  (304, 3, '코딩',     40),(305, 3, '온라인강의', 50),(306, 3, '시험준비', 60),
  -- 창작
  (401, 4, '글쓰기',   10),(402, 4, '그림',     20),(403, 4, '사진',     30),
  (404, 4, '음악',     40),(405, 4, '영상',     50),(406, 4, '디자인',   60),
  (407, 4, '공예',     70),
  -- 자기계발
  (501, 5, '루틴',     10),(502, 5, '습관',     20),(503, 5, '시간관리', 30),
  (504, 5, '생산성',   40),(505, 5, '마인드',   50),(506, 5, '리더십',   60),
  -- 재테크
  (601, 6, '저축',     10),(602, 6, '투자',     20),(603, 6, '가계부',   30),
  (604, 6, '부채상환', 40),(605, 6, '창업',     50),
  -- 라이프
  (701, 7, '여행',     10),(702, 7, '맛집',     20),(703, 7, '취미',     30),
  (704, 7, '봉사',     40),(705, 7, '환경',     50),(706, 7, '패션',     60),
  -- 관계
  (801, 8, '가족',     10),(802, 8, '연인',     20),(803, 8, '친구',     30),
  (804, 8, '육아',     40),(805, 8, '반려동물', 50),
  -- 임팩트
  (901, 9, '환경',     10),(902, 9, '기부',     20),(903, 9, '봉사',     30),
  (904, 9, '공익',     40)
on conflict (id) do update set
  category_id=excluded.category_id, name=excluded.name, sort_order=excluded.sort_order;

-- ═════════════════════════════════════════════
-- 3. challenges 확장
--    기존 'kind' 컬럼 그대로 유지. 추가 컬럼만.
--    proof_type 은 현재 'photo' 만 허용 (GPS/스크린샷 Phase 2).
--    frequency 는 daily/weekly3/weekly1 — daily 가 기본.
-- ═════════════════════════════════════════════
alter table public.challenges
  add column if not exists category_id  int references public.categories(id),
  add column if not exists subcategory_id int references public.subcategories(id),
  add column if not exists frequency    text not null default 'daily',
  add column if not exists proof_type   text not null default 'photo';

-- 빈도 체크 (drop 후 재생성 — if not exists 가 없으므로 안전 재시도)
alter table public.challenges drop constraint if exists challenges_frequency_check;
alter table public.challenges
  add constraint challenges_frequency_check
  check (frequency in ('daily','weekly3','weekly1'));

alter table public.challenges drop constraint if exists challenges_proof_type_check;
alter table public.challenges
  add constraint challenges_proof_type_check
  check (proof_type in ('photo'));   -- gps/screenshot Phase 2

-- ═════════════════════════════════════════════
-- 4. cheers 확장 — cheer_type (4가지 응원)
--    기존 unique (proof_id, user_id) → (proof_id, user_id, cheer_type)
-- ═════════════════════════════════════════════
alter table public.cheers
  add column if not exists cheer_type text not null default 'heart';

alter table public.cheers drop constraint if exists cheers_cheer_type_check;
alter table public.cheers
  add constraint cheers_cheer_type_check
  check (cheer_type in ('fire','clap','muscle','heart'));

-- 기존 unique 제약 (proof_id, user_id) 제거 후 cheer_type 포함으로 재생성
alter table public.cheers drop constraint if exists cheers_proof_id_user_id_key;
alter table public.cheers
  add constraint cheers_proof_user_type_key unique (proof_id, user_id, cheer_type);

-- ═════════════════════════════════════════════
-- 5. challenge_votes (둘러보기 4가지 평가)
-- ═════════════════════════════════════════════
create table if not exists public.challenge_votes (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  vote_type    text not null check (vote_type in ('creative','hard','touching','fresh')),
  created_at   timestamptz not null default now(),
  unique (challenge_id, user_id, vote_type)
);
create index if not exists idx_votes_challenge on public.challenge_votes(challenge_id);

alter table public.challenge_votes enable row level security;

-- 멤버는 평가 SELECT (집계용), open 챌린지는 누구나 SELECT, 본인만 INSERT/DELETE
drop policy if exists votes_member_read on public.challenge_votes;
drop policy if exists votes_open_read on public.challenge_votes;
drop policy if exists votes_self_insert on public.challenge_votes;
drop policy if exists votes_self_delete on public.challenge_votes;

create policy votes_member_read on public.challenge_votes
  for select using (public.is_member_of(challenge_id));
create policy votes_open_read on public.challenge_votes
  for select using (public.is_open_challenge(challenge_id));
create policy votes_self_insert on public.challenge_votes
  for insert with check (
    user_id = auth.uid()
    and (public.is_member_of(challenge_id) or public.is_open_challenge(challenge_id))
  );
create policy votes_self_delete on public.challenge_votes
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 6. chat_messages (대화 탭 — 멤버 전용 실시간 채팅)
-- ═════════════════════════════════════════════
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists idx_chat_challenge_created
  on public.chat_messages(challenge_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists chat_member_read on public.chat_messages;
drop policy if exists chat_self_insert on public.chat_messages;
drop policy if exists chat_self_delete on public.chat_messages;

-- 대화는 멤버 전용 (open 챌린지도 채팅은 멤버만 — 비멤버는 인증/응원/댓글만)
create policy chat_member_read on public.chat_messages
  for select using (public.is_member_of(challenge_id));
create policy chat_self_insert on public.chat_messages
  for insert with check (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );
create policy chat_self_delete on public.chat_messages
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 7. logs (기록 탭 — Vlog 형태)
-- ═════════════════════════════════════════════
create table if not exists public.logs (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  content      text not null check (char_length(content) between 1 and 4000),
  photo_url    text,                                -- nullable
  created_at   timestamptz not null default now()
);
create index if not exists idx_logs_challenge_created
  on public.logs(challenge_id, created_at desc);

alter table public.logs enable row level security;

drop policy if exists logs_member_read on public.logs;
drop policy if exists logs_open_read on public.logs;
drop policy if exists logs_self_insert on public.logs;
drop policy if exists logs_self_delete on public.logs;

create policy logs_member_read on public.logs
  for select using (public.is_member_of(challenge_id));
create policy logs_open_read on public.logs
  for select using (public.is_open_challenge(challenge_id));
create policy logs_self_insert on public.logs
  for insert with check (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );
create policy logs_self_delete on public.logs
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 8. log_likes + log_comments (기록 카드 좋아요/댓글)
-- ═════════════════════════════════════════════
create table if not exists public.log_likes (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.logs(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (log_id, user_id)
);
create index if not exists idx_log_likes_log on public.log_likes(log_id);

create table if not exists public.log_comments (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.logs(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists idx_log_comments_log_created
  on public.log_comments(log_id, created_at asc);

alter table public.log_likes    enable row level security;
alter table public.log_comments enable row level security;

-- ─ helpers — log_id 기반 멤버/open 체크 (logs → challenges 경유)
create or replace function public.is_member_of_log(log_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.logs l
    join public.challenge_members m on m.challenge_id = l.challenge_id
    where l.id = log_uuid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_open_log(log_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.logs l
    join public.challenges c on c.id = l.challenge_id
    where l.id = log_uuid and c.kind = 'open'
  );
$$;

drop policy if exists log_likes_member_read on public.log_likes;
drop policy if exists log_likes_open_read on public.log_likes;
drop policy if exists log_likes_self_insert on public.log_likes;
drop policy if exists log_likes_self_delete on public.log_likes;

create policy log_likes_member_read on public.log_likes
  for select using (public.is_member_of_log(log_id));
create policy log_likes_open_read on public.log_likes
  for select using (public.is_open_log(log_id));
create policy log_likes_self_insert on public.log_likes
  for insert with check (
    user_id = auth.uid()
    and (public.is_member_of_log(log_id) or public.is_open_log(log_id))
  );
create policy log_likes_self_delete on public.log_likes
  for delete using (user_id = auth.uid());

drop policy if exists log_comments_member_read on public.log_comments;
drop policy if exists log_comments_open_read on public.log_comments;
drop policy if exists log_comments_self_insert on public.log_comments;
drop policy if exists log_comments_self_delete on public.log_comments;

create policy log_comments_member_read on public.log_comments
  for select using (public.is_member_of_log(log_id));
create policy log_comments_open_read on public.log_comments
  for select using (public.is_open_log(log_id));
create policy log_comments_self_insert on public.log_comments
  for insert with check (
    user_id = auth.uid() and public.is_member_of_log(log_id)
  );
create policy log_comments_self_delete on public.log_comments
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 9. create_challenge RPC 갱신 — v2 컬럼 모두 받음
--    하위 호환: 기존 4 파라미터 시그니처도 유지하려면 새 시그니처로 교체.
--    클라이언트(db.ts) 도 같이 업데이트 필요.
-- ═════════════════════════════════════════════
drop function if exists public.create_challenge(text, text, text, date, date);

create or replace function public.create_challenge(
  p_title          text,
  p_description    text,
  p_kind           text,
  p_start_date     date,
  p_end_date       date,
  p_category_id    int  default null,
  p_subcategory_id int  default null,
  p_frequency      text default 'daily',
  p_proof_type     text default 'photo'
) returns public.challenges
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.challenges (
    creator_id, title, description, kind,
    start_date, end_date,
    category_id, subcategory_id, frequency, proof_type
  )
  values (
    v_uid, p_title, p_description, p_kind,
    p_start_date, p_end_date,
    p_category_id, p_subcategory_id, p_frequency, p_proof_type
  )
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid);

  return v_row;
end $$;

alter function public.create_challenge(text, text, text, date, date, int, int, text, text) owner to postgres;
grant execute on function public.create_challenge(text, text, text, date, date, int, int, text, text) to authenticated;
