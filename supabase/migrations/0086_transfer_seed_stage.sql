-- 🚀 0086 — 씨앗 무대 「매일 8천보 걷기」를 법인 계정 소유로 이전 (1회성 데이터 이전)
--
-- 배경 (ORG_HADA_PLAN §9.5 결정 D, 2026-10-28):
--   유일한 공식 무대가 0083 가드 이전에 개인 계정(mirr0505@gmail.com)으로 세워졌다.
--   조직 하다는 조직 계정의 것이어야 한다 → 법인 계정(doinovation@doinno.co.kr)으로 옮긴다.
--   앱 경로로는 개설자 이전이 불가능하다(0022 challenges_creator_update 의 with check) — 그건 의도된 차단이고
--   바꾸지 않는다. 이 파일은 운영자가 한 번 돌리는 데이터 이전이며, 새 RPC·정책을 만들지 않는다.
--
-- 왜 "새로 만들어 복사"가 아니라 "같은 하다의 주인 변경"인가:
--   하다 id 가 그대로라 참여자 인증·연속 기록·초대 링크·알림·울림 글 연결이 전부 유지된다.
--   복사는 id 가 바뀌고, 인증 재삽입 시 연속 트리거(0044)·하루 1회 인덱스(0077)를 다시 맞춰야 한다.
--
-- 옮기는 것 (이 하다 안에서 개인 계정이 한 것만):
--   challenges.creator_id · 멤버 행(role='host'·합류일 유지) · 멈춤 이력 · 기록 · 인증 댓글 · 기록 댓글 ·
--   응원 · 기록 좋아요 · 평가 · 울림 반응/댓글
-- 옮기지 않는 것:
--   gift_orders(모의 결제 — 결제 기록은 실제 결제자 이름으로 보존) · notification_queue(지난 벨 기록)
--   · 개인 계정의 다른 하다 활동 전부
--
-- 부수효과 점검(2026-10-28 운영 DB): 대상 테이블의 UPDATE 트리거는 challenges 의 gave_up_at 1회 설정 가드뿐
--   → 이 이전으로 알림이 나가거나 연속 기록이 재계산되지 않는다.
--
-- 전제 순서 (어기면 스스로 중단한다):
--   ① 0085 적용 → ② 법인 계정 앱 로그인(users 행 생성) → ③ 콘솔에서 검증 기록 + 사람 계층 org 지정 → ④ 이 파일
--
-- 원자성: 전부 DO 블록 하나 = 한 문장 → 중간에 실패하면 아무것도 안 바뀐다.
-- 재실행: 이미 이전됐으면 notice 만 남기고 끝난다.

do $$
declare
  c_challenge_id constant uuid := '7af4c47a-36f4-45c4-957f-01a79f2db751';   -- 매일 8천보 걷기
  c_from_email   constant text := 'mirr0505@gmail.com';
  c_to_email     constant text := 'doinovation@doinno.co.kr';
  v_from    uuid;
  v_to      uuid;
  v_to_tier text;
  v_creator uuid;
  v_rows    int;
