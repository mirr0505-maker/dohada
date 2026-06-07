// 🚀 초대 중계 및 딥링크 리다이렉션 게이트웨이 리다이렉터
//
// 역할:
//   1. 카톡 등 외부 메신저에서 공유된 HTTPS 링크로 진입.
//   2. *.supabase.co 도메인 자체의 HTML 샌드박스 정책(text/plain 강제 치환 및 CSP 차단)을 우회하기 위해,
//      GitHub Pages로 호스팅되는 정적 HTML 페이지로 307 리다이렉트 수행.
//
// 배포: supabase functions deploy invite --no-verify-jwt
//
// @ts-nocheck — Deno globals

Deno.serve(async (req) => {
  // GET 요청만 허용
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // URL에서 챌린지 ID 획득
  const url = new URL(req.url);
  const challengeId = url.searchParams.get('id');

  if (!challengeId) {
    // 초대 코드가 없는 경우 메인 소개 웹사이트로 리다이렉트
    return new Response(null, {
      status: 307,
      headers: {
        'Location': 'https://mirr0505-maker.github.io/dohada/'
      }
    });
  }

  // GitHub Pages에 등록된 정적 invite.html 주소로 307 임시 리다이렉트
  return new Response(null, {
    status: 307,
    headers: {
      'Location': `https://mirr0505-maker.github.io/dohada/invite.html?id=${challengeId}`
    }
  });
});
