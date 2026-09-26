import React from 'react';
import { View, Text, Pressable, ScrollView, Image, Animated, type ImageSourcePropType } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pop, ProTag, Range, T } from '../components/ui';
import { ASSET_SLOTS } from '../design/asset-slots';
import { usesPro } from '../project';
import { isProPreset, loopScale, presetDelta, type MotionDirection } from '../motion-math';
import type { LayerTransform, Motion, PartMotion, SavedMotion, MotionPreset } from '../types';

const C = T;
// Everyday words for what the movement does. The effect ids stay in English in the data.
// 45.39: 여섯 → 스물(무료 6 · PRO 14). 조사로 매긴 순위와 배정은 verification/round45_39/MOTION_TIERS.md.
// 묶음(등장·동작·강조)으로 나눠 보여 준다. id 는 저장에 남는 값이라 앞의 여섯은 그대로다.
export type MotionGroup = '등장' | '동작' | '강조';
export const MOTION_GROUPS: { id: MotionGroup; hint: string }[] = [
  { id: '등장', hint: '화면 밖에서 나타나요' },
  { id: '동작', hint: '몸짓으로 말해요' },
  { id: '강조', hint: '감정을 크게 보여요' },
];
export const PRESETS: { id: MotionPreset; label: string; hint: string; group: MotionGroup }[] = [
  { id: 'pop', label: '뿅', hint: '작게 있다가 뿅 튀어나와요', group: '등장' },
  { id: 'slide', label: '쓱', hint: '옆이나 위아래에서 쓱 들어와요', group: '등장' },
  { id: 'peek', label: '빼꼼', hint: '아래에서 살짝 내밀었다 숨어요', group: '등장' },
  { id: 'drop', label: '쿵', hint: '위에서 떨어져 착지해요', group: '등장' },
  { id: 'vanish', label: '사라지기', hint: '있다가 쏙 사라져요', group: '등장' },
  { id: 'bounce', label: '통통', hint: '뛰었다가 착지할 때 눌려요', group: '동작' },
  { id: 'float', label: '둥실', hint: '부드럽게 위아래로 떠요', group: '동작' },
  { id: 'tilt', label: '까딱', hint: '고개를 좌우로 까딱여요', group: '동작' },
  { id: 'hop', label: '폴짝', hint: '움츠렸다 크게 뛰어요', group: '동작' },
  { id: 'nod', label: '끄덕', hint: '두 번 끄덕여요', group: '동작' },
  { id: 'bow', label: '꾸벅', hint: '꾸벅 숙였다 일어나요', group: '동작' },
  { id: 'dance', label: '들썩', hint: '좌우로 들썩들썩 춤춰요', group: '동작' },
  { id: 'sway', label: '살랑', hint: '발끝을 축으로 살랑 흔들려요', group: '동작' },
  { id: 'spin', label: '빙글', hint: '한 바퀴 빙글 돌아요', group: '동작' },
  { id: 'shake', label: '흔들기', hint: '좌우로 빠르게 흔들려요', group: '강조' },
  { id: 'pulse', label: '두근거리기', hint: '커졌다 작아져요', group: '강조' },
  { id: 'jitter', label: '부르르', hint: '제자리에서 작게 떨려요', group: '강조' },
  { id: 'shiver', label: '덜덜', hint: '크게 덜덜 떨어요', group: '강조' },
  { id: 'punch', label: '쾅', hint: '쾅 커졌다 돌아와요', group: '강조' },
  { id: 'stretch', label: '쭈욱', hint: '말랑하게 늘었다 줄어요', group: '강조' },
];
export const DIRECTIONS: { id: MotionDirection; label: string }[] = [
  { id: 'left', label: '왼쪽' }, { id: 'right', label: '오른쪽' }, { id: 'up', label: '위' }, { id: 'down', label: '아래' },
];
export const PART_EFFECTS = [
  { id: 'rotate' as const, label: '회전', unit: '°', min: 5, max: 60, step: 5, amount: 20 },
  { id: 'move' as const, label: '이동', unit: '%', min: .01, max: .12, step: .01, amount: .04 },
  { id: 'scale' as const, label: '크기', unit: '', min: .05, max: .4, step: .05, amount: .15 },
];

