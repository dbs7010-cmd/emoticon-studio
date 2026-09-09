import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, View, Text, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Host, Slider } from '@expo/ui';
import { WebView } from 'react-native-webview';
import { canvasHtml } from './canvas-html';
import { Dialog, Preview } from '../components/ui';
import { dataUrl } from '../services/images';
import { imageUri } from '../services/storage';
import type { LayerTransform, LocalImage, PainterExport, QA, Slot } from '../types';

type Scene = {
  undo: boolean;
  redo: boolean;
  dirty: boolean;
  activeLayerId: string;
  activeReferenceId?: string | null;
  layers: LayerTransform[];
  references: (LayerTransform & { path: string })[];
};
type Props = {
  slot: Slot;
  slotCount: number;
  canon?: LocalImage;
  onSave: (payload: PainterExport, dialogue: string) => QA | undefined;
  onClose: () => void;
  onNavigate: (number: number) => void;
  onAddReferences: () => Promise<LocalImage[]>;
  onRemoveReference: (path: string) => void;
  onShare: () => Promise<void>;
};

type Brush = 'pen' | 'pencil' | 'marker';
type Panel = 'color' | 'reference' | 'more' | null;
const transform = (id: string, name: string): LayerTransform => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
const source = { html: canvasHtml };
const clampWidth = (value: number) => Math.max(1, Math.min(48, value));
const C = {
  bg: '#F7F4EE', paper: '#FFFDF9', ink: '#232323', muted: '#77736C', line: '#E7E1D7',
  coral: '#FF7A59', peach: '#FFE2D8', yellow: '#F8D66D', mint: '#BFE9D5', blue: '#C9DCF8', lavender: '#DCCCF7',
};
const palette = [
  '#171717', '#4B4B4B', '#858585', '#C9C9C9', '#FFFFFF',
  '#E94F4F', '#FF6E7A', '#FF8C69', '#FFAA4D', '#FFD15C',
  '#A8D85F', '#65C47A', '#66BE9B', '#50C7C2', '#54A9E8',
  '#5D87D6', '#6D72D9', '#9870D8', '#BF6AD5', '#E768AD',
  '#765044', '#A77559', '#D7B79B', '#F0D8BF',
];

