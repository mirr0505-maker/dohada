// 🚀 업데이트 소식 모달 — RELEASE_NOTE.tag 가 바뀌면 앱 켤 때 1회 노출.
//   닫으면 태그를 SecureStore 에 저장 → 같은 릴리스는 다시 안 뜬다. tag='' 이면 아예 안 뜸.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { RELEASE_NOTE } from '@/lib/releaseNotes';

const SEEN_KEY = 'whatsnew_seen_tag';   // 마지막으로 확인한 릴리스 태그 (디바이스 로컬)

export function WhatsNewModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!RELEASE_NOTE.tag) return;   // off 스위치
    SecureStore.getItemAsync(SEEN_KEY)
      .then(seen => { if (seen !== RELEASE_NOTE.tag) setVisible(true); })
      .catch(() => {});
  }, []);

  const close = () => {
    haptic.tap();
    setVisible(false);
    SecureStore.setItemAsync(SEEN_KEY, RELEASE_NOTE.tag).catch(() => {});   // 저장 실패해도 UX 는 진행
  };

  if (!RELEASE_NOTE.tag) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>✨ {RELEASE_NOTE.title}</Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {RELEASE_NOTE.lines.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 {RELEASE_NOTE.tip}</Text>
            </View>
          </ScrollView>

          <Pressable style={styles.btn} onPress={close} accessibilityRole="button">
            <Text style={styles.btnText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: 22,
    gap: 14,
  },
  title: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  body: { maxHeight: 320 },
  lineRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dot: { fontSize: fontSize.base, color: colors.brand, fontFamily: fontFamily.bold, lineHeight: 22 },
  lineText: { flex: 1, fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 22 },
  tipBox: {
    marginTop: 6,
    backgroundColor: colors.accent50,
    borderRadius: radius.lg,
    padding: 12,
  },
  tipText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 20 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { fontSize: fontSize.base, color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
