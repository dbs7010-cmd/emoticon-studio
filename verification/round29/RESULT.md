# 29차 결과 — MOTION V1 CLOSEOUT (2026-09-14)

판정: **PASS (자동 검증 범위)** — 실기기 항목은 사용자 직접 검수로 미룸(docs/MANUAL_QA.md). 새 APK·BrowserStack 없음(사용자 결정).

## 현재 움직임 구조 (코드 기준)
- 저장: `Slot.motion`(선택) `{version:1, preset?, speed, strength, parts?, play?, stagger?, alternate?, captionMoves?}` + `Slot.motionImage`(GIF) + `Slot.submitImage`(WebP). 그림(`work`)과 분리.
- 엔진(canvas-html): 하나의 루프(`loopSeconds`) 안에서 전체 효과(`wholeDelta`)·부분(`partDelta`, 정수 배 주기)·두 모습(`poseHides`)을 레이어 변환으로 합성. 미리보기와 파일이 같은 `buildLoop()`. 잘림 감지 `motionClips`.
- 화면(motion-panel): 기본(효과 3카드·속도·세기·문구 고정·없애기) / 부분만 움직이기(PRO) / 보관함. 하단 취소·적용 고정, 재생 줄 상단 고정.
- 권한: `usesPro` = parts 또는 alternate. 새로 만들거나 바꾼 PRO 내용만 저장 시 확인(`proIsNew`), 이미 저장한 PRO 효과는 계속 재생·재저장.
- 일괄 적용(App `applyMotionToMany` + MotionBaker)·보관함(`Store.savedMotions`).

## A/B/C/D
| 기능 | 분류 | 근거 |
|---|---|---|
| 통통·흔들기·두근거리기 | A | PRESETS, wholeDelta |
| 속도·세기 | A | Row 0~1(0.05 단계), loopSeconds·strength |
| 즉시 미리보기 | A | 효과 선택 → motion 명령, 탭 진입 play |
| 저장 후 재시작 복원 | **B → 완성** | 저장은 됐으나 Painter `init` 이 `slot.motion` 을 보내지 않아 다시 연 칸의 캔버스에 움직임이 없었고, 그 상태로 저장하면 움직임·움직이는 파일이 지워졌다. **수정함** |
| 특정 레이어 지정 | A | parts[].layerId, '그림 N 부분 움직임 추가' |
| 이동(방향·시작/끝 지점) | A | effect move, angle / fromX~toY |
| 회전·크기(중심점) | A | rotate / scale, pivot |
| 두 모습 교대 | A | alternate.poseB·interval, 첫 모습 복사 |
| 여러 움직임 조합 | A | 전체 효과 + 부분 여러 개(최대 8, 검증) |
| 시작 간격/타이밍 | A | play together/sequence, stagger, 부분 speed |
| PRO 소개 문구 | B → 수정 | '움직임 저장·일괄 적용'을 PRO 혜택으로 적었으나 코드상 무료. 실제 PRO 인 '차례로 움직이기·시작 간격'으로 교체 |
| D(위험·대규모) | 없음 | 키프레임/타임라인·경로 곡선·이징 편집은 V1 범위 밖이며 구현하지 않음 |

## 자동 검증
- `npm test` 전체 PASS (tests.log). 신규 `scripts/motion-v1-test.cjs`(실제 App·저장소·images 서비스, 엔진만 흉내).
- **수정 효과 증명**: 수정을 잠시 되돌리면 같은 테스트가 "통통: 재시작 뒤 캔버스가 저장된 움직임을 받는다"에서 실패(motion-v1-without-fix.log), 복원 후 해시 동일·PASS.
- `motion-test.cjs`(Chromium 엔진) PASS (motion-test.log): 무료 3종 이음새 없는 반복·잘림 없음, 그림 수정 후 움직임 유지, PRO 부분 회전·이동, 두 모습, 문구 고정/동행, 실제 GIF/WebP 판독.
- typecheck PASS.
