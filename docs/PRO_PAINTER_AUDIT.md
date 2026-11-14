# PRO Painter 기술 감사 (2026-09-14, 27차 직후)

목표: 현재 Painter 를 보존하면서 이모티콘 제작에 필요한 핵심 기능을 어디까지 빠르게 올릴 수 있는지 **코드 증거로** 판단한다.
Procreate 복제는 목표가 아니다. 이 문서는 조사·계획이며 구현을 포함하지 않는다.

## 1. 현재 Painter 구조 — 증거

| 항목 | 사실 | 근거 |
|---|---|---|
| 렌더러 | **HTML5 Canvas 2D, `react-native-webview` 안.** RN 은 버튼·패널만 그린다 | `src/painter/canvas-html.ts`(HTML 문자열), `painter.tsx` `<WebView source={source}>` |
| Skia / gesture-handler / reanimated / perfect-freehand / svg | **설치도 import 도 없다** | `package.json` dependencies, `App.tsx`·`src/**` import 전수(grep 0건) |
| 실제 사용 의존성 | expo, expo-constants, expo-file-system, expo-image-manipulator, expo-image-picker, expo-sharing, expo-status-bar, @expo/vector-icons, react-native-safe-area-context, react-native-webview (`@expo/ui` 는 설치만, Painter 에서 미사용) | import 집계 |
| 캔버스 해상도 | 레이어마다 360×360 비트맵(제출 규격과 동일), CSS 로 화면 크기 확대 | `canvas-html.ts` `W=canvas.width` ← `KAKAO_STATIC_SPEC` |
| stroke 자료구조 | **벡터 stroke 가 없다.** 포인터 이동마다 활성 레이어 비트맵에 즉시 선분을 그린다(래스터 즉시 기록) | `pointermove` → `g.lineTo…stroke()` |
| 선 보정 | 지수 평활 1단(`steady += (raw-steady)*.55`) + 3px 간격 보간 | `pointermove` |
| 브러시 | 펜/붓/연필 = `globalAlpha`·굵기 배율·연필 입자(`grain`) 차이. 27차에 색 투명도용 wet 버퍼 추가 | `style()`, `grain()`, `dry()` |
| 입력 흐름 | canvas Pointer Events → 한 손가락 그리기 / `touches` Map 으로 2손가락 이동·핀치·탭 되돌리기, 3손가락 탭 다시 | `pointerdown/move/up`, `beginMulti`, `finishMulti` |
| 필압 | **읽지 않는다.** `pointerType` 은 `'touch'` 구분에만 쓰고 `pressure`·`tiltX`·`getCoalescedEvents` 사용 0건 | grep |
| 레이어 | 그림 레이어 최대 4 + 참고 레이어 N. 레이어마다 x·y·scale·rotation·opacity·visible | `layers`, `references`, `meta()` |
| 선택·변형 | 사각 마키 → 떠 있는 비트맵(dx·dy·scale·rot·flip) → 적용/취소/새 레이어로 분리 | `liftSelection`, `applySelection`, `selectTransform` |
| undo/redo | **레이어 전체 ImageData 스냅숏**, 최대 40개 | `snapshot()`, `checkpoint()` (`history.length>40`) |
| 저장·복원 | 저장 시 레이어별 PNG dataURL + 합성 PNG + metrics 를 RN 으로 보내 파일로 기록, 열 때 dataURL 로 되돌려 `init` | `m.type==='save'`, `loadLayer`, `services/images.ts` |
| 움직임 | 같은 레이어 비트맵에 외부 변환을 걸어 미리보기·GIF/WebP 를 같은 `buildLoop()` 로 생성 | `buildLoop` |
| 실행 형태 | **이미 네이티브 빌드로 돈다.** `android/`(prebuild) + `expo-dev-client` 플러그인, 검증 APK 는 Metro 없는 release 번들. iOS 프로젝트(`ios/`)는 생성된 적 없다 | `app.json` plugins, `android/`, 27차 APK |

### 현재 구조의 한계 (PRO 목표 기준)
- 해상도 360×360 고정: 확대해 그리면 계단이 보인다. 전문 도구감의 가장 큰 제약.
- stroke 기록이 없어 획 단위 편집·다시 그리기·필압 곡선 후처리가 불가.
- 스냅숏 undo 메모리: 레이어 1장 360×360×4 ≈ 0.52MB × 레이어 수 × 40. 해상도를 2배로 올리면 4배.
- WebView ↔ RN 메시지는 JSON 문자열(저장 시 PNG base64). 획 그리기 자체는 WebView 안에서 끝나 지연이 적다.

