-- 🚀 0062 — 파장 글에 사진 여러 장 노출 (photo_urls)
--
-- 배경: 0061 parang_posts() 는 커버 1장(photo_url)만 반환했다. 인증(proofs)·기록(logs)엔
--   photo_urls text[](최대 3~4장, 0045)가 있는데 파장 RPC 가 안 내려줘, 파장 카드에선
--   2장 이상 올려도 1장만 보였다. 방·홈 기록처럼 여러 장 스와이프되게 photo_urls 를 추가한다.
--
-- ⚠️ 반환 테이블 컬럼이 바뀌므로 create or replace 불가 → drop 후 재생성.
-- ⚠️ 마이그레이션 먼저 — 적용 후 db.ts/PostCard OTA. 재실행 안전.

drop function if exists public.parang_posts();

create function public.parang_posts()
returns table (
  post_type        text,          -- 'proof' | 'log'
  post_id          uuid,
  challenge_id     uuid,          -- CTA용 하다 id
  title            text,          -- 하다 제목
  body             text,          -- caption(proof) / content(log)
  photo_url        text,          -- 커버(첫 장) — 하위호환 유지
  photo_urls       text[],        -- 🚀 0062: 사진 전체(최대 3~4장). 비면 [photo_url] 폴백
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
--   1) 사진 2장 인증 나눔 → photo_urls 길이 2, 카드에서 스와이프
--   2) 사진 없는 기록 나눔 → photo_urls '{}' → 카드 사진 영역 없음
--   3) 익명 글 → author_nickname/avatar 여전히 null
