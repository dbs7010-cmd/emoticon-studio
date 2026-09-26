import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, BackHandler, LayoutAnimation, Modal, View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, UIManager } from 'react-native';
import { Keyboard, useWindowDimensions, type GestureResponderEvent, type ImageSourcePropType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { canvasHtml } from './canvas-html';
import { alphaOf, hsv, hsvOf, light, parseHex, toHex, typedHex, withAlpha } from './color';
import { Action, Dialog, Elev, EmptyState, IconButton, ProTag, Range, Segmented, SheetHeader, T, TabBar, userMessage } from '../components/ui';
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
  // 내보내기 검수의 '손볼 곳'에서 들어온 칸이면 저장 뒤 그 검수 화면으로 돌아간다(45.38).
  returnToReview?: boolean;
  onReturnToReview?: () => void;
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

// 'manual': 저장 버튼(45.38). 이 칸을 저장하고 완성으로 표시하되 **이 칸에 머문다**. 다음 칸은 저장 뒤 안내에서 고른다.
type SaveAction = 'stay' | 'manual' | 'close' | 'share' | 'complete' | 'reference' | 'motion' | number;
export type Tool = 'pen' | 'fill' | 'eraser' | 'select';
type Brush = 'pen' | 'brush' | 'pencil';
type Panel = 'color' | 'width' | 'brush' | 'reference' | 'more' | 'caption' | null;
// 캔버스 아래 기본 도구 줄의 높이. **늘 같은 높이다** — 어떤 도구 창을 열고 닫아도 캔버스의
// 크기·자리·배율이 달라지지 않는다(45.35 §4). 45.34 는 브러시 목록이 열리면 즐겨찾기 줄을
// 접어 이 높이를 줄였는데, 그러면 여는 순간 캔버스가 커졌다가 닫으면 작아진다. 목록이 이제
// 화면 전체를 덮는 창이라 아래 줄이 보이지도 않으므로, 접을 이유 자체가 없어졌다.
// 즐겨찾기 카드(62) + 도구 네 칸(52) + 줄 사이 여백.
export const BASE_H = 142;
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
// ── 왼쪽 세로 조절대(45.35 승인 시안) ─────────────────────────────────────────────────────
// 위가 굵기, 아래가 불투명도. **캔버스 밖** 제 자리에 서기 때문에 끄는 동안 그림이 가려지지 않는다 —
// 예전에는 캔버스 한가운데에 검은 미리보기 상자가 떴고, 정작 고치는 중인 그림을 덮었다.
//
// 끊기지 않는 비결은 '부모를 다시 그리지 않는 것'이다. 끄는 동안의 값은 이 부품 안에만 있고,
// 손을 떼는 순간 한 번만 위로 올린다. 그래서 끄는 내내 편집 화면 전체가 다시 그려지지도,
// WebView 에 중간값 메시지가 쌓이지도 않는다. 최종값은 손을 떼는 그 순간 반드시 올라간다.
// 지연 보간·debounce·setTimeout 은 쓰지 않는다 — 늦게 반영하는 것이 아니라 아예 보내지 않는다.
// 굵기는 어차피 **다음 첫 획**부터 쓰이므로, 끄는 도중의 값을 엔진이 알 이유가 없다.
// 기둥 폭 72dp: 손가락 자리(48dp)를 넉넉히 넘고, **라벨과 값 말풍선이 기둥 안에 온전히 들어간다**.
// 64dp 였을 때 '불투명도' 라벨과 '100%' 말풍선이 기둥 밖으로 삐져나가 캔버스에 가렸다(검토 렌더에서 확인).
// 말풍선을 캔버스 위로 띄우는 길도 있지만, 그러면 고치는 중인 그림의 가장자리를 가린다.
export const RAIL_W = 72;
// 캔버스 둘레 여백. 종이가 작업면 위에 놓인 대지로 읽히게 한다 — 여백 없이 화면 오른쪽 끝에 붙으면 테두리가 잘린 듯 보였다(45.37 실기기).
export const CANVAS_GAP = 10;
// 손잡이는 흰 세로 캡슐(시안). 홈 가운데에 얹히고, 가운데에 잉크색 표시가 하나 있다.
const RAIL_HANDLE_H = 34, RAIL_HANDLE_W = 20, RAIL_GROOVE_X = 7, RAIL_GROOVE_W = 6;
// 홈의 길이. 아래위로 하나씩 서므로 캔버스 높이의 절반을 나눠 갖되, 시안의 비율을 넘지 않는다 —
// 캔버스가 길다고 노란 기둥 둘이 화면을 지배하면 안 된다. 짧은 화면에서는 120dp 까지 줄어든다.
// 기둥의 위아래 여백(24) + 두 홈 사이(20) + 라벨 둘을 빼고 남는 높이를 둘로 나눈다.
// 짧은 화면(320×568)에서는 하한 56dp 까지 줄어든다 — 108dp 를 고집했더니 기둥이 캔버스 영역 밖으로
// 밀려나 불투명도 홈이 아래 줄에 잘렸다. 잘려서 못 쓰는 것보다 짧아도 쓰는 편이 낫다.
// 접근성 한 걸음(increment/decrement)은 홈 길이와 무관하게 늘 정확히 한 칸씩 움직인다.
const RAIL_TRACK_MAX = 208, RAIL_TRACK_MIN = 56, RAIL_LABEL_H = 19;
const railTrackOf = (area: number) => Math.max(RAIL_TRACK_MIN, Math.min(RAIL_TRACK_MAX, Math.floor((area - 24 - 20 - RAIL_LABEL_H * 2) / 2)));
// 말풍선은 손잡이 오른쪽에 붙어 함께 오르내린다. 손잡이 자리에 매여 있으므로 조절이 끝나면
// 남아 떠도는 표시가 없다.
const RAIL_BUBBLE_X = RAIL_HANDLE_W, RAIL_BUBBLE_H = 22, RAIL_BUBBLE_W = 44;
// 0~1 을 퍼센트 글자로. 자리를 비율로 잡아야 첫 그림부터 맞고, 레이아웃을 재기 전에도 비어 보이지 않는다.
const pct = (r: number) => (Math.max(0, Math.min(1, r)) * 100).toFixed(2) + '%' as `${number}%`;
function VSlider({ label, value, min, max, step = 1, onCommit, bubble, disabled, testID, a11yLabel, height: track }: {
  label: string; value: number; min: number; max: number; step?: number;
  onCommit: (n: number) => void; bubble: (n: number) => React.ReactNode;
  disabled?: boolean; testID?: string; a11yLabel?: string; height: number;
}) {
  // 끄는 동안의 값. null 이면 위에서 내려온 값을 그대로 보여 준다.
  const [live, setLive] = useState<number | null>(null);
  const liveRef = useRef<number | null>(null);
  const pageTop = useRef(0);
  const [h, setH] = useState(0);
  const shown = live ?? value;
  const span = max - min || 1;
  const travel = Math.max(1, h - RAIL_HANDLE_H);
  const ratio = Math.max(0, Math.min(1, (shown - min) / span));
  const quantize = (n: number) => Math.max(min, Math.min(max, Math.round(n / step) * step));
  // 위로 갈수록 큰 값. 손잡이의 가운데가 손가락을 따라온다.
  const at = (pageY: number) => {
    if (h <= 0) return;
    const next = quantize(min + (1 - Math.max(0, Math.min(1, (pageY - pageTop.current - RAIL_HANDLE_H / 2) / travel))) * span);
    liveRef.current = next;
    setLive(next);
  };
  const settle = () => { if (liveRef.current !== null) onCommit(liveRef.current); liveRef.current = null; setLive(null); };
  const nudge = (by: number) => onCommit(quantize(value + by * step));
  return <View style={{ width: RAIL_W - 8, height: track + RAIL_LABEL_H }}>
    <Text numberOfLines={1} style={{ height: RAIL_LABEL_H, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: -.2, color: disabled ? T.faint : T.muted }}>{label}</Text>
    <View testID={testID} accessibilityRole="adjustable" accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled }} accessibilityValue={{ min, max, now: Math.round(shown) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityHint={disabled ? undefined : '누른 채 위아래로 끌어서 바꿔요'}
      onAccessibilityAction={e => { if (disabled) return; if (e.nativeEvent.actionName === 'increment') nudge(1); if (e.nativeEvent.actionName === 'decrement') nudge(-1); }}
      onLayout={e => { const n = Math.round(e.nativeEvent.layout.height); if (n > 0 && n !== h) setH(n); }}
      onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled} onResponderTerminationRequest={() => false}
      // 기준점은 **누르는 그 이벤트 안에서** 잡는다: 홈의 화면 위치 = pageY − locationY.
      // 둘이 같은 이벤트의 같은 좌표계라 Modal·상태바·안전 영역 차이가 끼어들지 않고, 비동기 측정을 기다리지도 않는다.
      // 그다음부터는 pageY 만 쓴다 — locationY 는 손가락이 홈 밖으로 나가거나 닿은 대상이 바뀌면 튄다(45.36-R1 G19).
      onResponderGrant={e => { pageTop.current = e.nativeEvent.pageY - e.nativeEvent.locationY; at(e.nativeEvent.pageY); }}
      onResponderMove={e => at(e.nativeEvent.pageY)}
      onResponderRelease={settle} onResponderTerminate={settle}
      style={{ height: track }}>
      {/* 손잡이가 오르내리는 자리. 위아래로 손잡이 절반만큼 들여 두면 손잡이가 끝에서 잘리지 않는다. */}
      <View pointerEvents="none" style={{ height: track - RAIL_HANDLE_H, marginVertical: RAIL_HANDLE_H / 2 }}>
        {/* 홈: 얇고 부드러운 회색. 들여 둔 만큼 도로 늘려 기둥 전체를 지난다. */}
        <View style={{ position: 'absolute', left: RAIL_GROOVE_X, top: -RAIL_HANDLE_H / 2, bottom: -RAIL_HANDLE_H / 2, width: RAIL_GROOVE_W, borderRadius: RAIL_GROOVE_W / 2, backgroundColor: T.surface2 }} />
        {/* 아래에서 지금 값까지만 노랑이 찬다. */}
        <View style={{ position: 'absolute', left: RAIL_GROOVE_X, width: RAIL_GROOVE_W, top: pct(1 - ratio), bottom: -RAIL_HANDLE_H / 2, borderRadius: RAIL_GROOVE_W / 2, backgroundColor: disabled ? T.lineStrong : T.accent }} />
        {/* 손잡이. 누르는 동안에도 크기는 그대로다 — 테두리 색만 짙어진다. */}
        <View testID={testID ? testID + ' 손잡이' : undefined}
          style={{ position: 'absolute', left: 0, bottom: pct(ratio), marginBottom: -RAIL_HANDLE_H / 2, width: RAIL_HANDLE_W, height: RAIL_HANDLE_H, borderRadius: RAIL_HANDLE_W / 2,
            alignItems: 'center', justifyContent: 'center', backgroundColor: T.paper,
            borderWidth: 1, borderColor: live !== null ? T.ink : T.lineStrong, ...Elev[1] }}>
          <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: disabled ? T.faint : T.ink }} />
        </View>
        {!disabled && <View style={{ position: 'absolute', left: RAIL_BUBBLE_X, bottom: pct(ratio), marginBottom: -RAIL_BUBBLE_H / 2 }}>{bubble(shown)}</View>}
      </View>
    </View>
  </View>;
}
// 끌어서 차례를 바꾸는 목록(45.37 — 45.36-R1 의 DragRow 를 대신한다).
// 사용자 신고 "레이어 순서 바꿀 때 모션이 어색함"(영상 78~83초)을 이렇게 풀었다:
// ① 끄는 줄은 Animated 값으로 손가락을 따라간다 — 끄는 동안 편집 화면도, 이 목록도 다시 그려지지 않는다.
// ② 다른 줄은 끄는 줄이 반 칸을 넘을 때마다 부드럽게(140ms) 비켜 준다. 예전에는 끄는 줄만 떠다니고 나머지는 가만히 있다가
//    놓는 순간 한꺼번에 뛰었다.
// ③ 놓으면 끄는 줄이 새 자리로 미끄러져 들어간다. 엔진이 새 차례를 돌려줄 때까지 화면의 차례를 먼저 바꿔 두어
//    (낙관적 차례) 옛 자리로 튀었다 돌아오는 깜빡임이 없다. 엔진이 돌려주면 그 차례로 갈아탄다.
// ④ 목록 밖(판 머리 위)으로 삐져나가지 않게 목록을 잘라 둔다.
// 손잡이는 이 목록이 건네주는 응답 함수를 받는다: 손잡이를 누른 채 끌 때만 움직이고, 줄의 다른 곳은 평소처럼 누른다.
// 레이어 한 줄의 높이: 줄 56 + 아래 구분선 1. 끈 거리를 칸 수로 바꿀 때 쓴다.
const LAYER_ROW_H = 57;
type DragHandle = Pick<React.ComponentProps<typeof View>, 'onStartShouldSetResponder' | 'onMoveShouldSetResponder' | 'onResponderTerminationRequest' | 'onResponderGrant' | 'onResponderMove' | 'onResponderRelease' | 'onResponderTerminate'>;
function DragList({ ids, rowH, onMove, onDragging, renderRow }: {
  ids: string[]; rowH: number; onMove: (id: string, steps: number) => void; onDragging?: (on: boolean) => void;
  renderRow: (id: string, index: number, handle: DragHandle, dragging: boolean) => React.ReactNode;
}) {
  const key = ids.join('|');
  const [order, setOrder] = useState<string[] | null>(null);
  // 엔진이 새 차례를 돌려주면(또는 레이어가 늘거나 줄면) 낙관적 차례를 내려놓는다.
  useEffect(() => { setOrder(null); }, [key]);
  const list = order && order.length === ids.length && order.every(id => ids.includes(id)) ? order : ids;
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{ id: string; from: number; to: number; start: number } | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const shifts = useRef(new Map<string, Animated.Value>()).current;
  const shiftOf = (id: string) => { let v = shifts.get(id); if (!v) { v = new Animated.Value(0); shifts.set(id, v); } return v; };
  const slide = (v: Animated.Value, toValue: number, ms = 140) => Animated.timing(v, { toValue, duration: ms, useNativeDriver: true });
  const spread = (from: number, to: number) => list.forEach((id, j) => {
    if (j === from) return;
    const target = from < to && j > from && j <= to ? -rowH : to < from && j >= to && j < from ? rowH : 0;
    slide(shiftOf(id), target).start();
  });
  const finish = () => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const steps = d.to - d.from;
    slide(dragY, steps * rowH, 120).start(() => {
      if (steps) { const next = [...list]; next.splice(d.to, 0, next.splice(d.from, 1)[0]); setOrder(next); onMove(d.id, steps); }
      dragY.setValue(0); shifts.forEach(v => v.setValue(0)); setDragId(null); onDragging?.(false);
    });
  };
  const handleFor = (id: string, index: number): DragHandle => ({
    onStartShouldSetResponder: () => list.length > 1, onMoveShouldSetResponder: () => list.length > 1,
    // 목록 스크롤이 손가락을 가로채면 끌던 줄이 공중에 멈춘다 — 끄는 동안은 넘겨주지 않는다.
    onResponderTerminationRequest: () => false,
    onResponderGrant: e => { drag.current = { id, from: index, to: index, start: e.nativeEvent.pageY }; dragY.setValue(0); setDragId(id); onDragging?.(true); },
    onResponderMove: e => {
      const d = drag.current; if (!d) return;
      const dy = Math.max(-d.from * rowH, Math.min((list.length - 1 - d.from) * rowH, e.nativeEvent.pageY - d.start));
      dragY.setValue(dy);
      const to = d.from + Math.round(dy / rowH);
      if (to !== d.to) { d.to = to; spread(d.from, to); }
    },
    onResponderRelease: finish, onResponderTerminate: finish,
  });
  return <View style={{ overflow: 'hidden' }}>
    {list.map((id, index) => { const dragging = id === dragId;
      return <Animated.View key={id} style={{ transform: [{ translateY: dragging ? dragY : shiftOf(id) }], zIndex: dragging ? 2 : 0, elevation: dragging ? 4 : 0, backgroundColor: dragging ? T.paper : undefined }}>
        {renderRow(id, index, handleFor(id, index), dragging)}
      </Animated.View>; })}
  </View>;
}
// 말풍선 껍데기. 모서리·테두리·글자를 다른 도구와 같은 언어로 쓴다.
function RailBubble({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    width: RAIL_BUBBLE_W, height: RAIL_BUBBLE_H, borderRadius: 10, backgroundColor: T.paper, borderWidth: 1, borderColor: T.line, ...Elev[1] }}>{children}</View>;
}
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
export function Painter({ slot, slotCount, setName, canon, canonName, canonLocked, palette, userPalette, onSaveUserColor, onRemoveUserColor, brushSettings, onBrushSettings, favoriteBrushes, onFavoriteBrushes, paperTexture, completeTitle, hasPrevious, previousImage, pro, onRequestPro, previousMotion, initialTool, onToolChange, guideHint, onGuideHintDone, guideExample, guideExampleMode, onImportGuideExample, savedMotions, onSaveMotion, onForgetMotion, onSave, onComplete, returnToReview, onReturnToReview, onSetReference, onCopyPrevious, onColorUsed, onClose, onNavigate, onAddReferences, onImportDrawing, initialImport, onInitialImportUsed, cutouts, onKeepCutout, onUseCutout, onForgetCutout, onRemoveReference, onShare }: Props) {
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
  const coverRoom = (cover = .5) => {
    if (!canvasSide) return Infinity;
    const area = canvasArea;
    const side = Math.min(canvasSide, Math.max(0, area));
    // 패널이 너무 납작해지지 않게 160dp 아래로는 내리지 않는다 — 다만 그 하한이
    // '캔버스 절반' 보다 크면 규칙 자체를 깨게 된다(320dp 화면: 절반이 156dp).
    // 그래서 하한도 캔버스에 맞춰 함께 내린다. 넘지 않는 것이 먼저다.
    const floor = Math.min(160, Math.round(side * cover));
    // 그리기 탭은 캔버스가 가운데라 남는 자리의 절반이 캔버스 아래다.
    return Math.max(floor, Math.round((area - side) / 2 + side * cover));
  };
  // 키보드가 떠 있을 때는 240dp 를 넘지 않되, **키보드 위에 실제로 남은 자리**(머리 52·모드 줄 48 제외)도 넘지 않는다.
  // 240 을 그대로 쓰면 320×568 급에서 키보드 위 자리(약 217dp)보다 커 패널 윗부분이 머리 밑으로 들어갔다 —
  // 45.36-R1 에서 화면 매트릭스에 568 높이를 넣고 처음 잡혔다. 입력 줄·적용이 들어갈 120dp 아래로는 내리지 않는다.
  const panelRoom = (share: number, cover = .5) => typing
    ? Math.max(120, Math.min(240, windowHeight - insets.top - insets.bottom - keyboard - 52 - 48))
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
  // 즐겨찾기 편집 모드. 평소에는 줄을 누르면 그 브러시로 그리고, 편집 중에는 어느 칸에 넣을지 묻는다.
  const [favEdit, setFavEdit] = useState(false);
  // 브러시 창에서 보고 있는 분류. 세부 설정에 들어갔다 나와도 이 값이 남아 있어 제자리로 돌아온다.
  const [brushGroup, setBrushGroup] = useState<Group>('선');
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
  // 레이어 줄을 끄는 동안 목록 스크롤을 멈춘다 — 스크롤이 손가락을 가로채면 끌던 줄이 공중에 멈춘다(45.37).
  const [layerDragging, setLayerDragging] = useState(false);
  const [cutoutPicker, setCutoutPicker] = useState(false);
  const [hiddenWarning, setHiddenWarning] = useState('');
  // 저장 버튼 뒤의 짧은 안내(45.38). 'done' 이면 '다음 칸' 으로 이어 갈 수 있고, 'blank' 면 빈 칸은 완성이 아니라고 말한다.
  // 4초 뒤 스스로 걷힌다 — 캔버스 위에는 한 번에 한 가지만 말한다(canvasMessage).
  const [savedNote, setSavedNote] = useState<'done' | 'blank' | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSaved = (kind: 'done' | 'blank') => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedNote(kind); savedTimer.current = setTimeout(() => setSavedNote(null), 4000);
  };
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);
  const keeping = useRef<((data: string | null) => void) | null>(null);
  const selectedReference = scene.references.find(r => r.id === scene.activeReferenceId);

  const width = tool === 'eraser' ? eraserWidth : penWidth;
  // 조절대가 실제로 뜻을 갖는 때. 채우기·선택·글씨 손질·스포이드 중에는 바꿀 것이 없으므로 비활성으로 둔다 —
  // 자리는 그대로 남아 화면이 흔들리지 않고, 글자는 읽을 수 있을 만큼만 옅다.
  const editing = !scene.captionPicked && !scene.selection && !scene.picking;
  const sizable = (tool === 'pen' || tool === 'eraser') && editing;
  const inkable = tool === 'pen' && editing;
  // 말풍선 안의 원. 굵기를 눈으로 가늠하게 하되 말풍선 크기는 바뀌지 않도록 4~12 안에 둔다.
  const dotFor = (n: number) => Math.max(4, Math.min(12, Math.round(3 + n * 9 / 48)));
  // 기둥 홈의 길이는 **캔버스 한 변**으로 정한다 — 조절대는 종이 옆에 붙어 종이의 위아래 끝을 넘지 않는다(45.36-R1 G1).
  // 45.35~45.36 은 캔버스 영역 전체 높이로 재서, 세로로 긴 화면에서 조절대가 종이 위아래 빈 자리까지 뻗었다.
  // 아직 한 번도 재지 않았을 때(첫 그림)는 화면으로 어림한다 — 재고 나면 그 값을 쓴다.
  const railTrack = railTrackOf(canvasSide ?? Math.min(windowWidth - RAIL_W, Math.max(200, windowHeight - insets.top - insets.bottom - 52 - 48 - BASE_H)));
  const tap = (name: string) => { if (PROBE) console.log('SELPROBE ' + JSON.stringify({ type: 'ui', what: name, t: Date.now() })); };
  // 조용한 자동저장이 도는 동안 캔버스는 다른 명령을 받지 않는다. 그 사이 누른 도구·색·굵기는 버리지 않고 모았다가
  // 저장이 끝나면 보낸다. 자동저장 중에 누른 완성·닫기도 잃지 않고 저장이 끝난 뒤 이어서 한다.
  const held = useRef<object[]>([]), quiet = useRef(false), queued = useRef<SaveAction | null>(null);
  // 저장 요청 번호(45.12차). 늦게 온 응답을 다음 저장의 응답으로 잘못 쓰지 않으려고 센다.
  const saveToken = useRef(0);
  const saveRef = useRef<(action: SaveAction) => void>(() => {});
  const inject = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);
  // 조용한 자동저장 중에도 **다음 획의 준비**는 미루지 않는다. 아래는 그림을 건드리지 않고
  // '다음에 무엇으로 그릴지'만 정하는 명령이라 저장 결과에 영향이 없다. 미뤘다가 보내면 그 사이에
  // 사용자가 그은 획이 **이전 도구로** 그려진다 — 지우개 → 펜 전환이 사라지던 원인이다(45.34).
  const NOW = ['save', 'saved', 'saveFailed', 'tool', 'brush', 'brushSettings', 'color', 'width'];
  const send = (message: { type: string } & Record<string, unknown>) => { if (quiet.current && !NOW.includes(message.type)) { held.current.push(message); return; } inject(message); };
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
  // 브러시 창을 닫는 길은 하나뿐이다 — 편집 모드·고정 중·세부 설정까지 함께 내려놓는다.
  const closeBrushRef = useRef<() => void>(() => {});
  backRef.current = () => {
    if (busy) return true;                                   // 저장 중에는 아무 일도 하지 않는다
    if (cutoutPicker) { setCutoutPicker(false); return true; }
    if (showCanon) { setShowCanon(false); return true; }
    if (layerMenu) { setLayerMenu(null); return true; }
    if (captionOpen) { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); return true; }
    if (scene.selection) { send({ type: 'selectCancel' }); return true; }   // 임시 편집은 버리기 전에 되돌린다
    // 브러시 창 안에서 한 단계 들어가 있으면 창을 닫기 전에 그 단계부터 되돌린다.
    if (panel === 'brush' && brushDetail) { ease(); setBrushDetail(false); return true; }
    if (panel === 'brush') { closeBrushRef.current(); return true; }
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
    if (tool === 'pen' && isBrushOn(key)) { ease(); setPanel('brush'); setBrushDetail(true); return; }
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
    Alert.alert('참고 삭제', '이 칸에서 이 참고를 없앱니다. 다른 칸의 참고는 그대로예요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { onRemoveReference(path); send({ type: 'removeReference', id }); setPanel(null); } },
    ]);
  }

  // 지금 그리고 있는 브러시. 세부 설정 화면의 제목과 견본이 이 브러시를 가리킨다.
  const currentBrushKey = (CATALOG.find(b => isBrushOn(b.key)) ?? CATALOG[0]).key;
  // ── 브러시 창(45.35 승인 시안) ─────────────────────────────────────────────────────────
  // 아래에서 올라오는 얕은 판이 아니라 **넓은 독립 창**이다. 뒤의 캔버스는 가볍게 어두워질 뿐
  // 크기도 배율도 그대로다. 창 높이는 미리 정해 두어, 목록과 세부 설정을 오가도 창이 커졌다
  // 작아졌다 하지 않는다. 보통 세로 화면에서 네 줄이 통째로 보이는 높이를 아래에서 보장한다.
  // 승인 시안: 창은 머리줄·모드 줄 **바로 아래부터** 아래 끝 가까이까지 덮는다(45.36-R1 G10).
  // 네 줄 보장은 창에 드는 모든 것을 센다 — 머리 48 · 분류 48 · 줄 넷 · 세부 설정 입구 48 · 편집 안내 한 줄(24) · 여백.
  // 45.35~45.36 은 세부 설정 입구를 빼고 셌다. 그래서 320×568 에서 세 줄 반만 보였다(G9).
  // 짧은 화면에서 이 합이 모자라면 창이 머리줄을 조금 덮는다 — 줄을 잘라 보이는 것보다 낫다.
  const brushRoom = Math.max(160, windowHeight - insets.top - insets.bottom - 16);
  const BRUSH_ROW_H = 72;
  const BRUSH_WINDOW_MIN = 48 + 48 + BRUSH_ROW_H * 4 + 48 + 24 + 8;
  const brushWindowH = Math.min(brushRoom, Math.max(brushRoom - 52 - 48, BRUSH_WINDOW_MIN));
  const closeBrush = () => { ease(); setPanel(null); setFavEdit(false); setPinning(null); setBrushDetail(false); };
  closeBrushRef.current = closeBrush;
  const stab = effectiveBrush.stabilizer;
  const brushWindow = panel !== 'brush' ? null : <View testID="브러시 창 배경" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40, backgroundColor: '#12151A59' }}>
    <Pressable accessibilityRole="button" accessibilityLabel="브러시 창 바깥 닫기" onPress={closeBrush} style={{ flex: 1 }} />
    <View testID="브러시 창" accessibilityViewIsModal style={{ height: brushWindowH, marginHorizontal: 8, marginBottom: 8, borderRadius: 20, overflow: 'hidden', backgroundColor: C.paper, ...Elev[2] }}>
      <SheetHeader
        title={brushDetail ? brushInfo(currentBrushKey).title : favEdit ? '즐겨찾기 편집' : '브러시'}
        closeLabel="브러시 닫기" onClose={closeBrush}
        left={brushDetail ? <IconButton label="브러시 목록으로" icon="chevron-left" size={22} color={C.ink} onPress={() => { ease(); setBrushDetail(false); }} /> : undefined}
        right={brushDetail ? undefined : <Pressable accessibilityRole="button" accessibilityLabel={favEdit ? '즐겨찾기 편집 끝내기' : '즐겨찾기 편집'}
          accessibilityState={{ selected: favEdit }}
          onPress={() => { ease(); setFavEdit(!favEdit); setPinning(null); }}
          style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 12, borderRadius: C.radius.button, alignItems: 'center', justifyContent: 'center',
            backgroundColor: favEdit ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{favEdit ? '끝내기' : '즐겨찾기 편집'}</Text>
        </Pressable>} />

      {/* 목록 쪽은 세부 설정에 들어가도 **살아 있다**(보이지만 않는다) — 돌아오면 보던 분류와
          구르던 자리가 그대로다. 다시 만들면 맨 위로 튕긴다. */}
      <View style={{ flex: 1, minHeight: 0, display: brushDetail ? 'none' : 'flex' }}>
        {favEdit && !pinning && <Text style={{ fontSize: 12, color: C.muted, paddingHorizontal: 16, paddingBottom: 6 }}>넣을 브러시를 고르면 1·2·3번 칸 중에 고를 수 있어요.</Text>}
        {/* 어느 칸에 넣을지. 지금 그 칸에 무엇이 있는지 함께 보여 준다 — 무엇과 바뀌는지 알고 눌러야 한다. */}
        {!!pinning && <View style={{ gap: 6, marginHorizontal: 12, marginBottom: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: C.radius.md, backgroundColor: C.surface2 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>‘{brushInfo(pinning).title}’ 를 어느 칸에 넣을까요?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {quickBrushes.map((k, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={(i + 1) + '번 칸 — 지금 ' + brushInfo(k).title + ' · 여기에 넣기'}
              onPress={() => { pinBrush(i, pinning); setPinning(null); }}
              style={({ pressed }) => ({ flex: 1, minHeight: C.tap, paddingHorizontal: 6, borderRadius: C.radius.button, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper })}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{i + 1}번 칸</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted }}>지금 {brushInfo(k).title}</Text>
            </Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel="즐겨찾기 고정 취소" onPress={() => setPinning(null)}
              style={{ minHeight: C.tap, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>취소</Text>
            </Pressable>
          </View>
        </View>}
        {/* 분류: 선·채색·질감·효과. 한 분류 안에서는 마지막 줄까지 한 번의 스크롤로 닿는다. */}
        <TabBar testID="브러시 분류" value={brushGroup} onChange={setBrushGroup}
          items={GROUPS.map(g => ({ key: g, label: g, a11y: '브러시 분류 ' + g }))} />
        {!!effectiveBrush.preset && effectiveBrush.preset in RETIRED &&
          <Text style={{ fontSize: 11, color: C.muted, paddingHorizontal: 16, paddingTop: 6 }}>지금은 예전 브러시 ‘{RETIRED[effectiveBrush.preset]}’ 로 그리고 있어요. 그대로 쓸 수 있어요.</Text>}
        {/* 한 줄에 한 브러시. 줄마다 카드를 두르지 않는다 — 얇은 구분선과 여백으로만 가른다.
            고른 줄만 옅은 노랑과 체크다. 잠긴 것도 이름과 견본이 선명하다 — 흐리게 지우지 않는다. */}
        <ScrollView testID="브러시 목록" style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 8 }}>
          {CATALOG.filter(b => b.group === brushGroup).map(b => { const on = isBrushOn(b.key), fav = quickBrushes.indexOf(b.key);
            return <Pressable key={b.key} testID={'브러시 줄 ' + b.title}
              accessibilityRole="button"
              accessibilityLabel={(favEdit ? '즐겨찾기에 넣기 ' : '브러시 ') + b.title}
              accessibilityValue={{ text: (b.pro ? 'PRO' : '무료') + (fav >= 0 ? ' · 즐겨찾기 ' + (fav + 1) + '번' : '') }}
              accessibilityHint={favEdit ? '누르면 어느 칸에 넣을지 고를 수 있어요' : b.pro && !pro ? 'PRO 브러시예요' : b.use}
              accessibilityState={{ selected: on }}
              onPress={() => { if (favEdit) { setPinning(b.key); return; } pickFromAll(b.key); }}
              style={({ pressed }) => ({ minHeight: BRUSH_ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 10,
                borderBottomWidth: 1, borderColor: C.line,
                backgroundColor: on && !favEdit ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
              {/* 이름 칸 — 견본과 겹치지 않는 제 자리를 갖는다. */}
              <View style={{ width: 96 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: on ? '800' : '700', color: C.ink }}>{b.title}</Text>
                {fav >= 0 && <Text style={{ fontSize: 11, color: C.muted }}>즐겨찾기 {fav + 1}번</Text>}
              </View>
              {/* 견본 칸 — 남은 가로폭을 전부 쓴다. 실제 브러시 엔진이 낸 획이다. */}
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Image accessibilityIgnoresInvertColors source={b.stroke} style={{ width: '100%', height: 40, tintColor: color }} resizeMode="contain" />
              </View>
              {b.pro && <ProTag />}
              {/* 표시 자리는 고르든 말든 같은 너비다 — 고를 때 줄 안이 밀리지 않는다. */}
              <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                {favEdit ? <MaterialCommunityIcons name={fav >= 0 ? 'pin' : 'pin-outline'} size={18} color={fav >= 0 ? C.ink : C.faint} />
                  : on ? <MaterialCommunityIcons name="check" size={20} color={C.ink} /> : null}
              </View>
            </Pressable>; })}
        </ScrollView>
        {/* 세부 설정은 같은 창의 **다른 화면**이다. 목록 창 안에 조절을 쌓아 두지 않는다. */}
        <Pressable accessibilityRole="button" accessibilityLabel="세부 설정" accessibilityHint="진하기와 선 보정을 바꿔요"
          onPress={() => { ease(); setBrushDetail(true); }}
          style={({ pressed }) => ({ minHeight: C.tap, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16,
            borderTopWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.fill : C.paper })}>
          <MaterialCommunityIcons name="tune-variant" size={18} color={C.muted} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>세부 설정</Text>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.faint, textAlign: 'right' }}>진하기 {Math.round(effectiveBrush.opacity * 100)}% · 선 보정 {STAB_LEVELS.find(([k]) => k === stab)?.[1] ?? '끔'}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />
        </Pressable>
      </View>

      {/* 세부 설정 화면. 같은 창 안에서 바뀌고, 뒤로 가면 목록의 분류와 자리가 그대로 돌아온다. */}
      {brushDetail && <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 12, color: C.muted }}>{brushInfo(currentBrushKey).use}</Text>
        <View style={{ height: 40, borderRadius: C.radius.button, backgroundColor: C.surface2, justifyContent: 'center', paddingHorizontal: 10 }}>
          <Image accessibilityIgnoresInvertColors accessibilityLabel="지금 브러시 획 견본" source={brushInfo(currentBrushKey).stroke} style={{ width: '100%', height: 28, tintColor: color }} resizeMode="contain" />
        </View>
        <Range label="진하기" value={Math.round(effectiveBrush.opacity * 100)} min={5} max={100} step={1} onChange={n => changeBrush({ opacity: Math.round(n) / 100 }, false)} onActive={a => { if (a === false) changeBrush({ opacity: effectiveBrush.opacity }, true); }} display={Math.round(effectiveBrush.opacity * 100) + '%'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable accessibilityRole="switch" accessibilityLabel="선 보정" accessibilityState={{ checked: stab !== 'off' }} onPress={() => changeBrush({ stabilizer: stab === 'off' ? 'light' : 'off' })}
            style={{ minHeight: C.tap, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 2 }}>
            <Switch on={stab !== 'off'} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>선 보정</Text>
          </Pressable>
          {stab !== 'off' && <View style={{ flex: 1 }}>
            <Segmented dense value={stab} onChange={level => changeBrush({ stabilizer: level })} items={STAB_LEVELS.map(([level, name]) => ({ key: level, label: name, a11y: '보정 ' + name }))} />
          </View>}
        </View>
      </ScrollView>}
    </View>
  </View>;
  // 캔버스가 주인공이다. 아래 기본 도구 줄(baseH)은 늘 같은 높이로 자리를 차지하고, 패널은 그 위에 겹쳐 뜬다.
  // 브러시 창은 45.35 부터 화면 전체를 덮는 독립 창이라 아래 판에 들지 않는다.
  const dockOpen = !!scene.selection || (!!panel && panel !== 'more' && panel !== 'brush') || drawRail || refRail || !!scene.captionPicked;
  // 움직이기 탭에서는 캔버스를 위로 붙이고, 패널은 캔버스 아래 남는 자리(+ 기본 도구 줄 자리)를 쓴다 — 미리보기를 가리지 않는다.
  // 남는 자리가 작은 화면에서만 최소 높이만큼 캔버스 아래쪽에 겹친다.
  const motionHeight = Math.max(250, Math.min(Math.round(windowHeight * .55), Math.round(canvasArea - (canvasSide ?? canvasArea)) + BASE_H));
  // 패널 표면: 흰 표면 + 위쪽 24 둥글기 + 옅은 선 하나. 떠 있는 표면이지만 캔버스 위 그림자는 두지 않는다(그림이 흐려 보인다).
  const raised = dockOpen || tab === 'motion';
  // 색을 고를 때는 도구 줄 자리까지 쓴다. 캔버스를 더 가리지 않고 색 선택 영역을 확보한다.
  const colorDock = tab === 'draw' && panel === 'color' && !scene.selection;
  const dock = { position: 'absolute', left: 0, right: 0, bottom: tab === 'draw' && !typing && !colorDock ? BASE_H : 0, zIndex: 20, borderTopWidth: raised ? 1 : 0, borderLeftWidth: raised ? 1 : 0, borderRightWidth: raised ? 1 : 0, borderColor: C.line, borderTopLeftRadius: raised ? 24 : 0, borderTopRightRadius: raised ? 24 : 0, overflow: 'hidden', backgroundColor: C.paper, flexShrink: 0 } as const;
  const narrow = windowWidth < 360;
  // 머리줄이 두 줄로 갈릴지는 '실제로 잰 폭'으로 정한다 — 화면이 좁아서든 글자가 커서든 같은 규칙이다.
  // 기본 글자 크기에서는 320~412dp 모두 한 줄이다(승인 시안). 글자 배율을 키워 정말 넘칠 때만 둘째 줄로 내린다 —
  // 45.36 은 이 규칙을 끄고(false 고정) 한 줄을 강요해, 큰 글자에서 잘릴 자리를 검사 기대값으로 덮었다(45.36-R1 G3).
  const [headW, setHeadW] = useState(0), [tabsW, setTabsW] = useState(0), [aidsW, setAidsW] = useState(0);
  // 되돌리기·다시 실행의 자리(45.37 사용자 요청): 참고·레이어·문구의 왼쪽 끝. 다만 380dp 미만에서는 모드 줄에 다 들지 않아,
  // 줄을 하나 더 쓰는 대신(작은 화면에서 캔버스·판 자리가 모자라진다) 윗줄 이름 옆에 선다. 윗줄은 저장 하나라 자리가 남는다.
  const undoInModeRow = windowWidth >= 380;
  const undoPair = <>
    <Bar label="되돌리기" icon="undo-variant" narrow disabled={!initialized || !scene.undo || busy} onPress={() => send({ type: 'undo' })} />
    <Bar label="다시 실행" icon="redo-variant" narrow disabled={!initialized || !scene.redo || busy} onPress={() => send({ type: 'redo' })} />
  </>;
  // 모드 줄이 넘칠 때(큰 글자)만 두 줄로 간다 — 잰 폭으로 정한다.
  const headStacked = tab === 'draw' && headW > 0 && tabsW > 0 && aidsW > 0 && tabsW + aidsW + 12 > headW;
  // 위 줄의 '레이어'는 지금 어느 장을 쓰는지 말한다 — 열지 않아도 읽힌다(45.5차).
  const drawLayers = scene.layers.filter(l => l.id.startsWith('draw-'));
  const layerAt = (id: string) => scene.layers.findIndex(l => l.id === id);
  const activeLayerAt = drawLayers.findIndex(l => l.id === scene.activeLayerId);
  const layerBadge = drawLayers.length > 1 && activeLayerAt >= 0 ? '레이어 ' + (activeLayerAt + 1) : '레이어';
  // 보조 도구 묶음. 한 줄에 설 때나 두 줄로 내려올 때나 같은 것이라, 잰 폭이 자리에 따라 달라지지 않는다.
  const aidRow = <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== aidsW) setAidsW(w); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* 되돌리기·다시 실행은 참고·레이어·문구의 **왼쪽 끝**에 선다(45.37 사용자 요청). 윗줄의 '‹ 닫기' 옆에 있으면
          '뒤로·앞으로 가기'처럼 읽혀 헷갈렸다. 그림을 고치는 손과 같은 줄에 두고, 옅은 세로 선으로 보조 도구와 가른다.
          움직이기 탭에서도 되돌리기는 쓰이므로 그대로 둔다. */}
      {undoInModeRow && undoPair}
      {undoInModeRow && tab === 'draw' && <View style={{ width: 1, height: 24, marginHorizontal: 4, backgroundColor: C.line }} />}
      {/* 그림을 돕는 것끼리 한 무리(45.5차): 가져오는 것(참고) · 쌓는 것(레이어) · 얹는 것(문구).
          아래 도구 줄은 '지금 그리는 손'만 다룬다. 레이어는 몇 번째를 쓰는 중인지 여기서 바로 읽힌다. */}
      {tab === 'draw' && ([['참고', refRail || showCanon, 'image-outline', '참고', () => { ease(); setRefRail(!refRail); setRefBrowse(true); setDrawRail(false); setPanel(null); setCaptionOpen(false); }],
         ['레이어', drawRail, 'layers-outline', layerBadge, () => { ease(); setDrawRail(!drawRail); setRefRail(false); setPanel(null); setCaptionOpen(false); }],
         ['문구', panel === 'caption' || !!scene.captionPicked, 'format-text', '문구', () => { if (panel === 'caption') { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); } else { setDrawRail(false); setRefRail(false); openCaption(); } }]] as const).map(([label, on, icon, title, run]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={run} hitSlop={{ left: 2, right: 2 }}
          style={({ pressed }) => ({ width: 44, minHeight: 48, borderRadius: C.radius.button, alignItems: 'center', justifyContent: 'center', gap: 1,
            backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
          <MaterialCommunityIcons name={icon} size={17} color={on ? C.ink : C.muted} />
          <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
        </Pressable>)}
  </View>;
  const emptyCut = !slot.work && !slot.finalImage;
  // 제안할 수 있는 상태(continueAvailable)와 지금 캔버스에 보이는지(offerContinue)를 나눈다. 더보기 메뉴는 앞의 것으로 가려서,
  // 메뉴를 여는 순간 같은 기능의 두 번째 입구가 생기지 않게 한다.
  const continueAvailable = initialized && emptyCut && hasPrevious && !!previousImage && !continueDismissed && !scene.dirty && !scene.undo;
  const offerContinue = continueAvailable && tab === 'draw' && !panel && !refRail && !drawRail;
  // 작업 패널(브러시·색·문구·참고 관리)과 레이어 줄이 열려 있으면, 캔버스를 누르는 첫 손가락은 '패널 닫기'다(45.4차).
  // 참고 줄은 제외한다 — 참고는 캔버스 위에서 옮기고 키우는 중이라 손가락이 캔버스로 가야 한다.
  const panelCovering = tab === 'draw' && ((!!panel && panel !== 'more' && panel !== 'brush') || drawRail);
  // 캔버스 위에는 한 번에 한 가지만 말한다(45.2차). 위에서부터 급한 순서로 하나를 고른다.
  const canvasMessage: 'saving' | 'saved' | 'hidden' | 'eyedrop' | 'previous' | 'guide' | 'zoomHint' | null =
    // 방금 누른 저장의 결과는 두 탭 모두에서 보인다 — 움직이기 탭에서 저장해도 '다음 칸'으로 이어 갈 수 있어야 한다.
    savedNote && !slowSave ? 'saved'
    : tab !== 'draw' ? null
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
  // 윗줄의 주 동작 하나: 저장. 누르면 **이 칸에 머문다**(45.38). 45.37 까지는 이름만 '저장'이고 실제로는 다음 칸으로 넘어가,
  // 단순히 저장하려던 사람이 작업 자리를 잃었다. 이제 저장한 뒤 캔버스 위 안내에서 '다음 칸'을 고를 수 있다.
  // 내보내기 검수에서 고치러 들어온 칸이면 저장 뒤 그 검수 화면으로 돌아간다.
  // 모양은 승인 시안대로 노란 채움 + 글자만.
  const saveButton = <Pressable accessibilityRole="button" accessibilityLabel="저장" accessibilityHint={returnToReview ? '저장한 뒤 내보내기 검수로 돌아가요' : '이 칸을 저장하고 완성으로 표시해요. 이 칸에 그대로 있어요'}
      disabled={busy || !initialized} onPress={() => save('manual')}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({ minHeight: 40, minWidth: 56, paddingHorizontal: 14, marginHorizontal: 2, borderRadius: C.radius.button,
        alignItems: 'center', justifyContent: 'center', backgroundColor: busy || !initialized ? C.fill : pressed ? C.accentLine : C.accent })}>
      <Text numberOfLines={1} style={{ color: busy || !initialized ? C.faint : C.accentInk, fontWeight: '800', fontSize: 14 }}>저장</Text>
    </Pressable>;
  return <Modal onRequestClose={() => { if (Keyboard.isVisible()) { Keyboard.dismiss(); return; } if (panel === 'brush' && brushDetail) { ease(); setBrushDetail(false); return; } if (panel === 'brush') { closeBrush(); return; } if (panel) { ease(); setPanel(null); return; } if (drawRail || refRail) { ease(); setDrawRail(false); setRefRail(false); return; } if (showCanon) { setShowCanon(false); return; } save('close'); }} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* 머리: 닫기 · 세트 이름과 칸 번호 · 저장 · 더보기. 되돌리기·다시 실행은 아래 줄(참고 왼쪽)로 옮겼다(45.37). */}
      <View style={{ minHeight: 52, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }}>
        <Bar label="그리기 닫기" icon="chevron-left" strong disabled={busy} onPress={() => save('close')} />
        {/* 이름은 한 줄로 줄이고 넘치면 말줄임한다. 칸 번호도 한 줄이다 — 글자 단위로 여러 줄에 쌓지 않는다. */}
        <View style={{ flex: 1, flexShrink: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: C.tap }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: '100%', fontSize: 15, lineHeight: 20, color: C.ink, fontWeight: '700' }}>{setName}</Text>
          {/* 저장 표시는 칸 번호 옆 작은 자리다. 예전에는 머리줄에 28dp 칸을 따로 차지해, 320dp 에서 세트 이름이 설 자리를 빼앗았다(45.36-R1 G3).
              자리 폭은 늘 같아서 표시가 뜨고 사라져도 글자가 밀리지 않는다. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
            <Text numberOfLines={1} accessibilityLabel="현재 칸" style={{ flexShrink: 1, fontSize: 11, lineHeight: 14, fontWeight: '600', color: C.faint, letterSpacing: .4 }}>{String(slot.number).padStart(2, '0') + ' / ' + slotCount}</Text>
            <View testID="저장 표시" accessibilityLabel={saveMark === 'saving' ? '저장 중' : saveMark === 'done' ? '저장됨' : undefined} style={{ width: 16, height: 14, marginLeft: 3, alignItems: 'center', justifyContent: 'center' }}>
              {saveMark === 'saving' && <MaterialCommunityIcons name="cloud-upload-outline" size={13} color={C.faint} />}
              {saveMark === 'done' && <MaterialCommunityIcons name="cloud-check-outline" size={13} color={C.success} />}
            </View>
          </View>
        </View>
        {!undoInModeRow && undoPair}
        {saveButton}
        <Bar label="더보기" icon="dots-horizontal" active={panel === 'more'} onPress={() => { setPanel(panel === 'more' ? null : 'more'); setDrawRail(false); setRefRail(false); }} />
      </View>
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
              style={{ minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: tab === key ? '800' : '600', color: tab === key ? C.ink : C.faint }}>{title}</Text>
              <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: tab === key ? C.accent : 'transparent' }} />
            </Pressable>)}
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
      {/* 왼쪽 조절대 + 캔버스. 조절대는 **늘 같은 자리를 차지한다** — 움직이기 탭에서 내용만 비우고
          자리는 남겨, 탭을 오가도 정사각 캔버스의 크기가 달라지지 않는다. */}
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      <View testID="조절대" style={{ width: RAIL_W, paddingLeft: 4, alignItems: 'flex-start', justifyContent: 'center', backgroundColor: C.bg }}>
        {tab === 'draw' && !typing && !panel && !drawRail && !refRail && !scene.selection && <View testID="조절대 내용" style={{ height: canvasSide ?? undefined, paddingVertical: 4, justifyContent: 'space-between' }}>
          <VSlider testID="굵기 조절대" label="굵기" height={railTrack} a11yLabel={tool === 'eraser' ? '지우개 굵기' : '브러시 굵기'}
            value={width} min={1} max={48} step={1} disabled={!sizable}
            onCommit={n => setWidth(n, true)}
            bubble={n => <RailBubble testID="굵기 말풍선">
              <View style={{ width: dotFor(n), height: dotFor(n), borderRadius: dotFor(n) / 2, backgroundColor: tool === 'eraser' ? C.paper : color, borderWidth: 1, borderColor: C.lineStrong }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>{Math.round(n)}</Text>
            </RailBubble>} />
          <View style={{ height: 20 }} />
          <VSlider testID="불투명도 조절대" label="불투명도" height={railTrack} a11yLabel="브러시 불투명도"
            value={Math.round((effectiveBrush.opacity ?? 1) * 100)} min={10} max={100} step={5} disabled={!inkable}
            onCommit={n => changeBrush({ opacity: Math.max(.1, Math.min(1, n / 100)) }, true)}
            bubble={n => <RailBubble testID="불투명도 말풍선">
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>{Math.round(n)}%</Text>
            </RailBubble>} />
        </View>}
        {/* 움직이기 탭에서 기둥은 비어 있다. 기둥과 캔버스 밖이 같은 작업면 색이라 빈 띠로 읽히지 않는다.
            45.36 은 여기에 누를 수 없는 재생 아이콘을 두었다 — 눌러도 아무 일 없는 표시는 두지 않는다(45.36-R1 G5). */}
      </View>
      {/* 그리기 탭: 캔버스와 조절대가 영역의 **세로 가운데**에 함께 선다. 45.36-R1 은 맨 위에 붙였는데, 기기에서 캔버스 아래에
          큰 빈 자리가 한 덩어리로 남아 "캔버스가 비어 보인다"는 신고가 됐다(45.37 영상). 가운데에 두면 남는 자리가 위아래로 나뉘어
          종이가 작업면 한가운데 놓인 대지처럼 읽힌다. 움직이기 탭은 아래를 움직임 판이 쓰므로 위에 선다. */}
      <View testID="캔버스 영역" style={{ flex: 1, padding: CANVAS_GAP, alignItems: 'center', justifyContent: tab === 'motion' ? 'flex-start' : 'center', backgroundColor: C.bg }}
        onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; const side = Math.floor(Math.min(w, h) - CANVAS_GAP * 2); if (side > 0 && side !== canvasSide) setCanvasSide(side); if (h > 0 && Math.round(h) !== canvasArea) setCanvasArea(Math.round(h)); if (w > 0 && Math.round(w) !== canvasWide) setCanvasWide(Math.round(w)); }}>
        {/* 캔버스 틀: 네이티브 WebView 는 크기 지정을 무시하고 영역 전체를 채워, 캔버스가 위에 붙고 아래에 빈 띠가 남았다(40차 실기기 bounds 0,381–1080,1882).
            정사각 틀로 감싸 잘라 두면 WebView 가 틀만큼만 차지하고, 그리기 탭에서는 영역 가운데·움직이기 탭에서는 위에 선다. */}
        {/* 종이 경계: 얇은 선 + 옅은 그림자. 흰 종이와 작업면이 비슷한 밝기라 경계가 없으면 캔버스가 떠 보였다(45.37 실기기). */}
        <View ref={canvasRef} collapsable={false} style={canvasSide ? { width: canvasSide, height: canvasSide, overflow: 'hidden', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, ...Elev[1] } : { width: '100%', aspectRatio: 1, maxHeight: '100%', overflow: 'hidden' }}>
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
                // 저장 버튼: 그림이 있으면 완성으로 표시하고, 빈 캔버스면 작업만 남긴다(빈 칸은 완성이 아니다).
                const declare = action === 'complete' || (action === 'manual' && !blank);
                if (m.dirty !== false || action === 'stay' || action === 'manual' || action === 'share' || action === 'complete' || action === 'reference') {
                  const result = onSave(m, slot.dialogue, declare); setQA(result);
                }
                send({ type: 'saved', token: m.token }); unlock(); markSaved();
                if (nextAction.current === 'complete' && blank) { Alert.alert('아직 빈 칸이에요', '선을 하나라도 그리면 완성할 수 있어요.'); return; }
                if (action === 'manual') {
                  if (returnToReview && !blank) { onReturnToReview?.(); return; }
                  showSaved(blank ? 'blank' : 'done');
                  return;
                }
                if (action === 'motion') switchTab('draw');
                else if (action === 'close') onClose();
                else if (action === 'complete') onComplete();
                else if (action === 'reference') onSetReference();
                else if (typeof action === 'number') onNavigate(action);
                else if (action === 'share') onShare().catch(e => Alert.alert('공유하지 못했어요', userMessage(e)));
              } catch (e) { send({ type: 'saveFailed', token: m.token }); setSaveMark(null); unlock(); Alert.alert('저장하지 못했어요', userMessage(e)); }
            }
          } catch (e) { unlock(); Alert.alert('그리지 못했어요', userMessage(e)); }
        }} style={{ flex: 1, backgroundColor: C.paper }} />
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
        {/* 45.35: 굵기를 끄는 동안 캔버스 한가운데에 뜨던 검은 상자를 없앴다. 값은 왼쪽 조절대의
            손잡이 옆 말풍선이 말한다 — 고치는 중인 그림을 덮지 않는다. */}
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
        {canvasMessage === 'saved' && <View testID="저장 안내" style={{ position: 'absolute', left: 12, right: zoom > 1.05 ? 92 : 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 12, paddingRight: 2, borderRadius: 18, backgroundColor: C.floating, borderWidth: 1, borderColor: C.line, ...Elev[1] }}>
          <MaterialCommunityIcons name={savedNote === 'done' ? 'check-circle' : 'content-save-outline'} size={16} color={savedNote === 'done' ? C.success : C.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: C.ink }}>{savedNote === 'done' ? '저장했어요 · 완성으로 표시했어요' : '저장했어요 · 빈 칸은 완성으로 치지 않아요'}</Text>
          {savedNote === 'done' && <Pressable accessibilityRole="button" accessibilityLabel={completeTitle.includes('전체') ? '전체 보기로 가기' : '다음 칸으로 가기'}
            onPress={() => { setSavedNote(null); onComplete(); }}
            style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 12, borderRadius: C.radius.button, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: pressed ? C.fill : 'transparent' })}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{completeTitle.includes('전체') ? '전체 보기' : '다음 칸'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={C.ink} />
          </Pressable>}
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
          {/* 명세 E08: 여기서 하는 일은 아직 임시다. 무엇이 임시인지 글로 말하고, 나가는 길은 취소·적용 둘뿐이다.
              머리는 다른 판과 같은 공통 머리다(45.36-R1 G7) — 다만 닫기 ×는 두지 않는다. 세 번째 출구가 되기 때문이다. */}
          <SheetHeader title="고른 부분" />
          <Text numberOfLines={2} accessibilityLabel="고른 부분은 적용해야 그림에 남아요" style={{ fontSize: 12, color: C.muted, paddingHorizontal: 16, marginTop: -6 }}>캔버스에서 끌어 옮기고, 아래에서 바꾼 뒤 적용해야 그림에 남아요.</Text>
          {/* 판 높이가 정해져 있으므로 이 목록이 먼저 줄어야 아래 취소·적용이 밀려나지 않는다. */}
          <ScrollView style={{ flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 8 }}>
          {/* 옮기기는 캔버스에서 끌어서 한다. 여기에는 누르는 변형만 둔다. */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['작게', 'magnify-minus-outline', { scale: .9 }], ['크게', 'magnify-plus-outline', { scale: 1.1 }], ['왼쪽 회전', 'rotate-left', { rot: -15 }], ['오른쪽 회전', 'rotate-right', { rot: 15 }], ['좌우 반전', 'flip-horizontal', { flip: true }]] as const).map(([title, icon, change]) =>
              <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={() => send({ type: 'selectTransform', ...change })}
                // 변형 도구는 '아이콘 도구' 역할이다 — 아래 도구 줄처럼 바탕·테두리 없이 아이콘과 이름, 누르는 동안만 회색(45.36-R1 G8).
                style={({ pressed }) => ({ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: C.radius.button, backgroundColor: pressed ? C.fill : 'transparent' })}>
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
        </View> : panel === 'color' ? <View testID="색상 패널" style={{ maxHeight: panelRoom(0.38, 0.44) + (typing ? 0 : BASE_H) }}><ColorPanel scrollable={!dropping} color={color} recent={palette} saved={userPalette} view={colorView} onView={setColorView} onPick={pickColor} onEyedrop={startEyedrop} eyedropHandlers={eyedropHandlers} onSave={onSaveUserColor} onForget={onRemoveUserColor} onClose={() => { ease(); setPanel(null); }} /></View>
        : panel === 'caption' ? <View style={{ backgroundColor: C.paper, maxHeight: panelRoom(0.5) }}>
          {/* 미확정 변경은 '문구 적용'으로만 확정된다. 닫으면 고치던 글자는 버려지고 화면의 문구는 그대로 남는다.
              키보드가 올라오면 머리·지우기·아래 버튼을 접고 입력 한 줄(색 · 입력 · 키보드 닫기 · 적용)만 남긴다 —
              캔버스가 띠로 줄어 고치는 글씨가 잘리던 39차 P2. 입력칸은 같은 자리에 남아 포커스를 잃지 않는다. */}
          {!typing && <SheetHeader title="문구" closeLabel="문구 닫기" onClose={() => { ease(); Keyboard.dismiss(); setPanel(null); setCaptionOpen(false); }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: typing ? 8 : 16, paddingTop: typing ? 8 : 0, paddingBottom: 8 }}>
            {/* 지금 색을 보여 주기만 한다(45.10차). 색을 고르는 입구는 아래 '팔레트' 하나 — 같은 일을 하는 자리를 둘 두지 않는다. */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF', ...{ shadowColor: '#000', shadowOpacity: .15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } } }} />
            <TextInput accessibilityLabel="문구 내용" value={captionDraft} onChangeText={setCaptionDraft} multiline={false} autoFocus returnKeyType="done" onSubmitEditing={() => applyCaption(captionDraft)} placeholder="예: 고마워" placeholderTextColor={C.faint} style={{ flex: 1, fontSize: 17, height: C.tap, paddingVertical: 0, textAlignVertical: 'center', borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.surface2, color: C.ink }} />
            {/* 360dp 미만에서는 키보드 닫기 아이콘을 두지 않는다 — 입력칸이 70dp 까지 줄어 글자를 쓸 자리가 없었다(45.36-R1).
                키보드는 안드로이드 뒤로 가기로 닫히고, 닫아도 적용·삭제되지 않는 것은 그대로다(명세 E07). */}
            {typing && !narrow && <IconButton label="키보드 닫기" icon="keyboard-close" color={C.muted} size={20} onPress={() => Keyboard.dismiss()} />}
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

        : panel === 'reference' && selectedReference ? <Sheet room={coverRoom()} title="참고 사진" onClose={() => { ease(); setPanel(null); }}>
          <View style={{ paddingHorizontal: 8, gap: 8 }}>
          <Minor title="위치 초기화" onPress={() => { changeTransform(selectedReference.id, { x: 0, y: 0, scale: 1, rotation: 0 }); setPanel(null); }} />
          <Minor title="참고 삭제" danger onPress={() => { const image = slot.referenceImages.find(i => i.path === selectedReference.path); if (image) removeReference(image.path, selectedReference.id); }} />
          </View>
        </Sheet> : <>
        {drawRail && <SheetHeader title="레이어" closeLabel="레이어 닫기" onClose={() => { ease(); setDrawRail(false); }}
          right={scene.layers.filter(l => l.id.startsWith('draw-')).length < 4
            ? <IconButton testID="레이어 추가" label="레이어 추가" icon="plus" size={22} color={C.ink} onPress={addDrawing} />
            : undefined} />}
        {drawRail && <View style={{ maxHeight: Math.min(280, coverRoom()) }}>
          <ScrollView scrollEnabled={!layerDragging} showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 8 }}>
            {/* 목록은 scene.layers 차례 그대로다(아래로 갈수록 앞). 그래서 아래로 한 칸 끌면 '앞으로 한 칸'(by +1)이다.
                엔진은 한 번에 한 칸만 옮기므로 끈 칸 수만큼 한 칸씩 보낸다 — 엔진은 건드리지 않는다. */}
            <DragList ids={scene.layers.map(l => l.id)} rowH={LAYER_ROW_H}
              onDragging={on => { setLayerDragging(on); if (on) setLayerMenu(null); }}
              onMove={(id, steps) => { for (let i = 0; i < Math.abs(steps); i++) send({ type: 'moveLayer', id, by: Math.sign(steps) }); }}
              renderRow={(id, index, handle, dragging) => {
              const layer = scene.layers.find(l => l.id === id)!;
              const active = layer.id === scene.activeLayerId, name = layerLabel(layer.name);
              return <View style={{ paddingBottom: layerMenu === layer.id ? 6 : 0, borderBottomWidth: 1, borderColor: C.line, backgroundColor: active && !dragging ? C.accentSoft : 'transparent' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
                {/* 고른다고 판이 닫히지 않는다 — 어느 장을 골랐는지 보고 이어서 순서·보임을 만질 수 있어야 한다. */}
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 선택`} accessibilityState={{ selected: active }}
                  onPress={() => send({ type: 'select', id: layer.id })}
                  style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 16, backgroundColor: pressed ? C.fill : 'transparent' })}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, overflow: 'hidden', opacity: layer.visible ? 1 : .35 }}>
                    {thumbs[layer.id] ? <Image source={{ uri: thumbs[layer.id] }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: active ? '800' : '600', color: layer.visible ? C.ink : C.faint }}>{name}</Text>
                  <View style={{ width: 18, alignItems: 'center' }}>{active ? <MaterialCommunityIcons name="pencil" size={16} color={C.ink} /> : null}</View>
                </Pressable>
                <EyeToggle label={`${name} ${layer.visible ? '숨기기' : '보이기'}`} on={layer.visible} onPress={() => changeTransform(layer.id, { visible: !layer.visible })} />
                {/* 손잡이: 누른 채 위아래로 끌면 차례가 바뀐다. 화면 읽기 사용자는 같은 자리에서 올리기·내리기 동작을 쓴다.
                    45.36 은 접근성 동작만 달아 두어, 보이는 손잡이를 끌어도 아무 일이 없었다(G14). */}
                {scene.layers.length > 1 && <View {...handle} accessibilityRole="adjustable" accessibilityLabel={`${name} 순서 바꾸기`}
                  accessibilityHint="누른 채 위아래로 끌어서 차례를 바꿔요"
                  accessibilityValue={{ min: 1, max: scene.layers.length, now: layerAt(layer.id) + 1 }}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={e => send({ type: 'moveLayer', id: layer.id, by: e.nativeEvent.actionName === 'increment' ? 1 : -1 })}
                  style={{ width: 44, height: C.tap, borderRadius: C.radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: dragging ? C.fill : 'transparent' }}>
                  <MaterialCommunityIcons name="drag-horizontal-variant" size={21} color={dragging ? C.ink : C.muted} />
                </View>}
                <Pressable accessibilityRole="button" accessibilityLabel={`${name} 관리`} onPress={() => setLayerMenu(layerMenu === layer.id ? null : layer.id)} style={{ width: C.tap, height: C.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={20} color={C.muted} /></Pressable>
              </View>
            {layerMenu === layer.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 }}>
              {/* 겹치는 차례(45.7차): 위로/아래로 대신 '앞으로 보내기·뒤로 보내기' — 목록의 방향을 몰라도 결과가 그려진다. */}
              {scene.layers.length > 1 && layerAt(layer.id) < scene.layers.length - 1 && <Minor title="앞으로 보내기" onPress={() => { setLayerMenu(null); send({ type: 'moveLayer', id: layer.id, by: 1 }); }} />}
              {scene.layers.length > 1 && layerAt(layer.id) > 0 && <Minor title="뒤로 보내기" onPress={() => { setLayerMenu(null); send({ type: 'moveLayer', id: layer.id, by: -1 }); }} />}
              <Minor title="이름 바꾸기" onPress={() => { setLayerMenu(null); setRenaming({ id: layer.id, name: layer.name }); }} />
              {scene.layers.length < 4 && <Minor title="복제" onPress={() => { setLayerMenu(null); send({ type: 'duplicateLayer', id: layer.id }); }} />}
              {scene.layers.length > 1 && <Minor danger title="지우기" onPress={() => { setLayerMenu(null); Alert.alert(name + ' 지우기', '이 레이어와 레이어에 준 부분 움직임이 함께 지워져요. 되돌리기로 되살릴 수 있어요.', [{ text: '취소', style: 'cancel' }, { text: '지우기', style: 'destructive', onPress: () => send({ type: 'removeLayer', id: layer.id }) }]); }} />}
            </View>}
            </View>;
            }} />
          </ScrollView>
        </View>}
        {refRail && <SheetHeader title="참고" closeLabel="참고 닫기" onClose={() => { ease(); setRefRail(false); }} />}
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
        {refRail && (refSource === 'mine' || !BUILTIN_READY) && (scene.references.length > 0 || !!guideExample) && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        {refRail && (refSource === 'mine' || !BUILTIN_READY) && scene.references.length === 0 && !guideExample &&
          <EmptyState icon="image-outline" message="그림을 보며 따라 그릴 참고 사진을 추가해 보세요."
            action={<Action primary compact title="참고 사진 추가" icon="plus" onPress={() => void addReferences()} />} />}

        {refRail && refSource === 'mine' && !!selectedReference && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 4 }}>
          <EyeToggle label={`참고 ${selectedReference.visible ? '숨기기' : '보이기'}`} on={selectedReference.visible} onPress={() => send({ type: 'toggleReference', id: selectedReference.id })} />
          <MaterialCommunityIcons name="circle-opacity" size={16} color={C.muted} />
          <View style={{ flex: 1 }}><Range testID="참고 진하기" label="진하기" value={selectedReference.opacity} min={.1} max={1} step={.05} onChange={opacity => changeTransform(selectedReference.id, { opacity: Math.round(opacity * 20) / 20 })} /></View>
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
      <View accessibilityElementsHidden={colorDock} importantForAccessibility={colorDock ? 'no-hide-descendants' : 'auto'} style={{ height: typing ? 0 : BASE_H, borderTopWidth: typing ? 0 : 1, borderColor: C.line, backgroundColor: C.paper }} pointerEvents={busy || !initialized || colorDock ? 'none' : 'auto'}>
        {tab === 'draw' && !typing && <>
        {/* 윗줄(45.5차): 손이 가장 자주 가는 둘 — 지금 브러시와 지금 색 — 이 넓게 서고,
            지우개·채우기·선택은 옆의 작은 '빠른 모드' 셋으로 붙는다. 여섯 칸을 똑같이 나눈 도구 메뉴가 아니다.
            이미 고른 것을 다시 누르면 그 설정이 열린다(브러시 = 선 종류·굵기, 색 = 팔레트). */}
        {/* ── 승인 보드 01 배치(45.28차) ──────────────────────────────────────────────
            ① 브러시 빠른 선택 카드 3 + '전체'  ② 지금 색 + 굵기 한 줄  ③ 펜·지우개·채우기·선택 네 칸.
            되돌리기·다시 실행·완성은 머리줄로 올라갔다 — 여기서는 '무엇으로 그릴까'만 다룬다. */}
        {/* ── 승인 시안의 아래 줄(45.35) ──────────────────────────────────────────────
            ① 즐겨찾기 세 칸 + 전체  ② 펜·지우개·채우기·선택 + 지금 색.
            굵기와 불투명도는 왼쪽 조절대로 올라갔다 — 아래에 두 줄로 눕혀 두지 않는다.
            큰 둥근 카드와 굵은 외곽선을 걷고, 고른 칸만 옅은 노랑과 짧은 밑줄로 말한다. */}
        <View testID="빠른 브러시" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 6 }}>
          {quickBrushes.map(key => { const b = brushInfo(key), on = tool === 'pen' && isBrushOn(key);
            return <Pressable key={key} testID={'빠른 브러시 ' + b.title} accessibilityRole="button" accessibilityLabel={b.title}
              accessibilityState={{ selected: on }} accessibilityHint={on ? '다시 누르면 세부 설정이 열려요' : undefined}
              onPress={() => pickBrush(key)}
              style={({ pressed }) => ({ flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: C.radius.button,
                backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
              <Image accessibilityIgnoresInvertColors source={b.stroke} style={{ width: '76%', height: 20, tintColor: color }} resizeMode="contain" />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{b.title}</Text>
            </Pressable>; })}
          <Pressable accessibilityRole="button" accessibilityLabel="브러시 전체" accessibilityState={{ expanded: panel === 'brush' }}
            onPress={() => { ease(); setPanel('brush'); setBrushDetail(false); setBrushGroup(brushInfo(currentBrushKey).group); setDrawRail(false); setRefRail(false); setCaptionOpen(false); }}
            style={({ pressed }) => ({ width: 56, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: C.radius.button,
              backgroundColor: pressed ? C.fill : 'transparent' })}>
            <MaterialCommunityIcons name="view-grid-outline" size={20} color={C.muted} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted }}>전체</Text>
          </Pressable>
        </View>
        {/* ② 도구 네 칸과 지금 색. 색은 오른쪽 끝에 동그라미 하나로 선다(시안). */}
        <View testID="도구 줄" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingTop: 6 }}>
          {ALL_TOOLS.map(([key, title, icon, a11y]) => { const on = tool === key;
            return <Pressable key={key} testID={'도구 ' + title} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }}
              onPress={() => selectTool(key)}
              style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: C.radius.button,
                backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
              <MaterialCommunityIcons name={icon} size={20} color={on ? C.ink : C.muted} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{title}</Text>
            </Pressable>; })}
          <Pressable testID="지금 색" accessibilityRole="button" accessibilityLabel="색" accessibilityValue={{ text: color.toUpperCase() }} accessibilityState={{ expanded: panel === 'color' }}
            accessibilityHint="누르면 색을 골라요"
            onPress={() => { ease(); setPanel(panel === 'color' ? null : 'color'); setDrawRail(false); setRefRail(false); setCaptionOpen(false); }}
            style={({ pressed }) => ({ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}>
            <View testID="지금 색 고리" style={{ width: 36, height: 36, borderRadius: 18, padding: 3, backgroundColor: C.paper,
              borderWidth: panel === 'color' ? 2 : 1, borderColor: panel === 'color' ? C.ink : C.lineStrong }}>
              <View style={{ flex: 1, borderRadius: 15, backgroundColor: color }} />
            </View>
          </Pressable>
        </View>
        </>}
      </View>
    </KeyboardAvoidingView>
    {/* 브러시 창은 머리줄·캔버스·아래 줄을 모두 덮는 독립 창이다(승인 시안). */}
    {brushWindow}

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
// narrow: 폭 40 + 좌우 터치 여유 4 — 손가락 자리는 48dp 그대로, 줄 안에서 차지하는 폭만 줄인다(모드 줄에 되돌리기를 넣으려고, 45.37).
function Bar({ label, icon, strong, narrow, active, disabled, onPress }: { label: string; icon: IconName; strong?: boolean; narrow?: boolean; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: active }} disabled={disabled} onPress={onPress} hitSlop={narrow ? { left: 4, right: 4 } : undefined} style={{ width: narrow ? 40 : T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .3 : 1 }}>
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
// 45.35: 캔버스 가장자리 굵기 띠(45.4차)는 왼쪽 세로 조절대가 대신한다. 쓰이지 않는 부품을 남겨 두면
// 다음 사람이 어느 쪽이 진짜인지 알 수 없다.
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
// 45.35: 손으로 그린 눈 대신 다른 아이콘과 같은 집합(MaterialCommunityIcons)에서 가져온다 —
// 한 줄 안에서 연필·눈·점 셋의 선 굵기와 크기가 어긋나 보이던 자리다.
function EyeToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={onPress}
    style={({ pressed }) => ({ width: T.tap, height: T.tap, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.fill : 'transparent' })}>
    <MaterialCommunityIcons name={on ? 'eye-outline' : 'eye-off-outline'} size={20} color={on ? T.ink : T.faint} />
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
function Sheet({ title, onClose, children, tall, room = Infinity, plain, closeLabel, right }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean; room?: number; plain?: boolean; closeLabel?: string; right?: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return <View style={{ backgroundColor: T.paper, maxHeight: Math.min(room, tall ? Math.min(440, Math.max(300, Math.round(height * .5))) : Math.min(300, Math.max(190, height - 440))) }}>
    <SheetHeader title={title} onClose={onClose} closeLabel={closeLabel} right={right} />
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

  return <View style={{ flexShrink: 1, minHeight: 0, paddingBottom: 8 }}>
    <SheetHeader title="색상" closeLabel="팔레트 닫기" onClose={onClose} />
    <View style={{ flexShrink: 1, minHeight: 0, paddingHorizontal: 16, gap: 8 }}>
    <TabBar testID="색상 보기" value={view} onChange={onView} items={[{ key: 'custom', label: '직접 선택' }, { key: 'palette', label: '팔레트' }]} />
    <ScrollView testID="색 견본 스크롤" style={{ flexShrink: 1, minHeight: 0 }} scrollEnabled={scrollable} keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator contentContainerStyle={{ gap: 12, paddingTop: 4, paddingBottom: 16 }}>
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
    </View>
    {/* 제목과 탭만 고정한다. 색 값·추출·견본·투명도는 작은 화면과 키보드 위에서도 함께 스크롤된다. */}
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
      {/* 직접 선택(45.35 승인 시안): 넓은 SV 사각판 + 오른쪽 세로 색상 막대. 밝기는 사각판의 세로축이라
          따로 막대를 두지 않는다 — 같은 값을 두 곳에서 조절하지 않게. 투명도는 그대로 남는다. */}
      {/* 승인 시안: 사각판 · 세로 막대 · **오른쪽 색 견본 두 줄 세 칸**. 최근 쓴 색이 먼저이고, 모자라면 기본 색으로 채운다 —
          처음 연 사람에게도 빈칸이 아니라 바로 고를 색이 있다. 예전에는 판 아래 가로 줄이라 판 경계에서 잘렸다(45.36-R1 G13). */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><ColorArea color={color} onPick={(c, settle) => onPick(keepAlpha(c), settle)} /></View>
        <View testID="최근 색" style={{ width: 36 * 2 + 10, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 10 }}>
          {[...recent.slice(0, 6).map(c => ['최근 색 ' + c, c] as const), ...swatches.filter(c => !recent.some(r => same(r, c))).map(c => ['기본 색 ' + c, c] as const)].slice(0, 6)
            .map(([label, c]) => <Swatch round key={label} label={label} color={c} size={36} selected={same(c, color)} onPress={() => quick(c)} />)}
        </View>
      </View>
      <Range label="투명도" value={percent} min={5} max={100} step={1} onChange={n => channel('a', Math.round(n) * 2.55)} display={percent + '%'} />
    </>}
    </ScrollView>
    </View>
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
// ── 색 고르는 판(45.35 승인 시안) ─────────────────────────────────────────────────────────
// 왼쪽에 넓은 SV 사각판, 오른쪽에 세로 색상 막대. 시안 그대로의 배치다.
//
// 예전에는 사각판을 가로 20칸·세로 16칸의 작은 네모로, 색상 막대를 30칸으로 이어 붙였다.
// 칸마다 색이 한 번에 뛰므로 **계단식 색 타일**로 보였다 — 사용자가 지적한 그 문제다.
// 이제는 아주 작은 PNG 두 장(흰색이 사라지는 가로 · 검정이 짙어지는 세로)을 바탕색 위에 늘려
// 덮는다. 늘릴 때 기기가 픽셀 사이를 메우므로 단이 생기지 않는다. 두 장은 색과 무관해서
// 어떤 색상에서도 같은 판이 나온다 — 색을 바꿀 때마다 그림을 다시 만들지 않는다.
// (그라디언트 라이브러리를 새로 넣지 않는다: 네이티브 구성이 달라진다.)
const FIELD_H = 132, HUE_W = 44, HUE_BAR_W = 22, KNOB = 24;
const SAT_MASK = require('../../assets/art/field-sat.png');
const VAL_MASK = require('../../assets/art/field-val.png');
const HUE_MASK = require('../../assets/art/hue-bar-v.png');
// 손잡이는 흰 고리 + 고른 색 + 얇은 짙은 테두리. 두 겹이라 흰 색 위에서도 검은 색 위에서도 보인다.
function Knob({ color, left, top }: { color: string; left: number | `${number}%`; top: number | `${number}%` }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left, top, marginLeft: -KNOB / 2, marginTop: -KNOB / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...Elev[2] }}>
    <View style={{ width: KNOB - 7, height: KNOB - 7, borderRadius: KNOB, backgroundColor: color, borderWidth: 1, borderColor: '#1717194D' }} />
  </View>;
}
// 끄는 동안의 색은 화면 한 프레임에 한 번, 실제로 바뀌었을 때만 위로 올린다. 손을 떼면(settle) 그 자리에서 바로 올린다(45.37).
// 예전에는 손가락 이벤트마다 올려 편집 화면 전체가 다시 그려지고 캔버스에 색 명령이 쌓였다 — '조절이 뚝뚝 끊김'의 한 자리.
const nextFrame: (f: () => void) => unknown = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(f, 16);
function useFramedPick(onPick: (c: string, settle?: boolean) => void) {
  const latest = useRef<string | null>(null), sent = useRef<string | null>(null), pending = useRef(false);
  const flush = () => { pending.current = false; const c = latest.current; if (c !== null && c !== sent.current) { sent.current = c; onPick(c, false); } };
  return (c: string, settle: boolean) => {
    latest.current = c;
    if (settle) { pending.current = false; sent.current = c; latest.current = null; onPick(c, true); return; }
    if (!pending.current) { pending.current = true; nextFrame(flush); }
  };
}
function ColorArea({ color, onPick }: { color: string; onPick: (c: string, settle?: boolean) => void }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>
    <View style={{ flex: 1 }}><ColorField color={color} onPick={onPick} /></View>
    <HueBar color={color} onPick={onPick} />
  </View>;
}
function ColorField({ color, onPick }: { color: string; onPick: (c: string, settle?: boolean) => void }) {
  const [size, setSize] = useState({ w: 0, h: FIELD_H });
  // 누를 때 판의 화면 위치를 잡고(pageX − locationX), 그다음부터는 화면 좌표만 쓴다 — 조절대와 같은 방식(45.36-R1 G19).
  // 손가락이 판 밖으로 나가도 가장자리 값에서 멈추고 튀지 않는다.
  const origin = useRef({ x: 0, y: 0 });
  const push = useFramedPick(onPick);
  const grab = (e: GestureResponderEvent) => { origin.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY }; };
  const local = (e: GestureResponderEvent) => [e.nativeEvent.pageX - origin.current.x, e.nativeEvent.pageY - origin.current.y] as const;
  const { h, s, v } = hsvOf(color);
  const at = (x: number, y: number, settle: boolean) => {
    if (size.w <= 0) return;
    const sat = Math.max(0, Math.min(1, x / size.w)), val = Math.max(.04, Math.min(1, 1 - y / size.h));
    push(hsv(h, sat, val), settle);
  };
  return <View accessibilityRole="adjustable" accessibilityLabel="색 사각판" accessibilityHint="누르거나 끌어서 선명함과 밝기를 골라요"
    accessibilityValue={{ text: color }}
    onLayout={e => { const w = Math.floor(e.nativeEvent.layout.width), hh = Math.floor(e.nativeEvent.layout.height); if (w > 0 && (w !== size.w || hh !== size.h)) setSize({ w, h: hh }); }}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => { grab(e); at(...local(e), false); }}
    onResponderMove={e => at(...local(e), false)}
    onResponderRelease={e => at(...local(e), true)}
    style={{ height: FIELD_H, borderRadius: T.radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: hsv(h, 1, 1) }}>
    <Image accessibilityIgnoresInvertColors source={SAT_MASK} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
    <Image accessibilityIgnoresInvertColors source={VAL_MASK} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
    <Knob color={color} left={pct(s)} top={pct(1 - v)} />
  </View>;
}
function HueBar({ color, onPick }: { color: string; onPick: (c: string, settle?: boolean) => void }) {
  const [height, setHeight] = useState(FIELD_H);
  const { h, s, v } = hsvOf(color);
  const push = useFramedPick(onPick);
  const at = (y: number, settle: boolean) => { if (height <= 0) return; push(hsv(Math.max(0, Math.min(1, y / height)) * 360, s || 1, v || 1), settle); };
  const top = useRef(0);   // 누를 때 막대의 화면 위치. 그다음부터는 pageY 만 쓴다(ColorField 와 같은 까닭).
  return <View accessibilityRole="adjustable" accessibilityLabel="색 계열 막대" accessibilityHint="누르거나 끌어서 색 계열을 골라요"
    accessibilityValue={{ text: Math.round(h) + '도' }}
    onLayout={e => { const hh = Math.floor(e.nativeEvent.layout.height); if (hh > 0 && hh !== height) setHeight(hh); }}
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => { top.current = e.nativeEvent.pageY - e.nativeEvent.locationY; at(e.nativeEvent.pageY - top.current, false); }}
    onResponderMove={e => at(e.nativeEvent.pageY - top.current, false)}
    onResponderRelease={e => at(e.nativeEvent.pageY - top.current, true)}
    style={{ width: HUE_W, height: FIELD_H, alignItems: 'center' }}>
    <View pointerEvents="none" style={{ width: HUE_BAR_W, height: '100%', borderRadius: HUE_BAR_W / 2, overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
      <Image accessibilityIgnoresInvertColors source={HUE_MASK} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
    </View>
    <Knob color={hsv(h, 1, 1)} left={HUE_W / 2} top={pct(h / 360)} />
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
