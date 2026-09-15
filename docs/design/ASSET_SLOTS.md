# 임티제작소 에셋 자리 규격 (40차, 41차 실제 배치로 보정)

> 41차: 제작 발주용 전체 명세는 `docs/design/ASSET_PRODUCTION_SPEC.md`, 생성 AI 전달 문서는 `docs/design/ASSET_GENERATION_HANDOFF.md`. 이 표는 앱 안 자리 요약이다.

코드 원본: `src/design/asset-slots.ts` (`ASSET_SLOTS`). 화면은 `AssetSlot` 컴포넌트(`src/components/ui.tsx`)로 이 자리를 그린다.
에셋이 없으면 따뜻한 도형 자리표시가 같은 크기로 그려진다. **에셋을 넣을 때는 `source` 만 `require(...)` 로 바꾸고, 비율이 다른 그림을 넣지 않는다.** 레이아웃은 다시 짜지 않는다.

| 자리 | 쓰는 곳 | 비율(w:h) | 표시 크기(dp) | 안전 영역 | 바탕 |
|---|---|---|---|---|---|
| `homeHeroArtwork` | 홈 창작 표면 오른쪽 위(right 14 · top 16) | 1:1 | 96 (폭 < 380dp) / 112 | 주 피사체는 칸의 오른쪽 79% × 위쪽 89% 안 — 왼쪽 21%(제목)·아래 11%(행동 줄) 비움 | 투명 PNG |
| `homeEmptyArtwork` | 홈 최근 작업이 비었을 때 | 4:3 | 120×90 | 가운데 80% | 투명 |
| `noticeArtwork` | 홈 공식 알림 카드 왼쪽 (`HOME_NOTICE.enabled`) | 1:1 | 44×44 | 가운데 76% | 투명 |
| `referencePoseThumbnail` | 참고 › 기본 레퍼런스 한 칸 (관절 인형 전신) | 3:4 | 64×85 (가로 스크롤 줄) | 위아래 6%, 좌우 10% | 불투명(흰/크림) |
| `motionExampleArtwork` | 움직이기 효과 견본(칸에 그림이 없을 때) | 1:1 | 48×48 견본 칸 안 41×41 | 가운데 86% — 통통 위로 16%, 흔들기 ±9°, 두근거리기 1.14배에서도 칸 안 | 투명 |
| `exportSuccessArtwork` | 내보내기 요약 표면 오른쪽(세트 완성 시) | 1:1 | 84×84 | 가운데 84% | 투명 |
| `proFeatureArtwork` | PRO 화면 위쪽 전후 비교 — 16:9 표면은 앱이 그림 | 1:1 두 장 | 86×86 × 2 (가운데 화살표·아래 라벨은 앱) | 가운데 84%, 두 장 같은 크기·바닥선 | 투명(따뜻한 표면 위) |

## 기능 자리(에셋과 함께 켜는 것)
- `EXPRESSION_GUIDE.enabled = false` — 켜면 Painter 캔버스 위 한 줄 힌트(`ExpressionHint`). 꺼져 있으면 아무것도 그리지 않는다.
- `BUILTIN_REFERENCES = { enabled: true, ready: false, categories: 포즈·표정·손동작·효과, placeholderCount: 8 }` — `ready=false` 동안 칸은 누를 수 없는 준비 중 자리표시다. 에셋이 들어오면 칸을 `referencePoseThumbnail` 로 채우고 누르면 기존 참고 사진과 같은 옮기기·크기·진하기 흐름으로 넣는다.
- `HOME_NOTICE.enabled = false` — 켜면 창작 표면과 최근 작업 사이에 카드 하나. 꺼져 있으면 간격도 0.

## 그림 톤
- 2~2.5등신 짤뚱한 캐릭터·관절 인형. 손그림 선, 사용자의 그림보다 "더 잘 그린" 인상을 주지 않는다.
- 노랑(#FFD02F)은 작은 포인트로만. 표면 전체를 노랗게 칠하지 않는다.
- 카카오 캐릭터·로고·색 조합을 따라 하지 않는다.
