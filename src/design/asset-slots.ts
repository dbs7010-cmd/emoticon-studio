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
};

// 표현 가이드는 창작자의 내비게이션이다: 한 감정에서 여러 표현을 보고 골라 자기 캐릭터로 응용한다.
// 흐름은 감정 선택 → 표현 보기 → 예시 선택 → (참고하며 그리기 | 밑그림으로 넣기).
// 파일 이름 규칙: assets/expression-guides/<예시 id>.png — 카드 그림(45.16차)과 같은 자리를 쓴다.
// 예시 id 는 '<카드 id>-<표현 갈래>' 라서 카드 파일 이름과 겹치지 않는다(greeting-thanks.png vs greeting-thanks-polite.png).
// 파일이 실제로 들어오기 전에는 artwork 를 두지 않는다(없는 파일을 require 하지 않는다).
// artwork 가 없으면 화면은 '준비 중'으로 두고 두 버튼(참고·밑그림)을 누를 수 없게 한다.
export type ExpressionExample = {
  id: string;
  label: string;   // 표현 갈래 이름 — 감정 이름과 함께 읽힌다('고마워 · 정중하게')
  hint: string;    // 무엇을 그리는지 한 줄
  artwork?: ImageSourcePropType;
};

export const ASSET_SLOTS = {
  // 홈 첫 화면 오른쪽. 창작 표면 위에 겹쳐 앉는 캐릭터. 표면 바탕이 비치도록 투명 PNG.
  // 40차 최종 배치(App.tsx): 창작 표면 오른쪽 위 right 14 · top 16, 화면폭 < 380dp 이면 96, 아니면 112. 아래 12% 는 행동 줄과 겹칠 수 있어 비운다.
  homeHeroArtwork: { aspectRatio: 1, display: '96×96 (폭 < 380dp) / 112×112 (그 외) — 표면 오른쪽 위', sourceSize: '336(@3x) · 224 · 112 / 마스터 1024', safeArea: '주 피사체는 칸의 오른쪽 79% × 위쪽 89% 안(왼쪽 21%·아래 11% 비움 — 제목·행동 줄 침범 방지)', background: 'transparent', source: null },
  // 세트가 하나도 없을 때 최근 작업 자리. AssetSlot size 120 → 120×90.
  homeEmptyArtwork: { aspectRatio: 4 / 3, display: '120×90 (점선 상자 안 가운데, 아래에 문구 두 줄)', sourceSize: '360×270(@3x) · 240×180 · 120×90 / 마스터 1280×960', safeArea: '가운데 80%', background: 'transparent', source: null },
  // 공식 알림 카드 왼쪽 작은 그림.
  noticeArtwork: { aspectRatio: 1, display: '44×44', sourceSize: '132(@3x) · 88 · 44 / 마스터 512', safeArea: '가운데 76%', background: 'transparent', source: null },
  // 기본 레퍼런스 한 칸. 2~2.5등신 관절 인형 전신이 들어가므로 세로형. 44차 LOCK: 참고 패널의 4열 격자(좌우 여백 12, 간격 8).
  // source 가 없으면 BuiltinReferences 가 회색 관절 인형 자리표시를 그린다. source 를 넣으면 같은 칸에 그 그림이 들어간다(분류별 목록은 에셋 라운드).
  referencePoseThumbnail: { aspectRatio: 3 / 4, display: '4열 격자 한 칸: 폭 floor((화면폭 − 24 − 8×3) / 4), 높이 = 폭 × 4/3 → 360dp 78×104 · 384dp 84×112 · 412dp 91×121', sourceSize: '썸네일 192×255 + 캔버스용 투명 원본 1080×1440', safeArea: '위아래 6%, 좌우 10% 여백 — 전신이 칸 안, 발끝 바닥선 94%', background: 'opaque', source: null },
  // 표현 가이드 카드 윗부분 그림(44차 LOCK). 2열 카드(간격 12) 안 정사각 틀(모서리 14, #F3F1EC) 가운데에 틀의 80% 크기로 앉는다.
  expressionGuideArtwork: { aspectRatio: 1, display: '틀 = floor((화면폭 − 32 − 12) / 2) − 20 → 360dp 138 · 384dp 150 · 412dp 164, 그림 = 틀 × 0.8 → 110 · 120 · 131', sourceSize: '360(@3x) · 240 · 120 / 마스터 1024 × 카드 수', safeArea: '가운데 84% — 몸짓 전체가 칸 안, 바닥선 90%. 표정·몸짓만으로 뜻이 읽혀야 한다(글자 없음)', background: 'transparent', source: null },
  // 움직이기 효과 견본에 그림이 없을 때(빈 칸) 쓰는 기본 캐릭터.
  motionExampleArtwork: { aspectRatio: 1, display: '48×48 견본 칸 안 41×41 그림(86%)', sourceSize: '123(@3x) · 82 · 41 / 마스터 512', safeArea: '가운데 86% — 통통 위로 16%, 흔들기 ±9° 회전, 두근거리기 1.14배에서도 칸 안', background: 'transparent',
    // 최종 그림이 올 때까지 앱 기본 캐릭터. 그림이 있는 칸에서는 언제나 사용자의 그림이 먼저다(44.2차 규칙 그대로).
    source: require('../../assets/art/mascot-paper.png') },
  // 내보내기에서 모든 칸이 완성됐을 때 요약 표면 오른쪽.
  exportSuccessArtwork: { aspectRatio: 1, display: '84×84', sourceSize: '252(@3x) · 168 · 84 / 마스터 1024', safeArea: '가운데 84%', background: 'transparent', source: null },
  // PRO 화면 위쪽 비교(App.tsx proSheet). 16:9 따뜻한 표면(폭 화면-32, 최대 높이 214, 안쪽 여백 14)은 앱이 그리고,
  // 그 안에 1:1 그림 두 장(86×86, 왼쪽 '전체 움직임' · 오른쪽 '눈·팔·몸만')과 화살표·라벨이 들어간다. 지금은 mascot-paper / mascot-ink.
  proFeatureArtwork: { aspectRatio: 1, display: '86×86 두 장(전·후) — 16:9 표면 안, 가운데 화살표·아래 라벨은 앱이 그림', sourceSize: '258(@3x) · 172 · 86 × 2 / 마스터 1024 × 2', safeArea: '가운데 84%, 두 장이 같은 캐릭터·같은 크기·같은 바닥선', background: 'transparent',
    // 최종 그림이 올 때까지 앱 기본 캐릭터 두 장을 쓴다. 화면은 이 두 줄만 보므로 파일만 바꾸면 PRO 화면이 바뀐다.
    source: require('../../assets/art/mascot-paper.png'), sourceAfter: require('../../assets/art/mascot-ink.png') },
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
    { id: 'greeting-hello', category: '기쁨·인사', name: '안녕', hint: '손 크게 흔들기' }, {
      id: 'greeting-thanks', category: '기쁨·인사', name: '고마워', hint: '두 손 모아 꾸벅',
      // 45.17차 첫 흐름. 카드의 이름·힌트·차례는 그대로 두고 표현 다섯 갈래만 아래에 달았다.
      examples: [
        { id: 'greeting-thanks-polite', label: '정중하게', hint: '두 손 모으고 깊게 꾸벅' },
        { id: 'greeting-thanks-moved', label: '감격해서', hint: '눈물 맺힌 눈으로 선물 꼭 안기' },
        { id: 'greeting-thanks-friendly', label: '친근하게', hint: '엄지 척하며 씩 웃기' },
        { id: 'greeting-thanks-grand', label: '과장해서', hint: '바닥까지 큰절하기' },
        { id: 'greeting-thanks-shy', label: '수줍게', hint: '시선 피하며 작은 하트 내밀기' },
      ],
    },
    { id: 'greeting-like', category: '기쁨·인사', name: '좋아', hint: '엄지 척' }, { id: 'greeting-excited', category: '기쁨·인사', name: '신나', hint: '두 팔 번쩍' },
    { id: 'sad-sorry', category: '슬픔·미안', name: '미안해', hint: '고개 푹 숙이기' }, { id: 'sad-sad', category: '슬픔·미안', name: '슬퍼', hint: '무릎 안고 앉기' },
    { id: 'sad-crying', category: '슬픔·미안', name: '흑흑', hint: '눈물 훔치기' }, { id: 'sad-are-you-okay', category: '슬픔·미안', name: '괜찮아?', hint: '살짝 다가가기' },
    { id: 'angry-unfair', category: '화남·억울', name: '억울해', hint: '팔짱 + 몸 돌리기' }, { id: 'angry-angry', category: '화남·억울', name: '화났어', hint: '주먹 불끈' },
    { id: 'angry-hmph', category: '화남·억울', name: '흥', hint: '고개 홱 돌리기' }, { id: 'angry-annoyed', category: '화남·억울', name: '짜증나', hint: '머리 감싸기' },
    { id: 'surprise-gasp', category: '놀람·당황', name: '헉', hint: '두 손으로 입 가리기' }, { id: 'surprise-what', category: '놀람·당황', name: '뭐?', hint: '몸 뒤로 젖히기' },
    { id: 'surprise-flustered', category: '놀람·당황', name: '당황', hint: '땀 한 방울' }, { id: 'surprise-no-way', category: '놀람·당황', name: '설마', hint: '눈 동그랗게' },
    { id: 'daily-good-night', category: '일상', name: '잘 자', hint: '이불 덮고 눕기' }, { id: 'daily-hungry', category: '일상', name: '배고파', hint: '배 잡고 쓰러지기' },
    { id: 'daily-depart', category: '일상', name: '출발', hint: '가방 메고 뛰기' }, { id: 'daily-wait', category: '일상', name: '기다려', hint: '손바닥 내밀기' },
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
