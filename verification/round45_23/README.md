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

---

# 덧붙임 — 디자인 검토 자료와 손가락 자리 (APK 재빌드 없음)

## 화면 자료

`screens/index.html` · 19개 화면 × 390dp · PNG 와 HTML 둘 다. 만든 법과 **무엇을 판정할 수 없는지**는 `screens/README.md`.

요청한 목록과 파일:

| 요청 | 파일 |
|---|---|
| 홈: 작업 없음 / 작업 있음 | `home-empty` · `home-work` |
| 새 세트 생성 / 세트 상세 | `new-set` · `set-detail` |
| 감정 목록 / 표현 선택 | `guide-emotions` · `guide-examples` |
| 그리기 기본 / 브러시 / 색 / 참고창 / 레이어 | `draw-base` · `draw-brush` · `draw-color` · `draw-reference` · `draw-layers` |
| 문구+키보드 / 선택·변형 | `draw-caption` · `draw-selection` |
| 움직이기 / 부분 움직임 | `motion-base` · `motion-parts` |
| 내보내기 전 / 결과 | `export-before` · `export-result` |
| PRO / 설정 | `pro` · `settings` |

## 손가락 자리 — 보이는 크기와 누를 자리를 나눠 쟀다

`scripts/_touch.cjs` · 결과 `touch-targets.txt` · `touch-targets.json`

19개 화면에서 누를 수 있는 것 **203가지**를 쟀다. 재는 법은 **보이는 크기(width/height/minHeight) + hitSlop 양쪽**이다.

| | 처음 | 지금 |
|---|---|---|
| 손가락 자리 48dp 이상 | 153 | **196** |
| 미달 | **43** | **0** |
| 크기를 적지 않고 늘어나는 것 | 7 | 7 |

'늘어나는 것' 7가지는 모름이 아니다: 홈 가이드 미리보기 3장(`flex:1 · 비율 1`), 세트 카드(여백 24), 패널 바깥 덮개(화면 전체), PRO 요금제 2장(`flex:1 · 여백 28`). 모두 48dp 보다 크게 자란다.

### 고친 43가지

| 무엇 | 처음 | 어떻게 | 지금 |
|---|---|---|---|
| 감정 분류 칩 5개 | 높이 40 | 위아래 hitSlop 4 (가로 간격 6 은 건드리지 않음) | 48 |
| 세그먼트 칸(팔레트·직접 선택 등) | 높이 40/44 | 위아래 hitSlop 4/2 (칸끼리 붙어 있어 가로로는 못 넓힘) | 48 |
| 시트 닫기 3곳(브러시·참고·레이어) | 44×44 | hitSlop 2 — 머리줄 제 여백 안이라 옆 버튼을 건드리지 않음 | 48×48 |
| 세부 설정 줄 | 높이 44 | 위아래 hitSlop 2 | 48 |
| 작은 보조 버튼(내 그림으로 보관·새 레이어로 분리) | 높이 44 | 위아래 hitSlop 2 | 48 |
| 카드 안 '이어서 만들기' | 높이 44 | 위아래 hitSlop 2 | 48 |
| 빠른 도구(지우개·채우기·선택) | 46×48 | 좌우 hitSlop 1 — 칸 사이 간격이 2dp 라 딱 맞물린다. 좁은 화면(42dp)은 간격을 6 으로 벌리고 hitSlop 3 | 48×48 |
| 색 견본 24 + 최근 색 7 + 내 팔레트 | 30dp + hitSlop 6 = 42 | **배치 조정.** 간격이 6 뿐이라 hitSlop 으로는 이웃과 겹친다(이미 6dp 씩 겹쳐 있었다). 견본 36dp · 간격 12 로 — 누를 자리 48dp 가 이웃과 **맞닿기만** 한다 | 48×48 |

겹침 없음의 근거: 격자에서 누를 자리가 겹치지 않으려면 `견본 + 간격 ≥ 누를 자리` 여야 한다. 36 + 12 = 48 = 누를 자리. `color-test` 가 이 식을 그대로 검사한다.

### 변경한 화면만 돌린 검사

`color-test` · `convenience-test` · `visual-system-test` · `viewport-matrix-test` · `ui-structure-test` 모두 PASS. 이어서 전체 `npm test` 도 **23/23 PASS**.

## 남은 항목(그대로 유지)

도움말(T01) · 저장/파일 열기(X02) · 약관·개인정보 URL(P01) 은 이번에도 손대지 않았다. 진입점을 새로 만들지도, 기존 진입점을 없애지도 않았다.

## APK

**이번에는 빌드하지 않았다.** `dist/` 의 6개는 그대로다.

### dist 의 APK 전체 SHA-256

| 파일 | 바이트 | SHA-256 |
|---|---|---|
| `emoticon-studio-1.0.0-vc1-internal-review-0da0556-arm64.apk` | 38549950 | `a7bfebfe50f4e4d2f6cc92fcca2c92e1cff0285aa191c0d31bca4a06fd114b35` |
| `emoticon-studio-1.0.0-vc1-internal-review-271d166-arm64.apk` | 38619778 | `a6e4c58a41f264d04ebf4e7a72fb16ddd61dd7c21b8ae39fba1fc0b4eb04ce88` |
| `emoticon-studio-1.0.0-vc1-internal-review-345bb21-arm64.apk` | 39581735 | `acc96ad982f16de64e26101c7d76680365140809d6bb178eacca03cd592e6ae2` |
| `emoticon-studio-1.0.0-vc1-internal-review-717cd67-arm64.apk` | 39585799 | `5dcb3d98260e07c08edc5f71862a65e1141f9280b9376e8ba64d56da7324df71` |
| `emoticon-studio-1.0.0-vc1-internal-review-8af81b6-arm64.apk` | 39584135 | `b3288e465adcc19013109c4799bbe293aac2b1ee01a0593284c4ccff1fa03c5c` |
| `emoticon-studio-1.0.0-vc1-internal-review-c70b8c5-arm64.apk` | 39578139 | `32ac93be1f2d6685038dd6933d678b0bec28f82af2e94357fd703a1dd9c4fdf4` |

맨 아래 `c70b8c5` 가 45.23 UI 통합 뒤 한 번 만든 검수용 APK다. 그 뒤 소스 변경과의 차이는 아래.

### APK 소스 `c70b8c5` 와 지금의 차이

| | |
|---|---|
| 이번 작업 시작 HEAD | `21594ff` |
| 이번 작업 종료 HEAD | (아래 커밋 참조) |
| APK 소스 커밋 | `c70b8c5` |

`c70b8c5` 이후 앱 코드가 바뀐 곳은 **손가락 자리 넓히기 한 가지**뿐이다:

```
App.tsx                 |  3 ++-
src/components/ui.tsx   |  3 ++-
src/painter/painter.tsx | 20 +++++++++++---------
```

- `21594ff` 까지(= `2130fa2`·`998b11d`·`21594ff`): 문서·검증 자료·빈 파일 정리뿐. **앱 코드 변화 없음** — 그래서 `c70b8c5` APK 는 그때까지의 UI 와 같다.
- `3d2d8ac`: 손가락 자리 43곳. **이 변경은 `c70b8c5` APK 에 들어 있지 않다.** 다음에 빌드할 때 들어간다.
- `5c84e71`: 임시 파일 삭제.

즉 **현재 APK 로 실기기 검수하면 색 견본은 30dp(누를 자리 42dp) 상태이고, 칩·세그먼트·시트 닫기도 넓히기 전 상태다.** 위 화면 자료는 넓힌 뒤의 최신 소스를 그린 것이다.
