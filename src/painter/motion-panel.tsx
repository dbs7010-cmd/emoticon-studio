import React from 'react';
import { View, Text, Pressable, ScrollView, Image, type ImageSourcePropType } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProTag, Range, T } from '../components/ui';
import { ASSET_SLOTS } from '../design/asset-slots';
import { usesPro } from '../project';
import type { LayerTransform, Motion, PartMotion, SavedMotion } from '../types';

const C = T;
// Everyday words for what the movement does. The effect ids stay in English in the data.
export const PRESETS = [
  { id: 'bounce' as const, label: '통통', hint: '위아래로 통통 튀어요', icon: 'arrow-up-down' as const },
  { id: 'shake' as const, label: '흔들기', hint: '좌우로 흔들려요', icon: 'arrow-left-right' as const },
  { id: 'pulse' as const, label: '두근거리기', hint: '커졌다 작아져요', icon: 'heart-pulse' as const },
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
const Row = ({ label, value, onChange, min, max, display, onActive }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; display?: string; onActive?: (active: boolean) => void }) =>
  <Range label={label} value={value} min={min} max={max} onChange={onChange} display={display ?? words(value, min, max)} onActive={onActive} />;

const Chip = ({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) =>
  <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}
    style={{ flex: wide ? 1 : undefined, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : C.paper }}>
    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{label}</Text>
  </Pressable>;

// 레이어의 기본 이름("그림 1")은 칸 이름("01번 그림")과 헷갈린다. 저장된 이름은 그대로 두고 화면에서만 레이어로 부른다.
export const layerLabel = (name: string) => name.replace(/^그림 (\d+)$/, '레이어 $1');

// 효과 견본. 이 칸의 그림이 그 효과대로 실제로 움직인다 — 이름만 보고 결과를 짐작하게 하지 않는다.
// Animated 대신 작은 타이머로 한 컴포넌트만 다시 그린다(패널 전체를 매 프레임 그리지 않는다).
export function MotionSample({ preset, uri, fallback, size = 44, active }: { preset: 'bounce' | 'shake' | 'pulse'; uri?: string; fallback: ImageSourcePropType | null; size?: number; active: boolean }) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setT((Date.now() - started) / 1000), 60);
    return () => clearInterval(timer);
  }, []);
  const phase = Math.sin(t * Math.PI * 2 / .8);
  const move = preset === 'bounce' ? { transform: [{ translateY: -Math.abs(phase) * size * .16 }] }
    : preset === 'shake' ? { transform: [{ rotate: `${phase * 9}deg` }] }
    : { transform: [{ scale: 1 + Math.max(0, phase) * .14 }] };
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Image accessibilityIgnoresInvertColors source={uri ? { uri } : fallback ?? undefined} style={[{ width: size * .86, height: size * .86, opacity: active ? 1 : .85 }, move]} resizeMode="contain" />
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
  // 그리기 탭과 같은 자리·같은 이름의 확정 버튼. 움직임은 고르는 즉시 칸에 들어가 있고, 이 버튼이 칸을 끝낸다.
  completeTitle: string;
  onComplete: () => void;
  completeBusy: boolean;
};


