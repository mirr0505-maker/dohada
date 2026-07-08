-- 🚀 0054 — 파장(선한 영향력) 탭 3층 집계 RPC
--
-- 배경: 파장 탭(WORLDWIDE_EXECUTION_PLAN.md W1)은 "나 → 우리 → 세상"으로 번지는
--   선한 영향력을 온기로 보여준다. 데이터는 이미 여러 테이블에 존재하지만,
--   RLS가 교차 사용자 읽기를 막으므로(내가 건넨 응원 총량·전체 기부 등) 한 번에 집계할 수 없다.
--   → browse_challenges(0050)·is_browse_visible(0052)와 동일한 SECURITY DEFINER 패턴으로
--     RLS를 우회하되, **집계 스칼라만** 반환한다. 신원 컬럼(user_id·creator_id·nickname 등) 일절 미반환.
--
-- 정체성: 비교/랭킹/1등 아님. 여기 숫자는 겨루는 점수가 아니라 "번진 이야기"의 강조점.
--
-- ⚠️ 마이그레이션 먼저 — 이 파일 적용 후 db.ts/화면 OTA. 재실행 안전(create or replace).

-- 반환 json 구조 (전부 집계 스칼라 — 신원 없음):
--   mine  : 호출자(auth.uid()) 기준 개인 파장
--     reference_total  = 내가 만든 하다들의 참조수 합 (= 내 하다를 따라 시작한 사람 수, 0050)
--     cheers_given     = 내가 건넨 응원 수 (cheers, user_id = 나)
--     courage_received = 내 완주 이야기가 받은 "용기 받았어요" 수 (completion_story_reactions)
--   ours  : 이번 주(롤링 최근 7일) 하다 동료들이 함께 만든 온기
--     week_cheers      = 최근 7일 전체 응원 수
--     week_new_starts  = 최근 7일 새 따라하기 수 (= 누군가의 시작이 된 하다, challenge_references)
--   world : 세상으로 흐른 결과 (전체 집계)
--     donated_count    = 기부로 전환된 한잔 수 (gift_orders status='donated')
--     donated_amount   = 그 기부 금액 합 (gift_orders.amount)
--
-- KST 주석: '이번 주'는 롤링 최근 7일(now() - 7일)이라 인스턴트 비교 → 타임존 무관하게 일관.
--   (0049의 KST 날짜 경계 이슈는 '자정 기준 하루 구분'에만 해당 — 롤링 창엔 불필요)
create or replace function public.parang_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'mine', json_build_object(
      'reference_total', coalesce((
        select sum(c.reference_count)::int
        from public.challenges c
        where c.creator_id = auth.uid()
      ), 0),
      'cheers_given', coalesce((
        select count(*)::int
        from public.cheers ch
        where ch.user_id = auth.uid()
      ), 0),
      'courage_received', coalesce((
        select count(*)::int
        from public.completion_story_reactions r
        join public.completion_stories s on s.id = r.story_id
        where s.user_id = auth.uid()
      ), 0)
    ),
    'ours', json_build_object(
      'week_cheers', coalesce((
        select count(*)::int
        from public.cheers ch
        where ch.created_at >= now() - interval '7 days'
      ), 0),
      'week_new_starts', coalesce((
        select count(*)::int
        from public.challenge_references cr
        where cr.created_at >= now() - interval '7 days'
      ), 0)
    ),
    'world', json_build_object(
      'donated_count', coalesce((
        select count(*)::int
        from public.gift_orders g
        where g.status = 'donated'
      ), 0),
      'donated_amount', coalesce((
        select sum(g.amount)::bigint
        from public.gift_orders g
        where g.status = 'donated'
      ), 0)
    )
  );
$$;

grant execute on function public.parang_stats() to authenticated;

-- 검증:
--   1) select parang_stats();  → mine/ours/world 3키 json, 신원 컬럼 없음
--   2) 응원 없는 신규 유저 → 전부 0
--   3) gift_orders에 donated 없으면 world.donated_amount = 0 (null 아님)
