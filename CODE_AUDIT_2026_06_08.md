# Do : 하다 — 베타 출시 전 코드 점검 리포트 (2026-06-08)

대상: FEEDBACK #1~#13 반영분 + 마이그레이션 0018~0021 및 관련 RLS·Edge Function·UI.
점검자: Claude Code (Opus 4.7).
점검 범위: 코드 품질 · 보안(해킹/RLS) · 어뷰징 노출 · 베타→정식 출시 리스크.

---

## 📋 개선 항목 체크리스트 (우선순위)

### 🔴 P0 — 출시 전 반드시 수정 (베타 동작 자체가 깨질 수 있는 결함) — **2026-06-08 완료** ✅

마이그레이션 [0022_fix_p0_security_gaps.sql](supabase/migrations/0022_fix_p0_security_gaps.sql) + [db.ts](mobile/lib/db.ts#L951) 패치 + EAS Update 양 채널 배포(`b831f8ba-…` / `5e3fd62e-…`).

- [x] **P0-1**  `notification_queue` 직접 INSERT 제거 → `notify_creator_gave_up` security definer RPC 로 대체
- [x] **P0-2**  `challenges_creator_update` 정책 신설 + invitation_message 길이 check + `gave_up_at` set-once 트리거
- [x] **P0-3**  `enqueue_chat_notif` 트리거 머리에 `if new.is_notice then return new; end if;` 추가
- [x] **P0-4**  `chat_self_insert` 정책에 is_notice 위장 차단 가드 추가
- [x] **P0-5**  `can_create_in_challenge` 헬퍼에 `gave_up_at is null` 가드 + `cheers_self_insert` 정책 강화(멤버·오픈 검증)
- [x] **P0-6**  `send_creator_notice` 에 길이 1~200 검증 + 60초 쿨다운 + advisory lock + 종료 챌린지 차단

### 🟡 P1 — 베타 동안 모니터링, 정식 출시 전 정리 필수 — **2026-06-08 완료** ✅

마이그레이션 [0023_get_invite_info_rpc.sql](supabase/migrations/0023_get_invite_info_rpc.sql) + flush-notifications 패치 + cron 헤더 갱신 + 클라이언트 패치 + EAS Update 양 채널 재배포 (`4ed5a380-…` / `3389a73d-…`).

- [x] **P1-7**  flush-notifications 머리에 `FLUSH_NOTIFICATIONS_SECRET` Authorization 검증 + Verify JWT OFF + cron command 에 헤더 추가
- [x] **P1-8**  일일 cap 카운팅을 batch group 단위 dedupe 로 보정 (cheer_batch/log_like_batch N row → 1건)
- [x] **P1-9**  `get_invite_info` security definer RPC 신설 (0023) → `fetchChallengeDetailForInvite` RPC 호출로 교체. closed/cheered 챌린지도 비멤버가 메타 안전 조회
- [x] **P1-10** room/[id].tsx 의 console.log 제거 + `enterAlertShownRef` 가드 추가
- [x] **P1-11** invite/[id].tsx 의 accept/reject 둘 다 `clearPendingInvite()` 호출 + joinChallenge 의 'already_member' status 분기
- [x] **P1-12** home.tsx 의 `abandonedAlertShownRef` 가드 (P0-2 자연 해소 + 안전망)
- [x] **P1-13** 0019 RPC 에 actor_id 노출 의도 주석 보강 (notification_queue 가 service_role 한정 — 의도된 동작)

### 🟢 P2 — 코드 품질·유지보수성 — **2026-06-08 완료** ✅

- [x] **P2-14** InviteConfirmModal reset 을 close 시점에만 (`!visible` 트리거)
- [x] **P2-15** `lib/format.ts` 에 `getKstTodayRange()` 추가 + db.ts 두 곳 KST 기준으로 통일
- [x] **P2-16** `fetchFellowProofs` 에 Phase 2 RPC 이관 TODO 주석 추가 (비효율 인지)
- [x] **P2-17** `giveUpMembership` console.log 제거 — P0 작업에서 함께 정리
- [x] **P2-18** ChatTab 의 INSERT 이벤트가 payload + author 단건 조회로 incremental 적용 (전체 load() 제거)
- [x] **P2-19** `_layout.tsx` daily reminder 기본값 OFF (`enabledStr === 'true'`) — 명시 동의 흐름
- [x] **P2-20** P0-2 수정으로 신규 포기 챌린지의 `challenges.gave_up_at` 정상 갱신 → 자연 해소
- [x] **P2-21** docs/invite.html anon key 인지 주석 + origin 제한 권장 (정식 출시 단계 작업)
- [x] **P2-22** `joinChallenge` 가 `JoinResult` 반환 ('newly_joined' / 'already_member') → invite/[id].tsx 에서 분기 메시지
- [x] **P2-23** InviteConfirmModal 일반 참여자도 본인 글귀 추가 가능 (개설자 메시지 있을 때도 토글로 폼 노출)

### 🚀 정식 출시 전환 시 추가 리스크 (코드만으론 해결 불가)

- [ ] **R1**  AI 콘텐츠 검수 미구현 (챌린지 생성·인증 사진·완주 이야기) — 앱 심사 반려 가능
- [ ] **R2**  미성년자(만 14세 미만) 차단 미구현 (`users.birth_date` 컬럼 자체 없음)
- [ ] **R3**  약관·개인정보 수집 동의·회원 탈퇴 흐름 부재 — 정통망법/GDPR 위반 소지
- [ ] **R4**  TestFlight·EAS Update URL을 정식 App Store / Play Store URL 로 전환 필요
- [ ] **R5**  무한 외부 의존성 (exp.host · Supabase · GitHub Pages · R2) 의 단일 장애점 대응
- [ ] **R6**  EAS Update 채널 운영 (production/preview 양쪽 push) 실수 1회로 환경 불일치 가능
- [ ] **R7**  딥링크 패키지명 `app.dohada.beta` 하드코딩 — 정식 packageId 분리 운영 필요

---

## 🔍 결함별 상세 (P0 만 발췌, 전체 진단은 채팅 기록 참조)

### P0-1. `notification_queue` 직접 INSERT 가 RLS 로 차단

**증거**
- [supabase/migrations/0009_notifications_quiet_4principles.sql:96-97](supabase/migrations/0009_notifications_quiet_4principles.sql#L96) — `enable row level security` 만, **policy 0 개**
- [mobile/lib/db.ts:998](mobile/lib/db.ts#L998) — 클라이언트가 직접 `notification_queue.insert(...)` 호출, 결과 destructure 안 함 → **silent fail**

**결과**: FEEDBACK #10 의 "📢 챌린지 종료: ○○○님이 도전을 포기하여 방이 종료되었습니다" 푸시가 멤버에게 도달하지 않을 가능성.

**수정 방향(TO-BE)**:
1. `notify_creator_gave_up(p_challenge_id uuid)` 라는 SECURITY DEFINER RPC 신설 — 개설자 검증 후 큐 INSERT.
2. db.ts 의 `giveUpMembership` 은 그 RPC 만 호출, 직접 INSERT 제거.

---

### P0-2. `challenges` UPDATE 정책 부재

**증거**
- `grep "for update" supabase/migrations` 결과: challenges 정책 없음 (users / device_tokens / notification_prefs / challenge_members / logs / completion_stories 만).
- [mobile/lib/db.ts:1021-1025](mobile/lib/db.ts#L1021) `updateInvitationMessage` 가 `challenges.update` 시도
- [mobile/lib/db.ts:967-971](mobile/lib/db.ts#L967) `giveUpMembership` 이 `challenges.gave_up_at` update 시도

**결과**: 초대 메시지 저장 실패 + 개설자 포기의 `challenges.gave_up_at` 갱신 실패 → 발견 목록·동료 인증 피드 필터링이 깨질 수 있음.

**수정 방향(TO-BE)**:
```sql
create policy challenges_creator_update on public.challenges
  for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());
```

---

### P0-3. 공지 메시지의 이중 푸시 알림

**증거**
- [supabase/migrations/0019_creator_notice.sql:38-51](supabase/migrations/0019_creator_notice.sql#L38) — RPC 가 `chat_messages` INSERT 후 추가로 `creator_notice` 큐 INSERT.
- [supabase/migrations/0009_notifications_quiet_4principles.sql:103-126](supabase/migrations/0009_notifications_quiet_4principles.sql#L103) — `trg_enqueue_chat` 트리거가 모든 INSERT 에 대해 `chat` 큐 추가.

**결과**: 멤버는 같은 공지에 푸시 2건(`📢 개설자 공지` + `새 대화`) 수신 + 일일 cap 5 중 2 소모.

**수정 방향(TO-BE)**: 트리거 함수 머리에 `if new.is_notice then return new; end if;` 추가.

---

### P0-4. 가짜 공지 위장 어뷰징

**증거**
- [supabase/migrations/0007_v2_categories_chat_logs_votes.sql:197-200](supabase/migrations/0007_v2_categories_chat_logs_votes.sql#L197) `chat_self_insert` 정책에 `is_notice` 가드 없음
- [mobile/components/challenge/ChatTab.tsx:30-32, 143-181](mobile/components/challenge/ChatTab.tsx#L30) UI 는 `is_notice` 만 보고 상단 고정 표시

**결과**: 일반 멤버가 `is_notice=true` 로 INSERT → 챌린지방 상단에 영구 가짜 공지.

**수정 방향(TO-BE)**: `chat_self_insert` 정책 with check 에 다음 추가
```sql
and (is_notice = false or exists (
  select 1 from public.challenges c
  where c.id = challenge_id and c.creator_id = auth.uid()
))
```

---

### P0-5. 포기 멤버의 인증·평가·응원 INSERT 가능

**증거**: 0001/0007 의 `proofs_self_insert`, `cheers_self_insert`, `votes_self_insert` 는 helper 함수가 아니라 직접 `EXISTS (... challenge_members ...)` 사용, **`gave_up_at is null` 조건 없음**.

**결과**: API 직접 호출 시 포기한 사용자도 데이터 INSERT 가능 (정상 UI 로는 불가).

**수정 방향(TO-BE)**: 해당 정책들을 `is_member_of(challenge_id)` 헬퍼 사용으로 통일.

---

### P0-6. `send_creator_notice` 길이·쿨다운 검증 부재

**증거**: [0019:16-53](supabase/migrations/0019_creator_notice.sql#L16) — 빈 메시지·과도한 호출 모두 통과.

**결과**: 악의 또는 실수로 개설자가 알림 폭격 가능 (멤버 전원 × 호출 횟수).

**수정 방향(TO-BE)**: RPC 머리에 길이 1~200 검증 + 60초 쿨다운 검증 추가.

---

## ✅ 좋은 점 (유지)

- 조용한 알림 4원칙 설계는 견고
- 0017 의 `is_member_of` 헬퍼 갱신으로 SELECT 단 가드 일관성
- Optimistic UI + Realtime 결합 안정
- invite/[id].tsx 자동 가입 차단 + 명시 동의 패턴
- `*_self_*` 정책 패밀리 일관성

---

## 🛠 작업 순서 (수정 진행 시 권장)

각 항목은 작업 단위가 분리되어 있으므로 1개씩 — **AS-IS → TO-BE → 적용 → 검증** 순서를 지키며 진행.

1. **사전 확인**: 운영 Supabase DB 의 현재 정책 스냅샷 (P0-1·P0-2 가 이미 수동 패치되어 있는지)
2. P0-2 (challenges UPDATE 정책) → 가장 가벼우면서 가장 많은 동작을 회복
3. P0-1 (notification_queue 직접 INSERT 제거 + RPC 화)
4. P0-3·P0-4 (트리거 is_notice skip + chat_messages 가드)
5. P0-5 (proofs/cheers/votes 정책 helper 사용)
6. P0-6 (send_creator_notice 검증·쿨다운)
7. P1 군 — 인증·디버그 코드 정리·invite 분기 정리
8. P2 군 — 코드 품질
9. R 군 — 정식 출시 전 별도 트랙

각 단계는 **하나의 마이그레이션 파일 또는 하나의 클라이언트 파일 패치 단위**로 분리해서 적용 + 사용자 검증.

---

## 📌 메모

- 마이그레이션 신규 번호는 0022 부터 (현재 0021 까지 적용됨)
- 마이그레이션 적용 후 반드시 Supabase 대시보드 SQL Editor 에서 검증 쿼리 실행 (정책 존재 / 트리거 동작 / 시드 데이터 확인)
- 클라이언트 패치 후 Expo Go 실기기에서 5탭(대화/인증/기록/현황/박제) + 초대/포기/공지 흐름 수동 검증
