# Do : 하다 — UI/UX 현재 구현 상태 감사 (UIUX_AUDIT)

> **목적**: 외부 UI/UX 전문가가 이 앱의 시장성·글로벌 트렌드 적합성·경쟁앱 대비 강약점을
> 분석할 수 있도록, **실제 코드(`mobile/`)에 구현된 현재 상태**만 정리한다.
>
> **진실 원천 = 코드.** 기획서(`MVP_SCOPE.md`)·`CLAUDE.md`는 stale 일 수 있어 6번 섹션에서 갭으로 분리.
> 추측·기획 의도·계획은 배제했고, 코드에 없는 것은 "미구현"으로 명시했다.
>
> 감사 기준 시점: 작업 브랜치 `master` / 조사 대상 = `mobile/app/` 24개 라우트 파일 + `mobile/components/` 29개 + `mobile/lib/`.
> 플랫폼: Expo (RN), expo-router 파일 기반 라우팅. **스타일링 = 순수 `StyleSheet` + `lib/tokens.ts` (NativeWind/Tailwind 미사용).**

---

## 0. 한눈에 보는 요약 (Executive Snapshot)

| 항목 | 현재 상태 |
|---|---|
| 라우트(화면) 수 | 21개 고유 화면 (온보딩 onb1~4는 1개 컴포넌트 공유) |
| 바텀 탭 | **5개** — 홈 / 내 하다 / ⊕(생성) / 기록 / 해냈어요 |
| 숨은 탭 | `discover`(→ '하다 구경', v2.18)·`profile`(내 정보) = `href:null` (탭바엔 없으나 discover는 내하다 맨 아래+홈 링크로 진입, profile은 아바타로) |
| 챌린지 방 | 단일 화면 5탭 (대화·인증·기록·현황·박제) + 적응형 FAB |
| 디자인 토큰 | `lib/tokens.ts` 단일 소스 (컬러·타이포·스페이싱·라운드·그림자) |
| 폰트 | Pretendard 3 weight (Regular/Medium/Bold) |
| 다크모드 | **미지원** (정적 라이트 팔레트, statusBar만 수동 분기) |
| i18n | 골격만 — `t()` 실제 호출 **2회**뿐, 51개 파일에 한국어 하드코딩 |
| 로딩/에러/empty | 주요 피드 화면 대부분 3종 모두 처리 (Skeleton/ErrorState/빈 카드) |
| 정체성 키워드 | "조용한 SNS" — 무한스크롤 차단(🌙 끝 마커), 큰 숫자 "99+", 비교/랭킹 배제, 가입순 정렬 |
| 결제 UI | mock·파일럿 게이트(`isGiftPilotEmail`)로 일부만 노출 (응원 한잔은 전체, 내기는 파일럿) |

핵심 차별점(코드 확인됨): ① 무한스크롤 의도적 차단 ② 좋아요 합산 금지(4종 응원 독립 카운트) ③ 친구신청 없는 "도전 인연" ④ 100+ 숫자 약화 ⑤ 4가지 방 타입(solo/cheered/closed/open)별 카피·UI 분기.

---

## 1. 화면 전수조사

`mobile/app/` 파일 기반 라우트 전수. 각 화면: (a) 역할 (b) 주요 UI 요소·레이아웃 (c) 진입/이탈 경로.

### 1.1 온보딩·인증 스택

#### [index.tsx](mobile/app/index.tsx) — 스플래시
- (a) 앱 진입점. 세션 있으면 즉시 홈으로 자동 진입.
- (b) 전체화면 오렌지(`colors.accent`) 배경 + `BrandMark` xl + "Do : 하다" + 슬로건 2줄 + 하단 "탭하여 시작 →" / "건너뛰기".
- (c) 진입: 앱 콜드스타트. 이탈: 세션 있으면 `replace('/(tabs)/home')`, 탭 시 `/onb1`, "건너뛰기" 시 `replace('/login')`.

#### [onb1.tsx](mobile/app/onb1.tsx) ~ [onb4.tsx](mobile/app/onb4.tsx) — 온보딩 4슬라이드
- (a) 정체성 소개 4단계(혼자 아닌 함께 / 인증·응원 / 친구신청 없는 동료 / 세상도 바꾼다). 4개 파일 모두 `<OnbView step={n}/>` 한 줄 래퍼.
- (b) [OnbView.tsx](mobile/components/OnbView.tsx): 상단 좌 BrandMark·우 "건너뛰기", 중앙 대형 이모지(96px)+제목+설명, 하단 진행 dot(active는 width 24 pill)+큰 버튼. **좌우 Fling 스와이프**(`Gesture.Race`)로도 이동.
- (c) 진입: 스플래시 탭. 이탈: 다음 슬라이드 push / step4·건너뛰기 → `replace('/login')`.

#### [login.tsx](mobile/app/login.tsx) — 로그인
- (a) Google OAuth + Apple Sign In(iOS만 노출). Supabase `signInWithIdToken`.
- (b) 상단 로고블록, 중앙 "시작해볼까요? / 3초만에 가입", 하단 구글 버튼(공식 4색 G 로고 SVG)·애플 버튼(검정, iOS만)·약관 안내 footer. 로딩 중 `ActivityIndicator`.
- (c) 진입: 온보딩/스플래시/`session===null` 리다이렉트/초대 미로그인. 이탈: 신규=`/welcome`, 기존=`/home`, pending 초대=`/invite/[id]`.

#### [welcome.tsx](mobile/app/welcome.tsx) — 약관 동의 (가입 직후)
- (a) 만 14세·서비스·개인정보(필수) + 마케팅(선택) 동의.
- (b) ScrollView. 🎉 + 환영 타이틀 + 슬로건 카드 + 체크박스 5행(전체동의/4항목) + 필수 충족 시 활성화되는 "시작하기" 버튼.
- (c) 진입: 신규 로그인. 이탈: `replace('/home')`. ※ 휴대폰 인증 없음(MVP).

### 1.2 메인 5탭 — `(tabs)/`

