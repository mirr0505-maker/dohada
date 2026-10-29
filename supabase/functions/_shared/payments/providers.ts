// 🚀 외부 서비스 주입 지점 — PG / 기프티콘 발급 / 본인인증
// Stage 1: 전부 mock. Stage 2: PG 만 토스 샌드박스(라우팅) · 기프티콘·본인확인은 mock. Stage 3 에서 나머지 교체.
// 환경변수 분기로 mock 을 켜고 끄는 백도어를 만들지 않는다 — 교체는 코드 레벨에서만.
import type { PgConfirmResult } from './verifyPayment.ts';
import type { ProductTier } from './catalog.ts';

// ─── PG (토스페이먼츠 자리) ──────────────────────────────
export type PgClient = {
  // 결제 승인 — paymentKey 로 PG 에 실제 승인 요청, 승인된 금액·주문번호를 돌려받는다.
  //   amount = **우리 DB 주문 금액** (클라·결제 페이지 값 불신). 토스는 이 값과 결제 요청 금액이 다르면 승인을 거부한다 = 이중 방어
  confirm(paymentKey: string, orderId: string, amount: number): Promise<PgConfirmResult>;
  // 결제 취소 (전액) — 발급 실패 자동 환불 등. 이미 취소된 결제면 성공으로 본다(재시도 안전)
  cancel(paymentKey: string, reason: string): Promise<void>;
};

// Mock PG: paymentKey 형식 'MOCKPAY:<orderId>:<amount>' 를 승인된 결제로 간주.
// 금액 위변조 테스트를 위해 paymentKey 가 품고 있는 값을 그대로 돌려준다.
export function createMockPgClient(): PgClient {
  return {
    async confirm(paymentKey, _orderId, _amount) {
      const parts = paymentKey.split(':');
      if (parts[0] !== 'MOCKPAY' || parts.length !== 3) {
        return { orderId: '', amount: 0, status: 'FAILED' };
      }
      return { orderId: parts[1], amount: Number(parts[2]), status: 'DONE' };
    },
    async cancel(_paymentKey, _reason) {
      // mock: 항상 성공
    },
  };
}

// ─── 토스페이먼츠 (Stage 2 샌드박스 · 기존 결제창 = API 개별 연동 키) ─────────────
// 승인 POST /v1/payments/confirm · 조회 GET /v1/payments/{paymentKey} · 취소 POST /v1/payments/{paymentKey}/cancel
// 인증 = Basic base64("<시크릿키>:"). 시크릿은 Supabase Secrets TOSS_SECRET_KEY — 코드·git 에 두지 않는다.
const TOSS_API_BASE = 'https://api.tosspayments.com/v1/payments';

// 토스 결제 객체 → 우리 승인 결과. 토스 status 는 DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED/… — DONE 만 승인으로 본다
// deno-lint-ignore no-explicit-any
export function parseTossPayment(payment: any): PgConfirmResult {
  const status = payment?.status === 'DONE'
    ? 'DONE'
    : (payment?.status === 'CANCELED' || payment?.status === 'PARTIAL_CANCELED') ? 'CANCELED' : 'FAILED';
  return {
    orderId: String(payment?.orderId ?? ''),
    amount: Number(payment?.totalAmount ?? 0),
    status,
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<any> }>;   // deno-lint-ignore no-explicit-any

export function createTossPgClient(secretKey: string | undefined, fetchImpl: FetchLike = fetch as unknown as FetchLike): PgClient {
  // 키가 없으면 토스 경로를 쓰는 순간 실패 — mock 으로 조용히 넘어가는 폴백은 두지 않는다(원칙 0)
  const authHeader = () => {
    if (!secretKey) throw new Error('toss_secret_missing');
    return `Basic ${btoa(`${secretKey}:`)}`;
  };

  return {
    async confirm(paymentKey, orderId, amount) {
      const res = await fetchImpl(`${TOSS_API_BASE}/confirm`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      const body = await res.json();
      if (res.ok) return parseTossPayment(body);

      // 이미 승인된 결제 — 첫 승인 응답이 네트워크에서 유실된 뒤 재시도한 경우.
      //   여기서 실패로 처리하면 "돈은 빠졌는데 주문은 실패"가 된다 → 실제 상태를 조회해 그대로 쓴다
      if (body?.code === 'ALREADY_PROCESSED_PAYMENT') {
        const got = await fetchImpl(`${TOSS_API_BASE}/${encodeURIComponent(paymentKey)}`, {
          method: 'GET',
          headers: { Authorization: authHeader() },
        });
        if (got.ok) return parseTossPayment(await got.json());
      }
      // 그 외 거절(금액 불일치·잔액 부족·만료 등) — 돈이 빠지지 않은 상태
      return { orderId: '', amount: 0, status: 'FAILED' };
      // ※ fetch 자체가 throw(네트워크 끊김)하면 그대로 올려 보낸다 — 승인 여부를 모르는 상태에서
      //    pay_failed 로 확정하면 안 된다. 주문은 created 로 남고 재시도 시 위 ALREADY_PROCESSED 경로로 회복된다.
    },
    async cancel(paymentKey, reason) {
      const res = await fetchImpl(`${TOSS_API_BASE}/${encodeURIComponent(paymentKey)}/cancel`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: reason.slice(0, 200) }),
      });
      if (res.ok) return;
      const body = await res.json().catch(() => ({}));
      if (body?.code === 'ALREADY_CANCELED_PAYMENT') return;   // 재시도 안전 — 이미 돌려준 돈은 다시 돌려줄 필요 없음
      throw new Error(`toss_cancel_failed:${body?.code ?? 'unknown'}`);
    },
  };
}

