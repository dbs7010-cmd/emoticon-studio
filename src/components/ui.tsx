import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, Modal, Pressable, ScrollView, ActivityIndicator, type ImageSourcePropType } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUri } from '../services/storage';
import { ASSET_SLOTS, type AssetSlotName } from '../design/asset-slots';
import type { LocalImage } from '../types';

// ── 임티제작소 디자인 토큰(40차) ──────────────────────────────────────────────────────────────
// 한 벌의 색·글자·간격·모서리·그림자로 홈·보드·그리기·내보내기가 한 앱으로 읽히게 한다.
//
// 색은 명세 §2 표를 따른다: 흰 바탕 · 차가운 회색 계열 보조 · 노랑 하나로 강조(CTA · 고른 것 · 진행).
// 창작 표면처럼 따뜻한 면은 강조 면으로만 남긴다. 색만으로 상태를 구분하지 않는다(테두리·체크·밑줄을 함께 쓴다).
// 노랑 위 글자는 반드시 accentInk(짙은 색) — 흰 글자는 대비가 2:1 아래라 읽히지 않는다. 노랑을 글자색으로 쓰지 않는다.
// 이 앱은 카카오 이모티콘 제출을 돕지만 카카오가 만든 앱이 아니다. 카카오의 노랑·로고·캐릭터·화면 구성을 따라 하지 않는다.
export const T = {
  bg: '#FFFFFF',            // surface — 앱 기본 바탕(명세 §2)
  paper: '#FFFFFF',         // surfacePrimary
  surface2: '#F5F6F8',      // workspace — 캔버스 바깥·세그먼트 바탕·빈 칸(명세 §2)
  warm: '#FFF9E8',          // surfaceWarm — 창작 표면·제안
  ink: '#17191D',           // ink — 본문·아이콘(명세 §2)
  muted: '#555D69',         // secondary — 보조 설명(명세 §2)
  faint: '#8B93A0',         // 아주 작은 보조 글자와 비활성 아이콘(secondary 에서 한 단계 옅게)
  line: '#E3E6EC',          // border — 구분선(명세 §2)
  lineStrong: '#CBD0DA',
  accent: '#FFD52A',        // primary — 주요 CTA·도구 선택(명세 §2)
  accentLine: '#F0C61E',    // primaryPressed
  accentSoft: '#FFF3B0',    // selected — 선택 배경 보조(명세 §2)
  accentInk: '#17191D',     // 노랑 위 글자는 언제나 짙은 색(흰 글씨 금지)
  accentBorder: '#EFD25E', // 고른 표면(옅은 노랑)의 1px 가장자리
  warmLine: '#F4E6B8',      // 따뜻한 표면의 가장자리
  warmInk: '#8A6A00',       // 따뜻한 표면 위의 작은 머리글(노랑 계열 글자가 아닌 짙은 황갈색)
  floating: '#FFFFFFF7',    // 캔버스 위에 뜨는 흰 표면
  yellow: '#FFD52A',
  fill: '#EFF1F5', fillPressed: '#E3E6EC',
  success: '#2F8A57', successSoft: '#E4F3EA',
  warning: '#A86400', warningSoft: '#FDF0D6',
  danger: '#B42318', dangerSoft: '#FBE4E1',   // danger(명세 §2)
  info: '#2C5F9E', infoSoft: '#EAF1FB',
  mint: '#E4F3EA', blue: '#EAF1FB', lavender: '#EFE8FB',
  lilac: '#D9CFFF', sky: '#C9EBFF', coral: '#FFD5CF',   // 감정 그림 배경(명세 §2)
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  tap: 48, // 편한 손가락 자리
};
const C = T;

// 글자 위계. 굵기 하나로 위계를 만들지 않는다 — 크기·굵기·색·줄 간격을 함께 쓴다. 설명문은 굵게 쓰지 않는다.
export const Type = {
  screenTitle: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
  cardTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: T.ink },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400', color: T.ink },
  bodySecondary: { fontSize: 13, lineHeight: 19, fontWeight: '400', color: T.muted },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: T.ink },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: T.muted },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: T.faint },
} as const;

