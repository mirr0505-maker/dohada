// 🚀 EAS 빌드 프로필별 동적 설정 (v2.5 — dev/prod 분리)
//
// EAS_BUILD_PROFILE 환경변수로 분기:
//   - development → 'app.dohada.beta.dev' (다른 앱 아이콘 + 별도 설치 가능)
//   - production / preview → 'app.dohada.beta' (TestFlight·App Store)
//
// Expo 가 app.config.js 를 app.json 보다 우선 사용. app.json 은 기본값으로 그대로 둠.
//
// ⚠️ dev 빌드는 Google OAuth 가 작동 X (Google Cloud Console 의 iOS Client 가
// production bundle ID 와만 짝지어져 있음). 베타 검증은 Apple Sign In 으로 진행.
// Phase 1.5 에 dev 용 Google iOS Client 별도 발급 검토.

const config = require('./app.json');

const profile = process.env.EAS_BUILD_PROFILE;
const isDev = profile === 'development';

module.exports = {
  ...config,
  expo: {
    ...config.expo,
    name: isDev ? 'Do : 하다 Dev' : config.expo.name,
    ios: {
      ...config.expo.ios,
      bundleIdentifier: isDev
        ? 'app.dohada.beta.dev'
        : config.expo.ios.bundleIdentifier,
    },
    android: {
      ...config.expo.android,
      package: isDev
        ? 'app.dohada.beta.dev'
        : config.expo.android.package,
    },
  },
};
