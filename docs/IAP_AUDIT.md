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

---

# 45.28차 — 구독 → **비소모성 일회성 PRO** 전환 (2026-09-24)

## 무엇이 바뀌었나

| 항목 | 이전(구독) | 지금(일회성) |
|---|---|---|
| 상품 | `pro_monthly` · `pro_yearly` (subs) | **`pro_lifetime` 하나** (in-app, 비소모성) |
| 조회 | `fetchProducts({ type:'subs' })` + offer token | `fetchProducts({ type:'in-app' })`, offer token 없음 |
| 결제 요청 | `requestPurchase({ type:'subs', google:{ subscriptionOffers } })` | `requestPurchase({ type:'in-app', google:{ skus:['pro_lifetime'] } })` |
| 확정 | `finishTransaction({ isConsumable:false })` | 같음 — **소비 처리하지 않는다**(다시 팔지 않는다) |
| 서버 조회 | `purchases.subscriptionsv2.get` | `purchases.products.get`(상품 id + 토큰) |
| 판정 | 상태 ACTIVE/GRACE + 만료 시각 | `purchaseState === 0`(구매됨) · 기한 없음 |
| 이용권 | `plan:'monthly'|'yearly'` + `expiresAt` | `plan:'lifetime'`, **`expiresAt` 없음** |
| 해지 | 스토어 구독 관리 | 해지 없음 — 스토어 **구매 내역**으로 안내 |
| 화면 | 월간·연간 두 카드에서 고르기 | 값 하나. "구독이 아니라 한 번만 결제해요" |

예전 `monthly`·`yearly` 는 **팔지 않지만 읽는다**: 저장된 이용권, 스토어에 남은 구독, 서버 판정 규칙을
그대로 두었다. 이미 가진 권한을 못 본 척해 잃게 하지 않는다(`iap-test` 가 두 경우를 함께 검사한다).

## 가격 — 후보는 문서에만 (45.29)

후보 가격은 **14,900원**이다. 이 숫자는 **이 문서에만** 있다 — 45.29 에서 앱 코드와 화면에서 모두
뺐다(`proposedPrice` · `PRICES_ARE_PROPOSED` · `PRICE_IS_CANDIDATE_NOTE` 삭제).

제품 화면은 이제 **스토어가 말해 주는 값만** 적는다:

- 정상 조회: 스토어의 현지 가격을 그대로 보이고 구매 버튼이 켜진다.
- 조회 실패: 값을 지어내지 않고 '가격을 불러오지 못했어요 · 지금은 구매할 수 없어요 · 잠시 뒤 다시
  시도해 주세요'를 적고, 구매 버튼은 꺼지며 '다시 시도'가 나온다.

확정 판매가는 Play Console 에 `pro_lifetime` 을 등록할 때 정한다. 그때까지 이 숫자는 기획 후보다.

## 자동 검사로 확인한 것

- `iap-test` — in-app 조회, `type:'in-app'` 요청·offer 없음, 서버 확인 뒤에만 이용권·확정,
  `isConsumable:false`, 기한 없는 이용권이 40년 뒤에도 PRO, 일회성 우선 복원 + 예전 구독도 복원,
  재설치 자동 복원, 환불·다른 계정이면 종료(기록 보존), 화면(가격·성공·구매 내역·취소·실패·복원·
  조회 실패 시 값 없음·재시도 안내·버튼 꺼짐), 오류 코드 노출 없음.
- `server-test` — 일회성 판정: 구매됨만 통과·기한 없음·취소/보류/다른 상품/구독 응답 거절·
  테스트 구매는 서버 설정이 정한다. 예전 구독 판정은 그대로.
- `pro-test` · `review-pro-test` — 권한 규칙과 내부 검수 PRO 분리 그대로.

## 지금도 막혀 있는 것 (외부 · 우리가 코드로 풀 수 없다)

| 막힌 것 | 무엇이 필요한가 | 지금 상태 |
|---|---|---|
| 스토어 계정 요건 | Play Console 개발자 계정, 앱 등록, **`pro_lifetime` 앱 내 상품 등록**(비소모성), 라이선스 테스터 등록 | 없음 — 상품이 없으면 `listProducts` 가 `not-found`, 화면은 구매 버튼을 꺼 둔다 |
| 실제 구매 | 위 계정 + Play 스토어에서 받은 앱(내부 테스트 트랙) + 기기의 Play 로그인 | 미검증. 가짜 스토어로만 확인했다 |
| 영수증 확인 서버 | 서버 배포(HTTPS), `GOOGLE_SERVICE_ACCOUNT_JSON`, `ANDROID_PACKAGE_NAME`, 빌드 시 `EMOTICON_RECEIPT_ENDPOINT` | 코드만 있음. 주소가 없으면 앱은 **이용권을 만들지 않는다**(`not-configured`) |
| 업로드 서명 | `EMOTICON_UPLOAD_STORE_FILE`·`_STORE_PASSWORD`·`_KEY_ALIAS`·`_KEY_PASSWORD` | 없음 — `release-check` SIGNING FAIL[EXTERNAL] |
| 브랜드 에셋 | 아이콘·스플래시·피처 그래픽·스크린샷 | `release-check` ASSETS BLOCKED |
| iOS | `ios/` 프로젝트, App Store Server API 판정 | 없음 |

**막히지 않은 것**: 저장(로컬 파일)과 내보내기(파일 묶음)는 무료 기능이고 스토어 계정과 무관하다.
`export-test`·`spec-test`·`e2e-test` 가 그대로 통과한다 — PRO 가 없어도, 결제 모듈이 없어도 한 세트를
끝까지 그려 워터마크 없이 내보낼 수 있다. 이용권이 끝나도 이미 만든 PRO 움직임은 재생·내보내기가 된다.