// 움직이기 화면. 결과(캔버스와 효과 견본)가 먼저이고 설정은 고른 다음에 나온다.
// 무료 효과는 누르는 즉시 칸에 들어간다. PRO(부분 움직임·두 모습)는 **들어가기 전에** PRO 라고 알리고,
// 무료 사용자는 입구에서 PRO 안내로 간다 — 만들고 난 뒤 저장할 때 막지 않는다.
export function MotionPanel({ motion, layers, clipped, pro, sample, hasCaption, previousMotion, pivotPick, pivotRole, onPickPivot, onFocusPart, onDuplicateForPose, onEditPose, savedMotions, onSaveMotion, onUseMotion, onForgetMotion, onChange, onRequestPro, thumbs, completeTitle, onComplete, completeBusy }: Props) {
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
  // 효과 카드: 고른 것만 옅은 노랑 표면. 테두리는 1px 하나. '없음'은 좁고 조용하게 — 효과와 같은 무게로 서지 않는다.
  const card = (on: boolean) => ({ flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: C.radius.md, borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : C.paper } as const);
  const quiet = (on: boolean) => ({ width: 56, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: C.radius.md, borderWidth: 1, borderColor: on ? C.accentBorder : 'transparent', backgroundColor: on ? C.accentSoft : C.surface2 } as const);
  const row = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.surface2 } as const;
  const back = view === 'pose' ? { label: '부분 움직임으로 돌아가기', to: 'parts' as const, title: '두 모습 번갈아' }
    : { label: '움직임 처음으로', to: 'basic' as const, title: view === 'parts' ? '부분만 움직이기' : '보관한 움직임' };

  return <View style={{ flex: 1 }}>
    {view !== 'basic' && <Pressable accessibilityRole="button" accessibilityLabel={back.label} onPress={() => setView(back.to)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: C.tap, paddingHorizontal: 8 }}>
      <MaterialCommunityIcons name="chevron-left" size={22} color={C.ink} />
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{back.title}</Text>
    </Pressable>}
    {/* 손가락이 슬라이더나 순서 손잡이를 잡고 있는 동안에는 이 판이 따라 스크롤되면 안 된다. */}
    <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={!holding && dragFrom === null} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20, gap: 10 }}>
    {view === 'basic' ? <>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="움직임 없음" accessibilityState={{ selected: !base.preset }} onPress={clearPreset} style={quiet(!base.preset)}>
        <MaterialCommunityIcons name="motion-pause-outline" size={20} color={!base.preset ? C.ink : C.faint} />
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: !base.preset ? '700' : '600', color: !base.preset ? C.ink : C.muted }}>없음</Text>
      </Pressable>
      {PRESETS.map(p => {
        const on = base.preset === p.id;
        return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.label} accessibilityState={{ selected: on }} onPress={() => set({ preset: p.id })} style={card(on)}>
          <MotionSample preset={p.id} uri={sample} fallback={ASSET_SLOTS.motionExampleArtwork.source} active={on} size={48} />
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{p.label}</Text>
        </Pressable>;
      })}
    </View>
    {/* 다시 쓰는 것끼리 한 묶음(45.2차): 직전 칸의 움직임과 보관해 둔 움직임. 새로 고르기 바로 다음 자리. */}
    <View style={{ gap: 6 }}>
    {!moving && !!previousMotion && (() => {
      const locked = usesPro(previousMotion) && !pro;
      const name = [PRESETS.find(p => p.id === previousMotion.preset)?.label, previousMotion.parts?.length ? `부분 ${previousMotion.parts.length}` : null].filter(Boolean).join(' · ');
      // 따뜻한 제안 한 줄: 24칸을 만드는 동안 가장 자주 누르는 행동.
      return <Pressable accessibilityRole="button" accessibilityLabel="직전 칸 움직임 다시 쓰기" onPress={() => locked ? onRequestPro() : onChange(previousMotion)} style={{ ...row, backgroundColor: C.warm, borderWidth: 1, borderColor: C.warmLine }}>
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
            <Row label={effect.label} value={part.amount} min={effect.min} max={effect.max} display={effect.id === 'rotate' ? Math.round(part.amount) + '°' : undefined} onActive={setHolding} onChange={amount => editPart(part.id, { amount: Number(amount.toFixed(3)) })} />
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
                  ? <Row label="방향" value={part.angle} min={0} max={350} display={Math.round(part.angle) + '°'} onActive={setHolding} onChange={angle => editPart(part.id, { angle: Math.round(angle / 10) * 10 })} />
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
          display={(base.stagger ?? .15).toFixed(2) + '초'} onActive={setHolding}
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
        <Row label="간격" value={base.alternate.interval} min={.2} max={1.2} display={base.alternate.interval.toFixed(1) + '초'} onActive={setHolding} onChange={interval => set({ alternate: { ...base.alternate!, interval: Number(interval.toFixed(2)) } })} />
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

    <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: C.paper }}>
      <Pressable accessibilityRole="button" accessibilityLabel="완성 후 다음" disabled={completeBusy} onPress={onComplete}
        style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, flexDirection: 'row', gap: 6, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center', opacity: completeBusy ? .4 : 1 })}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: C.accentInk }}>{completeTitle}</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color={C.accentInk} />
      </Pressable>
    </View>
  </View>;
}

function Toggle({ on }: { on: boolean }) {
  return <View style={{ width: 36, height: 22, borderRadius: 11, padding: 2, backgroundColor: on ? C.accent : C.lineStrong, justifyContent: 'center' }}>
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: on ? 'flex-end' : 'flex-start' }} />
  </View>;
}
