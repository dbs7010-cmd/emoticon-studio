import { t } from '../i18n/index';
// App-only appearance, composed from the established UI primitives.
// Painter and motion controls continue importing ./ui unchanged (user scope, 2026-10-28).
import React from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { ImtiIcon, IconSize } from '../design/icons';
import * as Base from './ui';
import { Glyph, SheetHeader } from './ui';
import type { SegmentItem, ButtonVariant } from './ui';
export * from './ui';
type IconName = React.ComponentProps<typeof Glyph>['name'];
export const T = { ...Base.T, surface2: '#F6F6F8', warm: '#F6F6F8', fill: '#F6F6F8', fillPressed: '#EFEDF3',
  radius: { xs: 6, sm: 8, md: 10, lg: 12, xl: 16, chip: 8, button: 8, card: 12 } };
const C = T;
export const S = { ...Base.S, pressed: { backgroundColor: T.fill } } as const;
const systemTitle = ({ fontFamily: _family, ...style }: { fontFamily?: string; [key: string]: unknown }) => ({ ...style, fontWeight: '700' as const });
export const Type = { ...Base.Type, screenTitle: systemTitle(Base.Type.screenTitle), screenName: systemTitle(Base.Type.screenName), sectionTitle: systemTitle(Base.Type.sectionTitle) };
export const Elev = { 0: {}, 1: {}, 2: { boxShadow: '0px 4px 16px rgba(25, 31, 40, 0.08)' } } as const;
export const Card = { ...Base.Card, shadow: { boxShadow: 'none' }, float: Elev[2] } as const;
export const Clay = { card: { backgroundColor: T.paper, boxShadow: 'none' }, small: { backgroundColor: T.paper, boxShadow: 'none' },
  yellow: { backgroundColor: T.accentSoft, boxShadow: 'none' }, button: { boxShadow: 'none' },
  buttonPressed: { boxShadow: 'none', opacity: .82 }, nav: { backgroundColor: T.paper, boxShadow: 'none' } } as const;
export const Pop = { border: { borderWidth: 1, borderColor: T.lineStrong }, shadow: { boxShadow: 'none' }, small: { boxShadow: 'none' }, pressed: { opacity: .8 } } as const;
export const styles = StyleSheet.create({ ...Base.styles, card: { ...Base.styles.card, borderRadius: T.radius.card, boxShadow: 'none' } });
export function Action({ title, onPress, disabled = false, primary = false, busy = false, danger = false, icon, variant, compact = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean; busy?: boolean; danger?: boolean; icon?: IconName; variant?: ButtonVariant; compact?: boolean }) {
  const kind: ButtonVariant = variant ?? (primary ? 'primary' : danger ? 'danger' : 'secondary');
  const off = disabled || busy;
  const tint = kind === 'primary' ? T.accentInk : kind === 'danger' ? T.danger : T.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: off, busy }} disabled={off} onPress={onPress}
    style={({ pressed }) => {
      const big = kind === 'primary' && !compact;
      return {
        minHeight: big ? 52 : T.tap, borderRadius: T.radius.button,
        flexDirection: 'row', gap: T.gap.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: kind === 'ghost' ? T.gap.sm : T.gap.lg,
        backgroundColor: kind === 'primary' ? (off ? '#F6EDC6' : T.accent)
          : kind === 'danger' ? T.dangerSoft
          : kind === 'ghost' ? (pressed ? T.fill : 'transparent')
          : (pressed ? T.fillPressed : T.fill),
        // App-only flat button. Painter keeps the original Action from ./ui.
        borderWidth: 0,
        ...(kind === 'primary' && !off ? (pressed ? Clay.buttonPressed : Clay.button) : null),
        opacity: off && kind !== 'primary' ? .5 : kind === 'danger' && pressed ? .8 : 1,
      };
    }}>
    {busy && <ActivityIndicator size="small" color={kind === 'primary' ? T.accentInk : T.muted} />}
    {!busy && !!icon && <Glyph name={icon} size={18} color={off && kind === 'primary' ? T.faint : tint} />}
    <Text numberOfLines={1} style={{ ...Type.button, fontSize: kind === 'primary' && !compact ? 16 : 14, fontWeight: kind === 'primary' ? '800' : '700', color: off && kind === 'primary' ? T.faint : tint }}>{title}</Text>
  </Pressable>;
}

