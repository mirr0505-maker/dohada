// 🚀 Expo Push Token 등록 + 알림 설정 prefs
// EPN (Expo Push Service) 사용 → APNs 인증서 셋업 불필요.
// 첫 로그인 시 호출 → device_tokens 에 upsert + notification_prefs row ensure.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from './supabase';
import { ensurePermission } from './notifications';

export type NotificationPrefs = {
  chat_enabled: boolean;
  comment_enabled: boolean;
  cheer_batch_enabled: boolean;
  proof_log_enabled: boolean;   // 동료 인증·기록 업로드 알림 (0027)
  daily_enabled: boolean;
};

// 🚀 알림 kind → 챌린지방 딥링크 (헤더 알림함 행 탭 시 사용)
//   대화·공지 → 대화 탭 / 기록·기록 댓글·좋아요 → 기록 탭 / 인증·인증 댓글·응원 → 인증 탭
//   proofId/logId 가 있으면 해당 카드로 스크롤 포커스, 댓글 알림은 댓글 시트까지 자동 오픈
export function notificationRoute(
  kind: string | undefined,
  challengeId: string,
  target?: { proofId?: string | null; logId?: string | null },
): string {
  if (kind === 'chat' || kind === 'creator_notice') return `/room/${challengeId}?tab=chat`;
  if (kind === 'log' || kind === 'log_comment' || kind === 'log_like_batch') {
    if (!target?.logId) return `/room/${challengeId}?tab=log`;
    return `/room/${challengeId}?tab=log&logId=${target.logId}${kind === 'log_comment' ? '&comments=1' : ''}`;
  }
  // proof · comment · cheer_batch
  if (!target?.proofId) return `/room/${challengeId}?tab=proof`;
  return `/room/${challengeId}?tab=proof&proofId=${target.proofId}${kind === 'comment' ? '&comments=1' : ''}`;
}

// 디바이스의 Expo Push Token 을 받아 device_tokens 에 upsert
export async function registerExpoPushToken(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (Platform.OS === 'web') return;       // 웹은 EPN 미지원

  const granted = await ensurePermission();
  if (!granted) return;

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId
    ?? (Constants as any).easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] projectId 없음 — Expo Push Token 등록 불가');
    return;
  }

  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = res?.data;
    if (!token) return;

    await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        expo_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_token' },
    );
  } catch (e) {
    console.warn('[push] 토큰 등록 실패', e);
  }
}

// notification_prefs row 가 없으면 default(true) 로 생성
export async function ensureNotificationPrefs(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('notification_prefs')
    .upsert(
      { user_id: userId },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('chat_enabled, comment_enabled, cheer_batch_enabled, proof_log_enabled, daily_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    chat_enabled:        data?.chat_enabled        ?? true,
    comment_enabled:     data?.comment_enabled     ?? true,
    cheer_batch_enabled: data?.cheer_batch_enabled ?? true,
    proof_log_enabled:   data?.proof_log_enabled   ?? true,
    daily_enabled:       data?.daily_enabled       ?? true,
  };
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<void> {
  const { error } = await supabase
    .from('notification_prefs')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}
