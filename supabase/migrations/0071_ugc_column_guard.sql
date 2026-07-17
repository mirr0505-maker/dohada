-- 🚀 0071 — UGC 테이블 컬럼 권한 차단 (0068·0069·0070 과 같은 부류, 마지막 정리)
--
-- 공통 문제:
--   logs / log_comments / completion_stories / daily_notes / pledges 의 UPDATE 정책은
--   전부 `using/with check (user_id = auth.uid())` 형태 — "내 글이냐"만 본다.
--   어느 컬럼을 쓰는지는 안 막는다. RLS 는 '행'을 고르는 장치라서 — 컬럼 제한은 GRANT 의 일이다.
--   (0068 users · 0069 challenge_members.role · 0070 challenges 와 완전히 같은 교훈)
--   proofs 는 UPDATE 정책 자체가 없어 INSERT 만 문제인데, 그 INSERT 가 더 위험하다(아래 ④).
--
-- 각 테이블의 화이트리스트는 추측이 아니라 mobile/ 전수 grep 으로 확정했다(테이블별 주석에 근거).
--
-- ⚠️ hidden 은 어느 테이블에도 grant 하지 않는다.
--   hidden 은 서버만 정하는 값이다 — 신고 3건 누적 트리거(0047) · 운영자 RPC(0059
--   admin_set_content_hidden). 클라가 실어 보낼 수 있으면 작성자의 '수정' 한 번이
--   서버의 숨김을 되돌린다. 최근 클라에서 hidden 전송을 전부 제거했고, 여기서 못박는다.
--
-- ⚠️ service_role 은 건드리지 않는다 (Edge Function 들이 이 테이블들을 읽고 쓴다).
-- SELECT · DELETE 는 그대로 (행 단위라 RLS 로 충분).
-- SECURITY DEFINER + owner postgres RPC(parang_posts · admin_* 등)는 grant 회수의 영향을 받지 않는다.
-- 재실행 안전 — revoke/grant 는 멱등.
-- (테이블 단위 revoke 는 기존 컬럼 단위 권한까지 함께 지우므로 재실행해도 상태가 같다)

-- ═════════════════════════════════════════════
-- ① logs — 기록
-- ═════════════════════════════════════════════
-- 문제 (0013:7 logs_self_update):
--   challenge_id 를 UPDATE 로 갈아탈 수 있다. INSERT 는 is_member_of(challenge_id) 로 방 소속을
--   검증하지만(0007:198), UPDATE 는 user_id 만 본다 → 내가 멤버인 방에 기록을 쓴 뒤
--   challenge_id 만 **내가 멤버가 아닌 남의 방**으로 바꾸면 콘텐츠 주입이 된다.
--   (INSERT 게이트를 UPDATE 로 우회하는 전형)
--
-- 클라가 logs 에 실제로 쓰는 경로 (전수 grep):
--   INSERT: db.ts:994-1003 createLog — challenge_id·user_id·title·content·photo_url·photo_urls·
--           share_to_parang·parang_anon
--   UPDATE: db.ts:1024-1027 updateLog — title·content·photo_url·photo_urls 뿐
revoke update, insert on public.logs from authenticated;
revoke update, insert on public.logs from anon;

grant insert (challenge_id, user_id, title, content, photo_url, photo_urls,
              share_to_parang, parang_anon) on public.logs to authenticated;

-- update 에서 뺀 것:
--   challenge_id — 위 '방 갈아타기' 차단 (insert 에는 필요하므로 insert 에만 있다)
--   user_id      — 작성자 바꿔치기 차단
--   hidden       — 서버 전용 (위 상단 설명)
--   share_to_parang / parang_anon — updateLog 가 보내지 않는다.
--                  공명 나누기 여부는 작성 시점의 선택이고, 수정으로 뒤집는 경로는 없다(v2.26 설계 그대로).
grant update (title, content, photo_url, photo_urls) on public.logs to authenticated;

