// 첫 실행 한 장 · 작가명 정하기(2026-10-08 토스식 개편 · 캔버스 T-Start / T-Login, 사용자 확인).
// - 로그인은 무료·유료 모두 한다(사용자 결정). 서버 설정이 있는 빌드에서는 카카오·네이버·구글 버튼, 없는 빌드(개발·검사)는 '시작하기' 하나.
// - 제목은 '쉽게 움직이는 이모티콘'을 앞세운다(사용자 요청: 내보내기보다 움직임 강조).
// - 작가명은 한 번 정하면 바꿀 수 없다. 형식은 여기서 먼저 보고, 금지어·중복은 서버가 정한다(입력이 멈추면 확인).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T, Font, Clay } from './ui';
import { HopStage } from './motion-fx';
import { ImtiIcon, IconSize } from '../design/icons';
import type { Provider } from '../services/cloud/account';
import { t } from '../i18n/index';
import * as AppleAuthentication from 'expo-apple-authentication';

const C = T;
const LOGIN: { id: Provider; label: string; bg: string; ink: string; line?: string }[] = [
  { id: 'kakao', label: t('start.kakao'), bg: '#FEE500', ink: 'rgba(0,0,0,0.85)' },   // 각 회사 로그인 버튼 안내의 색
  { id: 'naver', label: t('start.naver'), bg: '#03C75A', ink: '#FFFFFF' },
  { id: 'google', label: t('start.google'), bg: '#F2F4F6', ink: '#191F28' },   // 2026-10-14 시안 Z-Start: 흰 바탕 위 옅은 회색 면
];
function Logo({ id }: { id: Provider }) {
  if (id === 'kakao') return <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9l-.9 3.3 3.8-2.5c.6.1 1.2.1 1.9.1 5 0 9-3.1 9-6.9S17 4 12 4z" fill="#191919" /></Svg>;
  if (id === 'naver') return <Svg width={16} height={16} viewBox="0 0 24 24"><Path d="M15.6 12.8 8.1 2H2v20h6.4V11.2L15.9 22H22V2h-6.4z" fill="#FFFFFF" /></Svg>;
  return <Svg width={18} height={18} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z" />
    <Path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7z" />
    <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.8 2.4-8.7 2.4-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </Svg>;
}

// 움직이는 칸 셋 + 빈 칸 하나(2026-10-16: 콘 · 친구 고구마 · 친구 완두콩 — 같은 캐릭터가 이어지지 않게). 각자 다른 움직임으로 '톡 누르면 움직인다'를 보여 준다.
function useLoop(ms: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.loop(Animated.sequence([
    Animated.timing(v, { toValue: 1, duration: ms / 2, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration: ms / 2, useNativeDriver: true })])); a.start(); return () => a.stop(); }, [v, ms]);
  return v;
}
const CORN = { wave: require('../../assets/mascot/corn-wave.png'), goguma: require('../../assets/mascot/goguma-cheer.png'), kong: require('../../assets/mascot/kong-wave.png') };
const Corn = ({ s, pose }: { s: number; pose: keyof typeof CORN }) => <Image accessibilityIgnoresInvertColors source={CORN[pose]} style={{ width: s, height: s }} resizeMode="contain" />;
function MovingSet({ size }: { size: number }) {
  const a = useLoop(900), b = useLoop(1300), c = useLoop(1800);
  const cell = (size - 56 - 12) / 2, art = Math.round(cell * .62);
  const box = { width: cell, height: cell, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Clay.card } as const;
  // 시안 Z-Start: 옅은 노란 동그라미 위에 흰 클레이 칸들.
  return <View accessible accessibilityLabel="움직이는 이모티콘 예시" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFBE0', padding: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <View style={box}><Animated.View style={{ transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -art * .14] }) }] }}><Corn s={art} pose="wave" /></Animated.View></View>
      <View style={box}><Animated.View style={{ transform: [{ rotate: b.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }] }}><Corn s={art} pose="goguma" /></Animated.View></View>
      <View style={box}><Animated.View style={{ transform: [{ translateY: c.interpolate({ inputRange: [0, 1], outputRange: [-art * .05, art * .05] }) }] }}><Corn s={art} pose="kong" /></Animated.View></View>
      <View style={{ ...box, backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: C.lineStrong }}><ImtiIcon name="plus" size={IconSize.tool} color={C.faint} /></View>
    </View>
    <View style={{ position: 'absolute', right: -6, top: -10, height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, ...Clay.small, justifyContent: 'center' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.point }} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>움직이는 중</Text>
    </View>
  </View>;
}

