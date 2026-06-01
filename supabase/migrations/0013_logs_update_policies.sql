-- 0013_logs_update_policies.sql
-- v2.2 기록 수정/삭제 + 댓글 수정 도입 시 발견:
-- logs / log_comments 의 UPDATE policy 가 빠져있었음 (0007 에는 SELECT/INSERT/DELETE 만).
-- 본인 글/댓글만 수정 가능하게 추가.

drop policy if exists logs_self_update on public.logs;
create policy logs_self_update on public.logs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists log_comments_self_update on public.log_comments;
create policy log_comments_self_update on public.log_comments
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
