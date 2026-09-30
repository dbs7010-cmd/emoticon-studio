# 45.42 시각 완성도 — 실제 적용 계획 (착수 전 정리, 코드 변경 없음)

## 확정된 것(2026-09-28 사용자)
- White Base
- 임티 라인 아이콘 체계(선택 = 노란 면 + 잉크 아이콘)
- 홈 카드 B(18/32 + 막대 + 다음 칸)
- 완료 B(흰 카드 + 작품 + 노란 체크)
- 32칸 시각화는 보드·완료에서 적극 활용
- PRO는 보라 없이 배지·구성으로 표현

**금지:**
- 제품 구조 변경
- Canvas·Motion 정보구조 변경
- 한 번에 대규모 적용

## A. 적용 계획 — 작은 단계, 단계마다 멈춰서 확인

각 단계는 커밋 하나다. 매 단계 **`npm test` 통과 + 대체 렌더(390) 확인**을 거친다. APK는 표시한 단계에서만 만든다.

| 단계 | 내용 | 화면에 보이는 변화 | 확인 |
|---|---|---|---|
| **S0 준비** | `npx expo install react-native-svg`(Expo 공식 모듈, SDK 57 문서 확인함). 테스트 로더(`scripts/load-ts.cjs`)에 `react-native-svg` 기본 목 한 곳 추가 | 없음 | `npm test` |
| **S1 아이콘 부품** | `src/design/icons.tsx` 새 파일: 임티 라인 20종(핵심 11 + 시스템 9)과 `<ImtiIcon>`. **아직 어느 화면도 쓰지 않는다** | 없음 | 새 `icon-test`: 20종 모두 렌더, 선 1.8, 채움 없음, 크기 22/18/14만 |
| **S2 색·상태 토큰** | `src/components/ui.tsx`의 `T` **값만** White Base로 바꾼다. 이름은 유지해 파일 전체를 고치지 않는다. 새 상태 토큰 `S`를 추가한다(pressed · selected · disabled · success) | **앱 전체 바탕이 흰색으로** 바뀐다(크림 → 흰색). 레이아웃 변화 없음 | `visual-system-test` 고정값 갱신 · 대비 검사 유지 · 렌더 26화면 한 번 |
| **S3 공통 상태 UI** | `ui.tsx`에 `EmptyState`(두들 + 행동 하나 + 흐름 아이콘, 지금 코드는 쓰이지 않음 → 새로 설계) · `SaveToast` · `CompleteCard` · `useMicro`(pop 0.28초 · rise 0.24초, `Animated` 네이티브 구동) · 선택/비활성 규칙 함수. **아직 화면에 연결하지 않는다** | 없음 | 부품 단위 검사 |
| **S4 홈** ★먼저 | `App.tsx` 홈 구역만 바꾼다. 머리(PRO 잉크 배지·설정 아이콘), 이어서 카드 B, '새 세트 만들기' 잉크 테두리 버튼, 제안까지 목록 아이콘, '내 그림으로 시작' 한 줄, 빈 홈 = `EmptyState` | 홈만 시안 WB2-Home처럼 | `visual-system`·`ui-structure` 홈 단언 갱신. **APK 1**(홈 실기기 확인, 움직이기 아이콘 22 가독성 포함) |
| S5 보드 | `App.tsx` 보드: 칸 타일 4상태(완성 = 흰 칸 + 노란 체크 배지 · 그리는 중 = 흐린 작품 + 테두리 점 · **지금 칸 = 노란 면 + 잉크 테두리** · 빈 칸 = 점선) · 머리에 32칸 진행 · 전부 완성 시 `CompleteCard` | 보드 | 보드 단언 갱신 |
| S6 PRO | `ProTag` → 잉크 테두리 배지. PRO 시트 맨 위에 전/후 시각 예시(무료 전체 vs PRO 부분), 기능 목록은 그 아래 짧게 | PRO 시트·배지 | `closed-test-ui-test` 문구 일치 검사 유지 |
| S7 Painter·Motion | **아이콘과 상태만.** 도구 줄·모드 줄 보조·패널 머리·레이어 줄 아이콘을 `ImtiIcon`으로 바꾼다. 저장 안내 → `SaveToast`. 선택 = 노란 면 + 잉크 아이콘(지금과 같은 자리). 배치·흐름·캔버스는 그대로 | 그리기·움직이기 아이콘 | 기존 geometry 검사(viewport-matrix)가 그대로 통과해야 한다. **APK 2** |
| S8 정리 | 남은 MDI 사용처 목록화 → 같은 규칙으로 옮기거나 목록으로 남김. 시스템 `Alert.alert` 32곳의 앱 시트 전환은 **별도 판단**(범위 큼) | — | — |

