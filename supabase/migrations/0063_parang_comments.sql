-- 🚀 0063 — 공명(파장) 글 인라인 댓글 (익명 토글 · SNS형 하단 댓글)
--
-- 배경: 공명 글엔 "공명해요" 반응(0061 parang_reactions)만 있고 댓글이 없었다.
--   기존 인증/기록 댓글(0004 comments·0007 log_comments)은 멤버 RLS라 비멤버(공명 뷰어)가 못 봄
--   → 공명 전용 댓글 테이블 + SECURITY DEFINER 조회 RPC(parang_posts·reactions와 동일 우회 패턴).
--
-- 정체성: 댓글도 작성 시 익명/실명 토글(게시글 공명 나누기와 동일 관례). **기본 익명 ON**.
--   좋아요·랭킹 없음 유지. 검수/신고/차단은 앱 공통 관례(3a·3b) 그대로.
--
-- ⚠️ parang_posts() 는 comment_count 추가 위해 drop·재생성(반환 타입 변경). 재실행 안전.
-- ⚠️ 마이그레이션 먼저 — 적용 후 db.ts/UI OTA.

-- ─────────────────────────────────────────────
-- 1. 댓글 테이블 (target_type 으로 proof/log 한 테이블 — 0047 hidden 매핑과 동일 톤)
-- ─────────────────────────────────────────────
create table if not exists public.parang_comments (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('proof', 'log')),
  target_id   uuid not null,
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null,
  anon        boolean not null default true,   -- 기본 익명 ON (댓글은 가벼운 반응)
  hidden      boolean not null default false,  -- 신고 3건 누적/검수 숨김 (0047 관례)
  created_at  timestamptz not null default now()
);

create index if not exists idx_parang_comments_target
  on public.parang_comments (target_type, target_id);

alter table public.parang_comments enable row level security;

-- 조회: 본인 것만 직접 select 가능 (전체 목록은 아래 SECURITY DEFINER RPC 로만)
drop policy if exists parang_comments_self_select on public.parang_comments;
create policy parang_comments_self_select on public.parang_comments
  for select using (user_id = auth.uid());

-- 등록: 본인 이름으로만
drop policy if exists parang_comments_self_insert on public.parang_comments;
create policy parang_comments_self_insert on public.parang_comments
  for insert with check (user_id = auth.uid());

-- 삭제: 본인 댓글만
drop policy if exists parang_comments_self_delete on public.parang_comments;
create policy parang_comments_self_delete on public.parang_comments
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 2. 조회 RPC — 한 글의 댓글 목록 (익명이면 작성자 null, 차단·숨김 내부 필터)
--    ⚠️ 익명 댓글은 신원 컬럼을 절대 반환하지 않는다(anon → nickname/avatar null).
--       내 댓글 여부는 user_id 대신 mine 불리언으로만 (익명 신원 역추적 차단).
-- ─────────────────────────────────────────────
create or replace function public.parang_comments(p_target_type text, p_target_id uuid)
returns table (
  id              uuid,
  content         text,
  anon            boolean,
  author_nickname text,        -- 익명이면 null
  author_avatar   text,        -- 익명이면 null
  mine            boolean,     -- 내(auth.uid()) 댓글인지 (삭제 노출용)
  created_at      timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id,
    c.content,
    c.anon,
    case when c.anon then null else u.nickname   end as author_nickname,
    case when c.anon then null else u.avatar_url end as author_avatar,
    (c.user_id = auth.uid())                         as mine,
    c.created_at
  from public.parang_comments c
  join public.users u on u.id = c.user_id
  where c.target_type = p_target_type
    and c.target_id = p_target_id
    and c.hidden = false
    and c.user_id not in (select public.blocked_user_ids())   -- 차단(양방향) 제외
  order by c.created_at asc;
$$;

alter function public.parang_comments(text, uuid) owner to postgres;
grant execute on function public.parang_comments(text, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 3. parang_posts() 재생성 — comment_count 추가 (0062 본체 + 댓글 수)
-- ─────────────────────────────────────────────
drop function if exists public.parang_posts();

create function public.parang_posts()
returns table (
  post_type        text,
  post_id          uuid,
  challenge_id     uuid,
  title            text,
  body             text,
  photo_url        text,
  photo_urls       text[],
  author_nickname  text,
  author_avatar    text,
  reference_count  int,
  courage_count    int,
  comment_count    int,          -- 🚀 0063: 숨김 아닌 댓글 수
  mine_couraged    boolean,
  created_at       timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select * from (
    -- 인증(proof) 크로스포스트
    select
      'proof'::text     as post_type,
      p.id              as post_id,
      p.challenge_id    as challenge_id,
      c.title           as title,
      p.caption         as body,
      p.photo_url       as photo_url,
      case
        when p.photo_urls is not null and array_length(p.photo_urls, 1) > 0 then p.photo_urls
        when p.photo_url is not null then array[p.photo_url]
        else '{}'::text[]
      end               as photo_urls,
      case when p.parang_anon then null else u.nickname   end as author_nickname,
      case when p.parang_anon then null else u.avatar_url end as author_avatar,
      c.reference_count as reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'proof' and r.target_id = p.id) as courage_count,
      (select count(*)::int from public.parang_comments cc
         where cc.target_type = 'proof' and cc.target_id = p.id and cc.hidden = false) as comment_count,
      exists (select 1 from public.parang_reactions r
         where r.target_type = 'proof' and r.target_id = p.id
           and r.user_id = auth.uid()) as mine_couraged,
      p.created_at      as created_at
    from public.proofs p
    join public.challenges c on c.id = p.challenge_id
    join public.users u      on u.id = p.user_id
    where p.share_to_parang = true and p.hidden = false

    union all

    -- 기록(log) 크로스포스트
    select
      'log'::text,
      l.id,
      l.challenge_id,
      c.title,
      l.content,
      l.photo_url,
      case
        when l.photo_urls is not null and array_length(l.photo_urls, 1) > 0 then l.photo_urls
        when l.photo_url is not null then array[l.photo_url]
        else '{}'::text[]
      end,
      case when l.parang_anon then null else u.nickname   end,
      case when l.parang_anon then null else u.avatar_url end,
      c.reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'log' and r.target_id = l.id),
      (select count(*)::int from public.parang_comments cc
         where cc.target_type = 'log' and cc.target_id = l.id and cc.hidden = false),
      exists (select 1 from public.parang_reactions r
         where r.target_type = 'log' and r.target_id = l.id
           and r.user_id = auth.uid()),
      l.created_at
    from public.logs l
    join public.challenges c on c.id = l.challenge_id
    join public.users u      on u.id = l.user_id
    where l.share_to_parang = true and l.hidden = false
  ) posts
  order by created_at desc
  limit 30;
$$;

alter function public.parang_posts() owner to postgres;
grant execute on function public.parang_posts() to authenticated;

-- 검증:
--   1) 익명 댓글 → parang_comments() 가 author_nickname/avatar null, mine 은 본인만 true
--   2) 차단 사용자 댓글 → 목록에서 제외
--   3) 댓글 작성 → parang_posts().comment_count +1
--   4) 본인 댓글 삭제 OK, 남 댓글 삭제 RLS 거부
