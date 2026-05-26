// 🚀 인증 — Google OAuth → Supabase signInWithIdToken
//
// 흐름:
//   1) expo-auth-session 의 Google.useAuthRequest 로 ID token 받기
//   2) supabase.auth.signInWithIdToken({ provider: 'google', token }) 호출
//   3) Supabase auth.users 자동 생성, 우리 public.users 행은 별도로 upsert
//
// 사전 작업 (.env 에 키 채우기):
//   - EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
//   - EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID
//   - EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB
//   - app.json scheme = "dohada" (이미 설정)
//
// 키 발급: https://console.cloud.google.com > APIs & Services > Credentials
//   각 플랫폼 OAuth 2.0 클라이언트 ID 발급. iOS 번들 ID: app.dohada.beta,
//   Android 패키지: app.dohada.beta + SHA-1 (EAS 빌드 후 확인 가능).

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isSupabaseConfigured } from './supabase';

// Expo Go / 브라우저 OAuth 마무리 처리
WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthState = {
  request: ReturnType<typeof Google.useAuthRequest>[0];
  response: ReturnType<typeof Google.useAuthRequest>[1];
  promptAsync: ReturnType<typeof Google.useAuthRequest>[2];
};

// React 컴포넌트 안에서 호출. login.tsx 가 이 hook 의 결과로 버튼 동작.
export function useGoogleAuth() {
  return Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  });
}

// Google ID token 으로 Supabase 세션 만들고, public.users 에 프로필 upsert
export async function signInWithGoogleIdToken(idToken: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 가 구성되지 않았습니다. .env 를 확인하세요.');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;

  // public.users 행 upsert — nickname 은 Google 이름 또는 이메일 prefix
  const user = data.user;
  if (user) {
    const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string };
    const fallbackNick = user.email?.split('@')[0] ?? '도전자';
    await supabase.from('users').upsert(
      {
        id: user.id,
        google_sub: user.identities?.[0]?.id ?? null,
        email: user.email,
        nickname: meta.full_name || fallbackNick,
        avatar_url: meta.avatar_url ?? null,
      },
      { onConflict: 'id' },
    );
  }

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