-- ═════════════════════════════════════════════
-- ② log_comments — 기록 댓글
-- ═════════════════════════════════════════════
-- 문제 (0013:13 log_comments_self_update): ① 과 동일 구조 — log_id 갈아타기 + hidden.
--
-- 클라가 실제로 쓰는 경로 (전수 grep):
--   INSERT: db.ts:962-966 addLogComment — log_id·user_id·content
--   UPDATE: db.ts:1046-1049 updateLogComment — content 뿐
revoke update, insert on public.log_comments from authenticated;
revoke update, insert on public.log_comments from anon;

grant insert (log_id, user_id, content) on public.log_comments to authenticated;

-- update 에서 뺀 것: log_id(댓글을 남의 기록으로 이동 = 문맥 조작) · user_id · hidden
grant update (content) on public.log_comments to authenticated;

-- ═════════════════════════════════════════════
-- ③ completion_stories — 완주 이야기 (박제 계열)
-- ═════════════════════════════════════════════
-- 문제 (0016:162 completion_stories_update): challenge_id 갈아타기 + hidden.
--   challenge_id 를 바꾸면 상세 화면의 '어떤 하다를 완주했는지'가 통째로 바뀐다 = 박제 위조.
--   (시스템 통계 4종은 BEFORE UPDATE 트리거 protect_completion_story_stats(0016:107)가
--    OLD 값으로 되돌리므로 UPDATE 쪽은 이미 안전 → grant 에서도 뺀다)
--
-- 클라가 실제로 쓰는 경로 (전수 grep):
--   INSERT: db.ts:1599-1615 createCompletionStory
--   UPDATE: db.ts:1751-1770 updateCompletionStory — 사용자 서술 6종 + photo_urls + visibility
--
-- ⚠️ INSERT 화이트리스트에 시스템 통계 4종(total_days·proof_count·longest_streak·completion_rate)을
--    반드시 포함해야 한다. BEFORE INSERT 트리거 fill_completion_story_stats(0016:47)가 어차피
--    덮어쓰지만, 이 컬럼들은 NOT NULL 이라 createCompletionStory 가 NOT NULL 통과용으로 0 을
--    **실제로 전송**한다(db.ts:1603-1606). 빼면 완주 이야기 작성이 42501 로 전멸한다.
--    (값 자체는 트리거가 덮어쓰므로 grant 해도 조작 불가 — 권한과 무결성이 서로 다른 층에서 지켜진다)
revoke update, insert on public.completion_stories from authenticated;
revoke update, insert on public.completion_stories from anon;

grant insert (challenge_id, user_id,
              total_days, proof_count, longest_streak, completion_rate,
              story, hardest, helped_when_giving_up, advice_to_starters, own_tip, what_changed,
              photo_urls, visibility) on public.completion_stories to authenticated;

-- update 에서 뺀 것: challenge_id(박제 위조) · user_id · hidden · 시스템 통계 4종(트리거가 보호)
grant update (story, hardest, helped_when_giving_up, advice_to_starters, own_tip, what_changed,
              photo_urls, visibility) on public.completion_stories to authenticated;

-- ═════════════════════════════════════════════
-- ④ proofs — 인증 (UPDATE 정책 없음 → INSERT 만)
-- ═════════════════════════════════════════════
-- 문제: goal_type. 트리거 set_proof_goal_type(0049:19)은 `if new.goal_type is null then` **조건부**라
--   클라가 값을 실어 보내면 덮어쓰지 않는다. 그리고 하루 1회 유니크 인덱스가
--   `where goal_type is distinct from 'count'` **부분 인덱스**(0049:48-50)다.
--   → cadence 방 인증에 goal_type:'count' 를 실으면 그 인증만 인덱스 밖으로 빠져
--     하루 1회 제약이 사라진다 = 같은 날 도배 → 완주 이야기의 proof_count·completion_rate 부풀리기.
--     박제는 영구(수칙 3)인데 그 근거가 조작되면 박제가 거짓이 된다.
--
-- 클라가 실제로 쓰는 경로 (전수 grep):
--   INSERT: app/checkin/[id].tsx:172-180 — challenge_id·user_id·photo_url·photo_urls·caption·
--           share_to_parang·parang_anon
--   UPDATE: 없음 (proofs 는 select/insert/delete 정책만 존재 — 0005·0024·0034)
--           → update grant 를 되돌려주지 않는다. 회수만 하면 끝.
revoke update, insert on public.proofs from authenticated;
revoke update, insert on public.proofs from anon;

