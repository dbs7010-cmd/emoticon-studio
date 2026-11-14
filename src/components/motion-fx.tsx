// 첫 화면 효과(2026-10-14 시안 Z · 사용자 확정 "이펙트가 없어"). 모두 Animated 네이티브 구동(transform · opacity 만).
// · Rise: 들어올 때 아래에서 살짝 떠오르며 차례로(delay 로 순서)
// · Hop: 대표 캐릭터가 통통 튄다(그림자·뒤 빛·반짝이와 함께)
// · Fill: 진행 막대가 0 에서 채워지고 빛이 가끔 지나간다
// · Shine: 노란 버튼 위로 가끔 빛이 지나간다
// 동작 줄이기(접근성)를 켠 기기에서는 모두 멈춘 채로 그린다. 옅은 빛 번짐(그라데이션 면)은 쓰지 않는다(사용자 "부담스럽다").
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, type ViewStyle, type StyleProp } from 'react-native';
import { T } from './ui';

let reduceCache: boolean | null = null;
export function useStill() {
  const [still, setStill] = useState(reduceCache ?? false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo?.isReduceMotionEnabled?.().then(on => { reduceCache = !!on; if (live) setStill(!!on); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return still;
}
const loop = (a: Animated.CompositeAnimation) => Animated.loop(a);
// 검사 환경(가짜 RN)에도 있는 순수 함수로 둔다.
const out = (x: number) => 1 - Math.pow(1 - x, 3);
const linear = (x: number) => x;
const wave = (x: number) => .5 - .5 * Math.cos(Math.PI * x);

export function Rise({ delay = 0, children, style, testID }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const still = useStill();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: 550, delay, easing: out, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [still, delay, v]);
  return <Animated.View testID={testID} style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
}

// 대표 캐릭터 무대: 뒤 동그라미(기본 옅은 노랑, 홈 이어 그리기 카드는 흰색 — 2026-10-16, 숨 쉰다) · 반짝이 둘 · 바닥 그림자 · 통통 튀는 그림.
export function HopStage({ size, children, glow: glowColor = '#FFF7CF' }: { size: number; children: React.ReactNode; glow?: string }) {
  const still = useStill();
  const t = useRef(new Animated.Value(0)).current, b = useRef(new Animated.Value(0)).current, s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const hop = loop(Animated.timing(t, { toValue: 1, duration: 1200, easing: linear, useNativeDriver: true }));
    const breathe = loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 1200, easing: wave, useNativeDriver: true }),
      Animated.timing(b, { toValue: 0, duration: 1200, easing: wave, useNativeDriver: true })]));
    const twinkle = loop(Animated.timing(s, { toValue: 1, duration: 2200, easing: wave, useNativeDriver: true }));
    hop.start(); breathe.start(); twinkle.start();
    return () => { hop.stop(); breathe.stop(); twinkle.stop(); };
  }, [still, t, b, s]);
  const lift = t.interpolate({ inputRange: [0, .12, .45, .7, 1], outputRange: [0, 0, -size * .14, 0, 0] });
  const sx = t.interpolate({ inputRange: [0, .12, .45, .7, 1], outputRange: [1.06, .96, 1, 1.04, 1.06] });
  const sy = t.interpolate({ inputRange: [0, .12, .45, .7, 1], outputRange: [.94, 1.05, 1, .96, .94] });
  const shade = t.interpolate({ inputRange: [0, .45, .7, 1], outputRange: [1, .6, 1.05, 1] });
  const glow = b.interpolate({ inputRange: [0, 1], outputRange: [.92, 1.06] });
  const spark = (phase: number) => s.interpolate({ inputRange: [0, phase, phase + .2, phase + .35, 1].map(x => Math.min(1, x)), outputRange: [0, 0, 1, 0, 0], extrapolate: 'clamp' });
  const star = (left: number, top: number, phase: number, k: number) => <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, width: 14 * k, height: 14 * k, opacity: still ? 0 : spark(phase), transform: [{ rotate: '45deg' }, { scale: still ? 1 : spark(phase) }] }}>
    <View style={{ position: 'absolute', left: 6 * k, top: 0, width: 2 * k, height: 14 * k, borderRadius: k, backgroundColor: T.point }} />
    <View style={{ position: 'absolute', top: 6 * k, left: 0, height: 2 * k, width: 14 * k, borderRadius: k, backgroundColor: T.point }} />
  </Animated.View>;
  return <View style={{ width: size * 1.6, height: size * 1.25, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, borderRadius: size, backgroundColor: glowColor, transform: [{ scale: still ? 1 : glow }] }} />
    {star(size * .18, size * .1, .05, 1)}
    {star(size * 1.3, size * .32, .5, .8)}
    <Animated.View style={{ position: 'absolute', bottom: size * .08, width: size * .7, height: 10, borderRadius: 5, backgroundColor: 'rgba(163,151,96,0.22)', transform: [{ scaleX: still ? 1 : shade }] }} />
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: still ? [] : [{ translateY: lift }, { scaleX: sx }, { scaleY: sy }] }}>{children}</Animated.View>
  </View>;
}

// 진행 막대: 보라로 채워지며 들어오고, 3초마다 흰 빛이 한 번 지나간다.
export function FillBar({ ratio, track = 'rgba(255,255,255,0.8)', testID, label }: { ratio: number; track?: string; testID?: string; label?: string }) {
  const still = useStill();
  const [w, setW] = useState(0);
  const grow = useRef(new Animated.Value(0)).current, sweep = useRef(new Animated.Value(0)).current;
  const r = Math.max(.02, Math.min(1, ratio));
  useEffect(() => {
    if (still) { grow.setValue(1); return; }
    const a = Animated.timing(grow, { toValue: 1, duration: 1000, delay: 400, easing: out, useNativeDriver: true });
    const sw = loop(Animated.sequence([Animated.delay(1800), Animated.timing(sweep, { toValue: 1, duration: 1200, easing: wave, useNativeDriver: true }), Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start(); sw.start();
    return () => { a.stop(); sw.stop(); };
  }, [still, grow, sweep]);
  const full = w * r;
  return <View testID={testID} accessible={!!label} accessibilityLabel={label} onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }}>
    <Animated.View style={{ width: full, height: 6, borderRadius: 3, backgroundColor: T.point, overflow: 'hidden', transform: [{ translateX: grow.interpolate({ inputRange: [0, 1], outputRange: [-full, 0] }) }] }}>
      {!still && <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: Math.max(12, full * .4), backgroundColor: 'rgba(255,255,255,0.45)', transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-full * .5, full * 1.2] }) }] }} />}
    </Animated.View>
  </View>;
}

// 노란 버튼 위로 가끔 지나가는 빛줄기. 부모는 overflow: 'hidden' 이어야 한다.
export function Shine({ width }: { width: number }) {
  const still = useStill();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const a = loop(Animated.sequence([Animated.delay(2600), Animated.timing(v, { toValue: 1, duration: 1000, easing: wave, useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [still, v]);
  if (still) return null;
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -10, bottom: -10, width: width * .3, backgroundColor: 'rgba(255,255,255,0.45)', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-width * .5, width * 1.3] }) }, { skewX: '-20deg' }] }} />;
}