// 시안은 슬라이더 오른쪽에 지금 값을 적는다: 30°, 보통.
const words = (value: number, min: number, max: number) => {
  const at = (value - min) / (max - min || 1);
  return at < .2 ? '아주 약하게' : at < .4 ? '약하게' : at < .6 ? '보통' : at < .8 ? '세게' : '아주 세게';
};
// 움직임 조절 줄. step 은 값이 실제로 바뀌는 칸이다 — 막대는 이 칸이 바뀔 때만 움직임을 다시 적용한다(45.37: 끄는 내내
// 미리보기가 처음부터 다시 돌아 '뚝뚝' 끊겼다). fmt 가 있으면 끄는 동안의 값도 같은 글자로 보여 준다.
const Row = ({ label, value, onChange, min, max, step, fmt, onActive }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; fmt?: (n: number) => string; onActive?: (active: boolean) => void }) => {
  const text = fmt ?? ((n: number) => words(n, min, max));
  return <Range label={label} value={value} min={min} max={max} step={step ?? (max - min) / 20} onChange={onChange} display={text(value)} format={text} onActive={onActive} />;
};

const Chip = ({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) =>
  <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}
    style={{ flex: wide ? 1 : undefined, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : C.paper }}>
    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{label}</Text>
  </Pressable>;

// 레이어의 기본 이름("그림 1")은 칸 이름("01번 그림")과 헷갈린다. 저장된 이름은 그대로 두고 화면에서만 레이어로 부른다.
export const layerLabel = (name: string) => name.replace(/^그림 (\d+)$/, '레이어 $1');

