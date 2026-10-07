// 가짜 카카오·네이버 토큰 확인 서버(로컬 검사 전용). functions/.env.demo-emoti 가 이 주소를 본다.
const http = require('node:http');
module.exports = () => {
  const server = http.createServer((req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/v1/user/access_token_info') {
      if (token === 'kakao-good-token') return send(200, { id: 111, expires_in: 3600, app_id: 424242 });
      if (token === 'kakao-second-user') return send(200, { id: 333, expires_in: 3600, app_id: 424242 });
      if (token === 'kakao-other-app') return send(200, { id: 222, expires_in: 3600, app_id: 999999 });
      return send(401, { code: -401, msg: 'this access token does not exist' });
    }
    if (req.url === '/v1/nid/me') {
      if (token === 'naver-good-token') return send(200, { resultcode: '00', message: 'success', response: { id: 'NV-abc' } });
      return send(401, { resultcode: '024', message: 'Authentication failed' });
    }
    send(404, {});
  });
  return new Promise(r => server.listen(7777, '127.0.0.1', () => r(server)));
};
