# 27차 결과 — PRO 색상 · 출시 구성 차단 · viewport · 마지막 칸 (2026-09-14)

판정: **PARTIAL** — RGB·투명도의 **Android 실기기 조작**이 미검증이다(자동 검사만 통과). 나머지 최소 확인 항목은 실기기 증거가 있다.

## APK (같은 소스, 설정만 다름)
| 구분 | 파일 | SHA-256 | internalReview |
|---|---|---|---|
| 내부 검수 | verification/apk-keep/app-27th-internal-30675514072c.apk (81,139,876 B) | 30675514072c391de25020f52db03852b543d5ff85452c8271554b453d2a2cd7 | true (assets/app.config 확인) |
| 출시 구성 | verification/apk-keep/app-27th-release-aebc2f527cc1.apk (81,139,872 B) | aebc2f527cc19389d96d8bc2df650db53461eab20a1ad13a51d26d5c9d372ef7 | false (assets/app.config 확인) |

SOURCE_ID(둘 공통): d6327a4e31aed5b7a89fd995fa0a7fc21018b1846014fed6d8e2bd6e16f8f701
빌드 로그: build-internal.log(7m15s), build-release.log(2m42s). 출시 구성 APK 는 debug keystore 서명 — Play 업로드 빌드가 아니다.
기존 26차 APK(8f00a9f2…)는 보존.

## BrowserStack (Samsung Galaxy S23 / Android 13)
| 실행 | 세션 | 증거 |
|---|---|---|
| --r27 내부 | 12741a6f7d79e5fec7eb397a0b7726da05a17b4b | internal/ |
| --r27rel 출시 | f86826cc9731bac844b856113cbefcc3db68f849 | release/ |
| --r27color 내부 재검수(같은 APK) | 10aef323269ea8096bf47d03b5e325897018d57f | internal-color/ |

logcat(세 실행 모두): FATAL 0 · AndroidRuntime 0 · ReactNativeJS 오류 0 · "Text strings must be rendered" 0. ReactNativeJS 는 `Running "main"` 과 내부 빌드 SELPROBE 정보 로그뿐.

## 실기기 PASS
- 기존 그리기 회귀 없음: 03-draw(획 2개), 27-red-line / 27c-blue-line(굵기 24 직선), 27c-alpha-stroke.
- 모든 패널 전환 canvas viewport 동일: 팔레트·직접 선택·펜 굵기·문구(키보드 닫힘)·참고·레이어·더보기·선택 패널·움직이기 = 전부 x0 y384 1080×1731 (report-smoke.json viewport 10건).
- FREE/PRO 경계(내부, PRO 끄기): 스포이드 PRO·내 팔레트 저장 PRO 잠금, RGB·투명도 막대 없음, 색상 줄·연속 색상·채도명도 면·HEX 유지 (27-free-lock, 27-free-custom).
- 출시 구성: 스포이드 PRO 잠금·RGB 없음(27r-color-*), 잠금 → PRO 안내(27r-lock-to-sheet), 설정에 검수용 스위치·내부 빌드 안내 없음(27r-settings), PRO 시작하기·구매 복원 후에도 홈 "PRO 보기"(무료) + "결제 모듈 없음" 안내(27r-still-free).
- 스포이드 실제 픽셀 추출: 노랑(#FFD15C)을 든 채 파랑 직선을 눌러 #54A9E8 획득, 색상 계열 206°로 동기화 (27c-eyedrop). ※ 27-eyedrop-picked(#E94F4F)는 이미 같은 색이던 상태라 추출 증거로 쓰지 않는다.
- 내 팔레트 저장 → 앱 종료·재실행 후 유지 → 재선택 (27-palette-saved / -restart / -reused).
- 저장 후 상태: 저장 → 재실행 → 같은 칸에 그림 유지 (27-palette-reused 캔버스).
- 32번째 칸 접근: 보드 스크롤 후 "슬롯 32 미착수" 탭 → "32번 그림 · 전체 32" (27-last-tile).

## FAIL / 미검증
- **RGB·투명도 실기기 조작 미검증.** 원인은 러너: r27 은 스크롤 스와이프가 하단 도구바에 떨어져 막대에 닿지 못했고, r27color 는 첫 스크롤이 성공했으나 기준으로 쓴 "팔레트 닫기"가 화면 밖으로 밀려 다음 스크롤이 실패했다(27c-rgb: HEX 까지 내려간 화면). 앱 결함 증거는 없다. 따라서 27c-alpha-stroke 는 불투명 노랑 획이며 투명도 증거가 아니다.
- 자동 검사로만 확인: color-test(막대가 캔버스 색 값을 바꿈, 투명도 8자리), color-engine-test(Chromium: 50% 획 최대 알파 128 균일, 되돌리기 1회, 저장 중 획 보존, 투명도 채우기, 참고 색 추출).
- 사용성 관찰: 색 패널 높이가 짧아 PRO 정밀 조절(RGB·투명도)이 HEX 아래 두 번 스크롤 거리에 있다.
- 결제·복원의 실제 스토어 흐름은 이 빌드에 결제 모듈이 없어 검증 대상 아님.

다음 재검수(필요 시): 같은 내부 APK, 스크롤 기준을 화면 고정 좌표(패널 영역)로 바꾼 --r27color. 재빌드 불필요.
