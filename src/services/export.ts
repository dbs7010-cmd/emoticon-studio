import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';
import { localFile, exportFile } from './storage';
import type { Project } from '../types';

export type ExportEntry = { name: string; data: Uint8Array };
// 공식 도구(WebPAnimator)로 넘길 한 컷의 프레임. **저장해 둔 파일이 아니라 내보내는 순간 만든 것이다.**
// 저장할 때마다 24장씩 파일로 남기면 자동저장이 느려지고, 컷을 고치거나 순서를 바꾼 뒤에도 옛
// 프레임이 남아 지금 작품과 다른 것이 묶음에 섞인다. 그래서 내보낼 때 현재 그림·움직임에서 새로 만든다.
export type HandoffFrames = { number: number; frames: Uint8Array[]; delayMs: number };

const table = (() => {
  const values = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    values[n] = c >>> 0;
  }
  return values;
})();
// data URL 을 바로 바이트로 푼다. 프레임을 파일로 한 번 거치지 않고 묶음에 넣기 위해서다.
// atob 가 있는지에 기대지 않는다 — 기기마다 갈리는 것에 제출 파일을 걸지 않는다.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeDataUrl(url: string): Uint8Array {
  if (!/^data:[^;,]*;base64,/.test(url)) throw new Error('base64 데이터가 아닙니다.');
  const text = url.slice(url.indexOf(',') + 1).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let at = 0, bits = 0, held = 0;
  for (let i = 0; i < text.length; i++) {
    const value = B64.indexOf(text[i]);
    if (value < 0) throw new Error('base64 데이터가 아닙니다.');
    held = (held << 6) | value; bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (held >> bits) & 255; }
  }
  return out.subarray(0, at);
}
export function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// 폴더가 있는 묶음에는 폴더 항목도 함께 적는다. Windows 의 Expand-Archive 는 폴더 항목이 없으면
// 한 단계 아래의 파일을 풀지 못하고 중간에 멈춘다(2026-09-12 PowerShell 5.1 에서 실제로 확인).
// 제출물을 받는 사람이 Windows 기본 도구로 열 수 있어야 하므로 항목을 적어 준다.
export function withDirectories(entries: ExportEntry[]): ExportEntry[] {
  const out: ExportEntry[] = [], seen = new Set<string>();
  for (const entry of entries) {
    const parts = entry.name.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      const directory = parts.slice(0, depth).join('/') + '/';
      if (!seen.has(directory)) { seen.add(directory); out.push({ name: directory, data: new Uint8Array(0) }); }
    }
    out.push(entry);
  }
  return out;
}

// Stored (uncompressed) ZIP. PNG is already compressed, so this costs nothing and
// keeps the export free of any archiver dependency.
export function buildZip(entries: ExportEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), sum = crc32(entry.data), size = entry.data.length;
    const local = new Uint8Array(30 + name.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034B50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); // fixed timestamp keeps exports reproducible
    lv.setUint32(14, sum, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30); local.set(entry.data, 30 + name.length);
    locals.push(local);

    const header = new Uint8Array(46 + name.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x02014B50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 20, true); hv.setUint16(8, 0x0800, true);
    hv.setUint16(10, 0, true); hv.setUint16(12, 0, true); hv.setUint16(14, 0x21, true);
    hv.setUint32(16, sum, true); hv.setUint32(20, size, true); hv.setUint32(24, size, true);
    hv.setUint16(28, name.length, true); hv.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);
    offset += local.length;
  }
  const directory = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directory, true); ev.setUint32(16, offset, true);

  const parts = [...locals, ...central, end];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

// Slots that claim a drawing whose file is no longer on disk. Exporting those would either
// throw a raw error or ship a hole, so the caller stops and names them instead.
// 내보낼 때 고르는 한 장. 움직이는 컷이면 카카오가 받는 WebP 를 먼저 쓰고, 없으면 작업용 GIF 를 쓴다.
export const shipped = (slot: Project['slots'][number]) => slot.submitImage ?? slot.motionImage ?? slot.finalImage;
export const shippedName = (slot: Project['slots'][number]) =>
  `${String(slot.number).padStart(2, '0')}.${slot.submitImage ? 'webp' : slot.motionImage ? 'gif' : 'png'}`;
// 묶음에 실제로 들어갈 파일의 형식별 수. 화면의 '파일 형식' 안내가 ZIP 과 같은 규칙(shippedName)으로 센다(45.38).
// 예전 안내는 'WebP · 나머지 PNG' 로 적었지만, WebP 가 없는 움직이는 칸은 GIF 로 들어갔다.
export function exportFormatSummary(project: Project): string {
  const counts: Record<'png' | 'webp' | 'gif', number> = { png: 0, webp: 0, gif: 0 };
  for (const slot of shippedSlots(project)) counts[shippedName(slot).split('.').pop() as 'png' | 'webp' | 'gif']++;
  const parts = (['png', 'webp', 'gif'] as const).filter(k => counts[k] > 0).map(k => ({ png: 'PNG', webp: 'WebP', gif: 'GIF' })[k] + ' ' + counts[k] + '개');
  return parts.length ? parts.join(' · ') : '아직 만든 파일이 없어요';
}
export function brokenSlots(project: Project): number[] {
  return project.slots.filter(slot => shipped(slot) && !localFile(shipped(slot)!.path).exists).map(slot => slot.number);
}
// Final images only, in slot order. Reference layers live outside finalImage and can never appear here.
export const shippedSlots = (project: Project) =>
  project.slots.filter(slot => shipped(slot) && localFile(shipped(slot)!.path).exists);
