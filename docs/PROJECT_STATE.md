# PROJECT STATE

## LOCKED
- `docs/MASTER_SOURCE.md` 전체

## DONE — 기존 V1
- Expo SDK 57 모바일 앱
- 로컬 프로젝트/32 슬롯
- CANON
- 기본 Painter
- PNG 저장/공유
- 기본 QA
- 로컬 이중 저장/복구
- 4열 결과 슬롯 보드
- 슬롯 선택 → Painter 직행

## CURRENT
Painter 한 화면 연속 제작 흐름 강화.

이번 브랜치 `feat/painter-flow-v1` 변경:
- Painter 하단 Reference 스트립
- Reference 빠른 단독 ON/OFF
- Reference 이동/scale/rotation/opacity/delete 경로
- 새 Reference를 프로젝트 전체 슬롯에 공유
- 저장된 슬롯에도 새 공용 Reference 병합
- Draw Layer 1/2 유지
- 기본/연필/마커 직접 선택
- 펜/지우개 별도 굵기와 +/- 빠른 조절
- CANON 상시 작은 미리보기 + 크게 보기
- 명시적 `저장 → 다음`
- 두 손가락 pinch/pan 캔버스 제스처 추가
- 저장 시 레이어/PNG/슬롯 썸네일 기존 흐름 유지

## VERIFICATION STATUS
- 코드 변경 및 Git diff 범위 확인 완료
- 자동 테스트 코드는 새 흐름에 맞춰 갱신
- 이 환경에서는 npm/Expo 의존성을 실행할 수 없어 typecheck/test/bundle은 아직 실행하지 못함
- 실제 Android Expo Go 실기기 검증 필요

## CURRENT ACCEPTANCE CHECK
1. HOME → 슬롯 → Painter 직행
2. Reference 스트립이 항상 보임
3. Reference 1 탭 → ON, 다시 탭 → OFF
4. 다른 Reference 탭 → 즉시 교체
5. Reference 이동/크기/투명도 조절
6. Draw Layer 1/2 전환 및 이동
7. 기본/연필/마커
8. 펜/지우개 굵기 독립 조절
9. 한 손가락 드로잉
10. 두 손가락 pan/zoom 중 의도치 않은 선 없음
11. 저장 → 현재 슬롯 썸네일 반영
12. 저장 → 다음 → 같은 Painter 흐름에서 다음 슬롯
13. 다음 슬롯에서도 공용 Reference 그대로 사용
14. 앱 재실행 후 작업/레이어/Reference 유지

## NEXT
실기기에서 위 체크를 한 번에 검증하고 실제 발생한 문제만 수정한다.
그 전에는 AI 고도화/움직이는 이모티콘/PRO 기능을 추가하지 않는다.

## BLOCKED
- 실제 Android/iPhone Painter 사용감 미검증
