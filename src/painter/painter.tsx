import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, LayoutAnimation, Modal, View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, UIManager } from 'react-native';
import { Keyboard, useWindowDimensions, type GestureResponderEvent, type ImageSourcePropType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { canvasHtml } from './canvas-html';
import { alphaOf, hsv, hsvOf, light, parseHex, toHex, typedHex, withAlpha } from './color';
import { Action, Dialog, Elev, IconButton, ProTag, Range, Segmented, SheetHeader, T, userMessage } from '../components/ui';
import { ASSET_SLOTS, BUILTIN_REFERENCES } from '../design/asset-slots';
import { MotionPanel, layerLabel } from './motion-panel';
import { KAKAO_STATIC_SPEC } from '../constants/kakao-spec';
import { usesPro } from '../project';
import { dataUrl } from '../services/images';
import { imageUri } from '../services/storage';
import { CAPTION_STYLES } from '../types';
import type { BrushSettings, Caption, CaptionStyle, LayerTransform, LocalImage, Motion, PainterExport, QA, SavedMotion, Slot } from '../types';

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
  // 즐겨찾기 세 칸. 사용자가 고정하고, 앱이 저장한다 — 다른 브러시를 썼다고 바뀌지 않는다.
  favoriteBrushes?: string[];
  onFavoriteBrushes?: (keys: string[]) => void;
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
  // 표현 가이드에서 고른 표현(44.2차): 이름과 짧은 몸짓 힌트 한 줄만 받는다 — 가이드 전용 상태·패널은 두지 않는다.
  guideHint?: { name: string; hint: string } | null;
  onGuideHintDone?: () => void;
  // 표현 가이드에서 고른 예시(45.17차). 그림은 앱에 함께 실린 번들 모듈이고, 없으면 가이드 화면이 고르지 못하게 막는다.
  guideExample?: { id: string; title: string; hint: string; artwork: ImageSourcePropType; display?: ImageSourcePropType } | null;
  // 가이드 화면에서 무엇을 눌렀는지: 참고 창으로 보며 그릴지, 밑그림으로 깔지.
  guideExampleMode?: 'watch' | 'underlay' | null;
  // 번들 그림을 참고 사진과 같은 자리(세트의 referenceImages)로 들여온다 — 저장·복원은 기존 참고 정책 그대로다.
  onImportGuideExample?: (artwork: ImageSourcePropType) => Promise<LocalImage | null>;
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
export const BASE_H = 184;   // 브러시 카드(62) + 색·굵기(32) + 도구 네 칸(48) + 줄 사이 여백(45.28차)
const transform = (id: string, name: string): LayerTransform => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
const source = { html: canvasHtml };
const C = T;
// 선택 이동이 '옮기기'로 갔는지 '새 마키'로 갔는지 기기에서 확인하기 위한 기록. 내부 검수 빌드에서만 켠다.
const PROBE = (Constants.expoConfig?.extra as { internalReview?: boolean } | undefined)?.internalReview === true;
// 두 손가락 확대 안내는 앱을 켠 뒤 한 번만 보인다(43.1차). 저장 데이터에는 남기지 않는다.
let zoomHintShown = false;
// 앱을 켜 둔 동안 마지막으로 고른 문구 글씨체(45.6차). 칸을 옮겨도 이어진다 — 24칸을 만드는 동안 매번 다시 고르지 않는다.
// 저장된 칸은 자기 글씨체를 그대로 쓰고, 앱을 껐다 켜면 기본으로 돌아온다(저장 구조를 늘리지 않는다).
let sessionCaptionFace: CaptionStyle = 'basic';
// 패널이 열리고 닫힐 때만 짧게 미끄러진다. 200ms 는 눈이 변화를 따라갈 만큼이고, 기다렸다고
// 느낄 만큼은 아니다. 그림 자체에는 어떤 움직임도 걸지 않는다 — 작품이 흔들려 보이면 안 된다.
if (Platform.OS === 'android') UIManager?.setLayoutAnimationEnabledExperimental?.(true);
const ease = () => LayoutAnimation?.configureNext?.(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
const BRUSHES = [
  { key: 'pen' as const, title: '펜', art: require('../../assets/art/tool-pen.png'), stroke: require('../../assets/art/stroke-pen.png') },
  { key: 'brush' as const, title: '붓', art: require('../../assets/art/tool-brush.png'), stroke: require('../../assets/art/stroke-brush.png') },
  { key: 'pencil' as const, title: '연필', art: require('../../assets/art/tool-pencil.png'), stroke: require('../../assets/art/stroke-pencil.png') },
];
// 브러시 한 벌(45.28차). 무료 4종 + PRO 8종 = 12종. key 는 저장되는 값이라 바꾸지 않는다.
// base = 엔진의 기본 브러시, preset = 엔진 PRESETS 의 key. 둘 중 하나만 갖는다.
export type BrushKey = string;
// 브러시 30종(45.31 · v2 구성표). 무료 10 + PRO 20. **문서 ID(F01·P01…)는 앱 ID 가 아니다** —
// key 와 preset 은 저장되는 값이고, 효과가 같으면 예전 이름을 그대로 쓴다.
// group 은 목록 분류(선·채색·질감·효과)다. use 는 고른 뒤 한 줄로 보여 주는 설명이다.
type Group = '선' | '채색' | '질감' | '효과';
const CATALOG: { key: BrushKey; title: string; pro: boolean; group: Group; base?: Brush; preset?: NonNullable<BrushSettings['preset']>; use: string; stroke: ImageSourcePropType }[] = [
  // ── 무료 10 ──
  { key: 'pen', title: '기본 펜', pro: false, group: '선', base: 'pen', use: '고른 굵기의 또렷한 선 · 외곽선', stroke: require('../../assets/art/stroke-pen.png') },
  { key: 'inknatural', title: '자연 잉크', pro: false, group: '선', preset: 'inknatural', use: '가장자리가 살아 있는 손맛 선', stroke: require('../../assets/art/stroke-inknatural.png') },
  { key: 'ink', title: '테이퍼 펜', pro: false, group: '선', preset: 'ink', use: '시작이 가늘어지는 선 · 펜선 정리', stroke: require('../../assets/art/stroke-ink.png') },
  { key: 'brushpen2', title: '붓펜', pro: false, group: '선', preset: 'brushpen2', use: '천천히 그으면 굵어지는 붓 선 · 손글씨', stroke: require('../../assets/art/stroke-brushpen2.png') },
  { key: 'flat', title: '납작 펜', pro: false, group: '선', preset: 'flat', use: '팁 각도에 따라 굵기가 달라지는 선', stroke: require('../../assets/art/stroke-flat.png') },
  { key: 'pencil2', title: '연필', pro: false, group: '질감', preset: 'pencil2', use: '마른 입자의 옅은 선 · 밑그림과 해칭', stroke: require('../../assets/art/stroke-pencil2.png') },
  { key: 'colorpencil', title: '색연필', pro: false, group: '질감', preset: 'colorpencil', use: '종이결에 색이 쌓이는 선 · 덧칠', stroke: require('../../assets/art/stroke-colorpencil.png') },
  { key: 'opaque', title: '불투명 채색붓', pro: false, group: '채색', preset: 'opaque', use: '겹쳐도 얼룩 없는 고른 면 · 평면 채색', stroke: require('../../assets/art/stroke-opaque.png') },
  { key: 'marker2', title: '마커', pro: false, group: '채색', preset: 'marker2', use: '납작하고 넓은 선 · 빠른 색 채우기', stroke: require('../../assets/art/stroke-marker2.png') },
  { key: 'airbrush', title: '에어브러시', pro: false, group: '채색', preset: 'airbrush', use: '옅게 번지는 색 · 볼터치와 그림자', stroke: require('../../assets/art/stroke-airbrush.png') },
  // ── PRO 20 ──
  { key: 'inkrough', title: '거친 잉크', pro: true, group: '선', preset: 'inkrough', use: '속은 꽉 차고 가장자리가 거친 굵은 선', stroke: require('../../assets/art/stroke-inkrough.png') },
  { key: 'rough', title: '드라이 잉크', pro: true, group: '선', preset: 'rough', use: '안쪽이 끊기는 마른 잉크 선', stroke: require('../../assets/art/stroke-rough.png') },
  { key: 'bristle', title: '붓결 잉크', pro: true, group: '선', preset: 'bristle', use: '획 방향으로 이어지는 붓털 결', stroke: require('../../assets/art/stroke-bristle.png') },
  { key: 'ballpen', title: '볼펜', pro: true, group: '선', preset: 'ballpen', use: '가늘고 옅은 선 · 겹쳐 쌓는 해칭', stroke: require('../../assets/art/stroke-ballpen.png') },
  { key: 'crayon', title: '크레용', pro: true, group: '질감', preset: 'crayon', use: '왁스가 뭉치고 종이가 비치는 선', stroke: require('../../assets/art/stroke-crayon.png') },
  { key: 'chalk', title: '분필', pro: true, group: '질감', preset: 'chalk', use: '가루가 성글게 앉는 굵은 선', stroke: require('../../assets/art/stroke-chalk.png') },
  { key: 'pastel', title: '소프트 파스텔', pro: true, group: '질감', preset: 'pastel', use: '고운 가루가 넓게 앉는 채색', stroke: require('../../assets/art/stroke-pastel.png') },
  { key: 'charcoal', title: '목탄', pro: true, group: '질감', preset: 'charcoal', use: '큰 결이 불규칙하게 번지는 선·면', stroke: require('../../assets/art/stroke-charcoal.png') },
  { key: 'pencilside', title: '연필 옆면', pro: true, group: '질감', preset: 'pencilside', use: '넓은 접촉면의 결 있는 음영', stroke: require('../../assets/art/stroke-pencilside.png') },
  { key: 'grainshade', title: '입자 음영', pro: true, group: '질감', preset: 'grainshade', use: '미세한 입자가 쌓이는 음영', stroke: require('../../assets/art/stroke-grainshade.png') },
  { key: 'oilpastel', title: '오일 파스텔', pro: true, group: '채색', preset: 'oilpastel', use: '두껍게 눌리는 왁스 채색', stroke: require('../../assets/art/stroke-oilpastel.png') },
  { key: 'wash', title: '워시', pro: true, group: '채색', preset: 'wash', use: '얇은 색을 겹쳐 쌓는 넓은 칠', stroke: require('../../assets/art/stroke-wash.png') },
  { key: 'wateredge', title: '가장자리 수채', pro: true, group: '채색', preset: 'wateredge', use: '가장자리에 색이 고이는 수채 면', stroke: require('../../assets/art/stroke-wateredge.png') },
  { key: 'dryflat', title: '드라이 평붓', pro: true, group: '효과', preset: 'dryflat', use: '넓은 붓결과 끊어진 색면', stroke: require('../../assets/art/stroke-dryflat.png') },
  { key: 'pointil', title: '점묘', pro: true, group: '효과', preset: 'pointil', use: '경로 둘레에 흩어지는 점', stroke: require('../../assets/art/stroke-pointil.png') },
  { key: 'spray', title: '스프레이', pro: true, group: '효과', preset: 'spray', use: '넓게 퍼지는 분사 입자', stroke: require('../../assets/art/stroke-spray.png') },
  { key: 'outline', title: '테두리 펜', pro: true, group: '효과', preset: 'outline', use: '속이 빈 두 겹 선 · 굵은 강조', stroke: require('../../assets/art/stroke-outline.png') },
  { key: 'dotted', title: '점선 펜', pro: true, group: '효과', preset: 'dotted', use: '점이 이어지는 선 · 재봉선과 안내선', stroke: require('../../assets/art/stroke-dotted.png') },
  { key: 'parallelpen', title: '평행선 펜', pro: true, group: '효과', preset: 'parallelpen', use: '나란한 세 줄 · 속도선과 무늬', stroke: require('../../assets/art/stroke-parallelpen.png') },
  { key: 'glowpen', title: '발광 펜', pro: true, group: '효과', preset: 'glowpen', use: '또렷한 중심과 흐린 번짐 · 반짝임', stroke: require('../../assets/art/stroke-glowpen.png') },
];
const GROUPS: Group[] = ['선', '채색', '질감', '효과'];
// 무료로 쓰는 프리셋. PRO 가 끝나도 이 값들은 효력이 남는다.
const FREE_PRESETS = new Set(CATALOG.filter(b => !b.pro && b.preset).map(b => b.preset as string));
// 목록에서 내린 예전 브러시. 엔진에는 그대로 있어 저장된 작품이 쓰던 값이 살아 있다.
// 45.31 에서 마커·붓펜·연필이 새 것으로 갈렸고, 예전 것은 여기에 남아 계속 해석된다.
const RETIRED: Record<string, string> = { grain: '결 연필', calligraphy: '캘리그래피', chisel: '납작펜(구형)', soft: '부드러운 펜', marker: '마커(구형)', brushpen: '붓펜(구형)' };
export const FREE_BRUSHES = CATALOG.filter(b => !b.pro).map(b => b.key);
export const PRO_BRUSH_KEYS = CATALOG.filter(b => b.pro).map(b => b.key);
// 빠른 선택 줄의 첫 모습. 승인 보드처럼 세 칸이고, 전체 목록에서 고르면 그 자리가 바뀐다.
// 즐겨찾기 세 칸의 처음 값. 사용자가 바꾸기 전까지 이것으로 연다.
const QUICK_DEFAULT: BrushKey[] = ['pen', 'pencil2', 'marker2'];
// 승인 보드는 아래 도구 줄에 '펜'을 쓴다. 위 카드에도 '펜'이 있어 글자만으로는 둘이 같아 보인다 —
// 보이는 글자는 보드대로 두고, 읽어 주는 이름만 '그리기 도구 펜'으로 갈라 둘을 구분한다.
const ALL_TOOLS: [Tool, string, IconName, string][] = [['pen', '펜', 'fountain-pen-tip', '그리기 도구 펜'], ['eraser', '지우개', 'eraser', '지우개'], ['fill', '채우기', 'format-color-fill', '채우기'], ['select', '선택', 'select-drag', '선택']];
const STAB_LEVELS = [['light', '약'], ['medium', '중'], ['strong', '강']] as const;
// 저장된 브러시 설정을 믿지 않고 한 칸씩 읽는다. 낯선 값은 없는 것으로 본다.
function cleanBrush(b?: BrushSettings): BrushSettings {
  const size = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(48, Math.round(n))) : undefined;
  return {
    preset: b?.preset && (CATALOG.some(p => p.preset === b.preset) || b.preset in RETIRED) ? b.preset : undefined,
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

// 기본 레퍼런스 32칸은 아직 칸별 자료도 고르는 동작도 없다(자리표시뿐).
// 명세 E05: 미완성 격자를 사용자 화면에 보이지 않는다. 자료는 그대로 두고 화면에서만 감춘다.
const BUILTIN_READY: boolean = BUILTIN_REFERENCES.enabled && BUILTIN_REFERENCES.ready;
export function Painter({ slot, slotCount, setName, canon, canonName, canonLocked, palette, userPalette, onSaveUserColor, onRemoveUserColor, brushSettings, onBrushSettings, favoriteBrushes, onFavoriteBrushes, paperTexture, completeTitle, hasPrevious, previousImage, pro, onRequestPro, previousMotion, initialTool, onToolChange, guideHint, onGuideHintDone, guideExample, guideExampleMode, onImportGuideExample, savedMotions, onSaveMotion, onForgetMotion, onSave, onComplete, onSetReference, onCopyPrevious, onColorUsed, onClose, onNavigate, onAddReferences, onImportDrawing, initialImport, onInitialImportUsed, cutouts, onKeepCutout, onUseCutout, onForgetCutout, onRemoveReference, onShare }: Props) {
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
  const coverRoom = (cover = .5) => canvasSide ? Math.max(160, Math.round((canvasArea - canvasSide) / 2 + canvasSide * cover)) : Infinity;
  const panelRoom = (share: number, cover = .5) => typing
    ? 240
    : Math.min(coverRoom(cover), Math.max(160, Math.round(windowHeight * share) - insets.bottom));
  // 세트에서 마지막으로 쓴 선 종류·굵기와 앱을 켠 동안 고른 도구로 연다 — 24칸을 그리는 동안 매번 다시 고르지 않는다.
  const startBrush = cleanBrush(brushSettings);
  const [tool, setTool] = useState<Tool>(initialTool && initialTool !== 'select' ? initialTool : 'pen'), [brush, setBrush] = useState<Brush>(startBrush.base ?? 'pen'), [color, setColor] = useState(palette[0] ?? '#242424');
  const [penWidth, setPenWidth] = useState(startBrush.width ?? 6), [eraserWidth, setEraserWidth] = useState(startBrush.eraserWidth ?? 24), [zoom, setZoom] = useState(1);
  // 캔버스는 이미 두 손가락으로 1~4배 확대·이동된다(canvas-html). 그 사실을 처음 한 번 짧게 알리고, 확대한 동안에는 작은 배율 표시로 100% 로 돌아가게 한다.
  const [zoomHint, setZoomHint] = useState(false);
  // 스포이드를 누른 채 캔버스로 끌 때: 지금 집고 있는 자리(캔버스 안 0~1)와 그 자리의 색.
  const [dropper, setDropper] = useState<{ vx: number; vy: number; color: string | null } | null>(null);
  const canvasRef = useRef<View>(null);
  const canvasBox = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const sampleAt = useRef(0);
  // 스포이드를 누르고 있는 동안에는 색 패널을 스크롤하지 않는다 — 안 그러면 손가락을 패널이 먼저 가져간다(45.4 실기기).
  const [dropping, setDropping] = useState(false);
  const dropped = useRef<string | null>(null);
  const zoomHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (zoomHintTimer.current) clearTimeout(zoomHintTimer.current); }, []);
  const resetZoom = () => { setZoom(1); send({ type: 'zoom', zoom: 1 }); };
  const [panel, setPanel] = useState<Panel>(null), [drawRail, setDrawRail] = useState(false), [refRail, setRefRail] = useState(false);
  // 기본 레퍼런스는 찾는 동안에만 큰 격자를 연다. 고르면 접히고 캔버스에서 맞춘다(44.2차).
  const [refBrowse, setRefBrowse] = useState(true);
  // 기본 레퍼런스에서 고른 자세: 어느 분류의 몇 번째인가. 넘기기는 이 분류 안에서만 움직인다(45.4차).
  const [refCategory, setRefCategory] = useState<string>(BUILTIN_REFERENCES.categories[0]);
  const [poseIndex, setPoseIndex] = useState(0);
  const [guideHintOpen, setGuideHintOpen] = useState(true);
  // 표현 예시 참고 창(45.17차). 캔버스 위에 떠 있는 안내일 뿐이라 그림·썸네일·출력 어디에도 들어가지 않는다.
  const [refWindow, setRefWindow] = useState<'open' | 'collapsed' | 'closed'>('closed');
  // 빠른 선택 세 자리. 전체 목록에서 고르면 눌러 둔 자리가 그 브러시로 바뀐다(자리는 늘 셋).
  // 저장된 즐겨찾기를 그대로 연다. 모르는 이름은 버리고 세 칸을 기본값으로 채운다.
  const [quickBrushes, setQuickBrushes] = useState<BrushKey[]>(() => {
    const kept = (favoriteBrushes ?? []).filter(k => CATALOG.some(b => b.key === k));
    const out = [...new Set(kept)].slice(0, 3);
    for (const d of QUICK_DEFAULT) if (out.length < 3 && !out.includes(d)) out.push(d);
    return out;
  });
  // 즐겨찾기를 바꾸는 유일한 길. 사용자가 누른 것만 여기로 온다.
  function pinBrush(slot: number, key: BrushKey) {
    const next = quickBrushes.map((k, i) => i === slot ? key : k);
    setQuickBrushes(next); onFavoriteBrushes?.(next); setPinning(null);
  }
  // 어느 칸에 넣을지 고르는 중인 브러시. null 이면 평소 상태다.
  const [pinning, setPinning] = useState<BrushKey | null>(null);
  const guideUsed = useRef(false);
  // 이 칸에 깔아 둔 밑그림의 참고 id. 같은 예시를 또 눌러도 그림이 두 장 쌓이지 않게 한다.
  const guideLaid = useRef<string | null>(null);
  const [showCanon, setShowCanon] = useState(false), [showQA, setShowQA] = useState(false), [qa, setQA] = useState<QA | undefined>(slot.qa);
  // 빈 칸을 열면 한 번 보여 주는 '이전 칸 그림으로 시작'. 닫거나 그리기 시작하면 사라진다.
  const [continueDismissed, setContinueDismissed] = useState(false);
  const [canvasArea, setCanvasArea] = useState(0);
  // 참고 창을 화면 밖으로 내보내지 않으려면 캔버스 영역의 가로도 알아야 한다(정사각 변만으로는 모자란다).
  const [canvasWide, setCanvasWide] = useState(0);
  // 굵기를 끄는 동안에만 보이는 크기 원(px). 손을 떼면 null.
  const [sizing, setSizing] = useState<number | null>(null);
  const [brushDetail, setBrushDetail] = useState(false);
  // 저장 확신: 저장 중에는 작은 구름, 끝나면 체크가 잠깐 보였다가 사라진다. 늘 붙어 있는 '저장됨' 글자는 없다.
  const [saveMark, setSaveMark] = useState<'saving' | 'done' | null>(null);
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 저장이 길어질 때만 켠다. 보통 저장은 한 번의 왕복이라 이 표시가 뜨지 않는다.
  const [slowSave, setSlowSave] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (markTimer.current) clearTimeout(markTimer.current); if (slowTimer.current) clearTimeout(slowTimer.current); }, []);
  const markSaved = () => { setSaveMark('done'); if (markTimer.current) clearTimeout(markTimer.current); markTimer.current = setTimeout(() => setSaveMark(null), 1200); };
  const [tab, setTab] = useState<'draw' | 'motion'>('draw');
  const [proSheet, setProSheet] = useState(false);
  const pendingAction = useRef<SaveAction | null>(null), proHandled = useRef(false);
  const [captionOpen, setCaptionOpen] = useState(false), [captionDraft, setCaptionDraft] = useState(''), [captionPlace, setCaptionPlace] = useState<Caption['place']>('bottom');
  // 문구 글씨체(45.6차): 한 번 고르면 다음 칸에서도 그대로 — 24칸을 만드는 동안 같은 성격을 다시 고르지 않는다.
  const [captionFace, setFace] = useState<CaptionStyle>(sessionCaptionFace);
  const setCaptionFace = (next: CaptionStyle) => { sessionCaptionFace = next; setFace(next); };
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
  // 저장 요청 번호(45.12차). 늦게 온 응답을 다음 저장의 응답으로 잘못 쓰지 않으려고 센다.
  const saveToken = useRef(0);
  const saveRef = useRef<(action: SaveAction) => void>(() => {});
  const inject = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  const send = (message: { type: string } & Record<string, unknown>) => { if (quiet.current && !['save', 'saved', 'saveFailed'].includes(message.type)) { held.current.push(message); return; } inject(message); };
  const unlock = () => {
    if (timeout.current) clearTimeout(timeout.current); inFlight.current = false; setBusy(false);
    if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; } setSlowSave(false);
    if (quiet.current) { quiet.current = false; held.current.splice(0).forEach(inject); }
    const next = queued.current; queued.current = null;
    if (next !== null) setTimeout(() => saveRef.current(next), 0);
  };

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  // 명세 E04: Android 뒤로는 **열려 있는 것부터** 닫는다. 급한 것(임시 편집)이 먼저다.
  // 아무것도 열려 있지 않을 때만 화면 밖으로 나간다 — 그때는 기존 닫기 경로(자동저장)를 그대로 탄다.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (busy) return true;                                   // 저장 중에는 아무 일도 하지 않는다
    if (cutoutPicker) { setCutoutPicker(false); return true; }
    if (showCanon) { setShowCanon(false); return true; }
    if (layerMenu) { setLayerMenu(null); return true; }
    if (captionOpen) { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); return true; }
    if (scene.selection) { send({ type: 'selectCancel' }); return true; }   // 임시 편집은 버리기 전에 되돌린다
    if (panel) { ease(); setPanel(null); return true; }
    if (drawRail) { ease(); setDrawRail(false); return true; }
    if (refRail) { ease(); setRefRail(false); return true; }
    if (refWindow !== 'closed') { ease(); setRefWindow('closed'); return true; }
    if (tab === 'motion') { switchTab('draw'); return true; }
    return false;                                            // 화면을 벗어나는 것은 아래 useEffect 가 맡는다
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backRef.current()) return true;
      onClose();
      return true;
    });
    return () => sub.remove();
  }, []);
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
      // 새 칸은 그림 한 장으로 연다(45.10차). 둘째 장은 '레이어 추가'로 필요할 때 만든다 —
      // 빈 장이 저장 파일까지 만들던 것(칸마다 투명 PNG 한 장)과, 빈 장에 그려 놓고 "그림이 사라졌다"고 느끼던 혼동을 없앤다.
      // 이미 저장된 칸은 자기 장 목록을 그대로 쓰므로 옛 세트의 장 수·차례·그림·부분 움직임 참조는 그대로다.
      const layers = slot.work?.layers ?? [{ ...transform('draw-1', '그림 1'), image: slot.finalImage }];
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
    // 고르면 바로 그릴 수 있게 판을 닫는다(45.25차). 세부 설정은 열려 있었더라도 함께 접힌다.
    ease(); setPanel(null); setBrushDetail(false);
  }
  // 막대를 끄는 동안에는 매 순간 저장 파일을 쓰지 않는다. 손이 멈추고 잠시 뒤 한 번만 최근 색에 남긴다.
  const remember = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (remember.current) clearTimeout(remember.current); }, []);
  function pickColor(value: string, settle = true) {
    setColor(value); send({ type: 'color', color: value });
    if (remember.current) clearTimeout(remember.current);
    if (settle) onColorUsed(value); else remember.current = setTimeout(() => onColorUsed(value), 700);
  }
  // 승인 보드 01 대로 색 패널은 SV 사각 + 색상 막대로 열린다. 견본 격자는 '팔레트' 갈래에 그대로 있다(45.28차).
  const [colorView, setColorView] = useState<'palette' | 'custom'>('custom');
  // PRO 브러시. 저장된 값은 PRO 가 끝나도 지우지 않고, 효력만 무료 범위(프리셋 없음 · 진하기 100% · 보정 끔/약)로 돌린다.
  const [brushPrefs, setBrushPrefs] = useState<BrushSettings>(() => cleanBrush(brushSettings));
  const brushSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (brushSave.current) clearTimeout(brushSave.current); }, []);
  // 진하기와 선 보정은 무료다(드로잉 앱의 기본 조절). 고급 브러시 네 가지만 PRO 이고, PRO 가 끝나면 효력만 기본 선으로 돌린다.
  const effectiveBrush = {
    preset: pro ? brushPrefs.preset : (brushPrefs.preset && FREE_PRESETS.has(brushPrefs.preset) ? brushPrefs.preset : undefined),
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
  const brushInfo = (key: BrushKey) => CATALOG.find(b => b.key === key) ?? CATALOG[0];
  // 지금 이 브러시로 그리고 있는가. 프리셋이 걸려 있으면 프리셋이, 없으면 기본 브러시가 기준이다.
  const isBrushOn = (key: BrushKey) => {
    const b = brushInfo(key);
    return effectiveBrush.preset ? effectiveBrush.preset === b.preset : (!b.preset && brush === b.base);
  };
  // 카드 한 번 = 고르기. 이미 고른 카드를 다시 = 세부 설정 열기(승인 보드의 '펜 설정').
  function pickBrush(key: BrushKey) {
    const b = brushInfo(key);
    if (isBrushOn(key)) { ease(); setPanel('brush'); setBrushDetail(true); return; }
    if (b.pro && !pro) { onRequestPro(); return; }
    if (b.preset) { changeBrush({ preset: b.preset }); }
    else { changeBrush({ preset: undefined, base: b.base }); setBrush(b.base!); send({ type: 'brush', brush: b.base! }); }
    if (tool !== 'pen') { setTool('pen'); send({ type: 'tool', tool: 'pen' }); onToolChange?.('pen'); }
  }
  // 전체 목록에서 고르면: 그 브러시로 그리고 목록을 닫는다.
  // **즐겨찾기는 건드리지 않는다**(45.31) — 한 번 썼다고 고정해 둔 칸이 밀려나면 안 된다.
  function pickFromAll(key: BrushKey) {
    const b = brushInfo(key);
    if (b.pro && !pro) { onRequestPro(); return; }
    if (b.preset) { changeBrush({ preset: b.preset }); }
    else { changeBrush({ preset: undefined, base: b.base }); setBrush(b.base!); send({ type: 'brush', brush: b.base! }); }
    if (tool !== 'pen') { setTool('pen'); send({ type: 'tool', tool: 'pen' }); onToolChange?.('pen'); }
    ease(); setPanel(null); setBrushDetail(false);
  }
  function selectPreset(key: NonNullable<BrushSettings['preset']>) {
    if (!pro) { onRequestPro(); return; }
    changeBrush({ preset: key });
    setTool('pen'); send({ type: 'tool', tool: 'pen' });
    // 기본 브러시와 같은 규칙: 고르면 바로 그릴 수 있게 판을 닫는다(45.25차).
    ease(); setPanel(null); setBrushDetail(false);
  }
  const brushKey = JSON.stringify(effectiveBrush);
  useEffect(() => {
    if (!initialized) return;
    send({ type: 'brushSettings', preset: effectiveBrush.preset ?? null, opacity: effectiveBrush.opacity, stabilizer: effectiveBrush.stabilizer === 'off' ? 'light' : effectiveBrush.stabilizer, smoothing: effectiveBrush.stabilizer !== 'off' });
  }, [initialized, brushKey]);
  // 스포이드는 캔버스를 보고 눌러야 하므로 패널을 내린다. 색을 읽으면 패널이 직접 선택으로 다시 올라온다.
  // 기본 레퍼런스를 고르면 큰 격자는 물러난다. 그림이 들어오면(ready) 여기서 기존 참고 레이어 흐름으로 넘긴다 — 지금은 자리표시라 접기만 한다.
  function pickBuiltinReference(index: number) {
    ease(); setRefBrowse(false); setPoseIndex(index);
    // ready=true 가 되면 이 자리에서 기존 addReferences 흐름으로 참고 레이어를 추가한다(넘기기도 같은 함수를 쓴다).
  }
  // 좌우로 넘겨 자세를 바꾼다. 분류 밖으로는 나가지 않고, 끝에서는 더 가지 않는다(돌지 않는다).
  function movePose(next: number) {
    const last = BUILTIN_REFERENCES.placeholderCount - 1;
    const at = Math.max(0, Math.min(last, next));
    if (at === poseIndex) return;
    setPoseIndex(at);
    // ready=true 가 되면 여기서 캔버스의 참고 레이어 그림만 바꾼다(위치·크기·진하기는 그대로 둔다).
  }
  // 스마트폰에서 색을 집는 가장 짧은 길: 스포이드를 누른 채 그림 위로 끌었다가 뗀다.
  // (그냥 누르기만 하면 예전처럼 '캔버스에서 색을 누르세요' 방식이 그대로 이어진다.)
  const eyedropHandlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: () => {
      // 패널은 아직 내리지 않는다 — 끄는 동안 이 손잡이가 화면에서 사라지면 손가락을 따라갈 수 없다.
      dropped.current = null; setDropper(null); setDropping(true);
      canvasRef.current?.measureInWindow((x, y, w, h) => { canvasBox.current = { x, y, w, h }; });
      send({ type: 'eyedrop', on: true });
    },
    onResponderMove: (e: GestureResponderEvent) => {
      // 자를 아직 못 쟀으면 캔버스 사각형 크기로 어림한다(기기에서는 누르는 순간 실제 위치를 잰다).
      const box = canvasBox.current ?? (canvasSide ? { x: 0, y: 0, w: canvasSide, h: canvasSide } : null);
      if (!box || !box.w || !box.h) return;
      const vx = (e.nativeEvent.pageX - box.x) / box.w, vy = (e.nativeEvent.pageY - box.y) / box.h;
      if (vx < 0 || vx > 1 || vy < 0 || vy > 1) { setDropper(null); dropped.current = null; return; }
      setDropper(d => ({ vx, vy, color: d?.color ?? null }));
      const now = Date.now();
      if (now - sampleAt.current > 60) { sampleAt.current = now; send({ type: 'sample', vx, vy }); }
    },
    onResponderRelease: () => {
      const picked = dropped.current;
      setDropper(null); dropped.current = null; setDropping(false);
      // 캔버스까지 끌지 않았으면(그냥 눌렀다 뗐으면) 예전처럼 패널을 내리고 캔버스를 눌러 집는다.
      if (!picked) { ease(); setPanel(null); setDrawRail(false); setRefRail(false); return; }
      send({ type: 'eyedrop', on: false });
      pickColor(withAlpha(picked, alphaOf(color)));
      ease(); setPanel(null);
    },
    onResponderTerminate: () => { setDropper(null); dropped.current = null; setDropping(false); },
  };
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
  // 장을 지웠다 다시 추가해도 이미 쓰는 번호와 겹치지 않게, 비어 있는 가장 작은 번호를 쓴다(45.11차).
  function addDrawing() { let n = 1; while (scene.layers.some(l => l.id === 'draw-' + n)) n++; send({ type: 'addLayer', id: 'draw-' + n, name: `그림 ${n}` }); }
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
    // 입력칸에 확정하지 않은 문구가 남아 있으면 저장 직전에 그대로 넣는다 — '적용'을 누르지 않았다고 조용히 잃지 않는다(45.1차).
    // 빈 입력은 건드리지 않는다: 문구를 지우는 일은 '문구 지우기'로만 한다.
    const pendingCaption = captionOpen ? captionDraft.trim() : '';
    if (pendingCaption && pendingCaption !== (scene.caption?.text ?? '')) send({ type: 'caption', caption: { text: pendingCaption, place: captionPlace, color, style: captionFace } });
    inFlight.current = true; nextAction.current = action;
    // 자동저장('stay')은 화면을 잠그지 않는다. 칸을 떠나는 저장(닫기·완성·이동·공유)만 잠깐 잠근다.
    if (action === 'stay') quiet.current = true; else setBusy(true);
    setSaveMark('saving');
    const token = ++saveToken.current;
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => setSlowSave(true), 1500);
    timeout.current = setTimeout(() => { send({ type: 'saveFailed', token }); setSaveMark(null); unlock(); Alert.alert('저장이 늦어지고 있어요', '작업은 화면에 그대로 있어요. 잠시 뒤 스스로 다시 저장하고, 닫기나 완성을 누르면 바로 다시 저장해요.'); }, 20000);
    send({ type: 'save', gif: !!scene.motion, token });
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
    if (current?.style) setCaptionFace(current.style);
    ease(); setDrawRail(false); setRefRail(false); setPanel('caption'); setCaptionOpen(true);
  }
  // 문구 색(45.5차): 지금까지 문구 패널의 동그라미는 '지금 색'을 보여 주기만 했다. 이제 누르면 실제로 바뀐다.
  // 캔버스에 이미 문구가 있으면 그 문구의 색만 갈아 끼운다 — 옮겨 둔 자리·크기·회전은 그대로다.
  function setCaptionColor(next: string) {
    pickColor(next);
    if (scene.caption?.text) send({ type: 'caption', caption: { ...scene.caption, color: next } });
  }
  function changeCaptionFace(next: CaptionStyle) {
    setCaptionFace(next);
    if (scene.caption?.text) send({ type: 'caption', caption: { ...scene.caption, style: next } });
  }
  function applyCaption(text: string) {
    const clean = text.trim();
    send({ type: 'caption', caption: clean ? { text: clean, place: captionPlace, color, style: captionFace } : null });
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
  // 고른 표현을 밑그림으로 깐다. 새 길을 내지 않고 참고 사진과 똑같은 길을 쓴다:
  // 참고 레이어는 그림 레이어와 따로 쌓이므로 기존 그림·문구·부분 움직임을 건드리지 않고,
  // 최종 PNG·움직이는 파일·작품 썸네일에도 들어가지 않는다(캔버스가 화면에 그릴 때만 깔린다).
  // 비율 유지·가운데 배치·기본 진하기 30% 도 기존 참고 레이어 규칙을 그대로 쓴다.
  async function insertGuideUnderlay() {
    if (!guideExample || !onImportGuideExample || inFlight.current) return;
    // 이 칸에 이미 깔아 둔 밑그림이 있으면 같은 그림을 또 들이지 않는다. 숨겨 뒀다면 다시 보여 주기만 한다.
    const already = guideLaid.current && scene.references.some(r => r.id === guideLaid.current) ? guideLaid.current : null;
    if (already) {
      const shown = scene.references.find(r => r.id === already);
      if (!shown?.visible || scene.activeReferenceId !== already) send({ type: 'toggleReference', id: already });
      setRefRail(true); setRefSource('mine'); setRefBrowse(false); setPanel(null); setDrawRail(false);
      return;
    }
    // 장이 이미 다 찼으면 **아무것도 하기 전에** 말한다(45.26차 정정).
    // 예전에는 밑그림만 깔고 빈 장을 못 만든 채 끝냈다 — 참고는 늘었는데 그 위에 그릴 곳이 없는 반쪽 상태였다.
    // 그것을 성공으로 치지 않는다: 참고도 장도 건드리지 않고 돌아간다.
    if (scene.layers.length >= 4) {
      Alert.alert('그림 장이 가득 찼어요', '밑그림을 깔면 그 위에 새로 그릴 장이 한 장 필요해요. 지금은 네 장이 모두 차 있어 넣지 않았어요 — 레이어에서 쓰지 않는 장을 지우고 다시 눌러 주세요. 지금 그림은 그대로예요.');
      return;
    }
    inFlight.current = true; setBusy(true);
    // 되돌릴 거리를 적어 둔다. 중간에 어긋나면 이번에 더한 것만 걷어내고 넣기 전으로 돌린다.
    let laidId: string | null = null;
    try {
      const image = await onImportGuideExample(guideExample.artwork);
      if (!image) return;
      const id = 'ref-' + image.path;
      send({ type: 'addReferences', references: [{ ...transform(id, '밑그림 · ' + guideExample.title), visible: false, opacity: .3, path: image.path, data: await dataUrl(image) }] });
      laidId = id;
      // 보이게 하는 일은 참고 타일을 누를 때와 같은 명령에 맡긴다 — '한 번에 하나만 보인다'는 기존 규칙이 그대로 지켜진다.
      send({ type: 'toggleReference', id });
      // 밑그림을 깔았으면 그 위에 바로 그릴 빈 장을 하나 만든다.
      // 엔진이 새 장을 맨 위에 놓고 바로 고른다(addLayer → selectDrawLayer). 기존 장은 건드리지 않는다.
      addDrawing();
      guideLaid.current = id;
      laidId = null;                    // 여기까지 오면 되돌릴 것이 없다
      setRefRail(true); setRefSource('mine'); setRefBrowse(false); setPanel(null); setDrawRail(false);
    } catch (e) {
      // 이번에 더한 참고만 걷어내고 넣기 전 상태로 돌린다. 기존 그림·참고는 건드리지 않는다.
      if (laidId) send({ type: 'removeReference', id: laidId });
      guideLaid.current = null;
      Alert.alert('밑그림을 넣지 못했어요', userMessage(e));
    }
    finally { unlock(); }
  }
  // 가이드에서 고른 예시는 칸을 열 때 한 번만 쓴다. 다시 열거나 옆 칸으로 넘어갈 때 저절로 또 깔리지 않는다.
  useEffect(() => {
    if (!initialized || !guideExample || guideUsed.current) return;
    guideUsed.current = true;
    if (guideExampleMode === 'underlay') void insertGuideUnderlay();
    else setRefWindow('open');
  }, [initialized, guideExample, guideExampleMode]);
  // 참고 창 크기와 머무를 수 있는 자리. 창은 늘 캔버스 영역 안에 있어 화면 밖으로 빠져나가지 않는다.
  // 명세 E05: 기본은 clamp(112dp, 캔버스폭의 36%, 144dp). 예전 46%(최대 190)는 캔버스를 너무 많이 덮었다.
  // 사용자가 우하단 손잡이로 늘리면 그 폭을 쓰되, 최소 112 · 최대 캔버스폭 60% 를 넘지 않는다.

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
  // 전체 브러시 목록(45.31차). 30종을 선·채색·질감·효과로 나눠 놓는다 — 평면 목록 서른 줄이 아니다.
  // 고르는 것과 즐겨찾기에 고정하는 것은 **다른 행동**이다: 카드를 누르면 고르고, 압정을 누르면 칸을 고른다.
  // 잠긴 브러시도 이름과 실제 획 견본이 그대로 읽힌다.
  const brushSheet = <View style={{ flexShrink: 1, minHeight: 0, paddingHorizontal: 12, paddingBottom: 6, gap: 6 }}>
    {!!pinning && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.ink }}>‘{brushInfo(pinning).title}’ 를 어느 칸에?</Text>
      {quickBrushes.map((k, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={'즐겨찾기 ' + (i + 1) + '번 칸에 넣기'}
        onPress={() => pinBrush(i, pinning)}
        style={({ pressed }) => ({ minHeight: C.tap, paddingHorizontal: 10, borderRadius: C.radius.button, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: C.lineStrong, backgroundColor: pressed ? C.fill : C.paper })}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.ink }}>{i + 1}</Text>
        <Text numberOfLines={1} style={{ fontSize: 9, color: C.faint }}>{brushInfo(k).title}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="즐겨찾기 고정 취소" onPress={() => setPinning(null)}
        style={{ minHeight: C.tap, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>취소</Text>
      </Pressable>
    </View>}
    <ScrollView testID="브러시 목록" style={{ flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator
      contentContainerStyle={{ gap: 10, paddingTop: 2, paddingBottom: 12 }}>
      {!!effectiveBrush.preset && effectiveBrush.preset in RETIRED &&
        <Text style={{ fontSize: 11, color: C.muted }}>지금은 예전 브러시 ‘{RETIRED[effectiveBrush.preset]}’ 로 그리고 있어요. 그대로 쓸 수 있어요.</Text>}
      {GROUPS.map(groupName => {
        const group = CATALOG.filter(b => b.group === groupName);
        if (!group.length) return null;
        const paid = group.filter(b => b.pro).length;
        return <View key={groupName} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{groupName}</Text>
            <Text style={{ flex: 1, fontSize: 11, color: C.faint }}>무료 {group.length - paid} · PRO {paid}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {group.map(b => { const on = isBrushOn(b.key), locked = b.pro && !pro, fav = quickBrushes.indexOf(b.key);
              return <View key={b.key} style={{ width: '31.5%' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={'브러시 ' + b.title}
                  accessibilityHint={locked ? 'PRO 브러시예요' : b.use} accessibilityState={{ selected: on }}
                  onPress={() => pickFromAll(b.key)}
                  style={({ pressed }) => ({ minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: C.radius.button,
                    borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : pressed ? C.fill : C.paper })}>
                  {/* 잠긴 것도 실제 획 견본과 이름이 그대로 읽힌다. 흐리게 지우지 않는다. */}
                  <Image accessibilityIgnoresInvertColors source={b.stroke} style={{ width: '78%', height: 16, tintColor: color }} resizeMode="contain" />
                  <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{b.title}</Text>
                  {b.pro && <Text style={{ fontSize: 8, fontWeight: '800', color: C.faint, letterSpacing: .3 }}>PRO</Text>}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={(fav >= 0 ? '즐겨찾기에 있음 ' : '즐겨찾기에 고정 ') + b.title}
                  onPress={() => setPinning(b.key)} hitSlop={6}
                  style={{ position: 'absolute', right: 0, top: 0, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={fav >= 0 ? 'pin' : 'pin-outline'} size={13} color={fav >= 0 ? C.ink : C.faint} />
                </Pressable>
              </View>; })}
          </View>
        </View>; })}
      {/* 고른 브러시가 무엇에 쓰는 것인지 한 줄로. 카드마다 설명을 붙이면 목록이 읽히지 않는다. */}
      <Text testID="브러시 쓰임" style={{ fontSize: 11, color: C.muted }}>{(CATALOG.find(b => isBrushOn(b.key)) ?? CATALOG[0]).use}</Text>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="세부 설정" accessibilityState={{ expanded: brushDetail }} onPress={() => { ease(); setBrushDetail(!brushDetail); }}
      hitSlop={{ top: 2, bottom: 2 }}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderTopWidth: 1, borderColor: C.line }}>
      <MaterialCommunityIcons name="tune-variant" size={18} color={C.muted} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>세부 설정</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.faint, textAlign: 'right' }}>진하기 {Math.round(effectiveBrush.opacity * 100)}% · 선 보정 {STAB_LEVELS.find(([k]) => k === stab)?.[1] ?? '끔'}</Text>
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
  const dockOpen = !!scene.selection || (!!panel && panel !== 'more') || drawRail || refRail || !!scene.captionPicked;
  // 움직이기 탭에서는 캔버스를 위로 붙이고, 패널은 캔버스 아래 남는 자리(+ 기본 도구 줄 자리)를 쓴다 — 미리보기를 가리지 않는다.
  // 남는 자리가 작은 화면에서만 최소 높이만큼 캔버스 아래쪽에 겹친다.
  const motionHeight = Math.max(250, Math.min(Math.round(windowHeight * .55), Math.round(canvasArea - (canvasSide ?? canvasArea)) + BASE_H));
  // 패널 표면: 흰 표면 + 위쪽 24 둥글기 + 옅은 선 하나. 떠 있는 표면이지만 캔버스 위 그림자는 두지 않는다(그림이 흐려 보인다).
  const raised = dockOpen || tab === 'motion';
  const dock = { position: 'absolute', left: 0, right: 0, bottom: tab === 'draw' && !typing ? BASE_H : 0, zIndex: 20, borderTopWidth: raised ? 1 : 0, borderLeftWidth: raised ? 1 : 0, borderRightWidth: raised ? 1 : 0, borderColor: C.line, borderTopLeftRadius: raised ? 24 : 0, borderTopRightRadius: raised ? 24 : 0, overflow: 'hidden', backgroundColor: C.paper, flexShrink: 0 } as const;
  const narrow = windowWidth < 360;
  // 머리줄이 두 줄로 갈릴지는 '실제로 잰 폭'으로 정한다 — 화면이 좁아서든 글자가 커서든 같은 규칙이다.
  const [headW, setHeadW] = useState(0), [tabsW, setTabsW] = useState(0), [aidsW, setAidsW] = useState(0);
  const [topW, setTopW] = useState(0), [cmdW, setCmdW] = useState(0);
  const headStacked = tab === 'draw' && headW > 0 && tabsW > 0 && aidsW > 0 && tabsW + aidsW + 12 > headW;
  // 위 줄의 '레이어'는 지금 어느 장을 쓰는지 말한다 — 열지 않아도 읽힌다(45.5차).
  const drawLayers = scene.layers.filter(l => l.id.startsWith('draw-'));
  const layerAt = (id: string) => scene.layers.findIndex(l => l.id === id);
  const activeLayerAt = drawLayers.findIndex(l => l.id === scene.activeLayerId);
  const layerBadge = drawLayers.length > 1 && activeLayerAt >= 0 ? '레이어 ' + (activeLayerAt + 1) : '레이어';
  // 보조 도구 묶음. 한 줄에 설 때나 두 줄로 내려올 때나 같은 것이라, 잰 폭이 자리에 따라 달라지지 않는다.
  const aidRow = <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== aidsW) setAidsW(w); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* 그림을 돕는 것끼리 한 무리(45.5차): 가져오는 것(참고) · 쌓는 것(레이어) · 얹는 것(문구).
          아래 도구 줄은 '지금 그리는 손'만 다룬다. 레이어는 몇 번째를 쓰는 중인지 여기서 바로 읽힌다. */}
      {tab === 'draw' && ([['참고', refRail || showCanon, 'image-outline', '참고', () => { ease(); setRefRail(!refRail); setRefBrowse(true); setDrawRail(false); setPanel(null); setCaptionOpen(false); }],
         ['레이어', drawRail, 'layers-outline', layerBadge, () => { ease(); setDrawRail(!drawRail); setRefRail(false); setPanel(null); setCaptionOpen(false); }],
         ['문구', panel === 'caption' || !!scene.captionPicked, 'format-text', '문구', () => { if (panel === 'caption') { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); } else { setDrawRail(false); setRefRail(false); openCaption(); } }]] as const).map(([label, on, icon, title, run]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={run}
          style={{ minHeight: 48, paddingHorizontal: narrow ? 1 : 2, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ height: 32, paddingHorizontal: narrow ? 6 : 8, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: on ? C.accentSoft : 'transparent' }}>
            {!narrow && <MaterialCommunityIcons name={icon} size={16} color={on ? C.ink : C.muted} />}
            <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
          </View>
        </Pressable>)}
  </View>;
  const emptyCut = !slot.work && !slot.finalImage;
  // 제안할 수 있는 상태(continueAvailable)와 지금 캔버스에 보이는지(offerContinue)를 나눈다. 더보기 메뉴는 앞의 것으로 가려서,
  // 메뉴를 여는 순간 같은 기능의 두 번째 입구가 생기지 않게 한다.
  const continueAvailable = initialized && emptyCut && hasPrevious && !!previousImage && !continueDismissed && !scene.dirty && !scene.undo;
  const offerContinue = continueAvailable && tab === 'draw' && !panel && !refRail && !drawRail;
  // 작업 패널(브러시·색·문구·참고 관리)과 레이어 줄이 열려 있으면, 캔버스를 누르는 첫 손가락은 '패널 닫기'다(45.4차).
  // 참고 줄은 제외한다 — 참고는 캔버스 위에서 옮기고 키우는 중이라 손가락이 캔버스로 가야 한다.
  const panelCovering = tab === 'draw' && ((!!panel && panel !== 'more') || drawRail);
  // 캔버스 위에는 한 번에 한 가지만 말한다(45.2차). 위에서부터 급한 순서로 하나를 고른다.
  const canvasMessage: 'saving' | 'hidden' | 'eyedrop' | 'previous' | 'guide' | 'zoomHint' | null =
    tab !== 'draw' ? null
    // 저장이 길어지는 동안에는 이것이 가장 급한 소식이다 — 지금 획이 캔버스에 닿지 않는 이유다.
    : slowSave ? 'saving'
    : hiddenWarning ? 'hidden'
    // 끌어서 집는 동안에는 안내 대신 집히는 색을 보여 준다 — 같은 자리에 둘이 겹치지 않게(45.4 실기기).
    : (scene.picking && !dropping) ? 'eyedrop'
    // 가이드에서 고른 표현이 이전 칸 제안보다 앞이다 — 방금 사용자가 고른 이 칸의 할 일이라서. 닫으면 그 아래가 보인다.
    // 참고 자리가 서 있으면 같은 말이 거기 적혀 있다 — 캔버스 위에 또 띄우지 않는다(45.25차).
    : (guideHint && guideHintOpen && !scene.dirty && !(guideExample && refWindow !== 'closed')) ? 'guide'
    : offerContinue ? 'previous'
    : (zoomHint && zoom <= 1.05) ? 'zoomHint'
    : null;
  // 숨김 경고는 사실인 동안만 남는다(45.2 검증): 레이어를 다시 보이게 했거나 스포이드처럼 다른 일을 시작하면 자리를 비운다.
  // 알림 자리가 하나뿐이라, 끝난 경고가 남아 있으면 그 뒤의 안내(스포이드 취소·표현 힌트·이전 칸)가 서지 못한다.
  useEffect(() => {
    if (!hiddenWarning) return;
    const active = scene.layers.find(l => l.id === scene.activeLayerId);
    if (!active || active.visible || scene.picking) setHiddenWarning('');
  }, [hiddenWarning, scene.layers, scene.activeLayerId, scene.picking]);
  // 확대 안내는 실제로 보일 수 있을 때(이전 칸 제안 카드가 캔버스 위를 덮지 않을 때) 한 번 띄운다 — 카드에 가려진 채 '보였음'으로 지나가지 않게(44차 실기기).
  useEffect(() => { if (!initialized || zoomHintShown || offerContinue || guideHint || tab !== 'draw') return; zoomHintShown = true; setZoomHint(true); zoomHintTimer.current = setTimeout(() => setZoomHint(false), 2600); }, [initialized, offerContinue, guideHint, tab]);
  // 효과 견본에 쓸 이 칸의 그림: 저장된 그림이 지금 것과 같으면 그 파일, 아직 저장 전이면 지금 레이어의 작은 그림.
  // 이 칸에 그림이 있으면 언제나 사용자의 그림이 먼저다. 아무것도 그리지 않은 칸에서만 견본 그림(motionExampleArtwork 자리)이 대신 움직인다(44.2차).
  const hasDrawing = !!slot.finalImage || !!slot.work || scene.dirty || scene.undo;
  const sample = !hasDrawing ? undefined
    : !scene.dirty && slot.finalImage ? imageUri(slot.finalImage.path)
    : thumbs[scene.activeLayerId] ?? (slot.finalImage ? imageUri(slot.finalImage.path) : undefined);
  type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  const brushIcon: IconName = effectiveBrush.preset ? 'brush-variant' : brush === 'pen' ? 'fountain-pen-tip' : brush === 'brush' ? 'brush' : 'pencil';
  // 아래 줄은 '지금 그리는 손'이다: 브러시와 색이 주인공, 나머지 셋은 모드를 바꾸는 빠른 칸(45.5차).
  // 네 번째 값: 아이콘 옆에 이름을 남길지. 처음 보는 사람이 그림만으로 알 수 있는 것은 이름을 떼고, 애매한 것만 남긴다.
  const quickTools: [Tool, string, IconName, boolean][] = [['eraser', '지우개', 'eraser', true], ['fill', '채우기', 'format-color-fill', true], ['select', '선택', 'select-drag', true]];
  // 되돌리기 · 다시 실행 · 완성. 승인 보드처럼 머리줄에 선다(45.28차).
  // '완성'은 예전 아래 줄과 같은 일을 한다 — 완성 표시 · 저장 · 다음 칸으로.
  const cmdRow = <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== cmdW) setCmdW(w); }}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
    <Bar label="되돌리기" icon="undo-variant" disabled={!initialized || !scene.undo || busy} onPress={() => send({ type: 'undo' })} />
    <Bar label="다시 실행" icon="redo-variant" disabled={!initialized || !scene.redo || busy} onPress={() => send({ type: 'redo' })} />
    <Pressable accessibilityRole="button" accessibilityLabel="완성 후 다음" accessibilityHint={'이 칸을 완성으로 표시하고 저장한 뒤 ' + (completeTitle.includes('전체') ? '전체 보기로 가요' : '다음 칸으로 가요')}
      disabled={busy || !initialized} onPress={() => save('complete')}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, marginLeft: 2, borderRadius: C.radius.button, flexDirection: 'row', gap: 4,
        alignItems: 'center', justifyContent: 'center', backgroundColor: busy || !initialized ? C.fill : pressed ? C.accentLine : C.accent })}>
      <Text numberOfLines={1} style={{ color: C.accentInk, fontWeight: '800', fontSize: 14 }}>완성</Text>
      <MaterialCommunityIcons name="arrow-right" size={16} color={C.accentInk} />
    </Pressable>
  </View>;
  // 머리줄이 넘치면 명령 묶음을 둘째 줄로 내린다. 세트 이름이 설 자리(96dp)를 남긴다.
  // 320dp 급에서는 재 보기 전에도 분명히 모자라므로 바로 내린다 — 이름을 글자 단위로 쌓거나
  // 손가락 자리를 줄이는 대신 줄을 하나 더 쓴다(45.29차).
  const cmdStacked = narrow || (topW > 0 && cmdW > 0 && cmdW + 44 + 28 + 44 + 96 > topW);
  return <Modal onRequestClose={() => { if (Keyboard.isVisible()) { Keyboard.dismiss(); return; } if (panel) { ease(); setPanel(null); return; } if (drawRail || refRail) { ease(); setDrawRail(false); setRefRail(false); return; } if (showCanon) { setShowCanon(false); return; } save('close'); }} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* 머리: 닫기 · 세트 이름과 칸 번호 · 되돌리기 · 다시 · 더보기. 저장 버튼은 없다 — 작업은 자동저장된다. */}
      <View onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w !== topW) setTopW(w); }}
        style={{ minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }}>
        <Bar label="그리기 닫기" icon="chevron-left" strong disabled={busy} onPress={() => save('close')} />
        {/* 이름은 한 줄로 줄이고 넘치면 말줄임한다. 칸 번호도 한 줄이다 — 글자 단위로 여러 줄에 쌓지 않는다. */}
        <View style={{ flex: 1, flexShrink: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: C.tap }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: '100%', fontSize: 15, lineHeight: 20, color: C.ink, fontWeight: '700' }}>{setName}</Text>
          <Text numberOfLines={1} accessibilityLabel="현재 칸" style={{ maxWidth: '100%', fontSize: 11, lineHeight: 14, fontWeight: '600', color: C.faint, letterSpacing: .4 }}>{String(slot.number).padStart(2, '0') + ' / ' + slotCount}</Text>
        </View>
        <View testID="저장 표시" accessibilityLabel={saveMark === 'saving' ? '저장 중' : saveMark === 'done' ? '저장됨' : undefined} style={{ width: 28, height: C.tap, alignItems: 'center', justifyContent: 'center' }}>
          {saveMark === 'saving' && <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={C.faint} />}
          {saveMark === 'done' && <MaterialCommunityIcons name="cloud-check-outline" size={17} color={C.success} />}
        </View>
        {!cmdStacked && cmdRow}
        <Bar label="더보기" icon="dots-horizontal" active={panel === 'more'} onPress={() => { setPanel(panel === 'more' ? null : 'more'); setDrawRail(false); setRefRail(false); }} />
      </View>
      {cmdStacked && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 6, paddingBottom: 4, backgroundColor: C.paper }}>{cmdRow}</View>}
      {/* 모드(그리기·움직이기)와 보조(참고·레이어·문구)는 캔버스를 지키려고 한 줄에 선다.
          다만 둘이 폭을 넘으면 글자나 손가락 자리를 줄이지 않고 두 줄로 바꾼다 — 320dp 나 큰 글자에서 겹치던 자리다.
          재는 것은 실제 배치 폭이라 글자 배율이 커져도 같은 규칙으로 갈린다(45.24). */}
      <View onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w !== headW) setHeadW(w); }}
        style={{ borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== tabsW) setTabsW(w); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {([['draw', '그리기'], ['motion', '움직이기']] as const).map(([key, title]) =>
            <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: tab === key }}
              onPress={() => switchTab(key)}
              style={{ minHeight: 48, paddingHorizontal: narrow ? 9 : 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: tab === key ? '800' : '600', color: tab === key ? C.ink : C.faint }}>{title}</Text>
              <View pointerEvents="none" style={{ position: 'absolute', left: narrow ? 9 : 12, right: narrow ? 9 : 12, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: tab === key ? C.accent : 'transparent' }} />
            </Pressable>)}
          <View style={{ flex: 1 }} />
          </View>
          <View style={{ flex: 1 }} />
          {!headStacked && aidRow}
        </View>
        {headStacked && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderTopWidth: 1, borderColor: C.line }}>{aidRow}</View>}
      </View>

      {/* 캔버스는 도구를 열고 닫아도 제자리다(45.5차). 색 패널 때문에 그림이 위로 뛰던 자리 이동을 없앴다 —
          "조절한다고 그림이 도망가면 안 된다". 패널은 아래에서 겹쳐 뜨고, 덮는 높이는 캔버스 절반을 넘지 않는다. */}
      {/* 참고 자리(45.25차). 예전에는 캔버스 위에 떠 있어 그리는 자리를 덮었다 —
          이제 캔버스 밖 제 자리에 선다. 이 줄이 자리를 차지하면 아래 캔버스 영역이 그만큼 줄고,
          정사각 캔버스는 줄어든 자리에 다시 맞춰진다(canvasSide = min(폭, 높이)).
          그림 자체는 여전히 360×360 이고 저장 좌표도 그대로다 — 보이는 크기만 달라진다. */}
      {!!guideExample && refWindow !== 'closed' && <GuideStrip
        title={guideExample.title} hint={guideExample.hint} artwork={guideExample.display ?? guideExample.artwork}
        collapsed={refWindow === 'collapsed'}
        onCollapse={() => { ease(); setRefWindow(refWindow === 'collapsed' ? 'open' : 'collapsed'); }}
        onClose={() => { ease(); setRefWindow('closed'); }}
        onUnderlay={onImportGuideExample ? () => void insertGuideUnderlay() : undefined} />}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: tab === 'motion' ? 'flex-start' : 'center', backgroundColor: C.surface2 }}
        onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; const side = Math.floor(Math.min(w, h)); if (side > 0 && side !== canvasSide) setCanvasSide(side); if (h > 0 && Math.round(h) !== canvasArea) setCanvasArea(Math.round(h)); if (w > 0 && Math.round(w) !== canvasWide) setCanvasWide(Math.round(w)); }}>
        {/* 캔버스 틀: 네이티브 WebView 는 크기 지정을 무시하고 영역 전체를 채워, 캔버스가 위에 붙고 아래에 빈 띠가 남았다(40차 실기기 bounds 0,381–1080,1882).
            정사각 틀로 감싸 잘라 두면 WebView 가 틀만큼만 차지하고, 그리기 탭에서는 영역 가운데·움직이기 탭에서는 위에 선다. */}
        <View ref={canvasRef} collapsable={false} style={canvasSide ? { width: canvasSide, height: canvasSide, overflow: 'hidden', backgroundColor: C.surface2 } : { width: '100%', aspectRatio: 1, maxHeight: '100%', overflow: 'hidden' }}>
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
            if (m.type === 'sampled') { dropped.current = m.color ?? null; setDropper(d => d ? { ...d, color: m.color ?? null } : d); return; }
            if (m.type === 'picked') {
              // 읽은 것은 색 계열이다. 지금 쓰던 투명도는 그대로 둔다.
              if (m.color) pickColor(withAlpha(m.color, alphaOf(color)));
              else Alert.alert('색이 없는 곳이에요', '그림이나 참고 사진이 보이는 곳을 눌러 주세요.');
              setColorView('custom'); setPanel('color');
            }
            if (m.type === 'error') { unlock(); Alert.alert('그리지 못했어요', userMessage(m.message)); }
            // 번호가 다른 저장 응답은 이미 포기한 요청의 뒤늦은 대답이다 — 지금 그림 대신 옛 그림을 쓰지 않도록 버린다.
            if (m.type === 'save' && inFlight.current && m.token === saveToken.current) {
              try {
                let action = nextAction.current;
                // An empty canvas is not a finished cut. Keep the work, refuse the declaration only.
                const blank = !(m.metrics?.coverage > 0);
                if (action === 'complete' && blank) action = 'stay';
                if (m.dirty !== false || action === 'stay' || action === 'share' || action === 'complete' || action === 'reference') {
                  const result = onSave(m, slot.dialogue, action === 'complete'); setQA(result);
                }
                send({ type: 'saved', token: m.token }); unlock(); markSaved();
                if (nextAction.current === 'complete' && blank) { Alert.alert('아직 빈 칸이에요', '선을 하나라도 그리면 완성할 수 있어요.'); return; }
                if (action === 'motion') switchTab('draw');
                else if (action === 'close') onClose();
                else if (action === 'complete') onComplete();
                else if (action === 'reference') onSetReference();
                else if (typeof action === 'number') onNavigate(action);
                else if (action === 'share') onShare().catch(e => Alert.alert('공유하지 못했어요', userMessage(e)));
              } catch (e) { send({ type: 'saveFailed', token: m.token }); setSaveMark(null); unlock(); Alert.alert('저장하지 못했어요', userMessage(e)); }
            }
          } catch (e) { unlock(); Alert.alert('그리지 못했어요', userMessage(e)); }
        }} style={{ flex: 1, backgroundColor: C.surface2 }} />
        </View>

        {/* 스포이드를 끄는 동안(45.4차): 집는 자리에 고리, 손가락에 가리지 않게 위쪽에 지금 읽힌 색과 값. */}
        {!!dropper && !!canvasSide && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' }}>
          <View style={{ position: 'absolute', left: Math.max(0, Math.min(canvasSide, (canvasSide - 0) * 0 + dropper.vx * canvasSide)) - 17, top: Math.max(0, Math.min(canvasSide, dropper.vy * canvasSide)) - 17,
            width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: dropper.color ?? 'transparent', ...Elev[2] }} />
          <View testID="스포이드 미리보기" style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, backgroundColor: '#171717C7' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: dropper.color ?? '#00000000', borderWidth: 1, borderColor: '#FFFFFFB3' }} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>{dropper.color ?? '색이 없는 곳'}</Text>
          </View>
        </View>}
        {/* 패널이 열린 동안의 캔버스: 누르면 패널만 닫힌다. 이 손가락은 WebView 에 닿지 않으므로 채우기·획·지우기·선택이 일어나지 않는다.
            확대·이동 값은 캔버스 안에 있으므로 패널을 여닫아도 그대로다. */}
        {panelCovering && <Pressable testID="패널 닫기 막" accessibilityRole="button" accessibilityLabel="패널 닫고 그리기로"
          onPress={() => { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); setDrawRail(false); }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />}
        {/* 굵기를 끄는 동안의 크기 원과 px. 조절은 캔버스 가장자리 띠에서 한다. */}
        {sizing !== null && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {/* 짙은 반투명 떠 있는 표시. 밝은 그림·흰 캔버스 어디서나 원과 숫자가 읽힌다. 손을 떼면 바로 사라진다. */}
          <View testID="굵기 미리보기" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 88, minHeight: 88, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, backgroundColor: '#171717C7' }}>
            <View style={{ width: Math.max(2, sizing * (canvasSide ?? KAKAO_STATIC_SPEC.width) / KAKAO_STATIC_SPEC.width), height: Math.max(2, sizing * (canvasSide ?? KAKAO_STATIC_SPEC.width) / KAKAO_STATIC_SPEC.width), borderRadius: 999, backgroundColor: tool === 'eraser' ? '#FFFFFF' : color, borderWidth: 1.5, borderColor: '#FFFFFFB3' }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: .3 }}>{sizing}px</Text>
          </View>
        </View>}
        {/* 확대한 동안에만: 작은 배율 표시. 누르면 100%. 캔버스 위 빈 띠에 뜨고, 띠가 없는 짧은 화면에서만 캔버스 모서리에 걸린다. */}
        {tab === 'draw' && zoom > 1.05 && <Pressable accessibilityRole="button" accessibilityLabel="원래 크기로 보기" onPress={resetZoom} hitSlop={8}
          style={({ pressed }) => ({ position: 'absolute', top: 8, right: 12, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pressed ? C.fill : C.floating, borderWidth: 1, borderColor: C.line })}>
          <MaterialCommunityIcons name="magnify" size={14} color={C.muted} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>{Math.round(zoom * 100)}%</Text>
        </Pressable>}
        {canvasMessage === 'zoomHint' && <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.floating, borderWidth: 1, borderColor: C.line }}>
            <MaterialCommunityIcons name="gesture-spread" size={14} color={C.muted} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.muted }}>두 손가락으로 벌리면 크게 볼 수 있어요</Text>
          </View>
        </View>}
        {/* 캔버스 위 알림 자리(45.2차): 한 번에 하나만. 급한 순서 — 저장 중(길어질 때만) > 숨긴 레이어 > 스포이드 > 표현 힌트 > 이전 칸 > 확대 안내.
            확대 배율(%)은 알림이 아니라 상태라서 이 자리를 쓰지 않고 오른쪽 위에 따로 선다. */}
        {canvasMessage === 'saving' && <View accessibilityLabel="저장 중이라 잠시 그릴 수 없어요" pointerEvents="none" style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.floating, borderWidth: 1, borderColor: C.line }}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={14} color={C.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.ink }}>저장 중이에요 · 잠시만요</Text>
        </View>}
        {canvasMessage === 'hidden' && <View style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 12, paddingRight: 2, borderRadius: 18, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentBorder }}>
          <MaterialCommunityIcons name="eye-off-outline" size={16} color={C.accentInk} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.accentInk }}>'{layerLabel(hiddenWarning)}'이 숨겨져 있어요</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="숨긴 레이어 다시 보이기" onPress={() => { changeTransform(scene.activeLayerId, { visible: true }); setHiddenWarning(''); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.accentInk }}>보이기</Text></Pressable>
        </View>}
        {canvasMessage === 'guide' && !!guideHint && <View style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingLeft: 12, paddingRight: 2, borderRadius: 18, backgroundColor: C.floating, borderWidth: 1, borderColor: C.line }}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={C.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.ink }}><Text style={{ fontWeight: '800' }}>{guideHint.name}</Text> · {guideHint.hint}</Text>
          <IconButton label="표현 힌트 닫기" icon="close" size={16} color={C.muted} onPress={() => { setGuideHintOpen(false); onGuideHintDone?.(); }} />
        </View>}
        {/* 빈 칸: 이전 칸 그림에서 이어 그릴 수 있게 한 번 제안한다. 누를 때만 복사하고, 비어 있는 칸이라 잃을 것이 없다. */}
        {canvasMessage === 'previous' && <View style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 18, backgroundColor: T.floating, borderWidth: 1, borderColor: C.line }}>
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
        {/* 표현 예시 참고 창(45.17차): 캔버스 위에 떠 있는 작은 창. 손잡이로 옮기고 접고 닫는다.
            화면 위의 안내라서 작품·썸네일·출력 어디에도 들어가지 않는다 — 그림이 되는 것은 밑그림(참고 레이어)뿐이다.
            창이 덮은 자리에서는 캔버스가 손가락을 받지 않아, 옮기는 손이 선을 긋지 않는다. */}
        {/* 표현 가이드 자리(다음 라운드). 꺼져 있으면 아무것도 그리지 않는다. */}
        {/* 표현 가이드("무엇을 그릴까?")는 홈의 '표현 가이드'에서 고른다(44차). 캔버스 위에는 띄우지 않는다. */}

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

        {canvasMessage === 'eyedrop' && <View style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, borderRadius: 18, backgroundColor: T.floating, borderWidth: 1, borderColor: C.line }}>
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
          {/* 캐릭터 기준은 세트 전체의 일이라 참고 사진 줄에서 내려왔다(45.2차). 보드의 세트 메뉴와 같은 계열이다. */}
          {!!canon && <MenuButton icon="account-star-outline" title={showCanon ? '캐릭터 기준 숨기기' : '캐릭터 기준 보기'} onPress={() => { setPanel(null); setShowCanon(!showCanon); }} />}
          <MenuButton icon="bookmark-outline" title={canon ? '이 칸을 캐릭터 기준으로 바꾸기' : '이 칸을 캐릭터 기준으로'} onPress={() => { setPanel(null); setShowCanon(false); save('reference'); }} />
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
          thumbs={thumbs} previousMotion={previousMotion ?? null} onFocusPart={layerId => send({ type: 'focusPart', layerId })} />
      </View> : <View style={dock} pointerEvents={busy || !initialized ? 'none' : 'auto'}>
        {scene.selection ? <View style={{ maxHeight: panelRoom(0.5) }}>
          {/* 명세 E08: 여기서 하는 일은 아직 임시다. 무엇이 임시인지 글로 말하고, 나가는 길은 취소·적용 둘뿐이다. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 10 }}>
            <MaterialCommunityIcons name="selection-drag" size={16} color={C.muted} />
            <Text numberOfLines={1} accessibilityLabel="고른 부분은 적용해야 그림에 남아요" style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.muted }}>고른 부분을 바꾸는 중 · 적용해야 그림에 남아요</Text>
          </View>
          {/* 판 높이가 정해져 있으므로 이 목록이 먼저 줄어야 아래 취소·적용이 밀려나지 않는다. */}
          <ScrollView style={{ flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 8 }}>
          {/* 옮기기는 캔버스에서 끌어서 한다. 여기에는 누르는 변형만 둔다. */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['작게', 'magnify-minus-outline', { scale: .9 }], ['크게', 'magnify-plus-outline', { scale: 1.1 }], ['왼쪽 회전', 'rotate-left', { rot: -15 }], ['오른쪽 회전', 'rotate-right', { rot: 15 }], ['좌우 반전', 'flip-horizontal', { flip: true }]] as const).map(([title, icon, change]) =>
              <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={() => send({ type: 'selectTransform', ...change })}
                style={({ pressed }) => ({ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 14, backgroundColor: pressed ? C.fillPressed : C.surface2 })}>
                <MaterialCommunityIcons name={icon} size={20} color={C.ink} />
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: C.muted }}>{title}</Text>
              </Pressable>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}>
            <Minor title="내 그림으로 보관" onPress={() => void keepCutout()} />
            <Minor title="새 레이어로 분리" onPress={() => send({ type: 'selectApply', toNewLayer: true })} />
          </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6, backgroundColor: C.paper }}>
            <Pressable accessibilityRole="button" accessibilityLabel="선택 취소" onPress={() => { tap('button:선택 취소'); send({ type: 'selectCancel' }); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>취소</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="선택 적용" onPress={() => { tap('button:선택 적용'); send({ type: 'selectApply' }); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>적용</Text></Pressable>
          </View>
        </View> : panel === 'color' ? <View style={{ maxHeight: panelRoom(0.38, 0.44) }}><ColorPanel scrollable={!dropping} color={color} recent={palette} saved={userPalette} view={colorView} onView={setColorView} onPick={pickColor} onEyedrop={startEyedrop} eyedropHandlers={eyedropHandlers} onSave={onSaveUserColor} onForget={onRemoveUserColor} onClose={() => { ease(); setPanel(null); }} /></View>
        : panel === 'caption' ? <View style={{ backgroundColor: C.paper, maxHeight: panelRoom(0.5) }}>
          {/* 미확정 변경은 '문구 적용'으로만 확정된다. 닫으면 고치던 글자는 버려지고 화면의 문구는 그대로 남는다.
              키보드가 올라오면 머리·지우기·아래 버튼을 접고 입력 한 줄(색 · 입력 · 키보드 닫기 · 적용)만 남긴다 —
              캔버스가 띠로 줄어 고치는 글씨가 잘리던 39차 P2. 입력칸은 같은 자리에 남아 포커스를 잃지 않는다. */}
          {!typing && <SheetHeader title="문구" closeLabel="문구 닫기" onClose={() => { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: typing ? 8 : 16, paddingTop: typing ? 8 : 0, paddingBottom: 8 }}>
            {/* 지금 색을 보여 주기만 한다(45.10차). 색을 고르는 입구는 아래 '팔레트' 하나 — 같은 일을 하는 자리를 둘 두지 않는다. */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF', ...{ shadowColor: '#000', shadowOpacity: .15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } } }} />
            <TextInput accessibilityLabel="문구 내용" value={captionDraft} onChangeText={setCaptionDraft} multiline={false} autoFocus returnKeyType="done" onSubmitEditing={() => applyCaption(captionDraft)} placeholder="예: 고마워" placeholderTextColor={C.faint} style={{ flex: 1, fontSize: 17, minHeight: C.tap, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.surface2, color: C.ink }} />
            {typing && <IconButton label="키보드 닫기" icon="keyboard-close" color={C.muted} size={20} onPress={() => Keyboard.dismiss()} />}
            {/* 명세 E07: 키보드 바로 위에 취소·적용을 함께 둔다. 키보드를 닫는 것만으로는 적용도 삭제도 되지 않는다. */}
            {typing && <Pressable accessibilityRole="button" accessibilityLabel="문구 취소" onPress={() => { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); }}
              style={({ pressed }) => ({ minHeight: C.tap, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper, alignItems: 'center', justifyContent: 'center' })}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>취소</Text>
            </Pressable>}
            {typing && <Pressable accessibilityRole="button" accessibilityLabel="문구 적용" onPress={() => applyCaption(captionDraft)}
              style={({ pressed }) => ({ minHeight: C.tap, paddingHorizontal: 16, borderRadius: 14, backgroundColor: pressed ? C.accentLine : C.accent, alignItems: 'center', justifyContent: 'center' })}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.accentInk }}>적용</Text>
            </Pressable>}
          </View>
          {/* 문구 색: 최근 쓴 색을 바로 누르고, 더 고르려면 팔레트로 간다. 고르는 즉시 캔버스의 글씨에 반영된다(45.5차). */}
          {!typing && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>색</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {[color, ...palette.filter(c => c.toUpperCase() !== color.toUpperCase())].slice(0, 5).map(c =>
                <Pressable key={c} accessibilityRole="button" accessibilityLabel={'문구 색 ' + c} accessibilityState={{ selected: c.toUpperCase() === color.toUpperCase() }}
                  onPress={() => setCaptionColor(c)} hitSlop={6}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: c.toUpperCase() === color.toUpperCase() ? 2.5 : 1, borderColor: c.toUpperCase() === color.toUpperCase() ? C.ink : '#17171718' }} />)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="문구 색 고르기" accessibilityValue={{ text: '지금 ' + color.toUpperCase() }}
              onPress={() => { ease(); setCaptionOpen(false); setPanel('color'); }}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: pressed ? C.fill : C.surface2 })}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>팔레트</Text>
            </Pressable>
          </View>}
          {/* 글씨체(45.6차): 이름이 아니라 '가' 한 글자로 성격을 보여 준다. 폰트 파일은 새로 넣지 않는다 — 기기에 있는 글꼴을 쓴다. */}
          {!typing && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>글씨</Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
              {CAPTION_STYLES.map(face => { const on = captionFace === face.key;
                return <Pressable key={face.key} accessibilityRole="button" accessibilityLabel={'문구 글씨 ' + face.title} accessibilityState={{ selected: on }}
                  onPress={() => changeCaptionFace(face.key)}
                  style={({ pressed }) => ({ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: on ? C.accentSoft : pressed ? C.fill : C.surface2 })}>
                  <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: face.key === 'thick' ? '900' : '700', fontFamily: face.key === 'serif' ? 'serif' : undefined, color: on ? C.ink : C.muted }}>가</Text>
                  <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{face.title}</Text>
                </Pressable>; })}
            </View>
          </View>}
          {!typing && !!(scene.caption?.text) && <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 }}>
            <Minor danger title="문구 지우기" onPress={() => { setCaptionDraft(''); applyCaption(''); }} />
          </View>}
          {!typing && <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6, backgroundColor: C.paper }}>
            <Action primary title="문구 적용" onPress={() => applyCaption(captionDraft)} />
          </View>}
        </View>

        : panel === 'brush' ? <Sheet tall plain room={coverRoom()} title="브러시" onClose={() => { ease(); setPanel(null); }}>
          {brushSheet}
        </Sheet>
        : panel === 'reference' && selectedReference ? <Sheet room={coverRoom()} title="참고 사진" onClose={() => { ease(); setPanel(null); }}>
          <View style={{ paddingHorizontal: 8, gap: 8 }}>
          <Minor title="위치 초기화" onPress={() => { changeTransform(selectedReference.id, { x: 0, y: 0, scale: 1, rotation: 0 }); setPanel(null); }} />
          <Minor title="참고 삭제" danger onPress={() => { const image = slot.referenceImages.find(i => i.path === selectedReference.path); if (image) removeReference(image.path, selectedReference.id); }} />
          </View>
        </Sheet> : <>
        {drawRail && <SheetHeader title="레이어" closeLabel="레이어 닫기" closeIcon="chevron-down" onClose={() => { ease(); setDrawRail(false); }} />}
        {drawRail && <View style={{ maxHeight: Math.min(188, coverRoom()) }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 6 }}>
            {scene.layers.map(layer => {
              const active = layer.id === scene.activeLayerId, name = layerLabel(layer.name);
              return <View key={layer.id} style={{ paddingBottom: layerMenu === layer.id ? 6 : 0, borderRadius: 14, borderWidth: 1, borderColor: active ? C.accentBorder : C.line, backgroundColor: active ? C.accentSoft : C.paper }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 선택`} accessibilityState={{ selected: active }}
                  onPress={() => { send({ type: 'select', id: layer.id }); setDrawRail(false); }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 6 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface2, overflow: 'hidden', opacity: layer.visible ? 1 : .35 }}>
                    {thumbs[layer.id] ? <Image source={{ uri: thumbs[layer.id] }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: active ? '700' : '500', color: layer.visible ? C.ink : C.faint }}>{name}</Text>
                  {active && <MaterialCommunityIcons name="pencil" size={16} color={C.ink} />}
                </Pressable>
                <EyeToggle label={`${name} ${layer.visible ? '숨기기' : '보이기'}`} on={layer.visible} onPress={() => changeTransform(layer.id, { visible: !layer.visible })} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 관리`} onPress={() => setLayerMenu(layerMenu === layer.id ? null : layer.id)} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={20} color={C.muted} /></Pressable>
              </View>
            {layerMenu === layer.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6 }}>
              {/* 겹치는 차례(45.7차): 위로/아래로 대신 '앞으로 보내기·뒤로 보내기' — 목록의 방향을 몰라도 결과가 그려진다. */}
              {scene.layers.length > 1 && layerAt(layer.id) < scene.layers.length - 1 && <Minor title="앞으로 보내기" onPress={() => { setLayerMenu(null); send({ type: 'moveLayer', id: layer.id, by: 1 }); }} />}
              {scene.layers.length > 1 && layerAt(layer.id) > 0 && <Minor title="뒤로 보내기" onPress={() => { setLayerMenu(null); send({ type: 'moveLayer', id: layer.id, by: -1 }); }} />}
              <Minor title="이름 바꾸기" onPress={() => { setLayerMenu(null); setRenaming({ id: layer.id, name: layer.name }); }} />
              {scene.layers.length < 4 && <Minor title="복제" onPress={() => { setLayerMenu(null); send({ type: 'duplicateLayer', id: layer.id }); }} />}
              {scene.layers.length > 1 && <Minor danger title="지우기" onPress={() => { setLayerMenu(null); Alert.alert(name + ' 지우기', '이 레이어와 레이어에 준 부분 움직임이 함께 지워져요. 되돌리기로 되살릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '지우기', style: 'destructive', onPress: () => send({ type: 'removeLayer', id: layer.id }) }]); }} />}
            </View>}
            </View>;
            })}
            {scene.layers.length < 4 && <Pressable accessibilityRole="button" accessibilityLabel="레이어 추가" onPress={addDrawing} style={{ minHeight: C.tap, flexDirection: 'row', gap: 6, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="plus" size={16} color={C.muted} /><Text style={{ fontSize: 13, fontWeight: '600', color: C.muted }}>레이어 추가</Text></Pressable>}
          </ScrollView>
        </View>}
        {refRail && <SheetHeader title="참고" closeLabel="참고 닫기" closeIcon="chevron-down" onClose={() => { ease(); setRefRail(false); }} />}
        {refRail && BUILTIN_READY && <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <Segmented dense value={refSource} onChange={next => { setRefSource(next); setRefBrowse(true); }} items={[{ key: 'mine', label: '내 사진', icon: 'image-outline' }, { key: 'builtin', label: '기본 레퍼런스', icon: 'human-handsup' }]} />
        </View>}
        {refRail && refSource === 'builtin' && BUILTIN_READY && (refBrowse
          ? <BuiltinReferences maxHeight={Math.max(120, Math.min(260, coverRoom() - 110))} category={refCategory} onCategory={setRefCategory} onPick={pickBuiltinReference} />
          : <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 6 }}>
              <PoseStrip category={refCategory} index={poseIndex} count={BUILTIN_REFERENCES.placeholderCount} onIndex={movePose} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.muted }}>캔버스에서 위치·크기·진하기를 맞춰요</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="기본 레퍼런스 다시 찾기" onPress={() => { ease(); setRefBrowse(true); }}
                  style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: pressed ? C.fill : C.surface2 })}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>다시 찾기</Text>
                </Pressable>
              </View>
            </View>)}
        {refRail && (refSource === 'mine' || !BUILTIN_READY) && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <RailTile label="참고 사진 추가" caption="사진 추가" icon="plus" dashed onPress={() => void addReferences()} />
            {/* 참고 창을 닫았어도 고른 표현은 이 칸에 남아 있다 — 다시 열 자리가 없어 길이 끊기지 않게. */}
            {!!guideExample && <RailTile label={refWindow === 'closed' ? '표현 예시 참고 자리 열기' : '표현 예시 참고 자리 닫기'} caption="표현 예시" icon="lightbulb-on-outline"
              selected={refWindow !== 'closed'} onPress={() => { ease(); setRefWindow(refWindow === 'closed' ? 'open' : 'closed'); }} />}
            {scene.references.map((ref, index) => {
              const image = slot.referenceImages.find(i => i.path === ref.path), active = ref.id === scene.activeReferenceId;
              return <RailTile key={ref.id} label={`참고 ${index + 1} 선택`} caption={`참고 ${index + 1}`} image={image ? imageUri(image.path) : undefined} icon="image-outline" selected={active} faded={!ref.visible}
                // 타일을 누르는 것은 "이 참고로 작업하겠다"는 뜻이다: 고르면 캔버스에 바로 보인다(45.1차).
                // 다시 누르면 선택만 풀고(보임 상태는 그대로), 숨기기는 눈 아이콘이 맡는다 — 앱이 이유 없이 다시 켜지 않는다.
                onPress={() => { send(active ? { type: 'setActiveReference', id: null } : { type: 'toggleReference', id: ref.id }); setPanel(null); }} />;
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
        {/* 윗줄(45.5차): 손이 가장 자주 가는 둘 — 지금 브러시와 지금 색 — 이 넓게 서고,
            지우개·채우기·선택은 옆의 작은 '빠른 모드' 셋으로 붙는다. 여섯 칸을 똑같이 나눈 도구 메뉴가 아니다.
            이미 고른 것을 다시 누르면 그 설정이 열린다(브러시 = 선 종류·굵기, 색 = 팔레트). */}
        {/* ── 승인 보드 01 배치(45.28차) ──────────────────────────────────────────────
            ① 브러시 빠른 선택 카드 3 + '전체'  ② 지금 색 + 굵기 한 줄  ③ 펜·지우개·채우기·선택 네 칸.
            되돌리기·다시 실행·완성은 머리줄로 올라갔다 — 여기서는 '무엇으로 그릴까'만 다룬다. */}
        <View testID="빠른 브러시" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 6 }}>
          {quickBrushes.map(key => { const b = brushInfo(key), on = isBrushOn(key);
            return <Pressable key={key} testID={'빠른 브러시 ' + b.title} accessibilityRole="button" accessibilityLabel={b.title}
              accessibilityState={{ selected: on }} accessibilityHint={on ? '다시 누르면 세부 설정이 열려요' : undefined}
              onPress={() => pickBrush(key)}
              style={({ pressed }) => ({ flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: C.radius.button,
                borderWidth: 1, borderColor: on ? C.accentBorder : C.line, backgroundColor: on ? C.accentSoft : pressed ? C.fill : C.paper })}>
              <Image accessibilityIgnoresInvertColors source={b.stroke} style={{ width: '78%', height: 18, tintColor: color }} resizeMode="contain" />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{b.title}</Text>
            </Pressable>; })}
          <Pressable accessibilityRole="button" accessibilityLabel="브러시 전체" accessibilityState={{ expanded: panel === 'brush' }}
            onPress={() => { ease(); setPanel(panel === 'brush' ? null : 'brush'); setDrawRail(false); setRefRail(false); setCaptionOpen(false); }}
            style={({ pressed }) => ({ width: 54, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: C.radius.button,
              borderWidth: 1, borderColor: panel === 'brush' ? C.lineStrong : C.line, backgroundColor: pressed ? C.fill : C.paper })}>
            <MaterialCommunityIcons name="dots-grid" size={18} color={C.muted} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted }}>전체</Text>
          </Pressable>
        </View>
        {/* ② 지금 색과 굵기. 승인 보드처럼 한 줄이다 — 세로 조절대는 없앴다. */}
        <View testID="색과 굵기" style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 6 : 10, paddingHorizontal: 12, paddingTop: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="색" accessibilityState={{ expanded: panel === 'color' }}
            onPress={() => { ease(); setPanel(panel === 'color' ? null : 'color'); setDrawRail(false); setRefRail(false); setCaptionOpen(false); }}
            // 보이는 크기는 32 지만 누르는 자리는 48×48 이다(양쪽 8 씩). 줄의 좌우 여백이 그만큼 있어 이웃과 겹치지 않는다.
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, padding: 3, backgroundColor: C.paper,
              borderWidth: panel === 'color' ? 2 : 1, borderColor: panel === 'color' ? C.ink : C.lineStrong, opacity: pressed ? .7 : 1 })}>
            <View style={{ flex: 1, borderRadius: 13, backgroundColor: color }} />
          </Pressable>
          {/* 굵기는 그리거나 지울 때만 쓴다 — 채우기·선택, 글씨·선택 손질, 스포이드 중에는 칸만 남기고 비운다
              (줄 높이가 흔들리지 않게). 지금 쓰지 않는 조절을 늘어놓지 않는다. */}
          {(tool === 'pen' || tool === 'eraser') && !scene.captionPicked && !scene.selection && !scene.picking ? <>
            {!narrow && <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>굵기</Text>}
            <View style={{ flex: 1 }}>
              <Range hideLabel label={tool === 'eraser' ? '지우개 굵기' : '브러시 굵기'} value={width} min={1} max={48} step={1}
                onChange={n => { setWidth(n, false); setSizing(Math.max(1, Math.min(48, Math.round(n)))); }}
                onActive={active => { if (active === false) { setWidth(width, true); setSizing(null); } }} />
            </View>
            <Text testID="굵기 수치" style={{ fontSize: 14, fontWeight: '800', color: C.ink, minWidth: 24, textAlign: 'right' }}>{width}</Text>
          </> : <View style={{ flex: 1, minHeight: 32 }} />}
        </View>
        {/* ③ 도구 네 칸. 활성 도구는 노랑, 열린 설정 판은 테두리로 따로 말한다. */}
        <View testID="도구 줄" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4 }}>
          {ALL_TOOLS.map(([key, title, icon, a11y]) => { const on = tool === key;
            return <Pressable key={key} testID={'도구 ' + title} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }}
              onPress={() => selectTool(key)}
              style={({ pressed }) => ({ flex: 1, minHeight: C.tap, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: C.radius.button,
                backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
              <MaterialCommunityIcons name={icon} size={on ? 21 : 20} color={on ? C.ink : C.muted} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
            </Pressable>; })}
        </View>
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
function Switch({ on }: { on: boolean }) {
  return <View style={{ width: 36, height: 22, borderRadius: 11, padding: 2, backgroundColor: on ? T.accent : T.lineStrong, justifyContent: 'center' }}>
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: on ? 'flex-end' : 'flex-start' }} />
  </View>;
}
// 기본 레퍼런스(44차 LOCK) — "어떻게 그릴까?". 분류 칩 한 줄 + 3:4 썸네일 4열 격자(좌우 12 · 간격 8).
// 격자는 패널 안에서 세로로 구르고 윗줄 하나 반이 보여 더 있다는 걸 알린다. 자리 규격: asset-slots referencePoseThumbnail.
// ready=false 동안 칸은 누를 수 없는 자리표시(관절 인형 실루엣). 분류에 그림이 하나도 없으면 한 줄 빈 상태.
function BuiltinReferences({ maxHeight, category, onCategory, onPick }: { maxHeight: number; category: string; onCategory: (name: string) => void; onPick: (index: number) => void }) {
  const { width } = useWindowDimensions();
  const setCategory = onCategory;
  // 칸 폭은 격자가 실제로 받은 폭으로 잰다 — 패널 테두리 1px 때문에 창 폭으로 재면 넷째 칸이 다음 줄로 밀렸다(44차 실기기).
  const [gridWidth, setGridWidth] = useState(width - 2);
  const cols = BUILTIN_REFERENCES.columns, gap = 8, cell = Math.floor((gridWidth - 24 - gap * (cols - 1)) / cols), tall = Math.round(cell * 4 / 3);
  const items = Array.from({ length: BUILTIN_REFERENCES.placeholderCount }, (_, i) => i);
  // 그림이 들어오면 같은 칸에 그 그림이 들어가고, 없으면 지금 쓰는 회색 관절 인형 자리표시가 그대로 남는다(45.3차).
  const pose = ASSET_SLOTS.referencePoseThumbnail.source;
  return <View style={{ paddingTop: 8, gap: 8 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
      {BUILTIN_REFERENCES.categories.map(name => { const on = category === name;
        return <Pressable key={name} accessibilityRole="button" accessibilityLabel={'기본 레퍼런스 ' + name} accessibilityState={{ selected: on }} onPress={() => setCategory(name)}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? T.ink : T.surface2 }}>
          <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? T.paper : T.muted }}>{name}</Text>
        </Pressable>; })}
    </ScrollView>
    {items.length
      ? <ScrollView testID="기본 레퍼런스 격자" nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight }} onLayout={e => { const w = Math.floor(e.nativeEvent.layout.width); if (w > 0 && w !== gridWidth) setGridWidth(w); }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: 12, paddingBottom: 4 }}>
          {items.map(i =>
            <Pressable key={category + i} testID="기본 레퍼런스 자리" accessibilityRole="button" accessibilityLabel={`${category} 기본 레퍼런스 ${i + 1}${BUILTIN_REFERENCES.ready ? '' : ' 준비 중'}`} onPress={() => onPick(i)}
              style={({ pressed }) => ({ width: cell, height: tall, borderRadius: 12, backgroundColor: pressed ? T.fill : T.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' })}>
              {pose
                ? <Image accessibilityIgnoresInvertColors source={pose} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                : <>
                  <View style={{ width: cell * .24, height: cell * .24, borderRadius: cell, backgroundColor: T.lineStrong, marginBottom: 3 }} />
                  <View style={{ width: cell * .32, height: cell * .38, borderRadius: cell * .12, backgroundColor: T.lineStrong, transform: [{ rotate: `${(i % 3 - 1) * 8}deg` }] }} />
                  <View style={{ flexDirection: 'row', gap: cell * .06, marginTop: 2 }}>
                    <View style={{ width: cell * .08, height: cell * .16, borderRadius: cell, backgroundColor: T.lineStrong }} />
                    <View style={{ width: cell * .08, height: cell * .16, borderRadius: cell, backgroundColor: T.lineStrong }} />
                  </View>
                </>}
            </Pressable>)}
        </ScrollView>
      : <Text style={{ paddingHorizontal: 12, paddingVertical: 16, fontSize: 12, color: T.muted }}>이 분류에는 아직 그림이 없어요</Text>}
    <Text style={{ paddingHorizontal: 12, paddingBottom: 8, fontSize: 11, color: T.faint }}>{BUILTIN_REFERENCES.ready ? '누르면 캔버스에 참고로 깔려요' : '관절 인형 그림은 준비 중이에요'}</Text>
  </View>;
}
function PoseStrip({ category, index, count, onIndex }: { category: string; index: number; count: number; onIndex: (next: number) => void }) {
  const [dx, setDx] = useState(0);
  const from = useRef(0);
  const pose = ASSET_SLOTS.referencePoseThumbnail.source;
  const cell = 52, gap = 8;
  // 끝에서는 더 밀리지 않는다 — 손에는 벽이 만져지고, 자세는 돌지 않는다.
  const wall = (d: number) => ((d < 0 && index >= count - 1) || (d > 0 && index <= 0)) ? d * .25 : d;
  const cells = [-1, 0, 1].map(offset => {
    const at = index + offset;
    return <View key={offset} style={{ width: cell, height: Math.round(cell * 4 / 3), borderRadius: 10, overflow: 'hidden', backgroundColor: T.surface2,
      opacity: at < 0 || at > count - 1 ? 0 : offset === 0 ? 1 : .5, borderWidth: offset === 0 ? 2 : 0, borderColor: T.accent, alignItems: 'center', justifyContent: 'center' }}>
      {pose ? <Image accessibilityIgnoresInvertColors source={pose} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <MaterialCommunityIcons name="human-handsup" size={20} color={T.lineStrong} />}
    </View>;
  });
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View testID="자세 넘기기" accessibilityRole="adjustable" accessibilityLabel={category + ' 자세 넘기기'} accessibilityHint="좌우로 넘기면 다음·이전 자세를 봐요"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onIndex(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={(e: GestureResponderEvent) => { from.current = e.nativeEvent.pageX; setDx(0); }}
      onResponderMove={(e: GestureResponderEvent) => setDx(wall(e.nativeEvent.pageX - from.current))}
      onResponderRelease={(e: GestureResponderEvent) => { const moved = e.nativeEvent.pageX - from.current; setDx(0); if (moved <= -40) onIndex(index + 1); else if (moved >= 40) onIndex(index - 1); }}
      onResponderTerminate={() => setDx(0)}
      style={{ flex: 1, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ flexDirection: 'row', gap, transform: [{ translateX: dx }] }}>{cells}</View>
    </View>
    <Text style={{ fontSize: 12, fontWeight: '700', color: T.muted }}>{index + 1} / {count}</Text>
  </View>;
}
// 굵기 수식(43.1차 그대로): 작은 값은 촘촘하게, 큰 값은 성기게 — 한 번 끌어 1~48 전체를 오간다(SIZE_TRAVEL dp).
// 조절하는 자리는 45.4차에 바뀌었다: 도구 줄의 칸을 없애고 캔버스 오른쪽 가장자리의 좁은 띠에서 세로로 끈다(아래 EdgeSize).
// 끄는 동안에는 캔버스 가운데에 실제 크기 원과 px 이 뜬다.
export const widthToRatio = (w: number) => Math.sqrt(Math.max(0, (w - 1) / 47));
export const ratioToWidth = (r: number) => Math.max(1, Math.min(48, Math.round(1 + 47 * r * r)));
export const SIZE_TRAVEL = 180;
// 캔버스 가장자리 굵기 띠(45.4차). 평소에는 지금 굵기를 점 하나로만 말하고, 누른 채 세로로 끌면 굵기가 바뀐다.
// 여기서 시작한 손가락만 굵기 조절이 된다 — 캔버스 다른 곳에서 시작한 획에는 영향이 없다.
function EdgeSize({ label, value, color, eraser, onChange, onActive }: { label: string; value: number; color: string; eraser: boolean; onChange: (value: number, settle: boolean) => void; onActive: (value: number | null) => void }) {
  const start = useRef<{ y: number; r: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const ratio = widthToRatio(value), dot = Math.round(4 + 12 * ratio);
  const moveTo = (pageY: number | undefined, settle: boolean) => {
    const from = start.current; if (!from) return;
    // 위로 끌면 굵게(화면 y 는 아래로 커진다).
    const next = ratioToWidth(Math.max(0, Math.min(1, from.r + (from.y - (pageY ?? from.y)) / SIZE_TRAVEL)));
    onChange(next, settle); onActive(settle ? null : next);
  };
  return <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityHint="누른 채 위아래로 끌어서 굵기를 바꿔요"
    accessibilityValue={{ min: 1, max: 48, now: value, text: value + 'px' }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={e => onChange(Math.max(1, Math.min(48, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))), true)}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => { start.current = { y: e.nativeEvent.pageY ?? 0, r: ratio }; setHolding(true); onActive(value); }}
    onResponderMove={e => moveTo(e.nativeEvent.pageY, false)}
    onResponderRelease={e => { moveTo(e.nativeEvent.pageY, true); start.current = null; setHolding(false); onActive(null); }}
    onResponderTerminate={() => { start.current = null; setHolding(false); onActive(null); onChange(value, true); }}
    testID="굵기 띠"
    style={{ width: 26, height: '44%', minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
    <View pointerEvents="none" style={{ width: 20, flex: 1, borderRadius: 10, backgroundColor: holding ? '#17171722' : '#17171710', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <MaterialCommunityIcons name="chevron-up" size={12} color={T.muted} />
      <View style={{ width: dot, height: dot, borderRadius: 8, backgroundColor: eraser ? T.paper : color, borderWidth: 1, borderColor: T.lineStrong }} />
      <MaterialCommunityIcons name="chevron-down" size={12} color={T.muted} />
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
// 표현 예시를 보며 그리는 자리(45.25차). 캔버스 **밖**에 선다 — 예전에는 캔버스 위에 떠 있어
// 그리는 자리를 덮었고, 옮기고 크기를 맞추는 일까지 사람이 해야 했다.
// 이 줄이 자리를 차지하면 아래 캔버스 영역이 그만큼 줄고 정사각 캔버스가 다시 맞춰진다.
// 그림 자체(360×360)와 저장 좌표는 그대로다. 저장되는 그림·움직이는 파일·썸네일에는 들어가지 않는다.
function GuideStrip({ title, hint, artwork, collapsed, onCollapse, onClose, onUnderlay }: {
  title: string; hint: string; artwork: ImageSourcePropType; collapsed: boolean;
  onCollapse: () => void; onClose: () => void; onUnderlay?: () => void;
}) {
  return <View testID="표현 예시 참고 자리" style={{ borderBottomWidth: 1, borderColor: T.line, backgroundColor: T.paper }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 12, paddingRight: 2, gap: 2 }}>
      <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color={T.muted} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '800', color: T.ink, marginLeft: 4 }}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={collapsed ? '표현 예시 펼치기' : '표현 예시 접기'} onPress={onCollapse}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} hitSlop={2}>
        <MaterialCommunityIcons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={T.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="표현 예시 닫기" onPress={onClose}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} hitSlop={2}>
        <MaterialCommunityIcons name="close" size={17} color={T.muted} />
      </Pressable>
    </View>
    {/* 펼친 모습: 그림은 왼쪽에 작게, 할 말과 행동은 오른쪽에. 가로로 눕혀 세로 자리를 아낀다. */}
    {!collapsed && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10 }}>
      <View style={{ width: 96, height: 96, borderRadius: T.radius.sm, backgroundColor: T.surface2, overflow: 'hidden' }}>
        <Image accessibilityIgnoresInvertColors accessibilityLabel={title + ' 예시 그림'} source={artwork} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text numberOfLines={3} style={{ fontSize: 13, lineHeight: 19, color: T.muted }}>{hint}</Text>
        {!!onUnderlay && <Pressable accessibilityRole="button" accessibilityLabel="이 예시를 밑그림으로 넣기" onPress={onUnderlay}
          style={({ pressed }) => ({ minHeight: T.tap, borderRadius: T.radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : T.surface2 })}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: T.ink }}>밑그림으로 넣기</Text>
        </Pressable>}
      </View>
    </View>}
  </View>;
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
// plain: 안에서 스스로 구르는 판(브러시 목록처럼). 시트가 또 한 겹 스크롤을 씌우면 안쪽의 '줄어드는
// 목록 + 고정 줄' 규칙이 죽어, 아래 고정 줄(세부 설정)이 화면 밖으로 밀려난다(45.28차에 실제로 그랬다).
function Sheet({ title, onClose, children, tall, room = Infinity, plain }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean; room?: number; plain?: boolean }) {
  const { height } = useWindowDimensions();
  return <View style={{ backgroundColor: T.paper, maxHeight: Math.min(room, tall ? Math.min(440, Math.max(300, Math.round(height * .5))) : Math.min(300, Math.max(190, height - 440))) }}>
    <SheetHeader title={title} onClose={onClose} />
    {plain ? children : <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>}
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
  onPick: (c: string, settle?: boolean) => void; onEyedrop: () => void; eyedropHandlers: Record<string, unknown>; onSave: (c: string) => void; onForget: (c: string) => void;
  onClose: () => void;
  // 스포이드를 끌고 있는 동안에는 견본 목록이 따라 스크롤되면 안 된다.
  scrollable: boolean;
};
function ColorPanel({ color, recent, saved, view, onView, onPick, onEyedrop, eyedropHandlers, onSave, onForget, onClose, scrollable }: ColorPanelProps) {
  // 견본 한 번 = 고르고 닫기. 상세 조절 = 고르고 머무르기.
  const quick = (c: string) => { onPick(c); onClose(); };
  const [hex, setHex] = useState(color);
  const [tidy, setTidy] = useState(false);
  // 바깥(스포이드·HEX·최근 색)에서 색이 바뀌면 입력칸과 밝기 막대가 따라온다.
  useEffect(() => { setHex(color); }, [color]);
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const rgba = parseHex(color);
  const percent = Math.round(rgba.a / 2.55);
  const kept = saved.some(c => same(c, color));
  // SV 사각·색상 막대에서 고른 색은 불투명하다. 정해 둔 투명도가 있으면 계열만 바꾸고 투명도는 지킨다.
  const keepAlpha = (c: string) => withAlpha(c, rgba.a);
  const typed = (value: string) => { setHex(value); const next = typedHex(value, true); if (next) onPick(next); };
  const channel = (key: 'r' | 'g' | 'b' | 'a', n: number) => onPick(toHex({ ...rgba, [key]: n }), false);
  const action = { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' } as const;

  return <View style={{ flexShrink: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 }}>
    {/* 머리 한 줄: 지금 색 · 최근 쓴 색 · 스포이드 · 내 팔레트 저장 · 닫기. 두 갈래 어디에서나 같은 자리.
        최근 쓴 색이 가장 먼저다 — 한 번 누르면 그 색으로 돌아가 바로 그린다. 예전에는 따로 한 줄을 차지해 패널이 캔버스를
        더 가리고 팔레트 마지막 줄이 도구 줄 경계에서 잘렸다(43차 실기기). 직접 선택에서는 이 자리에 색 값이 보인다. */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
      {view === 'palette' && <Text style={{ fontSize: 12, fontWeight: '700', color: T.muted }}>최근</Text>}
      {view === 'palette' && !recent.length && <Text style={{ flex: 1, fontSize: 12, color: T.faint }}>아직 쓴 색이 없어요</Text>}
      {view === 'palette' && recent.length
        ? <ScrollView testID="최근 색" horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', gap: 12, paddingHorizontal: 6, paddingVertical: 6 }}>
            {recent.slice(0, 7).map(c => <Swatch round key={'r' + c} label={'최근 색 ' + c} color={c} size={36} selected={same(c, color)} onPress={() => quick(c)} />)}
          </ScrollView>
        : view === 'custom'
          ? <TextInput accessibilityLabel="HEX 색 값" value={hex} onChangeText={typed} autoCapitalize="characters" autoCorrect={false} maxLength={9}
              placeholder="#RRGGBB" placeholderTextColor="#8E8E93"
              // 값은 정보다. 색상환보다 눈에 세게 들어오지 않도록 바탕 없이 조용히 둔다(45.5차).
              style={{ flex: 1, height: 40, paddingHorizontal: 2, backgroundColor: 'transparent', fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: .4 }} />
          : <Text accessibilityLabel="지금 색 값" style={{ flex: 1, fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: .4 }}>{color.toUpperCase()}</Text>}
      {/* 누르면 예전처럼 캔버스를 눌러 집고, 누른 채 캔버스로 끌면 끌리는 자리 색을 바로 집는다(45.4차). */}
      <View {...eyedropHandlers} accessibilityRole="button" accessibilityLabel="스포이드" accessibilityHint="누른 채 그림 위로 끌면 그 자리 색을 집어요"
        style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <MaterialCommunityIcons name="eyedropper-variant" size={19} color={T.ink} />
        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: T.muted }}>색 추출</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={kept ? '내 팔레트에 있음' : '내 팔레트에 저장'} disabled={kept} onPress={() => onSave(color)}
        style={({ pressed }) => ({ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 12, backgroundColor: pressed ? T.fill : 'transparent' })}>
        <MaterialCommunityIcons name={kept ? 'check' : 'palette-swatch-outline'} size={19} color={kept ? T.success : T.ink} />
        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: kept ? T.success : T.muted }}>{kept ? '저장됨' : '색 저장'}</Text>
      </Pressable>
      <IconButton label="팔레트 닫기" icon="chevron-down" color={T.muted} onPress={onClose} />
    </View>
    <Segmented dense value={view} onChange={onView} items={[{ key: 'custom', label: '직접 선택' }, { key: 'palette', label: '팔레트' }]} />
    {/* 여기서부터가 스크롤 자리다. 견본이 많아도 머리줄과 탭은 밀려나지 않고,
        마지막 줄은 아래 여백(16) 덕분에 도구 줄 경계에 딱 붙지 않는다(43차 실기기에서 잘리던 자리). */}
    <ScrollView testID="색 견본 스크롤" style={{ flexShrink: 1, minHeight: 0 }} scrollEnabled={scrollable} keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator contentContainerStyle={{ gap: 12, paddingTop: 4, paddingBottom: 16 }}>
    {view === 'palette' ? <>
      {!!saved.length && <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: T.muted }}>내 팔레트 {saved.length}</Text>
          {!!saved.length && <Pressable accessibilityRole="button" accessibilityLabel={tidy ? '내 팔레트 정리 끝' : '내 팔레트 정리'} onPress={() => setTidy(!tidy)} style={{ minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted }}>{tidy ? '끝' : '정리'}</Text>
          </Pressable>}
        </View>
        {saved.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 6, margin: -6 }}>
          {saved.map(c => tidy
            ? <Pressable key={'u' + c} accessibilityRole="button" accessibilityLabel={'내 팔레트 ' + c + ' 지우기'} onPress={() => onForget(c)} hitSlop={6}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00000033' }}>
                <MaterialCommunityIcons name="close" size={16} color={light(c) ? '#1B1B1D' : '#FFFFFF'} />
              </Pressable>
            : <Swatch key={'u' + c} label={'내 팔레트 ' + c} color={c} size={36} selected={same(c, color)} onPress={() => quick(c)} />)}
        </View> : null}
      </View>}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: T.muted }}>기본 색</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 6, margin: -6 }}>
          {swatches.map(c => <Swatch key={c} color={c} size={36} selected={same(c, color)} onPress={() => quick(c)} />)}
        </View>
      </View>
    </> : <>
      {/* 직접 선택(45.28차, 승인 보드 01): 프리셋 한 줄 · SV 사각 + 색상 막대. 밝기는 사각의 세로축이라
          따로 막대를 두지 않는다 — 같은 값을 두 곳에서 조절하지 않게. 투명도는 그대로 남는다. */}
      <ColorField color={color} onPick={(c, settle) => onPick(keepAlpha(c), settle)} />
      <HueBar color={color} onPick={(c, settle) => onPick(keepAlpha(c), settle)} />
      {!!recent.length && <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: T.muted }}>최근</Text>
        <ScrollView testID="최근 색" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 12, paddingHorizontal: 6, paddingVertical: 4 }}>
          {recent.slice(0, 7).map(c => <Swatch round key={'c' + c} label={'최근 색 ' + c} color={c} size={36} selected={same(c, color)} onPress={() => quick(c)} />)}
        </ScrollView>
      </View>}
      <Range label="투명도" value={percent} min={5} max={100} step={1} onChange={n => channel('a', Math.round(n) * 2.55)} display={percent + '%'} />
    </>}
    </ScrollView>
  </View>;
}
// 작은 정사각 견본. 동그라미를 길게 늘어놓는 대신 규칙적인 격자로 세운다 — 눈이 줄과 칸을 따라가고,
// 같은 자리에 같은 색이 있어 손이 기억한다. 고른 것은 테두리와 체크 둘 다로 말한다: 테두리만으로는
// 어두운 색 위에서 잘 보이지 않는다.
function Swatch({ color, selected, onPress, size = 34, label, round }: { color: string; selected: boolean; onPress: () => void; size?: number; label?: string; round?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? '색 ' + color} accessibilityState={{ selected }} onPress={onPress} hitSlop={6}
    // 흰색·아주 밝은 색은 옅은 테두리로는 바탕과 구분되지 않아 빈칸처럼 보인다. 밝은 색에만 또렷한 선을 준다.
    style={{ width: size, height: size, borderRadius: round ? size / 2 : 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      borderWidth: selected ? 2.5 : 1, borderColor: selected ? T.ink : light(color) ? T.lineStrong : '#17171718' }}>
    {selected && <MaterialCommunityIcons name="check" size={Math.round(size * .5)} color={light(color) ? '#1B1B1D' : '#FFFFFF'} />}
  </Pressable>;
}
// 색상환(45.4차). 스마트폰에서 색을 고르는 가장 익숙한 모양이고, 긴 막대 세 줄보다 자리를 적게 쓴다.
// 조각을 돌려 원을 만든다(각 조각은 아래쪽 끝 = 원 가운데를 축으로 돈다). 가운데로 갈수록 흰 막이 덮여 옅어진다.
// SV 사각(가로 = 선명함 · 세로 = 밝기)과 색상 막대. 승인 보드 01 의 색 시트 배치 그대로다.
// 그라디언트 그림 없이 세우려고 색 띠를 여러 칸으로 나눠 붙인다 — 칸 수는 눈에만 관계하고 손가락과는 무관하다.
const SAT_STEPS = 20, VAL_STEPS = 16, HUE_STEPS = 30, FIELD_H = 116;
function ColorField({ color, onPick }: { color: string; onPick: (c: string, settle?: boolean) => void }) {
  const [size, setSize] = useState({ w: 0, h: FIELD_H });
  const { h, s, v } = hsvOf(color);
  const at = (x: number, y: number, settle: boolean) => {
    if (size.w <= 0) return;
    const sat = Math.max(0, Math.min(1, x / size.w)), val = Math.max(.04, Math.min(1, 1 - y / size.h));
    onPick(hsv(h, sat, val), settle);
  };
  const knob = { x: s * size.w, y: (1 - v) * size.h };
  return <View accessibilityRole="adjustable" accessibilityLabel="색 사각판" accessibilityHint="누르거나 끌어서 선명함과 밝기를 골라요"
    accessibilityValue={{ text: color }}
    onLayout={e => { const w = Math.floor(e.nativeEvent.layout.width), hh = Math.floor(e.nativeEvent.layout.height); if (w > 0 && (w !== size.w || hh !== size.h)) setSize({ w, h: hh }); }}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => at(e.nativeEvent.locationX, e.nativeEvent.locationY, false)}
    onResponderMove={e => at(e.nativeEvent.locationX, e.nativeEvent.locationY, false)}
    onResponderRelease={e => at(e.nativeEvent.locationX, e.nativeEvent.locationY, true)}
    style={{ height: FIELD_H, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: T.paper }}>
    <View pointerEvents="none" style={{ flex: 1, flexDirection: 'row' }}>
      {Array.from({ length: SAT_STEPS }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: hsv(h, (i + .5) / SAT_STEPS, 1) }} />)}
    </View>
    {/* 아래로 갈수록 검어지는 막(밝기). */}
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {Array.from({ length: VAL_STEPS }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: '#000000', opacity: (i / (VAL_STEPS - 1)) * .92 }} />)}
    </View>
    {size.w > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: knob.x - 11, top: knob.y - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: color, ...Elev[2] }} />}
  </View>;
}
function HueBar({ color, onPick }: { color: string; onPick: (c: string, settle?: boolean) => void }) {
  const [width, setWidth] = useState(0);
  const { h, s, v } = hsvOf(color);
  const at = (x: number, settle: boolean) => { if (width <= 0) return; onPick(hsv(Math.max(0, Math.min(1, x / width)) * 360, s || 1, v || 1), settle); };
  return <View accessibilityRole="adjustable" accessibilityLabel="색 계열 막대" accessibilityHint="누르거나 끌어서 색 계열을 골라요"
    accessibilityValue={{ text: Math.round(h) + '도' }}
    onLayout={e => { const w = Math.floor(e.nativeEvent.layout.width); if (w > 0 && w !== width) setWidth(w); }}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => at(e.nativeEvent.locationX, false)}
    onResponderMove={e => at(e.nativeEvent.locationX, false)}
    onResponderRelease={e => at(e.nativeEvent.locationX, true)}
    style={{ height: T.tap, justifyContent: 'center' }}>
    <View pointerEvents="none" style={{ height: 20, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: T.line }}>
      {Array.from({ length: HUE_STEPS }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: hsv((i + .5) * (360 / HUE_STEPS), 1, 1) }} />)}
    </View>
    {width > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: (h / 360) * width - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: hsv(h, 1, 1), ...Elev[2] }} />}
  </View>;
}
// Secondary to the slider, but it guarantees size stays adjustable on any device.
function Step({ label, sign, onPress }: { label: string; sign: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={{ width: 40, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: T.muted }}>{sign}</Text></Pressable>;
}
// 보조 행동(secondary). 흰 표면 + 옅은 선 하나. 위험한 일만 옅은 빨강.
function Minor({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} hitSlop={{ top: 2, bottom: 2 }} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: danger ? 0 : 1, borderColor: T.line, backgroundColor: danger ? T.dangerSoft : pressed ? T.fill : T.paper, alignItems: 'center', justifyContent: 'center' })}><Text style={{ fontSize: 13, fontWeight: '700', color: danger ? T.danger : T.ink }}>{title}</Text></Pressable>;
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
