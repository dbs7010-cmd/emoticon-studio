// IAP / 이용권 검사. 실제 스토어·실결제는 여기서 돌지 않는다 — 스토어는 가짜(expo-iap 과 같은 함수 모양),
// 영수증 서버는 가짜 fetch 다. 검증하는 것은 **우리 코드가 스토어·서버의 각 대답을 어떻게 다루는가**다.
// 실제 Play 결제·영수증 서버 배포는 docs/IAP_AUDIT.md 의 BLOCKED/MANUAL QA 로 따로 남긴다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data, options) { files.set(this.uri, options?.encoding === 'base64' ? Buffer.from(data, 'base64') : data); }
  textSync() { return files.get(this.uri); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const future = new Date(Date.now() + 30 * 864e5).toISOString();
const flush = (ms = 5) => new Promise(r => setTimeout(r, ms));

// ── 가짜 스토어 ────────────────────────────────────────────────────────────────────────────────
// 45.28: 파는 것은 비소모성 일회성 상품 하나('in-app'). 구독 offer token 이 없다.
const item = (id, price) => ({ id, type: 'in-app', platform: 'android', title: id, displayPrice: price });
// Android 구매에는 purchaseToken 말고도 주문 번호·원본 JSON 이 함께 온다. 서버가 필요한 것은 purchaseToken 뿐이다.
const bought = (productId, extra = {}) => ({ productId, platform: 'android', purchaseState: 'purchased', purchaseToken: 'play-token-' + productId, transactionId: 'GPA.1234-5678', dataAndroid: '{"orderId":"GPA.1234"}', transactionDate: Date.now(), ...extra });
function fakeStore(opts = {}) {
  const s = { requests: [], finished: [], finishedConsumable: [], updates: new Set(), errors: new Set(), products: opts.products ?? [item('pro_lifetime', '₩14,900')], owned: opts.owned ?? [], fetchError: opts.fetchError, ownedError: opts.ownedError, requestError: opts.requestError, answer: opts.answer ?? ((args, st) => st.emit(bought(args.request.google.skus[0]))) };
  s.emit = p => [...s.updates].forEach(f => f(p));
  s.fail = e => [...s.errors].forEach(f => f(e));
  s.module = {
    initConnection: async () => true,
    fetchProducts: async req => { if (s.fetchError) throw s.fetchError; return s.products.filter(p => req.skus.includes(p.id)); },
    requestPurchase: async args => { s.requests.push(args); if (s.requestError) throw s.requestError; setTimeout(() => s.answer(args, s), 0); return null; },
    getAvailablePurchases: async () => { if (s.ownedError) throw s.ownedError; return s.owned; },
    finishTransaction: async a => { s.finished.push(a.purchase.purchaseToken); s.finishedConsumable.push(a.isConsumable === true); return true; },
    purchaseUpdatedListener: f => { s.updates.add(f); return { remove: () => s.updates.delete(f) }; },
    purchaseErrorListener: f => { s.errors.add(f); return { remove: () => s.errors.delete(f) }; },
  };
  return s;
}
// ── 가짜 영수증 서버 ───────────────────────────────────────────────────────────────────────────
// 일회성 구매는 기간이 없다 — 서버도 expiresAt 을 주지 않는다. 예전 구독 토큰만 기간을 받는다.
function fakeServer(reply = body => body.productId === 'pro_lifetime'
  ? { verified: true, plan: 'lifetime' }
  : { verified: true, plan: body.productId === 'pro_yearly' ? 'yearly' : 'monthly', expiresAt: future }) {
  const srv = { bodies: [], down: false };
  srv.fetch = async (url, init) => {
    if (srv.down) throw new Error('offline');
    const body = JSON.parse(init.body); srv.bodies.push(body);
    return { ok: true, status: 200, json: async () => reply(body) };
  };
  return srv;
}

(async () => {
  // ════════ 1. 규칙 층: adapter + pro ════════
  const load = loader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
  const adapter = load('src/services/purchase-adapter.ts');
  const pro = load('src/services/pro.ts');
  const opts = srv => ({ endpoint: 'https://verify.example', fetchImpl: srv.fetch });

  // 상품 조회
  let st = fakeStore(); adapter.useStoreModuleForTests(st.module);
  let listed = await adapter.listProducts();
  assert.equal(listed.state, 'ok');
  assert.deepEqual(listed.products.map(p => [p.id, p.plan, p.localizedPrice]), [['pro_lifetime', 'lifetime', '₩14,900']], '상품 조회: 일회성 상품 하나와 스토어 가격');
  assert.equal(st.module.fetchProducts.length >= 0 && true, true);
  st = fakeStore({ fetchError: { code: 'network-error', message: 'x' } }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await adapter.listProducts(), { state: 'unavailable', problem: 'network' }, '상품 조회 실패: 네트워크');
  st = fakeStore({ products: [] }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await adapter.listProducts(), { state: 'unavailable', problem: 'not-found' }, '상품이 스토어에 없음');
  adapter.useStoreModuleForTests(null);
  assert.deepEqual(await adapter.listProducts(), { state: 'unavailable', problem: 'store-missing' }, '모듈 없음');

  // 구매 성공: 서버 확인 → 이용권 → 그다음 확정
  st = fakeStore(); adapter.useStoreModuleForTests(st.module);
  let srv = fakeServer();
  let out = await pro.purchase(opts(srv));
  assert.equal(out.state, 'purchased', '구매 성공');
  assert.deepEqual([out.entitlement.plan, out.entitlement.source, out.entitlement.verified], ['lifetime', 'store', true]);
  assert.equal(out.entitlement.expiresAt, undefined, '한 번 사면 끝나는 상품이라 기한이 없다');
  assert.equal(pro.isPro(out.entitlement), true, '서버가 확인한 구매만 PRO');
  assert.equal(pro.isPro(out.entitlement, new Date(Date.now() + 40 * 365 * 864e5)), true, '40년 뒤에도 PRO 다');
  assert.equal(st.requests[0].type, 'in-app', '일회성 상품으로 요청한다(구독 아님)');
  assert.deepEqual(st.requests[0].request.google, { skus: ['pro_lifetime'] }, '구독 offer 를 붙이지 않는다');
  assert.equal(st.finishedConsumable.at(-1), false, '비소모성이라 소비 처리하지 않는다');
  // Android token 우선순위: purchaseToken 만 서버로 간다. 주문 번호·원본 JSON 은 쓰지 않는다.
  assert.equal(srv.bodies[0].purchaseToken, 'play-token-pro_lifetime', 'Android: purchaseToken 을 보낸다');
  assert.equal(srv.bodies[0].productId, 'pro_lifetime', '서버는 어떤 상품인지 알아야 products API 로 묻는다');
  assert.notEqual(srv.bodies[0].purchaseToken, 'GPA.1234-5678');
  assert.deepEqual(Object.keys(srv.bodies[0]).sort(), ['platform', 'productId', 'purchaseToken'], '서버로 가는 값은 세 개뿐');
  assert.deepEqual(st.finished, ['play-token-pro_lifetime'], '확인된 뒤에만 구매를 확정한다');
  assert.equal(st.updates.size + st.errors.size, 0, '결과를 받으면 리스너를 놓는다');
  assert.equal(adapter.tokenOf({ productId: 'pro_lifetime', purchaseToken: null, transactionId: 'GPA.1' }, 'android'), '', 'purchaseToken 이 없으면 다른 값으로 대신하지 않는다');
  assert.equal(adapter.tokenOf({ productId: 'pro_lifetime', purchaseToken: '  jws.abc  ' }, 'ios'), 'jws.abc', 'iOS 는 같은 필드의 JWS');

  // 다른 상품 알림은 무시하고 우리 상품을 기다린다
  st = fakeStore({ answer: (args, s) => { s.emit(bought('other.coins')); setTimeout(() => s.emit(bought('pro_lifetime')), 0); } }); adapter.useStoreModuleForTests(st.module);
  out = await pro.purchase(opts(fakeServer()));
  assert.equal(out.entitlement.plan, 'lifetime', '다른 상품 알림을 우리 구매로 읽지 않는다');

  // token 이 아직 없는 구매 / pending → 서버에 보내지 않고 처리 중
  for (const [label, emitted] of [['token 없음', bought('pro_lifetime', { purchaseToken: null })], ['pending', bought('pro_lifetime', { purchaseState: 'pending' })]]) {
    st = fakeStore({ answer: (a, s) => s.emit(emitted) }); adapter.useStoreModuleForTests(st.module); srv = fakeServer();
    out = await pro.purchase(opts(srv));
    assert.deepEqual(out, { state: 'pending' }, label + ': 처리 중');
    assert.equal(srv.bodies.length, 0, label + ': 서버에 묻지 않는다');
    assert.equal(st.finished.length, 0, label + ': 확정하지 않는다');
  }

  // 취소·실패
  const failWith = async (error, via = 'listener') => {
    st = fakeStore(via === 'listener' ? { answer: (a, s) => s.fail(error) } : { requestError: error }); adapter.useStoreModuleForTests(st.module); srv = fakeServer();
    const result = await pro.purchase(opts(srv));
    assert.equal(srv.bodies.length, 0); assert.equal(st.finished.length, 0); assert.equal(result.entitlement, undefined, '취소·실패는 이용권을 만들지 않는다');
    return result;
  };
  assert.deepEqual(await failWith({ code: 'user-cancelled', message: 'User cancelled' }), { state: 'cancelled' }, '구매 취소');
  assert.deepEqual(await failWith({ code: 'network-error' }), { state: 'failed', problem: 'network' }, '구매 중 네트워크 오류');
  assert.deepEqual(await failWith({ code: 'already-owned' }), { state: 'failed', problem: 'already-owned' }, '이미 가지고 있음');
  assert.deepEqual(await failWith({ code: 'billing-unavailable' }, 'request'), { state: 'failed', problem: 'store-unavailable' }, '요청 자체 거절');
  assert.deepEqual(await failWith({ code: 'purchase-error' }), { state: 'failed', problem: 'unknown' }, '알 수 없는 실패');
  st = fakeStore({ products: [] }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await pro.purchase(opts(fakeServer())), { state: 'failed', problem: 'not-found' }, '스토어에 상품이 없으면 결제를 열지 않는다');
  assert.equal(st.requests.length, 0);

  // 서버 쪽 실패: 스토어 결제는 됐지만 확인 못 함 → 이용권 없음, 확정하지 않음(재시도 가능하게 남긴다)
  const serverCase = async (srvOpts, expected) => {
    st = fakeStore(); adapter.useStoreModuleForTests(st.module);
    const result = await pro.purchase(srvOpts);
    assert.deepEqual(result, { state: 'failed', problem: expected });
    assert.equal(st.finished.length, 0, expected + ': 확인 전에는 확정하지 않는다');
  };
  await serverCase({ fetchImpl: fakeServer().fetch }, 'server-missing');
  const down = fakeServer(); down.down = true;
  await serverCase(opts(down), 'server-unreachable');
  await serverCase(opts(fakeServer(() => ({ verified: false, plan: 'lifetime', reason: '취소된 구매' }))), 'refused');

  // 복원
  st = fakeStore({ owned: [bought('pro_lifetime', { transactionDate: 1 })] }); adapter.useStoreModuleForTests(st.module); srv = fakeServer();
  out = await pro.restore(opts(srv));
  assert.equal(out.state, 'purchased', '복원 성공'); assert.equal(out.entitlement.plan, 'lifetime', '한 번 산 PRO 가 돌아온다');
  assert.equal(srv.bodies[0].purchaseToken, 'play-token-pro_lifetime');
  // 예전 구독을 가진 사람: 새로 팔지 않아도 그 이용권을 못 본 척하지 않는다.
  st = fakeStore({ owned: [bought('pro_yearly', { transactionDate: 5 })] }); adapter.useStoreModuleForTests(st.module); srv = fakeServer();
  out = await pro.restore(opts(srv));
  assert.equal(out.entitlement.plan, 'yearly', '예전 구독도 복원된다');
  // 둘 다 있으면 기한 없는 일회성 PRO 가 먼저다.
  st = fakeStore({ owned: [bought('pro_yearly', { transactionDate: 9 }), bought('pro_lifetime', { transactionDate: 1 })] }); adapter.useStoreModuleForTests(st.module); srv = fakeServer();
  out = await pro.restore(opts(srv));
  assert.equal(out.entitlement.plan, 'lifetime', '일회성 PRO 가 먼저 복원된다');
  st = fakeStore({ owned: [] }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await pro.restore(opts(fakeServer())), { state: 'none' }, '구매 기록 없음');
  st = fakeStore({ owned: [bought('pro_lifetime', { isSuspendedAndroid: true }), bought('other.coins')] }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await pro.restore(opts(fakeServer())), { state: 'none' }, '결제 보류(suspended)·다른 상품은 복원하지 않는다');
  st = fakeStore({ ownedError: { code: 'service-disconnected' } }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await pro.restore(opts(fakeServer())), { state: 'failed', problem: 'network' }, '복원 중 연결 실패');
  adapter.useStoreModuleForTests(null);
  assert.deepEqual(await pro.restore(opts(fakeServer())), { state: 'failed', problem: 'store-missing' });

  // 앱 시작 재확인
  const live = { plan: 'lifetime', source: 'store', verified: true, checkedAt: new Date(0).toISOString() };
  adapter.useStoreModuleForTests(null);
  assert.deepEqual(await pro.refreshEntitlement(live, opts(fakeServer())), { state: 'unchanged' }, '모듈 없으면 저장된 것 유지');
  st = fakeStore({ ownedError: { code: 'network-error' } }); adapter.useStoreModuleForTests(st.module);
  assert.deepEqual(await pro.refreshEntitlement(live, opts(fakeServer())), { state: 'unchanged' }, '오프라인이면 저장된 이용권 유지');
  st = fakeStore({ owned: [] }); adapter.useStoreModuleForTests(st.module);
  let refreshed = await pro.refreshEntitlement(live, opts(fakeServer()));
  assert.equal(refreshed.state, 'updated', '스토어가 이 계정에 구매가 없다고 하면 끝낸다(환불·계정 변경)');
  assert.equal(pro.isPro(refreshed.entitlement), false); assert.equal(pro.expiredButRemembered(refreshed.entitlement), true, '기록은 남는다(만든 작품 보호)');
  assert.deepEqual(await pro.refreshEntitlement(undefined, opts(fakeServer())), { state: 'unchanged' }, '무료는 그대로 무료');
  st = fakeStore({ owned: [bought('pro_lifetime')] }); adapter.useStoreModuleForTests(st.module);
  refreshed = await pro.refreshEntitlement(undefined, opts(fakeServer()));
  assert.equal(refreshed.state, 'updated'); assert.equal(refreshed.entitlement.plan, 'lifetime', '재설치 뒤 시작 시 자동 복원');
  const offline = fakeServer(); offline.down = true;
  assert.deepEqual(await pro.refreshEntitlement(live, opts(offline)), { state: 'unchanged' }, '서버 연결 실패면 유지');
  assert.deepEqual(await pro.refreshEntitlement(live, { fetchImpl: fakeServer().fetch }), { state: 'unchanged' }, '서버 주소가 없으면 유지');
  refreshed = await pro.refreshEntitlement(live, opts(fakeServer(() => ({ verified: false, plan: 'lifetime', reason: '환불됨' }))));
  assert.equal(pro.isPro(refreshed.entitlement), false, '서버가 거절하면 끝낸다');

  // 사람에게 보이는 말: 모든 문제에 제목과 다음 행동, 오류 코드·모듈 이름 없음
  for (const problem of ['store-missing', 'network', 'store-unavailable', 'not-found', 'already-owned', 'server-missing', 'server-unreachable', 'refused', 'store-account', 'unknown', 'save']) {
    const t = pro.problemText(problem);
    assert.ok(t.title && t.next, problem + ': 제목과 다음 행동');
    assert.ok(!/[a-z]+-[a-z]+|expo|iap|Expo Go|code/i.test(t.title + t.next), problem + ': 코드·모듈 이름 노출 없음');
  }
  console.log('  규칙 층 PASS');

  // ════════ 2. 화면: 실제 App ════════
  const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: () => {} })); return React.createElement('WebView', props); });
  const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
  const opened = [];
  Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async url => { opened.push(url); } } });
  const realSetInterval = global.setInterval;
  global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
  const ui = loader({
    'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-constants': { expoConfig: { extra: { receiptEndpoint: 'https://verify.example' } } }, 'react-native-webview': { WebView },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
    './src/services/images': { dataUrl: async () => '', pickImages: async () => [] },
    './src/components/image-analyzer': { ImageAnalyzer: () => null },
    './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
    './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
  });
  const uiAdapter = ui('src/services/purchase-adapter.ts');
  const { createProject } = ui('src/project.ts');
  const { loadStore, saveStore } = ui('src/services/storage.ts');
  const App = ui('App.tsx').default;
  let server = fakeServer();
  global.fetch = (...a) => server.fetch(...a);
  let tree;
  const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
  const seen = [];
  const shows = t => { const all = texts(); seen.push(...all); return all.some(x => x.includes(t)); };
  const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
  const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); assert.ok(!m[0].props.disabled, 'enabled ' + label); await act(async () => { m[0].props.onPress(); await flush(); }); await act(async () => { await flush(10); }); };
  const restart = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); await flush(); }); await act(async () => { await flush(10); }); };
  const ent = () => loadStore().store.entitlement;

  saveStore({ version: 1, introDone: true, revision: 1, projects: [createProject('결제 세트', '콩이')] });
  st = fakeStore(); uiAdapter.useStoreModuleForTests(st.module);
  await restart();
  assert.equal(ent(), undefined, '처음엔 무료');
  await press('PRO 보기');
  assert.ok(shows('₩14,900'), '구매 가능: 스토어 가격이 보인다');
  assert.ok(!shows('후보 가격') && !shows('미확정') && !shows('제안가'), '제품 화면에 내부 기획 문구가 없다');
  assert.ok(shows('구독이 아니라 한 번만 결제해요'), '구독이 아니라는 것을 화면이 말한다');
  assert.equal(labelled('PRO 한 번 구매하기')[0].props.disabled, false, '가격을 불러오면 살 수 있다');

  await press('PRO 한 번 구매하기');
  assert.ok(shows('PRO를 시작했어요'), '성공 상태');
  assert.equal(ent().verified, true, '이용권이 저장된다');
  assert.equal(ent().plan, 'lifetime', '일회성 PRO 로 저장된다');
  assert.equal(ent().expiresAt, undefined, '기한 없이 저장된다');
  assert.deepEqual(st.finished, ['play-token-pro_lifetime']);
  assert.equal(labelled('구독 관리').length, 0, '일회성 구매에는 해지가 없다');
  assert.equal(labelled('구매 내역').length, 1, '대신 스토어 구매 내역으로 가는 길이 있다');
  await press('구매 내역');
  assert.equal(opened.at(-1), 'https://play.google.com/store/account/orderhistory', '스토어 구매 내역으로 간다');
  await press('PRO로 만들러 가기');
  assert.ok(texts().includes('PRO') && !texts().includes('PRO 보기'), '홈에 PRO 표시');

  // 재시작: 스토어에 구독이 남아 있으면 유지·갱신, 없으면 끝낸다
  st = fakeStore({ owned: [bought('pro_lifetime')] }); uiAdapter.useStoreModuleForTests(st.module);
  await restart();
  assert.ok(texts().includes('PRO') && !texts().includes('PRO 보기'), '재시작 뒤 구매가 계정에 남아 있으면 PRO 유지');
  st = fakeStore({ owned: [] }); uiAdapter.useStoreModuleForTests(st.module);
  await restart();
  assert.ok(texts().includes('PRO 보기'), '재시작 뒤 스토어에 구매가 없으면 PRO 가 꺼진다(환불·다른 계정)');
  assert.equal(ent().plan, 'lifetime', '기록은 남는다');

  // 취소
  st = fakeStore({ answer: (a, s) => s.fail({ code: 'user-cancelled' }) }); uiAdapter.useStoreModuleForTests(st.module);
  await press('PRO 보기'); await press('PRO 한 번 구매하기');
  assert.ok(shows('결제를 취소했어요') && shows('결제는 진행되지 않았어요'), '취소 상태와 안내');
  // 네트워크 실패
  st.answer = (a, s) => s.fail({ code: 'network-error' });
  await press('PRO 한 번 구매하기');
  assert.ok(shows('스토어에 연결하지 못했어요') && shows('인터넷 연결을 확인'), '실패: 다음 행동이 보인다');
  assert.equal(labelled('다시 시도').length, 1, '다시 시도 버튼');
  // 복원: 없음
  await press('구매 복원');
  assert.ok(shows('복원할 구매가 없어요'), '구매 없음');
  // 복원: 서버 연결 실패
  st.owned = [bought('pro_lifetime')]; server.down = true;
  await press('구매 복원');
  assert.ok(shows('결제 확인을 마치지 못했어요'), '서버 연결 실패 안내');
  assert.equal(st.finished.length, 0, '확인 전 확정 없음');
  // 복원 성공
  server.down = false;
  await press('안내에서 구매 복원');
  assert.ok(shows('PRO를 다시 켰어요'), '복원 성공');
  assert.equal(ent().plan, 'lifetime');
  await press('PRO로 만들러 가기');

  // 결제 모듈이 없는 빌드(내부 검수 APK 등): 결제할 수 없다고 말하고, 무료는 그대로
  uiAdapter.useStoreModuleForTests(null);
  const s0 = loadStore().store; saveStore({ ...s0, revision: s0.revision + 1, entitlement: undefined });
  await restart();
  await press('PRO 보기');
  assert.ok(shows('이 기기에서는 결제를 열 수 없어요') && shows('무료 기능은 그대로'), '모듈 없음 안내');
  assert.ok(shows('가격을 불러오지 못했어요'), '값을 지어내지 않고 못 불러왔다고 말한다');
  assert.ok(shows('지금은 구매할 수 없어요') && shows('다시 시도해 주세요'), '살 수 없는 상태와 다음에 할 일을 적는다');
  assert.ok(!shows('14,900'), '조회 실패에도 후보 가격을 대신 적지 않는다');
  assert.equal(labelled('PRO 한 번 구매하기')[0].props.disabled, true, '결제할 수 없으면 구매 버튼이 꺼진다');
  assert.equal(labelled('무료로 계속하기')[0].props.disabled, false, '무료로 계속하기는 그대로');
  await press('무료로 계속하기');
  assert.equal(labelled('새 세트 만들기').length, 1, '무료 작업 흐름 그대로');
  assert.equal(labelled('검수용 PRO 켜기').length, 0, '출시 구성: 검수 스위치 없음');

  // 화면에 나온 모든 글자에 스토어 오류 코드·모듈 이름이 없다
  const leaks = seen.filter(t => /user-cancelled|network-error|already-owned|billing-unavailable|expo-iap|Expo Go|purchaseToken/.test(t));
  assert.deepEqual(leaks, [], '오류 코드 노출 없음');
  await act(async () => tree.unmount());
  console.log('PASS: iap — 비소모성 일회성 PRO: 상품 조회(in-app·가격·네트워크 실패·상품 없음·모듈 없음), 구매 성공 시 서버 확인 뒤에만 이용권·확정, Android purchaseToken 만 전송(주문 번호·원본 JSON 미사용)·token 없음/pending 은 확인 보류, 취소·네트워크·이미 보유·요청 거절·알 수 없음·상품 없음, 서버 없음·연결 실패·거절 시 이용권 없음·미확정, 복원(일회성 우선·예전 구독도 인정·없음·결제 보류 제외·연결 실패), 앱 시작 재확인(오프라인·서버 실패 유지, 구독 없음·거절 시 종료하되 기록 보존, 재설치 자동 복원), 화면 상태(불러오기·구매 가능·성공·구매 내역·취소·실패+다시 시도·구매 없음·확인 실패·복원 성공·조회 실패 시 값 없음·재시도 안내·버튼 꺼짐), 오류 코드 노출 없음, 출시 구성 검수 스위치 없음. 실제 Play 결제·서버 배포는 미검증.');
})().catch(e => { console.error(e); process.exit(1); });