// 그림자는 예뻐 보이려고가 아니라 표면의 층을 가르려고 쓴다. 짙은 그림자는 쓰지 않는다.
//   0: 평평한 바탕 · 1: 카드·누르는 표면 · 2: 떠 있는 dock·시트
export const Elev = {
  0: {},
  1: { shadowColor: '#3B3420', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  2: { shadowColor: '#3B3420', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
} as const;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// 사용자에게 보여 줄 오류 문장. 우리가 쓴 한국어 문장은 그대로, 기술 오류(영문·코드·경로)는 일반 문장으로 바꾼다.
// 원문은 개발 로그로만 남긴다 — 화면에는 "Error:"·파일 경로·JSON 같은 말이 나오지 않는다.
export function userMessage(error: unknown, fallback = '잠시 후 다시 시도해 주세요.'): string {
  const text = String((error as { message?: string })?.message ?? error ?? '').replace(/^(Error|TypeError|RangeError):\s*/, '').trim();
  if (!/[가-힣]/.test(text) || /(undefined|null|TypeError|JSON|base64|file:|content:|\bat\s)/i.test(text)) {
    if (text) console.warn('[emoticon-studio]', text);
    return fallback;
  }
  return text;
}

// ── 버튼 가족 ──────────────────────────────────────────────────────────────────────────────
// primary   노랑 · 52dp · 화면에 하나. 지금 할 일.
// secondary 흰 표면 + 옅은 테두리 · 48dp. primary 와 같은 무게로 보이지 않는다.
// ghost     바탕 없음 · 작은 보조 동작.
// danger    옅은 빨강 바탕 + 짙은 빨강 글자. 되돌릴 수 없는 일.
// 네 상태를 눈으로 구분한다: 평소 / 눌림(색이 잠깐 진해진다) / 비활성(흐려진다) / 처리 중(돌아가는 표시).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Action({ title, onPress, disabled = false, primary = false, busy = false, danger = false, icon, variant, compact = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean; busy?: boolean; danger?: boolean; icon?: IconName; variant?: ButtonVariant; compact?: boolean }) {
  const kind: ButtonVariant = variant ?? (primary ? 'primary' : danger ? 'danger' : 'secondary');
  const off = disabled || busy;
  const tint = kind === 'primary' ? T.accentInk : kind === 'danger' ? T.danger : T.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: off, busy }} disabled={off} onPress={onPress}
    style={({ pressed }) => ({
      minHeight: kind === 'primary' && !compact ? 52 : T.tap, borderRadius: kind === 'primary' ? 14 : T.radius.sm,
      flexDirection: 'row', gap: T.gap.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: kind === 'ghost' ? T.gap.sm : T.gap.lg,
      backgroundColor: kind === 'primary' ? (off ? '#F4ECCB' : pressed ? T.accentLine : T.accent)
        : kind === 'danger' ? T.dangerSoft
        : kind === 'ghost' ? (pressed ? T.fill : 'transparent')
        : (pressed ? T.fill : T.paper),
      borderWidth: kind === 'secondary' ? 1 : 0, borderColor: T.line,
      opacity: off && kind !== 'primary' ? .5 : kind === 'danger' && pressed ? .8 : 1,
    })}>
    {busy && <ActivityIndicator size="small" color={kind === 'primary' ? T.accentInk : T.muted} />}
    {!busy && !!icon && <MaterialCommunityIcons name={icon} size={18} color={off && kind === 'primary' ? T.faint : tint} />}
    <Text numberOfLines={1} style={{ ...Type.button, fontSize: kind === 'primary' && !compact ? 16 : 14, fontWeight: kind === 'primary' ? '800' : '700', color: off && kind === 'primary' ? T.faint : tint }}>{title}</Text>
  </Pressable>;
}

// 아이콘만 있는 버튼. 보이는 아이콘은 작아도 누르는 자리는 48dp 다. 아이콘 둘레에 카드를 두르지 않는다.
export function IconButton({ label, icon, onPress, disabled, size = 22, color = T.ink, active, testID }: { label: string; icon: IconName; onPress: () => void; disabled?: boolean; size?: number; color?: string; active?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: active }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ width: T.tap, height: T.tap, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed || active ? T.fill : 'transparent', opacity: disabled ? .3 : 1 })}>
    <MaterialCommunityIcons name={icon} size={size} color={color} />
  </Pressable>;
}

// 하나의 낮고 넓은 세그먼트. 칸마다 테두리를 두르지 않는다 — 고른 칸만 옅은 노랑 알약이 올라온다.
// 세 개의 독립 카드처럼 보이면 안 된다.
export type SegmentItem<K extends string> = { key: K; label: string; icon?: IconName; image?: number; a11y?: string };
export function Segmented<K extends string>({ items, value, onChange, testID, dense }: { items: SegmentItem<K>[]; value: K | null; onChange: (key: K) => void; testID?: string; dense?: boolean }) {
  return <View testID={testID} style={{ flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: T.surface2 }}>
    {items.map(item => { const on = item.key === value;
      return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.a11y ?? item.label} accessibilityState={{ selected: on }} onPress={() => onChange(item.key)}
        style={{ flex: 1, minHeight: dense ? 40 : 44, borderRadius: 11, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
          backgroundColor: on ? T.accentSoft : 'transparent', borderWidth: on ? 1 : 0, borderColor: on ? T.accentBorder : 'transparent' }}>
        {!!item.image && <Image source={item.image} style={{ width: 13, height: 18, opacity: on ? 1 : .7 }} resizeMode="contain" />}
        {!!item.icon && <MaterialCommunityIcons name={item.icon} size={16} color={on ? T.ink : T.muted} />}
        <Text numberOfLines={1} style={{ fontSize: dense ? 13 : 14, fontWeight: on ? '800' : '600', color: on ? T.ink : T.muted }}>{item.label}</Text>
      </Pressable>; })}
  </View>;
}

