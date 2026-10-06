// 전체 백업·복원(2026-10-06). 세트 백업(backup.ts, 세트 하나)은 그대로 두고, 기기를 바꿀 때 필요한 것을 한 파일에 더 담는다:
//   지금 있는 모든 세트(휴지통 제외)와 그 그림 + 앱 설정(최근 색·내 팔레트·종이 질감·보관한 움직임·조각·즐겨찾기 브러시·안내 완료).
//
// 담지 않는 것: PRO 이용권(entitlement)·검수 해제(reviewUnlock). **구매 권한은 백업 파일로 옮겨지지 않는다** —
// 파일은 누구나 고칠 수 있으므로, PRO 는 언제나 스토어의 구매 복원으로만 돌아온다. 되살릴 때도 파일에 그런 값이 있으면 읽지 않는다.
//
// 형식: 압축하지 않은 ZIP(세트 백업과 같은 작성기·검사기).
//   full-backup.json  { format, version, createdAt, settings, projects, missing }
//   images/<이름>     세트·조각이 가리키는 그림
//
// 되살리기는 아무것도 덮어쓰지 않는다: 먼저 전부 검사하고(형식·버전·저장 데이터 검증·그림 이름·CRC·빠진 그림),
// 그림은 새 이름으로 쓰고, 세트는 새로 들이며(같은 세트가 있으면 사본), 목록(색·움직임·조각)은 지금 것 뒤에 없는 것만 붙이고,
// 한 값짜리 설정(종이 질감·즐겨찾기 브러시)은 지금 기기에 아직 정한 값이 없을 때만 채운다.
import { buildZip, fileStamp, type ExportEntry } from './export';
import { exportFile, localFile, ensureRoot } from './storage';
import { readZip, remap } from './backup';
import { parseStore, storeImagePaths } from '../project';
import type { Project, Store } from '../types';

export const FULL_BACKUP_FORMAT = 'emoticon-studio-full-backup';
export const FULL_BACKUP_VERSION = 1;
const IMAGE_NAME = /^image-[a-zA-Z0-9._-]+\.(png|gif|webp)$/;
// 화면이 쓰는 상한과 같다(최근 색 8 · 내 팔레트 48 · 보관한 움직임 12 · 조각 40).
const CAP = { palette: 8, userPalette: 48, savedMotions: 12, cutouts: 40 } as const;

type Settings = Pick<Store, 'palette' | 'userPalette' | 'paperTexture' | 'savedMotions' | 'cutouts' | 'favoriteBrushes' | 'introDone'>;
const settingsOf = (s: Store): Settings => ({ palette: s.palette, userPalette: s.userPalette, paperTexture: s.paperTexture, savedMotions: s.savedMotions, cutouts: s.cutouts, favoriteBrushes: s.favoriteBrushes, introDone: s.introDone });

export function buildFullBackup(store: Store, now = new Date()): { bytes: Uint8Array; sets: number; images: number; missing: string[] } {
  const projects = store.projects.filter(p => !p.deletedAt).map(({ deletedAt: _trash, ...kept }) => kept as Project);
  const scope: Store = { version: 1, revision: 1, projects, cutouts: store.cutouts };
  const paths = [...storeImagePaths(scope)].sort();
  const missing = paths.filter(path => !localFile(path).exists);
  const present = paths.filter(path => !missing.includes(path));
  const meta = { format: FULL_BACKUP_FORMAT, version: FULL_BACKUP_VERSION, createdAt: now.toISOString(), settings: settingsOf(store), projects, missing };
  const entries: ExportEntry[] = [
    { name: 'full-backup.json', data: new TextEncoder().encode(JSON.stringify(meta)) },
    { name: 'images/', data: new Uint8Array(0) },
    ...present.map(path => ({ name: 'images/' + path, data: localFile(path).bytesSync() })),
  ];
  return { bytes: buildZip(entries), sets: projects.length, images: present.length, missing };
}

export function writeFullBackup(store: Store, now = new Date()): { path: string; sets: number; images: number; missing: number } {
  const { bytes, sets, images, missing } = buildFullBackup(store, now);
  const file = exportFile(`all-backup-${fileStamp(now)}.zip`);
  file.write(bytes);
  readFullBackup(file.bytesSync());   // 방금 쓴 것이 되살릴 수 있는 파일인지 바로 확인한다
  return { path: file.name, sets, images, missing: missing.length };
}

export const isFullBackup = (archive: Uint8Array) => { try { return readZip(archive).some(e => e.name === 'full-backup.json'); } catch { return false; } };

