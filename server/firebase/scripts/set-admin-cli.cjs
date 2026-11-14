// 관리자 권한 부여 — gcloud 없이, 이 PC 의 Firebase CLI 로그인(운영자 본인 계정)으로 실행한다(2026-10-13).
// 순서: ① 관리자 페이지(https://emoti-18d80.web.app/)에서 운영자 구글 계정으로 한 번 로그인 ② 이 스크립트 실행 ③ 관리자 페이지 새로고침.
// 사용: node scripts/set-admin-cli.cjs <로그인한 구글 이메일> [--remove]
// 비밀 값은 쓰지 않는다(CLI 가 이미 가진 운영자 로그인 토큰만 이 실행 동안 쓴다). 화면에는 uid 와 결과만 나온다.
const path = require('path');
const PROJECT = 'emoti-18d80';
const email = process.argv[2];
const remove = process.argv.includes('--remove');
if (!email || !email.includes('@')) { console.error('사용: node scripts/set-admin-cli.cjs <구글 이메일> [--remove]'); process.exit(1); }

(async () => {
  const lib = p => require(path.join(path.dirname(require.resolve('firebase-tools/package.json')), 'lib', p));
  const { getAccessToken } = lib('apiv2.js');
  const auth = lib('auth.js');
  const account = auth.getGlobalDefaultAccount && auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI 로그인이 없어요. 먼저 npx firebase login 을 해 주세요.');
  if (auth.setActiveAccount) auth.setActiveAccount({}, account);
  const token = await getAccessToken();
  const call = async (method, body) => {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:${method}`, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'x-goog-user-project': PROJECT }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(`${method} ${r.status}: ${j.error && j.error.message}`);
    return j;
  };
  const found = await call('lookup', { email: [email] });
  const users = found.users || [];
  if (users.length !== 1) throw new Error(`이 이메일로 로그인한 관리자 페이지 계정을 찾지 못했어요(${users.length}개). 관리자 페이지에서 먼저 구글로 로그인해 주세요.`);
  const uid = users[0].localId;
  await call('update', { localId: uid, customAttributes: JSON.stringify(remove ? {} : { admin: true }) });
  console.log(`${remove ? '관리자 권한을 뺐어요' : '관리자 권한을 줬어요'} — uid ${uid}. 관리자 페이지를 새로고침(필요하면 로그아웃 후 다시 로그인)해 주세요.`);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
