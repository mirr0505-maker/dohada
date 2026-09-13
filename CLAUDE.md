# CLAUDE.md — Do : 하다 작업 규칙

이 파일은 Claude Code가 이 저장소에서 작업할 때 **반드시 따라야 하는 지침**이다.
메인 세션(Advisor)은 판단·설계·검증을 맡고, 구현 노동은 Worker(Opus 4.8 서브에이전트)에게 위임한다 — 상세는 아래 「모델 역할 분담」.

**Phase 1 MVP 의 단일 진실원천은 [`MVP_SCOPE.md`](docs/MVP_SCOPE.md) (v2.5) 이다.**
**제품·비전 전체 청사진은 [`BLUEPRINT.md`](BLUEPRINT.md) (구 PITCH 흡수, 2026-06-13).**
**베타 모집 랜딩 기획은 [`docs/beta-landing-plan.md`](docs/beta-landing-plan.md) — 정체성·기존 SNS 극복 메시지 정리.**
장기 비전·정책·DB 설계는 [`Do_하다_통합기획서_v4_0_1.pdf`](Do_하다_통합기획서_v4_0_1.pdf) 를 참조.
**UI/UX 의 절대 기준은 [`prototype/do-hada-app-v4.html`](prototype/do-hada-app-v4.html)** — 화면 디자인 결정 시 반드시 해당 화면의 HTML/CSS 를 먼저 본다 (v4 = 28화면).
작업 단위는 부록 E.8의 **Week** 단위(Day는 작업 덩어리 예시).
실제 앱 코드는 [`mobile/`](mobile/), 백엔드(DB + Edge Function)는 [`supabase/`](supabase/).

### 신규 코드 위치 (v2.1)
- 챌린지방 5탭 컴포넌트: [`mobile/components/challenge/`](mobile/components/challenge/) — ChatTab / LogTab / StatusTab / ArchiveTab
- 큰 숫자 노출 정책: [`mobile/lib/format.ts`](mobile/lib/format.ts)
- 알림: [`mobile/lib/push.ts`](mobile/lib/push.ts) + [`supabase/functions/flush-notifications/`](supabase/functions/flush-notifications/)

### 신규 코드 위치 (v2.2 ~ v2.4)
- 통합 헤더 (4 탭 공통): [`mobile/components/AppHeader.tsx`](mobile/components/AppHeader.tsx)
- 챌린지방 모달: [`mobile/components/challenge/MemberSheet.tsx`](mobile/components/challenge/MemberSheet.tsx) · [`ImpactModal.tsx`](mobile/components/challenge/ImpactModal.tsx) · [`LogCommentsSheet.tsx`](mobile/components/challenge/LogCommentsSheet.tsx)
- 홈 v2.3 분류별 카드: [`mobile/components/home/MyChallengeCard.tsx`](mobile/components/home/MyChallengeCard.tsx) — Solo/Cheered/Closed/Open 4 variants
- 관심 분류 시스템 (v2.4):
  - DB: [`supabase/migrations/0014_user_interests.sql`](supabase/migrations/0014_user_interests.sql)
  - 함수: `fetchMyInterests` · `addInterest` · `removeInterest` · `fetchInterestingOpenChallenges` ([`mobile/lib/db.ts`](mobile/lib/db.ts))
  - UI: [`mobile/app/(tabs)/profile.tsx`](mobile/app/(tabs)/profile.tsx) — `InterestEditModal`
- 도전 포기 (soft delete): [`mobile/lib/db.ts`](mobile/lib/db.ts) `giveUpMembership` + [`mobile/app/room/[id].tsx`](mobile/app/room/[id].tsx) 멈춤 Alert 분기

### 신규 코드 위치 (v2.5 — SNS-first 재설계)
- 브랜드 마크: [`mobile/components/BrandMark.tsx`](mobile/components/BrandMark.tsx) — `( ⊙ )` 컴포넌트 (size sm/md/lg/xl, 폰트 무관)
- 탭바 재구성: [`mobile/app/(tabs)/_layout.tsx`](mobile/app/(tabs)/_layout.tsx) — 홈 / 내도전 / ⊕ / 기록 / **해냈어요** (profile 탭 제거, 우상단 아바타로 MY 일원화)
- 홈 SNS-first 피드: [`mobile/app/(tabs)/home.tsx`](mobile/app/(tabs)/home.tsx) — me-strip 1줄 + 피드 카드 5종 (🎉 완주리본 · 📸 오늘인증 · 🙋 응원받기 · 🌍 누구나합류 · ✨ 관심도전) + 🌙 끝 마커
- 기록 탭 (신규): `mobile/app/(tabs)/record.tsx` — 앱 전체 기록(Vlog) 피드
- 해냈어요 탭 (신규):
  - 공개 탭: `mobile/app/(tabs)/done.tsx`
  - 상세: `mobile/app/done/[id].tsx` — "나도 도전 시작하기" CTA (신규 유입 루프)
  - 작성: `mobile/app/done/new.tsx` — 시스템 통계 자동 잠금 + 사진·소감 옵션
- DB: [`supabase/migrations/0016_completion_stories.sql`](supabase/migrations/0016_completion_stories.sql) — 완주 이야기 + 공개 범위 + 반응
- 박제 → 해냈어요 진입점: [`mobile/components/challenge/ArchiveTab.tsx`](mobile/components/challenge/ArchiveTab.tsx) "완주 이야기 공유" 버튼 + 4단계 상품 잠금 노출 (가격 "추후 결정")

### 신규 코드 위치 (v2.6 — 알림 시스템 통일 + 안정화)
**알림 정책 3줄**: ① 알림 발생 → 푸시 + 헤더 벨 dot (둘 다 `notification_queue` 동일 소스) ② 22시~익일 06시 푸시 보류 → 06시 일괄 발송 (알림함엔 즉시 보임) ③ 푸시 탭 → 홈 + 알림함 자동 오픈 → 행 탭 시 해당 탭 딥링크.
- 알림함 (벨): [`mobile/components/AppHeader.tsx`](mobile/components/AppHeader.tsx) — kind 별 라벨·미리보기, dot = 마지막 확인(`bell_seen_at`) 이후 새 알림만. **가짜 dot 금지 원칙** (해냈어요 탭 dot 도 실데이터)
- 알림 조회·딥링크: `fetchMyNotifications` ([`mobile/lib/db.ts`](mobile/lib/db.ts)) + `notificationRoute` ([`mobile/lib/push.ts`](mobile/lib/push.ts))
- 푸시 탭 진입: [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx) — `useLastNotificationResponse` + 세션 복원 대기 + 콜드 스타트 시 홈 replace → `홈?bell=<ts>`. 챌린지방은 `?tab=` param 변경에도 탭 전환 반응
- 발송 파이프라인: DB 트리거 (0009·0019·0022·**0026 인증/기록**) → `notification_queue` → [`supabase/functions/flush-notifications/`](supabase/functions/flush-notifications/) cron (조용시간 22~06시·일 5건 상한·응원 1시간 묶음·무음). 알림함 RLS 는 0025, "동료 인증·기록" 토글은 0027
- 솔로 방 = 알림 0건 (모든 트리거 수신자가 "본인 제외 멤버" — solo 는 멤버 1명이라 구조적 보장)
- 완주 판정: [`mobile/lib/stats.ts`](mobile/lib/stats.ts) — KST 기준 + frequency(daily/weekly3/weekly1) 목표 인증 수. cheered 방의 완주 판정·박제는 도전자(개설자) 기준. 완주 화면 1회 노출 키 = `complete_seen_<챌린지>_<유저>` (SecureStore 키는 영숫자·`.`·`-`·`_` 만 허용 — `:` 금지)
- **다음 네이티브 빌드 시 활성화** (2026-06-12): `expo-image-manipulator` (사진 회전 굽기 + 1600px 리사이즈 + JPEG 압축) — 코드·의존성은 9e69108 에 반영 완료, 구 빌드는 가드 폴백으로 무동작. **다음 `eas build` (preview·production) 부터 자동 활성화 — 추가 작업 불필요, 빌드만 하면 됨**
- **출시 직전 백로그** (2026-06-11 결정):
  - ~~기록 단일 라우트(`/log/[id]`) 또는 `?tab=log&logId=` 스크롤 포커스~~ → **알림 딥링크로 선반영 (2026-06-11)**: 알림함 행 탭 시 `?tab=proof&proofId=` / `?tab=log&logId=` 해당 카드 스크롤 포커스 + `&comments=1` 댓글 시트 자동 오픈 (`notificationRoute` · `room/[id].tsx` · `LogTab`). 알림함 행에 챌린지 제목 표시 (`fetchMyNotifications` embed). 홈/기록 탭의 기록 카드 → 챌린지방 기록 탭 동선은 기존 유지 (5탭 컨텍스트 보존 사상)
  - **Sentry DSN 연결** — 베타는 Supabase `client_errors` 자체 수집으로 운영. 정식 출시 전에 sentry.io 프로젝트 생성 → `.env` 에 `EXPO_PUBLIC_SENTRY_DSN` 추가 (코드는 DSN 만 넣으면 자동 전환). 이유: 네이티브 레벨 크래시(JS 밖)는 자체 수집이 못 잡음

### 신규 코드 위치 (v2.7 — Phase 1.5 일괄 오픈, 2026-06-11)
- 용기 받았어요 반응: [`supabase/migrations/0029_story_courage_reactions.sql`](supabase/migrations/0029_story_courage_reactions.sql) (사용자당 1회·본인 글 RLS 거부) + `toggleStoryCourage`/`mapStoryReactions` ([`mobile/lib/db.ts`](mobile/lib/db.ts)) + [`mobile/app/done/[id].tsx`](mobile/app/done/[id].tsx) 토글 UI
- 생성 마법사 **5단계** (7→5 압축): [`mobile/app/create.tsx`](mobile/app/create.tsx) — 제목→분류→방타입→기간+빈도→인증방식. 내기는 마지막 화면 한 줄 티저
- 홈 노출 상한: [`mobile/app/(tabs)/home.tsx`](mobile/app/(tabs)/home.tsx) `HOME_ACTIVE_LIMIT=5`(미인증 우선)·`HOME_FINISHED_LIMIT=3` + 모두 보기 링크 + 미인증 선택 모달(`checkinPickerOpen`)
- 관심 도전 2-티어: `fetchInterestingOpenChallenges` — 1순위 명시 관심 / 2순위 자동 추론, 티어 내 최신순 (인기 가중치 금지)
- 둘러보기 카테고리 필터: [`mobile/app/(tabs)/discover.tsx`](mobile/app/(tabs)/discover.tsx) — 로드된 목록 기반 칩, 클라 필터
- 온보딩: 스플래시([`mobile/app/index.tsx`](mobile/app/index.tsx)) 세션 자동 홈 진입 + 건너뛰기, [`mobile/components/OnbView.tsx`](mobile/components/OnbView.tsx) 좌우 Fling 스와이프
- 완주 celebration: [`mobile/app/complete/[id].tsx`](mobile/app/complete/[id].tsx) — Reanimated entering (성취 순간에만 모션)
- **종료 방 쓰기 잠금 (마무리 인사 7일 유예)**: 기준 = 종료일 24시(KST)부터 7일, solo 는 즉시 잠금. 유예 중엔 대화·댓글·기록·응원 모두 가능(대화 탭에 "N일 남았어요" 배너), 지나면 **응원·좋아요 포함 전면 읽기 전용** (열람·탭 이동은 유지). 판정 = `getFarewellState` ([`mobile/lib/stats.ts`](mobile/lib/stats.ts)) 단일 소스 + DB 는 0030 RESTRICTIVE 정책 6개. 종료 방 초대·멈춤은 회색 비활성, 초대 링크 신규 합류 차단 (`joinChallenge`)
- **에러 수집 (Sentry 미사용)**: [`mobile/lib/sentry.ts`](mobile/lib/sentry.ts) — DSN 없으면 Supabase `client_errors` 테이블(0031)로 자체 수집 (전역 JS 에러 핸들러 + `reportError` 10곳, 세션당 20건 상한·중복 제거). 조회는 SQL Editor: `select * from client_errors order by created_at desc;` DSN 을 .env 에 넣으면 자동으로 Sentry 모드 전환

### 신규 코드 위치 (v2.8 — 시작일·모집 기간 + 늦합류 비례 완주, 2026-06-12)
- **시작일 선택**: [`mobile/app/create.tsx`](mobile/app/create.tsx) Step4 — 다함께(closed)·누구나(open) 방만 오늘~+7일 칩. 방 타입 변경 시 시작일 자동 리셋
- **모집 기간** (시작일 전): 합류·대화 가능, 인증 불가 — FAB "🗓️ N일 뒤 시작 · 동료 모집 중" + info bar "시작 D-N" + 초대글에 시작일 자동 포함. DB 측 인증 차단은 기존 0024 `is_within_challenge_period` (start_date 조건 포함)가 담당
- **늦합류 비례 완주**: [`mobile/lib/stats.ts`](mobile/lib/stats.ts) `memberTargetProofCount`/`memberPassedDays` — isCompleted/isFailed 에 `joinedAt` 옵션. 합류일 > 시작일이면 "합류일~종료일" 구간 기준 목표. 호출부: room 배지·완주 redirect·ArchiveTab(`subjectJoinedAt`)·StatusTab(멤버별 분모)
- **관심 도전 라벨 정직화**: `matched_by: explicit | inferred` — 추론 매칭은 "내 도전과 같은 분야" 카피 (관심 미설정 사용자 혼란 방지)
- **버전·OTA 표시**: [`mobile/app/(tabs)/profile.tsx`](mobile/app/(tabs)/profile.tsx) 하단 — `expo-updates` updateId 8자리 + 적용 시각 (베타 테스터 소통용)
- **종료 방 UI**: 기록 탭에도 마무리 인사 배너, info bar D-N → 회색 "종료" + 진행 숫자 취소선
- **포기 = 조용한 보관 + 읽기 전용 (2026-06-12 결정)**: 삭제 ❌ (공유 공간 — 동료 박제 보호 + "보존돼요" 약속). DB 는 [`0034_gave_up_read_only.sql`](supabase/migrations/0034_gave_up_read_only.sql) — `is_viewer_of*` 헬퍼로 SELECT 10개 정책만 포기자 포함, 쓰기 정책은 활성 멤버 전용 유지 (완주 유예보다 강한 잠금). UI: 내도전 탭 하단 "🕊️ 지난 도전" 접힌 섹션 (기본 숨김) → 방 열람 (writeLocked + 헤더 액션 비활성) + FAB "다시 시작하기" (`/create?title=` 프리필). 진입 차단 Alert 제거

