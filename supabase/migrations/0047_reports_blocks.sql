-- 🚀 0047 — 신고(reports)·차단(blocks) + 콘텐츠 자동숨김(hidden)
--
-- 애플/구글 UGC 필수 4종: 신고·차단·필터링·연락수단. (연락수단=앱 내 문의 이메일은 클라.)
-- 베타: 차단·숨김 "필터링"은 클라(차단 id 집합·hidden 플래그를 fetch 해 제외). 정식은 RLS 격상.
-- 자동숨김 두 경로: ① 같은 대상 신고 3건 누적 → hidden=true (이 트리거) ② AI 검수 flag → 작성 시 hidden=true (클라).
--
-- 신고 사유 6종: spam(스팸)·abuse(욕설/혐오)·sexual(음란물)·violence(폭력/자해)·impersonation(사칭)·other(기타).
-- 재실행 안전.

-- ─── 신고 ───
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('proof','comment','log_comment','log','story','chat')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam','abuse','sexual','violence','impersonation','other')),
  detail      text,
  status      text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)   -- 같은 사람이 같은 대상 중복 신고 방지
);
create index if not exists idx_reports_target on public.reports (target_type, target_id);

alter table public.reports enable row level security;
drop policy if exists reports_self_insert on public.reports;
create policy reports_self_insert on public.reports
  for insert with check (reporter_id = auth.uid());
drop policy if exists reports_self_select on public.reports;
create policy reports_self_select on public.reports
  for select using (reporter_id = auth.uid());   -- 운영 검토는 service role(콘솔)

-- ─── 차단 ───
-- 내 outgoing(내가 차단한) 행만 보이고 관리. "나를 차단한 사람"은 누구인지 비공개 —
-- 양방향 숨김에 필요한 id 목록만 blocked_user_ids() RPC 로 노출(방향 안 드러냄).
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_self_all on public.blocks;
create policy blocks_self_all on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- 양방향 차단 id (내가 차단 + 나를 차단) — 숨길 user_id 목록만, 방향 비노출
create or replace function public.blocked_user_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;
alter function public.blocked_user_ids() owner to postgres;

-- ─── 콘텐츠 자동숨김 플래그 ───
alter table public.proofs             add column if not exists hidden boolean not null default false;
alter table public.comments           add column if not exists hidden boolean not null default false;
alter table public.log_comments       add column if not exists hidden boolean not null default false;
alter table public.logs               add column if not exists hidden boolean not null default false;
alter table public.completion_stories add column if not exists hidden boolean not null default false;
alter table public.chat_messages      add column if not exists hidden boolean not null default false;

-- 신고 누적 ≥ 3 → 대상 자동숨김 (target_type 별 테이블 분기). security definer 로 시스템이 숨김.
create or replace function public.apply_report_autohide()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.reports
    where target_type = new.target_type and target_id = new.target_id;
  if v_count >= 3 then
    if    new.target_type = 'proof'       then update public.proofs             set hidden = true where id = new.target_id;
    elsif new.target_type = 'comment'     then update public.comments           set hidden = true where id = new.target_id;
    elsif new.target_type = 'log_comment' then update public.log_comments       set hidden = true where id = new.target_id;
    elsif new.target_type = 'log'         then update public.logs               set hidden = true where id = new.target_id;
    elsif new.target_type = 'story'       then update public.completion_stories set hidden = true where id = new.target_id;
    elsif new.target_type = 'chat'        then update public.chat_messages      set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end $$;
alter function public.apply_report_autohide() owner to postgres;
drop trigger if exists trg_report_autohide on public.reports;
create trigger trg_report_autohide
  after insert on public.reports
  for each row execute procedure public.apply_report_autohide();

-- 검증:
--   1) 서로 다른 3명이 같은 인증을 신고 → 그 proofs.hidden = true
--   2) 같은 사람이 같은 대상 재신고 → unique 거부 (23505)
--   3) A 가 B 를 차단 → A 의 blocked_user_ids() 에 B, B 의 blocked_user_ids() 에도 A (방향은 안 드러남)
--   4) 클라: hidden=false 필터 + blocked_user_ids 제외로 노출 제어 (피드·방·댓글·기록·discover)
