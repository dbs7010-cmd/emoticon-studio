# Play Data Safety 작업표 + 데이터 흐름 감사 (37차, 2026-09-15)

> 갱신일: 2026-09-27 · 기준 커밋: `503e561` + C1~C7 작업본. 기존 감사 산출물은 당시 기록이며 새 AAB 검증을 대신하지 않습니다.

상태: **DRAFT** — Play Console 에 제출하지 않았다. 제출 전까지 DRAFT.
표시: **CONFIRMED**(코드·빌드 산출물에서 직접 확인) · **UNKNOWN**(코드로 확인 불가) · **OWNER INPUT REQUIRED**(운영자 결정 필요).
감사 대상: 저장소 HEAD `49206d38` + 미커밋 작업본, 36차 AAB(`app-release.aab`, SHA-256 `5da6aac1…9fda`)의 병합 매니페스트·dex, `:app:dependencies --configuration releaseRuntimeClasspath`.

## 1. CODE REALITY 요약
| 항목 | 결과 | 상태 | 근거 |
|---|---|---|---|
| 계정·로그인·이메일·이름 | 없음 | CONFIRMED | 인증 코드·필드 없음(`src/types.ts` `Store`/`Project`) |
| 분석(analytics) | 없음 | CONFIRMED | `package.json` 의존성, AAB dex 에 firebase-analytics·amplitude·mixpanel 없음 |
| 크래시 리포트 SDK | 없음 | CONFIRMED | dex 에 sentry·bugsnag·crashlytics 없음 |
| 광고 SDK · 광고 ID | 없음 | CONFIRMED | dex 에 `com/google/android/gms/ads`·`AdvertisingIdClient` 없음, 매니페스트에 `AD_ID` 없음 |
| 위치 권한 | 없음 | CONFIRMED | 병합 매니페스트에 LOCATION 권한 0건 |
| 클라우드 저장 | 없음(운영자 서버) | CONFIRMED | 앱 코드에 업로드 경로 없음 |
| Android 자동 백업 | **켜짐** — 규칙 파일 없음 | CONFIRMED | 매니페스트 `android:allowBackup="true"`, `fullBackupContent`/`dataExtractionRules` 없음. 앱 데이터 폴더는 `Paths.document` = `filesDir`(expo-file-system `FileSystemModule.kt` 38행) → Android 문서상 자동 백업 기본 포함 대상 |
| AI · 외부 API | 없음 | CONFIRMED | `src`·`App.tsx` 에 fetch 는 `receipt.ts` 한 곳 |
| 개발 도구(expo-dev-client) | release 에는 비활성 스텁 | CONFIRMED | `expo-dev-launcher/android/build.gradle` `debugImplementation`/`releaseImplementation`(disableInRelease) |
| expo-updates | 미설치(인터페이스만) | CONFIRMED | `node_modules` 에 `expo-updates-interface` 만, 매니페스트 `updates.ENABLED=false` |

