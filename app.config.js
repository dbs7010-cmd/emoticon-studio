// 빌드 구성을 하나 더 둔다: **내부 검수 빌드**.
//
// 왜 app.json 만으로는 안 되는가
//   결제 모듈이 아직 없어 PRO 를 켤 길이 없고, 그러면 사용자가 PRO 제작 기능을 눈으로 볼 수 없다.
//   그렇다고 앱 안에 "무료로 PRO 켜기" 같은 문을 두면 그것이 출시본에도 들어간다.
//   그래서 **빌드할 때 정해지는 값**으로 가른다. 출시 구성에서는 이 값이 false 라, 우회 경로가
//   아예 꺼진 채로 묶인다.
//
// 왜 __DEV__ 가 아닌가
//   __DEV__ 는 Metro 개발 서버로 띄웠을 때만 참이다. 우리가 손으로 확인하는 내부 APK 는 Metro 가
//   없는 release 번들이라 __DEV__ 가 거짓이다. 즉 __DEV__ 로 묶으면 정작 확인해야 할 그 APK 에서
//   동작하지 않는다. expo-constants 의 extra 는 번들에 박혀 들어가므로 Metro 없이도 살아 있다.
//
// 쓰는 법
//   내부 검수 빌드:  EMOTICON_INTERNAL_REVIEW=1 npx expo prebuild --platform android
//                    그리고 같은 환경변수를 둔 채 gradlew :app:assembleRelease
//   출시 빌드:       환경변수를 두지 않는다. 그것이 기본값이다.
const base = require('./app.json');
const { httpsUrl, email } = require('./release/config-values.cjs');
const publicContact = require('./release/public-contact.json');
const pick = (envValue, fileValue, valid) => envValue !== undefined ? (valid(envValue) ? envValue : undefined) : (valid(fileValue) ? fileValue : undefined);

const internalReview = process.env.EMOTICON_INTERNAL_REVIEW === '1';
const purchases = process.env.EMOTICON_PURCHASES;
if (purchases !== undefined && purchases !== 'closed') throw new Error('EMOTICON_PURCHASES must be closed or unset');
if (purchases === 'closed' && internalReview) throw new Error('Closed free tests cannot enable internalReview');
// 비공개 테스트 PRO 체험: 기본 꺼짐. EMOTICON_PRO_TRIAL=1 이고 구매가 닫힌 빌드에서만 켤 수 있다.
// 일반 출시 구성(구매 열림)에서 켜려 하면 여기서 멈춘다 — 실수로 PRO 를 공짜로 여는 출시본이 나오지 않게.
const proTrial = process.env.EMOTICON_PRO_TRIAL === '1';
if (process.env.EMOTICON_PRO_TRIAL !== undefined && !['0', '1'].includes(process.env.EMOTICON_PRO_TRIAL)) throw new Error('EMOTICON_PRO_TRIAL must be 1, 0 or unset');
if (proTrial && purchases !== 'closed') throw new Error('EMOTICON_PRO_TRIAL=1 needs EMOTICON_PURCHASES=closed (never in a purchase-enabled release)');
// 영수증 확인 서버 주소(https 만). 비밀 키가 아니라 공개 주소다 — 키는 서버에만 둔다.
// 비어 있으면 앱은 구매를 확인하지 못하고, 그 사실을 화면에 말한다(PRO 를 열지 않는다).
const receiptEndpoint = /^https:\/\//.test(process.env.EMOTICON_RECEIPT_ENDPOINT || '') ? process.env.EMOTICON_RECEIPT_ENDPOINT : undefined;

