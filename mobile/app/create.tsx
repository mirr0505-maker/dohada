// 🚀 챌린지 만들기 — 5단계 마법사 (7→5 압축: 죽은 단계 제거, 결정 1개 = 화면 1개 유지)
// 1: 제목  2: 카테고리  3: 방 타입  4: 기간+빈도  5: 인증 방식 (+ 내기 Phase 2 한 줄 티저)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Timer, Zap, Sprout, Leaf, TreeDeciduous, Mountain, Star,
  Flame, CalendarDays, Calendar, Repeat, Target,
  Camera, Image as ImageIcon, MapPin,
  Heart, User, Handshake, Globe, Check, X, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { CategoryIcon } from '@/components/CategoryIcon';
import { colors, fontFamily, fontSize, fontWeight, radius } from '@/lib/tokens';
import { useSession } from '@/lib/session';
import {
  createChallenge, fetchCategoryTree, referenceChallenge,
  type CreateChallengeFrequency, type CreateChallengeProofType,
  type DbCategory, type DbSubcategory,
} from '@/lib/db';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadProofImage } from '@/lib/upload';
import {
  isBetVisible, BET_TIERS, BET_DONATION_MODES, type BetTier, type BetDonationMode,
} from '@/lib/payments';
import type { ChallengeKind } from '@/lib/types';

const TOTAL_STEPS = 5;

const SUGGESTIONS = [
  '📚 100일 책 읽기',
  '🏃 매일 5km 러닝',
  '🚭 100일 금연',
  '💪 매일 푸쉬업 50개',
  '🧘 매일 명상 10분',
  '💰 30일 무지출',
];

const DURATIONS = [
  { label: '1일',  desc: '당일 하루 마무리',       Icon: Timer, days: 1 },
  { label: '3일',  desc: '초단기 작심삼일 깨기', Icon: Zap, days: 3 },
  { label: '7일',  desc: '맛보기',           Icon: Sprout, days: 7 },
  { label: '30일', desc: '습관 형성',         Icon: Leaf, days: 30 },
  { label: '100일', desc: '박제 가치 최고', Icon: TreeDeciduous, days: 100, recommended: true },
  { label: '180일', desc: '반년의 지속',       Icon: Mountain, days: 180 },
  { label: '1년',  desc: '인생 변환점',       Icon: Star, days: 365 },
] as const;

const FREQUENCIES: { value: CreateChallengeFrequency; label: string; desc: string; Icon: LucideIcon }[] = [
  { value: 'daily',   label: '매일',         desc: '하루도 빠지지 않고', Icon: Flame },
  { value: 'weekly3', label: '주 3회 이상',  desc: '유연하게',           Icon: CalendarDays },
  { value: 'weekly1', label: '주 1회',       desc: '긴 호흡으로',        Icon: Calendar },
];

const PROOF_TYPES = [
  { value: 'photo',      label: '사진 인증',     desc: '카메라로 직접 촬영',             Icon: Camera, enabled: true },
  { value: 'screenshot', label: '앱 스크린샷',   desc: '운동·걷기 앱 기록 화면 (보관함)', Icon: ImageIcon, enabled: true },
  { value: 'gps',        label: 'GPS 위치 인증', desc: 'Phase 2 출시 예정',               Icon: MapPin, enabled: false },
];

// 🚀 cheered(응원받기) 최상단 + 추천 — "선언하면 지인이 응원" 을 첫 생성자의 기본 시나리오로.
//    solo("혼자만의 다짐")는 한 칸 아래로 그대로 유지 (제거 금지).
const ROOM_TYPES: { value: ChallengeKind; label: string; desc: string; Icon: LucideIcon; recommended?: boolean }[] = [
  { value: 'cheered', label: '응원받기',       desc: '나 혼자 하다, 지인들이 응원해줘요',   Icon: Heart, recommended: true },
  { value: 'solo',    label: '혼자만의 다짐',  desc: '나만 보는 조용한 기록',              Icon: User },
  { value: 'closed',  label: '함께 하기',      desc: '초대한 사람들이 같이 하다',            Icon: Handshake },
  { value: 'open',    label: '누구나 합류',    desc: '둘러보기 공개 · 아무나 참여',          Icon: Globe },
];

