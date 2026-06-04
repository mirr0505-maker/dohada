// 🚀 EAS 빌드 프로필별 동적 설정 (v2.5 — dev/prod 분리)
//
// EAS_BUILD_PROFILE 환경변수로 분기:
//   - development → 'app.dohada.beta.dev' (다른 앱 아이콘 + 별도 설치 가능)
//   - production / preview → 'app.dohada.beta' (TestFlight·App Store)
//
// ⚠️ Expo 가 자동으로 app.json 을 config 매개변수로 inject 하므로
// 반드시 ({ config }) => {...} 함수 형태로 export. 정적 export 하면
// app.json 값이 무시되고 production 설정으로 fallback (doctor 경고).
//
// ⚠️ dev 빌드는 Google OAuth 가 작동 X (Google Cloud Console 의 iOS Client 가
// production bundle ID 와만 짝지어져 있음). 베타 검증은 Apple Sign In 으로 진행.
// Phase 1.5 에 dev 용 Google iOS Client 별도 발급 검토.

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const isDev = profile === 'development';

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
