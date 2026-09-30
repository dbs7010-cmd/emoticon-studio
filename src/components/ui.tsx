import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, Modal, Pressable, ScrollView, ActivityIndicator, Animated, type ImageSourcePropType } from 'react-native';
import { ImtiIcon, IconSize } from '../design/icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUri } from '../services/storage';
import { ASSET_SLOTS, type AssetSlotName } from '../design/asset-slots';
import type { LocalImage } from '../types';

// ── 임티제작소 디자인 토큰 · 45.42 WHITE BASE (사용자 확정 2026-09-28) ─────────────────────────────────
// 색은 네 가지 역할뿐이다: WHITE(바탕) · INK(글자·선·검정 테두리) · NEUTRAL(가라앉은 면·선·누름) · MAKER YELLOW.
// · 사용자의 이모티콘이 화면에서 가장 화려해야 한다. UI 는 흰색과 중립색으로 물러선다.
// · 노랑(#FFCC2E)은 주 행동 · 선택 · 진행 · 브랜드 순간에만. 한 화면의 주인공 노랑은 하나.
// · 초록(success)은 저장 성공 같은 '정말 성공한 순간'에만 제한적으로. PRO 는 색 세계관을 따로 두지 않는다(보라 없음) —
//   배지·아이콘·구성으로 표현한다. pro·proSoft 이름은 남겨 두되 잉크·중립 값을 가리킨다.
// · 검정 2px 테두리(+ Pop 그림자)는 '누를 노란 버튼'과 '지금 고른 것'에만(45.39 절충안 유지). 카드·캔버스는 옅은 중립 선.
// · 글자 대비: 읽는 글자는 ink(16.8) 또는 muted(흰 5.8 · 가라앉은 면 5.3 · 누름 5.1 · 누름 진함 4.6 · 옅은 노랑 5.2) — 모두 4.5:1 이상.
//   faint(흰 3.3)는 비활성 표시(WCAG 1.4.3 예외)와 장식 화살표에만 쓴다.
// · 노랑 위 글자는 언제나 잉크(흰 글씨 금지). 노랑을 글자색으로 쓰지 않는다.
// 이 앱은 카카오 이모티콘 제출을 돕지만 카카오가 만든 앱이 아니다. 카카오의 노랑(#FEE500)·로고·캐릭터·화면 구성을 따라 하지 않는다.
export const T = {
  bg: '#FFFFFF',            // 앱 바탕 — 흰색
  paper: '#FFFFFF',         // 카드·패널 표면
  surface2: '#F6F5F2',      // 가라앉은 면 — 캔버스 바깥·세그먼트 바탕·빈 칸·보조 카드
  warm: '#F6F5F2',          // (45.39 크림 제안 면) → 가라앉은 면과 같게
  ink: '#1F1D1A',           // 본문·아이콘·검정 테두리
  muted: '#6B655E',         // 보조 설명
  faint: '#948D84',         // 비활성 표시와 장식(화살표·구분 기호) 전용 — 읽어야 하는 글자에는 쓰지 않는다(흰 면 3.3:1). 글자는 muted
  line: '#ECE9E3',          // 구분선
  lineStrong: '#DCD7CE',
  accent: '#FFCC2E',        // MAKER YELLOW — 주 행동과 고른 것
  accentLine: '#E6AE00',    // 노랑 눌림
  accentSoft: '#FFF4CC',    // 옅은 노랑(목록형 선택 · 진행 표시의 부드러운 면)
  accentInk: '#1F1D1A',     // 노랑 위 글자
  accentBorder: '#1F1D1A',  // 고른 면의 가장자리 — 검정 테두리와 같은 잉크
  warmLine: '#ECE9E3',      // (45.39 크림 선) → 중립 선
  warmInk: '#6B655E',       // (45.39 크림 위 글자) → muted
  floating: '#FFFFFFF7',
  yellow: '#FFCC2E',
  fill: '#F2F0EC', fillPressed: '#E8E5DF',   // 누름
  success: '#1E8E5A', successSoft: '#E3F4EA', // 저장 성공 등 성공 순간에만
  warning: '#9A5B00', warningSoft: '#FFEACC',
  danger: '#B42318', dangerSoft: '#FCE3DF',
  info: '#3D4FC4', infoSoft: '#E9E5FF',
  pro: '#1F1D1A', proSoft: '#F6F5F2',         // PRO 는 보라 없이 잉크·중립으로(배지 모양이 구분한다)
  edge: '#1F1D1A', stroke: 2,                // 검정 테두리 — 노란 버튼·고른 것에만
  cardLine: '#ECE9E3', paperLine: '#DCD7CE', // 카드·캔버스의 옅은 중립 선
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, chip: 10, button: 14, card: 20 },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  tap: 48, // 편한 손가락 자리 — 아이콘 크기(22/18/14)와 따로 둔다
};
// 상태 토큰(45.42). 화면마다 제각각이던 누름·선택·비활성·성공 표시를 한 벌로 모은다.
// 비활성은 **색만** 옅게 한다(투명도로 흐리지 않는다). 실제 비활성 동작(disabled)과 accessibilityState 는 각 버튼이 그대로 갖는다.
export const S = {
  pressed: { backgroundColor: T.fill },
  selected: { backgroundColor: T.accent, borderColor: T.edge },   // 도구·탭형 선택: 노란 면 + 잉크(테두리 2px 는 도구 줄만)
  selectedSoft: { backgroundColor: T.accentSoft },                // 목록형 선택(브러시 줄·레이어 줄)
  disabledInk: T.faint,                                           // 비활성 글자·아이콘 색
  success: { color: T.success, backgroundColor: T.successSoft },
} as const;
// 짧은 반응 시간(ms). 0.1~0.3초 — 동작 결과를 바로 알게 할 만큼만.
export const Motion = { press: 100, pop: 280, rise: 240 } as const;
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
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: T.muted },
} as const;

