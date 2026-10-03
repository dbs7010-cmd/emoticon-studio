# 홍보용 예시 작품 (emoti 이모티 스토어 그림)

- `characters/` — 운영자가 만든 오리지널 캐릭터(사용자 작품 아님). 360×360 투명 PNG, 앱에 그대로 가져와 쓸 수 있다.
  - 주인공 '몽이' 12 표현: hello(안녕) · excited(신나) · thanks(고마워) · sorry(미안해) · good(좋아) · congrats(축하해) · sleepy(졸려) · teary(울먹) · surprised(놀람) · cheer(응원) · pouty(삐짐) · goodnight(잘 자)
  - 보조 캐릭터: piyak(병아리 '삐약') · dubu(곰 '두부') — 각 3표현. 한 세트에 섞지 않는다.
  - 부분 움직임용 레이어: `mongi-hello-layer-body.png`(몸) + `mongi-hello-layer-arm.png`(흔드는 팔). 팔 회전 중심 = (250, 222)/360.
  - 원본(벡터): `scripts/promo/character.cjs`
- `motion/` — **앱의 실제 움직임 엔진(canvas-html)이 만든 GIF** 와 순간별 변환값(`engine-motion.json`). `scripts/promo/engine-run.cjs`
  - bounce-excited.gif(통통 · 무료) · shake-pouty.gif(흔들기 · 무료) · part-wave-hello.gif(팔만 회전 · PRO 부분 움직임)
- `store-draft/` — 1차 스토어 그림. phone 의 앱 화면 칸은 **대체 렌더(초안)** 라 'DRAFT' 표시가 있다. 실기기 캡처로 바꾼다.
