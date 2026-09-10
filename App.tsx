import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View, Image, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { Action, Dialog, Field, Preview, styles, T } from './src/components/ui';
import { ImageAnalyzer, type Analyzer } from './src/components/image-analyzer';
import { Painter } from './src/painter/painter';
import { KAKAO_STATIC_SPEC as SPEC } from './src/constants/kakao-spec';
import { createProject, droppedImagePaths, duplicates, IDEA_SUGGESTIONS, NO_DIALOGUE_IDEA } from './src/project';
import { deleteLocalImages, exportUri, imageUri, loadStore, saveStore } from './src/services/storage';
import { exportSet } from './src/services/export';
import { pickImages, savePainterWork } from './src/services/images';
import { inspectImage } from './src/services/qa';
import { conceptAssistant } from './src/services/concept';
import type { Check, LocalImage, Project, Slot, Store, QA, PainterWork } from './src/types';

const guideFields = [['expressionGuide', '표정 가이드'], ['poseGuide', '포즈 가이드'], ['compositionGuide', '구도 가이드'], ['effectGuide', '효과 가이드'], ['textPlacementGuide', '텍스트 배치']] as const;
const colors: Record<string, string> = { PASS: '#55B989', WARNING: '#E7A93C', FAIL: '#E35C62', EMPTY: '#A5A097', DRAWING: '#67A9E8', REVIEW: '#A786DF', PLANNED: '#75C79C' };
const C = T;
function Checks({ checks }: { checks: Check[] }) { return <>{checks.filter(c => c.status !== 'PASS').map(c => <View key={c.label} style={{ gap: 4 }}><Text style={{ color: colors[c.status], fontWeight: '700' }}>{c.status} · {c.label}</Text><Text style={styles.muted}>{c.detail}</Text></View>)}</>; }
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
  const [projectId, setProjectId] = useState<string | null>(null), [slotNumber, setSlotNumber] = useState<number | null>(null), [canonOpen, setCanonOpen] = useState(false), [painting, setPainting] = useState(false);
  const [busy, setBusy] = useState(''), [ideaText, setIdeaText] = useState('');
  const [menu, setMenu] = useState(false), [detail, setDetail] = useState(false), [setQA, setSetQA] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null), [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [issues, setIssues] = useState<QA | null>(null);
  const [screen, setScreen] = useState<'board' | 'planning' | 'preview'>('board');
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - T.gap.lg * 2 - T.gap.sm * 3) / 4;
  const projectCardWidth = (screenWidth - T.gap.lg * 2 - T.gap.md) / 2;
  const analyzer = useRef<Analyzer>(null);
  function load() { try { const result = loadStore(); current.current = result.store; setStore(result.store); setLoadError(''); if (result.recovered) setNotice('이전 저장 사본을 복구했습니다.'); } catch (e) { setLoadError(String(e)); } }
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
  function updateSlot(patch: Partial<Slot>) { updateProject(p => ({ ...p, slots: p.slots.map(s => s.number === slotNumber ? { ...s, ...patch } : s) })); }
  function updateSlotNumber(number: number, patch: Partial<Slot>) { updateProject(p => ({ ...p, slots: p.slots.map(s => s.number === number ? { ...s, ...patch } : s) })); }
  // What the user sees while typing: the stored slot with the unwritten edit laid over it.
  // One reference intake path, shared by planning and Painter: picked images join every slot.
  function addReferences() {
    void task('참고 저장 중…', async () => {
      const images = await pickImages(true);
      if (images.length) updateProject(p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, images) })) }));
    });
  }
  const project = store?.projects.find(p => p.id === projectId), slot = project?.slots.find(s => s.number === slotNumber);
  function back() { if (busy) return; if (slotNumber !== null) { setSlotNumber(null); setDetail(false); } else if (canonOpen) setCanonOpen(false); else if (screen !== 'board') setScreen('board'); else setProjectId(null); }
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (painting) return false; if (projectId) { back(); return true; } return false; }); return () => sub.remove(); }, [projectId, slotNumber, canonOpen, busy, painting, screen]);
  async function task(label: string, work: () => Promise<void>) { if (busy) return; setBusy(label); try { await work(); } catch (e) { Alert.alert('작업 실패', String(e)); } finally { setBusy(''); } }
  async function analyzed(image: LocalImage): Promise<LocalImage> { if (image.metrics) return image; try { return { ...image, metrics: await analyzer.current!.analyze(image) }; } catch { setNotice('일부 픽셀 분석을 수행하지 못했습니다. 해당 검사는 WARNING으로 표시합니다.'); return image; } }
  async function runQA(all: boolean) {
    if (!project) return;
    const id = project.id;
    await task('이미지 검수 중…', async () => {
      const canon = project.canon.image ? await analyzed(project.canon.image) : undefined;
      const checked = new Map<number, Slot>();
      for (const s of project.slots.filter(s => all || s.number === slotNumber)) {
        const finalImage = s.finalImage ? await analyzed(s.finalImage) : undefined;
        const qa = inspectImage(finalImage, canon);
        checked.set(s.number, { ...s, finalImage, qa, status: finalImage ? qa.status : s.status });
      }
      changeProject(id, p => ({ ...p, canon: { ...p.canon, image: canon }, slots: p.slots.map(s => checked.get(s.number) ?? s) }));
      if (all) setSetQA(true); else { const qa = checked.get(slotNumber!)?.qa; if (qa) setIssues(qa); }
    });
  }
  function saveFinal(finalImage: LocalImage, goHome: boolean, work?: PainterWork, dialogue?: string) {
    if (!project || !slot) return;
    let qa: QA;
    try { qa = inspectImage(finalImage, project.canon.image); }
    catch { qa = { status: 'WARNING', checkedAt: new Date().toISOString(), checks: [{ label: '자동 검사', status: 'WARNING', detail: '검사를 마치지 못했어요. 상세에서 다시 검사해 주세요.' }], consistency: [], notes: [] }; }
    changeProject(project.id, p => ({ ...p, lastSlot: slot.number, slots: p.slots.map(s => s.number === slot.number ? { ...s, finalImage, work, dialogue: dialogue ?? s.dialogue, qa, status: qa.status } : s) }));
    if (goHome) { setPainting(false); setSlotNumber(null); setDetail(false); }
    if (!painting && qa.status !== 'PASS') setIssues(qa);
    return qa;
  }
  function openPainter() {
    if (!slot) return;
    setPainting(true);
  }
  function createNewProject() {
    const taken = new Set((current.current?.projects ?? []).map(p => p.projectName));
    let name = '새 이모티콘 세트';
    for (let n = 2; taken.has(name); n++) name = `새 이모티콘 세트 ${n}`;
    const p = createProject(name, '');
    try { commit(s => ({ ...s, projects: [...s.projects, p] })); setProjectId(p.id); setScreen('board'); }
    catch (e) { Alert.alert('저장 실패', String(e)); }
  }
  // One tap puts an idea on the next free slot. Nothing else is required of it.
  function assignIdea(text: string) {
    if (!project) return;
    const target = project.slots.find(s => !s.finalImage && !s.dialogue.trim() && !s.noDialogue);
    if (!target) { setNotice('빈 칸이 없어요.'); return; }
    const silent = text === NO_DIALOGUE_IDEA;
    updateSlotNumber(target.number, { dialogue: silent ? '' : text, noDialogue: silent, status: target.status === 'EMPTY' ? 'PLANNED' : target.status });
  }
  function clearIdea(number: number) {
    const target = project?.slots.find(s => s.number === number);
    if (!target) return;
    updateSlotNumber(number, { dialogue: '', noDialogue: false, status: target.finalImage ? target.status : 'EMPTY' });
  }
  function drawFrom(number?: number) {
    if (!project) return;
    const target = number ?? project.slots.find(s => !s.finalImage && (s.dialogue.trim() || s.noDialogue))?.number
      ?? project.slots.find(s => !s.finalImage)?.number ?? project.lastSlot ?? 1;
    setScreen('board'); setSlotNumber(target); setDetail(false); setPainting(true);
  }
  function deleteProject(id: string) {
    const target = current.current?.projects.find(p => p.id === id);
    if (!target) return;
    try { commit(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) })); }
    catch (e) { Alert.alert('삭제 실패', String(e)); return; }
    if (id === projectId) { setProjectId(null); setSlotNumber(null); setCanonOpen(false); setDetail(false); }
    setConfirmDeleteId(null); setManageId(null);
    setNotice(`${target.projectName} 세트를 삭제했어요.`);
  }
  function rememberColor(color: string) {
    try { commit(s => ({ ...s, palette: [color, ...(s.palette ?? []).filter(c => c !== color)].slice(0, 8) })); } catch { /* colour history is a convenience, never a blocker */ }
  }
  // Deterministic set-level checks. Everything here works offline.
  const setChecks: Check[] = !project ? [] : [
    ...(() => {
      const missing = project.slots.filter(s => !s.finalImage).length;
      return missing ? [{ label: '빠진 칸', status: (missing === SPEC.count ? 'FAIL' : 'WARNING') as Check['status'], detail: `${missing}칸이 아직 비어 있어요.` }] : [];
    })(),
    ...project.slots.filter(s => s.finalImage && (s.finalImage.width !== SPEC.width || s.finalImage.height !== SPEC.height))
      .map(s => ({ label: `${String(s.number).padStart(2, '0')}번 크기`, status: 'FAIL' as const, detail: `${SPEC.width}×${SPEC.height}가 아니에요.` })),
    ...project.slots.filter(s => s.finalImage && s.finalImage.metrics && !s.finalImage.metrics.transparent)
      .map(s => ({ label: `${String(s.number).padStart(2, '0')}번 배경`, status: 'FAIL' as const, detail: '배경이 투명하지 않아요.' })),
    ...duplicates(project.slots).map(group => ({ label: '겹친 대사', status: 'WARNING' as const, detail: `${group.map(n => String(n).padStart(2, '0')).join(', ')}번이 같아요.` })),
    ...project.slots.filter(s => s.qa?.status === 'FAIL').map(s => ({ label: `${String(s.number).padStart(2, '0')}번 검사`, status: 'FAIL' as const, detail: '자동 검사에서 문제가 나왔어요.' })),
  ];
  function exportProject() {
    if (!project) return;
    void task('제출용 파일 만드는 중…', async () => {
      const result = exportSet(project);
      const made = result.missing ? `${result.count}칸으로 제출 파일을 만들었어요. ${result.missing}칸은 아직 비어 있어요.` : `${result.count}칸 전체로 제출 파일을 만들었어요.`;
      if (!await Sharing.isAvailableAsync()) { setNotice(`${made} 저장 위치: ${result.path}`); return; }
      await Sharing.shareAsync(exportUri(result.path), { mimeType: 'application/zip', UTI: 'public.zip' });
      setNotice(`${made} 공유 창에서 저장할 곳을 골라 주세요.`);
    });
  }
  const managed = store?.projects.find(p => p.id === manageId);
  const pendingDelete = store?.projects.find(p => p.id === confirmDeleteId);
  const dupes = project ? duplicates(project.slots) : [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><StatusBar style="dark" /><ImageAnalyzer ref={analyzer} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {project && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, minHeight: 58, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" disabled={!!busy} onPress={back} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, color: C.ink }}>‹</Text></Pressable>
        {!slot && !canonOpen && (project.canon.image ? <Image source={{ uri: imageUri(project.canon.image.path) }} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF' }} resizeMode="contain" /> : <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '900' }}>{project.characterName.slice(0, 1)}</Text></View>)}
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 16, color: C.ink, fontWeight: '900' }}>{canonOpen ? '캐릭터 메모' : slot ? `슬롯 ${String(slot.number).padStart(2, '0')}` : screen === 'planning' ? '아이디어' : screen === 'preview' ? '전체 보기' : project.projectName}</Text>{!slot && !canonOpen && screen === 'board' && <Text style={{ fontSize: 10, color: C.muted }}>{project.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성</Text>}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="프로젝트 메뉴" disabled={!!busy} onPress={() => setMenu(true)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, color: C.ink }}>⋯</Text></Pressable>
      </View>}
      {!!busy && <Text style={{ paddingHorizontal: 14, paddingVertical: 4, color: C.muted }}>{busy}</Text>}
      {!!saveError && <View style={{ padding: 12, backgroundColor: '#FFE4DF' }}><Text selectable>{saveError}</Text><Action title="다시 저장" onPress={() => { try { commit(s => s); } catch {} }} /></View>}
      <ScrollView pointerEvents={busy ? 'none' : 'auto'} key={`${projectId}/${slotNumber}/${canonOpen}/${screen}`} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
        {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={() => setNotice('')} style={{ padding: 8, borderRadius: 12, backgroundColor: '#FFF6D8' }}><Text>{notice} ×</Text></Pressable>}
        {loadError ? <><Text selectable>{loadError}</Text><Action title="다시 불러오기" onPress={load} /></> : !store ? <Text>불러오는 중…</Text> : !project ? <>
          <View style={{ marginBottom: 2 }}>
            <Text style={styles.title}>내 작업실</Text>
            <Text style={[styles.muted, { marginTop: 2, fontSize: 13 }]}>그려 저장하고, 한 세트를 끝내요.</Text>
          </View>
          {!store.projects.length && <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
            <Doodle />
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>아직 세트가 없어요</Text>
            <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18 }}>원캐릭터를 정하고, 32칸을 채우고,{'\n'}제출 파일까지 한 번에 끝낼 수 있어요.</Text>
          </View>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {store.projects.map((p, index) => {
              const cover = p.canon.image ?? p.slots.find(s => s.finalImage)?.finalImage;
              const done = p.slots.filter(s => s.finalImage).length;
              const tint = [C.peach, C.mint, C.blue][index % 3];
              return <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} key={p.id} onPress={() => { setProjectId(p.id); setDetail(false); setScreen('board'); }} style={{ width: projectCardWidth, backgroundColor: C.paper, borderRadius: T.radius.lg, borderWidth: 1, borderColor: C.line, padding: 6, gap: 5 }}>
                <View style={{ height: projectCardWidth - 52, minHeight: 92, borderRadius: T.radius.sm, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{cover ? <Image source={{ uri: imageUri(cover.path) }} style={{ width: '86%', height: '86%' }} resizeMode="contain" /> : <View style={{ alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 28, color: '#665F57' }}>〰</Text><Text style={{ fontSize: 10, color: C.muted }}>첫 그림을 기다리는 중</Text></View>}</View>
                <Text numberOfLines={1} style={{ fontSize: 14, color: C.ink, fontWeight: '800' }}>{p.projectName}</Text>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#EEE8DF', overflow: 'hidden' }}><View style={{ width: `${Math.max(2, done / SPEC.count * 100)}%`, height: '100%', backgroundColor: C.coral }} /></View>
                <Text style={{ fontSize: 10, color: C.muted }}>{done} / {SPEC.count}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.projectName} 관리`} onPress={() => setManageId(p.id)} hitSlop={6} style={{ position: 'absolute', right: 2, top: 2, width: T.tap, height: T.tap, borderRadius: T.tap / 2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, color: '#6E675E', marginTop: -8 }}>⋯</Text></Pressable>
              </Pressable>;
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="새 세트 만들기" onPress={createNewProject} style={{ width: projectCardWidth, minHeight: 104, borderRadius: T.radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D3CCC1', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 6 }}><View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18, color: '#6B5A1E' }}>＋</Text></View><Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>새 세트</Text><Text style={{ fontSize: 10, color: C.muted }}>바로 그리기</Text></Pressable>
          </View>
        </> : canonOpen ? <>
          {(() => {
            const pickCanon = () => task('이미지 저장 중…', async () => { const images = await pickImages(); if (!images[0]) return; const image = await analyzed(images[0]); updateProject(p => ({ ...p, canon: { ...p.canon, image }, slots: p.slots.map(s => ({ ...s, qa: undefined, status: s.finalImage ? 'REVIEW' : s.status })) })); });
            return <>
              <View style={{ flexDirection: 'row', gap: T.gap.md, alignItems: 'center' }}>
                <Pressable accessibilityRole="button" accessibilityLabel="원캐릭터 이미지 선택" disabled={!!busy} onPress={pickCanon} style={{ width: 116, height: 116, borderRadius: T.radius.lg, backgroundColor: project.canon.image ? '#F0ECE5' : '#FFFCF8', borderWidth: 1, borderStyle: project.canon.image ? 'solid' : 'dashed', borderColor: project.canon.image ? C.line : '#D3CCC1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {project.canon.image
                    ? <Image accessibilityLabel="원캐릭터" source={{ uri: imageUri(project.canon.image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    : <><Doodle /><Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>그림 고르기</Text></>}
                </Pressable>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.label}>캐릭터 이름</Text>
                  <TextInput accessibilityLabel="캐릭터 이름" value={project.characterName} onChangeText={characterName => updateProject(p => ({ ...p, characterName }))} style={styles.input} placeholder="이름" placeholderTextColor="#918B82" />
                  {!!project.canon.image && <Pressable accessibilityRole="button" accessibilityLabel="원캐릭터 그림 바꾸기" disabled={!!busy} onPress={pickCanon} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ fontSize: 12, color: C.muted }}>그림 바꾸기</Text></Pressable>}
                </View>
              </View>
              <Text style={[styles.muted, { fontSize: 12 }]}>이 캐릭터를 32칸 내내 같은 모습으로 유지해요.</Text>

              <View style={{ gap: 10 }}>
              {([['어떤 캐릭터인가요', [['personality', '성격'], ['speech', '말투']]], ['그릴 때 지킬 것', [['locked', '꼭 유지할 특징'], ['variable', '바꿔도 되는 특징']]]] as const).map(([section, fields]) =>
                <View key={section} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>{section}</Text>
                  <View style={{ backgroundColor: C.paper, borderRadius: T.radius.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: T.gap.md }}>
                    {fields.map(([key, label], i) => <View key={key} style={{ borderTopWidth: i ? 1 : 0, borderColor: C.line, paddingVertical: 8 }}>
                      <Field flat label={label} value={project.canon[key]} onChangeText={value => updateProject(p => ({ ...p, canon: { ...p.canon, [key]: value } }))} />
                    </View>)}
                  </View>
                </View>)}
              </View>

              <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: T.gap.md }}>
                <Field label="세트 이름" value={project.projectName} onChangeText={projectName => updateProject(p => ({ ...p, projectName }))} multiline={false} />
              </View>
            </>;
          })()}
        </> : screen === 'planning' ? <>
          {(() => {
            const chosen = project.slots.filter(s => s.dialogue.trim() || s.noDialogue);
            const free = project.slots.some(s => !s.finalImage && !s.dialogue.trim() && !s.noDialogue);
            return <>
              <Text style={[styles.muted, { fontSize: 13 }]}>막히면 하나 골라보세요. 안 써도 그리는 데는 아무 문제 없어요.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput accessibilityLabel="직접 쓰기" value={ideaText} onChangeText={setIdeaText} multiline={false} style={[styles.input, { flex: 1 }]} placeholder="직접 쓰기" placeholderTextColor="#918B82" />
                <Pressable accessibilityRole="button" accessibilityLabel="아이디어 추가" disabled={!ideaText.trim() || !free} onPress={() => { assignIdea(ideaText.trim()); setIdeaText(''); }} style={{ minHeight: T.tap, paddingHorizontal: 18, borderRadius: T.radius.sm, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: !ideaText.trim() || !free ? .4 : 1 }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>담기</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {IDEA_SUGGESTIONS.map(idea => <Pressable key={idea} accessibilityRole="button" accessibilityLabel={`아이디어 ${idea}`} disabled={!free} onPress={() => assignIdea(idea)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', opacity: free ? 1 : .4 }}><Text style={{ fontSize: 13, color: C.ink }}>{idea}</Text></Pressable>)}
              </View>
              {!!chosen.length && <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>정해둔 칸</Text>
                <View style={{ borderRadius: T.radius.md, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
                  {chosen.map((s, i) => <View key={s.number} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${String(s.number).padStart(2, '0')}번 그리기`} onPress={() => drawFrom(s.number)} style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: T.gap.md }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#B4ADA3', width: 22 }}>{String(s.number).padStart(2, '0')}</Text>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: C.ink }}>{s.noDialogue ? '무대사' : s.dialogue.trim()}</Text>
                      {!!s.finalImage && <Text style={{ fontSize: 10, color: C.muted }}>완성</Text>}
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${String(s.number).padStart(2, '0')}번 아이디어 지우기`} onPress={() => clearIdea(s.number)} style={{ width: T.tap, height: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: C.muted }}>×</Text></Pressable>
                  </View>)}
                </View>
              </View>}
              <Action primary title="그리기" onPress={() => drawFrom()} />
            </>;
          })()}
        </> : screen === 'preview' ? <>
          <Text style={styles.muted}>{project.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성 · 세트 전체 균형을 한눈에 봐요.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{project.slots.map(s => <Pressable key={s.number} testID={`preview-${s.number}`} accessibilityRole="button" accessibilityLabel={`${String(s.number).padStart(2, '0')}번 ${s.finalImage ? '완성' : '비어 있음'}`} onPress={() => { setScreen('board'); setSlotNumber(s.number); setDetail(false); setPainting(true); }} style={{ width: tileWidth, gap: 3 }}>
            <View style={{ width: tileWidth, aspectRatio: 1, borderRadius: T.radius.md, backgroundColor: s.finalImage ? C.paper : '#F0ECE5', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {s.finalImage ? <Image source={{ uri: imageUri(s.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 10, color: C.muted }}><Text style={{ fontWeight: '900', color: s.finalImage ? C.ink : '#AAA39A' }}>{String(s.number).padStart(2, '0')}</Text>{s.noDialogue ? ' 무대사' : s.dialogue.trim() ? ' ' + s.dialogue.trim() : ''}</Text>
          </Pressable>)}</View>
          <View style={styles.card}>
            <Text style={styles.subtitle}>제출 전 검사</Text>
            {setChecks.length ? setChecks.map(c => <Text key={c.label} style={{ fontSize: 13, lineHeight: 19, color: c.status === 'FAIL' ? colors.FAIL : C.ink }}>{c.label} · {c.detail}</Text>) : <Text style={styles.muted}>지금까지는 문제가 보이지 않아요.</Text>}
            <Text style={{ fontSize: 11, color: C.muted }}>{SPEC.note}</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>사전 확인일 뿐 플랫폼 승인을 보장하지 않아요.</Text>
          </View>
          <Action primary title="제출 파일 만들기" disabled={!!busy || !project.slots.some(s => s.finalImage)} onPress={exportProject} />
        </> : slot && !painting ? <>
          <Field label="대사" value={slot.dialogue} multiline={false} onChangeText={dialogue => updateSlot({ dialogue, status: slot.status === 'EMPTY' && dialogue.trim() ? 'PLANNED' : slot.status })} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Action title="아이디어 생성" onPress={() => { const suggestion = conceptAssistant.suggest(slot); const patch: Partial<Slot> = {}; for (const [key] of guideFields) if (!slot[key].trim()) patch[key] = suggestion[key]; updateSlot({ ...patch, status: slot.status === 'EMPTY' ? 'PLANNED' : slot.status }); }} />
            <Pressable accessibilityRole="button" accessibilityLabel="상세" accessibilityState={{ expanded: detail }} onPress={() => setDetail(!detail)} style={{ padding: 12 }}><Text>{detail ? '상세 접기' : '상세'}</Text></Pressable>
          </View>
          {(slot.expressionGuide || slot.poseGuide || slot.compositionGuide) ? <View style={styles.card}>{guideFields.slice(0, 3).map(([key, label]) => slot[key] ? <Text key={key} numberOfLines={2} style={{ fontSize: 13, lineHeight: 18 }}>{label.replace(' 가이드', '')} · {slot[key]}</Text> : null)}</View> : null}
          {detail && <View style={{ gap: 10 }}>
            {([['emotion', '감정'], ['situation', '상황'], ...guideFields, ['notes', '작업 메모']] as const).map(([key, label]) => <Field key={key} label={label} value={slot[key]} onChangeText={value => updateSlot({ [key]: value })} />)}
            <View style={{ flexDirection: 'row', gap: 8 }}><Preview image={project.canon.image} label="원캐릭터" size={110} /><Preview image={slot.finalImage} label="완성 그림" size={110} /></View>
            <Text style={styles.muted}>유지할 특징 · {project.canon.locked || '등록한 기준 없음'}</Text>
            <Action title="직접 그린 이미지 가져오기" onPress={() => Alert.alert('이미지 가져오기', '현재 완성 그림을 선택한 그림으로 바꿉니다.', [{ text: '취소', style: 'cancel' }, { text: '선택', onPress: () => task('저장 중…', async () => { const images = await pickImages(); if (images[0]) saveFinal(await analyzed(images[0]), false); }) }])} />
            <Action title="PNG 내보내기 / 공유" disabled={!slot.finalImage} onPress={() => task('공유 준비 중…', async () => { if (!await Sharing.isAvailableAsync()) throw new Error('공유 기능을 사용할 수 없습니다.'); await Sharing.shareAsync(imageUri(slot.finalImage!.path), { mimeType: 'image/png', UTI: 'public.png' }); })} />
            <Action title="이 슬롯 검사" onPress={() => runQA(false)} />
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.label}>참고 이미지</Text><Action title="+ 추가" onPress={() => task('참고 저장 중…', async () => { const images = await pickImages(true); updateProject(p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, images) })) })); })} /></View>
          {!!slot.referenceImages.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{slot.referenceImages.map((im, i) => <Pressable key={im.path} accessibilityRole="button" accessibilityLabel={`참고 ${i + 1} 보기`} onPress={() => Alert.alert(`참고 ${i + 1}`, '그리기에서 크게 볼 수 있습니다.')}><Image source={{ uri: imageUri(im.path) }} style={{ width: 64, height: 64, backgroundColor: '#F0ECE5', borderRadius: 10 }} resizeMode="contain" /></Pressable>)}</ScrollView>}
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0ECE5', borderRadius: T.radius.md }}>{slot.finalImage ? <Image accessibilityLabel="현재 그림" source={{ uri: imageUri(slot.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={styles.muted}>아직 그린 그림이 없어요</Text>}</View>
        </> : <>
          {(() => {
            const done = project.slots.filter(s => s.finalImage).length;
            return <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.gap.md }}>
                {!!project.canon.image && <Pressable accessibilityRole="button" accessibilityLabel="세트 참고" onPress={() => setCanonOpen(true)} style={{ width: 52, height: 52, borderRadius: T.radius.md, backgroundColor: '#F0ECE5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Image source={{ uri: imageUri(project.canon.image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /></Pressable>}
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: '#EEE8DF', overflow: 'hidden' }}><View style={{ width: `${Math.max(2, done / SPEC.count * 100)}%`, height: '100%', backgroundColor: C.coral }} /></View>
                  <Text style={{ fontSize: 11, color: C.muted }}>{done} / {SPEC.count} 완성</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={done ? '이어서 그리기' : '첫 칸 그리기'} onPress={() => drawFrom()} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{done ? '이어서 그리기' : '첫 칸 그리기'}</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="아이디어" onPress={() => setScreen('planning')} style={{ flex: 1, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>아이디어</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="전체 보기" onPress={() => setScreen('preview')} style={{ flex: 1, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>전체 보기</Text></Pressable>
              </View>
            </>;
          })()}
          <View testID="slot-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{project.slots.map(s => {
            const planned = !!(s.dialogue.trim() || s.noDialogue);
            return <Pressable key={s.number} testID={`slot-${s.number}`} accessibilityRole="button" accessibilityLabel={`슬롯 ${s.number} ${s.finalImage ? '완성' : planned ? '기획함' : '비어 있음'}`} onPress={() => { setSlotNumber(s.number); setDetail(false); setPainting(true); }} style={{ width: tileWidth, aspectRatio: 1, borderRadius: T.radius.md, backgroundColor: s.finalImage ? C.paper : planned ? '#FFFBF3' : C.paper, borderWidth: project.lastSlot === s.number ? 2 : 1, borderColor: project.lastSlot === s.number ? C.coral : s.finalImage ? '#D9D1C6' : C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 3 }}>
            {s.finalImage ? <Image source={{ uri: imageUri(s.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <><Text style={{ fontSize: 15, color: planned ? '#8C857A' : '#C4BDB3', fontWeight: '700' }}>{String(s.number).padStart(2, '0')}</Text>{planned && <Text numberOfLines={1} style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{s.noDialogue ? '무대사' : s.dialogue.trim()}</Text>}</>}
            {(s.status === 'FAIL' || s.status === 'WARNING') && <View style={{ position: 'absolute', right: 5, bottom: 5, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFF', backgroundColor: colors[s.status] }} />}
          </Pressable>;
          })}</View>
        </>}
      </ScrollView>
      {slot && !canonOpen && !painting && <View style={{ padding: 10, backgroundColor: C.bg }}><Action primary title="그리기" disabled={!!busy} onPress={openPainter} /></View>}
    </KeyboardAvoidingView>

    {managed && !pendingDelete && <Dialog title="세트 관리" onClose={() => setManageId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{managed.projectName}</Text>
      <Text style={styles.muted}>{managed.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성</Text>
      <Action title="세트 열기" onPress={() => { const id = managed.id; setManageId(null); setProjectId(id); setDetail(false); }} />
      <Action title="세트 삭제" onPress={() => setConfirmDeleteId(managed.id)} />
    </Dialog>}
    {pendingDelete && <Dialog title="세트 삭제" onClose={() => setConfirmDeleteId(null)}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{pendingDelete.projectName}</Text>
      <Text style={styles.muted}>{pendingDelete.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성</Text>
      <Text style={styles.muted}>이 세트의 그림, 참고 이미지, 원캐릭터가 함께 지워집니다. 삭제하면 되돌릴 수 없어요.</Text>
      <Action title="이 세트 삭제" onPress={() => deleteProject(pendingDelete.id)} />
      <Action title="취소" onPress={() => setConfirmDeleteId(null)} />
    </Dialog>}
    {menu && project && <Dialog title={project.projectName} onClose={() => setMenu(false)}>
      <View style={{ borderRadius: T.radius.md, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
        {([['캐릭터 메모', () => { setSlotNumber(null); setCanonOpen(true); }],
           ['세트 전체 검사', () => void runQA(true)],
           ['카카오 규격 안내', () => Alert.alert('카카오 규격', SPEC.note, [{ text: '닫기' }, { text: '공식 안내', onPress: () => { Linking.openURL(SPEC.officialUrl).catch(e => Alert.alert('링크 오류', String(e))); } }])],
           ['다른 세트 열기', () => { setProjectId(null); setSlotNumber(null); setCanonOpen(false); setScreen('board'); }]] as const).map(([label, run], i) =>
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setMenu(false); run(); }} style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: T.gap.lg, borderTopWidth: i ? 1 : 0, borderColor: C.line }}><Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{label}</Text></Pressable>)}
      </View>
    </Dialog>}
    {setQA && project && <Dialog title="전체 QA" onClose={() => setSetQA(false)}>
      <Text>완료 {project.slots.filter(s => s.finalImage).length} / {SPEC.count} · 미작업 {project.slots.filter(s => s.status === 'EMPTY').length}</Text>
      <Text>{['PASS', 'WARNING', 'FAIL'].map(status => `${status} ${project.slots.filter(s => s.status === status).length}`).join(' · ')}</Text>
      {dupes.map(group => <Text key={group.join(',')}>중복 대사 · {group.join(', ')}</Text>)}
      {project.slots.filter(s => s.qa?.status !== 'PASS').map(s => <Pressable key={s.number} accessibilityRole="button" onPress={() => { setSetQA(false); setCanonOpen(false); setSlotNumber(s.number); setDetail(false); if (s.qa) setIssues(s.qa); }} style={{ paddingVertical: 8 }}><Text style={{ color: colors[s.qa?.status ?? 'EMPTY'] }}>{String(s.number).padStart(2, '0')} · {s.finalImage ? s.qa?.status ?? '미검사' : '그림 없음'}</Text></Pressable>)}
    </Dialog>}
    {issues && <Dialog title="검수 결과" onClose={() => setIssues(null)}>
      {issues.status === 'PASS' ? <Text style={{ fontSize: 15, fontWeight: '800', color: colors.PASS }}>기본 검사는 모두 통과했어요.</Text> : <Checks checks={[...issues.checks, ...issues.consistency]} />}
      {(issues.notes ?? []).map(note => <Text key={note} style={{ fontSize: 11, color: C.muted }}>{note}</Text>)}
    </Dialog>}
    {painting && project && slot && <Painter key={project.id + '/' + slot.number} slot={slot} slotCount={project.slots.length} canon={project.canon.image} canonName={project.characterName} canonLocked={project.canon.locked} palette={store?.palette ?? []} onColorUsed={rememberColor}
      onClose={() => { setPainting(false); setSlotNumber(null); setDetail(false); }}
      onNavigate={number => { setSlotNumber(number); setDetail(false); }}
      onAddReferences={async () => { const added = await pickImages(true); if (added.length) changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, added) })) })); return added; }}
      onRemoveReference={path => { changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: s.referenceImages.filter(image => image.path !== path), work: s.work ? { ...s.work, references: s.work.references.filter(reference => reference.image?.path !== path), activeLayerId: s.work.activeLayerId.startsWith('ref-') && s.work.references.some(reference => reference.id === s.work!.activeLayerId && reference.image?.path === path) ? 'draw-1' : s.work.activeLayerId } : undefined })) })); }}
      onSave={(payload, dialogue) => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; const { finalImage, work } = savePainterWork(payload, latest.referenceImages); return saveFinal(finalImage, false, work, dialogue); }}
      onShare={async () => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; if (!latest.finalImage || !await Sharing.isAvailableAsync()) throw new Error('공유할 이미지가 없거나 공유 기능을 사용할 수 없습니다.'); await Sharing.shareAsync(imageUri(latest.finalImage.path), { mimeType: 'image/png', UTI: 'public.png' }); }} />}
  </SafeAreaView>;
}
