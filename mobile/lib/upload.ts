// 🚀 사진 업로드 — Cloudflare R2 (presigned PUT)
//
// 흐름: Edge Function 호출 → presigned URL 받음 → fetch PUT 으로 R2 에 직접 업로드.
// 클라이언트는 R2 키를 절대 보지 않는다.

import { supabase, isSupabaseConfigured } from './supabase';

type PresignRes = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  contentType: string;
  expiresIn: number;
};

// 카메라로 찍은 사진을 R2 에 업로드하고 public URL 을 반환
export async function uploadProofImage(localUri: string, ext = 'jpg'): Promise<string> {
  if (!isSupabaseConfigured) {
    // 베타 환경: Supabase 미연동 시 로컬 URI 그대로 반환 (UI 검증용)
    return localUri;
  }

  // 1) Edge Function 으로부터 presigned URL 받기
  const { data, error } = await supabase.functions.invoke<PresignRes>('r2-presign', {
    body: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, ext },
  });
  if (error || !data) throw error ?? new Error('presign failed');

  // 2) 로컬 파일을 blob 으로 읽어 PUT
  const fileBlob = await uriToBlob(localUri);
  const putRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': data.contentType },
    body: fileBlob,
  });
  if (!putRes.ok) {
    throw new Error(`R2 PUT 실패: ${putRes.status} ${await putRes.text().catch(() => '')}`);
  }

  return data.publicUrl;
}

// RN 의 expo-camera 가 반환하는 file:// URI 를 Blob 으로 변환
async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}
