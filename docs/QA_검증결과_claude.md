# QA 베타검증 — 코드 레벨 검증 결과 (검증자: Claude)

> **대상 시나리오**: [`QA_베타검증_시나리오.md`](QA_베타검증_시나리오.md) (2026-06-18)
> **검증 방식**: 정적 코드 추적 + 자동 테스트 실행 (실기기 미사용)
> **검증일**: 2026-06-18
> **코드 기준**: 현재 작업 트리 (master, 마지막 커밋 5223f5a)

---

## 0. 검증 방식과 한계 (먼저 읽기)

이 문서는 **실기기 테스터가 아니라 "코드 감사" 결과**다. 설치·카메라·푸시·OAuth 왕복·실시간 채팅·렌더링 같은 런타임/디바이스 동작은 사람 테스터만 확인할 수 있다. 여기서는 **"시나리오의 기대 동작이 실제 소스에 그대로 구현돼 있는가"를 추적·대조**하고, 자동 테스트 의무 영역(결제·검수·완주)은 직접 실행했다. 사람 테스터가 뛰기 전에 **코드상 모순·버그·정책 위반을 미리 거르는 1차 필터**로 쓴다.

표기:
- ✅ 코드상 시나리오대로 구현 확인
- 🧪 자동 테스트 통과
- 📱 실기기 검증 필요 (코드만으론 결론 불가)

---

## 1. 자동 검증 (직접 실행)

| 항목 | 명령 | 결과 |
|---|---|---|
| 결제·정산·수령·검수·완주 순수 로직 | `npm test` | 🧪 **71/71 통과** |
| 모바일 타입 안정성 | `npx tsc --noEmit` (mobile) | ✅ **0 에러** |

→ **TC-O/P(결제·정산)·TC-E7/R1(AI검수)·TC-S1(완주판정)·TC-P1(내기 백도어)** 의 계산·파싱·상태머신 로직이 회귀 없이 검증됨.

---

## 2. 부록2 "절대 일어나면 안 되는 일(S1)" — 코드 차단 확인

| 위험 | 시나리오 | 코드 근거 | 판정 |
|---|---|---|---|
| 하다 구경 신원 노출 | TC-M1 | `browse_challenges` RPC 반환 컬럼에 `creator_id`/`user_id` **부재**(화이트리스트 SECURITY DEFINER). `gave_up_at is null`·`order by created_at desc` | ✅ |
| 탈퇴 후 닉네임 잔존 | TC-V2 | `delete-account`: nickname→"탈퇴한 사람", email/google_sub/avatar→null, PII 6종 즉시 삭제 | ✅ |
| 탈퇴 시 동료 박제 파괴 | TC-V2 | 하드삭제 없음 — `challenge_members.gave_up_at`만 set, proofs/콘텐츠 보존 | ✅ |
| 미완주 본전 회수 | TC-P1 | `claim-gift`: bet 주문은 서버 `selfBetOutcome`+`validateBetClaim`로만 receive 허용 | ✅ 🧪 |
| 결제 디스클레이머 누락 | TC-O1 | "🧪 모의 결제" 문구 6개 화면(GiftSheet·BetSheet·gift/[id]·room·create·profile) | ✅ |
| 검수 우회/정상글 증발 | TC-R1 | `moderateUgcText`: block→throw, allow/flag→노출, API오류→안전측 차단. 백도어 분기 없음 | ✅ 🧪 |
| 미성년·미인증 내기방 합류 | TC-J3 | `invite.ts` `adult_required` throw + RLS `members_self_insert` | ✅ |
| 남의 계정 삭제 | TC-V1 | `delete-account`가 uid를 **JWT에서만** 도출, body 무시 | ✅ |

---

## 3. 핵심 판정 로직 단일 소스 (stats.ts) 대조

