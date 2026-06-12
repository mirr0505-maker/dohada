// 🚀 챌린지방 - 기록 탭 (Vlog 형태)
// v4: "📝 인상깊은 순간을 기록해요" 버튼 + 카드 피드. 인증과 별개의 추억성 콘텐츠.
// 제목 + 본문 + 사진(선택, R2 업로드) + 좋아요/댓글.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, Modal,
  KeyboardAvoidingView, Platform, Alert, Image, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import {
  fetchLogs, createLog, updateLog, deleteLog, toggleLogLike, type LogWithAuthor,
} from '@/lib/db';
import { uploadProofImage } from '@/lib/upload';
import { colors, fontFamily, fontSize, fontWeight, radius, shadow } from '@/lib/tokens';
import { haptic } from '@/lib/haptics';
import { LogCommentsSheet } from './LogCommentsSheet';

type Props = {
  challengeId: string;
  challengeStartDate: string;        // YYYY-MM-DD
  myUserId: string | undefined;
  isMember: boolean;
  canComment: boolean;               // solo 방은 false — 기록 댓글 숨김
  composerOpen: boolean;             // 기록 모달 — 부모(room) FAB 가 트리거
  onComposerClose: () => void;
  writeLocked?: boolean;             // 박제 — 좋아요·수정·댓글 작성 잠금
  farewellDaysLeft?: number;         // 마무리 인사 유예 잔여일 (유예 중일 때만 1~7) — ChatTab 과 동일 배너
  focusLogId?: string | null;        // 알림 딥링크 — 해당 기록 카드로 스크롤 포커스
  focusComments?: boolean;           // 알림 딥링크 — 댓글 시트까지 자동 오픈 (log_comment)
};

