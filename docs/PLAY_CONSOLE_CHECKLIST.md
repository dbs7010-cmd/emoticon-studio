# Play Console 체크리스트 (37차, 2026-09-15)

> 갱신일: 2026-09-27 · 기준 커밋: `503e561` + C1~C7 작업본. 기존 감사 산출물은 당시 기록이며 새 AAB 검증을 대신하지 않습니다.

구분: **REPO READY**(저장소에서 준비됨) · **OWNER ACTION**(운영자가 결정·입력) · **EXTERNAL BLOCKER**(외부 계정·배포·에셋 필요) · **FINAL QA**(실기기·실제 트랙에서만 판정).
어떤 항목도 DONE 이 아니다. Play Console 에 아무것도 제출하지 않았다.

| 항목 | 구분 | 현재 상태 | 근거 / 다음 행동 |
|---|---|---|---|
| package `com.emoticonstudio.app` | REPO READY | 설정·AAB 에서 확인, release-check 가 검사 | 첫 업로드 시 영구 확정 → OWNER ACTION |
| Play App Signing | EXTERNAL BLOCKER | 역할 문서화만 | 앱 생성 시 Google 생성 키 선택 (`RELEASE_SIGNING.md` §1) |
| upload key | EXTERNAL BLOCKER | 서명 구조·가드·검사 준비(36차) | 실제 키 생성·백업 = OWNER ACTION |
| 비소모성 일회성 상품 `pro_lifetime` | EXTERNAL BLOCKER | 앱·서버 코드가 이 ID 사용 | Console 에 비소모성 일회성 상품·가격 등록 = OWNER ACTION (가격 미확정) |
| receipt server | EXTERNAL BLOCKER | `server/verify-receipt.js` 코드만 | 배포·서비스 계정·https 주소 → 빌드에 `EMOTICON_RECEIPT_ENDPOINT` |
| license tester | EXTERNAL BLOCKER | — | 테스터 계정 등록 = OWNER ACTION |
| privacy URL | **BLOCKED** | 초안 `docs/PRIVACY_POLICY_KO.md` | 사업자 정보 입력 + 공개 URL 게시 전까지 BLOCKED |
| Data Safety | **DRAFT** | `docs/PLAY_DATA_SAFETY.md` | UNKNOWN 3건 해소 + OWNER 확인 후 Console 입력 전까지 DRAFT |
| content rating | **BLOCKED** | — | Play 설문 실제 완료 전까지 BLOCKED = OWNER ACTION |
| target audience | OWNER ACTION | 앱은 연령을 묻지 않음(코드 확인) | 대상 연령대 선택. 13세 미만 포함 시 가족 정책 추가 검토 필요 |
| ads declaration | OWNER ACTION | 광고 SDK 없음(의존성·AAB dex 확인) | "광고 없음" 선택 여부 확인 |
| store listing text | REPO READY(초안) | `docs/PLAY_STORE_LISTING_KO.md` DRAFT | 개발자 연락처·카테고리·가격 입력 = OWNER ACTION |
| app icon 512 | **BLOCKED** | 템플릿(35차 assets:check FAIL) | 최종 브랜드 에셋 |
| feature graphic 1024×500 | **BLOCKED** | 없음 | 최종 브랜드 에셋 |
| screenshots | **BLOCKED** | 없음 | 최종 에셋 적용 빌드의 실기기 화면 |
| AAB | EXTERNAL BLOCKER | 36차 dry-run AAB 는 임시 키·영수증 서버 없음 → 출시 후보 아님 | 업로드 키 + 연락처 설정 + 에셋 + clean prebuild 후 (정상 출시에는 영수증 서버도 필수) `release:check` exit 0 |
| testing track (internal) | FINAL QA | — | 내부 테스트 트랙 설치 → 구매·복원·만료·오프라인 확인 |
| app access (심사용 안내) | OWNER ACTION | 로그인 없음 | "제한 없음" 선택 여부 확인 |
| 권한 선언 검토 | OWNER ACTION | 감사 결과 `PLAY_DATA_SAFETY.md` §권한 | SYSTEM_ALERT_WINDOW release 전용 제거, VIBRATE·저장소(≤32)는 2026-10-04 제거(blockedPermissions), 그 전 기록: 후속 검토 |
| Android 자동 백업 | OWNER ACTION | `allowBackup=true`, 백업 규칙 없음 | 백업 허용 유지 여부 결정 → 방침·Data Safety 문구에 반영 |
| 기기 QA (28차 PARTIAL) | FINAL QA | MANUAL QA DEFERRED | 실기기 확인 |

## 빠진 blocker 점검 (37차 검증)
- 개인정보처리방침 URL · Data Safety · 콘텐츠 등급 · 그래픽 · AAB 서명 · 영수증 서버 · 상품 · 테스터 → 모두 표에 있음.
- 새로 발견: Billing Library 가 넣는 Google 전송 라이브러리(datatransport) 동작 UNKNOWN, 자동 백업 정책 미결정, 불필요 가능 권한 3종 → 표에 추가.

## 구매 비활성 비공개 테스트
`EMOTICON_PURCHASES=closed`를 명시합니다. `EMOTICON_INTERNAL_REVIEW`는 두지 않습니다. 개인정보처리방침 URL·문의 이메일·서명·데이터 보호·BILLING 검사에는 예외가 없습니다. 서버 미설정만 WARN입니다. 무료 브러시 10·무료 움직임 6, PRO 브러시 20·PRO 움직임 14 구성은 유지합니다.
백업 ZIP 공유, 선택한 백업 읽기, 휴지통 30일, 로컬 제목 글꼴은 데이터 보안 작업표에 반영했습니다.
문의 이메일·공개 개인정보 URL: [OWNER INPUT REQUIRED]. 실제 업로드 키는 아직 없으며 임시 키는 사용하지 않습니다.
> 2026-10-06 현재: 문의 이메일 emoticon755@gmail.com · 개인정보 URL https://dbs7010-cmd.github.io/emoticon-studio/privacy/ (공개본 = main `ae25526`, 바이트 일치 확인) · 업로드 키 있음(`00_배포준비.md` §1 현재 상태). 위 줄은 당시 기록.

예전 구독 `pro_monthly` / `pro_yearly`는 팔지 않지만 복원에서 알아봅니다.
