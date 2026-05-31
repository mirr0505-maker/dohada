// 🚀 Supabase 클라이언트 — 세션은 expo-secure-store 에 보관 (안전 저장소)
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // .env 채우기 전엔 명확히 알려주기. 빌드는 통과시키되 런타임에 안내.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 .env 에 없습니다. ' +
    '베타 흐름 검증을 위해 더미 모드로 동작합니다.',
  );
}

// SecureStore 청크 어댑터 — Keychain item 의 2KB 한도 우회
// Supabase 세션(JWT + user_metadata)이 2KB 넘어서 SecureStore 저장 실패 → 다음 요청에
// JWT 누락 → auth.uid() = null → RLS 위반. 1KB 단위로 쪼개 저장.
const CHUNK = 1024;
const META = '-chunks';
const ExpoSecureStoreAdapter = {
  async getItem(key: string) {
    const meta = await SecureStore.getItemAsync(key + META);
    if (!meta) return await SecureStore.getItemAsync(key);   // 청크 안 한 짧은 값 호환
    const parts: string[] = [];
    for (let i = 0; i < Number(meta); i++) {
      const part = await SecureStore.getItemAsync(`${key}-${i}`);
      if (part === null) return null;                          // 손상된 청크
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string) {
    // 기존 청크/단일 값 모두 정리 후 새로 저장 (잔재 방지)
    const oldMeta = await SecureStore.getItemAsync(key + META);
    if (oldMeta) {
      for (let i = 0; i < Number(oldMeta); i++) {
        await SecureStore.deleteItemAsync(`${key}-${i}`);
      }
      await SecureStore.deleteItemAsync(key + META);
    }
    await SecureStore.deleteItemAsync(key);

    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(
        `${key}-${i}`,
        value.slice(i * CHUNK, (i + 1) * CHUNK),
      );
    }
    await SecureStore.setItemAsync(key + META, String(chunks));
  },
  async removeItem(key: string) {
    const meta = await SecureStore.getItemAsync(key + META);
    if (meta) {
      for (let i = 0; i < Number(meta); i++) {
        await SecureStore.deleteItemAsync(`${key}-${i}`);
      }
      await SecureStore.deleteItemAsync(key + META);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      // web/SSR 환경에선 SecureStore 없음 → 기본 localStorage fallback
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Supabase 가 실제로 구성됐는지 (코드 분기용)
export const isSupabaseConfigured = Boolean(url && anonKey);
