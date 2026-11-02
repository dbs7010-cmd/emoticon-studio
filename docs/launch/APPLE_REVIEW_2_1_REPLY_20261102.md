# Apple 심사 보완 — Guideline 2.1 Information Needed (2026-11-02)

- 대상: iOS 앱 1.0 / 1.0.0 (7), 제출 ID 69982121-47ed-4320-88b7-b5573d375836
- Apple 메시지: 11-01 오전 4:36. 상태 "심사를 통과하지 못함 — 2.1.0 Performance: App Completeness". PRO Lifetime 은 "심사 준비됨"(앱과 함께 다시 제출).
- 같은 날 Google Play: 프로덕션 출시 통과(대표님 보고). vc26.
- 요구: App Review Information 의 **메모(Notes)** 에 아래 1~6 을 넣고 **실기기 화면 녹화**를 함께 낸 뒤 "앱 심사에 다시 제출".

## 대표님이 할 일

1. 실제 아이폰(최신 iOS)에 TestFlight build 7 설치 → 아래 "녹화 순서"대로 화면 녹화 한 편.
2. App Store Connect → iOS 앱 1.0 → 앱 심사 정보:
   - 로그인 필요: 체크 유지. 사용자 이름·암호 칸은 **비워 두고**(Sign in with Apple 로 들어오므로 데모 계정이 따로 없음) 메모에 그 이유를 적는다 — 아래 메모에 들어 있음.
   - 메모: 아래 영어 본문 전체 붙여넣기(4,000자 이내).
   - 첨부 파일: 녹화 영상 업로드. 용량 때문에 안 되면 비공개 링크(구글 드라이브 '링크가 있는 사용자 보기' 등)를 메모 맨 아래 `Screen recording:` 줄에 넣는다.
3. "앱 심사에 다시 제출".

## 녹화 순서 (한 편, 끊지 않고)

설정 › 제어 센터에 '화면 기록' 추가 → 앱을 완전히 닫은 상태에서 녹화 시작.

1. 홈 화면에서 emoti 아이콘을 눌러 **앱 실행**부터 찍는다.
2. **Apple로 계속하기** → 로그인 → 작가명 정하기(새 계정이면). = 계정 만들기·로그인.
3. 새 세트 만들기 → 첫 칸에 손가락으로 그리기 → 움직이기에서 효과 하나 적용 → 미리보기.
4. 내보내기 화면 열어서 카카오·LINE 파일 만들기 보여 주기(실제 카카오·LINE 제출은 하지 않음).
5. **PRO 화면** → 구매(TestFlight 는 샌드박스라 실제 결제 안 됨) → PRO 기능(잠겨 있던 움직임 등) 하나 써 보기 → **구매 복원** 눌러 보이기.
6. 공모전 탭 → 제출 화면까지 보여 주기(실제 제출은 하지 않아도 됨, 남에게 공개되지 않는다는 점을 메모에서 설명).
7. 내 정보 탭 → 계정 → **탈퇴(서버 데이터 삭제)** → 확인 → 로그인 화면으로 돌아가는 것까지. = 계정 삭제.
8. 녹화 종료.

녹화용으로 쓰고 지워도 되는 Apple ID 로 하는 게 편하다(마지막에 탈퇴하므로).

## 메모(Notes) — 그대로 붙여넣기

```text
Screen recording: attached (physical iPhone, latest iOS, build 1.0.0 (7)). It starts at app launch and shows sign-in, account creation, drawing, motion, export, PRO purchase and restore, the contest entry screen, and account deletion.

1. SIGN-IN / DEMO ACCOUNT
The app requires sign-in so that a user's sets, backups and PRO purchase are tied to one account. On iOS, "Sign in with Apple" is shown first; Google, Kakao and Naver are also available. No separate demo username/password exists: please tap "Sign in with Apple" with any Apple ID. On first sign-in an account is created automatically and the user picks an artist (display) name.
Account deletion: bottom tab "내 정보" (My) > Account section > "탈퇴(서버 데이터 삭제)" (Delete account) > confirm. This deletes the account and its server data (backups and contest entries) and signs the user out.

2. PURPOSE AND AUDIENCE
emoti is a drawing app for making animated emoticon/sticker sets on a phone or tablet. It is for people (age 14+) who want to create their own emoticons but find desktop drawing and animation tools hard to use. The user draws with a finger or stylus, applies simple motions (bounce, wave, etc.) instead of drawing frame by frame, and exports files in the sizes required to propose a set to the KakaoTalk Emoticon Studio or LINE Creators Market. Free video lessons in the app teach the workflow.

3. HOW TO USE THE MAIN FEATURES
- After sign-in, tap the "+" / new set button on Home to create a set, then tap the first slot to open the canvas and draw.
- Open the motion tab above the canvas and tap a motion to animate the drawing; play the preview.
- From the set board, open Export to create Kakao or LINE files. Uploading those files to Kakao or LINE is done by the user outside the app.
- Lessons are on Home (built-in videos, no account needed beyond sign-in).
- PRO ("emoti PRO Lifetime", one-time non-consumable IAP) unlocks additional motions and motion combinations, motion for a single layer, applying one motion to a whole set, cloud backup/restore of sets, and removes ads. Free users can preview PRO motions on their own drawing before buying. Open PRO from Home or the My tab; "Restore purchases" is on the same screen. Please test purchase and restore with a Sandbox account.
- Free users watch one rewarded ad (Google AdMob) when they create an export file package; drawing, motion, lessons and contests have no ads. If an ad cannot load, the export still proceeds. PRO users see no ads.

4. EXTERNAL SERVICES
- Sign in with Apple, Google Sign-In, Kakao Login, Naver Login: authentication.
- Google Firebase (Authentication, Cloud Functions, Firestore/Storage, Hosting): account, backup, contest entries, and server-side verification of the in-app purchase receipt.
- Apple In-App Purchase (StoreKit): the PRO purchase.
- Google AdMob: optional rewarded ads for free users.
The app does not use any AI service to generate drawings.

5. REGIONAL DIFFERENCES
The app is distributed in Korea, Japan and Taiwan. Features are the same in all regions. The interface is in Korean, Japanese or Traditional Chinese according to the device language; devices set to any other language (e.g. English) show the Korean interface.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. All characters and lesson content are our own. The app does not include KakaoTalk or LINE content; it only creates image files in the sizes those platforms publish for creators.

User-generated content: drawings stay on the device (and in the user's own backup). Contest entries are sent privately to us for judging and are never shown to other users; the app has no public feed, comments or messaging between users, so there is no content for other users to report or block.
```

## 보내기 전 대표님 확인 (사실과 다르면 메모를 고친다)

- [ ] iOS 로그인 화면에 Google·카카오·네이버도 실제로 보이는지(build 7 IPA 설정에는 셋 다 있음). 안 보이면 1번 문단에서 해당 이름을 뺀다.
- [ ] 3번의 버튼 이름·위치(+ 버튼, 움직이기 탭, 내보내기, PRO 위치)가 build 7 화면과 같은지 — 녹화하면서 확인.
- [ ] PRO 혜택 문장(추가 움직임·조합, 레이어 부분 움직임, 한 번에 적용, 클라우드 백업, 광고 없음)이 지금 구매 화면 설명과 맞는지.
- [ ] 공모전이 일본·대만에서도 같은지. 다르면 5번에 "Contest events are operated for Korea only." 한 줄 추가.
