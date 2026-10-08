// 가짜 카카오·네이버·구글 로그인 서버(로컬 검사 전용, 127.0.0.1:7777). functions/.env.demo-emoti 가 이 주소를 본다.
// 실제 회사 화면 대신 '동의'를 바로 눌러 준 것처럼 code 를 돌려준다. 클라이언트 ID·비밀값·redirect_uri 를 실제 서버처럼 대조한다.
// 검사 쪽에서 mock.user = '111' 처럼 다음 로그인 회원을 정한다. mock.deny = true 면 사용자가 취소한 것처럼 돌려준다.
const http = require('node:http');
const IDS = { kakao: 'kakao-rest-key', naver: 'naver-client-id', google: 'google-client-id.apps.googleusercontent.com' };
const SECRETS = { kakao: 'fake-kakao-secret', naver: 'fake-naver-secret', google: 'fake-google-secret' };
module.exports = () => {
  const codes = new Map(), tokens = new Map();
  const mock = { user: '111', deny: false, requests: [], IDS, SECRETS };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1:7777');
    let body = ''; for await (const c of req) body += c;
    const form = new URLSearchParams(body), q = u.searchParams;
    mock.requests.push(u.pathname);
    const send = (code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    const authorize = p => {
      if (q.get('client_id') !== IDS[p] || q.get('response_type') !== 'code' || !q.get('state') || !q.get('redirect_uri')) return send(400, { error: 'invalid_request' });
      const back = new URL(q.get('redirect_uri'));
      if (mock.deny) back.searchParams.set('error', p === 'kakao' ? 'access_denied' : p === 'naver' ? 'user_cancel' : 'access_denied');
      else { const code = `code-${p}-${Math.random().toString(36).slice(2)}`; codes.set(code, { p, user: mock.user, redirect: q.get('redirect_uri'), state: q.get('state') }); back.searchParams.set('code', code); }
      back.searchParams.set('state', q.get('state'));
      res.writeHead(302, { location: back.toString() }); res.end();
    };
    const redeem = (p, f) => {   // code 는 한 번만
      const c = codes.get(f.get('code')); codes.delete(f.get('code'));
      if (!c || c.p !== p || f.get('client_id') !== IDS[p] || f.get('client_secret') !== SECRETS[p]) return null;
      if (p !== 'naver' && f.get('redirect_uri') !== c.redirect) return null;
      if (p === 'naver' && f.get('state') !== c.state) return null;
      return c;
    };
    if (u.pathname === '/oauth/authorize') return authorize('kakao');
    if (u.pathname === '/oauth2.0/authorize') return authorize('naver');
    if (u.pathname === '/google/auth') return authorize('google');
    if (u.pathname === '/oauth/token' && req.method === 'POST') {
      const c = redeem('kakao', form); if (!c) return send(400, { error: 'invalid_grant', error_code: 'KOE320' });
      const at = 'at-kakao-' + Math.random().toString(36).slice(2); tokens.set(at, c.user); return send(200, { access_token: at, token_type: 'bearer', expires_in: 21599 });
    }
    if (u.pathname === '/v2/user/me') {
      const user = tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
      return user ? send(200, { id: Number(user) || user }) : send(401, { code: -401 });
    }
    if (u.pathname === '/oauth2.0/token') {
      const c = redeem('naver', q); if (!c) return send(200, { error: 'invalid_request', error_description: 'no' });
      const at = 'at-naver-' + Math.random().toString(36).slice(2); tokens.set(at, c.user); return send(200, { access_token: at, token_type: 'bearer', expires_in: '3600' });
    }
    if (u.pathname === '/v1/nid/me') {
      const user = tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
      return user ? send(200, { resultcode: '00', message: 'success', response: { id: 'NV-' + user } }) : send(401, { resultcode: '024', message: 'Authentication failed' });
    }
    if (u.pathname === '/google/token' && req.method === 'POST') {
      const c = redeem('google', form); if (!c) return send(400, { error: 'invalid_grant' });
      const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
      const aud = mock.wrongAud ? 'someone-else' : IDS.google;
      return send(200, { access_token: 'g', id_token: `${b64({ alg: 'none' })}.${b64({ iss: 'https://accounts.google.com', aud, sub: 'G' + c.user, exp: Math.floor(Date.now() / 1000) + 3600 })}.x` });
    }
    send(404, {});
  });
  return new Promise(r => server.listen(7777, '127.0.0.1', () => { mock.close = () => server.close(); r(mock); }));
};
module.exports.IDS = IDS;
module.exports.SECRETS = SECRETS;