// 그림자. 층을 가르는 부드러운 그림자(Elev)와, 스티커처럼 붙은 주요 표면의 딱 떨어지는 그림자(Pop) 두 가지.
//   Elev 0: 평평한 바탕 · 1: 카드·누르는 표면 · 2: 떠 있는 dock·시트
//   Pop: 2px 테두리와 함께 쓴다(주요 버튼·카드·캔버스·고른 것). 눌리면 그림자를 거두고 그만큼 내려앉는다.
export const Elev = {
  0: {},
  1: { shadowColor: '#1F1D1A', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  2: { shadowColor: '#1F1D1A', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
} as const;
// 카드(홈 세트·가이드·목록 상자·대화 상자·안내)와 캔버스 종이. 검정 없이 옅은 중립 선과 부드러운 그림자로 층을 가른다.
export const Card = {
  border: { borderWidth: 1, borderColor: T.cardLine },
  shadow: { boxShadow: '0px 1px 2px rgba(31, 29, 26, 0.05), 0px 8px 24px rgba(31, 29, 26, 0.07)' },
  float: { boxShadow: '0px 8px 24px rgba(31, 29, 26, 0.14)' },
} as const;
export const Paper = {
  border: { borderWidth: 1, borderColor: T.paperLine },
  shadow: { boxShadow: '0px 6px 18px rgba(31, 29, 26, 0.10)' },
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

// 빈 상태(45.42 S3). 두 모양이 있다.
// · 작은 빈 목록(예전 모양): icon + message + action — 패널 안의 빈 목록(참고 사진 등).
// · 첫 화면 빈 상태(새 모양): title 을 주면 가라앉은 면 위에 그림(art) · 제목 한 줄 · 설명 한 줄 · 노란 행동 하나,
//   그리고 선택으로 '그리기 › 움직이기 › 내보내기' 흐름 아이콘. 노란 행동은 화면에 하나뿐이다.
export function EmptyState(props: { icon: IconName; message: string; action: React.ReactNode } | {
  title: string; body: string; actionLabel: string; onAction: () => void; art?: React.ReactNode; flow?: boolean; testID?: string }) {
  if ('title' in props) {
    const { title, body, actionLabel, onAction, art, flow, testID } = props;
    return <View testID={testID} style={{ backgroundColor: T.surface2, borderRadius: T.radius.card, paddingHorizontal: T.gap.xl, paddingVertical: T.gap.xxl, alignItems: 'center', gap: T.gap.md }}>
      {art}
      <View style={{ alignItems: 'center', gap: T.gap.xs }}>
        <Text accessibilityRole="header" style={{ ...Type.sectionTitle, textAlign: 'center' }}>{title}</Text>
        <Text style={{ ...Type.bodySecondary, textAlign: 'center' }}>{body}</Text>
      </View>
      <Action primary title={actionLabel} onPress={onAction} icon="plus" />
      {flow && <View testID="흐름 아이콘" accessible accessibilityLabel="그리기, 움직이기, 내보내기 순서" style={{ flexDirection: 'row', alignItems: 'center', gap: T.gap.sm }}>
        {([['brush', '그리기'], ['motion', '움직이기'], ['export', '내보내기']] as const).map(([name, label], i) => <React.Fragment key={name}>
          {i > 0 && <ImtiIcon name="next" size={IconSize.meta} color={T.faint} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ImtiIcon name={name} size={IconSize.meta} color={T.muted} /><Text style={{ ...Type.caption, color: T.muted }}>{label}</Text></View>
        </React.Fragment>)}
      </View>}
    </View>;
  }
  const { icon, message, action } = props;
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
// ── 45.42 S3 공통 상태 부품 ────────────────────────────────────────────────────────────────
// 선택·비활성 규칙(한 벌). 선택은 아이콘이 아니라 담는 면이 말한다: 도구·탭 = 노란 면 + 잉크 테두리, 목록 = 옅은 노랑 면.
// 비활성은 색만 옅게 — 투명도로 흐리지 않고, 실제 disabled 와 accessibilityState 는 부르는 버튼이 그대로 갖는다.
export function selectedFace(on: boolean, kind: 'tool' | 'list' = 'tool') {
  if (!on) return { backgroundColor: 'transparent', borderColor: 'transparent' };
  return kind === 'tool' ? { ...S.selected } : { ...S.selectedSoft, borderColor: 'transparent' };
}
export const inkFor = (disabled?: boolean) => (disabled ? S.disabledInk : T.ink);

// 짧은 반응(0.24~0.28초). Animated 네이티브 구동(transform · opacity 만). 보간을 쓰지 않고 값 자체를 움직인다.
// pop  = 0.6 배에서 튀어 오르며 나타남(완성 체크) · rise = 12 아래에서 올라오며 나타남(저장 알림)
export function useMicro(kind: 'pop' | 'rise', play = true) {
  const scale = React.useRef(new Animated.Value(kind === 'pop' ? .6 : 1)).current;
  const lift = React.useRef(new Animated.Value(kind === 'rise' ? 12 : 0)).current;
  const fade = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!play) return;
    const ms = kind === 'pop' ? Motion.pop : Motion.rise;
    const out = (x: number) => 1 - Math.pow(1 - x, 3);
    const back = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);   // 살짝 넘쳤다 돌아오는 끝
    const a = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: ms, easing: out, useNativeDriver: true }),
      kind === 'pop' ? Animated.timing(scale, { toValue: 1, duration: ms, easing: back, useNativeDriver: true })
        : Animated.timing(lift, { toValue: 0, duration: ms, easing: out, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [play, kind, scale, lift, fade]);
  return { opacity: fade, transform: kind === 'pop' ? [{ scale }] : [{ translateY: lift }] };
}

// 저장 알림: 흰 알약 + 초록 체크 + 칸 번호 + 잉크 '다음 칸'. 경고창처럼 보이지 않게 — 노랑·빨강을 쓰지 않는다.
export function SaveToast({ slot, onNext, nextLabel = '다음 칸', message }: { slot: number; onNext?: () => void; nextLabel?: string; message?: string }) {
  const rise = useMicro('rise');
  const text = message ?? `${slot}번 칸 저장됨`;
  return <Animated.View testID="저장 알림" accessibilityLiveRegion="polite" accessibilityLabel={text}
    style={[{ flexDirection: 'row', alignItems: 'center', gap: T.gap.sm, minHeight: T.tap, paddingLeft: T.gap.md, paddingRight: onNext ? 6 : T.gap.lg,
      borderRadius: 999, backgroundColor: T.paper, ...Card.border, ...Card.float }, rise]}>
    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="check" size={IconSize.meta} color={T.paper} /></View>
    <Text numberOfLines={1} style={{ ...Type.button, color: T.ink, flexShrink: 1 }}>{text}</Text>
    {!!onNext && <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} onPress={onNext} hitSlop={6}
      style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: T.gap.md, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: pressed ? '#3A3632' : T.ink })}>
      <Text style={{ ...Type.button, fontSize: 13, color: T.paper }}>{nextLabel}</Text><ImtiIcon name="next" size={IconSize.meta} color={T.paper} />
    </Pressable>}
  </Animated.View>;
}

