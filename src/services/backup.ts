// 세트 백업·복원(45.38). 앱을 지우거나 기기를 바꾸기 전에 세트 하나를 파일 하나로 보관하고, 그 파일에서 되살린다.
//
// 형식: 압축하지 않은 ZIP(내보내기와 같은 작성기).
//   backup.json      { format, version, createdAt, project } — 세트 정보(칸·레이어·문구·움직임·참고·캐릭터 기준)
//   images/<이름>    그 세트가 가리키는 모든 그림(완성 그림·작업 레이어·움직이는 파일·참고·캐릭터 기준·부가 이미지)
//
// 되살릴 때는 먼저 전부 검사하고, 하나라도 어긋나면 아무것도 쓰지 않는다:
// 형식·버전 · 저장 데이터 검증(parseStore) · 그림 이름 규칙(경로 조작 차단) · CRC · 세트가 가리키는 그림이 빠짐없이 있는지.
// 검사를 통과하면 그림을 **새 이름**으로 쓰고 세트 안의 경로를 바꿔 넣는다 — 이미 있는 파일을 덮어쓰지 않는다.
import { buildZip, crc32, fileStamp, safeName, type ExportEntry } from './export';
import { exportFile, localFile, ensureRoot } from './storage';
import { imagePaths, parseStore } from '../project';
import type { Project } from '../types';

export const BACKUP_FORMAT = 'emoticon-studio-backup';
export const BACKUP_VERSION = 1;
// 되살릴 수 있는 그림 이름. 앱이 만든 이름 규칙과 같다 — 폴더·상위 경로·다른 확장자는 받지 않는다.
const IMAGE_NAME = /^image-[a-zA-Z0-9._-]+\.(png|gif|webp)$/;

// 세트가 가리키는 모든 그림(부가 이미지 포함).
export function backupPaths(project: Project): string[] {
  const paths = imagePaths(project);
  if (project.extras?.icon) paths.add(project.extras.icon.path);
  if (project.extras?.share) paths.add(project.extras.share.path);
  return [...paths].sort();
}

// 기기에서 이미 사라진 그림은 담을 수 없다. 그렇다고 백업 전체를 막으면 정작 보관이 필요한 순간에 아무것도 남기지 못한다 —
// 있는 그림은 모두 담고, 없는 그림은 missing 에 적어 둔다(되살린 뒤에도 원래 기기와 같은 자리가 비어 있다).
export function buildBackup(project: Project, now = new Date()): { bytes: Uint8Array; images: number; missing: string[] } {
  const paths = backupPaths(project);
  const missing = paths.filter(path => !localFile(path).exists);
  const present = paths.filter(path => !missing.includes(path));
  const { deletedAt: _trash, ...kept } = project;
  const meta = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), missing, project: kept };
  const entries: ExportEntry[] = [
    { name: 'backup.json', data: new TextEncoder().encode(JSON.stringify(meta)) },
    { name: 'images/', data: new Uint8Array(0) },
    ...present.map(path => ({ name: 'images/' + path, data: localFile(path).bytesSync() })),
  ];
  return { bytes: buildZip(entries), images: present.length, missing };
}

// 백업 파일을 앱 폴더에 쓰고 이름을 돌려준다(공유 창으로 넘길 파일). 쓴 뒤 다시 읽어 검사한다.
export function writeBackup(project: Project, now = new Date()): { path: string; images: number; missing: number } {
  ensureRoot();
  const { bytes, images, missing } = buildBackup(project, now);
  // 같은 날 여러 번 백업해도 이름이 겹치지 않게 초 단위 시각을 붙인다(2026-10-05).
  const file = exportFile(`backup-${safeName(project.projectName)}-${project.id.slice(-6)}-${fileStamp(now)}.zip`);
  file.write(bytes);
  readBackup(file.bytesSync());   // 방금 쓴 것이 되살릴 수 있는 파일인지 바로 확인한다
  return { path: file.name, images, missing: missing.length };
}

type Entry = { name: string; data: Uint8Array };
// 압축하지 않은 ZIP 만 읽는다(이 앱이 만든 백업). 다른 도구로 다시 압축한 파일은 이유를 말하고 거절한다.
export function readZip(archive: Uint8Array): Entry[] {
  if (archive.length < 22) throw new Error('백업 파일이 너무 작아요.');
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  // 끝 레코드를 뒤에서 찾는다(주석이 붙은 ZIP 도 끝 레코드 위치가 달라질 수 있다).
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 22 - 65535); i--) if (view.getUint32(i, true) === 0x06054B50) { end = i; break; }
  if (end < 0) throw new Error('백업 파일이 끝까지 저장되지 않았거나 ZIP 이 아니에요.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out: Entry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (at + 46 > archive.length || view.getUint32(at, true) !== 0x02014B50) throw new Error('백업 파일 목록이 깨졌어요.');
    const method = view.getUint16(at + 10, true), sum = view.getUint32(at + 16, true), size = view.getUint32(at + 20, true), raw = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength));
    if (method !== 0 || size !== raw) throw new Error('다른 프로그램으로 다시 압축한 파일은 되살릴 수 없어요. 앱에서 만든 백업 파일을 그대로 골라 주세요.');
    if (offset + 30 > archive.length || view.getUint32(offset, true) !== 0x04034B50) throw new Error('백업 파일 내용이 깨졌어요.');
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    if (start + size > archive.length) throw new Error('백업 파일 내용이 잘렸어요.');
    const data = archive.slice(start, start + size);
    if (crc32(data) !== sum) throw new Error('백업 파일이 손상됐어요(' + name + ').');
    out.push({ name, data });
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

