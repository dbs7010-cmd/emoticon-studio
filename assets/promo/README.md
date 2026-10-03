# 홍보용 예시 작품 (emoti 이모티 스토어 그림)

- `characters/` — 운영자가 만든 오리지널 캐릭터(사용자 작품 아님). 360×360 투명 PNG, 앱에 그대로 가져와 쓸 수 있다.
  - 주인공 '몽이' 12 표현: hello(안녕) · excited(신나) · thanks(고마워) · sorry(미안해) · good(좋아) · congrats(축하해) · sleepy(졸려) · teary(울먹) · surprised(놀람) · cheer(응원) · pouty(삐짐) · goodnight(잘 자)
  - 보조 캐릭터: piyak(병아리 '삐약') · dubu(곰 '두부') — 각 3표현. 한 세트에 섞지 않는다.
  - 부분 움직임용 레이어: `mongi-hello-layer-body.png`(몸) + `mongi-hello-layer-arm.png`(흔드는 팔). 팔 회전 중심 = (250, 222)/360.
  - 원본(벡터): `scripts/promo/character.cjs`
- `motion/` — **앱의 실제 움직임 엔진(canvas-html)이 만든 GIF** 와 순간별 변환값(`engine-motion.json`). `scripts/promo/engine-run.cjs`
  - bounce-excited.gif(통통 · 무료) · shake-pouty.gif(흔들기 · 무료) · part-wave-hello.gif(팔만 회전 · PRO 부분 움직임)
- `store-draft/` — 1차 스토어 그림. phone 의 앱 화면 칸은 **대체 렌더(초안)** 라 'DRAFT' 표시가 있다. 실기기 캡처로 바꾼다.
  - **1차는 대체됨(2026-10-03)**: 통통을 좌우 호(arc)로 배치했으나 엔진 값은 좌우 이동 0(제자리 위아래)이라 맞지 않았고, ①의 앱 화면이 '없음' 선택 상태였다. 기록으로 남긴다.
- `store-draft-v2/` — 2차 스토어 그림(그래픽 이미지 + 휴대전화 ①~④). 세트 예시 '몽이의 하루'(몽이 12표현). `scripts/promo/compose.cjs`
  - 통통: 같은 세로축에 눌린 잔상(t0) + 뜬 순간(t0.25) + 그림자. 부분 움직임: 손 레이어만 −30°/0°/+30°, 몸 그대로.
  - 앱 화면 칸: `PROMO_SCENES=1 PROMO_SET_NAME='몽이의 하루' node scripts/_screens.cjs verification/promo/ui-v2 390 844` 의 대체 렌더 → 'DRAFT' 표시 유지.
    ① 02칸 신나 · 움직이기 · 통통 선택(세기 세게/속도 보통) ② 10칸 응원 · 그리기 ③ 01칸 안녕 · 부분만 움직이기(손 회전) ④ 보드 12개 완성 / 32칸
  - 실기기 캡처가 생기면 `--device <폴더>`(phone-1.png~phone-4.png)로 화면 칸만 바꾼다.
- `backup/` — 홍보 세트 '몽이의 하루' 백업 파일(앱 '설정 › 백업에서 되살리기'). `scripts/promo/backup-set.cjs` 가 앱의 writeBackup/readBackup/restoreBackup 으로 만들고 검사한다
  (새 세트로 추가 · 그림 새 이름 · 기존 파일 불변 · 두 번째는 '(복원)' 사본). 실기기 가져오기는 아직 안 해 봤다. 가져오기·캡처 동선: `backup/가져오기와_캡처_안내.txt`
- `store-final/` — **최종(2026-10-03)**: 휴대전화 ①~④의 앱 화면을 에뮬레이터 실제 캡처로 교체, DRAFT 없음. `node scripts/promo/compose.cjs verification/promo/store-v3 --ui verification/promo/ui-v2 --device assets/promo/device-captures`
- `device-captures/` — 에뮬레이터(Android 14 x86_64, 별도 AVD)에서 '몽이의 하루' 백업을 실제로 되살린 뒤 찍은 원본 4장(1080×2400). 앱은 같은 소스의 x86_64 빌드(arm64 APK 는 에뮬레이터 ARM 변환에서 libreactnative.so 로딩 실패).
