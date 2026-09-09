# EMOTICON STUDIO — MASTER SOURCE

## PRODUCT — LOCKED
휴대폰에서 상업 이모티콘 1세트를 쉽고 빠르게 끝내는 전용 제작툴.
일반 그림앱, 어린이 스티커 놀이앱, AI 완성그림 생성기가 아니다.

1차 타깃은 카카오/메신저 이모티콘 부업·작가 데뷔에 도전하는 성인 초보다.
Procreate/Clip Studio/Photoshop을 먼저 배우지 않아도 실제 제출 가능한 세트를 완성할 수 있어야 한다.
쉬워도 유치하지 않고 성인 창작 작업도구의 느낌을 유지한다.

## CORE UX — HIGHEST PRIORITY
제품의 본체는 Painter 한 화면의 연속 제작 흐름이다.

프로젝트/CANON/레퍼런스 준비
→ 슬롯 01 Painter
→ 레퍼런스를 캔버스 밑에 켜고 직접 그림
→ 저장
→ 슬롯 01 썸네일 자동 반영
→ 같은 Painter에서 슬롯 02
→ 그려 저장
→ 반복
→ 1세트 완성
→ 자동 QA
→ 제출용 Export

핵심 리듬: `그린다 → 저장 → 다음 → 그린다 → 저장 → 다음`.
작업 중 Home/Detail/설정 화면을 반복 왕복하게 만들지 않는다.

## HOME / SET BOARD
전체 결과 확인용이다.
- 프로젝트명
- CANON 작은 이미지
- 완료 수
- 슬롯 썸네일 그리드

슬롯 선택 시 Painter로 바로 진입한다.
긴 설정, 긴 QA, 설명 카드, 큰 상태 텍스트를 기본 화면에 노출하지 않는다.

## PAINTER — LOCKED
필수:
- 이전/현재/다음 슬롯
- 대사 입력 + 간단 추천
- 자연스러운 펜 입력
- 기본 펜/연필/마커
- 지우개
- 펜·지우개 별도 굵기
- 빠른 색 선택
- Undo/Redo
- Draw Layer 1/2
- 레이어 보임/숨김, 이동, scale, opacity
- 여러 Reference
- Reference ON/OFF, 이동, scale, opacity, 삭제
- CANON Quick View
- 한 손가락 드로잉
- 두 손가락 pan/zoom
- 투명 PNG
- 저장 → 슬롯 반영
- 저장 → 다음

Reference는 캔버스 밑에 까는 작업 레이어이며 최종 Export에 포함하지 않는다.
Reference는 타인의 결과물을 복제하기 위한 것이 아니라 포즈/표정/구도 참고 후 자기 캐릭터로 재창작하기 위한 자료다.

## AI ROLE — LOCKED
AI는 작업을 방해하지 않는 보조자/사전심사 역할이다.
기본:
- 대사 추천
- 대사 중복/세트 밸런스 확인
향후:
- 레퍼런스 자동 분리·태깅·추천
- CANON 일관성 검사
- 제출 전 AI QA

최종 그림을 AI가 대신 제작하는 것이 핵심이 아니다.

## QA
최종적으로 다음을 자동 검사한다.
- 필수 슬롯 수
- PNG/캔버스/투명영역/파일크기
- 누락
- 대사 중복
- CANON 대비 편차
- 슬롯 반복
- 제출 준비 상태

PASS/WARNING/FAIL은 사전검수이며 실제 플랫폼 승인을 보장하지 않는다.
공식 확인되지 않은 규격은 VERIFIED로 만들지 않는다.

## MONETIZATION — LOCKED
원칙: **완성은 무료, 생산성은 유료.**

FREE만으로 캐릭터 등록 → 한 세트 제작 → 기본 Painter/Layer/Reference → 저장 → 기본 QA → 제출용 Export가 가능해야 한다.
무료판에서 Export, 슬롯 수, 저장 횟수, 상업 사용을 막거나 워터마크를 넣지 않는다.

PRO는 더 빠르고 전문적으로 만드는 기능이다.
후보: 고급 브러시/레이어, stabilizer, eyedropper, transform 고도화, AI 분석, reference 자동화, 백업, 멀티플랫폼 export, batch export, 움직이는 이모티콘.

## NOT NOW
- 로그인/결제 구현
- 커뮤니티/팀 협업
- 복잡한 서버/SaaS 관리
- Photoshop/Procreate 복제
- 수십 레이어/PSD/고급 마스크
- 자동 플랫폼 제출
- 움직이는 이모티콘
- 과도한 AI 이미지 생성
- 개발보다 큰 문서 시스템

## DEVELOPMENT RULE
현재 코드 조사 → 이 문서와 PROJECT_STATE 확인 → CURRENT 하나만 최소 변경 → 테스트 → 실기기 검증 → 판정 → 상태 기록 → STOP.
LOCKED를 임의 변경하지 않는다.
"있으면 좋겠다"를 이유로 CURRENT 범위를 늘리지 않는다.
