# 세트 종류(멈춰있는 32 · 움직이는 24) 설계 — 41.5차 (2026-09-15)

상태: **DESIGN LOCKED · IMPLEMENTATION NOT STARTED** — 코드는 바꾸지 않았다(아래 §7 이유).
기준 커밋: `f978e36`. 규격 원본: `src/constants/kakao-spec.ts`(`KAKAO_STATIC_SPEC.count 32` · `KAKAO_ANIMATED_SPEC.count 24`, 둘 다 VERIFIED 2026-09-12).

## 1. 목표(제품 결정 — 사용자 지시)
- 새 이모티콘 만들기 → **세트 종류 선택** → 멈춰있는 이모티콘 **32칸** / 움직이는 이모티콘 **24칸**.
- 폐기: 32칸 세트에서 칸 하나에 움직임을 넣으면 세트 전체를 24 규격으로 판정하는 구조.
- 채택하지 않음(기본 UX): 32칸을 만든 뒤 제출할 24칸을 고르게 하기.
- 이유: 초보자가 **처음부터 필요한 분량을 알고** 끝까지 완성한다.

## 2. 현재 구조와 원인(코드 근거)
| 곳 | 지금 | 문제 |
|---|---|---|
| `src/types.ts:66` Project | 종류 필드 없음 | 종류를 저장할 곳이 없다 |
| `src/project.ts:4-8` createProject | 항상 `KAKAO_STATIC_SPEC.count`(32)칸 | 움직이는 세트도 32칸으로 태어난다 |
| `src/project.ts:60` setIsAnimated | `slots.some(isAnimated)` | 칸 하나로 세트 종류가 뒤집힌다 |
| `src/project.ts:97` parseStore | `slots.length !== 32` 이면 "손상" | 24칸 세트는 **열리지 않는다** |
| `App.tsx:780-797` 내보내기 | `profile = setIsAnimated ? ANIMATED(24) : STATIC(32)` | 요약·제출 준비는 24 |
| `App.tsx:342` setChecks 남은 칸 | `missing === SPEC.count(32)` | 32 기준 |
| `src/services/export.ts:189` | `missing: SPEC.count - count` | 32 기준 |
| `App.tsx:566` 홈 카드 종류 문구 | `setIsAnimated(p)` | 판정식에 의존 |
| `App.tsx:1120` 세트 메뉴 "움직임 한 번에 적용" | `setIsAnimated(project)` 일 때만 | 판정식에 의존 |
| 보드·진행·Painter `N / 32`·다음 칸·이전 칸·재정렬 | 전부 `project.slots.length` / 칸 번호 | **이미 칸 수 독립** — 바꿀 필요 없음 |
| QA `App.tsx:167,180,392` | 칸마다 `slot.motion ? ANIMATED : STATIC` | 칸 단위라 문제 없음 |
| 이전 움직임 `App.tsx:1140` · 묶음 프레임 `App.tsx:428` | 칸 단위 `isAnimated(s)` | 문제 없음 |

## 3. 제안 모델(가장 작은 변경)
```ts
// src/types.ts — Project 에 선택 필드 하나
kind?: 'still' | 'animated';        // STAGES 의 이름(still / animated)과 같게

// src/project.ts
export const SET_COUNT = { still: KAKAO_STATIC_SPEC.count, animated: KAKAO_ANIMATED_SPEC.count } as const;
export function createProject(name, character, kind: 'still' | 'animated' = 'still'): Project   // slots = SET_COUNT[kind]
// 세트 종류의 단일 원천. 새 세트는 저장된 kind, 옛 세트(kind 없음)는 지금과 똑같이 판정한다.
export const setKind = (p: Project): 'still' | 'animated' => p.kind ?? (p.slots.some(isAnimated) ? 'animated' : 'still');
export const requiredCount = (p: Project) => SET_COUNT[setKind(p)];
// parseStore 칸 수 검사
//   kind 있음 → slots.length === SET_COUNT[kind]
//   kind 없음 → slots.length === 32   (지금 규칙 그대로)
//   kind 가 낯선 값 → 손상
```
- `setIsAnimated` 는 `setKind(p) === 'animated'` 로 바꾸고 이름은 호출처 정리 때 제거.
- 화면: 내보내기 `profile`·`need` ← `setKind`, 남은 칸·`missing` ← `project.slots.length`(칸이 곧 만들 분량), 요약 분모 ← `requiredCount`.
- 규격 숫자는 계속 `kakao-spec.ts` 한 곳.

