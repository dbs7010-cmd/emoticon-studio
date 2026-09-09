import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View, Image, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { Action, Dialog, Field, Preview, styles } from './src/components/ui';
import { ImageAnalyzer, type Analyzer } from './src/components/image-analyzer';
import { Painter } from './src/painter/painter';
import { KAKAO_STATIC_SPEC as SPEC } from './src/constants/kakao-spec';
import { createProject, duplicates } from './src/project';
import { imageUri, loadStore, saveStore } from './src/services/storage';
import { pickImages, savePainterWork } from './src/services/images';
import { inspectImage } from './src/services/qa';
import { conceptAssistant } from './src/services/concept';
import type { Check, LocalImage, Project, Slot, Store, QA, PainterWork } from './src/types';

const guideFields = [['expressionGuide', '표정 가이드'], ['poseGuide', '포즈 가이드'], ['compositionGuide', '구도 가이드'], ['effectGuide', '효과 가이드'], ['textPlacementGuide', '텍스트 배치']] as const;
const colors: Record<string, string> = { PASS: '#55B989', WARNING: '#E7A93C', FAIL: '#E35C62', EMPTY: '#A5A097', DRAWING: '#67A9E8', REVIEW: '#A786DF', PLANNED: '#75C79C' };
const C = { bg: '#F7F4EE', paper: '#FFFDF9', ink: '#232323', muted: '#77736C', line: '#E7E1D7', coral: '#FF7A59', peach: '#FFE2D8', yellow: '#F8D66D', mint: '#BFE9D5', blue: '#C9DCF8', lavender: '#DCCCF7' };
function Checks({ checks }: { checks: Check[] }) { return <>{checks.filter(c => c.status !== 'PASS').map(c => <View key={c.label} style={{ gap: 4 }}><Text style={{ color: colors[c.status], fontWeight: '700' }}>{c.status} · {c.label}</Text><Text style={styles.muted}>{c.detail}</Text></View>)}</>; }
function mergeImages(existing: LocalImage[], added: LocalImage[]) { return [...existing, ...added.filter(image => !existing.some(current => current.path === image.path))]; }
export default function App() { return <SafeAreaProvider><Studio /></SafeAreaProvider>; }
function Studio() {
  const [store, setStore] = useState<Store | null>(null), current = useRef<Store | null>(null);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null), [slotNumber, setSlotNumber] = useState<number | null>(null), [canonOpen, setCanonOpen] = useState(false), [painting, setPainting] = useState(false);
  const [projectName, setProjectName] = useState(''), [characterName, setCharacterName] = useState(''), [busy, setBusy] = useState('');
  const [menu, setMenu] = useState(false), [detail, setDetail] = useState(false), [setQA, setSetQA] = useState(false), [newProjectOpen, setNewProjectOpen] = useState(false);
  const [issues, setIssues] = useState<QA | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - 28 - 24) / 4;
  const projectCardWidth = (screenWidth - 40) / 2;
  const analyzer = useRef<Analyzer>(null);
  function load() { try { const result = loadStore(); current.current = result.store; setStore(result.store); setLoadError(''); if (result.recovered) setNotice('이전 저장 사본을 복구했습니다.'); } catch (e) { setLoadError(String(e)); } }
  useEffect(load, []);
  function commit(transform: (s: Store) => Store) {
    if (!current.current) throw new Error('저장소가 준비되지 않았습니다.');
    const next = { ...transform(current.current), revision: current.current.revision + 1 };
    current.current = next; setStore(next);
    try { saveStore(next); setSaveError(''); } catch (e) { setSaveError(String(e)); throw e; }
  }
  function changeProject(id: string, transform: (p: Project) => Project) { commit(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...transform(p), updatedAt: new Date().toISOString() } : p) })); }
  function updateProject(transform: (p: Project) => Project) { if (projectId) { try { changeProject(projectId, transform); } catch { /* Keep unsaved state with persistent retry banner. */ } } }
  function updateSlot(patch: Partial<Slot>) { updateProject(p => ({ ...p, slots: p.slots.map(s => s.number === slotNumber ? { ...s, ...patch } : s) })); }
  const project = store?.projects.find(p => p.id === projectId), slot = project?.slots.find(s => s.number === slotNumber);
  function back() { if (busy) return; if (slotNumber !== null) { setSlotNumber(null); setDetail(false); } else if (canonOpen) setCanonOpen(false); else setProjectId(null); }
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (painting) return false; if (projectId) { back(); return true; } return false; }); return () => sub.remove(); }, [projectId, slotNumber, canonOpen, busy, painting]);
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
    catch { qa = { status: 'WARNING', checkedAt: new Date().toISOString(), checks: [{ label: '자동 검사', status: 'WARNING', detail: '검사를 마치지 못했습니다. 상세에서 다시 검사하세요.' }], consistency: [] }; }
    changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => s.number === slot.number ? { ...s, finalImage, work, dialogue: dialogue ?? s.dialogue, qa, status: qa.status } : s) }));
    if (goHome) { setPainting(false); setSlotNumber(null); setDetail(false); }
    if (!painting && qa.status !== 'PASS') setIssues(qa);
    return qa;
  }
  function openPainter() {
    if (!slot) return;
    if (slot.finalImage && (slot.finalImage.width !== SPEC.width || slot.finalImage.height !== SPEC.height)) { Alert.alert('크기 불일치', `FINAL을 ${SPEC.width}×${SPEC.height}로 수정해 다시 가져오세요.`); return; }
    setPainting(true);
  }
  function createNewProject() {
    if (!projectName.trim() || !characterName.trim()) return;
    const p = createProject(projectName.trim(), characterName.trim());
    try { commit(s => ({ ...s, projects: [...s.projects, p] })); setProjectId(p.id); setProjectName(''); setCharacterName(''); setNewProjectOpen(false); } catch (e) { Alert.alert('저장 실패', String(e)); }
  }
  const dupes = project ? duplicates(project.slots) : [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><StatusBar style="dark" /><ImageAnalyzer ref={analyzer} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {project && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, minHeight: 58, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" disabled={!!busy} onPress={back} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>‹</Text></Pressable>
        {!slot && !canonOpen && (project.canon.image ? <Image source={{ uri: imageUri(project.canon.image.path) }} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF' }} resizeMode="contain" /> : <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '900' }}>{project.characterName.slice(0, 1)}</Text></View>)}
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 16, color: C.ink, fontWeight: '900' }}>{canonOpen ? '프로젝트 설정' : slot ? `슬롯 ${String(slot.number).padStart(2, '0')}` : project.projectName}</Text>{!slot && !canonOpen && <Text style={{ fontSize: 10, color: C.muted }}>{project.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성</Text>}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="프로젝트 메뉴" disabled={!!busy} onPress={() => setMenu(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>⋯</Text></Pressable>
      </View>}
      {!!busy && <Text style={{ paddingHorizontal: 14, paddingVertical: 4, color: C.muted }}>{busy}</Text>}
      {!!saveError && <View style={{ padding: 12, backgroundColor: '#FFE4DF' }}><Text selectable>{saveError}</Text><Action title="다시 저장" onPress={() => { try { commit(s => s); } catch {} }} /></View>}
      <ScrollView pointerEvents={busy ? 'none' : 'auto'} key={`${projectId}/${slotNumber}/${canonOpen}`} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
        {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={() => setNotice('')} style={{ padding: 8, borderRadius: 12, backgroundColor: '#FFF6D8' }}><Text>{notice} ×</Text></Pressable>}
        {loadError ? <><Text selectable>{loadError}</Text><Action title="다시 불러오기" onPress={load} /></> : !store ? <Text>불러오는 중…</Text> : !project ? <>
          <View style={{ marginBottom: 2 }}><Text style={styles.title}>내 작업실</Text><Text style={[styles.muted, { marginTop: 4 }]}>그려 저장하고, 한 세트를 끝내요.</Text></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {store.projects.map((p, index) => {
              const cover = p.canon.image ?? p.slots.find(s => s.finalImage)?.finalImage;
              const done = p.slots.filter(s => s.finalImage).length;
              const tint = [C.peach, C.mint, C.blue, C.lavender, '#FFF1B8'][index % 5];
              return <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} key={p.id} onPress={() => { setProjectId(p.id); setDetail(false); }} style={{ width: projectCardWidth, backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 10, gap: 8 }}>
                <View style={{ height: projectCardWidth - 30, minHeight: 118, borderRadius: 16, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{cover ? <Image source={{ uri: imageUri(cover.path) }} style={{ width: '86%', height: '86%' }} resizeMode="contain" /> : <View style={{ alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 28, color: '#665F57' }}>〰</Text><Text style={{ fontSize: 10, color: C.muted }}>첫 그림을 기다리는 중</Text></View>}</View>
                <Text numberOfLines={1} style={{ fontSize: 14, color: C.ink, fontWeight: '900' }}>{p.projectName}</Text>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: '#EEE8DF', overflow: 'hidden' }}><View style={{ width: `${Math.max(2, done / SPEC.count * 100)}%`, height: '100%', backgroundColor: C.coral }} /></View>
                <Text style={{ fontSize: 10, color: C.muted }}>{done} / {SPEC.count}</Text>
              </Pressable>;
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="새 이모티콘 세트" onPress={() => setNewProjectOpen(true)} style={{ width: projectCardWidth, minHeight: projectCardWidth + 18, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BDB5AA', backgroundColor: '#FFF9F4', alignItems: 'center', justifyContent: 'center', gap: 8 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26 }}>＋</Text></View><Text style={{ fontSize: 13, fontWeight: '900' }}>새 세트</Text><Text style={{ fontSize: 10, color: C.muted }}>원캐릭터부터 시작</Text></Pressable>
          </View>
        </> : canonOpen ? <>
          <Preview image={project.canon.image} label="원캐릭터" size={160} />
          <Action title="원캐릭터 이미지 선택" disabled={!!busy} onPress={() => task('이미지 저장 중…', async () => { const images = await pickImages(); if (!images[0]) return; const image = await analyzed(images[0]); updateProject(p => ({ ...p, canon: { ...p.canon, image }, slots: p.slots.map(s => ({ ...s, qa: undefined, status: s.finalImage ? 'REVIEW' : s.status })) })); })} />
          <Field label="프로젝트 이름" value={project.projectName} onChangeText={projectName => updateProject(p => ({ ...p, projectName }))} multiline={false} />
          <Field label="캐릭터 이름" value={project.characterName} onChangeText={characterName => updateProject(p => ({ ...p, characterName }))} multiline={false} />
          {([['personality', '성격'], ['speech', '말투'], ['locked', '꼭 유지할 특징'], ['variable', '바꿔도 되는 특징']] as const).map(([key, label]) => <Field key={key} label={label} value={project.canon[key]} onChangeText={value => updateProject(p => ({ ...p, canon: { ...p.canon, [key]: value } }))} />)}
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
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0ECE5', borderRadius: 16 }}>{slot.finalImage ? <Image accessibilityLabel="현재 그림" source={{ uri: imageUri(slot.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={styles.muted}>아직 그린 그림이 없어요</Text>}</View>
        </> : <>
          <View style={{ padding: 14, borderRadius: 22, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="원캐릭터 설정" onPress={() => setCanonOpen(true)} style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{project.canon.image ? <Image source={{ uri: imageUri(project.canon.image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ fontSize: 11, fontWeight: '800' }}>원캐릭터</Text>}</Pressable>
            <View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{project.projectName}</Text><Text style={{ fontSize: 11, color: C.muted }}>그림을 저장하면 바로 다음 칸으로 이어집니다.</Text><View style={{ height: 7, borderRadius: 4, backgroundColor: '#EEE8DF', overflow: 'hidden' }}><View style={{ width: `${Math.max(2, project.slots.filter(s => s.finalImage).length / SPEC.count * 100)}%`, height: '100%', backgroundColor: C.coral }} /></View><Text style={{ fontSize: 10, color: C.muted }}>{project.slots.filter(s => s.finalImage).length} / {SPEC.count} 완성</Text></View>
          </View>
          <View testID="slot-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{project.slots.map(s => <Pressable key={s.number} testID={`slot-${s.number}`} accessibilityRole="button" accessibilityLabel={`슬롯 ${s.number} ${s.dialogue} ${s.status}`} onPress={() => { setSlotNumber(s.number); setDetail(false); setPainting(true); }} style={{ width: tileWidth, aspectRatio: 1, borderRadius: 14, backgroundColor: C.paper, borderWidth: 1, borderColor: s.finalImage ? '#D9D1C6' : C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {s.finalImage ? <Image source={{ uri: imageUri(s.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ fontSize: 17, color: '#AAA39A', fontWeight: '700' }}>{String(s.number).padStart(2, '0')}</Text>}
            <View style={{ position: 'absolute', right: 6, bottom: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: colors[s.status] }} />
          </Pressable>)}</View>
        </>}
      </ScrollView>
      {slot && !canonOpen && !painting && <View style={{ padding: 10, backgroundColor: C.bg }}><Action primary title="그리기" disabled={!!busy} onPress={openPainter} /></View>}
    </KeyboardAvoidingView>

    {newProjectOpen && <Dialog title="새 이모티콘 세트" onClose={() => setNewProjectOpen(false)}><Text style={styles.muted}>복잡한 설정은 나중에. 이름만 정하고 바로 시작합니다.</Text><Field label="프로젝트 이름" value={projectName} onChangeText={setProjectName} multiline={false} /><Field label="캐릭터 이름" value={characterName} onChangeText={setCharacterName} multiline={false} /><Action primary title="세트 만들기" disabled={!projectName.trim() || !characterName.trim()} onPress={createNewProject} /></Dialog>}
    {menu && project && <Dialog title="프로젝트" onClose={() => setMenu(false)}>
      <Action title="프로젝트 설정" onPress={() => { setMenu(false); setSlotNumber(null); setCanonOpen(true); }} />
      <Action title="전체 QA" onPress={() => { setMenu(false); void runQA(true); }} />
      <Action title="카카오 규격 안내" onPress={() => { setMenu(false); Alert.alert('카카오 규격', SPEC.note, [{ text: '닫기' }, { text: '공식 안내', onPress: () => { Linking.openURL(SPEC.officialUrl).catch(e => Alert.alert('링크 오류', String(e))); } }]); }} />
      <Action title="프로젝트 목록" onPress={() => { setMenu(false); setProjectId(null); setSlotNumber(null); setCanonOpen(false); }} />
    </Dialog>}
    {setQA && project && <Dialog title="전체 QA" onClose={() => setSetQA(false)}>
      <Text>완료 {project.slots.filter(s => s.finalImage).length} / {SPEC.count} · 미작업 {project.slots.filter(s => s.status === 'EMPTY').length}</Text>
      <Text>{['PASS', 'WARNING', 'FAIL'].map(status => `${status} ${project.slots.filter(s => s.status === status).length}`).join(' · ')}</Text>
      {dupes.map(group => <Text key={group.join(',')}>중복 대사 · {group.join(', ')}</Text>)}
      {project.slots.filter(s => s.qa?.status !== 'PASS').map(s => <Pressable key={s.number} accessibilityRole="button" onPress={() => { setSetQA(false); setCanonOpen(false); setSlotNumber(s.number); setDetail(false); if (s.qa) setIssues(s.qa); }} style={{ paddingVertical: 8 }}><Text style={{ color: colors[s.qa?.status ?? 'EMPTY'] }}>{String(s.number).padStart(2, '0')} · {s.finalImage ? s.qa?.status ?? '미검사' : '그림 없음'}</Text></Pressable>)}
    </Dialog>}
    {issues && <Dialog title="검수 결과" onClose={() => setIssues(null)}>{issues.status === 'PASS' ? <Text>문제 없음</Text> : <><Checks checks={[...issues.checks, ...issues.consistency]} /><Text style={{ fontSize: 12, color: C.muted }}>V1 참고 판정</Text></>}</Dialog>}
    {painting && project && slot && <Painter key={project.id + '/' + slot.number} slot={slot} slotCount={project.slots.length} canon={project.canon.image}
      onClose={() => { setPainting(false); setSlotNumber(null); setDetail(false); }}
      onNavigate={number => { setSlotNumber(number); setDetail(false); }}
      onAddReferences={async () => { const added = await pickImages(true); if (added.length) changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, added) })) })); return added; }}
      onRemoveReference={path => { changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: s.referenceImages.filter(image => image.path !== path), work: s.work ? { ...s.work, references: s.work.references.filter(reference => reference.image?.path !== path), activeLayerId: s.work.activeLayerId.startsWith('ref-') && s.work.references.some(reference => reference.id === s.work!.activeLayerId && reference.image?.path === path) ? 'draw-1' : s.work.activeLayerId } : undefined })) })); }}
      onSave={(payload, dialogue) => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; const { finalImage, work } = savePainterWork(payload, latest.referenceImages); return saveFinal(finalImage, false, work, dialogue); }}
      onShare={async () => { const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!; if (!latest.finalImage || !await Sharing.isAvailableAsync()) throw new Error('공유할 이미지가 없거나 공유 기능을 사용할 수 없습니다.'); await Sharing.shareAsync(imageUri(latest.finalImage.path), { mimeType: 'image/png', UTI: 'public.png' }); }} />}
  </SafeAreaView>;
}