#### [home.tsx](mobile/app/(tabs)/home.tsx) — 홈 (SNS-first 피드) · 1,325줄
- (a) "도전 인연들의 하루" 피드. 내 진행 + 동료 활동 + 합류/추천을 1스크롤에.
- (b) `AppHeader` + ScrollView(pull-to-refresh). 섹션 순서: **오늘 나의 하다**(내 카드, 상한 5·미인증 우선정렬) → **🏆 끝낸 하다**(상한 3) → **오늘 하다 인연들의 하루**(🎉 완주리본 + 📸 챌린지별 오늘 인증 그룹+더보기) → **오늘 응원으로 힘주기**(응원받기 방) → **함께 합류하기**(누구나) → **내 관심 분야 하다** → **🌙 끝 마커**. 미인증 다건 시 선택 모달, 누구나 합류 시 `OpenJoinPreviewSheet`.
- (c) 진입: 탭/로그인 후. 이탈: 카드 → `/room/[id]`, 인증 → `/checkin/[id]`, 완주리본 → `/done/[id]`, 모두보기 → `/(tabs)/my-challenges`.

#### [my-challenges.tsx](mobile/app/(tabs)/my-challenges.tsx) — 내 하다 · 523줄
- (a) 참여 중 모든 하다 목록(작업 공간 입구).
- (b) `AppHeader` + 서브헤더("🚩 내 하다") + FlatList. 카드 = 새 대화/기록 알림 배지줄 + 제목·D-day·인증상태 배지 + 설명 + 일정 + 메타(인원·N일째·연속) + 진행률 바. ListFooter에 **💛 응원하는 하다** / **🏆 끝낸 하다** / **🕊️ 지난 하다(포기, 기본 접힘)** 3밴드.
- (c) 진입: 탭. 이탈: 카드 → `/room/[id]`(종료/포기 카드는 `?tab=archive`/열람).

#### [create-tab.tsx](mobile/app/(tabs)/create-tab.tsx) — ⊕ (빈 placeholder)
- (a) 탭바 가운데 큰 ⊕ 버튼 라우트 등록용. **실제 렌더 없음** (`<View/>`). `_layout`의 `tabPress` 리스너가 `router.push('/create')`로 가로챔.
- (c) 진입 불가(보이지 않음). 탭 → `/create` modal.

#### [record.tsx](mobile/app/(tabs)/record.tsx) — 기록 (Vlog 피드) · 246줄
- (a) 앱 전체 도전 인연들의 기록(Vlog) union 피드. "오늘 인증"보다 길고 추억성.
- (b) `AppHeader` + 인트로("🎥 기록") + FlatList. 카드 = 아바타·닉네임·카테고리·시간 + 제목 + 본문(3줄) + 사진(16:9) + 좋아요/댓글 카운트(99+) + "이어 보기 →".
- (c) 진입: 탭. 이탈: 카드 → `/room/[id]?tab=log`.

#### [done.tsx](mobile/app/(tabs)/done.tsx) — 해냈어요 (공개) · 285줄
- (a) 완주 이야기 공개 무대. "줄세우지 않고, 서로에게 용기를". 최신순만(랭킹 X).
- (b) `AppHeader` + 인트로 + FlatList. 카드 = 아바타·카테고리 + 챌린지 제목 + 통계 미니 4칸(일/연속/인증/완주%) + 발췌 + 사진 1장 + "🤝 N명이 용기를 얻었어요".
- (c) 진입: 탭(새 공개글 시 조용한 dot). 이탈: 카드 → `/done/[id]`.

#### [discover.tsx](mobile/app/(tabs)/discover.tsx) — 하다 구경 (익명 발상 라이브러리, v2.18) · **탭바 숨김(`href:null`)이나 진입점 연결됨**
- (a) "남들은 무슨 하다 하나" — 전체 유형 **익명** 카드(개설자·참여자 신원 제거) + 4가지 평가(✨😱🥹💫) + 🔁따라하기/참조수. 탐색이 아니라 '참조'. 정렬 = 최신순(줄세우기 X).
- (b) `AppHeader` + 서브헤더("하다 구경") + 안내 + **카테고리 필터 칩** + FlatList. `BrowseCard` = 타입 4색 배지(🧍나홀로·🤝다함께·🌍누구나·💛응원받기) + 제목·내용 + 정형 "기간·인증방식" + 안내문 이미지(opt-out 시 숨김) + 4평가(이모지+두글자 라벨) + 🔁참조수 + "따라하기" 버튼.
- (c) 진입: **내하다 맨 아래 "🔭 하다 구경" 카드 + 홈 끝마커 직전 링크**(v2.18 연결). 이탈: 따라하기 → `/create?ref=`(프리필). **카드 탭으로 방 이동 없음**(익명 보존). 데이터 = `browse_challenges` RPC(신원 컬럼 미반환, 0050).

#### [profile.tsx](mobile/app/(tabs)/profile.tsx) — 내 정보(MY) · 1,234줄 · **탭바 숨김(`href:null`)**
- (a) MY 허브. 프로필·관심분야·알림설정·완주보관함·로드맵·문의/로그아웃.
- (b) `AppHeader` + ScrollView. 프로필 카드(아바타 변경·닉네임 편집·이메일) + 관심분야 칩(편집 모달) + 알림 5토글(채팅/댓글/응원·좋아요/동료 인증·기록/매일안부+시간) + 🏆 내 완주 보관함 + 🔒 로드맵 예고 5종(내기/인연 ×횟수/박제 인쇄/응원 한잔/기부 허브) + 액션(한잔 내역[파일럿]·문의·로그아웃) + 버전/OTA 표기.
- (c) 진입: **AppHeader 우상단 아바타** → `/(tabs)/profile`. 이탈: 로그아웃 → `/login`, 한잔내역 → `/gifts`.

### 1.3 모달·동적 라우트

#### [create.tsx](mobile/app/create.tsx) — 챌린지 만들기 5단계 마법사 (modal) · 1,542줄
- (a) 1 제목 → 2 카테고리 → 3 방타입(+안내문) → 4 기간·빈도/목표횟수 → 5 인증방식(+내기 파일럿).
- (b) 헤더(✕·step/5) + step dot bar + KeyboardAvoidingView·ScrollView 본문(단계별 큰 질문+옵션 카드) + 하단 이전/다음 바. 제출 시 AI 검수(`moderate-challenge`) → `createChallenge` RPC.
- (c) 진입: ⊕ 탭, 포기 방 "다시 시작"(`?title=`). 이탈: 생성 후 `/room/[id]`(closed/cheered는 `?fromCreate=1`).

