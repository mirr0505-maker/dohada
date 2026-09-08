# 환경 분리 (개발 / 운영) — 계획 문서

> **상태: 계획만. 아직 아무것도 실행하지 않음 (2026-09-08 작성).**
> 이 문서는 "개발용 하다"와 "운영용 하다"를 어떻게 나눌지에 대한 단일 진실원천이다.
> 실제 착수 시 각 체크박스를 채우고, 완료된 단계는 날짜와 함께 기록한다.

---

## 1. 지금 상태 진단

**껍데기는 이미 분리돼 있고, 데이터는 안 돼 있다.**

- [`mobile/app.config.js`](../mobile/app.config.js) — `APP_VARIANT=development` 이면
  번들 ID `app.dohada.beta.dev` + 이름 "Do : 하다 Dev" → 아이콘 다른 별도 앱으로 **동시 설치 가능** ✅
- [`mobile/eas.json`](../mobile/eas.json) — development / preview / production **세 프로필이 전부 같은
  Supabase 프로젝트**(`bpffxeddkuekefphsolz`) + 같은 R2 버킷을 본다 ❌

그래서 지금 생기는 문제:

1. Dev 앱으로 만든 테스트 챌린지·인증·알림이 **운영 사용자 데이터에 그대로 섞인다**
2. 마이그레이션(현재 0001~0078)을 **처음 실행하는 곳이 곧 운영 DB** (SQL Editor 수동 적용 —
   메모 `reference_supabase-db-push-forbidden`). 0051→0052 사고가 실사용자 앞에서 난 이유
3. Dev 빌드는 구글 로그인이 아예 안 된다 (Google Cloud 의 iOS Client 가 운영 번들 ID 와만 짝지어짐 —
   app.config.js 주석에 기록된 미해결 항목)

**위험한 쪽은 앱이 아니라 백엔드다.**

---

## 2. 분리해야 할 축 7개

| 축 | 현재 | 분리 방법 |
|---|---|---|
| ① 앱 레코드 (번들/패키지) | dev 번들 분기 완료 ✅ | 그대로 |
| ② Supabase (DB + Auth + Edge Function + cron) | **공용 ❌** | 프로젝트 2개 |
| ③ Cloudflare R2 버킷 | **공용 ❌** | 버킷 2개 + `r2-presign` secrets 분리 |
| ④ 소셜 로그인 자격증명 | dev 는 구글 로그인 불가 | dev 번들용 Google 클라이언트 발급 · Apple 은 번들 2개 등록 |
| ⑤ 푸시 자격증명 | **확인 필요** | Android FCM 은 package 별(Firebase 앱 추가 필요) · iOS APNs 키는 팀 단위라 공용 OK |
| ⑥ 외부 API 키 (ANTHROPIC 등) | 공용 | dev 전용 키 (사용량·과금 구분) |
| ⑦ OTA 채널 | 채널 3개지만 DB 는 하나 | 아래 3절 |

---

## 3. 목표 구조

```
Dev 앱     app.dohada.beta.dev   →  Supabase dohada-dev (신규)  →  채널 development
운영 앱    app.dohada.beta       →  Supabase bpffxeddkuekefphsolz (현재)
                                     ├─ 채널 preview     (사전 릴리스 · 나 혼자 먼저)
                                     └─ 채널 production  (전체 사용자)
```

### 결정 (근거 포함)

