-- 🚀 0025 — 헤더 벨 알림함(inbox) 공개
--
-- AS-IS: notification_queue 는 RLS 정책 0개 = service_role 전용.
--        헤더 벨 dot 은 별도 로직(새 대화/기록 24h)이라 푸시와 따로 움직임.
-- TO-BE: 본인 행 SELECT 만 허용 → 벨 알림함이 푸시와 "동일한 소스" 를 읽음.
--        INSERT/UPDATE/DELETE 정책은 계속 없음 (트리거·RPC·service_role 전용 유지).
--
-- 재실행 안전.

drop policy if exists notifq_self_select on public.notification_queue;
create policy notifq_self_select on public.notification_queue
  for select using (user_id = auth.uid());

-- 검증:
--   클라이언트(authenticated)에서
--   select count(*) from notification_queue;  → 본인 행 수만 보여야 함
--   insert 시도 → RLS 거부되어야 함
