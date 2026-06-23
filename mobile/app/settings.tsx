// 🚀 설정 — 햄버거(≡) 진입 (리디자인 v2)
// profile.tsx 에서 "설정" 관심사를 분리: 알림 토글 + 베타 안내 + 계정(문의·약관/버전·로그아웃) + 계정 삭제.
// 알림 토글 로직, 시간 선택 모달, 계정 삭제 모달은 여기로 이전(프로필은 내 정보/내역만).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, Switch, ScrollView,
  Modal, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft, MessageCircle, MessageSquareText, Heart, Camera, Bell, Moon,
  MessageSquareWarning, FileText, LogOut, Coins, Users, BookOpen, Coffee, HeartHandshake,
  Check, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { ListRow } from '@/components/ListRow';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors, fontFamily, fontSize, fontWeight, radius, textStyle } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import { signOut, deleteAccount } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { fetchNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/lib/push';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { isBetVisible } from '@/lib/payments';

export default function SettingsScreen() {
  const session = useSession();
  const myUserId = session?.user?.id;
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  // 로컬 알림(매일 안부) 시간
  const [reminderHour, setReminderHour] = useState(8);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // 회원 탈퇴 — 2단계 확인 모달
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('daily_reminder_time');
        if (stored) {
          const [h, m] = stored.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) { setReminderHour(h); setReminderMinute(m); }
        }
      } catch (e) {
        console.warn('[SettingsScreen] 알림 시간 복원 실패', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!myUserId || myUserId === 'dev') return;
    fetchNotificationPrefs(myUserId).then(setPrefs).catch(() => {});
  }, [myUserId]);

  const togglePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    if (!myUserId || !prefs) return;
    haptic.tap();
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await updateNotificationPrefs(myUserId, { [key]: value });
      // daily 토글은 로컬 알림 schedule/cancel 도 동기화
      if (key === 'daily_enabled') {
        await SecureStore.setItemAsync('daily_enabled', value ? 'true' : 'false');
        if (value) {
          const stored = await SecureStore.getItemAsync('daily_reminder_time');
          let h = 8; let m = 0;
          if (stored) {
            const [sh, sm] = stored.split(':').map(Number);
            if (!isNaN(sh) && !isNaN(sm)) { h = sh; m = sm; }
          }
          await scheduleDailyReminder(h, m);
        } else {
          await cancelDailyReminder();
        }
      }
    } catch (e: any) {
      setPrefs(prefs);   // 롤백
      Alert.alert('설정 실패', e?.message ?? String(e));
    }
  }, [myUserId, prefs]);

  // 운영팀 문의 (UGC 연락수단)
  const onContact = () => {
    haptic.tap();
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Do:하다] 문의·신고')}`)
      .catch(() => Alert.alert('문의', `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL} 로 보내주세요.`));
  };

  // 약관·버전 — 외부 약관 페이지가 아직 없어 버전/OTA 정보를 안내 (베타 테스터 소통용)
  const onTermsVersion = () => {
    haptic.tap();
    const ota = Updates.updateId
      ? `업데이트 ${Updates.updateId.slice(0, 8)} · ${formatUpdateTime(Updates.createdAt)} 적용`
      : '업데이트: 빌드 내장 버전';
    Alert.alert('약관·버전 정보', `Do : 하다 v${appVersion}\n${ota}\n\n약관은 가입 시 동의 화면에서 확인할 수 있어요.`);
  };

  const onLogout = () => {
    Alert.alert('로그아웃', '다음에 또 만나요. 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <Screen backgroundColor={colors.bg}>
      {/* 상세 헤더: 뒤로가기 + 타이틀 */}
      <View style={styles.nav}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} accessibilityLabel="뒤로">
          <ArrowLeft size={23} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.navTitle}>설정</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── 알림 ── */}
        {prefs && (
          <View style={styles.section}>
            <Text style={styles.label}>알림</Text>
            <View style={styles.setgroup}>
              <ToggleRow icon={MessageCircle} label="채팅" sub="하다 방 새 메시지 (즉시)"
                value={prefs.chat_enabled} onChange={(v) => togglePref('chat_enabled', v)} />
              <Divider />
              <ToggleRow icon={MessageSquareText} label="댓글" sub="내 인증·기록의 댓글 (즉시)"
                value={prefs.comment_enabled} onChange={(v) => togglePref('comment_enabled', v)} />
              <Divider />
              <ToggleRow icon={Heart} label="응원·좋아요" sub="1시간마다 묶어서 1건"
                value={prefs.cheer_batch_enabled} onChange={(v) => togglePref('cheer_batch_enabled', v)} />
              <Divider />
              <ToggleRow icon={Camera} label="동료 인증·기록" sub="동료가 인증/기록을 올렸을 때 (즉시)"
                value={prefs.proof_log_enabled} onChange={(v) => togglePref('proof_log_enabled', v)} />
              <Divider />
              <ToggleRow icon={Bell} label="매일 안부" sub="지정한 시간에 하루 1회 로컬 알림"
                value={prefs.daily_enabled} onChange={(v) => togglePref('daily_enabled', v)}>
                {prefs.daily_enabled && (
                  <Pressable style={styles.timeBtn} onPress={() => { haptic.tap(); setTimePickerOpen(true); }}>
                    <Text style={styles.timeBtnText}>{formatReminderTime(reminderHour, reminderMinute)}</Text>
                  </Pressable>
                )}
              </ToggleRow>
            </View>
            <View style={styles.note}>
              <Moon size={14} color={colors.faint} strokeWidth={1.8} />
              <Text style={styles.noteText}>
                밤 10시~아침 6시는 조용해요. 응원·좋아요는 하루 최대 20건.
              </Text>
            </View>
          </View>
        )}

        {/* ── 베타 안내 (로드맵) ── */}
        <View style={styles.section}>
          <Text style={styles.label}>베타 안내</Text>
          <View style={styles.setgroup}>
            {isBetVisible() && (
              <>
                <RoadmapRow icon={Coins} title="내기 한잔 — 개발 완료"
                  desc="완주하면 본전, 실패하면 기부 — 가상 교환권으로 개발 완료. 법률 자문 후 오픈, 실제 결제는 정식 출시 후예요." />
                <Divider />
              </>
            )}
            <RoadmapRow icon={Coffee} title="응원 한잔 — 베타 체험 중"
              desc="동료의 인증에 '한잔'으로 응원해요. 베타는 가상 교환권(모의 결제), 정식 출시 때 실물 기프티콘으로 열려요." />
            <Divider />
            <RoadmapRow icon={Users} title="하다 인연 ×횟수 누적"
              desc="함께 한 동료와의 누적 횟수가 기록되고, 명함·연락처 매칭이 추가돼요." />
            <Divider />
            <RoadmapRow icon={BookOpen} title="완주 박제 자산화 (실물 인쇄)"
              desc="완주한 나의 하다 이야기를 책으로 영구 소장할 수 있게 돼요." />
            <Divider />
            <RoadmapRow icon={HeartHandshake} title="함께 만든 변화 — 기부 허브"
              desc="받은 응원을 기부로 돌리기 — 내 한 잔이 누군가의 한 잔이 돼요." />
          </View>
        </View>

        {/* ── 계정 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>계정</Text>
          <View style={styles.setgroup}>
            <ListRow icon={MessageSquareWarning} label="문의·신고 (운영팀)" onPress={onContact} />
            <Divider />
            <ListRow icon={FileText} label="약관·버전 정보" rightText={`v${appVersion}`} onPress={onTermsVersion} />
            <Divider />
            <ListRow icon={LogOut} label="로그아웃" onPress={onLogout} />
          </View>
        </View>

        {/* 계정 삭제 — 구글·애플 의무 진입점. 눈에 띄지 않게(빨강) → 2단계 확인 모달 */}
        <Pressable
          style={styles.danger}
          onPress={() => { haptic.tap(); setDeleteModalOpen(true); }}
          hitSlop={8}
        >
          <Text style={styles.dangerText}>계정 삭제</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.version}>Do : 하다 v{appVersion}</Text>
          <Text style={styles.tagline}>같이 하는 사람의 응원이 진짜 힘이에요</Text>
        </View>
      </ScrollView>

      <TimePickerModal
        visible={timePickerOpen}
        currentHour={reminderHour}
        currentMinute={reminderMinute}
        onClose={() => setTimePickerOpen(false)}
        onSaved={async (h, m) => {
          try {
            await SecureStore.setItemAsync('daily_reminder_time', `${h}:${m}`);
            setReminderHour(h); setReminderMinute(m);
            await scheduleDailyReminder(h, m);
            haptic.success();
          } catch (e: any) {
            Alert.alert('알림 설정 실패', e?.message ?? String(e));
          } finally {
            setTimePickerOpen(false);
          }
        }}
      />

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => { setDeleteModalOpen(false); router.replace('/login'); }}
      />
    </Screen>
  );
}