#### [checkin/[id].tsx](mobile/app/checkin/[id].tsx) — 사진 인증 (modal) · 491줄
- (a) 카메라 촬영 + 보관함 다중선택(최대 3장) → 캡션 → R2 업로드 → `proofs` insert.
- (b) 어두운 배경. 헤더(✕·오늘 인증) + viewfinder(CameraView 또는 미리보기+썸네일줄+N/M 배지) + 캡션 입력(KeyboardAvoidingView) + 하단(셔터/보관함 또는 "이 사진으로 인증"+더찍기/보관함/다시). 카메라 권한 없으면 권한 안내 화면.
- (c) 진입: 홈/방 FAB "📸 오늘 인증하기". 이탈: 인증 완료 Alert(연속 마일스톤·방타입별 메시지) → `router.back()`.

#### [room/[id].tsx](mobile/app/room/[id].tsx) — 챌린지 방 (5탭) · 2,088줄
- (a) 앱의 핵심 화면. 한 챌린지의 대화·인증·기록·현황·박제 + 멤버·초대·응원·선물·내기·다짐·신고.
- (b) 헤더(← / 제목+완주🏆·종료🏁 배지 / stacked avatars / 초대) → 부제+발송메시지(개설자) → **info bar**(🔥 N/M일·📸 N/N 인증·💚·D-N·멈춤) → 진행률 바 → **5탭 바** → 탭 콘텐츠 → **적응형 FAB**. Realtime(proofs/cheers/comments) 구독. 다수 시트/모달(Comments·Member·Report·InviteLetter·InviteConfirm·Impact·Gift·Bet·Pledge·PhotoViewer).
- (c) 진입: 모든 카드/딥링크/`?tab=`. 이탈: ← 뒤로, 완주 자동감지 시 `/complete/[id]`(1회).

#### [invite/[id].tsx](mobile/app/invite/[id].tsx) — 초대 랜딩 · 392줄
- (a) 외부 초대 링크 진입점. 자동 합류 차단 → 정보 확인 후 수락/거절.
- (b) 상태별(loading/confirming/joining/error) 카드. confirming 시 챌린지명·카테고리·기간·안내문·내기 배지 + 수락/거절 버튼.
- (c) 진입: 카톡 공유 링크(Edge Function `invite`). 미로그인 시 pending 저장 후 `/login`. 이탈: 수락 → `/room/[id]`, 거절 → `/home`.

#### [complete/[id].tsx](mobile/app/complete/[id].tsx) — 완주 축하 · 208줄
- (a) 종료일 통과 + 목표 달성 시 디바이스당 1회 표시. (인증서/포토북 X.)
- (b) 전체화면 오렌지. `Reanimated` entering 모션(ZoomIn 트로피 · FadeIn 타이틀/완주율/슬로건) + 하단 버튼(기록 공유·내기 정산[있으면]·박제 보기·홈으로). `gestureEnabled:false`.
- (c) 진입: 방의 완주 자동 감지 `replace`. 이탈: 박제→`/room/[id]?tab=archive`, 홈→`/home`.

#### [done/new.tsx](mobile/app/done/new.tsx) — 완주 이야기 작성 · 616줄
- (a) 시스템 통계 자동 잠금 + 6개 옵션 필드(소감/어려운 점/도움/조언/꿀팁/달라진 점) + 사진 최대 3 + 공개범위.
- (b) ScrollView + 통계 4칸(잠금) + 필드 입력 + 사진 + public/allies 선택. (AI 검수 경유.)
- (c) 진입: ArchiveTab "✍️ 완주 이야기 공유하기". 이탈: 작성 후 back.

#### [done/[id].tsx](mobile/app/done/[id].tsx) — 완주 이야기 상세 · 401줄
- (a) 증언 상세 + "나도 [카테고리] 도전 시작하기" CTA(유입 루프) + "용기 받았어요" 토글(0029).
- (b) 통계 4칸 + 작성 필드만 노출 + 사진 + 반응 토글. 본인 글이면 우상단 삭제 메뉴.
- (c) 진입: 해냈어요/홈 완주리본 카드. 이탈: CTA → `/create`, back.

#### [gift/[id].tsx](mobile/app/gift/[id].tsx) — 응원 한잔 수령/상세 · 248줄
- (a) 받기/기부 2택(mock). 발신자에겐 진행상태.
- (b) 헤더 + 티어·상태 라벨 + 받기/기부 버튼(수신자·paid일 때). "실제 결제·계좌 연결 없음" 디스클레이머.
- (c) 진입: 알림 "한잔 도착" 탭 / 방 인증카드 ☕. 이탈: back.

#### [gifts.tsx](mobile/app/gifts.tsx) — 한잔 내역 · 150줄 · 파일럿 전용
- (a) 보낸/받은 응원 한잔(+내기) 내역 리스트.
- (b) 헤더 + FlatList(티어·상태·날짜).
- (c) 진입: 내 정보 "☕ 한잔 내역"(파일럿만). 이탈: 행 → `/gift/[id]`.

> **데드 코드(해소됨)**: `components/home/MyChallengeCard.tsx`(301줄, Solo/Cheered/Closed/Open 4 variant)는 어느 화면에서도 import 되지 않던 home v2.3 잔재였다(v2.5 홈은 인라인 카드 직접 렌더). **본 감사 중 삭제 처리**(git 추적 — 복원 가능).

---

## 2. 네비게이션 구조

### 2.1 바텀 탭 (5개) — [(tabs)/_layout.tsx](mobile/app/(tabs)/_layout.tsx)
| 위치 | 탭 | 아이콘(Ionicons) | 동작 |
|:-:|---|---|---|
| 1 | 홈 | home/home-outline | `/(tabs)/home` |
| 2 | 내 하다 | flag/flag-outline | `/(tabs)/my-challenges` |
| 3 | **⊕** | 커스텀 원형 오렌지(돌출 `marginTop:-18`, `shadow.lg`) | `tabPress` 가로채 `/create` modal push |
| 4 | 기록 | film/film-outline | `/(tabs)/record` |
| 5 | 해냈어요 | trophy/trophy-outline | `/(tabs)/done` · 새 공개글 시 조용한 dot 배지 |

