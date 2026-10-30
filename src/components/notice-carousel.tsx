import { t } from '../i18n/index';
// 홈 맨 위 공지 배너(2026-10-14 시안 Z-Home · 사용자 확정: "둥근 테두리 없이 앱 가로 규격에 꽉 차게, 이미지 칸").
// 화면 폭을 꽉 채운 가로 배너(390×130 비율)를 옆으로 넘긴다. 혼자서도 4초마다 다음 장으로 넘어가고, 손을 대면 잠시 멈춘다.
// 동작 줄이기(접근성)를 켠 기기에서는 저절로 넘기지 않는다. 왼쪽 아래 점(지금 장은 길쭉한 보라)으로 몇 번째인지 보인다.
// 그림 파일(image)을 주면 배너 전체를 그 그림으로 덮는다 — 권장 1080×360, 왼쪽 아래 모서리(점 자리)는 비워 둔다.
// backdrop 은 배경 그림(1170×390, scripts/lessons/topic-art.cjs) — 오른쪽에 주제 그림이 있고 왼쪽 글자(kicker · title)는 앱이 그대로 얹는다(공모전 제목처럼 바뀌는 글자).
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';
import { T } from './ui';

export type NoticeSlide = { key: string; kicker: string; title: string; tone: string; art: React.ReactNode; onPress: () => void; label: string; testID?: string; kickerColor?: string; image?: ImageSourcePropType; backdrop?: ImageSourcePropType };

export const NOTICE_RATIO = 130 / 390;
const AUTO_MS = 4000;

// guessWidth: 첫 그리기 전 예상 폭(화면 폭). 실제 폭은 onLayout 으로 바로잡는다.
export function NoticeCarousel({ slides, guessWidth }: { slides: NoticeSlide[]; guessWidth: number }) {
  const [width, setWidth] = useState(guessWidth);
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const held = useRef(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo?.isReduceMotionEnabled?.().then(on => { if (live) setStill(!!on); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (still || slides.length < 2) return;
    const id = setInterval(() => {
      if (held.current) return;
      setIndex(i => { const n = (i + 1) % slides.length; scroller.current?.scrollTo?.({ x: n * width, animated: true }); return n; });
    }, AUTO_MS);
    // 검사 환경(node)에서 이 타이머 하나 때문에 프로그램이 끝나지 않는 일이 없게 한다. 기기에서는 unref 가 없어 그대로다.
    (id as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(id);
  }, [still, slides.length, width]);
  if (!slides.length) return null;
  const height = Math.round(width * NOTICE_RATIO);
  return <View testID="홈 공지 슬라이드" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden' }}>
    <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast"
      onTouchStart={() => { held.current = true; }} onTouchEnd={() => { held.current = false; }}
      onMomentumScrollEnd={e => { held.current = false; setIndex(Math.round(e.nativeEvent.contentOffset.x / width)); }}>
      {slides.map(s => <Pressable key={s.key} testID={s.testID} accessibilityRole="button" accessibilityLabel={s.label} onPress={s.onPress}
        style={({ pressed }) => ({ width, height, minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 24, paddingRight: 20, paddingBottom: 6, backgroundColor: s.tone, opacity: pressed ? .9 : 1 })}>
        {s.image ? <Image source={s.image} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="cover" accessibilityIgnoresInvertColors /> : s.backdrop ? <>
          <Image source={s.backdrop} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={{ width: width * .56, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: s.kickerColor ?? T.yellowInk }}>{s.kicker}</Text>
            <Text numberOfLines={2} style={{ fontSize: 20, lineHeight: 27, fontWeight: '900', color: T.ink, letterSpacing: -.4 }}>{s.title}</Text>
          </View>
        </> : <>
          <View pointerEvents="none" style={{ position: 'absolute', right: width * .02, top: height / 2 - height * .58, width: height * 1.16, height: height * 1.16, borderRadius: height, backgroundColor: 'rgba(255,255,255,0.45)' }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: s.kickerColor ?? T.yellowInk }}>{s.kicker}</Text>
            <Text numberOfLines={2} style={{ fontSize: 19, lineHeight: 26, fontWeight: '800', color: T.ink, letterSpacing: -.4 }}>{s.title}</Text>
          </View>
          <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>{s.art}</View>
        </>}
      </Pressable>)}
    </ScrollView>
    {slides.length > 1 && <View pointerEvents="none" accessible accessibilityLabel={t("release.d104", { v0: (slides.length), v1: (index + 1) })}
      style={{ position: 'absolute', left: 24, bottom: 12, flexDirection: 'row', gap: 4 }}>
      {slides.map((s, i) => <View key={s.key} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? T.point : 'rgba(25,31,40,0.28)' }} />)}
    </View>}
  </View>;
}
