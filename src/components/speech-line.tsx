import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

// 대사 한 줄(2026-10-28). 그림 위에 얹는 글씨 — 캔버스 문구와 같은 모양(굵은 글씨 + 흰 테두리)이라
// 예시에서 본 모습 그대로 내 칸에서도 나온다. 그림 파일에 글자를 굽지 않으므로 언어마다 바뀐다.
// 테두리는 흰 글씨를 여덟 방향으로 살짝 밀어 겹쳐 그린다(React Native 글자에는 외곽선 속성이 없다).
export function SpeechLine({ text, size = 16, color = '#242424', style }: { text: string; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const w = Math.max(1.5, size * .11);
  const base = { fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: '800' as const, textAlign: 'center' as const, letterSpacing: -.3 };
  const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
    {ring.map(([x, y]) => <Text key={x + ',' + y} testID="대사 테두리" numberOfLines={1} style={[base, { position: 'absolute', left: x * w, right: -x * w, top: y * w, color: '#FFFFFF' }]}>{text}</Text>)}
    <Text numberOfLines={1} style={[base, { color }]}>{text}</Text>
  </View>;
}