**순서 이유:**
- S0~S3은 화면을 거의 바꾸지 않는 토대다(S2만 바탕색). 그래서 되돌리기 쉽다.
- 홈(S4)은 가장 작은 화면 단위로 확정 디자인 전체를 한 번 검증한다.

**S2의 선택지:**
- **권장: 전체 한 번에.** 토큰 값 교체는 코드 몇 줄이지만 모든 화면의 바탕을 바꾼다. 크림 화면과 흰 화면이 섞인 중간 상태가 더 어색하다.
- **대안:** 홈에서만 새 토큰을 쓰고 나중에 전체를 전환. 토큰이 두 벌이 되고 중간 빌드에서 화면마다 바탕색이 다르다.

## B. 수정 대상 파일과 영향

| 파일 | 단계 | 변경 | 영향 |
|---|---|---|---|
| `package.json`·`package-lock.json` | S0 | `react-native-svg` 추가 | **네이티브 모듈 추가 → prebuild·APK 재빌드 필요.** Expo 공식, 새 권한 없음(확인 예정) |
| `scripts/load-ts.cjs` | S0 | `react-native-svg` 기본 목 | 로더를 쓰는 검사 31개 전부. 목이 없으면 실제 모듈을 불러와 깨진다 |
| `src/design/icons.tsx` (새 파일) | S1 | 아이콘 경로·부품 | 새 파일만 |
| `scripts/icon-test.cjs` (새 파일) · `package.json` test:ux | S1 | 아이콘 검사 | — |
| `src/components/ui.tsx` (332줄) | S2·S3·S6 | 토큰 값 · 상태 토큰 · 공통 부품 · `ProTag` | **토큰 사용 약 1,000곳**(App 456 · painter 360 · motion 103 · ui 118)이 값을 따라 바뀐다. 이름은 그대로라 코드 수정은 ui.tsx뿐 |
| `App.tsx` (1,773줄) | S4·S5·S6 | 홈 · 보드 · PRO 시트 구역 | 홈·보드·PRO만. 설정·내보내기·가이드는 토큰만 따라감. 아이콘 56곳 중 해당 구역만 교체 |
| `src/painter/painter.tsx` (2,278줄) | S7 | 아이콘 교체 · 저장 안내 부품화 | 아이콘 47곳. 박힌 색 44곳 중 UI 색만 토큰으로(색 견본 자료 제외). 배치·엔진 연결 변경 없음 |
| `src/painter/motion-panel.tsx` (481줄) | S7 | 아이콘 교체 · 선택 면 | 아이콘 21곳. 격자·흐름 변경 없음 |
| `src/painter/canvas-html.ts` | — | **변경 없음**(브러시 엔진 금지 · 캔버스 구조 금지) | — |

**검사 영향:**
- 색 값을 고정한 검사 6개: `visual-system` · `ui-structure` · `convenience` · `product-ux` · `ux-test` · `_target` → S2·S4·S5에서 새 값으로 갱신(**원칙 단언은 유지**: 대비 4.5:1, 노랑 하나, 검정 테두리 규칙).
- 아이콘 이름에 의존하는 검사 3개(`color`·`convenience`·`product-ux`):
  - `'plus'` 1곳은 S7에서 갱신한다.
  - `'lock-outline'` 없음 단언은 의미가 그대로 유지된다(잠금 아이콘을 쓰지 않는다).

## C. 공통 토큰 · 아이콘 부품 설계

### C-1. 색 토큰(`T` 값 교체 — 이름 유지)

| 이름 | 지금(45.39) | 바꿀 값 | 비고 |
|---|---|---|---|
| `bg` | `#FFF9EC` 크림 | `#FFFFFF` | White Base |
| `paper` | `#FFFFFF` | `#FFFFFF` | — |
| `surface2` | `#F6EBD3` | `#F6F5F2` | 가라앉은 면(중립) |
| `fill` · `fillPressed` | `#F3EADA` · `#EADFCB` | `#F2F0EC` · `#E8E5DF` | 누름 |
| `ink` · `edge` | `#2A2320` | `#1F1D1A` | 글자·검정 테두리 |
| `muted` · `faint` | `#6F6258` · `#9A8C7F` | `#77716A` · `#B3ADA4` | 대비 검사 유지(muted ≥ 4.5:1) |
| `line` · `lineStrong` | `#EADFCB` · `#D3C4AA` | `#ECE9E3` · `#DCD7CE` | — |
| `cardLine` · `paperLine` | 갈색 | `#ECE9E3` · `#DCD7CE` | 절충안의 '카드 = 옅은 선'은 유지, 색만 중립 |
| `accent` · `accentSoft` · `accentLine` | `#FFCC2E` · `#FFF0B8` · `#F0B800` | `#FFCC2E` · `#FFF4CC` · `#E6AE00` | **Maker Yellow** |
| `warm` · `warmLine` · `warmInk` | 크림 계열 | `surface2` · `line` · `muted`와 같게 | 크림 세계관 제거 |
| `success` · `successSoft` | `#1E7F55` | `#1E8E5A` · `#E3F4EA` | **저장 성공 체크에서만** |
| `pro` · `proSoft` | 보라 | `ink` · `surface2`와 같게 | 보라 제거. PRO는 배지 모양으로 |
| `warning` · `danger` · `info` | 그대로 | 그대로 | 경고·삭제·정보에만 |
| `lilac` · `sky` · `coral` · `mint` · `lavender` · `blue` | 파스텔 | **삭제**(사용처 0) | — |

