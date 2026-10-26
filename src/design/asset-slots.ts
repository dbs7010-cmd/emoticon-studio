// 최종 일러스트가 들어갈 자리. 에셋이 들어와도 레이아웃을 다시 짜지 않도록 비율·표시 크기·안전 영역을 여기서 못 박는다.
// source 가 null 이면 AssetSlot 이 따뜻한 도형 자리표시를 그린다(에셋 없이도 구성이 완성돼 보여야 한다).
// 에셋을 넣을 때는 source 만 require(...) 로 바꾼다. 비율이 다른 그림을 넣지 않는다.
import type { ImageSourcePropType } from 'react-native';

export type AssetSlotSpec = {
  aspectRatio: number;          // width / height
  display: string;              // 화면에서 차지하는 크기(dp)
  sourceSize: string;           // 권장 제작 해상도(@3x · @2x · @1x / 마스터) — ASSET_PRODUCTION_SPEC 과 같은 값
  safeArea: string;             // 그림의 중요한 부분이 들어가야 하는 안쪽 영역
  background: 'transparent' | 'opaque';
  source: ImageSourcePropType | null;
  // 전·후 두 장이 필요한 자리(PRO 비교)만 쓴다. 나머지 자리는 source 한 장이면 된다.
  sourceAfter?: ImageSourcePropType | null;
  // PRO 비교의 셋째 장(단계로 잇기). 2026-10-15: 같은 그림에 무료 통통 / PRO 부분 / PRO 단계를 건 세 장.
  sourceSteps?: ImageSourcePropType | null;
};

export type ExpressionGuideCard = {
  id: string;
  category: string;
  name: string;
  hint: string;
  // 파일이 실제로 들어온 카드에만 정적 require(...)를 넣는다. 없으면 기존 준비 중 자리표시를 쓴다.
  artwork?: ImageSourcePropType;
  // 45.17차: 한 감정 아래의 여러 표현(표정·자세·구도). 없으면 카드는 예전처럼 바로 그리기로 간다.
  examples?: ExpressionExample[];
  // 감정 목록에서 이 카드를 대표하는 예시의 id. 그 예시의 그림을 그대로 쓴다 —
  // 같은 그림을 한 번 더 require 하지 않으므로 묶음에 두 번 들어가지 않는다.
  cover?: string;
};

// 표현 가이드는 창작자의 내비게이션이다: 한 감정에서 여러 표현을 보고 골라 자기 캐릭터로 응용한다.
// 흐름은 감정 선택 → 표현 보기 → 예시 선택 → (참고하며 그리기 | 밑그림으로 넣기).
// 파일 이름 규칙: assets/expression-guides/<예시 id>.png — 카드 그림(45.16차)과 같은 자리를 쓴다.
// 예시 id 는 '<카드 id>-<표현 갈래>' 라서 카드 파일 이름과 겹치지 않는다(greeting-thanks.png vs greeting-thanks-polite.png).
// 파일이 실제로 들어오기 전에는 artwork 를 두지 않는다(없는 파일을 require 하지 않는다).
// artwork 가 없으면 화면은 '준비 중'으로 두고 두 버튼(참고·밑그림)을 누를 수 없게 한다.
// 45.18차 납품: '고마워' 다섯 장은 9×9 통합 시트(1254×1254)에서 칸을 잘라 낸 것이라 실제 크기가 132×132 다.
// 권장 360 / 마스터 1024 에 못 미친다. 확대하지 않고 원본 픽셀 그대로 넣었다 — 큰 화면(참고 창·밑그림)에서는 늘어나 부드럽게 보인다.
export type ExpressionExample = {
  id: string;
  label: string;   // 표현 갈래 이름 — 감정 이름과 함께 읽힌다('고마워 · 정중하게')
  hint: string;    // 무엇을 그리는지 한 줄
  // 밑그림으로 캔버스에 깔리는 원본. 선만 있고 속이 비어 있다 — 이것은 바꾸지 않는다.
  artwork?: ImageSourcePropType;
  // 카드 위에 보여 줄 때만 쓰는 그림. 몸 안이 흰색이라 카드 색이 몸으로 비치지 않는다.
  // 바깥은 그대로 투명하다(그림 전체를 흰 사각형으로 덮지 않았다). 없으면 artwork 를 그대로 쓴다.
  display?: ImageSourcePropType;
};

