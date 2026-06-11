# 🚀 Do : 하다 — 셋업 체크리스트

VS Code + Claude Code로 Day 1을 시작하기 전 점검표.
순서대로 따라가면 환경 셋업이 끝납니다.

---

## 📂 1. VS Code 폴더 구조 *(2026-06-01 실제 상태)*

```
dohada/                                  # ⭐ 프로젝트 루트
├─ 📘 Do_하다_통합기획서_v4_0_1.pdf       # 장기 비전·정책
├─ 📋 CLAUDE.md                          # Claude Code 작업 규칙
├─ 📋 MVP_SCOPE.md                       # Phase 1 단일 진실원천 (v2.1)
├─ 📋 BLUEPRINT.md                       # ⭐ 베타 모집 HTML 청사진 (v2.1 신규)
├─ 📋 setup-checklist.md                 # 이 파일
├─ 🔐 .env.example.txt                   # 키 템플릿 (커밋)
├─ 📋 .gitignore
│
├─ 📱 prototype/
│  └─ do-hada-app-v4.html                # ⭐ UI/UX 절대 기준 (v4 = 28화면)
│
├─ 📦 mobile/                            # ⭐ Expo SDK 54 프로젝트
│  ├─ app/                               # Expo Router 라우트
│  │  ├─ _layout.tsx                     # + 알림 응답 핸들러 (v2.1)
│  │  ├─ index.tsx (splash)
│  │  ├─ onb1~4.tsx, login.tsx, welcome.tsx
│  │  ├─ (tabs)/                         # 5탭 nav (v2)
│  │  │   ├─ _layout.tsx
│  │  │   ├─ home.tsx, my-challenges.tsx
│  │  │   ├─ create-tab.tsx (listener), discover.tsx, profile.tsx
│  │  ├─ create.tsx                      # 5단계 마법사 (2026-06-11 압축)
│  │  ├─ room/[id].tsx                   # 5탭 + 헤더 v4 (v2)
│  │  ├─ checkin/[id].tsx
│  │  ├─ invite/[id].tsx, complete/[id].tsx
│  │
│  ├─ components/
│  │  ├─ Button, Screen, OnbView, ErrorState, Skeleton, CommentsSheet
│  │  └─ challenge/                      # ⭐ 5탭 분리 (v2)
│  │      ├─ ChatTab.tsx                 # Realtime 채팅
│  │      ├─ LogTab.tsx                  # Vlog 기록 + 작성 모달
│  │      ├─ StatusTab.tsx               # 가입 순 + 본인 위
│  │      └─ ArchiveTab.tsx              # 진행중/완주 분기
│  │
│  ├─ lib/                               # tokens, supabase, auth, db, types, session,
│  │                                     # upload, invite, haptics, stats, notifications,
│  │                                     # sentry, i18n + locales/
│  │  ├─ format.ts                       # ⭐ 99+ 정책 (v2.1)
│  │  └─ push.ts                         # ⭐ Expo Push Token + prefs (v2.1)
│  │
│  ├─ assets/                            # fonts/Pretendard-*, images/icon·splash·...
│  ├─ 🔐 .env                            # 실제 키 (gitignore)
│  ├─ app.json, eas.json, metro.config.js
│  └─ package.json
│
└─ 🗄️ supabase/
   ├─ migrations/
   │  ├─ 0001_init.sql                   # 5 테이블 + RLS + 트리거
   │  ├─ 0002_kind_pause.sql              # 단독 + 잠시 멈춤
   │  ├─ 0003_open_challenge.sql          # 공개(open) + 비멤버 SELECT
   │  ├─ 0004_comments.sql                # 인증 댓글
   │  ├─ 0005_fix_rls_recursion.sql       # RLS 무한 재귀 핫픽스
   │  ├─ 0006_create_challenge_rpc.sql    # 만들기 RPC (트리거 우회)
   │  ├─ 0007_v2_categories_chat_logs_votes.sql  # v2 도메인 일괄
   │  ├─ 0008_cheered_challenge_type.sql  # ⭐ 응원받기 방 (v2.1)
   │  └─ 0009_notifications_quiet_4principles.sql # ⭐ 조용 알림 4원칙 (v2.1)
   │
   └─ functions/
      ├─ r2-presign/index.ts             # R2 presigned PUT
      ├─ moderate-challenge/index.ts     # AI 검수 (Claude Haiku)
      └─ flush-notifications/index.ts    # ⭐ 알림 cron 처리기 (v2.1)
```

---

## ✅ 2. 사전 설치 체크 (Day 1 시작 전)

### 개발 도구
- [ ] Node.js LTS 설치 (≥ 20.x 권장) — `node -v` 확인
- [ ] npm 또는 pnpm 설치 — `npm -v`
- [ ] Git 설치 — `git --version`
- [ ] VS Code 설치 + 한국어 팩
- [ ] Claude Code 설치 — `npm install -g @anthropic-ai/claude-code`
- [ ] Expo CLI — `npm install -g expo`
- [ ] EAS CLI — `npm install -g eas-cli`

