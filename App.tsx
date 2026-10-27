import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, BackHandler, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, Image, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { rewardedUnit, showRewarded } from './src/services/ads';
import { t } from './src/i18n/index';
import { purchasesClosed, PURCHASES_CLOSED_NOTE } from './src/services/purchase-config';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Action, AssetSlot, CompleteCard, Dialog, Elev, EmptyState, Field, IconButton, ProBadge, ProTag, Range, Segmented, StatusDot, STATUS_TONE, styles, T, Type, userMessage, Pop, Font, Card, Glyph, Clay } from './src/components/ui';
import { Rise, HopStage, FillBar, Shine } from './src/components/motion-fx';
import { ImtiIcon, IconSize, type IconName as ImtiName } from './src/design/icons';
import { ASSET_SLOTS, EXPRESSION_GUIDE, HOME_NOTICE, type ExpressionExample, type ExpressionGuideCard } from './src/design/asset-slots';
import { ImageAnalyzer, type Analyzer } from './src/components/image-analyzer';
import { MotionBaker, type Baker } from './src/components/motion-baker';
import { ExtraComposer, placeInFrame, type Composer } from './src/components/extra-composer';
import { Painter, CATALOG, type CopiedWork, type Tool } from './src/painter/painter';
import { isProPreset } from './src/motion-math';
import { KAKAO_ANIMATED_SPEC, KAKAO_STATIC_SPEC as SPEC, STAGES, WEBP_TOOL_RULE, WEBP_ANIMATOR_URL, REQUIRED_EXTRAS } from './src/constants/kakao-spec';
import { TRASH_DAYS, inTrash, trashExpired, captionText, createProject, doneCount, usesPro, droppedImagePaths, setIssues, isAnimated, isDone, isWorking, nextUnfinished, previousDrawn, reorderSlots, setIsAnimated, DEFAULT_MOTION } from './src/project';
import { cutFile, deleteLocalImages, exportFile, exportUri, listExports, migrateExports, removeExports, imageUri, inspectStore, localFile, loadStore, readPickedFile, saveStore, type StoreReport } from './src/services/storage';
import { restoreBackup, writeBackup } from './src/services/backup';
import { isFullBackup, restoreFullBackup, writeFullBackup } from './src/services/full-backup';
import { CloudScreen } from './src/components/cloud-screen';
import { TabBar, type HomeTab } from './src/components/tab-bar';
import { NoticeCarousel, type NoticeSlide } from './src/components/notice-carousel';
import { ChatSim } from './src/components/chat-sim';
import { GUIDEBOOK } from './src/constants/guidebook';
import { LESSONS, LESSON_GROUPS, type LessonAction } from './src/constants/lessons';
import { LessonView } from './src/components/lesson-view';
import { ArtistNameScreen, StartScreen } from './src/components/onboarding';
import { appCloud, cloudConfig } from './src/services/cloud/firebase';
import { artistNameFormat, authBase, checkArtistName, providerReady, register, setArtistName, signInWithApple, signInWithBrowser, warmUp, WARM_ARTIST_CALLS, WARM_LOGIN, WARM_LOGIN_CALLS, type Provider } from './src/services/cloud/account';
import { openContests } from './src/services/cloud/contest';
import * as WebBrowser from 'expo-web-browser';
import { getRandomBytes, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';
import { assembleApng, inspectPng, LINE_SPEC, LINE_STICKER, lineCuts, lineName, lineProblems, linePlan, lineZip, shrinkSteps, type LineFile } from './src/services/line-export';
import { exportSet, decodeDataUrl, fileStamp, safeName, type HandoffFrames, exportFormatSummary } from './src/services/export';
import { dataUrl, importBundledImage, pickImages, savePainterWork, saveMotionLoop, saveSubmitLoop, saveCutout } from './src/services/images';
import { identicalFinalsAsync, finalsKey, inspectImage } from './src/services/qa';
import { PLANS, REVIEW_BUILD_NOTE, REVIEW_DEV_NOTE, entitlementLabel, expiredButRemembered, internalReviewBuild, isPro, problemText, proTrial, PRO_TRIAL_NOTE, purchase, purchaseHistoryUrl, refreshEntitlement, restore, reviewCapable, reviewEnvLabel, reviewUnlocked, storePrices, subscriptionManageUrl, type PaymentProblem, type PurchaseOutcome } from './src/services/pro';
import { PRESETS } from './src/painter/motion-panel';
import type { Check, LocalImage, Motion, Project, SavedMotion, Slot, Store, QA, PainterWork } from './src/types';

// 45.43 S8: 상태 글자·점 색도 승인 팔레트 안에서(보라 없음). 경고·실패는 글자로 읽혀야 하므로 대비가 되는 짙은 토큰(흰 면 4.5:1 이상)을 쓴다.
const colors: Record<string, string> = { PASS: T.success, WARNING: T.warning, FAIL: T.danger, EMPTY: T.faint, DRAWING: T.ink, REVIEW: T.muted, PLANNED: T.success };
const C = T;
const proBrushes = CATALOG.filter(b => b.pro);
const proMotions = PRESETS.filter(p => isProPreset(p.id));
const proFeatures = [
  [`PRO 움직임 ${proMotions.length}종`, proMotions.map(p => p.label).join(' · '), 'motion'],
  ['부분만 움직이기 · 두 모습 번갈아', '손·새싹 잎·소품처럼 원하는 곳만 따로, 차례로', 'layer'],
  ['여러 칸에 같은 움직임 한 번에', '보관한 움직임을 고른 칸 전부에', 'check'],
  [`PRO 브러시 ${proBrushes.length}종`, proBrushes.map(b => b.title).join(' · '), 'brush'],
] as const;
// 설정 화면에 보여 줄 앱 버전. app.json 의 값을 그대로 읽는다.
const appVersion = Constants.expoConfig?.version ?? '—';
// 감정 카드의 대표 그림을 꺼낸다. 홈 미리보기와 감정 목록이 같은 규칙을 쓴다.
// 카드 위에 보여 줄 그림. 표시용이 있으면 그것을 쓴다 — 몸 안이 흰색이라 카드 색이 캐릭터로 비치지 않는다.
// 밑그림으로 깔 때는 이 함수를 쓰지 않는다(원본 artwork 그대로).
const shownArt = (x?: { artwork?: ImageSourcePropType; display?: ImageSourcePropType } | null) => x?.display ?? x?.artwork ?? null;
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
// 화면 방향(2026-10-10, Play 발견 항목 '대형 화면 크기 조절·방향 제한'): 설정 파일에서 세로 고정을 걷고, 휴대폰(짧은 변 600dp 미만)만 실행 중 세로로 잠근다.
// 태블릿·폴더블 펼침은 가로·세로 모두 — Android 16 은 큰 화면에서 세로 고정을 어차피 무시한다.
function lockPhonePortrait() {
  const screen = Dimensions?.get?.('screen'); if (!screen) return;   // 검사 대역에는 Dimensions 가 없다
  const { width, height } = screen;
  const lock = Math.min(width, height) < 600 ? ScreenOrientation.OrientationLock.PORTRAIT_UP : ScreenOrientation.OrientationLock.DEFAULT;
  ScreenOrientation.lockAsync(lock).catch(() => { /* 잠그지 못해도 앱은 그대로 쓴다 */ });
}
const CONTENT_MAX = 720;
export default function App() {
  useEffect(() => { lockPhonePortrait(); const sub = Dimensions?.addEventListener?.('change', lockPhonePortrait); return () => sub?.remove(); }, []);
  return <SafeAreaProvider><Studio /></SafeAreaProvider>;
}
function Studio() {
  const [store, setStore] = useState<Store | null>(null), current = useRef<Store | null>(null);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  // What the files on this device actually looked like. Kept so a failure can be read here
  // instead of guessed at, and so nothing has to be deleted to find out.
  const [report, setReport] = useState<StoreReport | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null), [slotNumber, setSlotNumber] = useState<number | null>(null), [canonOpen, setCanonOpen] = useState(false), [painting, setPainting] = useState(false);
  const [checkedFinals, setCheckedFinals] = useState<Record<string, { key: string; groups: number[][]; error?: boolean }>>({});
  useEffect(() => {
    let cancelled = false;
    for (const p of store?.projects ?? []) {
      if (inTrash(p)) continue;
      const key = finalsKey(p);
      void identicalFinalsAsync(p).then(groups => {
        if (!cancelled) setCheckedFinals(old => ({ ...old, [p.id]: { key, groups } }));
      }).catch(() => {
        if (!cancelled) setCheckedFinals(old => ({ ...old, [p.id]: { key, groups: [], error: true } }));
      });
    }
    return () => { cancelled = true; };
  }, [store, projectId]);
  const [busy, setBusy] = useState('');
  const [menu, setMenu] = useState(false);
  // 명세 H03: 새 세트는 이름을 확인하고 만든다. 이 값이 있는 동안에도 저장소는 그대로다 — '만들기'를 눌러야 세트가 생긴다.
  const [newSetName, setNewSetName] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null), [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false), [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  // 세트 관리의 이름 칸, 전체 작업의 검색·분류·정렬(45.38).
  const [managedName, setManagedName] = useState('');
  // 표현 가이드의 목적지(45.38): null = 가장 최근 세트(예전과 같다), 'new' = 새 세트, 그 밖에는 고른 세트 id.
  const [guideTargetId, setGuideTargetId] = useState<string | null>(null), [guideTargetPick, setGuideTargetPick] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'working' | 'done'>('all');
  const [projectOrder, setProjectOrder] = useState<'recent' | 'name'>('recent');
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
  // 비공개 테스트 PRO 체험 빌드에서는 같은 홈 공지 자리(승인된 한 줄 배너)에 체험 안내를 둔다 — 팝업이 아니라 늘 보이는 한 줄이고,
  // 누르면 PRO 화면(전체 안내)이 열린다. 체험이 아닌 빌드에서는 기존 공지 규칙 그대로다.
  const trialNotice = proTrial();
  const homeNotice = trialNotice ? { title: 'PRO 무료 체험 중 · 비공개 테스트', body: '정식 출시 시 일부 기능은 별도 구매가 필요해요', link: undefined } : HOME_NOTICE;
  const noticeOn = trialNotice || HOME_NOTICE.enabled || (reviewCapable() && noticePreview);
  const [prepOpen, setPrepOpen] = useState(false); // 제출 준비는 묶음을 만든 뒤 보는 일이라 접어 둔다(45.2차).
  // 부가 이미지 만들기. 고른 컷을 프레임 안에서 옮기고 키우기만 한다 — 원본 컷은 건드리지 않는다.
  const [extraKind, setExtraKind] = useState<'icon' | 'share' | 'cover'>('icon');
  const [extraSlot, setExtraSlot] = useState<number | null>(null);
  const [place, setPlace] = useState({ scale: 1, dx: 0, dy: 0 });
  const composer = useRef<Composer>(null);
  // 2026-10-08 토스식 개편: 첫 화면은 아래 탭 세 갈래(홈 · 공모전 · 내 정보). 예전 '설정' 창은 '내 정보' 탭이 되었다 —
  // settings 는 그 탭이 열려 있는지의 별명이고, 다른 화면으로 가며 부르던 setSettings(false) 는 탭을 바꾸지 않는다.
  const [homeTab, setHomeTab] = useState<HomeTab>('home');
  // 그리기 화면에서 '강좌에서 배워요'를 누르면 저장·닫기 뒤 강좌 탭으로 간다.
  const lessonsNext = useRef(false);
  // 로그인 관문(2026-10-08 사용자 결정: 무료·유료 모두 로그인 + 작가명). 서버 설정이 있는 빌드에서만 닫는다 —
  // authUid: undefined = 기기에 남은 로그인을 되살리는 중, null = 로그인 전. artist: undefined = 모름(오프라인 등, 막지 않는다), null = 아직 안 정함.
  const [startOpen, setStartOpen] = useState(false);
  const [authUid, setAuthUid] = useState<string | null | undefined>(undefined);
  const [artist, setArtist] = useState<string | null | undefined>(undefined);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [homeContest, setHomeContest] = useState<{ title: string; dday: string } | null>(null);
  const settings = homeTab === 'my';
  const setSettings = (open: boolean) => { if (open) setHomeTab('my'); };
  // 설정 › 내보낸 파일(2026-10-06): 이미 다른 앱으로 보낸 사본(exports/)의 개수·크기. 사용자가 확인할 때만 지운다.
  const [exportsConfirm, setExportsConfirm] = useState<{ name: string; bytes: number }[] | null>(null);
  // 전체 백업에서 되살린 결과(2026-10-07): 들어온 것 · 보관 칸이 차서 못 넣은 것 · 지금 값을 지킨 설정 · 백업에 없는 것을 한 창에서 말한다.
  const [restoreReport, setRestoreReport] = useState<{ done: string[]; missed: string[]; kept: string[] } | null>(null);
  // vc4(2026-10-07): 계정·클라우드. 앱 설정(extra.cloud)에 서버 설정이 있을 때만 연결한다 — 없으면 null 이고 화면은 '준비 중'만 보인다.
  const [cloudOpen, setCloudOpen] = useState(false);
  const cloud = useRef(appCloud(cloudConfig(Constants.expoConfig?.extra))).current;
  // 시스템 브라우저로 서버 로그인 중계(/auth/start)를 연다. 서버 설정이 없는 빌드(cloud=null)에서는 부르지 않는다.
  // 로그인 결과의 작가명을 바로 쓴다 — 로그인 직후 서버(registerUser)를 한 번 더 기다리지 않고 작가명/홈 화면으로 간다.
  const loginWith = async (provider: Provider) => { const config = cloudConfig(Constants.expoConfig?.extra); if (!cloud || !config) return;
    const r = await signInWithBrowser(cloud, provider, { base: authBase(config), open: (url, ret) => WebBrowser.openAuthSessionAsync(url, ret), randomBytes: getRandomBytes });
    if (r && r.artistName !== undefined) setArtist(r.artistName); };   // 옛 서버(작가명을 안 줌)면 registerUser 결과를 기다린다
  // Apple 로그인(iOS 전용, 2026-10-27): 시스템 Apple 창 → 서버 exchangeApple. 이메일·이름 범위는 요청하지 않는다.
  const loginApple = async () => { if (!cloud) return;
    const r = await signInWithApple(cloud, { randomBytes: getRandomBytes, sha256: s => digestStringAsync(CryptoDigestAlgorithm.SHA256, s),
      signIn: nonce => AppleAuthentication.signInAsync({ nonce, requestedScopes: [] }) });
    if (r && r.artistName !== undefined) setArtist(r.artistName); };
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => { if (Platform.OS === 'ios' && cloud) AppleAuthentication.isAvailableAsync().then(setAppleReady).catch(() => setAppleReady(false)); }, [cloud]);
  useEffect(() => { if (!cloud) return;
    return cloud.onAuth(uid => { setAuthUid(uid); setArtist(undefined);
      if (uid) register(cloud).then(u => setArtist(u.artistName ?? null)).catch(() => setArtist(undefined)); }); }, [cloud]);
  // 시작 화면·작가명 화면이 열리면 그다음에 거칠 서버 단계를 미리 깨운다(처음 깨는 데 단계마다 약 2초 — 실기기 '로그인 렉').
  useEffect(() => { const config = cloudConfig(Constants.expoConfig?.extra); if (!cloud || !config) return;
    if (authUid === null) warmUp(config, WARM_LOGIN, [...WARM_LOGIN_CALLS, ...WARM_ARTIST_CALLS]);
    else if (authUid && artist === null) warmUp(config, [], WARM_ARTIST_CALLS); }, [cloud, authUid, artist]);
  // 구매 확인 서버에 로그인 증명을 함께 보낸다(한 구매 = 한 계정). 서버 설정이 없는 빌드는 null.
  // 서버 연결 빌드에서만 로그인 증명을 함께 보낸다. 증명이 아직 없으면 확인을 미룬다(pro.ts confirm).
  const payOpts = cloud ? { authToken: () => cloud.idToken() } : {};
  const finishStart = () => { setStartOpen(false); if (store && !store.introDone) { try { commit(st => ({ ...st, introDone: true })); } catch { /* 다음 실행에 다시 보일 뿐 */ } } };
  const startLogin = (provider: Provider | 'apple') => { setLoginError(''); setLoginBusy(true);
    (provider === 'apple' ? loginApple() : loginWith(provider)).then(() => finishStart()).catch(e => setLoginError(String((e as Error).message ?? e))).finally(() => setLoginBusy(false)); };
  // 홈 공지 줄의 공모전: 서버가 있을 때만, 접수 중인 것 하나. 실패하면 조용히 없음(홈을 막지 않는다).
  useEffect(() => { if (!cloud) return; let alive = true;
    openContests(cloud).then(list => { const c = list.find(x => x.status === 'open'); if (!alive) return;
      if (!c) { setHomeContest(null); return; }
      const days = Math.ceil((Number(c.endsAt) - Date.now()) / 864e5);
      setHomeContest({ title: c.title, dday: Number.isFinite(days) && days >= 0 ? (days === 0 ? 'D-DAY' : 'D-' + days) : '' }); }).catch(() => {});
    return () => { alive = false; }; }, [cloud]);
  // 첫 실행 사용 안내(2026-10-05): 그리기 → 움직이기 → 저장·내보내기 세 장. 새 사용자(세트 없음 · introDone 없음)에게 한 번만,
  // 건너뛰기·다 보기 모두 introDone 을 남겨 다시 뜨지 않는다. 설정의 '사용 안내 다시 보기'로 언제든 다시 연다(저장값은 바꾸지 않음).
  const [introStep, setIntroStep] = useState<number | null>(null);
  const introOffered = useRef(false);
  const [contactFallback, setContactFallback] = useState(false);
  const privacyUrl = Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined;
  const supportEmail = Constants.expoConfig?.extra?.supportEmail as string | undefined;
  async function openSupport() {
    if (!supportEmail) return;
    const subject = encodeURIComponent('[emoti 이모티] 문의');
    const body = encodeURIComponent(`앱 버전: ${appVersion}\nOS: ${Platform.OS} ${Platform.Version}`);
    try { await Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${body}`); }
    catch { setContactFallback(true); }
  }
  // 홈 아래 두 화면(44차): 전체 작업(여러 세트 찾기·다시 열기)과 표현 가이드("무엇을 그릴까?"). 세트 안 칸 관리는 보드가 맡는다.
  const [homeView, setHomeView] = useState<'home' | 'all' | 'guide' | 'book' | 'lesson'>('home');
  const [lessonGroup, setLessonGroup] = useState<string>('all');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState<string | null>(null);
  // 채팅에서 써 보기(2026-10-13): 보드에서 연다. 세트별 — 이 세트에서 그린 칸만 이모티콘 판에 나온다.
  const [chatOpen, setChatOpen] = useState(false);
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
  // 45.43: 가이드·'내 그림으로 시작'의 그림은 **고른 그 칸**('세트id/칸')에만 쓴다. 다른 칸·다른 세트로 열리는 그리기에는 넘어가지 않는다.
  // 예전에는 '완성 · 다음'이 가이드 예시를 지우지 않아, 다음 빈 칸에 같은 참고 창·밑그림이 저절로 다시 열렸다.
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const clearEntry = () => { setGuideHint(null); setGuideExample(null); setGuideExampleMode(null); setPendingImport(null); setEntryFor(null); };
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
  const [prices, setPrices] = useState<{ lifetime?: string; regular?: string; percent?: number } | null>(null);
  const resetPayment = () => setPayment({ phase: 'idle' });
  const entitlement = store?.entitlement;
  // 내부 검수 빌드에서만 검수용 해제가 함께 인정된다. 출시 구성에서는 reviewUnlocked() 가 늘 거짓이라
  // 저장소에 값이 남아 있어도 효력이 없다 — 검수하며 만든 작품은 남고, 권한만 따라오지 않는다.
  // 비공개 테스트 PRO 체험(구매 닫힘 빌드 전용 빌드 값)도 같은 자리에서 인정한다. 저장소에 아무것도 쓰지 않으므로
  // 정식 빌드로 업데이트하면 사라지고 실제 구매(isPro)만 남는다. 구매 기록과 섞이지 않는다.
  const trial = proTrial();
  const pro = isPro(entitlement) || reviewUnlocked(store ?? undefined) || trial;
  // 이 빌드의 보상형 광고 단위(없으면 광고 없음). src/services/ads.ts
  const adUnit = rewardedUnit(Constants.expoConfig?.extra as Parameters<typeof rewardedUnit>[0]);
  // 첫 실행 안내: 저장소를 읽은 뒤 한 번만 판단한다. 세트가 하나라도 있으면(기존 사용자·백업 복원) 띄우지 않는다.
  useEffect(() => {
    if (!store || introOffered.current) return;
    introOffered.current = true;
    // 2026-10-08: 새 사용자의 첫 화면은 3장 안내 창이 아니라 '첫 실행 한 장'(StartScreen). 3장 안내는 내 정보 › 사용 안내 다시 보기.
    if (!store.introDone && store.projects.length === 0) setStartOpen(true);
  }, [store]);
  // 앱을 열 때 한 번, 저장된 이용권을 스토어와 영수증 서버에 다시 묻는다. 물어볼 수 없으면 그대로 둔다.
  const rechecked = useRef(false);
  useEffect(() => {
    if (!store || rechecked.current) return;
    rechecked.current = true;
    void refreshEntitlement(store.entitlement, payOpts).then(result => {
      if (result.state !== 'updated') return;
      try { commit(st => ({ ...st, entitlement: result.entitlement })); } catch { /* 저장 실패는 배너가 말하고, 다음 실행에서 다시 묻는다 */ }
    }).catch(() => { /* 묻지 못한 것은 '아니다'라는 대답이 아니다 */ });
  }, [store]);
  // PRO 화면을 열면 스토어의 실제 가격을 불러온다. 못 불러오면 제안가를 그대로 두고 왜 결제할 수 없는지 말한다.
  async function loadPrices() {
    if (purchasesClosed()) return;
    setPayment({ phase: 'loading' });
    const result = await storePrices();
    if (result.state === 'ok') {
      const lifetime = result.products.find(p => p.plan === 'lifetime');
      setPrices({ lifetime: lifetime?.localizedPrice, regular: lifetime?.regularPrice, percent: lifetime?.discountPercent });
      setPayment(now => now.phase === 'loading' ? { phase: 'ready' } : now);
    } else {
      setPrices(null);
      setPayment(now => now.phase === 'loading' ? { phase: 'unavailable', problem: result.problem } : now);
    }
  }
  useEffect(() => { if (proSheet) void loadPrices(); }, [proSheet]);
  // 큰 화면(태블릿·폴더블·가로, 2026-10-10): 내용 폭을 720dp 로 묶어 가운데 둔다 — 카드가 화면 끝까지 늘어나지 않게. 칸 수·크기도 이 폭으로 센다.
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = Math.min(windowWidth, CONTENT_MAX);
  // 폰 4열(2026-10-08 토스식 개편 · 캔버스 U-Board) / 좁은 폰 3열 / 태블릿 6~8열. 칸 자체가 커지는 것이 아니라 한 화면에 더 들어간다.
  const columns = screenWidth >= 900 ? 8 : screenWidth >= 600 ? 6 : screenWidth < 340 ? 3 : 4;
  const tileWidth = (screenWidth - T.gap.lg * 2 - T.gap.sm * (columns - 1)) / columns;
  const projectCardWidth = (screenWidth - T.gap.lg * 2 - T.gap.md) / 2;
  const analyzer = useRef<Analyzer>(null), baker = useRef<Baker>(null);
  function load() {
    try {
      const result = loadStore();
      current.current = result.store; setStore(result.store); setLoadError(''); setReport(result.report);
      if (result.recovered) setNotice('저장 파일 하나가 손상돼 다른 사본으로 열었어요. 손상된 파일도 지우지 않았어요.');
      // 예전 빌드가 앱 폴더 바로 아래 둔 내보낸 사본을 exports/ 로 옮긴다(지우지 않는다, 실패해도 다음 실행에 다시).
      migrateExports().catch(() => {});
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
  // 휴지통에서 TRASH_DAYS(30)일이 지난 세트는 앱이 저장소를 읽은 뒤 한 번 영구 삭제한다(45.38). 실패해도 다음 실행에 다시 한다.
  const purgedOnce = useRef(false);
  useEffect(() => {
    if (!store || purgedOnce.current) return;
    purgedOnce.current = true;
    if (!store.projects.some(p => trashExpired(p))) return;
    try { commit(st => ({ ...st, projects: st.projects.filter(p => !trashExpired(p)) })); } catch { /* 저장 실패는 배너가 말한다 */ }
  }, [store]);
  function changeProject(id: string, transform: (p: Project) => Project) { commit(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...transform(p), updatedAt: new Date().toISOString() } : p) })); }
  function updateProject(transform: (p: Project) => Project) { if (projectId) { try { changeProject(projectId, transform); } catch { /* Keep unsaved state with persistent retry banner. */ } } }
  const project = store?.projects.find(p => p.id === projectId), slot = project?.slots.find(s => s.number === slotNumber);
  // 지금 열린 칸이 가이드·가져온 그림을 고른 바로 그 칸인가(45.43). 아니면 그리기는 빈 캔버스로 연다.
  const entryHere = !!project && !!slot && entryFor === project.id + '/' + slot.number;
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
  // 내보내기 검수의 '손볼 곳'에서 들어온 칸은 저장하면 그 검수 화면으로 돌아간다(45.38).
  // 예전에는 다음 미완성 칸이 남아 있으면 그 칸으로 넘어가, 검수 중이던 흐름을 잃었다.
  function returnToReview() {
    setPainting(false); setSlotNumber(null); clearEntry();
    setScreen('export'); setReturnToExport(false);
  }
  function completeAndNext() {
    if (returnToExport) { returnToReview(); return; }
    const latest = current.current?.projects.find(p => p.id === projectId);
    if (!latest || slotNumber === null) return;
    const next = nextUnfinished(latest, slotNumber);
    clearEntry();
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
    return { layers, caption: source.work.caption, motion: source.motion ?? null };
  }

  // 겹치지 않는 기본 이름. 예전부터 쓰던 규칙 그대로다.
  function defaultSetName() {
    const taken = new Set((current.current?.projects ?? []).map(p => p.projectName));
    let name = '새 이모티콘 세트';
    for (let n = 2; taken.has(name); n++) name = `새 이모티콘 세트 ${n}`;
    return name;
  }
  // 실제로 세트를 만들어 1번 칸을 연다. 저장 의미는 예전과 같다(칸 수·기본값 불변).
  // fromGuide: 가이드에서 고른 표현으로 새 세트를 만든 경우에만 그 가이드를 1번 칸에 쓴다. 일반 새 세트는 빈 캔버스로 연다.
  function createProjectNow(name: string, fromGuide = false) {
    const p = createProject(name.trim() || defaultSetName(), '');
    try { commit(s => ({ ...s, projects: [...s.projects, p] })); setNewSetName(null); setProjectId(p.id); setScreen('board'); setSlotNumber(1); setPainting(true); setEntryFor(fromGuide ? p.id + '/1' : null); }
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
    // 목적지: 사용자가 고른 세트, 없으면 가장 최근 세트. '새 세트'를 골랐으면 새로 만든다.
    const target = guideTargetId === 'new' ? undefined : sortedProjects.find(p => p.id === guideTargetId) ?? sortedProjects[0];
    setGuideTargetId(null);
    if (!target) { createProjectNow(defaultSetName(), true); return; }
    const open = nextUnfinished(target, target.lastSlot ?? 0);
    setProjectId(target.id); setScreen('board');
    // 칸이 다 찬 세트에서는 완성한 칸을 대신 열지 않는다 — 보드를 보여 주고 고를 사람에게 맡긴다(45.1차).
    if (open === null) { clearEntry(); setNotice('이 세트는 칸이 다 찼어요. 고칠 칸을 고르거나 새 이모티콘 세트를 만들어 주세요.'); return; }
    setSlotNumber(open); setPainting(true); setEntryFor(target.id + '/' + open);
  }
  function startFromImage() {
    void task('그림을 여는 중…', async () => {
      const picked = await pickImages();
      if (!picked[0]) return;
      const data = await dataUrl(picked[0]);
      const p = createProject(defaultSetName(), '');
      commit(s => ({ ...s, projects: [...s.projects, p] }));
      setPendingImport(data); setEntryFor(p.id + '/1'); setProjectId(p.id); setScreen('board'); setSlotNumber(1); setPainting(true);
    });
  }
  function drawFrom(number?: number) {
    if (!project) return;
    const target = number ?? nextUnfinished(project, project.lastSlot ?? 0) ?? project.lastSlot ?? 1;
    setScreen('board'); setSlotNumber(target); setPainting(true);
  }
  // 세트 삭제는 휴지통으로 옮기는 것이다(45.38). 예전에는 확인창 한 번 뒤 그림 파일까지 바로 지워져 되돌릴 수 없었다.
  // 휴지통의 세트는 목록에서만 빠지고 그림 파일은 그대로 남는다(저장소가 아직 그 파일을 가리키므로 정리 대상이 아니다).
  function deleteProject(id: string) {
    const target = current.current?.projects.find(p => p.id === id);
    if (!target) return;
    try { commit(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p) })); }
    catch (e) { Alert.alert('휴지통으로 옮기지 못했어요', userMessage(e)); return; }
    if (id === projectId) { setProjectId(null); setSlotNumber(null); setCanonOpen(false); }
    setConfirmDeleteId(null); setManageId(null);
    setNotice(`${target.projectName} 세트를 휴지통으로 옮겼어요. ${TRASH_DAYS}일 안에 되살릴 수 있어요.`);
  }
  // 세트 백업(45.38): 세트 하나를 파일 하나로 만들어 공유 창으로 넘긴다. 앱을 지우거나 기기를 바꿔도 이 파일로 되살린다.
  function backupProject(target: Project) {
    void task('백업 파일 만드는 중…', async () => {
      const made = writeBackup(target);
      const lost = made.missing ? ` 그림 ${made.missing}개는 이 기기에 이미 없어 빼고 만들었어요.` : '';
      if (!await Sharing.isAvailableAsync()) { setNotice(`백업 파일을 만들었어요(그림 ${made.images}개).${lost} 이 기기에서는 공유 창을 열 수 없어요.`); return; }
      await Sharing.shareAsync(exportUri(made.path), { mimeType: 'application/zip', UTI: 'public.zip', dialogTitle: '백업 파일 보관' });
      setNotice(`${target.projectName} 백업 파일을 만들었어요(그림 ${made.images}개).${lost} 공유 창에서 드라이브·메일 등 앱 밖에 보관해 주세요.`);
    });
  }
  // 전체 백업(2026-10-06): 모든 세트와 앱 설정을 파일 하나로. 구매 권한(PRO)은 담지 않는다.
  function backupAll() {
    void task('전체 백업 만드는 중…', async () => {
      if (!current.current) return;
      const made = writeFullBackup(current.current);
      const lost = made.missing ? ` 그림 ${made.missing}개는 이 기기에 이미 없어 빼고 만들었어요.` : '';
      if (!await Sharing.isAvailableAsync()) { setNotice(`전체 백업 파일을 만들었어요(세트 ${made.sets}개).${lost} 이 기기에서는 공유 창을 열 수 없어요.`); return; }
      await Sharing.shareAsync(exportUri(made.path), { mimeType: 'application/zip', UTI: 'public.zip', dialogTitle: '전체 백업 보관' });
      setNotice(`전체 백업 파일을 만들었어요(세트 ${made.sets}개 · 그림 ${made.images}개 · 설정 포함${made.trashed ? ` · 휴지통 세트 ${made.trashed}개 제외` : ''}).${lost} 공유 창에서 드라이브·메일 등 앱 밖에 보관해 주세요. PRO 구매는 백업에 들어가지 않고 구매 복원으로 돌아와요.`);
    });
  }
  // 백업에서 되살리기: 파일을 고르면 먼저 전부 검사하고, 통과하면 새 세트로 들인다. 같은 세트가 있으면 덮어쓰지 않고 사본으로.
  function restoreFromBackup() {
    void task('백업 확인하는 중…', async () => {
      // 문서 선택 모듈은 누를 때만 불러온다(네이티브 모듈 — 앱 시작과 검사 환경에 부담을 주지 않는다).
      const picker = require('expo-document-picker') as typeof import('expo-document-picker');
      const picked = await picker.getDocumentAsync({ type: ['application/zip', 'application/octet-stream', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.length) return;
      const bytes = readPickedFile(picked.assets[0].uri);
      // 전체 백업(2026-10-06)이면 세트·설정을 지금 것에 **더한다**. PRO 이용권은 파일에서 읽지 않는다(구매 복원으로만).
      if (isFullBackup(bytes)) {
        if (!current.current) return;
        let all;
        try { all = restoreFullBackup(bytes, current.current); }
        catch (e) { throw new Error(userMessage(e) + ' 기존 작품·설정은 바뀌지 않았어요.'); }
        commit(() => all.store);
        setSettings(false); setHomeView('all');
        const count = (n: number, what: string) => n ? [`${what} ${n}개`] : [];
        setRestoreReport({
          done: [`세트 ${all.sets}개(그림 ${all.images}개)${all.copies ? ` — 같은 세트 ${all.copies}개는 '(복원)' 사본으로` : ''}`, ...count(all.added.savedMotions, '보관한 움직임'), ...count(all.added.cutouts, '조각'), ...count(all.added.userPalette, '내 색'), ...count(all.added.palette, '최근 색')],
          missed: [...count(all.skipped.savedMotions, '보관한 움직임(최대 12개)'), ...count(all.skipped.cutouts, '조각(최대 40개)'), ...count(all.skipped.userPalette, '내 색(최대 48개)'), ...count(all.skipped.palette, '최근 색(최대 8개)')],
          kept: all.kept,
        });
        return;
      }
      let restored;
      try { restored = restoreBackup(bytes, current.current?.projects ?? []); }
      catch (e) { throw new Error(userMessage(e) + ' 기존 작품은 바뀌지 않았어요.'); }
      commit(s => ({ ...s, projects: [...s.projects, restored.project] }));
      setSettings(false); setHomeView('all');
      setNotice(`${restored.project.projectName} 세트를 되살렸어요(그림 ${restored.images}개)${restored.copy ? ' — 같은 세트가 있어 사본으로 넣었어요' : ''}.`);
    });
  }
  // 세트 관리에 이름 바꾸기·복제를 모은다(45.38). 예전에는 이름을 바꾸려면 '캐릭터 기준 · 세트 이름'으로 따로 들어가야 했다.
  function renameProject(id: string, name: string) {
    const next = name.trim();
    if (!next) return;
    try { changeProject(id, p => ({ ...p, projectName: next })); } catch (e) { Alert.alert('이름을 바꾸지 못했어요', userMessage(e)); return; }
    setManageId(null); setNotice(`세트 이름을 '${next}'(으)로 바꿨어요.`);
  }
  // 복제는 세트 정보만 새로 만든다. 그림 파일은 두 세트가 함께 가리킨다 — 편집은 늘 새 파일로 저장되고,
  // 한쪽을 지워도 다른 쪽이 가리키는 파일은 정리되지 않으므로(droppedImagePaths) 안전하다.
  function duplicateProject(id: string) {
    const source = current.current?.projects.find(p => p.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const taken = new Set((current.current?.projects ?? []).map(p => p.projectName));
    let name = source.projectName + ' 사본';
    for (let i = 2; taken.has(name); i++) name = `${source.projectName} 사본 ${i}`;
    const copy: Project = { ...JSON.parse(JSON.stringify(source)), id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, projectName: name, createdAt: now, updatedAt: now, deletedAt: undefined };
    try { commit(st => ({ ...st, projects: [...st.projects, copy] })); } catch (e) { Alert.alert('복제하지 못했어요', userMessage(e)); return; }
    setManageId(null); setNotice(`'${name}' 세트를 만들었어요.`);
  }
  function restoreProject(id: string) {
    const target = current.current?.projects.find(p => p.id === id);
    if (!target) return;
    try { commit(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, deletedAt: undefined, updatedAt: new Date().toISOString() } : p) })); }
    catch (e) { Alert.alert('되살리지 못했어요', userMessage(e)); return; }
    setNotice(`${target.projectName} 세트를 되살렸어요.`);
  }
  // 영구 삭제: 저장소에서 빼면 다른 곳이 가리키지 않는 그림 파일은 commit 이 정리한다(droppedImagePaths).
  function purgeProject(id: string) {
    const target = current.current?.projects.find(p => p.id === id);
    if (!target) return;
    try { commit(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) })); }
    catch (e) { Alert.alert('삭제하지 못했어요', userMessage(e)); return; }
    setConfirmPurgeId(null);
    setNotice(`${target.projectName} 세트를 영구 삭제했어요.`);
  }
  // A movement someone liked is kept at the store level, so it can be opened again from any cut of
  // any set. The name is made from the settings themselves: nobody has to invent one mid-drawing.
  function motionName(motion: Motion) {
    const preset = PRESETS.find(p => p.id === motion.preset)?.label;
    const parts = motion.parts?.length ? `부분 ${motion.parts.length}` : null;
    const pose = motion.alternate ? '두 모습' : null;
    const boil = motion.boil ? '떨림' : null;
    return [preset, parts, pose, boil].filter(Boolean).join(' · ') || '움직임';
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
  const projectFinals = project ? checkedFinals[project.id] : undefined;
  const issuesPending = !!project && projectFinals?.key !== finalsKey(project);
  const setChecks: Check[] = !project ? [] : setIssues(project, issuesPending ? [] : projectFinals?.groups);
  if (projectFinals?.error && !issuesPending) setChecks.push({ label: '그림 비교', status: 'WARNING', detail: '그림 파일을 비교하지 못했어요. 세트를 다시 열어 확인해 주세요.' });
  // A purchase only ever lands here, and only after the store and our receipt server both said yes.
  async function startPurchase() {
    if (purchasesClosed()) return;
    setPayment({ phase: 'buying' });
    settlePayment(await purchase(payOpts), 'bought');
  }
  async function restorePro() {
    if (purchasesClosed()) return;
    setPayment({ phase: 'restoring' });
    settlePayment(await restore(payOpts), 'restored');
  }
  function settlePayment(outcome: PurchaseOutcome, success: 'bought' | 'restored') {
    if (outcome.state === 'purchased') {
      try { commit(st => ({ ...st, entitlement: outcome.entitlement })); setPayment({ phase: success }); }
      catch { setPayment({ phase: 'failed', problem: 'save' }); }
      return;
    }
    if (outcome.state === 'failed') { setPayment({ phase: 'failed', problem: outcome.problem, reason: outcome.reason }); return; }
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
    // 칸마다 차례로 만든다. 진행 수를 그대로 보여 준다(45.38) — 예전에는 '만드는 중…' 한 줄뿐이라 멈춘 것처럼 보였다.
    const targets = target.slots.filter(slot => slot.work && (slot.motion || slot.work.frames) && isAnimated(slot));
    for (const [index, slot] of targets.entries()) {
      setBusy(`움직이는 칸 프레임 만드는 중 · ${index + 1}/${targets.length}칸`);
      try {
        // 장만 있고 효과가 없는 칸은 빈 움직임으로 굽는다(엔진이 이전 칸의 움직임을 이어 쓰지 않게 늘 무언가를 보낸다).
        const loop = await baker.current!.bake(slot.work!, slot.motion ?? DEFAULT_MOTION, true);
        const frames = (loop.sheets ?? []).map(decodeDataUrl);
        if (frames.length) handoff.push({ number: slot.number, frames, delayMs: loop.delayMs });
        else failed.push(slot.number);
      } catch { failed.push(slot.number); }
    }
    return { handoff, failed };
  }
  // 보상형 광고(2026-10-27): 무료 사용자가 파일 묶음을 만들기 전에 한 번. PRO·광고 단위 없는 빌드는 바로 통과.
  // 광고를 못 불러오면 막지 않는다. 끝까지 보지 않고 닫으면 이번엔 만들지 않는다.
  async function adGate(): Promise<boolean> {
    if (pro || !adUnit) return true;
    setBusy(t('export.adLoading'));
    const outcome = await showRewarded(adUnit);
    if (outcome === 'closed') { setNotice(t('export.adClosed')); return false; }
    return true;
  }
  function exportProject() {
    if (!project) return;
    // 화면·약속 문구는 모두 '파일 묶음'이다(38차). 움직이는 칸은 카카오 WebPAnimator 에서 마무리하므로
    // 앱이 '제출 파일'을 만들어 준다고 말하지 않는다 — PRO 화면의 무료 약속과 같은 말을 쓴다.
    void task('파일 묶음 만드는 중…', async () => {
      if (!await adGate()) return;
      const { handoff, failed } = await bakeHandoff(project);
      setBusy('파일 묶음 정리하는 중…');
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
  // LINE 움직이는 스티커 파일 묶음(2026-10-27, 글로벌 통합안 EM-G07). 카카오 묶음과 따로 만든다 — 카카오 경로는 그대로.
  // 움직이는 칸 8/16/24개 · 칸마다 270×270 APNG(1MB 넘으면 장 수를 줄여 다시) · 메인 240×240 APNG · 탭 96×74 PNG.
  // 규격에 하나라도 걸리면 묶지 않고 어느 칸이 왜 걸렸는지 말한다. LINE 등록·심사는 사용자가 직접 한다.
  function exportLine() {
    if (!project) return;
    const pick = lineCuts(project);
    if (!pick.size) { setNotice(t('line.needMoving', { n: pick.moving })); return; }
    void task(t('line.making'), async () => {
      if (!await adGate()) return;
      type Cut = typeof pick.cuts[number];
      const files: LineFile[] = [];
      const motionOf = (slot: Cut) => slot.motion ?? DEFAULT_MOTION;
      const apng = async (slot: Cut, w: number, h: number, kind: 'sticker' | 'main', name: string): Promise<LineFile> => {
        let made = await baker.current!.line(slot.work!, motionOf(slot), { w, h, count: 0 });
        let plan = linePlan(made.loop, made.count), data: Uint8Array = new Uint8Array(0), problems: string[] = [];
        if (!plan) return { name, data, kind, problems: [`한 바퀴가 4초를 넘어요(${made.loop.toFixed(1)}초) — 움직임 속도를 빠르게 해 주세요`] };
        for (const count of shrinkSteps(plan.frames)) {
          if (count !== made.count) { made = await baker.current!.line(slot.work!, motionOf(slot), { w, h, count }); plan = linePlan(made.loop, made.count)!; }
          data = assembleApng(made.sheets.map(decodeDataUrl), plan.delayMs, plan.plays);
          problems = lineProblems(inspectPng(data), kind);
          if (data.length <= LINE_SPEC.maxBytes) break;
        }
        return { name, data, kind, problems };
      };
      for (const [i, slot] of pick.cuts.entries()) {
        setBusy(t('line.progress', { i: i + 1, n: pick.cuts.length }));
        try { files.push(await apng(slot, LINE_STICKER.w, LINE_STICKER.h, 'sticker', lineName(i))); }
        catch (e) { files.push({ name: lineName(i), data: new Uint8Array(0), kind: 'sticker', problems: ['만들지 못했어요 · ' + userMessage(e)] }); }
      }
      setBusy(t('line.mainTab'));
      const first = pick.cuts[0];
      files.push(await apng(first, LINE_SPEC.main.w, LINE_SPEC.main.h, 'main', 'main.png'));
      const tab = await baker.current!.line(first.work!, motionOf(first), { w: LINE_SPEC.tab.w, h: LINE_SPEC.tab.h, count: 1, still: true });
      const tabData = decodeDataUrl(tab.sheets[0]);
      files.push({ name: 'tab.png', data: tabData, kind: 'tab', problems: lineProblems(inspectPng(tabData), 'tab') });
      const bad = files.filter(f => f.problems.length);
      if (bad.length) {
        const where = bad.map(f => f.kind === 'sticker' ? `${pad(pick.cuts[Number(f.name.slice(0, 2)) - 1].number)}번 칸(${f.problems.join(', ')})` : `${f.name}(${f.problems.join(', ')})`);
        setNotice('LINE 규격에 맞지 않는 칸이 있어 묶지 않았어요. ' + where.join(' · '));
        return;
      }
      const file = exportFile(`${safeName(project.projectName)}-LINE-${pick.size}-${fileStamp(new Date())}.zip`);
      file.write(lineZip(files));
      const skipped = pick.moving - pick.size!;
      const made = t('line.done', { n: pick.size! }) + (skipped ? ` 움직이는 칸 ${skipped}개는 ${pick.size}개 세트에 들어가지 않았어요.` : '') + (pick.stills.length ? ' 멈춘 칸은 빠져요.' : '');
      if (!await Sharing.isAvailableAsync()) { setNotice(`${made} 이 기기에서는 공유 창을 열 수 없어요.`); return; }
      await Sharing.shareAsync(exportUri(file.name), { mimeType: 'application/zip', UTI: 'public.zip' });
      setNotice(`${made} ${t('line.upload')}`);
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
  // 휴지통의 세트는 홈·전체 작업·표현 가이드의 대상에서 모두 빠진다(45.38).
  const sortedProjects = store ? store.projects.filter(p => !inTrash(p)).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')) : [];
  const managedLive = store?.projects.find(p => p.id === manageId);
  useEffect(() => { setManagedName(managedLive?.projectName ?? ''); }, [manageId]);
  // 전체 작업 목록: 이름 검색 · 작업 중/완성 분류 · 최근 수정순/이름순.
  const query = projectQuery.trim().toLocaleLowerCase();
  const visibleProjects = sortedProjects
    .filter(p => !query || p.projectName.toLocaleLowerCase().includes(query))
    .filter(p => projectFilter === 'all' || (projectFilter === 'done' ? doneCount(p) === p.slots.length : doneCount(p) < p.slots.length));
  if (projectOrder === 'name') visibleProjects.sort((a, b) => a.projectName.localeCompare(b.projectName, 'ko'));
  const trashed = store ? store.projects.filter(inTrash).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')) : [];
  const pendingPurge = store?.projects.find(p => p.id === confirmPurgeId);
  // 홈은 프로젝트 관리 화면이 아니라 시작 화면이다(45.5차): 가장 최근 세트 하나만 두고, 나머지는 전체 작업에서 관리한다.
  const HOME_RECENT = 1;
  // 강좌 끝의 '바로 해 보기'. 강좌가 가리키는 화면으로 바로 보낸다.
  function runLessonAction(a: LessonAction) {
    const latest = sortedProjects[0];
    setHomeView('home');
    if (a === 'newSet') { createNewProject(); return; }
    if (a === 'guide') { setHomeView('guide'); return; }
    if (a === 'book') { setHomeView('book'); return; }
    if (a === 'contest') { setHomeTab('contest'); return; }
    if (!latest) { createNewProject(); return; }
    setProjectId(latest.id);
    if (a === 'export') { setScreen('export'); return; }
    setScreen('board'); setSlotNumber(nextUnfinished(latest, latest.lastSlot ?? 0) ?? latest.lastSlot ?? 1); setPainting(true);
  }
  // 내 정보 탭의 줄들(예전 설정 창 내용 그대로 — 기능·이름을 바꾸지 않았다). 흰 카드 한 장에 담는다.
  const myRows = <View testID="내 정보 설정" style={{ gap: 4, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 28, ...Clay.card }}>
      <Text style={{ fontSize: 12, color: C.muted }}>{trial && !isPro(entitlement) ? 'PRO 체험 · 비공개 테스트' : entitlementLabel(entitlement)}</Text>
      {/* 검수용 빌드는 스스로 그렇다고 말한다. 출시 구성에서는 아예 그려지지 않는다(internalReviewBuild() 가 거짓). */}
      {reviewCapable() && <View style={{ gap: 8, padding: 12, borderRadius: T.radius.md, backgroundColor: C.accentSoft }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.accentInk }}>{reviewEnvLabel()}</Text>
        <Text style={{ fontSize: 11, color: C.accentInk, lineHeight: 16 }}>{internalReviewBuild() ? REVIEW_BUILD_NOTE : REVIEW_DEV_NOTE}</Text>
        <Pressable accessibilityRole="switch" accessibilityLabel="검수용 PRO 켜기" accessibilityState={{ checked: !!store?.reviewUnlock }}
          onPress={() => { try { commit(st => ({ ...st, reviewUnlock: !st.reviewUnlock })); } catch { /* 저장 실패는 위 배너가 말한다 */ } }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
          <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: store?.reviewUnlock ? C.point : C.lineStrong }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: store?.reviewUnlock ? 18 : 0 }} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.accentInk }}>검수용 PRO {store?.reviewUnlock ? '켜짐' : '꺼짐'}</Text>
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityLabel="홈 공지 미리 보기" accessibilityState={{ checked: noticePreview }}
          onPress={() => setNoticePreview(!noticePreview)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
          <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: noticePreview ? C.point : C.lineStrong }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: noticePreview ? 18 : 0 }} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.accentInk }}>홈 공지 미리 보기 {noticePreview ? '켜짐' : '꺼짐'}</Text>
        </Pressable>
      </View>}
      <Pressable accessibilityRole="button" accessibilityLabel="사용 안내 다시 보기" onPress={() => { setSettings(false); setIntroStep(0); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, borderRadius: T.radius.md, backgroundColor: pressed ? C.fill : 'transparent' })}>
        <Glyph name="help-circle-outline" size={20} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>사용 안내 다시 보기</Text>
        <Glyph name="chevron-right" size={18} color={C.faint} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="전체 백업 만들기" onPress={() => { setSettings(false); backupAll(); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, borderRadius: T.radius.md, backgroundColor: pressed ? C.fill : 'transparent' })}>
        <Glyph name="archive-arrow-down-outline" size={20} color={C.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>전체 백업 만들기</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>모든 세트 · 색 · 보관한 움직임 · 조각 · 설정 (PRO 구매 제외)</Text>
        </View>
        <Glyph name="chevron-right" size={18} color={C.faint} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="백업에서 되살리기" onPress={restoreFromBackup}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, borderRadius: T.radius.md, backgroundColor: pressed ? C.fill : 'transparent' })}>
        <Glyph name="archive-arrow-up-outline" size={20} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>백업에서 되살리기</Text>
        <Glyph name="chevron-right" size={18} color={C.faint} />
      </Pressable>
      {(() => {
        const copies = settings ? safely(listExports) ?? [] : [];
        if (!copies.length) return null;
        const mb = copies.reduce((t, x) => t + x.bytes, 0) / 1048576;
        return <Pressable accessibilityRole="button" accessibilityLabel={`내보낸 파일 ${copies.length}개`} onPress={() => { setSettings(false); setExportsConfirm(copies); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, borderRadius: T.radius.md, backgroundColor: pressed ? C.fill : 'transparent' })}>
          <Glyph name="folder-zip-outline" size={20} color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>내보낸 파일</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{`보낸 뒤 앱에 남은 사본 ${copies.length}개 · ${mb < .1 ? '0.1MB 미만' : mb.toFixed(1) + 'MB'}`}</Text>
          </View>
          <Glyph name="chevron-right" size={18} color={C.faint} />
        </Pressable>;
      })()}
      <Pressable accessibilityRole="button" accessibilityLabel={'휴지통 ' + trashed.length + '개'} onPress={() => { setSettings(false); setTrashOpen(true); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, borderRadius: T.radius.md, backgroundColor: pressed ? C.fill : 'transparent' })}>
        <Glyph name="delete-restore" size={20} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>휴지통</Text>
        <Text style={{ fontSize: 13, color: C.muted }}>{trashed.length ? trashed.length + '개' : '비어 있음'}</Text>
        <Glyph name="chevron-right" size={18} color={C.faint} />
      </Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="캔버스 종이 질감" accessibilityState={{ checked: store?.paperTexture === true }}
        onPress={() => { try { commit(st => ({ ...st, paperTexture: st.paperTexture !== true })); } catch { /* 저장 실패는 배너가 말한다 */ } }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>캔버스 종이 질감</Text>
          <Text style={{ fontSize: 11, color: C.muted }}>파일에는 들어가지 않아요</Text>
        </View>
        <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: store?.paperTexture === true ? C.point : C.lineStrong }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', marginLeft: store?.paperTexture === true ? 18 : 0 }} />
        </View>
      </Pressable>
      {/* 앱 정보: 실제 설정에 적힌 버전만 보여 준다. 없는 도움말·백업 버튼은 만들지 않는다(명세 T01). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: 1, borderColor: C.line }}>
        <Text style={{ flex: 1, fontSize: 13, color: C.muted }}>버전</Text>
        <Text accessibilityLabel={'앱 버전 ' + appVersion} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{appVersion}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="개인정보처리방침" accessibilityState={{ disabled: !privacyUrl }} disabled={!privacyUrl}
        onPress={() => privacyUrl && void Linking.openURL(privacyUrl).catch(() => setNotice('개인정보처리방침을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.'))}
        style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, color: C.ink }}>개인정보처리방침</Text><Text style={{ color: C.muted }}>{privacyUrl ? '열기 ›' : '준비 중'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="문의하기" accessibilityState={{ disabled: !supportEmail }} disabled={!supportEmail}
        onPress={() => void openSupport()} style={{ minHeight: T.tap, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, color: C.ink }}>문의하기</Text><Text style={{ color: C.muted }}>{supportEmail ? '메일 보내기 ›' : '준비 중'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="PRO 이용" onPress={() => { setSettings(false); setProSheet(true); }}
        style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: pressed ? T.fill : 'transparent' })}>
        <Glyph name="star-four-points-outline" size={19} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: C.ink }}>PRO 이용</Text>
        <Glyph name="chevron-right" size={18} color={C.muted} />
      </Pressable>
  </View>;
  const setMeta = (p: Project) => { const when = new Date(p.updatedAt); return { moving: setIsAnimated(p), done: doneCount(p), working: p.slots.filter(isWorking).length, stamp: Number.isFinite(when.getTime()) ? `${when.getMonth() + 1}월 ${when.getDate()}일` : '' }; };
  // 첫 실행 한 장 · 로그인 · 작가명. 서버가 있으면 로그인 전에는 앱 안으로 들어가지 않는다(기기 안 작품은 그대로 있다).
  if (store && !loadError && cloud && authUid === undefined) return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}><StatusBar style="dark" /><Text style={{ fontSize: 13, color: C.muted }}>불러오는 중…</Text></SafeAreaView>;
  if (store && !loadError && ((cloud && authUid === null) || (!cloud && startOpen))) return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}><StatusBar style="dark" />
    <StartScreen providers={cloud ? { kakao: providerReady(Constants.expoConfig?.extra, 'kakao'), naver: providerReady(Constants.expoConfig?.extra, 'naver'), google: providerReady(Constants.expoConfig?.extra, 'google') } : null}
      apple={appleReady} onLogin={startLogin} onStart={finishStart} busy={loginBusy} error={loginError} /></SafeAreaView>;
  if (store && !loadError && cloud && authUid && artist === null) return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}><StatusBar style="dark" />
    <ArtistNameScreen formatError={artistNameFormat} check={name => checkArtistName(cloud, name)}
      save={async name => { const r = await setArtistName(cloud, name); setArtist(r.artistName); }} /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><StatusBar style="dark" /><ImageAnalyzer ref={analyzer} /><MotionBaker ref={baker} /><ExtraComposer ref={composer} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {project && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, minHeight: 56, backgroundColor: (screen === 'board' || screen === 'export') && !canonOpen ? T.page : C.bg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" disabled={!!busy} onPress={back} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Glyph name="chevron-left" size={28} color={C.ink} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 20, lineHeight: 27, color: C.ink, fontWeight: '800', letterSpacing: -.2 }}>{canonOpen ? '캐릭터 기준' : screen === 'export' ? '내보내기' : screen === 'batch' ? '움직임 한 번에 적용' : screen === 'extras' ? '부가 이미지' : project.projectName}</Text>
          {(canonOpen || screen !== 'board') && <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{project.projectName}</Text>}
        </View>
        {screen === 'board' && !canonOpen && <Pressable accessibilityRole="button" accessibilityLabel="세트 메뉴" disabled={!!busy} onPress={() => setMenu(true)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Glyph name="dots-horizontal" size={24} color={C.ink} /></Pressable>}
      </View>}
      {!!busy && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 }}><Glyph name="timer-sand" size={15} color={C.muted} /><Text style={{ fontSize: 12, color: C.muted }}>{busy}</Text></View>}
      {!!saveError && <View style={{ margin: 12, padding: 12, gap: 8, borderRadius: T.radius.md, backgroundColor: T.dangerSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Glyph name="content-save-alert-outline" size={20} color={T.danger} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.ink }}>변경 내용을 아직 저장하지 못했어요</Text>
        </View>
        <Text style={{ fontSize: 12, color: C.ink, lineHeight: 18 }}>작업은 화면에 그대로 있어요. 다시 저장을 눌러 주세요.</Text>
        <Action primary title="다시 저장" onPress={() => { try { commit(s => s); } catch {} }} />
      </View>}
      <ScrollView style={{ backgroundColor: (!project && !loadError && homeView === 'home') || (project && (screen === 'board' || screen === 'export') && !canonOpen) ? T.page : C.bg }} pointerEvents={busy ? 'none' : 'auto'} key={`${projectId}/${slotNumber}/${canonOpen}/${screen}/${homeView}`} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, windowWidth > CONTENT_MAX && { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }, !project && !loadError && { flexGrow: 1 }, !project && !loadError && homeView === 'home' && { paddingHorizontal: screenWidth < 340 ? 12 : 16, paddingTop: 8, gap: 12, backgroundColor: T.page },
        project && (screen === 'board' || screen === 'export') && !canonOpen && { gap: 12, backgroundColor: T.page }]}>
        {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={() => setNotice('')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: T.tap, paddingVertical: 10, paddingHorizontal: 14, borderRadius: T.radius.md, backgroundColor: C.paper, ...Elev[1] }}>
          <Glyph name="information-outline" size={18} color={C.muted} />
          <Text style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 19 }}>{notice}</Text>
          <Glyph name="close" size={18} color={C.muted} />
        </Pressable>}
        {loadError ? <>
          <View style={[styles.card, { gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: T.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name="file-alert-outline" size={22} color={T.danger} />
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
            <Glyph name={diagOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
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
            <Text style={{ fontSize: 12, color: C.muted }}>{sortedProjects.length}개 세트</Text>
          </View>
          <Field label="세트 이름으로 찾기" value={projectQuery} onChangeText={setProjectQuery} multiline={false} />
          <Segmented dense testID="세트 분류" value={projectFilter} onChange={setProjectFilter} items={[{ key: 'all', label: '전체' }, { key: 'working', label: '작업 중' }, { key: 'done', label: '완성' }]} />
          <Segmented dense testID="세트 정렬" value={projectOrder} onChange={setProjectOrder} items={[{ key: 'recent', label: '최근 수정순' }, { key: 'name', label: '이름순' }]} />
          {!visibleProjects.length && <Text style={{ fontSize: 13, color: C.muted }}>조건에 맞는 세트가 없어요. 찾는 말이나 분류를 바꿔 보세요.</Text>}
          <View testID="전체 작업 목록" style={{ borderRadius: 24, ...Clay.card }}>
            {visibleProjects.map((p, i) => {
              const m = setMeta(p), cover = p.slots.find(s => s.finalImage);
              return <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} onPress={() => { setProjectId(p.id); setScreen('board'); }}
                  style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, opacity: pressed ? .6 : 1 })}>
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {cover ? <Image source={{ uri: imageUri((cover.motionImage ?? cover.finalImage)!.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Glyph name="draw" size={20} color={C.lineStrong} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{p.projectName}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{m.moving ? '움직이는' : '멈춰있는'} · {m.done}개 완성{m.stamp ? ` · ${m.stamp}` : ''}</Text>
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.projectName} 관리`} onPress={() => setManageId(p.id)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Glyph name="dots-horizontal" size={22} color={C.muted} /></Pressable>
              </View>;
            })}
          </View>
        </> : !project && homeView === 'lesson' && LESSONS.some(l => l.id === lessonId) ? <>
          <LessonView key={lessonId!} lesson={LESSONS.find(l => l.id === lessonId)!} onBack={() => setHomeView('home')} onAction={runLessonAction} />
        </> : !project && homeView === 'book' ? <>
          {/* 이용 가이드북(2026-10-13, 홈 공지 슬라이드 ①): 장(章) 카드를 누르면 펼쳐진다. 규격 장은 카카오 공식 가이드 링크를 함께 준다. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, marginTop: -4, marginLeft: -8 }}>
            <IconButton label="홈으로" icon="chevron-left" color={C.ink} onPress={() => { setBookOpen(null); setHomeView('home'); }} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>이용 가이드북</Text>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.muted, marginTop: -8 }}>앱 사용법부터 카카오 제안 규격, 승인에 가까워지는 팁까지</Text>
          {GUIDEBOOK.map((ch, i) => { const open = bookOpen === ch.id;
            return <View key={ch.id} testID={'가이드북 ' + ch.id} style={{ borderRadius: 24, ...Clay.card, boxShadow: open ? '8px 10px 22px rgba(120, 100, 70, 0.16)' : Clay.card.boxShadow }}>
              <Pressable accessibilityRole="button" accessibilityLabel={ch.title} accessibilityState={{ expanded: open }} onPress={() => setBookOpen(open ? null : ch.id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, borderRadius: 24, backgroundColor: pressed ? C.fill : C.paper })}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: open ? C.pointSoft : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: open ? C.pointInk : C.ink }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{ch.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{ch.summary}</Text>
                </View>
                <Glyph name={open ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
              </Pressable>
              {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                {ch.items.map(it => <View key={it.title} style={{ gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{it.title}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{it.body}</Text>
                </View>)}
                {!!ch.source && <Pressable accessibilityRole="link" accessibilityLabel="카카오 이모티콘 스튜디오 공식 가이드 열기" onPress={() => Linking.openURL(ch.source!).catch(() => setNotice('링크를 열지 못했어요.'))}
                  style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 22, backgroundColor: pressed ? C.fillPressed : C.fill })}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>공식 가이드 열기</Text>
                  <Glyph name="open-in-new" size={16} color={C.muted} />
                </Pressable>}
              </View>}
            </View>; })}
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
                style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? C.pointSoft : C.surface2 }}>
                <Text style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.pointInk : C.muted }}>{name}</Text>
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
                      borderWidth: on ? 2 : 1, borderColor: on ? C.point : C.line, opacity: has ? 1 : .55 })}>
                    <View style={{ width: cell - 18, height: cell - 18, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <AssetSlot name="expressionGuideArtwork" size={Math.round((cell - 18) * .84)} sourceOverride={shownArt(x)} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2, paddingBottom: 2 }}>
                      {on && <Glyph name="check" size={15} color={C.point} />}
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
                {/* 어느 세트의 몇 번 칸에 넣는지 행동 바로 위에서 말한다(45.38). 예전에는 가장 최근 세트의 다음 빈 칸이 말없이 열렸다. */}
                {(() => {
                  const dest = guideTargetId === 'new' ? null : sortedProjects.find(p => p.id === guideTargetId) ?? sortedProjects[0] ?? null;
                  const open = dest ? nextUnfinished(dest, dest.lastSlot ?? 0) : null;
                  const text = !dest ? '새 이모티콘 세트의 01번 칸' : open === null ? `${dest.projectName} · 빈 칸 없음(보드에서 골라요)` : `${dest.projectName} · ${pad(open)}번 칸`;
                  return <View testID="표현 넣을 곳" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 12, borderRadius: 12, backgroundColor: C.surface2 }}>
                    <Glyph name="arrow-down-bold-box-outline" size={18} color={C.muted} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.ink }}><Text style={{ color: C.muted }}>넣을 곳 </Text><Text style={{ fontWeight: '800' }}>{text}</Text></Text>
                    {!!sortedProjects.length && <Pressable accessibilityRole="button" accessibilityLabel="넣을 곳 바꾸기" onPress={() => setGuideTargetPick(true)}
                      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? C.fill : 'transparent' })}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>바꾸기</Text>
                    </Pressable>}
                  </View>;
                })()}
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
                    style={({ pressed }) => ({ width: cardWidth, padding: 10, gap: 8, borderRadius: T.radius.card, backgroundColor: pressed ? C.fill : C.paper, ...Card.border })}>
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
          {/* 2026-10-08 토스식 개편(캔버스 T-Home, 사용자 확인): 회색 바탕 + 흰 카드. 글자를 줄이고 한눈에 —
              ① 이어 그리기 카드(세트 이름 · n/32 · 네 칸 · 막대 · 노란 버튼 하나) ② 공지 한 줄(공모전·알림) ③ 제안까지 세 칸(아이콘 + 두 마디) ④ 내 세트 한 줄.
              아래 탭(홈 · 공모전 · 내 정보)은 화면 밖 TabBar 가 맡는다. */}
          {homeTab === 'home' && <>
          <Rise delay={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: T.tap }}>
            <View testID="홈 브랜드" accessible accessibilityRole="header" accessibilityLabel="emoti 이모티" style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 24, fontFamily: Font.display, fontWeight: '400', color: C.ink }}>emoti</Text>
              {/* 2026-10-27 큰 표지형 시안: 로고 옆 작은 부제(본문 글꼴). */}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontWeight: '600', color: C.muted }}>{t('home.subtitle')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="표현 가이드" onPress={() => setHomeView('guide')}
              style={({ pressed }) => ({ width: T.tap, height: T.tap, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.fill : 'transparent' })}>
              <ImtiIcon name="guide" size={IconSize.tool} />
            </Pressable>
            {/* 무료일 때 'PRO 보기', 산 뒤에는 'PRO'(노란 면) — 지금 PRO 인지 글자로 구분한다(출시 검사도 이 글자를 본다). */}
            <ProBadge label="PRO 보기" text={trial && !isPro(entitlement) ? 'PRO 체험' : pro ? 'PRO' : 'PRO 보기'} owned={pro} onPress={() => setProSheet(true)} />
          </Rise>
          {(() => {
            // 2026-10-14 시안 Z-Home(사용자 확정 A안): 꽉 찬 공지 배너 → 노란 클레이 대표 카드(통통 튀는 그림 · 보라 진행 · 노란 버튼) → 제안까지 작은 줄 → 내 세트 96 카드.
            const gutter = screenWidth < 340 ? 12 : 16;
            const setCard = (key: string, label: string, onPress: () => void, pic: React.ReactNode, name: string, sub: string, picBg: string = C.paper, disabled = false) =>
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
                style={({ pressed }) => ({ width: 96, minHeight: 132, gap: 6, transform: pressed ? [{ scale: .97 }] : [] })}>
                <View style={{ width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Clay.card, backgroundColor: picBg }}>{pic}</View>
                <View style={{ paddingHorizontal: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{sub}</Text>
                </View>
              </Pressable>;
            const ownPicture = setCard('own', '내 그림으로 시작', startFromImage, <ImtiIcon name="reference" size={IconSize.tab} disabled={!!busy} />, '내 그림', '사진에서 시작', C.paper, !!busy);
            const newSet = setCard('new', '새 세트 만들기', createNewProject, <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...Clay.button }}><ImtiIcon name="plus" size={IconSize.tool} /></View>, '새 세트', '32칸', C.accentSoft);
            // 공지 배너(사용자 확정): 둥근 모서리 없이 화면 가로에 꽉 차게. 그림 파일이 생기면 slide.image 로 덮는다.
            const art = (child: React.ReactNode) => <View style={{ width: 72, height: 72, borderRadius: 26, ...Clay.card, alignItems: 'center', justifyContent: 'center' }}>{child}</View>;
            const slides: NoticeSlide[] = [
              { key: 'book', kicker: '가이드북', title: '앱 사용부터\n승인 팁까지', label: '가이드북 열기', tone: T.bannerYellow, kickerColor: T.yellowInk, backdrop: require('./assets/notices/book.png'),
                art: art(<ImtiIcon name="guide" size={IconSize.tab} color={C.ink} />), onPress: () => setHomeView('book') },
              ...(cloud ? [{ key: 'contest', kicker: homeContest ? (homeContest.dday ? `공모전 · ${homeContest.dday}` : '공모전') : '공모전 현황', kickerColor: T.pointInk,
                title: homeContest ? homeContest.title : '열리는 공모전을\n여기서 알려 드려요', label: homeContest ? '공모전 ' + homeContest.title : '공모전 현황 보기', tone: T.bannerViolet, backdrop: require('./assets/notices/contest.png'),
                art: art(<ImtiIcon name="contest" size={IconSize.tab} color={C.point} />), onPress: () => setHomeTab('contest') }] : []),
              ...(noticeOn ? [{ key: 'notice', testID: '홈 알림', kicker: '알림', title: homeNotice.title, label: homeNotice.title, tone: T.accentSoft,
                art: <AssetSlot name="noticeArtwork" size={72} />,
                onPress: () => { if (trialNotice) { setProSheet(true); return; } if (homeNotice.link) Linking.openURL(homeNotice.link).catch(() => setNotice('링크를 열지 못했어요.')); } }] : []),
            ];
            const noticeLine = <Rise delay={80} style={{ marginHorizontal: -gutter }}><NoticeCarousel slides={slides} guessWidth={Math.min(windowWidth, CONTENT_MAX)} /></Rise>;
            if (!sortedProjects.length) return <>
              {noticeLine}
              {/* 빈 홈: 그림 · 제목 · 노란 행동 하나. */}
              <Rise delay={160}><EmptyState testID="홈 창작 표면" flow
                art={<HopStage size={screenWidth < 380 ? 80 : 96}><AssetSlot name="homeHeroArtwork" size={screenWidth < 380 ? 80 : 96} /></HopStage>}
                title="첫 칸부터 그려 볼까요?" body="한 세트 = 32칸 · 무료로 끝까지"
                actionLabel="새 세트 만들기" onAction={createNewProject} /></Rise>
              <Rise delay={240} style={{ flexDirection: 'row', gap: 10 }}>{ownPicture}</Rise>
            </>;
            // 2026-10-27 승인 시안 '큰 표지형'(Codex 전달 · docs/design/APPROVED_VISUAL_20261027.md): 공지 배너 → 작은 공지 줄 →
            // 내 세트 2열 큰 표지(최근 3개 + 새 세트 칸) → 내 그림 가져오기 한 줄. 큰 대표 카드·제안까지 줄·소개 문구는 두지 않는다.
            // 노랑은 지금 할 일 하나 — 가장 최근 세트 표지 안의 '이어서 그리기'. 누름은 0.975배로 짧게(motion-spec).
            // 넓은 화면(폴드 펼침·태블릿)은 3열 — 2열이면 표지 하나가 화면 반을 차지한다. 서가는 한 줄을 다 채우는 수만큼(새 세트 칸 포함).
            const shelfW = Math.min(windowWidth, CONTENT_MAX) - gutter * 2, cols = shelfW >= 560 ? 3 : 2, tileW = Math.floor((shelfW - 14 * (cols - 1)) / cols);
            const compact = tileW < 170;
            const recent = sortedProjects.slice(0, cols * 2 - 1);
            const tints = [C.accentSoft, C.pointSoft, T.surface2];
            const coverOf = (q: Project) => {
              const made = q.slots.filter(s => s.finalImage);
              return made.find(s => s.number === q.lastSlot) ?? made.at(-1);
            };
            const cover = (q: Project, i: number) => {
              const pic = coverOf(q), m = setMeta(q), first = i === 0;
              const next = nextUnfinished(q, q.lastSlot ?? 0);
              const kind = setIsAnimated(q) ? t('home.kindMoving') : t('home.kindStill');
              return <View key={q.id} style={{ width: tileW, gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={q.projectName} onPress={() => { setProjectId(q.id); setScreen('board'); }}
                  style={({ pressed }) => ({ aspectRatio: 1, minHeight: 120, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...Clay.card, backgroundColor: tints[i % tints.length], transform: pressed ? [{ scale: .975 }] : [] })}>
                  {pic ? <Image testID="홈 표지 그림" source={{ uri: imageUri((pic.motionImage ?? pic.finalImage)!.path) }} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                    : <ImtiIcon name="brush" size={IconSize.tab} color={C.faint} />}
                  {first && <Pressable accessibilityRole="button" accessibilityLabel={`${q.projectName} 이어서 만들기`} onPress={() => { setProjectId(q.id); setScreen('board'); setSlotNumber(next ?? q.lastSlot ?? 1); setPainting(true); }}
                    style={({ pressed }) => ({ position: 'absolute', left: 8, bottom: 8, maxWidth: tileW - 16, height: compact ? 34 : 40, paddingHorizontal: compact ? 10 : 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: compact ? 12 : 13, fontWeight: '800', color: C.accentInk }}>{m.done || pic ? t('home.continue') : t('home.startDrawing')}</Text>
                    <Glyph name="arrow-right" size={14} color={C.accentInk} />
                  </Pressable>}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${q.projectName} 관리`} onPress={() => setManageId(q.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ position: 'absolute', top: 6, right: 6, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' }}>
                    <ImtiIcon name="more" size={IconSize.meta} color={C.muted} />
                  </Pressable>
                </Pressable>
                <View style={{ paddingHorizontal: 4, gap: 2 }}>
                  <Text numberOfLines={1} accessibilityLabel={q.projectName} style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{q.projectName}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{t('home.cuts', { kind, done: m.done, total: q.slots.length })}</Text>
                </View>
              </View>;
            };
            const newTile = <View key="new" style={{ width: tileW, gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="새 세트 만들기" onPress={createNewProject}
                style={({ pressed }) => ({ aspectRatio: 1, minHeight: 120, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, transform: pressed ? [{ scale: .975 }] : [] })}>
                <ImtiIcon name="plus" size={IconSize.tab} color={C.muted} />
              </Pressable>
              <View style={{ paddingHorizontal: 4, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{t('home.newSet')}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{t('home.newSetSub')}</Text>
              </View>
            </View>;
            return <>
              {noticeLine}
              <Rise delay={120}><Pressable testID="홈 공지 줄" accessibilityRole="button" accessibilityLabel={t('home.notice')} onPress={() => setHomeView('book')}
                style={({ pressed }) => ({ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, opacity: pressed ? .7 : 1 })}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: .8, color: C.point }}>NOTICE</Text>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.ink }}>{t('home.notice')}</Text>
              </Pressable></Rise>
              <Rise delay={180} style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{t('home.mySets')}<Text style={{ fontSize: 15, fontWeight: '600', color: C.muted }}>{sortedProjects.length}</Text></Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="전체 작업 보기" onPress={() => setHomeView('all')} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.point }}>{t('home.recentAll', { n: sortedProjects.length })}</Text>
                  </Pressable>
                </View>
                <View testID="홈 작품 서가" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {recent.map(cover)}
                  {newTile}
                </View>
              </Rise>
              <Rise delay={240}><Pressable accessibilityRole="button" accessibilityLabel="내 그림으로 시작" accessibilityState={{ disabled: !!busy }} disabled={!!busy} onPress={startFromImage}
                style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? .7 : 1 })}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.pointSoft, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="reference" size={IconSize.row} disabled={!!busy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{t('home.ownTitle')}</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>{t('home.ownSub')}</Text>
                </View>
              </Pressable></Rise>
            </>;
          })()}
          </>}
          {homeTab === 'class' && <>
            {/* 강좌(2026-10-14 시안 Z-Class): 지금은 무료 앱 사용법(가이드북 장)과 표현 가이드. 작가 강좌(유료)는 준비 중 자리만 둔다 — 결제·정산·영상은 아직 없다. */}
            <Rise delay={20} style={{ paddingTop: 6 }}>
              <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34, fontWeight: '800', color: C.ink, letterSpacing: -.6 }}>강좌</Text>
              <Text style={{ fontSize: 14, color: C.muted }}>작가에게 배우는 이모티콘 만들기</Text>
            </Rise>
            {/* 2026-10-16 사용자: 유튜브처럼 단순하게 — 위에 묶음 칩, 아래 한 줄에 하나씩 16:9 썸네일 + 제목 + 한 줄 정보. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {([['all', '전체'], ...LESSON_GROUPS.map(g => [g.id, g.short])] as [string, string][]).map(([id, label]) => { const on = lessonGroup === id;
                return <Pressable key={id} accessibilityRole="button" accessibilityLabel={'강좌 묶음 ' + label} accessibilityState={{ selected: on }} onPress={() => setLessonGroup(id)}
                  style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? C.ink : C.fill }}>
                  <Text style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? C.paper : C.ink }}>{label}</Text>
                </Pressable>; })}
            </ScrollView>
            <View testID="강좌 목록" style={{ gap: 22 }}>
              {LESSONS.filter(l => lessonGroup === 'all' || l.group === lessonGroup).map(l => { const g = LESSON_GROUPS.find(x => x.id === l.group)!;
                return <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={'강좌 ' + l.title} onPress={() => { setLessonId(l.id); setHomeView('lesson'); }}
                  style={({ pressed }) => ({ gap: 10, opacity: pressed ? .85 : 1 })}>
                  <View style={{ aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: C.surface2 }}>
                    <Image accessibilityIgnoresInvertColors source={l.thumb} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <View style={{ position: 'absolute', right: 8, bottom: 8, height: 22, paddingHorizontal: 7, borderRadius: 6, backgroundColor: 'rgba(25,31,40,0.78)', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{`${l.minutes}분`}</Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 2, gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 22, fontWeight: '800', color: C.ink }}>{l.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: C.muted }}>{`${g.free ? '무료 · ' : ''}${g.short} · ${l.steps.length}단계 · ${l.summary}`}</Text>
                  </View>
                </Pressable>; })}
            </View>
            {/* 작가 강좌(유료)는 아직 없다 — 큰 자리 대신 한 줄로 알린다. */}
            <View testID="작가 강좌 준비 중" accessible accessibilityLabel="작가 강좌 준비 중. 공모전 선정 작가의 강좌가 곧 열려요"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, backgroundColor: C.pointSoft }}>
              <Glyph name="school-outline" size={22} color={C.pointInk} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>작가에게 배우는 강좌가 곧 열려요</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>공모전 선정 작가와 함께 준비하고 있어요</Text>
              </View>
            </View>
            <Rise delay={200}>
              <Pressable accessibilityRole="button" accessibilityLabel="표현 가이드 열기" onPress={() => setHomeView('guide')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, ...Clay.card, transform: pressed ? [{ scale: .98 }] : [] })}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="sticker" size={IconSize.tool} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>표현 가이드</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>어떤 마음을 그릴지 골라 밑그림으로</Text>
                </View>
                <ImtiIcon name="next" size={IconSize.row} color={C.faint} />
              </Pressable>
            </Rise>
          </>}
          {homeTab === 'contest' && <>
            <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34, fontWeight: '800', color: C.ink, letterSpacing: -.4, paddingTop: 6 }}>공모전</Text>
            {store && <CloudScreen inline part="contest" visible onClose={() => setHomeTab('home')} cloud={cloud} extra={Constants.expoConfig?.extra} device={`${Platform.OS} ${Platform.Version}`}
              store={store} projects={store.projects} commit={commit} task={task} login={loginWith} bakeHandoff={bakeHandoff} />}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4 }}>
              <ImtiIcon name="info" size={IconSize.row} color={C.muted} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: C.muted }}>카카오·라인 같은 플랫폼 제안은 작가님 이름으로 직접 내요. emoti 가 대신 제출하지 않아요.</Text>
            </View>
          </>}
          {homeTab === 'my' && <>
            <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34, fontWeight: '800', color: C.ink, letterSpacing: -.4, paddingTop: 6 }}>내 정보</Text>
            {store && <CloudScreen inline part="account" visible onClose={() => setHomeTab('home')} cloud={cloud} extra={Constants.expoConfig?.extra} device={`${Platform.OS} ${Platform.Version}`}
              store={store} projects={store.projects} commit={commit} task={task} login={loginWith} bakeHandoff={bakeHandoff} />}
            {myRows}
          </>}
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
                      {picked && <View style={{ position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><Glyph name="check" size={14} color={C.accentInk} /></View>}
                      {!!result && <View style={{ position: 'absolute', right: 4, bottom: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: result.ok ? colors.PASS : colors.FAIL, borderWidth: 1.5, borderColor: '#FFF' }} />}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: C.muted }}>{pad(s.number)}{isAnimated(s) ? ' · 움직임 있음' : ''}</Text>
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
                      : <Glyph name="play-circle-outline" size={40} color="#B8B8BD" />}
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
                    <Glyph name={ok ? 'check-circle' : 'circle-outline'} size={18} color={ok ? colors.PASS : C.muted} />
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
              ['파일 형식', exportFormatSummary(project)],   // 45.38: ZIP 과 같은 규칙으로 센 실제 파일 수
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
              <Glyph name={ok ? 'check-circle' : 'circle-outline'} size={18} color={ok ? T.success : C.lineStrong} />
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
              {/* 2026-10-08 토스식(캔버스 U-Export): 흰 카드 · 세트 이름과 종류 · 큰 숫자 · 막대. 다 채우면 완성 그림. */}
              <View testID="내보내기 요약" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ fontSize: 14, color: C.muted }}>{finished >= profile.count ? `세트를 모두 완성했어요 · ${profile.profileLabel}` : profile.profileLabel}</Text>
                  <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{finished}<Text style={{ fontSize: 17, fontWeight: '500', color: C.muted }}>{` / ${profile.count}칸 완성`}</Text></Text>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, Math.min(100, finished / profile.count * 100))}%`, height: '100%', borderRadius: 3, backgroundColor: C.accent }} /></View>
                </View>
                {finished >= profile.count && <AssetSlot name="exportSuccessArtwork" size={84} />}
              </View>
              <View testID="결과 격자" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {project.slots.map(s => {
                  const bad = problems.some(c => c.slot === s.number), shown = s.motionImage ?? s.finalImage;
                  return <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${pad(s.number)}번 칸 열기`} onPress={() => fixSlot(s.number)}
                    style={{ width: cell, height: cell, borderRadius: 10, borderWidth: bad ? 2 : 0, borderColor: STATUS_TONE.fail, backgroundColor: shown ? C.paper : C.fillPressed, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {shown ? <Image source={{ uri: imageUri(shown.path) }} style={{ width: '100%', height: '100%', opacity: isDone(s) ? 1 : .55 }} resizeMode="contain" /> : <Text style={{ fontSize: 10, fontWeight: '600', color: C.muted }}>{pad(s.number)}</Text>}
                  </Pressable>;
                })}
              </View>

              {/* 2·3. 손볼 곳과 고치는 길 */}
              {/* 손볼 곳: 한 표면 안의 목록. 상태는 옅은 호박/빨강 동그라미 하나로 — 강한 경고 상자를 쌓지 않는다. */}
              {issuesPending && <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper }}><Glyph name="timer-sand" size={18} color={C.muted} /><Text style={{ fontSize: 15, color: C.muted }}>손볼 곳 확인 중</Text></View>}
              {!issuesPending && !problems.length && <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="check" size={IconSize.meta} color={C.paper} /></View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.ink }}>손볼 곳 없음</Text></View>}
              {!issuesPending && !!problems.length && <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 4 }}>손볼 곳 {problems.length}개</Text>
                <View style={{ borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, overflow: 'hidden' }}>
                  {problems.map((c, i) => <Pressable key={c.label + i} accessibilityRole="button" accessibilityLabel={`${c.label} 고치기`} disabled={!c.slot} onPress={() => c.slot && fixSlot(c.slot)}
                    style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed && c.slot ? C.fill : 'transparent' })}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.status === 'FAIL' ? T.dangerSoft : T.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Glyph name={c.status === 'FAIL' ? 'alert-circle-outline' : 'alert-outline'} size={17} color={c.status === 'FAIL' ? T.danger : T.warning} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.muted }}><Text style={{ fontWeight: '700', color: C.ink }}>{c.label}</Text> · {c.detail}</Text>
                    {!!c.slot && <Glyph name="chevron-right" size={18} color={C.faint} />}
                  </Pressable>)}
                </View>
              </View>}

              {/* 4. 지금 할 일. 이 화면의 노란 버튼은 이것 하나다. */}
              <Action primary title={t('export.make')} disabled={!!busy || !drawn.length} onPress={exportProject} />
              {!!drawn.length && drawn.length < project.slots.length && <Text style={{ marginTop: -4, textAlign: 'center', fontSize: 12, color: C.muted }}>{`지금 있는 ${drawn.length}칸으로 만들어요 · 빈 칸은 빠져요`}</Text>}
              {!pro && !!adUnit && <Text testID="광고 안내" style={{ marginTop: -4, textAlign: 'center', fontSize: 12, color: C.muted }}>{t('export.adHint')}</Text>}
              {/* LINE 움직이는 스티커(2026-10-27): 카카오 묶음과 따로. 움직이는 칸 8개 이상일 때 만들 수 있다. */}
              <Action title={t('export.line')} disabled={!!busy || !drawn.length} onPress={exportLine} />
              {!!lastExport && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, borderRadius: 16, backgroundColor: T.successSoft }}>
                <Glyph name="check-circle" size={20} color={colors.PASS} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: C.ink }}>{lastExport.count}칸을 묶었어요</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="다시 공유" disabled={!!busy} onPress={shareAgain} style={{ minHeight: T.tap, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>다시 공유</Text></Pressable>
              </View>}

              {/* 제출 준비: 지금 그리는 일보다 뒤에 오는 일이라 접어 둔다. 접힌 줄에도 몇 개가 남았는지 보인다(45.2차). */}
              <View style={{ borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingVertical: 6, paddingHorizontal: 20 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={prepOpen ? '제출 준비 접기' : '제출 준비 보기'} accessibilityState={{ expanded: prepOpen }} onPress={() => setPrepOpen(!prepOpen)}
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>제출 준비</Text>
                <Text style={{ flex: 1, fontSize: 13, color: prepShort ? C.warning : C.muted }}>{prepShort ? `${prepShort}가지 더 필요해요` : '필요한 것을 다 채웠어요'}</Text>
                <Glyph name={prepOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
              </Pressable>
              {prepOpen && <View style={{ paddingBottom: 10, gap: 4 }}>
                <Segmented dense value={stage} onChange={setStage} items={[{ key: 'proposal', label: '제안에 필요한 것', a11y: '제안 기준으로 보기' }, { key: 'release', label: '출시에 필요한 것', a11y: '출시 기준으로 보기' }]} />
                <View style={{ height: 4 }} />
                {requirements.map(r => row(r.label, r.ok, r.label, r.detail))}
              </View>}
              <Pressable accessibilityRole="button" accessibilityLabel="부가 이미지 만들기" onPress={() => setScreen('extras')}
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>부가 이미지 만들기</Text>
                <Glyph name="chevron-right" size={18} color={C.faint} />
              </Pressable>

              {/* 5. 규격·직접 확인·파일 검사는 접어 둔다. 지우지 않고, 필요할 때 펼친다. */}
              <Pressable accessibilityRole="button" accessibilityLabel={specOpen ? '자세히 접기' : '자세히 보기'} accessibilityState={{ expanded: specOpen }} onPress={() => setSpecOpen(!specOpen)}
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.ink }}>규격 · 파일 검사</Text>
                <Glyph name={specOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
              </Pressable>
              </View>
              {specOpen && <>
                {/* 가이드가 정한 제작 도구 규칙. 앱이 대신하지 않는 일을 한 줄로 분명히 한다. */}
                {moving && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.surface2 }}>
                  <Glyph name="movie-open-outline" size={20} color={C.muted} />
                  <Text style={{ flex: 1, fontSize: 12, color: C.ink, lineHeight: 18 }}>움직이는 칸은 카카오 WebPAnimator에서 WebP로 마무리해요. 묶음에 칸별 프레임이 들어 있어요.</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="WebPAnimator 열기" onPress={() => { Linking.openURL(WEBP_ANIMATOR_URL).catch(() => Alert.alert('링크를 열지 못했어요', '잠시 후 다시 시도해 주세요.')); }}
                    style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph name="open-in-new" size={18} color={C.muted} />
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
                      {project.selfChecked && <Glyph name="check" size={14} color="#FFF" />}
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
                      <Glyph name="open-in-new" size={15} color={C.muted} />
                    </Pressable>
                  </View>
                </View>
              </>}
            </>;
          })()}
        </> : <>
          {(() => {
            // 2026-10-15: 홈·내보내기와 같은 기준으로 센다 — 멈춰 있는 세트 32칸, 움직이는 세트 24칸(카카오 제안 기준).
            // 칸은 늘 32개라, 움직이는 세트는 24칸만 채우면 되고 남는 칸은 비워 둬도 된다.
            const total = (setIsAnimated(project) ? STAGES.animated : STAGES.still).proposal.emoticons;
            const finishedCount = doneCount(project);
            const done = Math.min(finishedCount, total);
            const working = project.slots.filter(isWorking).length;
            const drawnCount = project.slots.filter(s => s.finalImage).length;
            const nextCut = nextUnfinished(project, project.lastSlot ?? 0);
            const playButton = drawnCount >= 2 && <Pressable accessibilityRole="button" accessibilityLabel={playing ? '전체 재생 멈추기' : '전체 재생'} onPress={() => { setPlayIndex(0); setPlaying(!playing); }}
              style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: playing ? C.pointSoft : C.accent, alignItems: 'center', justifyContent: 'center', ...(playing ? {} : pressed ? Clay.buttonPressed : Clay.button) })}>
              <Glyph name={playing ? 'pause' : 'play'} size={22} color={C.ink} />
            </Pressable>;
            // 45.43 S5: 전부 완성하면 완성 카드 B(흰 카드 · 노란 체크 · 작품 격자 · 노란 행동 하나)가 머리를 맡는다.
            // 행동 글자는 시안의 '파일 묶음 만들기' 대신 '내보내기' — 이 버튼은 묶음을 바로 만들지 않고 내보내기 화면을 연다(거기서 파일 묶음 만들기).
            // 기준을 채우면 완성 카드. 카드의 숫자는 실제로 완성한 칸 수(움직이는 세트를 32칸 다 채웠으면 32).
            if (done === total) return <><CompleteCard total={finishedCount} subtitle={`${project.projectName} · 파일 묶음을 만들 수 있어요`} actionLabel="내보내기" actionIcon="tray-arrow-up" onAction={() => setScreen('export')}>
              {/* 시안처럼 여덟 칸씩 두 줄(앞 16칸). 전체는 아래 격자에 있다. */}
              <View testID="완성 작품 격자" style={{ gap: 6 }}>
                {[0, 1].map(row => <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
                  {project.slots.slice(row * 8, row * 8 + 8).map(s => <View key={s.number} style={{ flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: C.surface2, overflow: 'hidden' }}>
                    {!!s.finalImage && <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage).path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
                  </View>)}
                </View>)}
              </View>
            </CompleteCard>
            {/* 다 채운 세트도 전체 재생은 그대로 쓸 수 있다. */}
            {!!playButton && <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>{playButton}</View>}</>;
            // 요약 카드(캔버스 U-Board): 큰 숫자 n / 32칸 · 종류 꼬리표 · 막대 하나 · 전체 재생. 네 상태 범례는 걷었다 — 칸 모서리 점이 말한다.
            // 2026-10-14 시안 Z-Board: 노란 클레이 요약 카드 · 보라 진행 막대.
            return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 28, ...Clay.yellow }}>
              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 26, lineHeight: 32, color: C.ink, fontWeight: '800', letterSpacing: -.4 }}>{done}<Text style={{ fontSize: 17, fontWeight: '500', color: C.yellowInk }}>{` / ${total}칸`}</Text></Text>
                  <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{setIsAnimated(project) ? '움직이는 세트 · 24칸 기준' : '멈춰 있는 세트 · 32칸 기준'}</Text></View>
                </View>
                {!!working && <Text style={{ fontSize: 13, color: C.yellowInk, marginTop: -6 }}>{working}칸 그리는 중</Text>}
                <FillBar testID="보드 진행" label={`${total}칸 중 ${done}칸 완성${nextCut !== null ? `, 지금 ${nextCut}번 칸` : ''}`} ratio={done / total} />
              </View>
              {playButton}
            </View>;
          })()}
          {!reordering && project.slots.some(s => s.finalImage) && <Pressable testID="채팅에서 써 보기" accessibilityRole="button" accessibilityLabel="채팅에서 써 보기" onPress={() => setChatOpen(true)}
            style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 22, ...Clay.card, transform: pressed ? [{ scale: .98 }] : [] })}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.pointSoft, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="chat" size={IconSize.row} color={C.point} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>채팅에서 써 보기</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>대화 속에 넣어 크기·표정을 확인해요</Text>
            </View>
            <ImtiIcon name="next" size={IconSize.row} color={C.faint} />
          </Pressable>}
          {reordering && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: T.radius.md, backgroundColor: T.infoSoft }}>
            <Glyph name="swap-horizontal" size={18} color={T.info} />
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
          {/* 칸 격자가 주인공(45.43 S5 · 시안 '진행' 네 상태). 완성 = 흰 칸 + 노란 체크 · 그리는 중 = 흐린 작품 + 노란 테두리 점 ·
              지금(이어서 그리기가 여는 칸, 홈의 '다음은 N번 칸'과 같다) = 옅은 노랑 면 + 잉크 테두리 · 빈 칸 = 점선 + '+'. 손볼 곳은 왼쪽 위 점. */}
          <View testID="slot-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(() => { const nextCut = nextUnfinished(project, project.lastSlot ?? 0); return project.slots.map(s => {
            const done = isDone(s), working = isWorking(s);
            const current = s.number === nextCut, empty = !s.finalImage;
            return <Pressable key={s.number} testID={`slot-${s.number}`} accessibilityRole="button" accessibilityLabel={`슬롯 ${s.number} ${done ? '완성' : working ? '작업 중' : '미착수'}`} accessibilityState={{ selected: current }} onPress={() => { setSlotNumber(s.number); setPainting(true); }} style={{ width: tileWidth, gap: 4 }}>
              <View testID={`slot-face-${s.number}`} style={{ width: tileWidth, aspectRatio: 1, borderRadius: 20, backgroundColor: current ? C.pointSoft : empty ? C.paper : C.fill, borderWidth: current ? 2 : empty ? 1.5 : 0, borderColor: current ? C.point : C.lineStrong, borderStyle: empty && !current ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 }}>
                {s.finalImage
                  ? <Image source={{ uri: imageUri((s.motionImage ?? s.finalImage).path) }} style={{ width: '100%', height: '100%', opacity: done ? 1 : .55 }} resizeMode="contain" />
                  // 명세 S01: 빈 칸은 '+' 로 분명히 알린다(지금 칸은 붓). 누르면 예전과 똑같이 그 칸이 열린다(동작은 그대로).
                  : <View style={{ alignItems: 'center' }}><Text style={{ fontSize: current ? 15 : 14, fontWeight: '800', color: current ? C.ink : C.muted }}>{pad(s.number)}</Text>{current && <Text style={{ fontSize: 10, fontWeight: '700', color: C.pointInk }}>다음</Text>}</View>}
                {/* 상태는 모서리 점 하나: 완성 = 초록 · 그리는 중 = 노랑(잉크 테두리). 손볼 곳은 왼쪽 위. */}
                {done && <View pointerEvents="none" testID="완성 표시" style={{ position: 'absolute', right: 7, bottom: 7, width: 10, height: 10, borderRadius: 5, backgroundColor: C.success }} />}
                {working && <View pointerEvents="none" testID="그리는 중 표시" style={{ position: 'absolute', right: 7, bottom: 7, width: 10, height: 10, borderRadius: 5, backgroundColor: C.dotWorking }} />}
                {(s.status === 'FAIL' || s.status === 'WARNING') && <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: 6 }}><StatusDot tone={s.status === 'FAIL' ? 'fail' : 'warn'} /></View>}
              </View>
              {reordering && !!s.finalImage && <View style={{ flexDirection: 'row', gap: 2 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={String(s.number) + '번 앞으로'} disabled={s.number === 1} onPress={() => moveSlot(s.number, s.number - 1)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: s.number === 1 ? 'transparent' : C.surface2 }}><Glyph name="chevron-left" size={18} color={s.number === 1 ? C.lineStrong : C.ink} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={String(s.number) + '번 뒤로'} disabled={s.number === project.slots.length} onPress={() => moveSlot(s.number, s.number + 1)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: s.number === project.slots.length ? 'transparent' : C.surface2 }}><Glyph name="chevron-right" size={18} color={s.number === project.slots.length ? C.lineStrong : C.ink} /></Pressable>
              </View>}
              {!empty && <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted, paddingHorizontal: 2 }}><Text style={{ fontWeight: '700', color: C.ink }}>{pad(s.number)}</Text>{captionText(s) ? ' ' + captionText(s) : ''}</Text>}
            </Pressable>;
          }); })()}</View>
        </>}
      </ScrollView>
      {store && !loadError && !project && homeView === 'home' && <TabBar value={homeTab} onChange={tab => { setHomeTab(tab); setNotice(''); }} />}
      {/* 보드 아래 고정 줄: 남은 칸이 있으면 이어서 그리기가 먼저, 완성이 생기면 내보내기. 다 채우면 내보내기가 노랑이다. */}
      {project && screen === 'board' && !canonOpen && doneCount(project) < project.slots.length && (() => {
        const next = nextUnfinished(project, project.lastSlot ?? 0);
        const done = doneCount(project), started = done > 0 || project.slots.some(isWorking);
        // 움직이는 세트가 24칸 기준을 채우면 완성 카드가 '내보내기'를 맡는다 — 같은 버튼을 두 번 두지 않는다(2026-10-15).
        const met = done >= (setIsAnimated(project) ? STAGES.animated : STAGES.still).proposal.emoticons;
        return <View testID="board-action-dock" style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: C.paper, boxShadow: '0px -8px 24px rgba(120, 100, 70, 0.10)' }}>
          {next !== null && <View style={{ flex: 2 }}><Action primary title={started ? '이어서 그리기' : '첫 칸 그리기'} disabled={!!busy} onPress={() => drawFrom()} /></View>}
          {!met && (done > 0 || next === null) && <View style={{ flex: 1 }}><Action primary={next === null} title="내보내기" disabled={!!busy} onPress={() => setScreen('export')} /></View>}
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
      {/* 2026-10-16: 홈·세트 화면과 같은 기준(멈춤 32 · 움직임 24) */}
      <Text style={styles.muted}>{Math.min(doneCount(managed), (setIsAnimated(managed) ? STAGES.animated : STAGES.still).proposal.emoticons)} / {(setIsAnimated(managed) ? STAGES.animated : STAGES.still).proposal.emoticons}칸 완성</Text>
      <Field label="세트 이름" value={managedName} onChangeText={setManagedName} multiline={false} />
      <Action primary title="이름 바꾸기" disabled={!managedName.trim() || managedName.trim() === managed.projectName} onPress={() => renameProject(managed.id, managedName)} />
      <Action icon="content-copy" title="세트 복제" onPress={() => duplicateProject(managed.id)} />
      <Action icon="archive-arrow-down-outline" title="백업 파일 만들기" onPress={() => { const target = managed; setManageId(null); backupProject(target); }} />
      <Text style={{ fontSize: 12, color: C.muted, lineHeight: 17 }}>그림·레이어·문구·움직임·참고를 파일 하나로 보관해요. 앱을 지우거나 기기를 바꾸기 전에 만들어 두면 내 정보 › 백업에서 되살리기로 그대로 돌아와요.</Text>
      <Action danger icon="delete-outline" title="세트 삭제" onPress={() => setConfirmDeleteId(managed.id)} />
    </Dialog>}
    {introStep !== null && (() => {
      // 첫 실행 안내(2026-10-06 정리): 그림은 '장식 캐릭터'가 아니라 **실제 기능의 축소판**이다 — 표현 가이드의 선 그림 캐릭터를
      // 캔버스·보드에 놓고, 앱의 선 아이콘·노랑 선택 표시로 그 쪽의 실제 버튼(펜·지우개·가져오기 / 효과 / 자동 저장·묶음·공유)을 보여 준다.
      // 예전 종이 질감 입체 캐릭터(mascot-paper)·사진 같은 펜 그림은 쓰지 않는다. 문구는 실제 저장·공유 동작과 맞춘다.
      const steps = [
        { icon: 'pencil-outline' as const, title: '그리기·가져오기', body: "세트의 칸을 눌러 손가락으로 그려요. 사진이나 그림은 홈의 '내 그림으로 시작'이나 그리기 화면의 더보기 › 그림 가져오기로 가져와요. 그리는 동안 자동으로 저장되고, 저장을 누르면 보드에 바로 올라가요." },
        { icon: 'motion-play-outline' as const, title: '움직임 적용', body: `'움직이기' 탭에서 효과를 고르면 내 그림으로 바로 미리 봐요. 세기·속도도 바꿀 수 있어요. 무료 움직임 ${PRESETS.filter(x => !isProPreset(x.id)).length}종으로도 한 세트를 끝까지 만들 수 있어요.` },
        { icon: 'export-variant' as const, title: '저장·내보내기', body: '그린 칸은 이 기기 안에만 저장돼요. 세트의 내보내기는 제출용 파일 묶음(ZIP)을, 그리기 화면의 이 칸 공유는 그 칸 하나(움직이면 GIF)를 만들어 고른 앱으로 보내요. 앱을 지우거나 기기를 바꾸기 전에는 내 정보 › 전체 백업 만들기로 백업 파일을 만들어 앱 밖에 보관해 두세요.' },
      ];
      const step = steps[introStep]; const last = introStep === steps.length - 1;
      const finish = () => { setIntroStep(null); if (!store?.introDone) { try { commit(st => ({ ...st, introDone: true })); } catch { /* 저장 실패는 다음 실행에 다시 보일 뿐이다 */ } } };
      return <Dialog title={`사용 안내 ${introStep + 1}/${steps.length}`} onClose={finish}>
        <IntroArt step={introStep} />
        <View accessibilityLabel={`${steps.length}단계 중 ${introStep + 1}단계`} style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {steps.map((_, i) => <View key={i} style={{ width: i === introStep ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === introStep ? C.point : C.line, borderWidth: i === introStep ? 1 : 0, borderColor: C.accentLine }} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Glyph name={step.icon} size={22} /><Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{step.title}</Text></View>
        <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{step.body}</Text>
        {last && trial && <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>{PRO_TRIAL_NOTE}</Text>}
        <Action primary title={last ? '시작하기' : '다음'} onPress={() => last ? finish() : setIntroStep(introStep + 1)} />
        {!last && <Action title="건너뛰기" onPress={finish} />}
      </Dialog>;
    })()}
    {pendingDelete && <Dialog title="세트 삭제" onClose={() => setConfirmDeleteId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{pendingDelete.projectName}</Text>
      <Text style={styles.muted}>휴지통으로 옮겨요. {TRASH_DAYS}일 안에는 내 정보 › 휴지통에서 그림까지 그대로 되살릴 수 있고, 그 뒤에는 영구 삭제돼요.</Text>
      <Action danger title="휴지통으로 옮기기" onPress={() => deleteProject(pendingDelete.id)} />
      <Action title="취소" onPress={() => setConfirmDeleteId(null)} />
    </Dialog>}
    {guideTargetPick && <Dialog title="넣을 곳 고르기" onClose={() => setGuideTargetPick(false)}>
      {sortedProjects.map(p => { const open = nextUnfinished(p, p.lastSlot ?? 0);
        const on = (guideTargetId ?? sortedProjects[0]?.id) === p.id;
        return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'넣을 곳 ' + p.projectName} accessibilityState={{ selected: on }}
          onPress={() => { setGuideTargetId(p.id); setGuideTargetPick(false); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: on ? '800' : '700', color: C.ink }}>{p.projectName}</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>{open === null ? '빈 칸 없음' : pad(open) + '번 칸'}</Text>
          {on && <Glyph name="check" size={18} color={C.ink} />}
        </Pressable>; })}
      <Pressable accessibilityRole="button" accessibilityLabel="넣을 곳 새 세트" accessibilityState={{ selected: guideTargetId === 'new' }}
        onPress={() => { setGuideTargetId('new'); setGuideTargetPick(false); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 12, backgroundColor: guideTargetId === 'new' ? C.accentSoft : pressed ? C.fill : 'transparent' })}>
        <Glyph name="plus" size={18} color={C.ink} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.ink }}>새 이모티콘 세트</Text>
      </Pressable>
    </Dialog>}
    {trashOpen && !pendingPurge && <Dialog title="휴지통" onClose={() => setTrashOpen(false)}>
      <Text style={styles.muted}>지운 세트는 {TRASH_DAYS}일 동안 여기 남아요. 되살리면 그림·움직임·참고가 그대로 돌아와요.</Text>
      {!trashed.length && <Text style={{ fontSize: 13, color: C.muted }}>휴지통이 비어 있어요.</Text>}
      {trashed.map(p => {
        const left = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - Date.parse(p.deletedAt!)) / 86400000));
        return <View key={p.id} testID={'휴지통 ' + p.projectName} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{p.projectName}</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>{doneCount(p)} / {p.slots.length} 완성 · {left}일 뒤 영구 삭제</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Action primary compact icon="restore" title="되살리기" onPress={() => restoreProject(p.id)} /></View>
            <View style={{ flex: 1 }}><Action compact danger title="영구 삭제" onPress={() => setConfirmPurgeId(p.id)} /></View>
          </View>
        </View>; })}
    </Dialog>}
    {pendingPurge && <Dialog title="영구 삭제" onClose={() => setConfirmPurgeId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{pendingPurge.projectName}</Text>
      <Text style={styles.muted}>이 세트의 그림과 참고 사진이 함께 지워지고, 되돌릴 수 없어요.</Text>
      <Action danger title="영구 삭제" onPress={() => purgeProject(pendingPurge.id)} />
      <Action title="취소" onPress={() => setConfirmPurgeId(null)} />
    </Dialog>}
    {store && cloudOpen && <CloudScreen visible={cloudOpen} onClose={() => setCloudOpen(false)} cloud={cloud} extra={Constants.expoConfig?.extra} device={`${Platform.OS} ${Platform.Version}`}
      store={store} projects={store.projects} commit={commit} task={task}
      login={loginWith}
      bakeHandoff={bakeHandoff} />}
    {restoreReport && <Dialog title="전체 백업에서 되살렸어요" onClose={() => setRestoreReport(null)}>
      {restoreReport.done.map(line => <Text key={line} style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{'· ' + line}</Text>)}
      {!!restoreReport.missed.length && <Text style={{ fontSize: 13, lineHeight: 19, color: C.ink }}>{'보관 칸이 차서 넣지 못했어요: ' + restoreReport.missed.join(', ') + '. 지금 것을 정리한 뒤 같은 파일로 다시 되살리면 들어와요(세트는 사본이 하나 더 생겨요).'}</Text>}
      {!!restoreReport.kept.length && <Text style={{ fontSize: 13, lineHeight: 19, color: C.ink }}>{'이 기기에서 정해 둔 ' + restoreReport.kept.join('·') + '은(는) 바꾸지 않았어요.'}</Text>}
      <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>PRO 구매는 백업에 들어가지 않아요. 구매했다면 PRO 화면의 구매 복원으로 다시 켜 주세요. 휴지통에 있던 세트는 백업에 없어요.</Text>
      <Action primary title="확인" onPress={() => setRestoreReport(null)} />
    </Dialog>}
    {exportsConfirm && <Dialog title="내보낸 파일 정리" onClose={() => setExportsConfirm(null)}>
      <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{`제출 묶음·백업·한 칸 공유를 만들 때 앱에 남은 사본 ${exportsConfirm.length}개예요. 지워도 세트·그림 원본은 그대로이고, 이미 다른 앱(드라이브·메신저 등)으로 보낸 파일도 그대로예요.`}</Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>앱 안에만 있는 백업 파일은 지우면 되돌릴 수 없어요. 앱 밖에 보관했는지 먼저 확인해 주세요.</Text>
      <Action danger icon="delete-outline" title="사본 지우기" onPress={() => { const done = removeExports(exportsConfirm.map(x => x.name)); setExportsConfirm(null); setNotice(`내보낸 사본 ${done.removed}개를 지웠어요. 세트·그림은 그대로예요.`); }} />
      <Action title="그대로 두기" onPress={() => setExportsConfirm(null)} />
    </Dialog>}
    {contactFallback && <Dialog title="문의 이메일" onClose={() => setContactFallback(false)}>
      <Text>메일 앱을 열지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.</Text>
      <Text selectable accessibilityLabel="복사할 문의 이메일" style={{ fontSize: 17, color: C.ink }}>{supportEmail}</Text>
    </Dialog>}
    {proSheet && <Modal animationType="slide" onRequestClose={() => { setProSheet(false); resetPayment(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="PRO 닫기" onPress={() => { setProSheet(false); resetPayment(); }} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Glyph name="chevron-left" size={28} color={C.ink} /></Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: C.ink }}>PRO</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: T.gap.lg, gap: T.gap.md, paddingBottom: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.ink, lineHeight: 32, letterSpacing: -.4 }}>{'다양한 붓과 움직임으로\n여러 칸을 한 번에'}</Text>
          {/* 45.43 S6 전/후(시안 WB2-States 'PRO 표현'): 색이 아니라 배지·구성으로 PRO 를 보인다(보라 없음).
              왼쪽·오른쪽은 같은 그림(proFeatureArtwork source / sourceAfter)이다. 달라지는 것은 '무엇이 움직이는가'뿐 —
              실제 PRO 기능인 '부분만 움직이기'(고른 레이어만 따로)를 그린다. 흔드는 손 자리만 점선 원으로 표시한다. */}
          <View testID="PRO 전후" accessibilityLabel="움직임 전후 미리보기" style={{ gap: 12, padding: 14, borderRadius: 24, backgroundColor: C.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ProTag />
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>같은 그림, 움직임만 달라져요</Text>
            </View>
            {/* 2026-10-15: 같은 그림에 무료 통통 · PRO 손 흔들기(부분) · PRO 등장→인사(단계)를 건 세 장. 앱 엔진으로 구운 실제 움직임이다(scripts/pro-clips.cjs). */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([[ASSET_SLOTS.proFeatureArtwork.source, '무료 ·', '전체 움직임', '통통', false],
                 [ASSET_SLOTS.proFeatureArtwork.sourceAfter, 'PRO ·', '부분 움직임', '손만 흔들기', true],
                 [ASSET_SLOTS.proFeatureArtwork.sourceSteps, 'PRO ·', '이어 움직임', '등장 → 인사', true]] as const).map(([src, tier, label, hint, pro]) =>
                <View key={label} accessibilityLabel={`${tier} ${label} · ${hint}`} style={{ flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: pro ? C.paper : C.surface2, borderWidth: pro ? 1.5 : 0, borderColor: C.edge, alignItems: 'center', gap: 4 }}>
                  <Image accessibilityIgnoresInvertColors source={src ?? undefined} style={{ width: 86, height: 86 }} resizeMode="contain" />
                  <View style={{ flexDirection: 'row', gap: 3 }}><Text style={{ fontSize: 11, fontWeight: pro ? '800' : '400', color: pro ? C.ink : C.muted }}>{tier}</Text><Text style={{ fontSize: 11, fontWeight: pro ? '800' : '700', color: pro ? C.ink : C.muted }}>{label}</Text></View>
                  <Text style={{ fontSize: 11, color: C.muted }}>{hint}</Text>
                </View>)}
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>PRO 움직임과 조합은 구매 전에 내 그림으로 미리 볼 수 있어요(저장은 PRO).</Text>
            {/* PRO 움직임 칩: 실제 PRO 효과 이름(PRESETS 에서 PRO 인 것)을 앞에서 다섯, 나머지는 +N. */}
            <View testID="PRO 움직임 칩" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {proMotions.slice(0, 5).map(m => <View key={m.id} style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.surface2, justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{m.label}</Text></View>)}
              {proMotions.length > 5 && <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.surface2, justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>+{proMotions.length - 5}</Text></View>}
            </View>
          </View>
          {/* 실제로 PRO 인 것만 적는다(짧게). 그리기 기본 도구(진하기·보정·스포이드·팔레트·RGB)는 무료라 넣지 않는다. */}
          {proFeatures.map(([title, hint, icon]) =>
            <View key={title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name={icon} size={IconSize.row} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{title}</Text>
                <Text numberOfLines={2} style={{ fontSize: 12, color: C.muted }}>{hint}</Text>
              </View>
            </View>)}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4 }}>
            <Glyph name="check" size={16} color={C.muted} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: C.muted }}>{`무료 브러시 ${CATALOG.filter(b => !b.pro).length}종 · 무료 움직임 ${PRESETS.filter(p => !isProPreset(p.id)).length}종으로 한 세트를 끝까지 만들고, 워터마크 없이 파일 묶음으로 내보낼 수 있어요.`}</Text>
          </View>
          {entitlementLabel(entitlement) !== '무료' && <Text style={{ fontSize: 12, color: C.muted }}>{entitlementLabel(entitlement)}</Text>}
          {expiredButRemembered(entitlement) && <Text style={{ fontSize: 12, color: C.ink }}>기간이 끝나도 이미 만든 움직임은 계속 재생되고 내보낼 수 있어요.</Text>}
          {/* 파는 것은 하나다: 한 번 구매하면 계속 쓰는 PRO. 값은 **스토어가 말해 주는 것만** 적는다.
              불러오지 못하면 값을 지어내지 않고, 지금 살 수 없다는 것과 다음에 할 일을 적는다. */}
          {purchasesClosed() ? <Text testID={trial ? 'PRO 체험 안내' : '구매 비활성 안내'} style={{ color: C.ink, fontSize: 15, lineHeight: 23 }}>{trial ? PRO_TRIAL_NOTE : PURCHASES_CLOSED_NOTE}</Text> : <>
          <View accessibilityRole="summary" accessibilityLabel={prices?.lifetime ? 'PRO 가격 ' + prices.lifetime + (prices.regular ? ', 할인 중, 정가 ' + prices.regular : '') : 'PRO 가격을 불러오지 못했어요'}
            style={{ borderWidth: 1, borderColor: prices?.lifetime ? C.accentBorder : C.line, borderRadius: 16, padding: 14, gap: 2, backgroundColor: prices?.lifetime ? C.accentSoft : C.surface2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{PLANS[0].label}</Text>
            {prices?.lifetime
              ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  {!!prices.percent && <Text testID="PRO 할인율" style={{ fontSize: 22, fontWeight: '900', color: C.danger }}>{`${prices.percent}%`}</Text>}
                  <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{prices.lifetime}</Text>
                  {!!prices.regular && <Text testID="PRO 정가" accessibilityLabel={'정가 ' + prices.regular} style={{ fontSize: 14, color: C.muted, textDecorationLine: 'line-through' }}>{prices.regular}</Text>}
                </View>
              : <Text style={{ fontSize: 15, fontWeight: '700', color: C.muted }}>{payment.phase === 'loading' ? '가격을 불러오는 중…' : '가격을 불러오지 못했어요'}</Text>}
            {!prices?.lifetime && payment.phase !== 'loading' && <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>지금은 구매할 수 없어요. 잠시 뒤 다시 시도해 주세요. 무료 기능은 그대로 쓸 수 있어요.</Text>}
            <Text style={{ fontSize: 11, color: C.muted }}>구독이 아니라 한 번만 결제해요. 정기 결제나 해지가 없어요.</Text>
          </View>
          <PaymentStatus payment={payment} onRestore={() => void restorePro()} onRetry={() => void loadPrices()} />
          {payment.phase === 'bought' || payment.phase === 'restored'
            ? <Action primary title="PRO로 만들러 가기" onPress={() => { setProSheet(false); resetPayment(); }} />
            : <Action primary title="PRO 한 번 구매하기" busy={payment.phase === 'buying'} disabled={!prices?.lifetime || payment.phase === 'loading' || payment.phase === 'restoring' || isPro(entitlement)} onPress={() => void startPurchase()} />}
          </>}
          {/* 내부 검수 빌드에서는 이 기기에서 결제를 열 수 없는 일이 흔하다. 잠금에 부딪힌 검수자가
              설정 깊은 곳의 토글을 찾아 헤매지 않도록, 막힌 바로 그 자리에서 켤 수 있게 한다.
              출시 구성에서는 internalReviewBuild() 가 거짓이라 이 줄이 아예 그려지지 않는다. 구매가 아니다. */}
          {reviewCapable() && !pro && <Action icon="key-variant" title="결제 없이 검수용 PRO 켜기"
            onPress={() => { try { commit(st => ({ ...st, reviewUnlock: true })); setProSheet(false); resetPayment(); setNotice(internalReviewBuild() ? REVIEW_BUILD_NOTE : REVIEW_DEV_NOTE); } catch (e) { setNotice('검수용 PRO 를 켜지 못했어요. ' + userMessage(e)); } }} />}
          <Action title={trial ? 'PRO 체험 계속하기' : '무료로 계속하기'} onPress={() => { setProSheet(false); resetPayment(); }} />
          {!purchasesClosed() && <Pressable accessibilityRole="button" accessibilityLabel="구매 복원" disabled={payment.phase === 'buying' || payment.phase === 'restoring'} onPress={() => void restorePro()} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{payment.phase === 'restoring' ? '구매 내역을 확인하는 중…' : '구매 복원'}</Text></Pressable>}
          {/* 일회성 구매에는 해지가 없다. 영수증·환불은 스토어의 구매 내역에서 본다.
              예전 구독 저장본을 가진 사람에게는 구독 관리 길도 함께 둔다 — 길을 막지 않는다. */}
          {isPro(entitlement) && !!entitlement && entitlement.plan === 'lifetime' && <Pressable accessibilityRole="button" accessibilityLabel="구매 내역" onPress={() => { Linking.openURL(purchaseHistoryUrl()).catch(() => setPayment({ phase: 'failed', problem: 'store-unavailable' })); }} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>구매 내역 보기</Text></Pressable>}
          {isPro(entitlement) && !!entitlement && (entitlement.plan === 'monthly' || entitlement.plan === 'yearly') && <Pressable accessibilityRole="button" accessibilityLabel="구독 관리" onPress={() => { Linking.openURL(subscriptionManageUrl('pro_' + entitlement.plan)).catch(() => setPayment({ phase: 'failed', problem: 'store-unavailable' })); }} style={{ minHeight: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>구독 관리 · 해지</Text></Pressable>}
          <Text style={{ fontSize: 10, color: C.muted, lineHeight: 16 }}>한 번 구매하면 같은 스토어 계정에서 계속 쓸 수 있어요. 기기를 바꾸거나 다시 설치하면 구매 복원을 눌러 주세요. 작품과 파일은 어떤 경우에도 지우지 않아요.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>}
    {chatOpen && project && <ChatSim visible setName={project.projectName} onClose={() => setChatOpen(false)}
      stickers={project.slots.filter(sl => sl.finalImage).map(sl => ({ number: sl.number, uri: imageUri((sl.motionImage ?? sl.finalImage)!.path) }))} />}
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
            <Glyph name={icon} size={19} color={C.muted} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: C.ink }}>{label}</Text>
            {locked && <ProTag />}
          </Pressable>)}
      </View>
    </Dialog>}
    {painting && project && slot && <Painter key={project.id + '/' + slot.number} slot={slot} slotCount={project.slots.length} setName={project.projectName} canon={project.canon.image} canonName={project.characterName} canonLocked={project.canon.locked} palette={store?.palette ?? []} onColorUsed={rememberColor} userPalette={store?.userPalette ?? []} onSaveUserColor={saveUserColor} onRemoveUserColor={removeUserColor}
      brushSettings={project.brush}
      favoriteBrushes={store?.favoriteBrushes}
      onFavoriteBrushes={keys => { try { commit(st => ({ ...st, favoriteBrushes: keys })); } catch (e) { setNotice('즐겨찾기를 저장하지 못했어요. ' + userMessage(e)); } }}
      onBrushSettings={brush => { try { changeProject(project.id, p => ({ ...p, brush })); } catch (e) { setNotice('브러시 설정을 저장하지 못했어요. ' + userMessage(e)); } }}
      completeTitle={nextUnfinished(project, slot.number) === null ? '완성 · 전체 보기' : '완성 · 다음'}
      hasPrevious={!!previousDrawn(project, slot.number)}
      previousImage={previousDrawn(project, slot.number)?.finalImage}
      pro={pro}
      onRequestPro={() => setProSheet(true)}
      previousMotion={project.slots.filter(s => s.number < slot.number && isAnimated(s)).at(-1)?.motion ?? null}
      guideHint={entryHere ? guideHint : null}
      onGuideHintDone={() => setGuideHint(null)}
      guideExample={entryHere ? guideExample : null}
      guideExampleMode={entryHere ? guideExampleMode : null}
      // 번들 그림을 **이 칸의** 참고 사진과 같은 자리에 들여놓는다. 저장·복원·삭제는 기존 참고 정책이 그대로 맡는다.
      // 45.37: 예전에는 세트의 모든 칸에 넣어, 한 칸에서 고른 밑그림이 다른 칸에도 깔렸다(새 칸은 첫 참고를 켜서 연다).
      onImportGuideExample={async artwork => {
        const image = await importBundledImage(artwork);
        changeProject(project.id, q => ({ ...q, slots: q.slots.map(t => t.number !== slot.number ? t : { ...t, referenceImages: mergeImages(t.referenceImages, [image]) }) }));
        return image;
      }}
      initialTool={lastTool}
      onToolChange={setLastTool}
      paperTexture={store?.paperTexture === true}
      savedMotions={store?.savedMotions ?? []}
      onSaveMotion={saveMotion}
      onForgetMotion={forgetMotion}
      onComplete={completeAndNext}
      returnToReview={returnToExport}
      onReturnToReview={returnToReview}
      onSetReference={useAsReference}
      onCopyPrevious={copyPreviousWork}
      onOpenLessons={() => { lessonsNext.current = true; }}
      onClose={() => { setPainting(false); setSlotNumber(null); clearEntry(); if (lessonsNext.current) { lessonsNext.current = false; setReturnToExport(false); setProjectId(null); setHomeView('home'); setHomeTab('class'); return; } if (returnToExport) { setScreen('export'); setReturnToExport(false); } }}
      // 옆 칸으로 넘어가면 이 칸에서 고른 예시는 따라가지 않는다. 칸에 깔아 둔 밑그림은 그 칸에 그대로 남는다.
      onNavigate={number => { clearEntry(); setSlotNumber(number); }}
      onImportDrawing={async () => { const picked = await pickImages(); return picked[0] ? await dataUrl(picked[0]) : null; }}
      cutouts={(store?.cutouts ?? []).map(c => ({ id: c.id, name: c.name, path: c.image.path }))}
      onKeepCutout={async data => keepCutout(data)}
      onUseCutout={async id => { const found = (current.current?.cutouts ?? []).find(c => c.id === id); return found ? await dataUrl(found.image) : null; }}
      onForgetCutout={forgetCutout}
      initialImport={entryHere ? pendingImport : null}
      onInitialImportUsed={() => setPendingImport(null)}
      // 참고 사진은 **지금 칸에만** 들어간다(45.37 사용자 신고: 한 칸에서 가져온 참고가 세트의 모든 칸에 깔렸다).
      // 이미 다른 칸에 들어가 있던 참고는 사용자 데이터라 지우지 않는다 — 그 칸에서 따로 지울 수 있다.
      onAddReferences={async () => { const added = await pickImages(true); if (added.length) changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => s.number !== slot.number ? s : { ...s, referenceImages: mergeImages(s.referenceImages, added) }) })); return added; }}
      onRemoveReference={path => { changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => s.number !== slot.number ? s : ({ ...s, referenceImages: s.referenceImages.filter(image => image.path !== path), work: s.work ? { ...s.work, references: s.work.references.filter(reference => reference.image?.path !== path), activeLayerId: s.work.activeLayerId.startsWith('ref-') && s.work.references.some(reference => reference.id === s.work!.activeLayerId && reference.image?.path === path) ? 'draw-1' : s.work.activeLayerId } : undefined })) })); }}
      onSave={(payload, dialogue, complete) => {
        const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!;
        const { finalImage, work } = savePainterWork(payload, latest.referenceImages);
        // The moving file is only rebuilt when the painter sent one, so a still cut stays still
        // and a failed encode never replaces a good loop with nothing.
        const motion = payload.motion ?? undefined;
        let motionImage = latest.motionImage, submitImage = latest.submitImage;
        // 움직임 효과가 없어도 애니메이션 장이 있으면 움직이는 칸이다(2026-10-15).
        if (!motion && !work.frames) { motionImage = undefined; submitImage = undefined; }
        else if (payload.gif?.data) {
          try { motionImage = saveMotionLoop(payload.gif.data); } catch (e) { console.warn(e); setNotice('움직이는 파일을 만들지 못했어요. 그림은 저장했어요.'); }
          if (payload.gif.webp) { try { submitImage = saveSubmitLoop(payload.gif.webp); } catch (e) { console.warn(e); submitImage = undefined; setNotice('WebP를 만들지 못했어요. 그림과 움직임은 저장했어요.'); } }
          else submitImage = undefined;
        }
        // 공식 도구에 넘길 PNG 프레임은 여기서 만들지 않는다. 내보낼 때 지금 그림·움직임에서 새로 만든다.
        return saveFinal(finalImage, work, dialogue, complete, motion, motionImage, submitImage);
      }}
      onShare={async () => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; if (!latest.finalImage || !await Sharing.isAvailableAsync()) throw new Error('공유할 이미지가 없거나 공유 기능을 사용할 수 없습니다.'); // 2026-10-05: 움직임이 있는 칸은 움직이는 GIF 를 보낸다(예전에는 정지 PNG 만 보내 받는 쪽에서 움직임이 없어 보였다).
        // 받는 앱·갤러리에 보이는 이름이 작품을 알아보게 '세트이름-칸번호-시각' 사본을 만들어 보낸다. 원본 파일은 그대로다.
        const source = latest.motion && latest.motionImage ? latest.motionImage : latest.finalImage; const gif = source.path.endsWith('.gif');
        const copy = cutFile(`${safeName(project.projectName)}-${String(slot.number).padStart(2, '0')}-${fileStamp()}.${gif ? 'gif' : 'png'}`); copy.write(localFile(source.path).bytesSync());
        await Sharing.shareAsync(copy.uri, { mimeType: gif ? 'image/gif' : 'image/png', UTI: gif ? 'com.compuserve.gif' : 'public.png' }); }} />}
  </SafeAreaView>;
}

// 결제 상태. 팝업을 띄우지 않고 PRO 화면 안에 카드 한 장으로 놓는다 — 기능 목록과 같은 모양(둥근 아이콘 + 굵은 한 줄 + 설명).
// 스토어 오류 코드는 보여 주지 않는다. 할 일이 있으면 글자 버튼 하나만 둔다.
type Payment = { phase: 'idle' | 'loading' | 'ready' | 'unavailable' | 'buying' | 'restoring' | 'bought' | 'restored' | 'cancelled' | 'pending' | 'none' | 'failed'; problem?: PaymentProblem | 'save'; reason?: string };
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
    // 서버가 거절 이유를 알려 주면(예: 다른 emoti 계정에 연결된 구매) 그 문장을 그대로 보인다.
    case 'unavailable': case 'failed': { const t = problemText(payment.problem ?? 'unknown'); return { tone: 'warn', icon: 'alert-circle-outline', title: t.title, next: payment.problem === 'refused' && payment.reason ? payment.reason : t.next, action: t.action }; }
    default: return null;
  }
}
function PaymentStatus({ payment, onRestore, onRetry }: { payment: Payment; onRestore: () => void; onRetry: () => void }) {
  const view = paymentView(payment);
  if (!view) return null;
  const good = view.tone === 'good';
  return <View testID="결제 상태" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: good ? '#CFE8D8' : T.line, backgroundColor: good ? T.successSoft : T.paper }}>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: good ? T.paper : view.tone === 'warn' ? T.warningSoft : T.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph name={view.icon} size={19} color={view.tone === 'warn' ? T.warning : good ? T.success : T.ink} />
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

// 첫 실행 안내의 그림 칸(2026-10-06). 표현 가이드 캐릭터(선 그림, 몸 안이 흰 표시용 그림)를 실제 화면 요소처럼 배치한다.
// 새 그림 파일은 없다. 칩은 실제 버튼 이름 그대로다(펜·지우개·그림 가져오기 / 무료 효과 이름 / 자동 저장·파일 묶음·공유).
const guideFigure = (id: string) => { for (const card of EXPRESSION_GUIDE.cards) for (const x of card.examples ?? []) if (x.id === id) return shownArt(x); return null; };
function IntroChip({ icon, label, on, small }: { icon?: React.ComponentProps<typeof Glyph>['name']; label: string; on?: boolean; small?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: small ? 24 : 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: on ? C.accent : C.paper, borderWidth: 1, borderColor: on ? C.accentBorder : C.line }}>
    {!!icon && <Glyph name={icon} size={14} color={C.ink} />}
    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: C.ink }}>{label}</Text>
  </View>;
}
// 2026-10-16: 사용 안내 그림은 대표 캐릭터 콘(assets/mascot). 표현 가이드 그림(다른 캐릭터들)은 안내에 쓰지 않는다.
const CORN_ART: Record<string, ImageSourcePropType> = {
  wave: require('./assets/mascot/corn-wave.png'), cheer: require('./assets/mascot/corn-cheer.png'), nod: require('./assets/mascot/corn-nod.png'),
  heart: require('./assets/mascot/corn-heart.png'), shy: require('./assets/mascot/corn-shy.png'),
  goguma: require('./assets/mascot/goguma-wave.png'), kong: require('./assets/mascot/kong-cheer.png'),
};
function IntroCanvas({ id, size, lift }: { id: string; size: number; lift?: Animated.Value }) {
  const art = CORN_ART[id] ?? guideFigure(id);
  return <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {!!art && <Animated.Image accessibilityIgnoresInvertColors source={art} resizeMode="contain" style={{ width: size * .8, height: size * .8, transform: lift ? [{ translateY: lift }] : [] }} />}
  </View>;
}
function IntroArt({ step }: { step: number }) {
  // 짧은 화면(높이 720dp 미만, 예: 360×640)에서는 그림 칸을 줄인다 — 줄이지 않으면 창이 최대 높이를 넘어
  // 3쪽 '시작하기'·1쪽 '건너뛰기'가 스크롤해야 보이는 자리로 밀려났다(2026-10-07 360×640 에뮬레이션 캡처).
  const compact = useWindowDimensions().height < 720;
  const canvas = compact ? 70 : 104, tile = compact ? 33 : 50, gap = compact ? 4 : 6;
  // 움직임 쪽만 그림이 실제로 통통 뛴다(앱의 '통통'과 같은 느낌의 위아래 반복). 다른 쪽은 멈춘 그림이다.
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step !== 1) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(lift, { toValue: -8, duration: 280, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.delay(260),
    ]));
    loop.start();
    return () => { loop.stop(); lift.setValue(0); };
  }, [step, lift]);
  const free = PRESETS.filter(p => !isProPreset(p.id));
  const shown = [free.find(p => p.id === 'bounce'), ...free.filter(p => p.id !== 'bounce')].filter(Boolean).slice(0, 3) as typeof free;
  return <View testID="사용 안내 그림" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ height: compact ? 84 : 136, borderRadius: 16, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 12 }}>
    {step === 0 && <>
      <IntroCanvas id="wave" size={canvas} />
      <View style={{ gap }}>
        <IntroChip small={compact} icon="pencil-outline" label="펜" on />
        <IntroChip small={compact} icon="eraser" label="지우개" />
        <IntroChip small={compact} icon="image-plus" label="그림 가져오기" />
      </View>
    </>}
    {step === 1 && <>
      <IntroCanvas id="cheer" size={canvas} lift={lift} />
      <View style={{ gap }}>
        {shown.map((p, i) => <IntroChip small={compact} key={p.id} label={p.label} on={i === 0} />)}
      </View>
    </>}
    {step === 2 && <>
      <View style={{ width: canvas, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {['wave', 'goguma', 'kong', 'heart'].map(id => <IntroCanvas key={id} id={id} size={tile} />)}
      </View>
      <View style={{ gap }}>
        <IntroChip small={compact} icon="check" label="자동 저장" />
        <IntroChip small={compact} icon="folder-zip-outline" label="파일 묶음(ZIP)" on />
        <IntroChip small={compact} icon="share-variant" label="공유" />
      </View>
    </>}
  </View>;
}
