import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, Modal, Pressable, ScrollView, ActivityIndicator, type ImageSourcePropType } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUri } from '../services/storage';
import { ASSET_SLOTS, type AssetSlotName } from '../design/asset-slots';
import type { LocalImage } from '../types';

// ── 임티제작소 디자인 토큰 · 45.39 확정 방향 D '노랑 스티커' ─────────────────────────────────────
// 사용자 확정(2026-09-27): B 의 굵은 테두리 + A 의 따뜻한 색감, 노랑이 기본색, 대비색으로 눈이 피로하지 않게 뚜렷하게.
//
// · 바탕은 따뜻한 크림(차가운 회색을 걷었다). 흰 표면이 그 위에 스티커처럼 붙는다.
// · 노랑(#FFCC2E)은 지금 할 일(저장·새로 만들기)과 고른 것에만 넓게 쓴다. 넓은 노란 면은 화면에 하나.
// · 대비색: 보라(PRO) · 초록(저장됨·완성) · 파스텔(감정 카드). 경고색은 정말 경고일 때만.
// · 테두리 절충안(45.39 사용자 확정 — 검정이 모든 카드를 두르니 '뜬금없고 통일성이 약하다'):
//   검정 2px(+ 딱 떨어지는 그림자 Pop)는 **누를 노란 버튼**과 **고른 것**에만 쓴다. 그래서 검정이 '누를 것·지금 고른 것'을 뜻한다.
//   카드·캔버스·안내·목록 상자는 따뜻한 갈색 선 + 부드러운 그림자(Card · Paper). 목록 줄은 얇은 선 그대로.
// · 노랑 위 글자는 언제나 짙은 색(흰 글씨 금지). 노랑을 글자색으로 쓰지 않는다.
// 이 앱은 카카오 이모티콘 제출을 돕지만 카카오가 만든 앱이 아니다. 카카오의 노랑(#FEE500)·로고·캐릭터·화면 구성을 따라 하지 않는다.
export const T = {
  bg: '#FFF9EC',            // 앱 바탕 — 따뜻한 크림
  paper: '#FFFFFF',         // 스티커 표면
  surface2: '#F6EBD3',      // 작업대 — 캔버스 바깥·세그먼트 바탕·빈 칸
  warm: '#FFF3D6',          // 따뜻한 제안 면
  ink: '#2A2320',           // 본문·아이콘·스티커 테두리
  muted: '#6F6258',         // 보조 설명(흰 표면에서 6:1)
  faint: '#9A8C7F',         // 아주 작은 보조 글자와 비활성 아이콘
  line: '#EADFCB',          // 구분선
  lineStrong: '#D3C4AA',
  accent: '#FFCC2E',        // 기본색 노랑 — 지금 할 일과 고른 것
  accentLine: '#F0B800',    // 노랑 눌림
  accentSoft: '#FFF0B8',    // 고른 면
  accentInk: '#2A2320',     // 노랑 위 글자
  accentBorder: '#2A2320',  // 고른 면의 가장자리 — 스티커 테두리와 같은 짙은 색
  warmLine: '#EFDDB0',
  warmInk: '#7A5A00',
  floating: '#FFFFFFF7',
  yellow: '#FFCC2E',
  fill: '#F3EADA', fillPressed: '#EADFCB',
  success: '#1E7F55', successSoft: '#D5F2E3',
  warning: '#9A5B00', warningSoft: '#FFEACC',
  danger: '#B42318', dangerSoft: '#FCE3DF',
  info: '#3D4FC4', infoSoft: '#E9E5FF',
  pro: '#5B47E0', proSoft: '#ECE8FF',            // PRO 대비색(노랑의 반대편 보라)
  mint: '#D5F2E3', blue: '#E3F1FF', lavender: '#ECE8FF',
  lilac: '#DCD3FF', sky: '#CDEBFF', coral: '#FFD9CC',   // 감정 카드 파스텔
  edge: '#2A2320', stroke: 2,                            // 검정 테두리 — 노란 버튼·고른 것에만
  cardLine: '#E0CFAF', paperLine: '#D6C3A0',             // 카드·캔버스의 따뜻한 갈색 선
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, chip: 10, button: 14, card: 20 },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  tap: 48, // 편한 손가락 자리
};
const C = T;
// 제목 글꼴: Jua(빌드 때 APK 에 들어간다, app.config.js). 한 굵기뿐이라 굵기는 400 으로 둔다 — 굵게를 걸면 가짜 굵기가 된다.
export const Font = { display: 'Jua' } as const;
const display = { fontFamily: Font.display, fontWeight: '400' as const };

