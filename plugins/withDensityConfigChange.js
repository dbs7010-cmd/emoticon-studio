// 화면 밀도(설정 › 디스플레이 › 화면 크기) 바뀜을 앱이 직접 받는다(2026-10-28).
// 이 값이 없으면 Android 가 MainActivity 를 다시 만들어, 그 직후 '내 그림' 사진 고르기가
// "unregistered ActivityResultLauncher" 로 실패했다(vc18 에뮬레이터, 원장 §66). React Native 는
// onConfigurationChanged 로 새 크기를 받아 화면을 다시 그리므로 다시 만들 필요가 없다.
// 폴드 접기·펴기(smallestScreenSize·screenLayout)는 Expo 기본값에 이미 들어 있다.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

function addDensity(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const now = String(activity.$['android:configChanges'] || '').split('|').filter(Boolean);
  if (!now.includes('density')) now.push('density');
  activity.$['android:configChanges'] = now.join('|');
  return manifest;
}
module.exports = config => withAndroidManifest(config, mod => { mod.modResults = addDensity(mod.modResults); return mod; });
module.exports.addDensity = addDensity;
