# 37차 — PLAY PRIVACY / LEGAL / STORE METADATA (2026-09-15)

판정: **DRAFT(문서 준비 범위)** — 코드 감사 근거로 방침·Data Safety·등록정보·체크리스트 초안 작성. Privacy URL **BLOCKED**, Data Safety **DRAFT**, 콘텐츠 등급 **BLOCKED**, 그래픽 **BLOCKED**. 어떤 항목도 DONE 아님.
앱 코드·에셋·설정·서명·결제 로직 변경 없음. Play Console 입력·제출 없음.

## 감사 근거
- 소스: `src/services/{storage,images,receipt,pro,purchase-adapter,export}.ts`, `App.tsx`(88~96·138~150·263~271·1148~1181행), `src/types.ts`, `server/verify-receipt.js`, `package.json`, `app.json`, `docs/MASTER_SOURCE.md`.
- 36차 AAB: 번들 매니페스트 `uses-permission` 9개(INTERNET, READ/WRITE_EXTERNAL_STORAGE ≤32, SYSTEM_ALERT_WINDOW, VIBRATE, BILLING, DYNAMIC_RECEIVER_NOT_EXPORTED, ACCESS_NETWORK_STATE), LOCATION·AD_ID 0건, `allowBackup="true"` 규칙 없음. dex: ads·analytics·sentry·bugsnag·crashlytics·AdvertisingIdClient 없음, `com/google/firebase`(encoders) 있음.
- `:app:dependencies releaseRuntimeClasspath`: `com.android.billingclient:billing:9.1.0` → `datatransport transport-api/backend-cct/runtime`, `firebase-encoders*`, `play-services-base/location 19.0.0`.
- node_modules: expo-dev-launcher release 는 `disableInRelease` 스텁, expo-updates 미설치(interface 만), `READ_EXTERNAL_STORAGE ≤32` 는 expo-image-picker 매니페스트, expo-file-system `documentDirectory` = `filesDir`, picker·manipulator 출력 = `cacheDirectory`.
- 공식 문서: Play Data safety 도움말(수집 = 기기 밖 전송, 라이브러리 포함 신고, 결제 서비스가 직접 받는 금융 정보 면제, 수집 없어도 양식 필수; 자동 백업 언급 없음), Android Auto Backup 문서(filesDir 기본 포함, cache 제외, 사용자 Google Drive 비공개 폴더 25MB).
- Play SDK Index Billing 페이지: 비로그인 조회로 본문 확인 불가 → UNKNOWN 유지.

## 핵심 확인
- 영수증 전송 필드: `pro.ts` 103행에서 `platform`·`productId`·`purchaseToken` 3개만. `ReceiptRequest.packageName` 선택 필드는 앱이 채우지 않음. https 강제. **트리거는 구매·복원·앱 실행 시 1회(소유 구독 있을 때)** — 기존 legal.md 는 구매 때만처럼 기술.
- 구매 토큰 기기 저장 없음(`Entitlement` 타입). 서버는 요청 저장 코드 없음, 실패 시 오류 문자열만 stderr.
- WebView 3곳 모두 인라인 HTML·`about:*`·원격 참조 없음.
- 불필요 가능 권한(보고만, 제거 안 함): SYSTEM_ALERT_WINDOW, VIBRATE(코드 사용 없음), WRITE_EXTERNAL_STORAGE ≤32(외부 저장소 쓰기 없음).
- 앱이 지우지 않는 파일: 내보내기 ZIP(`set-*`), picker/manipulator 캐시.

## 검증
| 확인 | 결과 |
|---|---|
| 새 문서 마커 수 | PRIVACY OWNER 17 · DATA_SAFETY UNKNOWN 28 / OWNER 8 · LISTING OWNER 6 / BLOCKED 5 · CHECKLIST BLOCKED 7 |
| "DONE" 사용 | 체크리스트의 "어떤 항목도 DONE 이 아니다" 1건뿐 |
| 발명된 사업자 정보 | 없음 — 회사명·대표자·주소·이메일·사업자 정보·시행일 전부 [OWNER INPUT REQUIRED] |
| legal.md 충돌 | 5건 → legal.md 상단에 대조 메모 추가(이용약관 본문은 미수정, PRO 목록 불일치 남음) |
| 체크리스트 blocker 누락 | 없음 + 새 항목 3(Billing datatransport, 자동 백업, 권한 3종) |
| 등록정보 길이 | 제목 11자 · 짧은 설명 42자 · 전체 약 810자 |
| 앱 변경 여부 | r36 RESULT 이후 바뀐 파일은 docs 와 `.expo/dev/logs/start.log`(Expo 로그)뿐 |
| typecheck · npm test | PASS · 15 PASS (`tests.log`) |
