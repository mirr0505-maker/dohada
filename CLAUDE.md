# CLAUDE.md — Do : 하다 작업 규칙

이 파일은 Claude Code가 이 저장소에서 작업할 때 **반드시 따라야 하는 지침**이다.
서브에이전트 위임 없이 메인 세션이 코드 작성·검증·정책 검토까지 직접 수행한다.

**Phase 1 MVP 의 단일 진실원천은 [`MVP_SCOPE.md`](MVP_SCOPE.md) (v2.5) 이다.**
**베타 모집 HTML 의 청사진은 [`BLUEPRINT.md`](BLUEPRINT.md) — 정체성·기존 SNS 극복 메시지 정리.**
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

### 신규 코드 위치 (Phase 2 Stage 1 — 핀테크 골격, 2026-06-11, 실돈 0원)
**단일 진실원천: [`PHASE2_FINTECH_PLAN.md`](PHASE2_FINTECH_PLAN.md) (v0.4)** — 응원 한잔/내기 한잔/기부 허브.
- 결제 순수 로직: [`supabase/functions/_shared/payments/`](supabase/functions/_shared/payments/) — catalog(금액 단일소스)·giftStateMachine·orderPolicy·verifyPayment·betSettlement·providers(PG/기프티콘/본인인증 mock, 주입 구조)
- Edge Functions: `verify-identity` / `create-gift-order` / `confirm-gift-payment` — gift_orders 쓰기는 이 경로 전용 (RLS 에 클라 쓰기 정책 없음)
- DB: [`supabase/migrations/0032_identity_gift_orders.sql`](supabase/migrations/0032_identity_gift_orders.sql) — `user_verifications`(본인만 조회) + `gift_orders` + `is_adult_verified`/`challenge_bet_allowed`
- 테스트: 루트 [`__tests__/`](__tests__/) — `npm test` (Node 내장 러너, 의존성 0). **결제 로직 수정 시 반드시 함께 갱신·실행** (자동 테스트 의무 영역)
- 내기(bet) 주문 오픈·실서비스 전환은 법률 자문 게이트 후 providers.ts 구현체 교체로만
- **응원 한잔 UI (Stage 1.5)**: 보내기 = [`mobile/components/challenge/GiftSheet.tsx`](mobile/components/challenge/GiftSheet.tsx) (티어→본인인증→mock결제), 수령 = `mobile/app/gift/[id].tsx` (받기/기부 2택 → 발신자 피드백 알림), 클라 함수 = [`mobile/lib/payments.ts`](mobile/lib/payments.ts). 인증 카드 ☕ 버튼은 **`__DEV__` 전용** (Stage 4 베타 오픈 시 해제). 수령 선택 시 발급 (claim-gift), 알림 kind 4종 + 기부 집계는 0033

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
- 디자인 토큰(`tokens.ts`, `tailwind.config.js`)을 임의로 바꾸지 않는다.
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
