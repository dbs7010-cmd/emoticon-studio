# ASSET INVENTORY — 그래픽 에셋이 있어야 확실히 좋아지는 자리 (34차, 2026-09-14)

UI 로 해결되는 문제는 넣지 않았다. 이번 라운드에서 에셋을 새로 만들지 않았다(ASSET_NEEDED 표시만).
기존 에셋(`assets/art/` 마스코트 3종·펜/붓/연필 도구·선 샘플)은 유지한다.

| screen | asset_name | purpose | priority | recommended_format | recommended_ratio | transparent_background | notes |
|---|---|---|---|---|---|---|---|
| 런처·스토어 | app_icon | 앱 아이콘. **현재 `assets/icon.png` 는 Expo 템플릿 기본 이미지(파란 'A' 격자)** | P0 (출시 차단) | PNG 1024×1024 | 1:1 | 아니오(iOS 는 불투명 필수) | `app.json` `icon`. 마스코트·흰/검/노랑 톤 기준. 제휴 오인 없게 카카오 요소 금지 |
| Android 런처 | adaptive_icon_foreground / background / monochrome | 적응형 아이콘. **현재 foreground 도 Expo 템플릿** | P0 (출시 차단) | PNG 432×432(각 레이어) | 1:1, 안전 영역 가운데 264dp 원 | foreground·monochrome 예 / background 아니오 | `app.json android.adaptiveIcon`. 배경색 `#F7F4EE` 설정됨 |
| 앱 시작 | splash_icon | 시작 화면 로고. **현재 `assets/splash-icon.png` 는 템플릿 격자** | P0 | PNG 1024×1024 | 1:1 | 예 | `app.json` 에 splash 설정이 없고 `expo-splash-screen` 미설치 — 에셋과 함께 설정 작업 필요(출시 준비) |
| Play 스토어 | store_hi_res_icon | 스토어 등록 아이콘 | P0 | PNG 512×512 | 1:1 | 아니오 | app_icon 에서 파생 |
| Play 스토어 | feature_graphic | 스토어 상단 그래픽 | P0 | PNG/JPG 1024×500 | 약 2:1 | 아니오 | 실제 앱 화면·마스코트 조합. 승인·수익 보장 문구 금지 |
| Play 스토어 | phone_screenshots | 스토어 스크린샷 | P0 | PNG 1080×1920 이상 | 9:16 | 아니오 | **그림으로 만들지 말고 실기기에서 실제 화면을 캡처**(검수 빌드와 같은 소스) |
| Painter 펜 설정 | preset_stroke_samples (ink / soft / grain / marker) | PRO 브러시 카드의 견본. 지금은 색 막대라 무료 펜·붓·연필 카드(실제 선 샘플 PNG)와 모양 문법이 다름 | P2 | PNG 300×84 (35차 계약: 기존 stroke-*.png 실측) | 약 3.6:1 | 예 | `assets/art/stroke-*.png` 와 같은 규격. **Painter freeze** — 실기기 확인 뒤 적용 |
| (선택) 복구·빈 상태 | 없음 | 기존 마스코트(`mascot-eraser`·`mascot-paper`)로 충분 | — | — | — | — | 새 에셋 불필요로 판단 |

## 아이콘 문법 기록 (에셋 불필요 — 코드 아이콘 유지)
- 34차에 바꿈: 대화상자 닫기 `×` 글자 → `close` 아이콘, 알림 `×` 글자 → `close` 아이콘(펜 설정·색 시트와 같은 모양).
- 남김(Painter freeze·기준 화면): Painter 머리 `‹ ⋯ ↶ ↷` 글자, 앱 머리 `‹ ⋯` 글자(Painter 와 같은 문법이라 통일 유지), 보드 `☰ 순서 변경` `▶ 전체 재생` 글자 기호, 움직임 패널 `×`. 실기기 확인 뒤 한 번에 아이콘으로 바꿀지 결정.
- 이모지 사용: 없음.

---

# ASSET REPLACEMENT CONTRACT (35차, 2026-09-14)

**원본은 `assets/asset-contract.json`** — 이 절은 그 파일을 사람이 읽기 쉽게 옮긴 것이다. 둘이 다르면 JSON 이 맞다.
검사: `npm run assets:check` (P0 FAIL 이 하나라도 있으면 종료 코드 1). 판정 규칙 자체는 `npm test` 의 `asset-check-test` 가 고정한다.

