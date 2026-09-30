// 「임티 라인」 아이콘(45.42 S1 · 45.41 확정 시안 WB2-Icons 와 같은 경로).
//
// 규칙:
// · 24 격자, 선 1.8, 둥근 끝·둥근 이음, 채움 없음. 모든 아이콘이 선 아이콘이다(채움·글자 아이콘을 섞지 않는다).
// · 크기는 세 가지뿐: 도구·탭 22 · 목록·버튼 18 · 보조 14. 누르는 자리(48dp)는 아이콘 크기와 따로 둔다.
// · 선택은 아이콘이 아니라 **담는 면**이 말한다(노란 면 + 잉크 아이콘). 그래서 이 부품에는 선택 상태가 없다.
// · 비활성은 선 색만 옅게(투명도로 흐리지 않는다). 실제 비활성 동작·접근성 상태는 부르는 쪽 버튼이 갖는다.
// · '손그림 한 획'(브랜드 디테일)은 brush · caption · motion 세 개에만 있다.
// · 시스템 아이콘(back·close·delete·eye…)은 새 모양을 만들지 않고 보편 모양을 같은 선으로만 맞춘다.
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// 색 기본값은 공통 토큰(ui.tsx T.ink · T.faint)과 같은 값이다. ui.tsx 가 이 파일을 쓰므로 여기서 ui.tsx 를 부르지 않는다
// (순환 참조). 두 값이 어긋나지 않는지는 icon-test 가 확인한다.
export const ICON_INK = '#1F1D1A';
export const ICON_FAINT = '#B3ADA4';
export const IconSize = { tool: 22, row: 18, meta: 14 } as const;
export type IconSizeValue = typeof IconSize[keyof typeof IconSize];
export const ICON_STROKE = 1.8;

