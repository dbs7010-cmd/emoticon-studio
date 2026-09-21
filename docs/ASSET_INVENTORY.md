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

---

# 45.15 보완 — 누락 목록과 제작 단위 (2026-09-21)

기존 결정을 바꾸지 않았다. 아래는 **지금 코드에서 뽑은 목록**과 **하나의 원본에서 파생되는 파일 묶음**이다.
숫자 정정: 기본 레퍼런스 분류는 **4개**다 — `포즈 · 표정 · 손동작 · 소품·효과`. 네 번째 이름 안에 가운뎃점이 들어 있어 다섯 개로 읽히던 것을 바로잡는다(`BUILTIN_REFERENCES.categories.length === 4`).

## A. 브랜드·스토어 — 원본 5개에서 파생 (FAIL 10건 ≠ 그림 10장)

| 만들 원본 | 파생 파일(경로) | 크기·형식·투명 | 연결할 설정 | 기존 확정 디자인 |
|---|---|---|---|---|
| **① 마스코트 마크**(정사각 심볼 1장) | `assets/brand/app-icon.png` | 1024×1024 PNG · **알파 채널 없음** | `expo.icon`(파일만 넣으면 app.config.js 가 연결) | 없음 |
| | `assets/brand/adaptive-foreground.png` | 1024×1024 PNG · **투명 필요**, 중요한 모양은 가운데 지름 약 66%(≈672px) 원 안 | `android.adaptiveIcon.foregroundImage` | 없음 |
| | `assets/brand/splash-icon.png` | 1024×1024 PNG · 투명 필요 | `expo-splash-screen` 플러그인(모듈 설치 + 파일이 둘 다 있을 때 자동) | 없음 |
| | `assets/store/play-icon-512.png` | 512×512 PNG · 알파 허용 · **1MB 이하** | 없음(Play Console 업로드) | 없음 |
| **② 한 색 실루엣**(①에서 따되 단색으로 다시 그림) | `assets/brand/adaptive-monochrome.png` | 1024×1024 PNG · 투명 필요 | `android.adaptiveIcon.monochromeImage` | 없음 |
| **③ 아이콘 뒷면**(그림 대신 **색 하나로 끝낼 수 있다**) | `assets/brand/adaptive-background.png` | 1024×1024 PNG · **투명 픽셀 없음** | `android.adaptiveIcon.backgroundImage`, 색만 쓰면 `assets/brand/brand.json` 의 `adaptiveBackgroundColor` | `app.json` 에 `backgroundColor: #F7F4EE` 가 이미 있다 |
| **④ 피처 그래픽**(가로 배너 한 장) | `assets/store/feature-graphic.png`(또는 `.jpg`) | 1024×500 PNG(24-bit)/JPEG · **알파 없음** | 없음(Play Console 업로드) | 없음 |
| **⑤ 실기기 스크린샷**(그림이 아니라 캡처) | `assets/store/screenshots/phone-01.png` … `phone-08` | 2~8장 · PNG/JPEG · 알파 없음 · 변 320~3840 · 긴 변 ≤ 짧은 변×2 · 1080×1920 권장 | 없음(Play Console 업로드) | 없음 — **사용자 기기 설치 뒤에만 가능** |
| (선택) 브러시 견본 | `assets/brush/preset-{ink,soft,grain,marker}.png` | 300×84 PNG · 투명 | 아직 코드 연결 없음(Painter FREEZE) | 없음 · WARN P2 |

### 프로젝트 자체 기준 vs 스토어 필수 요건
- **Google Play 가 요구하는 것**(외부): 스토어 아이콘 512×512 32-bit PNG ≤1MB · 피처 그래픽 1024×500(JPEG/24-bit PNG, 알파 없음) · 휴대폰 스크린샷 2장 이상. (근거는 `assets/asset-contract.json` 각 항목의 `use` 에 적힌 원문 요약)
- **Android 플랫폼이 요구하는 것**: 앱 아이콘 · 적응형 아이콘 앞면. 뒷면은 **색만으로도 된다**. 테마 아이콘(monochrome)은 Android 13+ 의 선택 기능이다.
- **이 프로젝트의 자체 기준**: 위에 더해 monochrome 과 adaptive_background **파일**을 요구하고, 템플릿 이미지가 남아 있으면 FAIL 로 잡고(`app_config`), `android/` 의 템플릿 리소스 30개를 FAIL 로 센다(`native_resources`). 즉 **검사기가 P0 라고 해서 전부 스토어 필수는 아니다.**
- 검사기의 나머지 두 FAIL 은 그림이 아니라 **그림을 넣은 뒤 하는 작업**이다: `npx expo install expo-splash-screen` · `npx expo prebuild --platform android --clean`. **45.15 에서는 실행하지 않았다.**