// ─── Stage 2 한시 라우팅 — 모의 결제키는 모의로, 나머지는 토스로 ─────────────
// 왜: preview·production 앱이 같은 서버를 쓴다. 토스 결제창은 preview 앱에만 나가 있고
//   production 앱은 아직 'MOCKPAY:' 키로 결제한다. 승인 경로를 통째로 바꾸면 production 의 한잔 보내기가 깨진다.
// ⚠️ 실결제(Stage 3, WP3) 전환일에 이 라우팅과 모의 경로를 **삭제**한다 — 실돈이 도는 서버에
//   "MOCKPAY: 키 = 승인" 경로가 남으면 공짜 결제 백도어다. (PHASE2_FINTECH_PLAN §9 WP3 체크리스트)
export function isMockPaymentKey(paymentKey: string): boolean {
  return paymentKey.startsWith('MOCKPAY:');
}

export function createStage2PgClient(toss: PgClient, mock: PgClient): PgClient {
  return {
    confirm: (paymentKey, orderId, amount) =>
      (isMockPaymentKey(paymentKey) ? mock : toss).confirm(paymentKey, orderId, amount),
    cancel: (paymentKey, reason) =>
      (isMockPaymentKey(paymentKey) ? mock : toss).cancel(paymentKey, reason),
  };
}

// ─── 기프티콘 B2B 발급 (기프티쇼 비즈 등 자리) ────────────
export type GifticonClient = {
  issue(tier: ProductTier, recipientUserId: string): Promise<{ voucherRef: string }>;
};

// Mock 발급기: failTiers 에 포함된 티어는 발급 실패 — 자동 환불 경로 테스트용
export function createMockGifticonClient(failTiers: ProductTier[] = []): GifticonClient {
  let seq = 0;
  return {
    async issue(tier, recipientUserId) {
      if (failTiers.includes(tier)) {
        throw new Error(`mock_issue_failed:${tier}`);
      }
      seq += 1;
      return { voucherRef: `MOCK-VOUCHER-${tier}-${recipientUserId.slice(0, 8)}-${seq}` };
    },
  };
}

// ─── 휴대폰 본인인증 (PASS/NICE/KCB 자리) ─────────────────
export type IdentityResult = {
  birthDate: string;   // YYYY-MM-DD
  phone: string;
  di: string;          // 중복가입확인정보 — 1인 다계정 차단
};

export type IdentityClient = {
  verify(identityToken: string): Promise<IdentityResult>;
};

// Mock 본인인증: 토큰 형식 'MOCKID:<YYYY-MM-DD>:<phone>' — di 는 전화번호 기반 고정값
export function createMockIdentityClient(): IdentityClient {
  return {
    async verify(identityToken) {
      const parts = identityToken.split(':');
      if (parts[0] !== 'MOCKID' || parts.length !== 3 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
        throw new Error('mock_identity_invalid_token');
      }
      return { birthDate: parts[1], phone: parts[2], di: `MOCKDI-${parts[2]}` };
    },
  };
}