// 효과 견본. 이 칸의 그림이 그 효과대로 실제로 움직인다 — 이름만 보고 결과를 짐작하게 하지 않는다.
// 45.39: 엔진과 **같은 식**(motion-math.ts)을 한 바퀴 24점으로 미리 계산해 네이티브 애니메이션으로 돌린다.
// 스무 개가 한꺼번에 움직여도 JS 가 매 프레임 다시 그리지 않는다(예전 타이머 방식은 칸마다 60ms 마다 다시 그렸다).
// 작은 견본에서는 작은 움직임이 보이지 않으므로 효과마다 정한 배율로 키운다 — 들어오는 효과는 배율 없이 그대로.
const SAMPLE_BOOST: Partial<Record<MotionPreset, { t: number; r: number; s: number }>> = {
  float: { t: 5, r: 1, s: 1 }, bounce: { t: 5, r: 1, s: 1 }, shake: { t: 5, r: 1, s: 1 }, jitter: { t: 5, r: 2.5, s: 1 }, tilt: { t: 1, r: 2.5, s: 1 }, pulse: { t: 1, r: 1, s: 4 },
  nod: { t: 3, r: 1, s: 2 }, bow: { t: 2, r: 1, s: 1.5 }, dance: { t: 3, r: 1.5, s: 1 }, sway: { t: 1, r: 1.3, s: 1 }, shiver: { t: 2.5, r: 1.5, s: 1 },
  hop: { t: 1.2, r: 1, s: 1.5 }, stretch: { t: 1, r: 1, s: 1.5 }, punch: { t: 1, r: 1, s: 1.2 },
};
const SAMPLE_POINTS = 24;
export function sampleFrames(preset: MotionPreset, size: number, direction?: MotionDirection) {
  const boost = SAMPLE_BOOST[preset] ?? { t: 1, r: 1, s: 1 };
  let last = 0;
  return Array.from({ length: SAMPLE_POINTS + 1 }, (_, i) => {
    const d = presetDelta(preset, i / SAMPLE_POINTS, .5, direction, size, size);
    // 회전은 이어지게 편다(360° 다음 0° 로 보간하면 거꾸로 한 바퀴 돈다).
    let rot = d.rot * boost.r; while (rot - last > 180) rot -= 360; while (last - rot > 180) rot += 360; last = rot;
    const sc = (v: number) => Math.max(.001, 1 + (v - 1) * boost.s);
    return { px: d.px, py: d.py, dx: d.dx * boost.t, dy: d.dy * boost.t, sx: sc(d.sx), sy: sc(d.sy), rot };
  });
}
export function MotionSample({ preset, uri, fallback, size = 44, active, direction }: { preset: MotionPreset; uri?: string; fallback: ImageSourcePropType | null; size?: number; active: boolean; direction?: MotionDirection }) {
  const clock = React.useRef(new Animated.Value(0)).current;
  const frames = React.useMemo(() => sampleFrames(preset, size, direction), [preset, size, direction]);
  React.useEffect(() => {
    // 카드는 **고르기 전에도** 움직인다. 화면 밖(패널이 닫힘)에서는 카드가 사라지며 함께 멈춘다.
    clock.setValue(0);
    const loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration: Math.round(800 * loopScale(preset)), easing: (x: number) => x, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [preset]);
  const inputRange = frames.map((_, i) => i / SAMPLE_POINTS);
  const at = (pick: (f: typeof frames[number]) => number) => clock.interpolate({ inputRange, outputRange: frames.map(pick) });
  const origin = `${(frames[0].px / size) * 100}% ${(frames[0].py / size) * 100}%`;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <Animated.Image accessibilityIgnoresInvertColors source={uri ? { uri } : fallback ?? undefined} resizeMode="contain"
      style={{ width: size * .86, height: size * .86, opacity: active ? 1 : .85, transformOrigin: origin,
        transform: [{ translateX: at(f => f.dx) }, { translateY: at(f => f.dy) }, { rotate: clock.interpolate({ inputRange, outputRange: frames.map(f => f.rot + 'deg') }) }, { scaleX: at(f => f.sx) }, { scaleY: at(f => f.sy) }] }} />
  </View>;
}

type Props = {
  motion: Motion | null;
  layers: LayerTransform[];
  clipped: boolean;
  pro: boolean;
  // 효과 견본에 쓰는 이 칸의 그림(없으면 앱 기본 캐릭터).
  sample?: string;
  hasCaption: boolean;
  // 앞 칸에 넣은 움직임. 빈 칸에서 한 번 눌러 그대로 다시 쓴다(여러 칸 한 번에는 PRO).
  previousMotion?: Motion | null;
  onChange: (motion: Motion | null) => void;
  pivotPick: string | null;
  pivotRole: string;
  onPickPivot: (id: string | null, role?: string) => void;
  onFocusPart: (layerId: string | null) => void;
  onDuplicateForPose: () => void;
  // Opening a pose for editing means selecting the drawings it is made of on the drawing tab.
  onEditPose: (layerIds: string[]) => void;
  savedMotions: SavedMotion[];
  onSaveMotion: () => void;
  onUseMotion: (saved: SavedMotion) => void;
  onForgetMotion: (id: string) => void;
  onRequestPro: () => void;
  thumbs: Record<string, string>;
};


// 움직이기 화면. 결과(캔버스와 효과 견본)가 먼저이고 설정은 고른 다음에 나온다.
// 무료 효과는 누르는 즉시 칸에 들어간다. PRO(부분 움직임·두 모습)는 **들어가기 전에** PRO 라고 알리고,
// 무료 사용자는 입구에서 PRO 안내로 간다 — 만들고 난 뒤 저장할 때 막지 않는다.
export function MotionPanel({ motion, layers, clipped, pro, sample, hasCaption, previousMotion, pivotPick, pivotRole, onPickPivot, onFocusPart, onDuplicateForPose, onEditPose, savedMotions, onSaveMotion, onUseMotion, onForgetMotion, onChange, onRequestPro, thumbs }: Props) {
  const [view, setView] = React.useState<'basic' | 'parts' | 'pose' | 'shelf'>('basic');
  const base: Motion = motion ?? { version: 1, speed: .5, strength: .5, captionMoves: false };
  const set = (patch: Partial<Motion>) => onChange({ ...base, ...patch });
  const parts = base.parts ?? [];
  const drawLayers = layers.filter(l => l.id.startsWith('draw-'));
  const nameOf = (layerId: string) => layerLabel(drawLayers.find(l => l.id === layerId)?.name ?? '레이어');
  const addPart = (layerId: string) => {
    const effect = PART_EFFECTS[0];
    const part: PartMotion = { id: 'part-' + Date.now().toString(36), layerId, effect: effect.id, pivotX: .5, pivotY: .5, amount: effect.amount, angle: 0, speed: .5, delay: 0 };
    set({ parts: [...parts, part], play: base.play ?? 'together' });
  };
  const editPart = (id: string, patch: Partial<PartMotion>) => set({ parts: parts.map(p => p.id === id ? { ...p, ...patch } : p) });
  const dropPart = (id: string) => { const left = parts.filter(p => p.id !== id); set({ parts: left.length ? left : undefined }); };
  const [holding, setHolding] = React.useState(false);
  const [openPart, setOpenPart] = React.useState<string | null>(null);
  const [detailPart, setDetailPart] = React.useState<string | null>(null);
  const [rowHeight, setRowHeight] = React.useState(96);
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragBy, setDragBy] = React.useState(0);
  const movePart = (from: number, to: number) => {
    if (to < 0 || to >= parts.length) return;
    const next = [...parts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set({ parts: base.play === 'sequence' ? next.map((p, i) => ({ ...p, delay: Number((i * (base.stagger ?? .15)).toFixed(2)) })) : next });
  };
  const hasPro = parts.length > 0 || !!base.alternate;
  const moving = !!base.preset || hasPro;
  // 무료 사용자에게는 PRO 화면 대신 PRO 안내가 열린다. 들어가서 만든 뒤에 막히는 일이 없다.
  const enterPro = () => { if (pro) setView('parts'); else onRequestPro(); };
  // '없음'은 전체 움직임만 뺀다. 부분 움직임이 있으면 그것은 남긴다.
  const clearPreset = () => { if (hasPro) set({ preset: undefined }); else onChange(null); };
  // 효과 카드는 그리기 탭의 **즐겨찾기 칸과 같은 역할**이다 — 그림 견본 + 이름 중 하나를 고른다(45.36-R1 G6·G18).
  // 그래서 같은 규칙: 테두리 없음, 고른 칸만 옅은 노랑 면 + 짧은 노란 밑줄, 누르는 동안 회색.
  // 한 줄에 일곱을 욱여넣던 것을 네 칸 격자로 바꿨다 — 320dp 에서 흔들기·부르르가 화면 밖에 있어 고를 수 없었고,
  // 기기에서는 칸이 36dp 로 줄어 손가락 자리(48dp)도 글자도 모자랐다.
  const card = (on: boolean) => ({ pressed }: { pressed: boolean }) => ({ flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: C.radius.md, backgroundColor: on ? C.accentSoft : pressed ? C.fill : C.bg, borderWidth: C.stroke, borderColor: on ? C.edge : 'transparent', ...(on ? Pop.small : {}) } as const);
  const mark = (on: boolean) => <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 4, height: 3, borderRadius: 2, backgroundColor: on ? C.accent : 'transparent' }} />;
  // 다른 화면으로 가는 줄은 **목록 줄** 역할이다 — 브러시·레이어 목록처럼 카드 없이 얇은 구분선으로 가른다.
  const row = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: C.line } as const;
  // 45.39: 묶음으로 나눈 격자. 묶음 칩으로 좁혀 볼 수 있다(전체가 기본).
  const [group, setGroup] = React.useState<MotionGroup | 'all'>('all');
  // PRO 효과 미리보기(무료 사용자). 누르면 **내 그림에 입혀 보여 주고** 그 자리에서 PRO 를 권한다.
  // 저장은 하지 않는다 — 저장·닫기를 누르면 PRO 안내가 먼저 뜨고, '무료로 저장'은 미리보기 전 효과로 되돌린다.
  const [trialFrom, setTrialFrom] = React.useState<{ preset?: MotionPreset; direction?: MotionDirection } | null>(null);
  const trying = !pro && isProPreset(base.preset) && !!trialFrom;
  const pick = (id: MotionPreset) => {
    if (!pro && isProPreset(id)) {
      if (!trialFrom) setTrialFrom({ preset: base.preset, direction: base.direction });
      set({ preset: id });
      return;
    }
    setTrialFrom(null);
    set({ preset: id });
  };
  const endTrial = () => { const from = trialFrom; setTrialFrom(null); if (!from) return; if (!from.preset && !hasPro) onChange(null); else set({ preset: from.preset, direction: from.direction }); };
  const sections = MOTION_GROUPS.filter(g => group === 'all' || g.id === group).map(g => {
    const items = PRESETS.filter(p => p.group === g.id);
    const rows: typeof items[] = []; for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
    return { ...g, rows };
  });
  const back = view === 'pose' ? { label: '부분 움직임으로 돌아가기', to: 'parts' as const, title: '두 모습 번갈아' }
    : { label: '움직임 처음으로', to: 'basic' as const, title: view === 'parts' ? '부분만 움직이기' : '보관한 움직임' };

  return <View style={{ flex: 1 }}>
    {view !== 'basic' && <Pressable accessibilityRole="button" accessibilityLabel={back.label} onPress={() => setView(back.to)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: C.tap, paddingHorizontal: 8 }}>
      <MaterialCommunityIcons name="chevron-left" size={22} color={C.ink} />
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{back.title}</Text>
    </Pressable>}
    {/* 손가락이 슬라이더나 순서 손잡이를 잡고 있는 동안에는 이 판이 따라 스크롤되면 안 된다. */}
    {/* 판 높이가 정해져 있으므로 이 목록이 먼저 줄어들어야 한다(flex:1 · minHeight:0).
        그래야 아래 완성 줄이 밖으로 밀려나지 않고, 목록 끝까지 스크롤로 닿을 수 있다. */}
    <ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" scrollEnabled={!holding && dragFrom === null} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20, gap: 10 }}>
    {view === 'basic' ? <>
    {/* 없음 + 묶음 칩. '없음'은 전체 움직임만 뺀다(부분 움직임이 있으면 '전체 없음'). */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="움직임 없음" accessibilityHint={hasPro ? '전체 움직임만 빼요. 부분 움직임은 남아요' : undefined} accessibilityState={{ selected: !base.preset }}
        onPress={() => { setTrialFrom(null); clearPreset(); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: !base.preset ? C.accentBorder : C.line, backgroundColor: !base.preset ? C.accentSoft : pressed ? C.fill : C.paper })}>
        <MaterialCommunityIcons name="motion-pause-outline" size={16} color={C.ink} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: !base.preset ? '800' : '600', color: C.ink }}>{hasPro ? '전체 없음' : '없음'}</Text>
      </Pressable>
      <View style={{ width: 1, height: 22, backgroundColor: C.line }} />
      {([['all', '전체'], ...MOTION_GROUPS.map(g => [g.id, g.id])] as [MotionGroup | 'all', string][]).map(([id, label]) => {
        const on = group === id;
        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={'움직임 묶음 ' + label} accessibilityState={{ selected: on }} onPress={() => setGroup(id)}
          style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20, backgroundColor: on ? C.ink : pressed ? C.fill : 'transparent', borderWidth: on ? 0 : 1, borderColor: C.line })}>
          <Text style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.paper : C.muted }}>{label}</Text>
        </Pressable>;
      })}
    </ScrollView>
    {trying && <View testID="PRO 미리보기 안내" style={{ gap: 8, padding: 12, borderRadius: C.radius.md, backgroundColor: C.warm, borderWidth: 1, borderColor: C.warmLine }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ProTag />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.ink }}>{PRESETS.find(p => p.id === base.preset)?.label} — 내 그림으로 미리 보는 중이에요</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="PRO로 이 효과 쓰기" onPress={onRequestPro}
          style={({ pressed }) => ({ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.ink, opacity: pressed ? .85 : 1 })}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.paper }}>PRO로 쓰기</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="미리보기 끝내기" onPress={endTrial}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper })}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>원래대로</Text>
        </Pressable>
      </View>
    </View>}
    <View testID="움직임 격자" style={{ gap: 12 }}>
      {sections.map(g => <View key={g.id} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>{g.id}</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>{g.hint}</Text>
        </View>
        {g.rows.map((line, r) => <View key={r} style={{ flexDirection: 'row', gap: 6 }}>
          {line.map(p => {
            const on = base.preset === p.id, locked = !pro && isProPreset(p.id);
            return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.label} accessibilityHint={locked ? 'PRO 효과예요. 누르면 내 그림으로 미리 볼 수 있어요' : p.hint} accessibilityState={{ selected: on }} onPress={() => pick(p.id)} style={card(on)}>
              {locked && <View pointerEvents="none" style={{ position: 'absolute', top: 4, right: 4 }}><ProTag /></View>}
              <MotionSample preset={p.id} uri={sample} fallback={ASSET_SLOTS.motionExampleArtwork.source} active={on} size={48} direction={p.id === 'slide' ? base.direction : undefined} />
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{p.label}</Text>
              {mark(on)}
            </Pressable>;
          })}
          {/* 마지막 줄이 모자라면 빈 칸으로 채워 칸 폭을 윗줄과 맞춘다. */}
          {Array.from({ length: 4 - line.length }, (_, i) => <View key={'pad' + i} style={{ flex: 1 }} />)}
        </View>)}
      </View>)}
    </View>
    {/* 쓱: 들어오는 쪽 */}
    {base.preset === 'slide' && <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>들어오는 쪽</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DIRECTIONS.map(d => <Chip key={d.id} wide label={d.label} on={(base.direction ?? 'left') === d.id} onPress={() => set({ direction: d.id })} />)}
      </View>
    </View>}
    {/* 다시 쓰는 것끼리 한 묶음(45.2차): 직전 칸의 움직임과 보관해 둔 움직임. 새로 고르기 바로 다음 자리. */}
    <View style={{ gap: 6 }}>
    {!moving && !!previousMotion && (() => {
      const locked = usesPro(previousMotion) && !pro;
      const name = [PRESETS.find(p => p.id === previousMotion.preset)?.label, previousMotion.parts?.length ? `부분 ${previousMotion.parts.length}` : null].filter(Boolean).join(' · ');
      // 따뜻한 제안 한 줄: 24칸을 만드는 동안 가장 자주 누르는 행동.
      return <Pressable accessibilityRole="button" accessibilityLabel="직전 칸 움직임 다시 쓰기" onPress={() => locked ? onRequestPro() : onChange(previousMotion)} style={{ ...row, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.warm, borderWidth: 1, borderColor: C.warmLine }}>
        <MaterialCommunityIcons name="history" size={20} color={C.ink} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>직전 칸 움직임 다시 쓰기{name ? ' · ' + name : ''}</Text>
        {locked ? <ProTag /> : <MaterialCommunityIcons name="plus" size={18} color={C.muted} />}
      </Pressable>;
    })()}
    <Pressable accessibilityRole="button" accessibilityLabel="보관한 움직임" onPress={() => setView('shelf')} style={row}>
      <MaterialCommunityIcons name="folder-outline" size={20} color={C.muted} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.ink }}>보관한 움직임{savedMotions.length ? ` · ${savedMotions.length}개` : ''}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={C.faint} />
    </Pressable>
    </View>

    {moving && <>
      <Row label="속도" value={base.speed} min={0} max={1} onActive={setHolding} onChange={speed => set({ speed: Math.round(speed * 20) / 20 })} />
      <Row label="세기" value={base.strength} min={0} max={1} onActive={setHolding} onChange={strength => set({ strength: Math.round(strength * 20) / 20 })} />
    </>}
    {moving && hasCaption && <Pressable accessibilityRole="switch" accessibilityLabel="글씨도 같이 움직이기" accessibilityState={{ checked: !!base.captionMoves }}
      onPress={() => set({ captionMoves: !base.captionMoves })} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 10 }}>
      <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>글씨도 같이 움직이기</Text>
      <Toggle on={!!base.captionMoves} />
    </Pressable>}
    {clipped && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: C.warningSoft }}>
      <MaterialCommunityIcons name="crop" size={16} color={C.warning} />
      <Text style={{ flex: 1, fontSize: 12, color: C.ink }}>그림이 칸 밖으로 나가요. 세기를 줄여 보세요.</Text>
    </View>}

    {/* 더 세밀하게: 한 줄뿐이라 제목이 필요 없다. PRO 표시는 작게 한 번(45.2차). */}
    <View style={{ gap: 6, paddingTop: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="부분만 움직이기" onPress={enterPro} style={row}>
        <MaterialCommunityIcons name="hand-back-right-outline" size={20} color={C.ink} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.ink }}>부분만 움직이기{parts.length ? ` · ${parts.length}개` : ''}{base.alternate ? ' · 두 모습' : ''}</Text>
        {!pro && <ProTag />}
        <MaterialCommunityIcons name="chevron-right" size={20} color={C.faint} />
      </Pressable>
    </View>
    </> : view === 'parts' ? <>
      {parts.map((part, index) => {
        const effect = PART_EFFECTS.find(e => e.id === part.effect)!;
        const dragging = dragFrom === index, open = openPart === part.id, detail = detailPart === part.id;
        const landing = dragFrom === null ? index : Math.max(0, Math.min(parts.length - 1, dragFrom + dragBy));
        const name = nameOf(part.layerId);
        return <View key={part.id} onLayout={e => { if (e.nativeEvent.layout.height > 0) setRowHeight(e.nativeEvent.layout.height); }}
          style={{ borderWidth: 1, borderColor: dragging || (dragFrom !== null && landing === index) ? C.accentBorder : C.line, borderRadius: C.radius.md, padding: 8, gap: 6, backgroundColor: dragging ? C.accentSoft : C.paper, opacity: dragging ? .9 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {parts.length > 1 && <View accessibilityRole="adjustable" accessibilityLabel={`${name} 순서 바꾸기`}
              accessibilityValue={{ min: 1, max: parts.length, now: index + 1 }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={e => movePart(index, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
              onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
              onResponderGrant={() => { setDragFrom(index); setDragBy(0); }}
              onResponderMove={e => setDragBy(Math.round((e.nativeEvent.locationY - 24) / rowHeight))}
              onResponderRelease={() => { if (dragFrom !== null && dragBy !== 0) movePart(dragFrom, dragFrom + dragBy); setDragFrom(null); setDragBy(0); }}
              onResponderTerminate={() => { setDragFrom(null); setDragBy(0); }}
              style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color={dragging ? C.ink : C.muted} />
            </View>}
            <Pressable accessibilityRole="button" accessibilityLabel={`${name} 움직이기`} accessibilityState={{ expanded: open }}
              onPress={() => { const next = open ? null : part.id; setOpenPart(next); onFocusPart(next ? part.layerId : null); }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: C.tap }}>
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: C.bg, overflow: 'hidden' }}>
                {thumbs[part.layerId] ? <Image source={{ uri: thumbs[part.layerId] }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '800', color: C.ink }}>{name}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{effect.label}</Text>
              <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
            </Pressable>
            <Pressable accessibilityRole="switch" accessibilityLabel={`${name} ${part.off ? '켜기' : '끄기'}`} accessibilityState={{ checked: !part.off }} onPress={() => editPart(part.id, { off: part.off ? undefined : true })}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Toggle on={!part.off} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${name} 부분 움직임 빼기`} onPress={() => dropPart(part.id)} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="close" size={18} color={C.muted} />
            </Pressable>
          </View>
          {open && <>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {PART_EFFECTS.map(e => <Chip key={e.id} wide label={e.label} on={part.effect === e.id} onPress={() => editPart(part.id, { effect: e.id, amount: e.amount })} />)}
            </View>
            <Row label={effect.label} value={part.amount} min={effect.min} max={effect.max} fmt={effect.id === 'rotate' ? n => Math.round(n) + '°' : undefined} onActive={setHolding} onChange={amount => editPart(part.id, { amount: Number(amount.toFixed(3)) })} />
            <Row label="속도" value={part.speed} min={0} max={1} onActive={setHolding} onChange={speed => editPart(part.id, { speed: Math.round(speed * 20) / 20 })} />
            <Pressable accessibilityRole="button" accessibilityLabel={`${name} 세부 조절`} accessibilityState={{ expanded: detail }} onPress={() => setDetailPart(detail ? null : part.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: C.muted }}>세부 조절</Text>
              <MaterialCommunityIcons name={detail ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
            </Pressable>
            {detail && <>
              {parts.length > 1 && <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip wide label="앞으로" on={false} onPress={() => movePart(index, index - 1)} />
                <Chip wide label="뒤로" on={false} onPress={() => movePart(index, index + 1)} />
              </View>}
              {part.effect === 'move' && <>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Chip wide label={pivotPick === part.id && pivotRole === 'from' ? '캔버스를 누르세요' : '시작 위치'} on={pivotPick === part.id && pivotRole === 'from'} onPress={() => onPickPivot(pivotPick === part.id && pivotRole === 'from' ? null : part.id, 'from')} />
                  <Chip wide label={pivotPick === part.id && pivotRole === 'to' ? '캔버스를 누르세요' : '끝 위치'} on={pivotPick === part.id && pivotRole === 'to'} onPress={() => onPickPivot(pivotPick === part.id && pivotRole === 'to' ? null : part.id, 'to')} />
                </View>
                {part.fromX === undefined || part.toX === undefined
                  ? <Row label="방향" value={part.angle} min={0} max={350} step={10} fmt={n => Math.round(n) + '°'} onActive={setHolding} onChange={angle => editPart(part.id, { angle: Math.round(angle / 10) * 10 })} />
                  : <Chip wide label="위치 지우기" on={false} onPress={() => editPart(part.id, { fromX: undefined, fromY: undefined, toX: undefined, toY: undefined })} />}
              </>}
              <Chip wide label={pivotPick === part.id && pivotRole === 'pivot' ? '캔버스를 누르세요' : '중심점 옮기기'} on={pivotPick === part.id && pivotRole === 'pivot'} onPress={() => onPickPivot(pivotPick === part.id ? null : part.id)} />
            </>}
          </>}
        </View>;
      })}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {drawLayers.map(l => <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={`${layerLabel(l.name)} 부분 움직임 추가`} onPress={() => addPart(l.id)}
          style={{ minHeight: 48, flexDirection: 'row', gap: 4, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="plus" size={16} color={C.ink} />
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>{layerLabel(l.name)}</Text>
        </Pressable>)}
      </View>

      {parts.length > 1 && <>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip wide label="함께" on={(base.play ?? 'together') === 'together'} onPress={() => set({ play: 'together', parts: parts.map(p => ({ ...p, delay: 0 })) })} />
          <Chip wide label="차례로" on={base.play === 'sequence'} onPress={() => set({ play: 'sequence', parts: parts.map((p, i) => ({ ...p, delay: Number((i * (base.stagger ?? .15)).toFixed(2)) })) })} />
        </View>
        {base.play === 'sequence' && <Row label="시작 간격" value={base.stagger ?? .15} min={0} max={.6}
          step={.05} fmt={n => n.toFixed(2) + '초'} onActive={setHolding}
          onChange={stagger => { const step = Number(stagger.toFixed(2)); set({ stagger: step, parts: parts.map((p, i) => ({ ...p, delay: Number((i * step).toFixed(2)) })) }); }} />}
      </>}

      <Pressable accessibilityRole="button" accessibilityLabel="두 모습 번갈아" onPress={() => setView('pose')} style={row}>
        <MaterialCommunityIcons name="swap-horizontal" size={20} color={C.ink} />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: C.ink }}>두 모습 번갈아</Text>
        <Text style={{ fontSize: 12, color: C.muted }}>{base.alternate ? '켜짐' : '꺼짐'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={C.muted} />
      </Pressable>
    </> : view === 'pose' ? <>
      <Pressable accessibilityRole="switch" accessibilityLabel="두 모습 번갈아 켜기" accessibilityState={{ checked: !!base.alternate }}
        onPress={() => set({ alternate: base.alternate ? undefined : { poseB: drawLayers.slice(1).map(l => l.id), interval: .4 } })}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: C.ink }}>두 모습 번갈아</Text>
        <Toggle on={!!base.alternate} />
      </Pressable>
      {!!base.alternate && <>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['모습 1', drawLayers.filter(l => !base.alternate!.poseB.includes(l.id))],
             ['모습 2', drawLayers.filter(l => base.alternate!.poseB.includes(l.id))]] as const).map(([title, members]) =>
            <View key={title} style={{ flex: 1, gap: 4, padding: 8, borderRadius: C.radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: C.ink }}>{title}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={title + ' 고쳐 그리기'} disabled={!members.length} onPress={() => onEditPose(members.map(l => l.id))}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: members.length ? 1 : .3 }}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={C.muted} />
                </Pressable>
              </View>
              {members.map(l => <Text key={l.id} numberOfLines={1} style={{ fontSize: 11, color: C.muted }}>{layerLabel(l.name)}</Text>)}
            </View>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {drawLayers.map(l => {
            const inB = base.alternate!.poseB.includes(l.id);
            return <Chip key={l.id} label={`${layerLabel(l.name)} → 모습 ${inB ? 2 : 1}`} on={inB}
              onPress={() => set({ alternate: { ...base.alternate!, poseB: inB ? base.alternate!.poseB.filter(x => x !== l.id) : [...base.alternate!.poseB, l.id] } })} />;
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="모습 1 복사해서 모습 2 만들기" onPress={onDuplicateForPose}
          style={{ minHeight: 48, flexDirection: 'row', gap: 6, borderRadius: C.radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="content-copy" size={16} color={C.ink} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>모습 1 복사해서 모습 2 만들기</Text>
        </Pressable>
        <Row label="간격" value={base.alternate.interval} min={.2} max={1.2} step={.1} fmt={n => n.toFixed(1) + '초'} onActive={setHolding} onChange={interval => set({ alternate: { ...base.alternate!, interval: Number(interval.toFixed(2)) } })} />
      </>}
    </> : <View style={{ gap: 8 }}>
      {!!motion && <Pressable accessibilityRole="button" accessibilityLabel="이 움직임 보관하기" onPress={onSaveMotion}
        style={{ minHeight: 48, flexDirection: 'row', gap: 6, borderRadius: C.radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="plus" size={16} color={C.ink} />
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>이 움직임 보관하기</Text>
      </Pressable>}
      {savedMotions.map(saved => {
        // 무료 사용자가 PRO 내용이 든 보관 움직임을 꺼내면, 넣고 난 뒤가 아니라 **누르는 순간** PRO 라고 알린다.
        const locked = usesPro(saved.motion) && !pro;
        return <View key={saved.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={saved.name + ' 꺼내 쓰기'} onPress={() => locked ? onRequestPro() : onUseMotion(saved)}
            style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: C.radius.sm, borderWidth: 1, borderColor: C.line }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.ink }}>{saved.name}</Text>
            {locked && <ProTag />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={saved.name + ' 보관 지우기'} onPress={() => onForgetMotion(saved.id)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="close" size={18} color={C.muted} />
          </Pressable>
        </View>;
      })}
      {!savedMotions.length && <Text style={{ fontSize: 12, color: C.muted }}>아직 보관한 움직임이 없어요.</Text>}
    </View>}
    </ScrollView>

  </View>;
}

function Toggle({ on }: { on: boolean }) {
  return <View style={{ width: 36, height: 22, borderRadius: 11, padding: 2, backgroundColor: on ? C.accent : C.lineStrong, justifyContent: 'center' }}>
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: on ? 'flex-end' : 'flex-start' }} />
  </View>;
}
