# 40차 — COMMERCIAL VISUAL UI REBUILD (2026-09-15)

판정: **PASS (시각 체계 · 자동 회귀 · 실기기 캡처 검토 · 실기기 스모크)** — 최종 캐릭터 에셋 없이도 완성된 구성. 기능·저장·엔진·움직임 스키마·내비게이션·FREE/PRO 불변.
출시 RC 가 아니다(디버그 서명 QA 빌드, 36~37차 BLOCKED 항목 그대로).

## A. 감사(구현 전) — `docs/design/ROUND40_VISUAL_AUDIT.md`
하드코딩 색 103곳 · 모서리 20종 · 선택 = 2px 노랑 박스 · 900 굵기 남발 · 펜/붓/연필 독립 카드 3장 · 도구마다 테두리 박스 · 움직임 없음이 효과와 같은 무게 · 보드 칸마다 글자 배지 · 내보내기 카드 5~7장 · 홈 첫 행동이 맨 아래·브랜드 없음.

## B. 디자인 시스템 — `src/components/ui.tsx`
- 색: bg #FAF8F2 · paper #FFFFFF · surface2 #F5F3ED · warm #FFF9E8 · accent #FFD02F / pressed #F2C322 / soft #FFF2B6 / border #F3D867 · ink #171717 · muted #66635D · faint #99958C · line #E9E6DE · success/warning/danger soft 쌍
- 모서리 8·12·16·20·24 · 간격 4·8·12·16·20·24·32 · 그림자 Elev 0/1/2(불투명도 ≤ .10)
- 글자 Type: screenTitle · sectionTitle · cardTitle · body · bodySecondary · button · caption · micro
- 컴포넌트: Action(primary·secondary·ghost·danger) · IconButton · Segmented · Chip · SheetHeader · SectionLabel · StatusDot · AssetSlot · Range · ProTag · Dialog

## C. 화면별
| 화면 | Before | After |
|---|---|---|
| Home | "내 작업실", 세트 카드 위·새 세트 버튼 맨 아래(회색) | 임티제작소 브랜드 머리 → 따뜻한 창작 표면(새 이모티콘 만들기 · 내 그림으로 시작 · 그림 자리) → 최근 작업 썸네일 카드. 알림 꺼짐=간격 0 |
| Painter | 머리·탭 이중 선, 도구 2px 박스, 되돌리기 회색 박스, 캔버스 위에 붙고 아래 빈 띠 | 가벼운 머리, 밑줄 탭 + 알약 보조 입구, 한 dock(고른 도구만 노랑 표면), 조용한 되돌리기, 완성 · 다음 →, **캔버스 영역 가운데 정사각** |
| Brush | 펜·붓·연필 독립 카드 + 획 그림 | **하나의 Segmented**(비선택 투명·선택 옅은 노랑 알약) + 고급 브러시 한 줄 + 접힌 세부 설정(진하기 · 선 보정 스위치 + 약/중/강 세그먼트) |
| Color | 스포이드/저장 버튼이 최근 색 위, 사각 3px 선택 | 머리(지금 색 · 스포이드 · 저장 · 닫기 아이콘) → **최근 색 동그라미** → 팔레트/직접 선택 세그먼트 |
| Reference | 내 사진 줄뿐 | 내 사진 / 기본 레퍼런스 세그먼트 + 포즈·표정·손동작·효과 칩 + 3:4 준비 중 자리표시 |
| Caption | 파랑 2px 선택선, 키보드 시 4줄 패널 | 짙은 중립 얇은 선 + 노랑 손잡이(색만), **입력 중 한 줄(색·입력·키보드 닫기·적용)** + 도구 줄 접기 |
| Motion | 네 카드 같은 무게 | 좁고 조용한 없음 + 효과 카드 3(48px 실제 견본) + 따뜻한 직전 칸 줄 + "더 세밀하게 움직이기" 조용한 목록 |
| Board | 칸 테두리 + 완성/작업 중 알약 | 모서리 상태 점 + 범례, 노랑 진행 막대, 떠 있는 아래 줄 |
| Export | 제목 한 줄 + 카드 더미 | 요약 표면(완성 시 따뜻한 표면 + exportSuccessArtwork) → 결과 격자 → 손볼 곳 한 표면(호박/빨강 동그라미) → 제출 준비 → 파일 묶음(노랑 1) |

## E. 펜/붓/연필 최종 형태
`Segmented testID="선 종류"`: 높이 44dp 칸 3개가 surface2 바탕(모서리 14, 안쪽 3dp) 하나를 나눠 씀. 비선택: 테두리·바탕 없음, 회갈 글자. 선택: accentSoft 알약 + accentBorder 1px + 짙은 글자 800. 각 칸 왼쪽에 13×18 도구 그림. 고급 브러시는 아래 한 줄(아이콘 · 고급 브러시 · PRO · ›).

## F. 에셋 자리 — `docs/design/ASSET_SLOTS.md`, `src/design/asset-slots.ts`
homeHeroArtwork 1:1(96/112) · homeEmptyArtwork 4:3(120) · noticeArtwork 1:1(44) · referencePoseThumbnail 3:4(64×85) · motionExampleArtwork 1:1(48) · exportSuccessArtwork 1:1(84) · proFeatureArtwork 16:9. EXPRESSION_GUIDE.enabled=false · BUILTIN_REFERENCES ready=false · HOME_NOTICE.enabled=false.

