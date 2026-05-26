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
    // 베타: 트래픽 적으니 100%. production 진입 시 0.2 정도로 낮춤.
    tracesSampleRate: __DEV__ ? 1.0 : 0.5,
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