// 글자 위계. 화면·섹션 제목은 Jua, 본문은 기기 기본 한글 글꼴. 설명문은 굵게 쓰지 않는다.
export const Type = {
  screenTitle: { fontSize: 26, lineHeight: 34, ...display, color: T.ink },
  screenName: { fontSize: 22, lineHeight: 29, ...display, color: T.ink },
  sectionTitle: { fontSize: 19, lineHeight: 26, ...display, color: T.ink },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: T.ink },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', color: T.ink },
  bodySecondary: { fontSize: 13, lineHeight: 19, fontWeight: '400', color: T.muted },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: T.ink },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: T.muted },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: T.faint },
} as const;

// 그림자. 층을 가르는 부드러운 그림자(Elev)와, 스티커처럼 붙은 주요 표면의 딱 떨어지는 그림자(Pop) 두 가지.
//   Elev 0: 평평한 바탕 · 1: 카드·누르는 표면 · 2: 떠 있는 dock·시트
//   Pop: 2px 테두리와 함께 쓴다(주요 버튼·카드·캔버스·고른 것). 눌리면 그림자를 거두고 그만큼 내려앉는다.
export const Elev = {
  0: {},
  1: { shadowColor: '#5A4020', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  2: { shadowColor: '#5A4020', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
} as const;
// 카드(홈 세트·가이드·목록 상자·대화 상자·안내)와 캔버스 종이. 검정 없이 따뜻한 선과 부드러운 그림자로 층을 가른다.
export const Card = {
  border: { borderWidth: 1.5, borderColor: T.cardLine },
  shadow: { boxShadow: '0px 3px 0px #EBDDC2' },
  float: { boxShadow: '0px 8px 24px rgba(90, 64, 32, 0.16)' },
} as const;
export const Paper = {
  border: { borderWidth: 1.5, borderColor: T.paperLine },
  shadow: { boxShadow: '0px 6px 18px rgba(90, 64, 32, 0.14)' },
} as const;
export const Pop = {
  border: { borderWidth: T.stroke, borderColor: T.edge },
  shadow: { boxShadow: `3px 3px 0px ${T.edge}` },
  small: { boxShadow: `2px 2px 0px ${T.edge}` },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
} as const;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// 같은 화면 안의 보기 전환은 모두 같은 문법을 쓴다: 배경 없이 굵은 글자와 노란 밑줄.
export function TabBar<K extends string>({ items, value, onChange, testID }: { items: readonly { key: K; label: string; a11y?: string }[]; value: K; onChange: (key: K) => void; testID?: string }) {
  return <View testID={testID} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: T.line }}>
    {items.map(item => { const selected = item.key === value; return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.a11y ?? item.label}
      accessibilityState={{ selected }} onPress={() => onChange(item.key)}
      style={({ pressed }) => ({ flex: 1, minHeight: T.tap, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : 'transparent' })}>
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: selected ? '800' : '600', color: selected ? T.ink : T.muted }}>{item.label}</Text>
      <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 0, height: 3, borderRadius: 2, backgroundColor: selected ? T.accent : 'transparent' }} />
    </Pressable>; })}
  </View>;
}

export function EmptyState({ icon, message, action }: { icon: IconName; message: string; action: React.ReactNode }) {
  return <View style={{ minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: T.gap.sm, padding: T.gap.lg }}>
    <MaterialCommunityIcons name={icon} size={30} color={T.faint} />
    <Text style={{ ...Type.bodySecondary, textAlign: 'center' }}>{message}</Text>
    {action}
  </View>;
}

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
    style={({ pressed }) => {
      const sticker = (kind === 'primary' || kind === 'secondary') && !off;
      return {
        minHeight: kind === 'primary' && !compact ? 52 : T.tap, borderRadius: T.radius.button,
        flexDirection: 'row', gap: T.gap.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: kind === 'ghost' ? T.gap.sm : T.gap.lg,
        backgroundColor: kind === 'primary' ? (off ? '#F4E9C8' : pressed ? T.accentLine : T.accent)
          : kind === 'danger' ? T.dangerSoft
          : kind === 'ghost' ? (pressed ? T.fill : 'transparent')
          : (pressed ? T.fill : T.paper),
        // 절충안(45.39): 노란 주요 버튼만 검정 테두리 + 딱 떨어지는 그림자(눌리면 내려앉는다). 보조 버튼은 카드와 같은 갈색 선.
        borderWidth: kind === 'primary' ? T.stroke : kind === 'secondary' ? 1.5 : 0,
        borderColor: kind === 'primary' ? (off ? T.lineStrong : T.edge) : T.cardLine,
        ...(sticker && kind === 'primary' ? (pressed ? Pop.pressed : Pop.shadow) : {}),
        opacity: off && kind !== 'primary' ? .5 : kind === 'danger' && pressed ? .8 : 1,
      };
    }}>
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
  // 칸의 위아래 hitSlop 이 이 상자 밖으로 나가면 안드로이드가 잘라낸다. 그만큼 안쪽 여백을 둔다.
  return <View testID={testID} style={{ flexDirection: 'row', paddingHorizontal: 3, paddingVertical: dense ? 4 : 2, borderRadius: 14, backgroundColor: T.surface2 }}>
    {items.map(item => { const on = item.key === value;
      return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.a11y ?? item.label} accessibilityState={{ selected: on }} onPress={() => onChange(item.key)}
        hitSlop={{ top: dense ? 4 : 2, bottom: dense ? 4 : 2 }}
        style={{ flex: 1, minHeight: dense ? 40 : 44, borderRadius: 11, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
          backgroundColor: on ? T.paper : 'transparent', borderWidth: on ? T.stroke : 0, borderColor: on ? T.edge : 'transparent' }}>
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
      borderWidth: on ? T.stroke : 1, borderColor: on ? T.edge : T.line, backgroundColor: on ? T.accentSoft : pressed ? T.fill : T.paper })}>
    {!!icon && <MaterialCommunityIcons name={icon} size={16} color={on ? T.ink : T.muted} />}
    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? T.ink : T.muted }}>{label}</Text>
  </Pressable>;
}

