# 임티제작소 에셋 목록 — 44.2차 FINAL

> 이 문서는 **세 갈래 전체 목록**이다: ① 앱 UI 에셋 자리 8개 ② 스토어·출시 에셋 ③ 선택(마케팅·보조). 앱 안 8개만 보고 "이게 전부"로 읽지 않는다.
> 제작 발주 상세는 `docs/design/ASSET_PRODUCTION_SPEC.md`, 생성 AI 전달은 `docs/design/ASSET_GENERATION_HANDOFF.md`, 출시 파일 규격·검사는 `assets/asset-contract.json`(+ `npm run assets:check`) 이 원본이다.

공통: 앱 안 그림은 투명 PNG `@1x/@2x/@3x`(S24 Ultra 는 @3x), 마스터는 표시 크기 8배 이상. **한국어 글자·숫자·PRO 표시는 그림에 넣지 않는다**(앱이 그린다). 기준 폭 360 · 384(S24) · 412dp.

---

## 1. APP UI ASSET SLOTS (앱 안 자리 8개 — 코드 `src/design/asset-slots.ts`)

화면은 `AssetSlot` 이 그린다(`size` = 폭, 높이 = 폭 ÷ 비율). 에셋이 없으면 같은 크기의 도형 자리표시가 그려진다. **넣을 때는 `source` 만 바꾸고 비율이 다른 그림을 넣지 않는다.**

| ID | 필요도 | 화면 · 자리 | 역할 | 표시 크기(dp) | 비율 | 안전 영역 | 바탕 | 자르기 | 자리표시(지금) | 캐릭터 일관성 | 수량·변형 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `homeHeroArtwork` | **REQUIRED** | 홈 · 창작 표면 오른쪽 위(right 14 · top 16) | 첫 3초 "여기서 내 이모티콘을 만든다" | 96(폭<380) / 112 | 1:1 | 오른쪽 79% × 위 89% — 왼쪽 21%(제목)·아래 11%(행동 줄) 비움 | 투명 · #FFF9E8 위 | 없음(contain) | 흰 둥근 네모 + 눈 둘 | 필요(메인) | 1 |
| `homeEmptyArtwork` | **REQUIRED** | 홈 · 최근 작업이 비었을 때 점선 상자 | "여기에 내 세트가 모인다" | 120×90 | 4:3 | 가운데 80%, 아래 10% 비움 | 투명 · #FAF8F2 | 없음 | 도형 | 필요 | 1 |
| `referencePoseThumbnail` | **REQUIRED** | 그리기 › 참고 › 기본 레퍼런스 4열 격자 한 칸 | "어떻게 그릴까?" 따라 그릴 자세 | floor((화면폭−24−24)/4) × 4/3 → 78×104 · **84×112** · 91×121 | 3:4 | 위아래 6% · 좌우 10%, 발끝 94% | **불투명** #F3F1EC | 없음 | 회색 관절 인형 실루엣 | 아니오(마네킹) | 분류 4 × 칸 N + 캔버스용 투명 원본 1080×1440 |
| `expressionGuideArtwork` | **REQUIRED** | 홈 › 표현 가이드 · 2열 카드 윗부분 | "무엇을 그릴까?" 표현 한 장면 | 틀 floor((화면폭−44)/2)−20 → 138 · **150** · 164, 그림 = 틀 × .8 | 1:1 | 가운데 84%, 바닥선 90% | 투명 · #F3F1EC 위 | 없음 | 도형 | 필요(메인이 연기) | **카드 수만큼 — V1 20장**(5분류 × 4) |
| `motionExampleArtwork` | **REQUIRED** | 그리기 › 움직이기 · 효과 견본 칸 | **그림이 없는 칸**에서 효과가 움직여 보이는 대상(그림이 있으면 사용자 그림이 먼저) | 48 칸 안 41×41 | 1:1 | 가운데 86% — 통통 16%·흔들기 ±9°·두근거리기 1.14배에서도 칸 안 | 투명 | 없음 | `mascot-paper.png`(임시) | 필요 | 1 |
| `exportSuccessArtwork` | **REQUIRED** | 내보내기 · 요약 표면 오른쪽(모두 완성 시) | "세트 완성" 순간 | 84×84 | 1:1 | 가운데 84%, 왼쪽 침범 금지 | 투명 · #FFF9E8 | 없음 | 도형 | 필요 | 1 |
| `proFeatureArtwork` | **REQUIRED** | PRO 화면 위 비교 표면 안 두 칸 | 전체 움직임 → 눈·팔·몸만 | 86×86 × 2 | 1:1 | 가운데 84%, 두 장 같은 캐릭터·크기·바닥선 | 투명 · #FFF9E8 | 없음 | `mascot-paper` / `mascot-ink`(임시) | 필요(두 장 동일) | 전·후 2 |
| `noticeArtwork` | OPTIONAL | 홈 · 공지/이벤트 카드 왼쪽 (`HOME_NOTICE.enabled=false` → 지금 자리 0) | 공지 표식 | 44×44 | 1:1 | 가운데 76% | 투명 · 흰 카드 | 없음 | 도형 | 선택(사물도 가능) | 1 |

