// 🚀 내 프로필 — 헤더 아바타 탭 진입 (리디자인 v2)
// 아바타+닉네임 + 관심 분야 + 나의 발자취(완주/최고연속/받은응원) + 끝낸 하다·다짐·한잔 내역.
// 알림·계정·로그아웃·계정삭제·로드맵은 설정(app/settings.tsx)으로 이전됨.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Pencil, Camera, Plus, Archive, Flag, Coffee, Check, Wrench, Clock } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { ListRow } from '@/components/ListRow';
import { CategoryIcon } from '@/components/CategoryIcon';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle } from '@/lib/tokens';
import { getCategoryIcon } from '@/lib/icons';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import {
  fetchMyProfile, updateMyNickname, updateMyAvatar,
  fetchMyInterests, addInterest, removeInterest, fetchCategoryTree,
  fetchMyFootprints, fetchIsAdmin,
  fetchMyTimezone, updateMyTimezone,
  type MyInterest, type DbCategory, type MyFootprints,
} from '@/lib/db';
import { HostMark, HostAvatarRing } from '@/components/HostMark';
import {
  TIMEZONE_OPTIONS, DEFAULT_TIMEZONE, getDeviceTimezone, timezoneLabel, timezoneOffsetLabel,
} from '@/lib/timezone';
import { uploadProofImage } from '@/lib/upload';
import { isGiftPilotEmail } from '@/lib/payments';

