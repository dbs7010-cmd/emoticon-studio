# Android 출시 서명 · AAB (36차, 2026-09-14)

> 갱신일: 2026-09-27 · 기준 커밋: `503e561` + C1~C7 작업본. 기존 감사 산출물은 당시 기록이며 새 AAB 검증을 대신하지 않습니다.

이 문서는 **절차와 역할**만 적는다. 실제 비밀번호·키 파일·키 별칭 값은 저장소·문서·로그 어디에도 적지 않는다.

## 1. 키 세 종류

| 키 | 누가 만들고 누가 갖나 | 무엇에 쓰나 | 보관 위치 | 잃어버리면 |
|---|---|---|---|---|
| **APP SIGNING KEY** (앱 서명 키) | Play App Signing 이 생성·보관(권장: Google 생성) | 사용자 기기에 설치되는 APK 를 Google 이 서명 | Google 서버. 우리 PC·저장소에 없음 | Google 이 보관하므로 분실 없음 |
| **UPLOAD KEY** (업로드 키) | 개발자가 로컬에서 생성(keytool) | Play Console 에 올리는 AAB 서명. Google 이 이 인증서로 "우리가 올렸다"를 확인 | **저장소 밖**: 개인 PC 의 사용자 폴더 + 오프라인 백업 1곳(암호화 USB 또는 비밀번호 관리자 첨부). 비밀번호는 비밀번호 관리자 | Play Console 에서 업로드 키 재설정 요청(앱 서명 키는 영향 없음) |
| **DEBUG KEY** (디버그 키) | Expo/RN 템플릿(`android/app/debug.keystore`, 공개 비밀번호 `android`) | 개발 빌드·내부 검수 APK | `android/`(prebuild 생성물, git 제외) | 의미 없음(공개 키) |