## 2. DATA INVENTORY
| DATA | SOURCE | STORED WHERE | DEVICE ONLY / SERVER | TRANSMITTED? | DESTINATION | PURPOSE | RETENTION | USER CAN DELETE? | REQUIRED / OPTIONAL | 상태 |
|---|---|---|---|---|---|---|---|---|---|---|
| 사용자가 그린 그림(PNG), 레이어·컷아웃 | 사용자 그리기 | 앱 전용 폴더 `filesDir/emoticon-studio/image-*.png` | DEVICE ONLY (자동 백업 가능) | 사용자가 공유를 누를 때만 | 사용자가 고른 앱 | 작업 저장 | 세트·컷에서 제거될 때까지, 앱 삭제 시 | 예 — 컷/세트 삭제 시 참조 끊긴 이미지 삭제(`App.tsx` `commit` → `deleteLocalImages`), 앱 삭제 | 앱 기능에 필수 | CONFIRMED |
| 프로젝트/세트 데이터(세트 이름·캐릭터 이름·성격·말투·칸 대사·감정·상황·움직임 설정·브러시 설정) | 사용자 입력 | `store-a.json`/`store-b.json` 같은 폴더 | DEVICE ONLY (자동 백업 가능) | 저장 파일 복구 화면에서 사용자가 "파일 내보내기"를 누를 때만(`App.tsx` `shareSnapshot`) | 사용자가 고른 앱 | 작업 저장 | 삭제·앱 삭제까지 | 예 — 세트 삭제, 앱 삭제 | 필수 | CONFIRMED |
| 참고 이미지(reference) · 기준 그림 | 사진 보관함에서 사용자가 선택 | 선택 이미지를 PNG 로 변환해 앱 폴더에 복사(`images.ts` `pickImages`) | DEVICE ONLY | 아니오 | — | 참고해 그리기 | 참조가 끊기면 삭제, 앱 삭제 | 예 | 선택 | CONFIRMED |
| 사진 선택 과정의 임시 파일 | expo-image-picker · expo-image-manipulator | `cacheDir`(`ImagePicker`·`ImageManipulator` 폴더) | DEVICE ONLY | 아니오 | — | 변환 | **앱이 지우지 않음**(`pickImages` 는 변환본 삭제 안 함). OS 캐시 정리·앱 삭제 시 | 앱 설정 "캐시 삭제"·앱 삭제 | — | CONFIRMED (보관 기간은 OS 정책, UNKNOWN) |
| 문구(caption) | 사용자 입력 | store JSON·그림에 합성 | DEVICE ONLY | 공유 시 파일에 포함 | 사용자가 고른 앱 | 작업 | 삭제까지 | 예 | 선택 | CONFIRMED |
| 생성 파일 GIF · WebP | 앱이 기기 안에서 인코딩 | 앱 폴더 `image-*.gif/webp` | DEVICE ONLY | 공유 시 | 사용자가 고른 앱 | 움직이는 이모티콘 | 참조 끊기면 삭제 | 예 | 선택 | CONFIRMED |
| 내보내기 묶음 ZIP `set-*.zip` | 앱 생성 | 앱 폴더 | DEVICE ONLY | 공유 시트로 | 사용자가 고른 앱 | 제출 파일 전달 | **앱이 지우지 않음** — 앱 삭제까지 | 앱 삭제·앱 데이터 삭제로만 | 선택 | CONFIRMED |
| 최근 색·내 팔레트·종이 질감 설정·보관한 움직임·컷아웃 | 사용자 | store JSON | DEVICE ONLY | 아니오 | — | 편의 | 삭제까지 | 예(목록에서 삭제) / 앱 삭제 | 선택 | CONFIRMED |
| 이용권 표시 `entitlement`(plan·source·verified·expiresAt·checkedAt·test) | 영수증 서버 판정 결과 | store JSON | DEVICE ONLY | 아니오 | — | PRO 기능 개방 | 덮어쓰기·앱 삭제 | 앱 삭제 | PRO 사용자만 | CONFIRMED |
| **구매 토큰 purchaseToken** | Google Play Billing | **앱 저장소에 저장하지 않음**(`Entitlement` 타입에 필드 없음). Google Play 쪽 보관은 Google 정책 | 서버로 전송 | **예** | 운영자 영수증 서버 → Google Play Developer API | 구매 진위 확인 | 앱: 메모리 내 처리. 서버: 코드상 저장 없음, 호스팅 로그 UNKNOWN | 서버 로그 삭제 요청 경로 OWNER INPUT REQUIRED | PRO 구매 시 필수 | CONFIRMED(앱·서버 코드) / 서버 운영 UNKNOWN |
| productId (`pro_lifetime`) | 앱 상수 | 앱 코드 | 서버로 전송 | 예 | 영수증 서버 | 요청 상품 대조 | 서버 코드상 저장 없음 | — | PRO 구매 시 | CONFIRMED |
| platform (`android`) | 앱 | — | 서버로 전송 | 예 | 영수증 서버 | 스토어 구분 | 저장 없음 | — | PRO 구매 시 | CONFIRMED |
| 구매 상태 판정 `{verified, plan, expiresAt, sandbox, reason}` | 영수증 서버 응답 | 필요한 값만 entitlement 로 | 기기 | 서버→앱 | 앱 | 권한 판단 | 위와 같음 | 앱 삭제 | — | CONFIRMED |
| IP 주소 등 통신 메타데이터 | 네트워크 요청 자체 | 호스팅 제공자 로그 | SERVER | 요청 시 자동 | 호스팅(미정) | — | UNKNOWN | UNKNOWN | — | **UNKNOWN / OWNER INPUT REQUIRED** |
| Google Play Billing Library 내부 로그/전송 | billing 9.1.0 → `datatransport`·`play-services-location`·`firebase-encoders` 의존 | — | UNKNOWN | UNKNOWN | Google | UNKNOWN | UNKNOWN | UNKNOWN | — | **UNKNOWN** — 의존성·매니페스트 컴포넌트는 CONFIRMED, 실제 수집 여부는 코드로 확인 불가 |
| 기기 식별자 | — | 앱 코드에서 읽지 않음 | — | 앱 코드는 보내지 않음 | — | — | — | — | — | CONFIRMED(앱 코드) / 라이브러리 UNKNOWN |