export default function ProfileScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [nickname, setNickname] = useState<string>('도전자');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hostTier, setHostTier] = useState<string | null>(null);    // 🚀 0064: 내 계층 (figure→금빛 테두리 + ⭐)
  const [earlyTier, setEarlyTier] = useState<string | null>(null);  // 🚀 0066: 내 창립 티어 (founder/beta→오렌지 테두리, 마크 없음)
  const [editingNick, setEditingNick] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [interests, setInterests] = useState<MyInterest[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [editingInterests, setEditingInterests] = useState(false);
  const [footprints, setFootprints] = useState<MyFootprints | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);   // 🚀 0077 하루 기준선
  const [editingTz, setEditingTz] = useState(false);
  const deviceTz = getDeviceTimezone();

  // 🚀 광장 '관심 정하기' 진입 — ?interests=1 이면 관심 편집 모달을 바로 연다
  // (파라미터가 남아 있어도 모달을 닫은 뒤 다시 열리지 않게 ref 로 1회만)
  const { interests: interestsParam } = useLocalSearchParams<{ interests?: string }>();
  const interestsAutoOpened = useRef(false);
  useEffect(() => {
    if (!interestsParam || interestsAutoOpened.current) return;
    interestsAutoOpened.current = true;
    setEditingInterests(true);
  }, [interestsParam]);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session]);

  useEffect(() => {
    if (!myUserId || myUserId === 'dev') return;
    fetchMyProfile(myUserId).then(p => { setNickname(p.nickname); setAvatarUrl(p.avatar_url); setHostTier(p.host_tier); setEarlyTier(p.early_tier); }).catch(() => {});
    fetchMyInterests(myUserId).then(setInterests).catch(() => {});
    fetchCategoryTree().then(t => setCategories(t.categories)).catch(() => {});
    fetchMyFootprints(myUserId).then(setFootprints).catch(() => {});
    fetchIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
    fetchMyTimezone(myUserId).then(setTimezone).catch(() => {});
    // 끝낸 하다 개수는 fetchMyFootprints 가 함께 준다(finished) — 목록을 또 부르지 않는다.
    // 완주(성공) 수와는 다른 축: finished = 종료일이 지난 하다, completed = 임계 달성.
  }, [myUserId]);

  // 보관함에서 아바타 사진 선택 → R2 업로드 → DB → state
  const onChangeAvatar = useCallback(async () => {
    if (!myUserId || uploadingAvatar) return;
    haptic.tap();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert('보관함 접근 권한이 필요해요', '설정 → Do:하다 → 사진 에서 켜주세요.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        exif: false,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setUploadingAvatar(true);
      const url = await uploadProofImage(uri, 'jpg');
      await updateMyAvatar(myUserId, url);
      setAvatarUrl(url);
      haptic.success();
    } catch (e: any) {
      Alert.alert('아바타 변경 실패', e?.message ?? String(e));
    } finally {
      setUploadingAvatar(false);
    }
  }, [myUserId, uploadingAvatar]);

  const email = session?.user?.email ?? '';
  const initial = (nickname || '도전자').slice(0, 1);
  const visibleEmail = email.endsWith('@privaterelay.appleid.com') ? '' : email;

  // 관심 칩 아이콘용 — category_id → slug 매핑 (MyInterest 엔 slug 없음)
  const slugById = new Map(categories.map(c => [c.id, c.slug]));

  return (
    <Screen backgroundColor={colors.bg}>
      {/* 상세 헤더: 뒤로가기 + 타이틀 + 닉네임 편집 */}
      <View style={styles.nav}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} accessibilityLabel="뒤로">
          <ArrowLeft size={23} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.navTitle}>내 프로필</Text>
        <Pressable onPress={() => { haptic.tap(); setEditingNick(true); }} hitSlop={10} accessibilityLabel="닉네임 수정">
          <Pencil size={20} color={colors.sub} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 프로필 카드 — 아바타(카메라 뱃지) + 닉네임 + 이메일 */}
        <View style={styles.profileCard}>
          <Pressable onPress={onChangeAvatar} disabled={uploadingAvatar} hitSlop={6} style={styles.avatarWrap}>
            <HostAvatarRing hostTier={hostTier} earlyTier={earlyTier} size={88}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
              )}
            </HostAvatarRing>
            <View style={styles.cameraBadge}>
              <Camera size={15} color={colors.sub} strokeWidth={1.8} />
            </View>
          </Pressable>
          <Pressable onPress={() => { haptic.tap(); setEditingNick(true); }} hitSlop={6}>
            <View style={styles.nicknameRow}>
              <Text style={styles.nickname}>{nickname}</Text>
              <HostMark hostTier={hostTier} />
            </View>
          </Pressable>
          {visibleEmail ? <Text style={styles.email}>{visibleEmail}</Text> : null}
        </View>

        {/* 관심 분야 */}
        <View style={styles.section}>
          <Text style={styles.label}>관심 분야</Text>
          <Pressable onPress={() => { haptic.tap(); setEditingInterests(true); }}>
            <View style={styles.chipsWrap}>
              {interests.map(i => (
                <View key={i.id} style={styles.chip}>
                  <CategoryIcon slug={slugById.get(i.category_id)} size={15} color={colors.brandInk} />
                  <Text style={styles.chipText}>{i.category_name}</Text>
                </View>
              ))}
              <View style={styles.chipAdd}>
                <Plus size={15} color={colors.sub} strokeWidth={2} />
              </View>
            </View>
          </Pressable>
          <Text style={styles.note}>관심 분야의 오픈 하다가 만들어지면 먼저 보여드려요.</Text>
        </View>

        {/* 나의 발자취 — 줄세우기 아닌 내 여정 자축 (3칸) */}
        <View style={styles.section}>
          <Text style={styles.label}>나의 발자취</Text>
          <View style={styles.footRow}>
            <View style={[styles.footCell, { backgroundColor: colors.tintCream }]}>
              <Text style={styles.footNum}>{footprints?.completed ?? 0}</Text>
              <Text style={styles.footLabel}>완주한 하다</Text>
            </View>
            <View style={[styles.footCell, { backgroundColor: colors.tintWarm }]}>
              <Text style={[styles.footNum, { color: colors.brandInk }]}>{footprints?.bestStreak ?? 0}</Text>
              <Text style={styles.footLabel}>최고 연속</Text>
            </View>
            <View style={[styles.footCell, { backgroundColor: colors.tintSage }]}>
              <Text style={[styles.footNum, { color: colors.doneInk }]}>{footprints?.cheersReceived ?? 0}</Text>
              <Text style={styles.footLabel}>받은 응원</Text>
            </View>
          </View>
        </View>

        {/* 내역 — 끝낸 하다 · 다짐 · 한잔 (좌측정렬 ListRow) */}
        <View style={styles.section}>
          <View style={styles.setgroup}>
            <ListRow
              icon={Archive}
              label="끝낸 하다"
              rightText={(footprints?.finished ?? 0) > 0 ? `${footprints?.finished}개` : undefined}
              onPress={() => { haptic.tap(); router.push('/(tabs)/my-challenges' as any); }}
            />
            <Divider />
            <ListRow
              icon={Flag}
              label="다짐 내역"
              onPress={() => { haptic.tap(); router.push('/pledges' as any); }}
            />
            {/* 한잔 내역 — 파일럿 전용 (Stage 4 베타 오픈 시 전체 공개) */}
            {isGiftPilotEmail(session?.user?.email) && (
              <>
                <Divider />
                <ListRow
                  icon={Coffee}
                  label="한잔 내역"
                  onPress={() => { haptic.tap(); router.push('/gifts' as any); }}
                />
              </>
            )}
          </View>
        </View>

        {/* 🚀 하루 기준선 (0077) — 인증·연속·완주를 어느 시간대의 하루로 셀지.
            해외 거주·출장 중이면 현지 자정 기준으로 바꿔야 저녁 인증이 그날로 기록된다. */}
        <View style={styles.section}>
          <Text style={styles.label}>하루 기준선</Text>
          <View style={styles.setgroup}>
            <ListRow
              icon={Clock}
              label={timezoneLabel(timezone)}
              sub={`${timezoneOffsetLabel(timezone)} · 이 시간대의 자정에 하루가 바뀌어요`}
              onPress={() => { haptic.tap(); setEditingTz(true); }}
            />
          </View>
          {deviceTz !== timezone && (
            <Pressable
              style={styles.tzHint}
              onPress={() => { haptic.tap(); setEditingTz(true); }}
              accessibilityRole="button"
            >
              <Text style={styles.tzHintText}>
                지금 계신 곳은 {timezoneLabel(deviceTz)}이에요 · 눌러서 바꾸기
              </Text>
            </Pressable>
          )}
          <Text style={styles.note}>인증·연속·완주를 이 시간대의 하루로 세요. 하루에 한 번 바꿀 수 있어요.</Text>
        </View>

        {/* 🚀 운영자 콘솔 진입점 — is_admin 일 때만. 권한 강제는 서버(RPC), 여기선 노출 게이트만 */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.setgroup}>
              <ListRow
                icon={Wrench}
                label="운영자 콘솔"
                onPress={() => { haptic.tap(); router.push('/admin' as any); }}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <NicknameEditModal
        visible={editingNick}
        current={nickname}
        userId={myUserId}
        onClose={() => setEditingNick(false)}
        onSaved={(next) => { setNickname(next); setEditingNick(false); }}
      />

      <TimezoneEditModal
        visible={editingTz}
        current={timezone}
        deviceTz={deviceTz}
        userId={myUserId}
        onClose={() => setEditingTz(false)}
        onSaved={(next) => { setTimezone(next); setEditingTz(false); }}
      />

      <InterestEditModal
        visible={editingInterests}
        userId={myUserId}
        categories={categories}
        interests={interests}
        onClose={() => setEditingInterests(false)}
        onChanged={(next) => setInterests(next)}
      />
    </Screen>
  );
}