- 디버그 키 인증서 SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` → `release/nonrelease-certificates.json`. 이 지문의 AAB 는 출시 검사가 FAIL.
- 36차 검증용 임시 키(`CN=DRY RUN NOT FOR PLAY`, 30일): SHA-256 `761141881af40e1622e5d0c6411451aa7814868d753614aaeedaa4f0c5b1a7f8` — 저장소 밖(`C:\build-temp\r36-dryrun-signing`)에만 있고 Play 에 등록하지 않는다. 같은 파일에 non-release 로 등록.

## 2. 저장소에 들어간 것 / 들어가면 안 되는 것

들어간 것(값 없음):
- `plugins/withReleaseSigning.js` — prebuild 때 `app/build.gradle` 을 바꾼다. release 는 업로드 키만, `bundle*Release` 는 업로드 키가 없으면 **빌드 시작 전에 멈춤**, 키 파일 없음·값 누락도 멈춤.
- `scripts/apply-release-signing.cjs` — 이미 생성된 `android/` 에 같은 변환 적용(`npm run release:apply-signing`).
- `scripts/release-check.cjs` — 출시 검사(`npm run release:check -- --aab <path> --identity <out.json>`).
- `release/upload-signing.example.properties` — 자리표시자만.
- `release/version-history.json` — Play 에 실제로 올린 versionCode 기록.
- `release/nonrelease-certificates.json` — 올리면 안 되는 인증서 지문(공개 값).

금지(출시 검사 `no_secrets_in_repo` / `no_project_properties_secret` 가 잡는다):
- `*.jks` `*.keystore` `*.p12` `*.pfx` 를 저장소에 두기(`.gitignore` 에도 추가됨)
- `android/gradle.properties` 에 `EMOTICON_UPLOAD_*` 넣기
- 문서·스크립트에 비밀번호 값 적기, 빌드 로그에 출력하기(Gradle 스크립트는 값을 출력하지 않는다. 36차 빌드 로그에 비밀번호 문자열 없음 확인)

## 3. 업로드 키 입력 방법 (로컬 전용)

값은 아래 둘 중 하나로만 넣는다.

1. 사용자 Gradle 설정: `%GRADLE_USER_HOME%\gradle.properties`(이 PC 는 `C:\gradle-home\gradle.properties`, 없으면 `%USERPROFILE%\.gradle\gradle.properties`)에 `release/upload-signing.example.properties` 의 네 줄을 실제 값으로.
2. 빌드하는 셸의 환경변수(같은 이름).

주의: 키 파일 경로는 **ASCII 경로**로 둔다. 36차 첫 시도에서 한글 사용자 폴더 경로가 깨져 `Upload keystore file not found` 로 멈췄다(가드가 제대로 막음).

업로드 키 생성(한 번, 사람이 로컬에서, 비밀번호는 프롬프트로 입력):
```
keytool -genkeypair -v -storetype PKCS12 -keystore <ASCII 경로>\emoticon-upload.jks -alias <별칭> -keyalg RSA -keysize 2048 -validity 10000
keytool -list -v -keystore <ASCII 경로>\emoticon-upload.jks   # SHA-256 확인 → EMOTICON_UPLOAD_CERT_SHA256 에 공개 지문만 기록
```

## 4. 출시 빌드 경로 — 기본: 로컬 Gradle

선택: **로컬 Gradle `:app:bundleRelease`**. 이유: 이 PC 에서 이미 release 빌드가 재현됐고(27·30차), EAS CLI 미설치·EAS 계정/자격 증명 미확인, 결과 파일을 곧바로 출시 검사할 수 있다. EAS(`eas.json` production `autoIncrement`)는 보조 경로로만 남긴다 — 쓰려면 versionCode 원천을 EAS 원격으로 옮기는 결정이 따로 필요(§6과 충돌).

순서:
1. `app.json` `expo.android.versionCode` 를 올린다(§6).
2. `npx expo prebuild --platform android --clean` — 서명 플러그인·expo-iap 플러그인이 네이티브 프로젝트에 다시 반영된다. (36차 확인: 현재 `android/`(9-12 생성)는 새 prebuild 결과와 다르다 — Gradle 표기(`=`), expo-iap 플러그인의 `missingDimensionStrategy "platform","play"`·앱 수준 `openiap-google:3.5.1` 줄이 없다. expo-iap 모듈이 `implementation "io.github.hyochan.openiap:openiap-google"` 을 직접 선언하므로 결제 라이브러리는 여전히 들어가지만, 출시 AAB 는 반드시 clean prebuild 결과로 만든다. 36차 dry run AAB 는 이 오래된 `android/` 로 만든 것이라 출시 후보가 아니다.)
3. 빌드 셸: `EMOTICON_INTERNAL_REVIEW` 없음, `EMOTICON_RECEIPT_ENDPOINT=https://…`(배포된 영수증 서버), 업로드 키 네 값(§3), ASCII 빌드 환경(`GRADLE_USER_HOME=C:\gradle-home`, `TEMP=C:\build-temp`, `ANDROID_HOME=C:\Android\Sdk`, JDK).
4. `C:\Dev\emoticon-studio\android\gradlew.bat :app:bundleRelease`
5. 결과: `android/app/build/outputs/bundle/release/app-release.aab`
6. `EMOTICON_UPLOAD_CERT_SHA256=<업로드 인증서 지문> npm run release:check -- --aab android/app/build/outputs/bundle/release/app-release.aab --identity verification/<회차>/build-identity.json`
7. 종료 코드 0 일 때만 Play Console 에 올린다. 2(에셋만 BLOCKED)·1 이면 올리지 않는다.
8. 올린 뒤 `release/version-history.json` `released` 에 `{versionCode, versionName, uploadedAt, track, aabSha256}` 추가.

내부 검수 APK(`assembleRelease` + `EMOTICON_INTERNAL_REVIEW=1`)는 업로드 키 없이 만들려면 `EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE=1` 을 명시해야 한다. 이 값은 AAB 에는 효과가 없다.

## 5. 출시 검사가 FAIL 로 막는 것

| 갈래 | 항목 | FAIL 조건 |
|---|---|---|
| CONFIG | internal_review_off | `extra.internalReview === true` |
| CONFIG | receipt_endpoint | 정상 출시에서 https 서버 주소 없음은 FAIL. 명시적 purchases=closed 구성의 미설정만 WARN |
| CONFIG/ARTIFACT | privacy_url · support_email (bundle_ 포함) | 유효한 개인정보 https URL·문의 이메일 없음은 FAIL [OWNER] |
| ARTIFACT | bundle_purchases · bundle_purchases_match · no_overlay_permission | 구매 구성 오류·설정/AAB 불일치·오버레이 권한 잔존은 FAIL |
| CONFIG | application_id | `com.emoticonstudio.app` 아님 |
| CONFIG | version_code | 정수 아님 · 없음 · `version-history` 최대값 이하 |
| CONFIG | version_name / native_version_sync | x.y.z 아님 · `android/` 버전이 설정과 다름 |
| SIGNING | release_signing_structure | 플러그인 미적용 · release 가 디버그 키 · 가드 없음 |
| SIGNING | signing_inputs | 업로드 키 설정 이름 누락 (값은 읽지 않음) |
| SIGNING | no_project_properties_secret / no_secrets_in_repo | 저장소에 키 파일·비밀번호 값 |
| SIGNING | signing_certificate | 디버그 키 · 검증용 임시 키 · 등록 업로드 지문과 다름 · 대조 지문 없음 |
| ARTIFACT | app_bundle · application_id_in_bundle · billing_permission · release_js_bundle · expo_iap_native · bundle_internal_review_off · bundle_receipt_endpoint | AAB 안에서 직접 판독 |
| ASSETS | brand_assets | `assets:check` FAIL → **BLOCKED**(서명과 분리 표시, 종료 코드 2) |

