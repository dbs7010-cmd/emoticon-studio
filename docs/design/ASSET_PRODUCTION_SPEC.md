# 임티제작소 — 최종 에셋 제작 명세 (41차 PRE-ASSET LOCK, 2026-09-15)

기준점: 커밋 `5a5b635` "Round40 visual shell pass"(39차 DEVICE QA PASS + 40차 VISUAL SHELL PASS).
이 문서는 **발주서**다. 이번 라운드에서 그림을 만들지도, 앱에 넣지도 않았다.

원본 관계
- 앱 안 자리 요약: `docs/design/ASSET_SLOTS.md` · 코드 자리: `src/design/asset-slots.ts`(`AssetSlot` 컴포넌트)
- 출시 에셋(아이콘·스플래시·스토어) 파일 규격·검사: `assets/asset-contract.json` + `npm run assets:check` — 이 문서와 다르면 **JSON 이 맞다**
- 생성 AI 전달 문서: `docs/design/ASSET_GENERATION_HANDOFF.md`
- 브랜드 캐릭터 원본: **미정** — 실제 에셋 제작 단계에서 사용자가 제공하거나 선택한 원본을 기준으로 별도 진행한다(41.5차). 41차에 `docs/design/emoti-assets-v1.zip` 을 원본으로 적었던 서술은 철회한다. 앱 안의 `assets/art/mascot-*.png` 는 현재 자리표시로만 쓰인다
- 세트 종류(32/24) 설계: `docs/design/SET_TYPE_DESIGN.md`

## 0. 공통 규칙
- **한국어 UI 글자는 그림에 넣지 않는다.** 문구·라벨·숫자·PRO 표시는 앱이 그린다(수정·현지화·스토어 대응). 예외: 없음. 스토어 피처 그래픽의 글자도 앱 이름 로고만 허용하고 문장은 넣지 않는다.
- 앱 안 그림: 투명 PNG, `@1x/@2x/@3x` 세 벌(`name.png`, `name@2x.png`, `name@3x.png` — React Native 밀도 접미사). S24 Ultra 밀도 2.81 → `@3x` 가 실제로 쓰인다. 원본 마스터는 표시 크기의 **8배 이상**(가장자리 정리용), 전달은 세 벌.
- 표시 크기(dp)와 좌표는 40차 실제 코드(`App.tsx`, `src/painter/*.tsx`)와 S24 Ultra 캡처(`verification/round40/device-v2`)에서 읽었다. 기준 폭: S24 Ultra 384dp · 작은 폰 360dp · 큰 폰 412dp.
- **CANON 의존**: BR-01(메인 캐릭터) 확정 전에는 캐릭터가 들어가는 에셋을 양산하지 않는다(§3 순서).
- 상태 표기: `PLACEHOLDER`(앱에 도형·임시 그림 자리 있음) · `NOT STARTED` · `BLOCKED BY CANON` · `BLOCKED BY MASTER` · `CAPTURE`(그림이 아니라 실기기 캡처).

## 1. 목록 — 21개

