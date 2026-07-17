-- 🚀 0068 — users 셀프 권한상승(privilege escalation) 차단
--
-- 문제 (0001:102-105):
--   users_self_write 는 `for update using (id = auth.uid())` — with check 가 없고,
--   users 에는 컬럼 단위 grant 도, UPDATE 트리거도 없다.
--   → 로그인한 사용자가 PostgREST 로 자기 행에 is_admin=true / host_tier='org' /
--     early_tier='founder' / deleted_at=null 을 그대로 UPDATE 할 수 있다.
--     is_admin()(0059) 이 이 컬럼을 읽으므로 = 운영자 콘솔 전체 탈취.
--
-- 방어 2겹 (RLS 만으론 못 막는 이유: RLS 는 "행"을 고르는 장치라 "어느 컬럼을 쓰냐"를
--            제한하지 못한다. 컬럼 제한은 GRANT 의 일이다):
--   ① 컬럼 단위 GRANT  = 주 방어선 — 클라(authenticated)가 만질 수 있는 컬럼 자체를 좁힌다.
--   ② RLS with check   = 보조 방어선 — 남의 행으로 id 를 바꿔 옮겨가는 것까지 차단.
--
-- 클라가 실제로 쓰는 경로는 이게 전부다 (전수 grep 확인):
--   INSERT: auth.ts 최초 로그인 upsert — 구글(id·google_sub·email·nickname·avatar_url),
--           애플(id·email·nickname·avatar_url). 둘 다 ignoreDuplicates:true
--           = ON CONFLICT DO NOTHING 이라 UPDATE 권한이 필요 없다.
--   UPDATE: db.ts updateMyNickname(nickname) · updateMyAvatar(avatar_url) — 이 2개뿐.
--
-- ⚠️ service_role 은 건드리지 않는다 — delete-account EF 가 익명화 UPDATE
--    (nickname·email·avatar_url·google_sub·deleted_at)를 service_role 로 수행한다.
--    users.host_tier/early_tier 를 쓰는 함수(0067 admin_review_promotion 등)는 전부
--    security definer + owner postgres 라 grant 회수의 영향을 받지 않는다.
--
-- 재실행 안전 — revoke/grant 는 멱등, 정책은 drop if exists 후 재생성.

-- ═════════════════════════════════════════════
-- ① 컬럼 단위 GRANT — 주 방어선
-- ═════════════════════════════════════════════
-- 테이블 단위 UPDATE/INSERT 를 먼저 회수한다.
-- (테이블 단위 revoke 는 기존 컬럼 단위 권한까지 함께 지우므로 재실행해도 상태가 같다)
revoke update, insert on public.users from authenticated;
revoke update, insert on public.users from anon;

-- 클라가 실제로 바꾸는 컬럼만 되돌려 준다 — 프로필 수정 2종.
grant update (nickname, avatar_url) on public.users to authenticated;

-- 최초 로그인 upsert 가 넣는 컬럼만. is_admin·host_tier·early_tier·deleted_at 은
-- 목록에 없으므로 가입 시점에 심는 경로도 함께 막힌다(기본값으로만 채워짐).
grant insert (id, google_sub, email, nickname, avatar_url) on public.users to authenticated;

-- ═════════════════════════════════════════════
-- ② RLS with check — 보조 방어선
-- ═════════════════════════════════════════════
-- using 만 있으면 "내 행을 골라서 id 를 남의 uid 로 바꾸는" UPDATE 가 통과한다.
-- with check 로 변경 후 행도 여전히 내 것이어야 함을 강제한다.
drop policy if exists users_self_write on public.users;
create policy users_self_write on public.users
  for update using (id = auth.uid())
       with check (id = auth.uid());

-- ═════════════════════════════════════════════
-- 적용 후 검증 (운영 DB 에서 실행 — 자동 테스트 불가 영역)
-- ═════════════════════════════════════════════
-- 아래 3종은 SQL Editor 가 아니라 **앱(로그인한 authenticated 세션)** 에서 확인하는 게 정확하다.
-- SQL Editor 는 postgres 권한이라 grant 검사를 통과해 버린다.
--
-- ① 권한 상승 시도가 거부되는가 (앱 콘솔/PostgREST):
--      supabase.from('users').update({ is_admin: true }).eq('id', <내 uid>)
--    → 42501 permission denied for table users 이어야 한다. (성공하면 이 마이그레이션이 미적용)
--    host_tier / early_tier / deleted_at 도 동일하게 42501.
-- ② 닉네임·아바타 변경은 여전히 되는가: 내정보 → 닉네임 수정, 아바타 변경 → 정상 저장.
-- ③ 최초 로그인 insert 는 되는가: 새 구글/애플 계정으로 로그인 → users 행 생성 + 온보딩 진입.
--    (재로그인 계정은 ON CONFLICT DO NOTHING 이라 아무 일도 안 일어나는 게 정상)
--
-- 부여된 권한 확인:
--   select privilege_type, column_name from information_schema.column_privileges
--     where table_name = 'users' and grantee = 'authenticated'
--     and privilege_type in ('INSERT','UPDATE') order by privilege_type, column_name;
--   -- 기대: INSERT = avatar_url·email·google_sub·id·nickname / UPDATE = avatar_url·nickname
