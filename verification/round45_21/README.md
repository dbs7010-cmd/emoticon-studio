# 45.21 — 실기기 밑그림 삽입 실패 수정 (2026-09-22, Claude)

시작 HEAD `72fe237`, 시작 작업 트리 **깨끗함**(보존할 사용자 변경 없음). 종료 HEAD `8af81b6`.
사용자가 검수한 APK 는 `345bb21` 이고, 거기에 이 수정은 들어 있지 않다.

## A. 원인 — 릴리스 빌드에서만 생기는 조건

실기기 캡처의 문구가 첫 단서였다. `밑그림을 넣지 못했어요 / 잠시 후 다시 시도해 주세요.`
뒷줄은 `userMessage` 의 **기본 문구**다. 내가 던진 한글 오류(`그림 파일을 찾지 못했습니다`)였다면 그대로 보였을 테니,
**URI 는 얻었고 그 뒤 단계에서 네이티브 영문 오류가 났다**는 뜻이다. 거기서부터 코드로 좁혔다.

### 무슨 일이 일어나는가
1. Metro 는 `require('../../assets/expression-guides/*.png')` 를 **Android drawable 리소스**로 굽는다.
   (45.19 APK 검사에서 `android/app/build/generated/res/react/release/drawable-mdpi/assets_expressionguides_*.png` 와
   `resources.arsc` 안 이름 81개를 이미 확인했다.)
2. 릴리스에서 `resolveAssetSource()` 는 파일 경로가 아니라 **스킴 없는 리소스 이름**(`assets_expressionguides_greetinghellowave`)을 준다.
3. `expo-asset` 의 `Asset.fromModule()` 이 여기서 지름길을 탄다 — `node_modules/expo-asset/build/Asset.js`:
   ```js
   if (Platform.OS === 'android' && !uri.includes(':') && (meta.width || meta.height)) {
       asset.localUri = asset.uri;   // 리소스 이름을 그대로 localUri 에
       asset.downloaded = true;      // '이미 내려받음' 으로 표시
   }
   ```
   주석에 적힌 의도는 **React Native `<Image>` 호환**이다(그래서 표현 목록·참고 창의 그림은 잘 보인다).
4. 그 표시 때문에 `downloadAsync()` 는 `if (this.downloaded) return this;` 로 **즉시 돌아온다. 파일이 만들어지지 않는다.**
5. `importBundledImage` 는 그 리소스 이름을 파일로 알고 `ImageManipulator.manipulate(...)` 에 넘긴다.
   네이티브는 이 문자열을 `Uri` 로 파싱해 이미지 로더에 넘기는데(`ImageManipulatorModule.kt`),
   스킴이 없으면 파일 경로로 읽혀 **`ImageLoadingFailedException`** 이 난다 → 영문 오류 → 기본 문구 팝업.

### 왜 지금까지 안 걸렸나
- 개발(Metro) 에서는 URI 가 `http://…` 라 3번 지름길이 적용되지 않고, 실제로 내려받아 파일이 생긴다.
- 테스트 mock 은 언제나 `file://` 을 돌려줬다. **이 조건 자체가 재현되지 않았다.**

### 고칠 수 있는 근거
같은 패키지의 **네이티브 쪽은 이 리소스 이름을 읽을 수 있다** — `expo-asset/android/.../AssetModule.kt`:
```kotlin
if (!uriString.contains(":")) {
  return openAssetResourceStream(context, uriString)   // 리소스 이름 → openRawResource
}
```
즉 문제는 JS 층의 지름길뿐이다. **표시만 지우면 원래 경로로 진짜 파일이 만들어진다.**

## B. 수정 (최소)

`src/services/images.ts` — `importBundledImage`
```ts
const asset = Asset.fromModule(module as number);
if (asset.downloaded && asset.localUri && !asset.localUri.includes(':')) {
  asset.downloaded = false;   // <Image> 호환용 지름길을 지운다
  asset.localUri = null;
}
await asset.downloadAsync();  // 네이티브가 리소스를 캐시 파일로 복사한다
```
- 스킴이 있는 경우(개발 Metro·iOS)는 **아무것도 달라지지 않는다.**
- 내려받은 뒤에도 파일 경로가 아니면 조용히 넘기지 않고 한글 오류로 멈춘다.
- 단계 표시를 더했다: `그림을 찾지 못했어요 (1단계)` / `그림을 파일로 옮기지 못했어요 (2단계)` / `앱에 저장하지 못했어요 (3단계)`.
  **내부 경로·네이티브 원문은 화면에 내보내지 않고 `console.warn` 으로만 남긴다.**

