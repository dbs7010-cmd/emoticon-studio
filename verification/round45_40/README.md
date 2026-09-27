# 45.40 C1~C7 구현·검증 보고

- 작업일: 2026-09-27~28. 최초 HEAD `8723ed8306b42056e612a58b3ec826c26b309769`, 브랜치 `feat/painter-flow-v1`.
- 최초 미커밋 항목: `round45_38/screens-320/`, `round45_38/screens/`, `round45_38/tests.log`, `round45_39/screens-360/`, `round45_39/screens/`의 미추적 자료. 삭제·추가 추적하지 않고 보존했다.
- 중단 중 추가된 운영자 문서 커밋 `c5b2702`, `4b0b669`, `503e561`도 보존했다.
- 구현·검사 커밋: `2bf647f` C6, `6608908` C1, `2b4a16a` C7, `22cad56` C3, `c9b6779` C2/출시 검사 연결, `1c391ea` C4, `e77cdf7` C5, `92e2d2b` 통합 회귀 검사.
- Expo SDK 57 문서 https://docs.expo.dev/versions/v57.0.0/ 를 코드 작성 전에 확인했다. 새 의존성·임시 출시 키를 추가하지 않았다. 브러시 엔진 `src/painter/canvas-html.ts`와 저장 스키마는 변경하지 않았다.

## 항목별 결과

| 항목 | 구현·변경 파일 | 검증 | 미해결·실물 확인 |
|---|---|---|---|
| C1 | `App.tsx`, `src/painter/painter.tsx`: CATALOG의 PRO 브러시, PRESETS/isProPreset의 PRO 움직임에서 이름·개수 생성. 무료 10/6 안내, Jua 제목·보라 PRO 아이콘 | `closed-test-ui-test`: PRO 브러시 이름 정확히 일치·무료 이름 0개, 움직임 이름·개수 일치, 무료 약속 검사. 기존 visual-system/ui-structure PASS | 실제 기기 글꼴·긴 목록 가독성은 미검증 |
| C2 | `App.tsx`, `app.config.js`, `release/config-values.cjs`, `scripts/release-check.cjs`: 개인정보 URL·문의 이메일 주입, 형식 오류 제외, 미설정 준비 중/비활성. mailto는 앱 버전·OS 버전만. 메일 앱 실패 시 선택·복사 가능한 주소 표시 | `closed-config-test`: URL/email 정상·오류·누락 및 config/AAB FAIL [OWNER]. `closed-test-ui-test`: openURL 인수·제목·본문·비활성·실패 시 selectable 주소 PASS | 실제 공개 URL·문의 이메일 미제공. 실제 메일 앱/길게 눌러 복사는 실기기 확인 필요 |
| C3 | `src/project.ts` setIssues, `src/services/qa.ts` 비동기 이미지 비교·경로 캐시, `App.tsx` 공통 판정 사용. 남은 칸은 진행 표시, 비교 중 확인 중. 실패는 비교 경고 | `closed-test-ui-test`: 같은 그림·겹친 문구·크기·배경·자동 FAIL 복합 세트에서 홈/내보내기 5개 및 이름 일치, 대기 표시, 화면 이동 시 파일 재읽기 없음. 기존 저장·백업·화면 검사 PASS | 대규모 실제 기기 성능 미측정. 이미지 저장 시 새 경로를 만드는 기존 계약에 따라 캐시하며 저장 형식은 그대로 |
| C4 | `plugins/withReleasePermissions.js`, app.config 플러그인 연결, release-check no_overlay_permission. release 전용 manifest에 tools:node=remove, debug 보존 | `closed-config-test`: 실제 Expo mod 반복 실행 멱등성·debug 보존·산출물 FAIL/PASS. Gradle processReleaseMainManifest 및 processReleaseManifest 성공. 최종 병합 manifest에 오버레이 없음, BILLING 있음 | 새 APK/AAB를 만들지 않았으므로 aapt2 dump permissions 및 최종 서명 AAB 권한 확인은 후속 |
| C5 | `docs/PRIVACY_POLICY_KO.md`, `PLAY_DATA_SAFETY.md`, `PLAY_STORE_LISTING_KO.md`, `PLAY_CONSOLE_CHECKLIST.md`, `RELEASE_SIGNING.md`, `legal.md`: 일회성 pro_lifetime, 무료10/6·PRO20/14, 백업 ZIP/선택 복원/휴지통30일/로컬 글꼴, 미확정 운영자 값 표시 | `closed-docs-test`: 5개 문서의 구형 상품/가격 검색은 예전 상품 복원 한 줄만, 날짜·기준 커밋 및 데이터 흐름 행 존재 PASS | 운영자 정보·호스팅·보관 기간·가격·공개 게시 및 Console 입력 미확정 |
| C6 | `scripts/viewport-matrix-test.cjs`, `.gitignore`: 측정 결과를 무시되는 verification/_latest로 이동 | 전체 npm test 후 과거 회차 추적 기록 변경 없음. closed-docs-test 출력 경로 검사 PASS | 없음 |
| C7 | `src/services/purchase-config.ts`, `pro.ts`, `purchase-adapter.ts`, `App.tsx`, `app.config.js`, `release-check.cjs`: 명시적 closed 구성, UI와 서비스/어댑터 가격·구매·복원·자동 재확인 차단 | `closed-purchases-test`: 모든 공개 진입점 스토어/서버 호출 0, reviewUnlock 차단, 누락·오타 자동선택 없음. `closed-test-ui-test`: closed 안내 및 구매/복원 미노출, 정상 출시 구매 UI 유지. `release-check-test`: 합성 AAB app.config에서 구성 판독. 기존 iap/pro/review-pro 검사 PASS | 실제 Play 설치·결제·복원과 최종 업로드 서명 AAB는 미검증 |

