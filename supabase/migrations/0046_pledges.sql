-- 🚀 0046 — 다짐(무현금 사회적 스테이크)
--
-- 정체성: "내기 한잔"(mock 결제, isGiftPilot 게이트)과 분리된 **무현금** 약속.
--   도전에 거는 가벼운 사회적 다짐 — "지면 ___" / "이기면 ___" (기부·청소·선플·커피 등).
--   돈이 앱을 거치지 않음(명예제도) → 결제·도박 규제 무관. 검수는 moderate-text(pledge 모드)가
--   "금액 표기 일절 금지 + 고가/신체·성적/강요 차단"으로 생성 시 동기 차단 (클라이언트 게이트).
--
-- 멤버당 방향별 1개 — 한 사람이 "지면" 다짐 1개 + "이기면" 다짐 1개까지.
-- fulfilled = 본인이 "지켰어요" 자가 체크 (명예제도, 별도 검증 없음).
--
-- RLS: SELECT = is_viewer_of(포기자 포함 열람, 다른 SELECT 정책과 동일 기준) /
--      쓰기 = is_member_of(활성 멤버) + 본인(user_id = auth.uid()).
--
-- 재실행 안전 — create table if not exists / drop policy if exists.

create table if not exists public.pledges (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  direction    text not null check (direction in ('lose', 'win')),  -- 지면(lose) / 이기면(win)
  content      text not null check (char_length(content) between 1 and 200),
  fulfilled    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (challenge_id, user_id, direction)
);

create index if not exists idx_pledges_challenge on public.pledges (challenge_id);

alter table public.pledges enable row level security;

-- 조회: 같은 방 열람자(포기 여부 무관 — proofs/logs SELECT 와 동일 기준)
drop policy if exists pledges_select on public.pledges;
create policy pledges_select on public.pledges
  for select using (public.is_viewer_of(challenge_id));

-- 등록: 활성 멤버가 본인 이름으로만
drop policy if exists pledges_self_insert on public.pledges;
create policy pledges_self_insert on public.pledges
  for insert with check (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );

-- 수정: 본인 다짐만 (주로 fulfilled "지켰어요" 토글)
drop policy if exists pledges_self_update on public.pledges;
create policy pledges_self_update on public.pledges
  for update using (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  ) with check (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );

-- 삭제: 본인 다짐만 (마음 바뀌면 거두기)
drop policy if exists pledges_self_delete on public.pledges;
create policy pledges_self_delete on public.pledges
  for delete using (
    user_id = auth.uid() and public.is_member_of(challenge_id)
  );

-- 검증:
--   1) 같은 방 멤버가 "지면" 다짐 insert → 성공, 같은 방향 재 insert → unique 충돌
--   2) 같은 멤버 "지면" + "이기면" 각각 1개 → 둘 다 성공
--   3) 비멤버가 insert → RLS 거부
--   4) 다른 사람 다짐 update/delete → RLS 거부
--   5) 금액 든 다짐("지면 5만원")은 DB 가 아니라 moderate-text(pledge)가 생성 전 차단