// ─── 알림 토글 행 (lucide 아이콘 + 라벨 + 보조 + Switch) ───
function ToggleRow({
  icon: Icon, label, sub, value, onChange, children,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.toggleRow}>
      <Icon size={19} color={colors.sub} strokeWidth={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {children}
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.line, true: colors.brand }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );
}

// ─── 베타 안내(로드맵) 행 ───
function RoadmapRow({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <View style={styles.roadmapRow}>
      <Icon size={19} color={colors.brandInk} strokeWidth={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={styles.roadmapTitle}>{title}</Text>
        <Text style={styles.roadmapDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function formatReminderTime(h: number, m: number): string {
  const ampm = h >= 12 ? '오후' : '오전';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMin = String(m).padStart(2, '0');
  return `${ampm} ${String(displayHour).padStart(2, '0')}:${displayMin}`;
}

function formatUpdateTime(d: Date | null): string {
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── 시간 선택 모달 ───
function TimePickerModal({
  visible, currentHour, currentMinute, onClose, onSaved,
}: {
  visible: boolean;
  currentHour: number;
  currentMinute: number;
  onClose: () => void;
  onSaved: (hour: number, minute: number) => void;
}) {
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(currentHour >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(currentHour % 12 === 0 ? 12 : currentHour % 12);
  const [minute, setMinute] = useState(currentMinute);

  useEffect(() => {
    if (visible) {
      setAmpm(currentHour >= 12 ? 'PM' : 'AM');
      setHour(currentHour % 12 === 0 ? 12 : currentHour % 12);
      setMinute(currentMinute);
    }
  }, [visible, currentHour, currentMinute]);

  const handleSave = () => {
    let finalHour = hour % 12;
    if (ampm === 'PM') finalHour += 12;
    onSaved(finalHour, minute);
  };

  const adjustHour = (delta: number) => {
    haptic.tap();
    setHour(prev => { const next = prev + delta; if (next > 12) return 1; if (next < 1) return 12; return next; });
  };
  const adjustMinute = (delta: number) => {
    haptic.tap();
    setMinute(prev => { const next = prev + delta; if (next >= 60) return 0; if (next < 0) return 50; return next; });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.pickerTitle}>알림 시간 설정</Text>
          <View style={styles.pickerRow}>
            <View style={styles.column}>
              <Pressable style={[styles.pickerBtn, ampm === 'AM' && styles.pickerBtnActive]}
                onPress={() => { haptic.tap(); setAmpm('AM'); }}>
                <Text style={[styles.pickerBtnText, ampm === 'AM' && styles.pickerBtnTextActive]}>오전</Text>
              </Pressable>
              <Pressable style={[styles.pickerBtn, ampm === 'PM' && styles.pickerBtnActive]}
                onPress={() => { haptic.tap(); setAmpm('PM'); }}>
                <Text style={[styles.pickerBtnText, ampm === 'PM' && styles.pickerBtnTextActive]}>오후</Text>
              </Pressable>
            </View>
            <View style={styles.spinnerColumn}>
              <Pressable style={styles.arrowBtn} onPress={() => adjustHour(1)}><Text style={styles.arrowText}>▲</Text></Pressable>
              <View style={styles.valueWrap}>
                <Text style={styles.valueText}>{String(hour).padStart(2, '0')}</Text>
                <Text style={styles.valueUnit}>시</Text>
              </View>
              <Pressable style={styles.arrowBtn} onPress={() => adjustHour(-1)}><Text style={styles.arrowText}>▼</Text></Pressable>
            </View>
            <View style={styles.spinnerColumn}>
              <Pressable style={styles.arrowBtn} onPress={() => adjustMinute(10)}><Text style={styles.arrowText}>▲</Text></Pressable>
              <View style={styles.valueWrap}>
                <Text style={styles.valueText}>{String(minute).padStart(2, '0')}</Text>
                <Text style={styles.valueUnit}>분</Text>
              </View>
              <Pressable style={styles.arrowBtn} onPress={() => adjustMinute(-10)}><Text style={styles.arrowText}>▼</Text></Pressable>
            </View>
          </View>
          <View style={styles.pickerActions}>
            <Pressable style={styles.pickerCancelBtn} onPress={onClose}><Text style={styles.pickerCancelText}>취소</Text></Pressable>
            <Pressable style={styles.pickerSaveBtn} onPress={handleSave}><Text style={styles.pickerSaveText}>설정 완료</Text></Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── 회원 탈퇴(계정 삭제) 모달 — 2단계 확인 ───
function DeleteAccountModal({
  visible, onClose, onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (visible) { setChecked(false); setDeleting(false); } }, [visible]);

  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      haptic.success();
      onDeleted();
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('탈퇴 실패', '잠시 후 다시 시도해주세요.\n계속되면 운영팀에 문의해주세요.');
    }
  };

  const onConfirm = () => {
    if (!checked || deleting) return;
    haptic.warning();
    Alert.alert('마지막 확인', '계정을 삭제하면 되돌릴 수 없어요.\n정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '계정 삭제', style: 'destructive', onPress: runDelete },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.modalTitle}>계정 삭제</Text>
          <Pressable onPress={onClose} hitSlop={12} disabled={deleting}>
            <Text style={styles.modalCancel}>취소</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={styles.delLead}>계정을 삭제하면 아래 내용이 적용돼요.</Text>
          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>삭제되는 정보</Text>
            <Text style={styles.delBullet}>• 프로필(닉네임·사진·이메일)</Text>
            <Text style={styles.delBullet}>• 본인인증 정보·알림 설정·관심 분야·알림함</Text>
          </View>
          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>남는 것 (동료의 박제 보호)</Text>
            <Text style={styles.delBullet}>
              • 내가 올린 인증·기록·댓글·대화·완주 이야기는 동료의 기록을 지키기 위해 "탈퇴한 사람"으로 익명 처리되어 남아요.
            </Text>
          </View>
          <View style={styles.delSection}>
            <Text style={styles.delSectionTitle}>그 밖에</Text>
            <Text style={styles.delBullet}>• 진행 중인 도전과 응원은 모두 종료돼요.</Text>
            <Text style={styles.delBullet}>• 삭제는 즉시 처리되며 되돌릴 수 없어요.</Text>
            <Text style={styles.delBullet}>
              • 지금 로그인한 계정으로는 다시 가입할 수 없어요. 다른 계정으로는 새로 시작할 수 있어요.
            </Text>
          </View>
          <Pressable style={styles.delCheckRow} onPress={() => { haptic.tap(); setChecked(v => !v); }} disabled={deleting}>
            <View style={[styles.delCheckbox, checked && styles.delCheckboxOn]}>
              {checked && <Check size={14} color={colors.onBrand} strokeWidth={3} />}
            </View>
            <Text style={styles.delCheckLabel}>위 내용을 모두 확인했어요</Text>
          </Pressable>
          <Pressable style={[styles.delButton, (!checked || deleting) && styles.delButtonDisabled]}
            onPress={onConfirm} disabled={!checked || deleting}>
            <Text style={styles.delButtonText}>{deleting ? '삭제 중…' : '계정 삭제하기'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5, borderBottomColor: colors.line,
  },
  navTitle: { fontSize: 17, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  section: { paddingHorizontal: 20, marginTop: 24 },
  label: {
    ...textStyle.section, color: colors.sub, marginBottom: 10,
  },
  setgroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.line,
    overflow: 'hidden',
  },
  divider: { height: 0.5, backgroundColor: colors.lineSoft, marginHorizontal: 16 },

  // 토글 행
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  toggleLabel: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  toggleSub: { fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },
  timeBtn: { backgroundColor: colors.brandTint, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  timeBtnText: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4, marginTop: 10 },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.faint, fontFamily: fontFamily.regular, lineHeight: 18 },

  // 베타 안내
  roadmapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  roadmapTitle: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold },
  roadmapDesc: { fontSize: fontSize.xs, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 18, marginTop: 4 },

  // 계정 삭제
  danger: { alignItems: 'center', paddingVertical: 16, marginTop: 20 },
  dangerText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },

  footer: { alignItems: 'center', marginTop: 8, gap: 3 },
  version: { fontSize: fontSize.sm, color: colors.faint2, fontFamily: fontFamily.regular },
  tagline: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular, marginTop: 2 },

  // ── 시간 선택 모달 ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pickerCard: { width: '100%', maxWidth: 320, backgroundColor: colors.surface, borderRadius: radius['2xl'], padding: 24 },
  pickerTitle: { fontSize: fontSize.lg, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: 20 },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  column: { gap: 8 },
  pickerBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.lineSoft },
  pickerBtnActive: { backgroundColor: colors.brand },
  pickerBtnText: { fontSize: fontSize.base, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  pickerBtnTextActive: { color: colors.onBrand },
  spinnerColumn: { alignItems: 'center', gap: 8 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 18, color: colors.brand },
  valueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  valueText: { fontSize: 32, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  valueUnit: { fontSize: fontSize.sm, color: colors.faint, fontFamily: fontFamily.regular },
  pickerActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  pickerCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.lineSoft, alignItems: 'center' },
  pickerCancelText: { fontSize: fontSize.md, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  pickerSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center' },
  pickerSaveText: { fontSize: fontSize.md, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },

  // ── 계정 삭제 모달 ──
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.line, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: 17, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
  modalCancel: { fontSize: fontSize.md, color: colors.sub, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  delLead: { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold, marginBottom: 16 },
  delSection: { marginBottom: 18 },
  delSectionTitle: { fontSize: fontSize.sm, color: colors.brandInk, fontFamily: fontFamily.bold, fontWeight: fontWeight.semibold, marginBottom: 6 },
  delBullet: { fontSize: fontSize.base, color: colors.sub, fontFamily: fontFamily.regular, lineHeight: 21, marginTop: 2 },
  delCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 4 },
  delCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  delCheckboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  delCheckLabel: { fontSize: fontSize.base, color: colors.ink, fontFamily: fontFamily.medium, fontWeight: fontWeight.medium },
  delButton: { backgroundColor: colors.danger, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  delButtonDisabled: { opacity: 0.4 },
  delButtonText: { fontSize: fontSize.md, color: colors.onBrand, fontFamily: fontFamily.bold, fontWeight: fontWeight.bold },
});
