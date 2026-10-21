# 39차 — FINAL DEVICE QA + RC PREPARATION (2026-09-15) — 기기 없이 할 수 있는 부분

판정(최종): **DEVICE QA PASS (실기기 1대, QA 빌드)** · RC 준비는 **PARTIAL** — 출시 업로드 키 서명 AAB 와 36~37차 BLOCKED 항목(업로드 키·Privacy URL·콘텐츠 등급·그래픽)이 남아 있어 RC 로 부르지 않는다.
(아래 0~7 은 기기 연결 전 작업, 9 가 무선 ADB 실기기 결과)
사용자 결정: 실기기는 나중에 **무선 디버깅(ADB Wireless)** 으로 연결. 그 전까지 기기 없이 가능한 작업을 모두 끝냄.
reset/clean 없음. 저장 형식 불변. 검증 산출물 삭제 없음(APK/AAB 보존 폴더 유지).

## 0. 안전 기록
- HEAD `49206d380f67e8a13d953e39c742cb22347be23f` (feat/painter-flow-v1), 시작 시 변경 134 → 끝 138(새 스크립트 3 + round39 폴더)
- stash 2개 보존, round38_5 tests.log `npm test exit=0` 확인
- version 1.0.0 · versionCode 1 · applicationId com.emoticonstudio.app · internalReview false
- 에뮬레이터 불가 재확인: arm64 AVD 이미지 + x86_64 호스트, `emulator -accel-check` = hypervisor 드라이버 없음(시스템 설정 변경 금지로 켜지 않음)

## 1. 새 네이티브 빌드
- 기존 `android/` 을 새 prebuild 와 비교 → 템플릿 차이뿐. 핵심 파일은 스크래치에 백업 후 `expo prebuild --platform android --clean --no-install`
- 확인: 서명 표식 2 · 실행 테마 창 바탕 `@color/activityBackground` · BILLING · applicationId · versionCode/Name · debug.keystore
- 빌드 중 발견·수정 2건(아래 ISSUES) 후 `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a` 성공(6분)

## 2. BUILD IDENTITY (`build-identity.json` — APK 내부를 직접 판독)
| 항목 | 값 |
|---|---|
| 종류 | **QA 빌드** — 디버그 키 서명 release APK(`EMOTICON_ALLOW_DEBUG_SIGNED_RELEASE=1`), arm64-v8a 전용. RC 아님, Play 업로드 불가 |
| 소스 | HEAD 49206d3 + 작업 트리 변경 138 · SOURCE_ID `0bfdaf60f4e2…afa67`(45 파일) |
| APK | `android/app/build/outputs/apk/release/app-release.apk` · 38,501,702 B · SHA256 `c6e80ecb14e9bcdf896fac44cc25cb428e42947dca87b487775636df36a73d63` |
| 보존본 | `verification/apk-keep/app-39th-qa-release-debugsigned-arm64-c6e80ecb14e9.apk` (해시 동일) |
| manifest(aapt2) | com.emoticonstudio.app · versionCode 1 · versionName 1.0.0 · BILLING 권한 · native-code arm64-v8a |
| 실행 테마(aapt2 resources) | `Theme.App.SplashScreen` windowBackground = `@color/activityBackground` = #F7F4EE (투명 비트맵을 창 바탕으로 쓰지 않음) |
| JS 번들 | Hermes 바이트코드 · 2,113,928 B · SHA256 `e579adef…6ecb` · expo-iap 포함 |
| 번들 app.config | internalReview **false** · receiptEndpoint null · plugins: expo-dev-client, expo-sharing, expo-iap, expo-image-picker, withLaunchBackground, withReleaseSigning |
| 서명(apksigner) | CN=Android Debug (SHA-256 fac61745…3b9c) — QA 용 확인 |

