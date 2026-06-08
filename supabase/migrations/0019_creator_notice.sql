-- 🚀 0019 — 개설자 전체 공지 알림 및 상단 공지 배너 연동
--
-- 개설자가 챌린지 룸에서 "발송메시지"를 발송할 때, 
-- 모든 멤버에게 푸시 알람을 보내고 대화방 상단 공지판에 등록하기 위한 변경사항입니다.

-- 1. chat_messages 테이블에 공지 여부 필드 추가
alter table public.chat_messages add column if not exists is_notice boolean default false;
comment on column public.chat_messages.is_notice is '개설자가 발송한 전체 공지 메시지 여부';

-- 2. notification_queue 의 kind check constraint 변경
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check 
  check (kind in ('chat','comment','log_comment','cheer_batch','log_like_batch','creator_notice'));

-- 3. 개설자가 전체 공지 알림을 보내는 RPC 함수 생성
create or replace function public.send_creator_notice(
  p_challenge_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_creator_nick text;
  v_chat_msg_id uuid;
begin
  -- 1. 개설자(방장)인지 검증
  select creator_id into v_creator_id from public.challenges where id = p_challenge_id;
  if v_creator_id <> auth.uid() then
    raise exception '개설자만 전체 알림을 보낼 수 있습니다.';
  end if;
  
  select nickname into v_creator_nick from public.users where id = auth.uid();

  -- 2. chat_messages 테이블에 공지글로 자동 인서트 (실시간 채팅방 상단에 즉시 반영됨)
  insert into public.chat_messages (challenge_id, user_id, content, is_notice)
  values (p_challenge_id, auth.uid(), p_message, true)
  returning id into v_chat_msg_id;

  -- 3. 본인을 제외한 챌린지 참여 멤버 전원에게 푸시 알림 큐 인서트 (포기한 멤버 제외)
  --    actor_id 는 의도된 노출 (Phase 2 in-app 인박스 도입 시 "누가 보냈는지" 식별용).
  --    notification_queue 는 service_role 만 접근하므로 일반 클라이언트엔 노출 안 됨.
  insert into public.notification_queue (user_id, kind, challenge_id, actor_id, preview, scheduled_for)
  select m.user_id, 'creator_notice', p_challenge_id, auth.uid(),
         coalesce(v_creator_nick, '개설자') || ': ' || left(p_message, 100),
         now()
  from public.challenge_members m
  where m.challenge_id = p_challenge_id
    and m.user_id <> auth.uid()
    and m.gave_up_at is null;
end;
$$;

alter function public.send_creator_notice(uuid, text) owner to postgres;
