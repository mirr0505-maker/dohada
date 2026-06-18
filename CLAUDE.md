# CLAUDE.md — Do : 하다 작업 규칙

이 파일은 Claude Code가 이 저장소에서 작업할 때 **반드시 따라야 하는 지침**이다.
서브에이전트 위임 없이 메인 세션이 코드 작성·검증·정책 검토까지 직접 수행한다.

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
- **클라**: 익명 카드 화면([`discover.tsx`](mobile/app/(tabs)/discover.tsx) 재설계 — 타입 4색 배지·이모지+두글자 평가 라벨(기발/대단/뭉클/새로움)·정형 기간/인증방식·🔁참조수·따라하기, **카드 탭→방 이동 없음**=익명 보존) · db `fetchBrowseChallenges`·`referenceChallenge`([`db.ts`](mobile/lib/db.ts)) · 타입 `BrowseChallengeCard`([`types.ts`](mobile/lib/types.ts)). 따라하기 = [`create.tsx`](mobile/app/create.tsx) `?ref=`+프리필(제목·방타입·분류·기간유형·빈도·내용), **생성 완료 시점에** 참조 +1(탭만 하고 안 만들면 카운트 X)
- **진입점 + 참조수 노출**: 내하다 맨 아래 "🔭 하다 구경" 카드([`my-challenges.tsx`](mobile/app/(tabs)/my-challenges.tsx)) + 홈 끝마커 직전 링크([`home.tsx`](mobile/app/(tabs)/home.tsx)). 내가 하는 하다가 참조되면 "🔁 N번 참조"(99+ 캡) 배지 — 조용한 목격받기 (`fetchMyChallenges`·`fetchMyChallengesWithDetails` 가 `reference_count` 반환)
- 결정(2026-06-17): ① 범위 C(전체 익명) ② 분류 4종 뚜렷 구분 ③ 참조 1인1회 테이블 ④ 안내문 이미지 디폴트 노출+opt-out ⑤ 평가는 구경 카드에 유지(익명화로 사람→'발상' 평가가 됨) ⑥ 종료/포기방 구경 제외(기본값, RPC 한 줄로 완화 가능)
- **배포 (⚠️ migration 먼저)**: 0050 적용 완료(운영 ✓) → 클라 OTA(preview·production 양 채널). EF·네이티브 빌드 불필요(JS만, 새 의존성 없음). 검증 tsc 0 + npm test 71/71
- **후속 버그픽스 (0051, 2026-06-17)**: 하다 구경 4평가 INSERT 가 비멤버 + open외(다함께/응원받기/나홀로)에서 RLS 거부됨 — `votes_self_insert`(0007)가 **멤버 OR open** 만 허용했기 때문(누구나·내가 멤버인 방만 됐음). `browse_visible` 챌린지면 평가 허용을 추가([`0051_browse_vote_rls.sql`](supabase/migrations/0051_browse_vote_rls.sql)). **DB(RLS)만 수정 — 클라/OTA 불필요**, 운영 적용 완료(운영 ✓)

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

- 모든 작업은 메인 세션이 직접 수행한다 (서브에이전트 위임 없음).
- 한 STEP(통합기획서 Week 단위) 안에서 자유롭게 진행 가능. Day 캘린더에
  강제로 맞추지 않는다. **흐름이 끊기지 않게 한 번에 쭉 진행하는 것이 우선.**
- 큰 수정은 AS-IS→TO-BE 보고 후 진행, 작은 수정은 바로 진행 후 한 줄 보고.
- 정책·미성년자·박제·결제·검수 검토는 통합기획서 8장 기준으로 메인이 직접 점검.
- 진척 변경 시 통합기획서 D.10 (v4.0.1 이후 이력) 또는 별도 PROGRESS.md에 갱신.

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