export function Painter({ slot, slotCount, canon, onSave, onClose, onNavigate, onAddReferences, onRemoveReference, onShare }: Props) {
  const web = useRef<WebView>(null), inFlight = useRef(false), nextAction = useRef<'stay' | 'close' | 'share' | number>('stay');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false), [initialized, setInitialized] = useState(false), [busy, setBusy] = useState(false);
  const [scene, setScene] = useState<Scene>({ undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, layers: [], references: [] });
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen'), [brush, setBrush] = useState<Brush>('pen'), [color, setColor] = useState('#242424');
  const [penWidth, setPenWidth] = useState(5), [eraserWidth, setEraserWidth] = useState(20), [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<Panel>(null), [layerRail, setLayerRail] = useState(false);
  const [showCanon, setShowCanon] = useState(false), [showQA, setShowQA] = useState(false), [qa, setQA] = useState<QA | undefined>(slot.qa), [saved, setSaved] = useState(false);
  const selectedReference = scene.references.find(r => r.id === scene.activeReferenceId);
  const width = tool === 'eraser' ? eraserWidth : penWidth;
  const send = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  const unlock = () => { if (timeout.current) clearTimeout(timeout.current); inFlight.current = false; setBusy(false); };

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    (async () => {
      const layers = slot.work?.layers ?? [{ ...transform('draw-1', '그림 1'), image: slot.finalImage }, transform('draw-2', '그림 2')];
      const savedRefs = slot.work?.references ?? [];
      const refs = slot.referenceImages.map((image, i) => {
        const savedRef = savedRefs.find(ref => ref.image?.path === image.path);
        return savedRef ?? { ...transform('ref-' + image.path, `참고 ${i + 1}`), visible: i === 0, opacity: .28, image };
      });
      const decodedLayers = await Promise.all(layers.map(async l => ({ ...l, data: 'image' in l && l.image ? await dataUrl(l.image) : undefined })));
      const decodedRefs = await Promise.all(refs.map(async l => ({ ...l, path: l.image!.path, data: await dataUrl(l.image!) })));
      if (!canceled) send({ type: 'init', layers: decodedLayers, references: decodedRefs, activeLayerId: slot.work?.activeLayerId });
    })().catch(e => Alert.alert('작업 불러오기 실패', String(e)));
    return () => { canceled = true; };
  }, [ready]);

  function selectTool(value: 'pen' | 'eraser') { setTool(value); send({ type: 'tool', tool: value }); }
  function selectBrush(value: Brush) { setBrush(value); send({ type: 'brush', brush: value }); selectTool('pen'); }
  function adjustWidth(delta: number) {
    const next = clampWidth(width + delta);
    if (tool === 'eraser') setEraserWidth(next); else setPenWidth(next);
    send({ type: 'width', tool: tool === 'eraser' ? 'eraser' : 'pen', width: next });
  }
  function changeTransform(id: string, patch: Partial<LayerTransform>) { send({ type: 'transform', id, ...patch }); }
  function save(action: 'stay' | 'close' | 'share' | number = 'stay') {
    if (inFlight.current) return;
    if (!initialized) { if (action === 'close') onClose(); return; }
    inFlight.current = true; setBusy(true); nextAction.current = action;
    timeout.current = setTimeout(() => { send({ type: 'saveFailed' }); unlock(); Alert.alert('저장 응답 없음', '현재 작업은 유지되어 있습니다. 다시 저장해 주세요.'); }, 20000);
    send({ type: 'save' });
  }
  async function addReferences() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const added = await onAddReferences();
      if (added.length) send({ type: 'addReferences', references: await Promise.all(added.map(async (image, i) => ({
        ...transform('ref-' + image.path, `참고 ${scene.references.length + i + 1}`), visible: false, opacity: .28, path: image.path, data: await dataUrl(image),
      }))) });
    } catch (e) { Alert.alert('참고 이미지 추가 실패', String(e)); }
    finally { unlock(); }
  }
  function removeReference(path: string, id: string) {
    Alert.alert('참고 이미지 삭제', '이 세트의 모든 칸에서 이 참고 이미지를 제거합니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { onRemoveReference(path); send({ type: 'removeReference', id }); setPanel(null); } },
    ]);
  }

  return <Modal onRequestClose={() => save('close')} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ minHeight: 54, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel="홈" disabled={busy} onPress={() => save('close')} style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 23, color: C.ink }}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 칸" disabled={busy || slot.number <= 1} onPress={() => save(slot.number - 1)} style={{ width: 38, height: 44, alignItems: 'center', justifyContent: 'center', opacity: slot.number <= 1 ? .25 : 1 }}><Text style={{ fontSize: 20 }}>‹</Text></Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 }}>
          <Text style={{ fontSize: 10, color: C.muted, fontWeight: '700' }}>이모티콘 세트</Text>
          <Text accessibilityLabel="현재 칸" style={{ fontSize: 17, color: C.ink, fontWeight: '900' }}>{String(slot.number).padStart(2, '0')} / {slotCount}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 칸" disabled={busy || slot.number >= slotCount} onPress={() => save(slot.number + 1)} style={{ width: 38, height: 44, alignItems: 'center', justifyContent: 'center', opacity: slot.number >= slotCount ? .25 : 1 }}><Text style={{ fontSize: 20 }}>›</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="레이어" onPress={() => { setLayerRail(!layerRail); setPanel(null); }} style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 19, fontWeight: '900' }}>▱</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="더보기" onPress={() => { setPanel(panel === 'more' ? null : 'more'); setLayerRail(false); }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>⋯</Text></Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <WebView ref={web} source={source} originWhitelist={['about:*']} javaScriptEnabled scrollEnabled={false} onShouldStartLoadWithRequest={r => r.url === 'about:blank'} onError={e => { unlock(); setInitialized(false); Alert.alert('그리기 오류', e.nativeEvent.description); }} onMessage={event => {
          try {
            const m = JSON.parse(event.nativeEvent.data);
            if (m.type === 'ready') setReady(true);
            if (m.type === 'initialized') setInitialized(true);
            if (m.type === 'state') setScene(m);
            if (m.type === 'zoom' && Number.isFinite(m.zoom)) setZoom(m.zoom);
            if (m.type === 'error') { unlock(); Alert.alert('그리기 오류', m.message); }
            if (m.type === 'save' && inFlight.current) {
              try {
                const action = nextAction.current;
                if (m.dirty !== false || action === 'stay' || action === 'share') {
                  const result = onSave(m, slot.dialogue); setQA(result); setSaved(true);
                }
                send({ type: 'saved' }); unlock();
                if (action === 'close') onClose(); else if (typeof action === 'number') onNavigate(action); else if (action === 'share') onShare().catch(e => Alert.alert('공유 실패', String(e)));
              } catch (e) { send({ type: 'saveFailed' }); unlock(); Alert.alert('저장 실패', String(e)); }
            }
          } catch (e) { unlock(); Alert.alert('그리기 오류', String(e)); }
        }} style={{ flex: 1, backgroundColor: '#EEEAE3' }} />

        {canon && <Pressable accessibilityRole="button" accessibilityLabel="원캐릭터 보기" onPress={() => setShowCanon(true)} style={{ position: 'absolute', left: 10, top: 10, width: 48, height: 48, padding: 3, borderRadius: 14, backgroundColor: '#FFFFFFE8', borderWidth: 1, borderColor: C.line, elevation: 3 }}><Image source={{ uri: imageUri(canon.path) }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="contain" /></Pressable>}
        {!!selectedReference?.visible && <View pointerEvents="none" style={{ position: 'absolute', left: 66, top: 13, backgroundColor: '#FFF9D8EE', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ fontSize: 10, color: '#6F6243', fontWeight: '800' }}>참고 조정 중 · 두 손가락 이동/확대</Text></View>}

        {layerRail && <View style={{ position: 'absolute', right: 8, top: 8, width: 104, maxHeight: '82%', padding: 7, borderRadius: 18, backgroundColor: '#FFFDF9F2', borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: C.muted, padding: 5 }}>레이어</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {scene.layers.map((layer, index) => <View key={layer.id} style={{ borderRadius: 12, backgroundColor: layer.id === scene.activeLayerId ? C.peach : '#FFF', borderWidth: 1, borderColor: layer.id === scene.activeLayerId ? '#F7A58E' : C.line, overflow: 'hidden' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`그림 ${index + 1} 선택`} onPress={() => send({ type: 'select', id: layer.id })} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 11, fontWeight: '900' }}>그림 {index + 1}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`그림 ${index + 1} ${layer.visible ? '숨기기' : '보이기'}`} onPress={() => changeTransform(layer.id, { visible: !layer.visible })} style={{ paddingBottom: 6, alignItems: 'center' }}><Text style={{ fontSize: 10, color: C.muted }}>{layer.visible ? '◉ 보임' : '○ 숨김'}</Text></Pressable>
            </View>)}
            {scene.references.map((ref, index) => {
              const image = slot.referenceImages.find(i => i.path === ref.path);
              const active = ref.id === scene.activeReferenceId;
              return <View key={ref.id} style={{ borderRadius: 12, backgroundColor: active ? C.blue : '#FFF', borderWidth: 1, borderColor: active ? '#8FB8EA' : C.line, overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`참고 ${index + 1} 조정`} onPress={() => { if (!ref.visible) send({ type: 'toggleReference', id: ref.id }); else send({ type: 'setActiveReference', id: ref.id }); }} onLongPress={() => { send({ type: 'setActiveReference', id: ref.id }); setPanel('reference'); setLayerRail(false); }} style={{ height: 55, padding: 4 }}>{image ? <Image source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text>참고 {index + 1}</Text>}</Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`참고 ${index + 1} ${ref.visible ? '끄기' : '켜기'}`} onPress={() => send({ type: 'toggleReference', id: ref.id })} style={{ paddingBottom: 6, alignItems: 'center' }}><Text style={{ fontSize: 10, color: C.muted }}>{ref.visible ? '◉ 참고' : '○ 꺼짐'}</Text></Pressable>
              </View>;
            })}
          </ScrollView>
        </View>}

        {panel === 'color' && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 10, padding: 13, borderRadius: 18, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}><Text style={{ fontSize: 13, fontWeight: '900' }}>색</Text><Pressable onPress={() => setPanel(null)} style={{ padding: 6 }}><Text>×</Text></Pressable></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{palette.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={'색 ' + c} onPress={() => { setColor(c); send({ type: 'color', color: c }); setPanel(null); }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: color.toLowerCase() === c.toLowerCase() ? 3 : 1, borderColor: color.toLowerCase() === c.toLowerCase() ? C.coral : '#999' }} />)}</View>
        </View>}

        {panel === 'reference' && selectedReference && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 10, padding: 14, borderRadius: 18, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontSize: 13, fontWeight: '900' }}>선택한 참고 이미지</Text><Pressable onPress={() => setPanel(null)} style={{ padding: 6 }}><Text>×</Text></Pressable></View>
          <Text style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>두 손가락으로 이미지 자체를 이동·확대합니다.</Text>
          <Text style={{ fontSize: 11 }}>불투명도 {Math.round(selectedReference.opacity * 100)}%</Text>
          <Host matchContents><Slider value={selectedReference.opacity} min={0} max={1} step={.05} onValueChange={opacity => changeTransform(selectedReference.id, { opacity })} /></Host>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <SmallButton title="위치 초기화" onPress={() => changeTransform(selectedReference.id, { x: 0, y: 0, scale: 1, rotation: 0 })} />
            <SmallButton title="참고 끄기" onPress={() => { send({ type: 'toggleReference', id: selectedReference.id }); setPanel(null); }} />
            <SmallButton danger title="삭제" onPress={() => { const image = slot.referenceImages.find(i => i.path === selectedReference.path); if (image) removeReference(image.path, selectedReference.id); }} />
          </View>
        </View>}

        {panel === 'more' && <View style={{ position: 'absolute', right: 10, top: 8, width: 178, padding: 9, borderRadius: 16, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          {canon && <MenuButton title="원캐릭터 보기" onPress={() => { setShowCanon(true); setPanel(null); }} />}
          <MenuButton title={`캔버스 ${zoom.toFixed(1)}×`} onPress={() => { const n = zoom >= 3 ? 1 : zoom + 1; setZoom(n); send({ type: 'zoom', zoom: n }); setPanel(null); }} />
          <MenuButton title="현재 그림 레이어 비우기" onPress={() => { setPanel(null); Alert.alert('레이어 비우기', '두 손가락 탭으로 되돌릴 수 있습니다.', [{ text: '취소' }, { text: '비우기', onPress: () => send({ type: 'clear' }) }]); }} />
          <MenuButton title="PNG 공유" onPress={() => { setPanel(null); save('share'); }} />
          <MenuButton title="제출 전 검사" onPress={() => { setPanel(null); setShowQA(true); }} />
        </View>}
      </View>

      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper }} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        <View style={{ paddingTop: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontSize: 11, fontWeight: '900', color: C.muted }}>참고</Text>{!!selectedReference?.visible && <Text style={{ fontSize: 9, color: '#5277A5' }}>두 손가락으로 참고 자체 조정</Text>}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 7, paddingHorizontal: 8, paddingVertical: 5 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="참고 추가" onPress={() => void addReferences()} style={{ width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BDB5AA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}><Text style={{ fontSize: 22, color: C.muted }}>＋</Text></Pressable>
          {scene.references.map((ref, index) => {
            const image = slot.referenceImages.find(i => i.path === ref.path), active = ref.id === scene.activeReferenceId;
            return <Pressable key={ref.id} accessibilityRole="button" accessibilityLabel={`참고 ${index + 1} ${ref.visible ? '사용 중' : '꺼짐'}`} onPress={() => send({ type: 'toggleReference', id: ref.id })} onLongPress={() => { send({ type: 'setActiveReference', id: ref.id }); setPanel('reference'); }} style={{ width: 52, height: 52, padding: 2, borderRadius: 14, borderWidth: active ? 3 : 1, borderColor: active ? '#6FA4E5' : C.line, backgroundColor: ref.visible ? C.blue : '#FFF' }}>
              {image ? <Image source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%', borderRadius: 10, opacity: ref.visible ? 1 : .38 }} resizeMode="contain" /> : <Text>{index + 1}</Text>}
            </Pressable>;
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, minHeight: 46 }}>
          <ToolPill title="펜" selected={tool === 'pen'} onPress={() => selectTool('pen')} />
          <ToolPill title="지우개" selected={tool === 'eraser'} onPress={() => selectTool('eraser')} />
          <ToolPill title="기본" selected={tool === 'pen' && brush === 'pen'} onPress={() => selectBrush('pen')} />
          <ToolPill title="연필" selected={tool === 'pen' && brush === 'pencil'} onPress={() => selectBrush('pencil')} />
          <ToolPill title="마커" selected={tool === 'pen' && brush === 'marker'} onPress={() => selectBrush('marker')} />
          <Pressable accessibilityRole="button" accessibilityLabel="색 선택" onPress={() => setPanel(panel === 'color' ? null : 'color')} style={{ width: 43, height: 40, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: color, borderWidth: 1, borderColor: '#777' }} /></Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 38, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', marginRight: 4 }}>{tool === 'eraser' ? '지우개' : '굵기'} {width}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="굵기 줄이기" onPress={() => adjustWidth(-2)} style={{ width: 36, height: 34, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>−</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="굵기 늘리기" onPress={() => adjustWidth(2)} style={{ width: 36, height: 34, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>＋</Text></Pressable>
          <Text style={{ flex: 1, textAlign: 'right', fontSize: 9, color: C.muted }}>두 손가락 탭 되돌리기 · 세 손가락 탭 다시</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, padding: 8, paddingTop: 3 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="저장" disabled={busy || !initialized} onPress={() => save()} style={{ flex: 1, minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#BEB6AB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', opacity: busy || !initialized ? .4 : 1 }}><Text style={{ fontWeight: '800', color: C.ink }}>{busy ? '저장 중…' : saved && !scene.dirty ? '저장됨' : '저장'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="저장 후 다음 칸" disabled={busy || !initialized} onPress={() => save(slot.number < slotCount ? slot.number + 1 : 'stay')} style={{ flex: 1.45, minHeight: 48, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', opacity: busy || !initialized ? .4 : 1 }}><Text style={{ color: '#FFF', fontWeight: '900' }}>{slot.number < slotCount ? '저장 → 다음 칸' : '세트 마지막 저장'}</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>

    {showCanon && <Dialog title="원캐릭터" onClose={() => setShowCanon(false)}><Preview image={canon} label="기준 캐릭터" size={260} /></Dialog>}
    {showQA && <Dialog title="제출 전 검사" onClose={() => setShowQA(false)}>{qa ? [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS').map(c => <Text key={c.label}>{c.status} · {c.label}: {c.detail}</Text>) : <Text>저장하면 자동으로 기본 검사를 진행합니다.</Text>}</Dialog>}
  </SafeAreaView></Modal>;
}

function ToolPill({ title, selected, onPress }: { title: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress} style={{ flex: 1, minWidth: 45, minHeight: 38, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: selected ? C.peach : 'transparent' }}><Text style={{ fontSize: 11, fontWeight: selected ? '900' : '700', color: C.ink }}>{title}</Text></Pressable>;
}
function SmallButton({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minHeight: 38, borderRadius: 11, backgroundColor: danger ? '#FFE0DE' : '#F2EEE7', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 11, fontWeight: '800', color: danger ? '#A43D3D' : C.ink }}>{title}</Text></Pressable>;
}
function MenuButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ minHeight: 42, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10 }}><Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>{title}</Text></Pressable>;
}
