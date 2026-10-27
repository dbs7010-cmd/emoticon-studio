# 45.36 구현·검증 결과

- 시작 HEAD: `5f8f2e9ce67a5a7e47d10134638fb33917bd9343` (`feat/painter-flow-v1`)
- 종료 소스 커밋: `5cda2df0a89c951778e56f3b2e6153f235c09f83`
- 승인 기준: `docs/design/approved-tool-design-board.webp` (원본 보존)
- 지시서: `verification/round45_36/CODEX_지시서.md` (원본 보존)
- 화면 증거는 실제 앱 컴포넌트를 버튼 흐름으로 렌더한 대체 렌더(R)다. WebView 그림·네이티브 키보드·실제 글꼴은 하네스 한계이며 실기기 화면으로 주장하지 않는다.

## G별 결과

| ID | 판정 | 재현 | 원인·변경 | 검증·증거 | 남은 것 |
|---|---|---|---|---|---|
| G1 | 수정됨 | R | 조절대 내용을 `canvasSide` 높이에 묶고 작업면 안에서 가운데 정렬 | `viewport-matrix-test`; `screens*/draw-base.png` | 실기기 손가락 감각 |
| G2 | 수정됨 | R | 판·선택·문구가 열리면 조절대 내용을 통째로 숨김 | 4크기 `draw-color/layers/reference/caption/selection.png` | 없음 |
| G3 | 수정됨 | R | 네 폭 모두 한 줄 머리, 참고·레이어·문구를 48dp 아이콘 위/작은 글자로 통일 | `viewport-matrix-test`: 320~412 한 줄, 48dp; 글자 배율 1/1.3/1.5 잘림 0 | 실기기 글꼴 메트릭 |
| G4 | 수정됨 | R/H 분리 | 판은 absolute overlay, 브러시 창은 독립 overlay; 캔버스 틀 불변. 문구 키보드만 H | `product-ux-test`, `convenience-test` | 실제 키보드 회피 실기기 확인 |
| G5 | 수정됨 | R | 기둥 폭은 유지해 캔버스 좌표를 보존하고 움직이기에는 `미리보기` 의미 표시 | `screens/motion-base.png`, 전환 회귀 테스트 | 없음 |
| G6 | 수정됨 | R | 공통 `TabBar`, 역할별 `accentSoft/pressed fill/underline` 규칙 사용 | `visual-system-test`, `ui-structure-test`; `comparisons/selection.png` | 없음 |
| G7 | 수정됨 | R | 공통 `SheetHeader` 사용, 기본 grab 제거, 제목+보조동작+닫기 구조 | 색·브러시·레이어·참고 렌더 | 선택 판 안내형 본문은 기능상 유지 |
| G8 | 수정됨 | R | 주동작 노랑, 보조 흰 테두리, 아이콘 도구 무테 위계 유지 | `visual-system-test`, 각 판 렌더 | 없음 |
| G8b | 수정됨 | D+R | 완성은 글자만, 화살표 제거; 작업면 `C.bg`; 더보기 유지 | `comparisons/workspace.png` | 없음 |
| G9 | 수정됨 | R | 떠 있는 창 높이를 네 행+머리+탭 기준으로 산정 | `viewport-matrix-test`; 4크기 `draw-brush.png` | 실제 스크롤 물리감 |
| G10 | 수정됨 | D+R | 좌우/아래 8dp 여백, 20dp 모서리, 손잡이 없는 독립 카드 | `comparisons/brush.png` | 없음 |
| G11 | 수정됨 | 실제 엔진 | 엔진 미변경. 고정 압력 0.5에서 브러시별 실제 가능한 경로·굵기·이벤트 간격으로 30종 재생성 | `asset-contract-test`; `brush-samples/brush-samples.png` | 엔진 한계: 자연 잉크·테이퍼·납작 펜은 작은 행에서 차이가 비교적 약함; 별도 엔진 미감 라운드로 이관 |
| G12 | 엔진 한계로 이관 | R+S | 현재 브러시의 실제 엔진 견본을 쓰고 설정은 실제 캔버스 엔진에 즉시 전달. 세부 미리보기 자체는 정적 번들 견본이라 진하기·보정 변화까지 재렌더하지 못함 | `draw-brush-detail.png`, `color-test`의 설정 전달 | 별도 미니 엔진 프리뷰 필요 |
| G13 | 수정됨 | D+R | `색상` 공통 머리, 밑줄 `TabBar`, SV/세로 hue/오른쪽 최근색·팔레트 유지 | `color-test`; `comparisons/color.png`; 4크기 렌더 | 없음 |
| G14 | 수정됨 | R/H 분리 | 행에 보이는 순서 손잡이와 접근성 증감 동작 추가 | `convenience-test`; `comparisons/layers.png` | 썸네일 공백은 하네스 WebView 미실행 결과; 실기기 확인 |
| G15 | 수정됨 | R | 공통 `EmptyState`(가운데 아이콘·한 줄 안내·주 버튼) | `screens/draw-reference.png` | 없음 |
| G16 | 재현 안 됨(검사 장치 문제 해결) | 실제 버튼 흐름 R | 하네스가 상태만 주입하던 문제. 먼저 `선택` 버튼을 누른 뒤 선택 상태 주입 | `screens/draw-selection.png`; `comparisons/selection.png` | 실제 손가락 영역 선택은 실기기 |
| G17 | 수정됨 | R/H | 입력 높이와 `textAlignVertical:center`, 수직 padding 0 | `screens/draw-caption.png` | 실제 Android 키보드·글꼴 |
| G18 | 수정됨 | R | 빈 기둥 의미 표시, 카드 선택 규칙 통일, 패널 높이 정리; 효과 정책 불변 | `motion-v1-test`, `motion-preset-test`; `screens/motion-base.png` | 정지 대체 렌더는 애니메이션 차이를 표현 못함 |
| G19 | 수정됨·실기기 미검증 | U+S+mock flow | `locationY` 제거, `measureInWindow`의 트랙 top을 `pageY`에서 빼고 범위 clamp. 로컬 live state만 갱신, release 1회 commit | `product-ux-test`: drag 중 WebView/저장 0, release 후 width 1회; 빠른/트랙 밖은 clamp 코드와 pageY 계약 검증 | 실제 기기 프레임 시간·손가락 이탈 감각은 미측정 |
| G20 | 수정됨·일부 미검증 | R+mock WebView | 판/창은 WebView를 재생성하지 않고 overlay, 확대 상태 유지 | `convenience-test`: 패널 여닫기 후 확대 유지; `product-ux-test`: 캔버스 자리 불변 | 실제 WebView scale/tx/ty와 깜빡임은 실기기 미검증 |

