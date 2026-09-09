# PROJECT STATE

## LOCKED
- `docs/MASTER_SOURCE.md` 전체
- 핵심 리듬: `그린다 → 저장 → 다음 칸 → 반복 → 1세트 완성`
- 초보 성인 상업 이모티콘 제작툴이며 범용 Painter/어린이 스티커 앱이 아니다.
- 무료판도 실제 1세트 완성/저장/제출이 가능해야 한다. 유료는 생산성/편의/전문 기능을 추가한다.
- Visual System V1.1: 밝은 아이보리/화이트 기반 + 제한된 파스텔 포인트 + 진한 차콜 텍스트.
- 앱 내 그래픽은 귀엽지만 디테일하지 않은 러프한 두들 감성으로 통일한다.
- Infinite Painter는 상호작용/작업성 참고만 하며 시각 디자인을 복제하지 않는다.
- 대사/무대사 기획은 Painter가 아니라 이후 `세트 기획` 단계의 역할이다. Painter 기본 화면은 슬롯 진행과 그림 작업에 집중한다.

## DEVICE VALIDATED
- 저장 → 슬롯 썸네일 반영
- 저장 → 다음 슬롯 연속 이동
- 공용 참고 이미지가 다음 슬롯에도 유지
- 두 손가락 짧은 탭 = 되돌리기 동작 확인
- 지우개 정상 동작 확인
- 참고 이미지 자체 확대/축소 동작 확인
- 새 Home Visual 방향이 이전 관리 폼보다 작업실에 가까워짐

## LATEST DEVICE FEEDBACK
- Painter 상단 `01 / 32 · 무대사/대사` 표시는 현재 단계에서는 뜬금없음 → **Painter에서 대사 표시/수정 제거**.
- 세 손가락 탭 Redo는 실기기에서 동작하지 않음 → **gesture history 보존 버그 수정 코드 반영, 재검증 대기**.
- 참고 이미지 확대는 PASS.
- 참고 이미지 이동은 최신 빌드에서 별도 재확인 필요.
- 레이어 레일/전체 UI 사용감은 계속 실기기 검증 중.

## IMPLEMENTED — CURRENT BRANCH `feat/painter-flow-v1`
### PRODUCT UX P0
- HOME: 상시 입력 폼 제거, 2열 프로젝트 작업실 카드 + `새 세트` 액션.
- SET BOARD: 원캐릭터/진행률/4열 슬롯, 슬롯 → Painter 직행.
- PAINTER: 캔버스 우선, 참고 스트립, 최소 그림 도구, 저장 → 다음 칸.
- LAYER: 상단 버튼 → 우측 좁은 플로팅 레이어 레일.
- REFERENCE: `activeDrawLayerId`와 `activeReferenceId` 분리, 선택 참고를 두 손가락으로 이동/확대.
- VISUAL: 웜 아이보리/화이트 + 제한된 파스텔 + 차콜 텍스트.
- 두 손가락 Undo / 세 손가락 Redo 제스처 엔진.

### LATEST FIXES — DEVICE FEEDBACK ROUND 3
1. Painter 상단에서 대사/무대사 및 브리프 편집 UI 제거.
   - 상단은 `이모티콘 세트` + `01 / 32` 진행만 표시.
   - 기존 슬롯 dialogue 데이터는 삭제하지 않고 그대로 보존/저장.
   - 대사 기능은 다음 `세트 기획` CURRENT에서 제대로 배치한다.
2. 세 손가락 Redo 수정.
   - 첫 손가락이 닿는 순간 임시 stroke checkpoint가 redo future를 지우던 문제 수정.
   - multi-touch가 실제 이동/핀치로 판정되기 전에는 reference transform checkpoint를 만들지 않음.
   - 두/세 손가락 탭 허용 시간을 450ms로 조정하고 작은 손가락 흔들림 허용 범위를 확대.
3. `scripts/ux-test.cjs`를 Painter 무대사 UI 제거 구조에 맞춰 갱신.

## VERIFICATION STATUS
- GitHub 코드 반영: DONE
- 이전 Android 실기기: Undo PASS / 지우개 PASS / 참고 확대 PASS
- 최신 `npm run typecheck`: **UNVERIFIED**
- 최신 `npm run test:ux`: **UNVERIFIED**
- 최신 Android Expo Go:
  - Painter 대사 제거: **UNVERIFIED**
  - 세 손가락 Redo 수정: **UNVERIFIED**
  - 참고 이미지 이동: **UNVERIFIED**

## CURRENT ACCEPTANCE CHECK
1. Painter 상단이 `01 / 32` 진행만 보여 자연스러운가
2. 두 손가락 탭 Undo 정상
3. 세 손가락 탭 Redo 정상
4. 참고 선택 후 두 손가락 이동 = 참고 이미지 자체 이동
5. 참고 선택 후 핀치 = 참고 이미지 자체 확대/축소
6. 상단 레이어 → 우측 레이어 레일 접근이 편한가
7. 저장 → 슬롯 반영 → 다음 칸 유지
8. 기존 dialogue/저장 데이터 손실 없음

## NEXT
위 8개 실기기 검증에서 나온 실제 문제만 수정한다.
P0가 안정되면 별도 CURRENT로 `세트 기획 화면 + 대사/무대사 초안 + 참고 이미지 슬롯 배치`를 구현한다.
AI 고도화/움직이는 이모티콘/PRO는 그 뒤다.

## BLOCKED
- 최신 브랜치 typecheck/자동 테스트/Android 실기기 재검증.
