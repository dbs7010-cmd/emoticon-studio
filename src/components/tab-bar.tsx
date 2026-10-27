// 아래 탭 막대(2026-10-14 시안 Z · 사용자 확정). 첫 화면 네 갈래: 홈 · 강좌 · 공모전 · 내 정보.
// 세트를 연 뒤(보드·그리기·내보내기)에는 보이지 않는다 — 그 화면들은 위쪽 '뒤로'로 돌아온다.
// 모양: 바닥에서 살짝 뜬 따뜻한 흰 알약(클레이 그림자). 고른 탭만 옅은 보라 알약 + 보라 글자, 나머지는 옅은 회색.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ImtiIcon, IconSize, type IconName } from '../design/icons';
import { t } from '../i18n/index';
import { T, Clay } from './ui';

export type HomeTab = 'home' | 'class' | 'contest' | 'my';
const TABS: { key: HomeTab; label: string; icon: IconName }[] = [
  { key: 'home', label: t('tab.home'), icon: 'home' },
  { key: 'class', label: t('tab.class'), icon: 'guide' },
  { key: 'contest', label: t('tab.contest'), icon: 'contest' },
  { key: 'my', label: t('tab.my'), icon: 'person' },
];
export function TabBar({ value, onChange, bottomInset = 0 }: { value: HomeTab; onChange: (tab: HomeTab) => void; bottomInset?: number }) {
  return <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 + bottomInset, backgroundColor: T.bg }}>
    <View testID="아래 탭" accessibilityRole="tablist" style={{ flexDirection: 'row', height: 62, borderRadius: 31, paddingHorizontal: 6, ...Clay.nav }}>
      {TABS.map(t => { const on = t.key === value;
        return <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onChange(t.key)}
          style={({ pressed }) => ({ flex: 1, marginVertical: 7, marginHorizontal: 2, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2,
            backgroundColor: on ? T.pointSoft : pressed ? T.fill : 'transparent', transform: pressed ? [{ scale: .96 }] : [] })}>
          <ImtiIcon name={t.icon} size={IconSize.row} color={on ? T.point : T.faint} filled={on} />
          <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? T.pointInk : T.muted }}>{t.label}</Text>
        </Pressable>; })}
    </View>
  </View>;
}
