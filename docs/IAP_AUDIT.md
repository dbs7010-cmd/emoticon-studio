# IAP / 이용권 감사 (30차, 2026-09-14)

판정 기준: 코드와 자동 검사로 확인한 것 / 외부(스토어 계정·서버 배포·실결제)가 있어야 확인되는 것을 섞지 않는다.

## 1. 수정 전 상태 (코드 기준)
| 항목 | 있었나 | 사실 |
|---|---|---|
| PRO 화면·PRO 시작하기·구매 복원 버튼 | 있음 | 누르면 항상 실패 — 결제 모듈이 없어서 |
| 결제 모듈 | **없음** | `purchase-adapter.ts` 가 `require('expo-iap')` 를 시도했지만 패키지 미설치. API 도 옛 이름(getSubscriptions/requestSubscription) |
| Android token | **잘못됨** | `transactionReceipt ?? purchaseToken` — Play Developer API 가 조회할 수 없는 값을 먼저 보낼 수 있었다 |
| 확정(acknowledge) 순서 | **잘못됨** | 서버 확인 **전에** finishTransaction 호출 — 확인 실패해도 결제가 확정됨 |
| 영수증 확인 클라이언트 | 있음·양호 | `receipt.ts`: https 만, 모양 검사, 거절/연결 실패 구분 |
| 영수증 서버 | 코드만 | `server/verify-receipt.js`: Play subscriptionsv2 조회·상태/상품/기간/테스트 구매 판정. **배포 안 됨, 키 없음** |
| 서버 주소 설정 | **없음** | `extra.receiptEndpoint` 를 넣는 곳이 없었다 |
| 앱 시작 재확인 | **없음** | 저장된 이용권만 믿음 — 해지·환불이 반영되지 않음 |
| 내부 검수 PRO | 있음·분리됨 | `reviewUnlock` + 빌드 구성 `internalReview`, 출시 구성에서 무효(27차 실기기 확인) |
| iOS | **없음** | `ios/` 프로젝트 없음, 서버도 Android 만 |
| 오류 표시 | 개발자 문구 | "결제 모듈(expo-iap)이 이 빌드에 없습니다. Expo Go…" 가 사용자 화면에 노출 |

## 2. 구조 (수정 후)
```
PRO 화면(App.tsx)
  ├ 열 때: storePrices() ─ expo-iap fetchProducts(subs) → 스토어 가격·offer token
  ├ PRO 시작하기: purchase(plan)
  │    adapter.buy → requestPurchase(subs, google.subscriptionOffers[{sku, offerToken}])
  │                → purchaseUpdatedListener / purchaseErrorListener 의 첫 대답(우리 상품만)
  │    pro.confirm → receipt.verifyReceipt({platform, productId, purchaseToken}) → 우리 서버 → Play API
  │                → verified 일 때만 finishTransaction(acknowledge) → Entitlement(verified:true) 저장
  ├ 구매 복원: restore() ─ getAvailablePurchases → 우리 상품·결제 보류 아님·token 있음·최신 → confirm
  └ 앱 시작: refreshEntitlement(cached) ─ 한 번
       물어볼 수 없음(모듈 없음·오프라인·서버 없음·서버 연결 실패) → 그대로
       스토어: 구독 없음 / 서버: 거절 → 살아 있던 이용권을 지금 종료(기록 보존)
       살아 있는 구독 + 서버 확인 → 새 기간으로 갱신(재설치 자동 복원)
```
권한 판정은 그대로 `isPro`: `source:'store'` + `verified:true`(출시 빌드) + 기간. 검수용 해제는 `reviewUnlocked()` 로 따로.

## 3. Android token
- 서버로 가는 값은 `platform`·`productId`·`purchaseToken` 세 개뿐.
- `purchaseToken` 은 OpenIAP 의 통합 필드(Android = Play purchase token, iOS = JWS). **없으면 다른 값(주문 번호 `GPA.…`, `dataAndroid` 원본 JSON)으로 대신하지 않고** 확인을 보류(pending)한다.
- 확정은 서버 확인 뒤. 확인 못 한 구매는 확정하지 않고 남겨 둔다 → 복원·다음 실행에서 다시 확인. Play 는 3일 안에 확정되지 않은 구매를 자동 환불하므로, 서버가 끝내 없으면 사용자는 돈을 잃지 않는다(화면이 그렇게 말한다).

## 4. 서버 / 영수증 (최소 설계)
- 요청: `POST {EMOTICON_RECEIPT_ENDPOINT}` `{ platform:'android', productId, purchaseToken }`
- 서버 동작(구현됨): 서비스 계정 JWT → `androidpublisher v3 purchases.subscriptionsv2.get` → 상품 일치 · `SUBSCRIPTION_STATE_ACTIVE|IN_GRACE_PERIOD` · 만료 시각 · 테스트 구매는 `ACCEPT_TEST_PURCHASES` 일 때만.
- 응답: `{ verified, plan:'monthly'|'yearly', expiresAt?, sandbox?, reason? }` / 스토어에 못 물으면 503.
- 이용권 갱신: 앱 시작마다 스토어 보유 구매로 서버에 재확인 → 새 `expiresAt`.
- **BLOCKED(외부)**: Play Console 앱·구독 상품 등록, 서비스 계정 권한 연결, 서버 배포(HTTPS 주소), 빌드 시 `EMOTICON_RECEIPT_ENDPOINT` 주입. iOS: App Store Server API 판정·`ios/` 빌드 없음.
- 미구현(출시 후 권장): Real-time Developer Notifications(Pub/Sub)로 해지·환불 즉시 반영, 서버 측 acknowledge 백업, 계정 연동(obfuscatedAccountId).

## 5. 자동 검사로 확인한 것 / 아닌 것
- 확인(`scripts/iap-test.cjs`, 가짜 스토어·가짜 서버): 상품 조회 성공/실패, 구매 성공/취소/실패 종류별, 복원 성공/없음/보류 제외/연결 실패, 서버 없음·연결 실패·거절, Android token 우선순위, 확인 전 미확정, 앱 시작 재확인 전 경우, 화면 상태 전부, 오류 코드 노출 없음, 출시 구성 검수 스위치 없음, 무료 흐름 유지. `pro-test`(규칙)·`server-test`(서버 판정) 유지.
- **미확인**: 실제 Play 결제 시트·실결제·실제 Play API 응답·acknowledge 실동작·가격 표시(현지화) — MANUAL_QA 30차 절.

## 6. 네이티브 빌드 확인 (출시 구성, 새 APK 는 검수용으로 보관하지 않음)
- `gradlew :app:assembleRelease`(EMOTICON_INTERNAL_REVIEW 없음): BUILD SUCCESSFUL 7m18s, Kotlin 오류 0 (`verification/round30/build-release.log`).
- 병합 매니페스트에 `com.android.vending.BILLING` 포함, APK `assets/app.config` 는 `internalReview:false`, `receiptEndpoint` 없음(주소 미주입 → 앱은 구매를 확인하지 못한다고 안내).
- APK SHA-256 decff80862265b83526de622fa96905baa715443f4cc35fa1c1866d73a12f5ff, SOURCE_ID 3ebf3796bf4eae2a2e56dc73deee300092b46a1d21aa230839e5b78520db9d73. debug keystore 서명 — 업로드 불가.
- `app.json` 에 `expo-iap` 플러그인을 넣었지만 `android/` 는 이번에 다시 prebuild 하지 않았다. 권한은 Play Billing 라이브러리 매니페스트 병합으로 들어왔다. 다음 정식 빌드(EAS/prebuild) 때 플러그인 적용 결과를 재확인한다.