// 칩: 짧은 선택지 여러 개. 고르면 옅은 노랑, 아니면 흰 표면. 테두리는 1px 하나.
export function Chip({ label, on, onPress, icon, wide, a11y }: { label: string; on: boolean; onPress: () => void; icon?: IconName; wide?: boolean; a11y?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ selected: on }} onPress={onPress}
    style={({ pressed }) => ({ flex: wide ? 1 : undefined, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: on ? T.accentBorder : T.line, backgroundColor: on ? T.accentSoft : pressed ? T.fill : T.paper })}>
    {!!icon && <MaterialCommunityIcons name={icon} size={16} color={on ? T.ink : T.muted} />}
    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? T.ink : T.muted }}>{label}</Text>
  </Pressable>;
}

// 시트·패널 머리: 제목 하나 + 선택 보조 동작 + 닫기. 모든 패널이 같은 머리를 쓴다.
export function SheetHeader({ title, onClose, closeLabel, closeIcon = 'close', right }: { title: string; onClose: () => void; closeLabel?: string; closeIcon?: IconName; right?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: T.gap.lg, paddingRight: 4 }}>
    <View style={{ position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none"><View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: T.line }} /></View>
    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }}>{title}</Text>
    {right}
    <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? title + ' 닫기'} onPress={onClose}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : 'transparent' })}>
      <MaterialCommunityIcons name={closeIcon} size={20} color={T.muted} />
    </Pressable>
  </View>;
}

// 섹션 제목(시트 안 · 화면 안). 굵은 대문자 라벨 대신 조용한 작은 제목.
export function SectionLabel({ title, right }: { title: string; right?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28 }}>
    <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: T.muted }}>{title}</Text>
    {right}
  </View>;
}

// 상태 점: 완성(초록) · 작업 중(노랑) · 손볼 곳(호박) · 문제(빨강). 글자 배지 대신 모서리 점 하나.
export const STATUS_TONE = { done: T.success, working: '#E8B21A', warn: '#D9901A', fail: '#D2574F' } as const;
// 상태는 색만으로 말하지 않는다(45.4차): 완성은 꽉 찬 점, 고치는 중은 테두리만 있는 점 — 색을 구분하지 못해도 모양이 다르다.
export function StatusDot({ tone, size = 10 }: { tone: keyof typeof STATUS_TONE; size?: number }) {
  const hollow = tone === 'working';
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hollow ? '#FFFFFF' : STATUS_TONE[tone], borderWidth: 2, borderColor: hollow ? STATUS_TONE[tone] : '#FFFFFF' }} />;
}

// 최종 일러스트 자리. 에셋이 없으면 따뜻한 도형으로 구성을 채운다 — 빈칸이나 회색 박스로 두지 않는다.
export function AssetSlot({ name, size, style, sourceOverride }: { name: AssetSlotName; size: number; style?: object; sourceOverride?: ImageSourcePropType | null }) {
  const spec = ASSET_SLOTS[name];
  const width = size, height = size / spec.aspectRatio;
  const source = sourceOverride === undefined ? spec.source : sourceOverride;
  if (source) return <Image accessibilityIgnoresInvertColors source={source} style={[{ width, height }, style]} resizeMode="contain" />;
  return <View testID={'asset-slot-' + name} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[{ width, height }, style]}>
    <View style={{ position: 'absolute', right: 0, bottom: 0, width: width * .82, height: width * .82, borderRadius: width, backgroundColor: '#FFE89A', opacity: .55 }} />
    <View style={{ position: 'absolute', left: width * .12, top: height * .18, width: width * .5, height: width * .5, borderRadius: width * .16, backgroundColor: '#FFFFFF', transform: [{ rotate: '-8deg' }], ...Elev[1] }} />
    <View style={{ position: 'absolute', left: width * .26, top: height * .34, width: width * .06, height: width * .06, borderRadius: width, backgroundColor: T.ink }} />
    <View style={{ position: 'absolute', left: width * .4, top: height * .32, width: width * .06, height: width * .06, borderRadius: width, backgroundColor: T.ink }} />
    <View style={{ position: 'absolute', right: width * .1, top: height * .12, width: width * .1, height: width * .1, borderRadius: width, backgroundColor: T.accent }} />
  </View>;
}