- 숨은 라우트: `discover`(='하다 구경', v2.18 — 내하다 맨 아래+홈 링크로 진입)·`profile` = `href:null` (탭바 미노출).
- 탭바 스타일: `surface` 배경, 상단 1px 보더, iOS 높이 84/안드로이드 `56+insets.bottom`, active=`accent`·inactive=`primary300`. 라벨 `fontSize.xs`. Android edge-to-edge 인셋 반영.
- 해냈어요 dot = `fetchLatestPublicStoryAt` 마지막 확인 이후 새 글 있을 때만(가짜 dot 금지).

### 2.2 루트 스택 — [_layout.tsx](mobile/app/_layout.tsx)
`headerShown:false` 공통. 화면: index · onb1~4 · login · welcome · **(tabs)** · create(modal) · checkin/[id](modal) · room/[id] · invite/[id] · complete/[id](`gestureEnabled:false`). 그 외 동적 라우트(done/new, done/[id], gift/[id], gifts)는 파일 존재로 자동 등록.
- 앱 부트: `useFonts`(Pretendard 3종) 로드 전 네이티브 스플래시 유지. `GestureHandlerRootView` + `SafeAreaProvider` + `ErrorBoundary` 래핑.
- 앱 active 전환 시 푸시 뱃지·알림 카드 클리어(`setBadgeCountAsync(0)`).

### 2.3 MY 진입점
별도 탭 없음. **모든 4탭 공통 헤더([AppHeader.tsx](mobile/components/AppHeader.tsx)) 우상단 아바타** 탭 → `/(tabs)/profile`. (홈/내하다/기록/해냈어요/둘러보기에 AppHeader 포함, profile 자체에도 포함.)

### 2.4 딥링크 처리
- **scheme**: `dohada://` (app.json). 외부 초대는 Edge Function URL(`https://<proj>.supabase.co/functions/v1/invite?id=`)로 공유 → 앱 `/invite/[id]`.
- **푸시 탭 흐름** ([_layout.tsx](mobile/app/_layout.tsx) `useLastNotificationResponse`): 세션 복원 대기 → `/(tabs)/home?bell=<ts>` 로 이동(콜드스타트는 `replace`) → `AppHeader`가 `bell` param으로 알림함 모달 자동 오픈.
- **알림함 행 → 탭 딥링크** ([push.ts](mobile/lib/push.ts) `notificationRoute`):
  - gift/gift_received/gift_donated/gift_refund → `/gift/[orderId]` (없으면 `?tab=proof`)
  - chat·creator_notice → `?tab=chat`
  - recruit_milestone·recruit_autoclosed → `?tab=status`
  - log·log_comment·log_like_batch → `?tab=log&logId=…(&comments=1)`
  - proof·comment·cheer_batch → `?tab=proof&proofId=…(&comments=1)`
- 방은 mount 후 `?tab=`/`?proofId=`/`?logId=` param 변경에 반응(탭 전환·카드 스크롤 포커스·댓글 시트 자동 오픈).

---

## 3. 핵심 플로우 단계별

### 3.1 온보딩 → 로그인 → 챌린지 생성 → 인증 → 응원 → 완주

```
스플래시(index)
  ├ 세션O → 홈 자동
  └ 세션X → onb1→onb2→onb3→onb4 (또는 건너뛰기) → login
login (Google/Apple)
  ├ 신규 → welcome(약관) → home
  └ 기존 → home
home (⊕ 또는 빈 카드 "+ 첫 하다 선언하기")
  → create 5단계: 제목 → 카테고리 → 방타입(+안내문) → 기간·빈도/목표횟수 → 인증방식
      제출 = AI 검수(moderate-challenge) → createChallenge RPC
  → room/[id] (closed/cheered는 ?fromCreate=1 → 카톡 초대 안내 Alert)
room → FAB "📸 오늘 인증하기" → checkin/[id]
  → 카메라/보관함(최대 3장) → 캡션 → R2 업로드 → proofs insert
  → 인증 완료 Alert(연속 마일스톤 + 방타입별 메시지) → back
응원: 인증 카드의 4종 응원 칩(🔥👏💪❤️, 독립 카운트·낙관적 업데이트·Realtime) / 댓글 / ☕ 한잔
완주: 방이 isCompleted 자동 감지 → complete/[id] (디바이스당 1회, SecureStore 키)
  → 박제(ArchiveTab) → "✍️ 완주 이야기 공유" → done/new → 해냈어요 탭 공개
```

### 3.2 둘러보기/공개 챌린지 → 참여
- **하다 구경(discover, v2.18)**: 익명 발상 라이브러리로 재설계 — 진입점 연결됨(내하다 맨 아래 "🔭 하다 구경" + 홈 끝마커 직전 링크). 전체 유형 익명 카드(신원 제거)·4평가·🔁따라하기(→ `/create?ref=` 프리필). **카드 탭으로 방 이동 없음**(익명 보존).
- **홈 "함께 합류하기"**: `JoinCard` → `handleJoinChallenge` → 이미 멤버면 이동 Alert, 아니면 `OpenJoinPreviewSheet`(안내문 미리보기) → `doJoin` → `joinChallenge`. 성인인증 필요(`adult_required`) 방은 차단 안내.
- **방 비멤버 진입**: 인증·기록 탭만 열람, 대화·현황·박제는 회색(`opacity:0.4`) + 합류 유도. 하단 FAB "🌍 이 하다에 참여하기" / 모집 마감 시 "🔒 모집 마감".
- **초대 링크**: `/invite/[id]` 랜딩 → 수락 → `/room/[id]`.

### 3.3 챌린지 방 내부 5탭 ([room/[id].tsx](mobile/app/room/[id].tsx))
| 탭 | 컴포넌트 | 역할 | FAB |
|---|---|---|---|
| 💬 대화 | [ChatTab](mobile/components/challenge/ChatTab.tsx) | 카톡식 말풍선 Realtime 채팅(본인 우측 오렌지). 공지(is_notice) 분리 표시. 멤버 전용. | 없음 |
| 📸 인증 (기본) | (방 내부 `ProofCard`) | 일별 인증 카드 피드. 사진 캐러셀+연속 메달, 4종 응원, 댓글, ☕ 한잔, ⋯ 신고/차단. FlatList scrollToIndex 딥링크. | 📸 오늘 인증하기 / ✓ 완료 / count형 "인증 추가 N/목표" / 시작전·멈춤·종료 분기 |
| 🎥 기록 | [LogTab](mobile/components/challenge/LogTab.tsx) (837줄) | Vlog 카드(제목·본문·사진 다장·좋아요·댓글). 작성 컴포저. 응원자 역할 배너. | 📝 기록 쓰기 (응원자·박제 후 없음) |
| 📊 현황 | [StatusTab](mobile/components/challenge/StatusTab.tsx) | 멤버별 인증률 카드(가입순·본인 위, **랭킹 X**). 안내문 카드, 모집상태 카드(open), 내기/다짐 슬롯. cheered는 응원자 "💛 응원 중". | 없음 |
| 🏆 박제 | [ArchiveTab](mobile/components/challenge/ArchiveTab.tsx) | 진행중=안내+4단계 상품 잠금(가격 "추후 결정"). 완주후=히어로+통계 4칸+"완주 이야기 공유"+3열 인증 타임라인. 실패 종료=격려+타임라인. | 없음 |

