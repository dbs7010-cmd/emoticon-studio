import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';
import { localFile, exportFile } from './storage';
import type { Project } from '../types';

export type ExportEntry = { name: string; data: Uint8Array };

const table = (() => {
  const values = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    values[n] = c >>> 0;
  }
  return values;
})();
export function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
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
    lv.setUint32(0, 0x04034B50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); // fixed timestamp keeps exports reproducible
    lv.setUint32(14, sum, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30); local.set(entry.data, 30 + name.length);
    locals.push(local);

    const header = new Uint8Array(46 + name.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x02014B50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 20, true); hv.setUint16(8, 0, true);
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
export function brokenSlots(project: Project): number[] {
  return project.slots.filter(slot => slot.finalImage && !localFile(slot.finalImage.path).exists).map(slot => slot.number);
}
// Final images only, in slot order. Reference layers live outside finalImage and can never appear here.
export function setEntries(project: Project): ExportEntry[] {
  return project.slots
    .filter(slot => slot.finalImage && localFile(slot.finalImage.path).exists)
    .map(slot => ({ name: `${String(slot.number).padStart(2, '0')}.png`, data: localFile(slot.finalImage!.path).bytesSync() }));
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
export function safeName(name: string) {
  return (name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'emoticon-set').slice(0, 40);
}
export function exportSet(project: Project): { path: string; count: number; missing: number } {
  const broken = brokenSlots(project);
  if (broken.length) throw new Error(`${broken.map(n => String(n).padStart(2, '0')).join(', ')}번 그림 파일을 찾을 수 없어요. 그 칸을 다시 그려 저장한 뒤 내보내 주세요.`);
  const entries = setEntries(project);
  if (!entries.length) throw new Error('아직 저장된 그림이 없습니다.');
  const file = exportFile(`${safeName(project.projectName)}-${project.id.slice(-6)}-${entries.length}.zip`);
  file.write(buildZip(entries));
  // Reopen what we just wrote. The bytes shipped must be the bytes we inspected.
  const written = file.bytesSync();
  const names = readZipNames(written);
  if (names.length !== entries.length || names.some((name, i) => name !== entries[i].name)) throw new Error('제출 파일을 저장했지만 내용이 맞지 않아요. 다시 시도해 주세요.');
  return { path: file.name, count: entries.length, missing: SPEC.count - entries.length };
}
