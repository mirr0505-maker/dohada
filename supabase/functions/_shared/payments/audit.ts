// 🚀 한잔 주문 감사 로그 — 상태 전이마다 gift_order_events 에 한 줄 (0091)
// gift_orders 는 한 행을 덮어쓰므로, 분쟁·정산 대사 때 "언제 누가 왜 바꿨는지"는 여기서만 꺼낼 수 있다.
//
// ⚠️ 기록 실패가 결제를 막으면 안 된다 — 전이는 이미 끝났으므로 오류는 로그로만 남긴다.
//   (감사 로그 장애로 돈은 받았는데 '실패' 응답이 나가는 쪽이 훨씬 위험하다)
import type { GiftStatus } from './giftStateMachine.ts';

export type GiftEventActorRole = 'sender' | 'recipient' | 'admin' | 'system';

export type GiftEventInput = {
  orderId: string;
  from: GiftStatus | null;          // null = 주문 생성
  to: GiftStatus;
  actorId: string | null;           // 시스템 자동 처리면 null
  actorRole: GiftEventActorRole;
  reason?: string | null;
  pgPayload?: Record<string, unknown> | null;
};

// 순수 변환 — DB 행 모양 (테스트 대상)
export function buildGiftEventRow(e: GiftEventInput) {
  return {
    order_id: e.orderId,
    from_status: e.from,
    to_status: e.to,
    actor_id: e.actorId,
    actor_role: e.actorRole,
    reason: e.reason ?? null,
    pg_payload: e.pgPayload ?? null,
  };
}

// service role 클라이언트로만 호출 (테이블에 authenticated 권한 없음)
// deno-lint-ignore no-explicit-any
export async function recordGiftEvent(service: any, e: GiftEventInput): Promise<void> {
  try {
    const { error } = await service.from('gift_order_events').insert(buildGiftEventRow(e));
    if (error) console.error('[gift_audit] insert failed', e.orderId, e.to, error.message);
  } catch (err) {
    console.error('[gift_audit] insert threw', e.orderId, e.to, String(err));
  }
}