- **헤더 공통**: 뒤로 / 제목(완주🏆·종료🏁 배지) / stacked avatars(최대 4+"+N", 탭=MemberSheet) / 초대(비멤버·종료·마감 시 회색 비활성).
- **info bar**: 🔥 진행일 · 📸 인증 N/N(cheered는 도전자 1명 기준) · 💚 임팩트 모달 · D-N(또는 시작 D-N/종료) · ⏸멈춤/▶재개/🏃그만하기.
- **종료·포기 상태**: 마무리 인사 7일 유예(`getFarewellState`) → 이후 전면 읽기 전용. 포기 멤버는 즉시 읽기 전용 + FAB "🔄 다시 시작하기".

---

## 4. 디자인 시스템 현황

### 4.1 토큰 단일 소스 — [lib/tokens.ts](mobile/lib/tokens.ts)
> **NativeWind/Tailwind 미설치** (`grep` 결과 없음). `tailwind.config.js` 부재 — `CLAUDE.md`가 언급하는 파일은 실재하지 않음(갭). 모든 스타일 = `StyleSheet.create` + tokens import.

**컬러** (라이트 단일 팔레트):
- primary 그레이스케일: `#1A1A1A`(primary) · 700 `#404040` · 500 `#737373` · 300 `#A3A3A3` · 100 `#E5E5E5` · 50 `#F5F5F5`
- accent(오렌지 핵심): `#FF6B35` · 700 `#E55A2B` · 100 `#FFE4D6` · 50 `#FFF4ED`
- background `#FAFAFA` · surface `#FFFFFF`
- 시맨틱: success `#22C55E` · warning `#F59E0B` · danger `#EF4444` · info `#3B82F6`
- 챌린지 타입 라벨: typeGeneral/Brand/Celeb/Public
- **streakTier 8색**(연속 마일스톤 3·7·21·49·99·180·365·730일): 초록→청록→파랑→보라→핑크→실버→골드→다이아
- ⚠️ 카드별로 토큰 외 인라인 hex 다수(예: 홈 빈상태 카드 `#F5F8FC`/`#F0FBF5`/`#FFFBEB`/`#FAF5FF`, my-challenges 알림 배지 `rgba(...)`). 디자인 토큰 밖 컬러가 화면 곳곳에 산재.

**타이포**: Pretendard 3 weight(`Pretendard-Regular/Medium/Bold`). fontSize `xs 11 · sm 12 · base 14 · md 15 · lg 16 · xl 18 · 2xl 20 · 3xl 24 · 4xl 28 · 5xl 32 · 6xl 40`. fontWeight regular~extrabold. (semibold 600은 정의돼 있으나 Pretendard-SemiBold 폰트는 로드 안 함 → 600 지정 시 시스템 합성.)

**스페이싱**: `0.5:2 ~ 16:64` 키 기반. **라운드**: sm8·md12·lg14·xl16·2xl20·3xl24·pill999. **그림자**: sm/md/lg (iOS shadow* + Android elevation 묶음).

### 4.2 다크모드
**미지원.** `colors`는 정적 상수, `useColorScheme` 미사용. `Screen`의 `statusBarStyle`만 화면별 수동('dark'/'light'). 어두운 화면(인증/완주)은 배경색을 직접 `colors.primary`/`accent`로 지정.

### 4.3 공통 컴포넌트 목록
| 컴포넌트 | 역할 |
|---|---|
| [Screen](mobile/components/Screen.tsx) | SafeArea 래퍼(fullScreen 옵션·edges·statusBar) |
| [Button](mobile/components/Button.tsx) | 4 variant(primary/secondary/outline/ghost) × 3 size(md/lg/xl), loading 스피너, minHeight 44(HIG) |
| [AppHeader](mobile/components/AppHeader.tsx) | 로고 워드마크("Do:**하다**" 하다=주황) + 벨(알림함 모달·조용한 dot) + 아바타 |
| [BrandMark](mobile/components/BrandMark.tsx) | `( ⊙ )` 로고(폰트 무관, View로 그림, sm~xl) |
| [Skeleton](mobile/components/Skeleton.tsx) | 펄스 placeholder + ChallengeCardSkeleton/ProofCardSkeleton |
| [ErrorState](mobile/components/ErrorState.tsx) | 😵 + 제목 + 재시도 버튼 (**유일하게 i18n `t()` 사용**) |
| [ErrorBoundary](mobile/components/ErrorBoundary.tsx) | 루트 크래시 폴백 |
| [PhotoCarousel](mobile/components/PhotoCarousel.tsx) / [PhotoViewer](mobile/components/PhotoViewer.tsx) | 카드 인라인 가로 페이저(점·N/M) / 전체화면 핀치줌 뷰어 |
| [CommentsSheet](mobile/components/CommentsSheet.tsx) | 인증 댓글 바텀시트 |
| [OnbView](mobile/components/OnbView.tsx) | 온보딩 슬라이드 공통 |
| challenge/ | ChatTab·LogTab·StatusTab·ArchiveTab(5탭 본문) + BetCard·BetSheet·GiftSheet·PledgeCard·PledgeSheet·FellowPledges·MemberSheet·ReportSheet·StreakMedal·ImpactModal·InviteLetterModal·InviteConfirmModal·LogCommentsSheet |
| home/ | OpenJoinPreviewSheet(합류 전 안내문 시트) · ~~MyChallengeCard(데드 코드 — 감사 중 삭제됨)~~ |

---

## 5. 상태 처리 표 (화면 × 로딩 / 에러 / empty)