export type BackupContents = { project: Project; images: Map<string, Uint8Array>; createdAt: string };
// 검사만 한다. 파일은 쓰지 않는다.
export function readBackup(archive: Uint8Array): BackupContents {
  const entries = readZip(archive);
  const metaEntry = entries.find(entry => entry.name === 'backup.json');
  if (!metaEntry) throw new Error('이모티 백업 파일이 아니에요.');
  let meta: { format?: unknown; version?: unknown; createdAt?: unknown; missing?: unknown; project?: unknown };
  try { meta = JSON.parse(new TextDecoder().decode(metaEntry.data)); } catch { throw new Error('백업 정보를 읽지 못했어요.'); }
  if (meta.format !== BACKUP_FORMAT) throw new Error('이모티 백업 파일이 아니에요.');
  if (meta.version !== BACKUP_VERSION) throw new Error('이 앱보다 새 버전에서 만든 백업이에요. 앱을 업데이트한 뒤 다시 시도해 주세요.');
  // 세트 모양은 저장소와 같은 검증으로 본다 — 손상된 세트를 저장소에 들이지 않는다.
  const project = parseStore(JSON.stringify({ version: 1, revision: 1, projects: [meta.project] })).projects[0];
  const images = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.name === 'backup.json' || entry.name === 'images/') continue;
    const path = entry.name.startsWith('images/') ? entry.name.slice(7) : '';
    if (!IMAGE_NAME.test(path)) throw new Error('백업 안에 받을 수 없는 파일이 있어요: ' + entry.name);
    images.set(path, entry.data);
  }
  // 만들 때 이미 없던 그림(missing 에 적힌 것)만 빠져도 된다. 적히지 않았는데 빠졌다면 파일이 잘못 바뀐 것이다.
  const known = Array.isArray(meta.missing) && meta.missing.every(x => typeof x === 'string') ? new Set(meta.missing as string[]) : new Set<string>();
  const missing = backupPaths(project).filter(path => !images.has(path) && !known.has(path));
  if (missing.length) throw new Error(`백업 안에 그림 ${missing.length}개가 빠져 있어요. 원래 기기에서 백업을 다시 만들어 주세요.`);
  return { project, images, createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : '' };
}

// 세트 안의 그림 경로를 새 이름으로 바꾼다. 경로는 모두 'image-…' 로 서로 겹치지 않으므로 같은 글자인 값만 바꾼다.
function remap<T>(value: T, names: Map<string, string>): T {
  if (typeof value === 'string') return (names.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map(item => remap(item, names)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, names)])) as T;
  return value;
}

// 검사를 통과한 백업에서 세트를 되살린다. 그림은 새 이름으로 쓰고, 이미 같은 세트가 있으면 새 id 의 사본으로 들인다.
// 돌려주는 세트를 저장소에 넣는 일은 부르는 쪽이 한다(commit) — 저장에 실패하면 여기서 쓴 그림은 다음 정리에서 빠진다.
export function restoreBackup(archive: Uint8Array, existing: Project[], now = new Date()): { project: Project; images: number; copy: boolean } {
  const { project, images } = readBackup(archive);
  ensureRoot();
  const names = new Map<string, string>();
  let n = 0;
  for (const [path, data] of images) {
    const ext = path.split('.').pop();
    const fresh = `image-${now.getTime()}-r${(n++).toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    localFile(fresh).write(data);
    names.set(path, fresh);
  }
  const restored = remap(project, names);
  const copy = existing.some(p => p.id === restored.id);
  const stamp = now.toISOString();
  const taken = new Set(existing.map(p => p.projectName));
  let name = restored.projectName;
  if (copy || taken.has(name)) { name = restored.projectName + ' (복원)'; for (let i = 2; taken.has(name); i++) name = `${restored.projectName} (복원 ${i})`; }
  return {
    project: { ...restored, id: copy ? `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}` : restored.id, projectName: name, updatedAt: stamp, deletedAt: undefined },
    images: images.size, copy,
  };
}
