import { t } from '../i18n/index';
// 애니메이션 탭(2026-10-15 · 시안 F2/F4, 사용자 확정): 그림 전체를 장마다 따로 그려 움직이게 한다.
// - 장이 없으면: 시작 버튼 하나와 강좌로 가는 길(초보용). 묶음 고르기는 두지 않는다(2026-10-15 사용자).
// - 장이 있으면: 장 줄(썸네일·번호·시간) → 고른 장의 시간 · 순서 · 삭제 → '이 장 그리기'(그리기 탭으로) · 앞 장 비춰 보기.
// - 무료는 3장까지, PRO 는 24장(카카오 규격 상한). 장을 바꾸면 되돌리기 기록은 새로 시작한다(엔진).
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { T, Clay, ProTag, Glyph } from '../components/ui';
import { ImtiIcon, IconSize } from '../design/icons';
import { ANIM_FREE_FRAMES, ANIM_MAX_FRAMES } from '../types';

const C = T;
const DURATIONS = [.1, .2, .3, .5, .8, 1] as const;

type Props = {
  frames: { id: string; duration: number }[] | null; index: number; onion: boolean; pro: boolean; playing: boolean;
  thumbs: Record<string, string>; hint: string | null;
  onStart: () => void; onLessons?: () => void; onSelect: (i: number) => void; onAdd: () => void; onDelete: (i: number) => void;
  onDuration: (i: number, d: number) => void; onMove: (from: number, to: number) => void; onOnion: (on: boolean) => void;
  onOff: () => void; onDraw: () => void; onPlay: (on: boolean) => void; onRequestPro: () => void;
};
export function AnimPanel(p: Props) {
  const n = p.frames?.length ?? 0;
  const limit = p.pro ? ANIM_MAX_FRAMES : ANIM_FREE_FRAMES;
  const head = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
    <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{t("ui.animation")}</Text>
    <View style={{ height: 22, paddingHorizontal: 9, borderRadius: 11, backgroundColor: C.accentSoft, justifyContent: 'center' }}><Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>{t("release.d139", { v0: (ANIM_FREE_FRAMES) })}</Text></View>
    <Text style={{ flex: 1, fontSize: 11, color: C.muted }}>{t("release.d140", { v0: (ANIM_MAX_FRAMES) })}</Text>
  </View>;
  // 장이 없을 때: 설명 한 줄 · 시작 버튼 하나 · 초보를 위한 강좌 길(2026-10-15 사용자: 묶음 고르기는 두지 않는다).
  if (!p.frames) return <ScrollView testID="애니메이션 시작" contentContainerStyle={{ padding: 16, gap: 14 }}>
    {head}
    <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink, paddingHorizontal: 2 }}>{t("release.s0942")}</Text>
    <Text style={{ fontSize: 13, lineHeight: 19, color: C.muted, paddingHorizontal: 2, marginTop: -8 }}>{t("release.s0943")}</Text>
    <Pressable testID="애니메이션 시작하기" accessibilityRole="button" accessibilityLabel={t("lesson.text031")} onPress={p.onStart}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.accentInk }}>{t("lesson.text031")}</Text>
    </Pressable>
    {!!p.onLessons && <Pressable accessibilityRole="link" accessibilityLabel={t("release.s0945")} onPress={p.onLessons}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: 20, ...Clay.card, transform: pressed ? [{ scale: .98 }] : [] })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.pointSoft, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="guide" size={IconSize.row} color={C.point} /></View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>{t("release.s0945")}</Text>
      <ImtiIcon name="next" size={IconSize.row} color={C.faint} />
    </Pressable>}
  </ScrollView>;

  const cur = p.frames[p.index];
  const canAdd = n < limit;
  return <ScrollView testID="애니메이션 장" contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>{head}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={p.playing ? t("release.s0947") : t("release.s0948")} onPress={() => p.onPlay(!p.playing)}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.playing ? C.pointSoft : C.accent, ...(p.playing ? {} : pressed ? Clay.buttonPressed : Clay.button) })}>
        <Glyph name={p.playing ? 'pause' : 'play'} size={20} color={p.playing ? C.point : C.ink} />
      </Pressable>
    </View>
    {!!p.hint && <Text testID="애니메이션 안내" style={{ fontSize: 12, lineHeight: 18, color: C.pointInk, paddingHorizontal: 2 }}>{p.hint}</Text>}
    {/* 장 줄 */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 8 }}>
      {p.frames.map((f, i) => { const on = i === p.index;
        return <Pressable key={f.id} testID={t("release.s0950") + " " + (i + 1)} accessibilityRole="button" accessibilityLabel={t("release.d141", { v0: (i + 1), v1: (f.duration) })} accessibilityState={{ selected: on }} onPress={() => p.onSelect(i)}
          style={{ width: 64, alignItems: 'center', gap: 3 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            ...(on ? { backgroundColor: C.pointSoft, boxShadow: `inset 0px 0px 0px 2px ${C.point}` } : Clay.small) }}>
            {p.thumbs[f.id] ? <Image source={{ uri: p.thumbs[f.id] }} style={{ width: 56, height: 56 }} /> : <Text style={{ fontSize: 13, color: C.faint }}>{i + 1}</Text>}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: on ? C.pointInk : C.ink }}>{i + 1}{t("release.s0950")}</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>{f.duration}{t("release.s0899")}</Text>
        </Pressable>; })}
      <Pressable testID="장 추가" accessibilityRole="button" accessibilityLabel={canAdd ? t("release.s0952") : n >= ANIM_MAX_FRAMES ? t("release.s0953") : t("release.s0954")}
        onPress={() => canAdd ? p.onAdd() : n < ANIM_MAX_FRAMES ? p.onRequestPro() : undefined}
        style={{ width: 64, alignItems: 'center', gap: 3 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.lineStrong }}>
          <ImtiIcon name="plus" size={IconSize.tool} color={C.muted} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{t("release.s0951")}</Text>
        {!canAdd && n < ANIM_MAX_FRAMES ? <ProTag /> : <Text style={{ fontSize: 11, color: C.faint }}>{`${n}/${limit}`}</Text>}
      </Pressable>
    </ScrollView>
    {/* 고른 장 */}
    {cur && <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, paddingHorizontal: 2 }}>{t("release.d142", { v0: (p.index + 1) })}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DURATIONS.map(d => { const on = Math.abs(cur.duration - d) < .001;
          return <Pressable key={d} accessibilityRole="button" accessibilityLabel={t("release.d143", { v0: (p.index + 1), v1: (d) })} accessibilityState={{ selected: on }} onPress={() => p.onDuration(p.index, d)}
            style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.pointSoft : C.fill }}>
            <Text style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? C.pointInk : C.muted }}>{d}{t("release.s0899")}</Text>
          </Pressable>; })}
      </View>
    </View>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable testID="이 장 그리기" accessibilityRole="button" accessibilityLabel={t("release.d144", { v0: (p.index + 1) })} onPress={p.onDraw}
        style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>{t("release.d144", { v0: (p.index + 1) })}</Text>
      </Pressable>
      {([[t("release.s0921"), 'chevron-left', p.index - 1], [t("release.s0082"), 'chevron-right', p.index + 1]] as const).map(([label, icon, to]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={t("release.d145", { v0: (p.index + 1), v1: (label) })} disabled={to < 0 || to >= n} onPress={() => p.onMove(p.index, to)}
          style={{ width: 48, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill, opacity: to < 0 || to >= n ? .4 : 1 }}>
          <Glyph name={icon} size={20} color={C.ink} />
        </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={t("release.d146", { v0: (p.index + 1) })} onPress={() => p.onDelete(p.index)}
        style={{ width: 48, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}>
        <ImtiIcon name="delete" size={IconSize.row} color={C.danger} />
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="switch" accessibilityLabel={t("release.s0956")} accessibilityState={{ checked: p.onion }} onPress={() => p.onOnion(!p.onion)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <View style={{ width: 40, height: 24, borderRadius: 12, padding: 2, backgroundColor: p.onion ? C.point : C.lineStrong, justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', marginLeft: p.onion ? 16 : 0 }} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{t("release.s0956")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("release.s0957")} accessibilityHint={t("release.s0958")} onPress={p.onOff}
        style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{t("release.s0957")}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
