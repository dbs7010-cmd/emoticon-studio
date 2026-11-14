# Codex 요청문 — 이모티 마스코트 단독 그림 (2026-10-27)

앱에는 Codex 원본 그림만 쓴다(대표 결정 10-27). 지금 원본(kon-v2-character-sheet · kon-friends-v2)에서 떨어져 있는 그림만 오려 썼고,
아래는 원본에 없거나 서로 겹쳐 있어 오릴 수 없는 그림이다. 받으면 `docs/design/mascot-v2-src/` 에 넣고 `scripts/mascot-cutout.cjs` 의 CUTS/ALIAS 를 바꾼다.

## 그대로 붙여 넣을 요청문

```
이모티 앱 마스코트 '콘(옥수수)·고구마·완두콩'을 kon-v2-character-sheet / kon-friends-v2 와 똑같은 그림체로 추가해 주세요.
(갈색 둥근 선, 수채 질감 채색, 복숭아 볼, 작은 손발, 콘은 잎사귀 옷 + 새싹 잎 두 장, 같은 색·비율·얼굴)

규격
- 한 장에 캐릭터 한 명·포즈 하나. 다른 캐릭터와 겹치지 않게.
- 투명 배경 PNG(가능하면) 또는 단색 크림 배경 #FDF9EE, 바닥 그림자 없이.
- 1024×1024, 캐릭터는 가운데, 위아래 여백 6% 정도. 글자·로고·테두리 없음.
- 움직임 선(반짝 선, zZ, 하트 등)은 캐릭터 가까이에만.

필요한 그림 (파일 이름 그대로)
콘
1. corn-base.png — 정면, 두 손 아래로 내리고 웃는 기본 자세
2. corn-bow.png — 고마워: 꾸벅 숙이며 두 손 모음
3. corn-sad.png — 슬퍼: 눈물 한 방울, 처진 눈썹
4. corn-angry.png — 화나: 찡그린 눈썹, 볼 부풀림, 머리 옆 빨간 화남 표시
5. corn-no.png — 아니: 두 손으로 X 표시, 무표정
6. corn-heart.png — 좋아: 머리 위로 두 손 하트 또는 머리 위 하트
7. corn-sorry.png — 미안: 고개 살짝 숙이고 두 손 모음, 미안한 표정
8. corn-nod.png — 응: 고개를 옆으로 살짝 기울여 끄덕이는 느낌
9. corn-wave-body.png + corn-wave-arm.png — 손 흔들기를 두 장으로 분리
   (같은 1024 캔버스·같은 위치에서, 몸 그림에는 흔드는 손이 없고, 팔 그림에는 흔드는 손(+반짝 선)만 있음. 겹쳐 놓으면 손 흔들기 한 장이 되게)
고구마
10. goguma-base.png — 정면 웃는 기본 자세
11. goguma-wave.png — 한 손 흔들기 (kon-friends-v2 위쪽 고구마 포즈를 단독으로)
12. goguma-cheer.png — 두 손 번쩍 신나
완두콩
13. kong-base.png — 정면 웃는 기본 자세
14. kong-wave.png — 한 손 흔들기
15. kong-cheer.png — 두 손 번쩍 신나 (kon-friends-v2 위쪽 완두콩 포즈를 단독으로)

전달: Notion 「10 콘과 친구들」 페이지에 15장(또는 16장) PNG 첨부.
```

## 지금 임시로 쓰는 것 (Codex 원본에서 오림)
| 앱 이름 | 지금 쓰는 원본 그림 |
|---|---|
| corn-wave · corn-base | 캐릭터 시트 큰 콘(손 흔들기) |
| corn-shy · corn-bow | 시트 오른쪽 위(두 손 모음) |
| corn-cheer · corn-heart | 시트 오른쪽 가운데(두 손 번쩍) |
| corn-sleep | 시트 오른쪽 아래(잠) |
| corn-cheer-small | 친구 그림 아래 가운데 콘 |
| corn-nod · corn-sorry | 손 흔들기 · 두 손 모음을 발끝 축으로 기울임 |
| corn-wave-arm · corn-wave-body | 손 흔들기 그림을 손/몸으로 잘라 나눔(손 밑 이음새가 조금 비침) |
| goguma-* | 친구 그림 아래 왼쪽 고구마(수줍은 하트) 한 장 |
| kong-* | 친구 그림 아래 오른쪽 완두콩(잠) 한 장 |
| 슬퍼·화나·아니 | 없음 — 강좌 표정 예시에서 빼고 다른 Codex 포즈로 대신 |