export const ASSET_SLOTS = {
  // 홈 첫 화면 오른쪽. 창작 표면 위에 겹쳐 앉는 캐릭터. 표면 바탕이 비치도록 투명 PNG.
  // 40차 최종 배치(App.tsx): 창작 표면 오른쪽 위 right 14 · top 16, 화면폭 < 380dp 이면 96, 아니면 112. 아래 12% 는 행동 줄과 겹칠 수 있어 비운다.
  homeHeroArtwork: { aspectRatio: 1, display: '96×96 (폭 < 380dp) / 112×112 (그 외) — 표면 오른쪽 위', sourceSize: '336(@3x) · 224 · 112 / 마스터 1024', safeArea: '주 피사체는 칸의 오른쪽 79% × 위쪽 89% 안(왼쪽 21%·아래 11% 비움 — 제목·행동 줄 침범 방지)', background: 'transparent', 
    // 2026-10-07: 코드로 그린 임시 자리표시(노랑 원 + 흰 스티커 얼굴) 대신 지금 앱의 선 그림 캐릭터(표현 가이드 표시용 그림)를 쓴다.
    // 2026-10-16 대표 캐릭터 콘(옥수수) — 손 흔들기. 원본: scripts/mascot-cutout.cjs(Codex 그림에서 오림)
    source: require('../../assets/mascot/corn-wave.png') },
  // 공식 알림 카드 왼쪽 작은 그림.
  noticeArtwork: { aspectRatio: 1, display: '44×44', sourceSize: '132(@3x) · 88 · 44 / 마스터 512', safeArea: '가운데 76%', background: 'transparent', 
    // 2026-10-07: 코드로 그린 임시 자리표시(노랑 원 + 흰 스티커 얼굴) 대신 지금 앱의 선 그림 캐릭터(표현 가이드 표시용 그림)를 쓴다.
    source: require('../../assets/mascot/corn-base.png') },
  // 기본 레퍼런스 한 칸. 2~2.5등신 관절 인형 전신이 들어가므로 세로형. 44차 LOCK: 참고 패널의 4열 격자(좌우 여백 12, 간격 8).
  // source 가 없으면 BuiltinReferences 가 회색 관절 인형 자리표시를 그린다. source 를 넣으면 같은 칸에 그 그림이 들어간다(분류별 목록은 에셋 라운드).
  referencePoseThumbnail: { aspectRatio: 3 / 4, display: '4열 격자 한 칸: 폭 floor((화면폭 − 24 − 8×3) / 4), 높이 = 폭 × 4/3 → 360dp 78×104 · 384dp 84×112 · 412dp 91×121', sourceSize: '썸네일 192×255 + 캔버스용 투명 원본 1080×1440', safeArea: '위아래 6%, 좌우 10% 여백 — 전신이 칸 안, 발끝 바닥선 94%', background: 'opaque', source: null },
  // 표현 가이드 카드 윗부분 그림(44차 LOCK). 2열 카드(간격 12) 안 정사각 틀(모서리 14, #F3F1EC) 가운데에 틀의 80% 크기로 앉는다.
  expressionGuideArtwork: { aspectRatio: 1, display: '틀 = floor((화면폭 − 32 − 12) / 2) − 20 → 360dp 138 · 384dp 150 · 412dp 164, 그림 = 틀 × 0.8 → 110 · 120 · 131', sourceSize: '360(@3x) · 240 · 120 / 마스터 1024 × 카드 수', safeArea: '가운데 84% — 몸짓 전체가 칸 안, 바닥선 90%. 표정·몸짓만으로 뜻이 읽혀야 한다(글자 없음)', background: 'transparent', source: null },
  // 움직이기 효과 견본에 그림이 없을 때(빈 칸) 쓰는 기본 캐릭터.
  motionExampleArtwork: { aspectRatio: 1, display: '48×48 견본 칸 안 41×41 그림(86%)', sourceSize: '123(@3x) · 82 · 41 / 마스터 512', safeArea: '가운데 86% — 통통 위로 16%, 흔들기 ±9° 회전, 두근거리기 1.14배에서도 칸 안', background: 'transparent',
    // 최종 그림이 올 때까지 앱 기본 캐릭터. 그림이 있는 칸에서는 언제나 사용자의 그림이 먼저다(44.2차 규칙 그대로).
    // 2026-10-06: 종이 질감 입체 캐릭터(mascot-paper, 예전 디자인)를 지금 앱의 선 그림 캐릭터(표현 가이드 '손 흔들며' 표시용)로 바꿨다.
    source: require('../../assets/mascot/corn-base.png') },
  // 내보내기에서 모든 칸이 완성됐을 때 요약 표면 오른쪽.
  exportSuccessArtwork: { aspectRatio: 1, display: '84×84', sourceSize: '252(@3x) · 168 · 84 / 마스터 1024', safeArea: '가운데 84%', background: 'transparent', 
    // 2026-10-07: 코드로 그린 임시 자리표시(노랑 원 + 흰 스티커 얼굴) 대신 지금 앱의 선 그림 캐릭터(표현 가이드 표시용 그림)를 쓴다.
    source: require('../../assets/mascot/corn-cheer.png') },
  // PRO 화면 위쪽 비교(App.tsx proSheet). 16:9 따뜻한 표면(폭 화면-32, 최대 높이 214, 안쪽 여백 14)은 앱이 그리고,
  // 그 안에 1:1 그림 두 장(86×86, 왼쪽 '전체 움직임' · 오른쪽 '부분 움직임')과 화살표·부분 표시·라벨이 들어간다.
  // 두 장은 **같은 그림**이다 — 바뀌는 것은 캐릭터가 아니라 무엇이 움직이느냐이기 때문이다.
  proFeatureArtwork: { aspectRatio: 1, display: '86×86 같은 그림 세 장(전체 움직임·부분 움직임·이어 움직임) — 아래 라벨은 앱이 그림', sourceSize: '360 GIF × 3 (scripts/pro-clips.cjs 가 앱 엔진으로 굽는다)', safeArea: '칸 안 — 굽는 스크립트가 잘림 없음을 검사한다', background: 'transparent',
    // 두 쪽은 **같은 그림**이다. 달라지는 것은 캐릭터가 아니라 '무엇이 움직이는가'이고, 그 차이는 앱이 그리는 부분 표시와 라벨이 말한다.
    // 이미 있는 표현 가이드 그림(손 흔들기)을 쓴다 — 손만 따로 움직이는 예가 부분 움직임과 그대로 맞는다.
    // 2026-10-15: 정지 그림 두 장 → **앱 엔진으로 구운 움직이는 GIF 세 장**(같은 그림 · 같은 크기). 구매 전에 무엇이 달라지는지 실제 움직임으로 본다.
    source: require('../../assets/pro/basic.gif'), sourceAfter: require('../../assets/pro/part.gif'), sourceSteps: require('../../assets/pro/steps.gif') },
} satisfies Record<string, AssetSlotSpec>;

