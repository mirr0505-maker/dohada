-- 🚀 0066 — 창립 멤버(개발자·베타테스터) 표식: users.early_tier
--
-- 배경 (사용자 방향): 금빛(⭐ figure/🏛️ org)은 "1,000명을 모은 사실"이 자라난 결과다 — 그 의미를 흐리지 않기 위해
--   창립 멤버를 금빛에 끼워넣지 않는다. 창립 멤버는 **완전히 다른 축**의 표식 = 브랜드 오렌지 링.
--   마크(이모지)는 없다 — 링은 금빛/오렌지 2종에서 정지(배지 경제 방지).
--   겹치면 금빛 우선(무대 = 현재형 정보가 더 중요).
--
-- 축 구분:
--   users.host_tier  (0064) = **누가 하다를 여는가** — 무대. 획득하는 것(1,000명 자동 승격).
--   users.early_tier (0066) = **언제 왔는가**       — 창립. 닫힌 집합(정식 출시일에 봉인).
--   서로 독립이다. 창립 멤버가 나중에 유명인이 될 수 있어야 하므로 한 컬럼에 합치지 않는다.
--
-- founder/beta 는 데이터로만 구분 저장하고 UI 링은 동일 — 창립 멤버 사이에 위계를 만들지 않는다.
--   (나중에 구분이 필요해지면 데이터는 이미 있다.)
--
-- 재실행 안전 — add column if not exists / drop if exists 후 create.

-- ═════════════════════════════════════════════
-- 1. 컬럼 — null(기본) = 일반 사용자. 창립 집합에 속할 때만 값이 있다.
-- ═════════════════════════════════════════════
alter table public.users add column if not exists early_tier text
  check (early_tier in ('founder', 'beta'));

-- ═════════════════════════════════════════════
-- 2. 테스트 잔재 정리 + 창립자 도장 (0059 admin seed 패턴 — email 기준)
-- ═════════════════════════════════════════════
-- 수동 테스트로 넣어 둔 figure 를 기획의도(figure 는 1,000명 자동 승격으로만 획득)대로 원복한다.
update public.users set host_tier = 'individual', host_since = null where email = 'mirr0505@gmail.com';

update public.users set early_tier = 'founder' where email = 'mirr0505@gmail.com';

-- ═════════════════════════════════════════════
-- 3. parang_posts() 재생성 — author_early_tier 추가 (0064 본체 + 작성자 창립 티어)
-- ═════════════════════════════════════════════
-- ⚠️ 익명 글은 author_nickname/author_avatar/author_host_tier 와 똑같이 author_early_tier 도 null.
--    창립 집합은 희소해서 그 자체가 신원 힌트가 된다 → 익명 글엔 절대 내리지 않는다.
drop function if exists public.parang_posts();

create function public.parang_posts()
returns table (
  post_type         text,
  post_id           uuid,
  challenge_id      uuid,
  title             text,
  body              text,
  photo_url         text,
  photo_urls        text[],
  author_nickname   text,
  author_avatar     text,
  author_host_tier  text,        -- 🚀 0064: 작성자 사용자 티어 (익명이면 null)
  author_early_tier text,        -- 🚀 0066: 작성자 창립 티어 (익명이면 null)
  reference_count   int,
  courage_count     int,
  comment_count     int,
  mine_couraged     boolean,
  created_at        timestamptz
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
      case when p.parang_anon then null else u.host_tier  end as author_host_tier,
      case when p.parang_anon then null else u.early_tier end as author_early_tier,
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
      case when l.parang_anon then null else u.host_tier  end,
      case when l.parang_anon then null else u.early_tier end,
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
--   1) [창립자] select host_tier, early_tier from users where email='mirr0505@gmail.com';
--      → host_tier='individual' (figure 테스트 잔재 원복), early_tier='founder'.
--      앱: 아바타에 오렌지 링, 닉네임 옆 ⭐ 마크 없음.
--   2) [일반] 아무 다른 계정 → early_tier is null → 링 없음(래퍼 미적용, 이전과 픽셀 동일).
--   3) [익명] parang_anon=true 로 나눈 공명 글 → parang_posts().author_early_tier is null
--      (author_nickname/avatar/host_tier 와 동일). 비익명 글 → 작성자 users.early_tier 값.
--   4) [겹침] 창립자를 임시로 figure 로 두면 → 금빛 링 우선(오렌지 아님). 확인 후 원복.
--   5) [제약] update users set early_tier='foo' → CHECK 위반(23514).

-- ─── 운영 절차 ────────────────────────────────────────
-- ① 정식 출시일 베타 백필 — 이 한 줄만 돌리면 베타 기간에 가입한 사람 전부가 창립 멤버가 된다.
--    (지금 미리 돌리지 않는 이유: 출시일까지 들어올 신규 가입자도 베타 테스터이므로 마지막에 한 번에 봉인)
--      update public.users set early_tier = 'beta'
--        where created_at < '<출시일>' and early_tier is null;
--
-- ② 나중에 칭호가 늘어날 때 — 이 CHECK 제약에 값을 추가하고,
--    클라의 RING_RULES 배열(mobile/components/HostMark.tsx)에 규칙 한 줄만 추가하면 된다.
--    호출부(HostAvatarRing 을 쓰는 화면들)는 건드릴 필요가 없다.