### 신규 코드 위치 (v2.9 — 안내문 + 베타 피드백 버그픽스, 2026-06-12)
- **안내문 (나홀로 제외 전체)**: 합류 전에 "어떤 도전인지" 보여주는 소개글(텍스트 + 보관함 이미지). DB = [`0037_challenge_intro.sql`](supabase/migrations/0037_challenge_intro.sql) (`challenges.intro_image_url` 컬럼 + `create_challenge`·`get_invite_info` RPC 확장 — **적용 필수, 미적용 시 챌린지 생성 실패**)
  - 입력: [`create.tsx`](mobile/app/create.tsx) `IntroEditor` (방 타입 스텝, kind≠solo). submit 에서 `description`+이미지(R2 업로드)→`createChallenge`. AI 검수에 안내문 텍스트 포함
  - 노출: 누구나=홈 [`OpenJoinPreviewSheet`](mobile/components/home/OpenJoinPreviewSheet.tsx) (합류 전 바텀시트, home.tsx 동선 교체) / 응원받기·다함께=[`invite/[id].tsx`](mobile/app/invite/[id].tsx) 초대 미리보기 / 전체=방 [`StatusTab`](mobile/components/challenge/StatusTab.tsx) 현황 info 카드
- **버그픽스 ②**: [`create.tsx`](mobile/app/create.tsx) 날짜 — `toLocalDateStr` 로 달력·칩·기본값을 로컬(KST) 기준 생성 (`toISOString().slice(0,10)` UTC 밀림 → "오늘" 비활성·+1~2일 어긋남 해소)
- **버그픽스 ③**: [`LogTab`](mobile/components/challenge/LogTab.tsx) 기록 작성 — 본문 영역 ScrollView 화 + 사진 미리보기 maxHeight 320 + 본문 minHeight 200 (사진 먼저 넣어도 본문 입력칸이 안 가려짐)
- **본인인증 입력 UX**: [`GiftSheet`](mobile/components/challenge/GiftSheet.tsx)·[`BetSheet`](mobile/components/challenge/BetSheet.tsx) 바텀시트를 `KeyboardAvoidingView` 로 감싸 키보드 가림 해소 + 생년월일 숫자만 입력→하이픈 자동(`formatBirthDateInput` in payments.ts, 숫자패드). ※ 현재 본인인증은 mock(형식·만19세만 검사) — 진짜 PASS 는 Stage 3 에서 화면째 교체, 이 수동 입력 UX 는 그때 사라짐
- **운영 반영 (2026-06-12)**: 0037 운영 DB 적용 완료 + OTA 배포(preview·production 양 채널). Edge Function 변경 없음

### 신규 코드 위치 (v2.10 — 목표 횟수형 도전, 0041, 2026-06-13)
**매일 인증이 아닌 "기간 내 N개 달성" 유형 (100대명산·제주올레·둘레길/자전거길 스탬프).** 기존 = 주기형(cadence: 기간×빈도), 신규 = 목표 횟수형(count: target_count 개).
- DB: [`0041_goal_count_type.sql`](supabase/migrations/0041_goal_count_type.sql) — `challenges.goal_type`('cadence'|'count') + `target_count`. `create_challenge`(12→14인자)·`get_invite_info` 확장. **count형은 서버에서 내기 강제 비활성**(bet_tier null). ⚠️ **migration 먼저** — 미적용 시 14인자 RPC 불일치로 모든 챌린지 생성이 깨짐 (2026-06-13 운영 적용 완료)
- 완주 판정 단일 소스: [`stats.ts`](mobile/lib/stats.ts) `goalStatus` — count = **총 인증 수 ≥ N (종료 무관·조기 완주 인정·하루 다회 OK)**, cadence = 기존(고유 날짜수 ≥ 기간×빈도). `isCompleted`/`isFailed` 위임
- 생성: [`create.tsx`](mobile/app/create.tsx) step4 유형 토글(`GoalTypeToggle`) + 목표 개수 입력(`TargetCountField`). count형은 내기 스텝 스킵
- 표시 분기 (일일 의무 없음 → "진행 N/목표"): 홈 미인증 잔소리 제외([`home.tsx`](mobile/app/(tabs)/home.tsx)) · FAB·BetCard 차단([`room/[id].tsx`](mobile/app/room/[id].tsx)) · 현황 분모 "개"([`StatusTab.tsx`](mobile/components/challenge/StatusTab.tsx)) · 완주([`complete/[id].tsx`](mobile/app/complete/[id].tsx)) · 박제 조기완주 노출([`ArchiveTab.tsx`](mobile/components/challenge/ArchiveTab.tsx)) · 내도전 배지([`my-challenges.tsx`](mobile/app/(tabs)/my-challenges.tsx))
- 결정(2026-06-13): ① 일일 의무 없음 ② 하루 다회 인증 ③ 늦합류 목표 고정(비례 X) ④ count형 내기 보류(응원만, betOutcome 미지원). 스탬프 명단·중복방지(진짜 스탬프북)는 [공식 미션](docs/MVP_SCOPE.md) 트랙으로 후속

### 신규 코드 위치 (Phase 2 Stage 1 — 핀테크 골격, 2026-06-11, 실돈 0원)
**단일 진실원천: [`PHASE2_FINTECH_PLAN.md`](docs/PHASE2_FINTECH_PLAN.md) (v0.4)** — 응원 한잔/내기 한잔/기부 허브.
- 결제 순수 로직: [`supabase/functions/_shared/payments/`](supabase/functions/_shared/payments/) — catalog(금액 단일소스)·giftStateMachine·orderPolicy·verifyPayment·betSettlement·providers(PG/기프티콘/본인인증 mock, 주입 구조)
- Edge Functions: `verify-identity` / `create-gift-order` / `confirm-gift-payment` — gift_orders 쓰기는 이 경로 전용 (RLS 에 클라 쓰기 정책 없음)
- DB: [`supabase/migrations/0032_identity_gift_orders.sql`](supabase/migrations/0032_identity_gift_orders.sql) — `user_verifications`(본인만 조회) + `gift_orders` + `is_adult_verified`/`challenge_bet_allowed`
- 테스트: 루트 [`__tests__/`](__tests__/) — `npm test` (Node 내장 러너, 의존성 0). **결제 로직 수정 시 반드시 함께 갱신·실행** (자동 테스트 의무 영역)
- 내기(bet) 주문 오픈·실서비스 전환은 법률 자문 게이트 후 providers.ts 구현체 교체로만
- **응원 한잔 UI (Stage 1.5)**: 보내기 = [`mobile/components/challenge/GiftSheet.tsx`](mobile/components/challenge/GiftSheet.tsx) (티어→본인인증→mock결제), 수령 = `mobile/app/gift/[id].tsx` (받기/기부 2택 → 발신자 피드백 알림), 클라 함수 = [`mobile/lib/payments.ts`](mobile/lib/payments.ts). 인증 카드 ☕ 버튼은 **전체 사용자 오픈 (Stage 4, 2026-06-13)** — `isGiftPilot` 게이트 제거(응원만). 디스클레이머 "🧪 실제 결제·계좌 연결 없음 · 베타 모의 결제" 를 보내기·결제확인·받기 화면에 명시. **내기(BetCard/BetConfig/fetchMyBet)는 `isGiftPilot` 파일럿 유지 — 앱스토어 도박 오인·법률 자문(⑤b) 전까지.** 수령 선택 시 발급 (claim-gift), 알림 kind 4종 + 기부 집계는 0033

### 신규 코드 위치 (Phase 2 Stage 5 ⑤a — 나와의 내기, mock·파일럿, 2026-06-12)
**단일 진실원천: [`PHASE2_FINTECH_PLAN.md`](docs/PHASE2_FINTECH_PLAN.md) 2.1-3 + Stage 5 ⑤a.** 나홀로(solo)·응원받기(cheered) 방의 도전자가 자기 한잔을 선주문 결제 → **완주=본전(받기/기부 선택)·실패=기부 확정**. 다인 내기(group)는 ⑤c 게이트 전까지 차단.
- **완주 판정 순수 로직**: [`supabase/functions/_shared/payments/betOutcome.ts`](supabase/functions/_shared/payments/betOutcome.ts) `computeSelfBetOutcome` — `lib/stats.ts`(isCompleted/memberTargetProofCount) 미러. KST·frequency·늦합류 비례. **결제 로직 = 자동 테스트 의무**라 SQL 아닌 TS 로 둠 (npm test 검증 위해). 테스트 = [`__tests__/self-bet-outcome.test.ts`](__tests__/self-bet-outcome.test.ts)
- **주문 경로 개방**: [`create-gift-order`](supabase/functions/create-gift-order/index.ts) 가 `orderType='bet'` 수용 — solo/cheered + 개설자 본인 + recipient=sender 강제 + 종료 전 + 1인 1내기 중복 차단(서버 게이트). `confirm-gift-payment` 는 order_type 무관 재사용
- **받기 게이트**: [`claim-gift`](supabase/functions/claim-gift/index.ts) 가 bet+receive 시 `selfBetOutcome` 로 완주 확인 — **미완주자 본전 회수 백도어 차단** (실돈 전환 후에도 안전). 기부는 언제나 허용
- **알림 스킵**: [`0036_self_bet.sql`](supabase/migrations/0036_self_bet.sql) — self-order(sender=recipient) 는 알림 미생성 (solo=알림 0건 원칙). 스키마 변경 없음(0032 가 bet/grand_cup 이미 지원)
- **UI**: 방 **현황 탭 상단** [`BetCard.tsx`](mobile/components/challenge/BetCard.tsx) (진입·진행·정산 한 카드, 도전자 본인만 — gift_orders RLS) + 걸기 시트 [`BetSheet.tsx`](mobile/components/challenge/BetSheet.tsx). 클라 함수 = `createBetOrder`·`fetchMyBet`·`BET_TIERS`(payments.ts). 노출 게이트 = `isGiftPilotEmail`. 완주 직후 발견성: [`complete/[id].tsx`](mobile/app/complete/[id].tsx) 에 paid 내기 있으면 "🎯 내기 정산하러 가기"(→현황 탭)
- **운영 반영 완료 (2026-06-12)**: 0036 운영 DB 적용 + `claim-gift`·`create-gift-order` 배포 (project `bpffxeddkuekefphsolz`)

### 신규 코드 위치 (Phase 2 Stage 5 ⑤c + 기부 모드 3종 — 다인 내기, mock·파일럿, 2026-06-12)
**기부 모드 3종 (개설 시 선택, ⑤a·⑤c 공통)**: commitment(완주→받기/기부·실패→기부) / pledge(완주→기부·실패→환불) / always(무조건 기부). **참여자 간 이전 0 불변** (자기 한잔은 자기가 받기/기부/환불 — 도박 구성요건 무관). commitment 의 구 "전원 미완주→전원 환불" 특례는 **제거**(실패=항상 기부 일관 / 환불은 pledge).
- **정산 순수 로직**: [`betSettlement.ts`](supabase/functions/_shared/payments/betSettlement.ts) `settleBet(donationMode)` + [`claimPolicy.ts`](supabase/functions/_shared/payments/claimPolicy.ts) `validateBetClaim`(per-주문 모드×결과→허용 액션). 테스트 = `bet-settlement`·`bet-claim`·`self-bet-outcome` (`npm test` 63/63). DB = [`0039_bet_donation_mode.sql`](supabase/migrations/0039_bet_donation_mode.sql) `gift_orders.donation_mode` + `refunded` 상태
- **다인 내기 설정**: [`0040_group_bet.sql`](supabase/migrations/0040_group_bet.sql) `challenges.bet_tier`·`bet_donation_mode`(null=내기 없음, closed/open 만) + `create_challenge`·`get_invite_info` 확장. 생성 마법사 `BetConfig`([create.tsx](mobile/app/create.tsx) step5, 다함께·누구나·파일럿). create-gift-order 가 group 은 챌린지 설정(티어·모드) 강제
- **미성년 합류 차단**: `bet_tier != null` 방은 [`joinChallenge`](mobile/lib/invite.ts) 가 성인 인증 검사 → `adult_required` 거부. 홈/초대 미리보기 `betBadgeText` 배지 + 거부 안내
- **포기=실패 인증**: [`claim-gift`](supabase/functions/claim-gift/index.ts) `gaveUp=true` → 종료 전이라도 즉시 실패 정산(commitment/always→기부·pledge→환불). [`BetCard`](mobile/components/challenge/BetCard.tsx) "🏳️ 포기하기(실패 인증)" + room `onBetGiveUp`
- **방 노출**: BetCard 가 self(개설자)·group(활성 멤버) 양쪽. group BetSheet 은 `fixedTier`·`fixedMode` 로 선택 생략
- **운영 반영 완료 (2026-06-13)**: 0039·0040 적용 + `claim-gift`·`create-gift-order` 배포. 클라는 빌드/OTA 대기. (배포 시 ⚠️ **migration 먼저** 원칙 — 미적용 상태로 EF 배포 시 donation_mode 컬럼 없어 응원 한잔까지 깨짐)

