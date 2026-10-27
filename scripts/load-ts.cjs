const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
// 45.42 S0: react-native-svg 는 네이티브 모듈이라 노드에서 실제로 불러올 수 없다. 검사 로더에서만 이름 붙은 빈 요소로 바꾼다.
// 이 목으로 통과한 검사는 '어떤 아이콘이 어디에 어떤 속성으로 그려지는가'까지만 확인한다 — 실제 SVG 렌더링 확인이 아니다.
const SVG_MOCK = Object.assign(
  Object.fromEntries(['Svg', 'Path', 'Circle', 'Rect', 'G', 'Line', 'Ellipse', 'Polyline', 'Polygon', 'Defs', 'ClipPath'].map(n => [n, 'Svg' + (n === 'Svg' ? '' : n)])),
  { default: 'Svg', __esModule: true });
exports.SVG_MOCK = SVG_MOCK;
exports.loader = function (given = {}) {
  // 시스템 브라우저 로그인(expo-web-browser)·난수(expo-crypto)는 검사에서 대역 — 실제 동작은 APK·실기기에서.
  const mocks = { 'react-native-svg': SVG_MOCK, 'expo-web-browser': { openAuthSessionAsync: async () => ({ type: 'cancel' }) }, 'expo-crypto': { getRandomBytes: n => new Uint8Array(require('node:crypto').randomBytes(n)), CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_a, s) => require('node:crypto').createHash('sha256').update(s).digest('hex') },
    // Apple 로그인(iOS 전용): 검사 환경은 Android 처럼 '쓸 수 없음'
    // 광고(Android 보상형): 검사 환경에서는 광고 단위가 없어 부르지 않는다. 부르면 '불러오지 못함'.
    'react-native-google-mobile-ads': (() => { const listeners = {}; return { __esModule: true, default: () => ({ initialize: async () => [], setRequestConfiguration: async () => {} }), AdsConsent: { gatherConsent: async () => ({ canRequestAds: true }) }, MaxAdContentRating: { PG: 'PG' }, TestIds: { REWARDED: 'ca-app-pub-3940256099942544/5224354917' }, AdEventType: { CLOSED: 'closed', ERROR: 'error' }, RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' }, RewardedAd: { createForAdRequest: () => ({ addAdEventListener: () => () => {}, load: () => {}, show: async () => {} }) } }; })(),
    'expo-apple-authentication': { isAvailableAsync: async () => false, signInAsync: async () => { throw Object.assign(new Error('cancel'), { code: 'ERR_REQUEST_CANCELED' }); }, AppleAuthenticationButton: () => null, AppleAuthenticationButtonType: { CONTINUE: 1 }, AppleAuthenticationButtonStyle: { BLACK: 2 } }, 'expo-screen-orientation': { OrientationLock: { DEFAULT: 0, PORTRAIT_UP: 3 }, lockAsync: async () => {} },
    // 강좌 영상(expo-video)은 검사에서 대역 — 실제 재생은 APK 에서 본다.
    'expo-video': { useVideoPlayer: () => ({ play() {}, pause() {}, loop: false, muted: false }), VideoView: 'VideoView' }, ...given };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      if (mocks[name]) return mocks[name];
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const resolved = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!resolved) throw new Error('Cannot resolve ' + base);
      // 그림·글꼴은 번들러가 하듯 '손잡이'로 돌려준다. 예전에는 TS 로 읽으려다 빈 객체가 되어
      // 어느 파일인지 알 수 없었다. 경로가 남아야 검토 렌더가 진짜 그림을 붙일 수 있다.
      if (/\.(png|jpg|jpeg|gif|webp|svg|ttf|otf|mp4)$/i.test(resolved)) {
        if (!cache.has(resolved)) cache.set(resolved, { exports: { __asset: resolved } });
        return cache.get(resolved).exports;
      }
      return load(resolved);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
};
