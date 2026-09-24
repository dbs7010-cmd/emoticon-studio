import { KAKAO_STATIC_SPEC as SPEC } from './constants/kakao-spec';
import type { LocalImage, Motion, Project, Slot, Store } from './types';

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
    add(slot.motionImage);
    add(slot.submitImage);
    slot.work?.layers.forEach(layer => add(layer.image));
    slot.work?.references.forEach(reference => add(reference.image));
  }
  return paths;
}
// Every image the whole store still points at.
export function storeImagePaths(store: Store): Set<string> {
  const paths = new Set<string>();
  for (const project of store.projects) for (const path of imagePaths(project)) paths.add(path);
  for (const cutout of store.cutouts ?? []) paths.add(cutout.image.path);
  for (const project of store.projects) { if (project.extras?.icon) paths.add(project.extras.icon.path); if (project.extras?.share) paths.add(project.extras.share.path); }
  return paths;
}
// Files that were reachable before an edit and are not reachable after it.
// A set difference over the whole store, so a file another project still points at is never listed.
export function droppedImagePaths(before: Store, after: Store): string[] {
  const kept = storeImagePaths(after);
  return [...storeImagePaths(before)].filter(path => !kept.has(path));
}
// A cut is finished only when the user says so. Older stores predate that declaration, so there
// a saved drawing still counts as finished and nothing already completed is lost.
export const isDone = (slot: Slot): boolean => slot.done ?? !!slot.finalImage;
// Something is on the canvas, but the user has not declared it finished.
export const isWorking = (slot: Slot): boolean => !isDone(slot) && !!slot.finalImage;
export const doneCount = (project: Project): number => project.slots.filter(isDone).length;
// Where '완성 · 다음' goes: the nearest unfinished cut after this one, wrapping to the start.
// A cut that already carries a drawing is never handed over as a fresh canvas.
export function nextUnfinished(project: Project, from: number): number | null {
  const order = [...project.slots.slice(from), ...project.slots.slice(0, from)];
  return order.find(s => !isDone(s) && !s.finalImage)?.number ?? order.find(s => !isDone(s))?.number ?? null;
}
// The cut a copy would come from: the most recently finished one that is not this cut.
export function previousDrawn(project: Project, exclude: number): Slot | undefined {
  const drawn = project.slots.filter(s => s.number !== exclude && s.finalImage && s.work);
  return drawn.filter(isDone).at(-1) ?? drawn.at(-1);
}
export const captionText = (slot: Slot): string => slot.work?.caption?.text.trim() ?? '';
// A cut moves when it carries any movement at all. Absent motion is the still cut it always was.
export const isAnimated = (slot: Slot): boolean =>
  !!(slot.motion && (slot.motion.preset || slot.motion.parts?.length || slot.motion.alternate));
export const setIsAnimated = (project: Project): boolean => project.slots.some(isAnimated);
// Which movements are PRO. Derived from the motion itself so a saved effect can always be
// replayed and re-exported, whatever the subscription says today.
export const usesPro = (motion?: Motion): boolean =>
  !!(motion && ((motion.parts?.length ?? 0) > 0 || motion.alternate));
