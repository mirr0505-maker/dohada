-- 🚀 0061 — 파장 = 사용자 기여 글 + 반응 (피드 v2, DB만)
--
-- 배경: 파장 피드 v1(0060)은 자동 이벤트(참조·완주·기부)만 모았다.
--   v2 는 사용자가 자기 인증/기록을 "파장에 나누기"로 직접 올린 글 + 반응이다.
--   (WORLDWIDE_EXECUTION_PLAN.md "W1-b" v2)
--   이번 스텝은 그걸 담을 DB 만 — 작성 화면·UI·FeedCard 는 v2b.
--
--   설계: 새 저장소를 만들지 않는다. 인증(proofs)·기록(logs)에
--   "파장에 나누기" 플래그 2컬럼만 얹어 커버·본문·사진을 그대로 재사용한다.
--   반응(용기받았어요)만 별도 테이블(parang_reactions).
--
-- 정체성: 반응은 "용기 받았어요" 단일 종류(좋아요 1차원 합산 아님).
--   "나도 할래요"는 별도 저장 없이 v2b 에서 create?ref= 따라하기(0050)로 재활용.
--   비교/랭킹 아님 — reference_count 는 은은한 "움직인 수"일 뿐.
--
-- ⚠️ 마이그레이션 먼저 — 이 파일 적용 후 db.ts/화면 OTA. 재실행 안전.

-- ─────────────────────────────────────────────
-- 1. 크로스포스트 플래그 (기본 false = 안 나눔이 디폴트)
--    parang_anon = 익명 나눔(작성자 신원 숨김 → 클라가 "어떤 이의 걸음")
-- ─────────────────────────────────────────────
alter table public.proofs
  add column if not exists share_to_parang boolean not null default false,
  add column if not exists parang_anon      boolean not null default false;

alter table public.logs
  add column if not exists share_to_parang boolean not null default false,
  add column if not exists parang_anon      boolean not null default false;

-- ─────────────────────────────────────────────
-- 2. 반응 테이블 parang_reactions ("용기 받았어요" — 사용자당 글당 1회, 취소 가능)
--    target_type 으로 proof/log 를 한 테이블에 담는다(0047 hidden 매핑과 동일 톤).
-- ─────────────────────────────────────────────
create table if not exists public.parang_reactions (
  target_type text not null check (target_type in ('proof', 'log')),
  target_id   uuid not null,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);

create index if not exists idx_parang_reactions_target
  on public.parang_reactions (target_type, target_id);

alter table public.parang_reactions enable row level security;

-- 조회: 본인 반응만 (카운트는 parang_posts RPC 가 DEFINER 로 집계 → 여기서 넓히지 않음)
drop policy if exists parang_reactions_self_select on public.parang_reactions;
create policy parang_reactions_self_select on public.parang_reactions
  for select using (user_id = auth.uid());

-- 등록: 본인 이름으로만
drop policy if exists parang_reactions_self_insert on public.parang_reactions;
create policy parang_reactions_self_insert on public.parang_reactions
  for insert with check (user_id = auth.uid());

-- 취소: 본인 반응만 삭제
drop policy if exists parang_reactions_self_delete on public.parang_reactions;
create policy parang_reactions_self_delete on public.parang_reactions
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. parang_posts() RPC — 최근 파장 공개 나눔 글 (created_at desc limit 30)
--    proofs·logs 는 멤버십 RLS 가 교차 사용자 읽기를 막으므로 SECURITY DEFINER 로 우회하되,
--    반환 컬럼을 화이트리스트로 통제한다.
--    ⚠️ 의도된 신원 노출: 비익명 글의 author_nickname·author_avatar 는
--       사용자가 스스로 공개 나눔한 것이라 반환이 정상. 익명 글(parang_anon=true)은 null.
--       그 외 개인식별 컬럼(user_id 등)은 반환하지 않는다.
--    차단 사용자 필터는 v2b 클라(앱 관례 v2.16). RPC 는 hidden 만 제외.
-- ─────────────────────────────────────────────
create or replace function public.parang_posts()
returns table (
  post_type        text,          -- 'proof' | 'log'
  post_id          uuid,
  challenge_id     uuid,          -- CTA용 하다 id
  title            text,          -- 하다 제목
  body             text,          -- caption(proof) / content(log)
  photo_url        text,          -- 커버(첫 장)
  author_nickname  text,          -- 익명이면 null
  author_avatar    text,          -- 익명이면 null
  reference_count  int,           -- 이 하다를 따라 시작한 사람 수(은은한 "움직인 수")
  courage_count    int,           -- 용기받았어요 집계
  mine_couraged    boolean,       -- 내(auth.uid()) 반응 여부
  created_at       timestamptz    -- 정렬 기준
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
      case when p.parang_anon then null else u.nickname   end as author_nickname,
      case when p.parang_anon then null else u.avatar_url end as author_avatar,
      c.reference_count as reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'proof' and r.target_id = p.id) as courage_count,
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
      case when l.parang_anon then null else u.nickname   end,
      case when l.parang_anon then null else u.avatar_url end,
      c.reference_count,
      (select count(*)::int from public.parang_reactions r
         where r.target_type = 'log' and r.target_id = l.id),
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
--   1) 익명 글(parang_anon=true) → author_nickname·author_avatar 항상 null
--   2) parang_reactions insert/delete 는 본인만(RLS), 재 insert → PK 충돌
--   3) select * from parang_posts(); → user_id 등 신원 컬럼 없음, hidden=true 글 제외
--   4) 신규 유저(나눔 글 0) → 빈 결과
