-- 🚀 0084 — 완주 이야기에 "목표 결과" 저장 (완주 ≠ 성공 두 축, 0078 의 박제 반영)
--
-- 문제: 완주 이야기의 completion_rate(0016 트리거) = 인증 수 ÷ 전체 일수 단순 비율.
--   주3회·주1회·목표 횟수형(0041)·잠시 멈춤(0078)·늦합류(v2.8)·성공 임계(0078)를 전혀 모른다.
--   → 주3회를 100% 채운 사람이 "완주율 43%" 로 영구 박제되는 문제.
--
-- 해법: 판정 단일 소스(mobile/lib/stats.ts goalStatus)와 같은 규칙의 순수 함수
--   (supabase/functions/_shared/goal/storyGoal.ts) 로 Edge Function finalize-story-goal 이 계산해 아래 5개 컬럼에 저장한다.
--   ⚠️ 판정을 SQL 로 복제하지 않는다 — 규칙이 두 곳에 있으면 언젠가 어긋난다. DB 는 결과만 보관.
--
-- 조작 불가: 이 5개 컬럼은 authenticated 에게 INSERT/UPDATE 를 **grant 하지 않는다.**
--   0071 ③ 의 컬럼 화이트리스트(grant insert/update (...) on completion_stories)는 그대로 둔다 —
--   새 컬럼은 목록에 없으므로 클라이언트는 쓸 수 없고, service_role(Edge Function)만 채운다.
--   ("시스템이 증명 · 조작 불가" 약속 유지)
--
-- nullable = 아직 계산 안 된 행 (0084 이전에 쓴 이야기 · Edge Function 호출 실패).
--   화면은 null 이면 기존 completion_rate 를 "인증률" 로 표시한다.
--   기존 행은 finalize-story-goal 의 backfill 모드로 한 번 채운다.
--
-- 박제 = 영구 — TTL·만료 컬럼 없음.
-- 재실행 안전 (add column if not exists).

alter table public.completion_stories
  add column if not exists goal_current      int,            -- 달성 수 (cadence = 고유 인증 날짜 수 · count = 총 인증 수)
  add column if not exists goal_target       int,            -- 성공 기준 수 (임계% 반영)
  add column if not exists goal_rate         numeric(5,2)    -- 달성률 % (임계 100% 목표 대비, 100 상한)
                             check (goal_rate is null or goal_rate between 0 and 100),
  add column if not exists succeeded         boolean,        -- 성공(임계 달성) — 완주(끝까지 감)와 다른 축
  add column if not exists success_threshold int;            -- 계산 당시 하다의 성공 임계 % (90/95/100) — 표시용 스냅숏
