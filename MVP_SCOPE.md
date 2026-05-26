# 🎯 Do : 하다 — MVP_SCOPE

**이 문서가 Phase 1의 단일 진실원천이다.**
통합기획서 v4.0.1은 장기 비전 자산이며, MVP 단계에서는 **이 문서만** 따른다.

---

## 만드는 이유 (한 줄)

> **"같이 도전하는 사람의 인증을 보고 응원하는 경험"** 이 진짜로 사람을 움직이는지 검증한다.

이것만 검증되면 나머지(박제 자산화, 도전 인연 ×횟수, 사이즈 적응형 UI, 명사 챌린지, 글로벌)는 다 그 위에 얹는다. 검증 안 되면 다른 거 만들어도 의미 없다.

## 성공 기준

- 베타 사용자 **30명**이 챌린지 만들어서 **1주일 이상 인증 지속**
- 그 30명 중 **10명 이상이 "친구에게 추천하고 싶다"** 라고 답함
- 한 챌린지당 **평균 3명 이상**이 모임

이게 안 되면 기능 더 만들지 말고 **왜 안 쓰는지** 인터뷰부터 한다.

---

## ✅ 진짜 만들 것 (6개 기능 + 온보딩 7화면)

> **2026-05-26 추가:** 프로토타입 v4의 온보딩 흐름(splash → onb1~4 → login → welcome)을 **그대로** UI로 제공한다.
> 단, 온보딩에 광고된 일부 기능(내기/박제/명사 챌린지/연락처 매칭)은 Phase 2이므로
> 카피만 보여주고 실제 진입은 불가. **휴대폰 인증은 MVP에서 완전히 제외** (welcome 화면도 약관 동의만).



### 1. 구글 로그인  *(2026-05-26 변경: 카카오 → 구글)*
- 그냥 구글 하나만. 카카오/Apple은 Phase 1.5.
- 회원가입 별도 없음. 구글 로그인 = 가입.
- 구글이 약관 처리는 안 하므로 별도 약관 동의 화면(`welcome`)이 필요함.

### 2. 챌린지 만들기 (단순)
- 입력: 제목 / 기간 / 설명 (선택) / **방 종류**
- **방 종류 3가지** *(2026-05-26 최종)*:
  - 🤝 폐쇄형(`closed`, 동료들과) — 초대받은 사람만, 카톡 공유로 모음
  - 🌍 공개형(`open`, 누구나) — 둘러보기에 노출, 비멤버도 조회/참여 가능
  - 🧘 단독(`solo`, 혼자) — creator 본인만, 다른 사람 가입 불가 (RLS)
- 카테고리 없음. 그냥 자유 텍스트.
- 7단계 마법사 ❌ → 1화면 폼.

### 3. 카톡 링크로 초대
- 챌린지 만들면 초대 링크 자동 생성 (`dohada://invite/<id>`)
- "카톡으로 공유" 버튼 → RN `Share` API. 카카오 SDK 는 Phase 1.5.
- **딥링크 처리**: 받은 사람이 링크 탭하면 자동 챌린지 가입 → 방으로 이동 (미로그인이면 로그인 후 자동).
- QR 명함 ❌ / 연락처 매칭 ❌

### 4. 사진 인증
- 앱 내 카메라로 직접 촬영
- 갤러리 업로드 ❌ (어뷰징 방지)
- EXIF 검증 ❌ (Phase 1.5)
- 하루 1번만 인증 가능
- **이미지 저장소: Cloudflare R2** *(2026-05-26 결정: Supabase Storage 대신)*
  이유: egress 무료, S3 호환, 비용 저렴. DB(`proofs.photo_url`)는 R2 public URL 또는 presigned URL을 보관.

### 5. 챌린지 방 (인증 피드만)
- 5탭 ❌ → 인증 피드 1개 화면만
- 사이즈 적응형 ❌ → 모든 방 같은 UI
- 채팅 ❌
- 멤버 리스트는 화면 상단에 작게
- **공개 챌린지의 비멤버**: 챌린지/멤버/인증/응원 모두 조회 가능, FAB 만 "참여하기" 로 분기

### 6. 응원하기 (❤️ 하나)
- 응원 이모지 5종 ❌ → ❤️ 하나만
- 4가지 평가 ❌
- 누가 응원했는지 보이기
- **Realtime 구독**: 새 인증/응원이 동료 폰에 즉시 반영 (Supabase Realtime).

---

## 🎁 베타 완성도 항목 *(2026-05-26 추가 — A~I)*

위 6개 핵심 외에, 베타 30명 검증 품질을 위해 추가한 것들. **신기능이 아니라 마감 완성도** 차원.