### 45.38~45.40 추가 데이터 흐름
| 데이터 | 생성·읽기 | 보관·전송 | 삭제·미확정 사항 |
|---|---|---|---|
| 백업 ZIP 만들기 | backup.ts writeBackup, 작품과 이미지로 ZIP 생성 | 앱 폴더에 저장, 사용자가 공유 창에서 고른 앱으로만 전달 | 앱 데이터 삭제 시 로컬 ZIP 제거, 외부 사본은 사용자가 관리 |
| 백업에서 되살리기 | expo-document-picker로 사용자가 고른 파일만 읽음 | 앱 폴더에 새 세트·이미지, 서버 전송 없음 | 기존 작품 보존, 선택한 원본 ZIP은 변경하지 않음 |
| 휴지통 30일 | 세트 삭제 시 deletedAt 기록 | 기기 안, 30일 뒤 앱 실행·정리 시 영구 삭제 | 수동 영구 삭제 가능, 아직 다른 세트가 참조하는 이미지 보존 |
| 제목 글꼴 파일 | Jua를 앱에 포함 | 기기 안, 네트워크 전송 없음 | 앱 삭제까지 |
| 문의 메일 | 사용자가 문의하기 선택 | mailto에 앱 버전·OS 버전만 포함, 사용자 메일 앱에서 전송 | 운영자 수신·보관 기간 [OWNER INPUT REQUIRED], 작품 자동 첨부 없음 |

구매 비활성 비공개 테스트는 extra.purchases='closed'를 명시해야 합니다. 이때 가격·구매·복원·자동 재확인과 영수증 요청은 모두 0회입니다. 결제 서버 미설정 예외는 이 구성에만 적용하며 Data Safety 확인·서명·검수 우회 차단 의무는 유지합니다.

## 3. SDK / PERMISSIONS
### 권한 (36차 AAB 번들 매니페스트 `uses-permission`)
| 권한 | 출처 | 필요 이유 | 판단 |
|---|---|---|---|
| `INTERNET` | 생성된 `AndroidManifest.xml` | 영수증 서버 요청, 구매 내역·공식 안내 링크는 브라우저로 열림 | 필요 |
| `ACCESS_NETWORK_STATE` | 라이브러리 병합(정확한 출처 UNKNOWN) | 네트워크 상태 확인 | 라이브러리 필요로 추정되나 출처 미확인 → 보고만 |
| `com.android.vending.BILLING` | expo-iap/Billing Library | Google Play 일회성 결제 | 필요 |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | `expo-image-picker`·`expo-file-system` 매니페스트 | 사진 선택은 androidx `PickVisualMedia`(시스템 사진 선택기, 없는 기기는 문서 선택기) — 고른 파일만 읽기 권한이 주어져 저장소 권한이 필요 없다(Expo v57 문서: "No permissions request is necessary for launching the image library", 앱 코드에 권한 요청 없음) | **2026-10-04 제거**(`app.json` `android.blockedPermissions`). Android 12 이하 실기기 확인은 미검증 |
| `WRITE_EXTERNAL_STORAGE` (maxSdk 32) | 생성된 매니페스트(템플릿)·라이브러리 | 앱 코드는 외부 저장소에 쓰지 않음(앱 폴더·공유 시트만) | **2026-10-04 제거**(`blockedPermissions`) |
| `SYSTEM_ALERT_WINDOW` | 기존 병합 보고서 201~204행: app/src/main/AndroidManifest.xml:6 | 앱 사용처 없음 | 45.40 withReleasePermissions로 release에서 tools:node="remove"; debug 보존. 새 APK/AAB 검증은 후속 |
| `VIBRATE` | 생성된 매니페스트(템플릿) | 앱 코드에 Vibration/Haptics 호출 없음 | **2026-10-04 제거**(`blockedPermissions`) |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX 자동 추가 | 앱 내부 브로드캐스트 보호 | 시스템 생성 |
| 카메라·마이크 | `tools:node="remove"`, image-picker 설정 `false` | — | 없음 CONFIRMED |
| 사진 권한(Android 13+ READ_MEDIA_*) | 매니페스트에 없음 | 사진 선택기 사용 | 없음 CONFIRMED |
(`DUMP`·`BIND_JOB_SERVICE` 는 권한 요청이 아니라 라이브러리 컴포넌트 보호 속성.)

