# 45.9 — 도톰 글씨체·연필 표현 수정 증거 (2026-09-21)

수집 환경: Windows 11 Pro x64 · 앱이 WebView 에 넣는 **실제 캔버스 엔진 HTML**(`engine.html`, `src/painter/canvas-html.ts` 에서 추출) 을 localhost 로 띄워 같은 명령으로 렌더.
글꼴은 **이 PC 의 것**(system-ui → Segoe UI/맑은 고딕, serif → 바탕/Times)이라 **Android 글꼴 검증이 아니다.**
비교 기준: 45.8 증거(`verification/round45_8/`) 와 같은 문구·색·굵기·경로.

## A. 도톰 글씨체 — 글자 자체가 굵어졌는가

| 문구 | 기본 글자픽셀 | 도톰 글자픽셀 | 배수 | 글자폭(기본→도톰) |
|---|---|---|---|---|
| 안녕하세요 | 2,569 | 4,376 | **1.70×** | 193 → 196 |
| Hello 123 | 1,914 | 3,084 | **1.61×** | 176 → 178 |
| 오늘 하루도 수고 많으셨어요(작은 크기) | 2,365 | 3,434 | **1.45×** | 323 → 311 |

45.8 에서는 같은 측정이 **2,569 → 2,569 (1.00×)** 였다. 흰 테두리만 다르던 문제가 사라졌다.
이미지: `shots/A5-final-{ko,en,long}-{basic,thick}.png`, 또박 비교는 `shots/A3-caption-ko-serif.png`.

## B. 연필 — 펜과 구분되는가 (18px, 같은 경로)

| | 칠해진 픽셀 | 평균 알파 | 반투명 비율 |
|---|---|---|---|
| 펜 | 4,588 | 245 | 8% |
| 붓 | 6,486 | 247 | 7% |
| 연필(45.9) | 4,587 | **135** | **100%** |
| 연필(45.8, 수정 전) | 4,571 | 235 | 20% |

- 한 획 안에서 같은 자리를 두 번 지나도 평균 138 로 **고르다**(예전에는 겹칠수록 진해졌다).
- 따로 그은 두 획이 만나는 자리는 203 으로 **자연스럽게 진해진다**(연필로 덧칠하는 느낌).
- 8px 얇은 선에서도 펜 254 vs 연필 138 로 구분된다.
- 펜·붓 수치는 45.8 과 같다(의도대로 연필만 바꿨다).
이미지: `shots/A1-brush-18px-after.png`, `shots/A2-pencil-overlap-8px.png`.

## C. 확인하지 못한 것
- **Android 실기기/에뮬레이터 렌더**: 기기 연결 거부(외출), 에뮬레이터는 아래 사유로 실행 불가 → 글꼴·손맛은 UNVERIFIED.
- 실제 앱 화면(홈·패널·키보드·연속 제작) 캡처: BLOCKED.

## D. 에뮬레이터 차단 사유 (정확한 조치 필요 사항)
- 호스트: AMD64 / Windows 11 Pro / 여유 디스크 29.7GB — **조건 충족**
- 펌웨어 가상화(VT-x)·SLAT: **사용 가능**
- 그러나 `HypervisorPresent = False` — Windows Hypervisor Platform(WHPX) 또는 Android Emulator hypervisor driver 가 켜져 있지 않다.
- 상태 확인·설치 모두 **관리자 권한 필요**(`Get-WindowsOptionalFeature ... requires elevation`), 보통 재부팅도 필요.
- 기존 AVD `arm_test` 는 arm64 이미지라 x86_64 호스트에서 실행 불가(`Avd's CPU Architecture 'arm64' is not supported`).
- 필요한 조치(사용자): ① 관리자 PowerShell 에서 `Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All` 후 재부팅, 또는 Android Emulator hypervisor driver 설치 ② 그 뒤 x86_64 시스템 이미지(≈1.2GB) 내려받기 승인 → 별도 AVD 생성(기존 `arm_test` 는 그대로 둔다).