## C7 구성과 예외 범위

- `EMOTICON_PURCHASES=closed`만 무료 비공개 테스트를 선택한다. 누락은 정상 출시다. 빈 문자열·오타 등 지원하지 않는 값은 app.config에서 오류로 중단한다.
- `EMOTICON_INTERNAL_REVIEW=1`과 closed를 함께 지정하면 빌드 구성 오류다. 런타임에서도 closed는 검수용 PRO 권한을 인정하지 않는다.
- CLI의 임의 track 이름으로 예외를 켜지 않는다. 실제 config의 `extra.purchases`와 AAB 내부 `base/assets/app.config`를 판독하며 두 구성 불일치는 FAIL이다.
- 영수증 주소 **미설정만** closed에서 WARN이다. 정상 출시의 영수증 검증과 모든 외부 배포의 서명·BILLING·결제 네이티브 모듈·검수 우회 차단·개인정보/문의 검사는 유지한다.
- 스토어를 열기 전에 구매/복원 서비스와 어댑터에서 다시 막는다. 화면만 감춘 구현이 아니다. 기존 작품·저장된 PRO 효과의 재생/내보내기는 유지한다.

## 권한 유입과 실제 병합 확인

기존 `android/app/build/outputs/logs/manifest-merger-release-report.txt:201~204`에서 `SYSTEM_ALERT_WINDOW`는 `android/app/src/main/AndroidManifest.xml:6`에서 추가됨을 확인했다. 앱 코드에는 overlay 사용처가 없다. debug manifest에도 개발용 선언이 있으므로 main을 삭제하지 않고 우선순위가 높은 release source-set에서만 제거한다.

플러그인을 Expo `compileModsAsync`로 적용한 뒤 로컬 Gradle의 `:app:processReleaseMainManifest`, `:app:processReleaseManifest`를 실행했다. 둘 다 BUILD SUCCESSFUL. 최종 `android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`에서 오버레이 없음·BILLING 유지 확인. 기존 중간 산출물은 오래된 권한을 포함할 수 있어 최종 작업 경로를 따로 확인했다. 매니페스트 작업 의존성으로 JS 번들이 갱신됐지만 APK·AAB 패키징은 실행하지 않았다.

## 검사와 보존

- 전체 `npm test`(TypeScript + 기존 회귀 검사 + 신규 4개 검사 + device-qa dry) PASS.
- 기존 테스트의 기대값을 낮추지 않았다. File 모형에 `async bytes()`를 추가해 실제 Expo의 비동기 읽기 API를 지원했고, release-check 정상 픽스처에 새 필수 개인정보 URL·문의 이메일을 추가했다.
- 신규 검사: `closed-purchases-test.cjs`, `closed-config-test.cjs`, `closed-test-ui-test.cjs`, `closed-docs-test.cjs`. npm test에 포함한다.
- device-qa는 dry 실행이다. react-test-renderer·native/WebView 모형 검사 통과를 실기기/Play 결제 통과로 보고하지 않는다.
- 반복 실행 로그: `verification/_latest/tests-final.log`, `release-normal.log`, `release-closed.log`, `manifest-check.log`, `manifest-final.log`. 이 경로는 git 제외다. 확정 검증 요약은 이 문서에 남긴다.

## 남은 배포 조건

구현과 가능한 자동 검증은 완료했지만, 현재 환경의 release-check 종료 코드는 두 구성 모두 1이다. 정상 구성의 receipt_endpoint는 FAIL이고 closed 구성에서는 WARN이다. 양쪽 모두 실제 업로드 키 입력 부재, 개인정보 URL/문의 이메일 부재로 FAIL이며, 기존 브랜드·스토어 에셋 검사는 BLOCKED다. 이를 통과시키려고 검사 기준을 낮추거나 운영자 값을 지어내지 않았다.

실제 업로드 키가 없어 **최종 서명 AAB는 차단 상태**다. 지시서에 따라 새 APK/AAB를 만들지 않았고 임시 키를 생성하거나 출시용으로 쓰지 않았다. 공개 URL·이메일·에셋·키 확보 후 최종 산출물 검사와 실기기/Play 검증이 필요하다.