## B. 표현 가이드 20장 — 목록은 이미 코드에 있다
`EXPRESSION_GUIDE.cards`(분류 5 × 4장). 카드에는 `category · name · hint` 만 있고 **id 필드도 그림 필드도 없다**(화면은 `name` 을 key 로 쓴다). 그림을 카드마다 다르게 하려면 카드 데이터에 그림을 달고 화면이 그것을 읽게 해야 한다 — **지금 코드에는 없다(미정)**.
그림 내용은 **이름 + 기존 힌트 그대로** 옮긴다. 표정 세부·소품·색처럼 원자료에 없는 것은 **미정**으로 둔다. 전체 20행은 `verification/round45_15/README.md` 의 표와 같다.

## C. 기본 레퍼런스 32칸 — 목록이 아직 없다
`BUILTIN_REFERENCES`: 분류 4 × `placeholderCount` 8 = **32칸**, 4열 격자. **칸마다의 이름·내용이 코드에 없다** — 화면이 읽어 주는 이름도 `"<분류> 기본 레퍼런스 <번호>"` 로 그때 만들어진다. 따라서 32칸의 **내용(어떤 자세·표정·손동작·소품인지)은 전부 미정**이고, 목록을 정하는 일이 그림 제작보다 먼저다.
파일은 칸마다 두 벌이다.
- **썸네일**: 3:4, 격자 칸(360dp 화면 78×104dp)에 `cover` 로 들어간다 → **3:4 가 아니면 가장자리가 잘린다.** 권장 192×255, 불투명 바탕 허용.
- **캔버스용 원본**: 같은 그림의 큰 투명 PNG(권장 1080×1440, 같은 3:4). 캔버스(360×360)에서는 비율을 지켜 가운데로 맞춰 들어가고(`loadLayer` 가 `min(W/w, H/h)` 로 축소), 사용자가 위치·크기·진하기(기본 30%)를 조절한다.
- 둘은 **같은 그림의 두 용도**다. 비율이 다르면 격자에서 본 것과 캔버스에 깔리는 것이 어긋난다.

## D. PRO 전·후 비교 — 정지 교체안은 후보로 유지
45.15 조사에서 정지 그림 두 장 교체를 후보로 두되 **확정하지 않는다.** 실제 움직임으로 보여 주는 최소안(기존 `MotionSample` 재사용 · 그림 2장 · 컴포넌트 두 곳 수정)은 `verification/round45_15/README.md` E 절에 적었다. **이번 라운드에서는 구현하지 않았다.**

---

# 45.16 — 표현 가이드 카드별 이미지 연결 계약 (2026-09-21, Codex)

45.15의 “ID·그림 필드 없음 / 공유 자리 한 장”은 당시 조사 기록으로 보존하며, 아래 계약으로 **SUPERSEDED** 됐다. 그림 자체는 만들거나 넣지 않았다.

## CURRENT — 납품 위치와 파일명
- 위치: `assets/expression-guides/`
- 파일명: `<카드 id>.png` — 소문자 영문·숫자·하이픈만 사용한다. 예: `greeting-hello.png`.
- 규격: **1:1 · 투명 PNG · 글자 없음**, 마스터 1024×1024px, 기본 납품 권장 360×360px. 화면에서는 약 110~131dp, `contain`으로 표시한다.
- 연결: `src/design/asset-slots.ts`의 해당 `EXPRESSION_GUIDE.cards` 항목에 선택 필드 `artwork`를 추가한다. **파일이 실제로 존재한 뒤에만** 정적 `require('../../assets/expression-guides/<id>.png')`를 넣는다.
- 예: `greeting-hello.png`를 받은 뒤 `greeting-hello` 카드에 `artwork: require('../../assets/expression-guides/greeting-hello.png')`를 단다. 다른 카드에는 영향을 주지 않는다.

## DONE — 코드 준비 상태
- 기존 20개 카드의 분류·이름·힌트·순서를 유지하고 중복 없는 안정 ID를 부여했다.
- 화면은 카드마다 `artwork` 유무를 판단한다. 있는 카드만 그 이미지를 표시하며, 없는 카드는 기존 따뜻한 준비 중 자리표시를 유지한다.
- 전체 `ready`는 `false` 그대로다. 저장 schema·사용자 데이터에는 필드를 추가하지 않았다.
- 현재 실제 납품 이미지와 `artwork` 연결은 **0개**다. 존재하지 않는 파일을 `require`하지 않았고 임시 이미지를 넣지 않았다.