## 3. ISSUES FOUND AND SELF-FIXED
| # | 등급 | 내용 | 수정 | 검증 |
|---|---|---|---|---|
| 1 | P1(빌드 차단) | 36차 서명 가드가 `bundle*Release` 이름을 AAB 로 판정 → 라이브러리 모듈의 `bundleLibRuntimeToJarRelease` 때문에 **내부 검수 APK(허용값 켬)까지 막힘**. 36차에는 가드가 실제 작업 그래프에서 허용값과 함께 돌지 않았음 | 앱 모듈 작업만 보고 `bundleRelease`/`signReleaseBundle`/`packageReleaseBundle` 만 AAB 로 판정(플러그인 + android/) | 빌드 성공, release-check-test 에 회귀 3개(라이브러리 작업 무시·앱 bundleRelease 만·AAB 는 허용값으로도 차단) |
| 2 | 빌드 환경 | `android/local.properties` 를 손으로 다시 만들며 `sdk.dir=C\:\Android\Sdk`(역슬래시 1개) → properties 해석에서 `\A` 가 사라져 잘못된 경로(IOException) | `sdk.dir=C:/Android/Sdk` | 빌드 설정 단계 통과 |
| 3 | P1(짧은 화면) | 화면 매트릭스: 360×640 에서 브러시 시트 상한 320dp 가 캔버스를 **83%** 덮음(색 69%, 레이어 54%). 결과를 보며 굵기·색을 고를 수 없음 | 패널 상한을 "캔버스 아래 남는 자리 + 캔버스 절반"으로 한 번 더 제한(`coverRoom`): 브러시·참고 시트, 색·문구·선택 패널, 레이어 줄. 터치 영역·캔버스 크기 불변, 넘치면 패널 안에서 스크롤 | viewport-matrix-test: 15개 화면 모두 ≤ 50% |

## 4. 화면 매트릭스 (`viewport-matrix-test`, `viewport-matrix.json`)
렌더된 스타일 값 + 기기가 줄 레이아웃 크기로 판정. 픽셀 렌더링 아님(그건 실기기).
| 화면 | 캔버스 | 앱 화면 비율 | 브러시 | 색 | 레이어 | 움직이기 겹침 | 키보드 위 남는 자리 |
|---|---|---|---|---|---|---|---|
| 360×640 | 360 | 0.58 | 0.50 | 0.50 | 0.50 | 0.26 | 260 |
| 390×720 | 390 | 0.56 | 0.50 | 0.50 | 0.44 | 0.11 | 308 |
| 390×800 | 390 | 0.50 | 0.50 | 0.50 | 0.33 | 0 | 356 |
| 412×900 | 412 | 0.47 | 0.50 | 0.50 | 0.22 | 0 | 416 |
(전체 15행은 json.) 모든 화면: 캔버스 한 변 ≥ 280dp, 굵기 조절 캔버스 안·폭 40dp, 도구 줄 2줄 안 잘림, 문구 패널이 키보드(화면 40% 가정) 위, 보드 3열·아래 줄 2버튼, 내보내기 결과 격자 칸 ≥ 44dp.

CANVAS AREA JUDGMENT: 390×800 기준 약 50%, 640dp 급 58%. 이번 회차 구조 변경 없음(터치 영역 축소 금지). 패널이 캔버스를 덮는 비율만 줄였다.

## 5. 8~24칸 반복 (`slot-repeat-test`)
실제 App 으로 1~24칸 연속 제작. 칸 2~24 각 칸 누르기 **10 → 10**(늘지 않음), 확인창 0. 연필·굵기·도구 유지, 최근 색 맨 앞 유지, 빈 칸마다 이전 그림 제안, 직전 움직임 행 매번 표시, 24칸 모두 완성·문구(작업 파일)·움직임 저장, 3칸 다시 열면 문구·움직임 그대로·이어받기 제안 없음.

## 6. 실기기 러너
- 새 `scripts/device-qa.cjs`(adb 만 사용, 추가 설치 없음): `--pair HOST:PORT CODE` / `--connect HOST:PORT` / `--run` / `--dry`
  - 설치 → 설치 버전 확인 → **시작 배경**(강제 종료 콜드 스타트 3회 × 캡처 6장 + 백그라운드 복귀, PNG 어두운 화소 비율) → 홈 → 새 세트 캔버스 도구 라벨 → 선 긋기 → 브러시 다시 누르기 시트 → 굵기 끌기 → 색·최근 색 → 지우개 같은 조작·시트 없음 → 되돌리기/다시 → 참고·레이어 → 문구(키보드 완료 → 선택 상태) → 움직이기 효과 3종 캡처 → 완성·다음 → 이전 칸 시작 + 직전 움직임 → 보드 → 내보내기 → logcat 치명 오류
  - 단계마다 ok/fail·스크린샷·`report.json`. **아직 기기에서 한 번도 돌지 않음.**
