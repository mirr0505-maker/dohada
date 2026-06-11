// 🚀 에러 수집 — DSN 있으면 Sentry, 없으면 Supabase `client_errors` 테이블(0031)로 자체 수집.
// Sentry 계정/프로젝트 없이도 크래시·에러 추적 가능. 조회는 SQL Editor 에서.
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// 폭주 방지 — 세션당 최대 20건, 동일 메시지는 세션 내 1회만
const MAX_PER_SESSION = 20;
let sentCount = 0;
const seenMessages = new Set<string>();

async function logToSupabase(err: unknown, context?: Record<string, unknown>, isFatal = false) {
  try {
    if (!isSupabaseConfigured) return;
    if (sentCount >= MAX_PER_SESSION) return;
    const message = err instanceof Error ? err.message : String(err);
    const key = message.slice(0, 200);
    if (seenMessages.has(key)) return;
    seenMessages.add(key);
    sentCount += 1;

    const stack = err instanceof Error ? err.stack ?? null : null;
    const { data } = await supabase.auth.getSession();
    await supabase.from('client_errors').insert({
      user_id: data.session?.user?.id ?? null,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      context: context ?? null,
      platform: Platform.OS,
      is_fatal: isFatal,
    });
  } catch {
    // 에러 로깅 실패는 조용히 무시 — 로깅이 또 에러를 만드는 무한 루프 방지
  }
}

export function initSentry() {
  if (DSN) {
    Sentry.init({
      dsn: DSN,
      debug: __DEV__,
      enableAutoSessionTracking: true,
      // 에러 수집만 — 성능 추적(스팬)은 무료 플랜 한도만 소모해서 끔
      tracesSampleRate: 0,
    });
    return;
  }
  // DSN 없음 → Supabase 폴백: 잡히지 않은 JS 에러(크래시)를 전역 핸들러로 수집
  const ErrorUtils = (global as any).ErrorUtils;
  if (ErrorUtils?.setGlobalHandler) {
    const prevHandler = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      logToSupabase(error, { where: 'global_handler' }, !!isFatal);
      prevHandler?.(error, isFatal);   // RN 기본 처리(레드박스/크래시)는 그대로 진행
    });
  }
}

// 명시적으로 에러 보낼 때 (try/catch 안에서)
export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (DSN) {
    Sentry.captureException(err, { extra: context });
    return;
  }
  if (__DEV__) console.warn('[error]', err, context);
  logToSupabase(err, context);
}
