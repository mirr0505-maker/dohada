-- 🚀 0082 — 명사(figure) 무대도 모집 캡 면제
--
-- 배경: 광장 탭의 "무대" 섹션은 명사(figure)·조직(org)이 연 하다를 상설로 보여준다.
--   그런데 캡 면제는 org 에만 있었다(0074) → **명사가 연 하다는 기간 50% 가 지나면 모집이 닫힌다**(0043).
--   결과: 광장 무대에 카드가 떠 있는데 눌러도 합류할 수 없는 방이 생긴다.
--   무대에 세워두는 이유가 "사람이 모이라고"인데, 정작 절반이 지나면 문이 닫히는 셈이다.
--
--   org 를 면제한 근거(0074)가 figure 에도 그대로 성립한다 —
--   0043 캡은 "서로를 목격하는 동료"를 지키는 장치인데, **무대는 애초에 광장**이라 전제가 다르다.
--
-- ⚠️ org 와 달리 figure 는 **kind='open' 일 때만** 면제한다.
--   org 갈래는 kind 를 안 따지지만(조직은 closed 도 흔히 쓴다), figure 는 개인이라
--   그 사람의 사적인 다함께·나홀로 방까지 캡을 풀어줄 이유가 없다.
--   무대에 뜨는 것도 open 뿐이다(0079: 비멤버 SELECT 가 open 에만 열려 있어서).
--
-- ⚠️ 면제하는 것은 **캡뿐**이다. 포기(gave_up_at)·개설자 수동 잠금(recruit_locked)은 그대로 막힌다.
-- ⚠️ 클라 mobile/lib/stats.ts isRecruiting 과 미러 — 한쪽만 고치면
--    "클라는 합류 버튼을 보여주는데 DB(RLS members_self_insert)가 거부" 로 갈라진다.
--
-- [불변] host_tier 가 individual 인 방의 판정은 이 마이그레이션 전후로 100% 동일하다.
-- 재실행 안전 — create or replace.

create or replace function public.is_recruiting(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = challenge_uuid
      and c.gave_up_at is null
      and not c.recruit_locked
      and (
        -- 0074: 조직 하다 = 광장 → 캡 무관, kind 무관 (closed 조직 하다도 이 함수엔 '모집 중')
        c.host_tier = 'org'
        or (
          c.kind = 'open'
          and (
            -- 0064: 면제 방은 기간 50% 자동 마감을 받지 않는다(1,000명까지 자라야 하므로).
            c.recruit_cap_exempt
            -- 🚀 0082: 명사 무대도 면제 — 광장에 떠 있는데 못 들어가는 방을 만들지 않는다.
            or c.host_tier = 'figure'
            -- 면제도 무대도 아니면 기존(0043) 조건 그대로 — 일반 open 방 동작 불변.
            or now() < public.recruit_close_at(c.start_date, c.end_date)
          )
        )
      )
  );
$$;
alter function public.is_recruiting(uuid) owner to postgres;

-- 검증:
--   1) [불변] 일반 open 방(host_tier='individual', 미면제): 기간 50% 전 true → 후 false. 종전과 동일.
--   2) [신규] figure 무대(open): 기간 50% 가 지나도 true.
--        update public.challenges set host_tier='figure' where id='<open 하다 id>';
--        select public.is_recruiting('<그 id>');            -- 기대: true (기간 90% 경과 상태에서도)
--   3) [경계] figure 인데 kind<>'open': 그 방의 판정은 open 갈래에 안 들어가므로 종전과 동일.
--   4) [면제는 캡뿐] figure 무대를 개설자가 손수 잠그면(recruit_locked=true) → false.
--        select public.set_recruit_lock('<그 id>', true);   select public.is_recruiting('<그 id>');  -- false
--   5) [포기] gave_up_at 이 있으면 host_tier 무관 false.
--   6) [org 불변] org 하다는 kind 무관 true (0074 그대로).