## NEXT / BLOCKED
- NEXT: 실제 에셋을 위 규칙으로 전달받으면 파일 존재·규격을 확인한 뒤 해당 카드만 연결하고 같은 회귀 검사를 실행한다.
- BLOCKED: 실제 에셋 미전달. 이미지의 캐릭터·색·세부 표현은 공식 확정으로 간주하지 않는다.

---

# 45.17 — 표현 가이드 예시 5종 납품 계약 (2026-09-22, Claude)

45.16 의 카드 그림 계약(`assets/expression-guides/<카드 id>.png`)은 그대로 살아 있다. 이번에는 그 아래 **표현 예시**가 생겼고, **같은 폴더·같은 규격**을 쓴다.

## 왜 예시가 따로 필요한가
표현 가이드는 창작자의 내비게이션이다. 한 감정에서 여러 표정·자세·구도를 보여 주고 자기 캐릭터로 응용하게 한다.
흐름: **감정 선택 → 다양한 표현 보기 → 예시 선택 → ① 참고하며 그리기 / ② 밑그림으로 넣기.**
이번 라운드는 `고마워` 한 감정으로 전체 흐름만 구현했다. 다른 19개 감정과 기본 레퍼런스 32칸은 **건드리지 않았다.**

## CURRENT — 납품 위치와 파일명 (예시 5종)
- 위치: `assets/expression-guides/` — 45.16 카드 그림과 같은 폴더.
- 파일명: `<예시 id>.png`. 예시 id 는 `<카드 id>-<표현 갈래>` 라서 카드 파일과 겹치지 않는다(`greeting-thanks.png` vs `greeting-thanks-polite.png`).
- 규격: **1:1 · 투명 PNG · 글자 없음**, 마스터 1024×1024px, 납품 권장 360×360px.
  - 가이드 화면 예시 줄에서는 74dp `contain`.
  - 참고 창에서는 창 너비(화면폭의 약 46%, 120~190dp) 정사각 `contain`.
  - **밑그림으로 깔릴 때는 같은 파일을 그대로 쓴다.** 캔버스(360×360) 안에 비율을 지켜 가운데로 줄여 들어가고(`min(W/w, H/h)`), 기본 진하기 30% 로 깔린다. 그래서 **투명 바탕이 필수**다(불투명이면 그림을 덮는다).
- 연결: `src/design/asset-slots.ts` 의 `EXPRESSION_GUIDE.cards` 중 `greeting-thanks` 카드의 `examples[]` 항목에 `artwork: require('../../assets/expression-guides/<예시 id>.png')` 를 단다. **파일이 실제로 존재한 뒤에만** 넣는다.

| 예시 ID | 표현 이름 | 힌트(코드에 있는 값) | 납품 파일 |
|---|---|---|---|
| `greeting-thanks-polite` | 정중하게 | 두 손 모으고 깊게 꾸벅 | `assets/expression-guides/greeting-thanks-polite.png` |
| `greeting-thanks-moved` | 감격해서 | 눈물 맺힌 눈으로 선물 꼭 안기 | `assets/expression-guides/greeting-thanks-moved.png` |
| `greeting-thanks-friendly` | 친근하게 | 엄지 척하며 씩 웃기 | `assets/expression-guides/greeting-thanks-friendly.png` |
| `greeting-thanks-grand` | 과장해서 | 바닥까지 큰절하기 | `assets/expression-guides/greeting-thanks-grand.png` |
| `greeting-thanks-shy` | 수줍게 | 시선 피하며 작은 하트 내밀기 | `assets/expression-guides/greeting-thanks-shy.png` |

**미정**: 캐릭터 생김새·색·선 두께(공식 캐릭터 미확정). 이름과 힌트 밖의 세부(소품 모양·시선 방향·배경)는 정해진 바 없다.

## DONE — 코드 준비 상태
- 감정 카드 20개의 이름·힌트·분류·차례는 그대로다. `examples` 를 가진 카드는 `고마워` **하나뿐**이고, 나머지 19개는 누르면 예전처럼 바로 그리기로 간다.
- 그림이 없는 예시는 **'그림 준비 중이에요'** 로 두고 두 버튼(참고·밑그림)을 **아예 그리지 않는다**. 없는 파일을 `require` 하지 않는다. `EXPRESSION_GUIDE.ready` 는 `false` 그대로다.
- 실제 납품 이미지와 `artwork` 연결은 **0개**다. 임시 그림을 채우지 않았다.