export default function CreateChallenge() {
  const session = useSession();
  const [step, setStep] = useState(1);
  // 🚀 프리필 — ① 포기한 방 "다시 시작하기"(?title=) ② 하다 구경 "따라하기"(?ref= + 제목·분류·기간유형·빈도·내용)
  const {
    title: titleParam, kind: kindParam, ref: refParam,
    categoryId: categoryIdParam, goalType: goalTypeParam,
    frequency: frequencyParam, targetCount: targetCountParam, desc: descParam,
  } = useLocalSearchParams<{
    title?: string; kind?: string; ref?: string; categoryId?: string;
    goalType?: string; frequency?: string; targetCount?: string; desc?: string;
  }>();
  // 숫자 파라미터 안전 파싱 (NaN 방지)
  const parseIntParam = (v?: string): number | null => {
    if (typeof v !== 'string' || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // 폼 state
  const [title, setTitle] = useState(typeof titleParam === 'string' ? titleParam : '');
  const [categoryId, setCategoryId] = useState<number | null>(parseIntParam(categoryIdParam));
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState<number>(100);   // 기본 100일 (v4 추천)
  const [frequency, setFrequency] = useState<CreateChallengeFrequency>(
    frequencyParam === 'daily' || frequencyParam === 'weekly3' || frequencyParam === 'weekly1'
      ? frequencyParam
      : 'daily',
  );
  const [proofType, setProofType] = useState<CreateChallengeProofType>('photo');   // v2.2
  // 🚀 기본 방타입 = cheered(응원받기). 홈 온램프·빈상태 '선언하기'가 ?kind= 로 넘긴 값이 있으면 그 값 우선.
  const [kind, setKind] = useState<ChallengeKind>(
    kindParam === 'solo' || kindParam === 'cheered' || kindParam === 'closed' || kindParam === 'open'
      ? kindParam
      : 'cheered',
  );
  const [startDate, setStartDate] = useState<string>(toLocalDateStr(new Date())); // 🚀 당일 챌린지용 시작일 (로컬 기준 — 타임존 밀림 방지)
  // 🚀 안내문 (나홀로 제외) — 합류 전 미리보기·방 현황에 노출. 텍스트 + 보관함 이미지(선택)
  const [description, setDescription] = useState(typeof descParam === 'string' ? descParam : '');
  const [introImageUri, setIntroImageUri] = useState<string | null>(null);
  // 🚀 다인 내기 (다함께·누구나, 파일럿) — 개설 시 티어+모드 고정. null = 내기 없음
  const [betTier, setBetTier] = useState<BetTier | null>(null);
  const [betDonationMode, setBetDonationMode] = useState<BetDonationMode>('commitment');
  const betVisible = isBetVisible();   // 🎯 내기 노출 게이트 (출시 후 BET_ENABLED, 현재 dev 전용)
  // 🚀 0041: 목표 유형 — cadence(주기형: 매일/주N회) / count(목표 횟수형: 기간 내 N개)
  const [goalType, setGoalType] = useState<'cadence' | 'count'>(goalTypeParam === 'count' ? 'count' : 'cadence');
  const [targetCount, setTargetCount] = useState<number>(
    (parseIntParam(targetCountParam) ?? 0) >= 1 ? parseIntParam(targetCountParam)! : 10,
  );
  // bet 은 'none' 고정.

  const [submitting, setSubmitting] = useState(false);

  // 🚀 1일 도전일 경우 방 타입을 자동으로 'together (closed)' 로 보정
  useEffect(() => {
    if (durationDays === 1 && (kind === 'solo' || kind === 'cheered')) {
      setKind('closed');
    }
  }, [durationDays, kind]);

  // 카테고리 트리 (1회 fetch + 캐시)
  const [tree, setTree] = useState<{ categories: DbCategory[]; subcategories: DbSubcategory[] } | null>(null);
  useEffect(() => {
    fetchCategoryTree().then(setTree).catch(() => setTree({ categories: [], subcategories: [] }));
  }, []);

  const canGoNext = useMemo(() => {
    if (submitting) return false;
    if (step === 1) return title.trim().length >= 2;
    if (step === 2) return categoryId != null;
    if (step === 3) return Boolean(kind);                              // 방 타입
    if (step === 4) return goalType === 'count'
      ? durationDays > 0 && targetCount >= 1                           // 목표 횟수형: 기간 + 목표 개수
      : durationDays > 0 && Boolean(frequency);                        // 주기형: 기간 + 빈도
    if (step === 5) return true;                                       // 인증 방식 (기본 photo)
    return false;
  }, [step, title, categoryId, durationDays, frequency, goalType, targetCount, kind, submitting]);

  const onPrev = () => {
    haptic.tap();
    if (step === 1) router.back();
    else setStep(s => Math.max(1, s - 1));
  };

  const onNext = async () => {
    if (!canGoNext) return;
    if (step < TOTAL_STEPS) {
      haptic.tap();
      setStep(s => s + 1);
      return;
    }
    // 마지막 → 만들기 실행
    await submit();
  };

  const submit = useCallback(async () => {
    if (!session?.user) {
      Alert.alert('로그인 필요', '먼저 로그인해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      // 안내문은 나홀로 방엔 없음 (수신자가 없으므로) — 저장 전에 정리
      const introText = kind === 'solo' ? '' : description.trim();
      const introUri = kind === 'solo' ? null : introImageUri;

      // 1) AI 검수 (기존) — 제목 + 안내문 텍스트 함께 검수 (검수 우회 분기 없음)
      const { data: mod, error: modErr } = await supabase.functions.invoke<{
        verdict: 'allow' | 'block'; reason: string | null; category: string | null;
      }>('moderate-challenge', { body: { title, description: introText } });
      if (modErr) throw modErr;
      if (!mod || mod.verdict === 'block') {
        haptic.warning();
        Alert.alert('하다 생성이 차단됐어요', mod?.reason ?? '부적절한 내용이 포함되어 있어요.');
        return;
      }

      // 1.5) 안내문 이미지 업로드 (있으면) — R2 URL 로 변환
      const introImageUrl = introUri ? await uploadProofImage(introUri, 'jpg') : null;

      // 2) DB insert (RPC)
      const challenge = await createChallenge({
        userId: session.user.id,
        proofType,
        title,
        description: introText,
        kind,
        durationDays,
        categoryId,
        subcategoryId,
        frequency,
        goalType,                                            // 🚀 0041: 목표 유형
        targetCount: goalType === 'count' ? targetCount : null,
        startDate, // 🚀 신규 추가
        introImageUrl, // 🚀 0037: 안내문 이미지
        // 🚀 0040: 다인 내기 — 다함께·누구나에서만. 서버도 kind 로 한 번 더 강제
        betTier: (kind === 'closed' || kind === 'open') ? betTier : null,
        betDonationMode,
      });
      // 🚀 하다 구경 "따라하기"로 만든 하다면 원본에 참조 1회 기록 (멱등 — 실패해도 생성 흐름엔 영향 없음)
      if (typeof refParam === 'string' && refParam) {
        try { await referenceChallenge(refParam); } catch { /* 참조수는 부가 표시 — 무시 */ }
      }
      haptic.success();
      // 응원자를 초대해야 의미 있는 방 = closed (함께 도전) + cheered (응원받기)
      const needsInvitation = kind === 'closed' || kind === 'cheered';
      const path = needsInvitation
        ? `/room/${challenge.id}?fromCreate=1`
        : `/room/${challenge.id}`;
      router.replace(path as any);
    } catch (e: any) {
      Alert.alert('만들기 실패', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }, [session, title, kind, durationDays, categoryId, subcategoryId, frequency, goalType, targetCount, proofType, startDate, description, introImageUri]);

  const stepMeta = STEP_META[step];

  return (
    <Screen backgroundColor={colors.bg}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={22} color={colors.sub} strokeWidth={2} />
        </Pressable>
        <Text style={styles.counter}>{step} / {TOTAL_STEPS}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* step dot bar */}
      <View style={styles.dotBar}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 < step  && styles.dotDone,
              i + 1 === step && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.stepLabel}>{stepMeta.label}</Text>
          <Text style={styles.question}>{stepMeta.question}</Text>
          <Text style={styles.hint}>{stepMeta.hint}</Text>

          {/* 단계별 body */}
          {step === 1 && (
            <Step1Title title={title} setTitle={setTitle} />
          )}
          {step === 2 && (
            <Step2Category
              tree={tree}
              categoryId={categoryId}
              setCategoryId={(id) => { setCategoryId(id); setSubcategoryId(null); }}
              subcategoryId={subcategoryId}
              setSubcategoryId={setSubcategoryId}
            />
          )}
          {step === 3 && (
            <View style={{ gap: 12 }}>
              <Step6RoomType value={kind} setValue={setKind} durationDays={durationDays} />
              {/* 🚀 안내문 — 나홀로 제외. 합류 전 미리보기·방 현황에 보임 (선택 입력) */}
              {kind !== 'solo' && (
                <IntroEditor
                  description={description}
                  setDescription={setDescription}
                  imageUri={introImageUri}
                  setImageUri={setIntroImageUri}
                  disabled={submitting}
                />
              )}
            </View>
          )}
          {step === 4 && (
            <View style={{ gap: 12 }}>
              <Step3Duration value={durationDays} setValue={setDurationDays} kind={kind} />
              {/* 🚀 0041: 목표 유형 — 주기형(매일/주N회) vs 목표 횟수형(기간 내 N개 달성) */}
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>어떻게 달성할까요?</Text>
              <GoalTypeToggle value={goalType} setValue={setGoalType} />
              {goalType === 'cadence' ? (
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>얼마나 자주 인증할까요?</Text>
              ) : (
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>기간 내 몇 개를 달성할까요?</Text>
              )}
              <Step4Frequency
                value={frequency}
                setValue={setFrequency}
                durationDays={durationDays}
                kind={kind}
                startDate={startDate}
                setStartDate={setStartDate}
                goalType={goalType}
                targetCount={targetCount}
                setTargetCount={setTargetCount}
              />
            </View>
          )}
          {step === 5 && (
            <View style={{ gap: 12 }}>
              <Step5ProofType value={proofType} setValue={setProofType} />
              {/* 🚀 다인 내기 — 다함께·누구나 + 파일럿만 (베타는 mock·실돈 0원) */}
              {betVisible && (kind === 'closed' || kind === 'open') && goalType !== 'count' ? (
                <BetConfig
                  betTier={betTier} setBetTier={setBetTier}
                  betDonationMode={betDonationMode} setBetDonationMode={setBetDonationMode}
                />
              ) : goalType === 'count' ? (
                <Text style={styles.smallNote}>
                  목표 횟수형은 응원 한잔으로 함께할 수 있어요.
                </Text>
              ) : (
                <Text style={styles.smallNote}>
                  응원 한잔으로 서로의 하다를 응원할 수 있어요.
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.bottomBar}>
          <Pressable
            style={styles.prevBtn}
            onPress={onPrev}
            disabled={submitting}
          >
            <Text style={styles.prevText}>{step === 1 ? '취소' : '← 이전'}</Text>
          </Pressable>
          <Pressable
            style={[styles.nextBtn, !canGoNext && styles.nextBtnDisabled]}
            onPress={onNext}
            disabled={!canGoNext}
          >
            {submitting ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.nextText}>
                {step === TOTAL_STEPS ? '만들기' : '다음 →'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── 각 step 메타 ───
const STEP_META: Record<number, { label: string; question: string; hint: string }> = {
  1: { label: 'CHALLENGE TITLE',      question: '어떤 하다를\n해보고 싶어요?',       hint: '짧고 명확한 문장이 좋아요.' },
  2: { label: 'CATEGORY',             question: '어떤 분야의\n하다인가요?',         hint: '대분류를 먼저 고르면 세부 분야가 나타나요.' },
  3: { label: 'ROOM TYPE',            question: '누구와 함께\n할까요?',             hint: '방 타입에 따라 둘러보기 노출이 달라져요.' },
  4: { label: 'DURATION & FREQUENCY', question: '얼마 동안, 얼마나 자주\n할까요?',   hint: '길수록 박제 가치가 커지고, 빈도가 강도를 결정해요.' },
  5: { label: 'PROOF TYPE',           question: '어떻게\n인증할까요?',              hint: '사진 인증과 앱 스크린샷 둘 다 가능해요.' },
};

// ─── Step 1: 제목 ───
function Step1Title({ title, setTitle }: { title: string; setTitle: (s: string) => void }) {
  return (
    <View style={{ gap: 16 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="예: 100일 금연 하다"
        placeholderTextColor={colors.primary300}
        style={styles.bigInput}
        maxLength={40}
        returnKeyType="next"
        autoFocus
      />
      <Text style={styles.counterSmall}>{title.length} / 40</Text>

      <Text style={styles.subSectionTitle}>인기 하다에서 골라보기</Text>
      <View style={styles.chipWrap}>
        {SUGGESTIONS.map(s => (
          <Pressable key={s} style={styles.chip} onPress={() => setTitle(s)}>
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step 2: 카테고리 (10 + 소분류) ───
function Step2Category({
  tree, categoryId, setCategoryId, subcategoryId, setSubcategoryId,
}: {
  tree: { categories: DbCategory[]; subcategories: DbSubcategory[] } | null;
  categoryId: number | null;
  setCategoryId: (id: number) => void;
  subcategoryId: number | null;
  setSubcategoryId: (id: number | null) => void;
}) {
  if (!tree) {
    return <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />;
  }
  const selected = tree.categories.find(c => c.id === categoryId) ?? null;
  const subs = selected
    ? tree.subcategories.filter(s => s.category_id === selected.id)
    : [];

  if (selected) {
    return (
      <View style={{ gap: 12 }}>
        <Pressable style={styles.subBackBtn} onPress={() => setCategoryId(0)}>
          <Text style={styles.subBackText}>← 다시 선택</Text>
        </Pressable>
        <View style={[styles.catItem, styles.catItemActive, { alignSelf: 'flex-start' }]}>
          <CategoryIcon slug={selected.slug} size={21} color={colors.brandInk} />
          <Text style={[styles.catName, { color: colors.brandInk }]}>{selected.name}</Text>
        </View>
        <Text style={styles.subSectionTitle}>세부 분야 (선택)</Text>
        <View style={styles.subWrap}>
          {subs.map(s => {
            const active = subcategoryId === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.subChip, active && styles.subChipActive]}
                onPress={() => setSubcategoryId(active ? null : s.id)}
              >
                <Text style={[styles.subChipText, active && styles.subChipTextActive]}>{s.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.catGrid}>
      {tree.categories.map(c => {
        const active = categoryId === c.id;
        return (
          <Pressable
            key={c.id}
            style={[styles.catItem, active && styles.catItemActive]}
            onPress={() => { setCategoryId(c.id); }}
          >
            <CategoryIcon slug={c.slug} size={21} color={active ? colors.brandInk : colors.sub} />
            <Text style={[styles.catName, active && { color: colors.brandInk }]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 3: 기간 ───
function Step3Duration({
  value, setValue, kind,
}: {
  value: number;
  setValue: (n: number) => void;
  kind: ChallengeKind;
}) {
  return (
    <View style={{ gap: 12 }}>
      {DURATIONS.map(d => {
        const active = value === d.days;
        const isDisabled = d.days === 1 && (kind === 'solo' || kind === 'cheered');
        return (
          <Pressable
            key={d.days}
            disabled={isDisabled}
            style={[
              styles.option,
              active && styles.optionActive,
              isDisabled && styles.optionDisabled,
            ]}
            onPress={() => {
              if (isDisabled) return;
              setValue(d.days);
            }}
          >
            <d.Icon size={24} color={active ? colors.brandInk : isDisabled ? colors.faint2 : colors.sub} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[
                  styles.optionTitle,
                  active && styles.optionTitleActive,
                  isDisabled && { color: colors.primary300 }
                ]}>
                  {d.label}
                </Text>
                {isDisabled && (
                  <Text style={{ fontSize: 11, color: colors.primary500, fontFamily: fontFamily.medium }}>
                    (개인 방 선택 불가)
                  </Text>
                )}
              </View>
              <Text style={styles.optionDesc}>
                {isDisabled ? '1일 하다는 다같이 하다/누구나 합류 방에서만 가능해요.' : d.desc}
              </Text>
            </View>
            {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// 🚀 로컬(기기 시간) 기준 YYYY-MM-DD — toISOString().slice(0,10) 는 UTC 라
// KST 자정~오전 9시 사이에 날짜가 하루 밀린다(오늘이 어제로). 달력·칩은 사용자가 보는
// 로컬 날짜로 만들어야 "오늘" 선택이 정상 동작한다. (완주 판정 등 서버 경계는 별도로 KST 사용)
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── 🚀 100일 범위 내 커스텀 달력 오버레이 컴포넌트 ───
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

function SimpleCalendarModal({
  visible, onClose, onSelectDate, selectedDateStr
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (d: string) => void;
  selectedDateStr: string;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 100);
    return d;
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const calendarCells = useMemo(() => {
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [year, month, daysInMonth, firstDay]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.calendarCard}>
        <View style={styles.calHeader}>
          <Pressable onPress={prevMonth} hitSlop={12}>
            <Text style={styles.calNavBtn}>◀ 이전 달</Text>
          </Pressable>
          <Text style={styles.calTitle}>{year}년 {month + 1}월</Text>
          <Pressable onPress={nextMonth} hitSlop={12}>
            <Text style={styles.calNavBtn}>다음 달 ▶</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {['일', '월', '화', '수', '목', '금', '토'].map(w => (
            <Text key={w} style={styles.weekText}>{w}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarCells.map((date, idx) => {
            if (!date) return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
            
            const dateStr = toLocalDateStr(date);
            const active = selectedDateStr === dateStr;

            const isBeforeToday = dateStr < toLocalDateStr(today);
            const isAfterMax = dateStr > toLocalDateStr(maxDate);
            const disabled = isBeforeToday || isAfterMax;

            return (
              <Pressable
                key={dateStr}
                disabled={disabled}
                style={[
                  styles.dayCell,
                  active && styles.dayCellActive,
                  disabled && styles.dayCellDisabled
                ]}
                onPress={() => {
                  haptic.tap();
                  onSelectDate(dateStr);
                  onClose();
                }}
              >
                <Text style={[
                  styles.dayText,
                  active && styles.dayTextActive,
                  disabled && styles.dayTextDisabled
                ]}>
                  {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.calCloseBtn} onPress={onClose} hitSlop={8}>
          <Text style={styles.calCloseBtnText}>닫기</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 4: 인증 빈도 ───
// 🚀 0041: 목표 유형 토글 — 주기형 vs 목표 횟수형
function GoalTypeToggle({
  value, setValue,
}: {
  value: 'cadence' | 'count';
  setValue: (v: 'cadence' | 'count') => void;
}) {
  const opts = [
    { value: 'cadence' as const, Icon: Repeat, label: '주기형',     desc: '매일·주 N회 꾸준히 인증' },
    { value: 'count'   as const, Icon: Target, label: '목표 횟수형', desc: '기간 내 N개 달성 (100대명산·올레 완주 등)' },
  ];
  return (
    <View style={{ gap: 12 }}>
      {opts.map(o => {
        const active = value === o.value;
        return (
          <Pressable key={o.value} style={[styles.option, active && styles.optionActive]} onPress={() => setValue(o.value)}>
            <o.Icon size={24} color={active ? colors.brandInk : colors.sub} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{o.label}</Text>
              <Text style={styles.optionDesc}>{o.desc}</Text>
            </View>
            {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// 🚀 0041: 목표 개수 입력 (count 유형) — 직접 입력 + 프리셋 칩
function TargetCountField({
  value, setValue,
}: {
  value: number;
  setValue: (n: number) => void;
}) {
  const presets = [10, 16, 27, 30, 50, 100];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          value={value > 0 ? String(value) : ''}
          onChangeText={(t) => {
            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
            setValue(Number.isNaN(n) ? 0 : Math.min(n, 9999));
          }}
          placeholder="예: 16"
          placeholderTextColor={colors.primary300}
          style={[styles.bigInput, { flex: 1 }]}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={styles.optionTitle}>개</Text>
      </View>
      <View style={styles.chipWrap}>
        {presets.map(p => (
          <Pressable key={p} style={styles.chip} onPress={() => setValue(p)}>
            <Text style={styles.chipText}>{p}개</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.smallNote}>기간 안에 이 개수만큼 인증하면 완주예요. 하루에 여러 개도 OK · 다 채우면 즉시 완주!</Text>
    </View>
  );
}

function Step4Frequency({
  value, setValue, durationDays, kind, startDate, setStartDate,
  goalType, targetCount, setTargetCount,
}: {
  value: CreateChallengeFrequency;
  setValue: (v: CreateChallengeFrequency) => void;
  durationDays: number;
  kind: ChallengeKind;
  startDate: string;
  setStartDate: (s: string) => void;
  goalType: 'cadence' | 'count';
  targetCount: number;
  setTargetCount: (n: number) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const options = useMemo(() => {
    if (durationDays === 1) {
      return [
        { value: 'daily' as CreateChallengeFrequency, label: '당일', desc: '하루 동안 한 번 인증', Icon: Timer },
      ];
    }
    return FREQUENCIES;
  }, [durationDays]);

  // 오늘부터 향후 3일간의 날짜 옵션 생성
  const dateOptions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      let label = `${d.getMonth() + 1}/${d.getDate()}`;
      let suffix = i === 0 ? '오늘' : i === 1 ? '내일' : '모레';
      arr.push({ dateStr, label, suffix });
    }
    return arr;
  }, []);

  // 🚀 다함께·누구나 방 시작일 (오늘~+7일) — 시작 전까지 동료 모집 기간 (v2.8 늦합류 피드백)
  const isRecruitKind = kind === 'closed' || kind === 'open';
  const recruitDateOptions = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const suffix = i === 0 ? '오늘' : i === 1 ? '내일' : i === 2 ? '모레' : `${i}일 뒤`;
      arr.push({ dateStr, label, suffix });
    }
    return arr;
  }, []);

  // 방 타입을 되돌렸을 때 미래 시작일이 남지 않게 정리 (당일 챌린지의 날짜 예약은 그대로 유지)
  useEffect(() => {
    if (durationDays > 1 && !isRecruitKind && startDate !== recruitDateOptions[0].dateStr) {
      setStartDate(recruitDateOptions[0].dateStr);
    }
  }, [durationDays, isRecruitKind, startDate, recruitDateOptions, setStartDate]);

  const isCustomDate = useMemo(() => {
    return !dateOptions.some(opt => opt.dateStr === startDate);
  }, [dateOptions, startDate]);

  const customLabel = useMemo(() => {
    if (!isCustomDate) return '달력 선택';
    const d = new Date(startDate + 'T00:00:00');   // 로컬 자정 파싱 — 'YYYY-MM-DD' 의 UTC 파싱 밀림 방지
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  }, [isCustomDate, startDate]);

  useEffect(() => {
    if (durationDays === 1 && value !== 'daily') {
      setValue('daily');
    }
  }, [durationDays, value]);

  return (
    <View style={{ gap: 12 }}>
      {goalType === 'count' ? (
        <TargetCountField value={targetCount} setValue={setTargetCount} />
      ) : options.map(f => {
        const active = value === f.value;
        return (
          <Pressable
            key={f.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => setValue(f.value)}
          >
            <f.Icon size={24} color={active ? colors.brandInk : colors.sub} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{f.label}</Text>
              <Text style={styles.optionDesc}>{f.desc}</Text>
            </View>
            {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
          </Pressable>
        );
      })}

      {/* 🚀 다함께·누구나 방 — 시작일 선택 (오늘~7일), 시작 전까지 동료 모집 기간 */}
      {durationDays > 1 && isRecruitKind && (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={styles.subSectionTitle}>언제 시작할까요? (시작 전까지 동료를 모아요)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}
          >
            {recruitDateOptions.map(opt => {
              const active = startDate === opt.dateStr;
              return (
                <Pressable
                  key={opt.dateStr}
                  style={[styles.dateCard, active && styles.dateCardActive]}
                  onPress={() => { haptic.tap(); setStartDate(opt.dateStr); }}
                >
                  <Text style={[styles.dateCardLabel, active && styles.dateCardLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.dateCardSuffix, active && styles.dateCardSuffixActive]}>
                    {opt.suffix}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.smallNote}>
            시작 후에 합류한 동료는 합류한 날부터 목표를 채우면 완주로 인정돼요.
          </Text>
        </View>
      )}

      {/* 🚀 당일 챌린지일 경우, 언제 도전할지 날짜 선택 UI 추가 */}
      {durationDays === 1 && (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={styles.subSectionTitle}>당일 하다 날짜를 선택해 주세요 (최대 100일 뒤까지)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}
          >
            {dateOptions.map(opt => {
              const active = startDate === opt.dateStr;
              return (
                <Pressable
                  key={opt.dateStr}
                  style={[styles.dateCard, active && styles.dateCardActive]}
                  onPress={() => {
                    haptic.tap();
                    setStartDate(opt.dateStr);
                  }}
                >
                  <Text style={[styles.dateCardLabel, active && styles.dateCardLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.dateCardSuffix, active && styles.dateCardSuffixActive]}>
                    {opt.suffix}
                  </Text>
                </Pressable>
              );
            })}

            {/* 달력 직접 선택 카드 */}
            <Pressable
              style={[styles.dateCard, { width: 120 }, isCustomDate && styles.dateCardActive]}
              onPress={() => {
                haptic.tap();
                setCalendarOpen(true);
              }}
            >
              <Text style={[styles.dateCardLabel, isCustomDate && styles.dateCardLabelActive, { fontSize: 13 }]}>
                {customLabel}
              </Text>
              <Text style={[styles.dateCardSuffix, isCustomDate && styles.dateCardSuffixActive]}>
                {isCustomDate ? '선택된 날짜' : '날짜 예약하기'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* 커스텀 100일 달력 모달 */}
      <SimpleCalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedDateStr={startDate}
        onSelectDate={(dateStr) => setStartDate(dateStr)}
      />
    </View>
  );
}

// ─── Step 5: 인증 방식 (사진 / 앱 스크린샷 / GPS 비활성) ───
function Step5ProofType({
  value, setValue,
}: { value: CreateChallengeProofType; setValue: (v: CreateChallengeProofType) => void }) {
  return (
    <View style={{ gap: 12 }}>
      {PROOF_TYPES.map(p => {
        const active = p.value === value;
        const disabled = !p.enabled;
        return (
          <Pressable
            key={p.value}
            disabled={disabled}
            onPress={() => setValue(p.value as CreateChallengeProofType)}
            style={[
              styles.option,
              active && styles.optionActive,
              disabled && styles.optionDisabled,
            ]}
          >
            <p.Icon size={24} color={active ? colors.brandInk : disabled ? colors.faint2 : colors.sub} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{p.label}</Text>
              <Text style={styles.optionDesc}>{p.desc}</Text>
            </View>
            {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 6: 방 타입 ───
function Step6RoomType({
  value, setValue, durationDays,
}: { value: ChallengeKind; setValue: (v: ChallengeKind) => void; durationDays: number }) {
  return (
    <View style={{ gap: 12 }}>
      {ROOM_TYPES.map(r => {
        const active = value === r.value;
        const isDisabled = durationDays === 1 && (r.value === 'solo' || r.value === 'cheered');
        return (
          <Pressable
            key={r.value}
            disabled={isDisabled}
            style={[
              styles.option,
              active && styles.optionActive,
              isDisabled && styles.optionDisabled,
            ]}
            onPress={() => {
              if (isDisabled) return;
              setValue(r.value);
            }}
          >
            <r.Icon size={24} color={active ? colors.brandInk : isDisabled ? colors.faint2 : colors.sub} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[
                  styles.optionTitle,
                  active && styles.optionTitleActive,
                  isDisabled && { color: colors.primary300 }
                ]}>
                  {r.label}
                </Text>
                {r.recommended && !isDisabled && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendBadgeText}>추천</Text>
                  </View>
                )}
                {isDisabled && (
                  <Text style={{ fontSize: 11, color: colors.primary500, fontFamily: fontFamily.medium }}>
                    (1일 하다 불가)
                  </Text>
                )}
              </View>
              <Text style={styles.optionDesc}>
                {isDisabled ? '1일 하다는 다같이 하는 방에서만 가능해요.' : r.desc}
              </Text>
            </View>
            {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── 🚀 안내문 입력 (나홀로 제외) — 텍스트 + 보관함 이미지(선택). 합류 전 미리보기에 노출 ───
function IntroEditor({
  description, setDescription, imageUri, setImageUri, disabled,
}: {
  description: string;
  setDescription: (s: string) => void;
  imageUri: string | null;
  setImageUri: (u: string | null) => void;
  disabled: boolean;
}) {
  const onPickImage = async () => {
    haptic.tap();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status === 'denied') {
        Alert.alert('보관함 접근 권한이 필요해요', '설정 → Do:하다 → 사진 에서 켜주세요.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],   // v18 — MediaTypeOptions 는 deprecated
        quality: 0.85,
        exif: false,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setImageUri(uri);
    } catch (e: any) {
      Alert.alert('사진 선택 실패', e?.message ?? String(e));
    }
  };

  return (
    <View style={styles.introBox}>
      <Text style={styles.introLabel}>안내문 (선택) — 합류 전에 보여요</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={'이 하다가 어떤 하다인지, 어떤 마음으로 함께하면 좋을지 알려주세요.'}
        placeholderTextColor={colors.primary300}
        style={styles.introInput}
        multiline
        maxLength={1000}
        editable={!disabled}
      />
      <Text style={styles.introCounter}>{description.length} / 1000</Text>
      {imageUri ? (
        <View style={styles.introImageWrap}>
          <Image source={{ uri: imageUri }} style={styles.introImage} resizeMode="cover" />
          <Pressable style={styles.introImageRemove} onPress={() => setImageUri(null)} disabled={disabled} hitSlop={8}>
            <X size={16} color={colors.surface} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.introImageBtn} onPress={onPickImage} disabled={disabled}>
          <ImageIcon size={16} color={colors.sub} strokeWidth={1.8} />
          <Text style={styles.introImageBtnText}>보관함에서 사진 추가</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── 🚀 다인 내기 설정 (다함께·누구나, 파일럿) — 티어 + 정산(기부) 모드. null=내기 없음 ───
function BetConfig({
  betTier, setBetTier, betDonationMode, setBetDonationMode,
}: {
  betTier: BetTier | null; setBetTier: (t: BetTier | null) => void;
  betDonationMode: BetDonationMode; setBetDonationMode: (m: BetDonationMode) => void;
}) {
  return (
    <View style={styles.introBox}>
      <Text style={styles.introLabel}>내기 한잔, 걸까요? (선택)</Text>
      <Text style={styles.smallNote}>
        걸면 참여자 전원이 같은 금액을 선주문해요. 성인 인증된 사람만 합류할 수 있어요. (베타: 모의 결제)
      </Text>
      <View style={styles.betChipRow}>
        <Pressable
          style={[styles.betChip, betTier === null && styles.betChipActive]}
          onPress={() => { haptic.tap(); setBetTier(null); }}
        >
          <Text style={[styles.betChipText, betTier === null && styles.betChipTextActive]}>안 걸기</Text>
        </Pressable>
        {BET_TIERS.map(t => (
          <Pressable
            key={t.tier}
            style={[styles.betChip, betTier === t.tier && styles.betChipActive]}
            onPress={() => { haptic.tap(); setBetTier(t.tier); }}
          >
            <Text style={[styles.betChipText, betTier === t.tier && styles.betChipTextActive]}>{t.label}</Text>
            <Text style={styles.betChipPrice}>{t.price.toLocaleString()}원</Text>
          </Pressable>
        ))}
      </View>
      {betTier && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={styles.introLabel}>정산 방식</Text>
          {BET_DONATION_MODES.map(m => {
            const active = betDonationMode === m.mode;
            return (
              <Pressable
                key={m.mode}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => { haptic.tap(); setBetDonationMode(m.mode); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{m.label}</Text>
                  <Text style={styles.optionDesc}>{m.desc}</Text>
                </View>
                {active && <Check size={20} color={colors.brand} strokeWidth={2.4} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── 스타일 ───
const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { fontSize: fontSize.sm, color: colors.primary500, fontFamily: fontFamily.medium },
  dotBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary100,
  },
  dotDone: { backgroundColor: colors.accent700 },
  dotActive: { backgroundColor: colors.accent },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  stepLabel: {
    fontSize: fontSize.xs,
    color: colors.accent700,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  question: {
    fontSize: fontSize['3xl'],
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  bigInput: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary100,
  },
  counterSmall: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    textAlign: 'right',
  },
  subSectionTitle: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.semibold,
    marginTop: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },

  // 카테고리 그리드 (2열)
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  catItem: {
    width: '47%', flexGrow: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,   // 가로 배치(아이콘 좌 + 라벨 우)
    paddingVertical: 14, paddingHorizontal: 14,            // 카드 높이 낮게
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  catItemActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  catName: {
    fontSize: fontSize.md,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  subBackBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  subBackText: { fontSize: fontSize.sm, color: colors.sub, fontFamily: fontFamily.medium },
  subWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  subChipActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  subChipText: { fontSize: fontSize.sm, color: colors.ink, fontFamily: fontFamily.medium },
  subChipTextActive: { color: colors.brandInk, fontWeight: fontWeight.bold },

  // 옵션 카드 (기간/빈도/방식/방타입/내기 공용)
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary100,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.accent50 },
  optionDisabled: { opacity: 0.5 },
  optionTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  optionTitleActive: { color: colors.accent700 },
  optionDesc: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  // 🚀 방타입 '추천' 배지 (cheered) — 디자인 토큰 내 accent 필 배지
  recommendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  recommendBadgeText: {
    fontSize: 10,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  smallNote: {
    fontSize: fontSize.xs,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },

  // 하단
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: colors.primary100,
    backgroundColor: colors.surface,
    gap: 12,
  },
  prevBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevText: { fontSize: fontSize.base, color: colors.primary, fontFamily: fontFamily.medium },
  nextBtn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextText: {
    fontSize: fontSize.base,
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dateScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  dateCard: {
    width: 76,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  dateCardLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  dateCardLabelActive: {
    color: colors.accent700,
  },
  dateCardSuffix: {
    fontSize: 10,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
  dateCardSuffixActive: {
    color: colors.accent,
    fontFamily: fontFamily.medium,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  calendarCard: {
    width: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primary100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calNavBtn: {
    fontSize: 14,
    color: colors.accent,
    fontFamily: fontFamily.medium,
  },
  calTitle: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: 'bold',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary100,
    paddingBottom: 6,
  },
  weekText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
  },
  dayCell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  dayCellEmpty: {
    width: 36,
    height: 36,
  },
  dayCellActive: {
    backgroundColor: colors.accent,
  },
  dayCellDisabled: {
    opacity: 0.15,
  },
  dayText: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: 'bold',
  },
  dayTextActive: {
    color: colors.surface,
  },
  dayTextDisabled: {
    color: colors.primary300,
    fontWeight: 'normal',
  },
  calCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  calCloseBtnText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.medium,
  },

  // 🚀 안내문 입력 (IntroEditor)
  introBox: {
    marginTop: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary100,
    gap: 10,
  },
  introLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  introInput: {
    minHeight: 90,
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
    textAlignVertical: 'top',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  introCounter: {
    fontSize: 11,
    color: colors.primary300,
    fontFamily: fontFamily.regular,
    textAlign: 'right',
    marginTop: -4,
  },
  introImageBtn: {
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary100,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  introImageBtnText: {
    fontSize: fontSize.sm,
    color: colors.primary500,
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
  },
  introImageWrap: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    maxHeight: 320,
  },
  introImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.primary100,
  },
  introImageRemove: {
    position: 'absolute',
    top: 8, right: 8,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 🚀 다인 내기 티어 칩 (BetConfig)
  betChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  betChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary100,
    backgroundColor: colors.background,
    alignItems: 'center',
    gap: 2,
  },
  betChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent50,
  },
  betChipText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
  },
  betChipTextActive: { color: colors.accent700 },
  betChipPrice: {
    fontSize: 11,
    color: colors.primary500,
    fontFamily: fontFamily.regular,
  },
});