- `--dry`: 러너 라벨 53개가 현재 소스에 있는지 대조 → npm test 에 포함(라벨이 낡으면 기기 전에 실패)
- `scripts/android-inspect.cjs`(BrowserStack) 라벨도 38.5차 UI 로 갱신(저장 → 완성 후 다음, 제출 준비 → 내보내기 등)

## 7. TEST RESULTS
- `npm test` exit 0 (`tests.log`): typecheck + 기존 16 + viewport-matrix + slot-repeat + device-qa 라벨 검사
- brush/color **engine** 테스트는 playwright 미설치로 npm test 밖(이전과 동일)

## 8. 실기기에서만 남은 것 (WIRELESS ADB 연결 후 AI 가 직접 수행)
시작 검은 화면(콜드·강제 종료·복귀) 실측 · 실제 픽셀 레이아웃(640/720/800/900+ 는 기기 해상도가 정함) · 굵기 조절 손가락 감각 · 문구 끌기/손잡이/두 손가락(adb input 으로는 두 손가락 불가 → 사람 감각 항목) · 움직임 견본 부드러움 · 키보드 실제 높이 · 보드·내보내기 실제 공유 시트 · logcat

## 9. 실기기 결과 — 무선 ADB (2026-09-15 05:16~05:52)
- 기기: Samsung Galaxy S24 Ultra SM-S928N · Android 16 (SDK 36) · 1080×2340 · 450dpi(≈384×832dp) · 글꼴 1.0 · 보조 사용자(user 150) 있음 → 설치·실행은 `--user 0`
- 연결: `adb mdns services` 로 페어링·연결 포트 자동 발견 → 첫 코드는 팝업이 닫혀 실패(페어링 서비스 사라짐 확인) → 두 번째 코드로 `adb pair` 성공 · `adb connect` 성공. USB 없음.
- 설치 전 앱 없음(데이터 위험 없음). 수정 APK 재설치(-r) 뒤 기존 세트 2개 그대로 유지 → **업데이트 데이터 호환 확인**.

| 빌드 | 러너 | 결과 |
|---|---|---|
| QA1 `c6e80ecb14e9` | run1(원 러너) | 16/19 — 실패 3개는 러너 문제(움직이는 화면 덤프 불가 2, 내보내기 아래 버튼 미스크롤 1) |
| QA1 `c6e80ecb14e9` | run2(러너 수정) | 18/19 — 움직이기 1개 실패 → 추적하니 **실제 결함** 발견 |
| **QA2 `e498dc36e01d`**(결함 수정) | run3 | **20/20 ok**, logcat 치명 오류 0 |

| 항목 | 실기기 근거(`device-run2`, `device-run3`) | 판정 |
|---|---|---|
| STARTUP | 강제 종료 콜드 스타트 3회 × 캡처 6장 + 홈 복귀 후 재개: 어두운 화소 최대 4.1%(run1 1.2%, run2 2.4%), 검은 프레임 없음 | PASS |
| HOME | 세트 0개: 캐릭터 + 아래 두 버튼. 세트 2개: 카드(실제 칸 4개·진행 막대·이어서 만들기) 두 장, 겹침·잘림 없음 | PASS |
| PAINTER | 도구 5·탭·참고/레이어/문구·되돌리기/다시·완성 · 다음 전부 보임, 선 긋기, 브러시 다시 누르기 → 시트(펜·붓·연필·세부 설정), 지우개 두 번 눌러도 시트 없음·지우개 굵기 조절 | PASS |
| CANVAS SIZE CONTROL | 누른 채 위로 끌기 → 48px 원 미리보기(캔버스 가운데, 손가락 아래 아님), 아래로 → 6px, 떼면 미리보기 사라짐, 손잡이가 손가락을 따라감 | PASS (손맛은 사람) |
| CAPTION | 키보드 완료 → 선택 상태(테두리·손잡이·"문구 내용 고치기/문구 선택 끝"), 글씨 끌기 이동, 손잡이 끌기 확대(캔버스 안), 바깥 누르면 선택 끝·획 없음, 두 번 누르면 편집+키보드 | PASS (두 손가락 크기·회전은 adb 불가 → 사람) |
| MOTION | 통통·흔들기·두근거리기 고르면 캔버스 미리보기가 실제로 움직임(연속 캡처 변화 1.2~1.4%, 없음 0), 속도·세기 표시, 다음 칸에 "직전 칸 움직임 다시 쓰기 · 통통" 표시 | PASS (수정 후) |
| BOARD | 진행 문구·재생·3열 칸(완성/작업 중 표시)·그림 추가·아래 줄 이어서 그리기/내보내기 | PASS |
| EXPORT | 부분 완성 세트: 손볼 곳(남은 칸·같은 그림·겹친 문구·01번 검사), 제안/출시 기준 전환, 멈춤 32개/움직임 24개·WebP 3개 기준, WebPAnimator 안내, 한 번 스크롤 뒤 "파일 묶음 만들기"·"자세히 보기", 화면에 제출 파일/작업 파일/undefined/null/Error/JSON 없음 | PASS |
| LOGS | `logcat *:E` 에 FATAL/AndroidRuntime 없음(3회) | PASS |

