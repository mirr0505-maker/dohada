// 🚀 외부 서비스 주입 지점 — PG / 기프티콘 발급 / 본인인증
// Stage 1: 전부 mock. Stage 2~3 에서 이 파일의 구현체만 실서비스로 교체한다.
// 환경변수 분기로 mock 을 켜고 끄는 백도어를 만들지 않는다 — 교체는 코드 레벨에서만.
import type { PgConfirmResult } from './verifyPayment.ts';
import type { ProductTier } from './catalog.ts';

// ─── PG (토스페이먼츠 자리) ──────────────────────────────
export type PgClient = {
  // 결제 승인 — paymentKey 로 PG 에 실제 승인 요청, 승인된 금액·주문번호를 돌려받는다
  confirm(paymentKey: string, orderId: string): Promise<PgConfirmResult>;
  // 결제 취소 (전액) — 발급 실패 자동 환불 등
  cancel(paymentKey: string, reason: string): Promise<void>;
};

// Mock PG: paymentKey 형식 'MOCKPAY:<orderId>:<amount>' 를 승인된 결제로 간주.
// 금액 위변조 테스트를 위해 paymentKey 가 품고 있는 값을 그대로 돌려준다.
export function createMockPgClient(): PgClient {
  return {
    async confirm(paymentKey, _orderId) {
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
