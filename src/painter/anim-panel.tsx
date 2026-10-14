// 애니메이션 탭(2026-10-15 · 시안 F2/F4, 사용자 확정): 그림 전체를 장마다 따로 그려 움직이게 한다.
// - 장이 없으면: 자주 쓰는 묶음(장 수·시간이 미리 맞춰진 시작점)에서 고른다. 눈 깜빡·빈 장은 무료, 나머지 묶음은 PRO.
// - 장이 있으면: 장 줄(썸네일·번호·시간) → 고른 장의 시간 · 순서 · 삭제 → '이 장 그리기'(그리기 탭으로) · 앞 장 비춰 보기.
// - 무료는 3장까지, PRO 는 24장(카카오 규격 상한). 장을 바꾸면 되돌리기 기록은 새로 시작한다(엔진).
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { T, Clay, ProTag, Glyph } from '../components/ui';
import { ImtiIcon, IconSize } from '../design/icons';
import { ANIM_FREE_FRAMES, ANIM_MAX_FRAMES } from '../types';

const C = T;
export type AnimRecipe = { id: string; title: string; hint: string; durations: number[]; free: boolean; next: string };
export const ANIM_RECIPES: AnimRecipe[] = [
  { id: 'blink', title: '눈 깜빡', hint: '2장 · 눈만 감은 모양으로', durations: [.8, .2], free: true, next: '2장에서 눈을 감은 모양으로 고쳐 그려요' },
  { id: 'blank', title: '빈 장으로 시작', hint: '2장 · 시간은 직접', durations: [.3, .3], free: true, next: '2장을 고쳐 그리고, 필요하면 장을 더해요' },
  { id: 'talk', title: '입 뻐끔', hint: '2장 · 입만 열고 닫기', durations: [.2, .2], free: false, next: '2장에서 입을 연 모양으로 고쳐 그려요' },
  { id: 'aura', title: '기운 일렁', hint: '3장 · 테두리만 조금씩', durations: [.1, .1, .1], free: false, next: '장마다 기운 테두리만 조금씩 다르게 그려요' },
  { id: 'sparkle', title: '반짝', hint: '2장 · 켜졌다 꺼졌다', durations: [.3, .3], free: false, next: '2장에서 반짝이를 지우거나 옮겨요' },
  { id: 'turn', title: '고개 돌리기', hint: '3장 · 앞 → 옆 → 앞', durations: [.4, .2, .4], free: false, next: '2장은 살짝 돌린 얼굴, 3장은 다 돌린 얼굴' },
];
const DURATIONS = [.1, .2, .3, .5, .8, 1] as const;

