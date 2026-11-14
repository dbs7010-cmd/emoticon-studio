# 26차 재검수 결과 — 2026-09-14

새 내부 검수 APK로 BrowserStack Samsung Galaxy S23 / Android 13 세션을 실행하고 종료했다. 세션: 292c4db8d3cfa6ecfb57fa9a55439b766bfd8279. 이전 APK·캡처를 새 결과로 사용하지 않았다.

- APK: verification/apk-keep/app-26th-recheck-8f00a9f21653.apk (81,128,080 bytes)
- SHA-256: 8f00a9f216533c9f4ca97bb97314a433b6fc70eecdf6d0374835a6d7be6a96e5
- SOURCE_ID: 9b2d7a1931e4991d666cbed69a73298a71905e10b89b6dce9e1e47d8a95144a5
- 기존 SOURCE_ID: 6cbb12f7c5c1c3b36c9b220d147c9a351e38a03a961d1b57862ccad17fa60fb9
- 새 APK의 assets/app.config: internalReview=true. 이전 b69e APK는 false였다.
- 업로드 전후 로컬 APK 해시 일치. BrowserStack API가 원격 파일 해시를 제공하지 않아 원격 digest 비교는 하지 않았다.

## 실제 Android PASS

- 키보드가 열린 상태에서 문구 입력·적용 노출: 26-caption-keyboard.png
- 키보드만 닫은 뒤 문구 패널·도구바 유지: 26-keyboard-closed.png. 해당 닫기 동작은 버튼 클릭 1회이며 back/hideKeyboard 명령 0회(report-smoke.json).
- 문구 선택·드래그·재적용·저장·앱 종료·재실행 후 위치 유지: 26-caption-selected.png → 26-caption-moved.png → 26-caption-reapplied.png → 26-caption-reopened.png.
- 32칸 하단 PRO 버튼 스크롤 전후 위치 동일: x=36,y=1992. 26-board.png / 26-board-bottom.png.
- 내부 검수 PRO 전환과 HEX #3366AA 반영: 26-internal-pro-on.png / 26-pro-hex.png.
- 수집 logcat에서 Text strings 오류, FATAL, AndroidRuntime 오류, ReactNativeJS 오류 0건. ReactNativeJS 정보 로그는 존재한다.

## 자동 검사

타입 검사 포함 npm test 통과(recheck-tests.log), git diff --check 통과. assembleRelease 성공(recheck-build.log).

## FAIL / 미검증

- PRO 색상 전체 구현은 완료 아님: RGB·투명도 조작, 실제 캔버스 스포이드, 이름 있는 사용자 팔레트 저장·재사용, 일반/PRO 고급 기능 분기가 미완성이다. HEX 성공을 전체 색상 기능 PASS로 확대하지 않는다.
- 일반 배포 빌드에서 개발자 진입이 숨겨지는 실제 화면은 미검증. 내부 APK에서 PRO 해제는 일반 배포 검증을 대체하지 않는다.
- 마지막 32번째 타일 접근, 모든 패널별 viewport 수치 동일성, 태블릿은 미검증.
- 첫 재검수의 문구 단계 실패는 이 폴더의 성공 결과로 대체한다. 첫 실행 캡처를 문구 PASS 증거로 사용하지 않는다.

자격 증명은 마스킹 창에서 실행 프로세스로만 전달했으며 파일·채팅에 저장하지 않았다. 러너 종료 시 환경 변수 제거 및 창 폐기 절차가 실행됐다.
