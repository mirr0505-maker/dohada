-- 🚀 0027 — "동료 인증·기록" 알림 끄기 토글 (0026 proof/log 알림용)
-- 기본 ON. 끄면 flush-notifications 가 푸시를 건너뜀 (알림함에는 계속 보임 — 다른 토글과 동일 동작).
-- 재실행 안전.

alter table public.notification_prefs
  add column if not exists proof_log_enabled boolean not null default true;
