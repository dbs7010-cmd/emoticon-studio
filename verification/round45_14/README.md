# 45.14 — 내부 검수 APK 빌드 · 에셋 8자리 제작 규격 (2026-09-21)

코드 변경 없음(빌드와 문서만). 45.10~45.13 수정은 그대로다. 도톰·연필·레이어·저장 구조는 건드리지 않았다.

## A. 빌드 전 확인
- **추적 중인 Android 파일 0개** — `git ls-files android` 가 비어 있다(`android/` 는 gitignore 대상, prebuild 산출물). 손으로 고친 네이티브 파일이 저장소에 없다는 뜻이다.
- 지금 `android/` 는 이 프로젝트의 설정 플러그인(`plugins/withReleaseSigning`, `withLaunchBackground`)이 적용된 상태로 이미 생성돼 있었다(`android/app/build.gradle` 에 `emoticonUploadConfigured`·`emoticonAllowDebugRelease` 분기 존재). 패키지·버전도 `app.json` 과 같다.
- 그래서 **prebuild 를 다시 돌리지 않았다.** 내부 검수 설정(`internalReview`)은 prebuild 가 아니라 **빌드 때마다 다시 만들어진다**: `expo-constants` 의 `createExpoConfig` 태스크가 gradle 실행 셸의 환경변수를 읽어 `assets/app.config` 를 새로 굽는다(`node_modules/expo-constants/scripts/get-app-config-android.gradle`, `outputs.upToDateWhen { false }`). 확인도 APK 안의 그 파일로 했다(아래 C).
- 도구 실제 경로 확인: JDK 17.0.18(Temurin) `…AndroidPlayer\OpenJDK` 존재, `C:\Android\Sdk` 존재, `platform-tools\adb.exe` 존재, `C:\gradle-home` · `C:\build-temp` 존재, `android/local.properties` 의 `sdk.dir=C:/Android/Sdk`.
- 내부 검수 환경변수는 **그 빌드 셸 안에서만** 설정했다(전역 환경을 바꾸지 않았다).

## B. 빌드 결과 — 성공
```
BUILD SUCCESSFUL in 2m 59s
618 actionable tasks: 10 executed, 608 up-to-date
```
전체 기록: `verification/round45_14/build-release.log` (850줄).

| 항목 | 값 |
|---|---|
| APK 절대 경로 | `C:\Dev\emoticon-studio\android\app\build\outputs\apk\release\app-release.apk` |
| 소스 커밋 | `0da0556` (Round45.13) |
| 작업 트리 상태 | 추적 파일 변경 없음. 미추적은 이번 라운드 산출물 `verification/round45_14/` 뿐 |
| SOURCE_ID | `dcef986f2ebc8c8fe8385f7ce2836ccf68a635024bdc72b67caf391c26108ed4` (파일 46개) |
| applicationId | `com.emoticonstudio.app` |
| versionName / versionCode | `1.0.0` / `1` |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |
| 지원 ABI | **`arm64-v8a` 하나**(`-PreactNativeArchitectures=arm64-v8a` 로 빌드) |
| 내부 검수 설정 | **적용됨** — APK 안 `assets/app.config` 의 `extra.internalReview = true` |
| 영수증 서버 주소 | 비어 있음(`extra.receiptEndpoint` 없음) → 실제 구매 확인은 불가 |
| JS 번들 | `assets/index.android.bundle` 포함(릴리스 번들, Metro 서버 불필요) |
| 파일 크기 | 38,549,950 바이트 |
| SHA-256 | `a7bfebfe50f4e4d2f6cc92fcca2c92e1cff0285aa191c0d31bca4a06fd114b35` |
| 서명 | `CN=Android Debug` (디버그 키) — **내부 검수용. 스토어 업로드 불가** |

