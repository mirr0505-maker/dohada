-- 🚀 0060 — 파장 = 기여 피드 (자동 이벤트 통합 RPC)
--
-- 배경: 파장 탭(WORLDWIDE_EXECUTION_PLAN.md "W1-b 파장 = 기여 피드 재설계")이
--   숫자 3층 대시보드만 있어 "매일 열 이유 없는" 상태 → 슬림 헤더 + 피드로 재구성.
--   피드 v1 = 자동 이벤트만(참조·완주·기부). 사용자 글·반응은 v2.
--
--   데이터는 여러 테이블에 흩어져 있고 RLS가 교차 사용자 읽기를 막으므로
--   (challenge_references 는 SELECT 정책 자체가 없음) 한 번에 못 읽는다.
--   → browse_challenges(0050)·parang_stats(0057)과 동일한 SECURITY DEFINER 패턴으로
--     RLS를 우회하되, 반환 컬럼을 화이트리스트로 통제해 신원 누수를 구조적으로 차단한다.
--     신원 컬럼(user_id·creator_id·nickname 등) 일절 미반환 = 익명 톤.
--
-- 정체성: 비교/랭킹/1등 아님. 여기 숫자는 겨루는 점수가 아니라 "조용히 번진 이야기".
--
-- ⚠️ 마이그레이션 먼저 — 이 파일 적용 후 db.ts/화면 OTA. 재실행 안전(create or replace).

-- 반환 (uniform row, created_at desc limit 30 — 신원 컬럼 없음):
--   event_type   : 'reference'(파장 번짐) | 'completion'(완주) | 'donation'(기부 전환)
--   challenge_id : CTA용 하다 id (reference·completion). donation 은 익명이라 null.
--   title        : 하다 제목 (reference·completion). donation 은 null.
--   count        : reference = 그 하다를 따라 시작한 사람 수(reference_count). 그 외 null.
--   amount       : donation = 기부 금액. 그 외 null.
--   created_at   : 이벤트 시각 (정렬 기준)
create or replace function public.parang_feed()
returns table (
  event_type   text,
  challenge_id uuid,
  title        text,
  count        int,
  amount       bigint,
  created_at   timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select * from (
    -- reference(파장 번짐): 따라하기된 source 하다별 최근 참조 시각 + 누적 참조수
    --   challenge_references 는 SELECT 정책이 없어 DEFINER 로만 읽힘 → 신원 안 새고 익명 유지.
    select
      'reference'::text        as event_type,
      c.id                     as challenge_id,
      c.title                  as title,
      c.reference_count        as count,
      null::bigint             as amount,
      max(cr.created_at)       as created_at
    from public.challenge_references cr
    join public.challenges c on c.id = cr.source_challenge_id
    group by c.id, c.title, c.reference_count

    union all

    -- completion(완주): 공개(visibility='public') 완주 이야기만
    select
      'completion'::text       as event_type,
      cs.challenge_id          as challenge_id,
      c.title                  as title,
      null::int                as count,
      null::bigint             as amount,
      cs.created_at            as created_at
    from public.completion_stories cs
    join public.challenges c on c.id = cs.challenge_id
    where cs.visibility = 'public'

    union all

    -- donation(기부 전환): 한잔이 기부로 흐른 건 — 익명(challenge_id·개인 식별 컬럼 미반환)
    select
      'donation'::text         as event_type,
      null::uuid               as challenge_id,
      null::text               as title,
      null::int                as count,
      g.amount::bigint         as amount,
      g.created_at             as created_at
    from public.gift_orders g
    where g.status = 'donated'
  ) feed
  order by created_at desc
  limit 30;
$$;

grant execute on function public.parang_feed() to authenticated;

-- 검증:
--   1) select * from parang_feed();  → event_type/challenge_id/title/count/amount/created_at,
--      user_id·creator_id·nickname 등 신원 컬럼 없음
--   2) 신규 유저(데이터 0) → 빈 결과
--   3) donation 행은 challenge_id·title 이 항상 null (익명)
