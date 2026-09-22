# ROUND45.23 — 남은 명세 구현과 검증

45.22 보고를 **부분 완료로 정정**한 뒤 이어서 한 일이다. 45.22 까지의 개선은 그대로 두고, `IMPLEMENTATION_SPEC.md` 에서 미구현으로 남아 있던 것을 마저 구현했다.

항목별 대조표 전체는 `docs/UI_SPEC_STATUS.md`, NEEDS_DECISION 재분류는 `docs/UI_MAP.md` D 절에 있다.

## 커밋

| 커밋 | 무엇을 |
|---|---|
| `57088d5` | H01/H02 — 홈에서 이어하기를 맨 위로, 빈 점선 카드 제거, 가이드 미리보기 3장 |
| `b77d2f8` | S01 빈 칸 `+` · E04 Android back · E07 문구 취소 |
| `5ecf997` | E05 참고 창 크기 손잡이 · T01 앱 버전 |
| `49fa8ee` | H03 — 이름을 묻고 '만들기'를 눌렀을 때 세트를 만든다 |
| `8b9ebf9` | §2 — 글자 위계 한 벌, 카드16·버튼12 모서리 |
| `9060334` | §7 — 폭 320dp, 글자 배율 1.0/1.3/1.5, 움직이기 경계 |
| `91d38c7` | E04 판 닫기 통일 · E08 임시 상태 알림 |
| `7035a0c` | 대조표와 박스 겹침 측정 |
| `c70b8c5` | NEEDS_DECISION 재분류 |

## 이번에 찾아 고친 것

| 무엇 | 어떻게 찾았나 |
|---|---|
| 320dp 에서 내보내기 결과 격자 칸이 43dp — 손가락보다 작다 | 매트릭스에 320 을 넣자 바로 걸렸다. 340dp 미만만 5열(52dp)로 |
| 움직이기 설정 목록이 길어지면 완성 줄을 판 밖으로 밀 수 있다 | 겹침 비율이 아니라 경계로 봤다. 목록에 `flex:1 · minHeight:0` |
| 레이어·참고 줄에는 닫기가 없어 도구 재탭·바깥 탭으로만 닫혔다 | 네 판의 닫기를 나란히 놓고 비교 |
| 선택 판이 임시 상태라는 말을 하지 않는다 | 명세 E08 대조 |
| 새 세트에서 되돌아가면 빈 세트가 남는다 | `createNewProject` 호출 경로를 읽었다 |

## 검사

`npm test` — typecheck + 23 스위트, **23/23 PASS**.

새로 붙인 회귀:
- `convenience-test` 9절 — 실제 `BackHandler` 를 눌러 뒤로 순서 확인 · 네 판의 닫기(이름 하나 · 40dp 이상 · 누르면 닫힘) · 키보드 위 취소/적용 · 빈 칸 `+`
- `viewport-matrix-test` — 폭 320 추가 · 글자 배율 1.0/1.3/1.5 · 움직이기 목록/완성 줄 경계 · 결과 격자 한 줄 다섯 칸 이상
- `visual-system-test` 1절 — 글자 일곱 값과 모서리 두 벌 고정
- `ux-test` — 새 세트는 확인 전에 생기지 않는다

## 자료

| 파일 | 무엇 |
|---|---|
| `viewport-and-scale.txt` | 폭 4종 × 높이 5종 매트릭스 + 글자 배율 결과 |
| `font-scale.json` | 화면·폭·배율별로 훑은 글자 수와 잘림 수 |
| `home-order.txt` | H01/H02 홈 순서 |
| `box-depth.txt` | 화면별 테두리 상자 겹침 |

## 이 자료의 성격

**위의 모든 렌더 근거는 대체 렌더다. 실기기 캡처가 아니다.** 실제 App 트리를 `react-test-renderer` 로 그려 스타일과 구조를 읽은 것이고, 픽셀·줄바꿈·글꼴 메트릭·손가락 판정은 기기가 해야 한다.

**DEVICE-UX 는 UNVERIFIED 로 남는다.** 실제 Android 화면을 보지 못했으므로 사용성 PASS 라고 적지 않는다. 지난 라운드의 PASS 를 이번 판의 PASS 로 다시 쓰지 않는다.

## APK

| | |
|---|---|
| 파일 | `dist/emoticon-studio-1.0.0-vc1-internal-review-c70b8c5-arm64.apk` |
| 크기 | 39,578,139 바이트 |
| 소스 커밋 | `c70b8c5` (이후 `2130fa2`·`998b11d` 는 문서와 빈 파일 정리뿐이라 앱 코드가 같다) |
| SOURCE_ID | `af3398e39e6320e902e620e7deee79f8c884cbf3fe71e4769da4052741ddd688` |
| 구성 | 내부 검수(`EMOTICON_INTERNAL_REVIEW=1`) · arm64-v8a · 디버그 서명 |
| 빌드 | `gradlew.bat :app:assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a` · BUILD SUCCESSFUL in 11m 50s |

**서명이 `CN=Android Debug` 라 스토어에 올릴 수 없다. 내부 검수용이고 공개 배포·외부 공유는 하지 않는다.**

이번 라운드 변경이 실제로 이 APK 안에 들어갔는지, 번들 문자열로 확인했다 — `apk-strings.txt`. 설치해 본 것이 아니라 파일을 뜯어 본 것이다.

기존 APK 다섯 개는 그대로 둔다.
