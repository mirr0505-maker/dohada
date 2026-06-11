-- 🚀 0029 — 완주 이야기 반응 "용기 받았어요" (Phase 1.5 placeholder → 베타 오픈)
--
-- 정체성: 줄세우기 X — 반응은 "용기 받았어요" 단일 종류 (좋아요 1차원 합산이 아니라
--         완주 증언에 대한 감사 표시 1종). 사용자당 이야기당 1회, 취소 가능.
--
-- 재실행 안전.

create table if not exists public.completion_story_reactions (
  story_id   uuid not null references public.completion_stories(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists idx_csr_story on public.completion_story_reactions (story_id);

alter table public.completion_story_reactions enable row level security;

-- 조회: 로그인 사용자 누구나 (카운트 노출용 — 이야기 자체 열람 권한은 completion_stories RLS 담당)
drop policy if exists csr_select on public.completion_story_reactions;
create policy csr_select on public.completion_story_reactions
  for select using (auth.uid() is not null);

-- 등록: 본인 이름으로만 + 본인 이야기에 셀프 반응 금지
drop policy if exists csr_self_insert on public.completion_story_reactions;
create policy csr_self_insert on public.completion_story_reactions
  for insert with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.completion_stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

-- 취소: 본인 반응만 삭제
drop policy if exists csr_self_delete on public.completion_story_reactions;
create policy csr_self_delete on public.completion_story_reactions
  for delete using (user_id = auth.uid());

-- 검증:
--   1) 타인 이야기에 insert → 성공, 같은 이야기 재 insert → PK 충돌
--   2) 본인 이야기에 insert → RLS 거부
--   3) select count(*) from completion_story_reactions where story_id='<id>';
