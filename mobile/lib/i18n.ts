// 🚀 i18n — Expo Localization + i18n-js
// 사용: t('home.hello') 또는 t('home.section', { count: 3 })
//
// MVP 는 한국어 우선. 영어는 fallback 골격으로만 두고, Phase 2 글로벌 진입 시 채움.
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import ko from './locales/ko';
import en from './locales/en';

const i18n = new I18n({ ko, en });
i18n.defaultLocale = 'ko';
i18n.enableFallback = true;

// 디바이스 언어 — 한국어/영어가 아니면 한국어로
const code = getLocales()[0]?.languageCode ?? 'ko';
i18n.locale = code === 'en' ? 'en' : 'ko';

export const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, options);

export default i18n;
