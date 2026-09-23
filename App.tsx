import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, Image, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Action, AssetSlot, Dialog, Elev, Field, IconButton, ProTag, Range, Segmented, StatusDot, STATUS_TONE, styles, T, Type, userMessage } from './src/components/ui';
import { ASSET_SLOTS, EXPRESSION_GUIDE, HOME_NOTICE, type ExpressionExample, type ExpressionGuideCard } from './src/design/asset-slots';
import { ImageAnalyzer, type Analyzer } from './src/components/image-analyzer';
import { MotionBaker, type Baker } from './src/components/motion-baker';
import { ExtraComposer, placeInFrame, type Composer } from './src/components/extra-composer';
import { Painter, type CopiedWork, type Tool } from './src/painter/painter';
import { KAKAO_ANIMATED_SPEC, KAKAO_STATIC_SPEC as SPEC, STAGES, WEBP_TOOL_RULE, WEBP_ANIMATOR_URL, REQUIRED_EXTRAS } from './src/constants/kakao-spec';
import { captionText, createProject, doneCount, usesPro, droppedImagePaths, duplicateCaptions, isAnimated, isDone, isWorking, nextUnfinished, previousDrawn, reorderSlots, setIsAnimated } from './src/project';
import { deleteLocalImages, exportUri, imageUri, inspectStore, loadStore, saveStore, type StoreReport } from './src/services/storage';
import { exportSet, decodeDataUrl, type HandoffFrames } from './src/services/export';
import { dataUrl, importBundledImage, pickImages, savePainterWork, saveMotionLoop, saveSubmitLoop, saveCutout } from './src/services/images';
import { identicalFinals, inspectImage } from './src/services/qa';
import { PLANS, PRICES_ARE_PROPOSED, PRICE_IS_CANDIDATE_NOTE, REVIEW_BUILD_NOTE, entitlementLabel, expiredButRemembered, internalReviewBuild, isPro, problemText, purchase, purchaseHistoryUrl, refreshEntitlement, restore, reviewUnlocked, storePrices, subscriptionManageUrl, type PaymentProblem, type PurchaseOutcome } from './src/services/pro';
import { PRESETS } from './src/painter/motion-panel';
import type { Check, LocalImage, Motion, Project, SavedMotion, Slot, Store, QA, PainterWork } from './src/types';