| 시나리오 | 함수 | 확인 내용 | 판정 |
|---|---|---|---|
| TC-S1 완주 | `goalStatus` | count=총 인증 수·조기완주 / cadence=KST 고유 날짜수·종료 후·늦합류 비례 | ✅ |
| TC-G4 count 하루다회 | `goalStatus`+`0049` | count는 `myProofs.length`로 카운트, DB 유니크 인덱스 **count형 제외**(부분 인덱스) | ✅ |
| TC-J4 늦합류 비례 | `memberTargetProofCount` | 합류일>시작일이면 합류일~종료일 기준, count는 고정 | ✅ |
| TC-L2 모집 마감 | `isRecruiting`/`recruitCloseAtMs` | open 한정, 수동잠금 또는 기간 50% 경과 시 마감 | ✅ |
| TC-U2 마무리 유예 | `getFarewellState` | solo 즉시 잠금, 그 외 종료+1~+7일 유예 후 전면 읽기전용 | ✅ |
| TC-G3 연속 메달 | `streakMilestone` | 마일스톤 8단계일 때만 메달, 비마일스톤 null | ✅ |
| TC-B3 Apple 로그인 | `login.tsx` | `appleAvailable && ...` 게이트 → Android 숨김·iOS 노출 | ✅ |

---

## 4. 발견 사항 (낮은 우선순위) — ✅ 모두 조치 완료

- **[S4·코드위생] db.ts stale 주석** — `addLogComment`/`createLog`/`sendChatMessage` 등 7곳에 `// 검수 (flag→hidden)` 주석이 남아 있었으나, v2.19 이후 `moderateUgcText`는 flag를 숨기지 않아 `hidden` 변수는 항상 `false`(block이면 throw). 동작 버그 아님, 주석만 오해 소지였음. → **✅ 해결: `// 🚀 검수 (v2.19: block→차단, flag·allow→통과·미숨김)`로 일괄 교정**
- **[테스터 안내] TC-R4 플레이스홀더 범위** — "🙈 숨김 처리된 기록" 자리표시는 **기록(logs)에만** 적용(`fetchLogs`/`fetchRecentLogs`만 hidden 행 반환). 댓글·채팅·인증·완주이야기의 숨김 항목은 설계상 **그냥 사라짐**(서버 `hidden=false` 필터). → **✅ 해결: `QA_베타검증_시나리오.md` TC-R4에 오인 방지 참고 줄 추가**

---

## 5. 코드만으론 결론 못 냄 → 사람 테스터 필수 (📱)

본질적으로 런타임/디바이스 동작이라 **실기기 검증 필수** (코드 존재 ≠ 정상 동작):

- **Phase A 전체** — 설치·권한 다이얼로그·콜드스타트 흰화면
- **TC-B2** Google OAuth 왕복 / **TC-G1·G2** 카메라·멀티사진 캐러셀·핀치줌 (문서도 실기기 필수 명시)
- **TC-I1** 실시간 채팅(Realtime) / **Phase N** 푸시 수신·조용시간·딥링크
- **Phase W** 네트워크 끊김·백그라운드 복귀·발열·해상도/글꼴
- **TC-X3** 버튼 연타 중복(서버 가드는 있으나 UX 레벨 실측 필요)

---

## 6. 심층 검증 — 결제(O/P) · 검수/신고/차단(R)

### 6-1. 결제·내기 (Phase O/P) — 서버 권위 + 엣지 방어

**금액 위변조 / 중복 결제 (`verifyPayment.paymentMatchesOrder`)**
- `status !== 'created'` → 거부 (이미 처리된 주문 **재승인 차단** = 연타 중복 결제 방지)
- `pg.status !== 'DONE'` → 거부 (PG 미승인)
- `pg.orderId !== order.id` → 거부 (**다른 주문 결제키 재사용 차단**)
- `pg.amount !== order.amount` → 거부 (**클라 금액 조작 차단**)
- 금액의 유일한 출처는 서버 카탈로그(`verdict.amount`) — 클라엔 금액 입력란 자체가 없음