## 공통 규칙

- 탭: `TabBar` — 선택 800 굵기 + 3dp 노랑 밑줄, 배경 없음; pressed는 텍스트 opacity.
- 도구/즐겨찾기/목록: 선택 `C.accentSoft`, pressed `C.fill`, 비활성 `C.faint`; 즐겨찾기는 짧은 노랑 밑줄, 목록은 행 전체 연노랑+체크.
- 판 머리: `SheetHeader`; 손잡이 없음, 제목/선택적 보조동작/닫기.
- 빈 상태: `EmptyState`; 아이콘, 안내, 주 동작.
- 옵션은 `Segmented`를 사용했다. 한 값 중 하나를 고르는 역할이므로 도구 버튼 규칙(선택 연노랑, pressed 회색)에 가장 가깝다.

## 화면 증거

- 네 크기 전체 26상태: `screens-320/`(320×568), `screens-360/`(360×640), `screens/`(390×844), `screens-412/`(412×915)
- 승인 시안과 390×844 구현 대조: `comparisons/workspace.png`, `brush.png`, `color.png`, `layers.png`, `selection.png`
- 실제 엔진 30종(행 크기/2×/조건): `brush-samples/brush-samples.png`

시안과 의도적으로 남긴 차이는 기능 보존 항목뿐이다: 더보기(기존 진입점), 논리 캔버스 360×360, 고정 72dp 왼쪽 기둥(48dp 이상 터치와 탭 전환 좌표 보존). 새 디자인 방향은 추가하지 않았다.

## 검사

- `npm test`: PASS (`tsc --noEmit` + 전체 UX/저장/제스처/색/움직임/IAP/에셋/뷰포트/구조/편의 회귀)
- `asset-contract-test`: 30종 전부 서로 다른 실제 엔진 PNG, 가로/세로 ≥3, 비어 있지 않고 띠를 과도하게 덮지 않음 — PASS
- 대체 렌더: 4크기 × 26상태 = 104 PNG 생성, 대표 화면 육안 확인
- 보존 회귀: 기존 저장·구형 브러시 ID, 무료10+PRO20, 즐겨찾기 3칸, 구매/복원, 검수 PRO 출시 무효, 움직임 저장 실패 시 이전본 보존, 지우개→펜 전환 — 전체 PASS

## 실기기 미검증

- 조절대의 실제 프레임 시간과 트랙 밖 손가락 이동 감각
- Android WebView의 확대/이동(scale/tx/ty), 패널 개폐 깜빡임, 레이어 썸네일
- 네이티브 키보드 회피와 실제 글꼴 배율 줄바꿈
- 실제 Play 구매·복원 및 스토어 설정
- 사용자 미감 최종 승인

## APK

통합 검증 뒤 생성했다. SDK 경로와 내부 검수 디버그 서명 허용 변수가 빠진 두 시도는 Gradle 구성 단계에서 중단되어 APK를 만들지 않았고, 변수를 모두 명시한 최종 빌드만 APK를 생성했다. 이전 APK는 `verification/apk-keep/` 및 `verification/apk-internal/`에서 변경하지 않았다.

| 항목 | 값 |
|---|---|
| 파일 | `dist/emoticon-studio-1.0.0-vc1-internal-review-5cda2df-arm64.apk` |
| 크기 | 40,992,296 bytes |
| SHA-256 | `10977ca1f2c11c8c50f8193663d64c6cfe2efe4099b58ebb92498cc39f0822d8` |
| 소스 커밋 | `5cda2df0a89c951778e56f3b2e6153f235c09f83` |
| ABI | arm64-v8a 단독 |
| 구성 | `EMOTICON_INTERNAL_REVIEW=1`, 내부 검수용 디버그 서명, 스토어 출시본 아님 |
| 빌드 | `:app:assembleRelease` — BUILD SUCCESSFUL in 4m 46s |
