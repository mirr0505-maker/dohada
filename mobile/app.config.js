// 🚀 EAS 빌드 프로필별 동적 설정 (v2.5 — dev/prod 분리)
//
// 분기 변수: APP_VARIANT (eas.json 의 build.development.env 에 명시).
//   - 'development' → 'app.dohada.beta.dev' (다른 앱 아이콘 + 별도 설치 가능)
//   - (그 외)        → 'app.dohada.beta'    (TestFlight·App Store)
//
// EAS_BUILD_PROFILE 자동 변수는 prebuild 단계에서 사용 불가한 경우가 있어
// 직접 env 변수를 박는 게 안전 (EAS Build worker 가 명시 env 만 보장).
//
// ⚠️ Expo 가 자동으로 app.json 을 config 매개변수로 inject 하므로
// 반드시 ({ config }) => {...} 함수 형태로 export.
//
// ⚠️ dev 빌드는 Google OAuth 가 작동 X (Google Cloud Console 의 iOS Client 가
// production bundle ID 와만 짝지어져 있음). 베타 검증은 Apple Sign In 으로 진행.
// Phase 1.5 에 dev 용 Google iOS Client 별도 발급 검토.

module.exports = ({ config }) => {
  const isDev = process.env.APP_VARIANT === 'development';

  return {
    ...config,
    name: isDev ? 'Do : 하다 Dev' : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier: isDev
        ? 'app.dohada.beta.dev'
        : config.ios.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isDev
        ? 'app.dohada.beta.dev'
        : config.android.package,
    },
  };
};