-- 뺀 것:
--   goal_type    — 위 도배 우회 차단. 트리거가 null 일 때만 채우므로, 클라가 못 보내야 트리거가 항상 이긴다.
--   streak_count — 트리거 set_proof_streak(0044:31,50)이 무조건 대입해 조작은 불가하지만,
--                  서버가 소유하는 값이므로 화이트리스트에서 뺀다(권한도 의도대로 좁게).
--   hidden       — 서버 전용
--   created_at   — 하루 경계(KST) 판정 근거. 클라가 안 보내고, 보낼 수도 없어야 한다.
grant insert (challenge_id, user_id, photo_url, photo_urls, caption,
              share_to_parang, parang_anon) on public.proofs to authenticated;

-- ═════════════════════════════════════════════
-- ⑤ daily_notes — 하루 리듬 (아침 다짐 · 저녁 회고)
-- ═════════════════════════════════════════════
-- 문제 (0056:53 daily_notes_self_update): note_date.
--   note_date 는 서버 default (now() at time zone 'Asia/Seoul')::date = KST 오늘(0056:25).
--   클라가 덮어쓸 수 있으면 지난 날짜로 소급 작성해 "그날 회고했다"를 만들어낼 수 있다
--   (하루 경계는 서버가 정한다 = 0049 교훈).
--
-- ⚠️ createDailyNote(db.ts:2076-2085)는 **upsert**(onConflict: user_id,kind,note_date).
--    PostgREST upsert 는 `insert … on conflict (…) do update set <payload 컬럼 전부>` 를 만든다
--    → payload 4종(user_id·kind·content·visibility)에 **INSERT 와 UPDATE grant 가 둘 다** 있어야
--      동작한다. 하나라도 빠지면 아침 다짐·저녁 회고 작성이 통째로 깨진다.
--    user_id 가 update 목록에 있는 건 upsert 가 SET 에 포함시키기 때문이고,
--    남의 행으로 옮기는 건 daily_notes_self_update 의 with check (user_id = auth.uid())가 막는다.
revoke update, insert on public.daily_notes from authenticated;
revoke update, insert on public.daily_notes from anon;

-- 뺀 것: note_date(서버 KST 기본값 = 소급 조작 차단) · challenge_id(MVP 항상 null, 클라 미사용)
grant insert (user_id, kind, content, visibility) on public.daily_notes to authenticated;
grant update (user_id, kind, content, visibility) on public.daily_notes to authenticated;

-- ═════════════════════════════════════════════
-- ⑥ pledges — 다짐 (무현금 사회적 스테이크)
-- ═════════════════════════════════════════════
-- 문제 (0046:46 pledges_self_update): 클라는 fulfilled 만 쓰는데 direction·content 도 열려 있다.
--   → 실패가 확정된 뒤 direction 을 lose→win 으로 뒤집어 "성공 시 다짐"이었던 척하면
--     '지킬 차례'가 사라진다 = 명예제도의 유일한 근거인 '무엇을 언제 걸었나'가 사후 조작된다.
--     content 도 마찬가지 — 지키기 쉬운 문구로 바꿔치기.
--   다짐은 돈이 아니라 목격으로 지탱되는 기능이라(동료 다짐 공개, v2.15), 사후 수정 가능하면
--   목격 자체가 무의미해진다.
--
-- 클라가 실제로 쓰는 경로 (전수 grep):
--   INSERT: db.ts:1848-1853 createPledge — challenge_id·user_id·direction·content
--   UPDATE: db.ts:1864 togglePledgeFulfilled — fulfilled 뿐
--   (마음이 바뀌면 '거두기' = DELETE(deletePledge, db.ts:1870) → 수정이 아니라 삭제 후 재등록.
--    DELETE 는 그대로 열려 있으므로 정상 UX 는 그대로다)
revoke update, insert on public.pledges from authenticated;
revoke update, insert on public.pledges from anon;