// ─── 하루 기준선(시간대) 선택 모달 ───
// 목록에 없는 시간대(기기가 알려준 곳)도 맨 위에 함께 보여준다 — 어디에 있든 고를 수 있게.
function TimezoneEditModal({
  visible, current, deviceTz, userId, onClose, onSaved,
}: {
  visible: boolean;
  current: string;
  deviceTz: string;
  userId: string | undefined;
  onClose: () => void;
  onSaved: (tz: string) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const options = TIMEZONE_OPTIONS.some(o => o.tz === deviceTz)
    ? TIMEZONE_OPTIONS
    : [{ tz: deviceTz, label: timezoneLabel(deviceTz) }, ...TIMEZONE_OPTIONS];

  const onSelect = async (tz: string) => {
    if (!userId || saving) return;
    if (tz === current) { onClose(); return; }
    haptic.tap();
    setSaving(tz);
    try {
      await updateMyTimezone(userId, tz);
      haptic.success();
      onSaved(tz);
    } catch (e: any) {
      // 하루 1회 변경 제한·알 수 없는 시간대는 서버(0077 트리거)가 한국어 메시지로 돌려준다
      Alert.alert('바꾸지 못했어요', e?.message ?? String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={12} disabled={!!saving}><Text style={styles.modalCancel}>닫기</Text></Pressable>
          <Text style={styles.modalTitle}>하루 기준선</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.modalHint}>
            고른 시간대의 자정에 하루가 바뀌어요. 해외에 있을 땐 현지로 맞춰야 저녁 인증이 그날로 기록돼요.
          </Text>
          <View style={styles.setgroup}>
            {options.map((o, i) => (
              <View key={o.tz}>
                {i > 0 && <View style={styles.tzDivider} />}
                <Pressable
                  style={styles.tzRow}
                  onPress={() => onSelect(o.tz)}
                  disabled={!!saving}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tzRowLabel}>{o.label}</Text>
                    <Text style={styles.tzRowSub}>
                      {timezoneOffsetLabel(o.tz)}{o.tz === deviceTz ? ' · 지금 계신 곳' : ''}
                    </Text>
                  </View>
                  {saving === o.tz
                    ? <Text style={styles.tzRowSub}>바꾸는 중…</Text>
                    : o.tz === current
                      ? <Check size={18} color={colors.brand} strokeWidth={2.5} />
                      : null}
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={styles.note}>기준선은 하루에 한 번만 바꿀 수 있어요.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── 관심 분야 편집 모달 (lucide 아이콘 그리드) ───
function InterestEditModal({
  visible, userId, categories, interests, onClose, onChanged,
}: {
  visible: boolean;
  userId: string | undefined;
  categories: DbCategory[];
  interests: MyInterest[];
  onClose: () => void;
  onChanged: (next: MyInterest[]) => void;
}) {
  const [saving, setSaving] = useState<number | null>(null);
  const isSelected = (catId: number) => interests.some(i => i.category_id === catId);

  const onToggle = async (cat: DbCategory) => {
    if (!userId || saving) return;
    haptic.tap();
    setSaving(cat.id);
    try {
      if (isSelected(cat.id)) {
        const existing = interests.find(i => i.category_id === cat.id);
        if (existing) {
          await removeInterest(existing.id);
          onChanged(interests.filter(i => i.id !== existing.id));
        }
      } else {
        await addInterest(userId, cat.id);
        const fresh = await fetchMyInterests(userId);
        onChanged(fresh);
      }
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.modalTitle}>관심 분야</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalDone}>완료</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={styles.modalHint}>
            관심 분야의 오픈 하다가 만들어지면 먼저 발견할 수 있어요. 여러 개 선택 가능.
          </Text>
          <View style={styles.catGrid}>
            {categories.map(cat => {
              const selected = isSelected(cat.id);
              const busy = saving === cat.id;
              const Icon = getCategoryIcon(cat.slug);
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.catCard, selected && styles.catCardOn]}
                  onPress={() => onToggle(cat)}
                  disabled={busy}
                >
                  {selected && (
                    <View style={styles.catCheck}><Check size={12} color={colors.onBrand} strokeWidth={3} /></View>
                  )}
                  <Icon size={22} color={selected ? colors.brandInk : colors.sub} strokeWidth={1.8} />
                  <Text style={[styles.catName, selected && { color: colors.brandInk }]}>{cat.name}</Text>
                  {cat.copy ? <Text style={styles.catCopy} numberOfLines={2}>{cat.copy}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── 닉네임 편집 모달 ───
function NicknameEditModal({
  visible, current, userId, onClose, onSaved,
}: {
  visible: boolean;
  current: string;
  userId: string | undefined;
  onClose: () => void;
  onSaved: (nickname: string) => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setValue(current); }, [visible, current]);

  const onSave = async () => {
    if (!userId || saving) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateMyNickname(userId, trimmed);
      haptic.success();
      onSaved(trimmed);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}><Text style={styles.modalCancel}>취소</Text></Pressable>
            <Text style={styles.modalTitle}>닉네임</Text>
            <Pressable onPress={onSave} hitSlop={12} disabled={!value.trim() || saving || value.trim() === current}>
              <Text style={[styles.modalDone, (!value.trim() || saving || value.trim() === current) && { opacity: 0.4 }]}>
                {saving ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="동료들에게 보일 이름"
              placeholderTextColor={colors.faint}
              style={styles.nickInput}
              maxLength={20}
              autoFocus
              editable={!saving}
            />
            <Text style={styles.modalHint}>하다 방·대화·기록에 표시돼요. 최대 20자.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5, borderBottomColor: colors.line,
  },
  navTitle: { flex: 1, fontSize: 17, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // 프로필 카드
  profileCard: { alignItems: 'center', paddingVertical: 28, gap: 4 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarText: { fontSize: 34, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  nicknameRow: { flexDirection: 'row', alignItems: 'center' },
  nickname: { fontSize: fontSize['2xl'], color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  email: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },

  section: { paddingHorizontal: 20, marginTop: 24 },
  label: { ...textStyle.section, color: colors.sub, marginBottom: 10 },
  note: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 18, marginTop: 8, paddingHorizontal: 2 },

  // 관심 칩
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: colors.brandTint, borderWidth: 1, borderColor: '#FFD0B8',
  },
  chipText: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  chipAdd: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
  },

  // 발자취
  footRow: { flexDirection: 'row', gap: 10 },
  footCell: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: radius.xl },
  footNum: { fontSize: 22, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  footLabel: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 3 },

  // 내역 ListRow 그룹
  setgroup: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.line, overflow: 'hidden',
  },
  divider: { height: 0.5, backgroundColor: colors.lineSoft, marginHorizontal: 16 },

  // 모달 공통
  tzHint: { marginTop: 8, paddingHorizontal: 2 },
  tzHintText: { fontSize: fontSize.sm, color: colors.brand, fontFamily: fontFamily.medium, lineHeight: 20 },
  tzRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  tzRowLabel: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.medium },
  tzRowSub: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  tzDivider: { height: 1, backgroundColor: colors.line, marginLeft: 16 },
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.line, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: 17, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  modalCancel: { fontSize: fontSize.md, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  modalDone: { fontSize: fontSize.md, color: colors.brand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  modalHint: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 20, marginBottom: 16 },
  modalBody: { padding: 20 },
  nickInput: {
    fontSize: fontSize.xl, color: colors.ink, fontFamily: fontFamily.medium,
    borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingVertical: 10,
  },

  // 관심 분야 그리드
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: {
    width: '47%', flexGrow: 1,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.line,
    padding: 16, gap: 6, position: 'relative',
  },
  catCardOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  catCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  catName: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },
  catCopy: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 16 },
});
