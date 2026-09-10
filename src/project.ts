import { KAKAO_STATIC_SPEC as SPEC } from './constants/kakao-spec';
import type { LocalImage, Project, Slot, Store } from './types';

export function createProject(projectName: string, characterName: string): Project {
  const now = new Date().toISOString();
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, projectName: projectName.trim(), characterName: characterName.trim(), createdAt: now, updatedAt: now,
    canon: { personality: '', speech: '', locked: '', variable: '' },
    slots: Array.from({ length: SPEC.count }, (_, i): Slot => ({ number: i + 1, dialogue: '', emotion: '', situation: '', expressionGuide: '', poseGuide: '', compositionGuide: '', effectGuide: '', textPlacementGuide: '', notes: '', referenceImages: [], status: 'EMPTY' })) };
}
// Every local image a project points at: CANON, references, finals and painter working layers.
export function imagePaths(project: Project): Set<string> {
  const paths = new Set<string>();
  const add = (image?: LocalImage) => { if (image?.path) paths.add(image.path); };
  add(project.canon.image);
  for (const slot of project.slots) {
    slot.referenceImages.forEach(add);
    add(slot.finalImage);
    slot.work?.layers.forEach(layer => add(layer.image));
    slot.work?.references.forEach(reference => add(reference.image));
  }
  return paths;
}
// Every image the whole store still points at.
export function storeImagePaths(store: Store): Set<string> {
  const paths = new Set<string>();
  for (const project of store.projects) for (const path of imagePaths(project)) paths.add(path);
  return paths;
}
// Files that were reachable before an edit and are not reachable after it.
// A set difference over the whole store, so a file another project still points at is never listed.
export function droppedImagePaths(before: Store, after: Store): string[] {
  const kept = storeImagePaths(after);
  return [...storeImagePaths(before)].filter(path => !kept.has(path));
}
// Everyday reactions a sticker set usually needs. A starting point when someone is stuck,
// never a checklist: nothing in the app requires any of these to be used.
export const IDEA_SUGGESTIONS = ['안녕!', '고마워', '미안해', '좋아!', '싫어', '헐', 'ㅋㅋㅋ', '슬퍼', '화났어', '사랑해', '축하해', '화이팅!', '잘자', '배고파', '기다려', '바빠', '피곤해', '무대사'] as const;
export const NO_DIALOGUE_IDEA = '무대사';
export function planningKey(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}
export function duplicates(slots: Slot[]): number[][] {
  const groups = new Map<string, number[]>();
  for (const slot of slots) {
    if (slot.noDialogue) continue;
    const key = planningKey(slot.dialogue).replace(/[\p{P}\p{S}\s]/gu, '');
    if (key) groups.set(key, [...(groups.get(key) ?? []), slot.number]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}
// Deterministic, local planning review. No network, so a set can always be finished offline.
export const plannedSlots = (project: Project): Slot[] => project.slots.filter(s => s.dialogue.trim() || s.noDialogue);
// Counts identical wording only. A helper, never a rule.
function concentration(slots: Slot[], read: (slot: Slot) => string, planned: number): { label: string; count: number }[] {
  const groups = new Map<string, { label: string; count: number }>();
  for (const slot of slots) {
    const key = planningKey(read(slot));
    if (!key) continue;
    const seen = groups.get(key);
    groups.set(key, { label: read(slot).trim(), count: (seen?.count ?? 0) + 1 });
  }
  return [...groups.values()].filter(g => planned >= 8 && g.count > planned * .4);
}
export function planningIssues(project: Project): string[] {
  const issues: string[] = [];
  const planned = plannedSlots(project);
  for (const group of duplicates(project.slots)) issues.push(`같은 대사가 ${group.map(n => String(n).padStart(2, '0')).join(', ')}번에 겹쳐요`);
  for (const g of concentration(project.slots, s => s.emotion, planned.length)) issues.push(`'${g.label}' 감정이 ${g.count}칸이에요. 다른 기분도 넣어보세요`);
  for (const g of concentration(project.slots, s => s.situation, planned.length)) issues.push(`'${g.label}' 상황이 ${g.count}칸이에요. 다른 장면도 넣어보세요`);
  const empty = project.slots.length - planned.length;
  if (empty && planned.length) issues.push(`${empty}칸이 남았어요`);
  return issues;
}
export function parseStore(raw: string): Store {
  const value = JSON.parse(raw) as Store;
  if (value.version !== 1 || !Number.isSafeInteger(value.revision) || !Array.isArray(value.projects)) throw new Error('지원하지 않거나 손상된 저장 파일입니다.');
  for (const p of value.projects) {
    if (!p.id || typeof p.projectName !== 'string' || !p.canon || !Array.isArray(p.slots) || p.slots.length !== SPEC.count) throw new Error('프로젝트 저장 데이터가 손상되었습니다.');
    for (const s of [p.characterName, p.createdAt, p.updatedAt, p.canon.personality, p.canon.speech, p.canon.locked, p.canon.variable]) if (typeof s !== 'string') throw new Error('CANON 저장 데이터가 손상되었습니다.');
    const validateImage = (image: Project['canon']['image']) => {
      if (!image) return;
      if (!/^[a-zA-Z0-9._-]+$/.test(image.path) || !(image.width > 0) || !(image.height > 0)) throw new Error('이미지 저장 데이터가 손상되었습니다.');
    };
    validateImage(p.canon.image);
    if (p.lastSlot !== undefined && !Number.isSafeInteger(p.lastSlot)) throw new Error('마지막 작업 칸 데이터가 손상되었습니다.');
    p.slots.forEach((s, index) => {
      if (s.number !== index + 1 || !Array.isArray(s.referenceImages) || typeof s.dialogue !== 'string') throw new Error('슬롯 저장 데이터가 손상되었습니다.');
      if (!['EMPTY', 'PLANNED', 'DRAWING', 'REVIEW', 'PASS', 'WARNING', 'FAIL'].includes(s.status)) throw new Error('슬롯 상태가 손상되었습니다.');
      if (s.noDialogue !== undefined && typeof s.noDialogue !== 'boolean') throw new Error('슬롯 기획 데이터가 손상되었습니다.');
      if (s.referenceKey !== undefined && typeof s.referenceKey !== 'string') throw new Error('슬롯 기획 데이터가 손상되었습니다.');
      for (const text of [s.emotion, s.situation, s.expressionGuide, s.poseGuide, s.compositionGuide, s.effectGuide, s.textPlacementGuide, s.notes]) if (typeof text !== 'string') throw new Error('슬롯 텍스트가 손상되었습니다.');
      s.referenceImages.forEach(validateImage); validateImage(s.finalImage);
      if (s.work) {
        if (s.work.version !== 1 || !Array.isArray(s.work.layers) || !Array.isArray(s.work.references) || s.work.layers.length < 1 || s.work.layers.length > 4) throw new Error('작업 레이어 데이터가 손상되었습니다.');
        const layers = [...s.work.layers, ...s.work.references];
        const ids = new Set(layers.map(l => l.id));
        if (ids.size !== layers.length || !ids.has(s.work.activeLayerId)) throw new Error('활성 레이어 데이터가 손상되었습니다.');
        for (const layer of layers) {
          if (typeof layer.name !== 'string' || typeof layer.visible !== 'boolean' || ![layer.opacity, layer.x, layer.y, layer.scale, layer.rotation].every(Number.isFinite) || layer.opacity < 0 || layer.opacity > 1 || layer.scale < 0.1 || layer.scale > 4) throw new Error('레이어 속성이 손상되었습니다.');
          validateImage(layer.image);
        }
      }
    });
  }
  if (value.palette !== undefined && (!Array.isArray(value.palette) || value.palette.some(c => typeof c !== 'string'))) throw new Error('색 기록이 손상되었습니다.');
  return value;
}
