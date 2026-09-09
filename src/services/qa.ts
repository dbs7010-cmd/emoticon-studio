import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';
import type { Check, LocalImage, Metrics, QA, Verdict } from '../types';
import { localFile } from './storage';

export const verdict = (checks: Check[]): Verdict => checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'WARNING') ? 'WARNING' : 'PASS';

// Only things we could actually compare become checks. "We could not check this" is a note,
// never a verdict, or every correct drawing would be flagged forever.
export function compareMetrics(canon?: Metrics, final?: Metrics): { checks: Check[]; notes: string[] } {
  if (!canon || !final) return { checks: [], notes: ['원캐릭터와 자동 비교할 픽셀 정보가 없어요. 나란히 보며 직접 확인해 주세요.'] };
  if (canon.coverage > 0.95) return { checks: [], notes: ['원캐릭터가 배경까지 꽉 찬 이미지라 자동 비교를 건너뛰었어요.'] };
  const center = Math.hypot(canon.centerX - final.centerX, canon.centerY - final.centerY);
  const area = Math.abs(canon.coverage - final.coverage);
  const color = Math.sqrt(canon.color.reduce((sum, c, i) => sum + (c - final.color[i]) ** 2, 0));
  return {
    checks: [
      { label: '그림 위치', status: center > 0.2 ? 'WARNING' : 'PASS', detail: `원캐릭터보다 ${(center * 100).toFixed(0)}%만큼 치우쳐 있어요.` },
      { label: '그림 크기', status: area > 0.25 ? 'WARNING' : 'PASS', detail: `채워진 넓이가 원캐릭터와 ${(area * 100).toFixed(0)}%p 달라요.` },
      { label: '전체 색감', status: color > 0.3 ? 'WARNING' : 'PASS', detail: `원캐릭터와 평균 색이 ${color.toFixed(2)}만큼 달라요. 소품·효과도 함께 계산돼요.` },
    ],
    notes: [],
  };
}

export function inspectImage(image?: LocalImage, canon?: LocalImage): QA {
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
  const consistency = compareMetrics(canon?.metrics, image?.metrics);
  notes.push(...consistency.notes);
  // The spec itself is unconfirmed. That is information about our own uncertainty, not a defect
  // in the user's drawing, so it must never turn a good slot into a warning.
  if (SPEC.policyStatus !== 'VERIFIED') notes.push(SPEC.note);
  return { status: verdict([...checks, ...consistency.checks]), checkedAt: new Date().toISOString(), checks, consistency: consistency.checks, notes };
}