// Slot numbers are positions, so reordering moves the work and renumbers the places it sits in.
// Everything a cut owns — drawing, layers, words, movement, the files behind them — travels with
// it, because it all hangs off the cut itself and never off the number.
export function reorderSlots(project: Project, from: number, to: number): Project {
  const last = project.slots.length;
  if (from === to || from < 1 || to < 1 || from > last || to > last) return project;
  const slots = [...project.slots];
  const [moved] = slots.splice(from - 1, 1);
  slots.splice(to - 1, 0, moved);
  const renumbered = slots.map((s, i) => ({ ...s, number: i + 1 }));
  // Where a cut ended up, found on the original object rather than the renumbered copy: the cut you
  // were last on has to be followed even when it is not the cut that moved.
  const follow = (n?: number) => n === undefined ? undefined : slots.indexOf(project.slots[n - 1]) + 1 || undefined;
  return { ...project, slots: renumbered, lastSlot: project.lastSlot === from ? to : follow(project.lastSlot) };
}
export const DEFAULT_MOTION: Motion = { version: 1, speed: .5, strength: .5, captionMoves: false };
export function normalizeText(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}
// Identical wording on two cuts. A warning the user acts on, never an automatic edit.
export function duplicateCaptions(slots: Slot[]): number[][] {
  const groups = new Map<string, number[]>();
  for (const slot of slots) {
    const key = normalizeText(captionText(slot)).replace(/[\p{P}\p{S}\s]/gu, '');
    if (key) groups.set(key, [...(groups.get(key) ?? []), slot.number]);
  }
  return [...groups.values()].filter(group => group.length > 1);
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
      if (s.done !== undefined && typeof s.done !== 'boolean') throw new Error('완성 표시 데이터가 손상되었습니다.');
      // Motion is optional and self-contained. A store written before movement existed simply
      // has none; a damaged one is refused here rather than played back as something else.
      if (s.motion !== undefined) {
        const m = s.motion;
        if (m.version !== 1) throw new Error('움직임 데이터가 손상되었습니다.');
        if (m.preset !== undefined && !['bounce', 'shake', 'pulse'].includes(m.preset)) throw new Error('움직임 종류가 손상되었습니다.');
        if (![m.speed, m.strength].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('움직임 세기 데이터가 손상되었습니다.');
        if (m.play !== undefined && !['together', 'sequence'].includes(m.play)) throw new Error('움직임 재생 순서가 손상되었습니다.');
        if (m.captionMoves !== undefined && typeof m.captionMoves !== 'boolean') throw new Error('문구 움직임 데이터가 손상되었습니다.');
        if (m.parts !== undefined) {
          if (!Array.isArray(m.parts) || m.parts.length > 8) throw new Error('부분 움직임 데이터가 손상되었습니다.');
          const partIds = new Set(m.parts.map(p => p.id));
          if (partIds.size !== m.parts.length) throw new Error('부분 움직임이 중복되었습니다.');
          for (const part of m.parts) {
            if (typeof part.id !== 'string' || typeof part.layerId !== 'string') throw new Error('부분 움직임 대상이 손상되었습니다.');
            if (!['rotate', 'move', 'scale'].includes(part.effect)) throw new Error('부분 움직임 종류가 손상되었습니다.');
            if (![part.pivotX, part.pivotY, part.amount, part.angle, part.speed, part.delay].every(Number.isFinite)) throw new Error('부분 움직임 값이 손상되었습니다.');
            for (const point of [part.fromX, part.fromY, part.toX, part.toY]) if (point !== undefined && !Number.isFinite(point)) throw new Error('부분 이동 위치가 손상되었습니다.');
            if (part.speed < 0 || part.speed > 1 || part.delay < 0 || part.delay > 5) throw new Error('부분 움직임 값이 범위를 벗어났습니다.');
          }
        }
        if (m.alternate !== undefined) {
          if (!Array.isArray(m.alternate.poseB) || m.alternate.poseB.some(id => typeof id !== 'string')) throw new Error('두 모습 데이터가 손상되었습니다.');
          if (!Number.isFinite(m.alternate.interval) || m.alternate.interval <= 0 || m.alternate.interval > 5) throw new Error('두 모습 간격이 범위를 벗어났습니다.');
        }
      }
      if (s.noDialogue !== undefined && typeof s.noDialogue !== 'boolean') throw new Error('슬롯 기획 데이터가 손상되었습니다.');
      if (s.referenceKey !== undefined && typeof s.referenceKey !== 'string') throw new Error('슬롯 기획 데이터가 손상되었습니다.');
      for (const text of [s.emotion, s.situation, s.expressionGuide, s.poseGuide, s.compositionGuide, s.effectGuide, s.textPlacementGuide, s.notes]) if (typeof text !== 'string') throw new Error('슬롯 텍스트가 손상되었습니다.');
      s.referenceImages.forEach(validateImage); validateImage(s.finalImage); validateImage(s.motionImage); validateImage(s.submitImage);
      if (s.work) {
        if (s.work.version !== 1 || !Array.isArray(s.work.layers) || !Array.isArray(s.work.references) || s.work.layers.length < 1 || s.work.layers.length > 4) throw new Error('작업 레이어 데이터가 손상되었습니다.');
        const caption = s.work.caption;
        if (caption !== undefined && (typeof caption.text !== 'string' || !['top', 'bottom'].includes(caption.place) || typeof caption.color !== 'string')) throw new Error('문구 데이터가 손상되었습니다.');
        // 글씨체는 선택 항목이다(45.6차): 없으면 기본, 있으면 아는 값이어야 한다. 옛 저장본은 이 줄을 그냥 지나간다.
        if (caption?.style !== undefined && !['basic', 'serif', 'thick'].includes(caption.style)) throw new Error('문구 데이터가 손상되었습니다.');
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
  if (value.userPalette !== undefined && (!Array.isArray(value.userPalette) || value.userPalette.length > 48 || value.userPalette.some(c => typeof c !== 'string' || !/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(c)))) throw new Error('내 팔레트가 손상되었습니다.');
  if (value.savedMotions !== undefined) {
    if (!Array.isArray(value.savedMotions) || value.savedMotions.length > 20) throw new Error('움직임 설정 보관함이 손상되었습니다.');
    for (const preset of value.savedMotions) {
      if (typeof preset.id !== 'string' || typeof preset.name !== 'string' || !preset.motion) throw new Error('움직임 설정이 손상되었습니다.');
    }
  }
  for (const p of value.projects ?? []) if (p.selfChecked !== undefined && typeof p.selfChecked !== 'boolean') throw new Error('직접 확인 표시가 손상되었습니다.');
  // 브러시 설정은 편의 값이라 모양만 본다. 안의 값이 낯설면 Painter 가 기본값으로 읽는다 — 세트 전체를 못 열게 하지 않는다.
  for (const p of value.projects ?? []) if (p.brush !== undefined && (typeof p.brush !== 'object' || p.brush === null || Array.isArray(p.brush))) throw new Error('브러시 설정이 손상되었습니다.');
  if (value.cutouts !== undefined) {
    if (!Array.isArray(value.cutouts) || value.cutouts.length > 40) throw new Error('보관한 그림 목록이 손상되었습니다.');
    for (const cutout of value.cutouts) {
      if (typeof cutout.id !== 'string' || typeof cutout.name !== 'string' || !cutout.image || typeof cutout.image.path !== 'string') throw new Error('보관한 그림이 손상되었습니다.');
    }
  }
  if (value.favoriteBrushes !== undefined) {
    if (!Array.isArray(value.favoriteBrushes) || value.favoriteBrushes.length > 3 || value.favoriteBrushes.some((k: unknown) => typeof k !== 'string'))
      throw new Error('즐겨찾기 브러시 목록이 손상되었습니다.');
  }
  const ent = value.entitlement;
  if (ent !== undefined) {
    // 'lifetime' 이 지금 파는 일회성 PRO 다. 'monthly'·'yearly' 는 팔지 않지만 예전 저장본을 그대로 읽는다.
    if (!['free', 'monthly', 'yearly', 'lifetime'].includes(ent.plan) || !['none', 'store'].includes(ent.source)) throw new Error('이용권 데이터가 손상되었습니다.');
    if (ent.verified !== undefined && typeof ent.verified !== 'boolean') throw new Error('이용권 검증 표시가 손상되었습니다.');
    for (const when of [ent.expiresAt, ent.checkedAt]) if (when !== undefined && Number.isNaN(new Date(when).getTime())) throw new Error('이용권 날짜가 손상되었습니다.');
  }
  return value;
}
