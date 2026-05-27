-- 🚀 0004 — 인증 사진별 댓글
-- 적용: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
--
-- 정책:
--   - 멤버만 조회/작성/삭제. open 챌린지면 비멤버도 조회 가능 (RLS).
--   - 본인 댓글만 삭제.
--   - 댓글 AI 검수는 MVP 단계 미적용 (베타 의견 보고 Phase 1.5 결정).

-- ─────────────────────────────────────────────
-- comments
-- ─────────────────────────────────────────────
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  proof_id    uuid not null references public.proofs(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 280),
  created_at  timestamptz not null default now()
);

create index idx_comments_proof_created
  on public.comments(proof_id, created_at asc);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.comments enable row level security;

-- 멤버는 조회
create policy comments_member_read on public.comments
  for select using (
    exists (
      select 1
      from public.proofs p
      join public.challenge_members m on m.challenge_id = p.challenge_id
      where p.id = proof_id and m.user_id = auth.uid()
    )
  );

-- open 챌린지면 비멤버도 조회
create policy comments_open_read on public.comments
  for select using (
    exists (
      select 1
      from public.proofs p
      join public.challenges c on c.id = p.challenge_id
      where p.id = proof_id and c.kind = 'open'
    )
  );

-- 멤버만 작성 (본인 user_id)
create policy comments_self_insert on public.comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.proofs p
      join public.challenge_members m on m.challenge_id = p.challenge_id
      where p.id = proof_id and m.user_id = auth.uid()
    )
  );

-- 본인만 삭제
create policy comments_self_delete on public.comments
  for delete using (user_id = auth.uid());
