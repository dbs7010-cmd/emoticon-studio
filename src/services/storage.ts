import { Directory, File, Paths } from 'expo-file-system';
import { parseStore } from '../project';
import type { Store } from '../types';

const root = () => new Directory(Paths.document, 'emoticon-studio');
export function ensureRoot() { root().create({ idempotent: true, intermediates: true }); }
export function localFile(path: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(path)) throw new Error('잘못된 로컬 파일 이름');
  return new File(root(), path);
}
export function imageUri(path: string) { return localFile(path).uri; }
// Export bundles live beside the images but are never image files, so cleanup never sees them.
// 2026-10-05: 내보내는 파일 이름에는 세트 이름(한글 포함)이 들어간다. 그림 파일(localFile)의 ASCII 규칙과 따로,
// 글자·숫자·. _ - 만 받는다(경로 구분자·공백 없음) — 받는 앱·갤러리에 보이는 이름이 작품을 알아보게 한다.
const EXPORT_NAME = /^[\p{L}\p{N}._-]+$/u;
function exportLocal(name: string) {
  if (!EXPORT_NAME.test(name) || name.includes('..')) throw new Error('잘못된 내보내기 파일 이름');
  return new File(root(), name);
}
export function exportFile(name: string) { ensureRoot(); return exportLocal('set-' + name); }
export function exportUri(name: string) { return exportLocal(name).uri; }
// 한 칸 공유용 사본(cut-…). 공유 창으로 넘길 때만 만든다.
export function cutFile(name: string) { ensureRoot(); return exportLocal('cut-' + name); }
// 사용자가 고른 파일(문서 선택 창이 앱 캐시로 복사한 것)을 읽는다. 앱 폴더 밖이라 localFile 의 이름 규칙을 쓰지 않는다.
export function readPickedFile(uri: string): Uint8Array { return new File(uri).bytesSync(); }
export function newImageFile() { ensureRoot(); return localFile(`image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`); }
// 움직이는 파일은 두 가지다: 작업용 GIF 와 카카오가 받는 WebP. 둘 다 같은 이름 규칙을 쓴다.
export function newMotionFile(kind: 'gif' | 'webp' = 'gif') { ensureRoot(); return localFile(`image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${kind}`); }
// Only files newImageFile() created may ever be removed; store snapshots share this directory.
const removable = (path: string) => /^image-[a-zA-Z0-9._-]+\.(png|gif|webp)$/.test(path);
// Best effort: a file that is already gone or locked must not abort the rest of the cleanup.
export function deleteLocalImages(paths: string[]): { removed: number; skipped: number } {
  let removed = 0, skipped = 0;
  for (const path of paths) {
    if (!removable(path)) { skipped++; continue; }
    try { const file = localFile(path); if (file.exists) { file.delete(); removed++; } } catch { skipped++; }
  }
  return { removed, skipped };
}

const SNAPSHOTS = ['store-a.json', 'store-b.json'] as const;
// What a snapshot file looks like from the outside, without changing it in any way.
// `stage` says where reading stopped, because "the bytes are damaged" and "the shape is wrong"
// have different causes and different answers.
export type SnapshotReport = {
  name: string; uri: string; exists: boolean; bytes: number | null;
  head: string; tail: string; stage: 'ok' | 'read' | 'json' | 'shape'; error: string | null; revision: number | null;
};
export type StoreReport = { directory: string; snapshots: SnapshotReport[] };
export type UnreadableStore = Error & { report: StoreReport };

const clip = (text: string, from: 'head' | 'tail') => text.length <= 40 ? text : from === 'head' ? text.slice(0, 40) : text.slice(-40);

// Read-only. Safe to call while the store is unreadable: it opens files and never writes one.
export function inspectStore(): StoreReport {
  const directory = root().uri;
  const snapshots = SNAPSHOTS.map((name): SnapshotReport => {
    const file = localFile(name);
    const base = { name, uri: file.uri, exists: false, bytes: null, head: '', tail: '', revision: null };
    let exists = false;
    try { exists = file.exists; } catch (e) { return { ...base, stage: 'read', error: String(e) }; }
    if (!exists) return { ...base, stage: 'read', error: null };
    let text: string;
    try { text = file.textSync(); } catch (e) { return { ...base, exists: true, stage: 'read', error: String(e) }; }
    const shape = { ...base, exists: true, bytes: text.length, head: clip(text, 'head'), tail: clip(text, 'tail') };
    try { JSON.parse(text); } catch (e) { return { ...shape, stage: 'json', error: String(e) }; }
    try { return { ...shape, stage: 'ok', error: null, revision: parseStore(text).revision }; }
    catch (e) { return { ...shape, stage: 'shape', error: String(e) }; }
  });
  return { directory, snapshots };
}

// Which snapshot currently holds the newest readable store. The next write goes to the other one,
// so a failed write can never damage the copy we are still relying on — not even when the caller
// retries with a new revision number.
let newest: string | null = null;

export function loadStore(): { store: Store; recovered: boolean; report: StoreReport } {
  ensureRoot();
  const report = inspectStore();
  const readable = report.snapshots.filter(s => s.stage === 'ok');
  const damaged = report.snapshots.filter(s => s.exists && s.stage !== 'ok');
  if (!readable.length) {
    newest = null;
    if (damaged.length) {
      const error = new Error('저장 파일을 읽지 못했습니다. 원본을 보존했습니다. 앱을 삭제하지 말고 다시 시도하세요.') as UnreadableStore;
      error.report = report;
      throw error;
    }
    return { store: { version: 1, revision: 0, projects: [] }, recovered: false, report };
  }
  const best = readable.reduce((a, b) => (b.revision ?? 0) > (a.revision ?? 0) ? b : a);
  newest = best.name;
  // Re-reading here keeps parseStore the single source of truth for what a store is.
  return { store: parseStore(localFile(best.name).textSync()), recovered: damaged.length > 0, report };
}

// Alternating snapshots: a failed/truncated write leaves the previous revision intact.
// Synchronous small JSON writes preserve edit ordering and finish before navigation/background.
export function saveStore(store: Store) {
  ensureRoot();
  const json = JSON.stringify(store);
  parseStore(json);
  const name = newest === SNAPSHOTS[0] ? SNAPSHOTS[1] : newest === SNAPSHOTS[1] ? SNAPSHOTS[0] : SNAPSHOTS[store.revision % 2];
  const file = localFile(name);
  file.write(json);
  if (file.textSync() !== json) throw new Error('저장 검증 실패. 다시 저장하세요.');
  newest = name;
}
