// 자체 공모전 제출(2026-10-07). 세트 **전체**를 '이 세트 내보내기'와 같은 규칙(setEntries)으로 묶어 그대로 낸다 — 대표 한 장으로 줄이지 않는다.
// 흐름: 공지·조건 확인 → 로그인 → 세트 선택 → 동의 → createSubmission(같은 제출 키면 같은 접수) → 업로드(진행률) → 서버 검사 결과(접수번호/거절 사유).
// 서버가 '접수됨'이라고 답하기 전에는 접수됐다고 말하지 않는다. 끊기면 같은 제출 키로 다시 시도한다(중복 접수 없음).
import { buildZip, setEntries, type HandoffFrames } from '../export';
import { sha256Hex } from './sha256';
import type { Cloud } from './firebase';
import type { Project } from '../../types';

export type ContestInfo = { id: string; title: string; status: string; notice: string; rules: string; consentVersion: string; startsAt: number; endsAt: number; requirements: { kind: 'still' | 'moving'; cuts: number; minAnimated: number }; maxBytes: number; results?: { receiptNo: string; setName: string }[] };
export type ContestPackage = { bytes: Uint8Array; sha256: string; cuts: number; animated: number; kind: 'still' | 'moving' };
export type SubmissionState = { status: 'uploading' | 'received' | 'rejected' | 'withdrawn' | 'expired' | 'timeout'; receiptNo?: string; reason?: string; review?: string };

export async function openContests(cloud: Cloud): Promise<ContestInfo[]> {
  // 규칙이 공개 상태만 읽게 하므로 질의도 그 상태로만 묻는다(준비 중인 공모전은 보이지 않는다).
  const list = await cloud.listWhereIn('contests', 'status', ['open', 'closed', 'judging', 'announced']);
  return list.map(({ id, data }) => ({ id, ...(data as Omit<ContestInfo, 'id'>) }));
}

// 제출 묶음(메모리). 움직이는 칸의 공식 도구용 프레임(handoff)도 내보내기와 똑같이 들어간다.
export function contestPackage(project: Project, handoff: HandoffFrames[] = []): ContestPackage {
  const entries = setEntries(project, handoff);
  const cutNames = entries.map(e => e.name).filter(n => /^\d{2}\.(png|webp|gif)$/.test(n));
  if (!cutNames.length) throw new Error('아직 저장된 그림이 없어요.');
  const bytes = buildZip(entries);
  const animated = cutNames.filter(n => !n.endsWith('.png')).length;
  return { bytes, sha256: sha256Hex(bytes), cuts: cutNames.length, animated, kind: animated ? 'moving' : 'still' };
}

// 앱에서 직접 그린 칸만(2026-10-21 대표 결정): '그림 가져오기'로 들인 레이어가 보이는 칸 번호. 숨긴 레이어는 그림에 안 들어가 묻지 않는다.
// 서버는 레이어를 모르므로 이 점검은 앱 안에서만 한다 — 심사 때 한 번 더 본다.
export function importedCuts(project: Project): string[] {
  return project.slots.flatMap((slot, i) => {
    if (!slot.finalImage) return [];
    const layers = [...(slot.work?.layers ?? []), ...(slot.work?.frames ?? []).flatMap(f => f.layers)];
    return layers.some(l => l.imported && l.visible) ? [String(i + 1).padStart(2, '0')] : [];
  });
}

// 앱 쪽 사전 점검: 서버와 같은 규칙으로 미리 알려 준다(서버가 다시 확인한다).
export function precheck(pkg: ContestPackage, c: ContestInfo): string | null {
  if (pkg.cuts !== c.requirements.cuts) return `이 공모전은 ${c.requirements.cuts}칸 세트를 받아요(지금 ${pkg.cuts}칸).`;
  if (c.requirements.kind === 'still' && pkg.animated) return '멈춰 있는 세트 공모전이에요 — 움직이는 칸을 빼 주세요.';
  if (c.requirements.kind === 'moving' && pkg.animated < Math.max(1, c.requirements.minAnimated)) return `움직이는 칸이 ${Math.max(1, c.requirements.minAnimated)}개 이상 필요해요.`;
  if (pkg.bytes.length > c.maxBytes) return '제출 파일이 너무 커요.';
  return null;
}

export const newSubmissionKey = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// 제출. key 는 부르는 쪽이 (공모전, 세트)마다 저장해 두고 재시도 때 그대로 넘긴다.
export async function submit(cloud: Cloud, c: ContestInfo, project: Project, pkg: ContestPackage, key: string,
  onProgress?: (fraction: number) => void, waitMs = 60000): Promise<SubmissionState> {
  const uid = cloud.uid();
  if (!uid) throw new Error('로그인이 필요해요.');
  const start = await cloud.call<{ status: string; path: string; receiptNo?: string }>('createSubmission', {
    contestId: c.id, submissionKey: key, consentVersion: c.consentVersion,
    declared: { sha256: pkg.sha256, bytes: pkg.bytes.length, kind: pkg.kind, cuts: pkg.cuts, setName: project.projectName },
  });
  if (start.status === 'received') return { status: 'received', receiptNo: start.receiptNo };
  await cloud.upload(start.path, pkg.bytes, 'application/zip', onProgress);
  return waitResult(cloud, c.id, uid, key, waitMs);
}

// 서버 검사 결과를 기다린다. 시간 안에 답이 없으면 'timeout' — 접수됐다고 하지 않고 '확인 중'으로 둔다(나중에 status() 로 다시 본다).
export async function waitResult(cloud: Cloud, contestId: string, uid: string, key: string, waitMs = 60000): Promise<SubmissionState> {
  const end = Date.now() + waitMs;
  for (;;) {
    const s = await status(cloud, contestId, uid);
    if (s && s.status !== 'uploading' && (s as { key?: string }).key === key) return s;
    if (Date.now() > end) return { status: 'timeout' };
    await new Promise(r => setTimeout(r, 1500));
  }
}

export async function status(cloud: Cloud, contestId: string, uid: string): Promise<(SubmissionState & { key?: string }) | null> {
  const d = await cloud.readDoc(`contests/${contestId}/submissions/${uid}`);
  if (!d) return null;
  return { status: d.status as SubmissionState['status'], receiptNo: d.receiptNo as string | undefined, reason: d.reason as string | undefined, review: (d.review as { state?: string } | undefined)?.state, key: d.submissionKey as string };
}

export const withdraw = (cloud: Cloud, contestId: string) => cloud.call<{ status: string }>('withdrawSubmission', { contestId });
