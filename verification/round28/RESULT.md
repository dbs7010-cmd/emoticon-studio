# 28차 결과 — PRO BRUSH FOUNDATION (2026-09-14)

판정: **PARTIAL** — 코드·자동 검사 PASS, Android 실기기는 일부만 확인. 나머지 실기기 재검수는 **BrowserStack 무료 체험 시간 소진으로 BLOCKED**.

## APK
- verification/apk-keep/app-28th-internal-b5d12fb15367.apk (81,152,300 B), internalReview=true (assets/app.config 확인)
- SHA-256 b5d12fb15367c6642723353c842ece10bc49e560ca26b3814f5bffa75784d958
- SOURCE_ID 7892e626c830b7ae1bd74bd516cb7d58a5ae7d2c2cdd40523d008cfd7ee34a35
- build-internal.log: BUILD SUCCESSFUL 4m 1s. 27차 APK 두 벌 보존.

## 자동 검사 (PASS)
- `npm test` (tests.log): 기존 전부 + color-test 의 PRO 브러시(프리셋 선택·기본 펜 카드 해제·진하기 50%·보정 강·700ms 뒤 한 번 저장·재실행 복원·기본 연필로 프리셋 해제) / 무료(저장된 PRO 설정 보존하되 효력 정지, 프리셋·진하기·보정 중/강 잠금 → PRO 안내, 선 보정 끄기/켜기·약 유지). ux-test 터치 크기 감사(320~412dp) 통과.
- `brush-engine-test` (brush-engine-test.log, Chromium):
  - 프리셋 4종 쌍별 다른 픽셀 5,318~10,653. 매끈한 잉크 시작 가늚·알파 255 / 부드러운 펜 반투명 가장자리 비율 0.48 / 결 연필 선 속 결 0.20 / 마커 한 획 균일 알파 140·잉크의 1.6배 이상 폭.
  - 진하기 50% → 알파 128, ×색 투명도 50% → 64, 기본 펜에도 128, 한 획 자기 겹침 ≤131, 다른 획 교차 192(=0.75).
  - 선 보정 흔들림(중심선 표준편차) 끔 1.48 / 약 1.01 / 강 0.42, 끝 도달 307/307.
  - 프리셋 획 되돌리기 1회, 손 떼기 전 저장에 획 포함.
  - 필압 자리: pen 0.2·1.0·0·1.5 결과 동일(반응 미연결), 오류 없음.
  - 회귀: 무료 펜/붓/연필(보정 약·진하기 100%)이 브러시 작업 이전 엔진(stash@{0})과 **픽셀 동일**.
- `color-engine-test` 재실행 PASS(투명도 획·채우기·스포이드·문구 투명도).

## Android 실기기 — --r28 (Galaxy S23/Android 13, 세션 4a3a32f464e11b62f1c8452ec1a8689e8f0c6496, internal/)
PASS (캡처·보고서 값으로 확인)
- 무료 펜 그리기(03-draw), 무료 브러시 잠금·유지(28-free-sheet: 브러시 마커 PRO·보정 강 PRO·브러시 진하기 PRO 잠금, 선 보정·보정 약 존재).
- 브러시 진하기 실제 조작 38% → 매끈한 잉크 세로 획이 검은 선 위로 비침, 시작 가늚(28-opacity). 도구 줄 "매끈한 잉크 굵기 6" 표시.
- **27차 미검증이던 RGB·투명도 실제 조작 PASS**: 빨강 36→204, 투명도 100%→48%, 색 값 #CC24247A, 분홍 반투명 획 아래 검은 선 비침(28-rgb, 28-rgb-applied).
- logcat: FATAL 0 · AndroidRuntime 0 · ReactNativeJS 오류 0 · Text 오류 0.

FAIL(러너 원인, 앱 결함 증거 없음)
- 28-pro-sheet/28-stabilizer: "이 그림 전부 지우기"가 ⋯ 메뉴 스크롤 아래라 찾지 못함 → 메뉴가 열린 채 28-presets 실패(캡처에 메뉴 열림).
- 28-eyedrop: 지그재그가 그려지지 않은 빈 곳을 눌러 앱이 정상적으로 "색이 없는 곳이에요" 안내 → 그 알림이 뒤 단계(재실행 복원·참고·다음 칸)를 막음.
- 28-undo/28-redo 는 단계 실행만 했고 판정 값을 남기지 않아 증거로 쓰지 않는다.

## BLOCKED
- 재검수 --r28b(다음 칸으로 빈 캔버스 확보·알림 선처리) 업로드 시 `HTTP 403 BROWSERSTACK_TESTING_TIME_LIMIT_EXHAUSTED` — App Automate 무료 체험 시간 소진. 세션 생성 없음, 증거 없음(internal-2/ 에는 apk.json 만).

## 실기기 미검증
프리셋 4종의 실기기 시각 차이 · 선 보정 끔/강 차이 · 브러시 설정 재실행 복원 · 프리셋 획 되돌리기/다시 · 스포이드 회귀(이번 APK) · 참고 · 칸 이동(이번 APK) · 펜 설정이 스크롤 없이 보이는지. 스타일러스 필압은 기기 없음.