export function StartScreen({ providers, apple, onLogin, onStart, busy, error }: {
  providers: Record<Provider, boolean> | null;   // null = 서버 설정 없는 빌드(로그인 없이 '시작하기')
  apple?: boolean;   // iOS 에서 Apple 로그인을 쓸 수 있을 때(2026-10-27, App Store 지침 4.8)
  onLogin: (p: Provider | 'apple') => void; onStart: () => void; busy?: boolean; error?: string;
}) {
  const { width, height } = useWindowDimensions();
  const art = Math.min(272, width - 96, height * .34);
  return <ScrollView testID="첫 실행" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, backgroundColor: C.paper }}>
    <View style={{ gap: 14, paddingTop: height < 700 ? 28 : 64 }}>
      <Text accessibilityRole="header" accessibilityLabel="emoti 이모티" style={{ fontSize: 20, fontFamily: Font.display, color: C.ink }}>emoti</Text>
      <Text style={{ fontSize: 32, lineHeight: 43, fontWeight: '800', color: C.ink, letterSpacing: -1 }}>{t('start.title1')}<Text style={{ backgroundColor: '#FFF0A0' }}>{t('start.title2')}</Text></Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: C.muted }}>{t('start.body')}</Text>
    </View>
    <View style={{ flex: 1, minHeight: art + 40, alignItems: 'center', justifyContent: 'center' }}><MovingSet size={art} /></View>
    <View style={{ gap: 8 }}>
      {!!error && <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, lineHeight: 19, color: C.danger, textAlign: 'center' }}>{error}</Text>}
      {/* Apple 버튼은 Apple 이 준 모양 그대로, 다른 로그인과 같은 크기로 맨 위에(iOS 에서만) */}
      {!!providers && apple && <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={16} style={{ height: 56, width: '100%', opacity: busy ? .6 : 1 }}
        onPress={() => { if (!busy) onLogin('apple'); }} />}
      {providers ? LOGIN.map(x => { const ready = providers[x.id];
        return <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={ready ? x.label : x.label + t('start.soon')} accessibilityState={{ disabled: !ready || !!busy }} disabled={!ready || !!busy} onPress={() => onLogin(x.id)}
          style={({ pressed }) => ({ height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: x.bg, borderWidth: x.line ? 1 : 0, borderColor: x.line, opacity: !ready ? .45 : pressed || busy ? .8 : 1 })}>
          <Logo id={x.id} /><Text style={{ fontSize: 16, fontWeight: '700', color: x.ink }}>{ready ? x.label : x.label + t('start.soon')}</Text>
        </Pressable>; })
        : <Pressable accessibilityRole="button" accessibilityLabel={t('start.go')} onPress={onStart}
            style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.accentInk }}>{t('start.go')}</Text>
          </Pressable>}
      {!!providers && <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: C.muted, textAlign: 'center' }}>{t('start.terms')}</Text>}
    </View>
  </ScrollView>;
}

export function ArtistNameScreen({ check, save, formatError, onBack }: {
  check: (name: string) => Promise<{ ok: boolean; reason?: string }>;
  save: (name: string) => Promise<void>;
  formatError: (name: string) => string | null;
  onBack?: () => void;
}) {
  const [name, setName] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'checking' | 'ok' | 'bad'; text?: string }>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const n = name.trim(); const my = ++seq.current;
    if (!n) { setState({ kind: 'idle' }); return; }
    const bad = formatError(n); if (bad) { setState({ kind: 'bad', text: bad }); return; }
    setState({ kind: 'checking' });
    const timer = setTimeout(() => { check(n).then(r => { if (my === seq.current) setState(r.ok ? { kind: 'ok', text: t('artist.ok') } : { kind: 'bad', text: r.reason ?? t('artist.no') }); })
      .catch(() => { if (my === seq.current) setState({ kind: 'bad', text: t('artist.offline') }); }); }, 400);
    return () => clearTimeout(timer);
  }, [name]);
  const done = async () => { setSaving(true);
    try { await save(name.trim()); } catch (e) { setState({ kind: 'bad', text: String((e as Error).message ?? e) }); } finally { setSaving(false); } };
  const tone = state.kind === 'ok' ? C.pointInk : state.kind === 'bad' ? C.danger : C.muted;
  return <View testID="작가명 정하기" style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 24, backgroundColor: C.paper }}>
    <View style={{ height: 56, justifyContent: 'center' }}>
      {!!onBack && <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="back" size={IconSize.tool} /></Pressable>}
    </View>
    <View style={{ gap: 10, paddingTop: 12 }}>
      <View style={{ alignSelf: 'flex-start', marginLeft: -20, marginBottom: 6 }}><HopStage size={64}><View style={{ width: 84, height: 84, borderRadius: 28, ...Clay.yellow, alignItems: 'center', justifyContent: 'center' }}><Corn s={64} pose="wave" /></View></HopStage></View>
      <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 37, fontWeight: '800', color: C.ink, letterSpacing: -.9 }}>{t('artist.title')}</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: C.muted }}>{t('artist.rule')}</Text>
    </View>
    <View style={{ marginTop: 26, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 60, borderRadius: 20, paddingHorizontal: 18, backgroundColor: C.paper,
        boxShadow: `inset 0px 0px 0px 2px ${state.kind === 'bad' ? C.danger : name ? C.point : C.lineStrong}, 6px 8px 18px rgba(120, 100, 70, 0.10)` }}>
        <TextInput accessibilityLabel={t('artist.field')} value={name} onChangeText={v => setName(v.replace(/\s/g, '').slice(0, 12))} autoFocus autoCorrect={false} autoCapitalize="none" maxLength={12}
          placeholder={t('artist.example')} placeholderTextColor={C.faint} style={{ flex: 1, padding: 0, fontSize: 20, fontWeight: '800', color: C.ink }} />
        <Text style={{ fontSize: 13, color: C.muted }}>{`${name.length}/12`}</Text>
      </View>
      {state.kind !== 'idle' && <Text testID="작가명 확인" accessibilityLiveRegion="polite" style={{ marginHorizontal: 4, fontSize: 13, fontWeight: '700', color: tone }}>{state.kind === 'checking' ? t('artist.checking') : state.text}</Text>}
    </View>
    <View style={{ flex: 1 }} />
    <Pressable accessibilityRole="button" accessibilityLabel="완료" accessibilityState={{ disabled: state.kind !== 'ok' || saving }} disabled={state.kind !== 'ok' || saving} onPress={() => void done()}
      style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: state.kind !== 'ok' ? C.fill : C.accent, ...(state.kind !== 'ok' ? {} : pressed ? Clay.buttonPressed : Clay.button) })}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: state.kind !== 'ok' ? C.faint : C.accentInk }}>{saving ? '저장하는 중…' : '완료'}</Text>
    </Pressable>
  </View>;
}
