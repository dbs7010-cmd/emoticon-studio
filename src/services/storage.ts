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
export function newImageFile() { ensureRoot(); return localFile(`image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`); }
export function loadStore(): { store: Store; recovered: boolean } {
  ensureRoot();
  const candidates: Store[] = [];
  let broken = 0;
  for (const name of ['store-a.json', 'store-b.json']) {
    const file = localFile(name);
    if (file.exists) { try { candidates.push(parseStore(file.textSync())); } catch { broken++; } }
  }
  if (!candidates.length && broken) throw new Error('저장 파일을 읽지 못했습니다. 원본을 보존했습니다. 앱을 삭제하지 말고 다시 시도하세요.');
  return { store: candidates.sort((a, b) => b.revision - a.revision)[0] ?? { version: 1, revision: 0, projects: [] }, recovered: broken > 0 };
}
// Alternating snapshots: a failed/truncated write leaves the previous revision intact.
// Synchronous small JSON writes preserve edit ordering and finish before navigation/background.
export function saveStore(store: Store) {
  ensureRoot();
  const json = JSON.stringify(store);
  parseStore(json);
  const file = localFile(store.revision % 2 ? 'store-a.json' : 'store-b.json');
  file.write(json);
  if (file.textSync() !== json) throw new Error('저장 검증 실패. 다시 저장하세요.');
}
