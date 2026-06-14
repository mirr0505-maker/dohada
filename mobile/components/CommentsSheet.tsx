// 🚀 댓글 시트 — 인증 1건의 댓글 목록 + 입력
// room/[id].tsx 가 sheet 열기 상태를 관리하고, proofId 와 onClose 만 넘김.
//
// 키보드 가림 이슈 (베타 발견):
//   AS-IS pageSheet + KeyboardAvoidingView(padding) → iOS pageSheet 안에서 RN 의 KAV 가 정상 동작 안 함 (known issue).
//   TO-BE fullscreen modal + ChatTab 검증 패턴(Keyboard 리스너 + 동적 inputBar paddingBottom).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { fetchComments, addComment, deleteComment } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { reportError } from '@/lib/sentry';
import type { CommentWithAuthor } from '@/lib/types';

type Props = {
  proofId: string | null;        // null 이면 sheet 닫힘
  myUserId: string | undefined;
  onClose: () => void;
  // 댓글 수 변동 시 부모에게 알려서 인증 카드 N 갱신
  onCountChange?: (proofId: string, delta: 1 | -1) => void;
  writeLocked?: boolean;         // 박제 — 새 댓글 작성 잠금 (열람은 가능)
};

export function CommentsSheet({ proofId, myUserId, onClose, onCountChange, writeLocked = false }: Props) {
  const [items, setItems] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isKbVisible, setIsKbVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // 키보드 표시/숨김 추적 — inputBar paddingBottom 동적 조절용
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvt, () => setIsKbVisible(true));
    const s2 = Keyboard.addListener(hideEvt, () => setIsKbVisible(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const load = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      const data = await fetchComments(pid);
      setItems(data);
    } catch (e) {
      reportError(e, { where: 'CommentsSheet/fetch', proofId: pid });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (proofId) load(proofId);
    else { setItems([]); setText(''); }
  }, [proofId, load]);

  // Realtime: 다른 사람 댓글 즉시 반영
  useEffect(() => {
    if (!proofId) return;
    // 인스턴스별 유니크 채널 이름 — 동일 토픽 이중 구독 충돌 방지 (ChatTab 패턴)
    const channel = supabase
      .channel(`comments:${proofId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `proof_id=eq.${proofId}` },
        () => { load(proofId); },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        (payload) => {
          const c = payload.old as { id: string };
          setItems(prev => prev.filter(x => x.id !== c.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [proofId, load]);

  const onSend = async () => {
    if (!proofId || !myUserId || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await addComment({ proofId, userId: myUserId, content: trimmed });
      haptic.tap();
      setText('');
      onCountChange?.(proofId, 1);
      await load(proofId);
    } catch (e: any) {
      Alert.alert('댓글 실패', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const onDelete = (commentId: string) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId);
            haptic.tap();
            if (proofId) onCountChange?.(proofId, -1);
            setItems(prev => prev.filter(x => x.id !== commentId));
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? String(e));
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={proofId !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* SafeAreaView 가 Modal 안에서 inset 못 잡는 케이스 → View + paddingTop 직접 적용 */}
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        {/* 헤더 — 상태바 아래에 안전하게 노출 */}
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={styles.title}>댓글</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* 댓글 목록 */}
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={c => c.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <CommentItem
                  item={item}
                  mine={item.user_id === myUserId}
                  onDelete={() => onDelete(item.id)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                  <Text style={styles.emptyText}>
                    첫 댓글을 남겨보세요.{'\n'}따뜻한 한마디가 큰 힘이에요.
                  </Text>
                </View>
              }
            />
          )}

          {/* 입력 — 키보드 표시 시 8px, 숨김 시 home indicator 영역 확보. 박제 후엔 잠금 안내 */}
          {writeLocked ? (
            <View style={styles.lockedBar}>
              <Text style={styles.lockedText}>🏁 박제된 하다예요 — 댓글은 보존만 됩니다.</Text>
            </View>
          ) : (
          <View style={[
            styles.inputBar,
            {
              paddingBottom: (Platform.OS === 'ios' && !isKbVisible && insets.bottom > 0)
                ? insets.bottom
                : 8
            }
          ]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="응원의 한마디"
              placeholderTextColor={colors.primary300}
              style={styles.input}
              maxLength={280}
              editable={!sending}
              multiline
            />
            <Pressable
              style={[
                styles.sendBtn,
                (!text.trim() || sending) && { opacity: 0.4 },
              ]}
              onPress={onSend}
              disabled={!text.trim() || sending}
            >
              <Text style={styles.sendText}>{sending ? '…' : '전송'}</Text>
            </Pressable>
          </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentItem({
  item, mine, onDelete,
}: { item: CommentWithAuthor; mine: boolean; onDelete: () => void }) {
  return (
    <Pressable
      style={styles.row}
      onLongPress={mine ? onDelete : undefined}
      delayLongPress={400}
    >
      {item.author?.avatar_url ? (
        <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={{ fontSize: 16 }}>🐰</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.rowHead}>
          <Text style={styles.author}>{item.author?.nickname ?? '익명'}</Text>
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        {mine ? <Text style={styles.deleteHint}>길게 눌러 삭제</Text> : null}
      </View>
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  if (ms < 60_000) return '방금';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  close: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    width: 44,
    textAlign: 'right',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 14, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarFallback: {
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  author: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  deleteHint: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  lockedBar: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary50,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
  },
  lockedText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
  },
  sendText: {
    color: colors.surface,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