### Expo Go / Development Build
- 이 앱은 Expo Go 에 의존하지 않는다. `react-native-webview` 는 Expo Go 에 포함된 모듈이지만, 검증은 전부 네이티브 APK 로 했다.
- Expo SDK 57 이 보증하는 네이티브 버전(`node_modules/expo/bundledNativeModules.json`): `@shopify/react-native-skia 2.6.2`, `react-native-gesture-handler ~2.32.0`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `react-native-svg 15.15.4`, `expo-gl ~57.0.2`. `expo-iap` 은 목록에 없다(서드파티).
- npm 최신 Skia 2.11.2 의 peer: react ≥19, react-native ≥0.78, reanimated ≥4, worklets ≥0.7 — 현재 RN 0.86.3/React 19.2.3 과 형식상 호환. **채택 시에는 SDK 보증 버전 2.6.2 로 고정한다.**
- `perfect-freehand` 1.2.3 (npm 메타 수정 2026-02-01): 의존성 없는 순수 JS. WebView 안에 인라인 가능 → 네이티브 빌드 불필요. 라이선스는 채택 시 원문 확인.

## 2. PRO PAINTER MATRIX

A = 현재 코드에 있음/확장 · B = 검증된 라이브러리 부착 · C = Development Build/네이티브 필요 · D = 직접 구현

| 기능 | 분류 | 현재 기반 | 추천 라이브러리/API | 변경 예상 파일 | Android | iOS | Expo Go | Dev Build 필요 | 난이도 | 파손 위험 | 추천 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 필압/스타일러스 | A(수신) + 검증 차단 | Pointer Events 이미 사용, `pressure` 미사용 | W3C `PointerEvent.pressure`/`pointerType==='pen'`/`getCoalescedEvents` (WebView 내) | canvas-html.ts | Chromium WebView 가 pen 이벤트 제공(사양) — **S Pen 실기기 미검증** | WKWebView Pencil pressure — 미검증, iOS 빌드 없음 | 가능(웹 API) | 아니오 | 중 | 낮음(펜일 때만 분기) | 조건부 — 스타일러스 기기 확보 전엔 폭 변화 연결만, 판정 보류 |
| 2 브러시 불투명도 | A | 27차 wet 버퍼(색 알파) | — | canvas-html.ts, painter.tsx | 가능 | 가능 | 가능 | 아니오 | 하 | 낮음 | 예 |
| 3 브러시 프리셋(잉크/연필/마커/부드러운 펜/질감) | A+D | `style()`·`grain()` 3종 | stamp 방식 직접 구현, 필요 시 perfect-freehand(윤곽 폴리곤) 인라인 | canvas-html.ts, painter.tsx, assets/art | 가능 | 가능 | 가능 | 아니오 | 중 | 중(기존 3종 획 모양 변화 — 기존 프리셋 값 유지로 완화) | 예(NEXT) |
| 4 손떨림 보정 | A | 지수 평활 1단 + on/off | 강도 단계(평활 계수·지연 창) 또는 perfect-freehand streamline | canvas-html.ts | 가능 | 가능 | 가능 | 아니오 | 하 | 낮음 | 예 |
| 5 RGB/HSV/HEX/Alpha | A(27차 구현) | color.ts, ColorPanel | — | — | 스포이드·팔레트 실기기 PASS, RGB·Alpha 막대 실기기 미검증 | 미검증 | 가능 | 아니오 | — | — | 유지(재검수만) |
| 6 실제 스포이드 | A(27차 구현) | `eyedrop`/`picked` | — | — | 실기기 PASS | 미검증 | 가능 | 아니오 | — | — | 유지 |
| 7 사용자/캐릭터 팔레트 | A | `Store.userPalette`(앱 전역) | 세트별 팔레트는 `Project` 선택 필드로 확장 | types.ts, project.ts, App.tsx, painter.tsx | 가능 | 가능 | 가능 | 아니오 | 하 | 낮음 | 예(후순위) |
| 8 레이어 | A | 4장, 이름·복제·삭제·불투명도·보임 | 상한 확대 시 undo 메모리 재설계 필요(D) | canvas-html.ts, project.ts(검증 1..4) | 가능 | 가능 | 가능 | 아니오 | 중 | 중(저장 검증·구버전 호환) | 상한 유지 권장 |
| 9 선택 | A | 사각 마키 | 올가미는 D(경로 마스크) | canvas-html.ts | 가능 | 가능 | 가능 | 아니오 | 중 | 중 | 올가미는 보류 |
| 10 이동/크기/회전/반전 | A | 선택 float + 레이어 transform | — | — | 실기기 PASS(이전 차수) | 미검증 | 가능 | 아니오 | — | — | 유지 |
| 11 undo/redo | A | 스냅숏 40 | 해상도 상향 시 타일·영역 diff 스냅숏(D) | canvas-html.ts | 가능 | 가능 | 가능 | 아니오 | 중 | 높음(핵심 제스처 연결) | 현 구조 유지 |
| 12 참고 | A | 참고 레이어·이동·핀치·불투명도 | — | — | 실기기 PASS(이전 차수) | 미검증 | 가능 | 아니오 | — | — | 유지 |
| 13 투명 PNG | A | 저장 metrics.transparent | — | — | PASS | 미검증 | 가능 | 아니오 | — | — | 유지 |
| 14 애니메이션 레이어 제어 | A | 레이어 단위 motion parts·두 모습 | — | — | PASS(이전 차수) | 미검증 | 가능 | 아니오 | — | — | 유지 |
| (참고) 고해상도 작업 캔버스 | D | 360 고정 | 작업 720/1080 + 출력 360 다운샘플 | canvas-html.ts 전반, 저장 형식 | 가능 | 가능 | 가능 | 아니오 | 상 | **높음**(저장 호환·undo 메모리·움직임 좌표) | 보류(별도 CURRENT) |
| (참고) Skia 엔진 전환 | B+C | 없음 | @shopify/react-native-skia 2.6.2 + gesture-handler + reanimated | Painter 전면 | 가능 | 가능 | 불가 | 예 | 상 | **매우 높음**(검증된 제스처·저장·움직임 전부 재작성) | 비추천(현 단계) |

