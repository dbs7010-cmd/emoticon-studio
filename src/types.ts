export type Status = 'EMPTY' | 'PLANNED' | 'DRAWING' | 'REVIEW' | 'PASS' | 'WARNING' | 'FAIL';
export type Verdict = 'PASS' | 'WARNING' | 'FAIL';
export type Metrics = { coverage: number; centerX: number; centerY: number; width: number; height: number; color: number[]; transparent: boolean };
export type LocalImage = { path: string; width: number; height: number; metrics?: Metrics };
export type LayerTransform = { id: string; name: string; visible: boolean; opacity: number; x: number; y: number; scale: number; rotation: number };
export type WorkLayer = LayerTransform & { image?: LocalImage };
export type PainterWork = { version: 1; activeLayerId: string; layers: WorkLayer[]; references: WorkLayer[] };
export type PainterExport = { data: string; metrics: Metrics; layers: (LayerTransform & { data: string })[]; references: (LayerTransform & { path: string })[]; activeLayerId: string };
export type Check = { label: string; status: Verdict; detail: string };
export type QA = { status: Verdict; checkedAt: string; checks: Check[]; consistency: Check[] };
export type Slot = {
  number: number; dialogue: string; emotion: string; situation: string;
  expressionGuide: string; poseGuide: string; compositionGuide: string;
  effectGuide: string; textPlacementGuide: string; notes: string;
  referenceImages: LocalImage[]; finalImage?: LocalImage; status: Status; qa?: QA; work?: PainterWork;
};
export type Project = {
  id: string; projectName: string; characterName: string; createdAt: string; updatedAt: string;
  canon: { image?: LocalImage; personality: string; speech: string; locked: string; variable: string };
  slots: Slot[];
};
export type Store = { version: 1; revision: number; projects: Project[] };
