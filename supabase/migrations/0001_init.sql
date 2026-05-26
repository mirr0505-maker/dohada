-- 🚀 Do : 하다 — Phase 1 MVP 초기 스키마 (5 테이블)
-- MVP_SCOPE.md 의 DB 섹션 그대로. 통합기획서 13장의 20개 테이블 중 Phase 1에만 필요한 5개.
--
-- 적용 방법:
--   1) Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run
--   2) 또는 supabase CLI:  supabase db push
--
-- 이후 supabase gen types typescript --project-id <id> > mobile/lib/database.types.ts

-- ─────────────────────────────────────────────
-- 1. users  (auth.users 와 1:1, 프로필 정보)
--    Google 로그인 시 supabase.auth.signInWithIdToken 으로 auth.users 생성됨.
--    그 직후 users 행을 만들어 nickname/avatar 저장.
-- ─────────────────────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  google_sub  text unique,                    -- Google sub (provider id)
  email       text,
  nickname    text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. challenges  (폐쇄형 챌린지 — MVP는 한 종류)
-- ─────────────────────────────────────────────
create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.users(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 40),
  description text check (char_length(description) <= 200),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_challenges_creator on public.challenges(creator_id);

-- ─────────────────────────────────────────────
-- 3. challenge_members  (참여 멤버)
-- ─────────────────────────────────────────────
create table public.challenge_members (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index idx_members_challenge on public.challenge_members(challenge_id);
create index idx_members_user on public.challenge_members(user_id);

-- ─────────────────────────────────────────────
-- 4. proofs  (인증 사진 — 하루 1번만 가능)
--    photo_url 은 Cloudflare R2 의 public URL (또는 path).
-- ─────────────────────────────────────────────
create table public.proofs (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  photo_url     text not null,
  caption       text check (char_length(caption) <= 140),
  created_at    timestamptz not null default now()
);
create index idx_proofs_challenge_created on public.proofs(challenge_id, created_at desc);

-- 하루 1회 인증 제약 (UTC 기준 날짜로 단순화)
create unique index uniq_proofs_per_day
  on public.proofs(challenge_id, user_id, ((created_at at time zone 'utc')::date));

-- ─────────────────────────────────────────────
-- 5. cheers  (❤ 응원 — 동일 인증에 1인 1회)
-- ─────────────────────────────────────────────
create table public.cheers (
  id          uuid primary key default gen_random_uuid(),
  proof_id    uuid not null references public.proofs(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (proof_id, user_id)
);
create index idx_cheers_proof on public.cheers(proof_id);

-- ═════════════════════════════════════════════
-- RLS (Row Level Security) — 폐쇄형 챌린지 = 멤버만 접근
-- ═════════════════════════════════════════════
alter table public.users              enable row level security;
alter table public.challenges         enable row level security;
alter table public.challenge_members  enable row level security;
alter table public.proofs             enable row level security;
alter table public.cheers             enable row level security;

-- users: 본인 정보 조회/수정, 같은 챌린지 멤버끼리 서로 보기
create policy users_self_read on public.users
  for select using (id = auth.uid()
                    or exists (
                      select 1
                      from public.challenge_members me
                      join public.challenge_members other
                        on me.challenge_id = other.challenge_id
                      where me.user_id = auth.uid()
                        and other.user_id = public.users.id
                    ));
create policy users_self_write on public.users
  for update using (id = auth.uid());
create policy users_self_insert on public.users
  for insert with check (id = auth.uid());

-- challenges: 멤버만 조회. 누구나 생성 (creator_id = auth.uid()).
create policy challenges_member_read on public.challenges
  for select using (
    exists (
      select 1 from public.challenge_members m
      where m.challenge_id = id and m.user_id = auth.uid()
    )
  );
create policy challenges_creator_insert on public.challenges
  for insert with check (creator_id = auth.uid());

-- challenge_members: 본인 가입/탈퇴, 멤버 목록은 같은 챌린지 멤버에게만 노출
create policy members_self_read on public.challenge_members
  for select using (
    exists (
      select 1 from public.challenge_members m
      where m.challenge_id = challenge_id and m.user_id = auth.uid()
    )
  );
create policy members_self_insert on public.challenge_members
  for insert with check (user_id = auth.uid());
create policy members_self_delete on public.challenge_members
  for delete using (user_id = auth.uid());

-- proofs: 멤버만 조회, 본인만 작성/삭제
create policy proofs_member_read on public.proofs
  for select using (
    exists (
      select 1 from public.challenge_members m
      where m.challenge_id = challenge_id and m.user_id = auth.uid()
    )
  );
create policy proofs_self_insert on public.proofs
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_members m
      where m.challenge_id = challenge_id and m.user_id = auth.uid()
    )
  );
create policy proofs_self_delete on public.proofs
  for delete using (user_id = auth.uid());

-- cheers: 멤버만 조회, 본인만 작성/삭제
create policy cheers_member_read on public.cheers
  for select using (
    exists (
      select 1
      from public.proofs p
      join public.challenge_members m on m.challenge_id = p.challenge_id
      where p.id = proof_id and m.user_id = auth.uid()
    )
  );
create policy cheers_self_insert on public.cheers
  for insert with check (user_id = auth.uid());
create policy cheers_self_delete on public.cheers
  for delete using (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 함수 — 챌린지 만들 때 생성자 자동 가입
-- ═════════════════════════════════════════════
create or replace function public.auto_join_creator()
returns trigger language plpgsql security definer as $$
begin
  insert into public.challenge_members (challenge_id, user_id)
    values (new.id, new.creator_id);
  return new;
end $$;

create trigger trg_auto_join_creator
  after insert on public.challenges
  for each row execute procedure public.auto_join_creator();