### SDK
| SDK | 역할 | 데이터 관련 |
|---|---|---|
| expo-iap 5.6.0 → openiap-google 3.5.1 → Play Billing 9.1.0 | 일회성 결제 | 결제 정보는 Google 이 처리. Billing 이 datatransport·play-services-location 을 끌어옴 → UNKNOWN |
| react-native-webview 13.16.1 | 캔버스·움직임 인코딩·이미지 분석 | `source={{ html }}` 인라인, `originWhitelist=['about:*']`, `about:blank` 외 이동 차단, HTML 에 원격 주소 없음 → 네트워크 없음 CONFIRMED |
| expo-image-picker / expo-image-manipulator | 사진 선택·변환 | 기기 안, 캐시 파일 |
| expo-file-system | 저장 | 앱 전용 폴더 |
| expo-sharing | 사용자 공유 | 사용자 선택 |
| expo-constants | 빌드 설정 읽기 | 없음 |
| expo-dev-client | 개발용 | release 비활성 |

## 4. NETWORK FLOWS
| 요청 | 트리거 | endpoint | payload | 목적 | 상태 |
|---|---|---|---|---|---|
| 영수증 확인 POST | ① 구매 완료 직후 ② "구매 복원" ③ **앱 실행 시 1회** — 스토어에 소유 구매가 있으면(`App.tsx` 88~96행 `refreshEntitlement` → `ownedPurchase` → `confirm`) | 빌드 설정 `extra.receiptEndpoint`(https 만). **현재 빌드 비어 있음 → 요청 자체 없음** | JSON `{ platform, productId, purchaseToken }` — `pro.ts` 103행에서 이 세 필드만 채움. `ReceiptRequest` 타입에 선택 필드 `packageName` 이 있으나 앱은 채우지 않음 | 구매 진위 확인 | CONFIRMED |
| 영수증 서버 → Google | 위 요청 처리 | `oauth2.googleapis.com/token`, `androidpublisher.googleapis.com/.../purchases/subscriptionsv2/tokens/{token}` | 서비스 계정 JWT, 토큰(URL 경로) | Play 에 구매 상태 조회 | CONFIRMED(코드) · 배포 안 됨 |
| 서버 응답 | — | — | `{verified, plan, expiresAt?, sandbox?, reason?}` | — | CONFIRMED |
| 서버 로그 | 실패 시 | 표준 오류 | 오류 문자열(Play 응답 앞 200자 포함 가능), 요청 본문은 기록 안 함 | 장애 확인 | CONFIRMED(코드) / 호스팅 로그 UNKNOWN |
| Google Play 결제 | 구매·가격 조회·복원 | Google Play 앱(Billing) | Google 처리 | 결제 | Google 영역 |
| 외부 링크 열기 | 사용자 탭 | 카카오 이모티콘 스튜디오 안내(notion), webp-animator, Play 구매 내역 | URL 만, 개인정보 없음 | 안내·구매 내역 | CONFIRMED — 브라우저/Play 앱에서 열림 |
| 공유 시트 | 사용자 탭 | 사용자가 고른 앱 | ZIP·PNG·GIF·store 스냅샷 | 전달 | CONFIRMED — 사용자 시작 |
| 라이브러리 백그라운드 통신(datatransport 등) | — | UNKNOWN | UNKNOWN | UNKNOWN | **UNKNOWN** |

### 구매 토큰 분류 메모 (별도 표시)
- 구매 토큰은 **이름·이메일 같은 직접 식별 정보는 아니지만, Google 이 특정 구매(따라서 특정 Google 계정의 거래)에 연결하는 값**이다. 운영자 서버가 받아 Google 에 조회하므로 **기기 밖 전송 = Play 정의상 "수집"** 에 해당한다(공식 도움말: 앱이 기기 밖으로 전송하는 것이 수집).
- Data Safety 후보 유형: **금융 정보 > 구매 내역(Purchase history)** — 공식 정의 "사용자가 한 구매·거래 정보". 상태: **OWNER INPUT REQUIRED**(최종 분류는 운영자 판단).
- 참고: 공식 도움말은 앱이 금융 정보를 직접 보지 않고 결제 서비스(Play Billing 등)가 사용자에게서 직접 받는 경우 그 금융 정보는 신고 대상이 아니라고 설명한다. 카드번호 등은 앱이 보지 않음(CONFIRMED). **그러나 구매 토큰은 앱과 운영자 서버가 직접 다룬다** → 면제 근거로 쓰기 어렵다.
- 개인정보처리방침에서는 "결제 확인 정보(구매 토큰·상품 번호·플랫폼)"로 따로 적는다(`PRIVACY_POLICY_KO.md` 3항).

