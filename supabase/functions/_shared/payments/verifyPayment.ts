// 🚀 결제 승인 대조 — 금액 위변조 방어의 핵심 (순수 함수)
// PG 승인 응답과 우리 주문을 대조한다. 하나라도 불일치 = 결제 취소 + pay_failed.

export type OrderForPayment = {
  id: string;
  amount: number;
  status: string;     // 'created' 여야만 승인 진행 (중복 승인 방지)
};

export type PgConfirmResult = {
  orderId: string;
  amount: number;
  status: 'DONE' | 'CANCELED' | 'FAILED';
};

export type PaymentVerdict = { ok: true } | { ok: false; reason: string };

export function paymentMatchesOrder(order: OrderForPayment, pg: PgConfirmResult): PaymentVerdict {
  if (order.status !== 'created') {
    return { ok: false, reason: 'order_not_payable' };     // 이미 처리된 주문 재승인 차단
  }
  if (pg.status !== 'DONE') {
    return { ok: false, reason: 'pg_not_done' };
  }
  if (pg.orderId !== order.id) {
    return { ok: false, reason: 'order_id_mismatch' };      // 다른 주문의 결제키 재사용 차단
  }
  if (pg.amount !== order.amount) {
    return { ok: false, reason: 'amount_mismatch' };        // 클라이언트 금액 조작 차단
  }
  return { ok: true };
}
