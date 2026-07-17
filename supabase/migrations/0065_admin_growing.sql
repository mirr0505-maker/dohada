-- 🚀 0065 — 운영 콘솔: 성장 중인 누구나 하다 후보 목록
--
-- 배경: 0064 로 "모집 캡 면제 → 누적 1,000명 → 개설자 유명인 자동 승격" 경로가 생겼지만,
--   운영 콘솔은 제목 검색(admin_search_challenges)뿐이라 **무엇을 검색해야 하는지 운영자가 알 수 없다**.
--   → 검색 없이도 "지금 자라고 있는 누구나 하다"를 누적 참여 많은 순으로 보여준다.
--
-- ⚠️ "1,000명 넘은 하다"만 거르면 안 된다 — 캡 면제 전에는 기간 50% 자동 마감 때문에 1,000명 도달이
--   구조적으로 불가능해 목록이 항상 비게 된다. 면제 여부와 무관하게 **누적 많은 순**으로 보여주는 것이 요점.
--
-- 누적 기준: gave_up_at 필터 없음 — 0064 승격 트리거(enqueue_host_promotion)와 동일 기준이어야
--   운영자가 보는 숫자와 승격 임계(1,000)가 어긋나지 않는다.
--
-- 재실행 안전 — drop if exists 후 create.

drop function if exists public.admin_list_growing_challenges();

create function public.admin_list_growing_challenges()
returns table (
  id                 uuid,
  title              text,
  kind               text,
  host_tier          text,
  host_label         text,
  recruit_cap_exempt boolean,
  member_count       int,          -- 누적 참여 (포기 포함 — 승격 트리거와 같은 기준)
  created_at         timestamptz
)
language plpgsql security definer stable set search_path = public as $$
-- RETURNS TABLE 의 컬럼(member_count 등)은 plpgsql 에선 OUT 변수로도 잡힌다.
-- 아래 order by member_count 가 출력 별칭이 아닌 그 변수(NULL)로 해석되면 정렬이 조용히 사라지므로,
-- 이름이 겹칠 땐 항상 컬럼을 쓰도록 못박는다. (이 함수는 쿼리에서 변수를 참조하지 않아 안전)
#variable_conflict use_column
begin
  -- 🔒 SECURITY DEFINER 라 RLS 를 우회한다 → 게이트 없으면 아무 로그인 사용자나 전체 하다 열람
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;

  return query
  select c.id, c.title, c.kind, c.host_tier, c.host_label, c.recruit_cap_exempt,
         (select count(*)::int from public.challenge_members m where m.challenge_id = c.id) as member_count,
         c.created_at
  from public.challenges c
  where c.kind = 'open'          -- 캡·승격 자체가 누구나 하다 전용 (0043·0064)
  order by member_count desc
  limit 30;
end $$;

alter function public.admin_list_growing_challenges() owner to postgres;
grant execute on function public.admin_list_growing_challenges() to authenticated;

-- 검증:
--   1) [권한] 비-admin 계정으로 select * from admin_list_growing_challenges(); → 'admin only' 예외(42501).
--   2) [범위] 반환 행의 kind 는 전부 'open' (solo/cheered/closed 는 섞이지 않음).
--   3) [기준] 포기(gave_up_at not null) 멤버가 있는 방의 member_count 가 활성 수가 아닌 누적 수와 일치
--      → 0064 enqueue_host_promotion 의 count 와 같은 값.
--   4) [정렬] member_count 내림차순, 최대 30행.