// 완성 카드: 흰 카드 + 튀어 오르는 노란 체크 + 'N칸 완성!' + 작품 격자(children) + 노란 행동 하나.
export function CompleteCard({ total, children, actionLabel, onAction, testID = '완성 카드' }: { total: number; children?: React.ReactNode; actionLabel: string; onAction: () => void; testID?: string }) {
  const pop = useMicro('pop');
  return <View testID={testID} style={{ backgroundColor: T.paper, borderRadius: T.radius.card, padding: T.gap.xl, gap: T.gap.lg, alignItems: 'center', ...Card.border, ...Card.shadow }}>
    <Animated.View testID="완성 체크" style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: T.accent, borderWidth: T.stroke, borderColor: T.edge, alignItems: 'center', justifyContent: 'center' }, pop]}>
      <ImtiIcon name="check" size={IconSize.tool} />
    </Animated.View>
    <Text accessibilityRole="header" style={{ ...Type.screenName, textAlign: 'center' }}>{total}칸 완성!</Text>
    {children}
    <View style={{ alignSelf: 'stretch' }}><Action primary title={actionLabel} onPress={onAction} /></View>
  </View>;
}

// PRO 배지(45.42): 보라 없이 잉크 테두리 + 반짝 아이콘 + 글자. 산 뒤(owned)에는 잉크 면 + 흰 글자로 '지금 PRO' 임을 구분한다.
// 누를 수 있으면 누르는 자리는 48dp.
export function ProBadge({ onPress, label = 'PRO 이용', text = 'PRO', owned }: { onPress?: () => void; label?: string; text?: string; owned?: boolean }) {
  const ink = owned ? T.paper : T.ink;
  const face = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: T.stroke, borderColor: T.edge, backgroundColor: owned ? T.ink : T.paper }}>
    <ImtiIcon name="pro" size={IconSize.meta} color={ink} /><Text style={{ fontSize: 12, fontWeight: '800', color: ink, letterSpacing: .2 }}>{text}</Text>
  </View>;
  if (!onPress) return <View accessible accessibilityLabel={owned ? 'PRO 이용 중' : text}>{face}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!owned }} onPress={onPress}
    style={({ pressed }) => ({ minHeight: T.tap, minWidth: T.tap, alignItems: 'center', justifyContent: 'center', transform: pressed ? [{ scale: .96 }] : [] })}>{face}</Pressable>;
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
  return <View style={{ gap: flat ? 2 : 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }, flat && { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 2, minHeight: 44 }, flat && multiline && { minHeight: 44 }]} placeholder={`${label} 입력`} placeholderTextColor={T.muted} /></View>;
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