| 화면 | 로딩 | 에러 | Empty |
|---|:-:|:-:|---|
| index(스플래시) | — | — | — (세션 대기) |
| onb1~4 | — | — | — |
| login | 버튼 스피너 | Alert(취소 제외) | — |
| welcome | — | — | — |
| **home** | ChallengeCardSkeleton ×2 | ErrorState+재시도 | 섹션별 빈 카드 5종(🌱 첫 하다/👣 동료 없음/🙋 응원 없음/🌍 공개 없음/✨ 관심 없음) |
| **my-challenges** | Skeleton ×3 | ErrorState | 🌱 "참여 중인 하다 없어요" + 보관함은 부가(실패 무시) |
| record | ActivityIndicator | ErrorState | 📓 "쌓인 기록 없어요" |
| done(해냈어요) | ActivityIndicator | ErrorState | 🌱 "공개 이야기 없어요" |
| discover(하다 구경) | Skeleton ×3 | ErrorState | 🔭 "아직 살펴볼 하다 없어요"(필터 시 분류별 문구) |
| profile | (조각별 catch 무시) | Alert(토글 롤백) | 관심 0/완주 0 분기 문구 |
| create | 제출 버튼 스피너 | Alert(검수 차단/실패) | 카테고리 로딩 ActivityIndicator |
| **checkin** | 권한 로딩 스피너 · 업로드 "업로드 중…" | Alert(촬영/선택/인증 실패·1일1회 중복 친절 안내) | 권한 없음 안내 화면 |
| **room** | ProofCardSkeleton ×2 | ErrorState+재시도 | 탭별 빈 상태(📸 인증 없음/응원자용 문구, 📊 멤버 없음, 🏆 박제 placeholder) |
| invite | ActivityIndicator | status='error' 카드 | — |
| complete | ActivityIndicator | (조용 실패) | — |
| done/new | 초기 ActivityIndicator | Alert(이미 작성/오류) | — |
| done/[id] | ActivityIndicator | (catch) | 작성 안 한 필드 숨김 |
| gift/[id] | ActivityIndicator | Alert | order 없음 분기 |
| gifts | ActivityIndicator | (catch) | 내역 없음 |

**패턴**: 피드형 화면은 `loading → error → empty → list` 3분기 일관. Pull-to-refresh(`RefreshControl tintColor=accent`)는 home/my-challenges/record/done/discover/room에 적용. 낙관적 업데이트+롤백(응원·평가·알림 토글)·`reportError`(자체 수집) 공통.

---

## 6. 문서 대비 갭 표 (MVP_SCOPE.md / CLAUDE.md ↔ 코드)

### 6.1 문서엔 있는데 코드 상태가 다른 것
| 항목 | 문서(MVP_SCOPE/CLAUDE) | 코드 실제 | 판정 |
|---|---|---|---|
| `tailwind.config.js` | CLAUDE "디자인 토큰(tokens.ts, tailwind.config.js)" | **파일 없음**, NativeWind 미설치 | 문서 오류 |
| 둘러보기 탭 | "하단 5탭… 둘러보기" 전제(§3.8) | `discover`='하다 구경'(v2.18) — 탭 대신 내하다 맨 아래+홈 링크 진입 | **해소**(동선 연결+익명 재설계, 0050) |
| 둘러보기 큐레이션 3종 | 지금 핫한/신규/인기 | 최신순 단일 + 카테고리 칩 ('하다 구경'은 줄세우기 의도적 배제 → 랭킹 큐레이션 없음) | 의도적 단순화 |
| 큐레이션 드롭다운 | 큐레이션+카테고리 드롭다운 | 드롭다운 없음, 카테고리 칩만 | 부분구현 |
| 사이즈 적응형 room-today | "📅 오늘 X/Y ›" small/medium/large | room-today 카드 자체 미구현(info bar로 대체) | 미구현(보류 명시됨) |
| i18n ko/en | "골격 유지, Phase 2 본격" | en.ts 5네임스페이스만, `t()` 호출 2회 | 골격만(사실상 미사용) |
| Sentry | DSN 채우면 활성 | `lib/sentry.ts` = Supabase `client_errors` 자체 수집(DSN 없음) | 대체 구현 |
| 명사/브랜드/공익 뱃지 | placeholder | 코드에 노출 없음(사회공헌만) | 미구현(보류) |
| 휴대폰 인증 | 제외(SNS 로그인이 대체) | welcome에 약관만, 휴대폰 X | 의도적 미구현 |

### 6.2 문서엔 없는데 코드엔 있는 것 (문서가 stale — v2.6~v2.17 증분)
> MVP_SCOPE 본문은 v2.5에서 멈췄고, 이후는 상단 "증분 메모" + CLAUDE.md에만 기록. 코드엔 다음이 **실제 구현**돼 있음:
- **목표 횟수형(count) 도전**(0041) — 기간 내 N개, 일일 의무 없음·하루 다회·조기 완주.
- **연속 인증 마일스톤 메달**(0044, [StreakMedal](mobile/components/challenge/StreakMedal.tsx)) — 게시글 오각형 메달 8단계.
- **인증/기록 다중 사진**(0045) — 인증 3·기록 4장, 캐러셀+전체화면 핀치줌.
- **누구나 방 모집 마감**(0043) — 수동 잠금/50·100명 넛지/기간 50% 자동마감(StatusTab 토글).
- **응원 한잔 / 나와의 내기 / 다인 내기**(Phase 2 mock 파일럿) — GiftSheet·BetCard·BetSheet, `isGiftPilotEmail` 게이트.
- **다짐(무현금 사회적 스테이크)**(0046) — PledgeCard·PledgeSheet·FellowPledges.
- **신고·차단 + flag 자동숨김**(0047) — ReportSheet, 차단 양방향 필터.
- **cheered(응원받기) 응원자 시선 정리**(0048) — 역할 배너·FAB 제거·요약 UI 분기.
- **종료 방 마무리 인사 7일 유예 / 포기 = 조용한 보관(읽기 전용)** — getFarewellState·지난 하다 섹션.
- **완주율% 표기, 완주 후 박제 자유 재진입, 내기 정산 동선**.
- **OTA 버전 표기**(profile 하단).