// 시트·패널 머리: 제목 하나 + 선택 보조 동작 + 닫기. 모든 패널이 같은 머리를 쓴다.
// 닫기는 언제나 × 하나다(승인 시안) — 판마다 ∨ 와 × 가 섞이지 않게 아이콘을 고를 수 없게 했다(45.36-R1 G7).
// onClose 가 없으면 닫기를 그리지 않는다: 나가는 길이 따로 정해진 판(선택 변형의 취소·적용, 명세 E08)이 같은 머리를 쓰되
// 세 번째 출구를 만들지 않기 위해서다.
export function SheetHeader({ title, onClose, closeLabel, right, left, grab = false }: { title: string; onClose?: () => void; closeLabel?: string; right?: React.ReactNode; left?: React.ReactNode; grab?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: left ? 2 : T.gap.lg, paddingRight: onClose ? 4 : T.gap.lg }}>
    {grab && <View style={{ position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none"><View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: T.line }} /></View>}
    {left}
    <Text numberOfLines={1} style={{ flex: 1, fontSize: 19, ...display, color: T.ink }}>{title}</Text>
    {right}
    {onClose && <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? title + ' 닫기'} onPress={onClose} hitSlop={2}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : 'transparent' })}>
      <MaterialCommunityIcons name="close" size={20} color={T.muted} />
    </Pressable>}
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
// hideLabel: 이름을 옆 글자로 또 적지 않고 접근성 이름으로만 남긴다(굵기 줄처럼 이미 옆에 이름이 있는 자리).
// 가로 조절 막대. 끊기지 않는 비결은 왼쪽 세로 조절대와 같다(45.37):
// ① 손잡이는 이 부품 안의 값(live)으로 **즉시** 따라온다 — 부모가 다시 그려지기를 기다리지 않는다.
// ② 부모에게는 값이 **실제로 바뀌었을 때만**(step 으로 반올림한 값 기준), **화면 한 프레임에 한 번**만 알린다.
//    예전에는 손가락 이벤트마다(초당 100번 넘게, 반올림 전 값이라 매번 '바뀜') 올려서, 편집 화면 전체가 다시 그려지고
//    움직임 미리보기가 매번 처음부터 다시 돌았다 — 사용자가 본 '뚝뚝 끊김'이다.
// ③ 손을 떼는 순간 마지막 값을 반드시 한 번 올린 뒤 onActive(false) 를 부른다. 늦게 반영하는 타이머는 없다.
// ④ 좌표는 누를 때 막대의 화면 위치를 잡고(pageX − locationX) 그다음부터 화면 좌표만 쓴다 — 손가락이 막대 밖으로 나가도 튀지 않는다.
const nextFrame: (f: () => void) => unknown = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(f, 16);
export function Range({ label, hideLabel, value, min, max, step, onChange, display, format, testID, onActive }: { label?: string; hideLabel?: boolean; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; display?: string; format?: (n: number) => string; testID?: string; onActive?: (active: boolean) => void }) {
  const [width, setWidth] = React.useState(0);
  const [live, setLive] = React.useState<number | null>(null);
  const origin = React.useRef(0), sent = React.useRef<number | null>(null), pending = React.useRef(false), latest = React.useRef<number | null>(null);
  const shown = live ?? value;
  const ratio = Math.max(0, Math.min(1, (shown - min) / (max - min || 1)));
  // 한 칸: 정해 두지 않으면 범위의 1/100. 부모에게는 이 칸이 바뀔 때만 알린다.
  const unit = step ?? (max - min) / 100;
  const snap = (n: number) => Math.max(min, Math.min(max, Math.round((n - min) / unit) * unit + min));
  const flush = () => { pending.current = false; const n = latest.current; if (n !== null && n !== sent.current) { sent.current = n; onChange(n); } };
  const at = (pageX: number) => {
    if (width <= 0) return;
    const n = snap(min + Math.max(0, Math.min(1, (pageX - origin.current) / width)) * (max - min));
    latest.current = n; setLive(n);
    if (!pending.current) { pending.current = true; nextFrame(flush); }
  };
  const settle = () => { flush(); latest.current = null; setLive(null); onActive?.(false); };
  // 스크린 리더는 자리를 누르지 않고 한 걸음을 요청한다. 한 걸음은 따로 정하지 않으면 범위의 1/20.
  const nudge = (by: number) => {
    const jump = step ?? (max - min) / 20;
    onChange(Math.max(min, Math.min(max, value + by * jump)));
  };
  const shownText = live !== null && format ? format(live) : display;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
    {!!label && !hideLabel && <Text style={{ width: 40, fontSize: 12, fontWeight: '600', color: T.muted }}>{label}</Text>}
    <View testID={testID} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'increment') nudge(1); if (e.nativeEvent.actionName === 'decrement') nudge(-1); }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={e => {
        // pageX 가 없는 이벤트(일부 모의 환경)에서는 기준점을 0 으로 두어 locationX 를 그대로 쓴다.
        const px = e.nativeEvent.pageX ?? e.nativeEvent.locationX;
        // 중복 거르기는 한 번의 조작 안에서만 한다. 부모 값은 엔진이 되돌려줄 때까지 늦을 수 있어 기준으로 쓰지 않는다.
        origin.current = px - e.nativeEvent.locationX; sent.current = null; onActive?.(true); at(px); flush();
      }}
      onResponderMove={e => at(e.nativeEvent.pageX ?? e.nativeEvent.locationX)}
      onResponderRelease={e => { if (e?.nativeEvent) at(e.nativeEvent.pageX ?? e.nativeEvent.locationX); settle(); }} onResponderTerminate={settle}
      style={{ flex: 1, height: 44, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: T.line, overflow: 'hidden' }}>
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: T.accent }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${ratio * 100}%`, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: live !== null ? T.accent : '#FFF', borderWidth: T.stroke, borderColor: T.edge }} />
    </View>
    {!!shownText && <Text accessibilityLabel={label ? label + ' 값' : undefined} style={{ minWidth: 42, fontSize: 12, color: T.muted, textAlign: 'right' }}>{shownText}</Text>}
  </View>;
}
// PRO 표시는 한 가지 모양뿐이다: 옅은 바탕의 작은 글자. 누르는 버튼(노랑)처럼 보이지 않게, 경고처럼 튀지 않게.
export function ProTag() {
  return <View style={{ paddingHorizontal: 6, height: 18, borderRadius: 6, backgroundColor: T.proSoft, justifyContent: 'center' }}>
    <Text style={{ fontSize: 10, fontWeight: '800', color: T.pro, letterSpacing: .4 }}>PRO</Text>
  </View>;
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#1716144D', justifyContent: 'center', padding: 20 }}>
    <View accessibilityViewIsModal style={{ maxHeight: '82%', backgroundColor: C.paper, borderRadius: T.radius.xl, paddingHorizontal: T.gap.xl, paddingTop: T.gap.md, paddingBottom: T.gap.xl, gap: T.gap.sm, ...Card.border, ...Card.float }}>
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
  card: { padding: T.gap.lg, gap: T.gap.sm, backgroundColor: C.paper, borderRadius: T.radius.lg, borderWidth: 1.5, borderColor: C.cardLine, boxShadow: '0px 3px 0px #EBDDC2' },
  title: { fontSize: 26, fontFamily: Font.display, fontWeight: '400', color: C.ink },
  subtitle: { fontSize: 20, fontFamily: Font.display, fontWeight: '400', color: C.ink },
  label: { fontSize: 13, fontWeight: '700', color: C.muted },
  input: { fontSize: 16, minHeight: T.tap, borderWidth: 1.5, borderColor: C.lineStrong, borderRadius: T.radius.sm, padding: T.gap.md, backgroundColor: '#FFFFFF', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: C.muted, fontSize: 16, lineHeight: 24 },
});
