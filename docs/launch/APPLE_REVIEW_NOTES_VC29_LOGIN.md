# Apple 심사 메모 초안 — 로그인을 켠 버전(vc29 / iOS build 9 이후)

2026-11-04 작성. 로그인을 켠 iOS 빌드를 제출할 때 쓴다. 지금 심사 중인 build 8(로그인 없음)은
`APPLE_REVIEW_2_1_REPLY_20261102.md` 를 그대로 쓴다.

## 제출 전 대표님 확인

- [ ] App Store Connect › 앱 심사 정보 › **로그인 필요: 체크**. 사용자 이름·암호는 **비워 둔다**(Sign in with Apple 로 심사자 본인 Apple ID 로 들어온다 — 메모 1번).
- [ ] 개인정보처리방침이 11-04 개정판(Apple 로그인·App Store 결제 추가)으로 게시돼 있는지.
- [ ] App Privacy(앱 개인 정보 보호) 답변 갱신: **사용자 ID**(앱 기능 · 사용자와 연결됨 · 추적 아님), **구매 내역**(앱 기능), **사용자 콘텐츠 — 사진/기타**(클라우드 백업·공모전 접수, 사용자가 올릴 때만). 이메일·이름·연락처·위치는 수집 안 함.
- [ ] 녹화: 앱 실행 → **Apple로 계속하기** → 작가명 → 그리기·움직이기·내보내기 → PRO 구매·복원 → 공모전 화면 → 내 정보 › **회원 탈퇴** → 로그인 화면으로 돌아감.
- [ ] 메모 첫 줄의 빌드 번호.

## 메모(Notes) — 그대로 붙여넣기

```text
Screen recording: attached (physical device, latest iOS, build 1.0.0 (9)). It starts at app launch and shows Sign in with Apple, choosing an artist name, drawing, motion, export, PRO purchase and restore, the contest screen, and account deletion.

1. SIGN-IN / DEMO ACCOUNT
The app requires sign-in so that a user's cloud backup, contest entries and PRO purchase are tied to one account. On iPhone and iPad, "Sign in with Apple" is shown first; Kakao, Naver and Google are also offered. No demo username/password is needed: please tap "Sign in with Apple" with any Apple ID. On first sign-in an account is created and the user picks an artist (display) name. The app asks for no name or email from any provider; it receives only the provider's user identifier.

ACCOUNT DELETION: bottom tab "내 정보" (My) > under "로그아웃" (Log out) tap the small "회원 탈퇴" (Delete account) link > confirm. This deletes the account, artist name, cloud backups and contest entries on our server, revokes the Sign in with Apple token, and returns to the sign-in screen. Drawings saved on the device are kept. Deletion is also available on the web: https://emoti-18d80.web.app/account/

2. PURPOSE AND AUDIENCE
emoti is a drawing app for making animated emoticon/sticker sets on a phone or tablet. It is for people (age 14+) who want to create their own emoticons but find desktop drawing and animation tools hard to use. The user draws with a finger or stylus, applies simple motions (bounce, wave, etc.) instead of drawing frame by frame, and exports files in the sizes required to propose a set to the KakaoTalk Emoticon Studio or LINE Creators Market. Free video lessons in the app teach the workflow.

3. HOW TO USE THE MAIN FEATURES
- After sign-in, tap the "+" / new set button on Home to create a set, then tap the first slot to open the canvas and draw.
- Open the motion tab above the canvas and tap a motion to animate the drawing; play the preview.
- From the set board, open Export to create Kakao or LINE files. Uploading those files to Kakao or LINE is done by the user outside the app.
- Lessons are on the Lessons tab (built-in videos).
- Contest tab: when a contest is open, the user can submit one of their own sets drawn in the app. Entries are sent privately to us for judging and are never shown to other users.
- PRO ("emoti PRO Lifetime", one-time non-consumable IAP) unlocks additional motions and motion combinations, motion for a single layer, applying one motion to a whole set, cloud backup/restore of sets, and removes ads. Free users can preview PRO motions on their own drawing before buying. Open PRO from Home or the My tab; "Restore purchases" is on the same screen. Please test purchase and restore with a Sandbox account.

4. EXTERNAL SERVICES
- Sign in with Apple, Kakao Login, Naver Login, Google Sign-In: authentication (user identifier only).
- Google Firebase (Authentication, Cloud Functions, Firestore/Storage, Hosting): account, cloud backup, contest entries, and server-side verification of the App Store signed transaction for the PRO purchase.
- Apple In-App Purchase (StoreKit): the PRO purchase.
The iOS app shows no ads. The app does not use any AI service to generate drawings.

5. REGIONAL DIFFERENCES
The app is distributed in Korea, Japan and Taiwan. Features are the same in all regions. The interface is in Korean, Japanese or Traditional Chinese according to the device language; devices set to any other language (e.g. English) show the Korean interface.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. All characters and lesson content are our own. The app does not include KakaoTalk or LINE content; it only creates image files in the sizes those platforms publish for creators.

User-generated content: drawings stay on the device and in the user's own cloud backup. There is no public feed, comments or messaging between users, so there is no content for other users to report or block.
```

## 근거(코드 확인 2026-11-04)

- Apple 로그인: `App.tsx` loginApple → `signInWithApple`(account.ts) → 서버 `exchangeApple`(apple.js), requestedScopes 없음. iOS 에서만 버튼(`AppleAuthentication.isAvailableAsync`).
- 탈퇴: `cloud-screen.tsx` '회원 탈퇴' 링크 → `deleteMyAccount`(index.js) → `revokeApple`. 운영 서버 인덱스(submissions uid·status) 11-04 배포.
- iOS 광고 없음: `ads.ts` rewardedUnit 이 android 가 아니면 null.
- iOS 결제 확인: `purchase.js` platform 'ios' → `apple-receipt.js` 서명 확인.
