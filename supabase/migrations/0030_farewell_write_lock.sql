-- 🚀 0030 — 종료 방 쓰기 잠금 (마무리 인사 7일 유예)
--
-- 정책 (2026-06-11 결정):
--   - 종료일 24시(KST)부터 7일간 = "마무리 인사 기간" — 대화·댓글·기록·응원·좋아요 모두 허용
--   - 7일이 지나면 완전 읽기 전용 박제 — 쓰기 전면 잠금 (응원·좋아요 포함, 전부 같이 잠금)
--   - solo 방은 인사 나눌 동료가 없으므로 유예 없이 종료 즉시 잠금
--   - 인증(proofs)은 0024 가 이미 종료 즉시 차단 (유예 없음 — 통계 왜곡 방지)
--
-- 구현: 기존 INSERT 정책은 그대로 두고 RESTRICTIVE 정책으로 AND 조건만 추가
--       (PERMISSIVE 정책 재정의 없이 안전하게 겹침).
-- 재실행 안전.

-- ═════════════════════════════════════════════
-- 1. 헬퍼 — 마무리 기간 내인지 (진행 중 포함)
-- ═════════════════════════════════════════════
create or replace function public.is_within_farewell_period(challenge_uuid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = challenge_uuid
      and (
        (now() at time zone 'Asia/Seoul')::date <= end_date                       -- 진행 중
        or (kind <> 'solo'
            and (now() at time zone 'Asia/Seoul')::date <= end_date + 7)          -- 마무리 7일
      )
  );
$$;
alter function public.is_within_farewell_period(uuid) owner to postgres;

-- ═════════════════════════════════════════════
-- 2. RESTRICTIVE 정책 — 대화 / 기록 / 인증 댓글 / 기록 댓글 / 응원 / 기록 좋아요
-- ═════════════════════════════════════════════
drop policy if exists chat_farewell_window on public.chat_messages;
create policy chat_farewell_window on public.chat_messages
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(challenge_id));

drop policy if exists logs_farewell_window on public.logs;
create policy logs_farewell_window on public.logs
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(challenge_id));

drop policy if exists comments_farewell_window on public.comments;
create policy comments_farewell_window on public.comments
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(
    (select challenge_id from public.proofs where id = proof_id)
  ));

drop policy if exists log_comments_farewell_window on public.log_comments;
create policy log_comments_farewell_window on public.log_comments
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(
    (select challenge_id from public.logs where id = log_id)
  ));

drop policy if exists cheers_farewell_window on public.cheers;
create policy cheers_farewell_window on public.cheers
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(
    (select challenge_id from public.proofs where id = proof_id)
  ));

drop policy if exists log_likes_farewell_window on public.log_likes;
create policy log_likes_farewell_window on public.log_likes
  as restrictive for insert to authenticated
  with check (public.is_within_farewell_period(
    (select challenge_id from public.logs where id = log_id)
  ));

-- 검증:
--   1) 진행 중 방: 대화/댓글/응원 INSERT 정상
--   2) 종료 +3일 (closed/open/cheered): INSERT 정상 (유예)
--   3) 종료 +8일: INSERT 전부 RLS 거부
--   4) solo 종료 +1일: INSERT 거부 (유예 없음)
