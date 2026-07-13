// 🚀 공명 글 인라인 댓글 (0063) — "댓글 N개" 탭 시 그 자리 펼침. 모달 아님.
//   익명 토글(기본 ON) · 익명이면 "어떤 이" · 본인 댓글만 삭제. 검수/차단/숨김은 db 함수·RPC가 처리.
//   비주얼 규칙(v2.26): lucide 라인 아이콘 + 중립(surface/line/ink/sub) + 브랜드 오렌지만.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { User, Check } from 'lucide-react-native';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import {
  fetchParangComments, addParangComment, deleteParangComment, type ParangComment,
} from '@/lib/db';

export function ParangComments({
  postType, postId, userId, onCountChange,
}: {
  postType: 'proof' | 'log';
  postId: string;
  userId: string | null;
  onCountChange?: (n: number) => void;
}) {
  const [comments, setComments] = useState<ParangComment[] | null>(null);
  const [input, setInput] = useState('');
  const [anon, setAnon] = useState(true);   // 기본 익명 ON
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    fetchParangComments(postType, postId).then(setComments).catch(() => setComments([]));
  }, [postType, postId]);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    const fresh = await fetchParangComments(postType, postId);
    setComments(fresh);
    onCountChange?.(fresh.length);
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || submitting || !userId) return;
    setSubmitting(true);
    try {
      await addParangComment({ postType, postId, userId, content: text, anon });
      setInput('');
      haptic.tap();
      await refresh();
    } catch (e: any) {
      Alert.alert('댓글', e?.message ?? '등록에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = (id: string) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => { try { await deleteParangComment(id); await refresh(); } catch {} },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      {comments === null ? (
        <ActivityIndicator color={colors.brand} style={{ paddingVertical: 12 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>첫 공명의 말을 남겨보세요.</Text>
      ) : (
        comments.map(c => (
          <View key={c.id} style={styles.row}>
            {c.anon || !c.author_avatar ? (
              <View style={[styles.avatar, styles.avatarNeutral]}>
                <User size={14} color={colors.faint} strokeWidth={1.8} />
              </View>
            ) : (
              <Image source={{ uri: c.author_avatar }} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.who}>{c.anon ? '어떤 이' : c.author_nickname}</Text>
              <Text style={styles.content}>{c.content}</Text>
            </View>
            {c.mine ? (
              <Pressable onPress={() => onDelete(c.id)} hitSlop={8}>
                <Text style={styles.del}>삭제</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      {/* 입력 — 익명 토글 + 등록 */}
      <View style={styles.inputBox}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="공명의 말 남기기…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          maxLength={200}
        />
        <View style={styles.controls}>
          <Pressable
            onPress={() => { haptic.tap(); setAnon(a => !a); }}
            style={[styles.anonToggle, anon && styles.anonToggleOn]}
            hitSlop={6}
          >
            {anon ? <Check size={13} color={colors.brand} strokeWidth={2.2} /> : null}
            <Text style={[styles.anonText, anon && styles.anonTextOn]}>익명</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={submitting || !input.trim()}
            style={[styles.submit, (submitting || !input.trim()) && styles.submitOff]}
          >
            <Text style={styles.submitText}>등록</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, gap: 12 },
  empty: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg },
  avatarNeutral: { alignItems: 'center', justifyContent: 'center' },
  who: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  content: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular, lineHeight: 20, marginTop: 1 },
  del: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },

  inputBox: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, gap: 8,
  },
  input: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.regular, minHeight: 20, maxHeight: 100, padding: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  anonToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line,
  },
  anonToggleOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  anonText: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  anonTextOn: { color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  submit: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.brand },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: fontSize.sm, color: colors.surface, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