| 항목 | 내용 |
|---|---|
| **A. 완주 화면** | 종료일이 지났고 매일 인증했으면 자동으로 🏆 완주 화면 (인증서/포토북 없음). [app/complete/[id].tsx](mobile/app/complete/[id].tsx) |
| **B. 단독(solo) 방** | 챌린지 만들기 폼에서 "동료들과 / 혼자" 라디오. `challenges.kind` 컬럼. |
| **C. 잠시 멈춤** | 단순 3일/7일 멈춤. `challenge_members.paused_until` 컬럼. 유배지/보석금 같은 페널티 없음. |
| **D. 챌린지 진행률** | room 헤더에 `12/30일 진행 (40%)`. |
| **E. Haptic feedback** | 응원/인증 셔터/챌린지 생성/멈춤 등 주요 액션에 진동. |
| **F. Streak 카운터** | `🔥 N 연속 인증` — 오늘 미인증 시 어제부터 카운트. |
| **G. 매일 로컬 알림** | 매일 저녁 20시 "오늘 인증했어?" 로컬 푸시. Apple Push 인증서 불필요. |
| **H. Skeleton 로딩** | ActivityIndicator 대신 카드 모양 placeholder. |
| **I. Pull-to-refresh** | home + room 모두 적용. |
| **J. 둘러보기** | 공개(open) 챌린지 목록. home 우상단 🌍 → [app/discover.tsx](mobile/app/discover.tsx). RLS 가 비멤버에게 open 챌린지만 노출. |
| **K. AI 콘텐츠 검수** *(2026-05-26 마지막 추가)* | 챌린지 생성 시 제목/설명을 Claude Haiku 4.5 가 비윤리/반국가/폭력/불법 4 카테고리로 검수 → block 이면 생성 차단. 공개 챌린지 도입 부작용 방지. [supabase/functions/moderate-challenge](supabase/functions/moderate-challenge/index.ts) |

추가 인프라:
- **Pretendard 폰트** (Regular/Medium/Bold OTF 3종, 동적 로딩)
- **Sentry 에러 모니터링** — `EXPO_PUBLIC_SENTRY_DSN` 채우면 활성, 비어있으면 noop
- **i18n 골격** — ko/en 두 locale. 화면 텍스트 점진적 교체 (Phase 1.5 ~ Phase 2 글로벌 진입 시 본격)

> **이게 마지막 추가다.** 더 늘리지 않고 베타 30명 검증 → 인터뷰 → 다음 결정.

---

## ❌ Phase 1에 절대 만들지 않을 것

명시적으로 적어둔다. **Claude Code가 친절하게 추가 제안해도 거절한다.**

| 기능 | 통합기획서 위치 | 보류 이유 |
|---|---|---|
| 휴대폰 인증 | 4.4 | **완전 제외** (구글이 약관 처리, welcome 은 약관 동의만) |
| 챌린지 방 5탭 | v3.2 | 인증 피드 하나로 검증 |
| 사이즈 적응형 UI | v3.3 | 5명 가정. 사용자 모이면 그때. |
| 도전 인연 ×횟수 시스템 | v3.4 | Phase 2. 챌린지 끝나면 그냥 끝. |
| QR 명함 + 연락처 매칭 | v3.4 | Phase 2 |
| 4가지 평가 (✨😱🥹💫) | v3.1 | ❤️ 하나로 검증 |
| 응원 이모지 5종 | 4.7.2 | ❤️ 하나로 충분 |
| 박제 자산화 — 인증서/포토북 | 4.10 | Phase 2. **단, MVP 는 단순 완주 화면(A) 까지만.** |
| 내기 시스템 (에스크로) | 4.14 | 결제/정산/환불 복잡. Phase 2. |
| AI 콘텐츠 검수 (인증 사진) | 4.6.3 | **챌린지 텍스트 검수(K)는 적용.** 사진 vision 검수는 Phase 1.5. |
| 유배지/보석금 | 8장 | Phase 2. **MVP 는 단순 잠시 멈춤(C) 만.** |
| 명사 챌린지 | 4.11 | Phase 2 |
| 둘러보기 큐레이션 (스태프픽/인기/검색) | 6장 | **단순 목록만 적용(J).** 큐레이션/검색은 Phase 1.5. |
| 카테고리 2-Tier | v3.1 | 자유 텍스트로 |
| 다국어/글로벌 (한국어 외) | 14장 | 한국어만. **i18n 골격은 잡아둠.** |
| 뱃지/칭호 5등급 | 4.12 | Phase 2 |
| 선물 응원 | 4.7.3 | Phase 2 |
| 음성 메시지 | Phase 2 | Phase 2 |
| 카카오톡 공유 SDK | 4.7 | Phase 1.5. **MVP 는 RN Share API 만.** |
| 카카오/Apple 로그인 | 4.3 | Phase 1.5. MVP 는 구글 단일. |

