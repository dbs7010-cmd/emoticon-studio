# 日本語・繁體中文 그림 자료 전달 — 2026-10-30

근거: [Notion 20](https://app.notion.com/p/409b8b85854a81b89781feb2515122c5). 한국어판과 콘 그림 자체는 유지하고 글자만 현지화했다.

| 자료 | 일본어 | 번체 | 크기 | 상태 |
|---|---:|---:|---|---|
| 강좌 썸네일 | 11 | 11 | 960×540 | 앱 연결용 |
| App Store 아이폰 | 5 | 5 | 1290×2796 | 실제 화면 미삽입 DRAFT |
| App Store 아이패드 | 5 | 5 | 2064×2752 | 실제 화면 미삽입 DRAFT |
| Play 소개 카드 | 5 | 5 | 1080×1920 | 실제 화면 미삽입 DRAFT |
| Play 그래픽 | 1 | 1 | 1024×500 | DRAFT |

총 54장. 강좌 썸네일 22장은 `assets/lessons/thumbs/ja/<id>.png`, `assets/lessons/thumbs/zh-Hant/<id>.png`에 있다. id는 first-set, brush-layer, motion, speech, animation, export, contest, character, expressions, set-plan, make-lesson으로 한국어판과 동일하다.

스토어 파일:

- `dist/appstore-20261029/<lang>/iphone69/01.png`~`05.png`, `ipad13/01.png`~`05.png` 및 HTML/이미지 원본.
- `dist/store-intro-20261028/<lang>/intro-01-draw.png`, `intro-02-motion.png`, `intro-03-set.png`, `intro-04-guide.png`, `intro-05-export.png`, `feature-graphic.png` 및 HTML/이미지 원본.
- 모음 폴더: `dist/localized-media-20261030/`. `index.html`에서 54장 전체를 확인할 수 있다.
- 전수 파일 목록·SHA-256·문자 검사 결과: `verification/localized-media-20261030/manifest.json`. 전달 폴더 manifest에는 bundleFile도 기록했다.

## 글자와 검사

- 썸네일 제목은 각 언어로 로드한 `LESSONS[].title`과 정확히 일치한다. 줄바꿈 위치만 별도로 정했으며 문구·공백을 바꾸지 않았다. 제목은 최대 2줄로 검사했다.
- 일본어: Yu Gothic. 번체: Microsoft JhengHei. 각 보통/굵은 글꼴의 cmap에서 실제 쓰인 글자의 glyph 존재를 검사했다. Windows 글꼴 파일은 전달물에 복사하거나 재배포하지 않았다.
- 54장 크기·알파 없는 RGB PNG, 글자 화면 밖 잘림, 표시 문구의 한국어 잔존 0을 확인했다. 한국어 썸네일·기존 Play 한국어판·콘 원본 해시는 생성 전후 동일했다.
- 일본어·번체 썸네일과 스토어 전체 컨택트시트, 대표 원본 크기 이미지를 육안 확인했다. 일본어 단어 중간 줄바꿈을 교정했다.
- `node scripts/verify-localized-media.cjs`: PASS. `asset-contract-test.cjs`: PASS. `lesson-corn-test.cjs`: PASS (Chrome 경로 지정). 첫 강좌 검사 실행의 브라우저 경로 미설정 오류는 Chrome 경로를 넣어 해결했다.
- 자동 검사·정적 이미지 검사이며 실기기에서의 글자 크기/배치 확인을 대신하지 않는다.

## 재생성

`node scripts/render-localized-media.cjs` → 썸네일·Play·App Store 54장 재생성.

`node scripts/verify-localized-media.cjs` → 크기·RGB·문자 검사. Chromium은 현재 PC의 Chrome을, 글꼴은 위 Windows 시스템 글꼴을 사용한다.

`scripts/localized-media-copy.json`에 스토어 문구·줄바꿈 기준이 있고, 강좌 제목은 앱 번역 표에서 직접 읽는다. `render-appstore-cards.cjs --lang ja` 또는 `--lang zh-Hant`는 해당 언어의 DRAFT만 만든다. 언어를 생략한 기존 한국어 동작은 유지했다.

## Claude가 이어서 할 일

- 새 썸네일의 언어별 선택 코드를 연결한다. 이번 변경에 앱 선택 코드는 넣지 않았다.
- 현지어 앱 화면을 촬영해 스토어 시안에 넣고 최종 검수한다. App Store의 흰 빈 프레임은 캡처 자리이며 실제 화면이 아니다. Play는 기존 일러스트형 소개 카드의 현지화 시안이다.
- DRAFT 표시가 있는 파일을 업로드용으로 쓰지 않는다. 현지어 캡처 합성 후 별도 최종본으로 확정한다.
- 강좌 mp4·단계 사진·vc25/iOS 빌드·실기기 검수는 Claude 담당이다. 캔버스·엔진·상품 ID·패키지·서명·버전은 변경하지 않았다.
