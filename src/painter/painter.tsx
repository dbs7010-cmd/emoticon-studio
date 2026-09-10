import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, View, Text, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Host, Slider } from '@expo/ui';
import { WebView } from 'react-native-webview';
import { canvasHtml } from './canvas-html';
import { Dialog, Preview, T } from '../components/ui';
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
  palette: string[];
  onSave: (payload: PainterExport, dialogue: string) => QA | undefined;
  onColorUsed: (color: string) => void;
  onClose: () => void;
  onNavigate: (number: number) => void;
  onAddReferences: () => Promise<LocalImage[]>;
  onRemoveReference: (path: string) => void;
  onShare: () => Promise<void>;
};

type Tool = 'pen' | 'fill' | 'eraser';
type Brush = 'pen' | 'pencil' | 'marker';
type Panel = 'color' | 'brush' | 'more' | 'reference' | null;
const transform = (id: string, name: string): LayerTransform => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
const source = { html: canvasHtml };
const C = T;
const swatches = [
  '#171717', '#4B4B4B', '#858585', '#C9C9C9', '#FFFFFF',
  '#E94F4F', '#FF6E7A', '#FF8C69', '#FFAA4D', '#FFD15C',
  '#A8D85F', '#65C47A', '#66BE9B', '#50C7C2', '#54A9E8',
  '#5D87D6', '#6D72D9', '#9870D8', '#BF6AD5', '#E768AD',
  '#765044', '#A77559', '#D7B79B', '#F0D8BF',
];

