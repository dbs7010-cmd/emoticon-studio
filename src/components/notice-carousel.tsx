// 홈 맨 위 공지 슬라이드(2026-10-13 사용자 요청: "공지 프레임 꽉 차게, 옆으로 슬라이드, 누르면 볼 수 있게").
// 카드 하나가 줄 폭을 꽉 채우고, 옆으로 넘기면 다음 공지가 온다. 오른쪽 아래 '1 / n' 으로 몇 번째인지 보인다.
// 저절로 넘어가지 않는다 — 읽는 중에 바뀌지 않게(손으로만 넘김).
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { T } from './ui';

export type NoticeSlide = { key: string; kicker: string; title: string; tone: string; art: React.ReactNode; onPress: () => void; label: string; testID?: string };

// guessWidth: 첫 그리기 전 예상 폭(화면 폭 - 여백). 실제 폭은 onLayout 으로 바로잡는다.
export function NoticeCarousel({ slides, guessWidth }: { slides: NoticeSlide[]; guessWidth: number }) {
  const [width, setWidth] = useState(guessWidth);
  const [index, setIndex] = useState(0);
  if (!slides.length) return null;
  return <View testID="홈 공지 슬라이드" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ borderRadius: 24, overflow: 'hidden' }}>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast"
      onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
      {slides.map(s => <Pressable key={s.key} testID={s.testID} accessibilityRole="button" accessibilityLabel={s.label} onPress={s.onPress}
        style={({ pressed }) => ({ width, minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 16, paddingVertical: 14, backgroundColor: s.tone, opacity: pressed ? .85 : 1 })}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: T.muted }}>{s.kicker}</Text>
          <Text numberOfLines={2} style={{ fontSize: 18, lineHeight: 25, fontWeight: '800', color: T.ink, letterSpacing: -.3 }}>{s.title}</Text>
        </View>
        <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>{s.art}</View>
      </Pressable>)}
    </ScrollView>
    {slides.length > 1 && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', right: 12, bottom: 6, height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(31,29,26,.55)' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>{`${index + 1} / ${slides.length}`}</Text>
    </View>}
  </View>;
}