## 5. PLAY DATA SAFETY WORKSHEET (Console 입력용 초안)
| DATA TYPE | COLLECTED? | SHARED? | EPHEMERAL? | REQUIRED? | PURPOSE | ENCRYPTED IN TRANSIT? | USER DELETION | 상태 |
|---|---|---|---|---|---|---|---|---|
| 금융 정보 > 구매 내역 (구매 토큰·상품 ID) | 예 (영수증 서버 배포 후) | 아니오 — 운영자 서버가 Google 에 조회. 서비스 제공자·운영 목적 처리로 볼지 OWNER 판단 | 앱: 저장 안 함 / 서버: 저장 코드 없음, 로그 UNKNOWN | PRO 구매 시 필수 (앱 사용 자체는 불필요) | 앱 기능(구매 확인), 사기 방지 | 예 — https 만 허용(`receipt.ts`), 서버→Google https | 서버 보관 정책·요청 경로 미정 | CONFIRMED(흐름) · OWNER INPUT REQUIRED(분류·보관·삭제) |
| 금융 정보 > 결제 정보(카드 등) | 아니오 — Google Play 가 처리 | 아니오 | — | — | — | — | — | CONFIRMED |
| 개인 정보(이름·이메일·ID·주소·전화) | 아니오 | 아니오 | — | — | — | — | — | CONFIRMED |
| 위치 | 아니오(앱 코드) | 아니오 | — | — | — | — | — | CONFIRMED(앱) / UNKNOWN(Billing 의 play-services-location 의존) |
| 사진 및 동영상 | 아니오 — 기기 안 처리, 공유는 사용자 시작 | 아니오 | — | — | — | — | — | CONFIRMED |
| 파일 및 문서 | 아니오 — 동일 | 아니오 | — | — | — | — | — | CONFIRMED |
| 앱 활동(App interactions 등) | 아니오 | 아니오 | — | — | — | — | — | CONFIRMED(앱 코드) |
| 앱 정보 및 성능(크래시·진단) | 아니오(앱 코드·SDK 없음) | 아니오 | — | — | — | — | — | CONFIRMED(앱) / **UNKNOWN**(Billing 의 datatransport) |
| 기기 또는 기타 ID | 아니오(앱 코드) | 아니오 | — | — | — | — | — | CONFIRMED(앱) / UNKNOWN(라이브러리) |
| 공통: 전송 암호화 | 영수증 요청 https 강제 | | | | | 예 | | CONFIRMED |
| 공통: 사용자 삭제 요청 방법 제공 | 기기 데이터는 앱에서 삭제 가능. 서버 측은 경로 없음 | | | | | | [OWNER INPUT REQUIRED] | OWNER INPUT REQUIRED |
| 공통: Android 자동 백업 | 사용자 Google 계정 백업(Android 기능). Data Safety 신고 대상 여부 — 공식 Data safety 도움말에 언급 없음 | | | | | | | **UNKNOWN / OWNER INPUT REQUIRED** |

## 6. UNKNOWN 해소 방법 (앱 코드 수정 없이)
1. Billing Library 의 datatransport 사용 — Google Play SDK Index 의 `com.android.billingclient:billing` 데이터 안내를 OWNER 가 Console 로그인 상태로 확인(37차 비로그인 조회에서 본문 없음).
2. 영수증 서버 호스팅의 요청 로그(IP 등)·보관 기간 — 호스팅 선택 시 결정.
3. 자동 백업 — 유지할지(`allowBackup`) OWNER 결정 후 방침·Data Safety 에 반영.
4. SYSTEM_ALERT_WINDOW는 45.40 release 전용 제거. VIBRATE·WRITE_EXTERNAL_STORAGE≤32 필요성은 후속 실기기 확인. 최종 서명 산출물의 권한 재확인 필요.

예전 구독 `pro_monthly` / `pro_yearly`는 팔지 않지만 복원에서 알아봅니다.