const colors: Record<string, string> = { PASS: T.success, WARNING: STATUS_TONE.warn, FAIL: STATUS_TONE.fail, EMPTY: T.faint, DRAWING: T.info, REVIEW: '#8B6FCB', PLANNED: T.success };
const C = T;
// 설정 화면에 보여 줄 앱 버전. app.json 의 값을 그대로 읽는다.
const appVersion = Constants.expoConfig?.version ?? '—';
// 감정 카드의 대표 그림을 꺼낸다. 홈 미리보기와 감정 목록이 같은 규칙을 쓴다.
// 카드 위에 보여 줄 그림. 표시용이 있으면 그것을 쓴다 — 몸 안이 흰색이라 카드 색이 캐릭터로 비치지 않는다.
// 밑그림으로 깔 때는 이 함수를 쓰지 않는다(원본 artwork 그대로).
const shownArt = (x?: { artwork?: ImageSourcePropType; display?: ImageSourcePropType } | null) => x?.display ?? x?.artwork ?? null;
const coverOf = (card: ExpressionGuideCard) => card.artwork ?? shownArt(card.examples?.find(x => x.id === card.cover)) ?? null;
// 홈에 올리는 표현 가이드 미리보기 셋: 서로 다른 감정·자세를 고른다(명세 §5 — 기존 예시 최대 3개).
const HOME_GUIDE_PREVIEW = ['greeting-hello', 'greeting-excited', 'daily-good-night'] as const;
const PREVIEW_TINT = [T.lilac, T.sky, T.coral] as const;
// 표현 선택의 '참고 vs 밑그림' 안내는 앱을 켠 뒤 처음 한 번만 보여 준다. 저장 파일에는 남기지 않는다.
let guideTipShown = false;
// A rough, hand-drawn mark: friendly, and never better drawn than the user's own work.
function Doodle() {
  return <View style={{ width: 96, height: 64, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 70, height: 46, borderRadius: 16, borderWidth: 2, borderColor: '#D8D1C6', transform: [{ rotate: '-3deg' }] }} />
    <View style={{ position: 'absolute', left: 26, top: 24, width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink }} />
    <View style={{ position: 'absolute', left: 46, top: 24, width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink }} />
    <View style={{ position: 'absolute', left: 33, top: 38, width: 18, height: 2, borderRadius: 2, backgroundColor: C.ink, transform: [{ rotate: '4deg' }] }} />
    <View style={{ position: 'absolute', right: 6, top: 6, width: 10, height: 2, borderRadius: 2, backgroundColor: C.yellow, transform: [{ rotate: '40deg' }] }} />
    <View style={{ position: 'absolute', right: 10, top: 2, width: 2, height: 10, borderRadius: 2, backgroundColor: C.yellow, transform: [{ rotate: '40deg' }] }} />
  </View>;
}
function mergeImages(existing: LocalImage[], added: LocalImage[]) { return [...existing, ...added.filter(image => !existing.some(current => current.path === image.path))]; }
export default function App() { return <SafeAreaProvider><Studio /></SafeAreaProvider>; }
function Studio() {
  const [store, setStore] = useState<Store | null>(null), current = useRef<Store | null>(null);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  // What the files on this device actually looked like. Kept so a failure can be read here
  // instead of guessed at, and so nothing has to be deleted to find out.
  const [report, setReport] = useState<StoreReport | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null), [slotNumber, setSlotNumber] = useState<number | null>(null), [canonOpen, setCanonOpen] = useState(false), [painting, setPainting] = useState(false);
  const [busy, setBusy] = useState('');
  const [menu, setMenu] = useState(false);
  // 명세 H03: 새 세트는 이름을 확인하고 만든다. 이 값이 있는 동안에도 저장소는 그대로다 — '만들기'를 눌러야 세트가 생긴다.
  const [newSetName, setNewSetName] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null), [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'board' | 'export' | 'batch' | 'extras'>('board');
  const [batchSource, setBatchSource] = useState<number | null>(null), [batchPicked, setBatchPicked] = useState<number[]>([]);
  const [batchSaved, setBatchSaved] = useState<string | null>(null), [batchReplace, setBatchReplace] = useState(true);
  // 적용하기 전에 한 칸을 실제로 만들어 보는 미리보기. 파일로 쓰지 않고 데이터 그대로 들고 있다가
  // 화면을 떠날 때 버린다 — 확인하기 전에는 저장된 작품이 한 글자도 바뀌지 않는다.
  const [batchPreview, setBatchPreview] = useState<{ number: number; data: string; loop: number; bytes: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [stage, setStage] = useState<'proposal' | 'release'>('proposal');
  // 제출 화면의 규격 원문은 접어 둔다 — 요약은 위에 늘 보이고, 원문은 필요할 때 펼친다.
  const [specOpen, setSpecOpen] = useState(false);
  // 홈 공지는 asset-slots 의 HOME_NOTICE 하나로 켜고 끈다. 검수용 빌드에서만 설정에서 켠 상태를 미리 볼 수 있다(저장하지 않는다).
  const [noticePreview, setNoticePreview] = useState(false);
  const noticeOn = HOME_NOTICE.enabled || (internalReviewBuild() && noticePreview);
  const [prepOpen, setPrepOpen] = useState(false); // 제출 준비는 묶음을 만든 뒤 보는 일이라 접어 둔다(45.2차).
  // 부가 이미지 만들기. 고른 컷을 프레임 안에서 옮기고 키우기만 한다 — 원본 컷은 건드리지 않는다.
  const [extraKind, setExtraKind] = useState<'icon' | 'share' | 'cover'>('icon');
  const [extraSlot, setExtraSlot] = useState<number | null>(null);
  const [place, setPlace] = useState({ scale: 1, dx: 0, dy: 0 });
  const composer = useRef<Composer>(null);
  const [settings, setSettings] = useState(false);
  // 홈 아래 두 화면(44차): 전체 작업(여러 세트 찾기·다시 열기)과 표현 가이드("무엇을 그릴까?"). 세트 안 칸 관리는 보드가 맡는다.
  const [homeView, setHomeView] = useState<'home' | 'all' | 'guide'>('home');
  const [guideCategory, setGuideCategory] = useState<string>(EXPRESSION_GUIDE.categories[0]);
  // 표현 가이드는 창작자의 내비게이션이다(45.17차): 감정을 고르면 그 감정의 여러 표현을 펼쳐 보고,
  // 예시 하나를 고른 다음 '참고하며 그리기' 또는 '밑그림으로 넣기'로 그리기 화면에 들어간다.
  const [guideCard, setGuideCard] = useState<ExpressionGuideCard | null>(null);
  // 고른 표현(G02). 고르기만으로는 편집에 들어가지 않고, 고른 뒤에 아래 두 행동이 열린다.
  const [guidePick, setGuidePick] = useState<string | null>(null);
  // 두 행동의 차이는 처음 한 번만 알려 준다. 앱을 다시 켜기 전까지 다시 뜨지 않는다.
  const [guideTip] = useState(() => !guideTipShown);
  // artwork = 캔버스에 깔 원본 · display = 보여 줄 그림(몸 안 흰색). 둘을 섞지 않는다.
  const [guideExample, setGuideExample] = useState<{ id: string; title: string; hint: string; artwork: ImageSourcePropType; display?: ImageSourcePropType } | null>(null);
  const [guideExampleMode, setGuideExampleMode] = useState<'watch' | 'underlay' | null>(null);
  // 가이드에서 고른 표현 한 줄. Painter 가 힌트로 한 번 보여 주고 끝난다 — 저장 구조에는 남기지 않는다(44.2차).
  const [guideHint, setGuideHint] = useState<{ name: string; hint: string } | null>(null);
  // 복구 화면의 기술 정보는 접어 두고(문의할 때만 펼침), 설정의 '저장 상태 보기'는 사람이 읽는 요약 창으로 연다.
  const [diagOpen, setDiagOpen] = useState(false), [storeStatus, setStoreStatus] = useState(false);
  const [playing, setPlaying] = useState(false), [playIndex, setPlayIndex] = useState(0);
  const [batchResults, setBatchResults] = useState<{ number: number; ok: boolean; reason?: string }[]>([]);
  // Where a fix came from, so finishing one returns to the export run instead of dropping the user.
  const [returnToExport, setReturnToExport] = useState(false), [reordering, setReordering] = useState(false);
  const [lastExport, setLastExport] = useState<{ path: string; count: number } | null>(null);
  // 마지막으로 내보낸 묶음에 실제로 들어간 프레임. 만들기 전에는 장수를 알 수 없으므로 추측해 적지 않는다.
  const [handoffCuts, setHandoffCuts] = useState<{ number: number; count: number; delayMs: number }[]>([]);
  const [proSheet, setProSheet] = useState(false);
  // 앱을 켠 동안 마지막으로 고른 그리기 도구. 다음 칸도 같은 도구로 열린다.
  const [lastTool, setLastTool] = useState<Tool>('pen');
  // 결제 한 번의 상태. 화면은 이 값 하나로 무엇을 보여 줄지 정한다(가격 불러오기 → 결제 → 결과).
  const [payment, setPayment] = useState<Payment>({ phase: 'idle' });
  // 일회성 PRO 하나의 스토어 가격. 없으면 화면은 후보 가격을 '미확정'이라고 적는다.
  const [prices, setPrices] = useState<{ lifetime?: string } | null>(null);
  const resetPayment = () => setPayment({ phase: 'idle' });
  const entitlement = store?.entitlement;
  // 내부 검수 빌드에서만 검수용 해제가 함께 인정된다. 출시 구성에서는 reviewUnlocked() 가 늘 거짓이라
  // 저장소에 값이 남아 있어도 효력이 없다 — 검수하며 만든 작품은 남고, 권한만 따라오지 않는다.
  const pro = isPro(entitlement) || reviewUnlocked(store ?? undefined);
  // 앱을 열 때 한 번, 저장된 이용권을 스토어와 영수증 서버에 다시 묻는다. 물어볼 수 없으면 그대로 둔다.
  const rechecked = useRef(false);
  useEffect(() => {
    if (!store || rechecked.current) return;
    rechecked.current = true;
    void refreshEntitlement(store.entitlement).then(result => {
      if (result.state !== 'updated') return;
      try { commit(st => ({ ...st, entitlement: result.entitlement })); } catch { /* 저장 실패는 배너가 말하고, 다음 실행에서 다시 묻는다 */ }
    }).catch(() => { /* 묻지 못한 것은 '아니다'라는 대답이 아니다 */ });
  }, [store]);
  // PRO 화면을 열면 스토어의 실제 가격을 불러온다. 못 불러오면 제안가를 그대로 두고 왜 결제할 수 없는지 말한다.
  async function loadPrices() {
    setPayment({ phase: 'loading' });
    const result = await storePrices();
    if (result.state === 'ok') {
      setPrices({ lifetime: result.products.find(p => p.plan === 'lifetime')?.localizedPrice });
      setPayment(now => now.phase === 'loading' ? { phase: 'ready' } : now);
    } else {
      setPrices(null);
      setPayment(now => now.phase === 'loading' ? { phase: 'unavailable', problem: result.problem } : now);
    }
  }
  useEffect(() => { if (proSheet) void loadPrices(); }, [proSheet]);
  const { width: screenWidth } = useWindowDimensions();
  // 폰 3열 / 태블릿 4~6열. 칸 자체가 커지는 것이 아니라 한 화면에 더 들어간다.
  const columns = screenWidth >= 900 ? 6 : screenWidth >= 600 ? 4 : 3;
  const tileWidth = (screenWidth - T.gap.lg * 2 - T.gap.sm * (columns - 1)) / columns;
  const projectCardWidth = (screenWidth - T.gap.lg * 2 - T.gap.md) / 2;
  const analyzer = useRef<Analyzer>(null), baker = useRef<Baker>(null);
  function load() {
    try {
      const result = loadStore();
      current.current = result.store; setStore(result.store); setLoadError(''); setReport(result.report);
      if (result.recovered) setNotice('저장 파일 하나가 손상돼 다른 사본으로 열었어요. 손상된 파일도 지우지 않았어요.');
    } catch (e) {
      // Nothing is written or removed on this path: the files stay exactly as they are found.
      const found = (e as { report?: StoreReport }).report ?? safely(inspectStore);
      setLoadError(String(e)); setReport(found ?? null);
      if (found) console.error('[emoticon-studio] 저장 파일을 읽지 못했습니다', JSON.stringify(found, null, 2));
    }
  }
  function safely<T>(read: () => T): T | null { try { return read(); } catch { return null; } }
  // Hands the file over exactly as it is on disk. Reading only: the damaged original stays put,
  // and a copy of it is what makes the cause findable off the device.
  function shareSnapshot(name: string) {
    void task('저장 파일 꺼내는 중…', async () => {
      if (!await Sharing.isAvailableAsync()) throw new Error('이 기기에서는 파일을 내보낼 수 없어요.');
      await Sharing.shareAsync(exportUri(name), { mimeType: 'application/json', UTI: 'public.json' });
    });
  }
  useEffect(load, []);
  function commit(transform: (s: Store) => Store) {
    if (!current.current) throw new Error('저장소가 준비되지 않았습니다.');
    const previous = current.current;
    const next = { ...transform(previous), revision: previous.revision + 1 };
    current.current = next; setStore(next);
    // Persist first. Only once the snapshot is on disk may the files it no longer references go.
    // On failure keep the edit in memory: the retry banner exists to write exactly this state,
    // and the last good snapshot on disk still points at assets nothing has deleted.
    try { saveStore(next); setSaveError(''); } catch (e) { setSaveError(String(e)); throw e; }
    deleteLocalImages(droppedImagePaths(previous, next));
  }
  function changeProject(id: string, transform: (p: Project) => Project) { commit(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...transform(p), updatedAt: new Date().toISOString() } : p) })); }
  function updateProject(transform: (p: Project) => Project) { if (projectId) { try { changeProject(projectId, transform); } catch { /* Keep unsaved state with persistent retry banner. */ } } }
  const project = store?.projects.find(p => p.id === projectId), slot = project?.slots.find(s => s.number === slotNumber);
  function back() { if (busy) return; if (slotNumber !== null) setSlotNumber(null); else if (canonOpen) setCanonOpen(false); else if (screen !== 'board') setScreen('board'); else setProjectId(null); }
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (painting) return false; if (projectId) { back(); return true; } if (guideCard) { setGuideCard(null); return true; } if (homeView !== 'home') { setHomeView('home'); return true; } return false; }); return () => sub.remove(); }, [projectId, slotNumber, canonOpen, busy, painting, screen, homeView, guideCard]);
  // 상태 수명(45.1차).
  //   PROJECT-SCOPED — 세트가 바뀌면 남을 이유가 없다: 내보내기 결과·부가 이미지 선택·움직임 한 번에·보드 일시 상태.
  //   SCREEN-SCOPED  — 보드에서만 산다: 칸 순서 바꾸기·전체 재생.
  //   SESSION-SCOPED — 앱을 켜 둔 동안 이어진다: 마지막 도구·PRO 상태·최근 색(저장은 세트/스토어가 맡는다).
  // 세트를 여닫을 때 한 곳에서 정리한다. 전역 초기화 장치는 두지 않는다.
  const openProject = useRef<string | null>(null);
  useEffect(() => {
    if (openProject.current === projectId) return;
    openProject.current = projectId;
    setLastExport(null); setHandoffCuts([]);
    setExtraKind('icon'); setExtraSlot(null); setPlace({ scale: 1, dx: 0, dy: 0 });
    setBatchSource(null); setBatchPicked([]); setBatchResults([]); setBatchSaved(null); setBatchPreview(null);
    setReordering(false); setPlaying(false); setPlayIndex(0); setReturnToExport(false);
    // 알림은 세트를 떠날 때만 지운다 — 세트를 여는 순간 띄운 안내(예: 칸이 다 찼어요)를 바로 지우지 않기 위해서다.
    if (!projectId) setNotice('');
  }, [projectId]);
  // 보드의 일시 상태는 보드를 떠나면 끝난다(칸을 열거나 내보내기·부가 이미지로 가면).
  useEffect(() => { if (painting || screen !== 'board') { setReordering(false); setPlaying(false); } }, [painting, screen]);
  async function task(label: string, work: () => Promise<void>) { if (busy) return; setBusy(label); try { await work(); } catch (e) { Alert.alert('하지 못했어요', userMessage(e)); } finally { setBusy(''); } }
  async function analyzed(image: LocalImage): Promise<LocalImage> { if (image.metrics) return image; try { return { ...image, metrics: await analyzer.current!.analyze(image) }; } catch { setNotice('일부 그림을 검사하지 못했어요. 그 칸은 확인이 필요하다고 표시돼요.'); return image; } }
  // Re-reads the saved files and replaces every verdict. No earlier PASS survives this.
  async function recheckAll() {
    if (!project) return;
    const id = project.id;
    await task('이미지 검수 중…', async () => {
      const checked = new Map<number, Slot>();
      for (const s of project.slots) {
        // 빈 칸은 검사할 그림이 없다. 검사하면 "그림 파일 없음" FAIL 이 빈 칸마다 쌓여 내보내기에 가짜 손볼 곳이 된다(42차 실기기).
        if (!s.finalImage) { checked.set(s.number, { ...s, qa: undefined }); continue; }
        const finalImage = await analyzed(s.finalImage);
        // 검사는 PNG 칸 그림에 한다. 움직이는 GIF 는 작업용 미리보기라 PNG 검사에 넣으면 움직이는 칸마다 FAIL 이 난다(42차 실기기).
        const qa = inspectImage(finalImage, s.motion ? KAKAO_ANIMATED_SPEC : SPEC);
        checked.set(s.number, { ...s, finalImage, qa, status: finalImage ? qa.status : s.status });
      }
      changeProject(id, p => ({ ...p, slots: p.slots.map(s => checked.get(s.number) ?? s) }));
      setNotice('저장된 그림을 다시 검사했어요.');
    });
  }
  // Autosave preserves work; `complete` is the user saying this cut is finished. Re-editing a
  // finished cut puts it back to 작업 중 and throws the old verdict away, so nothing carries a
  // check that was run against a different picture.
  function saveFinal(finalImage: LocalImage, work?: PainterWork, dialogue?: string, complete = false, motion?: Motion, motionImage?: LocalImage, submitImage?: LocalImage) {
    if (!project || !slot) return;
    let qa: QA;
    try { qa = inspectImage(finalImage, motion ? KAKAO_ANIMATED_SPEC : SPEC); }
    catch { qa = { status: 'WARNING', checkedAt: new Date().toISOString(), checks: [{ label: '자동 검사', status: 'WARNING', detail: '검사를 마치지 못했어요. 다시 저장해 주세요.' }], consistency: [], notes: [] }; }
    // A blank canvas is never a finished cut, whatever the button said.
    const done = complete && (finalImage.metrics?.coverage ?? 0) > 0;
    const id = project.id, number = slot.number;
    try {
      changeProject(id, p => ({ ...p, lastSlot: number, slots: p.slots.map(s => s.number === number ? { ...s, finalImage, work, dialogue: dialogue ?? s.dialogue, qa, done, status: qa.status, motion, motionImage, submitImage } : s) }));
    } catch (e) {
      // The drawing stays in memory and the retry banner will write it. The completion claim does
      // not stand, though: a count must never report something the disk never accepted.
      if (done && current.current) {
        const held = current.current;
        const corrected = { ...held, projects: held.projects.map(p => p.id === id ? { ...p, slots: p.slots.map(s => s.number === number ? { ...s, done: false } : s) } : p) };
        current.current = corrected; setStore(corrected);
        setNotice('저장하지 못해서 완성으로 표시하지 않았어요. 위의 다시 저장을 눌러 주세요.');
      }
      throw e;
    }
    return qa;
  }
  // "완성 · 다음" lands on a cut that is still open, and hands over an empty canvas: copying the
  // last drawing is a separate, explicit action inside the painter.
  function completeAndNext() {
    const latest = current.current?.projects.find(p => p.id === projectId);
    if (!latest || slotNumber === null) return;
    const next = nextUnfinished(latest, slotNumber);
    setGuideHint(null);
    if (next === null) {
      setPainting(false); setSlotNumber(null);
      if (returnToExport) { setScreen('export'); setReturnToExport(false); }
      else { setScreen('board'); setNotice('모든 칸을 완성했어요. 전체를 훑어보고 내보내기로 넘어가세요.'); }
      return;
    }
    setSlotNumber(next);
  }
  // The set reference is a snapshot: it points at the PNG as it was when chosen, so later edits
  // to that cut create a new file and leave this one alone.
  function useAsReference() {
    const latest = current.current?.projects.find(p => p.id === projectId)?.slots.find(s => s.number === slotNumber);
    if (!latest?.finalImage || !((latest.finalImage.metrics?.coverage ?? 0) > 0)) { setNotice('먼저 이 칸에 그림을 그려 주세요.'); return; }
    updateProject(p => ({ ...p, canon: { ...p.canon, image: latest.finalImage } }));
    setNotice('이 칸을 캐릭터 기준으로 정했어요.');
  }
  async function copyPreviousWork(): Promise<CopiedWork | null> {
    const latest = current.current?.projects.find(p => p.id === projectId);
    if (!latest || slotNumber === null) return null;
    const source = previousDrawn(latest, slotNumber);
    if (!source?.work) return null;
    const layers = await Promise.all(source.work.layers.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })));
    return { layers, caption: source.work.caption };
  }

  // 겹치지 않는 기본 이름. 예전부터 쓰던 규칙 그대로다.
  function defaultSetName() {
    const taken = new Set((current.current?.projects ?? []).map(p => p.projectName));
    let name = '새 이모티콘 세트';
    for (let n = 2; taken.has(name); n++) name = `새 이모티콘 세트 ${n}`;
    return name;
  }
  // 실제로 세트를 만들어 1번 칸을 연다. 저장 의미는 예전과 같다(칸 수·기본값 불변).
  function createProjectNow(name: string) {
    const p = createProject(name.trim() || defaultSetName(), '');
    try { commit(s => ({ ...s, projects: [...s.projects, p] })); setNewSetName(null); setProjectId(p.id); setScreen('board'); setSlotNumber(1); setPainting(true); }
    catch (e) { Alert.alert('세트를 만들지 못했어요', userMessage(e)); }
  }
  // 명세 H03: 먼저 이름을 보여 주고 확인을 받는다. 여기서 되돌아가도 빈 세트가 남지 않는다.
  function createNewProject() { setNewSetName(defaultSetName()); }
  // 표현 가이드에서 고른 표현으로 바로 그리러 간다. 새 흐름을 만들지 않고, 이어서 만들기·새 세트 만들기와 같은 길을 쓴다(44.2차).
  // 예시를 함께 고른 경우에도 새 흐름을 만들지 않는다 — 대상 칸을 정하는 길은 예전 그대로다(44.2차).
  function startFromGuide(card: { name: string; hint: string }, example?: ExpressionExample, mode?: 'watch' | 'underlay') {
    setGuideHint(card);
    // 그림이 아직 없는 예시는 가이드 화면에서 고를 수 없으므로 여기까지 오지 않는다.
    const artwork = example?.artwork;
    setGuideExample(example && artwork ? { id: example.id, title: card.name + ' · ' + example.label, hint: example.hint, artwork, display: example.display } : null);
    setGuideExampleMode(example && artwork ? mode ?? 'watch' : null);
    setGuideCard(null);
    setHomeView('home');
    const target = sortedProjects[0];
    if (!target) { createProjectNow(defaultSetName()); return; }
    const open = nextUnfinished(target, target.lastSlot ?? 0);
    setProjectId(target.id); setScreen('board');
    // 칸이 다 찬 세트에서는 완성한 칸을 대신 열지 않는다 — 보드를 보여 주고 고를 사람에게 맡긴다(45.1차).
    if (open === null) { setGuideHint(null); setGuideExample(null); setGuideExampleMode(null); setNotice('이 세트는 칸이 다 찼어요. 고칠 칸을 고르거나 새 이모티콘 세트를 만들어 주세요.'); return; }
    setSlotNumber(open); setPainting(true);
  }
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  function startFromImage() {
    void task('그림을 여는 중…', async () => {
      const picked = await pickImages();
      if (!picked[0]) return;
      const data = await dataUrl(picked[0]);
      const p = createProject(defaultSetName(), '');
      commit(s => ({ ...s, projects: [...s.projects, p] }));
      setPendingImport(data); setProjectId(p.id); setScreen('board'); setSlotNumber(1); setPainting(true);
    });
  }
  function drawFrom(number?: number) {
    if (!project) return;
    const target = number ?? nextUnfinished(project, project.lastSlot ?? 0) ?? project.lastSlot ?? 1;
    setScreen('board'); setSlotNumber(target); setPainting(true);
  }
  function deleteProject(id: string) {
    const target = current.current?.projects.find(p => p.id === id);
    if (!target) return;
    try { commit(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) })); }
    catch (e) { Alert.alert('삭제하지 못했어요', userMessage(e)); return; }
    if (id === projectId) { setProjectId(null); setSlotNumber(null); setCanonOpen(false); }
    setConfirmDeleteId(null); setManageId(null);
    setNotice(`${target.projectName} 세트를 삭제했어요.`);
  }
  // A movement someone liked is kept at the store level, so it can be opened again from any cut of
  // any set. The name is made from the settings themselves: nobody has to invent one mid-drawing.
  function motionName(motion: Motion) {
    const preset = PRESETS.find(p => p.id === motion.preset)?.label;
    const parts = motion.parts?.length ? `부분 ${motion.parts.length}` : null;
    const pose = motion.alternate ? '두 모습' : null;
    return [preset, parts, pose].filter(Boolean).join(' · ') || '움직임';
  }
  function saveMotion(motion: Motion) {
    const kept = store?.savedMotions ?? [];
    const body = JSON.stringify(motion);
    if (kept.some(s => JSON.stringify(s.motion) === body)) { setNotice('같은 움직임이 이미 보관되어 있어요.'); return; }
    const base = motionName(motion);
    const same = kept.filter(s => s.name === base || s.name.startsWith(base + ' (')).length;
    const saved: SavedMotion = { id: 'm-' + Date.now().toString(36), name: same ? `${base} (${same + 1})` : base, motion };
    try { commit(s => ({ ...s, savedMotions: [saved, ...(s.savedMotions ?? [])].slice(0, 12) })); setNotice(`${saved.name} 움직임을 보관했어요.`); }
    catch (e) { setNotice('움직임을 보관하지 못했어요. ' + userMessage(e)); }
  }
  const EXTRA_FRAMES = { icon: { width: 78, height: 78 }, share: { width: 600, height: 166 } } as const;
  async function makeExtra() {
    if (!project || extraSlot === null) return;
    const slot = project.slots.find(s => s.number === extraSlot);
    if (!slot?.finalImage) { setNotice('그림이 있는 칸을 골라 주세요.'); return; }
    if (extraKind === 'cover') {
      // 대표 이미지는 새로 만드는 그림이 아니라 고르는 것이다 — 가이드가 그렇게 정했다.
      changeProject(project.id, p => ({ ...p, extras: { ...p.extras, coverSlot: extraSlot } }));
      setNotice(`${pad(extraSlot)}번을 대표 이미지로 정했어요.`);
      return;
    }
    const frame = EXTRA_FRAMES[extraKind];
    await task('부가 이미지를 만드는 중…', async () => {
      const source = await dataUrl(slot.finalImage!);
      const data = await composer.current!.compose(source, frame, place, null);
      const image = saveCutout(data);
      changeProject(project.id, p => ({ ...p, extras: { ...p.extras, [extraKind]: image } }));
      setNotice(`${extraKind === 'icon' ? '아이콘' : '공유'} 이미지를 만들었어요. 원본 ${pad(extraSlot)}번은 그대로예요.`);
    });
  }
  function keepCutout(data: string) {
    const image = saveCutout(data);
    const kept = store?.cutouts ?? [];
    const name = `보관한 그림 ${kept.length + 1}`;
    try {
      commit(s => ({ ...s, cutouts: [{ id: 'cut-' + Date.now().toString(36), name, image }, ...(s.cutouts ?? [])].slice(0, 40) }));
      return name;
    } catch (e) { setNotice('그림을 보관하지 못했어요. ' + userMessage(e)); return null; }
  }
  function forgetCutout(id: string) {
    try { commit(s => ({ ...s, cutouts: (s.cutouts ?? []).filter(c => c.id !== id) })); }
    catch (e) { setNotice('보관을 지우지 못했어요. ' + userMessage(e)); }
  }
  function forgetMotion(id: string) {
    try { commit(s => ({ ...s, savedMotions: (s.savedMotions ?? []).filter(saved => saved.id !== id) })); }
    catch (e) { setNotice('보관을 지우지 못했어요. ' + userMessage(e)); }
  }
  function rememberColor(color: string) {
    try { commit(s => ({ ...s, palette: [color, ...(s.palette ?? []).filter(c => c !== color)].slice(0, 8) })); } catch { /* colour history is a convenience, never a blocker */ }
  }
  // 내 팔레트에 새 색을 넣는 것은 PRO다. 화면이 잠가 두지만 여기서도 한 번 더 막는다 — 권한 판단은 한 곳에 모인다.
  // 이미 모아 둔 색을 쓰거나 지우는 것은 PRO가 끝나도 막지 않는다(만든 것은 회수하지 않는다).
  function saveUserColor(color: string) {
    try { commit(s => ({ ...s, userPalette: [color, ...(s.userPalette ?? []).filter(c => c.toUpperCase() !== color.toUpperCase())].slice(0, 24) })); }
    catch (e) { setNotice('내 팔레트에 저장하지 못했어요. ' + userMessage(e)); }
  }
  function removeUserColor(color: string) {
    try { commit(s => ({ ...s, userPalette: (s.userPalette ?? []).filter(c => c.toUpperCase() !== color.toUpperCase()) })); }
    catch (e) { setNotice('내 팔레트에서 지우지 못했어요. ' + userMessage(e)); }
  }
  // Deterministic set-level checks over the saved files themselves. Everything here works offline,
  // and nothing here is a judgement about the artwork: those belong to the person drawing it.
  const pad = (n: number) => String(n).padStart(2, '0');
  const setChecks: Check[] = !project || screen !== 'export' ? [] : [
    ...(() => {
      const missing = project.slots.filter(s => !isDone(s)).length;
      return missing ? [{ label: '남은 칸', status: (missing === SPEC.count ? 'FAIL' : 'WARNING') as Check['status'], detail: `${missing}칸이 아직 완성되지 않았어요.` }] : [];
    })(),
    ...project.slots.filter(s => s.finalImage && (s.finalImage.width !== SPEC.width || s.finalImage.height !== SPEC.height))
      .map(s => ({ label: `${pad(s.number)}번 크기`, status: 'FAIL' as const, detail: `${SPEC.width}×${SPEC.height}가 아니에요. 이 칸을 다시 저장하면 맞춰져요.`, slot: s.number })),
    ...project.slots.filter(s => s.finalImage && s.finalImage.metrics && !s.finalImage.metrics.transparent)
      .map(s => ({ label: `${pad(s.number)}번 배경`, status: 'FAIL' as const, detail: '배경이 투명하지 않아요.', slot: s.number })),
    ...identicalFinals(project).map(group => ({ label: '같은 그림', status: 'WARNING' as const, detail: `${group.map(pad).join(', ')}번 파일이 완전히 같아요. 그대로 둘지 직접 판단해 주세요.`, slot: group[1] })),
    ...duplicateCaptions(project.slots).map(group => ({ label: '겹친 문구', status: 'WARNING' as const, detail: `${group.map(pad).join(', ')}번 문구가 같아요.`, slot: group[1] })),
    ...project.slots.filter(s => s.finalImage && s.qa?.status === 'FAIL').map(s => ({ label: `${pad(s.number)}번 검사`, status: 'FAIL' as const, detail: '자동 검사에서 문제가 나왔어요.', slot: s.number })),
  ];
  // A purchase only ever lands here, and only after the store and our receipt server both said yes.
  async function startPurchase() {
    setPayment({ phase: 'buying' });
    settlePayment(await purchase(), 'bought');
  }
  async function restorePro() {
    setPayment({ phase: 'restoring' });
    settlePayment(await restore(), 'restored');
  }
  function settlePayment(outcome: PurchaseOutcome, success: 'bought' | 'restored') {
    if (outcome.state === 'purchased') {
      try { commit(st => ({ ...st, entitlement: outcome.entitlement })); setPayment({ phase: success }); }
      catch { setPayment({ phase: 'failed', problem: 'save' }); }
      return;
    }
    if (outcome.state === 'failed') { setPayment({ phase: 'failed', problem: outcome.problem }); return; }
    setPayment({ phase: outcome.state });
  }
  // Applying one movement to several cuts. Each cut is rebuilt for real — a cut the board calls
  // moving must ship a moving file — and each one reports for itself, so a failure in the middle
  // never looks like a success and never touches the cuts that did work.
  async function applyMotionToMany(motion: Motion, numbers: number[], replace = true) {
    if (!project || !numbers.length) return;
    // 여러 칸 한 번에는 PRO 다. 입구에서 이미 PRO 안내로 가지만, 여기서도 한 번 더 막는다.
    if (!pro) { setProSheet(true); return; }
    const id = project.id;
    setBatchResults([]);
    await task(`${numbers.length}칸에 적용하는 중…`, async () => {
      const done: number[] = [], failed: { number: number; reason: string }[] = [];
      for (const number of numbers) {
        const slot = current.current?.projects.find(p => p.id === id)?.slots.find(s => s.number === number);
        if (!slot?.work) { failed.push({ number, reason: '아직 그림이 없어요' }); continue; }
        if (!replace && slot.motion) { failed.push({ number, reason: '이미 있는 움직임을 그대로 두었어요' }); continue; }
        try {
          const loop = await baker.current!.bake(slot.work, motion);
          const motionImage = saveMotionLoop(loop.data);
          // 제출 형식도 이 자리에서 다시 만든다. 새 움직임만 넣고 WebP 를 그대로 두면 묶음에는
          // 예전 움직임의 WebP 가 실려 나간다 — 화면은 새 움직임을 보여 주면서.
          let submitImage: LocalImage | undefined;
          if (loop.webp) { try { submitImage = saveSubmitLoop(loop.webp); } catch { submitImage = undefined; } }
          const qa = inspectImage(slot.finalImage, KAKAO_ANIMATED_SPEC);
          changeProject(id, p => ({ ...p, slots: p.slots.map(s => s.number === number ? { ...s, motion, motionImage, submitImage, qa, status: qa.status } : s) }));
          done.push(number);
        } catch (e) { failed.push({ number, reason: userMessage(e) }); }
      }
      setBatchResults([...done.map(number => ({ number, ok: true as const })), ...failed.map(f => ({ number: f.number, ok: false as const, reason: f.reason }))]);
      setNotice(failed.length ? `${done.length}칸에 적용했고 ${failed.length}칸은 실패했어요. 실패한 칸만 다시 시도할 수 있어요.` : `${done.length}칸에 같은 움직임을 적용했어요.`);
    });
  }
  async function previewOnOne(motion: Motion, number: number) {
    const slot = current.current?.projects.find(p => p.id === projectId)?.slots.find(s => s.number === number);
    if (!slot?.work) { setNotice(`${pad(number)}번은 아직 그림이 없어 미리 만들어 볼 수 없어요.`); return; }
    setPreviewing(true);
    try {
      const loop = await baker.current!.bake(slot.work, motion);
      setBatchPreview({ number, data: loop.data, loop: loop.loop, bytes: loop.bytes });
    } catch (e) { setNotice('미리보기를 만들지 못했어요. ' + userMessage(e)); }
    finally { setPreviewing(false); }
  }
  // Stepping through the finished cuts. A moving cut plays its own loop; a still one holds.
  useEffect(() => {
    if (!playing || !project) return;
    const made = project.slots.filter(s => s.finalImage);
    if (made.length < 2) { setPlaying(false); return; }
    const timer = setInterval(() => setPlayIndex(i => (i + 1) % made.length), 900);
    return () => clearInterval(timer);
  }, [playing, project?.id, project?.slots.filter(s => s.finalImage).length]);
  function moveSlot(from: number, to: number) { updateProject(p => reorderSlots(p, from, to)); }
  function fixSlot(number: number) { setReturnToExport(true); setScreen('board'); setSlotNumber(number); setPainting(true); }
  // 공식 도구(WebPAnimator)에 넣을 PNG 프레임을 **지금** 만든다. 저장할 때마다 만들어 두면
  // 자동저장이 매번 24장을 다리 너머로 보내고 파일로 쓰게 되고, 그림이나 움직임을 고친 뒤에도
  // 옛 프레임이 남아 지금 작품과 다른 것이 묶음에 섞인다. 여기서 만들면 둘 다 생기지 않는다.
  // 한 칸을 만들지 못해도 나머지는 그대로 내보내고, 만들지 못한 칸을 이름으로 알려 준다.
  async function bakeHandoff(target: Project): Promise<{ handoff: HandoffFrames[]; failed: number[] }> {
    const handoff: HandoffFrames[] = [], failed: number[] = [];
    for (const slot of target.slots) {
      if (!slot.work || !slot.motion || !isAnimated(slot)) continue;
      try {
        const loop = await baker.current!.bake(slot.work, slot.motion, true);
        const frames = (loop.sheets ?? []).map(decodeDataUrl);
        if (frames.length) handoff.push({ number: slot.number, frames, delayMs: loop.delayMs });
        else failed.push(slot.number);
      } catch { failed.push(slot.number); }
    }
    return { handoff, failed };
  }
  function exportProject() {
    if (!project) return;
    // 화면·약속 문구는 모두 '파일 묶음'이다(38차). 움직이는 칸은 카카오 WebPAnimator 에서 마무리하므로
    // 앱이 '제출 파일'을 만들어 준다고 말하지 않는다 — PRO 화면의 무료 약속과 같은 말을 쓴다.
    void task('파일 묶음 만드는 중…', async () => {
      const { handoff, failed } = await bakeHandoff(project);
      const result = exportSet(project, handoff);
      setLastExport({ path: result.path, count: result.count });
      setHandoffCuts(handoff.map(cut => ({ number: cut.number, count: cut.frames.length, delayMs: cut.delayMs })));
      const short = failed.length ? ` ${failed.map(pad).join(', ')}번은 WebPAnimator용 프레임을 넣지 못했어요.` : '';
      const made = (result.missing ? `${result.count}칸으로 파일 묶음을 만들었어요. ${result.missing}칸은 아직 비어 있어요.` : `${result.count}칸 전체로 파일 묶음을 만들었어요.`) + short;
      if (!await Sharing.isAvailableAsync()) { setNotice(`${made} 이 기기에서는 공유 창을 열 수 없어요.`); return; }
      await Sharing.shareAsync(exportUri(result.path), { mimeType: 'application/zip', UTI: 'public.zip' });
      // A share sheet that opened is not a file that arrived. Say only what we know.
      setNotice(`${made} 공유 창에서 저장할 곳을 골라 주세요.`);
    });
  }
  function shareAgain() {
    if (!lastExport) return;
    void task('다시 공유하는 중…', async () => {
      if (!await Sharing.isAvailableAsync()) { setNotice(`저장 위치: ${lastExport.path}`); return; }
      await Sharing.shareAsync(exportUri(lastExport.path), { mimeType: 'application/zip', UTI: 'public.zip' });
    });
  }
  const managed = store?.projects.find(p => p.id === manageId);
  const pendingDelete = store?.projects.find(p => p.id === confirmDeleteId);
  // 최근에 손댄 세트가 먼저. 홈은 앞의 넷만, 나머지는 '전체 작업'에서 찾는다 — 세트가 100개여도 홈 길이는 같다.
  const sortedProjects = store ? [...store.projects].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')) : [];
  // 홈은 프로젝트 관리 화면이 아니라 시작 화면이다(45.5차): 가장 최근 세트 하나만 두고, 나머지는 전체 작업에서 관리한다.
  const HOME_RECENT = 1;
  const setMeta = (p: Project) => { const when = new Date(p.updatedAt); return { moving: setIsAnimated(p), done: doneCount(p), working: p.slots.filter(isWorking).length, stamp: Number.isFinite(when.getTime()) ? `${when.getMonth() + 1}월 ${when.getDate()}일` : '' }; };
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><StatusBar style="dark" /><ImageAnalyzer ref={analyzer} /><MotionBaker ref={baker} /><ExtraComposer ref={composer} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {project && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, minHeight: 56, backgroundColor: C.bg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" disabled={!!busy} onPress={back} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="chevron-left" size={28} color={C.ink} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 20, lineHeight: 27, color: C.ink, fontWeight: '800', letterSpacing: -.2 }}>{canonOpen ? '캐릭터 기준' : screen === 'export' ? '내보내기' : screen === 'batch' ? '움직임 한 번에 적용' : screen === 'extras' ? '부가 이미지' : project.projectName}</Text>
          {(canonOpen || screen !== 'board') && <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{project.projectName}</Text>}
        </View>
        {screen === 'board' && !canonOpen && <Pressable accessibilityRole="button" accessibilityLabel="세트 메뉴" disabled={!!busy} onPress={() => setMenu(true)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={24} color={C.ink} /></Pressable>}
      </View>}
      {!!busy && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 }}><MaterialCommunityIcons name="timer-sand" size={15} color={C.muted} /><Text style={{ fontSize: 12, color: C.muted }}>{busy}</Text></View>}
      {!!saveError && <View style={{ margin: 12, padding: 12, gap: 8, borderRadius: T.radius.md, backgroundColor: T.dangerSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name="content-save-alert-outline" size={20} color={T.danger} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.ink }}>변경 내용을 아직 저장하지 못했어요</Text>
        </View>
        <Text style={{ fontSize: 12, color: C.ink, lineHeight: 18 }}>작업은 화면에 그대로 있어요. 다시 저장을 눌러 주세요.</Text>
        <Action primary title="다시 저장" onPress={() => { try { commit(s => s); } catch {} }} />
      </View>}
      <ScrollView pointerEvents={busy ? 'none' : 'auto'} key={`${projectId}/${slotNumber}/${canonOpen}/${screen}/${homeView}`} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, !project && !loadError && { flexGrow: 1 }]}>
        {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={() => setNotice('')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, paddingVertical: 10, paddingHorizontal: 14, borderRadius: T.radius.md, backgroundColor: C.paper, ...Elev[1] }}>
          <MaterialCommunityIcons name="information-outline" size={18} color={C.muted} />
          <Text style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 19 }}>{notice}</Text>
          <MaterialCommunityIcons name="close" size={18} color={C.muted} />
        </Pressable>}
        {loadError ? <>
          <View style={[styles.card, { gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: T.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="file-alert-outline" size={22} color={T.danger} />
              </View>
              <Text style={[styles.subtitle, { flex: 1 }]}>저장 파일을 열지 못했어요</Text>
            </View>
            <Text style={{ fontSize: 16, color: C.ink, lineHeight: 21 }}>작품 파일은 그대로 있어요. <Text style={{ fontWeight: '800' }}>앱을 지우거나 저장 데이터를 삭제하지 마세요.</Text></Text>
            <Action primary title="다시 불러오기" onPress={load} />
          </View>
          {/* 문의할 때만 쓰는 길. 기술 정보를 화면에 늘어놓지 않고, 저장 파일 사본을 그대로 보낼 수 있게만 한다. */}
          <Pressable accessibilityRole="button" accessibilityLabel={diagOpen ? '문의용 파일 접기' : '문의용 파일 보내기'} accessibilityState={{ expanded: diagOpen }} onPress={() => setDiagOpen(!diagOpen)}
            style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>문의용 파일 보내기</Text>
            <MaterialCommunityIcons name={diagOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
          </Pressable>
          {!!report && diagOpen && <View testID="문의용 파일" style={[styles.card, { gap: 8 }]}>
            {report.snapshots.map((file, i) => file.exists ? <Action key={file.name} title={`저장 사본 ${i + 1} 보내기`} icon="share-variant" disabled={!!busy} onPress={() => shareSnapshot(file.name)} /> : null)}
            {!report.snapshots.some(file => file.exists) && <Text style={{ fontSize: 12, color: C.muted }}>보낼 저장 파일이 없어요.</Text>}
          </View>}
        </> : !store ? <Text style={{ fontSize: 13, color: C.muted }}>불러오는 중…</Text> : !project && homeView === 'all' ? <>
          {/* 전체 작업(44차): 여러 이모티콘 세트를 찾고 다시 여는 곳. 한 줄 목록 — 세트 안 24/32칸은 보드가 맡는다. 폴더·태그·필터 없음. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, marginTop: -4, marginLeft: -8 }}>
            <IconButton label="홈으로" icon="chevron-left" color={C.ink} onPress={() => setHomeView('home')} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>전체 작업</Text>
            <Text style={{ fontSize: 12, color: C.faint }}>{sortedProjects.length}개 세트</Text>
          </View>
          <View testID="전체 작업 목록" style={{ borderRadius: T.radius.card, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            {sortedProjects.map((p, i) => {
              const m = setMeta(p), cover = p.slots.find(s => s.finalImage);
              return <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} onPress={() => { setProjectId(p.id); setScreen('board'); }}
                  style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, opacity: pressed ? .6 : 1 })}>
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {cover ? <Image source={{ uri: imageUri((cover.motionImage ?? cover.finalImage)!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <MaterialCommunityIcons name="draw" size={20} color={C.lineStrong} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{p.projectName}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: C.faint }}>{m.moving ? '움직이는' : '멈춰있는'} · {m.done}개 완성{m.stamp ? ` · ${m.stamp}` : ''}</Text>
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.projectName} 관리`} onPress={() => setManageId(p.id)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={22} color={C.faint} /></Pressable>
              </View>;
            })}
          </View>
        </> : !project && homeView === 'guide' ? <>
          {/* 표현 가이드(44차): "무엇을 그릴까?". 분류 → 표현 카드(그림 자리 · 이름 · 짧은 몸짓 힌트). 긴 설명·대화형·생성 없음.
              "어떻게 그릴까?"는 그리기 화면 › 참고 › 기본 레퍼런스가 맡는다. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, marginTop: -4, marginLeft: -8 }}>
            <IconButton label={guideCard ? '표현 가이드로' : '홈으로'} icon="chevron-left" color={C.ink} onPress={() => guideCard ? setGuideCard(null) : setHomeView('home')} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{guideCard ? guideCard.name : '표현 가이드'}</Text>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.muted, marginTop: -8 }}>{guideCard ? '같은 말도 표정과 자세에 따라 달라져요' : '어떤 마음인가요?'}</Text>
          {!guideCard && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingVertical: 4 }} style={{ marginHorizontal: -16, flexGrow: 0 }}>
            <View style={{ width: 10 }} />
            {EXPRESSION_GUIDE.categories.map(name => { const on = guideCategory === name;
              return <Pressable key={name} accessibilityRole="button" accessibilityLabel={'표현 가이드 ' + name} accessibilityState={{ selected: on }} onPress={() => setGuideCategory(name)}
                hitSlop={{ top: 4, bottom: 4 }}
                style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? C.ink : C.surface2 }}>
                <Text style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? C.paper : C.muted }}>{name}</Text>
              </Pressable>; })}
            <View style={{ width: 10 }} />
          </ScrollView>}
          {/* G02 표현 선택: 2열 격자에서 하나를 고르고, 고른 뒤에 행동한다(고르기만으로 편집에 들어가지 않는다). */}
          {!!guideCard && (() => {
            const list = guideCard.examples ?? [];
            const cell = Math.floor((screenWidth - 32 - 12) / 2);
            const picked = list.find(x => x.id === guidePick) ?? null;
            const ready = !!picked?.artwork;
            return <>
              <View testID="표현 예시 목록" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {list.map(x => { const on = x.id === guidePick, has = !!x.artwork;
                  return <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`${x.label} 고르기`}
                    accessibilityState={{ selected: on, disabled: !has }} disabled={!has}
                    onPress={() => setGuidePick(x.id)}
                    style={({ pressed }) => ({ width: cell, padding: 8, gap: 6, borderRadius: 16, backgroundColor: pressed ? C.fill : C.paper,
                      borderWidth: on ? 2 : 1, borderColor: on ? C.ink : C.line, opacity: has ? 1 : .55 })}>
                    <View style={{ width: cell - 18, height: cell - 18, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <AssetSlot name="expressionGuideArtwork" size={Math.round((cell - 18) * .84)} sourceOverride={shownArt(x)} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2, paddingBottom: 2 }}>
                      {on && <MaterialCommunityIcons name="check" size={15} color={C.ink} />}
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: on ? '800' : '700', color: has ? C.ink : C.faint }}>{x.label}</Text>
                    </View>
                    {!has && <Text style={{ paddingHorizontal: 2, fontSize: 11, color: C.faint }}>그림 준비 중이에요</Text>}
                  </Pressable>; })}
              </View>
              {/* 고른 표현의 설명과 두 행동. 고르기 전에는 눌리지 않는다. */}
              <View testID="표현 고른 뒤" style={{ gap: 10, marginTop: 4 }}>
                <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 19, color: picked ? C.ink : C.muted }}>
                  {picked ? picked.hint : '표현을 골라 주세요'}
                </Text>
                {guideTip && <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>참고는 옆에 두고 보고, 밑그림은 캔버스에 겹쳐 놓고 그려요</Text>}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="참고 보기" accessibilityState={{ disabled: !ready }} disabled={!ready}
                    onPress={() => { guideTipShown = true; startFromGuide(guideCard!, picked!, 'watch'); }}
                    style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: pressed ? C.fill : C.paper, borderWidth: 1, borderColor: ready ? C.lineStrong : C.line, opacity: ready ? 1 : .5 })}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: ready ? C.ink : C.faint }}>참고 보기</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="밑그림 넣기" accessibilityState={{ disabled: !ready }} disabled={!ready}
                    onPress={() => { guideTipShown = true; startFromGuide(guideCard!, picked!, 'underlay'); }}
                    style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: !ready ? C.fill : pressed ? C.accentSoft : C.accent, opacity: ready ? 1 : .6 })}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: ready ? C.accentInk : C.faint }}>밑그림 넣기</Text>
                  </Pressable>
                </View>
              </View>
            </>;
          })()}
          {!guideCard && (() => {
            const cardWidth = Math.floor((screenWidth - 32 - 12) / 2), frame = cardWidth - 20;
            const cards = EXPRESSION_GUIDE.cards.filter(c => c.category === guideCategory);
            return cards.length
              ? <View testID="표현 가이드 카드" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {cards.map(c => { const count = c.examples?.length ?? 0;
                    // 대표 그림은 이 감정의 예시 중 cover 가 가리키는 것을 그대로 쓴다(카드 전용 그림이 오면 artwork 가 먼저다).
                    const cover = c.artwork ?? shownArt(c.examples?.find(x => x.id === c.cover)) ?? null;
                    return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} · ${c.hint}`} onPress={() => { c.examples?.length ? setGuideCard(c) : startFromGuide(c); }}
                    style={({ pressed }) => ({ width: cardWidth, padding: 10, gap: 8, borderRadius: T.radius.card, backgroundColor: pressed ? C.fill : C.paper, borderWidth: 1, borderColor: C.line })}>
                    <View style={{ width: frame, height: frame, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <AssetSlot name="expressionGuideArtwork" size={Math.round(frame * .8)} sourceOverride={cover} />
                    </View>
                    <View style={{ gap: 2, paddingHorizontal: 2, paddingBottom: 2 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{c.name}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{count ? count + '가지 표현' : '준비 중'}</Text>
                    </View>
                  </Pressable>; })}
                </View>
              : <Text style={{ paddingVertical: 24, textAlign: 'center', fontSize: 13, color: C.muted }}>이 분류에는 아직 표현이 없어요</Text>;
          })()}
        </> : !project ? <>
          {/* 머리: 브랜드가 먼저. PRO 는 작은 배지, 설정은 작은 아이콘. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, marginTop: -4 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
                <MaterialCommunityIcons name="draw" size={16} color={C.accentInk} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: screenWidth < 360 ? 20 : 22, fontWeight: '800', color: C.ink, letterSpacing: -.6 }}>임티제작소</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="PRO 보기" onPress={() => setProSheet(true)} style={{ minHeight: 48, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pro ? C.ink : C.paper, borderWidth: pro ? 0 : 1, borderColor: C.line }}>
                <MaterialCommunityIcons name="star-four-points" size={12} color={pro ? C.paper : C.muted} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: pro ? C.paper : C.muted }}>{pro ? 'PRO' : 'PRO 보기'}</Text>
              </View>
            </Pressable>
            <IconButton label="설정" icon="cog-outline" color={C.muted} onPress={() => setSettings(true)} />
          </View>
          {/* 45.2차 홈 순서: 시작 → [세트가 없을 때 자리] → [공지 켜졌을 때] → 표현 가이드 → 최근 작업. 세트 수와 공지 상태가 순서를 바꾸지 않는다. */}
          {/* 명세 H01/H02 — 작업이 있으면 '이어서 만들기'가 맨 위에 오고, 소개용 큰 표면은 두지 않는다.
              작업이 없을 때만 창작 표면이 첫 화면을 맡는다(빈 최근 작업 카드·0% 진행바는 만들지 않는다). */}
          {!!sortedProjects.length && <Text style={[Type.sectionTitle, { marginTop: 2 }]}>이어서 만들기</Text>}
          {!!sortedProjects.length && <View style={{ gap: 12 }}>
            {sortedProjects.slice(0, HOME_RECENT).map(p => {
              const drawn = p.slots.filter(s => s.finalImage);
              const done = doneCount(p);
              const working = p.slots.filter(isWorking).length;
              const moving = setIsAnimated(p);
              const when = new Date(p.updatedAt);
              const stamp = Number.isFinite(when.getTime()) ? `${when.getMonth() + 1}월 ${when.getDate()}일` : '';
              return <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} key={p.id} onPress={() => { setProjectId(p.id); setScreen('board'); }}
                style={({ pressed }) => ({ backgroundColor: C.paper, borderRadius: T.radius.card, padding: 12, gap: 12, borderWidth: 1, borderColor: pressed ? C.lineStrong : C.line, ...Elev[1] })}>
                {/* 세트의 실제 칸 네 개가 주인공. 더 있으면 마지막 칸에 남은 수를 얹는다. 빈 세트는 첫 칸 자리에 연필 표시. */}
                <View testID="홈 작품 미리보기" style={{ flexDirection: 'row', gap: 6 }}>
                  {[0, 1, 2, 3].map(i => {
                    const s = drawn[i], more = i === 3 && drawn.length > 4;
                    return <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      {s ? <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage)!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        : i === drawn.length ? <MaterialCommunityIcons name="draw" size={22} color={C.lineStrong} /> : null}
                      {more && <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#1717178C', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>+{drawn.length - 3}</Text></View>}
                    </View>;
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 22, color: C.ink, fontWeight: '700' }}>{p.projectName}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: C.faint }}>{moving ? '움직이는 이모티콘' : '멈춰있는 이모티콘'}{stamp ? ` · ${stamp}` : ''}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${p.projectName} 관리`} onPress={() => setManageId(p.id)} hitSlop={6} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={22} color={C.faint} /></Pressable>
                </View>
                <View style={{ gap: 8, paddingHorizontal: 4 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: C.surface2, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, done / p.slots.length * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: C.accent }} /></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
                    <Text style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: '600' }}><Text style={{ color: C.ink, fontWeight: '700' }}>{done}개 완성</Text>{working ? ` · ${working}개 작업 중` : ''}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${p.projectName} 이어서 만들기`} onPress={() => { setProjectId(p.id); setScreen('board'); setSlotNumber(nextUnfinished(p, p.lastSlot ?? 0) ?? p.lastSlot ?? 1); setPainting(true); }}
                      hitSlop={{ top: 2, bottom: 2 }} style={{ minHeight: 44, justifyContent: 'center' }}>
                      {/* 카드를 누르면 세트가 열린다 — 이 줄은 그 안의 지름길이라 더 조용하다(45.2차). */}
                      <View style={{ height: 34, paddingLeft: 10, paddingRight: 6, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{done || working ? '이어서 만들기' : '그리기 시작'}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={C.muted} />
                      </View>
                    </Pressable>
                  </View>
                </View>
              </Pressable>;
            })}
            </View>}
          {/* 작업이 있을 때의 시작 줄: 큰 표면 대신 조용한 두 버튼. */}
          {!!sortedProjects.length && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Action primary compact icon="plus" title="새 이모티콘 만들기" onPress={createNewProject} />
            <Action variant="ghost" icon="image-outline" title="내 그림으로 시작" disabled={!!busy} onPress={startFromImage} />
          </View>}
          {!sortedProjects.length && <>
          {/* 첫 행동: 창작 표면. 에셋이 없어도 구성이 완성돼 보이고, 오른쪽 자리에 나중에 캐릭터가 앉는다. */}
          <View testID="홈 창작 표면" style={{ borderRadius: T.radius.card, backgroundColor: C.warm, borderWidth: 1, borderColor: C.warmLine, overflow: 'hidden', padding: 20, paddingRight: 16, minHeight: 184, ...Elev[1] }}>
            <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -56, width: 190, height: 190, borderRadius: 95, backgroundColor: '#FFEBA6', opacity: .6 }} />
            <View pointerEvents="none" style={{ position: 'absolute', right: 70, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: '#FFF4CF' }} />
            {/* 그림 자리는 오른쪽 위. 아래 행동 줄(새 이모티콘 만들기 · 내 그림으로 시작)과 겹치지 않는다(40차 실기기 캡처에서 겹침 발견). */}
            <AssetSlot name="homeHeroArtwork" size={screenWidth < 380 ? 96 : 112} style={{ position: 'absolute', right: 14, top: 16 }} />
            <View style={{ maxWidth: screenWidth < 380 ? 200 : 230, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.warmInk, letterSpacing: .2 }}>나만의 이모티콘 작업실</Text>
              <Text style={{ fontSize: screenWidth < 360 ? 20 : 22, lineHeight: screenWidth < 360 ? 28 : 30, fontWeight: '800', color: C.ink, letterSpacing: -.5 }}>{'오늘의 표정을\n그려 볼까요?'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16 }}>
              <Action primary compact icon="plus" title="새 이모티콘 만들기" onPress={createNewProject} />
              <Action variant="ghost" icon="image-outline" title="내 그림으로 시작" disabled={!!busy} onPress={startFromImage} />
            </View>
          </View>
          </>}
          {/* 공지/이벤트: 켤 때만 한 줄 배너(그림 자리 · 제목 · 짧은 정보 · 넘어가기 하나). 꺼져 있으면 자리도 간격도 0. */}
          {noticeOn && (() => {
            const body = <>
              <AssetSlot name="noticeArtwork" size={44} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{HOME_NOTICE.title}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 17, color: C.muted }}>{HOME_NOTICE.body}</Text>
              </View>
              {!!HOME_NOTICE.link && <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />}
            </>;
            const row = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: T.radius.card, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line } as const;
            // 넘어갈 곳이 있을 때만 누를 수 있는 줄이 된다. 행동은 최대 하나다.
            return HOME_NOTICE.link
              ? <Pressable testID="홈 알림" accessibilityRole="button" accessibilityLabel={HOME_NOTICE.title}
                  onPress={() => { Linking.openURL(HOME_NOTICE.link!).catch(() => setNotice('링크를 열지 못했어요.')); }}
                  style={({ pressed }) => ({ ...row, backgroundColor: pressed ? C.fill : C.paper })}>{body}</Pressable>
              : <View testID="홈 알림" style={row}>{body}</View>;
          })()}
          {/* 주요 기능 진입: 표현 가이드 한 줄. 노랑을 쓰지 않는 조용한 줄 — 홈의 노랑 버튼은 '새 이모티콘 만들기' 하나. */}
          <Pressable accessibilityRole="button" accessibilityLabel="표현 가이드" onPress={() => setHomeView('guide')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, borderRadius: T.radius.card, backgroundColor: pressed ? C.fill : C.paper, borderWidth: 1, borderColor: C.line })}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>표현 가이드</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>무엇을 그릴지 막막할 때</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />
          </Pressable>
          {/* 가이드가 무엇을 주는지 그림으로 한 번에 보인다. 기존 예시 셋을 서로 다른 보조색 위에 올린다. */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: -4 }}>
            {HOME_GUIDE_PREVIEW.map((id, i) => {
              const card = EXPRESSION_GUIDE.cards.find(c => c.id === id);
              return <Pressable key={id} accessibilityRole="button" accessibilityLabel={(card?.name ?? '') + ' 표현 보기'}
                onPress={() => { if (card?.examples?.length) { setHomeView('guide'); setGuideCategory(card.category); setGuideCard(card); } else setHomeView('guide'); }}
                style={({ pressed }) => ({ flex: 1, aspectRatio: 1, borderRadius: 16, backgroundColor: PREVIEW_TINT[i], alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? .8 : 1 })}>
                <AssetSlot name="expressionGuideArtwork" size={56} sourceOverride={card ? coverOf(card) : null} />
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{card?.name ?? ''}</Text>
              </Pressable>;
            })}
          </View>
          {sortedProjects.length > HOME_RECENT && <Pressable accessibilityRole="button" accessibilityLabel="전체 작업 보기" onPress={() => setHomeView('all')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52, borderRadius: 12, backgroundColor: pressed ? C.fill : 'transparent' })}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.muted }}>전체 세트 보기 {sortedProjects.length}</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={C.muted} />
          </Pressable>}
        </> : canonOpen ? <>
          {(() => {
            const pickReference = () => task('그림을 여는 중…', async () => { const images = await pickImages(); if (!images[0]) return; updateProject(p => ({ ...p, canon: { ...p.canon, image: images[0] } })); });
            const memo = ([['personality', '성격'], ['speech', '말투'], ['locked', '꼭 유지할 특징'], ['variable', '바꿔도 되는 특징']] as const).filter(([key]) => project.canon[key].trim());
            return <>
              <View style={{ flexDirection: 'row', gap: T.gap.md, alignItems: 'center' }}>
                <View style={{ width: 116, height: 116, borderRadius: T.radius.lg, backgroundColor: project.canon.image ? C.bg : C.paper, borderWidth: 1, borderStyle: project.canon.image ? 'solid' : 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {project.canon.image ? <Image accessibilityLabel="캐릭터 기준 그림" source={{ uri: imageUri(project.canon.image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Doodle />}
                </View>
                <View style={{ flex: 1, gap: T.gap.sm }}>
                  <Action icon="image-outline" title={project.canon.image ? '다른 그림으로 바꾸기' : '그림 고르기'} disabled={!!busy} onPress={pickReference} />
                  {!!project.canon.image && <Action title="캐릭터 기준 내리기" onPress={() => updateProject(p => ({ ...p, canon: { ...p.canon, image: undefined } }))} />}
                </View>
              </View>
              <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: T.gap.md }}>
                <Field label="세트 이름" value={project.projectName} onChangeText={projectName => updateProject(p => ({ ...p, projectName }))} multiline={false} />
              </View>
              {(!!memo.length || !!project.characterName.trim()) && <View style={styles.card}>
                <Text style={styles.subtitle}>예전에 적어둔 메모</Text>
                {!!project.characterName.trim() && <Text style={{ fontSize: 13, color: C.ink }}>캐릭터 이름 · {project.characterName}</Text>}
                {memo.map(([key, label]) => <Text key={key} style={{ fontSize: 13, color: C.ink }}>{label} · {project.canon[key]}</Text>)}
              </View>}
            </>;
          })()}
        </> : screen === 'batch' ? <>
          {(() => {
            const source = project.slots.find(s => s.number === batchSource);
            const kept = (store?.savedMotions ?? []).find(m => m.id === batchSaved);
            const motion = kept?.motion ?? source?.motion;
            const candidates = project.slots.filter(s => s.work && s.number !== batchSource);
            const failedNumbers = batchResults.filter(r => !r.ok).map(r => r.number);
            return <>
              <Text style={styles.subtitle}>{kept ? `${kept.name} 움직임` : batchSource ? `${pad(batchSource)}번 칸의 움직임` : '옮길 움직임을 고르세요'}</Text>

              {!!(store?.savedMotions ?? []).length && <>
                <Text style={styles.label}>보관한 움직임</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(store?.savedMotions ?? []).map(saved => <Pressable key={saved.id} accessibilityRole="button" accessibilityLabel={`${saved.name} 적용하기`} accessibilityState={{ selected: batchSaved === saved.id }}
                    onPress={() => { setBatchSaved(batchSaved === saved.id ? null : saved.id); setBatchResults([]); setBatchPreview(null); }}
                    style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: batchSaved === saved.id ? C.accentBorder : C.line, backgroundColor: batchSaved === saved.id ? C.accentSoft : C.paper, alignItems: 'center', justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{saved.name}</Text>
                  </Pressable>)}
                </View>
              </>}

              <Text style={styles.label}>움직임을 가져올 칸</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {project.slots.filter(isAnimated).map(s => <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${s.number}번을 기준으로`} accessibilityState={{ selected: batchSource === s.number }}
                  onPress={() => { setBatchSource(s.number); setBatchSaved(null); setBatchPicked([]); setBatchResults([]); setBatchPreview(null); }}
                  style={{ width: 64, gap: 3 }}>
                  <View style={{ width: 64, height: 64, borderRadius: T.radius.sm, borderWidth: batchSource === s.number ? 2.5 : 0, borderColor: batchSource === s.number ? C.accent : 'transparent', overflow: 'hidden', backgroundColor: batchSource === s.number ? C.paper : C.surface2 }}>
                    {s.finalImage ? <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage).path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                  </View>
                  <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>{pad(s.number)}</Text>
                </Pressable>)}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.label, { flex: 1 }]}>적용할 칸 {batchPicked.length}개</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="전체 선택" onPress={() => setBatchPicked(batchPicked.length === candidates.length ? [] : candidates.map(s => s.number))} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>{batchPicked.length === candidates.length ? '전체 해제' : '전체 선택'}</Text>
                </Pressable>
              </View>
              <ScrollView testID="batch-grid-scroll" nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 18 }} style={{ maxHeight: 360 }}>
                {candidates.map(s => {
                  const picked = batchPicked.includes(s.number);
                  const result = batchResults.find(r => r.number === s.number);
                  return <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${s.number}번 고르기`} accessibilityState={{ selected: picked }}
                    onPress={() => { setBatchPicked(picked ? batchPicked.filter(n => n !== s.number) : [...batchPicked, s.number]); setBatchPreview(null); }}
                    style={{ width: tileWidth, gap: 3 }}>
                    <View style={{ width: tileWidth, aspectRatio: 1, borderRadius: T.radius.md, borderWidth: picked ? 2.5 : 1, borderColor: picked ? C.accent : C.line, overflow: 'hidden', backgroundColor: picked ? C.accentSoft : C.paper }}>
                      {s.finalImage ? <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage).path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
                      {picked && <View style={{ position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="check" size={14} color={C.accentInk} /></View>}
                      {!!result && <View style={{ position: 'absolute', right: 4, bottom: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: result.ok ? colors.PASS : colors.FAIL, borderWidth: 1.5, borderColor: '#FFF' }} />}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 9, color: C.muted }}>{pad(s.number)}{isAnimated(s) ? ' · 움직임 있음' : ''}</Text>
                  </Pressable>;
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([[true, '움직임 바꾸기'], [false, '있는 칸은 그대로']] as const).map(([value, label]) =>
                  <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: batchReplace === value }} onPress={() => { setBatchReplace(value); setBatchPreview(null); }}
                    style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: batchReplace === value ? C.accentBorder : C.line, backgroundColor: batchReplace === value ? C.accentSoft : C.paper, alignItems: 'center', justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{label}</Text>
                  </Pressable>)}
              </View>

              {!!batchPicked.length && !!motion && (() => {
                // 적용하면 어떻게 되는지 한 칸으로 실제 만들어 본다. 저장된 것은 건드리지 않는다.
                const willChange = batchPicked.filter(n => batchReplace || !isAnimated(project.slots[n - 1]));
                const target = batchPreview?.number ?? willChange[0];
                if (!target) return <Text style={{ fontSize: 12, color: colors.WARNING }}>고른 칸에 이미 움직임이 있어 바뀌는 칸이 없어요.</Text>;
                return <View style={[styles.card, { alignItems: 'center' }]}>
                  <View style={{ width: 160, height: 160, borderRadius: T.radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {batchPreview
                      ? <Image accessibilityLabel="적용 전 미리보기" source={{ uri: batchPreview.data }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      : <MaterialCommunityIcons name="play-circle-outline" size={40} color="#B8B8BD" />}
                  </View>
                  <Text style={{ fontSize: 11, color: C.muted }}>{pad(target)}번{batchPreview ? ` · ${batchPreview.loop.toFixed(1)}초 반복 · 적용 전` : ''}</Text>
                  <Action title={batchPreview ? '다시 만들어 보기' : '미리 만들어 보기'} icon="play" disabled={!!busy || previewing || !pro}
                    onPress={() => void previewOnOne(motion, target)} />
                  {previewing && <Text style={{ fontSize: 12, color: C.muted }}>만들어 보는 중…</Text>}
                </View>;
              })()}

              {!!batchResults.length && <View style={styles.card}>
                {batchResults.map(r => <Text key={r.number} style={{ fontSize: 12, color: r.ok ? C.ink : colors.FAIL }}>{pad(r.number)} · {r.ok ? '적용됨' : r.reason}</Text>)}
                {!!failedNumbers.length && <Action title={`실패한 ${failedNumbers.length}칸 다시 시도`} disabled={!!busy || !motion} onPress={() => motion && void applyMotionToMany(motion, failedNumbers, batchReplace)} />}
              </View>}

              <Action primary title={`${batchPicked.length}칸에 적용`} disabled={!!busy || !motion || !batchPicked.length || !pro}
                onPress={() => motion && void applyMotionToMany(motion, batchPicked, batchReplace)} />
            </>;
          })()}
        </> : screen === 'extras' ? <>
          {(() => {
            const drawn = project.slots.filter(s => s.finalImage);
            const slot = project.slots.find(s => s.number === extraSlot);
            const frame = extraKind === 'icon' ? { width: 78, height: 78 } : extraKind === 'share' ? { width: 600, height: 166 } : { width: 360, height: 360 };
            const spec = REQUIRED_EXTRAS.find(e => e.id === extraKind)!;
            const previewWidth = Math.min(screenWidth - T.gap.lg * 2, 320);
            const previewHeight = previewWidth * frame.height / frame.width;
            const box = slot?.finalImage ? placeInFrame(slot.finalImage, { width: previewWidth, height: previewHeight }, place) : null;
            return <>
              <View style={{ flexDirection: 'row', padding: 3, borderRadius: 24, backgroundColor: T.fill }}>
                {REQUIRED_EXTRAS.map(e => <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={e.label} accessibilityState={{ selected: extraKind === e.id }}
                  onPress={() => { setExtraKind(e.id); setPlace({ scale: 1, dx: 0, dy: 0 }); }}
                  style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: extraKind === e.id ? C.paper : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: extraKind === e.id ? '900' : '700', color: extraKind === e.id ? C.ink : C.muted }}>{e.label}</Text>
                </Pressable>)}
              </View>
              <Text style={{ fontSize: 12, color: C.muted }}>{spec.spec}</Text>

              {drawn.length
                ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                    {drawn.map(s => <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${s.number}번으로 만들기`} accessibilityState={{ selected: extraSlot === s.number }}
                      onPress={() => { setExtraSlot(s.number); setPlace({ scale: 1, dx: 0, dy: 0 }); }}
                      style={{ width: 64, gap: 3 }}>
                      <View style={{ width: 64, height: 64, borderRadius: T.radius.sm, borderWidth: extraSlot === s.number ? 2.5 : 0, borderColor: extraSlot === s.number ? C.accent : 'transparent', overflow: 'hidden', backgroundColor: extraSlot === s.number ? C.paper : C.surface2 }}>
                        <Image source={{ uri: imageUri(s.finalImage!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      </View>
                      <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>{pad(s.number)}</Text>
                    </Pressable>)}
                  </ScrollView>
                : <Text style={{ fontSize: 12, color: C.muted }}>먼저 칸을 하나라도 그려 주세요.</Text>}

              {!!slot?.finalImage && <>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: previewWidth, height: previewHeight, borderRadius: T.radius.sm, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFF', overflow: 'hidden' }}>
                    {!!box && <Image accessibilityLabel="부가 이미지 미리보기" source={{ uri: imageUri(slot.finalImage.path) }}
                      style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h }} resizeMode="stretch" />}
                  </View>
                </View>
                {extraKind !== 'cover' && <>
                  <Range label="크기" value={place.scale} min={.3} max={2} display={place.scale.toFixed(2) + '배'} onChange={scale => setPlace({ ...place, scale: Number(scale.toFixed(2)) })} />
                  <Range label="가로" value={place.dx} min={-.5} max={.5} display={Math.round(place.dx * 100) + '%'} onChange={dx => setPlace({ ...place, dx: Number(dx.toFixed(3)) })} />
                  <Range label="세로" value={place.dy} min={-.5} max={.5} display={Math.round(place.dy * 100) + '%'} onChange={dy => setPlace({ ...place, dy: Number(dy.toFixed(3)) })} />
                </>}
                <Action primary title={extraKind === 'cover' ? '이 그림을 대표로' : '이 모양으로 만들기'} disabled={!!busy} onPress={() => void makeExtra()} />
              </>}

              <View style={styles.card}>
                {([['아이콘 이미지', !!project.extras?.icon, project.extras?.icon ? `${project.extras.icon.width}×${project.extras.icon.height}` : '아직 없어요'],
                   ['공유 이미지', !!project.extras?.share, project.extras?.share ? `${project.extras.share.width}×${project.extras.share.height}` : '아직 없어요'],
                   ['대표 이미지', !!project.extras?.coverSlot, project.extras?.coverSlot ? `${pad(project.extras.coverSlot)}번` : '아직 없어요']] as const).map(([label, ok, detail]) =>
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
                    <MaterialCommunityIcons name={ok ? 'check-circle' : 'circle-outline'} size={18} color={ok ? colors.PASS : C.muted} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.ink }}>{label}</Text>
                    <Text style={{ flexShrink: 1, fontSize: 12, color: C.muted, textAlign: 'right' }}>{detail}</Text>
                  </View>)}
              </View>
            </>;
          })()}
        </> : screen === 'export' ? <>
          {(() => {
            const moving = setIsAnimated(project);
            const profile = moving ? KAKAO_ANIMATED_SPEC : SPEC;
            const movingCuts = project.slots.filter(isAnimated).length;
            const submitReady = project.slots.filter(s => s.submitImage).length;
            const submitOver = project.slots.filter(s => s.submitImage && (s.submitImage.width !== KAKAO_ANIMATED_SPEC.width || s.submitImage.height !== KAKAO_ANIMATED_SPEC.height)).length;
            const drawn = project.slots.filter(s => s.finalImage);
            const measured = drawn.filter(s => s.finalImage!.metrics);
            const sized = drawn.filter(s => s.finalImage!.width === SPEC.width && s.finalImage!.height === SPEC.height);
            const clear = measured.filter(s => s.finalImage!.metrics!.transparent);
            const facts: [string, string][] = [
              ['완성한 칸', `${doneCount(project)} / ${profile.count}`],
              [`크기 ${SPEC.width}×${SPEC.height}`, `${sized.length} / ${drawn.length}`],
              ['투명 배경', measured.length === drawn.length ? `${clear.length} / ${drawn.length}` : `${clear.length} / ${measured.length}`],
              ['파일 형식', moving ? `움직이는 ${movingCuts}칸 중 ${submitReady}칸 WebP · 나머지 PNG` : 'PNG'],
              ['용량 상한', `${Math.round(profile.maxBytes / 1024)}KB`],
            ];
            const problems = setChecks.filter(c => c.status !== 'PASS');
            const need = (moving ? STAGES.animated : STAGES.still)[stage];
            const finished = doneCount(project);
            const shortBy = Math.max(0, need.emoticons - finished);
            const movingNeed = moving && 'animatedMin' in need ? need.animatedMin : 0;
            const movingShort = Math.max(0, movingNeed - submitReady);
            const requirements: { label: string; ok: boolean; detail: string }[] = [
              { label: `이모티콘 ${need.emoticons}개`, ok: shortBy === 0, detail: shortBy ? `${shortBy}개 더` : '채웠어요' },
              ...(moving ? [{ label: `움직이는 WebP ${movingNeed}개`, ok: movingShort === 0, detail: movingShort ? `${movingShort}개 더` : '채웠어요' }] : []),
              { label: '아이콘 이미지', ok: !!project.extras?.icon, detail: project.extras?.icon ? '있어요' : '아직 없어요' },
              ...(need.share ? [
                { label: '공유 이미지', ok: !!project.extras?.share, detail: project.extras?.share ? '있어요' : '아직 없어요' },
                { label: '대표 이미지', ok: !!project.extras?.coverSlot, detail: project.extras?.coverSlot ? `${pad(project.extras.coverSlot)}번` : '아직 없어요' },
              ] : []),
            ];
            const prepShort = requirements.filter(r => !r.ok).length;
            const row = (key: string, ok: boolean, label: string, detail: string) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 }}>
              <MaterialCommunityIcons name={ok ? 'check-circle' : 'circle-outline'} size={18} color={ok ? T.success : C.lineStrong} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: C.ink }}>{label}</Text>
              <Text style={{ flexShrink: 1, fontSize: 12, color: ok ? C.muted : colors.WARNING, textAlign: 'right' }}>{detail}</Text>
            </View>;
            // 320dp 에서 6열이면 칸이 43dp 로 손가락보다 작아진다(45.23차 매트릭스). 좁은 화면만 5열로 줄인다.
            const cols = screenWidth >= 600 ? 8 : screenWidth < 340 ? 5 : 6;
            const cell = Math.floor((screenWidth - T.gap.lg * 2 - 6 * (cols - 1)) / cols);
            const shownCheck = drawn.find(s => isDone(s)) ?? drawn[0];
            return <>
              {/* 1. 내가 만든 결과가 먼저다. 손볼 칸은 테두리로 드러나고, 누르면 그 칸이 열린다. */}
              {/* 요약 표면: 완성 상태가 먼저. 모두 채우면 따뜻한 표면과 완성 그림 자리(exportSuccessArtwork). */}
              <View testID="내보내기 요약" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: T.radius.card, backgroundColor: finished >= profile.count ? C.warm : C.paper, borderWidth: 1, borderColor: finished >= profile.count ? C.warmLine : C.line, ...Elev[1] }}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: finished >= profile.count ? C.warmInk : C.muted }}>{finished >= profile.count ? `세트를 모두 완성했어요 · ${profile.profileLabel}` : profile.profileLabel}</Text>
                  <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{finished} / {profile.count} 완성</Text>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: finished >= profile.count ? C.warmLine : C.line, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, Math.min(100, finished / profile.count * 100))}%`, height: '100%', borderRadius: 3, backgroundColor: C.accent }} /></View>
                </View>
                {finished >= profile.count
                  ? <AssetSlot name="exportSuccessArtwork" size={84} />
                  : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{Math.round(finished / profile.count * 100)}%</Text></View>}
              </View>
              <View testID="결과 격자" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {project.slots.map(s => {
                  const bad = problems.some(c => c.slot === s.number), shown = s.motionImage ?? s.finalImage;
                  return <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${pad(s.number)}번 칸 열기`} onPress={() => fixSlot(s.number)}
                    style={{ width: cell, height: cell, borderRadius: 10, borderWidth: bad ? 2 : shown ? 1 : 0, borderColor: bad ? STATUS_TONE.fail : C.line, backgroundColor: shown ? C.paper : C.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {shown ? <Image source={{ uri: imageUri(shown.path) }} style={{ width: '100%', height: '100%', opacity: isDone(s) ? 1 : .55 }} resizeMode="contain" /> : <Text style={{ fontSize: 10, fontWeight: '600', color: C.faint }}>{pad(s.number)}</Text>}
                  </Pressable>;
                })}
              </View>

              {/* 2·3. 손볼 곳과 고치는 길 */}
              {/* 손볼 곳: 한 표면 안의 목록. 상태는 옅은 호박/빨강 동그라미 하나로 — 강한 경고 상자를 쌓지 않는다. */}
              {!!problems.length && <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 4 }}>손볼 곳 {problems.length}개</Text>
                <View style={{ borderRadius: T.radius.card, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
                  {problems.map((c, i) => <Pressable key={c.label + i} accessibilityRole="button" accessibilityLabel={`${c.label} 고치기`} disabled={!c.slot} onPress={() => c.slot && fixSlot(c.slot)}
                    style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed && c.slot ? C.fill : 'transparent' })}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.status === 'FAIL' ? T.dangerSoft : T.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name={c.status === 'FAIL' ? 'alert-circle-outline' : 'alert-outline'} size={17} color={c.status === 'FAIL' ? T.danger : T.warning} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.muted }}><Text style={{ fontWeight: '700', color: C.ink }}>{c.label}</Text> · {c.detail}</Text>
                    {!!c.slot && <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />}
                  </Pressable>)}
                </View>
              </View>}

              {/* 4. 지금 할 일. 이 화면의 노란 버튼은 이것 하나다. */}
              <Action primary icon="package-variant-closed" title="파일 묶음 만들기" disabled={!!busy || !drawn.length} onPress={exportProject} />
              {!!lastExport && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, borderRadius: 16, backgroundColor: T.successSoft }}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.PASS} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: C.ink }}>{lastExport.count}칸을 묶었어요</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="다시 공유" disabled={!!busy} onPress={shareAgain} style={{ minHeight: T.tap, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>다시 공유</Text></Pressable>
              </View>}

              {/* 제출 준비: 지금 그리는 일보다 뒤에 오는 일이라 접어 둔다. 접힌 줄에도 몇 개가 남았는지 보인다(45.2차). */}
              <Pressable accessibilityRole="button" accessibilityLabel={prepOpen ? '제출 준비 접기' : '제출 준비 보기'} accessibilityState={{ expanded: prepOpen }} onPress={() => setPrepOpen(!prepOpen)}
                style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>제출 준비</Text>
                <Text style={{ flex: 1, fontSize: 12, color: prepShort ? colors.WARNING : C.muted }}>{prepShort ? `${prepShort}가지 더 필요해요` : '필요한 것을 다 채웠어요'}</Text>
                <MaterialCommunityIcons name={prepOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
              </Pressable>
              {prepOpen && <View style={{ padding: 14, gap: 4, borderRadius: T.radius.card, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line }}>
                <Segmented dense value={stage} onChange={setStage} items={[{ key: 'proposal', label: '제안에 필요한 것', a11y: '제안 기준으로 보기' }, { key: 'release', label: '출시에 필요한 것', a11y: '출시 기준으로 보기' }]} />
                <View style={{ height: 4 }} />
                {requirements.map(r => row(r.label, r.ok, r.label, r.detail))}
              </View>}
              <Pressable accessibilityRole="button" accessibilityLabel="부가 이미지 만들기" onPress={() => setScreen('extras')}
                style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>부가 이미지 만들기</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={C.faint} />
              </Pressable>

              {/* 5. 규격·직접 확인·파일 검사는 접어 둔다. 지우지 않고, 필요할 때 펼친다. */}
              <Pressable accessibilityRole="button" accessibilityLabel={specOpen ? '자세히 접기' : '자세히 보기'} accessibilityState={{ expanded: specOpen }} onPress={() => setSpecOpen(!specOpen)}
                style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>규격 · 직접 확인 · 파일 검사</Text>
                <MaterialCommunityIcons name={specOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
              </Pressable>
              {specOpen && <>
                {/* 가이드가 정한 제작 도구 규칙. 앱이 대신하지 않는 일을 한 줄로 분명히 한다. */}
                {moving && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.surface2 }}>
                  <MaterialCommunityIcons name="movie-open-outline" size={20} color={C.muted} />
                  <Text style={{ flex: 1, fontSize: 12, color: C.ink, lineHeight: 18 }}>움직이는 칸은 카카오 WebPAnimator에서 WebP로 마무리해요. 묶음에 칸별 프레임이 들어 있어요.</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="WebPAnimator 열기" onPress={() => { Linking.openURL(WEBP_ANIMATOR_URL).catch(() => Alert.alert('링크를 열지 못했어요', '잠시 후 다시 시도해 주세요.')); }}
                    style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="open-in-new" size={18} color={C.muted} />
                  </Pressable>
                </View>}
                <View style={styles.card}>
                  <Text style={{ fontSize: 12, color: C.ink, lineHeight: 18 }}><Text style={{ fontWeight: '700' }}>{profile.profileLabel}</Text> · {profile.format} · {profile.width}×{profile.height} · {Math.round(profile.maxBytes / 1024)}KB 이하</Text>
                  {moving && movingCuts > submitReady && <Text style={{ fontSize: 12, color: colors.WARNING, lineHeight: 18 }}>움직이는 {movingCuts}칸 중 {movingCuts - submitReady}칸은 WebP를 만들지 못해 GIF로 들어가요. 그 칸을 다시 열었다 닫으면 다시 만들어요.</Text>}
                  {!!submitOver && <Text style={{ fontSize: 12, color: colors.FAIL, lineHeight: 18 }}>{submitOver}칸의 WebP 크기가 {KAKAO_ANIMATED_SPEC.width}×{KAKAO_ANIMATED_SPEC.height}가 아니에요.</Text>}
                  {facts.map(([label, value]) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ fontSize: 12, color: C.muted }}>{label}</Text><Text style={{ flexShrink: 1, fontSize: 12, fontWeight: '800', color: C.ink, textAlign: 'right' }}>{value}</Text></View>)}
                  <Text style={{ fontSize: 12, color: C.ink, lineHeight: 18 }}>{need.text}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>공식 가이드 확인일 {profile.checkedAt}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.label}>직접 확인</Text>
                  {!!shownCheck && <View style={{ flexDirection: 'row', gap: 8 }}>
                    {([['밝은 배경', '#FFFFFF'], ['어두운 배경', '#2B2B2E']] as const).map(([label, background]) =>
                      <View key={label} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
                        <View style={{ width: '100%', maxWidth: 140, aspectRatio: 1, borderRadius: T.radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: background, overflow: 'hidden' }}>
                          <Image accessibilityLabel={`${label} 미리보기`} source={{ uri: imageUri((shownCheck.motionImage ?? shownCheck.finalImage)!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        </View>
                        <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
                      </View>)}
                  </View>}
                  {['캐릭터가 칸마다 같은 인물로 보여요', '표현이 지나치게 겹치지 않아요', '작게 줄여도 알아볼 수 있어요', '남의 그림·글꼴·상표가 없어요'].map(line => <Text key={line} style={{ fontSize: 12, lineHeight: 18, color: C.ink }}>· {line}</Text>)}
                  <Pressable accessibilityRole="checkbox" accessibilityLabel="표현과 문구 확인" accessibilityState={{ checked: !!project.selfChecked }}
                    onPress={() => updateProject(p => ({ ...p, selfChecked: !p.selfChecked }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: project.selfChecked ? C.ink : C.line, backgroundColor: project.selfChecked ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {project.selfChecked && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.ink }}>표현과 문구를 확인했어요</Text>
                  </Pressable>
                </View>
                <View style={styles.card}>
                  <Text style={styles.label}>파일 검사</Text>
                  {row('open', drawn.length > 0 && measured.length === drawn.length, '파일 열기', `${measured.length} / ${drawn.length}칸`)}
                  {row('clear', measured.length > 0 && clear.length === measured.length, '투명 배경', `${clear.length} / ${measured.length}칸`)}
                  {row('size', drawn.length > 0 && sized.length === drawn.length, '크기', `${sized.length} / ${drawn.length}칸`)}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="저장된 그림 다시 검사" disabled={!!busy || !drawn.length} onPress={() => void recheckAll()} style={{ minHeight: T.tap, justifyContent: 'center', opacity: !!busy || !drawn.length ? .4 : 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>다시 검사</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="공식 가이드 보기" onPress={() => { Linking.openURL(SPEC.officialUrl).catch(() => Alert.alert('링크를 열지 못했어요', '잠시 후 다시 시도해 주세요.')); }} style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>공식 가이드</Text>
                      <MaterialCommunityIcons name="open-in-new" size={15} color={C.muted} />
                    </Pressable>
                  </View>
                </View>
              </>}
            </>;
          })()}
        </> : <>
          {(() => {
            const done = doneCount(project);
            const working = project.slots.filter(isWorking).length;
            const drawnCount = project.slots.filter(s => s.finalImage).length;
            // 한 줄 요약 + 노랑 진행 막대 + 상태 점 범례. 격자가 주인공이라 요약은 낮고 조용하다.
            return <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.gap.md, paddingBottom: 4 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 16, lineHeight: 22, color: C.ink, fontWeight: '700' }}>{done}개 완성{working ? ` · ${working}개 작업 중` : ''}</Text>
                  <Text style={{ fontSize: 12, color: C.faint }}>/ {project.slots.length}칸</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, done / project.slots.length * 100)}%`, height: '100%', borderRadius: 2, backgroundColor: C.accent }} /></View>
                {/* 범례는 두 상태가 실제로 같이 있을 때만 설명할 것이 있다(45.2차). */}
                {done > 0 && working > 0 && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><StatusDot tone="done" size={8} /><Text style={{ fontSize: 11, color: C.muted }}>완성</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><StatusDot tone="working" size={8} /><Text style={{ fontSize: 11, color: C.muted }}>고치는 중</Text></View>
                </View>}
              </View>
              {drawnCount >= 2 && <Pressable accessibilityRole="button" accessibilityLabel={playing ? '전체 재생 멈추기' : '전체 재생'} onPress={() => { setPlayIndex(0); setPlaying(!playing); }}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: playing ? C.accent : C.paper, alignItems: 'center', justifyContent: 'center', ...Elev[1] }}>
                <MaterialCommunityIcons name={playing ? 'pause' : 'play'} size={22} color={C.ink} />
              </Pressable>}
            </View>;
          })()}
          {reordering && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: T.radius.md, backgroundColor: T.infoSoft }}>
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={T.info} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: T.info }}>순서 바꾸는 중</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="순서 바꾸기 끝" onPress={() => setReordering(false)} style={{ minHeight: T.tap, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '800', color: T.info }}>끝</Text></Pressable>
          </View>}
          {playing && (() => {
            const made = project.slots.filter(s => s.finalImage);
            const shown = made[playIndex % Math.max(1, made.length)];
            if (!shown) return null;
            return <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 200, height: 200, borderRadius: T.radius.md, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
                <Image accessibilityLabel="전체 재생 화면" source={{ uri: imageUri((shown.motionImage ?? shown.finalImage)!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              <Text style={{ fontSize: 11, color: C.muted }}>{pad(shown.number)} · {playIndex + 1} / {made.length}</Text>
            </View>;
          })()}
          {/* 칸 격자가 주인공. 상태는 글자 배지 대신 모서리 점 하나(초록 완성 · 노랑 고치는 중), 손볼 곳은 아래 점. 완성한 칸을 고치면 점이 노랑으로 바뀐다. */}
          <View testID="slot-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{project.slots.map(s => {
            const done = isDone(s), working = isWorking(s);
            const firstEmpty = project.slots.find(x => !x.finalImage)?.number;
            const current = project.lastSlot === s.number, adding = !s.finalImage && s.number === firstEmpty;
            return <Pressable key={s.number} testID={`slot-${s.number}`} accessibilityRole="button" accessibilityLabel={`슬롯 ${s.number} ${done ? '완성' : working ? '작업 중' : '미착수'}`} onPress={() => { setSlotNumber(s.number); setPainting(true); }} style={{ width: tileWidth, gap: 4 }}>
              <View style={{ width: tileWidth, aspectRatio: 1, borderRadius: 16, backgroundColor: s.finalImage ? C.paper : adding ? C.paper : C.surface2, borderWidth: current ? 2 : adding ? 1.5 : s.finalImage ? 1 : 0, borderColor: current ? C.accent : adding ? C.lineStrong : C.line, borderStyle: adding ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 }}>
                {s.finalImage
                  ? <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage).path) }} style={{ width: '100%', height: '100%', opacity: done ? 1 : .72 }} resizeMode="contain" />
                  : adding
                    ? <View style={{ alignItems: 'center', gap: 4 }}><View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="plus" size={18} color={C.accentInk} /></View><Text style={{ fontSize: 11, color: C.ink, fontWeight: '700' }}>그림 추가</Text></View>
                    // 명세 S01: 빈 칸은 '+' 로 분명히 알린다. 누르면 예전과 똑같이 그 칸이 열린다(동작은 그대로).
                    : <MaterialCommunityIcons name="plus" size={22} color={C.lineStrong} />}
                {(done || working) && <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: 6 }}><StatusDot tone={done ? 'done' : 'working'} /></View>}
                {(s.status === 'FAIL' || s.status === 'WARNING') && <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 6 }}><StatusDot tone={s.status === 'FAIL' ? 'fail' : 'warn'} /></View>}
              </View>
              {reordering && !!s.finalImage && <View style={{ flexDirection: 'row', gap: 2 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={String(s.number) + '번 앞으로'} disabled={s.number === 1} onPress={() => moveSlot(s.number, s.number - 1)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: s.number === 1 ? 'transparent' : C.surface2 }}><MaterialCommunityIcons name="chevron-left" size={18} color={s.number === 1 ? C.lineStrong : C.ink} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={String(s.number) + '번 뒤로'} disabled={s.number === project.slots.length} onPress={() => moveSlot(s.number, s.number + 1)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: s.number === project.slots.length ? 'transparent' : C.surface2 }}><MaterialCommunityIcons name="chevron-right" size={18} color={s.number === project.slots.length ? C.lineStrong : C.ink} /></Pressable>
              </View>}
              <Text numberOfLines={1} style={{ fontSize: 11, color: C.faint, paddingHorizontal: 2 }}><Text style={{ fontWeight: '700', color: done || working ? C.ink : C.faint }}>{pad(s.number)}</Text>{captionText(s) ? ' ' + captionText(s) : ''}</Text>
            </Pressable>;
          })}</View>
        </>}
      </ScrollView>
      {/* 보드 아래 고정 줄: 남은 칸이 있으면 이어서 그리기가 먼저, 완성이 생기면 내보내기. 다 채우면 내보내기가 노랑이다. */}
      {project && screen === 'board' && !canonOpen && (() => {
        const next = nextUnfinished(project, project.lastSlot ?? 0);
        const done = doneCount(project), started = done > 0 || project.slots.some(isWorking);
        return <View testID="board-action-dock" style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: C.paper, ...Elev[2] }}>
          {next !== null && <View style={{ flex: 2 }}><Action primary icon="pencil" title={started ? '이어서 그리기' : '첫 칸 그리기'} disabled={!!busy} onPress={() => drawFrom()} /></View>}
          {(done > 0 || next === null) && <View style={{ flex: 1 }}><Action primary={next === null} icon="package-variant-closed" title="내보내기" disabled={!!busy} onPress={() => setScreen('export')} /></View>}
        </View>;
      })()}
    </KeyboardAvoidingView>

    {newSetName !== null && <Dialog title="새 이모티콘 세트" onClose={() => setNewSetName(null)}>
      <Text style={styles.muted}>이름을 정하면 {SPEC.count}칸짜리 빈 세트를 만들어요. 이름은 나중에도 바꿀 수 있어요.</Text>
      <Field label="세트 이름" value={newSetName} onChangeText={setNewSetName} multiline={false} />
      <Action primary icon="plus" title="만들기" onPress={() => createProjectNow(newSetName)} />
      <Action title="취소" onPress={() => setNewSetName(null)} />
    </Dialog>}
    {managed && !pendingDelete && <Dialog title="세트 관리" onClose={() => setManageId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{managed.projectName}</Text>
      <Text style={styles.muted}>{doneCount(managed)} / {managed.slots.length} 완성</Text>
      <Action danger icon="delete-outline" title="세트 삭제" onPress={() => setConfirmDeleteId(managed.id)} />
    </Dialog>}
    {pendingDelete && <Dialog title="세트 삭제" onClose={() => setConfirmDeleteId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{pendingDelete.projectName}</Text>
      <Text style={styles.muted}>이 세트의 그림과 참고 사진이 함께 지워지고, 되돌릴 수 없어요.</Text>
      <Action danger title="이 세트 삭제" onPress={() => deleteProject(pendingDelete.id)} />
      <Action title="취소" onPress={() => setConfirmDeleteId(null)} />
    </Dialog>}
    {settings && <Dialog title="설정" onClose={() => setSettings(false)}>
      <Text style={{ fontSize: 12, color: C.muted }}>{entitlementLabel(entitlement)}</Text>
      {/* 검수용 빌드는 스스로 그렇다고 말한다. 출시 구성에서는 아예 그려지지 않는다(internalReviewBuild() 가 거짓). */}
      {internalReviewBuild() && <View style={{ gap: 8, padding: 12, borderRadius: T.radius.md, backgroundColor: C.accentSoft }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.accentInk }}>내부 검수용 빌드</Text>
        <Text style={{ fontSize: 11, color: C.accentInk, lineHeight: 16 }}>{REVIEW_BUILD_NOTE}</Text>
        <Pressable accessibilityRole="switch" accessibilityLabel="검수용 PRO 켜기" accessibilityState={{ checked: !!store?.reviewUnlock }}
          onPress={() => { try { commit(st => ({ ...st, reviewUnlock: !st.reviewUnlock })); } catch { /* 저장 실패는 위 배너가 말한다 */ } }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
          <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: store?.reviewUnlock ? C.accentLine : C.lineStrong }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: store?.reviewUnlock ? 18 : 0 }} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.accentInk }}>검수용 PRO {store?.reviewUnlock ? '켜짐' : '꺼짐'}</Text>
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityLabel="홈 공지 미리 보기" accessibilityState={{ checked: noticePreview }}
          onPress={() => setNoticePreview(!noticePreview)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
          <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: noticePreview ? C.accentLine : C.lineStrong }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: noticePreview ? 18 : 0 }} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.accentInk }}>홈 공지 미리 보기 {noticePreview ? '켜짐' : '꺼짐'}</Text>
        </Pressable>
      </View>}
      <Pressable accessibilityRole="switch" accessibilityLabel="캔버스 종이 질감" accessibilityState={{ checked: store?.paperTexture !== false }}
        onPress={() => { try { commit(st => ({ ...st, paperTexture: st.paperTexture === false })); } catch { /* 저장 실패는 배너가 말한다 */ } }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>캔버스 종이 질감</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>파일에는 들어가지 않아요</Text>
        </View>
        <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: store?.paperTexture !== false ? C.accent : C.lineStrong }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: store?.paperTexture !== false ? 18 : 0 }} />
        </View>
      </Pressable>
      {/* 앱 정보: 실제 설정에 적힌 버전만 보여 준다. 없는 도움말·백업 버튼은 만들지 않는다(명세 T01). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: 1, borderColor: C.line }}>
        <Text style={{ flex: 1, fontSize: 13, color: C.muted }}>버전</Text>
        <Text accessibilityLabel={'앱 버전 ' + appVersion} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{appVersion}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="PRO 이용" onPress={() => { setSettings(false); setProSheet(true); }}
        style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: pressed ? T.fill : 'transparent' })}>
        <MaterialCommunityIcons name="star-four-points-outline" size={19} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: C.ink }}>PRO 이용</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={C.muted} />
      </Pressable>
    </Dialog>}
    {proSheet && <Modal animationType="slide" onRequestClose={() => { setProSheet(false); resetPayment(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="PRO 닫기" onPress={() => { setProSheet(false); resetPayment(); }} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="chevron-left" size={28} color={C.ink} /></Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: C.ink }}>PRO</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: T.gap.lg, gap: T.gap.md, paddingBottom: 32 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, lineHeight: 30, letterSpacing: -.5 }}>{'더 섬세하게 움직이고\n여러 칸을 한 번에'}</Text>
          {/* proFeatureArtwork 자리(16:9). 지금은 앱 기본 캐릭터 두 장으로 전후를 보여 준다. */}
          <View accessibilityLabel="움직임 전후 미리보기" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, aspectRatio: 16 / 9, maxHeight: 214, borderRadius: 24, backgroundColor: C.warm, borderWidth: 1, borderColor: C.warmLine }}>
            {/* 왼쪽·오른쪽은 같은 그림이다. 달라지는 것은 '무엇이 움직이는가'뿐이라, 그 차이만 앱이 그린다. */}
            <View style={{ alignItems: 'center', gap: 5 }}>
              <View style={{ width: 86, height: 86 }}>
                <Image accessibilityIgnoresInvertColors source={ASSET_SLOTS.proFeatureArtwork.source ?? undefined} style={{ width: 86, height: 86 }} resizeMode="contain" />
                {/* 전체가 함께 움직인다: 그림 전체를 한 테두리로 감싼다. */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 2, top: 2, right: 2, bottom: 2, borderRadius: 14, borderWidth: 2, borderColor: C.warmInk }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>전체 움직임</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={24} color={C.ink} />
            <View style={{ alignItems: 'center', gap: 5 }}>
              <View style={{ width: 86, height: 86 }}>
                <Image accessibilityIgnoresInvertColors source={ASSET_SLOTS.proFeatureArtwork.sourceAfter ?? undefined} style={{ width: 86, height: 86 }} resizeMode="contain" />
                {/* 고른 곳만 움직인다: 흔드는 손 자리 하나만 감싼다. */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: 20, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.warmInk }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>부분 움직임</Text>
            </View>
          </View>
          {/* 실제로 PRO 인 것만 적는다. 그리기 기본 도구(진하기·보정·스포이드·팔레트·RGB)는 무료라 넣지 않는다. */}
          {([['부분만 움직이기 · 두 모습 번갈아', '손, 귀, 꼬리처럼 원하는 곳만 따로, 차례로', 'hand-back-right-outline'],
             ['여러 칸에 같은 움직임 한 번에', '보관한 움직임을 고른 칸 전부에', 'content-duplicate'],
             ['고급 브러시 8종', '매끈한 잉크, 부드러운 펜, 결 연필, 캘리그래피, 크레용, 에어브러시, 납작펜, 거친 선', 'brush-variant']] as const).map(([title, hint, icon]) =>
            <View key={title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={icon} size={19} color={C.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{title}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{hint}</Text>
              </View>
            </View>)}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4 }}>
            <MaterialCommunityIcons name="check" size={16} color={C.muted} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: C.muted }}>무료로도 워터마크 없이 한 세트를 끝까지 그리고, 기본 움직임을 넣고, 파일 묶음으로 내보낼 수 있어요.</Text>
          </View>
          {entitlementLabel(entitlement) !== '무료' && <Text style={{ fontSize: 12, color: C.muted }}>{entitlementLabel(entitlement)}</Text>}
          {expiredButRemembered(entitlement) && <Text style={{ fontSize: 12, color: C.ink }}>기간이 끝나도 이미 만든 움직임은 계속 재생되고 내보낼 수 있어요.</Text>}
          {/* 파는 것은 하나다: 한 번 구매하면 계속 쓰는 PRO. 고르는 줄이 아니라 값을 적는 칸이다.
              스토어 가격이 오면 그것을 적고, 없으면 후보 가격임을 분명히 적는다(하드코딩한 판매가가 아니다). */}
          <View accessibilityRole="summary" accessibilityLabel={'PRO 가격 ' + (prices?.lifetime || PLANS[0].proposedPrice)}
            style={{ borderWidth: 1, borderColor: C.accentBorder, borderRadius: 16, padding: 14, gap: 2, backgroundColor: C.accentSoft }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{PLANS[0].label}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{prices?.lifetime || PLANS[0].proposedPrice}</Text>
            <Text style={{ fontSize: 10, color: C.muted }}>{prices?.lifetime ? '스토어 가격' : (PRICES_ARE_PROPOSED ? '후보 가격 · 미확정' : '출시 가격')}</Text>
            {!prices?.lifetime && <Text style={{ fontSize: 10, color: C.muted, lineHeight: 15 }}>{PRICE_IS_CANDIDATE_NOTE}</Text>}
            <Text style={{ fontSize: 11, color: C.muted }}>구독이 아니라 한 번만 결제해요. 정기 결제나 해지가 없어요.</Text>
          </View>
          <PaymentStatus payment={payment} onRestore={() => void restorePro()} onRetry={() => void loadPrices()} />
          {payment.phase === 'bought' || payment.phase === 'restored'
            ? <Action primary title="PRO로 만들러 가기" onPress={() => { setProSheet(false); resetPayment(); }} />
            : <Action primary title="PRO 한 번 구매하기" busy={payment.phase === 'buying'} disabled={!prices?.lifetime || payment.phase === 'loading' || payment.phase === 'restoring' || isPro(entitlement)} onPress={() => void startPurchase()} />}
          {/* 내부 검수 빌드에서는 이 기기에서 결제를 열 수 없는 일이 흔하다. 잠금에 부딪힌 검수자가
              설정 깊은 곳의 토글을 찾아 헤매지 않도록, 막힌 바로 그 자리에서 켤 수 있게 한다.
              출시 구성에서는 internalReviewBuild() 가 거짓이라 이 줄이 아예 그려지지 않는다. 구매가 아니다. */}
          {internalReviewBuild() && !pro && <Action icon="key-variant" title="결제 없이 검수용 PRO 켜기"
            onPress={() => { try { commit(st => ({ ...st, reviewUnlock: true })); setProSheet(false); resetPayment(); setNotice(REVIEW_BUILD_NOTE); } catch (e) { setNotice('검수용 PRO 를 켜지 못했어요. ' + userMessage(e)); } }} />}
          <Action title="무료로 계속하기" onPress={() => { setProSheet(false); resetPayment(); }} />
          <Pressable accessibilityRole="button" accessibilityLabel="구매 복원" disabled={payment.phase === 'buying' || payment.phase === 'restoring'} onPress={() => void restorePro()} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{payment.phase === 'restoring' ? '구매 내역을 확인하는 중…' : '구매 복원'}</Text></Pressable>
          {/* 일회성 구매에는 해지가 없다. 영수증·환불은 스토어의 구매 내역에서 본다.
              예전 구독 저장본을 가진 사람에게는 구독 관리 길도 함께 둔다 — 길을 막지 않는다. */}
          {isPro(entitlement) && !!entitlement && entitlement.plan === 'lifetime' && <Pressable accessibilityRole="button" accessibilityLabel="구매 내역" onPress={() => { Linking.openURL(purchaseHistoryUrl()).catch(() => setPayment({ phase: 'failed', problem: 'store-unavailable' })); }} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>구매 내역 보기</Text></Pressable>}
          {isPro(entitlement) && !!entitlement && (entitlement.plan === 'monthly' || entitlement.plan === 'yearly') && <Pressable accessibilityRole="button" accessibilityLabel="구독 관리" onPress={() => { Linking.openURL(subscriptionManageUrl('pro_' + entitlement.plan)).catch(() => setPayment({ phase: 'failed', problem: 'store-unavailable' })); }} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>구독 관리 · 해지</Text></Pressable>}
          <Text style={{ fontSize: 10, color: C.muted, lineHeight: 16 }}>한 번 구매하면 같은 스토어 계정에서 계속 쓸 수 있어요. 기기를 바꾸거나 다시 설치하면 구매 복원을 눌러 주세요. 작품과 파일은 어떤 경우에도 지우지 않아요.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>}
    {menu && project && <Dialog title={project.projectName} onClose={() => setMenu(false)}>
      <View style={{ borderRadius: T.radius.md, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
        {([
          ['캐릭터 기준 · 세트 이름', 'account-star-outline', false, () => { setSlotNumber(null); setCanonOpen(true); }],
          ['칸 순서 바꾸기', 'swap-horizontal', false, () => { setReordering(true); }],
          // 여러 칸 한 번에는 움직이는 칸이 생긴 뒤에만 보인다. 무료 사용자는 들어가기 전에 PRO 안내로 간다.
          ...(setIsAnimated(project) ? [['움직임 한 번에 적용', 'content-duplicate', !pro, () => {
            if (!pro) { setProSheet(true); return; }
            setBatchSource(project.slots.find(isAnimated)?.number ?? null); setBatchSaved(null); setBatchPicked([]); setBatchResults([]); setBatchPreview(null); setScreen('batch');
          }] as const] : []),
        ] as readonly (readonly [string, React.ComponentProps<typeof MaterialCommunityIcons>['name'], boolean, () => void])[]).map(([label, icon, locked, run], i) =>
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setMenu(false); run(); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: T.gap.lg, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
            <MaterialCommunityIcons name={icon} size={19} color={C.muted} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: C.ink }}>{label}</Text>
            {locked && <ProTag />}
          </Pressable>)}
      </View>
    </Dialog>}
    {painting && project && slot && <Painter key={project.id + '/' + slot.number} slot={slot} slotCount={project.slots.length} setName={project.projectName} canon={project.canon.image} canonName={project.characterName} canonLocked={project.canon.locked} palette={store?.palette ?? []} onColorUsed={rememberColor} userPalette={store?.userPalette ?? []} onSaveUserColor={saveUserColor} onRemoveUserColor={removeUserColor}
      brushSettings={project.brush}
      onBrushSettings={brush => { try { changeProject(project.id, p => ({ ...p, brush })); } catch (e) { setNotice('브러시 설정을 저장하지 못했어요. ' + userMessage(e)); } }}
      completeTitle={nextUnfinished(project, slot.number) === null ? '완성 · 전체 보기' : '완성 · 다음'}
      hasPrevious={!!previousDrawn(project, slot.number)}
      previousImage={previousDrawn(project, slot.number)?.finalImage}
      pro={pro}
      onRequestPro={() => setProSheet(true)}
      previousMotion={project.slots.filter(s => s.number < slot.number && isAnimated(s)).at(-1)?.motion ?? null}
      guideHint={guideHint}
      onGuideHintDone={() => setGuideHint(null)}
      guideExample={guideExample}
      guideExampleMode={guideExampleMode}
      // 번들 그림을 세트의 참고 사진과 같은 자리에 들여놓는다. 저장·복원·삭제는 기존 참고 정책이 그대로 맡는다.
      onImportGuideExample={async artwork => {
        const image = await importBundledImage(artwork);
        changeProject(project.id, q => ({ ...q, slots: q.slots.map(t => ({ ...t, referenceImages: mergeImages(t.referenceImages, [image]) })) }));
        return image;
      }}
      initialTool={lastTool}
      onToolChange={setLastTool}
      paperTexture={store?.paperTexture !== false}
      savedMotions={store?.savedMotions ?? []}
      onSaveMotion={saveMotion}
      onForgetMotion={forgetMotion}
      onComplete={completeAndNext}
      onSetReference={useAsReference}
      onCopyPrevious={copyPreviousWork}
      onClose={() => { setPainting(false); setSlotNumber(null); setGuideHint(null); setGuideExample(null); setGuideExampleMode(null); if (returnToExport) { setScreen('export'); setReturnToExport(false); } }}
      // 옆 칸으로 넘어가면 이 칸에서 고른 예시는 따라가지 않는다. 칸에 깔아 둔 밑그림은 그 칸에 그대로 남는다.
      onNavigate={number => { setGuideHint(null); setGuideExample(null); setGuideExampleMode(null); setSlotNumber(number); }}
      onImportDrawing={async () => { const picked = await pickImages(); return picked[0] ? await dataUrl(picked[0]) : null; }}
      cutouts={(store?.cutouts ?? []).map(c => ({ id: c.id, name: c.name, path: c.image.path }))}
      onKeepCutout={async data => keepCutout(data)}
      onUseCutout={async id => { const found = (current.current?.cutouts ?? []).find(c => c.id === id); return found ? await dataUrl(found.image) : null; }}
      onForgetCutout={forgetCutout}
      initialImport={pendingImport}
      onInitialImportUsed={() => setPendingImport(null)}
      onAddReferences={async () => { const added = await pickImages(true); if (added.length) changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, added) })) })); return added; }}
      onRemoveReference={path => { changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: s.referenceImages.filter(image => image.path !== path), work: s.work ? { ...s.work, references: s.work.references.filter(reference => reference.image?.path !== path), activeLayerId: s.work.activeLayerId.startsWith('ref-') && s.work.references.some(reference => reference.id === s.work!.activeLayerId && reference.image?.path === path) ? 'draw-1' : s.work.activeLayerId } : undefined })) })); }}
      onSave={(payload, dialogue, complete) => {
        const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!;
        const { finalImage, work } = savePainterWork(payload, latest.referenceImages);
        // The moving file is only rebuilt when the painter sent one, so a still cut stays still
        // and a failed encode never replaces a good loop with nothing.
        const motion = payload.motion ?? undefined;
        let motionImage = latest.motionImage, submitImage = latest.submitImage;
        if (!motion) { motionImage = undefined; submitImage = undefined; }
        else if (payload.gif?.data) {
          try { motionImage = saveMotionLoop(payload.gif.data); } catch (e) { console.warn(e); setNotice('움직이는 파일을 만들지 못했어요. 그림은 저장했어요.'); }
          if (payload.gif.webp) { try { submitImage = saveSubmitLoop(payload.gif.webp); } catch (e) { console.warn(e); submitImage = undefined; setNotice('WebP를 만들지 못했어요. 그림과 움직임은 저장했어요.'); } }
          else submitImage = undefined;
        }
        // 공식 도구에 넘길 PNG 프레임은 여기서 만들지 않는다. 내보낼 때 지금 그림·움직임에서 새로 만든다.
        return saveFinal(finalImage, work, dialogue, complete, motion, motionImage, submitImage);
      }}
      onShare={async () => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; if (!latest.finalImage || !await Sharing.isAvailableAsync()) throw new Error('공유할 이미지가 없거나 공유 기능을 사용할 수 없습니다.'); await Sharing.shareAsync(imageUri(latest.finalImage.path), { mimeType: 'image/png', UTI: 'public.png' }); }} />}
  </SafeAreaView>;
}

// 결제 상태. 팝업을 띄우지 않고 PRO 화면 안에 카드 한 장으로 놓는다 — 기능 목록과 같은 모양(둥근 아이콘 + 굵은 한 줄 + 설명).
// 스토어 오류 코드는 보여 주지 않는다. 할 일이 있으면 글자 버튼 하나만 둔다.
type Payment = { phase: 'idle' | 'loading' | 'ready' | 'unavailable' | 'buying' | 'restoring' | 'bought' | 'restored' | 'cancelled' | 'pending' | 'none' | 'failed'; problem?: PaymentProblem | 'save' };
type PaymentView = { tone: 'plain' | 'good' | 'warn'; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; next?: string; action?: 'restore' | 'retry' };
function paymentView(payment: Payment): PaymentView | null {
  switch (payment.phase) {
    case 'loading': return { tone: 'plain', icon: 'progress-clock', title: '스토어 가격을 불러오는 중이에요' };
    case 'buying': return { tone: 'plain', icon: 'credit-card-outline', title: '결제 창에서 결제를 마쳐 주세요', next: '결제가 끝나면 이 화면에서 바로 PRO가 켜져요.' };
    case 'restoring': return { tone: 'plain', icon: 'history', title: '구매 내역을 확인하는 중이에요' };
    case 'bought': return { tone: 'good', icon: 'check-circle-outline', title: 'PRO를 시작했어요', next: '부분 움직임, 여러 칸 한 번에, 고급 브러시를 바로 쓸 수 있어요.' };
    case 'restored': return { tone: 'good', icon: 'check-circle-outline', title: 'PRO를 다시 켰어요', next: '이 기기에서도 PRO 기능을 쓸 수 있어요.' };
    case 'cancelled': return { tone: 'plain', icon: 'close-circle-outline', title: '결제를 취소했어요', next: '결제는 진행되지 않았어요. 언제든 다시 시작할 수 있어요.' };
    case 'pending': return { tone: 'plain', icon: 'timer-sand', title: '결제를 처리하는 중이에요', next: '스토어에서 결제가 끝나면 구매 복원을 눌러 주세요.', action: 'restore' };
    case 'none': return { tone: 'plain', icon: 'magnify', title: '복원할 구매가 없어요', next: '지금 Play 스토어 계정에서 구매한 PRO를 찾지 못했어요. 다른 계정으로 구매했다면 그 계정으로 바꿔 주세요.' };
    case 'unavailable': case 'failed': { const t = problemText(payment.problem ?? 'unknown'); return { tone: 'warn', icon: 'alert-circle-outline', title: t.title, next: t.next, action: t.action }; }
    default: return null;
  }
}
function PaymentStatus({ payment, onRestore, onRetry }: { payment: Payment; onRestore: () => void; onRetry: () => void }) {
  const view = paymentView(payment);
  if (!view) return null;
  const good = view.tone === 'good';
  return <View testID="결제 상태" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: good ? '#CFE8D8' : T.line, backgroundColor: good ? T.successSoft : T.paper }}>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: good ? T.paper : view.tone === 'warn' ? T.warningSoft : T.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={view.icon} size={19} color={view.tone === 'warn' ? T.warning : good ? T.success : T.ink} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink }}>{view.title}</Text>
      {!!view.next && <Text style={{ fontSize: 12, color: T.muted, lineHeight: 18 }}>{view.next}</Text>}
      {!!view.action && <Pressable accessibilityRole="button" accessibilityLabel={view.action === 'restore' ? '안내에서 구매 복원' : '다시 시도'} onPress={view.action === 'restore' ? onRestore : onRetry}
        style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: T.ink, textDecorationLine: 'underline' }}>{view.action === 'restore' ? '구매 복원' : '다시 시도'}</Text>
      </Pressable>}
    </View>
  </View>;
}