// 아이콘만 있는 버튼. 보이는 아이콘은 작아도 누르는 자리는 48dp 다. 아이콘 둘레에 카드를 두르지 않는다.

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
        {([['brush', t('ui.draw')], ['motion', t('ui.motion')], ['export', t('ui.export')]] as const).map(([name, label], i) => <React.Fragment key={name}>
          {i > 0 && <ImtiIcon name="next" size={IconSize.meta} color={T.faint} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ImtiIcon name={name} size={IconSize.meta} color={T.muted} /><Text style={{ ...Type.caption, color: T.muted }}>{label}</Text></View>
        </React.Fragment>)}
      </View>}
    </View>;
  }
  const { icon, message, action } = props;
  return <View style={{ minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: T.gap.sm, padding: T.gap.lg }}>
    <Glyph name={icon} size={30} color={T.faint} />
    <Text style={{ ...Type.bodySecondary, textAlign: 'center' }}>{message}</Text>
    {action}
  </View>;
}

// 사용자에게 보여 줄 오류 문장. 우리가 쓴 한국어 문장은 그대로, 기술 오류(영문·코드·경로)는 일반 문장으로 바꾼다.
// 원문은 개발 로그로만 남긴다 — 화면에는 "Error:"·파일 경로·JSON 같은 말이 나오지 않는다.

export function Segmented<K extends string>({ items, value, onChange, testID, dense }: { items: SegmentItem<K>[]; value: K | null; onChange: (key: K) => void; testID?: string; dense?: boolean }) {
  // 칸의 위아래 hitSlop 이 이 상자 밖으로 나가면 안드로이드가 잘라낸다. 그만큼 안쪽 여백을 둔다.
  return <View testID={testID} style={{ flexDirection: 'row', paddingHorizontal: 4, paddingVertical: dense ? 4 : 2, borderRadius: 22, ...Clay.small }}>
    {items.map(item => { const on = item.key === value;
      return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.a11y ?? item.label} accessibilityState={{ selected: on }} onPress={() => onChange(item.key)}
        hitSlop={{ top: dense ? 4 : 2, bottom: dense ? 4 : 2 }}
        style={{ flex: 1, minHeight: dense ? 40 : 44, borderRadius: 18, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
          backgroundColor: on ? T.pointSoft : 'transparent' }}>
        {!!item.image && <Image source={item.image} style={{ width: 13, height: 18, opacity: on ? 1 : .7 }} resizeMode="contain" />}
        {!!item.icon && <Glyph name={item.icon} size={16} color={on ? T.pointInk : T.muted} />}
        <Text numberOfLines={1} style={{ fontSize: dense ? 13 : 14, fontWeight: on ? '800' : '600', color: on ? T.pointInk : T.muted }}>{item.label}</Text>
      </Pressable>; })}
  </View>;
}

// 칩: 짧은 선택지 여러 개. 고르면 옅은 노랑, 아니면 흰 표면. 테두리는 1px 하나.

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // 2026-10-08 토스식 개편: 가운데 상자 대신 아래에서 올라오는 시트(손잡이 · 큰 제목 · 닫기). 내용과 동작은 그대로.
  return <Modal transparent animationType="slide" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(25, 31, 40, 0.32)', justifyContent: 'flex-end' }}>
    <Pressable accessibilityElementsHidden importantForAccessibility="no" style={{ flex: 1 }} onPress={onClose} />
    <View accessibilityViewIsModal style={{ maxHeight: '86%', backgroundColor: C.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: T.gap.xl, paddingTop: 10, paddingBottom: 28, gap: T.gap.sm }}>
      <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.lineStrong }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.subtitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('ui.close')} onPress={onClose} style={{ width: T.tap, height: T.tap, marginRight: -12, alignItems: 'center', justifyContent: 'center' }}><Glyph name="close" size={20} color={T.muted} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>
    </View>
  </View></Modal>;
}

export function Field({ label, value, onChangeText, multiline = true, flat = false }: { label: string; value: string; onChangeText: (s: string) => void; multiline?: boolean; flat?: boolean }) {
  return <View style={{ gap: flat ? 2 : 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }, flat && { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 2, minHeight: 44 }, flat && multiline && { minHeight: 44 }]} placeholder={`${label} 입력`} placeholderTextColor={T.muted} /></View>;
}
