# 35차 — ASSET PIPELINE PREPARATION (2026-09-14)

판정: **PASS(준비 범위)** — 최종 에셋이 오면 파일만 넣고 한 절차로 적용할 수 있다. **출시 에셋 검사는 의도대로 FAIL**(템플릿 잔존).
이미지 생성·수정 없음. Painter·31~34차 UI 불변.

## 조사 근거
- `assets/*.png` 6개: SHA-256·크기·색 형식 판독, icon.png·splash-icon.png·android-icon-foreground.png 를 직접 열어 Expo 템플릿 그림 확인.
- `android/app/src/main/res`: splashscreen_logo 5개(xxxhdpi 직접 확인 — 템플릿 동심원 격자) + ic_launcher* 25개 해시. `styles.xml` `Theme.App.SplashScreen` → `@drawable/splashscreen_logo`, `colors.xml` splashscreen_background `#FFFFFF`, MainActivity 에 splash 자리 주석. `android/` 는 `.gitignore`(prebuild 생성물).
- `expo-splash-screen`: 미설치, `bundledNativeModules` `~57.0.9`. Expo SDK 57 문서: 설정 플러그인 `expo-splash-screen`(image·imageWidth(기본 100)·resizeMode·backgroundColor·dark·android·ios), 네이티브 재빌드 필요, Expo Go·개발 빌드는 실제 모습 재현 불가. 아이콘 문서: iOS 1024×1024 투명 불가, Android adaptiveIcon foreground/background/monochrome, 스플래시 1024×1024 투명 PNG 권장.
- Google Play 도움말: 아이콘 512×512 32-bit PNG ≤1024KB, 피처 그래픽 1024×500 JPEG/24-bit PNG(알파 없음), 스크린샷 JPEG/24-bit PNG(알파 없음) 변 320~3840·긴 변 ≤ 짧은 변×2, 홍보 권장 1080×1920.

## 결과
- `npx expo config --type public`: icon `./assets/icon.png`(폴백), adaptiveIcon 템플릿 3종(폴백), plugins 기존 4개(스플래시 미추가), internalReview false.
- `node scripts/asset-check-test.cjs` PASS · `npm test` 14 PASS · typecheck PASS.
- `npm run assets:check` → exit 1, FAIL 10 · WARN 1 (`asset-check.txt`, `asset-check.json`).