### 실기기에서 발견 → 수정 → 재빌드 → 재설치 → 재검증
| # | 등급 | 증상 | 원인 | 수정 | 재검증 |
|---|---|---|---|---|---|
| D1 | **P1** | "움직임 없음"을 고른 뒤 다른 효과를 고르면 카드 견본만 움직이고 **캔버스 미리보기가 멈춘 채** — 효과가 안 먹는 것처럼 보임 | 엔진은 `motion:null` 에서 재생을 멈추고, 앱은 `play` 를 탭 전환 때만 보냄 | `setMotion`: 움직이기 탭에서 효과를 고르면 `play` 도 보냄(`painter.tsx`) | motion-v1-test 회귀(없음→통통 = motion+play, 없음은 play 없음) · npm test PASS · 재빌드 `e498dc36` · 재설치 · 같은 순서 연속 캡처에서 통통2 이동 382→392(수정 전 392 고정) · run3 13단계 ok |
| D2 | 러너 | 움직이는 화면에서 `uiautomator dump` 가 idle 을 못 잡고 **옛 덤프**를 남김 → 없는 버튼으로 오판 | 덤프 실패 무시 + 같은 파일 재사용 | 옛 파일 삭제·ERROR 검사·재시도, 움직이기는 좌표 탭 + 여러 장 캡처 최대 변화 | run3 ok · 원장 FAIL-020 |
| D3 | 러너 | 내보내기 버튼이 화면 아래 | 스크롤 없음 | 찾을 때까지 스와이프(최대 6) + 개발자 문구 검사 | run3 ok |

### BUILD IDENTITY — 최종 QA 빌드
- `verification/apk-keep/app-39th-qa2-motionfix-debugsigned-arm64-e498dc36e01d.apk` · SHA256 `e498dc36e01d74fadf1dece9f95eb57f3bdec7807a20a6f62f16b9fc9c58798f`
- 번들 SHA256 `430e7883…b01b` · internalReview false · 실행 테마 windowBackground `@color/activityBackground` · 서명 CN=Android Debug(QA 전용) · 소스 HEAD 49206d3 + 변경 138 (`build-identity.json`)
- 앞선 QA1 `c6e80ecb14e9…` 도 보존(수정 전 증거)

## P0 / P1 REMAINING
- P0 0 · P1 0 (실기기 1대 + 자동 검사 기준). 발견한 P1 1건(D1)은 수정·재검증 완료.
- P2(보고만): 문구 편집 중 키보드가 올라오면 캔버스가 좁은 띠로 줄어 긴/큰 글씨가 잘려 보임 · 통통 기본 세기가 흔들기·두근거리기보다 눈에 덜 띔(캔버스 360 기준 약 3px 이동).

## ONLY HUMAN APPROVALS (손맛·미감만)
1. 굵기 조절을 엄지로 끌 때 속도감(작은 값 촘촘·큰 값 빠름)
2. 두 손가락으로 글씨 크기·회전(adb 로 두 손가락 입력 불가), 8° 회전 무시 구간
3. 통통 기본 세기가 충분히 "통통"해 보이는지
4. 완성한 칸을 고치면 "작업 중"으로 돌아가는 규칙이 자연스러운지(의도된 동작: 다른 그림에 대한 옛 검사 결과를 버림)
5. 문구 편집 중 캔버스가 좁아지는 것이 거슬리는지
