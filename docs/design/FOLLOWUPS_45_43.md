# 45.43 이후 남은 과제 (S8 정리 목록)

S0~S8(WHITE BASE · 이모티 라인 아이콘 · 홈 · 보드 · PRO · 그리기/움직이기) 적용 뒤, **이번 범위에서 일부러 하지 않은 것**만 적는다.
구현 계획이 아니라 목록이다. 하나씩 따로 승인받아 진행한다.

## 1. 시스템 알림창(`Alert.alert`) 32곳 → 앱 시트
- 위치: `App.tsx` · `src/painter/painter.tsx` · `src/painter/motion-panel.tsx` (2026-10-01 기준 32곳).
- 지금은 안드로이드 기본 대화상자라 흰 바탕·잉크·노랑 규칙을 따르지 않는다. 범위가 커서 이번 작업에서 제외(사용자 결정).

## 2. 선 아이콘이 없어 MDI 로 남은 모양
`ui.tsx` 의 `LINE_ICON` 표에 없는 이름은 `Glyph` 가 MDI 그대로 그린다. 같은 뜻의 「이모티 라인」 아이콘을 새로 그려야 옮길 수 있다.

| 묶음 | MDI 이름 |
|---|---|
| 그리기 조작 | `eyedropper-variant`(스포이드) · `select-drag`(선택) · `gesture-pinch` · `gesture-spread` · `magnify` · `magnify-plus-outline` · `magnify-minus-outline` · `circle-opacity` · `tune-variant` · `drag-horizontal-variant` · `keyboard-close` · `crop` |
| 참고·레이어 | `image-plus` · `human-handsup`(관절 인형) · `view-grid-outline` · `pin` · `bookmark-outline` · `account-star-outline`(캐릭터 기준) |
| 움직이기 | `motion-pause-outline` · `hand-back-right-outline` · `folder-outline` · `history` · `swap-horizontal` · `play` · `pause` · `play-circle-outline` · `movie-open-outline` |
| 저장·상태 | `cloud-upload-outline` · `cloud-check-outline` · `content-save-alert-outline` · `check-circle` · `check-circle-outline` · `close-circle-outline` · `alert-circle-outline` · `information-outline` · `file-alert-outline` · `progress-clock` · `timer-sand` · `lightbulb-on-outline` · `clipboard-check-outline` |
| 내보내기·설정 | `package-variant-closed` · `share-variant` · `content-copy` · `archive-arrow-down-outline` · `archive-arrow-up-outline` · `arrow-down-bold-box-outline` · `delete-restore` · `restore` · `open-in-new` · `credit-card-outline` · `key-variant` · `chevron-up` · `chevron-down` |

## 3. 실기기에서만 판단할 수 있는 것
- 움직이기 아이콘(둥근 캐릭터 + 속도선)의 22dp 가독성 — 지금 앱은 14·18 로만 쓴다. 22 로 쓰는 자리가 생기면 그때 실기기로 본다.
- 큰 글자 설정(1.3·1.5배)에서 보드 범례·완성 카드·PRO 칩 줄바꿈.

## 4. 이름
- 브랜드 '이모티'와 같은 이름의 앱·상표가 있는지 확인하지 않았다(스토어 등록 전 확인).