export type FullBackupContents = { settings: Settings; projects: Project[]; images: Map<string, Uint8Array>; createdAt: string };
// 검사만 한다. 파일은 쓰지 않는다.
export function readFullBackup(archive: Uint8Array): FullBackupContents {
  const entries = readZip(archive);
  const metaEntry = entries.find(e => e.name === 'full-backup.json');
  if (!metaEntry) throw new Error('이모티 전체 백업 파일이 아니에요.');
  let meta: { format?: unknown; version?: unknown; createdAt?: unknown; settings?: unknown; projects?: unknown; missing?: unknown };
  try { meta = JSON.parse(new TextDecoder().decode(metaEntry.data)); } catch { throw new Error('백업 정보를 읽지 못했어요.'); }
  if (meta.format !== FULL_BACKUP_FORMAT) throw new Error('이모티 전체 백업 파일이 아니에요.');
  if (meta.version !== FULL_BACKUP_VERSION) throw new Error('이 앱보다 새 버전에서 만든 백업이에요. 앱을 업데이트한 뒤 다시 시도해 주세요.');
  const raw = (meta.settings && typeof meta.settings === 'object' ? meta.settings : {}) as Record<string, unknown>;
  // 설정에서 받는 칸만 골라 담는다 — entitlement·reviewUnlock 처럼 받지 않는 칸은 여기서 버려진다.
  const picked: Record<string, unknown> = {};
  for (const key of ['palette', 'userPalette', 'paperTexture', 'savedMotions', 'cutouts', 'favoriteBrushes', 'introDone'] as const) if (raw[key] !== undefined) picked[key] = raw[key];
  // 세트·설정의 모양은 저장소와 같은 검증으로 본다 — 손상된 내용을 저장소에 들이지 않는다.
  const checked = parseStore(JSON.stringify({ version: 1, revision: 1, projects: Array.isArray(meta.projects) ? meta.projects : [], ...picked }));
  const images = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.name === 'full-backup.json' || entry.name === 'images/') continue;
    const path = entry.name.startsWith('images/') ? entry.name.slice(7) : '';
    if (!IMAGE_NAME.test(path)) throw new Error('백업 안에 받을 수 없는 파일이 있어요: ' + entry.name);
    images.set(path, entry.data);
  }
  const known = Array.isArray(meta.missing) && meta.missing.every(x => typeof x === 'string') ? new Set(meta.missing as string[]) : new Set<string>();
  const lost = [...storeImagePaths(checked)].filter(path => !images.has(path) && !known.has(path));
  if (lost.length) throw new Error(`백업 안에 그림 ${lost.length}개가 빠져 있어요. 원래 기기에서 백업을 다시 만들어 주세요.`);
  return { settings: settingsOf(checked), projects: checked.projects, images, createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : '' };
}

export type FullRestore = { store: Store; sets: number; copies: number; images: number; added: { savedMotions: number; cutouts: number; userPalette: number }; skipped: { savedMotions: number; cutouts: number; userPalette: number } };
// 검사를 통과한 전체 백업을 지금 저장소에 **더한다**. 돌려주는 store 를 저장하는 일은 부르는 쪽이 한다(commit).
// 지금 저장소의 이용권·검수 해제·세트·설정은 그대로 둔다.
export function restoreFullBackup(archive: Uint8Array, current: Store, now = new Date()): FullRestore {
  const { settings, projects, images } = readFullBackup(archive);
  ensureRoot();
  const names = new Map<string, string>();
  let n = 0;
  for (const [path, data] of images) {
    const ext = path.split('.').pop();
    const fresh = `image-${now.getTime()}-a${(n++).toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    localFile(fresh).write(data);
    names.set(path, fresh);
  }
  const stamp = now.toISOString();
  const ids = new Set(current.projects.map(p => p.id)), taken = new Set(current.projects.map(p => p.projectName));
  let copies = 0;
  const incoming = projects.map((p, i) => {
    const restored = remap(p, names);
    const copy = ids.has(restored.id);
    if (copy) copies++;
    let name = restored.projectName;
    if (copy || taken.has(name)) { name = restored.projectName + ' (복원)'; for (let k = 2; taken.has(name); k++) name = `${restored.projectName} (복원 ${k})`; }
    taken.add(name);
    const id = copy ? `${now.getTime()}-${i}-${Math.random().toString(36).slice(2, 7)}` : restored.id;
    ids.add(id);
    return { ...restored, id, projectName: name, updatedAt: stamp, deletedAt: undefined };
  });
  // 목록: 지금 것을 앞에 그대로 두고, 없는 것만 상한까지 뒤에 붙인다.
  const merge = <T,>(mine: T[] | undefined, theirs: T[] | undefined, key: (x: T) => string, cap: number) => {
    const out = [...(mine ?? [])], seen = new Set(out.map(key));
    let added = 0, skipped = 0;
    for (const x of theirs ?? []) { if (seen.has(key(x))) continue; if (out.length >= cap) { skipped++; continue; } out.push(x); seen.add(key(x)); added++; }
    return { out, added, skipped };
  };
  const motions = merge(current.savedMotions, settings.savedMotions, m => m.id, CAP.savedMotions);
  const cutouts = merge(current.cutouts, (settings.cutouts ?? []).map(c => remap(c, names)), c => c.id, CAP.cutouts);
  const userPalette = merge(current.userPalette, settings.userPalette, c => c.toUpperCase(), CAP.userPalette);
  const palette = merge(current.palette, settings.palette, c => c.toUpperCase(), CAP.palette);
  const store: Store = {
    ...current,
    projects: [...current.projects, ...incoming],
    savedMotions: motions.out.length ? motions.out : current.savedMotions,
    cutouts: cutouts.out.length ? cutouts.out : current.cutouts,
    userPalette: userPalette.out.length ? userPalette.out : current.userPalette,
    palette: palette.out.length ? palette.out : current.palette,
    paperTexture: current.paperTexture ?? settings.paperTexture,
    favoriteBrushes: current.favoriteBrushes ?? settings.favoriteBrushes,
    introDone: current.introDone || settings.introDone || undefined,
  };
  // 이용권·검수 해제는 지금 기기의 값 그대로다(...current). 백업의 값은 readFullBackup 에서 이미 버려졌다.
  return { store, sets: incoming.length, copies, images: images.size,
    added: { savedMotions: motions.added, cutouts: cutouts.added, userPalette: userPalette.added },
    skipped: { savedMotions: motions.skipped, cutouts: cutouts.skipped, userPalette: userPalette.skipped } };
}