### 신규 코드 위치 (v2.11 — 누구나 방 모집 마감, 0043, 2026-06-13)
**누구나(open) 방은 "서로를 목격하는 동료" 경험이 핵심 → 군중이 되면 정체성 붕괴.** 강제 캡 대신 ① 개설자 수동 잠금 ② 50명·100명 도달 시 1회씩 넛지 알림 ③ 도전 기간 50% 경과 시 자동 마감. **"모집 마감" ≠ "종료"** — 신규 합류만 막히고 기존 멤버 인증·기록·대화·응원·완주는 그대로(다함께처럼). open 전용. 공식미션은 별도 트랙(캡 없음).
- 판정 단일 소스: [`stats.ts`](mobile/lib/stats.ts) `isRecruiting`(open + 미잠금 + 기간 50% 전) / `recruitCloseAtMs`(시작 00:00~종료 24:00 KST 중간). DB `recruit_close_at` 와 동일 계산. **마감 동작은 날짜 파생이라 cron 불필요** — 알림만 cron.
- DB: [`0043_recruit_lock.sql`](supabase/migrations/0043_recruit_lock.sql) — `challenges.recruit_locked`·`recruit_warn_level`(0/50/100 1회성)·`recruit_autoclose_notified` + `is_recruiting()`/`set_recruit_lock()`(해제는 50% 전만, 후엔 `auto_closed` 거부) RPC + `members_self_insert` 가드(open 은 모집중만) + 50/100 임계 트리거(`enqueue_recruit_milestone`) + 자동마감 알림 함수(`notify_recruit_autoclose`). 알림 kind 2종 추가
- 합류 차단 이중: [`joinChallenge`](mobile/lib/invite.ts)(클라) + `members_self_insert`(RLS). 노출 제거: [`db.ts`](mobile/lib/db.ts) `fetchInterestingOpenChallenges`·`fetchOpenChallenges` 가 `isRecruiting` 필터. 잠금 RPC = `setRecruitLock`
- UI: [`StatusTab`](mobile/components/challenge/StatusTab.tsx) 모집 상태 카드 + 개설자 "모집 잠그기/다시 열기" 토글(→`onRecruitLock` in [`room/[id].tsx`](mobile/app/room/[id].tsx)). 비멤버 FAB·헤더 초대 = recruit 마감 시 회색 "마감". 알림 라우팅 `recruit_milestone`·`recruit_autoclosed` → 현황 탭([`push.ts`](mobile/lib/push.ts)·[`AppHeader`](mobile/components/AppHeader.tsx)·[`flush-notifications`](supabase/functions/flush-notifications/index.ts) cron 이 `notify_recruit_autoclose` 호출)
- 결정(2026-06-13): ① 다시 열기는 50% 전만(후엔 고정) ② 자동마감도 개설자 알림 ③ 잠금 토글=현황 탭 ④ 개설 시 설정 없음(방 안에서만) ⑤ 임계는 50·100 고정 1회성. count형(0041)도 동일 적용
- **운영 반영 완료 (2026-06-13)**: 0043 적용 + `flush-notifications` EF 재배포(autoclose RPC 호출 추가) + 클라 OTA(preview·production). 네이티브 빌드 불필요(JS만 변경). (⚠️ kind 제약은 0033 gift 4종 포함 전체 목록 — 빠뜨리면 23514)

### 신규 코드 위치 (v2.12 — 비멤버 헤더 정직화 + 참가자/오늘 인증 수 정확화 + 워드마크, 2026-06-13)
- **참가자 수·오늘 인증 수 정확화 (RLS users-join 언더카운트 수정)**: 비멤버는 `users_self_read`(`shares_challenge_with`) 때문에 다른 멤버 프로필(users)을 못 읽어, [`fetchRoomData`](mobile/lib/db.ts) 의 `users(*)` 조인 + `.filter(m=>m.users)` 가 멤버 수를 깎았음(홈 카드는 `challenge_members` 행만 세 정확 → "홈 3명 vs 방 1명" 불일치). 수정: `fetchRoomData` 가 프로필 가시성과 분리한 `memberCount`(활성)·`todayCheckedCount`(활성 멤버 user_id 집합 × proofs — open 방은 비멤버도 proofs 열람 가능) 반환 + challenge_members select 에 `user_id` 직접 포함. 방 부제·`📸 N/N 인증`·헤더 아바타 +N·드롭업 제목 모두 이 값 사용 ([`room/[id].tsx`](mobile/app/room/[id].tsx)). 판정은 클라 단순 카운트(자동테스트 의무영역 아님)
- **비멤버 헤더 정직화**: 헤더 초대 버튼 = 비멤버·종료·포기·**모집 마감** 시 숨기지 않고 **회색 비활성**(누르면 합류/마감 안내). 아바타 드롭업([`MemberSheet`](mobile/components/challenge/MemberSheet.tsx)) = 비멤버에겐 **인원 수만, 이름 명단 비공개**(현황 탭 잠금과 동일 기준). 포기 멤버는 활성 명단에서 제외(헤더 인원수와 일치)
- **워드마크**: [`AppHeader`](mobile/components/AppHeader.tsx) "Do:**하다**" — 콜론은 검정, 한국어 브랜드명 '하다'를 로고색(주황)으로 (`brandName`, Option B)

### 신규 코드 위치 (v2.13 — 연속 인증 마일스톤 메달, 0044, 2026-06-13)
**인증 게시글에 "연속 N일" 오각형 메달.** 사람(아바타/닉네임) 아닌 **게시글**에 부착 → 비교/줄세우기 아닌 자기 여정 자축(조용한 SNS). 유튜브 골드 버튼 톤. 마일스톤 8단계: 3·7·21·49·99·180·365·730일.
- DB: [`0044_proof_streak.sql`](supabase/migrations/0044_proof_streak.sql) — `proofs.streak_count` + BEFORE INSERT 트리거 `set_proof_streak`(같은 챌린지 KST 연속 일수, **같은 날 2번째+ 인증은 0** → 메달 중복 방지) + 기존 인증 백필(gaps-and-islands). 인증 시점에 고정(박제 성격)
- 판정: [`stats.ts`](mobile/lib/stats.ts) `STREAK_MILESTONES`·`streakMilestone(count)` → `{day,label,color}` (마일스톤일 때만 non-null, 아니면 메달 X). 색 = [`tokens.ts`](mobile/lib/tokens.ts) `streakTier` 8색(초록→…→실버·골드·다이아, 인덱스 1:1)
- UI: [`StreakMedal.tsx`](mobile/components/challenge/StreakMedal.tsx) — `react-native-svg` Polygon 오각형 + 흰 숫자(의미 라벨은 a11y). 노출 = 방 인증 탭 ProofCard([`room/[id].tsx`](mobile/app/room/[id].tsx)) + 홈 오늘 인증 카드([`home.tsx`](mobile/app/(tabs)/home.tsx)) 사진 우상단. 데이터 = `fetchRoomData`·`fetchFellowProofs` 가 `streak_count` 반환
- 결정(2026-06-13): 전체 챌린지 적용 · 마일스톤 달성 게시글에만(상시 숫자 노출 X — 거대숫자 금지 정체성) · 저장 방식(트리거) · 49=강력한 습관/365=1년/730=2년. count형도 동일(연속 올린 날 기준)
- **배포 (⚠️ migration 먼저)**: 0044 적용 → 클라 OTA. EF·네이티브 빌드 불필요(`react-native-svg` 는 초기 커밋 cfd0ad3부터 빌드 포함). 미적용 상태로 OTA 시 streak_count 없어 메달만 미노출(무해)

### 신규 코드 위치 (v2.14 — 인증/기록 사진 여러 장 + 좌우 넘기기, 0045, 2026-06-13)
**인증 최대 3장 · 기록 최대 4장.** 카드에서 인라인 좌우 스와이프, 탭하면 전체화면에서도 좌우 스와이프(+핀치줌). 전부 OTA 가능(네이티브 추가 없음 — picker 다중선택 옵션 + 기존 gesture/reanimated).
- DB: [`0045_multi_photo.sql`](supabase/migrations/0045_multi_photo.sql) — `proofs.photo_urls text[]`(≤3) + `logs.photo_urls text[]`(≤4) + 백필 `[photo_url]`. **`photo_url` 은 커버(=첫 장)로 유지** → 기존 피드·홈·연속 메달·완주 통계 무탈. CHECK 로 장수 가드
- 데이터: [`db.ts`](mobile/lib/db.ts) `fetchRoomData`·`fetchFellowProofs`·`fetchLogs`·`fetchRecentLogs` 가 `photo_urls` 반환(빈 배열이면 `[photo_url]` 폴백). `createLog`/`updateLog` 는 `photoUrls: string[]`(커버 자동). 타입: `DbProof.photo_urls`·`LogWithAuthor.photo_urls`·`FellowProof.photo_urls`
- 표시: [`PhotoCarousel`](mobile/components/PhotoCarousel.tsx)(신규) — 카드 인라인 가로 페이저(점·"N/M" 배지, 우상단 슬롯=연속 메달). [`PhotoViewer`](mobile/components/PhotoViewer.tsx) = `photos[]`+`initialIndex`, FlatList 페이징 + 장별 핀치줌(줌 중 페이징 잠금). 적용: 방 인증 ProofCard(정사각) · 홈 오늘 인증(4:3) · 기록 카드(여러 장이면 캐러셀, 1장이면 기존 원본비율 LogPhoto)
- 업로드: 인증([`checkin/[id].tsx`](mobile/app/checkin/[id].tsx)) = 카메라/보관함 다중선택→썸네일 검토(추가·제거·더찍기), 기록([`LogTab`](mobile/components/challenge/LogTab.tsx)) = 썸네일 줄(최대 4). picker `allowsMultipleSelection`+`selectionLimit`
- **배포 (⚠️ migration 먼저)**: 0045 적용 → 클라 OTA. 미적용 OTA 시 photo_urls 없어 폴백(`[photo_url]`)으로 1장만 — 무해. ※ 전체화면 좌우 페이징+핀치 제스처는 실기기 확인 필요(정적 검증만 됨)

### 신규 코드 위치 (v2.15 — 다짐(무현금 사회적 스테이크) + 일반 UGC 검수, 0046, 2026-06-16)
**"내기 한잔"(mock 결제·법률 게이트)과 분리된 무현금 약속 = "다짐".** 앱으로 돈이 흐르지 않음(명예제도) → 결제·도박 규제 무관, 베타부터 영구 기능. 실돈 내기는 출시 후 법률 자문(⑤b) 게이트 유지.
- **콘텐츠 검수 일반화**: [`_shared/moderation/moderation.ts`](supabase/functions/_shared/moderation/moderation.ts) — 순수 로직(금액 사전탐지·응답 파싱·모드별 프롬프트, **자동 테스트 의무영역** → [`__tests__/moderation.test.ts`](__tests__/moderation.test.ts)) + EF [`moderate-text`](supabase/functions/moderate-text/index.ts)(`text`/`pledge` 모드, Haiku 4.5, JWT ON). 기존 `moderate-challenge`는 그대로.
- **다짐(pledge)**: DB [`0046_pledges.sql`](supabase/migrations/0046_pledges.sql) — `pledges`(direction `lose`(실패 시)/`win`(성공 시) + 자유 content 200자 + fulfilled, 멤버당 방향별 1개). RLS = 조회 `is_viewer_of`/쓰기 `is_member_of`+본인.
  - UI: [`PledgeSheet`](mobile/components/challenge/PledgeSheet.tsx)(트리거 토글 + **자유 문구** + `moderate-text(pledge)` 동기 차단 — 금액 표기 일절 금지·고가·신체/성적·강요) · [`PledgeCard`](mobile/components/challenge/PledgeCard.tsx)(완주/실패 맞춤 정산 "지킬 시간"·"지켰어요" 명예제도) · [`FellowPledges`](mobile/components/challenge/FellowPledges.tsx)(동료 다짐 공개·읽기전용 — 목격 정체성, 비교/랭킹 X)
  - 클라: [`db.ts`](mobile/lib/db.ts) `fetchChallengePledges`(방 전체→본인/동료 분리)·`createPledge`·`togglePledgeFulfilled`·`deletePledge`·`moderatePledge`. room [`room/[id].tsx`](mobile/app/room/[id].tsx) `pledgeSlot`(현황 탭 betSlot 옆)
  - 결정(2026-06-16): ① 이름 "다짐"(내기 단어 회피 = 법적 분리) ② 문구 자유·트리거만 실패/성공 이진 ③ 정산 명예제도(돈 안 거침) ④ 동료 다짐 공개 + 정산공개 ⑤ 전체 챌린지 유형(count 포함)
- **일반 UGC 검수 (3a, block 티어)**: [`db.ts`](mobile/lib/db.ts) `moderateUgcText` → 댓글(`addComment`)·기록댓글(`addLogComment`)·기록(`createLog`)·완주이야기(`createCompletionStory`)·대화(`sendChatMessage`) **+ 편집 경로**(`updateLog`·`updateLogComment`·`updateCompletionStory` — 수정 우회 차단)에서 `moderate-text(text)` 동기 차단. 명백한 위반만, 우회 분기 없음. **flag(애매→자동숨김)는 3b(신고·차단)와 인프라 공유 → 3b로 이월**
- **배포 (⚠️ migration 먼저)**: 0046 적용 + `moderate-text` EF 배포(`ANTHROPIC_API_KEY` 공유) 완료 → 클라 OTA(preview·production). 나머지 순수 JS

### 신규 코드 위치 (v2.16 — 신고·차단 + flag 자동숨김 (UGC), 0047, 2026-06-16)
**애플/구글 UGC 4종(신고·차단·필터링·연락수단) 충족 + AI flag/신고누적 자동숨김.** 출시 차단 #2 해소.
- **DB [`0047_reports_blocks.sql`](supabase/migrations/0047_reports_blocks.sql)**: `reports`(사유 6종 spam·abuse·sexual·violence·impersonation·other, `unique(reporter,target)` 중복방지) + `blocks`(본인 outgoing RLS) + `blocked_user_ids()` RPC(양방향 id, 방향 비노출) + `hidden` 6테이블(proofs·comments·log_comments·logs·completion_stories·chat_messages) + **신고 3건 누적 → 자동숨김 트리거**
- **검수 flag 티어**: [`moderation.ts`](supabase/functions/_shared/moderation/moderation.ts) text 모드 allow/**flag**/block 3단. flag → 작성 시 `hidden=true`(`moderateUgcText` boolean 반환, 8곳 threading). block 은 등록 차단(3a)
- **신고·차단·필터 (클라)**: [`db.ts`](mobile/lib/db.ts) `createReport`·`blockUser`·`unblockUser`·`fetchBlockedUserIds`. **필터링** = hidden(서버 `.eq('hidden',false)`) + 차단 양방향 제외(JS) — 8 surface(방/피드 인증·방/피드 기록·기록댓글·채팅·인증댓글·완주이야기). 베타는 클라 필터, 정식은 RLS 격상
- **UI**: [`ReportSheet`](mobile/components/challenge/ReportSheet.tsx)(사유 6종 칩 + 상세) · 인증 ProofCard ⋯ → 신고/차단([`room/[id].tsx`](mobile/app/room/[id].tsx) `openProofActions`·`handleBlock`) · [`MemberSheet`](mobile/components/challenge/MemberSheet.tsx) 멤버별 차단 · 프로필 "문의·신고 (운영팀)" mailto([`profile.tsx`](mobile/app/(tabs)/profile.tsx) + [`support.ts`](mobile/lib/support.ts) `SUPPORT_EMAIL` 단일 상수, 법인 후 교체)
- 결정(2026-06-16): ① 사유 6종 ② 자동숨김 신고 3건 / AI flag 1건 즉시 ③ 차단=양방향 콘텐츠 숨김·알림 X ④ 문의=화면엔 "운영팀" ⑤ flag→자동숨김(ⓑ)
- **배포 (⚠️ migration 먼저)**: 0047 적용 + `moderate-text` EF 재배포 완료 → 클라 OTA(preview·production). 차단목록 관리 UI·완전 RLS 격상은 후속

