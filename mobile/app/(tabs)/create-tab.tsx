// 🚀 + 탭 placeholder — 실제로는 _layout 의 listener 가 /create modal 로 push.
// 이 화면이 보이는 일은 없지만 expo-router 가 라우트 등록을 요구하므로 빈 컴포넌트.
import React from 'react';
import { View } from 'react-native';

export default function CreateTabPlaceholder() {
  return <View />;
}
