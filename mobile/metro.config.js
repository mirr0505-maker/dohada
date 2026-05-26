// 🚀 Metro config — Expo default + Sentry source map upload integration
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