grant insert (challenge_id, user_id, direction, content) on public.pledges to authenticated;

-- update 에서 뺀 것: direction·content(사후 조작) · challenge_id · user_id
grant update (fulfilled) on public.pledges to authenticated;

-- ═════════════════════════════════════════════
-- 적용 후 검증
-- ═════════════════════════════════════════════
-- 부여된 권한 확인 (SQL Editor):
--   select table_name, privilege_type, string_agg(column_name, ', ' order by column_name) as cols
--     from information_schema.column_privileges
--    where table_schema = 'public'
--      and grantee = 'authenticated'
--      and table_name in ('logs','log_comments','completion_stories','proofs','daily_notes','pledges')
--      and privilege_type in ('INSERT','UPDATE')
--    group by table_name, privilege_type
--    order by table_name, privilege_type;
--
--   기대:
--     completion_stories INSERT = advice_to_starters, challenge_id, completion_rate, hardest,
--                                 helped_when_giving_up, longest_streak, own_tip, photo_urls,
--                                 proof_count, story, total_days, user_id, visibility, what_changed
--     completion_stories UPDATE = advice_to_starters, hardest, helped_when_giving_up, own_tip,
--                                 photo_urls, story, visibility, what_changed
--     daily_notes        INSERT = content, kind, user_id, visibility
--     daily_notes        UPDATE = content, kind, user_id, visibility
--     log_comments       INSERT = content, log_id, user_id
--     log_comments       UPDATE = content
--     logs               INSERT = challenge_id, content, parang_anon, photo_url, photo_urls,
--                                 share_to_parang, title, user_id
--     logs               UPDATE = content, photo_url, photo_urls, title
--     pledges            INSERT = challenge_id, content, direction, user_id
--     pledges            UPDATE = fulfilled
--     proofs             INSERT = caption, challenge_id, parang_anon, photo_url, photo_urls,
--                                 share_to_parang, user_id
--     proofs             UPDATE = (행 없음)
--   ※ 어느 테이블에도 hidden 이 없어야 한다.
--
-- 차단 확인 (앱 = authenticated 세션에서. SQL Editor 는 postgres 권한이라 통과해버림):
--   supabase.from('logs').update({ challenge_id: '<남의 방>' }).eq('id', <내 기록>)   → 42501
--   supabase.from('logs').update({ hidden: false }).eq('id', <숨김된 내 기록>)        → 42501
--   supabase.from('proofs').insert({ …, goal_type: 'count' })                         → 42501
--   supabase.from('pledges').update({ direction: 'win' }).eq('id', <내 다짐>)         → 42501
--   supabase.from('daily_notes').update({ note_date: '2026-01-01' })                  → 42501
--
-- 정상 경로 유지 확인 (앱에서 직접 — GRANT 는 서버측이라 OTA 무관하게 즉시 라이브):
--   ① 기록 작성 (사진 포함/미포함) · 기록 수정 · 기록 삭제
--   ② 기록 댓글 작성 · 댓글 수정 · 댓글 삭제
--   ③ 완주 이야기 작성 (⚠️ 최우선 — 시스템 통계 0 전송 경로) · 수정 · 공개범위 변경 · 삭제
--   ④ 인증 (카메라·보관함, 사진 여러 장, 공명에 나누기 토글 ON/OFF, 연속 메달 표시)
--   ⑤ 다짐 걸기 · '지켰어요' 토글 · 다짐 거두기
--   ⑥ 하루 리듬 — 아침 다짐 작성 → 같은 날 재작성(덮어쓰기 upsert) → 저녁 회고 작성
--      (⚠️ upsert 라 INSERT·UPDATE grant 양쪽이 맞아야 함 — '재작성'까지 눌러봐야 검증 완료)
