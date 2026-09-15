export type Status = 'EMPTY' | 'PLANNED' | 'DRAWING' | 'REVIEW' | 'PASS' | 'WARNING' | 'FAIL';
export type Verdict = 'PASS' | 'WARNING' | 'FAIL';
export type Metrics = { coverage: number; centerX: number; centerY: number; width: number; height: number; color: number[]; transparent: boolean };
export type LocalImage = { path: string; width: number; height: number; metrics?: Metrics };
export type LayerTransform = { id: string; name: string; visible: boolean; opacity: number; x: number; y: number; scale: number; rotation: number };
export type WorkLayer = LayerTransform & { image?: LocalImage };
// Editable text that is drawn into the exported image. Absent means no words at all, the default.
// dx·dy·scale·rot 은 사용자가 손가락으로 옮기고 키우고 돌린 값이다. 없으면 예전처럼 위/아래
// 가운데에 놓인다 — 그래서 이 값들이 없던 저장 데이터도 그대로 열린다.
export type Caption = { text: string; place: 'top' | 'bottom'; color: string; dx?: number; dy?: number; scale?: number; rot?: number };
export type PainterWork = { version: 1; activeLayerId: string; layers: WorkLayer[]; references: WorkLayer[]; caption?: Caption };
export type MotionLoop = { count: number; fps: number; loop: number; delayMs: number; data: string; bytes: number; droppedColours: number; clipped: boolean;
  // 카카오가 받는 형식. 기기가 WebP 인코딩을 못 하면 null 이고, 그때는 GIF 만 남는다.
  webp?: string | null; webpBytes?: number;
  // 공식 도구에 넣을 360×360 PNG 프레임. 순서가 재생 순서다.
  sheets?: string[] };
export type PainterExport = { data: string; metrics: Metrics; layers: (LayerTransform & { data: string })[]; references: (LayerTransform & { path: string })[]; activeLayerId: string; caption?: Caption; motion?: Motion | null; gif?: MotionLoop };
// Motion is stored beside the drawing, never baked into it: editing a cut keeps its movement,
// and a cut with no motion is exactly the still cut it always was.
export type MotionPreset = 'bounce' | 'shake' | 'pulse';
export type PartEffect = 'rotate' | 'move' | 'scale';
// One drawing layer moving on its own. `amount` is degrees for rotate, a fraction of the canvas
// for move, and a scale delta for scale; `angle` is the direction a move travels in.
export type PartMotion = {
  id: string; layerId: string; effect: PartEffect;
  pivotX: number; pivotY: number; amount: number; angle: number;
  // Switched off for a moment while the rest is tuned. The setting stays so it can come back.
  off?: boolean;
  // A move can instead be pointed out on the canvas: both ends as fractions of the picture.
  fromX?: number; fromY?: number; toX?: number; toY?: number;
  speed: number; delay: number;
};
export type Motion = {
  version: 1;
  preset?: MotionPreset;            // the whole picture moving, free
  speed: number; strength: number;  // 0..1
  parts?: PartMotion[];                          // PRO: parts moving on their own
  play?: 'together' | 'sequence';
  // How far apart the parts start when they play in turn, in seconds.
  stagger?: number;                // PRO: how those parts share the loop
  alternate?: { poseB: string[]; interval: number }; // PRO: two poses taking turns
  captionMoves?: boolean;           // words stay still unless the user says otherwise
};
// `slot` is set only by set-level checks, where a problem can be opened and fixed in one tap.
export type Check = { label: string; status: Verdict; detail: string; slot?: number };
// notes carry what we could not verify. They never affect status.
export type QA = { status: Verdict; checkedAt: string; checks: Check[]; consistency: Check[]; notes?: string[] };
export type Slot = {
  number: number; dialogue: string; emotion: string; situation: string;
  expressionGuide: string; poseGuide: string; compositionGuide: string;
  effectGuide: string; textPlacementGuide: string; notes: string;
  referenceImages: LocalImage[]; finalImage?: LocalImage; status: Status; qa?: QA; work?: PainterWork;
  // The user's own completion declaration, separate from autosave. Optional so stores written
  // before it existed stay valid: there, a saved drawing is what counts as finished.
  done?: boolean;
  // Absent means a still cut. Kept apart from `work` so redrawing never disturbs the movement.
  motion?: Motion;
  // The moving file this cut exports, rebuilt whenever the drawing or the movement changes.
  motionImage?: LocalImage;
  // 공식 도구(WebPAnimator)에 넣을 360×360 PNG 프레임. 순서가 곧 재생 순서다.
  // 제출용 WebP. 없으면 이 컷은 아직 작업 파일(GIF)만 가진 것이다.
  submitImage?: LocalImage;
  // Planning-only, both optional so stores written before set planning stay valid.
  noDialogue?: boolean; referenceKey?: string;
};
export type Project = {
  id: string; projectName: string; characterName: string; createdAt: string; updatedAt: string;
  canon: { image?: LocalImage; personality: string; speech: string; locked: string; variable: string };
  slots: Slot[];
  lastSlot?: number; // where the user left off, so a restart lands back on the same칸
  // 부가 이미지 — 기존 컷을 골라 용도별 프레임에 얹어 만든 것. 원본 컷은 바뀌지 않는다.
  extras?: { icon?: LocalImage; share?: LocalImage; coverSlot?: number };
  // Ticked by the person, not by the app: the list of things only eyes can check.
  selfChecked?: boolean;
  // PRO 브러시 설정(선택). 없으면 무료 기본값 — 예전 세트는 그대로 열린다.
  brush?: BrushSettings;
};
// preset 이 없으면 기본 도구바의 펜/붓/연필을 쓴다. opacity 는 색 투명도와 따로 곱해지는 브러시 진하기(0.05~1).
// base·width·eraserWidth: 세트에서 마지막으로 쓴 선 종류와 굵기. 다음 칸과 재시작에서도 이어진다(없으면 펜 6 · 지우개 24).
export type BrushSettings = { preset?: 'ink' | 'soft' | 'grain' | 'marker'; opacity?: number; stabilizer?: 'off' | 'light' | 'medium' | 'strong'; base?: 'pen' | 'brush' | 'pencil'; width?: number; eraserWidth?: number };
// Only a store receipt may set this. `source` exists so a hand written file cannot claim PRO.
export type Entitlement = {
  // 라이선스 테스터·내부 테스트 구매로 열린 이용권. 화면이 그렇게 말하기 위한 표시다.
  test?: boolean; plan: 'free' | 'monthly' | 'yearly'; source: 'none' | 'store'; verified?: boolean; expiresAt?: string; checkedAt?: string };
export type SavedMotion = { id: string; name: string; motion: Motion };
// A piece someone cut out of a drawing and kept. It is a copy: the drawing it came from is unchanged.
export type Cutout = { id: string; name: string; image: LocalImage };
// reviewUnlock: 내부 검수 빌드에서만 효력이 있는 임시 해제. 이용권(entitlement)과 따로 둔다 —
// 같은 자리에 두면 출시 앱에서 구매한 이용권으로 읽힐 길이 생긴다.
// userPalette: 사용자가 이름 붙여 모아 둔 색(PRO로 저장). 최근 색(palette)과 달리 자동으로 밀려나지 않는다.
export type Store = { version: 1; revision: number; projects: Project[]; palette?: string[]; userPalette?: string[]; entitlement?: Entitlement; reviewUnlock?: boolean; paperTexture?: boolean; savedMotions?: SavedMotion[]; cutouts?: Cutout[] };
