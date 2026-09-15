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
  homeHeroArtwork: { aspectRatio: 1, display: '112×112 (360dp 폭) ~ 132×132 (412dp 폭)', safeArea: '가운데 84% — 표면 오른쪽 아래 모서리에 12dp 걸쳐도 잘리지 않게', background: 'transparent', source: null },
  // 세트가 하나도 없을 때 최근 작업 자리.
  homeEmptyArtwork: { aspectRatio: 4 / 3, display: '160×120', safeArea: '가운데 80%', background: 'transparent', source: null },
  // 공식 알림 카드 왼쪽 작은 그림.
  noticeArtwork: { aspectRatio: 1, display: '44×44', safeArea: '가운데 76%', background: 'transparent', source: null },
  // 기본 레퍼런스 한 칸. 2~2.5등신 관절 인형 전신이 들어가므로 세로형.
  referencePoseThumbnail: { aspectRatio: 3 / 4, display: '폭 (화면폭-16-8×3)/4 · 360dp 기준 약 78×104', safeArea: '위아래 6%, 좌우 10% 여백', background: 'opaque', source: null },
  // 움직이기 효과 견본에 그림이 없을 때(빈 칸) 쓰는 기본 캐릭터.
  motionExampleArtwork: { aspectRatio: 1, display: '40×40', safeArea: '가운데 86% — 흔들기 9° 회전·두근거리기 1.14배에서도 칸 안', background: 'transparent', source: null },
  // 내보내기에서 모든 칸이 완성됐을 때 요약 표면 오른쪽.
  exportSuccessArtwork: { aspectRatio: 1, display: '96×96', safeArea: '가운데 84%', background: 'transparent', source: null },
  // PRO 화면 위쪽 비교 그림(전체 움직임 → 부분 움직임).
  proFeatureArtwork: { aspectRatio: 16 / 9, display: '화면폭-32 × 9/16 · 최대 380×214', safeArea: '가운데 90%', background: 'transparent', source: null },
} satisfies Record<string, AssetSlotSpec>;

export type AssetSlotName = keyof typeof ASSET_SLOTS;

// 표현 가이드(억울해 → 팔짱 + 몸 돌리기) 자리. 켜면 Painter 캔버스 위에 한 줄 힌트로만 뜬다. 꺼져 있으면 아무것도 그리지 않는다.
export const EXPRESSION_GUIDE = { enabled: false } as const;
// 기본 레퍼런스(관절 인형 포즈·표정·손동작·효과). 에셋이 들어오기 전에는 '준비 중' 자리표시만 보인다.
export const BUILTIN_REFERENCES = { enabled: true, ready: false, categories: ['포즈', '표정', '손동작', '효과'] as const, placeholderCount: 8 };
// 홈 공식 알림. 공모전·챌린지·사례 모집에 쓴다. enabled=false 면 자리도 간격도 없다.
export const HOME_NOTICE: { enabled: boolean; title: string; body: string } = { enabled: false, title: '', body: '' };