### 6.3 핵심 변경분 반영 상태 (요청 명시 항목)
- **방 5탭**: ✅ 구현(대화·인증·기록·현황·박제), 탭별 컴포넌트 분리.
- **완주 쇼케이스("해냈어요")**: ✅ done 탭 + done/[id] + done/new + ArchiveTab 진입점. "용기 받았어요" 반응까지.
- **MY 이동**: ✅ profile 탭 제거 → AppHeader 우상단 아바타로 일원화.

---

## 7. 글로벌·접근성

### 7.1 i18n (ko/en)
- 엔진: `i18n-js` + `expo-localization`. 디바이스 언어 en이면 en, 그 외 ko 폴백([lib/i18n.ts](mobile/lib/i18n.ts)).
- 사전 규모: [ko.ts](mobile/lib/locales/ko.ts)/[en.ts](mobile/lib/locales/en.ts) 각 **5 네임스페이스(common/error/login/home/room)만**. 대부분 키가 화면에서 미사용.
- **실사용 = `t()` 호출 2회뿐**(ErrorState의 `error.title`·`common.retry`). 나머지 전 화면 **한국어 하드코딩**(51개 파일에 한글 리터럴). → 영어 디바이스로 켜도 거의 전부 한국어 노출.
- 날짜/통화/시간대: KST 고정 로직(`getKstTodayRange` 등). 로케일 기반 포맷 없음. 통화는 mock 결제라 미적용.
- **판정**: 글로벌 출시 관점에선 **사실상 한국어 단일 앱**. i18n은 인프라 골격만.

### 7.2 접근성 (a11y)
- `accessibilityRole`/`accessibilityLabel`: 헤더 버튼·탭·아바타·신고 ⋯·온보딩 건너뛰기·알림함 등 **부분 적용**(전수 아님). 다수 `Pressable`은 라벨 없음.
- 터치 타깃: `Button` minHeight 44(Apple HIG 준수), 작은 아이콘은 `hitSlop`로 보완.
- StreakMedal: 숫자 메달에 의미 라벨을 a11y로 제공(주석 명시).
- 스크린리더 전용 흐름/포커스 관리·동적 대비 검증은 코드상 미확인.

### 7.3 폰트 스케일 / 반응형
- **폰트 스케일**: fontSize가 **고정 숫자 토큰**. `allowFontScaling`을 끈 곳이 없어 RN 기본값(=true)대로 **OS 글자 크기 설정이 그대로 반영**되긴 하나, 모든 텍스트·컨테이너가 고정 px라 큰 글씨에서 레이아웃 깨짐 검증이 안 됨(`maxFontSizeMultiplier` 등 캡 없음 → 잠재 리스크).
- **SafeArea/노치**: `react-native-safe-area-context` `insets` 활용(Screen·탭바·온보딩 top offset·Android bottom pad).
- **기기 크기**: 가로폭은 `flex`·`%`·`marginHorizontal` 기반 유동. 모달 `maxWidth`(340~380) 캡. `useWindowDimensions`는 알림함 높이(`winHeight*0.5`)에 일부 사용. 태블릿/폴더블 전용 분기는 없음(폰 세로 가정).
- **가로모드**: `app.json` `"orientation": "portrait"` 로 **세로 고정**(가로 미지원). 폰 세로 단일 가정과 일치.

---

## 8. 화면별 텍스트 레이아웃 스케치

### 8.1 홈 ([home.tsx](mobile/app/(tabs)/home.tsx))
```
┌─ AppHeader ─────────────────────────────┐
│ ( ⊙ ) Do:하다           🔔•   (아바타)   │
├─────────────────────────────────────────┤
│ [본문 ScrollView · pull-to-refresh]      │
│ 오늘, 나의 하다                          │
│  ┌ 제목  [👑개설][🤝다함께][D-12][👥 2/3] │
│  │                              [ 인증 ] │  ← 최대 5, 미인증 우선
│  └ … (초과 시 "내 하다 N개 모두 보기 →") │
│ 🏆 끝낸 하다                              │
│  └ 제목  [🏁 종료·06.01~06.30]   박제 →  │
│ 오늘, 하다 인연들의 하루                  │
│  ┌ 🎉 OO님이 100일을 완주했어요  →       │
│  ├ 📸 [챌린지명] · 오늘 N명 인증          │
│  │   [아바타 닉네임 · 12분 전]            │
│  │   [사진 캐러셀 4:3 · 우상단 연속메달]  │
│  │   캡션 · "하다 인연들이 응원했어요 →"  │
│  │   (▼ N명 더 보기)                      │
│ 오늘, 응원으로 힘주기                     │
│  └ 🙋 [응원받기 카드 · 얼굴들 · 응원 보내기]│
│ 함께 합류하기 (누구나 합류)              │
│  └ 🌍 제목 · 함께 N명 · [함께 합류하기]   │
│ 내 관심 분야 하다 (관심 추천)            │
│  └ ✨ 제목 · 관심/같은분야 · 살펴보기 →   │
│ 🌙 오늘은 여기까지예요. / 내일 또, 한 걸음.│  ← 끝 마커(무한스크롤 차단)
└─ 하단 탭바: 홈 · 내 하다 · ⊕ · 기록 · 해냈어요 ─┘
```

### 8.2 챌린지 방 ([room/[id].tsx](mobile/app/room/[id].tsx))
```
┌─ 헤더 ──────────────────────────────────┐
│ ←   🏆 챌린지 제목      (◔◑◒ +5)   초대  │  ← avatars 탭=멤버시트
│      응원받는 하다·함께 6명   [발송메시지] │
├─ info bar ──────────────────────────────┤
│ 🔥 12/30일   📸 4/6 인증     💚  D-18  ⏸멈춤│
│ ▰▰▰▰▰▱▱▱▱▱ (진행률 바)                   │
├─ 5탭 바 ────────────────────────────────┤
│ 💬대화 │ [📸인증] │ 🎥기록 │ 📊현황 │ 🏆박제 │  ← 비멤버는 대화/현황/박제 회색
├─ 탭 콘텐츠 (인증) ──────────────────────┤
│ (응원자면) 💛 OO님의 하다예요 · 응원/댓글  │
│ ┌ 아바타 닉네임 · 시간            ⋯      │
│ │ [사진 정사각 캐러셀 · 연속메달]         │
│ │ 캡션                                    │
│ │ 🔥 👏 💪 ❤️   💬 댓글   ☕              │
│ └ …                                       │
├──────────────────────────────────────────┤
│        [ 📸 오늘 인증하기 ] (FAB)         │  ← 상태별 라벨 분기
└──────────────────────────────────────────┘
```

