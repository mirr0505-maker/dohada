// 🚀 사진 업로드 — Cloudflare R2 (presigned PUT)
//
// 흐름: 정규화(회전 굽기+리사이즈+압축) → Edge Function 호출 → presigned URL 받음 → fetch PUT.
// 클라이언트는 R2 키를 절대 보지 않는다.

import { supabase, isSupabaseConfigured } from './supabase';

// expo-image-manipulator 는 네이티브 모듈 — 이 패키지가 포함되기 전의 빌드(OTA 수신)에서는
// import 가 실패하므로 가드 후 폴백. 다음 네이티브 빌드부터 자동 활성화.
let manipulator: typeof import('expo-image-manipulator') | null = null;
try {
  manipulator = require('expo-image-manipulator');
} catch {
  manipulator = null;   // 구 빌드: 정규화 없이 원본 업로드 (기존 동작 유지)
}

type PresignRes = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  contentType: string;
  expiresIn: number;
};

const MAX_UPLOAD_WIDTH = 1600;   // 폰 화면 표시용으로 충분 + 업로드 용량 절감

// 🚀 업로드 재시도 — 일시적 네트워크 실패만 자동 재시도 (최초 1회 + 아래 지연만큼 추가 시도).
//   사용자가 알럿을 닫고 다시 누르면 성공하던 상황을 앱이 대신 처리한다.
const UPLOAD_RETRY_DELAYS_MS = [600, 1500];

// 서버가 "응답한" 오류(권한·검수 등 4xx)는 다시 시도해도 같은 결과 → 재시도 대상이 아니다.
// 재시도 대상은 요청이 네트워크 단계에서 실패한 경우뿐.
function isRetryableUploadError(e: any): boolean {
  const name = e?.name ?? '';
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') return true;   // EF 요청 자체가 못 나감
  if (name === 'TypeError') return true;                                               // RN fetch 실패(Network request failed)
  return e?.retryable === true;                                                        // R2 PUT 5xx 표식
}

async function withUploadRetry<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (e) {
      if (attempt >= UPLOAD_RETRY_DELAYS_MS.length || !isRetryableUploadError(e)) throw e;
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAYS_MS[attempt]));
    }
  }
}

// 사진 정규화 — ① EXIF 회전을 픽셀에 굽기 (가로 사진 90도 회전 버그 해결)
//              ② 1600px 초과 시 리사이즈 + JPEG 0.8 압축 (보관함 원본 최적화)
async function normalizeImage(uri: string): Promise<string> {
  if (!manipulator) return uri;
  try {
    const { ImageManipulator, SaveFormat } = manipulator;
    // 1차 렌더 — 회전 굽기 + 원본 크기 확인
    let rendered = await ImageManipulator.manipulate(uri).renderAsync();
    if (rendered.width > MAX_UPLOAD_WIDTH) {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: MAX_UPLOAD_WIDTH, height: null });
      rendered = await ctx.renderAsync();
    }
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return saved.uri;
  } catch {
    return uri;   // 정규화 실패가 업로드 자체를 막지 않게
  }
}

// 카메라/보관함 사진을 R2 에 업로드하고 public URL 을 반환
export async function uploadProofImage(localUri: string, ext = 'jpg'): Promise<string> {
  if (!isSupabaseConfigured) {
    // 베타 환경: Supabase 미연동 시 로컬 URI 그대로 반환 (UI 검증용)
    return localUri;
  }

  const normalizedUri = await normalizeImage(localUri);

  try {
    // 1) Edge Function 으로부터 presigned URL 받기
    const presigned = await withUploadRetry(async () => {
      const { data, error } = await supabase.functions.invoke<PresignRes>('r2-presign', {
        body: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, ext },
      });
      if (error || !data) throw error ?? new Error('presign failed');
      return data;
    });

    // 2) 로컬 파일을 blob 으로 읽어 PUT
    const fileBlob = await uriToBlob(normalizedUri);
    return await withUploadRetry(async () => {
      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presigned.contentType },
        body: fileBlob,
      });
      if (!putRes.ok) {
        const putError: any = new Error(`R2 PUT 실패: ${putRes.status} ${await putRes.text().catch(() => '')}`);
        putError.retryable = putRes.status >= 500;   // 5xx(서버 일시 오류)만 재시도, 4xx 는 즉시 실패
        throw putError;
      }
      return presigned.publicUrl;
    });
  } catch (e: any) {
    // 재시도까지 소진한 네트워크 실패는 영어 원문("Failed to send a request to the Edge Function") 대신 안내 문구로
    if (isRetryableUploadError(e)) {
      throw new Error('사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.');
    }
    throw e;
  }
}

// RN 의 expo-camera 가 반환하는 file:// URI 를 Blob 으로 변환
async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}