| 분류 | ID | 이름 | 우선 | 캐릭터 | 상태 |
|---|---|---|---|---|---|
| A. BRAND | BR-01 | Main Character CANON | P0 | 예 | NOT STARTED (원본은 에셋 제작 단계에서 확정) |
| | BR-02 | Supporting Character A | P2 | 예 | BLOCKED BY CANON |
| | BR-03 | Supporting Character B | P2 | 예 | BLOCKED BY CANON |
| B. HOME | HM-01 | homeHeroArtwork | P1 | 예 | PLACEHOLDER |
| | HM-02 | homeEmptyArtwork | P1 | 예 | PLACEHOLDER |
| | HM-03 | noticeArtwork | P3 | 선택 | PLACEHOLDER (기능 꺼짐) |
| C. CREATION | CR-01 | motionExampleArtwork | P2 | 예 | PLACEHOLDER (mascot-paper) |
| | CR-02 | expressionGuideVisual | P3 | 아니오(마네킹) | NOT STARTED (기능 꺼짐, 자리 결정 필요) |
| | CR-03 | brush_preset_previews | P3 | 아니오 | NOT STARTED (PRO 브러시 카드, 선택) |
| D. REFERENCE | RF-01 | Pose Mannequin MASTER | P1 | 마네킹 | NOT STARTED |
| | RF-02 | Pose reference pack (40~60) | P2 | 마네킹 | BLOCKED BY MASTER |
| E. COMPLETION/PRO | CP-01 | exportSuccessArtwork | P1 | 예 | PLACEHOLDER |
| | CP-02 | proFeatureArtwork (전·후 2장) | P2 | 예 | PLACEHOLDER (mascot-paper/ink) |
| F. LAUNCH/STORE | LS-01 | app_icon | P0 | 예(얼굴/실루엣) | NOT STARTED (Expo 템플릿) |
| | LS-02 | adaptive_icon (fg·bg·mono) | P0 | 예 | NOT STARTED (템플릿) |
| | LS-03 | splash_icon | P0 | 예 | NOT STARTED (템플릿) |
| | LS-04 | play_icon 512 | P0 | 예 | NOT STARTED |
| | LS-05 | feature_graphic | P0 | 예 | NOT STARTED |
| | LS-06 | phone_screenshots | P0 | — | CAPTURE (출시 후보 빌드) |
| | LS-07 | store_screenshot_frame | P3 | 아니오 | NOT STARTED (선택) |
| | LS-08 | social / contest template | P3 | 예 | NOT STARTED (출시 후) |

온보딩 전용 그림: **필요 없음**(앱에 온보딩 화면이 없다 — 새 세트는 바로 빈 캔버스로 들어간다, MASTER_SOURCE FIRST RELEASE).
기존 `assets/art/stroke-*.png`(선 샘플 3장): 40차 세그먼트 이후 **화면에 쓰이지 않는다**(`BRUSHES.stroke` 로 require 만 남음). 새로 만들지 않는다. `tool-*.png`(13×18 도구 그림)은 세그먼트에서 쓰이며 CANON 확정 뒤 선 두께만 맞출지 PHASE 4 에서 판단.

## 2. 에셋별 제작 명세

### A. BRAND

#### BR-01 Main Character CANON
| 항목 | 값 |
|---|---|
| Purpose | 앱 전체 브랜드의 얼굴. 모든 캐릭터 에셋의 기준 |
| Screen | 직접 화면은 없음 → HM-01·HM-02·CP-01·CP-02·CR-01·LS-01~05 의 원본 |
| Priority | P0 (다른 캐릭터 에셋 전부의 선행 조건) |
| Display aspect ratio | 제작 시트: 가로 16:9 턴어라운드 + 개별 포즈 1:1 |
| Recommended production resolution | 턴어라운드 3840×2160 · 개별 포즈 2048×2048 |
| Transparent / opaque | 개별 포즈 투명 · 시트는 #FAF8F2 바탕 |
| Expected background | 앱 바탕 #FAF8F2 / 따뜻한 표면 #FFF9E8 / 흰 표면 |
| Safe area | 개별 포즈: 가운데 80% 안에 몸 전체, 바닥선 90% |
| Subject placement | 정면·3/4·옆·뒤 4방향 + 표정 6(기본·기쁨·놀람·억울·울음·당당) + 대표 포즈 4(서기·손 흔들기·펜 들기·만세) |
| Crop tolerance | 0 — 시트는 잘리지 않는다 |
| Visual importance | 최상 |
| Character required? | 예 |
| CANON dependency | 자신이 CANON |
| FREE / PRO context | 공통 |
| Animation required? | 아니오(움직임은 앱 쪽). 단 관절이 읽히는 자세여야 함 |
| Text baked into image? | NO |
| Current placeholder location | 없음 |
| Implementation path | 원본 보관 `docs/design/canon-source/`(에셋 제작 단계에서 받은 원본 그대로) · 결과 `assets/brand/character/canon/`(시트·포즈, 앱 번들에 넣지 않음) |
| Status | NOT STARTED — 원본은 실제 에셋 제작 단계에서 사용자가 제공하거나 선택한다 |