## 4. 옛 저장 데이터(kind 없음, 32칸) — 절대 깨지지 않는 규칙
공통: **자동으로 kind 를 쓰지 않는다**(열기만 해서 저장 파일이 바뀌지 않는다). 칸 삭제·잘라내기·24칸 축소 **없음**. 25~32번 칸의 그림·움직임·문구는 그대로 보이고 고치고 내보낼 수 있다.

| 경우 | 열 때 | 보드 | 내보내기 | 저장 |
|---|---|---|---|---|
| 1. 움직임 없는 32칸 | `setKind` = still | 32칸(지금과 동일) | 멈춰있는 규격 32 | kind 쓰지 않음 |
| 2. 일부 칸에 움직임 있는 32칸 | `setKind` = animated(지금과 동일한 판정) | **32칸 그대로** | 움직이는 규격(필요 24)으로 요약하되, 칸이 32개인 옛 세트임을 한 줄로 알림: "예전에 만든 세트라 칸이 32개예요. 24개를 채우면 제안할 수 있어요." 묶음에는 완성한 칸 전부 | kind 쓰지 않음 |
| 3. 이미 완성된 옛 세트 | 1·2 와 같음 | `done` 표시 보존 | 1·2 와 같음. 완성 32/32 인 움직이는 옛 세트는 "24개 이상 채웠어요" | 변화 없음 |
| 4. 빈·부분 작업 옛 세트 | 1·2 와 같음 | 그대로 | 그대로 | 변화 없음 |

- 옛 세트가 나중에 움직임을 얻거나 잃으면: 지금처럼 판정이 따라간다(옛 세트에 한해 동작 변화 0). 새 판정 규칙은 **새 세트부터**.
- (선택, 나중) 세트 메뉴 "세트 종류 정하기": 옛 세트에 kind 를 **사용자가 명시적으로** 저장. still 은 항상 가능. animated 는 칸이 32개로 남는 "옛 움직이는 세트"로 저장(칸을 줄이지 않음). 이번 설계 범위 밖.
- 새 버전으로 만든 24칸 세트를 **옛 앱 버전**이 열면 `slots.length !== 32` 로 "손상" 판정 → 롤백 설치 시 열리지 않는다. 대응: 새 저장 형식 첫 쓰기 전 파일 버전 표식을 두거나, 출시 전이라(`released: []`) 롤백 경로가 없음을 기록. **구현 시 결정 필요(D3).**

## 5. 새 세트 흐름(40차 시각 체계 그대로)
```
홈 · 창작 표면 [새 이모티콘 만들기]
  └ 아래에서 올라오는 짧은 선택 시트(기존 Dialog/SheetHeader 스타일, 새 화면 아님)
      제목: 어떤 이모티콘을 만들까요?
      ┌──────────────────────────────┐
      │ 멈춰있는 이모티콘              │  ← 큰 선택 줄(흰 표면, 48dp+)
      │ 32개를 그려요                  │
      └──────────────────────────────┘
      ┌──────────────────────────────┐
      │ 움직이는 이모티콘              │
      │ 24개를 그리고 움직임을 붙여요  │
      └──────────────────────────────┘
  └ 고르는 즉시 세트 생성 → 01번 빈 캔버스(지금과 같은 "바로 그리기")
홈 · [내 그림으로 시작] → 같은 시트 → 사진 고르기 → 01번에 가져오기
```
- 시트 닫기 = 만들지 않음(아무것도 저장되지 않음). 확인 단계 추가 없음, 세트 이름 입력 없음(지금처럼 자동 이름).
- 홈 카드·보드 머리에 이미 "멈춰있는/움직이는 이모티콘" 문구가 있다 → `setKind` 로 바꾸기만.
- 쓰지 않는 말: 규격·프로필·슬롯·WebP·PNG(선택 시트에서).

