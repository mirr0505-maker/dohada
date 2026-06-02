// 🚀 BrandMark — Do:하다 로고 마크 ( ⊙ )
// 폰트 의존성 없이 정확한 비율로 그림. 괄호=텍스트, 원=View borderRadius, 점=View 채움.
// 비율은 icon.png (외부 원 ≈ 캔버스 34%, 점 ≈ 외부 원 24%) 기준.
//   - 점 = 본인
//   - 원 = 동료/응원
//   - 괄호 = 움직이는 응원 동작
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontWeight } from '@/lib/tokens';

type Size = 'sm' | 'md' | 'lg' | 'xl';

type Spec = { paren: number; ring: number; border: number; dot: number; gap: number };

// paren = 괄호 글자 크기. ring = 원 직경. border = 원 테두리 두께. dot = 점 직경. gap = 요소 간격.
const SIZES: Record<Size, Spec> = {
  sm: { paren: 16, ring: 14, border: 1.5, dot: 4,  gap: 2 },
  md: { paren: 22, ring: 20, border: 2,   dot: 5,  gap: 4 },
  lg: { paren: 40, ring: 36, border: 3,   dot: 9,  gap: 7 },
  xl: { paren: 64, ring: 58, border: 5,   dot: 14, gap: 11 },
};

export function BrandMark({ size = 'md', color }: { size?: Size; color: string }) {
  const s = SIZES[size];
  return (
    <View style={[styles.row, { gap: s.gap }]}>
      <Text style={[styles.paren, { fontSize: s.paren, color, lineHeight: s.paren * 1.1 }]}>(</Text>
      <View
        style={{
          width: s.ring,
          height: s.ring,
          borderRadius: s.ring / 2,
          borderWidth: s.border,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: s.dot,
            height: s.dot,
            borderRadius: s.dot / 2,
            backgroundColor: color,
          }}
        />
      </View>
      <Text style={[styles.paren, { fontSize: s.paren, color, lineHeight: s.paren * 1.1 }]}>)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  paren: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