**(가) 현재 프로젝트를 "운영"으로 승격하고, dev 를 새로 만든다.**
반대로 하면 베타 사용자들의 박제가 dev 로 밀린다 — 박제 영구 원칙(CLAUDE.md 기본원칙 #3) 위반.

**(나) `preview` 채널은 dev DB 로 옮기지 않는다. 운영 DB 에 남긴다.**
OTA 검증의 목적은 "운영 데이터에서 잘 도는가" 이므로, 빈 dev DB 로는 검증이 안 된다.
→ `development` = dev DB(기능 개발·마이그레이션 실험) / `preview` = 운영 DB 사전 릴리스 /
`production` = 전체.

**(다) Dev 앱을 공개 스토어에 올리지 않는다.**
애플은 미완성·중복 앱을 리젝하고, 검색에 두 개가 뜨면 사용자가 혼란스럽다.
TestFlight **내부** 테스터(심사 없음) / Play **내부 테스트** 트랙까지만.

---

## 4. 이행 순서

> 첫 단계(1~2)에서 가장 크게 남는 것: **마이그레이션 리허설 장소가 생긴다.**
> 운영 DB 는 78개 파일을 손으로 적용해 왔으므로, 파일 이력과 실제 스키마가 어긋나 있어도
> 지금은 확인할 방법이 없다. dev 재생이 곧 그 검증이다.

- [ ] 1. Supabase 새 프로젝트 `dohada-dev` 생성
- [ ] 2. `supabase/migrations/0001~0078` 을 **파일 순서대로 재생** → 깨지는 지점 기록
- [ ] 3. Edge Function 전체 배포 `--project-ref <dev>` + `supabase secrets set`
      ⚠️ `flush-notifications` 는 **반드시 `--no-verify-jwt`** (메모 `reference_flush-no-verify-jwt`)
- [ ] 4. dev 프로젝트에 pg_cron 스케줄 등록 (flush-notifications)
- [ ] 5. R2 dev 버킷 생성 + `r2-presign` secrets
- [ ] 6. Google OAuth — `app.dohada.beta.dev` 용 iOS / Android 클라이언트 발급
      (= app.config.js 의 "dev 는 구글 로그인 X" 미해결 항목 해소)
- [ ] 7. Apple Sign In — dev 번들에 capability 추가 + Supabase Apple provider 에 번들 2개 등록
- [ ] 8. Android 푸시 — dev package 용 Firebase 앱 추가 (FCM V1). iOS APNs 키는 팀 단위라 공용
- [ ] 9. `eas.json` **development 프로필 env 만** dev URL / anon key 로 교체
- [ ] 10. 로컬 `mobile/.env` 도 dev 프로젝트로 교체 → Expo Go 로 만지다 운영을 건드릴 일이 사라짐
- [ ] 11. dev 시드 데이터: `is_admin` 계정 · 테스트 유저 2~3명 · 샘플 하다 몇 개

---

## 5. 분리 후 운영 규율

- **마이그레이션**: dev 먼저 적용 → 검증 → 운영 적용.
  dev 는 이력이 깨끗하므로 `supabase db push` 사용 가능. **운영은 기존대로 SQL Editor 수동**
  (원격 이력 미기록 상태라 push 하면 깨짐)
- **Edge Function**: dev 배포 → 검증 → 운영 배포. 양쪽 다 `--no-verify-jwt` 규칙 동일
- **실기기 QA** 는 Dev 앱에서. `preview` 채널은 릴리스 리허설 전용
- **결제(mock) · AI 검수 키** 사용량을 dev/운영으로 나눠 과금 추적
- 배포 순서 원칙은 그대로: **migration 먼저 → EF → 클라 OTA**

---

## 6. 비용 · 부담

- Supabase 무료 플랜은 보통 **조직당 활성 프로젝트 2개**까지 → 추가 비용 없이 가능
  (정책은 착수 시점에 확인. 무료 프로젝트는 장기 미사용 시 일시정지되지만 클릭 한 번으로 복구)
- 진짜 비용은 돈이 아니라 **1인 개발자의 이중 관리**(스키마·EF·자격증명 2벌)

### 단계적 이행 (한 번에 다 하지 않는다)

| 단계 | 범위 | 얻는 것 |
|---|---|---|
| **최소** | 4절 1~5 (dev Supabase + 마이그레이션·EF 리허설만, 앱은 손 안 댐) | "운영에 처음 실행하는 SQL" 이 사라짐 |
| **중간** | + 6~11 (dev 앱 빌드가 dev DB 를 봄) | 테스트 데이터가 운영에 안 섞임 |
| **완전** | + TestFlight 내부 / Play 내부 테스트에 Dev 앱 등록 | 스토어 경유로 편하게 설치 |

---

## 7. 알아두어야 할 결정 사항

**번들 ID `app.dohada.beta` 의 "beta" 는 정식 출시 후엔 못 바꾼다.**
바꾸려면 새 앱 레코드 = 현재 TestFlight 테스터 · OTA 연속성 · 서명키 · OAuth 설정을 전부 잃는다
(메모 `reference_eas-run-from-mobile` — Android 서명키 2종은 개발자 인증 등록 상태).
사용자 눈에는 안 보이지만 딥링크 · OAuth · 서명키에 영구히 박힌다.

**판단: 그대로 둔다.** 사용자에게 보이지 않는 문자열 하나 때문에 이관 리스크를 지는 건 손해다.
다만 남는다는 사실은 인지한 채로 간다.
