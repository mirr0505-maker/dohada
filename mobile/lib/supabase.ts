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

// SecureStore 어댑터 — Supabase 세션을 device keychain 에 저장
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
