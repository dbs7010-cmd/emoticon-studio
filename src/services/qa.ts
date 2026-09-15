import { KAKAO_ANIMATED_SPEC, KAKAO_STATIC_SPEC } from '../constants/kakao-spec';
import type { Check, LocalImage, Project, QA, Verdict } from '../types';
import { crc32 } from './export';
import { localFile } from './storage';

// Cuts whose exported files are byte-for-byte the same picture. Worth telling the user about;
// never worth editing or deleting on their behalf.
export function identicalFinals(project: Project): number[][] {
  const groups = new Map<string, number[]>();
  for (const slot of project.slots) {
    if (!slot.finalImage) continue;
    const file = localFile(slot.finalImage.path);
    if (!file.exists) continue;
    const bytes = file.bytesSync();
    const key = `${bytes.length}:${crc32(bytes)}`;
    groups.set(key, [...(groups.get(key) ?? []), slot.number]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

export const verdict = (checks: Check[]): Verdict => checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'WARNING') ? 'WARNING' : 'PASS';

type Profile = { width: number; height: number; maxBytes: number | null; policyStatus: string; note: string };
export function inspectImage(image?: LocalImage, profile: Profile = KAKAO_STATIC_SPEC): QA {
  const SPEC = profile;
  const checks: Check[] = [];
  const notes: string[] = [];
  if (!image || !localFile(image.path).exists) checks.push({ label: '그림 파일', status: 'FAIL', detail: '저장된 그림 파일을 찾을 수 없어요.' });
  else {
    const file = localFile(image.path);
    const bytes = file.bytesSync();
    const png = bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    checks.push({ label: '파일 형식', status: png ? 'PASS' : 'FAIL', detail: png ? 'PNG로 저장돼 있어요.' : 'PNG 파일이 아니에요.' });
    if (png) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16), height = view.getUint32(20);
      const right = width === SPEC.width && height === SPEC.height;
      checks.push({ label: '이미지 크기', status: right ? 'PASS' : 'FAIL', detail: right ? `${width}×${height}로 작업 기준과 같아요.` : `${width}×${height}예요. 작업 기준 ${SPEC.width}×${SPEC.height}와 달라요. 이 칸을 다시 열어 저장하면 맞춰져요.` });
    }
    if (image.metrics) {
      checks.push({ label: '투명 배경', status: image.metrics.transparent ? 'PASS' : 'FAIL', detail: image.metrics.transparent ? '배경이 비어 있어요.' : '배경이 꽉 차 있어요. 투명 배경으로 저장해야 해요.' });
      checks.push({ label: '그림 내용', status: image.metrics.coverage > 0 ? 'PASS' : 'FAIL', detail: image.metrics.coverage > 0 ? `그림이 ${(image.metrics.coverage * 100).toFixed(0)}% 채워져 있어요.` : '아직 아무것도 그려지지 않았어요.' });
    } else notes.push('이 칸은 아직 픽셀 검사를 하지 않았어요.');
    // The official size limit is not confirmed, so the size is reported, never graded.
    notes.push(SPEC.maxBytes === null ? `파일 크기 ${(bytes.length / 1024).toFixed(0)}KB. 공식 용량 상한은 아직 확인되지 않았어요.` : `파일 크기 ${(bytes.length / 1024).toFixed(0)}KB.`);
    if (SPEC.maxBytes !== null) checks.push({ label: '파일 크기', status: bytes.length <= SPEC.maxBytes ? 'PASS' : 'FAIL', detail: `${(bytes.length / 1024).toFixed(0)}KB · 상한 ${SPEC.maxBytes / 1024}KB` });
  }
  // Character consistency, repeated expressions and readability are a person's call, so they are
  // said out loud and never scored. An automatic verdict here would be a guess wearing a badge.
  notes.push('캐릭터가 같아 보이는지, 표현이 겹치지는 않는지는 눈으로 확인해 주세요.');
  // The spec itself is unconfirmed. That is information about our own uncertainty, not a defect
  // in the user's drawing, so it must never turn a good slot into a warning.
  if (SPEC.policyStatus !== 'VERIFIED') notes.push(SPEC.note);
  return { status: verdict(checks), checkedAt: new Date().toISOString(), checks, consistency: [], notes };
}
