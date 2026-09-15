// 최종 일러스트가 들어갈 자리. 에셋이 들어와도 레이아웃을 다시 짜지 않도록 비율·표시 크기·안전 영역을 여기서 못 박는다.
// source 가 null 이면 AssetSlot 이 따뜻한 도형 자리표시를 그린다(에셋 없이도 구성이 완성돼 보여야 한다).
// 에셋을 넣을 때는 source 만 require(...) 로 바꾼다. 비율이 다른 그림을 넣지 않는다.
import type { ImageSourcePropType } from 'react-native';

export type AssetSlotSpec = {
  aspectRatio: number;          // width / height
  display: string;              // 화면에서 차지하는 크기(dp)
  safeArea: string;             // 그림의 중요한 부분이 들어가야 하는 안쪽 영역
  background: 'transparent' | 'opaque';
  source: ImageSourcePropType | null;
};

export const ASSET_SLOTS = {
  // 홈 첫 화면 오른쪽. 창작 표면 위에 겹쳐 앉는 캐릭터. 표면 바탕이 비치도록 투명 PNG.
  // 40차 최종 배치(App.tsx): 창작 표면 오른쪽 위 right 14 · top 16, 화면폭 < 380dp 이면 96, 아니면 112. 아래 12% 는 행동 줄과 겹칠 수 있어 비운다.
  homeHeroArtwork: { aspectRatio: 1, display: '96×96 (폭 < 380dp) / 112×112 (그 외) — 표면 오른쪽 위', safeArea: '주 피사체는 칸의 오른쪽 79% × 위쪽 89% 안(왼쪽 21%·아래 11% 비움 — 제목·행동 줄 침범 방지)', background: 'transparent', source: null },
  // 세트가 하나도 없을 때 최근 작업 자리. AssetSlot size 120 → 120×90.
  homeEmptyArtwork: { aspectRatio: 4 / 3, display: '120×90 (점선 상자 안 가운데, 아래에 문구 두 줄)', safeArea: '가운데 80%', background: 'transparent', source: null },
  // 공식 알림 카드 왼쪽 작은 그림.
  noticeArtwork: { aspectRatio: 1, display: '44×44', safeArea: '가운데 76%', background: 'transparent', source: null },
  // 기본 레퍼런스 한 칸. 2~2.5등신 관절 인형 전신이 들어가므로 세로형.
  referencePoseThumbnail: { aspectRatio: 3 / 4, display: '폭 (화면폭-16-8×3)/4 · 360dp 기준 약 78×104', safeArea: '위아래 6%, 좌우 10% 여백', background: 'opaque', source: null },
  // 움직이기 효과 견본에 그림이 없을 때(빈 칸) 쓰는 기본 캐릭터.
  motionExampleArtwork: { aspectRatio: 1, display: '48×48 견본 칸 안 41×41 그림(86%)', safeArea: '가운데 86% — 통통 위로 16%, 흔들기 ±9° 회전, 두근거리기 1.14배에서도 칸 안', background: 'transparent', source: null },
  // 내보내기에서 모든 칸이 완성됐을 때 요약 표면 오른쪽.
  exportSuccessArtwork: { aspectRatio: 1, display: '96×96', safeArea: '가운데 84%', background: 'transparent', source: null },
  // PRO 화면 위쪽 비교(App.tsx proSheet). 16:9 따뜻한 표면(폭 화면-32, 최대 높이 214, 안쪽 여백 14)은 앱이 그리고,
  // 그 안에 1:1 그림 두 장(86×86, 왼쪽 '전체 움직임' · 오른쪽 '눈·팔·몸만')과 화살표·라벨이 들어간다. 지금은 mascot-paper / mascot-ink.
  proFeatureArtwork: { aspectRatio: 1, display: '86×86 두 장(전·후) — 16:9 표면 안, 가운데 화살표·아래 라벨은 앱이 그림', safeArea: '가운데 84%, 두 장이 같은 캐릭터·같은 크기·같은 바닥선', background: 'transparent', source: null },
} satisfies Record<string, AssetSlotSpec>;

export type AssetSlotName = keyof typeof ASSET_SLOTS;

// 표현 가이드(억울해 → 팔짱 + 몸 돌리기) 자리. 켜면 Painter 캔버스 위에 한 줄 힌트로만 뜬다. 꺼져 있으면 아무것도 그리지 않는다.
export const EXPRESSION_GUIDE = { enabled: false } as const;
// 기본 레퍼런스(관절 인형 포즈·표정·손동작·효과). 에셋이 들어오기 전에는 '준비 중' 자리표시만 보인다.
export const BUILTIN_REFERENCES = { enabled: true, ready: false, categories: ['포즈', '표정', '손동작', '효과'] as const, placeholderCount: 8 };
// 홈 공식 알림. 공모전·챌린지·사례 모집에 쓴다. enabled=false 면 자리도 간격도 없다.
export const HOME_NOTICE: { enabled: boolean; title: string; body: string } = { enabled: false, title: '', body: '' };
