// 🚀 인증 본인 삭제 창 (0093) — 작성 후 10분 이내만. 한잔 연결 여부는 서버(RLS)가 판정한다.
export const PROOF_SELF_DELETE_WINDOW_MS = 10 * 60 * 1000;

// 화면에 ⋯(삭제)를 보여줄지 판단. 서버 RLS 가 최종 판정이라 여기는 UX 용.
// 기기 시계가 서버보다 늦어 created_at 이 미래로 보여도(음수 경과) 방금 올린 것이므로 허용.
export function canSelfDeleteProof(args: { createdAt: string; nowMs: number }): boolean {
  const elapsedMs = args.nowMs - Date.parse(args.createdAt);
  return elapsedMs < PROOF_SELF_DELETE_WINDOW_MS;
}
