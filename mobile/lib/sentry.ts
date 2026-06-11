// 🚀 Sentry 초기화 — 에러 자동 수집
// .env 에 EXPO_PUBLIC_SENTRY_DSN 가 있으면 활성, 없으면 noop.
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) {
    if (__DEV__) console.log('[sentry] EXPO_PUBLIC_SENTRY_DSN 없음 — 비활성 모드');
    return;
  }
  Sentry.init({
    dsn: DSN,
    debug: __DEV__,
    enableAutoSessionTracking: true,
    // 에러 수집만 사용 — 성능 추적(스팬)은 무료 플랜 한도만 소모해서 끔 (Sentry Developer 플랜 운영)
    tracesSampleRate: 0,
  });
}

// 명시적으로 에러 보낼 때 (try/catch 안에서)
export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!DSN) {
    if (__DEV__) console.warn('[sentry-noop]', err, context);
    return;
  }
  Sentry.captureException(err, { extra: context });
}