### 폰 (iPhone 12 Pro Max 기준)
- [ ] App Store에서 **Expo Go** 설치
- [ ] PC와 같은 Wi-Fi에 연결되어 있는지 확인

### VS Code 확장
- [ ] ESLint
- [ ] Prettier
- [ ] React Native Tools
- [ ] (기본 TypeScript 확장)
- ※ NativeWind 안 씀 (StyleSheet + tokens.ts 로 결정)

---

## 🔑 3. 외부 서비스 계정 + 키 발급 *(2026-05-26 갱신)*

`.env` 위치: **`mobile/.env`** (gitignore 됨). 템플릿: [.env.example](.env.example)

### Phase 1 MVP 필수 (3개)
- [ ] **Supabase 프로젝트** — https://supabase.com
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Edge Function 환경변수 — 클라이언트 노출 X)
  - SQL Editor 에서 `supabase/migrations/0001_init.sql`, `0002_kind_pause.sql` 실행
  - Authentication → Providers → Google ON + Web ID/Secret + iOS ID 같이 (콤마) + Skip nonce checks ON

- [ ] **Google Cloud OAuth** — https://console.cloud.google.com
  - iOS Client (번들 ID: `app.dohada.beta`) → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS`
  - Web Client → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB` + Client Secret 은 Supabase 콘솔에
  - Authorized redirect URI 에 `https://<project>.supabase.co/auth/v1/callback` 추가
  - Android Client 는 EAS Build 후 SHA-1 확보되면 발급 (지금은 비워두면 web 으로 fallback)

- [ ] **Cloudflare R2** — https://dash.cloudflare.com → R2
  - 버킷 생성 (예: `dohada-proofs`) + Public Access ON + CORS (GET/PUT)
  - `EXPO_PUBLIC_R2_ACCOUNT_ID`, `EXPO_PUBLIC_R2_BUCKET`, `EXPO_PUBLIC_R2_PUBLIC_URL`
  - API Token (Object Read & Write, 특정 버킷만) → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - Supabase CLI 로 secrets 설정 + `r2-presign` 함수 배포:
    ```bash
    supabase login && supabase link --project-ref <ref>
    supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
                          R2_BUCKET=dohada-proofs R2_PUBLIC_BASE_URL=https://pub-....r2.dev
    supabase functions deploy r2-presign --no-verify-jwt
    ```

### 베타 출시 직전 필수
- [ ] **Apple Developer Program** — $99/year. EAS iOS 빌드 + Apple Sign In 위해 필수.
  - 활성화 후: App ID 에 "Sign in with Apple" capability ON
  - Keys → "+K" → Sign in with Apple → .p8 파일 다운로드 (한 번만)
  - Services ID 발급 (Apple Sign In 서비스용)
  - Supabase → Authentication → Providers → Apple ON + Services ID + Team ID + Key ID + .p8 키 등록
- [ ] **EAS** — Expo 계정 (`eas login`) + `eas init` 으로 projectId 발급
- [ ] **Google Play Console** — $25 단발. Android 베타 테스트 트랙용.

### 선택 (있으면 좋음)
- [ ] **Sentry** — https://sentry.io 무료 계정 → DSN → `EXPO_PUBLIC_SENTRY_DSN`. 비워두면 noop.
- [ ] **Google Play Console** — $25 단발 (Android 출시 시)
- [ ] **카카오 디벨로퍼스** — Phase 1.5 (카카오 공유 SDK 정식 도입 시. MVP 는 RN Share API)

### Phase 2+ (확장 시점)
- [ ] 토스페이먼츠 / Stripe (내기/결제)
- [ ] Anthropic (AI 콘텐츠 검수)
- [ ] Mixpanel / PostHog (행동 분석)

---

## 📋 4. .gitignore 필수 항목

```gitignore
# 환경변수
.env
.env.*
!.env.example

# Expo
.expo/
.expo-shared/
dist/
web-build/

# Node
node_modules/
npm-debug.*
yarn-debug.*
yarn-error.*

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# 빌드
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*

# 로그
*.log

# Supabase 로컬
supabase/.temp/
```

---

## 🎬 5. 현재 작업 시작 명령

코드는 이미 완성 상태. 새 세션에서 작업 이어갈 때:

```bash
cd e:\dohada
claude code .
```

새 세션 첫 메시지 권장 형태:

```
이 프로젝트는 Do : 하다 챌린지 SNS 앱입니다.

먼저 다음 파일을 순서대로 읽어주세요:
1. CLAUDE.md (작업 규칙 — 반드시 준수)
2. MVP_SCOPE.md (Phase 1 단일 진실원천. 6개 기능 + A~I 완성도 항목)
3. setup-checklist.md (현재 폴더 구조 + 외부 서비스 셋업 상태)
4. prototype/do-hada-app-v4.html (시각 가이드)

작업 디렉토리: mobile/ (Expo SDK 54), supabase/ (DB + Edge Function)
```