### 신규 코드 위치 (v2.17 — 응원받기(cheered) vs 다함께 구분 + 응원자 시선 정리, 0048, 2026-06-16)
**cheered(응원받기) = 도전자(개설자) 1명만 도전, 나머지는 응원 동료(응원·댓글·채팅·선물만).** 권한(RLS `can_create_in_challenge`·FAB·내기·다짐 주체)은 이미 막혀 있었으나 **요약 UI 가 cheered 를 closed(다함께)처럼 "전원 인증"으로 표시**해 정체성이 흐려지고, 응원자가 방 안에서 자기 역할을 모르던 문제 정리. (FEEDBACK #40)
- **요약 UI 구분**: 홈 카드([home.tsx](mobile/app/(tabs)/home.tsx)) — 응원자=`💛 응원` 버튼·`🙋 도전자 응원하기` 메타, 도전자=`💛 받은 응원 N개`(인증 버튼 유지). 방 인포바([room/[id].tsx](mobile/app/room/[id].tsx)) — cheered 인증 분모를 전원이 아닌 **도전자 1명 기준**(`📸 1/1`, `cheeredCreatorCheckedToday`). 현황 탭([StatusTab.tsx](mobile/components/challenge/StatusTab.tsx)) — 응원 동료는 인증률 바 없이 `💛 응원 중`(`isCheerer`), **도전자 최상단 고정** + closed infoKindTag '🌍누구나'→'🤝다함께' 오타 수정. 내하다 배지([my-challenges.tsx](mobile/app/(tabs)/my-challenges.tsx)) — 응원자=`💛 응원하기`
- **응원자 5탭 시선**: 인증·기록 탭 상단 역할 배너 `💛 OO님의 하다예요 · 응원과 댓글로 함께해요`(인증=room ListHeader / 기록=[LogTab.tsx](mobile/components/challenge/LogTab.tsx) `cheerOnlyOf` prop). 빈 상태 응원자용 문구("아직 OO님의 인증이 없어요 · 곧 올라올 거예요"). **응원자 FAB 전면 제거**(대화로 점프하던 기록 탭 FAB 삭제 — 카드별 응원/댓글/좋아요가 행동, 미사용 `fabCheer` 정리). 대화=응원자 홈(변경 없음)·박제=도전자 기준(이미 분기됨, `subjectUserId`)
- **홈/내하다 IA**: 홈([home.tsx](mobile/app/(tabs)/home.tsx)) `myDoingChs`(응원방 제외)로 '오늘 나의 하다'·'끝낸 하다' 구성 → 응원방은 '오늘 응원으로 힘주기'(`cheeredRooms`)에만 노출(섹션 중복 제거). 내하다 탭([my-challenges.tsx](mobile/app/(tabs)/my-challenges.tsx)) — `내 하다(내가 하는: 나홀로·다함께·누구나·응원받기 개설자) → 💛 응원하는 하다 → 🏆 끝낸 하다` 3밴드 분리
- **DB [0048_pledge_cheered_gate.sql](supabase/migrations/0048_pledge_cheered_gate.sql)**: 다짐(pledge) INSERT 정책을 `is_member_of` → `can_create_in_challenge`(0008)로 교체 — cheered 방은 **개설자만 다짐 작성**(인증/기록과 동일 잣대). 응원 동료가 DB 레벨에선 다짐 insert 가능하던 방어선 공백 메움. UPDATE/DELETE 는 본인 행 한정이라 유지
- 결정(2026-06-16): ① 도전자 카드는 '받은 응원 N개'(my_cheers_count) ② 응원자 역할 안내=콘텐츠 탭 상단 슬림 배너 ③ 응원자 기록 탭 FAB 제거 ④ 응원방은 홈/내하다에서 '응원' 섹션으로만 ⑤ 다짐 DB 게이트 추가
- **배포 (⚠️ migration 먼저)**: 0048 적용 완료(운영 ✓) → 클라 OTA(preview·production 양 채널). EF·네이티브 빌드 불필요(JS만, RLS 1개). 검증 tsc 0 + npm test 71/71

### 신규 코드 위치 (v2.18 — 하다 구경 (익명 발상 라이브러리) + 따라하기 참조수, 0050, 2026-06-17)
**discover(둘러보기)가 진입점 0개로 묻혀 4평가(✨😱🥹💫)까지 통째로 사장 → "하다 구경"으로 재설계.** 개설자·참여자 신원을 지운 익명 카드(제목·내용·인증방식·타입·평가·참조수만) = 탐색이 아니라 '참조'(살펴보고→평가→따라하기). 신원 제거 = 비교/줄세우기 대상 자체가 없음(조용한 SNS 강화). (FEEDBACK: UIUX_AUDIT 부록 '동선 단절(중요)')
- **DB [`0050_browse_anonymous_library.sql`](supabase/migrations/0050_browse_anonymous_library.sql)**: ① `challenge_references`(따라하기 **1인1회** PK) + `reference_count` 캐시 컬럼 + 트리거 + `reference_challenge()` RPC(멱등) ② `browse_visible`·`browse_image_visible` opt-out 컬럼(둘 다 디폴트 ON, 수정=0022 개설자 UPDATE 정책) ③ `browse_challenges()` RPC — **신원 컬럼(creator_id·user_id) 일절 미반환**(SECURITY DEFINER + 화이트리스트 컬럼으로 누수 차단), 4평가 집계·내 평가 동봉(challenge_votes RLS 안 넓힘), **최신순 고정**(참조수·평가수 desc 줄세우기 금지), `browse_visible`+확정미성년+종료방(`gave_up_at`) 제외
- **범위 = 전체 유형 익명 노출(C)**: 익명이라 신원 특정 불가 + 흔한 도전("금연 100일")은 군중에 묻힘. RLS상 비멤버가 못 읽는 solo/cheered/closed 를 보여주려면 RPC 우회가 필수 = C의 핵심 비용. **미성년 가드는 부분만** — 가입 시 생년 미수집이라 '결제 본인인증 확정 미성년'만 제외(거의 0명). 실질 미성년 보호 = 익명화 + opt-out, **진짜 차단은 가입 생년 수집 백로그**(메모리 `project_minor-protection-gap`)
- **클라**: 익명 카드 화면([`discover.tsx`](mobile/app/(tabs)/discover.tsx) 재설계 — 타입 4색 배지·이모지+두글자 평가 라벨(기발/대단/뭉클/새로움)·정형 기간/인증방식·🔁참조수·따라하기, **카드 탭→방 이동 없음**=익명 보존) · db `fetchBrowseChallenges`·`referenceChallenge`([`db.ts`](mobile/lib/db.ts)) · 타입 `BrowseChallengeCard`([`types.ts`](mobile/lib/types.ts)). 따라하기 = [`create.tsx`](mobile/app/create.tsx) `?ref=`+프리필(제목·방타입·분류·기간유형·빈도 — **안내문은 복제 안 함**, v2.35), **생성 완료 시점에** 참조 +1(탭만 하고 안 만들면 카운트 X)
- **진입점 + 참조수 노출**: 내하다 맨 아래 "🔭 하다 구경" 카드([`my-challenges.tsx`](mobile/app/(tabs)/my-challenges.tsx)) + 홈 끝마커 직전 링크 + **콜드스타트 온램프 hero**(구 "🔍 둘러보고 합류" 자리를 "🔭 하다 구경"으로 교체, 누구나 합류 섹션은 유지 — 선언·구경·합류 3갈래 균형으로 응원받기 올인 방지)([`home.tsx`](mobile/app/(tabs)/home.tsx)). 내가 하는 하다가 참조되면 "🔁 N번 참조"(99+ 캡) 배지 — 조용한 목격받기 (`fetchMyChallenges`·`fetchMyChallengesWithDetails` 가 `reference_count` 반환)
- 결정(2026-06-17): ① 범위 C(전체 익명) ② 분류 4종 뚜렷 구분 ③ 참조 1인1회 테이블 ④ 안내문 이미지 디폴트 노출+opt-out ⑤ 평가는 구경 카드에 유지(익명화로 사람→'발상' 평가가 됨) ⑥ 종료/포기방 구경 제외(기본값, RPC 한 줄로 완화 가능)
- **배포 (⚠️ migration 먼저)**: 0050 적용 완료(운영 ✓) → 클라 OTA(preview·production 양 채널). EF·네이티브 빌드 불필요(JS만, 새 의존성 없음). 검증 tsc 0 + npm test 71/71
- **후속 버그픽스 (0051→0052, 2026-06-17)**: 하다 구경 4평가 INSERT 가 비멤버 + open외(다함께/응원받기/나홀로)에서 RLS 거부됨 — `votes_self_insert`(0007)가 **멤버 OR open** 만 허용(누구나·내가 멤버인 방만 됐음). ⚠️ [`0051`](supabase/migrations/0051_browse_vote_rls.sql)의 inline `exists(select … from challenges …)`는 **호출자 권한으로 평가돼 challenges 의 SELECT RLS(멤버만)에 막혀 무효** → 비멤버는 행 자체를 못 봐서 여전히 거부. [`0052`](supabase/migrations/0052_browse_vote_rls_fix.sql)에서 **SECURITY DEFINER 헬퍼 `is_browse_visible()`**로 교체(`is_member_of`/`is_open_challenge`와 동일 패턴)해 해결. 교훈: RLS 정책 안 서브쿼리는 SECURITY DEFINER 헬퍼로. **DB(RLS)만 수정 — 클라/OTA 불필요**, 운영 적용·검증 완료(운영 ✓)

### 신규 코드 위치 (v2.19 — 검수 숨김 강도 완화 + 숨김 정직화(플레이스홀더), 2026-06-18)
**AI 검수가 책 감상 기록을 과민 `flag`→`hidden=true` 로 조용히 숨겨 작성자조차 못 보던 문제.** 에러 없이 저장 성공음만 울려 "게시물이 어디로 갔지" 체감 (FEEDBACK #44). 검수 자체는 유지 — 우회/백도어 아님(rule #5).
- **숨김 강도 완화**: [`db.ts`](mobile/lib/db.ts) `moderateUgcText` — **명백한 위반(`block`)만 작성 차단**, `flag`(경계선 의심)는 더 이상 자동 숨김 안 함(`return false`). 사람 검토 큐가 없는 상태에서 AI 추측만으로 선량한 글(책 감상문 등)이 증발하던 경로 제거. 댓글·기록·완주이야기·대화 **전 UGC 공통**. 잔여 안전망 = AI block + 신고 3건 누적 자동숨김(0047 트리거)
- **숨김 정직화(플레이스홀더)**: `fetchLogs`·`fetchRecentLogs` 가 `.eq('hidden',false)` 제거 + `hidden` 반환(`LogWithAuthor.hidden`). 숨김 기록은 목록에서 증발시키지 않고 카드 자리에 **"🙈 숨김 처리된 기록이에요"**([`LogTab` LogCard](mobile/components/challenge/LogTab.tsx)·[`record.tsx` RecordCard](mobile/app/(tabs)/record.tsx) — 작성자·날짜 헤더 유지). 참여/응원 인원이 "여기 가려진 게 있다"를 모두 목격
- 결정(2026-06-18): ① block 만 차단·flag 비숨김(범위·강도 확 낮춤) ② 숨겨야 하면 그 자리에 숨김 메시지 노출(증발 금지) ③ 기존 오판 숨김 기록은 `update logs set hidden=false where hidden=true` 로 복구
- **배포**: 마이그레이션·EF 변경 없음(JS만) → OTA(preview·production 양 채널). 검증 tsc 0 + npm test 71/71

### 신규 코드 위치 (v2.20 — 회원 탈퇴(계정 삭제), 0053, 2026-06-18)
**구글·애플 의무 = 앱 내 계정 삭제. 출시 차단 #4 해소.** ⚠️ 모든 콘텐츠 FK 가 `on delete cascade` → auth.users 하드삭제 시 개설 방·동료 인증·댓글까지 연쇄 파괴 = **동료 박제 파괴** → 하드삭제 금지, **익명화 + auth ban** 이 정답(박제 영구·동료 보호 정체성과 합치). (LAUNCH_CHECKLIST #4)
- **DB [`0053_account_deletion.sql`](supabase/migrations/0053_account_deletion.sql)**: `users.deleted_at` 표식 컬럼만 추가(실제 처리는 EF). 박제 테이블 아님 → 자동만료 무관(rule #3)
- **EF [`delete-account`](supabase/functions/delete-account/index.ts)** (service role + JWT 본인확인 — 삭제 대상은 **JWT 에서만** 도출, body 무시 → 남의 계정 삭제 차단): ① PII 즉시 삭제(`user_verifications`·`device_tokens`·`user_interests`·`notification_prefs`·`notification_queue`·내가 건 `blocks`) ② `users` 익명화(nickname→"탈퇴한 사람", email·google_sub·avatar_url→null, deleted_at set → 공유 콘텐츠 작성자 자동 익명) ③ 활성 `challenge_members.gave_up_at` set(진행 도전 종료, proofs·박제 보존) ④ auth `ban_duration:'876000h'`(재로그인 영구차단) + email/메타 스크럽(best-effort). 공유 콘텐츠(인증·댓글·기록·대화·완주이야기·다짐·평가)·`gift_orders`(법적 보관)는 보존
- **클라**: [`auth.ts`](mobile/lib/auth.ts) `deleteAccount`(EF 호출 후 signOut) + [`profile.tsx`](mobile/app/(tabs)/profile.tsx) 로그아웃 아래 "계정 삭제"(빨강 링크) → `DeleteAccountModal`(2단계: 영향 안내+확인 체크박스 → 최종 재확인 Alert)
- 결정(2026-06-18): ① 익명화+비활성(하드삭제 X) ② **즉시**(유예 없음) ③ **사진 보존(익명)** — 동료 박제 보호, r2-delete 불필요 ④ gift_orders 보존 ⑤ **재가입 영구차단(ban)** — 단 안내에 "다른 계정으론 새로 시작 가능" 고지+체크박스
- **배포 완료 (⚠️ migration 먼저, 2026-06-18)**: 0053 운영 DB 적용 ✓ → `delete-account` EF 배포 ✓ → 클라 OTA(preview·production 양 채널) ✓. 네이티브 빌드 불필요(JS만). 검증 tsc 0 + npm test 71/71. ※ 실기기 확인 권장: 탈퇴 후 ①재로그인 차단 ②동료 방에 "탈퇴한 사람" 잔존 ③진행 방에서 빠짐. **delete-account EF 는 순수 계산/파싱 아닌 service-role 오케스트레이션 → 단위 테스트 비대상**

### 신규 코드 위치 (v2.21 — 내역 가독성 3종: 하다 구경 칩·끝낸 진행바·한잔/다짐 내역, 2026-06-19)
**전부 순수 JS(마이그레이션·EF 무변경) → OTA(preview·production 양 채널 배포 ✓). 검증 tsc 0 + npm test 71/71.**
- **하다 구경 분류 칩 잘림** (FEEDBACK #45): [`discover.tsx`](mobile/app/(tabs)/discover.tsx) 가로 필터 ScrollView 의 고정 `maxHeight:44` 가 이모지 칩(텍스트보다 줄높이 큼)을 위아래로 자름 — 텍스트만인 "전체"만 멀쩡했던 게 증거. 수정 = `filterChipText` 에 `lineHeight:18` 명시(칩 높이를 이모지·기기 무관하게 결정화) + 스크롤뷰 `height:48`(자동 높이 추정 의존 제거). ※1차 수정(maxHeight 제거→자동높이 의존)은 안 먹혀 lineHeight 고정으로 재수정
- **끝낸·포기 하다 진행바 회색** (FEEDBACK #45): 살아있는 주황 대신 차분한 회색(`primary300`). 내하다 끝낸 카드([my-challenges.tsx](mobile/app/(tabs)/my-challenges.tsx) `finished && progressFillDone`) + 챌린지방 진행률 바([room/[id].tsx](mobile/app/room/[id].tsx) `headerLocked && progressFillDone` = 종료||포기). 홈 끝낸 섹션은 진행바 자체가 없음(회색 "🏁 종료" 배지뿐)
- **한잔 내역 섹션 분리** (FEEDBACK #46): [`gifts.tsx`](mobile/app/gifts.tsx) FlatList→`SectionList` — 📤 건넨 / 📥 받은 / 🤝 내기(self-bet 라 방향 무관 별도 섹션, 빈 섹션 자동 숨김). 섹션 안 결과별 정렬 + 색 배지(받음 ☕ 주황 / 기부 💚 초록 / 대기 파랑 / 환불 회색). "기부 vs 내가 받은" 구분도 같은 배지로 충족 — 상태값(`delivered`=받음·`donated`=기부) 활용, DB 무변경
- **다짐 내역 (내정보, 신규)** (FEEDBACK #47): [`pledges.tsx`](mobile/app/pledges.tsx) — 무현금 다짐(0046)을 하다별 카드로, 상태 섹션(🏃 진행 중 / 🏆 완주한 하다 / 🌙 못 채운 하다)으로. 데이터 = [`db.ts`](mobile/lib/db.ts) `fetchMyPledges`(완주 판정은 방 화면과 같은 단일 소스 `stats.goalStatus`/`isFinished` 재사용 — KST·빈도·늦합류 비례·count 조기완주·포기=못채운). 끝난 하다는 결과×방향 '💛 지킬 차례'/'✓ 지켰어요' 칩(방 PledgeCard 와 동일 문구 🔻못 하면/🏆해내면), 카드 탭→방 현황 탭(`?tab=status`)에서 토글(화면은 보기 중심). 진입 = [profile.tsx](mobile/app/(tabs)/profile.tsx) "💛 다짐 내역"(무현금=전체 공개, 한잔 내역과 달리 파일럿 게이트 없음)

### 신규 코드 위치 (v2.22 — 갤S9 레이아웃 2종: 인증 응원칩 줄바꿈 · 하다 구경 칩 잘림, 2026-06-20)
**전부 순수 JS(마이그레이션·EF 무변경) → OTA(preview·production 양 채널 배포 ✓). 검증 tsc 0 + npm test 71/71. 둘 다 갤럭시S9(좁은 폭·Android) 재발 — 정적 검증만, 실기기 확인 권장.**
- **인증 응원칩 2줄 줄바꿈** (FEEDBACK #48 · #29 갤S9 재발): [`room/[id].tsx`](mobile/app/room/[id].tsx) — #29 에서 칩을 `cheerChipsWrap`(flexShrink·wrap)로 묶어 한잔 버튼은 고정했으나, 좁은 폭에선 칩 4개가 wrap 안에서 3+1 두 줄로 꺾임(본인 카드 '☕ 한잔 도착'은 라벨이 길어 폭을 더 먹음). 수정 = 폭 축소 — 칩 `paddingHorizontal 12→8`·`minWidth 44→40`, 칩 간격·행 간격 `8→6`, 한잔 버튼 `paddingHorizontal 12→8`. S9 가용폭(≈292dp = 360 − feed/card padding) 안으로 들어옴(2카운트+한잔도착 ≈320→280dp). `flexWrap:'wrap'` 은 극단(4종 두자리 카운트+한잔도착) 폴백으로 유지(잘림 방지). 기록(LogTab) 응원은 ❤️/💬 2개뿐이라 줄바꿈 구조 없음
- **하다 구경 분류 칩 세로 잘림** (FEEDBACK #48 · #45 갤S9 재발): [`discover.tsx`](mobile/app/(tabs)/discover.tsx) — #45 의 `lineHeight:18`+`height:48` 고정은 iOS 기준이라, Android 는 `includeFontPadding:true`(기본)+이모지 intrinsic 줄높이가 더 큰 세로 공간을 잡아 칩이 고정 48 박스에 잘림. 시스템 글자 2단계 축소해도 그대로 = **폰트 스케일 무관**(원인=폰트 패딩) 확인. 수정 = `filterChipText` 에 `includeFontPadding:false`(Android 폰트 패딩 제거, iOS 무영향) 한 줄

### 신규 코드 위치 (v2.23 — 초대장 스크롤 불가(긴 안내문 시 합류 버튼 닿지 않음), 2026-06-21)
**순수 JS(마이그레이션·EF 무변경) → OTA(preview·production 양 채널 배포 ✓). 검증 tsc 0. 안드로이드 초대→합류 차단 버그.**
- **초대장 스크롤 불가** (FEEDBACK #49): [`invite/[id].tsx`](mobile/app/invite/[id].tsx) — 카톡 초대 링크로 진입하는 하다 인연 초대장에 `ScrollView` 가 없어, 안내문(`description`)+개설자 한마디(`invitation_message`)가 길면 중앙 정렬(`center`: `flex:1`+`justifyContent:'center'`)된 카드가 화면 위아래로 넘쳐 하단 '함께 하기' 버튼에 닿을 수 없었음(안드로이드는 시스템 내비바까지 겹쳐 더 심함, 링크만 보내도 안내문/한마디는 챌린지 데이터라 그대로 렌더). 수정 = 본문을 `ScrollView` 로 감싸고 컨테이너 `flex:1→flexGrow:1`(+`justifyContent:'center'`·`paddingVertical:24`) → 짧으면(로딩·에러) 중앙 정렬 유지, 길면 끝까지 스크롤. `Screen` 이 하단 SafeArea(`edges` bottom) 보정 → 버튼이 내비바 위로 확보. **`flexGrow`(≠`flex`)** 라야 넘칠 때 카드 위가 안 잘리고 스크롤됨

### 신규 코드 위치 (v2.24 — 월드와이드 prosocial: 파장·하루 리듬·무대 토대, 2026-07-07)
**단일 진실원천: [`docs/WORLDWIDE_EXECUTION_PLAN.md`](docs/WORLDWIDE_EXECUTION_PLAN.md) (실행) + [`BLUEPRINT.md`](BLUEPRINT.md) 3.5절 (비전).** "소비가 아니라 기여가 지위가 되는 SNS" — 자랑을 '나눔=초대'로 구원. 정체성 게이트 승계(비교/랭킹/거대숫자 단독 금지).
- **탭바 재구성**: [`_layout.tsx`](mobile/app/(tabs)/_layout.tsx) — ⊕(생성)를 우하단 FAB로, 하단 5탭 = 홈/내도전/**파장**/기록/해냈어요 (create-tab 은 `href:null` 라우트만 유지).
- **W1 파장 탭 (선한 영향력)** — 초기엔 나→우리→세상 3층 대시보드였으나 **v2.26에서 기여 피드로 재설계됨(WaveLayer 삭제, 아래 v2.26 참조)**. 집계 RPC [`0057_parang_stats.sql`](supabase/migrations/0057_parang_stats.sql) `parang_stats()` SECURITY DEFINER(신원 0)는 **슬림 헤더**로 존속. db=`fetchParangStats`. ⚠️ 파일번호: 기존 0054·0055(browse fix/restore, 문서 미기재분)와 충돌로 parang을 **0057**로 재번호(함수 이미 운영 반영).
- **W2 하루 리듬 + 지금 함께**: DB=[`0056_daily_notes.sql`](supabase/migrations/0056_daily_notes.sql) `daily_notes`(아침 다짐/저녁 회고, KST 서버날짜, 1일1kind upsert, RLS `shares_challenge_with`) + `presence_now()` int RPC(내 하다 멤버 최근 30분 활동, 신원 0). UI=[`components/home/`](mobile/components/home/) `PresenceLine`·`DailyRhythmCard`·`DailyNoteComposeSheet`·`FellowReflections`, [`home.tsx`](mobile/app/(tabs)/home.tsx)는 import+3배치만. **아침/저녁=인앱 프롬프트만(푸시 없음)**. db=`createDailyNote`(moderateUgcText 내부)·`fetchMyDailyNote`·`fetchFellowReflections`·`fetchPresenceNow`. KST 15시=아침↔저녁 경계.
- **W3 Step 1 무대 토대 (3계층)**: DB=[`0058_host_tier.sql`](supabase/migrations/0058_host_tier.sql) `challenges.host_tier`(individual/figure/org, kind와 직교)·`host_label`(주최자명). [`HostBadge.tsx`](mobile/components/HostBadge.tsx)(individual→null, ⭐명사/🏛️공식) → 현황 탭·홈 JoinCard 2곳. **명사/조직 지정 = 수동 운영 SQL만**(`update challenges set host_tier='figure', host_label='유재석' …`), 셀프서비스 없음.
- **보류(scale-gated 🅰 — 조기 투자 금지=코드 부풀리기 방지)**: pod 연합(W3 Step2)·cap-exemption·광고+스폰서십(W4)·i18n(Phase G). **착수 트리거**는 실행 SoT의 "W3 착수 조건" 참조(첫 host 온보딩 시 cap-exemption / 한 하다 100명+·대형 유입 host 직전 = pod). W1·W2·W3-1 전부 운영 DB 적용 + OTA preview·production 완료.

### 신규 코드 위치 (v2.25 — 운영자(Admin) 콘솔, 2026-07-07)
**앱 내 운영 도구. SoT = [`docs/WORLDWIDE_EXECUTION_PLAN.md`](docs/WORLDWIDE_EXECUTION_PLAN.md) "운영자(Admin) 콘솔" + 메모 `project_admin-console`.**
- **admin 식별 = `users.is_admin`** (mirr0505@gmail.com만 true, [`0059_admin.sql`](supabase/migrations/0059_admin.sql) seed). 추가 = `update users set is_admin=true where email='…'`.
- DB: [`0059_admin.sql`](supabase/migrations/0059_admin.sql) — `is_admin()` SECURITY DEFINER 헬퍼 + admin RPC 6종(`admin_list_reports`·`admin_set_content_hidden`·`admin_resolve_report`·`admin_list_hidden`·`admin_set_host_tier`·`admin_search_challenges`). 신고·숨김은 0047 재활용(target_type↔테이블 매핑 = `apply_report_autohide` 미러). db.ts 래퍼 7종(`fetchIsAdmin`·`adminListReports`·…).
- 🔒 **보안 불변식**: admin RPC는 전부 SECURITY DEFINER라 RLS 우회 → **반드시 첫 줄 `is_admin()` 검사, 아니면 raise**(게이트 없으면 아무 로그인 사용자나 전체 신고·콘텐츠 열람/수정 = 치명적). 클라 게이트는 UX용. **새 admin RPC 추가 시 무조건 is_admin() 먼저.**
- UI: [`admin.tsx`](mobile/app/admin.tsx)(checking/ok/denied 방어) + [`components/admin/`](mobile/components/admin/) `ReportQueue`(신고큐)·`HostTierAssign`(명사/조직 지정)·`HiddenRestore`(숨김 복구). 진입점 = 프로필 하단 "🛠 운영자 콘솔"(is_admin만). Phase A 스코프. Phase B(후속) = ban·운영지표·결제(당장 SQL). 0059 적용 + OTA 완료.

### 신규 코드 위치 (v2.26 — 파장 = 기여 피드 재설계, 2026-07-08)
**파장 탭이 "숫자 대시보드"→"피드"로 진화(WaveLayer 삭제). "자랑질과의 화해": 좋아요 없이 '움직인 사람 수'가 화폐. SoT=[`docs/WORLDWIDE_EXECUTION_PLAN.md`](docs/WORLDWIDE_EXECUTION_PLAN.md) "W1-b".**
- 🎨 **비주얼 규칙(엄수)**: 데코 이모지 금지 → **lucide 라인 아이콘만**(네비바 톤). **신규 색 금지** → tokens 기존 팔레트만(응원4+평가4=8색 외 X), 피드=중립+브랜드 오렌지, 색은 반응 활성 상태만.
- **v1 자동 이벤트**: DB=[`0060_parang_feed.sql`](supabase/migrations/0060_parang_feed.sql) `parang_feed()` SECURITY DEFINER(참조∪완주∪기부, 신원 0). [`FeedCard.tsx`](mobile/components/parang/FeedCard.tsx)(Repeat/Trophy/HeartHandshake). db=`fetchParangFeed`. parang.tsx=슬림 3수치 스트립+FlatList 피드.
- **v2 사용자 글+반응**: DB=[`0061_parang_posts.sql`](supabase/migrations/0061_parang_posts.sql) — proofs/logs `share_to_parang`·`parang_anon` 컬럼 + `parang_reactions`(용기받았어요, 본인만 RLS) + `parang_posts()` RPC(**익명이면 author null**, 비익명은 의도된 신원 노출). UI=[`PostCard.tsx`](mobile/components/parang/PostCard.tsx)(User/Footprints/Heart). 인증([`checkin/[id].tsx`](mobile/app/checkin/[id].tsx))·기록([`LogTab.tsx`](mobile/components/challenge/LogTab.tsx) `createLog`) 작성에 **"파장에 나누기"+"익명" 토글**(기본 OFF, **updateLog 제외**). 반응=나도할래요(→`create?ref=` 따라하기 0050 재활용)·용기받았어요(toggle). **좋아요·랭킹 없음**, "움직인 수"=reference_count 은은하게.
- 중복: donation·reference는 파장 고유, completion은 해냈어요와 소재 겹치나 altitude 달라 **유지(ⓐ)**. 0060·0061 적용 + OTA preview·production 완료.

### 신규 코드 위치 (v2.27 — 알림·완주이야기·기록·다짐·파장 다듬기, 2026-07-08)
**전부 클라 위주(파장 사진만 마이그레이션). 실기기 확인 완료. OTA preview·production 배포 완료.**
- **아침 인사 앱 내 노출**: 08시 로컬 "아침 인사"(요일별 7개, [`notifications.ts`](mobile/lib/notifications.ts))가 배너에 텍스트 없이 "Do:하다"만 뜬 건 **iOS "미리보기 표시: 안 함"** 설정 탓(앱 버그 아님, 코드로 못 덮음 → 메모 `reference_ios-notif-show-previews`). 해법=알림 탭 시 홈에서 그날 인사말 노출: [`notifications.ts`](mobile/lib/notifications.ts) `todayGreeting()`(요일별 단일소스) + [`_layout.tsx`](mobile/app/_layout.tsx) 로컬 알림 탭 → `홈?greet=<ts>`(워밍 탭도 홈 이동 확실화) + [`home.tsx`](mobile/app/(tabs)/home.tsx) 상단 인사말 카드(× 닫기). 아침 인사는 서버푸시 아님(data.kind 없음 → 알림함 안 열림).
- **완주이야기 위계 반전**: [`done/[id].tsx`](mobile/app/done/[id].tsx) — 이 화면의 **주 행동 = "용기 받았어요"**(읽은 이가 글쓴이에게 되돌리는 제스처)로 격상: 주황 2px 테두리·전폭·큰 버튼(활성=주황 채움), **카운트 0·1 항상 노출**(`용기 받았어요 · N`). "나도 시작하기" CTA는 **보조 아웃라인**으로 낮춤. (메모 `project_completion-story-hierarchy` — 위계 반전 금지)
- **기록 이어보기 정밀 착지**: [`record.tsx`](mobile/app/(tabs)/record.tsx) "이어 보기" → `?tab=log&logId=${log.id}`(맨 위 아님, 그 기록 카드로 스크롤 포커스 — 알림 딥링크 인프라 재사용). 5탭 컨텍스트 보존 사상 유지(단일 상세 라우트 안 만듦).
- **오늘 다짐/회고 카드 홈→내 하다 이동**: 개인적 다짐 = 내 하다 맥락. [`home.tsx`](mobile/app/(tabs)/home.tsx)에서 제거 → [`my-challenges.tsx`](mobile/app/(tabs)/my-challenges.tsx) FlatList `ListHeaderComponent`(제목 바로 밑·paddingHorizontal 20 카드 너비 일치·내 하다 0개면 숨김) + 다짐 카드 아래 구분선. [`DailyRhythmCard.tsx`](mobile/components/home/DailyRhythmCard.tsx) 완료상태 배경 흰색→**accent50 틴트**(흰 챌린지 카드와 구분). **①지금 함께(PresenceLine)·③동료 회고(FellowReflections)는 홈 유지**(쓰기=내 하다 / 읽기·목격=홈).
- **파장 3종 다듬기**: ① 사진 여러 장 — [`0062_parang_photo_urls.sql`](supabase/migrations/0062_parang_photo_urls.sql) `parang_posts()` drop·재생성으로 `photo_urls[]` 반환(폴백 `[photo_url]`) + [`db.ts`](mobile/lib/db.ts) `ParangPost.photo_urls` + [`PostCard.tsx`](mobile/components/parang/PostCard.tsx) `PhotoCarousel`(방·홈처럼 좌우 스와이프). ② 누적=이벤트 30+글 30 최신순 병합, 무한스크롤 없음(오래된 건 조회 제외, 정상). ③ 나열식 개선=**위계 차등**: [`FeedCard.tsx`](mobile/components/parang/FeedCard.tsx) 자동 이벤트를 테두리·흰배경 없는 **옅은 앰비언트 라인**(작은 아이콘·sub 톤)으로 낮춰 사용자 글(PostCard)이 주인공. **⚠️ 0062 migration 먼저**(운영 적용 완료) → OTA.
- **파장 반응 위계(PostCard)**: [`PostCard.tsx`](mobile/components/parang/PostCard.tsx) — "용기받았어요"를 **좌측·주 버튼**(브랜드 테두리·굵은 글씨, 활성=주황 채움), "나도 할래요"를 **우측 끝·보조**(중립 테두리·흐린 글씨)로. `justify-content: space-between`. 완주이야기 위계와 동일 결(주 메시지=글쓴이에게 용기 되돌리기).
- **홈 "오늘의 인증" 카드 딥링크**: [`home.tsx`](mobile/app/(tabs)/home.tsx) `TodayProofCard` 탭 → `?tab=proof&proofId=${proof.id}`(방 인증 탭에서 그 인증글로 스크롤 포커스 — 기록 이어보기와 동일 인프라). 기존엔 `/room/${challenge_id}` 로만 가 엉뚱한 화면.
- **지금 함께(PresenceLine) 문구·정렬**: [`PresenceLine.tsx`](mobile/components/home/PresenceLine.tsx) — "지금 N명…각자의 하다를" → **"최근 30분, 동료 N명이 함께 걷고 있어요."**(30분 활동 = 정직·명료) + `alignSelf:flex-start` 제거·`marginHorizontal:20`(peekBar·카드와 정렬, 좌측 치우침 해소).
- **업데이트 소식 모달**: OTA는 조용히 적용돼 테스터가 업데이트를 모름 + iOS 외부채널 없음 → 앱 내 유일 알림. [`releaseNotes.ts`](mobile/lib/releaseNotes.ts) `RELEASE_NOTE`(tag·lines·tip) + [`WhatsNewModal.tsx`](mobile/components/WhatsNewModal.tsx)(홈 마운트, tag 바뀌면 1회 노출→SecureStore 저장). **운용=알릴 소식 있는 OTA만 tag 갱신**(조용히 낼 땐 tag 유지, 정식 땐 tag=''). tip에 강제종료 2회 안내. (메모 `project_update-news-modal`)

### 신규 코드 위치 (v2.28 — 파장→공명 리브랜드 + 공명 인라인 댓글(0063), 2026-07-13)
**"파장"의 UI 카피를 전부 "공명"으로 리브랜드(코드 식별자 `parang`·주석은 유지 = 하다 리브랜드 원칙, 리스크 최소) + 공명 글에 익명 인라인 댓글 추가. SoT=[`docs/WORLDWIDE_EXECUTION_PLAN.md`](docs/WORLDWIDE_EXECUTION_PLAN.md) "W1-b".**
- **리브랜드(UI만)**: 탭명·[`parang.tsx`](mobile/app/(tabs)/parang.tsx) 화면 제목·빈 상태·푸터·인증([`checkin/[id].tsx`](mobile/app/checkin/[id].tsx))·기록([`LogTab.tsx`](mobile/components/challenge/LogTab.tsx))의 "공명에 나누기" 토글까지 사용자 노출 "파장"=0. 반응 버튼 "용기받았어요"→**"공명해요"**([`PostCard.tsx`](mobile/components/parang/PostCard.tsx)). ※ 완주이야기의 "용기 받았어요"는 별개 기능이라 유지.
- **ripple 문구**: reference>0 → "이 공명에 N명이 반응했어요"(=따라 시작한 사람) / reference·공명해요(로컬 count) 둘 다 0 → "아직 조용하지만, 누군가 보고 있어요" / **공명해요만 있으면 라인 숨김**(모순 방지 — count 로컬 반영이라 누르면 즉시 사라짐).
- **공명 인라인 댓글 (0063)**: DB=[`0063_parang_comments.sql`](supabase/migrations/0063_parang_comments.sql) — `parang_comments`(target proof/log·content·**anon 기본 true**·hidden) + `parang_comments()` **SECURITY DEFINER RPC**(익명이면 작성자 null·`mine` 불리언으로만 삭제 노출=**신원 역추적 차단**·차단/숨김 내부 필터) + `parang_posts()` 재생성(`comment_count` 추가). db=`fetchParangComments`·`addParangComment(anon)`·`deleteParangComment`(검수 moderateUgcText 재사용). UI=[`ParangComments.tsx`](mobile/components/parang/ParangComments.tsx)(신규) — "댓글 N개" 탭→**인라인 펼침(모달 아님)**·익명 토글 기본 ON(끄면 실명 닉네임)·**수정 없음 삭제만**. 댓글 있으면 아이콘·글씨 브랜드색 강조.
- **사진 전체화면 복구**: PostCard 사진 탭 → `PhotoViewer`(방·홈과 동일 — PhotoCarousel `onPressPhoto` 누락됐던 것).
- **키보드 인셋**: 공명 FlatList `automaticallyAdjustKeyboardInsets`(iOS)+`keyboardShouldPersistTaps` — 인라인 입력창 키보드 가림 해소(iOS 확인). ⚠️ Android 키보드는 미검증(edge-to-edge 별도 보정 가능성).
- **결정(2026-07-13)**: ① 리브랜드=UI만(코드 parang 유지) ② 댓글 익명 기본 ON·per-comment 토글 ③ 인라인(모달 X)·"댓글 N개" 탭 펼침 ④ 수정 없음 삭제만 ⑤ ripple은 reference+공명해요 둘 다 0일 때만.
- **배포 (⚠️ 0063 migration 먼저, 운영 적용 완료)**: 리브랜드 OTA → 0063 적용 → 댓글·사진 OTA → 키보드·색상 픽스 OTA. 전부 preview·production 완료. 검증 tsc 0 + npm test 71/71.

### 신규 코드 위치 (v2.29 — 하루 기준선(사용자별 시간대) + 사진 업로드 재시도, 0077, 2026-08-19)
**하루 경계가 앱 전체에 KST 하드코딩이라 해외 거주·출장 사용자가 인증을 놓치던 버그.** 런던(BST)에서 KST 자정 = 현지 오후 4시 → 오후 4시 이후 인증이 "내일"로 저장 → 그날은 미인증 + 다음 날은 1일 1회 제약에 막힘 = **이틀이 하루로 뭉개짐**(연속 끊김·완주 일수 손실). 해외 거주 베타 사용자 피드백.
- ⚠️ **유니크 인덱스 식은 다른 테이블(users)을 참조할 수 없다**(immutable 식만) → `proofs.local_date` 컬럼에 **저장 시점의 작성자 기준 날짜**를 트리거로 박고, 유니크 인덱스·연속 트리거를 그 컬럼으로 옮기는 게 이 설계의 핵심(0049 교훈의 연장).
- DB [`0077_user_timezone.sql`](supabase/migrations/0077_user_timezone.sql): ① `users.timezone`(IANA, 기본 Asia/Seoul)+`timezone_updated_at` + `grant update (timezone)`(0068 컬럼 가드 유지) + 검증 트리거(알 수 없는 시간대 거부 · **변경 하루 1회** — 경계를 밀어 '놓친 하루' 되살리는 어뷰징 차단) ② `user_timezone(uuid)` SECURITY DEFINER 헬퍼 ③ `proofs.local_date` + `set_proof_local_date` 트리거(**이름 순서가 실행 순서** — goal_type→local_date→streak) + KST 백필(과거 재해석 금지) ④ `set_proof_streak`(0044)·`uniq_proofs_per_day`(0049) 를 local_date 기준으로 교체 ⑤ `is_within_challenge_period`(0028) 를 인증하는 사람의 시간대로 ⑥ `daily_notes.note_date` 기본값도 동일(안 바꾸면 해외 사용자가 자기 회고를 못 찾음)
- 클라 [`timezone.ts`](mobile/lib/timezone.ts)(신규 · 단일 소스): 활성 시간대 모듈 상태(`setActiveTimezone`/`getActiveTimezone`) + `getTodayRange()`(구 `getKstTodayRange`, format.ts 는 재수출만) + `toLocalDateStr`·`getLocalHour` + `TIMEZONE_OPTIONS`. Intl 기반이되 **엔진이 timeZone 을 못 다루면 기기 오프셋 폴백**(Hermes 편차 대비). 부트스트랩 = [`_layout.tsx`](mobile/app/_layout.tsx) 세션 로드 시 `fetchMyTimezone`→`setActiveTimezone`
- 판정 경로: [`stats.ts`](mobile/lib/stats.ts) 는 인증 날짜를 **`local_date` 우선**(`proofDateStr`)으로 묶는다 — 동료가 해외에 있어도 그 사람의 하루로 센다. streak 루프는 ms 가 아니라 **날짜 문자열로 하루 물러나기**(서머타임 23·25시간 날 겹침/건너뜀 방지, [`db.ts`](mobile/lib/db.ts) 도 동일)
- UI: [`profile.tsx`](mobile/app/(tabs)/profile.tsx) "하루 기준선" 섹션 + `TimezoneEditModal`(목록 + 기기 시간대 상단 노출) + **기기와 다르면 "지금 계신 곳은 런던이에요" 배너**(자동 변경은 안 한다 — 잠깐의 시차 이동으로 경계가 밀리면 안 됨). [`DailyRhythmCard`](mobile/components/home/DailyRhythmCard.tsx) 아침/저녁 15시 경계도 기준 시간대
- 결제(자동 테스트 의무): [`betOutcome.ts`](supabase/functions/_shared/payments/betOutcome.ts) 가 `proofDates`(=local_date)+`timezone` 을 받도록 교체(구 `proofIso`/`todayKst` 제거), [`claim-gift`](supabase/functions/claim-gift/index.ts) 가 local_date·users.timezone 조회. 테스트 = `self-bet-outcome`(런던 케이스 2건 추가) + [`timezone-day-boundary.test.ts`](__tests__/timezone-day-boundary.test.ts)(신규)
- **2단계 완료 (2026-08-19)**: 알림 조용시간 22~06시([`flush-notifications`](supabase/functions/flush-notifications/index.ts))도 **수신자별 시간대**로. 전역 판정(KST 22-6) → 수신자별 분기: 지금 그 사람의 밤인 알림만 **그 사람의 아침 6시**로 미룬다(깨어날 시각이 다르므로 같은 시각끼리 묶어 update). 일별 상한 창(하루)도 수신자 현지 자정 기준으로 자름. 시간대 계산은 Deno 내장 ICU(`Intl`) — 30·45분 오프셋(인도 +5:30)과 서머타임 전환 주간까지 확인. ⚠️ **배포는 반드시 `--no-verify-jwt`**(빠뜨리면 cron 401 → 푸시 전멸). `recruitCloseAtMs`(모집 마감)는 방 단위 시각이라 KST 유지
- **배포 (⚠️ migration 먼저)**: 0077 적용 → `claim-gift` EF 배포 → 클라 OTA. **순서 어기면 `local_date` 컬럼이 없어 홈·프로필 쿼리가 깨진다**(구 클라는 무영향)
- **사진 업로드 재시도**(같이 배포): [`upload.ts`](mobile/lib/upload.ts) — presign(EF)·R2 PUT 이 네트워크 단계에서 실패하면 0.6s·1.5s 백오프로 최대 3회. 4xx(서버가 응답한 오류)는 재시도 안 함. 최종 실패는 영어 원문 대신 한국어 안내. 인증·기록·프로필·안내문·완주이야기가 이 함수를 공유

### 신규 코드 위치 (v2.30~v2.33 — 완주/성공 분리(0078) + 광장 IA 2단계 + 무대 자동화·가드(0079~0083), 2026-08-20~08-24)
> ⚠️ **파일 근거로 복원한 기록이다.** 이 구간은 커밋되지 않은 작업 트리 상태로 남아 있어 CLAUDE.md 에 빠져 있었다.
> 마이그레이션 헤더 주석·코드·`releaseNotes.ts` 를 근거로 재구성했으며, **운영 DB 적용 여부는 이 문서가 보증하지 않는다**(SQL Editor 이력으로 확인할 것). 버전 경계도 편의상 한 덩어리로 묶었다.
- **완주 ≠ 성공 두 축 + 잠시 멈춤 이력** ([`0078_success_threshold_pause.sql`](supabase/migrations/0078_success_threshold_pause.sql)): 목표를 100% 채워야만 완주라, 100일 하다에서 출장·병원으로 8일을 놓치면 92일을 걸어도 "실패"로 찍히던 문제. **완주 = 포기하지 않고 끝까지 감**(박제·해냈어요 자격) / **성공 = 개설 시 정한 임계를 채움**(완주 화면·내기 정산·스폰서 기부·다짐 정산)으로 축을 나눈다. `challenges.success_threshold`(100/95/90, **기본 100 → 기존 하다 동작 완전 불변, 백필 없음**) + `challenge_pauses` 이력 테이블(구 `paused_until` 은 날짜 하나뿐이고 재개 시 지워져 이력이 안 남았다 — 이 숫자가 내기 금액을 좌우하므로 **지우지 않고 쌓아 감사 가능하게**). 클라 = [`stats.ts`](mobile/lib/stats.ts) `didFinishThrough`/`isSuccess`·`PAUSE_CREDIT_RATIO=0.1`(멈춤 인정 상한 10%). 🔒 **판정을 SQL 로 복제하지 않는다** — 단일 진실원천은 `stats.ts`, DB 는 재료(임계·멈춤 구간)만 저장. 테스트 = [`success-completion.test.ts`](__tests__/success-completion.test.ts)(내기·기부·다짐 정산 근거라 자동 테스트 의무 영역). 메모 `project_completion-vs-success`
- **광장 탭 (IA 2단계)** ([`discover.tsx`](mobile/app/(tabs)/discover.tsx)·[`_layout.tsx`](mobile/app/(tabs)/_layout.tsx)): 하단 탭 = **홈 · 광장 · 공명 · 기록 · 해냈어요**(생성 ⊕ 는 우하단 FAB). '내 하다' 탭은 내려오고 **라우트만 남는다**([`my-challenges.tsx`](mobile/app/(tabs)/my-challenges.tsx) — 홈 '모두 보기'·내 정보 '끝낸 하다'로 push 진입, 자체 뒤로가기 필수). 광장 = ① 🏛️ 무대 ② 🌍 지금 합류할 수 있는 하다 ③ 🔭 하다 구경 3단, **세 섹션 모두 최신순 고정**(참여자 수·인기 정렬 금지). 홈은 '나와 내 동료의 오늘'만 남기고 누구나 합류·하다 구경을 광장으로 이사. 메모 `project_stage-and-plaza`
- **무대 자동화·가드 4종** — 무대(`challenges.host_tier`)와 사람(`users.host_tier`)은 **서로 다른 축**이라 합치지 않되, 끊겨 있던 지점만 잇는다:
  - [`0079_host_tier_open_guard.sql`](supabase/migrations/0079_host_tier_open_guard.sql) — 무대 지정은 **`kind='open'` 에만**. 비멤버 SELECT 가 open 에만 열려 있어(0003) closed/cheered/solo 에 무대를 찍으면 **광장에 영영 안 뜨는 조용한 실패**가 된다. 지정 시점에 막는다.
  - [`0080_figure_stage_auto.sql`](supabase/migrations/0080_figure_stage_auto.sql) — 사람이 명사로 승격되면(누적 1,000명 심사, 0067) **그 사람의 하다에 무대 표식이 따라 붙는다**. 이전엔 승격이 아바타 금빛 링 하나뿐이라 무대에 서려면 운영자가 하다마다 손으로 지정해야 했다.
  - [`0081_admin_user_tier.sql`](supabase/migrations/0081_admin_user_tier.sql) + [`UserTierAssign.tsx`](mobile/components/admin/UserTierAssign.tsx) — **운영팀이 섭외해 데려온 명사**를 검색해 직접 지정(소급·알림 포함). 1,000명 심사 큐와 **공존**하는 독립 경로("자라난 사람 → 심사 큐 / 섭외한 사람 → 직접 지정"). SQL Editor 로 users 를 직접 update 하면 소급이 빠져 반쪽 승격이 된다.
  - [`0082_figure_recruit_exempt.sql`](supabase/migrations/0082_figure_recruit_exempt.sql) — 명사 무대도 모집 캡(0043) 면제. 안 그러면 광장에 카드는 떠 있는데 기간 50% 후엔 눌러도 합류가 안 된다. ⚠️ org 와 달리 **figure 는 `kind='open'` 일 때만** 면제.
  - [`0083_org_account_guard.sql`](supabase/migrations/0083_org_account_guard.sql) — 공식(org) 무대는 **조직 계정의 하다에만**. `challenges_creator_update`(0022)가 `creator_id` 이전을 원천 봉쇄해 **소유권 이전이 코드상 불가능**하므로, 담당자 개인 계정에 묶이면 퇴사 시 그 하다는 갈 곳이 없다. 메모 `project_org-hada-track`
- **문서 신설**: [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md)(개발/운영 환경 분리 — **계획만, 미착수**. 현재 development·preview·production 세 프로필이 전부 같은 Supabase·R2 를 본다) · [`docs/WEB_PLAN.md`](docs/WEB_PLAN.md)(제품 소개 사이트 트랙 SoT)

### 신규 코드 위치 (v2.34 — 광장 하다 구경 절제 + 홈 무대 분리·개설/참여 밴드 + 무대 2자리, 2026-09-08)
**전부 순수 JS(마이그레이션·EF 무변경) → OTA(preview·production 양 채널 배포 ✓). 검증 tsc 0 + npm test 135/135.**
- **하다 구경 = 내 관심 기본 + 3개만** ([`discover.tsx`](mobile/app/(tabs)/discover.tsx)): 광장 맨 아래 '하다 구경'이 항상 '전체'로 시작하고 최대 60장을 전부 나열해 끝없는 스크롤이 되던 문제. ① 관심을 1개 이상 등록했으면 `내 관심` 칩이 기본 활성 ② 카드는 `BROWSE_INITIAL_COUNT=3` 만 노출, `더 보기 (N개 남음)` 로 `BROWSE_STEP_COUNT=10` 씩 펼침(`visibleItems` = `filteredItems.slice`, 원본은 남겨 남은 개수를 정직하게 셈). **광장의 네 목록(⭐명사 무대 · 🏛️조직 무대 · `🌍 지금 합류할 수 있는 하다` · 하다 구경)이 첫 노출 3개를 공유**하되, 펼치는 단위는 목적에 따라 다르다 — 하다 구경은 훑어보는 라이브러리라 10개씩(`BROWSE_STEP_COUNT`), 무대·지금 합류는 한 장씩 읽고 합류를 정하는 목록이라 3개씩(`STAGE_STEP_COUNT`). ③ 칩 변경 시 3개로 리셋(`changeFilter` 단일 핸들러) ④ 필터 때문에 0개면 빈 상태에 `전체 보기` 탈출구 ⑤ 관심 미등록이면 `관심 분류를 정해보세요` 안내 카드 + `관심 정하기` → `/(tabs)/profile?interests=1`([`profile.tsx`](mobile/app/(tabs)/profile.tsx) 가 param 으로 관심 편집 모달 1회 자동 오픈). **안내 카드가 목록을 대체하지 않는다** — 하다 구경은 따라하기 유입 루프의 유일한 입구라 빈 화면이 되면 안 됨. 정렬은 최신순 고정(줄세우기 금지) 그대로.
  - ⚠️ **기본값은 "첫 load 1회만" 이 아니라 "사용자가 칩을 만지기 전까지"**([`discover.tsx`](mobile/app/(tabs)/discover.tsx) `filterTouched`). 세션 복원 전에 `useFocusEffect` 의 load 가 먼저 돌면 `myUserId` 가 없어 관심이 **0개로 조회**되고, "1회만" 이면 그 한 번으로 기본값 적용 기회가 영영 사라져 전체로 고정된다(실제로 발생 — 탭 lazy 마운트라 안 일어날 거라는 추측이 틀렸음). 메모 `reference_session-restore-load-race`
- **홈 = 무대 분리 + 개설/참여 2밴드** ([`home.tsx`](mobile/app/(tabs)/home.tsx)): 조직·명사 무대(`host_tier` figure/org)가 개인 하다와 같은 리스트에 섞여 있고, 개설/참여·방종류 구분이 카드 배지로만 있어 카드가 쌓이면 안 잡히던 문제. `isStageCh` 로 `stageActiveChs`/`personalActiveChs` 분리 → **앵커(오늘 할 일)는 개인 하다에서만** 뽑고, 렌더는 `내가 연 하다` → `참여 중인 하다` → `🏛️ 참여 중인 무대`(상한 `HOME_STAGE_LIMIT=3`) 순. 카드 JSX 는 `renderActiveCard(c)` 지역 함수로 **추출만**(내용 무변경) + 무대에만 `HostBadge` 한 줄. 밴드는 개설/참여 2개까지 — 방 종류는 카드 배지로 두고 밴드까지 4개로 쪼개면 홈이 관리 화면이 된다.
  - ⚠️ **`uncheckedChs` 는 손대지 않았다** — 인증 FAB·미인증 선택 모달은 무대까지 인증 대상으로 유지(무대를 홈에서 내리되 **인증 동선은 보존**). 대신 앵커가 없고 미인증이 남았으면(=무대만 미인증) `오늘 할 일을 다 했어요` 카드를 **렌더하지 않는다** — 개인 하다만 끝냈는데 "다 했어요"는 거짓말이 되고, 아래 무대 섹션이 그 역할을 맡는다.
- **광장 무대 = 명사·조직 2자리 상설** ([`discover.tsx`](mobile/app/(tabs)/discover.tsx)): 무대가 한 덩어리라 조직 하다가 하나라도 있으면 빈 상태 카드가 통째로 사라져 **명사 자리가 비어 있다는 사실 자체가 안 보이던** 문제. `stageItems` 를 `host_tier` 로 갈라 `figureItems`(⭐ 명사의 하다) / `orgItems`(🏛️ 조직의 하다) 두 하위 블록으로, **각 자리는 0개여도 "여기 열립니다" 카드를 지킨다**(무대 = 상설 자리 원칙). 명사 빈 자리엔 `보고 싶은 명사 제안하기` mailto(운영팀 수요 신호, 조직 제안과 같은 결). 카드 탭의 모집 마감 안내는 `onStagePress` 로 묶어 두 자리가 공유. `fetchStageChallenges` 가 이미 두 종류를 다 받아와 **DB·쿼리 변경 없음**.
- 결정(2026-09-08): ① 관심 미등록이면 안내 + **전체 3개는 그대로 노출**(0개 아님) ② 첫 노출은 네 목록 모두 3개, 더 보기는 하다 구경 10개씩 / 무대·지금 합류 3개씩 ③ 무대는 홈에서 **빼되 없애지 않음**(별도 섹션) ④ 홈 밴드는 개설/참여 2개까지 ⑤ 명사 빈 자리에도 제안 버튼(조직 카드와 대칭)

### 신규 코드 위치 (v2.35 — 무대 카드 합류 CTA + 따라하기 안내문 비복제, 2026-09-14)
**순수 JS(마이그레이션·EF 무변경) → OTA(preview·production 양 채널). 검증 tsc 0.**
- **무대 카드 CTA 3상태** ([`discover.tsx`](mobile/app/(tabs)/discover.tsx) `StageCard`·`onStagePress`): 무대 목록(`fetchStageChallenges`)은 누구나 목록과 달리 **참여 중·개설자에게도 노출**(상설 자리)이라, 카드 탭→미리보기→합류가 중복 합류 막다른 길이었음. `OpenChallengeCard.is_joined`([`types.ts`](mobile/lib/types.ts) · `mapOpenChallengeCard` 가 이미 받은 `challenge_members` 로 계산, 쿼리 무변경) 로 분기 — 참여 중=회색 "참여 중"(→`/room/[id]`) / 모집 중=주황 "함께 합류하기"(→미리보기) / 모집 마감=버튼 없음(기존 칩). 무대→누구나 중복 제거(id)는 이미 있었음 — 스크린샷의 "중복"은 아래 따라하기 복제본이었음.
- **따라하기 = 안내문 비복제** ([`discover.tsx`](mobile/app/(tabs)/discover.tsx) `onCopy` 에서 `desc` 제거 + [`create.tsx`](mobile/app/create.tsx) `descParam` 삭제): 조직 무대를 따라한 복사본이 제목·안내문까지 같아 광장에 "가짜 공식 하다"로 보였고(실제 발생, 개설자 본인도 새 하다인 줄 몰라 복사본에 인증), 안내문은 본인이 새로 쓰게 한다. 제목·분류·기간유형·빈도 프리필은 유지. 공명 "나도 할래요"(`/create?ref=` 만 전달)는 원래 안내문을 안 넘겼음

### 분류별 SNS 톤 + 홈 SNS-first (v2.3 + v2.5 정체성)
4가지 챌린지 종류 (`solo` / `cheered` / `closed` / `open`) = 4가지 다른 SNS 경험. 카피·UI·알림·박제·인연이 분류 키워드 하나로 매핑. 변경 시 4가지 모두 일관성 검토.
- 인증 완료 Alert / 카톡 초대 / 생성 후 Alert / 챌린지방 헤더 부제 / FAB 라벨 — 모두 분류별 분기 완료
- **홈 v2.5**: 분류별 그룹 → 피드 카드 5종 (도전 인연들의 하루 중심). 챌린지방 5탭 컨텍스트는 그대로 유지 (이중 보존).
- 박제 자산화 4단계 (Phase 2) 도 분류별 분기 예정 — 가격은 "추후 결정" (베타에 가격 못박지 않음)

### 사상 진단 (v2.5)
v2.1~v2.4 의 "X 빼기" 4개 (비교·친구신청·알림·무한스크롤) 만으론 챌린지 도구가 됨.
v2.5 — **버릴 건 망가진 방식, 지킬 건 욕구 자체**:
- 인정받기 욕구 → 좋아요 X · "목격받기" (동료가 내 여정 지켜봄)
- 소속 욕구 → 팔로우 X · "도전 인연" (목적 기반)
- 타인과 이어짐 욕구 → 도파민 피드 X · "되어가는 과정 피드"

도전 인연 정의 (베타 v2.5) = **현재 같은 챌린지의 멤버만**. ×횟수 누적은 Phase 2.

---

## 핵심 수칙

### 0. Human Readable 원칙 (대전제)
모든 코드는 훗날 1인 개발자가 혼자 읽고 이해하고 유지보수할 수 있어야 한다.
- 변수명·함수명은 역할이 명확히 드러나게 짓는다. 한국어 주석을 적극 사용.
- 복잡한 로직에는 **왜(Why)** 그렇게 작성했는지 한 줄 주석을 단다.
- 마법 숫자(magic number), 의미 없는 축약 변수명(`a`, `tmp`, `d2`) 금지.
- 새 기능 블록 상단에 `// 🚀 기능명: 한 줄 설명` 형식으로 목적을 명시한다.

### 1. 코드 부풀리기 금지 (최우선)
- **요청한 것만 만든다.** 요구사항과 무관한 기능·추상화·옵션을 임의로 추가하지 않는다.
- 요청 없는 리팩터링 금지. "겸사겸사" 다른 코드를 손대지 않는다.
- 불필요한 주석·docstring·헬퍼 함수·설정 옵션을 덧붙이지 않는다.
- 미래를 위한 추측성 코드("나중에 필요할 수도") 금지. 지금 필요한 것만.
- 라이브러리·의존성을 함부로 늘리지 않는다. 추가가 필요하면 먼저 이유를 보고한다.
- 같은 일을 더 적은 코드로 할 수 있으면 그쪽을 택한다.
- **"안 만들어도 되는 거 안 만들기"** — 통합기획서 부록 E의 1인 바이브 코딩 원칙.

### 2. 코드 보호
- 요구사항과 무관한 **기존 코드를 절대 수정하지 않는다.**
- 디자인 토큰(`mobile/lib/tokens.ts` — 단일 소스. NativeWind/Tailwind 미사용)을 임의로 바꾸지 않는다.
- 스타일·여백·클래스명·컬러를 디자인 시스템 밖에서 임의로 정의하지 않는다.

### 3. 선 보고 후 실행 (큰 수정에만 적용)
- **큰 수정**(여러 파일·구조 변경·라이브러리 추가·DB 스키마 변경·정책 영향)은
  코드 변경 전에 **AS-IS → TO-BE**를 한국어로 설명하고 사용자 확인을 받는다.
- **작은 수정**(단일 파일 내 버그 픽스, 텍스트·스타일 미세 조정, 명백한 오타)은
  바로 진행하고 변경 요약만 한 줄로 보고한다.
- 통합기획서 범위를 벗어나는 작업은 먼저 사용자에게 확인한다.

### 4. Surgical Edit
- 파일 전체 재작성 대신 **필요한 부분만** Edit 도구로 정밀 수정한다.
- 신규 파일이 아니면 전체 덮어쓰기(Write) 금지.

### 5. 200라인 규칙
- 한 파일이 200라인을 초과하면 기능별 분리를 먼저 제안한다.
- 챌린지 방 `room/[id].tsx`처럼 5탭이 한 파일에 모이는 경우는 예외로 본다
  (단, 각 탭은 `components/challenge/` 하위로 분리).

---

## 기능 추가 시 검증 (핵심 로직만 자동, 나머지는 수동)

코드를 새로 만들거나 고치면, **아래 기준에 따라 검증**한 뒤 완료로 본다.

### 자동 테스트 의무 영역 (반드시 테스트 코드 작성)
다음 영역은 사용자가 매번 손으로 확인하기 어렵거나 사고 시 손실이 큰 영역이다.
변경 시 `__tests__/` 하위에 검증 코드를 함께 만든다.

1. **결제 로직** — 토스페이먼츠 / Stripe 흐름, 에스크로, 정산 분배, 수수료 계산
2. **AI 콘텐츠 검수** — Claude API 호출 래퍼, 챌린지 생성 시 검증, 인증 사진 어뷰징 판정
3. **인증 / 권한** — OAuth 콜백, RLS 통과 여부, 휴대폰 인증 상태 전이
4. **박제 자산화** — 완주 시 인증서 자동 생성, 종이 인증서 주문 상태 머신
5. **유배지 / 보석금** — 3단계 페널티 전이, 보석금 누진 계산
6. **도전 인연 ×횟수** — 같은 챌린지 중복 카운트 방지, 관계 등급 전이

위 영역은 외부 API 의존도 가짜 데이터(mock)로 검증할 수 있게 만든다.
실제 API 호출 없이 파싱·계산 로직만 단위 테스트.

### 수동 검증으로 충분한 영역
UI/UX, 네비게이션, 디자인 토큰 적용, 빈 상태 화면 등은 Expo Go로
실기기에서 직접 돌려 확인한다. 자동 테스트를 강제하지 않는다.

### 검증 흐름
- Claude Code는 위 자동 테스트 영역을 건드릴 때 **테스트를 같이 작성하고 실행**한다.
- 그 외 영역은 변경 후 **"실기기에서 확인하세요"** 한 줄 안내로 충분.
- 통합기획서 해당 절(예: 4.10 박제 자산화, 4.14 내기) 기준을 충족하는지 확인.
- 테스트 실패 시 수정 후 다시 검증. 통과해야 다음 작업으로 넘어간다.

### 엣지 케이스 점검 항목
- 빈 데이터 / 결측값 / 네트워크 끊김
- 0명 / 1명 / 100명 / 1만명 챌린지 방 (사이즈 적응형 UI 경계값)
- 미인증 사용자가 결제 시도
- 잠시 멈춤 상태에서 인증 시도
- 같은 사용자가 같은 챌린지에 두 번 참여 시도

---

## 기본 원칙 (통합기획서 8장 + 정책 — 위반 시 사전 상의)

### 1. 친구 신청 / 수락 금지 (v3.4)
- "친구 추가", "친구 신청", "팔로우/팔로워" 같은 단어를 UI / 코드 / 푸시 알림에
  쓰지 않는다.
- 관계는 항상 **"도전 인연"** / **"동료"** / **"함께한 사람"** 으로 표현한다.
- 사람 간 관계는 챌린지 참여로 **자동 발생**한다. 명시적 신청-수락 흐름을
  추가하지 않는다.

### 2. 비교 압박 금지 (v3.5 조용한 SNS)
- 사용자 간 1:1 순위 비교 UI를 만들지 않는다 (랭킹 자체는 챌린지 내부 한정 OK).
- "OO님보다 N일 앞섭니다" 같은 비교 카피 금지.
- 거대한 숫자(누적 인증 12,847건) 단독 노출 금지. 항상 **"내 동료 N명 중 N명 ✓"**
  형태로 작은 동료 단위 우선.
- **숫자 100+ 는 자동 "99+"** 로 약화 (`lib/format.ts` `formatCheerCount`). 인증 응원·챌린지 평가 모두 적용.
- 멤버 정렬은 **인증률 desc 금지** — 가입 순(`joined_at asc`) + 본인 위. 시간의 흐름 톤.

### 3. 박제 = 영구 (v1)
- 완주 후 생성된 박제 / 인증서 / 포토북은 **사용자가 직접 삭제 요청하지 않는 한
  자동 삭제·만료되지 않는다.** TTL / expire_at 컬럼을 박제 관련 테이블에 함부로
  추가하지 않는다.
- 박제 데이터 마이그레이션은 항상 backup → migrate → verify 3단계.

### 4. 미성년자 보호 (8.3)
- 만 14세 미만 가입 차단 로직을 우회하는 코드 금지.
- 미성년자가 만든 챌린지는 **내기 기능 비활성**.
- 미성년자 프로필은 기본 비공개.

### 5. 콘텐츠 검수 우회 금지 (8.2)
- 챌린지 생성 / 인증 사진 업로드 시 AI 검수(Claude API)를 **건너뛰는 분기**를
  만들지 않는다. 개발 환경에서는 mock으로 통과시키되, 운영 코드에 `skipAI=true`
  같은 백도어를 남기지 않는다.

### 6. 어뷰징 방지 (4.6.3) — 베타는 부분 완화 (v2.2)
- 정식 6가지: 같은 사진 재사용 방지, GPS 검증, EXIF 확인, 시간 검증, 상호 인증, AI 검증.
- **베타 (Phase 1): 사진 인증 = 카메라 + 보관함 스크린샷 양쪽 허용.**
  운동·등산·사이클·걷기 앱의 자체 기록 화면(시간/거리 표시)을 인증 증거로 활용하는 페르소나 직답.
- GPS / EXIF / 시간 / AI 검증은 Phase 1.5. 베타는 **사용자 자발적 신뢰** 로 운영
  (스크린샷 선택 시 "시간 표시가 보이는 스샷이면 좋아요" 안내 문구).
- "같은 사진 재사용 방지" 해시 비교는 Phase 1.5 도입 예정.
- 정식 6가지 검증을 **끄는 토글** 은 만들지 않는다 — 일반 출시 전에 다시 켜는 게 전제.

### 7. 비밀키 보호
- API 키를 코드에 박지 않는다. `.env` + Expo Constants 또는 dotenv 경유.
- `.env`는 `.gitignore`에 포함. `.env.example`만 커밋.
- Supabase Service Role Key는 클라이언트 코드에 절대 노출하지 않는다
  (Anon Key만 사용, 민감한 작업은 Edge Function 경유).

### 8. 4가지 평가 의미 보존 (v3.1)
- ✨ 기발 / 😱 대단 / 🥹 뭉클 / 💫 새로움 — 이 4가지를 "좋아요" 1차원으로 합치지
  않는다. 각 평가는 독립 컬럼 / 독립 카운트.

### 9. 글로벌 다국어 (14장)
- 하드코딩된 한국어 문자열 금지. `i18n` 키로 등록.
- 날짜 / 통화 / 시간대는 사용자 로케일 기준.

---

## 작업 흐름

- 구현(코드 작성·수정·테스트 작성)은 Worker(Opus 4.8 서브에이전트)에게 위임한다 — 「모델 역할 분담」 참조.
- 한 STEP(통합기획서 Week 단위) 안에서 자유롭게 진행 가능. Day 캘린더에
  강제로 맞추지 않는다. **흐름이 끊기지 않게 한 번에 쭉 진행하는 것이 우선.**
- 큰 수정은 AS-IS→TO-BE 보고 후 진행, 작은 수정은 바로 진행 후 한 줄 보고.
- 정책·미성년자·박제·결제·검수 검토는 통합기획서 8장 기준으로 Advisor(메인)가 직접 점검.
- 진척 변경 시 통합기획서 D.10 (v4.0.1 이후 이력) 또는 별도 PROGRESS.md에 갱신.

---

## 모델 역할 분담: Advisor / Worker

메인 세션(Fable 5)은 **Advisor** — 판단에 집중하고 구현 노동은 Worker(Opus 4.8 서브에이전트)에게 위임한다.

### Advisor(메인 세션)가 직접 하는 일
- 요구사항 분석, 작업 분해, 설계 결정
- Worker에게 줄 작업 브리프 작성
- 결과 검증: diff 직접 확인, 테스트 직접 실행
- 최종 커밋 승인, 사용자 보고

### Worker(Opus 4.8 서브에이전트)에게 위임하는 일
- 코드 작성·수정, 테스트 작성 등 구현 작업 전부
- `Agent` 도구로 위임하고 `model`은 `"opus"`를 지정한다
- 서로 독립적인 작업은 한 메시지에서 병렬로 위임한다

### 브리프 기준 (토큰 절약의 핵심)
- **Advisor가 이미 파악한 컨텍스트(파일 경로·관련 함수·원인)를 브리프에 담아 Worker가 재탐색하지 않게 한다.** 재탐색이 최대 토큰 낭비원.
- 프로젝트 컨벤션, 알려진 함정, 완료 기준(통과해야 할 테스트·tsc 0)을 명시한다.
- 브리프는 필요한 것만 — 무관한 배경 설명으로 부풀리지 않는다.

### 경계 (무분별한 위임·토큰 낭비 방지)
- **한두 줄 수정·텍스트/문서 편집처럼 위임 오버헤드가 더 큰 작업은 Advisor가 직접 처리한다.** 위임 자체가 토큰을 쓴다 — 작은 일에 Worker를 부르지 않는다.
- Worker의 완료 보고를 그대로 믿지 않는다. diff와 테스트로 직접 확인한 뒤 승인한다.
- 검증 실패는 **수정 브리프로 재위임**한다. Advisor의 직접 수정은 사소한 마무리에만 허용.
- 같은 범위를 Worker에게 맡겼으면 Advisor가 중복으로 다시 탐색·구현하지 않는다.

---

## 자주 쓰는 명령

```bash
# 개발 시작
npx expo start                      # Expo Go로 폰 연결

# 빌드
eas build --profile development     # 개발 빌드
eas build --profile preview         # 베타 테스트 빌드
eas build --profile production      # 출시 빌드

# Supabase
supabase gen types typescript --project-id <id> > types/database.ts
                                    # DB 스키마 → TS 타입 자동 생성

# 테스트 (핵심 로직만)
npm test                            # 전체
npm test -- payment                 # 결제 로직만
npm test -- ai-moderation           # AI 검수만
```

---

## 주의 사항

- `Write` 도구로 기존 파일 전체 덮어쓰기 (신규 파일 제외)
- 요청 없는 리팩터링, 불필요한 주석·코드·의존성 추가 (= 코드 부풀리기)
- 자동 테스트 의무 영역(결제·AI·인증·박제·유배지·도전인연) 변경 시 테스트 없이 완료 보고
- "친구 신청 / 팔로우" 단어 사용
- 박제 데이터에 자동 만료 로직 추가
- 미성년자 보호 / 콘텐츠 검수 우회 코드 작성
- 디자인 토큰 외부에서 컬러 / 폰트 / 여백 직접 정의
- Supabase Service Role Key를 클라이언트에 노출
- `git push` / 앱스토어 배포 자동 실행 (사용자 명시 요청 시에만)