// ── 출시 에셋 연결 ─────────────────────────────────────────────────────────────────────────────
// 파일 위치·규격의 원본은 assets/asset-contract.json 이다. assets/brand/ 에 최종 이미지를 넣으면 여기서
// 자동으로 연결되고, 아직 없으면 지금의 Expo 템플릿 이미지로 떨어진다 — 빌드는 되지만
// scripts/asset-check.cjs(npm run assets:check)가 출시 검사에서 FAIL 한다. 이미지를 넣을 때 이 파일은 고치지 않는다.
const fs = require('fs');
const path = require('path');
const contract = require('./assets/asset-contract.json');
const brand = id => {
  const entry = contract.assets.find(a => a.id === id);
  return entry && fs.existsSync(path.join(__dirname, entry.destination)) ? './' + entry.destination : null;
};
// 색 값(선택): assets/brand/brand.json { "adaptiveBackgroundColor", "splashBackgroundColor", "splashImageWidth" }
const brandSettings = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/brand/brand.json'), 'utf8')); } catch { return {}; } })();
// 스플래시는 expo-splash-screen 설정 플러그인으로 연결한다(SDK 57 문서). 모듈이 없는데 플러그인을 넣으면 prebuild 가
// 실패하므로, 이미지와 모듈이 둘 다 있을 때만 넣는다. 둘 중 하나라도 없으면 asset-check 가 FAIL 로 알린다.
const splashModuleInstalled = (() => { try { require.resolve('expo-splash-screen/package.json', { paths: [__dirname] }); return true; } catch { return false; } })();

module.exports = () => {
  const adaptive = (base.expo.android && base.expo.android.adaptiveIcon) || {};
  const splashImage = brand('splash_icon');
  const plugins = [...(base.expo.plugins || [])];
  // 스플래시 플러그인이 없을 때: 실행 창 배경을 앱의 밝은 색으로(템플릿 투명 PNG 뒤로 검은 화면이 보이던 원인, 38.5차).
  if (!(splashImage && splashModuleInstalled)) plugins.push('./plugins/withLaunchBackground');
  if (splashImage && splashModuleInstalled) {
    plugins.push(['expo-splash-screen', {
      image: splashImage,
      imageWidth: brandSettings.splashImageWidth || 200,
      resizeMode: 'contain',
      backgroundColor: brandSettings.splashBackgroundColor || '#F4F4F5',
    }]);
  }
  // 출시 서명: prebuild 때마다 app/build.gradle 의 release 서명을 업로드 키로 바꾸고 AAB 디버그 서명을 막는다(docs/RELEASE_SIGNING.md).
  plugins.push('./plugins/withReleaseSigning');
  plugins.push('./plugins/withReleasePermissions');
  plugins.push('./plugins/withBackupRules');
  // 제목 글꼴(45.39 확정 디자인 D): Jua(SIL OFL 1.1, assets/fonts/Jua-OFL.txt). 빌드 때 APK 에 넣는다 — 실행 중 내려받지 않는다.
  // 본문은 기기 기본 한글 글꼴을 그대로 쓴다(한글 본문 글꼴은 굵기마다 수 MB 라 넣지 않는다).
  plugins.push(['expo-font', {
    android: { fonts: [{ fontFamily: 'Jua', fontDefinitions: [{ path: './assets/fonts/Jua-Regular.ttf', weight: 400 }] }] },
    ios: { fonts: ['./assets/fonts/Jua-Regular.ttf'] },
  }]);
  return {
  ...base.expo,
  icon: brand('app_icon') || base.expo.icon,
  android: {
    ...base.expo.android,
    adaptiveIcon: {
      ...adaptive,
      foregroundImage: brand('adaptive_foreground') || adaptive.foregroundImage,
      backgroundImage: brand('adaptive_background') || adaptive.backgroundImage,
      monochromeImage: brand('adaptive_monochrome') || adaptive.monochromeImage,
      ...(brandSettings.adaptiveBackgroundColor ? { backgroundColor: brandSettings.adaptiveBackgroundColor } : {}),
    },
  },
  plugins,
  extra: {
    ...(base.expo.extra ?? {}),
    // 이 값이 참인 빌드에서만 설정 화면에 검수용 스위치가 나타난다. 거짓이면 그 화면도, 그 길도 없다.
    internalReview,
    purchases,
    // 비공개 테스트 PRO 체험(구매 닫힘 빌드 전용). 저장되지 않는 빌드 값이다.
    proTrial,
    receiptEndpoint,
    // 공개 연락처: 환경변수가 있으면 그 값(형식이 틀리면 비움), 없으면 release/public-contact.json(저장소에 둔 공개 값).
    privacyPolicyUrl: pick(process.env.EMOTICON_PRIVACY_URL, publicContact.privacyPolicyUrl, httpsUrl),
    supportEmail: pick(process.env.EMOTICON_SUPPORT_EMAIL, publicContact.supportEmail, email),
  },
  };
};