type El = ['p', string] | ['c', number, number, number] | ['r', number, number, number, number, number];
export const ICON_PATHS = {
  // ── 핵심 기능(직접 그림) ──
  brush: [['p', 'M4.2 17.8l3.4-1 9.2-9.2a2 2 0 0 0-2.8-2.8L4.8 14z'], ['p', 'M13 5.8l2.8 2.8'], ['p', 'M12.6 20c1.4-1.2 2.6 1 4 0s2.4-1 3.4-.3']],
  eraser: [['p', 'M8 19.5h11'], ['p', 'M4.9 14.3l8.4-8.4a2 2 0 0 1 2.8 0l2.3 2.3a2 2 0 0 1 0 2.8l-8.3 8.3H8.2z'], ['p', 'M9.3 9.9l4.9 4.9']],
  fill: [['p', 'M5.2 11.2l6-6 7.1 7.1-6 6a1.5 1.5 0 0 1-2.1 0l-5-5a1.5 1.5 0 0 1 0-2.1z'], ['p', 'M4.8 12.6h13.4'], ['p', 'M20.3 16.4c0 1.1-.7 1.9-1.6 1.9s-1.6-.8-1.6-1.9c0-1 1.6-3 1.6-3s1.6 2 1.6 3z']],
  color: [['p', 'M12 3.6a8.4 8.4 0 1 0 0 16.8c1.1 0 1.7-.7 1.7-1.6 0-1.1-1-1.5-1-2.5 0-1 .8-1.7 1.8-1.7h2.1a3.6 3.6 0 0 0 3.6-3.6C20.2 6.7 16.6 3.6 12 3.6z'], ['c', 8, 10.3, 1.1], ['c', 12, 7.6, 1.1], ['c', 15.9, 10.3, 1.1]],
  reference: [['r', 4, 4.5, 16, 15, 2.6], ['p', 'M4.6 16.2l4.3-4.3 3.4 3.4 2.4-2.4 4.7 4.7'], ['c', 15.4, 8.9, 1.3]],
  layer: [['p', 'M12 4.2l8 4-8 4-8-4z'], ['p', 'M4 12.2l8 4 8-4'], ['p', 'M4 16.2l8 4 8-4']],
  caption: [['p', 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7.2L8 19.8v-3.3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z'], ['p', 'M8 10.8c1.3-1.3 2.6 1.3 4 0s2.7 1.3 4 0']],
  motion: [['c', 12, 9.6, 4.2], ['p', 'M5.5 20.2h13'], ['p', 'M9.6 16.6h4.8'], ['p', 'M5.2 6.4c.5-1.2 1.4-1.9 2.4-2.2M18.8 6.4c-.5-1.2-1.4-1.9-2.4-2.2']],
  export: [['p', 'M12 14.2V4.4'], ['p', 'M8.2 8.2L12 4.4l3.8 3.8'], ['p', 'M4.8 13.8v3.6a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8v-3.6']],
  save: [['p', 'M12 4.2v9.6'], ['p', 'M8.2 10.2l3.8 3.8 3.8-3.8'], ['p', 'M4.8 14.8v2.6A1.8 1.8 0 0 0 6.6 19.2h10.8a1.8 1.8 0 0 0 1.8-1.8v-2.6']],
  pro: [['p', 'M12 3.8l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z'], ['p', 'M18.4 15.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z']],
  // ── 시스템(보편 모양 · 같은 선) ──
  back: [['p', 'M15 5l-7 7 7 7']],
  next: [['p', 'M9 5l7 7-7 7']],
  close: [['p', 'M6 6l12 12M18 6L6 18']],
  plus: [['p', 'M12 5v14M5 12h14']],
  delete: [['p', 'M4.5 7h15'], ['p', 'M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7'], ['p', 'M6.5 7l.8 11.3A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7']],
  eye: [['p', 'M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6z'], ['c', 12, 12, 2.8]],
  eyeOff: [['p', 'M4 4l16 16'], ['p', 'M9.9 6.3A9.8 9.8 0 0 1 12 6c5.9 0 9.2 6 9.2 6a15 15 0 0 1-2.7 3.4M6.2 7.8C4 9.4 2.8 12 2.8 12s3.3 6 9.2 6c1.4 0 2.6-.3 3.7-.8']],
  undo: [['p', 'M9 14L4.5 9.5 9 5'], ['p', 'M4.5 9.5h9.5a5.5 5.5 0 0 1 0 11H11']],
  redo: [['p', 'M15 14l4.5-4.5L15 5'], ['p', 'M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3']],
  more: [['c', 5.5, 12, .9], ['c', 12, 12, .9], ['c', 18.5, 12, .9]],
  check: [['p', 'M5 12.5l4.5 4.5L19 7.5']],
  settings: [['p', 'M10.3 3.8h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.8 1.6v1.8l1.8 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.8-1.6v-1.8L4.3 9.1 6 6.2l2.2.8 1.6-.9z'], ['c', 12, 12, 2.6]],
} satisfies Record<string, El[]>;
export type IconName = keyof typeof ICON_PATHS;
export const CORE_ICONS: IconName[] = ['brush', 'eraser', 'fill', 'color', 'reference', 'layer', 'caption', 'motion', 'export', 'save', 'pro'];

export function ImtiIcon({ name, size = IconSize.row, color, disabled, accessibilityLabel }: {
  name: IconName; size?: IconSizeValue; color?: string; disabled?: boolean; accessibilityLabel?: string;
}) {
  const ink = color ?? (disabled ? ICON_FAINT : ICON_INK);
  const line = { stroke: ink, strokeWidth: ICON_STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  // 글자가 옆에 있는 아이콘은 화면 읽기에서 숨긴다. 아이콘만 있는 버튼은 버튼 쪽에 이름을 둔다(부르는 쪽 규칙).
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={'icon-' + name} {...a11y}>
    {(ICON_PATHS[name] as readonly El[]).map((e, i) => e[0] === 'p' ? <Path key={i} d={e[1]} {...line} />
      : e[0] === 'c' ? <Circle key={i} cx={e[1]} cy={e[2]} r={e[3]} {...line} />
      : <Rect key={i} x={e[1]} y={e[2]} width={e[3]} height={e[4]} rx={e[5]} {...line} />)}
  </Svg>;
}
