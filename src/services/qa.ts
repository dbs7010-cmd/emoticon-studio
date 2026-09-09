import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';
import type { Check, LocalImage, Metrics, QA, Verdict } from '../types';
import { localFile } from './storage';

export const verdict = (checks: Check[]): Verdict => checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'WARNING') ? 'WARNING' : 'PASS';
export function compareMetrics(canon?: Metrics, final?: Metrics): Check[] {
  if (!canon || !final) return [{ label: 'CANON 비교', status: 'WARNING', detail: '비교할 픽셀 정보가 없습니다. 나란히 보며 LOCKED 특징을 확인하세요.' }];
  if (canon.coverage > 0.95) return [{ label: 'CANON 배경', status: 'WARNING', detail: '불투명 배경이 대부분입니다. 캐릭터 영역을 분리할 수 없어 자동 비교를 보류합니다.' }];
  const center = Math.hypot(canon.centerX - final.centerX, canon.centerY - final.centerY);
  const area = Math.abs(canon.coverage - final.coverage);
  const color = Math.sqrt(canon.color.reduce((sum, c, i) => sum + (c - final.color[i]) ** 2, 0));
  return [
    { label: '중심 위치', status: center > 0.2 ? 'WARNING' : 'PASS', detail: `CANON 대비 거리 ${(center * 100).toFixed(1)}% (참고 기준 20%)` },
    { label: '불투명 영역 비율', status: area > 0.25 ? 'WARNING' : 'PASS', detail: `차이 ${(area * 100).toFixed(1)}%p (참고 기준 25%p)` },
    { label: '평균 색', status: color > 0.3 ? 'WARNING' : 'PASS', detail: `정규화 RGB 거리 ${color.toFixed(2)} (참고 기준 0.30). 소품·효과도 포함됩니다.` },
  ];
}
export function inspectImage(image?: LocalImage, canon?: LocalImage): QA {
  const checks: Check[] = [];
  if (!image || !localFile(image.path).exists) checks.push({ label: '파일 존재', status: 'FAIL', detail: 'FINAL 이미지 파일이 없습니다.' });
  else {
    const file = localFile(image.path);
    const bytes = file.bytesSync();
    const png = bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    checks.push({ label: '파일 존재', status: 'PASS', detail: '영구 저장 파일 확인' }, { label: '파일 형식', status: png ? 'PASS' : 'FAIL', detail: png ? 'PNG 시그니처 확인' : 'PNG가 아닙니다.' });
    if (png) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16), height = view.getUint32(20);
      checks.push({ label: '작업 크기', status: width === SPEC.width && height === SPEC.height ? 'PASS' : 'FAIL', detail: `${width}×${height} / 기준 ${SPEC.width}×${SPEC.height}` });
    }
    checks.push({ label: '파일 크기', status: SPEC.maxBytes === null ? 'WARNING' : bytes.length <= SPEC.maxBytes ? 'PASS' : 'FAIL', detail: `${(bytes.length / 1024).toFixed(1)} KB · ${SPEC.maxBytes === null ? '상한 UNVERIFIED' : `상한 ${SPEC.maxBytes / 1024} KB`}` });
    checks.push({ label: '투명 영역', status: !image.metrics ? 'WARNING' : image.metrics.transparent ? 'PASS' : 'FAIL', detail: !image.metrics ? '픽셀 검사 미실행' : image.metrics.transparent ? '투명 픽셀 있음 (배경 전체의 적합성을 보장하지 않음)' : '투명 픽셀 없음' });
    if (image.metrics) checks.push({ label: '그림 내용', status: image.metrics.coverage > 0 ? 'PASS' : 'FAIL', detail: `불투명 영역 ${(image.metrics.coverage * 100).toFixed(1)}%` });
  }
  checks.push({ label: '최신 제출 정책', status: 'WARNING', detail: SPEC.note });
  const consistency = compareMetrics(canon?.metrics, image?.metrics);
  return { status: verdict([...checks, ...consistency]), checkedAt: new Date().toISOString(), checks, consistency };
}