### 8.3 생성 마법사 ([create.tsx](mobile/app/create.tsx))
```
┌──────────────────────────────────────────┐
│ ✕                3 / 5                     │
│ ●━●━●─○─○ (step dot bar)                   │
├──────────────────────────────────────────┤
│ ROOM TYPE                                  │
│ 누구와 함께 할까요?                        │
│ 방 타입에 따라 둘러보기 노출이 달라져요.   │
│  ┌ 🤫 혼자만의 다짐  나만 보는 조용한 기록 │
│  ├ 🙋 응원받기      지인들이 응원해줘요    │
│  ├ 🤝 함께 하기     초대한 사람들이 같이   │
│  └ 🌍 누구나 합류   둘러보기 공개          │
│  [안내문 에디터: 텍스트 + 보관함 이미지]   │  ← solo 제외
├──────────────────────────────────────────┤
│ [ ← 이전 ]            [ 다음 → / 🎉 만들기 ]│
└──────────────────────────────────────────┘
```

### 8.4 완주 ([complete/[id].tsx](mobile/app/complete/[id].tsx))
```
┌──── 전체화면 오렌지 (Reanimated 모션) ────┐
│                  🏆 (ZoomIn)              │
│                  완주!                     │
│               "챌린지 제목"                │
│            30일을 끝까지 해냈어요          │
│      📸 인증 28일 / 목표 30일 · 완주율 93% │
│   ┌ 더 나은 나, 더 나은 세상            ┐ │
│   └ 내가 하는 것이 나와 세상을 바꿨다   ┘ │
├──────────────────────────────────────────┤
│ [ 기록 공유하기 ]                          │
│ [ 🎯 내기 정산하러 가기 ] (있으면)         │
│ [ 🏆 박제 보러 가기 ]                      │
│ [ 홈으로 ]                                 │
└──────────────────────────────────────────┘
```

### 8.5 하다 구경 ([discover.tsx](mobile/app/(tabs)/discover.tsx)) · 탭바 숨김, 내하다/홈 링크 진입 (v2.18)
```
┌─ AppHeader ──────────────────────────────┐
│ 하다 구경                                  │
│ 🔭 남들은 무슨 하다 하나 — 살펴보고 따라해 │
│ [전체][💪건강][🏃운동][📚학습]… (필터칩)   │
├──────────────────────────────────────────┤
│ ┌ [🧍 나홀로]              📚 학습         │  ← 타입 4색 배지 + 카테고리 (신원 없음)
│ │ 챌린지 제목                              │
│ │ 내용/안내문…                             │
│ │ 🗓️ 30일 · 매일 인증                      │
│ │ [안내문 이미지] (opt-out 시 숨김)        │
│ │  ✨기발3  😱대단1  🥹뭉클5  💫새로움2     │  ← 이모지+두글자 라벨
│ │ 🔁 12번 따라 했어요        [ 따라하기 ]  │
│ └                                          │
└──────────────────────────────────────────┘
```

### 8.6 MY ([profile.tsx](mobile/app/(tabs)/profile.tsx)) · 아바타로 진입
```
┌─ AppHeader ──────────────────────────────┐
│ 내 정보                                    │
│   (아바타·사진 변경)                       │
│   닉네임 ✏️                                │
│   email                                    │
│ 관심 분야  [💪건강][🏃운동] ✏️             │
│ 알림                                        │
│  채팅            ────●                      │
│  댓글            ────●                      │
│  응원·좋아요     ────●                      │
│  동료 인증·기록  ────●                      │
│  매일 안부       ────●   [20:00]           │
│  💛 밤10시~아침8시 조용 · 하루 최대 5건     │
│ 🏆 내 완주 보관함 · N개                     │
│ 로드맵 예고 🔒 (내기/인연/박제/한잔/기부)   │
│ [☕ 한잔 내역(파일럿)] [문의·신고] [로그아웃]│
│ v1.0.0 · OTA xxxxxxxx                       │
└──────────────────────────────────────────┘
```

---

## 부록 — 외부 분석가를 위한 관찰 메모 (코드 기반 사실만)

- **정체성 일관성**: "조용한 SNS" 원칙이 코드 전반에 실제 박혀 있음 — 무한스크롤 차단(🌙), 99+ 약화(`formatCheerCount`), 가입순 정렬(인증률 desc 금지), 4종 응원 독립 카운트, "친구/팔로우" 단어 부재("도전 인연"). 트렌드(안티-도파민·BeReal류 진정성)와 정합.
- **복잡도 신호**: 방 화면 단일 파일 2,088줄에 5탭·결제·다짐·신고·모집마감·종료유예가 응축. 4 방 타입 × (멤버/비멤버/개설자/응원자/포기/종료) 상태 조합이 분기 폭증 → 신규 사용자 인지 부하 가능성.
- **결제/내기 노출**: mock·파일럿 게이트로 일부만 켜져 있어, 일반 베타 유저 화면과 파일럿 화면이 다름(감사 시 계정별 상이 주의).
- **글로벌 준비도 낮음**: i18n 골격만, 사실상 한국어 단일. 다크모드·Dynamic Type 미대응 → 글로벌/접근성 심사 관점 보완 여지.
- **동선 단절 → 해소 (v2.18, 0050)**: 과거 둘러보기(discover)는 진입점 0개로 고아 상태 + 4평가 UI가 거기에만 있어 평가 기능 전체가 비노출이었음(수칙 #8 충돌). **'하다 구경'(익명 발상 라이브러리)으로 재설계해 해소** — 내하다 맨 아래 + 홈 링크로 진입 연결, 4평가(✨😱🥹💫) 부활, 개설자·참여자 신원 제거 익명 카드 + 🔁따라하기/참조수(복제 유입 루프). 신원이 없어 비교/줄세우기 대상 자체가 사라져 '조용한 SNS' 정체성과 정합.
- **데드 코드(해소됨)**: `MyChallengeCard.tsx` 미사용 → 감사 중 삭제.

> 이 문서는 코드 스냅샷 기준이며 실기기 스크린샷은 포함하지 않았다(요청의 8번 텍스트 스케치로 대체). 실제 픽셀·인터랙션 검증은 Expo Go/시뮬레이터 동작 확인 필요.
