// 🚀 R2 Presigned PUT URL 발급 — Supabase Edge Function
//
// 클라이언트 흐름:
//   1) 로그인한 사용자가 POST /functions/v1/r2-presign  { contentType, ext }
//   2) Edge Function 이 SigV4 로 PUT presigned URL 생성 (TTL 5분)
//   3) 클라이언트는 그 URL 에 fetch(PUT, body=file) 로 업로드
//   4) 업로드 후 public URL 을 proofs.photo_url 에 저장
//
// 환경변수 (supabase secrets set 으로 설정):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_BUCKET=do-hada-proofs, R2_PUBLIC_BASE_URL (custom domain or r2.dev)
//
// 배포:  supabase functions deploy r2-presign --no-verify-jwt   ← JWT 검증은 우리가 직접
//
// Deno runtime (Supabase Edge Functions 표준)
// @ts-nocheck — Deno globals (Deno, crypto.subtle) 사용. Node TS 검증에서 제외.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!;
const SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const BUCKET     = Deno.env.get('R2_BUCKET') ?? 'do-hada-proofs';
const PUBLIC_BASE = Deno.env.get('R2_PUBLIC_BASE_URL') ?? '';
const REGION = 'auto';
const SERVICE = 's3';
const EXPIRES = 300; // 5분

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // JWT 검증 — 로그인된 사용자만 발급
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonRes({ error: 'Missing bearer token' }, 401);
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonRes({ error: 'Unauthorized' }, 401);

  // body 파싱
  let body: { contentType?: string; ext?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const contentType = body.contentType ?? 'image/jpeg';
  const ext = (body.ext ?? 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();

  // 키: proofs/<user_id>/<yyyymmdd>/<random>.ext  — 사용자별 폴더로 충돌 방지
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const key = `proofs/${user.id}/${today}/${rand}.${ext}`;

  // R2 endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<BUCKET>/<KEY>
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;

  // SigV4 query-string signing (presigned URL)
  const signed = await presignPut({
    host, key: `/${BUCKET}/${key}`, contentType,
    accessKey: ACCESS_KEY, secretKey: SECRET_KEY, region: REGION, service: SERVICE,
    expires: EXPIRES,
  });

  const publicUrl = PUBLIC_BASE
    ? `${PUBLIC_BASE.replace(/\/$/, '')}/${key}`
    : url.split('?')[0];

  return jsonRes({
    uploadUrl: `${url}?${signed}`,
    publicUrl,
    key,
    contentType,
    expiresIn: EXPIRES,
  });
});

// ─── SigV4 presign (PUT) ─────────────────────────────────────
async function presignPut(p: {
  host: string; key: string; contentType: string;
  accessKey: string; secretKey: string; region: string; service: string; expires: number;
}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');  // 20260526T030000Z
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const credential = `${p.accessKey}/${credentialScope}`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expires),
    'X-Amz-SignedHeaders': 'host',
  });
  params.sort();

  const canonical = [
    'PUT',
    p.key,
    params.toString(),
    `host:${p.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonical),
  ].join('\n');

  const kDate    = await hmacRaw(`AWS4${p.secretKey}`, dateStamp);
  const kRegion  = await hmacRaw(kDate, p.region);
  const kService = await hmacRaw(kRegion, p.service);
  const kSigning = await hmacRaw(kService, 'aws4_request');
  const sig      = await hmacHex(kSigning, stringToSign);

  params.append('X-Amz-Signature', sig);
  return params.toString();
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacRaw(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function hmacHex(key: Uint8Array, data: string): Promise<string> {
  const raw = await hmacRaw(key, data);
  return [...raw].map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
