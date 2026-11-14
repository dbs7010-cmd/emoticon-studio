# 36차 — ANDROID RELEASE SIGNING / AAB PREPARATION (2026-09-14)

판정: **PASS(준비 범위) / RELEASE BLOCKED(외부)** — 서명 구조·가드·출시 검사·AAB 생성 경로 완료. 실제 업로드 키·영수증 서버·브랜드 에셋이 없어 출시 검사는 의도대로 exit 1.
Painter·UI·Export·결제 로직 변경 없음. Play Console 업로드·결제 없음. 비밀 값 커밋 없음.

## 사실 확인(추측 없음)
- 변경 전 `android/app/build.gradle`: `buildTypes.release { signingConfig signingConfigs.debug }`, signingConfigs 는 debug 만. `android/gradle.properties` 서명 값 없음. `C:\gradle-home\gradle.properties` 에 `EMOTICON` 없음.
- 기존 release APK(30차) apksigner: `CN=Android Debug`, SHA-256 `fac61745…3b9c` = `android/app/debug.keystore`.
- `app.json` 에 versionCode 없음 → prebuild 기본 1. `eas.json` production `autoIncrement: true`, EAS CLI 미설치.
- 저장소(추적·미추적)에 키 파일 없음.
- 새 prebuild(스크래치 복사본)와 현재 `android/`(9-12 생성)가 다름: Gradle `=` 표기, expo-iap 플러그인의 `missingDimensionStrategy "platform","play"`·앱 수준 `openiap-google:3.5.1`. expo-iap 모듈 gradle 이 `implementation "io.github.hyochan.openiap:openiap-google"` 직접 선언 → 결제 라이브러리는 포함됨.

## 결과 근거
| 확인 | 결과 |
|---|---|
| 플러그인 실제 prebuild(스크래치 복사본, node_modules 연결) | `√ Finished prebuild`, 마커·release 줄 적용 |
| `scripts/apply-release-signing.cjs` 두 번 | 적용 → "이미 적용돼 있어요"(반복 안전) |
| 가드: 키 없이 `:app:bundleRelease --dry-run` | FAIL "Release signing is not configured… never signed with the debug key" |
| 가드: 키 파일 경로가 깨진 상태(한글 경로) | FAIL "Upload keystore file not found" (9s) |
| 임시 키로 `:app:bundleRelease` | BUILD SUCCESSFUL 55s, `app-release.aab` 59,617,231 bytes |
| keytool `-printcert -jarfile` | Owner `CN=DRY RUN NOT FOR PLAY`, SHA-256 `76:11:41:88…A7:F8` (release-check 순수 Node 판독과 일치) |
| jarsigner `-verify` | `jar verified.` + 경고 "Entry … signed in JarFile but is not signed in JarInputStream"(res/color 2개) |
| 빌드 로그 비밀번호 문자열 | 없음 |
| `release-check` | exit 1 — `release-check.txt` |
| `assets:check` | exit 1, FAIL 10 · WARN 1 — `asset-check.txt` |
| typecheck · `npm test` | PASS · 15 PASS — `tests.log` |

## release-check 상세
- CONFIG FAIL: receipt_endpoint [EXTERNAL] 만 FAIL. internal_review_off·application_id·version_code(1 > 0)·version_name·native_version_sync PASS.
- SIGNING FAIL: release_signing_structure PASS · no_project_properties_secret PASS · no_secrets_in_repo PASS · signing_inputs FAIL [EXTERNAL, 실제 업로드 키 없음] · signing_certificate FAIL(검증용 임시 키 — 의도대로).
- ARTIFACT FAIL: app_bundle·application_id_in_bundle·billing_permission·release_js_bundle(2,114,808 bytes)·expo_iap_native·bundle_internal_review_off PASS · bundle_receipt_endpoint FAIL [EXTERNAL].
- ASSETS BLOCKED: brand_assets(app_icon, adaptive 3종, splash_icon, play_icon, feature_graphic, phone_screenshots, app_config, native_resources).
- 첫 실행에서 no_secrets_in_repo 가 테스트 파일의 비밀번호 대입 예시 문자열을 잡음(오탐) → 문자열 조립으로 바꾸고 "테스트 파일 자체 통과" 단언 추가, 재실행 PASS.

## 빌드 식별
`build-identity.json` — HEAD `49206d38`, 미커밋 124, SOURCE_ID `54d2fd8f…`, com.emoticonstudio.app, 1.0.0 / 1, release, AAB SHA-256 `5da6aac1c0c858aad96d410836d7ef53b7ef19b3520bf481c8f5078c20039fda`, 인증서 `761141…a7f8`(dry-run), internalReview false, receiptEndpointPresent false. 비밀 값 없음.

## 이 AAB 의 지위
출시 후보 아님: 임시 키 서명 · 오래된 `android/` · 영수증 서버 없음 · 템플릿 에셋. 검증 증거로만 둔다. 임시 키는 `C:\build-temp\r36-dryrun-signing`(저장소 밖, 30일), 비밀번호는 세션 스크래치 파일에만.

## 되돌림 정보
- 변경 전 `android/app/build.gradle` 사본: 세션 스크래치 `build.gradle.before-r36`.
