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
  daily_enabled: boolean;
};

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
    .select('chat_enabled, comment_enabled, cheer_batch_enabled, daily_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    chat_enabled:        data?.chat_enabled        ?? true,
    comment_enabled:     data?.comment_enabled     ?? true,
    cheer_batch_enabled: data?.cheer_batch_enabled ?? true,
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