## 6. 열린 제품 결정(구현 전에 사용자가 정해야 함)
| # | 질문 | 선택지 | 권장 |
|---|---|---|---|
| D1 | **멈춰있는 세트에서 움직이기 탭**을 어떻게 할까 | (a) 숨긴다 (b) 두되 내보내기는 멈춤 규격(움직임 파일은 참고용) (c) 움직임을 넣으면 "움직이는 세트로 바꿀까요" 안내 — 칸 수가 달라 전환 불가 | (a) — 초보자 혼동이 가장 적다. 단 39차 흐름·실기기 러너(새 세트에서 움직임 사용)를 "움직이는 세트" 선택으로 바꿔야 한다 |
| D2 | 옛 움직이는 32칸 세트 알림 문구 | §4 표의 한 줄 | 문구 확정 |
| D3 | 새 형식(24칸·kind) 저장본을 옛 앱이 열 때 | 버전 표식 / 기록만 | 출시 전이면 기록만 |
| D4 | 세트 종류를 나중에 바꾸기 | 제공 안 함 / 칸 수가 같은 방향만 | 제공 안 함(v1) |

## 7. 이번 라운드에서 구현하지 않은 이유
- 저장 검증(`parseStore`)을 바꾸는 일은 **잘못되면 기존 세트 전체가 "손상"으로 열리지 않는** 경로다(데이터 손실은 아니지만 사용자에게는 같은 결과). 지시 E: 위험이 조금이라도 있으면 설계까지만.
- D1 이 정해지지 않으면 Painter 움직이기 탭 노출(흐름)이 달라진다 — 41.5차 금지 범위(Painter/흐름 변경).
- 테스트 30여 곳이 32칸을 전제한다(아래) — 구현과 같은 커밋에서 바꿔야 한다.

## 8. 구현 때 바꿀 곳과 회귀 테스트
코드: `src/types.ts`(kind) · `src/project.ts`(SET_COUNT·createProject·setKind·requiredCount·parseStore) · `App.tsx`(createNewProject·startFromImage 선택 시트, 566 카드 문구, 342 남은 칸, 780-797 내보내기, 1120 세트 메뉴, 1022 세트 관리) · `src/services/export.ts:189` · D1(a)면 `src/painter/painter.tsx` 탭 조건(`kind` prop 하나).
기존 테스트 영향: `motion-v1-test.cjs:97,252` · `ux-test.cjs:509,579,642,798,812` · `export-test.cjs:196` · `e2e-test.cjs:161` · `flow-test.cjs:232` · `spec-test.cjs:58`(상수, 유지) · `slot-repeat-test.cjs:84`(≥24, 유지) · `scripts/device-qa.cjs`(새 세트 흐름).
새 회귀(구현 커밋 필수):
1. 새 멈춰있는 세트 = 32칸, kind still
2. 새 움직이는 세트 = 24칸, kind animated, 저장→재시작→열림
3. 옛 32칸(kind 없음, 움직임 없음) 열림 · 저장 파일 바이트 불변(열기만 할 때)
4. 옛 32칸(kind 없음, 일부 움직임) 열림 · 25~32번 칸 그림·움직임·문구 보존 · 내보내기 묶음에 포함
5. 칸 데이터 손실 0(모든 칸 JSON 비교)
6. kind 와 칸 수가 어긋난 저장본(animated + 32, still + 24)은 손상으로 거절하되 **원본 파일은 건드리지 않음**(기존 복구 규칙)
7. 보드 칸 수 · 진행 분모 · Painter `NN / 24` · 완성 · 다음이 24에서 끝남 · 내보내기 요약 분모 = requiredCount · `missing` = 칸 수 − 완성