type Props = {
  frames: { id: string; duration: number }[] | null; index: number; onion: boolean; pro: boolean; playing: boolean;
  thumbs: Record<string, string>; hint: string | null;
  onStart: (recipe: AnimRecipe) => void; onSelect: (i: number) => void; onAdd: () => void; onDelete: (i: number) => void;
  onDuration: (i: number, d: number) => void; onMove: (from: number, to: number) => void; onOnion: (on: boolean) => void;
  onOff: () => void; onDraw: () => void; onPlay: (on: boolean) => void; onRequestPro: () => void;
};
export function AnimPanel(p: Props) {
  const n = p.frames?.length ?? 0;
  const limit = p.pro ? ANIM_MAX_FRAMES : ANIM_FREE_FRAMES;
  const head = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
    <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>애니메이션</Text>
    <View style={{ height: 22, paddingHorizontal: 9, borderRadius: 11, backgroundColor: C.accentSoft, justifyContent: 'center' }}><Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>{`무료 ${ANIM_FREE_FRAMES}장까지`}</Text></View>
    <Text style={{ flex: 1, fontSize: 11, color: C.muted }}>{`PRO는 ${ANIM_MAX_FRAMES}장`}</Text>
  </View>;
  if (!p.frames) return <ScrollView testID="애니메이션 시작" contentContainerStyle={{ padding: 16, gap: 12 }}>
    {head}
    <Text style={{ fontSize: 13, lineHeight: 19, color: C.muted, paddingHorizontal: 2 }}>장마다 그림을 조금씩 다르게 그려 움직이게 해요. 지금 그림이 1장이 되고, 2장은 1장을 복사해서 시작해요.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {ANIM_RECIPES.map(r => { const locked = !r.free && !p.pro;
        return <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={'애니메이션 ' + r.title} accessibilityHint={locked ? 'PRO 묶음이에요' : r.hint}
          onPress={() => locked ? p.onRequestPro() : p.onStart(r)}
          style={({ pressed }) => ({ width: '48%', flexGrow: 1, minHeight: 76, padding: 12, gap: 4, borderRadius: 20, ...Clay.card, transform: pressed ? [{ scale: .97 }] : [] })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: C.ink }}>{r.title}</Text>
            {locked && <ProTag />}
          </View>
          <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted }}>{r.hint}</Text>
        </Pressable>; })}
    </View>
  </ScrollView>;

  const cur = p.frames[p.index];
  const canAdd = n < limit;
  return <ScrollView testID="애니메이션 장" contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>{head}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={p.playing ? '애니메이션 멈추기' : '애니메이션 재생'} onPress={() => p.onPlay(!p.playing)}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.playing ? C.pointSoft : C.accent, ...(p.playing ? {} : pressed ? Clay.buttonPressed : Clay.button) })}>
        <Glyph name={p.playing ? 'pause' : 'play'} size={20} color={p.playing ? C.point : C.ink} />
      </Pressable>
    </View>
    {!!p.hint && <Text testID="애니메이션 안내" style={{ fontSize: 12, lineHeight: 18, color: C.pointInk, paddingHorizontal: 2 }}>{p.hint}</Text>}
    {/* 장 줄 */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 8 }}>
      {p.frames.map((f, i) => { const on = i === p.index;
        return <Pressable key={f.id} testID={'장 ' + (i + 1)} accessibilityRole="button" accessibilityLabel={`${i + 1}장 · ${f.duration}초`} accessibilityState={{ selected: on }} onPress={() => p.onSelect(i)}
          style={{ width: 64, alignItems: 'center', gap: 3 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            ...(on ? { backgroundColor: C.pointSoft, boxShadow: `inset 0px 0px 0px 2px ${C.point}` } : Clay.small) }}>
            {p.thumbs[f.id] ? <Image source={{ uri: p.thumbs[f.id] }} style={{ width: 56, height: 56 }} /> : <Text style={{ fontSize: 13, color: C.faint }}>{i + 1}</Text>}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: on ? C.pointInk : C.ink }}>{i + 1}장</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>{f.duration}초</Text>
        </Pressable>; })}
      <Pressable testID="장 추가" accessibilityRole="button" accessibilityLabel={canAdd ? '장 추가(지금 장 복사)' : n >= ANIM_MAX_FRAMES ? '장은 24장까지예요' : '장 추가 · PRO'}
        onPress={() => canAdd ? p.onAdd() : n < ANIM_MAX_FRAMES ? p.onRequestPro() : undefined}
        style={{ width: 64, alignItems: 'center', gap: 3 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.lineStrong }}>
          <ImtiIcon name="plus" size={IconSize.tool} color={C.muted} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>장 추가</Text>
        {!canAdd && n < ANIM_MAX_FRAMES ? <ProTag /> : <Text style={{ fontSize: 11, color: C.faint }}>{`${n}/${limit}`}</Text>}
      </Pressable>
    </ScrollView>
    {/* 고른 장 */}
    {cur && <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, paddingHorizontal: 2 }}>{`${p.index + 1}장 보여 주는 시간`}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DURATIONS.map(d => { const on = Math.abs(cur.duration - d) < .001;
          return <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${p.index + 1}장 ${d}초`} accessibilityState={{ selected: on }} onPress={() => p.onDuration(p.index, d)}
            style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.pointSoft : C.fill }}>
            <Text style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? C.pointInk : C.muted }}>{d}초</Text>
          </Pressable>; })}
      </View>
    </View>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable testID="이 장 그리기" accessibilityRole="button" accessibilityLabel={`${p.index + 1}장 그리기`} onPress={p.onDraw}
        style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>{`${p.index + 1}장 그리기`}</Text>
      </Pressable>
      {([['앞으로', 'chevron-left', p.index - 1], ['뒤로', 'chevron-right', p.index + 1]] as const).map(([label, icon, to]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${p.index + 1}장 ${label}`} disabled={to < 0 || to >= n} onPress={() => p.onMove(p.index, to)}
          style={{ width: 48, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill, opacity: to < 0 || to >= n ? .4 : 1 }}>
          <Glyph name={icon} size={20} color={C.ink} />
        </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.index + 1}장 지우기`} onPress={() => p.onDelete(p.index)}
        style={{ width: 48, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dangerSoft }}>
        <ImtiIcon name="delete" size={IconSize.row} color={C.danger} />
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="switch" accessibilityLabel="앞 장 비춰 보기" accessibilityState={{ checked: p.onion }} onPress={() => p.onOnion(!p.onion)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <View style={{ width: 40, height: 24, borderRadius: 12, padding: 2, backgroundColor: p.onion ? C.point : C.lineStrong, justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', marginLeft: p.onion ? 16 : 0 }} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>앞 장 비춰 보기</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="애니메이션 끄기" accessibilityHint="1장만 남기고 나머지 장을 지워요" onPress={p.onOff}
        style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>애니메이션 끄기</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
