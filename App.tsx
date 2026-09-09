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
const colors: Record<string, string> = { PASS: '#24734a', WARNING: '#8b6207', FAIL: '#b43d40', EMPTY: '#6d7169', DRAWING: '#316caf', REVIEW: '#8053a8', PLANNED: '#486b43' };
function Checks({ checks }: { checks: Check[] }) { return <>{checks.filter(c => c.status !== 'PASS').map(c => <View key={c.label} style={{ gap: 4 }}><Text style={{ color: colors[c.status], fontWeight: '700' }}>{c.status} · {c.label}</Text><Text style={styles.muted}>{c.detail}</Text></View>)}</>; }
function mergeImages(existing: LocalImage[], added: LocalImage[]) { return [...existing, ...added.filter(image => !existing.some(current => current.path === image.path))]; }
export default function App() { return <SafeAreaProvider><Studio /></SafeAreaProvider>; }
function Studio() {
  const [store, setStore] = useState<Store | null>(null), current = useRef<Store | null>(null);
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null), [slotNumber, setSlotNumber] = useState<number | null>(null), [canonOpen, setCanonOpen] = useState(false), [painting, setPainting] = useState(false);
  const [projectName, setProjectName] = useState(''), [characterName, setCharacterName] = useState(''), [busy, setBusy] = useState('');
  const [menu, setMenu] = useState(false), [detail, setDetail] = useState(false), [setQA, setSetQA] = useState(false);
  const [issues, setIssues] = useState<QA | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - 24 - 24) / 4;
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
    if (slot.finalImage && (slot.finalImage.width !== SPEC.width || slot.finalImage.height !== SPEC.height)) {
      Alert.alert('크기 불일치', `FINAL을 ${SPEC.width}×${SPEC.height}로 수정해 다시 가져오세요.`); return;
    }
    setPainting(true);
  }
  const dupes = project ? duplicates(project.slots) : [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f4ec' }}><StatusBar style="dark" /><ImageAnalyzer ref={analyzer} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {project && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 60 }}>
        {slot || canonOpen ? <Pressable accessibilityRole="button" accessibilityLabel="프로젝트로 돌아가기" disabled={!!busy} onPress={back} style={{ padding: 12 }}><Text style={{ fontSize: 24 }}>‹</Text></Pressable> : project.canon.image ? <Image source={{ uri: imageUri(project.canon.image.path) }} style={{ width: 38, height: 38, borderRadius: 8 }} resizeMode="contain" /> : <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: '#e1e6d9', alignItems: 'center', justifyContent: 'center' }}><Text>{project.characterName.slice(0, 1)}</Text></View>}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>{canonOpen ? '프로젝트 설정' : slot ? `슬롯 ${String(slot.number).padStart(2, '0')}` : project.projectName}</Text>
        {!slot && !canonOpen && <Text style={styles.muted}>{project.slots.filter(s => s.finalImage).length} / {SPEC.count}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="프로젝트 메뉴" disabled={!!busy} onPress={() => setMenu(true)} style={{ padding: 12 }}><Text style={{ fontSize: 24 }}>⋯</Text></Pressable>
      </View>}
      {!!busy && <Text style={{ paddingHorizontal: 12, color: '#666' }}>{busy}</Text>}
      {!!saveError && <View style={{ padding: 12, backgroundColor: '#ffe3db' }}><Text selectable>{saveError}</Text><Action title="다시 저장" onPress={() => { try { commit(s => s); } catch {} }} /></View>}
      <ScrollView pointerEvents={busy ? 'none' : 'auto'} key={`${projectId}/${slotNumber}/${canonOpen}`} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
        {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={() => setNotice('')} style={{ padding: 8 }}><Text>{notice} ×</Text></Pressable>}
        {loadError ? <><Text selectable>{loadError}</Text><Action title="다시 불러오기" onPress={load} /></> : !store ? <Text>불러오는 중…</Text> : !project ? <>
          <Text style={styles.title}>내 작업실</Text>
          {store.projects.map(p => <Pressable accessibilityRole="button" accessibilityLabel={p.projectName} key={p.id} onPress={() => { setProjectId(p.id); setDetail(false); }} style={styles.card}><Text style={styles.subtitle}>{p.projectName}</Text><Text>{p.slots.filter(s => s.finalImage).length} / {SPEC.count}</Text></Pressable>)}
          <Field label="프로젝트 이름" value={projectName} onChangeText={setProjectName} multiline={false} />
          <Field label="캐릭터 이름" value={characterName} onChangeText={setCharacterName} multiline={false} />
          <Action title="새 프로젝트" disabled={!projectName.trim() || !characterName.trim()} onPress={() => { const p = createProject(projectName, characterName); try { commit(s => ({ ...s, projects: [...s.projects, p] })); setProjectId(p.id); setProjectName(''); setCharacterName(''); } catch (e) { Alert.alert('저장 실패', String(e)); } }} />
        </> : canonOpen ? <>
          <Preview image={project.canon.image} label="CANON" size={140} />
          <Action title="CANON 이미지 선택" disabled={!!busy} onPress={() => task('이미지 저장 중…', async () => { const images = await pickImages(); if (!images[0]) return; const image = await analyzed(images[0]); updateProject(p => ({ ...p, canon: { ...p.canon, image }, slots: p.slots.map(s => ({ ...s, qa: undefined, status: s.finalImage ? 'REVIEW' : s.status })) })); })} />
          <Field label="프로젝트 이름" value={project.projectName} onChangeText={projectName => updateProject(p => ({ ...p, projectName }))} multiline={false} />
          <Field label="캐릭터 이름" value={project.characterName} onChangeText={characterName => updateProject(p => ({ ...p, characterName }))} multiline={false} />
          {([['personality', '성격'], ['speech', '말투'], ['locked', 'LOCKED · 유지할 특징'], ['variable', 'VARIABLE · 바꿀 특징']] as const).map(([key, label]) => <Field key={key} label={label} value={project.canon[key]} onChangeText={value => updateProject(p => ({ ...p, canon: { ...p.canon, [key]: value } }))} />)}
        </> : slot && !painting ? <>
          <Field label="대사" value={slot.dialogue} multiline={false} onChangeText={dialogue => updateSlot({ dialogue, status: slot.status === 'EMPTY' && dialogue.trim() ? 'PLANNED' : slot.status })} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Action title="아이디어 생성" onPress={() => { const suggestion = conceptAssistant.suggest(slot); const patch: Partial<Slot> = {}; for (const [key] of guideFields) if (!slot[key].trim()) patch[key] = suggestion[key]; updateSlot({ ...patch, status: slot.status === 'EMPTY' ? 'PLANNED' : slot.status }); }} />
            <Pressable accessibilityRole="button" accessibilityLabel="상세" accessibilityState={{ expanded: detail }} onPress={() => setDetail(!detail)} style={{ padding: 12 }}><Text>{detail ? '상세 접기' : '상세'}</Text></Pressable>
          </View>
          {(slot.expressionGuide || slot.poseGuide || slot.compositionGuide) ? <View style={styles.card}>{guideFields.slice(0, 3).map(([key, label]) => slot[key] ? <Text key={key} numberOfLines={2} style={{ fontSize: 13, lineHeight: 18 }}>{label.replace(' 가이드', '')} · {slot[key]}</Text> : null)}</View> : null}
          {detail && <View style={{ gap: 10 }}>
            {([['emotion', '감정'], ['situation', '상황'], ...guideFields, ['notes', '작업 메모']] as const).map(([key, label]) => <Field key={key} label={label} value={slot[key]} onChangeText={value => updateSlot({ [key]: value })} />)}
            <View style={{ flexDirection: 'row', gap: 8 }}><Preview image={project.canon.image} label="CANON" size={110} /><Preview image={slot.finalImage} label="FINAL" size={110} /></View>
            <Text style={styles.muted}>LOCKED · {project.canon.locked || '등록한 기준 없음'}</Text>
            <Action title="직접 그린 FINAL 가져오기" onPress={() => Alert.alert('FINAL 가져오기', '현재 FINAL을 선택한 그림으로 바꿉니다.', [{ text: '취소', style: 'cancel' }, { text: '선택', onPress: () => task('저장 중…', async () => { const images = await pickImages(); if (images[0]) saveFinal(await analyzed(images[0]), false); }) }])} />
            <Action title="PNG 내보내기 / 공유" disabled={!slot.finalImage} onPress={() => task('공유 준비 중…', async () => { if (!await Sharing.isAvailableAsync()) throw new Error('공유 기능을 사용할 수 없습니다.'); await Sharing.shareAsync(imageUri(slot.finalImage!.path), { mimeType: 'image/png', UTI: 'public.png' }); })} />
            <Action title="이 슬롯 검사" onPress={() => runQA(false)} />
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.label}>참고 이미지</Text><Action title="+ 추가" onPress={() => task('참고 저장 중…', async () => { const images = await pickImages(true); updateProject(p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, images) })) })); })} /></View>
          {!!slot.referenceImages.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{slot.referenceImages.map((im, i) => <Pressable key={im.path} accessibilityRole="button" accessibilityLabel={`참고 ${i + 1} 보기`} onPress={() => Alert.alert(`참고 ${i + 1}`, '그리기에서 크게 볼 수 있습니다.')}><Image source={{ uri: imageUri(im.path) }} style={{ width: 64, height: 64, backgroundColor: '#e4e7e1', borderRadius: 6 }} resizeMode="contain" /></Pressable>)}</ScrollView>}
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7e9e3', borderRadius: 10 }}>{slot.finalImage ? <Image accessibilityLabel="현재 그림" source={{ uri: imageUri(slot.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={styles.muted}>아직 그린 그림이 없어요</Text>}</View>
        </> : <View testID="slot-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{project.slots.map(s => <Pressable key={s.number} testID={`slot-${s.number}`} accessibilityRole="button" accessibilityLabel={`슬롯 ${s.number} ${s.dialogue} ${s.status}`} onPress={() => { setSlotNumber(s.number); setDetail(false); setPainting(true); }} style={{ width: tileWidth, aspectRatio: 1, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce1d5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {s.finalImage ? <Image source={{ uri: imageUri(s.finalImage.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ fontSize: 18, color: '#92998b' }}>{String(s.number).padStart(2, '0')}</Text>}
          <View style={{ position: 'absolute', right: 5, bottom: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: colors[s.status] }} />
        </Pressable>)}</View>}
      </ScrollView>
      {slot && !canonOpen && !painting && <View style={{ padding: 10, backgroundColor: '#f4f4ec' }}><Action primary title="그리기" disabled={!!busy} onPress={openPainter} /></View>}
    </KeyboardAvoidingView>
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
    {issues && <Dialog title="검수 결과" onClose={() => setIssues(null)}>{issues.status === 'PASS' ? <Text>문제 없음</Text> : <><Checks checks={[...issues.checks, ...issues.consistency]} /><Text style={{ fontSize: 12, color: '#777' }}>V1 참고 판정</Text></>}</Dialog>}
    {painting && project && slot && <Painter key={project.id + '/' + slot.number} slot={slot} slotCount={project.slots.length} canon={project.canon.image}
      onClose={() => { setPainting(false); setSlotNumber(null); setDetail(false); }}
      onNavigate={number => { setSlotNumber(number); setDetail(false); }}
      onAddReferences={async () => {
        const added = await pickImages(true);
        if (added.length) changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({ ...s, referenceImages: mergeImages(s.referenceImages, added) })) }));
        return added;
      }}
      onRemoveReference={path => {
        changeProject(project.id, p => ({ ...p, slots: p.slots.map(s => ({
          ...s,
          referenceImages: s.referenceImages.filter(image => image.path !== path),
          work: s.work ? { ...s.work, references: s.work.references.filter(reference => reference.image?.path !== path), activeLayerId: s.work.activeLayerId.startsWith('ref-') && s.work.references.some(reference => reference.id === s.work!.activeLayerId && reference.image?.path === path) ? 'draw-1' : s.work.activeLayerId } : undefined,
        })) }));
      }}
      onSave={(payload, dialogue) => {
        const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!;
        const { finalImage, work } = savePainterWork(payload, latest.referenceImages);
        return saveFinal(finalImage, false, work, dialogue);
      }}
      onShare={async () => {
        const latest = current.current!.projects.find(p => p.id === project.id)!.slots.find(s => s.number === slot.number)!;
        if (!latest.finalImage || !await Sharing.isAvailableAsync()) throw new Error('공유할 이미지가 없거나 공유 기능을 사용할 수 없습니다.');
        await Sharing.shareAsync(imageUri(latest.finalImage.path), { mimeType: 'image/png', UTI: 'public.png' });
      }} />}
  </SafeAreaView>;
}