# 24차 · 홈·페인터 배치

홈은 작품을 카드 맨 위에 크게 배치하고 제목·수정일·진행 정보를 묶었다. 한 장은 카드 폭, 여러 장은 최대 3열로 표시한다. 카드 탭·이어서 만들기·새 세트·기존 빈칸 진입점은 유지했다.

펜·붓·연필은 도구 에셋과 실제 엔진 선 샘플을 한 줄에서 비교한다. 굵기·선 보정은 펜 설정으로 묶고 굵기 진입은 색 옆으로 이동했다. 패널 높이는 부모 비율 대신 화면 높이로 제한해 고정 도구바와 겹치지 않도록 했다. 작은 화면의 추가 설정은 패널 안에서 스크롤한다. 키보드 높이 보정과 닫힘 알림 처리는 보존했다.

| 검증 | 결과·범위 |
|---|---|
| npm test | 타입 + 기존 10개 스위트 PASS. 저장/선택 중 자동저장 방지/무료 흐름/32칸/이전 저장 호환 포함. 네이티브 모듈은 mock. |
| 최종 높이 조정 후 | typecheck + ux-test PASS |
| painter-test | 실제 Chromium Canvas PASS. 종이 질감 출력 0px, 브러시/지우개/Undo/Redo/참고 제외/저장 재열기. |
| 화면·패널 | 실제 React Native Web 화면과 Canvas, 390×844·320×640·320×568. 도구 3종이 고정 도구바 위에 보임, 보정 스크롤 접근 PASS. |
| 키보드 | 높이 300px 알림 모의. 입력·적용 유지, 닫힘 알림 뒤 문구 패널·도구바 복원 PASS. 실제 키보드는 미검증. |
| 로컬 Android | 기존 AVD 실행 시도 실패: ARM64 이미지는 이 x86_64 호스트에서 실행 불가. 개인 폰·유료 서비스 사용 없음. |

정상 개발 서버는 8081의 이 프로젝트 Expo Go 서버 하나다(PID 49136, 확인 당시). /status, Android 매니페스트와 실제 개발 번들 HTTP 200. 8082 리스너 없음. 처음 발견한 무응답 PID 33032는 현재 명령이 이 프로젝트임을 확인한 뒤 종료했다. 서버 연결은 검증했지만 기기 클라이언트의 경고 해소까지 확인한 것은 아니다. 개발 번들과 보존 릴리스 APK는 별개다.

승인 원본 2장과 zip은 docs/design에 원본 그대로 보존했다. 시안의 파랑·PRO·홈 탭바·임의 기능은 적용하지 않았다. [Expo v57 기준 문서](https://docs.expo.dev/versions/v57.0.0/)를 확인했다.

## APK

[최종 내부 검수 APK](C:/Dev/emoticon-studio/verification/apk-keep/app-24th-layout-869548b5.apk) · 81125748 bytes · 디버그 서명

SHA-256: `869548b53c8cfdbad19f62a8ef71ddbacd363cd374e4bd581db6ae3cf4981298`

SOURCE_ID: `2b3bf89957d8b21200e3b1573193fb8fb604304e5890e577a3e1fc7687622418`

빌드 소스맵의 App/Painter 원문이 현재 소스와 일치하고, APK의 내장 번들이 생성 번들과 해시까지 일치한다. 23차 보존 APK의 해시는 그대로다.

## 실제 캡처

아래는 앱 소스를 브라우저에서 렌더링한 캡처이며 Android 캡처가 아니다. 키보드 열림은 알림 모의이며 화면 하단 예약 공간을 보여 준다. 그림은 테스트 세션의 실제 Canvas 입력과 저장으로 만들었고 사용자 데이터를 읽거나 삭제하지 않았다.

### 홈

![홈](C:/Dev/emoticon-studio/verification/round24/home-web.png)

### 페인터 기본

![페인터 기본](C:/Dev/emoticon-studio/verification/round24/painter-basic-web.png)

### 펜 패널

![펜 패널](C:/Dev/emoticon-studio/verification/round24/pen-panel-web.png)

### 색상 패널

![색상 패널](C:/Dev/emoticon-studio/verification/round24/color-panel-web.png)

### 키보드 높이 알림 모의 · 300px

![키보드 높이 알림 모의 · 300px](C:/Dev/emoticon-studio/verification/round24/keyboard-open-simulated-web.png)

### 키보드 닫힘 알림 후 복원

![키보드 닫힘 알림 후 복원](C:/Dev/emoticon-studio/verification/round24/keyboard-closed-web.png)

### 320×640 펜 패널

![320×640 펜 패널](C:/Dev/emoticon-studio/verification/round24/pen-panel-320-web.png)

### 320×568 펜 패널

![320×568 펜 패널](C:/Dev/emoticon-studio/verification/round24/pen-panel-320-short-web.png)

## 남은 항목

최종 APK의 실제 Android 화면·터치·키보드만 닫기·안전 영역 검증. 기존 iOS/태블릿·스토어 연결 미검증은 이번 범위 밖이며 완료로 바꾸지 않았다.
