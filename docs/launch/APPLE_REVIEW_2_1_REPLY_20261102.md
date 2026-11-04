# Apple 심사 보완 — Guideline 2.1 Information Needed (2026-11-02, 11-04 정정)

- 대상: iOS 앱 1.0 / 1.0.0 (7), 제출 ID 69982121-47ed-4320-88b7-b5573d375836
- Apple 메시지: 11-01 오전 4:36. 상태 "심사를 통과하지 못함 — 2.1.0 Performance: App Completeness". PRO Lifetime 은 "심사 준비됨"(앱과 함께 다시 제출).
- 같은 날 Google Play: 프로덕션 출시 통과(대표님 보고). vc26.
- 요구: App Review Information 의 **메모(Notes)** 에 아래 1~6 을 넣고 **실기기 화면 녹화**를 함께 낸 뒤 "앱 심사에 다시 제출".

## 11-04 정정 — 이 앱에는 지금 로그인이 없다

- 11-02 판에는 "Sign in with Apple → 로그인 → 탈퇴" 순서가 있었다. **틀렸다.** 앱 안 로그인은 10-12 운영자 결정으로 보류됐고,
  build 7 IPA 의 `app.config` 에 서버 설정(`extra.cloud`)이 없다(11-04 IPA 를 열어 확인 — `extra.login` 은 세 회사 표시만 있고 서버 정보 없음).
  Android vc28 AAB 도 같다. 그래서 앱은 기기 안에서만 동작하고, 내 정보 탭에 "준비 중이에요 — 로그인과 PRO 클라우드 백업은 서버를 연결한 뒤에 열려요"가 뜬다.
- 따라서: 계정이 없으므로 **로그인·데모 계정·계정 삭제 항목은 해당 없음**. App Store Connect 의 "로그인 필요" 체크는 **끈다**.
  공모전 접수·클라우드 백업도 서버 연결 전이라 쓸 수 없다(앱이 그렇게 안내한다) — 메모에 그대로 적는다.
- 나중에 로그인을 켜는 빌드를 내면, 그때 Sign in with Apple·계정 삭제 안내를 다시 넣는다(Apple 4.8·5.1.1(v)).

## 대표님이 할 일

1. 실제 아이폰·아이패드(최신 iOS)에 TestFlight 최신 빌드 설치 → 아래 "녹화 순서"대로 화면 녹화 한 편(3~5분).
2. App Store Connect → iOS 앱 1.0 → 앱 심사 정보:
   - **로그인 필요: 체크 해제**(계정 없음).
   - 메모: 아래 영어 본문 전체 붙여넣기(4,000자 이내).
   - 첨부 파일: 녹화 영상 업로드. 용량 때문에 안 되면 비공개 링크(구글 드라이브 '링크가 있는 사용자 보기' 등)를 메모 맨 아래 `Screen recording:` 줄에 넣는다.
3. "앱 심사에 다시 제출".

## 녹화 순서 (한 편, 끊지 않고)

설정 › 제어 센터에 '화면 기록' 추가 → 앱을 완전히 닫은 상태에서 녹화 시작.

1. 홈 화면에서 emoti 아이콘을 눌러 **앱 실행**부터 찍는다(처음이면 안내 한 장이 나온다 → 시작).
2. 새 세트 만들기 → 첫 칸에 손가락으로 그리기 → 움직이기에서 효과 하나 적용 → 미리보기.
3. 내보내기 화면 열어서 카카오·LINE 파일 만들기 보여 주기(실제 카카오·LINE 제출은 하지 않음).
4. **PRO 화면** → 구매(TestFlight 는 샌드박스라 실제 결제 안 됨) → PRO 움직임 하나 써 보기 → **구매 복원** 눌러 보이기.
5. 강좌 탭에서 영상 하나 잠깐 열기.
6. 내 정보 탭 → "준비 중이에요"(로그인·클라우드 백업 준비 중) 안내가 보이게 한 번 비추기.
7. 녹화 종료.

## 메모(Notes) — 그대로 붙여넣기

```text
Screen recording: attached (physical device, latest iOS, current TestFlight build). It starts at app launch and shows drawing, motion, export, PRO purchase and restore, lessons, and the My tab.

1. SIGN-IN / DEMO ACCOUNT
This version has no sign-in and no user accounts. Everything works on the device without an account, so no demo account is needed. Online features (sign-in, cloud backup, contest entry) are not enabled in this version; the My tab says so ("준비 중이에요" - coming soon) and nothing is sent to a server.

2. PURPOSE AND AUDIENCE
emoti is a drawing app for making animated emoticon/sticker sets on a phone or tablet. It is for people (age 14+) who want to create their own emoticons but find desktop drawing and animation tools hard to use. The user draws with a finger or stylus, applies simple motions (bounce, wave, etc.) instead of drawing frame by frame, and exports files in the sizes required to propose a set to the KakaoTalk Emoticon Studio or LINE Creators Market. Free video lessons in the app teach the workflow.

3. HOW TO USE THE MAIN FEATURES
- Tap the "+" / new set button on Home to create a set, then tap the first slot to open the canvas and draw.
- Open the motion tab above the canvas and tap a motion to animate the drawing; play the preview.
- From the set board, open Export to create Kakao or LINE files. Uploading those files to Kakao or LINE is done by the user outside the app.
- Lessons are on the Lessons tab (built-in videos).
- PRO ("emoti PRO Lifetime", one-time non-consumable IAP) unlocks additional motions and motion combinations, motion for a single layer, applying one motion to a whole set, and removes ads. Free users can preview PRO motions on their own drawing before buying. Open PRO from Home or the My tab; "Restore purchases" is on the same screen. Please test purchase and restore with a Sandbox account.
- Free users watch one rewarded ad (Google AdMob) when they create an export file package; drawing, motion and lessons have no ads. If an ad cannot load, the export still proceeds. PRO users see no ads.

4. EXTERNAL SERVICES
- Apple In-App Purchase (StoreKit): the PRO purchase. The purchase receipt is verified by our server (Google Firebase Cloud Functions); no personal data is sent.
- Google AdMob: optional rewarded ads for free users.
The app does not use any AI service to generate drawings.

5. REGIONAL DIFFERENCES
The app is distributed in Korea, Japan and Taiwan. Features are the same in all regions. The interface is in Korean, Japanese or Traditional Chinese according to the device language; devices set to any other language (e.g. English) show the Korean interface.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. All characters and lesson content are our own. The app does not include KakaoTalk or LINE content; it only creates image files in the sizes those platforms publish for creators.

User-generated content: drawings stay on the device. There is no public feed, comments or messaging between users, so there is no content for other users to report or block.
```

## 보내기 전 대표님 확인 (사실과 다르면 메모를 고친다)

- [ ] 녹화에 쓴 빌드 번호를 메모 첫 줄 괄호에 적는다 — 11-04 TestFlight 에 올린 build 1.0.0 (8)(EAS 2aa1aeb2, 앱 코드 f8c2a7f, 서버 설정 없음 확인).
- [ ] 3번의 버튼 이름·위치(+ 버튼, 움직이기 탭, 내보내기, PRO 위치, 강좌 탭)가 녹화한 빌드 화면과 같은지.
- [ ] PRO 혜택 문장이 지금 구매 화면 설명과 맞는지(클라우드 백업은 이 판에서 뺐다 — 서버 연결 전).
- [ ] 4번: 영수증 확인 서버를 실제로 쓰는지(빌드에 receiptEndpoint 가 들어 있음 — build 7 확인). 결제 테스트 때 복원까지 되면 그대로 둔다.