export function LogTab({
  challengeId, challengeStartDate, myUserId, isMember, canComment,
  composerOpen, onComposerClose, writeLocked = false, farewellDaysLeft = 0,
  focusLogId = null, focusComments = false,
}: Props) {
  const [logs, setLogs] = useState<LogWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);   // 댓글 시트 대상
  const [editingLog, setEditingLog] = useState<LogWithAuthor | null>(null);   // 본인 글 수정 (v2.2)

  const load = useCallback(async () => {
    if (!challengeId || !myUserId) return;
    try {
      const data = await fetchLogs(challengeId, myUserId);
      setLogs(data);
    } catch (e: any) {
      Alert.alert('기록 불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [challengeId, myUserId]);

  useEffect(() => { load(); }, [load]);

  // 🚀 알림 딥링크 정밀 포커스 — focusLogId 의 기록 카드로 스크롤, 댓글 알림이면 댓글 시트 자동 오픈
  const listRef = useRef<FlatList<LogWithAuthor>>(null);
  const focusedLogRef = useRef<string | null>(null);   // 같은 param 으로 재로드 시 반복 스크롤 방지
  useEffect(() => {
    if (!focusLogId || logs.length === 0) return;
    if (focusedLogRef.current === focusLogId) return;
    const index = logs.findIndex(l => l.id === focusLogId);
    if (index < 0) return;
    focusedLogRef.current = focusLogId;
    // FlatList 가 카드 높이를 측정할 시간을 준 뒤 스크롤 (직후 호출은 빈번히 실패)
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
    }, 300);
    if (focusComments) setActiveLogId(focusLogId);
  }, [focusLogId, focusComments, logs]);

  // Realtime
  useEffect(() => {
    if (!challengeId) return;
    // 인스턴스별 유니크 채널 이름 — 같은 방 두 mount 시 동일 토픽 충돌 방지 (ChatTab 패턴)
    const channel = supabase
      .channel(`logs:${challengeId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logs', filter: `challenge_id=eq.${challengeId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'log_likes' },
        (payload) => {
          const l = payload.new as { log_id: string; user_id: string };
          setLogs(prev => prev.map(x =>
            x.id === l.log_id
              ? {
                  ...x,
                  like_count: x.like_count + 1,
                  liked_by_me: x.liked_by_me || l.user_id === myUserId,
                }
              : x,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'log_likes' },
        (payload) => {
          const l = payload.old as { log_id: string; user_id: string };
          setLogs(prev => prev.map(x =>
            x.id === l.log_id
              ? {
                  ...x,
                  like_count: Math.max(0, x.like_count - 1),
                  liked_by_me: l.user_id === myUserId ? false : x.liked_by_me,
                }
              : x,
          ));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, myUserId, load]);

  const onLike = useCallback(async (logId: string) => {
    if (!myUserId) return;
    if (writeLocked) {
      haptic.tap();
      Alert.alert('박제된 도전이에요', '마무리 기간이 끝나 반응은 보존만 됩니다.');
      return;
    }
    const target = logs.find(l => l.id === logId);
    if (!target) return;
    haptic.tap();
    // 낙관적
    setLogs(prev => prev.map(x =>
      x.id === logId
        ? {
            ...x,
            liked_by_me: !x.liked_by_me,
            like_count: x.like_count + (x.liked_by_me ? -1 : 1),
          }
        : x,
    ));
    try {
      await toggleLogLike({ logId, userId: myUserId, currentlyLiked: target.liked_by_me });
    } catch (e: any) {
      setLogs(prev => prev.map(x =>
        x.id === logId
          ? { ...x, liked_by_me: target.liked_by_me, like_count: target.like_count }
          : x,
      ));
      Alert.alert('좋아요 실패', e?.message ?? String(e));
    }
  }, [logs, myUserId, writeLocked]);

  return (
    <View style={styles.wrap}>
      {/* 🏁 마무리 인사 유예 배너 — 대화 탭과 동일 로직 (유예 중일 때만) */}
      {farewellDaysLeft > 0 && (
        <View style={styles.farewellBar}>
          <Text style={styles.farewellText}>
            🏁 도전 종료 — 마무리 인사 기간이 {farewellDaysLeft}일 남았어요
          </Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={logs}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={(info) => {
          // 카드 높이가 가변이라 측정 전엔 scrollToIndex 가 실패할 수 있음 — 근사 위치로 이동 후 재시도
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.2, animated: true });
          }, 350);
        }}
        renderItem={({ item }) => (
          <LogCard
            log={item}
            startDate={challengeStartDate}
            canComment={canComment}
            isMine={!writeLocked && item.user_id === myUserId}   /* 박제 후엔 수정/삭제 메뉴 잠금 */
            onLike={() => onLike(item.id)}
            onComment={() => { haptic.tap(); setActiveLogId(item.id); }}
            onEdit={() => { haptic.tap(); setEditingLog(item); }}
            onDelete={() => {
              Alert.alert('기록 삭제', '이 기록을 삭제할까요?\n좋아요·댓글도 같이 사라져요.', [
                { text: '취소', style: 'cancel' },
                {
                  text: '삭제',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteLog(item.id);
                      haptic.warning();
                      setLogs(prev => prev.filter(l => l.id !== item.id));
                    } catch (e: any) {
                      Alert.alert('삭제 실패', e?.message ?? String(e));
                    }
                  },
                },
              ]);
            }}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>불러오는 중…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎥</Text>
              <Text style={styles.emptyText}>
                아직 기록이 없어요.{'\n'}이 챌린지의 첫 추억을 남겨볼까요?
              </Text>
            </View>
          )
        }
      />

      <LogComposer
        visible={composerOpen || !!editingLog}
        onClose={() => { setEditingLog(null); onComposerClose(); }}
        challengeId={challengeId}
        myUserId={myUserId}
        editingLog={editingLog}
        onCreated={() => { setEditingLog(null); onComposerClose(); load(); }}
      />

      <LogCommentsSheet
        logId={activeLogId}
        writeLocked={writeLocked}
        myUserId={myUserId}
        onClose={() => setActiveLogId(null)}
        onCountChange={(lid, delta) => {
          setLogs(prev => prev.map(x =>
            x.id === lid
              ? { ...x, comment_count: Math.max(0, x.comment_count + delta) }
              : x,
          ));
        }}
      />
    </View>
  );
}

// ─── 기록 카드 ──────────────────────────
function LogCard({
  log, startDate, canComment, isMine, onLike, onComment, onEdit, onDelete,
}: {
  log: LogWithAuthor;
  startDate: string;
  canComment: boolean;
  isMine: boolean;
  onLike: () => void;
  onComment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dayN = computeDayN(startDate, log.created_at);
  const onLongPress = () => {
    if (!isMine) return;
    Alert.alert(
      '이 기록',
      '',
      [
        { text: '수정', onPress: onEdit },
        { text: '삭제', style: 'destructive', onPress: onDelete },
        { text: '취소', style: 'cancel' },
      ],
    );
  };
  return (
    <Pressable style={styles.card} onLongPress={onLongPress} delayLongPress={400}>
      <View style={styles.cardHeader}>
        {log.author.avatar_url ? (
          <Image source={{ uri: log.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={{ fontSize: 14 }}>{log.author.nickname?.slice(0, 1) || '🐰'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>
            {log.author.nickname || '동료'}{isMine ? ' (나)' : ''}
          </Text>
          <Text style={styles.authorMeta}>
            {dayN}일째 · {formatRel(log.created_at)}{isMine ? ' · 길게 눌러 수정/삭제' : ''}
          </Text>
        </View>
      </View>

      {log.photo_url ? (
        <LogPhoto uri={log.photo_url} style={styles.photo} />
      ) : null}

      <Text style={styles.title}>{log.title}</Text>
      <Text style={styles.content}>{log.content}</Text>

      <View style={styles.actions}>
        <Pressable style={styles.likeBtn} onPress={onLike} hitSlop={6}>
          <Text style={[styles.likeIcon, log.liked_by_me && styles.likeIconOn]}>
            {log.liked_by_me ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.likeCount, log.liked_by_me && styles.likeCountOn]}>
            {log.like_count}
          </Text>
        </Pressable>
        {canComment && (
          <Pressable style={styles.likeBtn} onPress={onComment} hitSlop={6}>
            <Text style={styles.likeIcon}>💬</Text>
            <Text style={styles.likeCount}>{log.comment_count}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── 사진 — 원본 비율 그대로 표시 (잘림 방지) ──────────
// 피드 레이아웃 안정성을 위해 세로 4:5 ~ 가로 16:9 사이로만 클램프.
function LogPhoto({ uri, style }: { uri: string; style: object }) {
  const [ratio, setRatio] = useState(16 / 10);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => { if (alive && w > 0 && h > 0) setRatio(Math.min(16 / 9, Math.max(4 / 5, w / h))); },
      () => {},   // 크기 조회 실패 시 기본 비율 유지
    );
    return () => { alive = false; };
  }, [uri]);
  return <Image source={{ uri }} style={[style, { aspectRatio: ratio }]} resizeMode="cover" />;
}

// ─── 작성 모달 ──────────────────────────
function LogComposer({
  visible, onClose, challengeId, myUserId, editingLog, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  myUserId: string | undefined;
  editingLog: LogWithAuthor | null;       // 있으면 수정 모드 (v2.2)
  onCreated: () => void;
}) {
  const insets = useSafeAreaInsets();         // status bar 와 겹침 방지
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);   // 선택 이미지 (v2.2)
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setContent(''); setPhotoUri(null); };

  // 수정 모드 진입 시 기존 값 채우기
  useEffect(() => {
    if (editingLog) {
      setTitle(editingLog.title);
      setContent(editingLog.content);
      setPhotoUri(editingLog.photo_url);
    } else if (visible) {
      reset();
    }
  }, [editingLog?.id, visible]);

  const onPickPhoto = async () => {
    haptic.tap();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert(
          '보관함 접근 권한이 필요해요',
          '설정 → Do:하다 → 사진 에서 켜주세요.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],   // v18 호환 — MediaTypeOptions 는 deprecated
        quality: 0.85,
        exif: false,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      Alert.alert('사진 선택 실패', e?.message ?? String(e));
    }
  };

  // 🚀 기록 중 바로 촬영 — 달리다 만난 풍광을 그 자리에서 담기 (베타 피드백)
  const onTakePhoto = async () => {
    haptic.tap();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert(
          '카메라 권한이 필요해요',
          '설정 → Do:하다 → 카메라 에서 켜주세요.',
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        exif: false,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      Alert.alert('촬영 실패', e?.message ?? String(e));
    }
  };

  const onSave = async () => {
    if (!myUserId || saving) return;
    setSaving(true);
    try {
      // photoUri 가 이미 http(s) URL 이면 기존 사진 그대로, 아니면 R2 업로드
      const photoUrl = photoUri
        ? (photoUri.startsWith('http') ? photoUri : await uploadProofImage(photoUri, 'jpg'))
        : null;
      if (editingLog) {
        await updateLog({ logId: editingLog.id, title, content, photoUrl });
      } else {
        await createLog({ challengeId, userId: myUserId, title, content, photoUrl });
      }
      haptic.success();
      reset();
      onCreated();
    } catch (e: any) {
      Alert.alert('기록 저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => { reset(); onClose(); }} hitSlop={12}>
            <Text style={styles.modalCancel}>취소</Text>
          </Pressable>
          <Text style={styles.modalTitle}>{editingLog ? '기록 수정' : '새 기록'}</Text>
          <Pressable
            onPress={onSave}
            disabled={!title.trim() || !content.trim() || saving}
            hitSlop={12}
          >
            <Text style={[
              styles.modalSave,
              (!title.trim() || !content.trim() || saving) && { opacity: 0.4 },
            ]}>
              {saving ? '저장 중…' : '저장'}
            </Text>
          </Pressable>
        </View>

        {/* 🚀 사진을 먼저 넣으면 세로 긴 사진이 본문 입력칸을 화면 밖으로 밀어냈음 →
            스크롤 가능하게 변경 + 사진 미리보기 높이 제한 (본문이 항상 닿을 수 있게) */}
        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목 (예: 한라산 정상에서)"
            placeholderTextColor={colors.primary300}
            style={styles.titleInput}
            maxLength={80}
            editable={!saving}
          />

          {photoUri ? (
            <View style={styles.photoBox}>
              <LogPhoto uri={photoUri} style={styles.photoPreview} />
              <Pressable
                style={styles.photoRemove}
                onPress={() => setPhotoUri(null)}
                disabled={saving}
                hitSlop={8}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoBtnRow}>
              <Pressable style={[styles.photoAddBtn, { flex: 1 }]} onPress={onTakePhoto} disabled={saving}>
                <Text style={styles.photoAddText}>📷 사진 찍기</Text>
              </Pressable>
              <Pressable style={[styles.photoAddBtn, { flex: 1 }]} onPress={onPickPhoto} disabled={saving}>
                <Text style={styles.photoAddText}>🖼️ 보관함에서</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={'오늘 어떤 변화가 있었나요?\n작은 순간도 적어두면 나중에 보물이 돼요.'}
            placeholderTextColor={colors.primary300}
            style={styles.contentInput}
            multiline
            maxLength={4000}
            editable={!saving}
          />
          <Text style={styles.counter}>{content.length} / 4000</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── 유틸 ──────────────────────────
function computeDayN(startDate: string, createdAt: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const created = new Date(createdAt);
  return Math.max(1, Math.floor((created.getTime() - start.getTime()) / 86_400_000) + 1);
}

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  farewellBar: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.accent50,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent100,
  },
  farewellText: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  list: { padding: 16, gap: 12, flexGrow: 1, paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    gap: 10,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorName: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  authorMeta: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  photo: {
    width: '100%',
    // aspectRatio 는 LogPhoto 가 원본 비율로 지정 (잘림 방지)
    borderRadius: radius.lg,
    backgroundColor: colors.primary100,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  actions: { flexDirection: 'row', gap: 16, paddingTop: 4 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIcon: { fontSize: 18 },
  likeIconOn: { },
  likeCount: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  likeCountOn: { color: colors.danger, fontWeight: fontWeight.bold },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 64, gap: 12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: {
    fontSize: fontSize.base, color: colors.primary500,
    fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22,
  },

  // Composer modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    backgroundColor: colors.surface,
  },
  modalCancel: { fontSize: fontSize.base, color: colors.primary500, fontFamily: fontFamily.medium },
  modalTitle: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalSave: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  titleInput: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
  },
  contentInput: {
    minHeight: 200,   // flex:1 → ScrollView 안에선 높이 0 이 되므로 최소 높이로 (본문 항상 보임)
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    paddingTop: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    textAlign: 'right',
    paddingBottom: 16,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  photoAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderStyle: 'dashed',
  },
  photoAddText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  photoBox: {
    marginTop: 12,
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    maxHeight: 320,   // 세로 긴 사진이 본문 입력칸을 화면 밖으로 밀어내지 않게 미리보기 높이 제한
  },
  photoPreview: {
    width: '100%',
    // aspectRatio 는 LogPhoto 가 원본 비율로 지정
    backgroundColor: colors.primary100,
  },
  photoRemove: {
    position: 'absolute',
    top: 8, right: 8,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
});