export type AssetSlotName = keyof typeof ASSET_SLOTS;

// 표현 가이드(44차 LOCK). 역할: "무엇을 그릴까?" — 홈의 '표현 가이드'에서 분류 → 표현 카드(그림 · 표현 이름 · 짧은 몸짓 힌트)로 훑는다.
// "어떻게 그릴까?"는 기본 레퍼런스(그리기 화면 › 참고)가 맡는다. 캔버스 위에는 가이드를 띄우지 않는다. 긴 설명·대화형·생성 기능 없음.
// ready=false 는 전체 목록이 아직 납품 완료되지 않았다는 뜻이다. 화면은 카드별 artwork 유무를 따로 판단한다.
// artwork 가 없는 카드는 expressionGuideArtwork 규격의 기존 준비 중 자리표시를 쓴다. 카드 글자는 앱이 그린다(그림에 굽지 않는다).
export const EXPRESSION_GUIDE = {
  ready: false,
  categories: ['기쁨·인사', '슬픔·미안', '화남·억울', '놀람·당황', '일상'] as const,
  cards: [
    {
      id: 'greeting-hello', category: '기쁨·인사', name: '안녕', hint: '손 크게 흔들기', cover: 'greeting-hello-wave',
      examples: [
        { id: 'greeting-hello-wave', label: '손 흔들며', hint: '손 흔들며 인사', artwork: require('../../assets/expression-guides/greeting-hello-wave.png'), display: require('../../assets/expression-guides/display/greeting-hello-wave.png') },
        { id: 'greeting-hello-peek', label: '빼꼼', hint: '빼꼼 보기', artwork: require('../../assets/expression-guides/greeting-hello-peek.png'), display: require('../../assets/expression-guides/display/greeting-hello-peek.png') },
        { id: 'greeting-hello-welcome', label: '양팔 벌려', hint: '양팔 벌려 환영', artwork: require('../../assets/expression-guides/greeting-hello-welcome.png'), display: require('../../assets/expression-guides/display/greeting-hello-welcome.png') },
        { id: 'greeting-hello-turn', label: '고개를 돌려', hint: '몸은 앞을 향하고 고개는 옆으로 돌리기', artwork: require('../../assets/expression-guides/greeting-hello-turn.png'), display: require('../../assets/expression-guides/display/greeting-hello-turn.png') },
      ],
    }, {
      id: 'greeting-thanks', category: '기쁨·인사', name: '고마워', hint: '두 손 모아 꾸벅', cover: 'greeting-thanks-polite',
      // 45.17차 첫 흐름. 카드의 이름·힌트·차례는 그대로 두고 표현 다섯 갈래만 아래에 달았다.
      examples: [
        { id: 'greeting-thanks-polite', label: '정중하게', hint: '두 손 모으고 깊게 꾸벅', artwork: require('../../assets/expression-guides/greeting-thanks-polite.png'), display: require('../../assets/expression-guides/display/greeting-thanks-polite.png') },
        { id: 'greeting-thanks-moved', label: '감격해서', hint: '눈물 맺힌 눈으로 선물 꼭 안기', artwork: require('../../assets/expression-guides/greeting-thanks-moved.png'), display: require('../../assets/expression-guides/display/greeting-thanks-moved.png') },
        { id: 'greeting-thanks-friendly', label: '친근하게', hint: '엄지 척하며 씩 웃기', artwork: require('../../assets/expression-guides/greeting-thanks-friendly.png'), display: require('../../assets/expression-guides/display/greeting-thanks-friendly.png') },
        { id: 'greeting-thanks-grand', label: '과장해서', hint: '바닥까지 큰절하기', artwork: require('../../assets/expression-guides/greeting-thanks-grand.png'), display: require('../../assets/expression-guides/display/greeting-thanks-grand.png') },
        { id: 'greeting-thanks-shy', label: '수줍게', hint: '시선 피하며 작은 하트 내밀기', artwork: require('../../assets/expression-guides/greeting-thanks-shy.png'), display: require('../../assets/expression-guides/display/greeting-thanks-shy.png') },
      ],
    },
    {
      id: 'greeting-like', category: '기쁨·인사', name: '좋아', hint: '엄지 척', cover: 'greeting-like-thumb',
      examples: [
        { id: 'greeting-like-thumb', label: '엄지척', hint: '엄지척 미소', artwork: require('../../assets/expression-guides/greeting-like-thumb.png'), display: require('../../assets/expression-guides/display/greeting-like-thumb.png') },
        { id: 'greeting-like-hands', label: '두 손 모아', hint: '두 손 모아 기쁨', artwork: require('../../assets/expression-guides/greeting-like-hands.png'), display: require('../../assets/expression-guides/display/greeting-like-hands.png') },
        { id: 'greeting-like-content', label: '여유롭게', hint: '눈 감고 여유', artwork: require('../../assets/expression-guides/greeting-like-content.png'), display: require('../../assets/expression-guides/display/greeting-like-content.png') },
      ],
    }, {
      id: 'greeting-excited', category: '기쁨·인사', name: '신나', hint: '두 팔 번쩍', cover: 'greeting-excited-cheer',
      examples: [
        { id: 'greeting-excited-jump', label: '점프하며', hint: '신나서 점프', artwork: require('../../assets/expression-guides/greeting-excited-jump.png'), display: require('../../assets/expression-guides/display/greeting-excited-jump.png') },
        { id: 'greeting-excited-cheer', label: '양팔 들고', hint: '양팔 들고 환호', artwork: require('../../assets/expression-guides/greeting-excited-cheer.png'), display: require('../../assets/expression-guides/display/greeting-excited-cheer.png') },
        { id: 'greeting-excited-dance', label: '춤추며', hint: '가볍게 춤추기', artwork: require('../../assets/expression-guides/greeting-excited-dance.png'), display: require('../../assets/expression-guides/display/greeting-excited-dance.png') },
      ],
    },
    {
      id: 'sad-sorry', category: '슬픔·미안', name: '미안해', hint: '고개 푹 숙이기', cover: 'sad-sorry-deep-bow',
      examples: [
        { id: 'sad-sorry-please', label: '두 손 모아', hint: '두 손 모아 부탁', artwork: require('../../assets/expression-guides/sad-sorry-please.png'), display: require('../../assets/expression-guides/display/sad-sorry-please.png') },
        { id: 'sad-sorry-deep-bow', label: '깊게 숙여', hint: '깊게 숙이기', artwork: require('../../assets/expression-guides/sad-sorry-deep-bow.png'), display: require('../../assets/expression-guides/display/sad-sorry-deep-bow.png') },
        { id: 'sad-sorry-timid', label: '주눅 들어', hint: '주눅 들어 몸 숙이기', artwork: require('../../assets/expression-guides/sad-sorry-timid.png'), display: require('../../assets/expression-guides/display/sad-sorry-timid.png') },
      ],
    }, {
      id: 'sad-sad', category: '슬픔·미안', name: '슬퍼', hint: '무릎 안고 앉기', cover: 'sad-sad-hug-knees',
      examples: [
        { id: 'sad-sad-downcast', label: '풀이 죽어', hint: '풀이 죽어 서기', artwork: require('../../assets/expression-guides/sad-sad-downcast.png'), display: require('../../assets/expression-guides/display/sad-sad-downcast.png') },
        { id: 'sad-sad-gesture', label: '손짓하며', hint: '슬픈 표정으로 손짓', artwork: require('../../assets/expression-guides/sad-sad-gesture.png'), display: require('../../assets/expression-guides/display/sad-sad-gesture.png') },
        { id: 'sad-sad-crouch', label: '웅크려 앉아', hint: '웅크리고 앉기', artwork: require('../../assets/expression-guides/sad-sad-crouch.png'), display: require('../../assets/expression-guides/display/sad-sad-crouch.png') },
        { id: 'sad-sad-sit-back', label: '등 돌리고', hint: '등 돌리고 앉기', artwork: require('../../assets/expression-guides/sad-sad-sit-back.png'), display: require('../../assets/expression-guides/display/sad-sad-sit-back.png') },
        { id: 'sad-sad-slump', label: '고개 숙여', hint: '고개 숙여 낙담', artwork: require('../../assets/expression-guides/sad-sad-slump.png'), display: require('../../assets/expression-guides/display/sad-sad-slump.png') },
        { id: 'sad-sad-hug-knees', label: '무릎 안고', hint: '무릎 안고 웅크리기', artwork: require('../../assets/expression-guides/sad-sad-hug-knees.png'), display: require('../../assets/expression-guides/display/sad-sad-hug-knees.png') },
        { id: 'sad-sad-teary', label: '눈물 맺혀', hint: '눈물 맺힌 슬픔', artwork: require('../../assets/expression-guides/sad-sad-teary.png'), display: require('../../assets/expression-guides/display/sad-sad-teary.png') },
      ],
    },
    {
      id: 'sad-crying', category: '슬픔·미안', name: '흑흑', hint: '눈물 훔치기', cover: 'sad-crying-wipe',
      examples: [
        { id: 'sad-crying-wipe', label: '눈물 닦으며', hint: '눈물 닦기', artwork: require('../../assets/expression-guides/sad-crying-wipe.png'), display: require('../../assets/expression-guides/display/sad-crying-wipe.png') },
        { id: 'sad-crying-cover-face', label: '얼굴 가리고', hint: '얼굴 가리고 울기', artwork: require('../../assets/expression-guides/sad-crying-cover-face.png'), display: require('../../assets/expression-guides/display/sad-crying-cover-face.png') },
        { id: 'sad-crying-loud', label: '서서 크게', hint: '서서 크게 울기', artwork: require('../../assets/expression-guides/sad-crying-loud.png'), display: require('../../assets/expression-guides/display/sad-crying-loud.png') },
        { id: 'sad-crying-sob', label: '펑펑', hint: '펑펑 울기', artwork: require('../../assets/expression-guides/sad-crying-sob.png'), display: require('../../assets/expression-guides/display/sad-crying-sob.png') },
        { id: 'sad-crying-crouch', label: '웅크려', hint: '몸을 웅크리고 두 손 모으기', artwork: require('../../assets/expression-guides/sad-crying-crouch.png'), display: require('../../assets/expression-guides/display/sad-crying-crouch.png') },
      ],
    }, {
      id: 'sad-are-you-okay', category: '슬픔·미안', name: '괜찮아?', hint: '살짝 다가가기', cover: 'sad-are-you-okay-lean',
      examples: [
        { id: 'sad-are-you-okay-face', label: '걱정스러운 얼굴', hint: '걱정스러운 얼굴', artwork: require('../../assets/expression-guides/sad-are-you-okay-face.png') },
        { id: 'sad-are-you-okay-arms-crossed', label: '팔짱 끼고', hint: '팔짱 끼고 걱정', artwork: require('../../assets/expression-guides/sad-are-you-okay-arms-crossed.png'), display: require('../../assets/expression-guides/display/sad-are-you-okay-arms-crossed.png') },
        { id: 'sad-are-you-okay-chest', label: '손끝으로 가리키며', hint: '한 손을 내려 손끝으로 가리키기', artwork: require('../../assets/expression-guides/sad-are-you-okay-chest.png') },
        { id: 'sad-are-you-okay-mouth', label: '입 가리고', hint: '입 가리고 걱정', artwork: require('../../assets/expression-guides/sad-are-you-okay-mouth.png') },
        { id: 'sad-are-you-okay-lean', label: '몸 숙여', hint: '몸 숙여 살피기', artwork: require('../../assets/expression-guides/sad-are-you-okay-lean.png') },
      ],
    },
    {
      id: 'angry-unfair', category: '화남·억울', name: '억울해', hint: '팔짱 + 몸 돌리기', cover: 'angry-unfair-stomp',
      examples: [
        { id: 'angry-unfair-stomp', label: '속상해서', hint: '속상해서 발 구르기', artwork: require('../../assets/expression-guides/angry-unfair-stomp.png'), display: require('../../assets/expression-guides/display/angry-unfair-stomp.png') },
      ],
    }, {
      id: 'angry-angry', category: '화남·억울', name: '화났어', hint: '주먹 불끈', cover: 'angry-angry-stand',
      examples: [
        { id: 'angry-angry-stand', label: '버티고 서서', hint: '화난 자세', artwork: require('../../assets/expression-guides/angry-angry-stand.png'), display: require('../../assets/expression-guides/display/angry-angry-stand.png') },
        { id: 'angry-angry-hips', label: '허리에 손 얹고', hint: '허리에 손 얹고 화남', artwork: require('../../assets/expression-guides/angry-angry-hips.png'), display: require('../../assets/expression-guides/display/angry-angry-hips.png') },
        { id: 'angry-angry-stomp', label: '발 구르며', hint: '화나서 발 구르기', artwork: require('../../assets/expression-guides/angry-angry-stomp.png'), display: require('../../assets/expression-guides/display/angry-angry-stomp.png') },
        { id: 'angry-angry-face', label: '얼굴 가득', hint: '화난 얼굴 클로즈업', artwork: require('../../assets/expression-guides/angry-angry-face.png') },
      ],
    },
    {
      id: 'angry-hmph', category: '화남·억울', name: '흥', hint: '고개 홱 돌리기', cover: 'angry-hmph-turn',
      examples: [
        { id: 'angry-hmph-turn', label: '고개 돌리고', hint: '고개 돌리고 콧김', artwork: require('../../assets/expression-guides/angry-hmph-turn.png') },
        { id: 'angry-hmph-back', label: '등 돌리고', hint: '등 돌리고 콧김', artwork: require('../../assets/expression-guides/angry-hmph-back.png'), display: require('../../assets/expression-guides/display/angry-hmph-back.png') },
        { id: 'angry-hmph-arms-crossed', label: '팔짱 끼고', hint: '팔짱 끼고 삐짐', artwork: require('../../assets/expression-guides/angry-hmph-arms-crossed.png'), display: require('../../assets/expression-guides/display/angry-hmph-arms-crossed.png') },
        { id: 'angry-hmph-pout', label: '볼 부풀리고', hint: '볼 부풀리고 삐짐', artwork: require('../../assets/expression-guides/angry-hmph-pout.png') },
      ],
    }, {
      id: 'angry-annoyed', category: '화남·억울', name: '짜증나', hint: '머리 감싸기', cover: 'angry-annoyed-head',
      examples: [
        { id: 'angry-annoyed-head', label: '머리 감싸고', hint: '머리 감싸고 화남', artwork: require('../../assets/expression-guides/angry-annoyed-head.png') },
        { id: 'angry-annoyed-facepalm', label: '이마 짚고', hint: '이마 짚기', artwork: require('../../assets/expression-guides/angry-annoyed-facepalm.png') },
        { id: 'angry-annoyed-sigh', label: '한숨 쉬며', hint: '한숨 쉬며 축 처짐', artwork: require('../../assets/expression-guides/angry-annoyed-sigh.png') },
        { id: 'angry-annoyed-ears', label: '귀 막고', hint: '귀 막고 괴로워하기', artwork: require('../../assets/expression-guides/angry-annoyed-ears.png') },
      ],
    },
    {
      id: 'surprise-gasp', category: '놀람·당황', name: '헉', hint: '두 손으로 입 가리기', cover: 'surprise-gasp-mouth',
      examples: [
        { id: 'surprise-gasp-mouth', label: '입 가리고', hint: '입 가리고 놀라기', artwork: require('../../assets/expression-guides/surprise-gasp-mouth.png'), display: require('../../assets/expression-guides/display/surprise-gasp-mouth.png') },
        { id: 'surprise-gasp-point', label: '가리키며', hint: '깜짝 놀라 가리키기', artwork: require('../../assets/expression-guides/surprise-gasp-point.png'), display: require('../../assets/expression-guides/display/surprise-gasp-point.png') },
        { id: 'surprise-gasp-face', label: '얼굴 가득', hint: '놀란 얼굴 클로즈업', artwork: require('../../assets/expression-guides/surprise-gasp-face.png') },
        { id: 'surprise-gasp-drop', label: '물건 떨어뜨리며', hint: '물건 떨어뜨려 놀람', artwork: require('../../assets/expression-guides/surprise-gasp-drop.png'), display: require('../../assets/expression-guides/display/surprise-gasp-drop.png') },
      ],
    }, {
      id: 'surprise-what', category: '놀람·당황', name: '뭐?', hint: '몸 뒤로 젖히기', cover: 'surprise-what-tilt',
      examples: [
        { id: 'surprise-what-tilt', label: '고개 갸웃', hint: '고개 갸웃하며 의문', artwork: require('../../assets/expression-guides/surprise-what-tilt.png'), display: require('../../assets/expression-guides/display/surprise-what-tilt.png') },
        { id: 'surprise-what-scratch', label: '머리 긁적이며', hint: '머리 긁적이며 의문', artwork: require('../../assets/expression-guides/surprise-what-scratch.png'), display: require('../../assets/expression-guides/display/surprise-what-scratch.png') },
        { id: 'surprise-what-question', label: '물음표', hint: '물음표 의문', artwork: require('../../assets/expression-guides/surprise-what-question.png') },
        { id: 'surprise-what-side-eye', label: '의심스럽게', hint: '의심스러운 눈초리', artwork: require('../../assets/expression-guides/surprise-what-side-eye.png') },
      ],
    },
    {
      id: 'surprise-flustered', category: '놀람·당황', name: '당황', hint: '땀 한 방울', cover: 'surprise-flustered-sweat',
      examples: [
        { id: 'surprise-flustered-shrug', label: '어쩔 줄 몰라', hint: '어쩔 줄 몰라 양손 들기', artwork: require('../../assets/expression-guides/surprise-flustered-shrug.png'), display: require('../../assets/expression-guides/display/surprise-flustered-shrug.png') },
        { id: 'surprise-flustered-sweat', label: '식은땀', hint: '식은땀 긴장', artwork: require('../../assets/expression-guides/surprise-flustered-sweat.png') },
        { id: 'surprise-flustered-shy', label: '조심스럽게', hint: '두 손 모아 조심스러움', artwork: require('../../assets/expression-guides/surprise-flustered-shy.png'), display: require('../../assets/expression-guides/display/surprise-flustered-shy.png') },
        { id: 'surprise-flustered-tremble', label: '몸 떨며', hint: '몸 떨며 긴장', artwork: require('../../assets/expression-guides/surprise-flustered-tremble.png'), display: require('../../assets/expression-guides/display/surprise-flustered-tremble.png') },
        { id: 'surprise-flustered-glance', label: '옆눈질', hint: '옆눈질하기', artwork: require('../../assets/expression-guides/surprise-flustered-glance.png') },
      ],
    }, {
      id: 'surprise-no-way', category: '놀람·당황', name: '설마', hint: '눈 동그랗게', cover: 'surprise-no-way-face',
      examples: [
        { id: 'surprise-no-way-face', label: '놀란 얼굴', hint: '깜짝 놀란 얼굴', artwork: require('../../assets/expression-guides/surprise-no-way-face.png') },
        { id: 'surprise-no-way-refuse', label: '손 내저으며', hint: '두 손 내저으며 거절', artwork: require('../../assets/expression-guides/surprise-no-way-refuse.png'), display: require('../../assets/expression-guides/display/surprise-no-way-refuse.png') },
      ],
    },
    {
      id: 'daily-good-night', category: '일상', name: '잘 자', hint: '이불 덮고 눕기', cover: 'daily-good-night-blanket',
      examples: [
        { id: 'daily-good-night-blanket', label: '이불 덮고', hint: '이불 덮고 잠자기', artwork: require('../../assets/expression-guides/daily-good-night-blanket.png'), display: require('../../assets/expression-guides/display/daily-good-night-blanket.png') },
        { id: 'daily-good-night-curl', label: '웅크려', hint: '웅크려 잠자기', artwork: require('../../assets/expression-guides/daily-good-night-curl.png'), display: require('../../assets/expression-guides/display/daily-good-night-curl.png') },
        { id: 'daily-good-night-hug', label: '안고', hint: '무언가 안고 잠자기', artwork: require('../../assets/expression-guides/daily-good-night-hug.png'), display: require('../../assets/expression-guides/display/daily-good-night-hug.png') },
        { id: 'daily-good-night-drowsy', label: '눈 비비며', hint: '졸려 눈 비비기', artwork: require('../../assets/expression-guides/daily-good-night-drowsy.png') },
        { id: 'daily-good-night-lie-down', label: '누워 지쳐', hint: '누워 지치기', artwork: require('../../assets/expression-guides/daily-good-night-lie-down.png'), display: require('../../assets/expression-guides/display/daily-good-night-lie-down.png') },
        { id: 'daily-good-night-table', label: '책상에 엎드려', hint: '책상에 엎드리기', artwork: require('../../assets/expression-guides/daily-good-night-table.png'), display: require('../../assets/expression-guides/display/daily-good-night-table.png') },
      ],
    }, {
      id: 'daily-hungry', category: '일상', name: '배고파', hint: '배 잡고 쓰러지기', cover: 'daily-hungry-ache',
      examples: [
        { id: 'daily-hungry-bowl', label: '그릇 들고', hint: '그릇 들고 난감', artwork: require('../../assets/expression-guides/daily-hungry-bowl.png'), display: require('../../assets/expression-guides/display/daily-hungry-bowl.png') },
        { id: 'daily-hungry-ache', label: '배 잡고', hint: '배를 잡고 아파하기', artwork: require('../../assets/expression-guides/daily-hungry-ache.png'), display: require('../../assets/expression-guides/display/daily-hungry-ache.png') },
      ],
    },
    {
      id: 'daily-depart', category: '일상', name: '출발', hint: '가방 메고 뛰기', cover: 'daily-depart-run',
      examples: [
        { id: 'daily-depart-run', label: '달리며', hint: '달리기', artwork: require('../../assets/expression-guides/daily-depart-run.png'), display: require('../../assets/expression-guides/display/daily-depart-run.png') },
        { id: 'daily-depart-run-point', label: '앞을 가리키며', hint: '달리며 앞을 가리키기', artwork: require('../../assets/expression-guides/daily-depart-run-point.png'), display: require('../../assets/expression-guides/display/daily-depart-run-point.png') },
        { id: 'daily-depart-walk', label: '걸으며', hint: '걷기', artwork: require('../../assets/expression-guides/daily-depart-walk.png'), display: require('../../assets/expression-guides/display/daily-depart-walk.png') },
        { id: 'daily-depart-wave-back', label: '뒤돌아 손 흔들며', hint: '뒤돌아 손 흔들기', artwork: require('../../assets/expression-guides/daily-depart-wave-back.png'), display: require('../../assets/expression-guides/display/daily-depart-wave-back.png') },
        { id: 'daily-depart-point-side', label: '손바닥을 펴고', hint: '한 팔을 옆으로 뻗어 손바닥 펴기', artwork: require('../../assets/expression-guides/daily-depart-point-side.png'), display: require('../../assets/expression-guides/display/daily-depart-point-side.png') },
      ],
    }, {
      id: 'daily-wait', category: '일상', name: '기다려', hint: '손바닥 내밀기', cover: 'daily-wait-palm',
      examples: [
        { id: 'daily-wait-palm', label: '손바닥 내밀어', hint: '손바닥 내밀어 멈춤', artwork: require('../../assets/expression-guides/daily-wait-palm.png'), display: require('../../assets/expression-guides/display/daily-wait-palm.png') },
        { id: 'daily-wait-reach', label: '손 뻗어', hint: '앞으로 손 뻗기', artwork: require('../../assets/expression-guides/daily-wait-reach.png'), display: require('../../assets/expression-guides/display/daily-wait-reach.png') },
        { id: 'daily-wait-hands', label: '두 손 모아', hint: '두 손 모아 잡기', artwork: require('../../assets/expression-guides/daily-wait-hands.png'), display: require('../../assets/expression-guides/display/daily-wait-hands.png') },
        { id: 'daily-wait-startled', label: '놀라며 손 뻗어', hint: '놀라며 손 뻗기', artwork: require('../../assets/expression-guides/daily-wait-startled.png'), display: require('../../assets/expression-guides/display/daily-wait-startled.png') },
        { id: 'daily-wait-call', label: '외치며 손 뻗어', hint: '외치며 손 뻗기', artwork: require('../../assets/expression-guides/daily-wait-call.png'), display: require('../../assets/expression-guides/display/daily-wait-call.png') },
      ],
    },
  ] as ExpressionGuideCard[],
};
// 기본 레퍼런스(44차 LOCK). 역할: "어떻게 그릴까?" — 그리기 화면 › 참고 › 기본 레퍼런스. 분류 칩 한 줄 + 3:4 썸네일 4열 격자.
// V1 분류는 넷: 포즈 · 표정 · 손동작 · 소품·효과(소품과 효과는 합친다. '일상'은 포즈와 겹쳐 두지 않는다).
// ready=false 동안 칸은 누를 수 없는 자리표시. ready=true 가 되면 칸을 누르면 기존 참고 사진과 같은 흐름(옮기기·크기·진하기)으로 캔버스 참고 레이어에 들어간다.
export const BUILTIN_REFERENCES = { enabled: true, ready: false, categories: ['포즈', '표정', '손동작', '소품·효과'] as const, placeholderCount: 8, columns: 4 };
// 홈 공식 알림. 공모전·챌린지·사례 모집에 쓴다. enabled=false 면 자리도 간격도 없다.
// 운영은 이 상수 한 곳에서 한다(서버·CMS 없음): enabled 로 켜고 끄고, title·body 를 바꾸고,
// 넘어갈 곳이 있으면 link 를 넣는다. link 가 없으면 넘어가기 표시(>)도 그리지 않는다 — 누를 수 없는 화살표를 두지 않는다.
export const HOME_NOTICE: { enabled: boolean; title: string; body: string; link?: string } = {
  enabled: false,
  title: '이모티콘 공모전 소식',
  body: '공모전·이벤트가 열리면 여기에서 알려드려요',
  link: undefined,
};