---

## 🛡️ 6. 보안 점검 (Day 1 끝나기 전)

- [ ] `.env` 파일이 git에 안 올라갔는지 `git status`로 확인
- [ ] `.gitignore`에 `.env` 들어있는지 확인
- [ ] Supabase **Anon Key**만 `EXPO_PUBLIC_` 으로 쓰고 Service Role Key는 별도
- [ ] 첫 커밋 메시지에 API 키가 포함되지 않았는지 확인
- [ ] GitHub 리포지토리는 **Private**로 만들기

---

## 🎯 7. 베타 출시 완료 기준 *(2026-06-01 갱신, v2.1)*

### ✅ 코드 / 인프라
- [x] v1 6개 기능 + 베타 완성도 A~L
- [x] v2: 5탭 + 만들기 7단계 + 카테고리 10 + 이중 평가 + 둘러보기 v4
- [x] 정체성 카피 A~J + 큰 숫자 99+
- [x] **v2.1: 응원받기 방 (cheered) + 조용 알림 4원칙**
- [x] Supabase / R2 / Google OAuth / Apple Sign In / 매일 로컬 알림
- [x] Edge Functions 3개 (moderate-challenge, r2-presign, flush-notifications)
- [x] Apple Developer 활성화 + Push Key
- [x] EAS development 빌드 + iPhone 설치 + 개발자 모드
- [x] expo-notifications plugin + APNs entitlement

### ⏳ 검증 / 모집
- [ ] 본인 며칠 풀 검증 (응원받기 방 + 알림 + 5탭 + 정체성)
- [ ] [`BLUEPRINT.md`](BLUEPRINT.md) 기반 베타 모집 HTML 작성
- [ ] production 빌드 + TestFlight 업로드
- [ ] 클로즈드 베타 30명 모집 (TestFlight + 카카오 채널 / Google Form)
- [ ] 1주일 인터뷰 (BLUEPRINT §8 질문지)

---

## 🆕 7.5 v2.1 셋업 가이드 (2026-06-01 추가)

미르가 0~6 단계는 이미 끝났고, v2.1 이후 추가로 한 셋업만 정리:

### 7.5.1 마이그레이션 적용 (Supabase SQL Editor 통째 Run)

| 순서 | 마이그레이션 | 내용 |
|:-:|---|---|
| 1 | 0007_v2_categories_chat_logs_votes.sql | categories + subcategories + chat_messages + logs + challenge_votes + cheers 확장 + RPC 재정의 |
| 2 | 0008_cheered_challenge_type.sql | 응원받기 방 + RLS (can_create_in_challenge) |
| 3 | 0009_notifications_quiet_4principles.sql | device_tokens + notification_prefs + notification_queue + 5 INSERT 트리거 |

### 7.5.2 Edge Function 배포

```powershell
cd e:\dohada
supabase functions deploy flush-notifications --no-verify-jwt
```

### 7.5.3 Supabase Cron (SQL Editor 1회 실행)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'flush-notifications-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://bpffxeddkuekefphsolz.supabase.co/functions/v1/flush-notifications',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

확인: `select jobname, schedule, active from cron.job;` → `flush-notifications-every-minute | * * * * * | true`

### 7.5.4 APNs / EPN

- Expo Push Service (EPN) 사용 → Apple Push Certificate 별도 셋업 X
- 미닝플로의 Push Key (PL5DM4Z5JH) 그대로 재사용
- app.json 의 `plugins` 에 `["expo-notifications", { "color": "#FF6B35" }]` 등록 (v2.1 적용 완료)

### 7.5.5 EAS 새 빌드 (v2.1 변경 반영)

```powershell
cd e:\dohada\mobile
eas build --profile development --platform ios
```

- expo-notifications plugin → `aps-environment` entitlement 자동 포함
- 첫 실행 시 알림 권한 팝업 → 허용 → device_tokens 자동 등록 확인

---

## 📞 8. 막힐 때

1. Claude Code에 에러 메시지 통째로 붙여넣기
2. "Expo SDK 54 + Expo Router + TypeScript 환경" 명시
3. 통합기획서 부록 **E.9 막힐 때 비상 대응** 참고
4. Expo / Supabase / Cloudflare Discord 커뮤니티

---

**마지막으로 ⚠️**

이 체크리스트는 **순서대로 따라가면 끝나도록** 만들어졌습니다.
도중에 막히면 다음 단계로 도망가지 말고, 그 자리에서 해결하세요.
1인 바이브 코딩의 함정은 "다음에 하지 뭐"가 누적되는 것입니다.

🚀 좋은 출발 되세요!