// 앱 색의 슬라이더. 트랙 · 채워진 부분 · 손잡이. 줄 어디를 끌어도 움직인다.
export function Range({ label, value, min, max, step, onChange, display, testID, onActive }: { label?: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; display?: string; testID?: string; onActive?: (active: boolean) => void }) {
  const [width, setWidth] = React.useState(0);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const from = (x: number) => { if (width > 0) onChange(min + Math.max(0, Math.min(1, x / width)) * (max - min)); };
  // 스크린 리더는 자리를 누르지 않고 한 걸음을 요청한다. 한 걸음은 따로 정하지 않으면 범위의 1/20.
  const nudge = (by: number) => {
    const jump = step ?? (max - min) / 20;
    onChange(Math.max(min, Math.min(max, value + by * jump)));
  };
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
    {!!label && <Text style={{ width: 40, fontSize: 12, fontWeight: '600', color: T.muted }}>{label}</Text>}
    <View testID={testID} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'increment') nudge(1); if (e.nativeEvent.actionName === 'decrement') nudge(-1); }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={e => { onActive?.(true); from(e.nativeEvent.locationX); }} onResponderMove={e => from(e.nativeEvent.locationX)}
      onResponderRelease={() => onActive?.(false)} onResponderTerminate={() => onActive?.(false)}
      style={{ flex: 1, height: 44, justifyContent: 'center' }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: T.line, overflow: 'hidden' }}>
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: T.accent }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${ratio * 100}%`, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: T.lineStrong, ...Elev[1] }} />
    </View>
    {!!display && <Text accessibilityLabel={label ? label + ' 값' : undefined} style={{ minWidth: 42, fontSize: 12, color: T.muted, textAlign: 'right' }}>{display}</Text>}
  </View>;
}
// PRO 표시는 한 가지 모양뿐이다: 옅은 바탕의 작은 글자. 누르는 버튼(노랑)처럼 보이지 않게, 경고처럼 튀지 않게.
export function ProTag() {
  return <View style={{ paddingHorizontal: 6, height: 18, borderRadius: 6, backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, justifyContent: 'center' }}>
    <Text style={{ fontSize: 10, fontWeight: '800', color: T.muted, letterSpacing: .4 }}>PRO</Text>
  </View>;
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#1716144D', justifyContent: 'center', padding: 20 }}>
    <View accessibilityViewIsModal style={{ maxHeight: '82%', backgroundColor: C.paper, borderRadius: T.radius.xl, paddingHorizontal: T.gap.xl, paddingTop: T.gap.md, paddingBottom: T.gap.xl, gap: T.gap.sm, ...Elev[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.subtitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={{ width: T.tap, height: T.tap, marginRight: -12, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="close" size={20} color={T.muted} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>
    </View>
  </View></Modal>;
}
export function Field({ label, value, onChangeText, multiline = true, flat = false }: { label: string; value: string; onChangeText: (s: string) => void; multiline?: boolean; flat?: boolean }) {
  return <View style={{ gap: flat ? 2 : 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }, flat && { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 2, minHeight: 44 }, flat && multiline && { minHeight: 44 }]} placeholder={`${label} 입력`} placeholderTextColor={T.faint} /></View>;
}
export function Preview({ image, label, size = 140 }: { image?: LocalImage; label: string; size?: number }) {
  return <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>{label}</Text><View style={{ height: size, backgroundColor: T.surface2, borderRadius: T.radius.md, justifyContent: 'center', overflow: 'hidden' }}>{image ? <Image accessibilityLabel={label} source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ textAlign: 'center', color: C.muted }}>이미지 없음</Text>}</View></View>;
}
export const styles = StyleSheet.create({
  page: { padding: T.gap.lg, gap: T.gap.md, paddingBottom: 28, backgroundColor: C.bg },
  card: { padding: T.gap.lg, gap: T.gap.sm, backgroundColor: C.paper, borderRadius: T.radius.lg, borderWidth: 1, borderColor: C.line },
  title: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  label: { fontSize: 12, fontWeight: '700', color: C.muted },
  input: { fontSize: 16, minHeight: T.tap, borderWidth: 1, borderColor: C.line, borderRadius: T.radius.sm, padding: T.gap.md, backgroundColor: '#FFFFFF', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
});