---

## 📅 진행 상황 (2026-05-26)

### Week 1 — UI + 더미 데이터 ✅
- 구글 로그인 화면 + 온보딩 7화면
- 챌린지 만들기 폼 + 챌린지 방 + 카메라 인증
- 디자인 토큰 + Pretendard 폰트 + StyleSheet 기반

### Week 2 — Supabase + R2 + 실시간 ✅
- Supabase DB 5테이블 + RLS + 트리거 (마이그레이션 0001)
- Cloudflare R2 + Edge Function (SigV4 presign) + 업로드
- Google OAuth → Supabase signInWithIdToken
- expo-camera 실제 연동
- Realtime 구독 (proofs / cheers)
- home/create/room 전 화면 Supabase 연동

### Week 3 — 베타 완성도 ✅
- 초대 딥링크 (`dohada://invite/<id>`)
- 카톡 초대 안내 모달
- ErrorState 컴포넌트 + Sentry 골격 + i18n 골격
- **A~I 일괄** (완주/단독/잠시멈춤/진행률/Haptic/Streak/로컬알림/Skeleton/Pull-to-refresh)
- **J. 둘러보기 + 공개 챌린지** (마이그레이션 0003)
- **K. AI 콘텐츠 검수** — Edge Function `moderate-challenge` (Claude Haiku 4.5)
- 마이그레이션 0002 (`challenges.kind`, `challenge_members.paused_until`),
  0003 (`open` kind + RLS, 비멤버 조회/참여)

### Week 4 — 베타 출시 ⏳
- ⏳ Apple Developer Program 활성화 대기
- [ ] EAS Build (`development` profile)
- [ ] iPhone 설치 + 전체 흐름 실기기 검증
- [ ] 클로즈드 베타 30명 모집 (TestFlight)
- [ ] Sentry DSN 발급 + .env 채우기 (선택)

---

## 🗄️ DB 스키마 (Phase 1)

**5개 테이블이면 충분.** 통합기획서 13장의 20개 테이블 → **5개**로 줄임.
(connections, ratings, logs, badges, bets, archives 등은 Phase 2에서 추가)

실제 마이그레이션: [0001_init.sql](supabase/migrations/0001_init.sql) +
[0002_kind_pause.sql](supabase/migrations/0002_kind_pause.sql) +
[0003_open_challenge.sql](supabase/migrations/0003_open_challenge.sql)

```sql
-- users (auth.users 와 1:1)
id, google_sub, email, nickname, avatar_url, created_at

-- challenges
id, creator_id, title, description,
kind ('closed' | 'solo' | 'open'),  -- 0002: solo, 0003: open
start_date, end_date, created_at

-- challenge_members
id, challenge_id, user_id, joined_at,
paused_until                    -- 0002: 잠시 멈춤 종료일 (nullable)

-- proofs (인증, 하루 1회 unique 인덱스)
id, challenge_id, user_id, photo_url, caption, created_at

-- cheers (응원 ❤️, 1인 1회 unique)
id, proof_id, user_id, created_at
```

추가 인프라:
- **RLS 정책**: 멤버 only, 본인만 작성/삭제
- **트리거**: 챌린지 생성 시 creator 자동 가입
- **Edge Function** `r2-presign`: SigV4 presigned PUT URL 발급 (R2 키 클라이언트 노출 X)

---

## 🚫 Claude Code 작업 시 규칙

**1. 이 문서에 없는 기능은 만들지 않는다.**
"이거 만들 때 X도 같이 만들면 어떨까요?" 같은 제안 거절한다.
거절 멘트: "MVP_SCOPE.md에 없어요. Phase 2에서 봅시다."

**2. 통합기획서 v4.0.1은 참고만.**
v4.0.1은 디자인 톤·정책 (친구 단어 금지, 비교 압박 금지, 미성년자 보호) 참고용.
기능 목록은 이 문서 우선.

**3. 30명 베타가 끝나기 전엔 Phase 2 기능 일절 안 만든다.**
사용자 인터뷰 결과 보고 결정한다.

---

## 🎯 핵심

> **"6개 + A~K 완성도. 베타 30명에게 보여준다."**

코드 측은 완료. 남은 건:
1. Apple Developer 활성화 → EAS Build → iPhone 설치
2. 베타 30명 모집 + 1주일 인증 지속 관찰
3. 결과로 Phase 2 기능 결정 (도전 인연, 내기, 박제, AI 검수 등)
