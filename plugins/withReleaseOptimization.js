// 릴리스 빌드 코드 줄이기·난독화(R8) 켜기 (2026-10-10, Play Console '다음 출시 버전을 위한 발견 항목': DEX 코드 최적화 기준 미달 — 난독화 1%, 해결 기한 2027-02).
// - android.enableMinifyInReleaseBuilds / enableShrinkResourcesInReleaseBuilds 를 gradle.properties 에 둔다(템플릿 build.gradle 이 이 값을 읽는다).
// - 각 라이브러리는 자기 keep 규칙(consumer rules)을 갖고 있다. 여기서는 WebView 에서 부르는 자바스크립트 다리만 덧붙여 지킨다.
// - 난독화 매핑 파일은 AGP 가 AAB 안(BUNDLE-METADATA)에 넣는다 — Play 가 비정상 종료 보고를 되돌려 읽을 수 있다.
const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# emoti(withReleaseOptimization): WebView 자바스크립트 다리와 리액트 네이티브 주석이 붙은 멤버를 지킨다.
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface,*Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keep class com.facebook.react.bridge.** { *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
`;

module.exports = function withReleaseOptimization(config) {
  config = withGradleProperties(config, c => {
    const set = (key, value) => {
      const i = c.modResults.findIndex(x => x.type === 'property' && x.key === key);
      if (i >= 0) c.modResults[i].value = value; else c.modResults.push({ type: 'property', key, value });
    };
    set('android.enableMinifyInReleaseBuilds', 'true');
    set('android.enableShrinkResourcesInReleaseBuilds', 'true');
    return c;
  });
  return withDangerousMod(config, ['android', async c => {
    const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (!now.includes('emoti(withReleaseOptimization)')) fs.writeFileSync(file, now + RULES);
    return c;
  }]);
};
