// 🚀 챌린지방 - 대화 탭 (Realtime chat_messages)
// v4: 카톡식 말풍선. 본인 메시지는 오른쪽 accent, 타인은 왼쪽 회색 + 닉네임.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView,
  Platform, Alert, Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { fetchChatMessages, sendChatMessage, type ChatMessageWithAuthor } from '@/lib/db';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';

type Props = {
  challengeId: string;
  myUserId: string | undefined;
  isMember: boolean;
};

export function ChatTab({ challengeId, myUserId, isMember }: Props) {
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<ChatMessageWithAuthor>>(null);

  const load = useCallback(async () => {
    if (!challengeId) return;
    try {
      const data = await fetchChatMessages(challengeId);
      setMessages(data);
    } catch (e: any) {
      Alert.alert('대화 불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime — chat_messages INSERT 구독 (본인/타인 무관, author join 필요해서 재조회)
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`chat:${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `challenge_id=eq.${challengeId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, load]);

  const onSend = useCallback(async () => {
    if (!myUserId || !isMember || sending) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput('');
    haptic.tap();

    // 낙관적 추가 — Realtime self-broadcast 가 늦거나 누락돼도 즉시 보이게.
    // 본인 메시지는 UI 에서 author 정보 안 보므로 빈 author 로 OK. load() 가 진짜 row 로 교체.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageWithAuthor = {
      id: tempId,
      challenge_id: challengeId,
      user_id: myUserId,
      content: text,
      created_at: new Date().toISOString(),
      author: { id: myUserId, nickname: '', avatar_url: null },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await sendChatMessage({ challengeId, userId: myUserId, content: text });
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      Alert.alert('전송 실패', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [challengeId, myUserId, isMember, sending, input]);

  // 메시지 추가될 때 맨 아래로 스크롤
  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>대화 불러오는 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.user_id === myUserId;
          return (
            <View style={[styles.row, mine && styles.rowMine]}>
              {!mine && (
                item.author.avatar_url ? (
                  <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={{ fontSize: 14 }}>{item.author.nickname?.slice(0, 1) || '🐰'}</Text>
                  </View>
                )
              )}
              <View style={{ maxWidth: '75%' }}>
                {!mine && (
                  <Text style={styles.name}>{item.author.nickname || '동료'}</Text>
                )}
                <View style={[styles.bubble, mine && styles.bubbleMine]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.content}
                  </Text>
                </View>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>
              아직 대화가 없어요.{'\n'}동료들에게 첫 인사를 건네볼까요?
            </Text>
          </View>
        }
      />

      {isMember ? (
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={colors.primary300}
            style={styles.input}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guestBar}>
          <Text style={styles.guestText}>대화는 참여 멤버만 작성할 수 있어요.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  loading: { fontSize: fontSize.sm, color: colors.primary500, fontFamily: fontFamily.regular },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowMine: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent50,
  },
  avatarFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  name: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.surface,
  },
  time: {
    fontSize: 10,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    marginLeft: 4,
  },
  timeMine: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base, color: colors.primary500,
    fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
    backgroundColor: colors.surface,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    fontSize: fontSize.sm,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  guestBar: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary50,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
  },
  guestText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
});