## G. 자동 검사
- `npm test` exit 0 (`tests.log`): typecheck + 19 스위트 + 러너 라벨 53
- 새 `visual-system-test`: 토큰 값, 2px 노랑 선택 박스 금지, 900 굵기 ≤2/파일, 화면 하드코딩 색 30(39차 56, 견본·토큰 정의 제외), 에셋 자리 7 규격, 홈 순서·노랑 버튼 1, 보드 글자 배지 없음, 도구 dock 테두리 없음, 선 종류 세그먼트, 문구 입력 한 줄, 없음 좁게, 내보내기 요약→격자·노랑 1
- 기존 회귀 유지: viewport matrix(640~1000 × 360~412), 24칸 반복, 없음→통통 재생, 39차 전 스위트
- 의도된 테스트 갱신: 새 세트 → 새 이모티콘 만들기 라벨, 홈 순서(창작 표면 먼저), 앱 바탕 #FAF8F2, 노랑 토큰 값

## H. 실기기 캡처 (Galaxy S24 Ultra, 무선 ADB)
1차 `device/` (APK a58ae6ba): 01 Home · 09 Board · 02 Painter · 03 Brush · 04 Brush details · 05 Color · 06b Caption 입력 · 06 Caption 선택 · 07 Reference · 07b 기본 레퍼런스 · 07c Layers · 08 Motion
2차 `device-v2/` (APK 3b161c50, 수정 후): 같은 화면 + 10 Export(요약·손볼 곳·제출 준비·파일 묶음)

## I. 캡처 검토에서 발견 → 직접 수정
| # | 등급 | 캡처에서 본 것 | 원인 | 수정 | 재확인 |
|---|---|---|---|---|---|
| V1 | P1 | 홈 창작 표면 그림 자리가 "내 그림으로 시작" 글자와 겹침 | 그림 자리를 오른쪽 아래에 둠 | 오른쪽 위로 이동·크기 112 | device-v2/01-home |
| V2 | P1 | 모든 그리기 화면에서 캔버스가 위에 붙고 도구 줄 위로 빈 회색 띠(약 150dp), 굵기 조절이 캔버스 가운데와 어긋남 | **네이티브 WebView 가 width/height 지정을 무시하고 영역 전체(0,381–1080,1882)를 채움** → 캔버스 페이지가 정사각 면을 맨 위에 그림 | WebView 를 정사각 틀(View, overflow hidden)로 감쌈. 엔진·좌표 변환 불변 | 러너가 읽은 캔버스 bounds 0,591–1080,1671(가운데), device-v2/02 |
| V3 | P1 | 문구 입력 중 입력 줄 위에 빈 흰 띠 | 키보드 중에도 도구 줄 자리(115dp)를 비워 둠 | 입력 중 도구 줄 높이 0 → 캔버스가 그만큼 커짐 | device-v2/06b |
| V4 | P2 | 참고·레이어·문구 선택 알약이 모서리 없는 네모로 보임 | Android 에서 LayoutAnimation 뒤 둥글기 누락 | 알약에 overflow hidden | device-v2/06b·07 |
| V5 | 회귀 | 자동 검사 첫 실행: 완성 세트 내보내기 요약에서 공식 규격 이름이 사라짐 | 요약 문구 교체 | "세트를 모두 완성했어요 · 규격 이름" | ux-test PASS |
| V6 | 규칙 | 배치·부가 이미지 화면에 2px 노랑 선택 박스 5곳, 900 굵기 12곳 남음 | 1차 적용 범위 밖 | 표면형 선택·700/800 | visual-system-test PASS |

## J. 기능 회귀 — 실기기 스모크(`device-qa/report.json`, APK 3b161c50)
**20/20 ok**: 설치 · 시작 배경(어두운 화소 최대 1.5%) · 홈 · 새 세트 캔버스 · 선 긋기 · 브러시 다시 누르기 시트 · 굵기 끌기 · 색·최근 색 · 지우개 · 되돌리기/다시 · 참고·레이어 · 문구 직접 · 움직이기 3종(캔버스 변화 통통 .0171 · 흔들기 .0174 · 두근거리기 .0013 · 없음 0, 없음→통통 재생 포함) · 완성·다음 · 이전 칸 + 직전 움직임 · 보드 · 내보내기 · logcat 치명 0.
러너 수정(앱 결함 아님): 캔버스가 가운데로 옮겨져 고정 좌표 획이 캔버스 밖 → 실제 WebView bounds 안에 긋기, 움직이기 카드 좌표 새 배치로, 두근거리기 바닥값 .0008(가는 선에서 실측 .0013~.0018).

## K. 남은 문제
- P0 0 · P1 0
- P2: 움직이는 세트 내보내기 요약은 "/ 24" 인데 결과 격자는 32칸(칸 수 모델은 32 고정 — 시각이 아니라 규격 로직, 이번 라운드 범위 밖) · 세부 설정을 펼치면 선 보정 줄이 시트 스크롤 아래(640dp급·S24 에서 한 번 스크롤) · 캔버스 위아래 띠(정사각 캔버스의 구조적 여백, 따뜻한 중립색)
- 앱 표시 이름(app.config `나의 이모티콘 작업실`)과 홈 브랜드 `임티제작소` 불일치 — 스토어 문서(37차)와 함께 정할 일

## L. 최종 에셋이 들어오면
`src/design/asset-slots.ts` 의 `source` 만 require 로 교체(비율 유지) → HOME_NOTICE/EXPRESSION_GUIDE/BUILTIN_REFERENCES.ready 켜기 → 기본 레퍼런스 칸 누르기를 기존 참고 흐름에 연결 → 앱 표시 이름·스토어 그래픽 정렬 → 같은 캡처 스크립트로 10화면 재검토.