제작 방식(PHASE 1, 원본 확정 뒤): 확정된 원본 캐릭터 각각 **① 원형 최대보존형 ② 앱용 정제형 ③ 강한 브랜드형** → 사용자가 메인 1종 + 방향 1개 선택 → 턴어라운드 시트 → **CANON LOCK**(파일 SHA-256 을 이 문서에 기록). 메인 후보는 원본을 받은 뒤 사용자가 정한다.
(41.5차: 41차의 "원본 3종 = emoti-assets-v1.zip 마스코트 · 메인 후보 종이" 서술은 철회)

#### BR-02 / BR-03 Supporting Character A / B
BR-01 과 같은 표. 차이만:
| 항목 | 값 |
|---|---|
| Purpose | 조연(도구 역할·상황 연출). CP-02 전·후 비교, LS-05 피처 그래픽, LS-08 템플릿 |
| Priority | P2 |
| Production | 턴어라운드 3840×2160 · 포즈 2048×2048, 표정 4 · 포즈 2 |
| CANON dependency | **BLOCKED BY CANON** — 선 두께·머리 비율·눈 모양·그림자 규칙을 BR-01 에서 그대로 가져온다 |
| Current placeholder | `assets/art/mascot-ink.png`(PRO 비교 오른쪽), `mascot-eraser.png`(앱에서 미사용) |
| Status | BLOCKED BY CANON (원본 확정 뒤 결정) |

### B. HOME

#### HM-01 homeHeroArtwork
| 항목 | 값 |
|---|---|
| Purpose | 홈 첫 3초 — "여기서 내 이모티콘을 만든다"는 인상. 창작 표면의 생명력 |
| Screen | Home · 창작 표면(`testID="홈 창작 표면"`, `App.tsx`) |
| Priority | P1 |
| Display aspect ratio | 1:1 |
| Display size | **112×112dp**(화면 폭 ≥ 380dp) · **96×96dp**(< 380dp) |
| Recommended production resolution | 전달 336×336(@3x) · 224(@2x) · 112(@1x) / 마스터 1024×1024 |
| Transparent / opaque | 투명 PNG |
| Expected background | 표면 #FFF9E8 + 테두리 #F4E6B8, 뒤에 앱이 그린 옅은 노랑 원 2개(#FFEBA6 60% 지름 190 · #FFF4CF 지름 140) |
| Safe area | **주 피사체 = 칸의 오른쪽 79% × 위쪽 89%**(112 기준 x 24~112, y 0~100). 왼쪽 24dp·아래 12dp 는 비운다 |
| Subject placement | 메인 캐릭터가 펜을 들고 화면 왼쪽(제목 쪽)을 향해 인사·권유하는 자세. 시선은 왼쪽 아래(행동 버튼) |
| Crop tolerance | 0 — 칸은 표면 안(right 14 · top 16)이라 잘리지 않지만 칸 밖은 그려지지 않는다(contain) |
| Visual importance | 높음 |
| Character required? | 예 |
| CANON dependency | BLOCKED BY CANON |
| FREE / PRO | FREE(모든 사용자) |
| Animation required? | 아니오 |
| Text baked? | NO — 위 "나만의 이모티콘 작업실 / 오늘의 표정을 그려 볼까요?" 와 버튼은 앱 |
| Current placeholder | `AssetSlot name="homeHeroArtwork"`(흰 둥근 네모 + 눈 두 개 + 노랑 점) |
| Implementation path | `assets/illustrations/home-hero.png` (+@2x, @3x) → `src/design/asset-slots.ts` `homeHeroArtwork.source = require(...)` |
| Status | PLACEHOLDER |

실제 배치(40차 코드 · S24 캡처 `device-v2/01-home.png`)
- 표면 폭 = 화면 폭 − 32 → S24 **352dp** · 360폰 328 · 412폰 380. 안쪽 여백 좌 20 · 우 16 · 위 20, 최소 높이 184, 모서리 24, overflow hidden.
- 그림 칸: x = 표면 폭 − 14 − 크기 → S24 **x 226~338, y 16~128**.
- 제목 열: x 20~250(최대 폭 230, 작은 폰 200). 실제 제목 "오늘의 표정을" 끝은 약 x 157 — 긴 문구로 바뀌면 250 까지 온다 → 칸 왼쪽 24dp(226~250) 비움 규칙의 근거.
- 행동 줄: y **119~167**(눈썹 17 + 6 + 제목 두 줄 60 + 16). "내 그림으로 시작" ghost 버튼 오른쪽 끝 약 x 315 → 칸 아래 12dp(116~128)와 겹칠 수 있음 → 아래 11% 비움 규칙의 근거.
- 작은 폰(360dp): 칸 x 218~314 · y 16~112, 행동 줄 y 119 → 겹침 없음. 같은 비율 규칙을 그대로 쓴다.

