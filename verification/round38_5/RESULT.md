# 38.5차 — MOBILE CREATION HAND-FEEL + CONVENIENCE PASS (2026-09-15)

판정: **PARTIAL** — 자동 검사(엔진 제스처·앱 상호작용·벤치마크) PASS. 손가락 감각·새 네이티브 빌드의 실행 배경은 실기기에서만 판정 가능.
38차 구조 유지. 저장 형식·레이어·Undo·움직임·내보내기 엔진 불변(글씨 제스처 라우팅만 추가). reset/clean 없음.

## 원인 확인 — 실행 시 검은 화면
- `AndroidManifest` 실행 테마 `Theme.App.SplashScreen` 의 `android:windowBackground` = `@drawable/splashscreen_logo`(비트맵 전체를 창 바탕으로 사용), 단색 배경·`windowSplashScreenBackground` 없음.
- 5개 밀도 `splashscreen_logo.png` 모두 투명 픽셀 있음(asset-check `inspectFile`). 투명한 곳 뒤로 빈 창(검정)이 보인다.
- 앱 뿌리 바탕 `#F4F4F5`, `activityBackground #F7F4EE`, 캔버스 HTML body `#F4F4F5` — 모두 밝음. 다른 어두운 원천 없음.
- 수정: `plugins/withLaunchBackground.js`(스플래시 플러그인이 없을 때만 등록) → 실행 창 배경 `@color/activityBackground`. 현재 `android/` styles.xml 에도 반영, 스크래치 복사본 **실제 `expo prebuild`** 결과에서 확인.
- 실기기 확인은 새 네이티브 빌드가 필요(개발 빌드의 dev launcher 화면은 해당 없음 — 원인은 앱 테마).

## 벤치마크 (product-ux-test 가 실제로 누르고 끌며 셈)
| 흐름 | 38차 | 38.5차 |
|---|---|---|
| FLOW A: 빈 다음 칸 → 이전 그림 → 연필 → 굵기 → 최근 색 → 문구 입력·배치 → 완성·다음 | 누르기 14 · 끌기 1 · 시트 4(브러시·색·문구×2) · 크기 버튼 반복 | **누르기 9 · 끌기 2 · 시트 3 · 확인창 0** |
| FLOW B: 빈 다음 칸 → 이전 그림 → 문구 고치기 → 직전 움직임 → 완성·다음 | 누르기 6 · 끌기 2(속도·세기 다시 맞춤) · 반복 설정 2 | **누르기 6 · 끌기 0 · 반복 설정 0 · 확인창 0** |
38차 수치는 38차 코드 경로 기준 셈(굵기 버튼·문구 위치 조절 진입·크게 버튼 1회·옮기기 끝 포함).

## 캔버스 면적 측정(390×844, 상태바 24·내비 48 가정)
머리 52 + 탭 48 + 기본 도구 줄 115 = 215dp → 캔버스 390×390, 앱 화면의 약 50%. 이번 회차에서 면적은 늘리지 않았다(터치 영역을 줄이지 않음). 대신 되돌리기·다시를 엄지 줄로 옮겨 머리 줄을 비웠다.

## 검증
- `npx tsc --noEmit` PASS
- `npm test` exit 0 · 16 PASS (`tests.log`)
- gesture-test(실제 엔진 + DOM 흉내): 글씨 누르면 선택(획·기록 없음), 다시 누르면 편집 요청, 떨림 ≠ 이동, 끌어 옮기기, 손잡이 크기, 두 손가락 크기(상한 3)·회전(8° 무시), 경계, 바깥 누르면 선택 끝(획 없음), 가장자리 큰 글씨의 손잡이도 캔버스 안, 저장 값 = 캔버스 값
- product-ux-test: 가장자리 굵기 끌기(끄는 동안만 24px 미리보기)·세트 저장, 지우개 같은 조작 40·시트 없음, 브러시→지우개→브러시 유지, 세부 설정 접힘, 최근 색 한 번에, 문구 키보드 완료 → 선택 상태, 간접 배치 버튼 없음, 다시 누르면 편집, 옮긴 문구 재열기 동일, 직전 칸 움직임 다시 쓰기, 조용한 자동저장(도구 줄 잠금 없음·명령 보류 후 전달·완성 대기·체크 1.2초), 짧은 화면(353dp) 굵기 조절 148dp·움직이기 패널 겹침 38% 미만, 재시작 뒤 굵기·선 종류·보정 유지, 실행 배경 플러그인·android/·뿌리 바탕, 홈 순서·flexGrow
- 기존: ux·color·motion-v1·iap 포함 전 스위트 PASS. brush/color **engine** 테스트(playwright 필요)는 이 PC 에 playwright 가 없어 실행 불가 — 이번 회차 이전부터 npm test 밖.