export function Painter({ slot, slotCount, canon, palette, onSave, onColorUsed, onClose, onNavigate, onAddReferences, onRemoveReference, onShare }: Props) {
  const web = useRef<WebView>(null), inFlight = useRef(false), nextAction = useRef<'stay' | 'close' | 'share' | number>('stay');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false), [initialized, setInitialized] = useState(false), [busy, setBusy] = useState(false);
  const [scene, setScene] = useState<Scene>({ undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, layers: [], references: [] });
  const [tool, setTool] = useState<Tool>('pen'), [brush, setBrush] = useState<Brush>('pen'), [color, setColor] = useState(palette[0] ?? '#242424');
  const [penWidth, setPenWidth] = useState(6), [eraserWidth, setEraserWidth] = useState(24), [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<Panel>(null), [drawRail, setDrawRail] = useState(false);
  const [showCanon, setShowCanon] = useState(false), [showQA, setShowQA] = useState(false), [qa, setQA] = useState<QA | undefined>(slot.qa), [saved, setSaved] = useState(false);
  const selectedReference = scene.references.find(r => r.id === scene.activeReferenceId);
  const width = tool === 'eraser' ? eraserWidth : penWidth;
  const send = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  const unlock = () => { if (timeout.current) clearTimeout(timeout.current); inFlight.current = false; setBusy(false); };

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  // Unsaved strokes must survive the app being swapped away or killed, so keep the work on disk
  // without ever interrupting the drawing rhythm. Both paths reuse the ordinary save pipeline.
  const autosave = useRef(() => {});
  autosave.current = () => { if (initialized && scene.dirty && !inFlight.current) save('stay'); };
  useEffect(() => {
    const timer = setInterval(() => autosave.current(), 40000);
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') autosave.current(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    (async () => {
      const layers = slot.work?.layers ?? [{ ...transform('draw-1', '그림 1'), image: slot.finalImage }, transform('draw-2', '그림 2')];
      const savedRefs = slot.work?.references ?? [];
      const refs = slot.referenceImages.map((image, i) => {
        const savedRef = savedRefs.find(ref => ref.image?.path === image.path);
        const planned = slot.referenceKey ? image.path === slot.referenceKey : i === 0;
        return savedRef ?? { ...transform('ref-' + image.path, `참고 ${i + 1}`), visible: planned, opacity: .3, image };
      });
      const decodedLayers = await Promise.all(layers.map(async l => ({ ...l, data: 'image' in l && l.image ? await dataUrl(l.image) : undefined })));
      const decodedRefs = await Promise.all(refs.map(async l => ({ ...l, path: l.image!.path, data: await dataUrl(l.image!) })));
      if (!canceled) send({ type: 'init', layers: decodedLayers, references: decodedRefs, activeLayerId: slot.work?.activeLayerId });
    })().catch(e => Alert.alert('작업 불러오기 실패', String(e)));
    return () => { canceled = true; };
  }, [ready]);

  function selectTool(value: Tool) {
    if (value === 'pen' && tool === 'pen') { setPanel(panel === 'brush' ? null : 'brush'); return; }
    setTool(value); setPanel(null); send({ type: 'tool', tool: value });
  }
  function selectBrush(value: Brush) { setBrush(value); setPanel(null); send({ type: 'brush', brush: value }); setTool('pen'); send({ type: 'tool', tool: 'pen' }); }
  function pickColor(value: string) { setColor(value); onColorUsed(value); send({ type: 'color', color: value }); if (tool === 'eraser') selectTool('pen'); }
  function setWidth(next: number) {
    const value = Math.max(1, Math.min(48, Math.round(next)));
    if (tool === 'eraser') setEraserWidth(value); else setPenWidth(value);
    send({ type: 'width', tool: tool === 'eraser' ? 'eraser' : 'pen', width: value });
  }
  function changeTransform(id: string, patch: Partial<LayerTransform>) { send({ type: 'transform', id, ...patch }); }
  function addDrawing() { send({ type: 'addLayer', id: 'draw-' + (scene.layers.length + 1), name: `그림 ${scene.layers.length + 1}` }); }
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
        ...transform('ref-' + image.path, `참고 ${scene.references.length + i + 1}`), visible: false, opacity: .3, path: image.path, data: await dataUrl(image),
      }))) });
    } catch (e) { Alert.alert('참고 이미지 추가 실패', String(e)); }
    finally { unlock(); }
  }
  function removeReference(path: string, id: string) {
    Alert.alert('참고 삭제', '이 세트의 모든 칸에서 이 참고를 없앱니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { onRemoveReference(path); send({ type: 'removeReference', id }); setPanel(null); } },
    ]);
  }

  const dock = { borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper } as const;
  return <Modal onRequestClose={() => save('close')} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.line }}>
        <Bar label="홈" glyph="홈" text disabled={busy} onPress={() => save('close')} />
        <Bar label="이전 칸" glyph="‹" small disabled={busy || slot.number <= 1} onPress={() => save(slot.number - 1)} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: C.tap }}>
          <Text style={{ fontSize: 10, color: C.muted, fontWeight: '700' }}>이모티콘 세트</Text>
          <Text accessibilityLabel="현재 칸" style={{ fontSize: 17, color: C.ink, fontWeight: '900' }}>{String(slot.number).padStart(2, '0')} / {slotCount}</Text>
        </View>
        <Bar label="다음 칸" glyph="›" small disabled={busy || slot.number >= slotCount} onPress={() => save(slot.number + 1)} />
        <Bar label="그림 겹치기" glyph="▤" caption="겹치기" active={drawRail} onPress={() => { setDrawRail(!drawRail); setPanel(null); }} />
        <Bar label="더보기" glyph="⋯" onPress={() => { setPanel(panel === 'more' ? null : 'more'); setDrawRail(false); }} />
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

        {canon && <Pressable accessibilityRole="button" accessibilityLabel="원캐릭터 보기" onPress={() => setShowCanon(true)} style={{ position: 'absolute', left: 10, top: 10, width: C.tap, height: C.tap, padding: 3, borderRadius: 14, backgroundColor: '#FFFFFFE8', borderWidth: 1, borderColor: C.line, elevation: 3 }}><Image source={{ uri: imageUri(canon.path) }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="contain" /></Pressable>}
        {initialized && !scene.undo && !scene.dirty && <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: 12, backgroundColor: '#FFF9D8EE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontSize: 10, color: '#6F6243', fontWeight: '800' }}>두 손가락 탭 되돌리기 · 세 손가락 탭 다시</Text></View>}
        {!!selectedReference?.visible && <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: '#E8F0FCEE', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ fontSize: 10, color: '#3F6491', fontWeight: '800' }}>두 손가락으로 참고 옮기기 · 크기</Text></View>}

        {drawRail && <View style={{ position: 'absolute', right: 8, top: 8, width: 118, maxHeight: '70%', borderRadius: C.radius.md, backgroundColor: '#FFFDF9F7', borderWidth: 1, borderColor: C.line, elevation: 8, overflow: 'hidden' }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: C.muted, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 }}>내 그림</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {scene.layers.map((layer, index) => {
              const active = layer.id === scene.activeLayerId;
              return <View key={layer.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.line, backgroundColor: active ? C.peach : 'transparent' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`그림 ${index + 1} 선택`} accessibilityState={{ selected: active }} onPress={() => send({ type: 'select', id: layer.id })} style={{ flex: 1, minHeight: C.tap, justifyContent: 'center', paddingLeft: 10 }}><Text style={{ fontSize: 12, fontWeight: active ? '900' : '700', color: C.ink }}>그림 {index + 1}</Text></Pressable>
                <EyeToggle label={`그림 ${index + 1} ${layer.visible ? '숨기기' : '보이기'}`} on={layer.visible} onPress={() => changeTransform(layer.id, { visible: !layer.visible })} />
              </View>;
            })}
            {scene.layers.length < 4 && <Pressable accessibilityRole="button" accessibilityLabel="그림 추가" onPress={addDrawing} style={{ minHeight: C.tap, borderTopWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.muted }}>＋ 그림 추가</Text></Pressable>}
          </ScrollView>
        </View>}

        {panel === 'color' && <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, paddingLeft: 10, paddingRight: 4, paddingVertical: 6, borderRadius: C.radius.lg, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          {!!palette.length && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 34, fontSize: 9, fontWeight: '900', color: C.muted }}>최근</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 8 }}>{palette.slice(0, 8).map(c => <Swatch key={'recent' + c} color={c} selected={color.toLowerCase() === c.toLowerCase()} onPress={() => pickColor(c)} />)}</ScrollView>
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 34, fontSize: 9, fontWeight: '900', color: C.muted }}>색</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 8 }}>{swatches.map(c => <Swatch key={c} color={c} selected={color.toLowerCase() === c.toLowerCase()} onPress={() => pickColor(c)} />)}</ScrollView>
            <Pressable accessibilityRole="button" accessibilityLabel="색 닫기" onPress={() => setPanel(null)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18, color: C.muted }}>×</Text></Pressable>
          </View>
        </View>}

        {panel === 'brush' && <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, borderRadius: C.radius.lg, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: C.muted, marginRight: 8 }}>펜 종류</Text>
          {([['pen', '기본'], ['pencil', '연필'], ['marker', '마커']] as const).map(([key, title]) =>
            <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: brush === key }} onPress={() => selectBrush(key)} style={{ flex: 1, minHeight: C.tap, marginVertical: 5, marginRight: 6, alignItems: 'center', justifyContent: 'center', borderRadius: C.radius.sm, borderWidth: 1, borderColor: brush === key ? '#E4B7A6' : C.line, backgroundColor: brush === key ? C.peach : '#FFF' }}><Text style={{ fontSize: 13, fontWeight: brush === key ? '900' : '700', color: C.ink }}>{title}</Text></Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel="펜 종류 닫기" onPress={() => setPanel(null)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18, color: C.muted }}>×</Text></Pressable>
        </View>}

        {panel === 'reference' && selectedReference && <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, padding: 8, borderRadius: C.radius.lg, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8, flexDirection: 'row', gap: 8 }}>
          <Minor title="위치 초기화" onPress={() => { changeTransform(selectedReference.id, { x: 0, y: 0, scale: 1, rotation: 0 }); setPanel(null); }} />
          <Minor title="참고 삭제" danger onPress={() => { const image = slot.referenceImages.find(i => i.path === selectedReference.path); if (image) removeReference(image.path, selectedReference.id); }} />
          <Minor title="닫기" onPress={() => setPanel(null)} />
        </View>}

        {panel === 'more' && <View style={{ position: 'absolute', right: 8, top: 8, width: 190, padding: 6, borderRadius: C.radius.md, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, elevation: 8 }}>
          {canon && <MenuButton title="원캐릭터 보기" onPress={() => { setShowCanon(true); setPanel(null); }} />}
          <MenuButton title={`크게 보기 (지금 ${zoom.toFixed(1)}×)`} onPress={() => { const n = zoom >= 3 ? 1 : zoom + 1; setZoom(n); send({ type: 'zoom', zoom: n }); setPanel(null); }} />
          <MenuButton title="PNG 공유" onPress={() => { setPanel(null); save('share'); }} />
          <MenuButton title="제출 전 검사" onPress={() => { setPanel(null); setShowQA(true); }} />
          <MenuButton danger title="이 그림 전부 지우기" onPress={() => { setPanel(null); Alert.alert('이 그림 전부 지우기', '지금 고른 그림이 비워져요. 두 손가락 탭으로 되돌릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '지우기', style: 'destructive', onPress: () => send({ type: 'clear' }) }]); }} />
        </View>}
      </View>

      <View style={dock} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
          <Text style={{ width: 46, fontSize: 10, fontWeight: '900', color: C.ink }}>따라 그릴{'\n'}참고</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="참고 추가" onPress={() => void addReferences()} style={{ width: 52, height: 52, borderRadius: C.radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BDB5AA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}><Text style={{ fontSize: 22, color: C.muted }}>＋</Text></Pressable>
            {scene.references.map((ref, index) => {
              const image = slot.referenceImages.find(i => i.path === ref.path), active = ref.id === scene.activeReferenceId;
              return <Pressable key={ref.id} accessibilityRole="button" accessibilityLabel={`참고 ${index + 1} 선택`} accessibilityState={{ selected: active }} onPress={() => { send({ type: 'setActiveReference', id: active ? null : ref.id }); setPanel(null); }} style={{ width: 52, height: 52, padding: 2, borderRadius: C.radius.sm, borderWidth: active ? 3 : 1, borderColor: active ? '#6FA4E5' : C.line, backgroundColor: ref.visible ? C.blue : '#FFF' }}>
                {image ? <Image source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%', borderRadius: 9, opacity: ref.visible ? 1 : .35 }} resizeMode="contain" /> : <Text>{index + 1}</Text>}
              </Pressable>;
            })}
          </ScrollView>
        </View>

        {!!selectedReference && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 4 }}>
          <EyeToggle label={`참고 ${selectedReference.visible ? '숨기기' : '보이기'}`} on={selectedReference.visible} onPress={() => send({ type: 'toggleReference', id: selectedReference.id })} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.muted }}>연하게</Text>
          <View testID="참고 진하기" style={{ flex: 1, height: 40, justifyContent: 'center' }}><Host style={{ width: '100%', height: 36 }}><Slider value={selectedReference.opacity} min={.1} max={1} onValueChange={opacity => changeTransform(selectedReference.id, { opacity: Math.round(opacity * 20) / 20 })} /></Host></View>
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.muted }}>진하게</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="참고 관리" onPress={() => setPanel(panel === 'reference' ? null : 'reference')} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, color: C.muted }}>⋯</Text></Pressable>
        </View>}

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: '#F2EEE7' }}>
            {([['pen', '펜'], ['fill', '채우기'], ['eraser', '지우개']] as const).map(([key, title]) =>
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: tool === key }} onPress={() => selectTool(key)} style={{ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: tool === key ? C.coral : 'transparent' }}><Text style={{ fontSize: 13, fontWeight: '900', color: tool === key ? '#FFF' : C.muted }}>{title}{key === 'pen' && tool === 'pen' ? ' ⌄' : ''}</Text></Pressable>)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="색 선택" onPress={() => { setPanel(panel === 'color' ? null : 'color'); setDrawRail(false); }} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F2EEE7' }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color, borderWidth: 1, borderColor: '#8D867C' }} /></Pressable>
        </View>

        {tool !== 'fill' && <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, minHeight: C.tap }}>
          <Text style={{ width: 58, fontSize: 10, fontWeight: '900', color: C.ink }}>{tool === 'eraser' ? '지우개 크기' : '펜 굵기'}</Text>
          <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: Math.max(5, Math.min(26, width)), height: Math.max(5, Math.min(26, width)), borderRadius: 13, backgroundColor: tool === 'eraser' ? '#C7C0B5' : color }} /></View>
          <View testID={tool === 'eraser' ? '지우개 크기' : '펜 굵기'} style={{ flex: 1, height: C.tap, justifyContent: 'center' }}>
            <Host style={{ width: '100%', height: 40 }}><Slider value={width} min={1} max={48} onValueChange={setWidth} /></Host>
          </View>
        </View>}

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="저장" disabled={busy || !initialized} onPress={() => save()} style={{ flex: 1, minHeight: 50, borderRadius: C.radius.md, borderWidth: 1, borderColor: '#BEB6AB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', opacity: busy || !initialized ? .4 : 1 }}><Text style={{ fontWeight: '800', color: C.ink }}>{busy ? '저장 중…' : saved && !scene.dirty ? '저장됨' : '저장'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="저장 후 다음 칸" disabled={busy || !initialized} onPress={() => save(slot.number < slotCount ? slot.number + 1 : 'stay')} style={{ flex: 1.5, minHeight: 50, borderRadius: C.radius.md, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', opacity: busy || !initialized ? .4 : 1 }}><Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{slot.number < slotCount ? '저장 → 다음 칸' : '세트 마지막 저장'}</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>

    {showCanon && <Dialog title="원캐릭터" onClose={() => setShowCanon(false)}><Preview image={canon} label="기준 캐릭터" size={260} /></Dialog>}
    {showQA && <Dialog title="제출 전 검사" onClose={() => setShowQA(false)}>
      {!qa ? <Text>저장하면 자동으로 기본 검사를 해요.</Text> : qa.status === 'PASS' ? <Text style={{ fontSize: 15, fontWeight: '800', color: '#55B989' }}>기본 검사는 모두 통과했어요.</Text>
        : [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS').map(c => <Text key={c.label} style={{ fontSize: 13, lineHeight: 19, color: c.status === 'FAIL' ? '#E35C62' : C.ink }}>{c.label} · {c.detail}</Text>)}
      {(qa?.notes ?? []).map(note => <Text key={note} style={{ fontSize: 11, color: C.muted }}>{note}</Text>)}
    </Dialog>}
  </SafeAreaView></Modal>;
}

function Bar({ label, glyph, caption, text, small, active, disabled, onPress }: { label: string; glyph: string; caption?: string; text?: boolean; small?: boolean; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: active }} disabled={disabled} onPress={onPress} style={{ width: small ? 40 : T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .25 : 1 }}>
    <Text style={{ fontSize: text ? 13 : caption ? 15 : 22, fontWeight: '900', color: active ? T.coral : T.ink }}>{glyph}</Text>
    {!!caption && <Text style={{ fontSize: 9, fontWeight: '800', color: active ? T.coral : T.muted }}>{caption}</Text>}
  </Pressable>;
}
// Hand-drawn eye: filled pupil when shown, struck through when hidden.
function EyeToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const tint = on ? T.ink : '#B4ADA3';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={onPress} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 22, height: 15, borderRadius: 8, borderWidth: 1.6, borderColor: tint, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />}</View>
    {!on && <View style={{ position: 'absolute', width: 26, height: 1.6, borderRadius: 1, backgroundColor: tint, transform: [{ rotate: '-24deg' }] }} />}
  </Pressable>;
}
function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'색 ' + color} accessibilityState={{ selected }} onPress={onPress} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, borderWidth: selected ? 3 : 1, borderColor: selected ? T.coral : '#A9A299' }} />;
}
// Secondary to the slider, but it guarantees size stays adjustable on any device.
function Step({ label, sign, onPress }: { label: string; sign: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={{ width: 40, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: T.muted }}>{sign}</Text></Pressable>;
}
function Minor({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minHeight: 44, borderRadius: T.radius.sm, backgroundColor: danger ? '#FFE0DE' : '#F2EEE7', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: danger ? '#A43D3D' : T.ink }}>{title}</Text></Pressable>;
}
function MenuButton({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ minHeight: T.tap, justifyContent: 'center', paddingHorizontal: 10, borderRadius: T.radius.sm, borderTopWidth: danger ? 1 : 0, borderColor: T.line }}><Text style={{ fontSize: 13, fontWeight: '700', color: danger ? '#A43D3D' : T.ink }}>{title}</Text></Pressable>;
}