export function setEntries(project: Project, handoff: HandoffFrames[] = []): ExportEntry[] {
  const cuts = shippedSlots(project)
    .map(slot => ({ name: shippedName(slot), data: localFile(shipped(slot)!.path).bytesSync() }));

  // 부가 이미지. 만들어 둔 것만 들어간다 — 없는 파일을 있는 것처럼 넣지 않는다.
  const extras: ExportEntry[] = [];
  const icon = project.extras?.icon, share = project.extras?.share;
  if (icon && localFile(icon.path).exists) extras.push({ name: 'icon.png', data: localFile(icon.path).bytesSync() });
  if (share && localFile(share.path).exists) extras.push({ name: 'share.png', data: localFile(share.path).bytesSync() });

  // 움직이는 컷은 공식 도구(WebPAnimator)가 360×360 PNG 프레임을 받아 WebP 로 만든다. 그래서 컷마다
  // 폴더를 하나 두고 그 안에 순서대로 프레임을 넣는다. 넘길 프레임이 없으면 폴더도 없다.
  // 컷 번호는 지금 이 묶음을 만드는 순간의 번호다 — 순서를 바꿨으면 바뀐 번호로 들어간다.
  const frames: ExportEntry[] = [];
  for (const cut of [...handoff].sort((a, b) => a.number - b.number)) {
    cut.frames.forEach((data, index) => frames.push({
      name: `webp-animator/${String(cut.number).padStart(2, '0')}/${String(index + 1).padStart(2, '0')}.png`,
      data,
    }));
  }
  const note = animatorNote(handoff);
  const guide = note ? [{ name: 'webp-animator/읽어주세요.txt', data: new TextEncoder().encode(note) }] : [];
  return [...cuts, ...extras, ...frames, ...guide];
}
// 공식 도구에 넣을 때 사람이 알아야 하는 것: 컷마다 몇 장을 몇 초 간격으로 넣는지.
// 앱이 대신 변환해 주지 않으므로, 추측하지 않도록 숫자를 그대로 적어 둔다.
export function animatorNote(handoff: HandoffFrames[]): string {
  const moving = [...handoff].filter(cut => cut.frames.length).sort((a, b) => a.number - b.number);
  if (!moving.length) return '';
  const lines = moving.map(cut => {
    const count = cut.frames.length;
    return `${String(cut.number).padStart(2, '0')}번 · ${count}장 · 한 장당 ${cut.delayMs}ms · 전체 ${((count * cut.delayMs) / 1000).toFixed(1)}초`;
  });
  return [
    'WebPAnimator 에 넣는 법',
    '1. https://emoticonstudio.kakao.com/webp-animator 에서 "움직이는 이모티콘"을 고릅니다.',
    '2. webp-animator 폴더 안의 컷 폴더 하나를 열어, 그 안의 PNG 를 번호 순서대로 모두 등록합니다.',
    '3. 프레임 시간을 아래 숫자에 맞추고, 반복 4회로 두고 내보냅니다.',
    '4. 컷마다 2~3을 되풀이합니다. 이 앱은 변환을 대신하지 않습니다.',
    '',
    ...lines,
  ].join('\n');
}
// Read the archive back the way an unzipper would, so a truncated or partial write cannot pass.
export function readZipNames(archive: Uint8Array): string[] {
  if (archive.length < 22) throw new Error('제출 파일이 너무 작아요.');
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;
  if (view.getUint32(end, true) !== 0x06054B50) throw new Error('제출 파일이 끝까지 저장되지 않았어요.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > archive.length || view.getUint32(at, true) !== 0x02014B50) throw new Error('제출 파일 목록이 깨졌어요.');
    const length = view.getUint16(at + 28, true);
    names.push(new TextDecoder().decode(archive.slice(at + 46, at + 46 + length)));
    at += 46 + length + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return names;
}
// Local file names are ASCII-only by design, so a Korean set title cannot survive here.
// The archive still needs to be unique and recognisable, hence the project suffix.
// 파일 이름에 쓸 세트 이름. 한글 등 글자·숫자는 그대로 두고, 공백·특수문자는 '-' 로 바꾼다(2026-10-05: 예전에는 한글을 모두 지워
// 받는 쪽에서 어느 세트인지 알 수 없었다). 비면 'emoticon-set'.
export function safeName(name: string) {
  return (name.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '') || 'emoticon-set').slice(0, 40).replace(/[-.]+$/, '') || 'emoticon-set';
}
// 같은 세트를 여러 번 내보내도 이름이 겹치지 않게 하는 시각 꼬리표(기기 시각, 초 단위).
export function fileStamp(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}
export function exportSet(project: Project, handoff: HandoffFrames[] = [], now = new Date()): { path: string; count: number; missing: number } {
  const broken = brokenSlots(project);
  if (broken.length) throw new Error(`${broken.map(n => String(n).padStart(2, '0')).join(', ')}번 그림 파일을 찾을 수 없어요. 그 칸을 다시 그려 저장한 뒤 내보내 주세요.`);
  const entries = setEntries(project, handoff);
  if (!entries.length) throw new Error('아직 저장된 그림이 없습니다.');
  const count = shippedSlots(project).length;
  const packed = withDirectories(entries);
  const file = exportFile(`${safeName(project.projectName)}-${project.id.slice(-6)}-${fileStamp(now)}.zip`);
  file.write(buildZip(packed));
  // Reopen what we just wrote. The bytes shipped must be the bytes we inspected.
  const written = file.bytesSync();
  const names = readZipNames(written);
  if (names.length !== packed.length || names.some((name, i) => name !== packed[i].name)) throw new Error('제출 파일을 저장했지만 내용이 맞지 않아요. 다시 시도해 주세요.');
  return { path: file.name, count, missing: SPEC.count - count };
}