`src/painter/painter.tsx` — `insertGuideUnderlay`
- 이 칸에 이미 깔아 둔 밑그림이 있으면 **다시 들이지 않고 보여 주기만** 한다(중복 삽입 방지).
- `내 사진` 불러오기·참고 저장 정책·사용자 그림은 건드리지 않았다.

## C. 회귀 검사 — mock 이 놓친 조건을 그대로 넣었다

`scripts/guide-flow-test.cjs` 8절. 릴리스의 expo-asset 을 흉내 낸다:
리소스 이름 + `downloaded: true`, 그리고 **표시를 지우고 다시 불러야만** 파일이 생기는 `downloadAsync`.
이미지 로더 mock 은 **스킴 없는 문자열을 받으면 던진다** — 기기에서 난 것과 같은 실패다.

수정을 되돌리고 돌려 재현을 확인했다:
```
Error: Could not load image from url: assets_expressionguides_greetinghellowave
```
수정 뒤에는 `file:///cache/…png` 가 넘어가고, 복사 1회·크기 유지·저장소 파일명 반환을 확인한다.
내려받기까지 실패하는 경우에는 **한글 + 단계만** 나오고 경로·영문 원문이 없다는 것도 검사한다.

중복 삽입 방지도 5절에 넣었다: 이미 깔린 뒤 다시 눌러도 `addReferences` 가 늘지 않고, 그림을 다시 들여오지도 않으며, 참고는 한 장 그대로다.

## D. 검사 결과

- typecheck 0
- `npm test` **23/23 PASS**
- 재현 확인: 수정 없이는 8절이 실패, 수정 뒤 통과

## E. APK

```
BUILD SUCCESSFUL in 6m 18s
```

| 항목 | 값 |
|---|---|
| 배포 사본 | `dist/emoticon-studio-1.0.0-vc1-internal-review-8af81b6-arm64.apk` |
| 소스 커밋 | `8af81b6` |
| SOURCE_ID | `72b855f05cbe94e29bffa8b92a9ec85120f86942abe30f0fced926f7ed977e65` (파일 127개) |
| 크기 | 39,584,135 바이트 |
| SHA-256 | `b3288e465adcc19013109c4799bbe293aac2b1ee01a0593284c4ccff1fa03c5c` (빌드본과 동일 확인) |
| ABI / 서명 | `arm64-v8a` / 디버그 키(내부 검수용) |
| 검수 플래그 | `extra.internalReview = true` |
| 가이드 drawable | 81개 |
| 단계 문구 | 세 개 모두 번들에 포함 확인 |
| 이전 APK | `0da0556` · `271d166` · `345bb21` 모두 **보존** |

## F. 별도 기록 — 이번에 고치지 않은 것 (UI 재설계 금지)

관찰만 적는다. 이번 수정에 섞지 않았다.

1. **참고 창의 큰 점유 면적** — 화면폭의 약 46%(120~190dp) 정사각이라 캔버스를 많이 가린다. 캡처에서도 캔버스 가운데를 덮었다.
2. **감정 카드의 같은 자리표시** — 카드 20장이 모두 같은 노란 도형이다. 카드별 그림(20장)이 아직 0장이라 그렇다(`EXPRESSION_GUIDE.ready=false`).
3. **미완성 기본 레퍼런스 패널** — `참고 › 기본 레퍼런스` 는 회색 인형 자리표시 32칸에 '관절 인형 그림은 준비 중이에요' 그대로다. 칸별 데이터도 `pickBuiltinReference`/`movePose` 도 비어 있다.
4. **움직이기 조절부와 완료 버튼 겹침 가능성** — 캡처에서 속도 막대 바로 아래에 '완성 · 다음' 이 붙어 있다. 실제로 겹치는지는 화면 높이에 달렸고 확인하지 않았다.

## G. 미검증

- **DEVICE-UX: UNVERIFIED.** 이 수정이 기기에서 실제로 통하는지는 **사용자 설치 확인 전까지 PASS 로 적지 않는다.**
  원인과 고칠 근거는 코드로 확인했고 그 조건을 테스트로 재현했지만, 실행 확인은 아직 없다.
- ADB·개발자 모드·AVD·앱 삭제·데이터 초기화 **모두 사용하지 않았다.**
