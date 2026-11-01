-- 0093_proof_self_delete_window.sql
-- 🚀 인증 본인 삭제: 작성 후 10분 이내 + 응원 한잔이 연결되지 않은 인증만
--
-- 왜:
--   다른 하다 방에 사진을 잘못 올린 사용자가 지울 방법이 없었다 (앱에 삭제 UI 없음).
--   0001 의 proofs_self_delete 는 시간 제한이 없어, UI 만 열면 지난 인증까지 지워
--   연속 기록·완주 판정·박제 근거를 사후에 고칠 수 있게 된다 → 10분 창으로 제한한다
--   (잘못 올린 걸 바로 알아채는 시간. 수정 기능은 없음 — 지우고 다시 올린다).
--   응원 한잔(gift_orders)이 걸린 인증은 결제·교환권의 근거라 지우지 않는다
--   (gift_orders.proof_id 는 on delete set null 이라 막지 않으면 근거가 조용히 끊긴다).
--
-- ⚠️ RLS 정책 안 서브쿼리는 호출자 권한으로 돈다 (0051→0052 사고).
--   gift_orders 는 RLS + 컬럼 grant(0092)로 좁혀져 있어 정책 안에서 직접 읽으면 막힌다
--   → SECURITY DEFINER 헬퍼로 판정 (is_member_of 와 같은 패턴, 0005).
--
-- 삭제 시 함께 정리되는 것: comments·cheers·notification_queue (cascade).
-- 하루 1회 유니크 인덱스는 행이 사라지면 풀려 같은 날 다시 인증할 수 있다.
-- R2 사진은 남겨 둔다 (다른 정리 경로와 동일).

-- ─── 헬퍼: 이 인증에 살아있는 한잔 주문이 있나 ───
-- 결제 전에 끝난 주문(canceled·pay_failed)만 무시. 그 외(결제·발급·환불 이력 포함)는 전부 근거로 본다.
create or replace function public.proof_has_active_gift(proof_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.gift_orders
    where proof_id = proof_uuid
      and status not in ('canceled', 'pay_failed')
  );
$$;

grant execute on function public.proof_has_active_gift(uuid) to authenticated;

-- ─── 정책 교체: 본인 + 10분 이내 + 한잔 없음 ───
drop policy if exists proofs_self_delete on public.proofs;

create policy proofs_self_delete on public.proofs
  for delete using (
    user_id = auth.uid()
    and created_at > now() - interval '10 minutes'
    and not public.proof_has_active_gift(id)
  );

-- ─── 검증 (적용 후 SQL Editor) ───
-- 1) 정책 확인:
--    select policyname, cmd, qual from pg_policies
--     where tablename = 'proofs' and policyname = 'proofs_self_delete';
-- 2) 헬퍼 확인 (한잔 걸린 인증 id 로 true, 아닌 id 로 false):
--    select public.proof_has_active_gift('<proof_id>');
-- 3) 앱에서: 방금 올린 인증 삭제 → 성공 / 10분 지난 인증 → 0행(앱이 "삭제할 수 없어요" 안내)