begin
  select id into v_from from public.users where email = c_from_email;
  select id, host_tier into v_to, v_to_tier
    from public.users where email = c_to_email and deleted_at is null;

  if v_from is null then raise exception '개인 계정을 찾을 수 없어요: %', c_from_email; end if;
  if v_to is null then
    raise exception '법인 계정이 아직 없어요: % — 앱에 한 번 로그인해 users 행을 만든 뒤 다시 실행하세요', c_to_email;
  end if;

  select creator_id into v_creator from public.challenges where id = c_challenge_id;
  if v_creator is null then raise exception '하다를 찾을 수 없어요: %', c_challenge_id; end if;
  if v_creator = v_to then
    raise notice '이미 법인 계정 소유예요 — 할 일 없음';
    return;
  end if;
  if v_creator <> v_from then raise exception '개설자가 예상과 달라요 — 중단'; end if;

  -- 검증 기록 + org 지정이 먼저다. 조직이 아닌 계정에 공식 무대를 넘기면 0083 원칙을 이 파일이 깨게 된다.
  if v_to_tier is distinct from 'org' then
    raise exception '법인 계정이 아직 조직(org)이 아니에요 — 운영자 콘솔에서 검증 기록 + 사람 계층 지정을 먼저 하세요';
  end if;

  -- 법인 계정이 이미 이 방 멤버면 unique(challenge_id, user_id) 충돌 → 손으로 정리할 상황이라 중단
  if exists (select 1 from public.challenge_members where challenge_id = c_challenge_id and user_id = v_to) then
    raise exception '법인 계정이 이미 이 하다의 멤버예요 — 중단';
  end if;

  update public.challenges set creator_id = v_to where id = c_challenge_id;

  -- 멤버 행은 지우고 새로 넣지 않고 user_id 만 바꾼다 → 합류일·role='host' 가 그대로 남는다
  update public.challenge_members set user_id = v_to
   where challenge_id = c_challenge_id and user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'challenge_members %', v_rows;

  update public.challenge_pauses set user_id = v_to
   where challenge_id = c_challenge_id and user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'challenge_pauses %', v_rows;

  update public.logs set user_id = v_to
   where challenge_id = c_challenge_id and user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'logs %', v_rows;

  update public.comments x set user_id = v_to
    from public.proofs p
   where p.id = x.proof_id and p.challenge_id = c_challenge_id and x.user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'comments %', v_rows;

  update public.log_comments x set user_id = v_to
    from public.logs l
   where l.id = x.log_id and l.challenge_id = c_challenge_id and x.user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'log_comments %', v_rows;

  update public.cheers x set user_id = v_to
    from public.proofs p
   where p.id = x.proof_id and p.challenge_id = c_challenge_id and x.user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'cheers %', v_rows;

  update public.log_likes x set user_id = v_to
    from public.logs l
   where l.id = x.log_id and l.challenge_id = c_challenge_id and x.user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'log_likes %', v_rows;

  update public.challenge_votes set user_id = v_to
   where challenge_id = c_challenge_id and user_id = v_from;
  get diagnostics v_rows = row_count; raise notice 'challenge_votes %', v_rows;

  -- 울림 반응·댓글은 challenge_id 가 없고 (target_type, target_id) 로 인증/기록을 가리킨다
  update public.parang_reactions r set user_id = v_to
   where r.user_id = v_from
     and ((r.target_type = 'proof' and r.target_id in (select id from public.proofs where challenge_id = c_challenge_id))
       or (r.target_type = 'log'   and r.target_id in (select id from public.logs   where challenge_id = c_challenge_id)));
  get diagnostics v_rows = row_count; raise notice 'parang_reactions %', v_rows;

  update public.parang_comments r set user_id = v_to
   where r.user_id = v_from
     and ((r.target_type = 'proof' and r.target_id in (select id from public.proofs where challenge_id = c_challenge_id))
       or (r.target_type = 'log'   and r.target_id in (select id from public.logs   where challenge_id = c_challenge_id)));
  get diagnostics v_rows = row_count; raise notice 'parang_comments %', v_rows;
end $$;

-- 검증 (적용 전 기대값 = 2026-10-28 조회. 그 사이 개인 계정 활동이 늘었으면 그만큼 많다):
--   1) select u.email, c.host_tier, c.host_label from challenges c join users u on u.id = c.creator_id
--        where c.id = '7af4c47a-36f4-45c4-957f-01a79f2db751';
--      → doinovation@doinno.co.kr / org / DO하다 운영팀
--   2) notice 건수: challenge_members 1 · challenge_pauses 2 · logs 39 · comments 7 · log_comments 6 ·
--      cheers 67 · log_likes 50 · challenge_votes 1 · parang_reactions 22 · parang_comments 0
--   3) 개인 계정 잔여 0:
--        select count(*) from challenge_members where challenge_id = '7af4…' and user_id = (select id from users where email = 'mirr0505@gmail.com');
--   4) 참여자 쪽 불변: select count(*) from proofs where challenge_id = '7af4…';   → 84 이상
--      select role, count(*) from challenge_members where challenge_id = '7af4…' group by 1;   → host 1 · member 2
--   5) 재실행 → notice '이미 법인 계정 소유예요' 만 나오고 아무것도 안 바뀐다
