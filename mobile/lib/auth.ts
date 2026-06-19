// 🚀 인증 — Google OAuth → Supabase signInWithIdToken + Apple Sign In
// Device-local provider lock: 한 기기에서 한 사용자 = 한 provider 만 사용 (v2.2)
//   - 첫 로그인 성공 시 SecureStore 에 provider 저장
//   - 다음 로그인 시 다른 provider 면 signOut + 차단 + 안내 Alert
//   - 베타 30명 단계의 가벼운 방어. 폰 바꾸거나 앱 재설치 시 리셋.
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

import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

// Expo Go / 브라우저 OAuth 마무리 처리 (웹에서만 실행하도록 제한하여 네이티브 환경 초기화 crash 방지)
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// ─── Device-local provider lock ────────────────────────
const PROVIDER_KEY = 'do-hada.auth.provider';
type AuthProvider = 'google' | 'apple';

async function getStoredProvider(): Promise<AuthProvider | null> {
  try {
    const v = await SecureStore.getItemAsync(PROVIDER_KEY);
    return v === 'google' || v === 'apple' ? v : null;
  } catch { return null; }
}

async function setStoredProvider(p: AuthProvider): Promise<void> {
  try { await SecureStore.setItemAsync(PROVIDER_KEY, p); } catch {}
}

function providerLabel(p: AuthProvider): string {
  return p === 'google' ? 'Google' : 'Apple';
}

// 다른 provider 로 로그인 시도면 throw. Supabase 호출 전에 검사해서 auth.users 쓰레기 row 방지.
async function checkProviderAllowed(attempted: AuthProvider): Promise<void> {
  const stored = await getStoredProvider();
  if (stored && stored !== attempted) {
    throw new Error(
      `이 기기는 ${providerLabel(stored)} 로 시작했어요.\n` +
      `${providerLabel(stored)} 로 로그인해주세요.`,
    );
  }
}

// Supabase OAuth + WebBrowser 를 통한 구글 로그인 처리 (New Architecture 크래시 방지)
export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 가 구성되지 않았습니다. .env 를 확인하세요.');
  }
  // Provider lock 검사 — Supabase 호출 전에
  await checkProviderAllowed('google');

  // redirect URI 생성 (dohada://)
  const redirectUrl = Linking.createURL('');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('OAuth URL을 받지 못했습니다.');

  // 브라우저로 OAuth 인증 진행
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type === 'success') {
    // result.url 에서 access_token, refresh_token 혹은 code 추출
    const urlObj = Linking.parse(result.url);
    const params = urlObj.queryParams || {};
    
    let accessToken = params.access_token as string;
    let refreshToken = params.refresh_token as string;

    // 만약 해시 파라미터(#)에 토큰이 들어있는 경우 파싱
    if (!accessToken && result.url.includes('#')) {
      const hash = result.url.split('#')[1];
      const chunks = hash.split('&');
      const hashParams: Record<string, string> = {};
      for (const chunk of chunks) {
        const [k, v] = chunk.split('=');
        if (k && v) {
          hashParams[k] = decodeURIComponent(v);
        }
      }
      accessToken = hashParams.access_token;
      refreshToken = hashParams.refresh_token;
    }

    let sessionData;
    if (accessToken) {
      const { data: sData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      if (sessionError) throw sessionError;
      sessionData = sData;
    } else {
      // 만약 PKCE flow 로 code 가 넘어온 경우
      const code = params.code as string;
      if (code) {
        const { data: sData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) throw sessionError;
        sessionData = sData;
      } else {
        throw new Error('인증 정보를 파싱할 수 없습니다.');
      }
    }

    const user = sessionData?.user;
    let isNewUser = false;
    if (user) {
      // 🚀 신규 유저 여부 판별: public.users에 데이터가 존재하는지 확인
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      isNewUser = !existingUser;

      // 성공 후 device-local provider 저장
      await setStoredProvider('google');

      // public.users 행 upsert — nickname 은 Google 이름 또는 이메일 prefix
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
        // ignoreDuplicates: 사용자가 직접 수정한 닉네임을 재로그인 시 덮어쓰지 않도록
        { onConflict: 'id', ignoreDuplicates: true },
      );
    }
    
    return { session: sessionData, isNewUser };
  } else if (result.type === 'cancel') {
    throw new Error('CANCELLED');
  } else {
    throw new Error('로그인 중 오류가 발생했습니다.');
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 🚀 회원 탈퇴(계정 삭제) — delete-account EF(익명화 + PII 삭제 + auth ban) 호출 후 로컬 세션 정리.
// 되돌릴 수 없음: 같은 소셜 계정은 재로그인 영구 차단(다른 계정으론 신규 가입 가능).
// 공유 콘텐츠(인증·기록·댓글 등)는 동료 박제 보호를 위해 "탈퇴한 사람" 으로 익명 보존.
export async function deleteAccount(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) throw error;
  } finally {
    // EF 가 auth 계정을 ban — 로컬 세션도 즉시 정리해 로그인 화면으로 (에러가 나더라도 강제 로그아웃 보장)
    await supabase.auth.signOut();
  }
}

// ─── Apple Sign In (iOS 만) ───────────────────────────
// iOS App Store 정책상 SNS 로그인 있는 앱은 Apple 로그인 필수.
// Android 에선 안 보이게 login.tsx 가 Platform.OS 분기.
//
// 사전 작업 (Apple Developer 활성화 후):
//   1) Apple Developer Console → Identifiers → App ID (`app.dohada.beta`) → "Sign in with Apple" capability ON
//   2) Keys → "+ Create a Key" → "Sign in with Apple" ON → 키 다운로드 (.p8 파일, 한 번만)
//   3) Supabase → Authentication → Providers → Apple ON + Services ID + Team ID + Key ID + Private Key 입력
//   4) eas build --profile development --platform ios 새로 빌드 (entitlement 반영)

export async function isAppleSignInAvailable(): Promise<boolean> {
  // iOS 13 이상 모든 현대 기기에서 상시 지원하므로, 네이티브 모듈 호출 크래시 방지를 위해 항상 true 반환
  return Platform.OS === 'ios';
}

export async function signInWithApple() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 가 구성되지 않았습니다.');
  }

  // Provider lock 검사 1 — Apple dialog 띄우기 전에 (사용자 헛수고 방지)
  await checkProviderAllowed('apple');

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple ID 토큰을 받지 못했어요.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // 성공 후 device-local provider 저장
  await setStoredProvider('apple');

  // public.users upsert
  // 주의: Apple 은 첫 로그인 때만 fullName/email 을 줌. 두 번째부터는 null.
  // Hide My Email 사용 시 user.email 이 xxx@privaterelay.appleid.com 의미 없는 prefix → 사용 X.
  const user = data.user;
  let isNewUser = false;
  if (user) {
    // 🚀 신규 유저 여부 판별: public.users에 데이터가 존재하는지 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    isNewUser = !existingUser;

    const fullName = [credential.fullName?.familyName, credential.fullName?.givenName]
      .filter(Boolean).join('') || null;
    const isHiddenEmail = (user.email ?? '').endsWith('@privaterelay.appleid.com');
    const emailPrefix = (!isHiddenEmail && user.email) ? user.email.split('@')[0] : null;
    const nick = fullName ?? emailPrefix ?? '도전자';
    // ignoreDuplicates: 기존 row 가 있으면 nickname 덮어쓰지 않음 (사용자가 직접 수정한 닉네임 보호)
    await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email,
        nickname: nick,
        avatar_url: null,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  }

  return { session: data.session, isNewUser };
}
