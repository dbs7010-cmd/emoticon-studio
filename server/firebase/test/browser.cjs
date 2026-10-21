// 시스템 브라우저 흉내: 주소를 열고 302 를 따라가다가 앱 주소(emoti://…) 나 웹 돌아올 주소에 닿으면 멈춘다.
// 앱의 WebBrowser.openAuthSessionAsync(url, returnUrl) 와 같은 모양({type, url})을 돌려준다.
module.exports = async function openAuth(url, returnUrl, log = []) {
  for (let i = 0; i < 10; i++) {
    if (url.startsWith(returnUrl)) return { type: 'success', url };
    const res = await fetch(url, { redirect: 'manual' });
    log.push(`${res.status} ${url.split('?')[0]}`);
    const next = res.headers.get('location');
    if (!next) return { type: 'page', status: res.status, body: await res.text(), url };
    url = new URL(next, url).toString().replace(/^emoti:\/auth/, 'emoti://auth');
  }
  throw new Error('너무 많은 이동');
};