## 안내판은 방향 확인용이다
채팅에서 만든 '고마워 5가지' 안내판은 방향을 맞추기 위한 것이다. **안내판 전체를 그대로 넣거나 임의로 잘라 쓰지 않는다.** 개별 에셋은 위 규격대로 따로 만들어 전달한다.

## NEXT / BLOCKED
- NEXT: 위 파일명으로 전달받으면 파일 존재·규격(1:1·투명)을 확인한 뒤 해당 예시만 연결하고 `npm test` 를 다시 돌린다. `ready` 를 일괄로 켜지 않는다.
- BLOCKED: 실제 에셋 미전달. 실기기 화면에서의 크기감·투명도·손맛은 사용자의 APK 설치·캡처 전까지 **미검증**이다.

---

# 45.18 — '고마워' 5종 납품 상태: 시안 연결 (2026-09-22, Claude)

45.17 의 납품 계약(`assets/expression-guides/<예시 id>.png` · 1:1 · 투명 · 글자 없음)은 그대로다. 아래는 **지금 들어와 있는 파일의 실제 상태**다.

## 들어온 것 — 9×9 시트에서 잘라 낸 다섯 장

원본 시트: `verification/round45_18/source-sheet-9x9.webp` (1254×1254 · 투명 · lossy WebP + 별도 알파 · ICC 있음). **요청했던 4096px 이 아니다.** 한 칸은 139px 뿐이다.

| 파일 | 실제 크기 | 형식 | 시트 위치 | 동작 |
|---|---|---|---|---|
| `greeting-thanks-polite.png` | **132×132** | RGBA · 투명 | 1행 5열 | 두 손 모으고 꾸벅 |
| `greeting-thanks-moved.png` | **132×132** | RGBA · 투명 | 1행 6열 | 선물 안고 감격 |
| `greeting-thanks-friendly.png` | **132×132** | RGBA · 투명 | 1행 7열 | 엄지 척 |
| `greeting-thanks-grand.png` | **132×132** | RGBA · 투명 | 1행 8열 | 큰절 |
| `greeting-thanks-shy.png` | **132×132** | RGBA · 투명 | 1행 9열 | 수줍게 하트 |

다섯 장은 같은 틀·같은 배율·같은 바닥선이다. 확대·샤프닝·알파 수정을 하지 않았고, 가장자리 잉크 0(잘림 없음)이다.

## 상태: 시안 — 최종 납품 아님

| | 계약 | 실제 | |
|---|---|---|---|
| 비율 1:1 | 필수 | 132×132 | ✓ |
| 투명 바탕 | 필수 | 투명(원본부터) | ✓ |
| 글자 없음 | 필수 | 없음 | ✓ |
| 납품 권장 | 360×360 | 132×132 | **✗ 37%** |
| 마스터 | 1024×1024 | 132×132 | **✗ 13%** |

- **약 120px 참고 표시**(가이드 줄·참고 창 작은 쪽): 또렷하다. 쓸 수 있다.
- **360px 캔버스 밑그림**: ×2.7 로 늘어나 **눈에 띄게 부드럽다(흐리다).** 따라 그릴 수는 있으나 선명하지 않다.

그래서 **최종 납품 PASS 를 선언하지 않는다.** 화면 연결은 해 두었으므로, 큰 그림이 오면 **같은 이름으로 파일만 갈아 끼우면 된다**(코드 변경 없음).

## 다시 만들 때의 요구

1. **칸당 최소 360×360, 마스터 1024×1024.** 지금 파일을 키우는 것으로는 해결되지 않는다.
2. **9×9 한 장에 몰아 담지 않는다** — 칸당 해상도가 시트의 1/9 이 된다. 낱장이 확실하고, 시트로 받으려면 4096px 이어야 칸당 455px 이 나온다.
3. **무손실 PNG** 로 받는다. 지금 원본은 lossy WebP 라 선 가장자리에 옅은 알파 잔털이 남는다(밝은 바탕에서는 보이지 않는다).
4. **몸 안쪽 흰 채움 여부는 미정.** 지금 그림은 선만 있어 어두운 바탕에서 속이 비친다. 앱의 카드·참고 창은 밝은 바탕이라 지금도 무방하다. 채울지 말지는 정해진 바 없다.

## 손대지 않은 것

시트의 나머지 76칸, 다른 19개 감정의 표현, 기본 레퍼런스 32칸. 공식 캐릭터·브랜드도 그대로 미정이다.