| asset | SOURCE FILE (에셋 라운드 산출물) | DESTINATION | FORMAT | DIMENSIONS | TRANSPARENCY | CONFIG REFERENCE | ANDROID / iOS / STORE | REBUILD | VALIDATION |
|---|---|---|---|---|---|---|---|---|---|
| app_icon (P0) | 최종 앱 아이콘 | `assets/brand/app-icon.png` | PNG | 1024×1024 | 알파 채널 없음 | `expo.icon` ← app.config.js 자동 | Android 레거시 · iOS 아이콘 · Play 아이콘 원본 | prebuild --clean + 네이티브 빌드 | 존재·크기·알파 없음·템플릿 아님 |
| adaptive_foreground (P0) | 적응형 앞면 | `assets/brand/adaptive-foreground.png` | PNG | 1024×1024(가운데 약 66% 원 안전) | 배경 투명 필수 | `android.adaptiveIcon.foregroundImage` 자동 | Android | prebuild --clean + 빌드 | 존재·크기·투명 픽셀 있음·템플릿 아님 |
| adaptive_background (P0) | 적응형 뒷면 | `assets/brand/adaptive-background.png` | PNG | 1024×1024 | 불투명 | `android.adaptiveIcon.backgroundImage` 자동 (색만: `brand.json adaptiveBackgroundColor`) | Android | prebuild --clean + 빌드 | 존재·크기·투명 픽셀 없음 |
| adaptive_monochrome (P0) | 테마 아이콘 실루엣 | `assets/brand/adaptive-monochrome.png` | PNG | 1024×1024 | 배경 투명 필수 | `android.adaptiveIcon.monochromeImage` 자동 | Android 13+ | prebuild --clean + 빌드 | 존재·크기·투명 픽셀 있음 |
| splash_icon (P0) | 스플래시 로고 | `assets/brand/splash-icon.png` | PNG | 1024×1024 | 배경 투명 필수 | `plugins: expo-splash-screen { image, imageWidth 200, resizeMode contain, backgroundColor #F4F4F5 }` ← 이미지+모듈 있으면 자동 | Android 12+ SplashScreen · iOS 런치 | `npx expo install expo-splash-screen`(최초 1회) + prebuild --clean + release/preview 빌드로 확인 | 존재·크기·투명·모듈 설치·설정 연결 |
| play_icon (P0) | 스토어 아이콘 | `assets/store/play-icon-512.png` | 32-bit PNG | 512×512, ≤1024KB | 알파 가능 | 없음(Play Console 업로드) | Store | 불필요 | 존재·크기·용량 |
| feature_graphic (P0) | 피처 그래픽 | `assets/store/feature-graphic.png` 또는 `.jpg` | JPEG / 24-bit PNG | 1024×500 | 알파 없음 | 없음 | Store | 불필요 | 존재·크기·알파 없음 |
| phone_screenshots (P0) | **실기기 캡처**(출시 후보 빌드) | `assets/store/screenshots/phone-01.png` … `phone-08` | JPEG / 24-bit PNG | 2~8장, 변 320~3840, 긴 변 ≤ 짧은 변×2, 권장 1080×1920 | 알파 없음 | 없음 | Store | 불필요 | 장수·크기·비율·알파(1080 미만 경고) |
| brush_preset_previews (P2) | 브러시 견본 4장 | `assets/brush/preset-{ink,soft,grain,marker}.png` | PNG | 300×84 | 배경 투명 | 아직 없음(Painter FREEZE 해제 후 `PRO_BRUSHES` 에 require) | 앱 화면 | JS 번들 → 앱 재빌드 | 존재·크기·투명(없으면 경고만) |

## 한 번의 교체 절차 (최종 에셋 도착 후)
1. 파일을 위 DESTINATION 이름 그대로 넣는다(필요하면 `assets/brand/brand.json` 에 색). 설정 파일은 고치지 않는다.
2. `npm run assets:check` — 파일 규격 FAIL 이 0이 될 때까지 파일만 고친다.
3. (최초 1회) `npx expo install expo-splash-screen`.
4. `npx expo prebuild --platform android --clean` → `native_resources`·`app_config` FAIL 이 사라지는지 `npm run assets:check` 재실행. (android/ 는 git 제외 생성물이다. prebuild 전 `local.properties` 의 `sdk.dir=C:\Android\Sdk` 를 다시 확인 — MASTER_SOURCE ASCII 경로 절차)
5. release 빌드 → 실기기에서 런처 아이콘·테마 아이콘·스플래시 확인 → 같은 빌드로 스토어 스크린샷 캡처 → `npm run assets:check` 전부 PASS.

