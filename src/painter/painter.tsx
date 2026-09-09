import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Host, Slider } from '@expo/ui';
import { WebView } from 'react-native-webview';
import { canvasHtml } from './canvas-html';
import { Action, Dialog, Preview, styles } from '../components/ui';
import { dataUrl } from '../services/images';
import { imageUri } from '../services/storage';
import { suggestDialogue } from '../services/concept';
import type { LayerTransform, LocalImage, PainterExport, QA, Slot } from '../types';

type Scene = { undo: boolean; redo: boolean; dirty: boolean; activeLayerId: string; layers: LayerTransform[]; references: (LayerTransform & { path: string })[] };
type Props = { slot: Slot; slotCount: number; canon?: LocalImage; onSave: (payload: PainterExport, dialogue: string) => QA | undefined; onClose: () => void; onNavigate: (number: number) => void; onAddReferences: () => Promise<LocalImage[]>; onShare: () => Promise<void> };
const transform = (id: string, name: string): LayerTransform => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
const source = { html: canvasHtml };
export function Painter({ slot, slotCount, canon, onSave, onClose, onNavigate, onAddReferences, onShare }: Props) {
  const web = useRef<WebView>(null), inFlight = useRef(false), nextAction = useRef<'stay' | 'close' | 'share' | number>('stay');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false), [initialized, setInitialized] = useState(false), [busy, setBusy] = useState(false);
  const [scene, setScene] = useState<Scene>({ undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', layers: [], references: [] });
  const [dialogue, setDialogue] = useState(slot.dialogue);
  const [tool, setTool] = useState('pen'), [brush, setBrush] = useState('pen'), [color, setColor] = useState('#242424');
  const [penWidth, setPenWidth] = useState(5), [eraserWidth, setEraserWidth] = useState(20), [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<'color' | 'layers' | 'references' | 'more' | null>(null);
  const [showCanon, setShowCanon] = useState(false), [showQA, setShowQA] = useState(false), [qa, setQA] = useState<QA | undefined>(slot.qa), [saved, setSaved] = useState(false);
  const selected = [...scene.layers, ...scene.references].find(l => l.id === scene.activeLayerId);
  const width = tool === 'eraser' ? eraserWidth : penWidth;
  const send = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  const unlock = () => { if (timeout.current) clearTimeout(timeout.current); inFlight.current = false; setBusy(false); };
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    (async () => {
      const layers = slot.work?.layers ?? [{ ...transform('draw-1', 'Draw Layer 1'), image: slot.finalImage }, transform('draw-2', 'Draw Layer 2')];
      const refs = slot.work?.references ?? slot.referenceImages.map((image, i) => ({ ...transform('ref-' + image.path, 'Reference ' + (i + 1)), opacity: .3, image }));
      const decodedLayers = await Promise.all(layers.map(async l => ({ ...l, data: 'image' in l && l.image ? await dataUrl(l.image) : undefined })));
      const decodedRefs = await Promise.all(refs.map(async l => ({ ...l, path: l.image!.path, data: await dataUrl(l.image!) })));
      if (!canceled) send({ type: 'init', layers: decodedLayers, references: decodedRefs, activeLayerId: slot.work?.activeLayerId });
    })().catch(e => Alert.alert('작업 불러오기 실패', String(e)));
    return () => { canceled = true; };
  }, [ready]);
  function selectTool(value: string) {
    setTool(value); send({ type: 'tool', tool: value });
    if ((value === 'pen' || value === 'eraser') && !scene.layers.some(l => l.id === scene.activeLayerId)) send({ type: 'select', id: scene.layers[0]?.id });
  }
  function changeLayer(id: string, patch: Partial<LayerTransform>) { send({ type: 'select', id }); send({ type: 'transform', ...patch }); }
  function save(action: 'stay' | 'close' | 'share' | number = 'stay') {
    if (inFlight.current) return;
    if (!initialized) { if (action === 'close') onClose(); return; }
    inFlight.current = true; setBusy(true); nextAction.current = action;
    timeout.current = setTimeout(() => { send({ type: 'saveFailed' }); unlock(); Alert.alert('저장 응답 없음', '현재 작업을 유지했습니다. 다시 저장하세요.'); }, 20000);
    send({ type: 'save' });
  }
  async function addReferences() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const added = await onAddReferences();
      if (added.length) send({ type: 'addReferences', references: await Promise.all(added.map(async (image, i) => ({ ...transform('ref-' + image.path, 'Reference ' + (scene.references.length + i + 1)), opacity: .3, path: image.path, data: await dataUrl(image) }))) });
    } catch (e) { Alert.alert('참고 추가 실패', String(e)); } finally { unlock(); }
  }
  return <Modal onRequestClose={() => save('close')} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: '#f6f5ef' }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Tool label="홈" onPress={() => save('close')} disabled={busy} />
        <Tool label="이전 슬롯" disabled={busy || !initialized || slot.number <= 1} onPress={() => save(slot.number - 1)}>‹</Tool>
        <Text accessibilityLabel="현재 슬롯" style={{ fontWeight: '700' }}>{String(slot.number).padStart(2, '0')} / {slotCount}</Text>
        <Tool label="다음 슬롯" disabled={busy || !initialized || slot.number >= slotCount} onPress={() => save(slot.number + 1)}>›</Tool>
        <Tool label="저장" disabled={busy || !initialized} onPress={() => save()}>{busy ? '저장 중' : saved && !scene.dirty ? '저장됨' : '저장'}</Tool>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
        <TextInput accessibilityLabel="대사" editable={!busy} value={dialogue} placeholder="대사" onChangeText={s => { setDialogue(s); setSaved(false); }} style={[styles.input, { flex: 1, minHeight: 42, paddingVertical: 6 }]} />
        <Action title="대사 추천" disabled={busy} onPress={() => { setDialogue(suggestDialogue(dialogue)); setSaved(false); }} />
        <Pressable accessibilityRole="button" accessibilityLabel="추가 도구" disabled={busy} onPress={() => setPanel(panel === 'more' ? null : 'more')} style={{ padding: 10 }}><Text style={{ fontSize: 22 }}>⋯</Text></Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <WebView ref={web} source={source} originWhitelist={['about:*']} javaScriptEnabled scrollEnabled onShouldStartLoadWithRequest={r => r.url === 'about:blank'} onError={e => { unlock(); setInitialized(false); Alert.alert('Painter 오류', e.nativeEvent.description); }} onMessage={event => {
          try {
            const m = JSON.parse(event.nativeEvent.data);
            if (m.type === 'ready') setReady(true);
            if (m.type === 'initialized') setInitialized(true);
            if (m.type === 'state') setScene(m);
            if (m.type === 'hint') Alert.alert('레이어 선택', m.message);
            if (m.type === 'error') { unlock(); Alert.alert('Painter 오류', m.message); }
            if (m.type === 'save' && inFlight.current) {
              try {
                const action = nextAction.current;
                // Navigating through an untouched slot must not create a blank result thumbnail.
                if (m.dirty !== false || dialogue !== slot.dialogue || action === 'stay' || action === 'share') {
                  const result = onSave(m, dialogue); setQA(result); setSaved(true);
                }
                send({ type: 'saved' }); unlock();
                if (action === 'close') onClose();
                else if (typeof action === 'number') onNavigate(action);
                else if (action === 'share') onShare().catch(e => Alert.alert('공유 실패', String(e)));
              } catch (e) { send({ type: 'saveFailed' }); unlock(); Alert.alert('저장 실패', String(e)); }
            }
          } catch (e) { unlock(); Alert.alert('Painter 오류', String(e)); }
        }} style={{ flex: 1, backgroundColor: '#eee' }} />
        {panel && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '75%', backgroundColor: '#fafbf8', padding: 10, borderTopWidth: 1, borderColor: '#d0d8c8' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={styles.label}>{{ color: '색', layers: '그리기 레이어', references: '레퍼런스', more: '추가 도구' }[panel]}</Text><Pressable accessibilityRole="button" accessibilityLabel="패널 닫기" onPress={() => setPanel(null)} style={{ padding: 10 }}><Text>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }} pointerEvents={busy ? 'none' : 'auto'}>
            {panel === 'color' && <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['#242424', '#ffffff', '#f06a75', '#ffc94e', '#6baf8b', '#548aca'].map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={'색 ' + c} onPress={() => { setColor(c); send({ type: 'color', color: c }); setPanel(null); }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c, borderWidth: 1, borderColor: '#999' }} />)}</View>
              <TextInput accessibilityLabel="펜 HEX 색상" style={styles.input} value={color} autoCapitalize="none" onChangeText={c => { setColor(c); if (/^#[0-9a-f]{6}$/i.test(c)) send({ type: 'color', color: c }); }} />
            </>}
            {(panel === 'layers' || panel === 'references') && <>
              {panel === 'references' && <Action title="+ 참고 추가" onPress={() => void addReferences()} disabled={busy || !initialized} />}
              {(panel === 'layers' ? scene.layers : scene.references).map(l => {
                const ref = slot.referenceImages.find(i => 'path' in l && i.path === l.path);
                return <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: l.id === scene.activeLayerId ? '#e1ead8' : 'transparent', borderRadius: 6 }}>
                  {ref && <Image source={{ uri: imageUri(ref.path) }} style={{ width: 38, height: 38 }} resizeMode="contain" />}
                  <Pressable accessibilityRole="button" accessibilityLabel={'선택 ' + l.name} onPress={() => { send({ type: 'select', id: l.id }); const next = panel === 'references' ? 'move' : 'pen'; setTool(next); send({ type: 'tool', tool: next }); }} style={{ flex: 1, padding: 12 }}><Text>{l.name}</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={l.name + (l.visible ? ' 숨기기' : ' 표시')} onPress={() => changeLayer(l.id, { visible: !l.visible })} style={{ padding: 12 }}><Text>{l.visible ? '켜짐' : '꺼짐'}</Text></Pressable>
                </View>;
              })}
              {selected && <>
                <Text style={{ fontSize: 12 }}>{selected.name} · 불투명도 {Math.round(selected.opacity * 100)}%</Text>
                <Host matchContents><Slider value={selected.opacity} min={0} max={1} step={.05} onValueChange={opacity => changeLayer(selected.id, { opacity })} /></Host>
                <View style={{ flexDirection: 'row' }}><Tool label="활성 레이어 이동" onPress={() => { selectTool('move'); setPanel(null); }}>드래그 이동</Tool><Tool label="위치 초기화" onPress={() => changeLayer(selected.id, { x: 0, y: 0, scale: 1, rotation: 0 })} /></View>
                <Text style={{ fontSize: 12 }}>크기 {selected.scale.toFixed(1)}×</Text>
                <Host matchContents><Slider value={selected.scale} min={.1} max={3} step={.1} onValueChange={scale => changeLayer(selected.id, { scale })} /></Host>
                <Text style={{ fontSize: 12 }}>회전 {Math.round(selected.rotation)}°</Text>
                <Host matchContents><Slider value={selected.rotation} min={-180} max={180} step={5} onValueChange={rotation => changeLayer(selected.id, { rotation })} /></Host>
              </>}
            </>}
            {panel === 'more' && <>
              <Action title="CANON" onPress={() => setShowCanon(true)} />
              <Action title={zoom + '× 캔버스 확대'} onPress={() => { const n = zoom === 3 ? 1 : zoom + 1; setZoom(n); send({ type: 'zoom', zoom: n }); setPanel(null); }} />
              <Action title="캔버스 이동" onPress={() => { selectTool('pan'); setPanel(null); }} />
              <Action title="선택한 그리기 레이어 비우기" onPress={() => Alert.alert('레이어 비우기', 'Undo로 되돌릴 수 있습니다.', [{ text: '취소' }, { text: '비우기', onPress: () => send({ type: 'clear' }) }])} />
              <Action title="PNG 공유" onPress={() => save('share')} />
              <Action title="검수 결과" onPress={() => setShowQA(true)} />
            </>}
          </ScrollView>
        </View>}
      </View>
      <View pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        <View style={{ flexDirection: 'row' }}>
          <Tool label="펜" selected={tool === 'pen'} onPress={() => selectTool('pen')} />
          <Tool label="지우개" selected={tool === 'eraser'} onPress={() => selectTool('eraser')} />
          <Tool label="Undo" disabled={!scene.undo} onPress={() => send({ type: 'undo' })} />
          <Tool label="Redo" disabled={!scene.redo} onPress={() => send({ type: 'redo' })} />
          <Tool label="색" onPress={() => setPanel(panel === 'color' ? null : 'color')} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
          <Text style={{ fontSize: 12, minWidth: 78 }}>{tool === 'eraser' ? '지우개' : tool === 'move' ? '레이어 이동' : tool === 'pan' ? '캔버스 이동' : { pen: '펜', marker: '마커', pencil: '연필' }[brush]} {tool === 'pen' || tool === 'eraser' ? width + 'px' : ''}</Text>
          <Host matchContents style={{ flex: 1 }}><Slider value={width} min={1} max={48} step={1} onValueChange={v => { if (tool === 'eraser') setEraserWidth(v); else setPenWidth(v); send({ type: 'width', tool, width: v }); }} /></Host>
          <Pressable accessibilityRole="button" accessibilityLabel="펜 종류" onPress={() => { const next = brush === 'pen' ? 'marker' : brush === 'marker' ? 'pencil' : 'pen'; setBrush(next); send({ type: 'brush', brush: next }); selectTool('pen'); }} style={{ padding: 10 }}><Text style={{ fontSize: 12 }}>펜 종류</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}><Tool label="레이어" onPress={() => setPanel(panel === 'layers' ? null : 'layers')}>{selected?.name ?? '레이어'}</Tool><Tool label="레퍼런스" onPress={() => setPanel(panel === 'references' ? null : 'references')}>레퍼런스 {scene.references.length}</Tool></View>
      </View>
    </KeyboardAvoidingView>
    {showCanon && <Dialog title="CANON" onClose={() => setShowCanon(false)}><Preview image={canon} label="기준 캐릭터" size={240} /></Dialog>}
    {showQA && <Dialog title="검수" onClose={() => setShowQA(false)}>{qa ? [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS').map(c => <Text key={c.label}>{c.status} · {c.label}: {c.detail}</Text>) : <Text>저장하면 검사합니다.</Text>}</Dialog>}
  </SafeAreaView></Modal>;
}
function Tool({ label, selected, disabled, onPress, children }: { label: string; selected?: boolean; disabled?: boolean; onPress: () => void; children?: React.ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? '#dfe8d7' : 'transparent', borderRadius: 8, opacity: disabled ? .35 : 1 }}><Text style={{ fontSize: 13, fontWeight: selected ? '700' : '500' }}>{children ?? label}</Text></Pressable>;
}