**주문 생성 게이트 (`create-gift-order`)**
- self-bet은 클라 `recipientId` **무시하고 본인(sender) 강제** → 참여자 간 이전 0 보장
- `donation_mode`는 화이트리스트(`commitment|pledge|always`) 외 값 → 기본값(클라 불신)
- 종료된 챌린지(`todayKst > end_date`) 새 내기 차단
- self(solo/cheered)는 개설자만 / group(closed/open)은 `bet_tier` 필수 + 티어·모드를 **챌린지 설정으로 강제**
- **1인 1내기** — 기존 내기(canceled/pay_failed 제외) 있으면 `409 bet_already_exists`
- cheer 일일 한도(`sentTodayCount`)·성인 인증(`is_adult_verified`)·활성 멤버십 서버 판정

**정산 규칙 (`betSettlement.settleBet` ↔ `claimPolicy.validateBetClaim` 일치)**
| 모드 | 완주 | 미완주/포기 |
|---|---|---|
| commitment | 받기 또는 기부(본인 선택) | 기부(실패 인정) |
| pledge | 기부 | 환불(돈 안 나감) |
| always | 기부 | 기부 |
- `validateBetClaim`: `in_progress`(종료 전)는 **어떤 정산도 불가**(조기완주 금지), `receive`는 **commitment+완주만**(미완주 본전 회수 백도어 차단)
- `aborted`(방 폭파) → 전원 환불 / `settlementInvariantHolds`로 **증발·중복 없음** 보증
- 상태머신(`giftStateMachine`): 종결 상태 봉인, `isMoneyHeldLimbo`(돈 받았는데 미정산) 감시

→ 위 전부 `npm test`의 gift-order·bet-settlement·bet-claim·self-bet-outcome·verifyPayment 케이스로 🧪 커버. **결제·정산 엣지에서 코드 결함 없음.**

### 6-2. 검수·신고·차단·숨김 (Phase R)

**검수 (`moderation.ts` + `moderateUgcText`)**
- text 모드 3단(allow/flag/block), pledge 모드는 금액 사전탐지(`containsMoneyAmount`) + 엄격 차단(money/luxury/body/coercion)
- `parseModerationVerdict`: JSON 없음·형식 위반·깨진 JSON·잘못된 verdict → **전부 안전측 block** (검수 못 하면 통과 안 시킴)
- 클라 `moderateUgcText`: block(또는 무응답)→throw(차단), allow/flag→노출, API 오류→throw → **백도어 분기 없음** (TC-R1)

**신고 (`0047` reports)**
- 사유 6종 check 제약, `unique(reporter_id, target_type, target_id)`로 **중복 신고 차단**(23505)
- `apply_report_autohide` 트리거: 같은 대상 신고 **≥3건 → hidden=true** (target_type별 6테이블 분기) (TC-R2)

**차단 (`0047` blocks + `blocked_user_ids()`)**
- RLS는 본인 outgoing만 / `blocked_user_ids()`는 "내가 차단 ∪ 나를 차단" **양방향 union, 방향 비노출** (TC-R3)
- 클라 8개 surface가 `fetchBlockedUserIds()` Set으로 양방향 제외 + 서버 `hidden=false` 필터

**숨김 정직화 (TC-R4)**
- `fetchLogs`/`fetchRecentLogs`는 `hidden` 필터 없이 행+플래그 반환 → 기록 카드 자리에 "🙈 숨김 처리된 기록" 플레이스홀더 (증발 금지)
- ⚠️ 단, 플레이스홀더는 **기록(logs)에만** 적용. 댓글·채팅·인증·완주이야기는 설계상 `hidden=false` 서버 필터로 빠짐(자리표시 없음) — 의도된 동작, 버그 아님

### 6-3. 심층 검증 종합

결제·검수·신고·차단의 **로직·상태머신·RLS·서버 게이트 어디에서도 동작 결함이나 우회 경로를 찾지 못함.** S1급 위험(미완주 회수·금액 조작·연타 중복·검수 우회·신원 노출)은 전부 서버 권위로 봉인돼 있고 자동 테스트로 회귀 방지됨. 남은 미확인은 실기기 UX(디스클레이머가 실제로 화면에 보이는지, 키보드 가림, mock 본인인증 입력)뿐 — 사람 테스터 영역.

---

> 본 문서는 코드 레벨 1차 감사. 최종 판정은 실기기 검증(사람 테스터) 결과와 합산한다.
