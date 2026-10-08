// 아래 탭 막대(2026-10-08 토스식 개편 · 캔버스 T-Home/T-Contest/T-My). 첫 화면 세 갈래: 홈 · 공모전 · 내 정보.
// 세트를 연 뒤(보드·그리기·내보내기)에는 보이지 않는다 — 그 화면들은 위쪽 '뒤로'로 돌아온다.
// 고른 탭은 아이콘 면을 채우고 글자를 굵게, 나머지는 옅은 선·글자. 누르는 자리는 칸 전체(높이 64).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ImtiIcon, IconSize, type IconName } from '../design/icons';
import { T } from './ui';

export type HomeTab = 'home' | 'contest' | 'my';
const TABS: { key: HomeTab; label: string; icon: IconName }[] = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'contest', label: '공모전', icon: 'contest' },
  { key: 'my', label: '내 정보', icon: 'person' },
];
export function TabBar({ value, onChange, bottomInset = 0 }: { value: HomeTab; onChange: (tab: HomeTab) => void; bottomInset?: number }) {
  return <View testID="아래 탭" accessibilityRole="tablist" style={{ flexDirection: 'row', height: 64 + bottomInset, paddingBottom: bottomInset, backgroundColor: T.paper, borderTopWidth: 1, borderColor: T.line }}>
    {TABS.map(t => { const on = t.key === value;
      return <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onChange(t.key)}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: pressed ? T.fill : 'transparent' })}>
        <ImtiIcon name={t.icon} size={IconSize.tab} color={on ? T.ink : T.faint} filled={on} />
        <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? T.ink : T.muted }}>{t.label}</Text>
      </Pressable>; })}
  </View>;
}
