import { KAKAO_STATIC_SPEC as SPEC } from './constants/kakao-spec';
import type { Project, Slot, Store } from './types';

export function createProject(projectName: string, characterName: string): Project {
  const now = new Date().toISOString();
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, projectName: projectName.trim(), characterName: characterName.trim(), createdAt: now, updatedAt: now,
    canon: { personality: '', speech: '', locked: '', variable: '' },
    slots: Array.from({ length: SPEC.count }, (_, i): Slot => ({ number: i + 1, dialogue: '', emotion: '', situation: '', expressionGuide: '', poseGuide: '', compositionGuide: '', effectGuide: '', textPlacementGuide: '', notes: '', referenceImages: [], status: 'EMPTY' })) };
}
export function duplicates(slots: Slot[]): number[][] {
  const groups = new Map<string, number[]>();
  for (const slot of slots) {
    const key = slot.dialogue.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu, '').toLocaleLowerCase();
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
    p.slots.forEach((s, index) => {
      if (s.number !== index + 1 || !Array.isArray(s.referenceImages) || typeof s.dialogue !== 'string') throw new Error('슬롯 저장 데이터가 손상되었습니다.');
      if (!['EMPTY', 'PLANNED', 'DRAWING', 'REVIEW', 'PASS', 'WARNING', 'FAIL'].includes(s.status)) throw new Error('슬롯 상태가 손상되었습니다.');
      for (const text of [s.emotion, s.situation, s.expressionGuide, s.poseGuide, s.compositionGuide, s.effectGuide, s.textPlacementGuide, s.notes]) if (typeof text !== 'string') throw new Error('슬롯 텍스트가 손상되었습니다.');
      s.referenceImages.forEach(validateImage); validateImage(s.finalImage);
      if (s.work) {
        if (s.work.version !== 1 || !Array.isArray(s.work.layers) || !Array.isArray(s.work.references) || s.work.layers.length !== 2) throw new Error('작업 레이어 데이터가 손상되었습니다.');
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
  return value;
}