**새 상태 토큰 `S`:**
```ts
export const S = {
  pressed:  { backgroundColor: T.fill },                              // 누름: 면만(아이콘 94%·카드 98% 축소는 useMicro)
  selected: { backgroundColor: T.accent, borderColor: T.edge },        // 도구·탭형 선택: 노란 면 + 잉크(테두리 2px는 도구 줄만)
  selectedSoft: { backgroundColor: T.accentSoft },                     // 목록형 선택(브러시 줄·레이어 줄)
  disabled: { color: T.faint },                                        // 선·글자 색만 옅게 — 투명도로 흐리지 않는다(지금 .5/.45/.3 혼재 정리)
  success:  { color: T.success, backgroundColor: T.successSoft },
} as const;
export const Motion = { pop: 280, rise: 240, press: 100 } as const;    // ms, 0.1~0.3초
```

### C-2. 아이콘 부품 `src/design/icons.tsx`

```ts
type IconName =
  // 핵심(직접 그림) — '손그림 한 획'은 brush · caption · motion 셋만
  | 'brush' | 'eraser' | 'fill' | 'color' | 'reference' | 'layer' | 'caption' | 'motion' | 'export' | 'save' | 'pro'
  // 시스템(보편 모양, 같은 선) — 선택 상태 없음, 누름만
  | 'back' | 'close' | 'delete' | 'eye' | 'eyeOff' | 'undo' | 'redo' | 'more' | 'check' | 'settings' | 'next' | 'plus';
export const IconSize = { tool: 22, row: 18, meta: 14 } as const;
export function ImtiIcon(p: { name: IconName; size?: 22 | 18 | 14; color?: string; disabled?: boolean; accessibilityLabel?: string }): JSX.Element;
```

**규칙:**
- 24 격자, `strokeWidth` 1.8(크기에 비례), 둥근 끝·둥근 이음, `fill="none"`.
- 색 기본 `T.ink`, `disabled`면 `T.faint`.
- **선택은 아이콘이 아니라 담는 면이 표현한다**(`S.selected`). 부품 안에 선택 상태를 두지 않아 한 방식만 남긴다.
- 경로 원본은 시안 `WB2-Icons`의 SVG와 같다. 한 곳(icons.tsx)에만 둔다.
- 접근성:
  - 글자가 옆에 있으면 아이콘은 숨긴다(`accessibilityElementsHidden`).
  - 아이콘만 있는 버튼은 버튼 쪽에 이름을 둔다(지금 규칙 그대로).
- MDI(`@expo/vector-icons`)는 S8까지 보조 자리에 남는다. **같은 화면 구역 안에서는 섞지 않는다**(구역 단위로 통째 교체).

### C-3. 공통 상태 부품(S3)

| 부품 | 모양(확정 시안) | 쓰는 곳 |
|---|---|---|
| `EmptyState` | 가라앉은 면 위 두들 캐릭터 + 아이콘 + 제목 한 줄 + 설명 한 줄 + 노란 행동 하나 + '그리기 › 움직이기 › 내보내기' 흐름 아이콘(선택) | 빈 홈(S4), 빈 목록 |
| `SaveToast` | 흰 알약 + 초록 체크(그려짐 0.3초) + 칸 번호 + 잉크 '다음 칸' 버튼, 0.24초 올라옴 | Painter 저장(S7), 이후 다른 저장 |
| `CompleteCard` | 흰 카드 + 노란 체크 튀어 오름 + '32칸 완성!' + 작품 격자 + 노란 CTA | 보드 전부 완성(S5), 내보내기 준비 완료 |
| `ProBadge` | 잉크 테두리 + 반짝 아이콘 + 'PRO' (크기 2) | `ProTag` 대체(S6) |
| `useMicro()` | `Animated` 네이티브 구동: pop · rise · press | 위 부품들 |

## 멈춤
이 문서는 계획이다. 승인되면 **S0 → S1 → S2 → S3 → S4(홈)**까지 진행하고, 홈 APK에서 멈춰 실기기 확인을 받는다.