## 6. 버전 규칙

- **versionCode 는 수동 증가.** 원천은 `app.json` `expo.android.versionCode`(36차에 1 로 명시). prebuild 가 `android/app/build.gradle` 에 옮긴다. EAS `autoIncrement` 는 로컬 경로에서 쓰지 않는다.
- Play 에 한 번이라도 올린 versionCode 는 다시 쓸 수 없다 → 올린 직후 `release/version-history.json` 에 기록, 출시 검사가 "기록 최대값보다 커야 함"을 강제.
- 검증용·내부 빌드는 기록하지 않는다(올리지 않았으므로).
- versionName(`expo.version`)은 사용자에게 보이는 x.y.z. 기능 출시마다 사람이 정한다.

## 7. Play Console 준비 목록 (업로드하지 않음)

| 항목 | 저장소에서 된 것 | 남은 것 |
|---|---|---|
| Play App Signing | 역할 정리(§1) | 앱 생성 시 Google 생성 앱 서명 키 선택 — EXTERNAL |
| 업로드 키 | 입력 구조·가드·검사 | 실제 업로드 키 생성·백업, 첫 AAB 업로드로 등록 — EXTERNAL |
| applicationId | `com.emoticonstudio.app` 고정·검사 | Play 에서 패키지 이름 선점(첫 업로드 시 영구) — EXTERNAL |
| versionCode 증가 규칙 | §6 + 검사 | — |
| 상품 `pro_lifetime` | 앱 코드·영수증 서버 코드(30차) | 비소모성 일회성 상품 생성, 가격 — EXTERNAL |
| 라이선스 테스터 | — | 테스터 계정 등록, 내부 테스트 트랙 — EXTERNAL |
| 영수증 서버 | `server/verify-receipt.js` | 배포 + 서비스 계정 권한(Play Developer API) + https 주소 — EXTERNAL |
| 개인정보처리방침 URL | `docs/legal.md` 초안 | 공개 URL 게시 — EXTERNAL |
| 스토어 등록정보 에셋 | 35차 명세·검사 | 아이콘 512·피처 그래픽·스크린샷 실물 — EXTERNAL(ASSET) |
| 콘텐츠 선언 | — | 콘텐츠 등급 설문, 데이터 보안 양식, 광고 여부, 대상 연령 — EXTERNAL |

## 8. 무료 기능 비공개 테스트 구성 (45.40)
`EMOTICON_PURCHASES=closed`를 prebuild와 번들 생성 양쪽에 명시합니다. 값 누락은 정상 출시이며 서버 검증 요건을 그대로 적용합니다. 잘못된 값은 구성 오류로 중단합니다. `EMOTICON_INTERNAL_REVIEW=1`과 함께 사용할 수 없습니다.
`EMOTICON_PRIVACY_URL`(https)·`EMOTICON_SUPPORT_EMAIL`은 실제 운영자 값으로 주입합니다. 미설정은 모든 외부 배포에서 FAIL [OWNER]입니다.
이 구성만 영수증 서버 주소 누락을 WARN으로 처리합니다. AAB 내부 app.config에서도 동일하게 판독하며, 서명·BILLING·네이티브 결제 모듈·PRO 검수 우회 차단 검사는 유지합니다. 검사는 `--track` 인자로 예외를 켜지 않고 실제 설정/AAB 값을 사용합니다.
이번 회차는 APK·AAB를 만들지 않습니다. 최종 업로드 키 확보 후 새 AAB에서 서명·권한·실제 Play 동작을 검증합니다. 임시 키를 출시용으로 쓰지 않습니다.

예전 구독 `pro_monthly` / `pro_yearly`는 팔지 않지만 복원에서 알아봅니다.