#### HM-02 homeEmptyArtwork
| 항목 | 값 |
|---|---|
| Purpose | 세트가 하나도 없을 때 "여기에 내 세트가 쌓인다" |
| Screen | Home · 최근 작업(세트 0개) 점선 상자 |
| Priority | P1 |
| Display aspect ratio / size | 4:3 · **120×90dp** |
| Production | 360×270(@3x) · 240×180 · 120×90 / 마스터 1280×960 |
| Transparent | 투명 |
| Expected background | 앱 바탕 #FAF8F2, 점선 테두리 #DAD5CA(모서리 20) |
| Safe area | 가운데 80%(12~108 × 9~81). 아래 10% 비움 — 8dp 아래에 제목 "첫 이모티콘 세트를 만들어 보세요"(14/700)·보조 문구 |
| Subject placement | 가운데. 빈 종이·빈 칸 앞에서 기대하는 메인 캐릭터(작게, 옆에 빈 이모티콘 칸 2~3개) |
| Crop tolerance | 0 |
| Visual importance | 중 |
| Character required? | 예 · CANON 의존 BLOCKED BY CANON |
| FREE / PRO | FREE · Animation NO · Text NO |
| Current placeholder | `AssetSlot name="homeEmptyArtwork"` |
| Implementation path | `assets/illustrations/home-empty.png` → `asset-slots.ts homeEmptyArtwork.source` |
| Status | PLACEHOLDER |

#### HM-03 noticeArtwork
| 항목 | 값 |
|---|---|
| Purpose | 공식 알림(공모전·챌린지·사례 모집) 카드의 작은 표식 |
| Screen | Home · 창작 표면과 최근 작업 사이 카드(`HOME_NOTICE.enabled=false` → 지금은 안 보임) |
| Priority | P3 |
| Display | 1:1 · **44×44dp** |
| Production | 132(@3x) · 88 · 44 / 마스터 512 |
| Transparent | 투명 · 배경 흰 카드 #FFFFFF(모서리 20, 테두리 #E9E6DE) |
| Safe area | 가운데 76%(5~39). 44dp 에서 실루엣이 읽혀야 함 |
| Subject placement | 가운데. 카드 안 배치: 여백 14 · 그림 왼쪽 44 · 간격 12 · 제목(14/700)·본문 두 줄(12) · 오른쪽 › 18 → 그림은 글자와 겹치지 않는다(자기 칸 밖으로 튀어나오는 요소 금지) |
| Crop tolerance | 0 · Visual importance 낮음 |
| Character required? | 선택(메인 캐릭터 얼굴 아이콘 또는 트로피·깃발 같은 사물) · CANON 의존: 캐릭터를 쓰면 BLOCKED BY CANON |
| FREE/PRO · Animation · Text | FREE · NO · **NO**(알림 제목·본문은 `HOME_NOTICE.title/body`) |
| Current placeholder / path | `AssetSlot name="noticeArtwork"` → `assets/illustrations/notice.png` |
| Status | PLACEHOLDER (기능 꺼짐) |

### C. CREATION / PAINTER

