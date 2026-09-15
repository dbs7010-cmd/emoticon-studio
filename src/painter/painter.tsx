import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, LayoutAnimation, Modal, View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, UIManager } from 'react-native';
import { Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { canvasHtml } from './canvas-html';
import { alphaOf, hsv, hsvOf, light, parseHex, toHex, typedHex, withAlpha } from './color';
import { Action, Dialog, IconButton, ProTag, Range, Segmented, SheetHeader, T, userMessage } from '../components/ui';
import { BUILTIN_REFERENCES, EXPRESSION_GUIDE } from '../design/asset-slots';
import { MotionPanel, layerLabel } from './motion-panel';
import { KAKAO_STATIC_SPEC } from '../constants/kakao-spec';
import { usesPro } from '../project';
import { dataUrl } from '../services/images';
import { imageUri } from '../services/storage';
import type { BrushSettings, Caption, LayerTransform, LocalImage, Motion, PainterExport, QA, SavedMotion, Slot } from '../types';

type Scene = {
  undo: boolean;
  redo: boolean;
  dirty: boolean;
  smoothing?: boolean;
  activeLayerId: string;
  activeReferenceId?: string | null;
  caption?: Caption | null;
  motion?: Motion | null;
  pivotPick?: string | null;
  pivotRole?: string;
  selection?: { box: { x: number; y: number; w: number; h: number }; dx: number; dy: number; scale: number; rot: number; flip: number } | null;
  captionPicked?: boolean;
  loop?: number;
  clipped?: boolean;
  playing?: boolean;
  picking?: boolean;
  layers: LayerTransform[];
  references: (LayerTransform & { path: string })[];
};
export type CopiedWork = { layers: (LayerTransform & { data?: string })[]; caption?: Caption };
type Props = {
  slot: Slot;
  slotCount: number;
  setName: string;
  canon?: LocalImage;
  canonName: string;
  canonLocked: string;
  palette: string[];
  userPalette: string[];
  onSaveUserColor: (color: string) => void;
  onRemoveUserColor: (color: string) => void;
  brushSettings?: BrushSettings;
  onBrushSettings: (settings: BrushSettings) => void;
  paperTexture: boolean;
  completeTitle: string;
  hasPrevious: boolean;
  previousImage?: LocalImage;
  pro: boolean;
  onRequestPro: () => void;
  // 앱을 켜 둔 동안 마지막으로 고른 도구. 다음 칸도 같은 도구로 열린다(선택 도구는 이어받지 않는다).
  previousMotion?: Motion | null;
  initialTool?: Tool;
  onToolChange?: (tool: Tool) => void;
  savedMotions: SavedMotion[];
  onSaveMotion: (motion: Motion) => void;
  onForgetMotion: (id: string) => void;
  onSave: (payload: PainterExport, dialogue: string, complete: boolean) => QA | undefined;
  onComplete: () => void;
  onSetReference: () => void;
  onCopyPrevious: () => Promise<CopiedWork | null>;
  onColorUsed: (color: string) => void;
  onClose: () => void;
  onNavigate: (number: number) => void;
  onAddReferences: () => Promise<LocalImage[]>;
  onImportDrawing: () => Promise<string | null>;
  initialImport?: string | null;
  onInitialImportUsed?: () => void;
  cutouts: { id: string; name: string; path: string }[];
  onKeepCutout: (data: string) => Promise<string | null>;
  onUseCutout: (id: string) => Promise<string | null>;
  onForgetCutout: (id: string) => void;
  onRemoveReference: (path: string) => void;
  onShare: () => Promise<void>;
};

type SaveAction = 'stay' | 'close' | 'share' | 'complete' | 'reference' | 'motion' | number;
export type Tool = 'pen' | 'fill' | 'eraser' | 'select';
type Brush = 'pen' | 'brush' | 'pencil';
type Panel = 'color' | 'width' | 'brush' | 'reference' | 'more' | 'caption' | null;
// 캔버스 아래 기본 도구 줄의 높이. 늘 같은 높이라 패널을 열고 닫아도 캔버스가 움직이지 않는다.
export const BASE_H = 115;
const transform = (id: string, name: string): LayerTransform => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
const source = { html: canvasHtml };
const C = T;
// 선택 이동이 '옮기기'로 갔는지 '새 마키'로 갔는지 기기에서 확인하기 위한 기록. 내부 검수 빌드에서만 켠다.
const PROBE = (Constants.expoConfig?.extra as { internalReview?: boolean } | undefined)?.internalReview === true;
// 패널이 열리고 닫힐 때만 짧게 미끄러진다. 200ms 는 눈이 변화를 따라갈 만큼이고, 기다렸다고
// 느낄 만큼은 아니다. 그림 자체에는 어떤 움직임도 걸지 않는다 — 작품이 흔들려 보이면 안 된다.
if (Platform.OS === 'android') UIManager?.setLayoutAnimationEnabledExperimental?.(true);
const ease = () => LayoutAnimation?.configureNext?.(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
const BRUSHES = [
  { key: 'pen' as const, title: '펜', art: require('../../assets/art/tool-pen.png'), stroke: require('../../assets/art/stroke-pen.png') },
  { key: 'brush' as const, title: '붓', art: require('../../assets/art/tool-brush.png'), stroke: require('../../assets/art/stroke-brush.png') },
  { key: 'pencil' as const, title: '연필', art: require('../../assets/art/tool-pencil.png'), stroke: require('../../assets/art/stroke-pencil.png') },
];
// PRO 브러시 프리셋. 엔진(canvas-html PRESETS)과 같은 key 를 쓴다. sample 은 카드 안의 짧은 견본 모양이다.
const PRO_BRUSHES = [
  { key: 'ink' as const, title: '매끈한 잉크', sample: { height: 4, borderRadius: 2, opacity: 1 } },
  { key: 'soft' as const, title: '부드러운 펜', sample: { height: 8, borderRadius: 4, opacity: .55 } },
  { key: 'grain' as const, title: '결 연필', sample: { height: 5, borderRadius: 1, opacity: .75 } },
  { key: 'marker' as const, title: '마커', sample: { height: 11, borderRadius: 1, opacity: .5 } },
];
const STAB_LEVELS = [['light', '약'], ['medium', '중'], ['strong', '강']] as const;
// 저장된 브러시 설정을 믿지 않고 한 칸씩 읽는다. 낯선 값은 없는 것으로 본다.
function cleanBrush(b?: BrushSettings): BrushSettings {
  const size = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(48, Math.round(n))) : undefined;
  return {
    preset: b?.preset && PRO_BRUSHES.some(p => p.key === b.preset) ? b.preset : undefined,
    opacity: typeof b?.opacity === 'number' && Number.isFinite(b.opacity) ? Math.max(.05, Math.min(1, b.opacity)) : undefined,
    stabilizer: b?.stabilizer && ['off', 'light', 'medium', 'strong'].includes(b.stabilizer) ? b.stabilizer : undefined,
    base: b?.base && BRUSHES.some(x => x.key === b.base) ? b.base : undefined,
    width: size(b?.width),
    eraserWidth: size(b?.eraserWidth),
  };
}
const swatches = [
  '#171717', '#4B4B4B', '#858585', '#C9C9C9', '#FFFFFF',
  '#E94F4F', '#FF6E7A', '#FF8C69', '#FFAA4D', '#FFD15C',
  '#A8D85F', '#65C47A', '#66BE9B', '#50C7C2', '#54A9E8',
  '#5D87D6', '#6D72D9', '#9870D8', '#BF6AD5', '#E768AD',
  '#765044', '#A77559', '#D7B79B', '#F0D8BF',
];

export function Painter({ slot, slotCount, setName, canon, canonName, canonLocked, palette, userPalette, onSaveUserColor, onRemoveUserColor, brushSettings, onBrushSettings, paperTexture, completeTitle, hasPrevious, previousImage, pro, onRequestPro, previousMotion, initialTool, onToolChange, savedMotions, onSaveMotion, onForgetMotion, onSave, onComplete, onSetReference, onCopyPrevious, onColorUsed, onClose, onNavigate, onAddReferences, onImportDrawing, initialImport, onInitialImportUsed, cutouts, onKeepCutout, onUseCutout, onForgetCutout, onRemoveReference, onShare }: Props) {
  const web = useRef<WebView>(null), inFlight = useRef(false), nextAction = useRef<SaveAction>('stay');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false), [initialized, setInitialized] = useState(false), [busy, setBusy] = useState(false);
  const [scene, setScene] = useState<Scene>({ undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: slot.work?.caption ?? null, layers: [], references: [] });
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // adjustResize 가 켜져 있어도 useWindowDimensions 는 화면 전체 높이를 돌려준다. 그 값으로 패널
  // 상한을 잡으면 키보드가 올라왔을 때 패널이 남은 자리보다 커져서, 바닥에 고정한 '적용'이
  // 키보드 뒤로 내려간다. 그래서 키보드 높이를 직접 받아 상한에서 뺀다.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates?.height ?? 0));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  // 패널이 쓸 수 있는 높이. 키보드가 없으면 화면의 절반, 있으면 남은 자리에서 머리글 몫을 뺀 만큼.
  const typing = keyboard > 0;
  // 키보드가 올라오면 남는 자리가 적다. 제목·입력칸·고정된 적용이 들어갈 만큼만 쓰고 나머지는 구른다.
  // 짧은 화면(640dp급)에서는 화면 비율만으로 잡으면 패널이 캔버스를 80% 넘게 덮는다(39차 화면 매트릭스).
  // 그래서 캔버스 아래 남는 자리 + 캔버스 절반을 넘지 않게 한 번 더 누른다 — 조절하는 동안 결과가 보이게.
  const coverRoom = () => canvasSide ? Math.max(160, Math.round((canvasArea - canvasSide) / 2 + canvasSide * .5)) : Infinity;
  const panelRoom = (share: number) => typing
    ? 240
    : Math.min(coverRoom(), Math.max(160, Math.round(windowHeight * share) - insets.bottom));
  // 세트에서 마지막으로 쓴 선 종류·굵기와 앱을 켠 동안 고른 도구로 연다 — 24칸을 그리는 동안 매번 다시 고르지 않는다.
  const startBrush = cleanBrush(brushSettings);
  const [tool, setTool] = useState<Tool>(initialTool && initialTool !== 'select' ? initialTool : 'pen'), [brush, setBrush] = useState<Brush>(startBrush.base ?? 'pen'), [color, setColor] = useState(palette[0] ?? '#242424');
  const [penWidth, setPenWidth] = useState(startBrush.width ?? 6), [eraserWidth, setEraserWidth] = useState(startBrush.eraserWidth ?? 24), [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<Panel>(null), [drawRail, setDrawRail] = useState(false), [refRail, setRefRail] = useState(false);
  const [showCanon, setShowCanon] = useState(false), [showQA, setShowQA] = useState(false), [qa, setQA] = useState<QA | undefined>(slot.qa);
  // 빈 칸을 열면 한 번 보여 주는 '이전 칸 그림으로 시작'. 닫거나 그리기 시작하면 사라진다.
  const [continueDismissed, setContinueDismissed] = useState(false);
  const [canvasArea, setCanvasArea] = useState(0);
  // 굵기를 끄는 동안에만 보이는 크기 원(px). 손을 떼면 null.
  const [sizing, setSizing] = useState<number | null>(null);
  const [brushDetail, setBrushDetail] = useState(false);
  // 저장 확신: 저장 중에는 작은 구름, 끝나면 체크가 잠깐 보였다가 사라진다. 늘 붙어 있는 '저장됨' 글자는 없다.
  const [saveMark, setSaveMark] = useState<'saving' | 'done' | null>(null);
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (markTimer.current) clearTimeout(markTimer.current); }, []);
  const markSaved = () => { setSaveMark('done'); if (markTimer.current) clearTimeout(markTimer.current); markTimer.current = setTimeout(() => setSaveMark(null), 1200); };
  const [tab, setTab] = useState<'draw' | 'motion'>('draw');
  const [proSheet, setProSheet] = useState(false);
  const pendingAction = useRef<SaveAction | null>(null), proHandled = useRef(false);
  const [captionOpen, setCaptionOpen] = useState(false), [captionDraft, setCaptionDraft] = useState(''), [captionPlace, setCaptionPlace] = useState<Caption['place']>('bottom');
  // 참고 줄의 두 갈래: 내 사진 / 기본 레퍼런스(관절 인형 — 에셋 들어오기 전에는 준비 중 자리표시).
  const [refSource, setRefSource] = useState<'mine' | 'builtin'>('mine');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [canvasSide, setCanvasSide] = useState<number | null>(null);
  const [layerMenu, setLayerMenu] = useState<string | null>(null);
  const [cutoutPicker, setCutoutPicker] = useState(false);
  const [hiddenWarning, setHiddenWarning] = useState('');
  const keeping = useRef<((data: string | null) => void) | null>(null);
  const selectedReference = scene.references.find(r => r.id === scene.activeReferenceId);

  const width = tool === 'eraser' ? eraserWidth : penWidth;
  const tap = (name: string) => { if (PROBE) console.log('SELPROBE ' + JSON.stringify({ type: 'ui', what: name, t: Date.now() })); };
  // 조용한 자동저장이 도는 동안 캔버스는 다른 명령을 받지 않는다. 그 사이 누른 도구·색·굵기는 버리지 않고 모았다가
  // 저장이 끝나면 보낸다. 자동저장 중에 누른 완성·닫기도 잃지 않고 저장이 끝난 뒤 이어서 한다.
  const held = useRef<object[]>([]), quiet = useRef(false), queued = useRef<SaveAction | null>(null);
  const saveRef = useRef<(action: SaveAction) => void>(() => {});
  const inject = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  const send = (message: { type: string } & Record<string, unknown>) => { if (quiet.current && !['save', 'saved', 'saveFailed'].includes(message.type)) { held.current.push(message); return; } inject(message); };
  const unlock = () => {
    if (timeout.current) clearTimeout(timeout.current); inFlight.current = false; setBusy(false);
    if (quiet.current) { quiet.current = false; held.current.splice(0).forEach(inject); }
    const next = queued.current; queued.current = null;
    if (next !== null) setTimeout(() => saveRef.current(next), 0);
  };

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  // Unsaved strokes must survive the app being swapped away or killed, so keep the work on disk
  // without ever interrupting the drawing rhythm. Both paths reuse the ordinary save pipeline.
  const autosave = useRef(() => {});
  const leaving = useRef(() => {});
  // 앱을 내릴 때는 선택이 열려 있어도 저장한다 — 앱이 사라질 수 있으므로 확정하는 편이 안전하다.
  leaving.current = () => { if (initialized && scene.dirty && !inFlight.current) save('stay'); };
  autosave.current = () => {
    if (!initialized || !scene.dirty || inFlight.current) return;
    if (scene.selection) return;   // 고르는 중에는 건너뛴다 — 확정해 버리면 하던 변형을 잃는다
    save('stay');
  };
  useEffect(() => {
    const timer = setInterval(() => autosave.current(), 40000);
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') leaving.current(); });
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
        const planned = slot.referenceKey === undefined ? i === 0 : image.path === slot.referenceKey;
        return savedRef ?? { ...transform('ref-' + image.path, `참고 ${i + 1}`), visible: planned, opacity: .3, image };
      });
      const decodedLayers = await Promise.all(layers.map(async l => ({ ...l, data: 'image' in l && l.image ? await dataUrl(l.image) : undefined })));
      const decodedRefs = await Promise.all(refs.map(async l => ({ ...l, path: l.image!.path, data: await dataUrl(l.image!) })));
      // The tool bar and the canvas must start on the same colour and the same widths. Sending
      // them with init is what keeps the set's last colour true on the next cut instead of only
      // looking selected.
      // 저장된 움직임도 함께 보낸다. 빠뜨리면 다시 연 칸의 캔버스에 움직임이 없고, 그 상태로 저장하는 순간
      // 저장 파일의 움직임과 움직이는 파일이 조용히 지워진다(재실행 뒤 '저장'만 눌러도).
      if (!canceled) send({ type: 'init', layers: decodedLayers, references: decodedRefs, activeLayerId: slot.work?.activeLayerId, caption: slot.work?.caption ?? null, motion: slot.motion ?? null, color, penWidth, eraserWidth });
    })().catch(e => Alert.alert('작업을 불러오지 못했어요', userMessage(e)));
    return () => { canceled = true; };
  }, [ready]);

  // 한 번 누르면 그 도구를 고르고, **이미 고른 도구를 다시 누르면 그 도구의 설정**을 연다(브러시 → 브러시, 지우개 → 크기).
  // 설정이 없는 도구(채우기·선택)는 다시 눌러도 그대로다.
  // 지우개 크기는 캔버스 가장자리 굵기 조절로 바꾸므로 지우개에는 따로 여는 시트가 없다.
  const settingsOf = (value: Tool): Panel => value === 'pen' ? 'brush' : null;
  function selectTool(value: Tool) {
    setDrawRail(false); setRefRail(false);
    if (value === tool) { const own = settingsOf(value); if (own) { ease(); setPanel(panel === own ? null : own); } return; }
    setTool(value); setPanel(null); send({ type: 'tool', tool: value }); onToolChange?.(value);
  }
  // 선 종류(펜·붓·연필)를 고르면 고급 브러시에서 내려온다 — 둘이 동시에 켜져 있지 않다. 시트는 열어 둔 채 굵기를 이어서 고른다.
  function selectBrush(value: Brush) {
    changeBrush({ preset: undefined, base: value }); setBrush(value); send({ type: 'brush', brush: value });
    if (tool !== 'pen') { setTool('pen'); send({ type: 'tool', tool: 'pen' }); onToolChange?.('pen'); }
  }
  // 막대를 끄는 동안에는 매 순간 저장 파일을 쓰지 않는다. 손이 멈추고 잠시 뒤 한 번만 최근 색에 남긴다.
  const remember = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (remember.current) clearTimeout(remember.current); }, []);
  function pickColor(value: string, settle = true) {
    setColor(value); send({ type: 'color', color: value });
    if (remember.current) clearTimeout(remember.current);
    if (settle) onColorUsed(value); else remember.current = setTimeout(() => onColorUsed(value), 700);
  }
  const [colorView, setColorView] = useState<'palette' | 'custom'>('palette');
  // PRO 브러시. 저장된 값은 PRO 가 끝나도 지우지 않고, 효력만 무료 범위(프리셋 없음 · 진하기 100% · 보정 끔/약)로 돌린다.
  const [brushPrefs, setBrushPrefs] = useState<BrushSettings>(() => cleanBrush(brushSettings));
  const brushSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (brushSave.current) clearTimeout(brushSave.current); }, []);
  // 진하기와 선 보정은 무료다(드로잉 앱의 기본 조절). 고급 브러시 네 가지만 PRO 이고, PRO 가 끝나면 효력만 기본 선으로 돌린다.
  const effectiveBrush = {
    preset: pro ? brushPrefs.preset : undefined,
    opacity: brushPrefs.opacity ?? 1,
    stabilizer: brushPrefs.stabilizer ?? 'light',
  };
  // 막대를 끄는 동안에는 저장 파일을 매번 쓰지 않는다. 손이 멈추면 한 번 남긴다.
  function changeBrush(patch: Partial<BrushSettings>, settle = true) {
    const next = { ...brushPrefs, ...patch };
    setBrushPrefs(next);
    if (brushSave.current) clearTimeout(brushSave.current);
    if (settle) onBrushSettings(next); else brushSave.current = setTimeout(() => onBrushSettings(next), 700);
  }
  function selectPreset(key: NonNullable<BrushSettings['preset']>) {
    if (!pro) { onRequestPro(); return; }
    changeBrush({ preset: key });
    setTool('pen'); send({ type: 'tool', tool: 'pen' });
  }
  const brushKey = JSON.stringify(effectiveBrush);
  useEffect(() => {
    if (!initialized) return;
    send({ type: 'brushSettings', preset: effectiveBrush.preset ?? null, opacity: effectiveBrush.opacity, stabilizer: effectiveBrush.stabilizer === 'off' ? 'light' : effectiveBrush.stabilizer, smoothing: effectiveBrush.stabilizer !== 'off' });
  }, [initialized, brushKey]);
  // 스포이드는 캔버스를 보고 눌러야 하므로 패널을 내린다. 색을 읽으면 패널이 직접 선택으로 다시 올라온다.
  function startEyedrop() {
    ease(); setPanel(null); setDrawRail(false); setRefRail(false);
    send({ type: 'eyedrop', on: true });
  }
  // settle=false: 끄는 동안(캔버스에는 바로, 저장은 손을 멈춘 뒤 한 번).
  function setWidth(next: number, settle = true) {
    const value = Math.max(1, Math.min(48, Math.round(next)));
    if (tool === 'eraser') setEraserWidth(value); else setPenWidth(value);
    send({ type: 'width', tool: tool === 'eraser' ? 'eraser' : 'pen', width: value });
    // 다음 칸과 재시작에서도 같은 굵기로 열리도록 세트에 남긴다.
    changeBrush(tool === 'eraser' ? { eraserWidth: value } : { width: value }, settle);
  }
  function changeTransform(id: string, patch: Partial<LayerTransform>) { send({ type: 'transform', id, ...patch }); }
  function addDrawing() { send({ type: 'addLayer', id: 'draw-' + (scene.layers.length + 1), name: `그림 ${scene.layers.length + 1}` }); }
  // The canvas holds the movement; this only asks it to change and to play while the tab is open.
  function switchTab(next: 'draw' | 'motion') {
    // 고르던 것이 남아 있으면 **탭을 넘기기 전에 내려놓는다.** 그냥 넘기면 점선·손잡이가 움직이기
    // 화면에 그대로 남고, 미리보기와 만들어지는 파일에도 섞인다. 내려놓는 자리는 지금 보이는 그 자리다.
    // 되돌리기 한 번으로 이 내려놓기까지 되돌아간다(엔진이 applySelection 에서 checkpoint 를 남긴다).
    if (scene.selection) send({ type: 'selectApply' });
    if (scene.captionPicked) send({ type: 'captionPick', on: false });
    ease();
    setTab(next); setPanel(null); setDrawRail(false); setRefRail(false);
    send({ type: next === 'motion' ? 'play' : 'stop' });
  }
  // 움직임은 고르는 즉시 칸에 들어간다. 따로 '적용'하지 않고 칸과 함께 자동저장·완성으로 저장된다.
  // '움직임 없음'은 엔진 재생을 멈춘다. 그 뒤 효과를 다시 고르면 재생도 다시 켜야 한다 —
  // 탭을 오갈 때만 play 를 보내면 캔버스 미리보기가 멈춘 채 남는다(39차 실기기에서 발견).
  function setMotion(motion: Motion | null) { send({ type: 'motion', motion }); if (motion && tab === 'motion') send({ type: 'play' }); }
  useEffect(() => { if (initialized) send({ type: 'paper', on: paperTexture }); }, [paperTexture, initialized]);
  // 굵기·색은 init 에 실려 간다. 선 종류와 도구는 캔버스가 준비된 뒤 한 번 맞춘다.
  useEffect(() => { if (!initialized) return; if (brush !== 'pen') send({ type: 'brush', brush }); if (tool !== 'pen') send({ type: 'tool', tool }); }, [initialized]);
  useEffect(() => { if (initialized && PROBE) send({ type: 'probe', on: true }); }, [initialized]);
  useEffect(() => { if ((drawRail || tab === 'motion') && initialized) send({ type: 'layerThumbs', size: 72 }); }, [drawRail, tab, initialized, scene.dirty, scene.layers.length]);
  // 작업실에서 그림으로 시작한 세트. 캔버스가 준비된 다음 한 번만 들여오고, 쓴 표시를 남겨
  // 다시 열었을 때 같은 그림이 또 들어오지 않게 한다.
  useEffect(() => {
    if (!initialized || !initialImport) return;
    send({ type: 'importDrawing', data: initialImport });
    onInitialImportUsed?.();
  }, [initialized, initialImport]);
  // A PRO effect that is already saved keeps working for ever. Only new or changed PRO content
  // asks for a subscription, and it asks before saving rather than dropping anything quietly.
  // PRO 부분(부분 움직임·두 모습·재생 순서)만 비교한다. 무료 효과·속도를 바꿨다고 이미 저장된 PRO 움직임을 다시 묻지 않는다.
  // 무료 사용자는 PRO 입구에서 PRO 안내로 가므로 정상 흐름에서는 여기에 닿지 않는다 — PRO 가 끝난 사용자를 위한 안전장치다.
  const proPart = (m?: Motion | null) => JSON.stringify(m ? { parts: m.parts ?? null, alternate: m.alternate ?? null, play: m.play ?? null, stagger: m.stagger ?? null } : null);
  const proIsNew = usesPro(scene.motion ?? undefined) && !pro && proPart(scene.motion) !== proPart(slot.motion);
  function saveWithoutPro() {
    const free = scene.motion ? { ...scene.motion, parts: undefined, alternate: undefined, play: undefined } : null;
    setProSheet(false);
    send({ type: 'motion', motion: free && free.preset ? free : null });
    // The canvas has the free motion now; this save is the answer to the question just asked,
    // so it must not be stopped by the state that is still on its way back.
    proHandled.current = true;
    save(pendingAction.current ?? 'stay');
  }
  function save(action: SaveAction = 'stay') {
    if (inFlight.current) { if (quiet.current && action !== 'stay') queued.current = action; return; }
    if (!initialized) { if (action === 'close') onClose(); return; }
    if (proIsNew && !proHandled.current) { pendingAction.current = action; setPanel(null); setDrawRail(false); setRefRail(false); setProSheet(true); return; }
    proHandled.current = false;
    inFlight.current = true; nextAction.current = action;
    // 자동저장('stay')은 화면을 잠그지 않는다. 칸을 떠나는 저장(닫기·완성·이동·공유)만 잠깐 잠근다.
    if (action === 'stay') quiet.current = true; else setBusy(true);
    setSaveMark('saving');
    timeout.current = setTimeout(() => { send({ type: 'saveFailed' }); setSaveMark(null); unlock(); Alert.alert('저장이 늦어지고 있어요', '작업은 그대로 있어요. 잠시 뒤 다시 시도해 주세요.'); }, 20000);
    send({ type: 'save', gif: !!scene.motion });
  }
  saveRef.current = save;
  // Copying is always something the user asks for, and it is always a separate document:
  // the canvas decodes fresh bitmaps, so editing the copy cannot reach the cut it came from.
  function copyPrevious() {
    if (inFlight.current) return;
    const run = async () => {
      inFlight.current = true; setBusy(true);
      try {
        const copied = await onCopyPrevious();
        if (!copied) { Alert.alert('복사할 그림이 없어요', '다른 칸에 저장된 그림이 아직 없어요.'); return; }
        send({ type: 'copyWork', layers: copied.layers, caption: copied.caption ?? null });
      } catch (e) { Alert.alert('이전 그림을 복사하지 못했어요', userMessage(e)); }
      finally { unlock(); }
    };
    if (scene.dirty || slot.finalImage) Alert.alert('이전 그림 복사', '지금 이 칸의 그림이 이전 칸 그림으로 바뀌어요. 되돌리기로 되살릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '복사', onPress: () => void run() }]);
    else void run();
  }
  function openCaption() {
    const current = scene.caption ?? slot.work?.caption ?? null;
    setCaptionDraft(current?.text ?? ''); setCaptionPlace(current?.place ?? 'bottom');
    ease(); setDrawRail(false); setRefRail(false); setPanel('caption'); setCaptionOpen(true);
  }
  function applyCaption(text: string) {
    const clean = text.trim();
    send({ type: 'caption', caption: clean ? { text: clean, place: captionPlace, color } : null });
    // 입력이 끝나면 키보드를 내리고 글씨를 고른 상태로 둔다 — 바로 캔버스에서 끌어 옮기고 손잡이로 크기를 바꾼다.
    Keyboard.dismiss();
    if (clean) send({ type: 'captionPick', on: true });
    ease(); setCaptionOpen(false); setPanel(null);
  }
  // A picture brought in as a drawing: it lands on its own layer and can be erased and drawn on.
  async function importDrawing() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setPanel(null);
    try { const data = await onImportDrawing(); if (data) send({ type: 'importDrawing', data }); }
    catch (e) { Alert.alert('그림을 가져오지 못했어요', userMessage(e)); }
    finally { unlock(); }
  }
  // 시안 A3의 '내 그림으로 보관'. 고른 부분을 그림 한 장으로 떠서 앱에 남긴다. 원래 그림도, 레이어도,
  // 지금 고른 상태도 그대로다 — 떠내는 것이지 잘라내는 것이 아니다.
  async function useCutout(id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try { const data = await onUseCutout(id); if (data) send({ type: 'importDrawing', data }); }
    catch (e) { Alert.alert('그림을 가져오지 못했어요', userMessage(e)); }
    finally { unlock(); }
  }
  async function keepCutout() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const data = await new Promise<string | null>(resolve => {
        keeping.current = resolve;
        send({ type: 'selectionImage', id: Date.now() });
        setTimeout(() => { if (keeping.current === resolve) { keeping.current = null; resolve(null); } }, 8000);
      });
      if (!data) return;
      const name = await onKeepCutout(data);
      if (name) Alert.alert('보관했어요', `'${name}'으로 보관했어요. 다른 칸의 더보기 › 그림 가져오기에서 꺼내 써요.`);
    } catch (e) { Alert.alert('보관하지 못했어요', userMessage(e)); }
    finally { unlock(); }
  }
  async function addReferences() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const added = await onAddReferences();
      if (added.length) send({ type: 'addReferences', references: await Promise.all(added.map(async (image, i) => ({
        ...transform('ref-' + image.path, `참고 ${scene.references.length + i + 1}`), visible: false, opacity: .3, path: image.path, data: await dataUrl(image),
      }))) });
    } catch (e) { Alert.alert('참고 사진을 넣지 못했어요', userMessage(e)); }
    finally { unlock(); }
  }
  function removeReference(path: string, id: string) {
    Alert.alert('참고 삭제', '이 세트의 모든 칸에서 이 참고를 없앱니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { onRemoveReference(path); send({ type: 'removeReference', id }); setPanel(null); } },
    ]);
  }

  // 브러시 시트의 할 일은 '브러시 고르기'다. 굵기는 캔버스 가장자리에서, 진하기·선 보정은 세부 설정 안에서 바꾼다.
  // 세부 설정을 열지 않아도 저장된 값은 그대로 적용된다.
  const stabName = effectiveBrush.stabilizer === 'off' ? '끔' : STAB_LEVELS.find(([level]) => level === effectiveBrush.stabilizer)?.[1] ?? '약';
  // 선 종류는 하나의 낮고 넓은 세그먼트다. 독립 카드 세 장으로 두지 않는다(40차). 고급 브러시는 네 번째 칸이 아니라 아래 조용한 한 줄.
  const stab = effectiveBrush.stabilizer;
  const brushSheet = <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
    <Segmented testID="선 종류" value={effectiveBrush.preset ? null : brush} onChange={selectBrush}
      items={BRUSHES.map(b => ({ key: b.key, label: b.title, image: b.art }))} />
    {pro
      ? <View testID="고급 브러시" style={{ flexDirection: 'row', gap: 6 }}>
          {PRO_BRUSHES.map(b => { const on = effectiveBrush.preset === b.key;
            return <Pressable key={b.key} accessibilityRole="button" accessibilityLabel={'브러시 ' + b.title} accessibilityState={{ selected: on }} onPress={() => selectPreset(b.key)}
              style={{ flex: 1, minHeight: 52, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : C.paper, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <View style={{ width: '62%', backgroundColor: color, ...b.sample }} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{b.title}</Text>
            </Pressable>; })}
        </View>
      // 무료 브러시와 같은 무게로 경쟁하지 않는 한 줄. 누르면 PRO 안내로 간다.
      : <Pressable accessibilityRole="button" accessibilityLabel="고급 브러시 PRO" onPress={onRequestPro}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderRadius: 12, backgroundColor: pressed ? C.fill : 'transparent' })}>
          <MaterialCommunityIcons name="brush-variant" size={18} color={C.muted} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>고급 브러시</Text>
          <ProTag />
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />
        </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="세부 설정" accessibilityState={{ expanded: brushDetail }} onPress={() => { ease(); setBrushDetail(!brushDetail); }}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderTopWidth: 1, borderColor: C.line }}>
      <MaterialCommunityIcons name="tune-variant" size={18} color={C.muted} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>세부 설정</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.faint, textAlign: 'right' }}>진하기 {Math.round(effectiveBrush.opacity * 100)}% · 선 보정 {stabName}</Text>
      <MaterialCommunityIcons name={brushDetail ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
    </Pressable>
    {brushDetail && <View style={{ gap: 4 }}>
      <Range label="진하기" value={Math.round(effectiveBrush.opacity * 100)} min={5} max={100} step={1} onChange={n => changeBrush({ opacity: Math.round(n) / 100 }, false)} display={Math.round(effectiveBrush.opacity * 100) + '%'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="switch" accessibilityLabel="선 보정" accessibilityState={{ checked: stab !== 'off' }} onPress={() => changeBrush({ stabilizer: stab === 'off' ? 'light' : 'off' })}
          style={{ minHeight: C.tap, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 2 }}>
          <Switch on={stab !== 'off'} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.muted }}>선 보정</Text>
        </Pressable>
        {stab !== 'off' && <View style={{ flex: 1 }}>
          <Segmented dense value={stab} onChange={level => changeBrush({ stabilizer: level })} items={STAB_LEVELS.map(([level, name]) => ({ key: level, label: name, a11y: '보정 ' + name }))} />
        </View>}
      </View>
    </View>}
  </View>;
  // 캔버스가 주인공이다. 아래 기본 도구 줄(BASE_H)은 늘 같은 높이로 자리를 차지하고, 패널은 그 위에 겹쳐 뜬다.
  const dockOpen = !!scene.selection || (!!panel && panel !== 'more') || drawRail || refRail || !!hiddenWarning || !!scene.captionPicked;
  // 움직이기 탭에서는 캔버스를 위로 붙이고, 패널은 캔버스 아래 남는 자리(+ 기본 도구 줄 자리)를 쓴다 — 미리보기를 가리지 않는다.
  // 남는 자리가 작은 화면에서만 최소 높이만큼 캔버스 아래쪽에 겹친다.
  const motionHeight = Math.max(250, Math.min(Math.round(windowHeight * .55), Math.round(canvasArea - (canvasSide ?? canvasArea)) + BASE_H));
  // 패널 표면: 흰 표면 + 위쪽 24 둥글기 + 옅은 선 하나. 떠 있는 표면이지만 캔버스 위 그림자는 두지 않는다(그림이 흐려 보인다).
  const raised = dockOpen || tab === 'motion';
  const dock = { position: 'absolute', left: 0, right: 0, bottom: tab === 'draw' && !typing ? BASE_H : 0, zIndex: 20, borderTopWidth: raised ? 1 : 0, borderLeftWidth: raised ? 1 : 0, borderRightWidth: raised ? 1 : 0, borderColor: C.line, borderTopLeftRadius: raised ? 24 : 0, borderTopRightRadius: raised ? 24 : 0, overflow: 'hidden', backgroundColor: C.paper, flexShrink: 0 } as const;
  const narrow = windowWidth < 360;
  const emptyCut = !slot.work && !slot.finalImage;
  // 제안할 수 있는 상태(continueAvailable)와 지금 캔버스에 보이는지(offerContinue)를 나눈다. 더보기 메뉴는 앞의 것으로 가려서,
  // 메뉴를 여는 순간 같은 기능의 두 번째 입구가 생기지 않게 한다.
  const continueAvailable = initialized && emptyCut && hasPrevious && !!previousImage && !continueDismissed && !scene.dirty && !scene.undo;
  const offerContinue = continueAvailable && tab === 'draw' && !panel && !refRail && !drawRail;
  // 효과 견본에 쓸 이 칸의 그림: 저장된 그림이 지금 것과 같으면 그 파일, 아직 저장 전이면 지금 레이어의 작은 그림.
  const sample = !scene.dirty && slot.finalImage ? imageUri(slot.finalImage.path) : thumbs[scene.activeLayerId] ?? (slot.finalImage ? imageUri(slot.finalImage.path) : undefined);
  type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  const brushIcon: IconName = effectiveBrush.preset ? 'brush-variant' : brush === 'pen' ? 'fountain-pen-tip' : brush === 'brush' ? 'brush' : 'pencil';
  const tools: [Tool, string, IconName][] = [['pen', '브러시', brushIcon], ['eraser', '지우개', 'eraser'], ['fill', '채우기', 'format-color-fill'], ['select', '선택', 'select-drag']];
  return <Modal onRequestClose={() => { if (Keyboard.isVisible()) { Keyboard.dismiss(); return; } if (panel) { ease(); setPanel(null); return; } if (drawRail || refRail) { ease(); setDrawRail(false); setRefRail(false); return; } if (showCanon) { setShowCanon(false); return; } save('close'); }} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* 머리: 닫기 · 세트 이름과 칸 번호 · 되돌리기 · 다시 · 더보기. 저장 버튼은 없다 — 작업은 자동저장된다. */}
      <View style={{ minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }}>
        <Bar label="그리기 닫기" icon="chevron-left" strong disabled={busy} onPress={() => save('close')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: C.tap }}>
          <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: C.ink, fontWeight: '700' }}>{setName}</Text>
          <Text accessibilityLabel="현재 칸" style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: C.faint, letterSpacing: .4 }}>{String(slot.number).padStart(2, '0') + ' / ' + slotCount}</Text>
        </View>
        <View testID="저장 표시" accessibilityLabel={saveMark === 'saving' ? '저장 중' : saveMark === 'done' ? '저장됨' : undefined} style={{ width: 28, height: C.tap, alignItems: 'center', justifyContent: 'center' }}>
          {saveMark === 'saving' && <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={C.faint} />}
          {saveMark === 'done' && <MaterialCommunityIcons name="cloud-check-outline" size={17} color={C.success} />}
        </View>
        <Bar label="더보기" icon="dots-horizontal" active={panel === 'more'} onPress={() => { setPanel(panel === 'more' ? null : 'more'); setDrawRail(false); setRefRail(false); }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 6 }}>
        {([['draw', '그리기'], ['motion', '움직이기']] as const).map(([key, title]) =>
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: tab === key }}
            onPress={() => switchTab(key)}
            style={{ minHeight: 48, paddingHorizontal: narrow ? 9 : 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: tab === key ? '800' : '600', color: tab === key ? C.ink : C.faint }}>{title}</Text>
            <View pointerEvents="none" style={{ position: 'absolute', left: narrow ? 9 : 12, right: narrow ? 9 : 12, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: tab === key ? C.accent : 'transparent' }} />
          </Pressable>)}
        <View style={{ flex: 1 }} />
        {/* 참고·레이어·문구는 여기 한 곳에서만 연다. */}
        {tab === 'draw' && ([['참고', refRail || showCanon, 'image-outline', () => { ease(); setRefRail(!refRail); setDrawRail(false); setPanel(null); }],
           ['레이어', drawRail, 'layers-outline', () => { ease(); setDrawRail(!drawRail); setRefRail(false); setPanel(null); }],
           ['문구', panel === 'caption' || !!scene.captionPicked, 'format-text', () => { if (panel === 'caption') { ease(); setPanel(null); setCaptionOpen(false); } else openCaption(); }]] as const).map(([title, on, icon, run]) =>
          <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: on }} onPress={run}
            style={{ minHeight: 48, paddingHorizontal: narrow ? 1 : 2, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ height: 32, paddingHorizontal: narrow ? 7 : 9, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: on ? C.accentSoft : 'transparent' }}>
              {!narrow && <MaterialCommunityIcons name={icon} size={16} color={on ? C.ink : C.muted} />}
              <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
            </View>
          </Pressable>)}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: tab === 'motion' ? 'flex-start' : 'center', backgroundColor: C.surface2 }}
        onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; const side = Math.floor(Math.min(w, h)); if (side > 0 && side !== canvasSide) setCanvasSide(side); if (h > 0 && Math.round(h) !== canvasArea) setCanvasArea(Math.round(h)); }}>
        {/* 캔버스 틀: 네이티브 WebView 는 크기 지정을 무시하고 영역 전체를 채워, 캔버스가 위에 붙고 아래에 빈 띠가 남았다(40차 실기기 bounds 0,381–1080,1882).
            정사각 틀로 감싸 잘라 두면 WebView 가 틀만큼만 차지하고, 그리기 탭에서는 영역 가운데·움직이기 탭에서는 위에 선다. */}
        <View style={canvasSide ? { width: canvasSide, height: canvasSide, overflow: 'hidden', backgroundColor: C.surface2 } : { width: '100%', aspectRatio: 1, maxHeight: '100%', overflow: 'hidden' }}>
        <WebView ref={web} source={source} originWhitelist={['about:*']} javaScriptEnabled scrollEnabled={false} onShouldStartLoadWithRequest={r => r.url === 'about:blank'} onError={e => { unlock(); setInitialized(false); Alert.alert('그리기 화면을 열지 못했어요', userMessage(e.nativeEvent.description, '닫았다가 다시 열어 주세요.')); }} onMessage={event => {
          try {
            const m = JSON.parse(event.nativeEvent.data);
            if (m.type === 'probe' || m.type === 'trace') { console.log('SELPROBE ' + JSON.stringify(m)); return; }
            if (m.type === 'ready') setReady(true);
            if (m.type === 'initialized') setInitialized(true);
            if (m.type === 'state') setScene(m);
            if (m.type === 'layerThumbs') setThumbs(Object.fromEntries((m.thumbs ?? []).map((t: { id: string; data: string }) => [t.id, t.data])));
            if (m.type === 'blocked' && m.reason === 'hidden') setHiddenWarning(m.name ?? '');
            if (m.type === 'selectionImage') { const waiting = keeping.current; keeping.current = null; waiting?.(m.data ?? null); if (!m.data) Alert.alert('보관하지 못했어요', '고른 부분을 읽지 못했어요. 다시 골라 주세요.'); }
            if (m.type === 'pivot' && scene.motion) {
              const patch = m.role === 'from' ? { fromX: m.x, fromY: m.y } : m.role === 'to' ? { toX: m.x, toY: m.y } : { pivotX: m.x, pivotY: m.y };
              const parts = (scene.motion.parts ?? []).map(p => p.id === m.id ? { ...p, ...patch } : p);
              setMotion({ ...scene.motion, parts });
            }
            if (m.type === 'zoom' && Number.isFinite(m.zoom)) setZoom(m.zoom);
            // 이미 고른 글씨를 한 번 더 누르면 내용 고치기.
            if (m.type === 'captionEdit') openCaption();
            if (m.type === 'picked') {
              // 읽은 것은 색 계열이다. 지금 쓰던 투명도는 그대로 둔다.
              if (m.color) pickColor(withAlpha(m.color, alphaOf(color)));
              else Alert.alert('색이 없는 곳이에요', '그림이나 참고 사진이 보이는 곳을 눌러 주세요.');
              setColorView('custom'); setPanel('color');
            }
            if (m.type === 'error') { unlock(); Alert.alert('그리지 못했어요', userMessage(m.message)); }
            if (m.type === 'save' && inFlight.current) {
              try {
                let action = nextAction.current;
                // An empty canvas is not a finished cut. Keep the work, refuse the declaration only.
                const blank = !(m.metrics?.coverage > 0);
                if (action === 'complete' && blank) action = 'stay';
                if (m.dirty !== false || action === 'stay' || action === 'share' || action === 'complete' || action === 'reference') {
                  const result = onSave(m, slot.dialogue, action === 'complete'); setQA(result);
                }
                send({ type: 'saved' }); unlock(); markSaved();
                if (nextAction.current === 'complete' && blank) { Alert.alert('아직 빈 칸이에요', '선을 하나라도 그리면 완성할 수 있어요.'); return; }
                if (action === 'motion') switchTab('draw');
                else if (action === 'close') onClose();
                else if (action === 'complete') onComplete();
                else if (action === 'reference') onSetReference();
                else if (typeof action === 'number') onNavigate(action);
                else if (action === 'share') onShare().catch(e => Alert.alert('공유하지 못했어요', userMessage(e)));
              } catch (e) { send({ type: 'saveFailed' }); setSaveMark(null); unlock(); Alert.alert('저장하지 못했어요', userMessage(e)); }
            }
          } catch (e) { unlock(); Alert.alert('그리지 못했어요', userMessage(e)); }
        }} style={{ flex: 1, backgroundColor: C.surface2 }} />
        </View>

        {/* 굵기: 캔버스 왼쪽 가장자리에서 끌어 바꾼다. 브러시·지우개가 같은 자리를 쓰고, 끄는 동안에만 크기 원과 px 이 보인다. */}
        {tab === 'draw' && initialized && (tool === 'pen' || tool === 'eraser') && !scene.selection && !scene.picking && !scene.captionPicked && panel !== 'more' &&
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
            <SizeControl label={tool === 'eraser' ? '지우개 굵기' : '브러시 굵기'} value={width} height={Math.round(Math.max(120, Math.min(220, (canvasSide ?? 300) * .42)))} onChange={setWidth} onActive={setSizing} />
          </View>}
        {sizing !== null && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {/* 짙은 반투명 떠 있는 표시. 밝은 그림·흰 캔버스 어디서나 원과 숫자가 읽힌다. 손을 떼면 바로 사라진다. */}
          <View testID="굵기 미리보기" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 88, minHeight: 88, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, backgroundColor: '#171717C7' }}>
            <View style={{ width: Math.max(2, sizing * (canvasSide ?? KAKAO_STATIC_SPEC.width) / KAKAO_STATIC_SPEC.width), height: Math.max(2, sizing * (canvasSide ?? KAKAO_STATIC_SPEC.width) / KAKAO_STATIC_SPEC.width), borderRadius: 999, backgroundColor: tool === 'eraser' ? '#FFFFFF' : color, borderWidth: 1.5, borderColor: '#FFFFFFB3' }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: .3 }}>{sizing}px</Text>
          </View>
        </View>}
        {/* 빈 칸: 이전 칸 그림에서 이어 그릴 수 있게 한 번 제안한다. 누를 때만 복사하고, 비어 있는 칸이라 잃을 것이 없다. */}
        {offerContinue && <View style={{ position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 18, backgroundColor: T.floating, borderWidth: 1, borderColor: C.line }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden' }}>
            <Image accessibilityLabel="이전 칸 그림" source={{ uri: imageUri(previousImage!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 칸 그림으로 시작" onPress={() => { setContinueDismissed(true); copyPrevious(); }} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>이전 칸 그림으로 시작</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>같은 캐릭터를 이어 그려요</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 칸 그림 안 쓰기" onPress={() => setContinueDismissed(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="close" size={18} color={C.faint} />
          </Pressable>
        </View>}
        {/* 표현 가이드 자리(다음 라운드). 꺼져 있으면 아무것도 그리지 않는다. */}
        {EXPRESSION_GUIDE.enabled && tab === 'draw' && !offerContinue && !panel && <ExpressionHint />}

        {showCanon && !!canon && <>
          <Pressable accessibilityRole="button" accessibilityLabel="캐릭터 기준 바깥 닫기" onPress={() => setShowCanon(false)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ position: 'absolute', right: 8, top: 8, width: 208, padding: 10, borderRadius: C.radius.md, backgroundColor: '#FFFFFFF2', borderWidth: 1, borderColor: C.line, elevation: 10, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.ink }}>캐릭터 기준{canonName ? ' · ' + canonName : ''}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="캐릭터 기준 닫기" onPress={() => setShowCanon(false)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
            <View style={{ height: 120, borderRadius: C.radius.sm, backgroundColor: C.bg, overflow: 'hidden' }}>
              <Image accessibilityLabel="캐릭터 기준 그림" source={{ uri: imageUri(canon.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
            {canonLocked.trim().split(/[,·\n]+/).filter(Boolean).slice(0, 3).map(trait => <Text key={trait} numberOfLines={1} style={{ fontSize: 11, color: C.ink }}>· {trait.trim()}</Text>)}
          </View>
        </>}
        {refRail && !!selectedReference?.visible && <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F0FCEE', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }}>
          <MaterialCommunityIcons name="gesture-pinch" size={14} color={T.info} />
          <Text style={{ fontSize: 10, color: T.info, fontWeight: '800' }}>옮기기 · 크기</Text>
        </View>}

        {!!scene.picking && <View style={{ position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, borderRadius: 18, backgroundColor: T.floating, borderWidth: 1, borderColor: C.line }}>
          <MaterialCommunityIcons name="eyedropper-variant" size={18} color={C.ink} />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: C.ink }}>캔버스에서 색을 누르세요</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="스포이드 취소" onPress={() => { send({ type: 'eyedrop', on: false }); setPanel('color'); }} style={{ minHeight: C.tap, paddingHorizontal: 12, justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.muted }}>취소</Text></Pressable>
        </View>}

        {panel === 'more' && <View testID="더보기 배경" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#00000055' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="더보기 바깥 닫기" onPress={() => { ease(); setPanel(null); }} style={{ flex: 1 }} />
          <View testID="더보기 메뉴" style={{ maxHeight: '78%', paddingBottom: 8, paddingHorizontal: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: C.paper, overflow: 'hidden' }}>
          <SheetHeader title={String(slot.number).padStart(2, '0') + '번 칸'} closeLabel="더보기 닫기" onClose={() => { ease(); setPanel(null); }} />
          <ScrollView showsVerticalScrollIndicator={false}>
          <MenuPair left="이전 칸" right="다음 칸"
            onLeft={slot.number > 1 ? () => { setPanel(null); save(slot.number - 1); } : undefined}
            onRight={slot.number < slotCount ? () => { setPanel(null); save(slot.number + 1); } : undefined} />
          <MenuButton icon="image-plus" title="그림 가져오기" onPress={() => { setPanel(null); if (cutouts.length) setCutoutPicker(true); else void importDrawing(); }} />
          {hasPrevious && !continueAvailable && <MenuButton icon="content-copy" title="이전 그림 복사" onPress={() => { setPanel(null); copyPrevious(); }} />}
          <MenuButton icon="magnify-plus-outline" title={`크게 보기 ${zoom.toFixed(1)}배`} onPress={() => { const n = zoom >= 3 ? 1 : zoom + 1; setZoom(n); send({ type: 'zoom', zoom: n }); setPanel(null); }} />
          <MenuButton icon="share-variant" title="이 칸 공유" onPress={() => { setPanel(null); save('share'); }} />
          <MenuButton icon="clipboard-check-outline" title="이 칸 검사" onPress={() => { setPanel(null); setShowQA(true); }} />
          <MenuButton danger icon="delete-outline" title="지금 레이어 비우기" onPress={() => { setPanel(null); Alert.alert('지금 레이어 비우기', '지금 고른 레이어의 그림이 지워져요. 되돌리기로 되살릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '비우기', style: 'destructive', onPress: () => send({ type: 'clear' }) }]); }} />
          </ScrollView>
          </View>
        </View>}
      </View>

      {tab === 'motion' ? <View style={[dock, { height: motionHeight, flexShrink: 0 }]} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        <MotionPanel motion={scene.motion ?? null} layers={scene.layers} clipped={!!scene.clipped} pro={pro} sample={sample} hasCaption={!!scene.caption?.text}
          pivotPick={scene.pivotPick ?? null} pivotRole={scene.pivotRole ?? 'pivot'}
          onPickPivot={(id, role) => send({ type: 'pivotPick', id, role: role ?? 'pivot' })}
          onDuplicateForPose={() => send({ type: 'duplicateLayer', id: scene.activeLayerId })}
          onEditPose={ids => { if (ids[0]) send({ type: 'select', id: ids[0] }); switchTab('draw'); setDrawRail(true); }}
          savedMotions={savedMotions} onSaveMotion={() => scene.motion && onSaveMotion(scene.motion)}
          onUseMotion={saved => setMotion(saved.motion)} onForgetMotion={onForgetMotion}
          onChange={setMotion} onRequestPro={onRequestPro}
          thumbs={thumbs} previousMotion={previousMotion ?? null} onFocusPart={layerId => send({ type: 'focusPart', layerId })}
          completeTitle={completeTitle} onComplete={() => save('complete')} completeBusy={busy || !initialized} />
      </View> : <View style={dock} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        {scene.selection ? <View style={{ maxHeight: panelRoom(0.5) }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 8 }}>
          {/* 옮기기는 캔버스에서 끌어서 한다. 여기에는 누르는 변형만 둔다. */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['작게', 'magnify-minus-outline', { scale: .9 }], ['크게', 'magnify-plus-outline', { scale: 1.1 }], ['왼쪽 회전', 'rotate-left', { rot: -15 }], ['오른쪽 회전', 'rotate-right', { rot: 15 }], ['좌우 반전', 'flip-horizontal', { flip: true }]] as const).map(([title, icon, change]) =>
              <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={() => send({ type: 'selectTransform', ...change })}
                style={({ pressed }) => ({ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 14, backgroundColor: pressed ? C.fillPressed : C.surface2 })}>
                <MaterialCommunityIcons name={icon} size={20} color={C.ink} />
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: C.muted }}>{title}</Text>
              </Pressable>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Minor title="내 그림으로 보관" onPress={() => void keepCutout()} />
            <Minor title="새 레이어로 분리" onPress={() => send({ type: 'selectApply', toNewLayer: true })} />
          </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6, backgroundColor: C.paper }}>
            <Pressable accessibilityRole="button" accessibilityLabel="선택 취소" onPress={() => { tap('button:선택 취소'); send({ type: 'selectCancel' }); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>취소</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="선택 적용" onPress={() => { tap('button:선택 적용'); send({ type: 'selectApply' }); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>적용</Text></Pressable>
          </View>
        </View> : panel === 'color' ? <View style={{ maxHeight: panelRoom(0.42) }}><ScrollView keyboardShouldPersistTaps="handled"><ColorPanel color={color} recent={palette} saved={userPalette} view={colorView} onView={setColorView} onPick={pickColor} onEyedrop={startEyedrop} onSave={onSaveUserColor} onForget={onRemoveUserColor} onClose={() => { ease(); setPanel(null); }} /></ScrollView></View>
        : panel === 'caption' ? <View style={{ backgroundColor: C.paper, maxHeight: panelRoom(0.5) }}>
          {/* 미확정 변경은 '문구 적용'으로만 확정된다. 닫으면 고치던 글자는 버려지고 화면의 문구는 그대로 남는다.
              키보드가 올라오면 머리·지우기·아래 버튼을 접고 입력 한 줄(색 · 입력 · 키보드 닫기 · 적용)만 남긴다 —
              캔버스가 띠로 줄어 고치는 글씨가 잘리던 39차 P2. 입력칸은 같은 자리에 남아 포커스를 잃지 않는다. */}
          {!typing && <SheetHeader title="문구" closeLabel="문구 닫기" onClose={() => { ease(); setPanel(null); setCaptionOpen(false); }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: typing ? 8 : 16, paddingTop: typing ? 8 : 0, paddingBottom: 8 }}>
            <View accessibilityLabel="문구 색" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF', ...{ shadowColor: '#000', shadowOpacity: .15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } } }} />
            <TextInput accessibilityLabel="문구 내용" value={captionDraft} onChangeText={setCaptionDraft} multiline={false} autoFocus returnKeyType="done" onSubmitEditing={() => applyCaption(captionDraft)} placeholder="예: 고마워" placeholderTextColor={C.faint} style={{ flex: 1, fontSize: 17, minHeight: C.tap, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.surface2, color: C.ink }} />
            {typing && <IconButton label="키보드 닫기" icon="keyboard-close" color={C.muted} size={20} onPress={() => Keyboard.dismiss()} />}
            {typing && <Pressable accessibilityRole="button" accessibilityLabel="문구 적용" onPress={() => applyCaption(captionDraft)}
              style={({ pressed }) => ({ minHeight: C.tap, paddingHorizontal: 16, borderRadius: 14, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center' })}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>적용</Text>
            </Pressable>}
          </View>
          {!typing && !!(scene.caption?.text) && <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 }}>
            <Minor danger title="문구 지우기" onPress={() => { setCaptionDraft(''); applyCaption(''); }} />
          </View>}
          {!typing && <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6, backgroundColor: C.paper }}>
            <Action primary title="문구 적용" onPress={() => applyCaption(captionDraft)} />
          </View>}
        </View>

        : panel === 'brush' ? <Sheet tall room={coverRoom()} title="브러시" onClose={() => { ease(); setPanel(null); }}>
          {brushSheet}
        </Sheet>
        : panel === 'reference' && selectedReference ? <Sheet room={coverRoom()} title="참고 사진" onClose={() => { ease(); setPanel(null); }}>
          <View style={{ paddingHorizontal: 8, gap: 8 }}>
          <Minor title="위치 초기화" onPress={() => { changeTransform(selectedReference.id, { x: 0, y: 0, scale: 1, rotation: 0 }); setPanel(null); }} />
          <Minor title="참고 삭제" danger onPress={() => { const image = slot.referenceImages.find(i => i.path === selectedReference.path); if (image) removeReference(image.path, selectedReference.id); }} />
          </View>
        </Sheet> : <>
        {/* 숨긴 레이어 위에 그으면 아무 일도 일어나지 않는다. 왜 그런지 여기서 말하고 바로 되돌린다. */}
        {!!hiddenWarning && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, marginTop: 4, paddingLeft: 10, borderRadius: C.radius.sm, backgroundColor: C.accentSoft }}>
          <MaterialCommunityIcons name="eye-off-outline" size={16} color={C.accentInk} />
          <Text style={{ flex: 1, fontSize: 12, color: C.accentInk }}>'{layerLabel(hiddenWarning)}'이 숨겨져 있어요</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="숨긴 레이어 다시 보이기" onPress={() => { changeTransform(scene.activeLayerId, { visible: true }); setHiddenWarning(''); }} style={{ minHeight: C.tap, paddingHorizontal: 12, justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>보이기</Text></Pressable>
        </View>}

        {drawRail && <View style={{ maxHeight: Math.min(216, coverRoom()) }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 6 }}>
            {scene.layers.map(layer => {
              const active = layer.id === scene.activeLayerId, name = layerLabel(layer.name);
              return <View key={layer.id} style={{ paddingBottom: layerMenu === layer.id ? 6 : 0, borderRadius: 14, borderWidth: 1, borderColor: active ? C.accentBorder : C.line, backgroundColor: active ? C.accentSoft : C.paper }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 선택`} accessibilityState={{ selected: active }}
                  onPress={() => { send({ type: 'select', id: layer.id }); setDrawRail(false); }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingLeft: 6 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.surface2, overflow: 'hidden', opacity: layer.visible ? 1 : .35 }}>
                    {thumbs[layer.id] ? <Image source={{ uri: thumbs[layer.id] }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: active ? '700' : '500', color: layer.visible ? C.ink : C.faint }}>{name}</Text>
                  {active && <MaterialCommunityIcons name="pencil" size={16} color={C.ink} />}
                </Pressable>
                <EyeToggle label={`${name} ${layer.visible ? '숨기기' : '보이기'}`} on={layer.visible} onPress={() => changeTransform(layer.id, { visible: !layer.visible })} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 관리`} onPress={() => setLayerMenu(layerMenu === layer.id ? null : layer.id)} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={20} color={C.muted} /></Pressable>
              </View>
            {layerMenu === layer.id && <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 6 }}>
              <Minor title="이름 바꾸기" onPress={() => { setLayerMenu(null); setRenaming({ id: layer.id, name: layer.name }); }} />
              {scene.layers.length < 4 && <Minor title="복제" onPress={() => { setLayerMenu(null); send({ type: 'duplicateLayer', id: layer.id }); }} />}
              {scene.layers.length > 1 && <Minor danger title="지우기" onPress={() => { setLayerMenu(null); Alert.alert(name + ' 지우기', '이 레이어와 레이어에 준 부분 움직임이 함께 지워져요. 되돌리기로 되살릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '지우기', style: 'destructive', onPress: () => send({ type: 'removeLayer', id: layer.id }) }]); }} />}
            </View>}
            </View>;
            })}
            {scene.layers.length < 4 && <Pressable accessibilityRole="button" accessibilityLabel="레이어 추가" onPress={addDrawing} style={{ minHeight: C.tap, flexDirection: 'row', gap: 6, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="plus" size={16} color={C.muted} /><Text style={{ fontSize: 13, fontWeight: '600', color: C.muted }}>레이어 추가</Text></Pressable>}
          </ScrollView>
        </View>}
        {refRail && BUILTIN_REFERENCES.enabled && <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <Segmented dense value={refSource} onChange={setRefSource} items={[{ key: 'mine', label: '내 사진', icon: 'image-outline' }, { key: 'builtin', label: '기본 레퍼런스', icon: 'human-handsup' }]} />
        </View>}
        {refRail && refSource === 'builtin' && BUILTIN_REFERENCES.enabled && <BuiltinReferences />}
        {refRail && (refSource === 'mine' || !BUILTIN_REFERENCES.enabled) && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            {/* 캐릭터 기준: 세트 전체가 따르는 그림 한 장. 따라 그릴 사진(참고)과 다른 것이라 앞에 따로 둔다. */}
            {!!canon && <RailTile label="캐릭터 기준 보기" caption="캐릭터 기준" image={imageUri(canon.path)} selected={showCanon} onPress={() => setShowCanon(!showCanon)} />}
            <RailTile label="이 칸을 캐릭터 기준으로" caption={canon ? '기준 바꾸기' : '기준 정하기'} icon="bookmark-outline" onPress={() => { setRefRail(false); setShowCanon(false); save('reference'); }} />
            <View style={{ width: 1, height: 52, marginHorizontal: 2, backgroundColor: C.line }} />
            <RailTile label="참고 사진 추가" caption="사진 추가" icon="plus" dashed onPress={() => void addReferences()} />
            {scene.references.map((ref, index) => {
              const image = slot.referenceImages.find(i => i.path === ref.path), active = ref.id === scene.activeReferenceId;
              return <RailTile key={ref.id} label={`참고 ${index + 1} 선택`} caption={`참고 ${index + 1}`} image={image ? imageUri(image.path) : undefined} icon="image-outline" selected={active} faded={!ref.visible}
                onPress={() => { send({ type: 'setActiveReference', id: active ? null : ref.id }); setPanel(null); }} />;
            })}
          </ScrollView>
        </View>}

        {refRail && refSource === 'mine' && !!selectedReference && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 4 }}>
          <EyeToggle label={`참고 ${selectedReference.visible ? '숨기기' : '보이기'}`} on={selectedReference.visible} onPress={() => send({ type: 'toggleReference', id: selectedReference.id })} />
          <MaterialCommunityIcons name="circle-opacity" size={16} color={C.muted} />
          <View style={{ flex: 1 }}><Range testID="참고 진하기" label="진하기" value={selectedReference.opacity} min={.1} max={1} onChange={opacity => changeTransform(selectedReference.id, { opacity: Math.round(opacity * 20) / 20 })} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="참고 관리" onPress={() => setPanel(panel === 'reference' ? null : 'reference')} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={20} color={C.muted} /></Pressable>
        </View>}

        {/* 글씨를 고른 동안: 옮기기·크기는 캔버스에서 한다. 여기에는 내용 고치기와 끝내기만 둔다. */}
        {!drawRail && !!scene.captionPicked && <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginVertical: 8 }}>
          <Minor title="문구 내용 고치기" onPress={openCaption} />
          <Minor title="문구 선택 끝" onPress={() => { ease(); send({ type: 'captionPick', on: false }); }} />
        </View>}
        </>}
      </View>}
      {/* ── 기본 도구 줄 ─────────────────────────────────────────────────────────────────
          늘 같은 높이(BASE_H)로 캔버스 아래 제자리를 차지한다. 움직이기 탭·키보드 입력 중에는 내용만 비우고 자리는 남긴다.
          윗줄: 도구와 색. 이미 고른 도구를 다시 누르면 그 설정이 열린다. 아랫줄: 이 칸을 끝내는 행동 하나. */}
      {/* 문구를 입력하는 동안에는 도구 줄 자리를 비우지 않고 접는다 — 빈 흰 띠(40차 캡처) 대신 캔버스가 그만큼 커져 고치는 글씨가 보인다. */}
      <View style={{ height: typing ? 0 : BASE_H, borderTopWidth: typing ? 0 : 1, borderColor: C.line, backgroundColor: C.paper }} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        {tab === 'draw' && !typing && <>
        {/* 윗줄: 한 dock 안의 도구들. 도구마다 카드를 두르지 않고, 고른 도구만 옅은 노랑 알약이 올라온다. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, gap: 6 }}>
          {tools.map(([key, title, icon]) => { const on = tool === key, settings = on && !!settingsOf(key), open = on && panel === settingsOf(key);
            return <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: on, expanded: settings ? open : undefined }} onPress={() => selectTool(key)}
              style={({ pressed }) => ({ flex: 1, minHeight: C.tap, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 14, backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
              <MaterialCommunityIcons name={icon} size={20} color={on ? C.ink : C.muted} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
              {settings && <View pointerEvents="none" style={{ position: 'absolute', top: 3, right: 5 }}><MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-up'} size={12} color={C.muted} /></View>}
            </Pressable>; })}
          <Pressable accessibilityRole="button" accessibilityLabel="색" accessibilityState={{ expanded: panel === 'color' }}
            onPress={() => { ease(); setPanel(panel === 'color' ? null : 'color'); setDrawRail(false); setRefRail(false); }}
            style={({ pressed }) => ({ flex: 1, minHeight: C.tap, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 14, backgroundColor: panel === 'color' ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
            <View style={{ width: 22, height: 22, borderRadius: 11, padding: 2, backgroundColor: C.paper, borderWidth: 1, borderColor: C.lineStrong }}>
              <View style={{ flex: 1, borderRadius: 9, backgroundColor: color }} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: panel === 'color' ? '800' : '600', color: panel === 'color' ? C.ink : C.muted }}>색</Text>
          </Pressable>
        </View>
        {/* 아랫줄: 엄지가 닿는 자리에 되돌리기·다시(조용한 아이콘)와 이 칸을 끝내는 행동. */}
        {!scene.selection && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, gap: 4 }}>
          <UndoButton label="되돌리기" icon="undo-variant" disabled={!initialized || !scene.undo} onPress={() => send({ type: 'undo' })} />
          <UndoButton label="다시 실행" icon="redo-variant" disabled={!initialized || !scene.redo} onPress={() => send({ type: 'redo' })} />
          <Pressable accessibilityRole="button" accessibilityLabel="완성 후 다음" disabled={busy || !initialized} onPress={() => save('complete')}
            style={({ pressed }) => ({ flex: 1, minHeight: C.tap, marginLeft: 4, paddingHorizontal: 8, borderRadius: 14, flexDirection: 'row', gap: 6, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !initialized ? .4 : 1 })}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: C.accentInk, fontWeight: '800', fontSize: 15 }}>{completeTitle}</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={C.accentInk} />
          </Pressable>
        </View>}
        </>}
      </View>
    </KeyboardAvoidingView>

    {cutoutPicker && <Dialog title="그림 가져오기" onClose={() => setCutoutPicker(false)}>
      {cutouts.map(cut => <View key={cut.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={cut.name + ' 넣기'} onPress={() => { setCutoutPicker(false); void useCutout(cut.id); }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 8, borderRadius: C.radius.sm, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFF' }}>
          <Image source={{ uri: imageUri(cut.path) }} style={{ width: 40, height: 40, borderRadius: 8 }} resizeMode="contain" />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.ink }}>{cut.name}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={cut.name + ' 보관 지우기'} onPress={() => onForgetCutout(cut.id)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="close" size={18} color={C.muted} /></Pressable>
      </View>)}
      <Action title="사진에서 고르기" icon="image-outline" onPress={() => { setCutoutPicker(false); void importDrawing(); }} />
    </Dialog>}
    {!!renaming && <Dialog title="레이어 이름" onClose={() => setRenaming(null)}>
      <TextInput accessibilityLabel="레이어 이름" value={renaming.name} onChangeText={name => setRenaming({ ...renaming, name })} multiline={false} maxLength={12}
        placeholder="예: 손" placeholderTextColor="#8E8E93"
        style={{ fontSize: 18, minHeight: C.tap, borderWidth: 1, borderColor: C.line, borderRadius: C.radius.sm, paddingHorizontal: 12, backgroundColor: '#FFF', color: C.ink }} />
      <Action primary title="이름 바꾸기" onPress={() => { if (renaming.name.trim()) send({ type: 'renameLayer', id: renaming.id, name: renaming.name }); setRenaming(null); }} />
    </Dialog>}
    {proSheet && <Dialog title="부분 움직임은 PRO" onClose={() => { setProSheet(false); pendingAction.current = null; }}>
      <Text style={{ fontSize: 13, lineHeight: 20, color: C.ink }}>PRO 기간이 끝나 새로 바꾼 부분 움직임은 저장할 수 없어요. 그림과 전체 움직임은 그대로 저장돼요.</Text>
      <Action primary title="PRO 알아보기" onPress={() => { setProSheet(false); onRequestPro(); }} />
      <Action title="PRO 효과 빼고 저장" onPress={saveWithoutPro} />
    </Dialog>}
    {showQA && <Dialog title="이 칸 검사" onClose={() => setShowQA(false)}>
      {!qa ? <Text style={{ fontSize: 13, color: C.ink }}>아직 검사한 결과가 없어요.</Text> : qa.status === 'PASS' ? <Text style={{ fontSize: 15, fontWeight: '700', color: C.success }}>기본 검사를 모두 통과했어요.</Text>
        : [...qa.checks, ...qa.consistency].filter(c => c.status !== 'PASS').map(c => <Text key={c.label} style={{ fontSize: 13, lineHeight: 19, color: c.status === 'FAIL' ? C.danger : C.ink }}>{c.label} · {c.detail}</Text>)}
      {(qa?.notes ?? []).map(note => <Text key={note} style={{ fontSize: 11, color: C.muted }}>{note}</Text>)}
    </Dialog>}
  </SafeAreaView></Modal>;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function Bar({ label, icon, strong, active, disabled, onPress }: { label: string; icon: IconName; strong?: boolean; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: active }} disabled={disabled} onPress={onPress} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .3 : 1 }}>
    <MaterialCommunityIcons name={icon} size={strong ? 28 : 22} color={T.ink} />
  </Pressable>;
}
// 되돌리기·다시: 도구처럼 보이지 않는 조용한 아이콘. 누르는 자리는 48dp 그대로.
function UndoButton({ label, icon, disabled, onPress }: { label: string; icon: IconName; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ width: T.tap, height: T.tap, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : 'transparent' })}>
    <MaterialCommunityIcons name={icon} size={23} color={disabled ? T.lineStrong : T.ink} />
  </Pressable>;
}
function Switch({ on }: { on: boolean }) {
  return <View style={{ width: 36, height: 22, borderRadius: 11, padding: 2, backgroundColor: on ? T.accent : T.lineStrong, justifyContent: 'center' }}>
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: on ? 'flex-end' : 'flex-start' }} />
  </View>;
}
// 기본 레퍼런스 자리. 2~2.5등신 관절 인형 전신이 들어갈 세로형(3:4) 칸. 에셋이 들어오기 전에는 준비 중 자리표시다 — 누를 수 없다.
function BuiltinReferences() {
  const [category, setCategory] = useState<string>(BUILTIN_REFERENCES.categories[0]);
  return <View style={{ paddingTop: 8, paddingBottom: 10, gap: 8 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
      {BUILTIN_REFERENCES.categories.map(name => { const on = category === name;
        return <Pressable key={name} accessibilityRole="button" accessibilityLabel={'기본 레퍼런스 ' + name} accessibilityState={{ selected: on }} onPress={() => setCategory(name)}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? T.ink : T.surface2 }}>
          <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? T.paper : T.muted }}>{name}</Text>
        </Pressable>; })}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
      {Array.from({ length: BUILTIN_REFERENCES.placeholderCount }, (_, i) =>
        <View key={category + i} testID="기본 레퍼런스 자리" accessibilityLabel={`${category} 기본 레퍼런스 ${i + 1} 준비 중`} style={{ width: 64, height: 85, borderRadius: 12, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.lineStrong, marginBottom: 3 }} />
          <View style={{ width: 22, height: 26, borderRadius: 9, backgroundColor: T.lineStrong, transform: [{ rotate: `${(i % 3 - 1) * 8}deg` }] }} />
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
            <View style={{ width: 6, height: 12, borderRadius: 3, backgroundColor: T.lineStrong }} />
            <View style={{ width: 6, height: 12, borderRadius: 3, backgroundColor: T.lineStrong }} />
          </View>
        </View>)}
    </ScrollView>
    <Text style={{ paddingHorizontal: 12, fontSize: 11, color: T.faint }}>관절 인형 포즈·표정·손동작을 곧 넣어 드려요</Text>
  </View>;
}
// 표현 가이드 한 줄 힌트 자리. EXPRESSION_GUIDE.enabled 가 켜질 때만 캔버스 위에 뜬다.
function ExpressionHint() {
  return <View style={{ position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: T.floating, borderWidth: 1, borderColor: T.line }}>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: T.faint }}>표현 가이드</Text>
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: T.ink }}>억울해 · 팔짱 + 몸 돌리기</Text>
    </View>
  </View>;
}
// 캔버스 가장자리의 굵기 조절. 위로 끌면 굵게, 아래로 끌면 가늘게(작은 값은 촘촘하게). 누르고 있는 동안에만 크기 원과 px 을 보여 준다.
export const widthToRatio = (w: number) => Math.sqrt(Math.max(0, (w - 1) / 47));
export const ratioToWidth = (r: number) => Math.max(1, Math.min(48, Math.round(1 + 47 * r * r)));
function SizeControl({ label, value, height, onChange, onActive }: { label: string; value: number; height: number; onChange: (value: number, settle: boolean) => void; onActive: (value: number | null) => void }) {
  const start = useRef<{ y: number; r: number } | null>(null);
  const ratio = widthToRatio(value), track = height - 28;
  const moveTo = (pageY: number, settle: boolean) => {
    if (!start.current) return;
    const next = ratioToWidth(Math.max(0, Math.min(1, start.current.r - (pageY - start.current.y) / Math.max(1, track))));
    onChange(next, settle); onActive(settle ? null : next);
  };
  return <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 1, max: 48, now: value }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={e => onChange(Math.max(1, Math.min(48, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))), true)}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
    onResponderGrant={e => { start.current = { y: e.nativeEvent.pageY, r: ratio }; onActive(value); }}
    onResponderMove={e => moveTo(e.nativeEvent.pageY, false)}
    onResponderRelease={e => { moveTo(e.nativeEvent.pageY, true); start.current = null; onActive(null); }}
    onResponderTerminate={() => { start.current = null; onActive(null); onChange(value, true); }}
    style={{ width: 40, height, alignItems: 'center', justifyContent: 'center' }}>
    {/* 평소에는 조용하게: 옅은 트랙 + 흰 손잡이. 캔버스 그림과 경쟁하지 않는다. */}
    <View style={{ width: 4, height: track, borderRadius: 2, backgroundColor: '#FFFFFFB3', borderWidth: 1, borderColor: '#17171714' }}>
      <View style={{ position: 'absolute', left: -10, top: (1 - ratio) * track - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#17171759' }} />
    </View>
  </View>;
}
// 참고 줄의 칸 하나: 그림(또는 아이콘) 위, 짧은 이름 아래.
function RailTile({ label, caption, image, icon, selected, dashed, faded, onPress }: { label: string; caption: string; image?: string; icon?: IconName; selected?: boolean; dashed?: boolean; faded?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress} style={{ width: 64, alignItems: 'center', gap: 4 }}>
    <View style={{ width: 56, height: 56, padding: 2, borderRadius: 14, borderWidth: selected ? 2 : dashed ? 1 : 0, borderStyle: dashed ? 'dashed' : 'solid', borderColor: selected ? T.accent : T.lineStrong, backgroundColor: dashed ? T.paper : T.surface2, alignItems: 'center', justifyContent: 'center' }}>
      {image ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%', borderRadius: 10, opacity: faded ? .35 : 1 }} resizeMode="contain" />
        : icon ? <MaterialCommunityIcons name={icon} size={22} color={T.muted} /> : null}
    </View>
    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: selected ? '700' : '500', color: selected ? T.ink : T.muted }}>{caption}</Text>
  </Pressable>;
}
// Hand-drawn eye: filled pupil when shown, struck through when hidden.
function EyeToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const tint = on ? T.ink : T.faint;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={onPress} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 22, height: 15, borderRadius: 8, borderWidth: 1.6, borderColor: tint, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />}</View>
    {!on && <View style={{ position: 'absolute', width: 26, height: 1.6, borderRadius: 1, backgroundColor: tint, transform: [{ rotate: '-24deg' }] }} />}
  </Pressable>;
}
// 하단에서 올라오는 설정 패널의 공통 껍데기.
//
// 한 번에 하나만 연다. 다른 설정을 고르면 열려 있던 것이 바뀐다 — 겹쳐 쌓지 않는다.
// 캔버스는 그대로 밝게 둔다: 지금 무엇을 고치는 중인지 보면서 골라야 하기 때문이다.
// 바탕을 어둡게 하는 것은 ⋯ 작업 도구처럼 **고르는 일 자체에 집중하는 자리**뿐이다.
// 높이는 내용에 맞추고, 길면 패널 안에서 스크롤한다 — 패널이 화면을 다 먹지 않는다.
// tall: 설정이 여러 줄인 펜 설정용. 조절이 스크롤 아래로 묻히지 않도록 화면 절반까지 쓴다(캔버스 크기는 그대로 — 패널은 겹쳐 뜬다).
function Sheet({ title, onClose, children, tall, room = Infinity }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean; room?: number }) {
  const { height } = useWindowDimensions();
  return <View style={{ backgroundColor: T.paper, maxHeight: Math.min(room, tall ? Math.min(440, Math.max(300, Math.round(height * .5))) : Math.min(300, Math.max(190, height - 440))) }}>
    <SheetHeader title={title} onClose={onClose} />
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>
  </View>;
}
// 색 패널. 캔버스를 덮지 않고 **아래 도구 자리를 대신 차지한다.** 그림을 보면서 색을 고를 수 있어야
// 고른 색이 맞는지 알 수 있기 때문이다.
//
// 두 갈래로 나눈다:
//   팔레트   — 규칙적인 작은 사각 격자. 최근 쓴 색과 내 팔레트는 맨 위에 따로 둔다.
//   직접 선택 — 색상 줄(8계열)·연속 색상 막대로 계열을, 채도·명도 면으로 밝기를, 정확한 값은 HEX 로.
// 전부 무료다(38차): 스포이드·내 팔레트·RGB·투명도는 드로잉 앱의 기본 기능이라 잠가서 PRO 가치를 만들지 않는다.
type ColorPanelProps = {
  color: string; recent: string[]; saved: string[];
  view: 'palette' | 'custom'; onView: (view: 'palette' | 'custom') => void;
  onPick: (c: string, settle?: boolean) => void; onEyedrop: () => void; onSave: (c: string) => void; onForget: (c: string) => void;
  onClose: () => void;
};
function ColorPanel({ color, recent, saved, view, onView, onPick, onEyedrop, onSave, onForget, onClose }: ColorPanelProps) {
  // 견본 한 번 = 고르고 닫기. 상세 조절 = 고르고 머무르기.
  const quick = (c: string) => { onPick(c); onClose(); };
  const [hue, setHue] = useState(() => hsvOf(color).h);
  const [hex, setHex] = useState(color);
  const [tidy, setTidy] = useState(false);
  // 바깥(스포이드·HEX·RGB·최근 색)에서 색이 바뀌면 입력칸과 계열이 따라온다. 회색처럼 계열이 없는 색은 계열을 두고 간다.
  useEffect(() => { setHex(color); const t = hsvOf(color); if (t.s > 0.04 && t.v > 0.04) setHue(t.h); }, [color]);
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const rgba = parseHex(color);
  const percent = Math.round(rgba.a / 2.55);
  const kept = saved.some(c => same(c, color));
  // 채도·명도 면. 가로는 옅은 쪽에서 짙은 쪽으로, 세로는 밝은 쪽에서 어두운 쪽으로.
  const field: string[][] = [];
  for (let row = 0; row < 5; row++) {
    const line: string[] = [];
    for (let col = 0; col < 8; col++) line.push(hsv(hue, (col + 1) / 8, 1 - row * 0.18));
    field.push(line);
  }
  // 면의 칸은 불투명하다. PRO로 정해 둔 투명도가 있으면 계열만 바꾸고 투명도는 지킨다.
  const keepAlpha = (c: string) => withAlpha(c, rgba.a);
  const typed = (value: string) => { setHex(value); const next = typedHex(value, true); if (next) onPick(next); };
  const channel = (key: 'r' | 'g' | 'b' | 'a', n: number) => onPick(toHex({ ...rgba, [key]: n }), false);
  const action = { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' } as const;

  return <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
    {/* 머리: 지금 색 · 스포이드 · 내 팔레트 저장 · 닫기. 두 갈래 어디에서나 같은 자리. */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, padding: 3, backgroundColor: T.paper, borderWidth: 1, borderColor: T.lineStrong }}>
        <View style={{ flex: 1, borderRadius: 12, backgroundColor: color }} />
      </View>
      <Text accessibilityLabel="지금 색 값" style={{ flex: 1, fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: .4 }}>{color.toUpperCase()}</Text>
      <IconButton label="스포이드" icon="eyedropper-variant" size={20} onPress={onEyedrop} />
      <IconButton label={kept ? '내 팔레트에 있음' : '내 팔레트에 저장'} icon={kept ? 'check' : 'palette-swatch-outline'} size={20} color={kept ? T.success : T.ink} disabled={kept} onPress={() => onSave(color)} />
      <IconButton label="팔레트 닫기" icon="chevron-down" color={T.muted} onPress={onClose} />
    </View>
    {/* 최근 쓴 색이 가장 먼저다. 작은 동그라미 한 줄 — 한 번 누르면 그 색으로 돌아가 바로 그린다. */}
    {!!recent.length && <View testID="최근 색" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {recent.slice(0, 7).map(c => <Swatch round key={'r' + c} label={'최근 색 ' + c} color={c} size={34} selected={same(c, color)} onPress={() => quick(c)} />)}
    </View>}
    <Segmented dense value={view} onChange={onView} items={[{ key: 'palette', label: '팔레트' }, { key: 'custom', label: '직접 선택' }]} />
    {view === 'palette' ? <>
      {!!saved.length && <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: T.muted }}>내 팔레트 {saved.length}</Text>
          {!!saved.length && <Pressable accessibilityRole="button" accessibilityLabel={tidy ? '내 팔레트 정리 끝' : '내 팔레트 정리'} onPress={() => setTidy(!tidy)} style={{ minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted }}>{tidy ? '끝' : '정리'}</Text>
          </Pressable>}
        </View>
        {saved.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {saved.map(c => tidy
            ? <Pressable key={'u' + c} accessibilityRole="button" accessibilityLabel={'내 팔레트 ' + c + ' 지우기'} onPress={() => onForget(c)} hitSlop={6}
                style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00000033' }}>
                <MaterialCommunityIcons name="close" size={16} color={light(c) ? '#1B1B1D' : '#FFFFFF'} />
              </Pressable>
            : <Swatch key={'u' + c} label={'내 팔레트 ' + c} color={c} size={30} selected={same(c, color)} onPress={() => quick(c)} />)}
        </View> : null}
      </View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {swatches.map(c => <Swatch key={c} color={c} size={30} selected={same(c, color)} onPress={() => quick(c)} />)}
      </View>
    </> : <>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {HUES.map(h => <Pressable key={h} accessibilityRole="button" accessibilityLabel={'색상 ' + h} accessibilityState={{ selected: hue === h }} onPress={() => setHue(h)}
          style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: hsv(h, 1, 1), borderWidth: hue === h ? 3 : 0, borderColor: T.ink }} />)}
      </View>
      <Range label="색상" value={hue} min={0} max={359} step={1} onChange={n => setHue(Math.round(n))} display={hue + '°'} />
      <View style={{ gap: 4 }}>
        {field.map((line, row) => <View key={row} style={{ flexDirection: 'row', gap: 4 }}>
          {line.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={'색 ' + c} accessibilityState={{ selected: same(c, color) || same(keepAlpha(c), color) }} onPress={() => onPick(keepAlpha(c))}
            style={{ flex: 1, height: 32, borderRadius: 6, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: same(keepAlpha(c), color) ? 3 : 0, borderColor: T.ink }}>
            {same(keepAlpha(c), color) && <MaterialCommunityIcons name="check" size={14} color={light(c) ? '#1B1B1D' : '#FFFFFF'} />}
          </Pressable>)}
        </View>)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: T.muted }}>HEX</Text>
        <TextInput accessibilityLabel="HEX 색 값" value={hex} onChangeText={typed} autoCapitalize="characters" autoCorrect={false} maxLength={9}
          placeholder="#RRGGBB" placeholderTextColor="#8E8E93"
          style={{ flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 10, backgroundColor: T.fill, fontSize: 13, color: T.ink }} />
      </View>
      <View style={{ gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: T.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: T.muted }}>RGB · 투명도</Text>
        </View>
        <Range label="빨강" value={rgba.r} min={0} max={255} step={1} onChange={n => channel('r', n)} display={String(rgba.r)} />
        <Range label="초록" value={rgba.g} min={0} max={255} step={1} onChange={n => channel('g', n)} display={String(rgba.g)} />
        <Range label="파랑" value={rgba.b} min={0} max={255} step={1} onChange={n => channel('b', n)} display={String(rgba.b)} />
        <Range label="투명도" value={percent} min={5} max={100} step={1} onChange={n => channel('a', Math.round(n) * 2.55)} display={percent + '%'} />
      </View>
    </>}
  </View>;
}
// 작은 정사각 견본. 동그라미를 길게 늘어놓는 대신 규칙적인 격자로 세운다 — 눈이 줄과 칸을 따라가고,
// 같은 자리에 같은 색이 있어 손이 기억한다. 고른 것은 테두리와 체크 둘 다로 말한다: 테두리만으로는
// 어두운 색 위에서 잘 보이지 않는다.
function Swatch({ color, selected, onPress, size = 34, label, round }: { color: string; selected: boolean; onPress: () => void; size?: number; label?: string; round?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? '색 ' + color} accessibilityState={{ selected }} onPress={onPress} hitSlop={6}
    style={{ width: size, height: size, borderRadius: round ? size / 2 : 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      borderWidth: selected ? 2.5 : 1, borderColor: selected ? T.ink : '#17171718' }}>
    {selected && <MaterialCommunityIcons name="check" size={Math.round(size * .5)} color={light(color) ? '#1B1B1D' : '#FFFFFF'} />}
  </Pressable>;
}
// 색상 줄의 여덟 계열. 그 사이 값은 아래 연속 색상 막대가 채운다.
const HUES = [0, 30, 60, 120, 180, 210, 270, 320];
// Secondary to the slider, but it guarantees size stays adjustable on any device.
function Step({ label, sign, onPress }: { label: string; sign: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={{ width: 40, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: T.muted }}>{sign}</Text></Pressable>;
}
// 보조 행동(secondary). 흰 표면 + 옅은 선 하나. 위험한 일만 옅은 빨강.
function Minor({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: danger ? 0 : 1, borderColor: T.line, backgroundColor: danger ? T.dangerSoft : pressed ? T.fill : T.paper, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 13, fontWeight: '700', color: danger ? T.danger : T.ink }}>{title}</Text></Pressable>;
}
// 메뉴 한 줄. 카드도 알약도 아니다 — 목록의 한 줄이다. 아이콘은 뜻을 보조할 뿐이라 이름을 늘 함께
// 적는다. 아이콘만 보고 뜻을 추측하게 하지 않는다. 모두 같은 집합(MaterialCommunityIcons)에서 쓰고,
// 이모지나 임시 점을 섞지 않는다. 기능과 연결되지 않은 장식 아이콘은 두지 않는다.
function MenuButton({ title, icon, onPress, danger }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: T.radius.sm, backgroundColor: pressed ? T.fill : 'transparent' })}>
    <MaterialCommunityIcons name={icon} size={18} color={danger ? T.danger : T.muted} />
    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: danger ? T.danger : T.ink }}>{title}</Text>
  </Pressable>;
}
// 묶음의 이름. 구분선은 쓰지 않는다 — 줄마다 선을 그으면 목록이 격자로 보인다. 작은 글자 하나면 충분하다.
function MenuGroup({ title }: { title: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: T.muted, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>{title}</Text>;
}
// 이전·다음처럼 짝인 행동은 한 줄에 둔다. 따로 세우면 목록만 길어지고 짝이라는 것이 보이지 않는다.
function MenuPair({ label, left, right, onLeft, onRight }: { label?: string; left: string; right: string; onLeft?: () => void; onRight?: () => void }) {
  const Half = ({ name, icon, run, side }: { name: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; run?: () => void; side: 'l' | 'r' }) =>
    <Pressable accessibilityRole="button" accessibilityLabel={name} disabled={!run} onPress={run}
      style={({ pressed }) => ({ flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        borderTopLeftRadius: side === 'l' ? 10 : 0, borderBottomLeftRadius: side === 'l' ? 10 : 0,
        borderTopRightRadius: side === 'r' ? 10 : 0, borderBottomRightRadius: side === 'r' ? 10 : 0,
        backgroundColor: pressed && run ? T.fillPressed : T.surface2, opacity: run ? 1 : .4 })}>
      <MaterialCommunityIcons name={icon} size={15} color={T.ink} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: T.ink }}>{name}</Text>
    </Pressable>;
  return <View style={{ paddingHorizontal: 10, paddingVertical: 2, gap: 3 }}>
    {!!label && <Text style={{ fontSize: 10, color: T.muted }}>{label}</Text>}
    <View style={{ flexDirection: 'row', gap: 2 }}>
      <Half name={left} icon="chevron-left" run={onLeft} side="l" />
      <Half name={right} icon="chevron-right" run={onRight} side="r" />
    </View>
  </View>;
}