Skia 를 지금 비추천하는 이유: 성능 문제가 관측되지 않았고(획은 WebView 안에서 완료), 필압도 WebView Pointer Events 로 받을 수 있으며, 전환 비용이 PRO 기능 전부보다 크다. 고해상도·수십 레이어가 필요해지면 다시 판단한다.

## 3. DEVELOPMENT BUILD PLAN (최소 변경)

현실: 네이티브 Android 빌드는 이미 쓰고 있다. 남은 것은 "Development Build 를 기준 실행 형태로 확정"하는 일이지 전환 공사가 아니다.

1. **기준 확정(코드 변경 없음)**: 검증 기준 = 로컬 `gradlew :app:assembleRelease` APK(내부/출시 구성 두 벌, SOURCE_ID·SHA 기록). Expo Go 스크립트(`start --go`)는 개발 편의로만 남기고 PASS 근거로 쓰지 않는다.
2. **Dev client 디버그 빌드는 보조**: BrowserStack 클라우드 기기는 로컬 Metro 에 닿지 않으므로(터널 필요) 반복 확인에 쓰지 않는다. 필요할 때만 `assembleDebug` + BrowserStack Local 을 검토.
3. **네이티브 모듈 추가 시 규칙**: `bundledNativeModules.json` 버전으로 설치 → `expo prebuild --platform android` → ASCII 경로 빌드(MASTER_SOURCE 절차) → 아래 회귀 목록 → 새 PRO 기능.
4. **출시 전 필수(Painter 무관)**: 업로드 키/EAS credentials, AAB(production 프로필), 결제 모듈·영수증 서버, 개인정보 URL.
5. **iOS**: `ios/` 없음. macOS 또는 EAS Build 가 필요 — 현재 차단.

전환(모듈 추가·prebuild) 직후 회귀 검증 — 실패 시 새 기능보다 복구 우선:
drawing · eraser · fill · RGB/alpha · eyedropper · undo/redo(2·3손가락) · pan/zoom · reference 이동/핀치 · save · 재실행 restore · slot 이동(이전/다음·32번째 칸). 기존 `--smoke`·`--r27`·`--r27color` 러너와 `npm test`·`color-engine-test` 를 그대로 재사용한다.

## 4. NEXT CURRENT — 하나

**B. 현재 엔진에서 PRO brush 기반 먼저.**

- 개발비용: WebView 캔버스의 `style()`/wet 버퍼/보간 루프를 확장하는 범위라 신규 의존성·네이티브 빌드 변경이 없다.
- 위험: 입력·제스처·저장 형식을 건드리지 않는다. 기존 펜/붓/연필 값은 그대로 두고 프리셋을 추가해 회귀 범위를 획 모양으로 한정한다.
- 재사용: 27차 투명도 wet 버퍼·Chromium 엔진 테스트·BrowserStack 러너를 그대로 쓴다. 첫 기기 실행에 27차 미검증인 RGB·투명도 막대 재검수를 함께 넣는다(러너 스크롤 기준만 수정, 재빌드 공유).
- PRO 목표: 무료와 체감 차이가 가장 큰 항목(마커·부드러운 펜·질감·보정 강도·브러시 불투명도)을 먼저 채운다. 획 함수에 `pressure` 인자를 받는 자리를 두어 스타일러스 확인 뒤 연결만 하면 되게 한다.
- A(Dev Build 먼저)가 아닌 이유: 이미 네이티브 빌드 기반이라 얻는 것이 없다. C(필압 PoC 먼저)가 아닌 이유: 스타일러스 실기기가 없어 판정할 수 없고(개인 휴대폰 금지, 클라우드 자동화는 필압을 재현하지 못함) 결과가 BLOCKED 로 끝난다.

## 5. 28차 반영 (2026-09-14)
- 2 브러시 불투명도: **구현**(PRO 진하기 5~100%, 색 투명도와 곱). 자동 PASS, 실기기 조작 PASS.
- 3 프리셋: **구현**(매끈한 잉크·부드러운 펜·결 연필·마커, 외부 라이브러리 없음 — perfect-freehand 미도입). 자동 PASS, 실기기 시각 차이 미검증(BrowserStack 시간 소진).
- 4 손떨림 보정: **구현**(끔/약/중/강, 중·강 끝점 보정). 자동 PASS(흔들림 1.48→0.42), 실기기 미검증.
- 1 필압: **입력 자리만**(pen pressure 수신·검증 함수, 반응 미연결). 실기기·스타일러스 미검증.
- 5 RGB/Alpha: 27차 미검증이던 실기기 조작 **PASS**.