#### CR-01 motionExampleArtwork
| 항목 | 값 |
|---|---|
| Purpose | 칸에 그림이 없을 때 효과 견본(통통·흔들기·두근거리기)이 실제로 움직여 보이는 대상 |
| Screen | Painter · 움직이기 탭 효과 카드(`MotionSample`, `src/painter/motion-panel.tsx`) |
| Priority | P2 |
| Display | 1:1 · 견본 칸 **48×48dp** 안 그림 **41×41dp**(86%). 카드 약 93×84(S24) |
| Production | 123(@3x) · 82 · 41 / 마스터 512 |
| Transparent | 투명 · 배경 흰 카드 또는 선택 시 #FFF2B6 |
| Safe area | 가운데 86% — 통통: 위로 7.7dp 이동, 흔들기: ±9° 회전, 두근거리기: 1.14배 확대에서도 48 칸 밖으로 나가지 않는 실루엣 |
| Subject placement | 가운데, 몸 전체, 바닥선 90%. 좌우 대칭에 가까울수록 회전이 자연스럽다 |
| Crop tolerance | 0 · Visual importance 중(작지만 반복 노출) |
| Character required? | 예 · BLOCKED BY CANON |
| FREE/PRO · Animation · Text | FREE · 앱이 transform 으로 움직임(그림 자체는 정지 1장) · NO |
| Current placeholder | `FALLBACK_SAMPLE = require('assets/art/mascot-paper.png')` (motion-panel.tsx) |
| Implementation path | `assets/illustrations/motion-example.png` → `FALLBACK_SAMPLE` 를 `ASSET_SLOTS.motionExampleArtwork.source ?? mascot-paper` 로 바꾸는 1줄 연결(에셋 라운드) |
| Status | PLACEHOLDER |

#### CR-02 expressionGuideVisual (선택)
| 항목 | 값 |
|---|---|
| Purpose | 표현 가이드 힌트("억울해 · 팔짱 + 몸 돌리기")의 보조 그림 |
| Screen | Painter 캔버스 위 한 줄 힌트(`ExpressionHint`, `EXPRESSION_GUIDE.enabled=false`) |
| Priority | P3 |
| Display | **현재 레이아웃에 그림 자리가 없다**(힌트는 글자만). 넣는다면 힌트 왼쪽 40×40dp — 추가 여부는 기능 켜기 전 결정 |
| Production | 120(@3x) / 마스터 512 · 투명 |
| Safe area / placement | 가운데 80%, RF-01 마네킹의 동작 요약 실루엣 |
| Character required? | 아니오(마네킹) · 의존: BLOCKED BY MASTER |
| Animation · Text | NO · NO |
| Status | NOT STARTED — 기능과 함께 결정(이번 발주 대상 아님) |

#### CR-03 brush_preset_previews (선택)
| 항목 | 값 |
|---|---|
| Purpose | PRO 사용자 브러시 카드(매끈한 잉크·부드러운 펜·결 연필·마커)의 선 견본. 지금은 색 막대 |
| Screen | Painter · 브러시 시트 PRO 줄(PRO 사용자만 보임) |
| Priority | P3 |
| Display / Production | `assets/asset-contract.json brush_preset_previews`: **300×84 PNG 4장, 투명** |
| Character / CANON | 아니오 / 무관 · PRO · Text NO |
| Implementation | `assets/brush/preset-{ink,soft,grain,marker}.png` → `painter.tsx PRO_BRUSHES` 연결 |
| Status | NOT STARTED (선택 — 없어도 출시 가능) |

### D. BUILT-IN REFERENCE

