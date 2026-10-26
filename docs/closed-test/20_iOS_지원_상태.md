# iOS 지원 상태 · 빌드 차단 항목 · 추가 비용 (2026-10-10 조사)

> 상태 표기: DONE · CURRENT · BLOCKED · NEXT. iOS 기기·빌드에서 실제로 확인한 것은 **없다**(아래는 코드 점검과 공식 문서 확인).

## 1. 지금 코드 상태
| 항목 | 상태 | 근거 |
|---|---|---|
| 번들 ID | DONE | app.json `ios.bundleIdentifier = com.emoticonstudio.app` |
| 같은 서버 사용 | DONE(설계) | 로그인 중계·백업·공모전이 플랫폼 구분 없이 같은 Firebase 함수·규칙. 앱은 Firebase JS SDK 라 네이티브 Firebase 설정 파일(GoogleService-Info.plist)이 필요 없다 |
| 카카오·네이버·구글 로그인 | DONE(설계) | 회사 SDK 없이 시스템 인증 창(iOS `ASWebAuthenticationSession`, expo-web-browser)으로 같은 `/auth/start` 를 연다 — iOS 용 앱 키·URL 스킴 등록 불필요 |
| **Apple 로그인** | **DONE(코드, 2026-10-27 · 실기기 미검증 — 30번 문서)** | App Store 심사 지침 4.8: 다른 회사 로그인을 쓰는 앱은 이름·이메일만 받고·이메일 숨기기 가능·광고 추적 없는 동등한 로그인을 함께 제공해야 한다 → 사실상 **Sign in with Apple**. 로그인 필수 정책이라 반드시 필요 |
| 그리기(WebView)·저장·공유 | NEXT(미검증) | 코드에 Android 전용 분기는 키보드 처리·레이아웃 애니메이션 정도. 파일 공유 UTI(`public.zip`)는 들어 있음 |
| 클라우드 자동 백업 제외 규칙 | NEXT | Android 전용 플러그인(withBackupRules). iOS 는 `exports/` 를 iCloud 백업 제외로 따로 표시해야 함 |
| 결제(expo-iap) | BLOCKED(정책상 닫힘) | iOS 상품 등록·영수증 검증 서버 없음 — Android 와 같이 닫아 둔 채 출시 가능 |
| 앱 아이콘·스플래시 | NEXT | iOS 아이콘 세트 생성 확인 필요(1024 정사각, 투명 금지) |
| 개인정보 | NEXT | App Store '앱 개인정보 보호' 라벨(Play 데이터 보안과 같은 내용), 계정 삭제 기능(앱 안 탈퇴 + 웹) — Apple 로그인 사용자는 탈퇴 때 Apple 토큰 철회 호출 필요 |

## 2. Apple 로그인 구현 계획(NEXT)
1. `npx expo install expo-apple-authentication`(Expo v57 문서 확인: iOS 전용, `ios.usesAppleSignIn: true`, EAS Build 가 권한을 켬)
2. 앱: 시작 화면에 **Apple로 계속하기**(iOS 에만, Apple 버튼 규정 모양) → `signInAsync()` 의 `identityToken`
3. 서버: `exchangeApple` 함수 — Apple 공개키(`appleid.apple.com/auth/keys`)로 서명·`aud = com.emoticonstudio.app`·`iss = https://appleid.apple.com`·만료·nonce 확인 → `apple:<sub>` Firebase 토큰. 앱이 보낸 토큰을 **서버가 검증**하므로 다른 회사와 같은 원칙을 지킨다
4. 탈퇴: Apple `revoke` 호출 — **Apple 로그인 키(.p8)** 로 만든 client secret 필요(서버 Secret Manager 에만)
5. 운영자 준비: Apple 개발자 계정 › Certificates, IDs & Profiles › 번들 ID 에 **Sign In with Apple** 켜기 · Keys 에서 Sign in with Apple 키 만들기(Key ID·Team ID 는 공개, .p8 은 비밀)

## 3. 빌드 차단 항목
| 차단 | 해결 | 비용 |
|---|---|---|
| Apple 개발자 프로그램 가입(없으면 실기기 설치·TestFlight·심사 불가) | 개인 가입 — 본인 인증·결제 | **연 USD 99** (공식 가입 페이지. 원화 표시가는 가입 화면에서 정해짐 — 환율 1,338.92원 기준 약 132,600원, 부가세 별도일 수 있음) |
| Mac 없이 iOS 빌드 | **EAS Build(클라우드)**로 빌드·서명 — Mac 불필요 | 무료 요금제: iOS 빌드 15회 포함(낮은 우선순위·동시 1개). 넘으면 Starter **월 USD 19**(빌드 크레딧 USD 45 포함), 초과 iOS 빌드 1회 **USD 2(중간)·USD 4(큰 작업자)** — expo.dev/pricing 2026-10 확인 |
| 실기기 확인 | 운영자 iPhone + TestFlight(무료) | iPhone 이 없으면 시뮬레이터 확인만 가능(EAS 시뮬레이터 빌드) — 실기기 검증은 BLOCKED |
| App Store 심사 자료 | 스크린샷(6.9"·6.5" 등), 개인정보 라벨, 심사용 로그인 계정(로그인 필수라 **심사용 테스트 계정 필요**), 계정 삭제 안내 | 0원 |
| 로그인 필수 + 심사 | 심사관이 로그인할 수 있어야 함 — Apple 로그인이면 심사관이 직접 가능, 카카오·네이버는 심사용 계정 제공 권장 | 0원 |

## 4. 추가 비용(원화, 예상)
| 항목 | 금액 |
|---|---|
| Apple 개발자 프로그램 | 연 약 132,600원(USD 99 × 1,338.92) — 실제 원화 청구가는 가입 화면 기준 |
| EAS Build | 무료 15회 안이면 0원 · 넘으면 월 약 25,400원(Starter USD 19) + 초과 빌드 1회 약 2,700~5,400원 |
| 서버 | 추가 0원(같은 서버) — 사용자 수 증가분은 19번 문서 표 |
| Mac | 0원(EAS 사용) |

## 5. 권장 순서
1. Android 실제 연결·실기기 검증을 먼저 끝낸다(같은 서버라 iOS 는 그 결과를 그대로 쓴다)
2. Apple 개발자 가입(운영자) → Apple 로그인 구현·서버 함수(내가) → EAS iOS 빌드 → TestFlight
3. iOS 전용 점검: iCloud 백업 제외, 아이콘, 키보드·안전 영역, 공유 시트, 개인정보 라벨
