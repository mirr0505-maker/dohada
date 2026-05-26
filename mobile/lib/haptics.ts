// 🚀 햅틱 — expo-haptics 단일 진입점
// 화면 코드에서는 haptic.tap() / .success() / .warning() 만 호출.
import * as Haptics from 'expo-haptics';

export const haptic = {
  // 가벼운 탭 (응원 토글 등)
  tap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  // 강한 진동 (인증 셔터)
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  // 성공 (챌린지 생성, 인증 완료)
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  // 경고 / 실패
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