## 2. STORE / RELEASE ASSETS (앱 UI 가 아니라 출시 파일 — 원본 `assets/asset-contract.json`)

| ID | 필요도 | 쓰임 | 규격 | 지금 |
|---|---|---|---|---|
| `app_icon` | **REQUIRED** | iOS·Android 레거시·Play 원본 | 1:1 1024, 알파 없음 | Expo 템플릿 |
| `adaptive_foreground` / `adaptive_background` / `adaptive_monochrome` | **REQUIRED** | Android 런처(마스크) | 1:1 1024 × 3, 가운데 지름 66% 원 안 | 템플릿 |
| `splash_icon` | **REQUIRED** | 시작 화면 | 1:1 1024 투명 | 템플릿 |
| `play_icon` | **REQUIRED** | Play 스토어 아이콘 | 512×512 ≤1MB | 없음 |
| `feature_graphic` | **REQUIRED** | Play 상단 그래픽 | 1024×500 불투명, 문장 금지 | 없음 |
| `phone_screenshots` | **REQUIRED** | Play 스크린샷 2~8 | 1080×1920 이상 — **그림이 아니라 출시 후보 빌드 캡처** | 에셋 삽입 후 촬영 |

## 3. OPTIONAL (보조·마케팅 — 없어도 출시된다)

| ID | 쓰임 | 비고 |
|---|---|---|
| `noticeArtwork` | 홈 공지 카드 | 공지 기능을 켤 때만 |
| `brush_preset_previews` | PRO 브러시 카드 선 견본 | 300×84 × 4, 지금은 색 막대 |
| `tool-pen/brush/pencil.png` | 브러시 시트 선 종류 세그먼트 | **이미 앱에서 쓰는 13×18 그림** — CANON 확정 뒤 톤만 맞출지 판단 |
| 조연 캐릭터(BR-02·03) | PRO 비교·피처 그래픽·SNS | 두 캐릭터를 쓸 때만 |
| `store_screenshot_frame` · SNS/공모전 템플릿 | 스토어·홍보 | 출시 후 |

## 4. NOT NEEDED (만들지 않는다)

- `stroke-pen/brush/pencil.png` — `require` 만 남고 화면에 쓰이지 않음(정리 대상)
- `mascot-eraser.png` — 앱에서 쓰이지 않음
- 전체 작업 화면 그림 — 세트가 5개 이상일 때만 들어가는 목록이라 빈 상태가 없다. 썸네일은 사용자의 실제 칸 그림
- 보드·설정·캔버스·로딩·오류 화면 그림 — 글자와 아이콘으로 충분
- 온보딩 그림 — 온보딩 화면이 없다(새 세트는 바로 빈 캔버스)
- 알림 아이콘 — 푸시 기능 없음
- 캔버스 위 표현 가이드 그림(옛 CR-02) — 가이드는 홈 화면으로 옮겼다(44차)
- 레퍼런스 가로 줄 64×85 규격 — 4열 격자로 대체(44차)

## 5. 기능 자리(에셋과 함께 켜는 것)
- `EXPRESSION_GUIDE = { ready: false, categories 5, cards 20 }` — 카드 = 그림 자리 + 표현 이름(≤6자) + 몸짓 힌트(≤14자). 카드를 누르면 최근 세트의 다음 칸(없으면 새 세트)으로 가고, 표현은 캔버스 위 **한 줄 힌트**로만 따라간다(44.2차).
- `BUILTIN_REFERENCES = { enabled: true, ready: false, categories 4, placeholderCount 8, columns 4 }` — 찾는 동안 4열 격자, **고르면 격자가 접히고 캔버스에서 맞춘다**(44.2차). `ready=true` 가 되면 칸을 누를 때 기존 참고 레이어 흐름으로 들어간다.
- `HOME_NOTICE.enabled = false` — 켜면 표현 가이드 줄 아래 카드 하나.

## 6. 그림 톤
- 2~2.5등신 짤뚱한 캐릭터·관절 인형. 손그림 선. 사용자의 그림보다 "더 잘 그린" 인상을 주지 않는다.
- 노랑(#FFD02F)은 작은 포인트로만. 카카오 캐릭터·로고·색 조합을 따라 하지 않는다.