## 템플릿 판정 근거
- 원본 템플릿 6개 해시(`templateFingerprints`): assets/icon.png · splash-icon.png · favicon.png · android-icon-foreground/background/monochrome.png — 직접 열어 템플릿 그림(파란 'A' 격자·동심원 격자)임을 확인.
- 네이티브 30개 해시(`nativeTemplateFingerprints`): 현재 android/res 의 splashscreen_logo 5개(동심원 격자 확인) + ic_launcher* 25개.
- 템플릿 파일은 설정이 가리키지 않으면 앱에 들어가지 않는다(Metro 는 require 한 파일만 묶음). 교체 뒤 `assets/*.png` 템플릿 원본은 지워도 되지만, 이번 라운드에서는 지우지 않았다(현재 폴백).

---

# UI 8자리 — 최신 코드 대조 (45.13차, 2026-09-21)

새 에셋을 만들지 않았다. 이 표는 **기존 8자리(`src/design/asset-slots.ts`)를 지금 코드와 대조한 것**이다(중복 기획서를 만들지 않으려고 기존 문서에 이어 적는다).
`코드 확인`은 소스와 자동 검사(`scripts/asset-contract-test.cjs`)로 본 것이고, **실제 화면에서 본 것은 아직 없다**(기기 없음 — `docs/MANUAL_QA.md` 45.13 검수표에서 확인한다).

| 자리 | 화면 · 컴포넌트(코드 확인) | 크기 / 비율 | 형식 · 바탕 | 지금 들어 있는 그림 |
|---|---|---|---|---|
| `homeHeroArtwork` | 홈 창작 표면 오른쪽 위 — `App.tsx:636` `<AssetSlot size={폭<380 ? 96 : 112}>` | 1:1 · 96 또는 112dp | PNG · 투명 | **없음**(자리표시 도형) |
| `homeEmptyArtwork` | 홈 '최근 작업'이 비었을 때 — `App.tsx:648` `<AssetSlot size={120}>` | 4:3 · 120×90dp | PNG · 투명 | **없음** |
| `noticeArtwork` | 홈 공지 카드 왼쪽 — `App.tsx:655` `<AssetSlot size={44}>` (`HOME_NOTICE.enabled` 일 때만) | 1:1 · 44dp | PNG · 투명 | **없음** |
| `referencePoseThumbnail` | 그리기 › 참고 › 기본 레퍼런스 4열 격자 — `painter.tsx:1142·1175` | 3:4 · 화면폭에 따라 78×104 ~ 91×121dp | PNG · 불투명 썸네일(+ 캔버스용 투명 원본) | **없음**(`BUILTIN_REFERENCES.ready=false`, 관절 인형 자리표시) |
| `expressionGuideArtwork` | 홈 › 표현 가이드 카드 윗그림 — `App.tsx:604` `<AssetSlot size={틀×0.8}>` | 1:1 · 110~131dp | PNG · 투명 | **없음**(`EXPRESSION_GUIDE.ready=false`) |
| `motionExampleArtwork` | 그리기 › 움직이기 효과 견본 — `motion-panel.tsx:149` (칸에 그림이 없을 때만) | 1:1 · 48dp 칸 안 41dp | PNG · 투명 | **있음(임시)** `assets/art/mascot-paper.png` |
| `exportSuccessArtwork` | 내보내기 요약, 모든 칸 완성 시 — `App.tsx:959` `<AssetSlot size={84}>` | 1:1 · 84dp | PNG · 투명 | **없음** |
| `proFeatureArtwork` (+`sourceAfter`) | PRO 화면 위쪽 전·후 비교 — `App.tsx:1215·1217` `<Image style={{width:86,height:86}}>` 두 장 | 1:1 · 86dp × 2 | PNG · 투명 | **있음(임시)** `mascot-paper.png` / `mascot-ink.png` |

권장 제작 해상도·안전 영역은 `src/design/asset-slots.ts` 의 각 자리 주석이 원본이다(이 표는 그 값을 옮기지 않는다 — 둘이 다르면 코드가 맞다).

확인한 방법과 한계
- 자리 8개가 **실제로 그 화면에서 소비되는지**는 `npm test` 의 `asset-contract-test` 가 매번 확인한다(그림을 넣으면 그려지고, 없으면 45.2 자리표시가 같은 칸 수·자리로 남는다).
- **아직 못 본 것**: 실제 기기 화면에서의 크기감·잘림·대비. 8자리 모두 `docs/MANUAL_QA.md` 검수표의 화면(홈·참고·표현 가이드·움직이기·내보내기·PRO)에서 함께 확인된다.
- 그림을 넣을 때는 `src/design/asset-slots.ts` 의 `source` 만 `require(...)` 로 바꾼다. 비율이 다른 그림을 넣지 않는다. 레이아웃은 고치지 않는다.