### 이 APK 가 무엇이고 무엇이 아닌가
- **내부 검수 APK**다: `EMOTICON_INTERNAL_REVIEW=1` 로 설정 화면에 '검수용 PRO 켜기' 스위치가 들어 있고, 업로드 키가 없어 `EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE=1` 로 디버그 서명했다.
- **스토어 배포용이 아니다.** 배포용은 환경변수 없이(=internalReview 꺼짐) 업로드 키로 `:app:bundleRelease`(AAB) 를 만든다 — `docs/RELEASE_SIGNING.md`. 디버그 서명 허용값은 AAB 에는 효과가 없다.
- **검수용 PRO 는 기능 확인 통로일 뿐, 실제 구매·복원 검증이 아니다.** 결제·복원은 내부 테스트 트랙 + 라이선스 테스터 + 영수증 서버가 있어야 확인된다(`docs/MANUAL_QA.md` 30차 절).
- **빌드 성공은 앱 실행 PASS 가 아니다.** 이 APK 를 기기에서 실행한 기록은 아직 없다(D 절).

## C. 확인된 설치·실행 명령 (PowerShell)
```powershell
$adb = "C:\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l                                   # 기기가 보이는지 먼저
& $adb install -r "C:\Dev\emoticon-studio\android\app\build\outputs\apk\release\app-release.apk"
& $adb shell am start -n com.emoticonstudio.app/.MainActivity
```
- `install -r` 는 덮어쓰기라 **기존 세트·그림을 지우지 않는다.**
- 기기가 arm64 여야 한다(이 APK 는 `arm64-v8a` 만 들어 있다). armeabi-v7a·x86_64 기기라면 `-PreactNativeArchitectures` 없이 다시 빌드한다.
- 이미 다른 서명의 같은 패키지가 깔려 있으면 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` 이 난다. **그때 앱을 지우지 않는다**(사용자 데이터가 사라진다). 사용자에게 알리고, 어떤 빌드가 깔려 있는지 확인한 뒤 결정한다.
- 이 APK 를 다시 만들려면: `docs/MANUAL_QA.md` 의 '45.13 — 실기기 검수 한 장' 0절 명령 그대로. 이번에는 그중 prebuild 단계를 건너뛰었다(A 절 사유).

## D. 기기 확인
- `adb devices -l` **1회** 실행 — 연결된 기기 없음. 반복 연결·AVD 재시도 없음, 관리자 설정·재부팅 없음.
- 따라서 설치·3칸 제작·저장·재열기·내보내기 검수는 **수행하지 못했다**. APK 는 준비됐고 절차는 `docs/MANUAL_QA.md` 45.13 절에 있다.

## E. 에셋 8자리 제작 규격
`verification/round45_14/ASSET_SPEC.md` — 자리마다 화면·역할·표시 크기(반응형 규칙 포함)·권장 원본·비율·형식·투명 여부·맞춤 방식과 잘릴 수 있는 영역·앱이 따로 그리는 글자·현재 그림 유무·우선순위를 적었다.
요점 세 가지:
1. 8자리 중 6자리는 `contain` 이라 잘리지 않는다. **`referencePoseThumbnail` 만 `cover` 라 3:4 가 아니면 잘린다.**
2. `expressionGuideArtwork`(카드 20장)와 `referencePoseThumbnail`(격자 칸 전부)은 **코드가 자리 하나를 모든 칸에 쓴다.** 카드별·자세별 그림을 쓰려면 화면 연결이 더 필요하다(**미확정**).
3. 지금 들어 있는 그림 두 장은 임시이고 자리 비율과도 맞지 않는다: `mascot-paper.png` 276×306, `mascot-ink.png` 103×132. **공식 캐릭터로 확정된 것이 아니다.**

## F. 남은 차단
- 실기기 없음(위 D). 이 APK 로 무엇을 확인할지는 `docs/MANUAL_QA.md` 45.13 검수표.
- 스토어 배포용 빌드는 업로드 키·영수증 서버가 있어야 한다(`docs/RELEASE_SIGNING.md`) — 이번 범위 밖.
- 출시를 막는 P0 에셋은 이 8자리가 아니라 브랜드·스토어 에셋이다(`npm run assets:check`).