#### RF-01 Pose Mannequin MASTER
| 항목 | 값 |
|---|---|
| Purpose | 따라 그릴 자세 기준. 이모티콘 비율(2~2.5등신)의 관절 인형 — 캐릭터가 아니라 **도구** |
| Screen | Painter · 참고 › 기본 레퍼런스(`BuiltinReferences`, 준비 중 칸 64×85) → 고르면 캔버스 참고 레이어 |
| Priority | P1 (RF-02 선행) |
| Display aspect ratio | 3:4 |
| Display size | 목록 칸 **64×85dp** · 캔버스 참고 레이어: 360×360 캔버스에 contain → 270×360 |
| Recommended production resolution | 캔버스용 **1080×1440** 투명 · 목록 썸네일 192×255(@3x) 불투명 — 마스터 1536×2048 |
| Transparent / opaque | 캔버스용 투명(참고 레이어는 진하기 30% 로 그림 위에 겹침) · 썸네일 불투명(#F5F3ED 바탕) |
| Safe area | 위아래 6% · 좌우 10% 안에 전신. 발끝 바닥선 94% |
| Subject placement | 정면 차렷(T 포즈 아님) 기본형 + 3/4 뷰 1장. 가운데 정렬 |
| Crop tolerance | 0 |
| Visual importance | 높음(따라 그리기 정확도) |
| Character required? | **아니오** — 얼굴 없음 또는 눈 위치 표시 점만. 성별·옷·머리카락 없음 |
| CANON dependency | 없음(비율만 BR-01 과 호환: 머리 : 몸 ≈ 1 : 1.2~1.5) |
| FREE / PRO | FREE(기본 레퍼런스는 무료 그리기 도구) |
| Animation required? | 아니오 |
| Text baked? | NO |
| Current placeholder | `painter.tsx BuiltinReferences` 회색 도형 8칸(`BUILTIN_REFERENCES.ready=false`) |
| Implementation path | `assets/reference/mannequin/master-front.png` · `master-3q.png` → 참고 추가 흐름 연결(에셋 라운드 코드 작업) |
| Status | NOT STARTED |

형태 규칙: 큰 둥근 머리(전체 높이의 40~45%) · 짧은 원통 몸통 · 짧은 팔(몸통 길이 이하)·짧은 다리 · 목·어깨·팔꿈치·손목·골반·무릎·발목에 **보이는 원형 관절** · 손은 벙어리장갑형(엄지만 분리) · 선 한 가지 두께 · 명암은 한 단계 회색 또는 없음 · 나무/플라스틱 질감 표현 금지(선화).

#### RF-02 Pose reference pack
| 항목 | 값 |
|---|---|
| Purpose | 포즈·표정·손동작·효과 카테고리별 따라 그리기 자세 |
| Screen | 참고 › 기본 레퍼런스 카테고리 칩(포즈·표정·손동작·효과) |
| Priority | P2 |
| Display / Production | RF-01 과 동일(3:4 · 1080×1440 투명 + 192×255 썸네일) |
| 수량 | 40~60(카테고리당 10~15) |
| Character | 아니오 · 의존: **BLOCKED BY MASTER**(RF-01 승인 전 생성 금지) |
| 열린 결정 | "표정" 카테고리: 얼굴 없는 마네킹과 충돌 → ① 머리만 크게 + 눈썹·입 기호선 허용 ② 몸짓으로 감정 표현(억울=팔짱+돌아서기) 중 선택 필요 |
| Implementation path | `assets/reference/pack/<category>/<nn>.png` + 목록 json |
| Status | BLOCKED BY MASTER |

### E. COMPLETION / PRO

#### CP-01 exportSuccessArtwork
| 항목 | 값 |
|---|---|
| Purpose | 세트를 모두 채웠을 때 "내 세트가 완성됐다"는 순간 |
| Screen | Export · 요약 표면(`testID="내보내기 요약"`) 오른쪽 — **완성 수 ≥ 규격 수일 때만** 보임(그 전에는 % 원) |
| Priority | P1 |
| Display | 1:1 · **84×84dp** |
| Production | 252(@3x) · 168 · 84 / 마스터 1024 |
| Transparent | 투명 · 배경 따뜻한 표면 #FFF9E8(테두리 #F4E6B8, 모서리 24) |
| Safe area | 가운데 84%(7~77). 칸 왼쪽으로 튀어나오는 요소 금지 — 왼쪽 12dp 간격 너머에 "세트를 모두 완성했어요 · 규격" + "24 / 24 완성"(24/800) + 진행 막대 |
| Subject placement | 실제 배치: 표면 여백 18 · 글자 열 폭 = 표면 폭 − 36 − 12 − 84 → S24 **220dp**, 그림 칸 세로 가운데. 메인 캐릭터가 완성된 이모티콘 묶음(작은 칸 여러 개)을 들어 올리는 자세, 시선 왼쪽(글자) |
| Crop tolerance | 0 · Visual importance 높음 |
| Character required? | 예 · BLOCKED BY CANON |
| FREE/PRO · Animation · Text | FREE · NO · NO |
| Current placeholder | `AssetSlot name="exportSuccessArtwork"` |
| Implementation path | `assets/illustrations/export-success.png` → `asset-slots.ts` |
| Status | PLACEHOLDER |

#### CP-02 proFeatureArtwork (전·후 두 장)
| 항목 | 값 |
|---|---|
| Purpose | PRO 가치 "전체가 움직이던 것 → 눈·팔·몸만 따로" 를 한눈에 |
| Screen | PRO 화면(`App.tsx proSheet`) 위쪽 비교 표면 |
| Priority | P2 |
| Display | 1:1 두 장 · 각 **86×86dp**. 16:9 따뜻한 표면(폭 화면−32 → S24 352, 높이 min(폭×9/16, 214) → S24 198, 안쪽 여백 14)은 **앱이 그린다**. 두 그림 사이 화살표(24)와 각 그림 아래 라벨("전체 움직임" / "눈·팔·몸만", 11/800)도 앱 |
| Production | 258(@3x) · 172 · 86 × 2 / 마스터 1024 × 2 |
| Transparent | 투명 · 배경 #FFF9E8 |
| Safe area | 가운데 84%. **두 장이 같은 캐릭터·같은 크기·같은 바닥선** — 차이는 움직임 표시(전: 몸 전체 흔들림 선 / 후: 눈·팔에만 작은 동작 선)뿐 |
| Subject placement | 가운데. 동작 선(짧은 호·점선)은 칸 안에서만 |
| Crop tolerance | 0 · Visual importance 중 |
| Character required? | 예 · BLOCKED BY CANON (BR-02 를 오른쪽에 쓰려면 BR-02 도 필요) |
| FREE / PRO | PRO 판매 화면 — 자물쇠·금색·반짝이 금지(40차 규칙: PRO 는 조용하게) |
| Animation · Text | NO(정지 2장) · NO |
| Current placeholder | `App.tsx` `MASCOT.paper`(왼쪽) · `MASCOT.ink`(오른쪽) Image 86×86 |
| Implementation path | `assets/illustrations/pro-before.png` · `pro-after.png` → 두 `Image source` 교체(레이아웃 불변) |
| Status | PLACEHOLDER |

### F. LAUNCH / STORE (이번 라운드 제작 없음 — 파일 규격은 `assets/asset-contract.json`)

| ID | Purpose / Screen | Priority | Ratio · Resolution | Transparent | Safe area · placement | Character / CANON | Text | Placeholder → Path | Status |
|---|---|---|---|---|---|---|---|---|---|
| LS-01 app_icon | iOS 아이콘·Android 레거시·Play 원본 | P0 | 1:1 · 1024×1024 | **알파 없음** | 가운데 80%, 메인 캐릭터 얼굴 또는 실루엣 + #FFD02F 작은 포인트, 바탕 #FAF8F2 계열 | 예 / BLOCKED BY CANON | NO | `assets/icon.png`(템플릿) → `assets/brand/app-icon.png` | NOT STARTED |
| LS-02 adaptive_icon | Android 런처(원형·둥근 네모 마스크) | P0 | 1:1 · 1024×1024 × 3 | fg·mono 투명 / bg 불투명 | **가운데 지름 66%(672px) 원 안**에 모든 형태 · mono 는 한 색 실루엣 | 예 / BLOCKED BY CANON | NO | `assets/android-icon-*`(템플릿) → `assets/brand/adaptive-{foreground,background,monochrome}.png` | NOT STARTED |
| LS-03 splash_icon | 앱 시작 화면 로고 | P0 | 1:1 · 1024×1024 | 투명 | 앱이 폭 200dp contain, 바탕 #F4F4F5(brand.json 으로 #FAF8F2 권장) · 가운데 60% | 예 / BLOCKED BY CANON | NO | `assets/splash-icon.png`(템플릿) → `assets/brand/splash-icon.png` + `expo-splash-screen` 설치 | NOT STARTED |
| LS-04 play_icon | Play 스토어 아이콘 | P0 | 1:1 · 512×512 ≤1MB | 알파 가능 | LS-01 에서 파생 | LS-01 파생 | NO | → `assets/store/play-icon-512.png` | NOT STARTED |
| LS-05 feature_graphic | Play 상단 그래픽 | P0 | 1024×500 | 알파 없음 | 가운데 70% 에 핵심, 좌우 15% 는 기기별 잘림 대비. 캐릭터 + 실제 앱 화면 조각 | 예 / BLOCKED BY CANON | 앱 이름 로고만 허용, 문장·승인 약속 금지 | → `assets/store/feature-graphic.png` | NOT STARTED |
| LS-06 phone_screenshots | Play 휴대폰 스크린샷 2~8 | P0 | 9:16 · 1080×1920 이상 | 알파 없음 | **그림이 아니라 출시 후보 빌드 실기기 캡처** | 앱에 들어간 에셋 | 앱 화면 그대로 | → `assets/store/screenshots/phone-NN.png` | CAPTURE (에셋 삽입 후) |
| LS-07 store_screenshot_frame | 스크린샷 위 짧은 설명 띠(선택) | P3 | 1080×1920 오버레이 | 알파 없음 최종 | 위 18% 띠 · 캡처 화면을 가리지 않음 | 선택 | 띠 글자는 편집 도구에서 입력(그림에 굽지 않음) | 없음 | NOT STARTED |
| LS-08 social / contest template | SNS·공모전 공지 | P3 | 1:1 1080 · 4:5 1080×1350 · 9:16 1080×1920 | 불투명 | 가운데 80% 글자 자리 비움 | 예 / BLOCKED BY CANON | 템플릿에 문구 자리만(글자 굽지 않음) | 없음 | NOT STARTED (출시 후) |

## 3. 제작 순서 — LOCK

| PHASE | 할 일 | 산출물 | 승인 게이트 |
|---|---|---|---|
| 0 | 에셋 제작 단계 시작 시 사용자가 원본 캐릭터를 제공·선택 → `docs/design/canon-source/` 원본 보관·SHA-256 기록 | CANON 원본 | 사용자 원본 확정 |
| 1 | 확정된 원본 → 캐릭터별 ①원형 최대보존 ②앱용 정제 ③강한 브랜드 비교 → 메인 1종·방향 1개 선택 → 턴어라운드·표정·대표 포즈 | BR-01 CANON 시트(SHA-256 기록) | **사용자 CANON LOCK** |
| 2 | CANON 대표 포즈로 HM-01 Home Hero · HM-02 Empty · CP-01 Export Success | 3종 × @1x/@2x/@3x | 내부 규격 검사(투명·크기·안전 영역) |
| 3 | PHASE 2 에셋 2~3개를 **실제 앱에 시험 삽입**(source 교체만) → S24 Ultra 캡처 → UI 와 캐릭터 궁합 확인 | 캡처 + 판정 | **사용자 확인(미감)** |
| 4 | BR-02·BR-03 조연 → CR-01 Motion 견본 · CP-02 PRO 전·후 · HM-03 Notice | | PHASE 1 LOCK 필수 |
| 5 | RF-01 Pose Mannequin MASTER(정면·3/4) → 앱 참고 레이어에 시험 삽입 | MASTER | **사용자 MASTER 승인** |
| 6 | RF-02 포즈 팩 40~60 양산(표정 카테고리 결정 포함) | 팩 + 목록 json | PHASE 5 승인 필수 |
| 7 | LS-01~05 아이콘·적응형·스플래시·Play 아이콘·피처 그래픽 → 출시 후보 빌드 → LS-06 스크린샷 캡처 | `npm run assets:check` 전부 PASS | 출시 직전 확인 |

**금지**: PHASE 1 승인 없이 PHASE 4~7 캐릭터 에셋 대량 생성 · MASTER 승인 없이 RF-02 생성 · 에셋 라운드에서 40차 레이아웃·토큰 변경(자리가 안 맞으면 그림을 고친다).

## 4. 에셋 라운드에서 할 코드 작업(참고 — 이번에 하지 않음)
1. `src/design/asset-slots.ts` 각 `source` 를 require 로 교체(HM-01·HM-02·HM-03·CP-01).
2. `motion-panel.tsx FALLBACK_SAMPLE` → `motionExampleArtwork` 연결(CR-01).
3. `App.tsx` PRO 비교 두 `Image source` 교체(CP-02).
4. `BUILTIN_REFERENCES.ready=true` + 칸 누르기 → 기존 `addReferences` 흐름으로 참고 레이어 추가(RF-01/02).
5. `visual-system-test` 에 "source 가 있으면 파일 존재·비율 일치" 검사 추가.
6. 출시 에셋은 `assets/asset-contract.json` 절차(`npm run assets:check` → prebuild --clean → 빌드).
