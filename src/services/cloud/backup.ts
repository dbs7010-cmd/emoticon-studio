// PRO 클라우드 백업·복원(2026-10-07). 세트의 **편집 원본**(레이어·움직임·문구·참고·완성/움직이는 파일)을 계정 저장소에 둔다.
//  - 파일은 내용 해시 이름(backups/{uid}/blobs/{sha256}) — 이미 서버에 있는 내용은 다시 보내지 않는다(바뀐 것만 전송).
//  - 세트 정보(편집 데이터 JSON)는 backups/{uid}/sets/{세트 id} 한 문서. 서버 규칙이 '본인 + 서버가 준 PRO'만 쓰게 한다.
//  - 복원은 새 세트로 들인다. 기기에 같은 세트가 있으면 덮어쓰지 않고 '(복원)' 사본으로(파일 백업 되살리기와 같은 규칙).
import { backupPaths, remap } from '../backup';
import { localFile, ensureRoot } from '../storage';
import { parseStore } from '../../project';
import { sha256Hex } from './sha256';
import type { Cloud } from './firebase';
import type { Project } from '../../types';

export type CloudSet = { id: string; name: string; updatedAt: number; device: string; bytes: number; files: { path: string; sha256: string; size: number }[] };
export type BackupResult = { files: number; sent: number; sentBytes: number; bytes: number; missing: number };

export async function backupSet(cloud: Cloud, project: Project, device: string, onProgress?: (done: number, total: number) => void): Promise<BackupResult> {
  const uid = cloud.uid();
  if (!uid) throw new Error('로그인이 필요해요.');
  const paths = backupPaths(project), files: CloudSet['files'] = [];
  let sent = 0, sentBytes = 0, missing = 0, done = 0;
  for (const path of paths) {
    const file = localFile(path);
    if (!file.exists) { missing++; done++; continue; }
    const data = file.bytesSync(), sha = sha256Hex(data);
    files.push({ path, sha256: sha, size: data.length });
    const at = `backups/${uid}/blobs/${sha}`;
    if (!(await cloud.exists(at))) { await cloud.upload(at, data, 'application/octet-stream'); sent++; sentBytes += data.length; }
    onProgress?.(++done, paths.length);
  }
  const { deletedAt: _trash, ...kept } = project;
  const bytes = files.reduce((t, f) => t + f.size, 0);
  // 목록은 파일을 다 올린 뒤에 쓴다 — 목록이 있는데 파일이 없는 백업을 남기지 않는다.
  await cloud.writeDoc(`backups/${uid}/sets/${project.id}`, { name: project.projectName.slice(0, 80), updatedAt: Date.now(), device: device.slice(0, 60), files, bytes, store: JSON.stringify(kept) });
  return { files: files.length, sent, sentBytes, bytes, missing };
}

export async function listSets(cloud: Cloud): Promise<CloudSet[]> {
  const uid = cloud.uid();
  if (!uid) throw new Error('로그인이 필요해요.');
  return (await cloud.listDocs(`backups/${uid}/sets`)).map(({ id, data }) => ({ id, name: String(data.name), updatedAt: Number(data.updatedAt), device: String(data.device), bytes: Number(data.bytes), files: data.files as CloudSet['files'] }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// 복원: 모두 내려받아 확인한 뒤에만 기기에 쓴다. 쓰다 실패하면 이번에 쓴 새 파일만 지운다.
export async function restoreSet(cloud: Cloud, setId: string, existing: Project[], now = new Date()): Promise<{ project: Project; images: number; copy: boolean }> {
  const uid = cloud.uid();
  if (!uid) throw new Error('로그인이 필요해요.');
  const doc = await cloud.readDoc(`backups/${uid}/sets/${setId}`);
  if (!doc) throw new Error('클라우드에서 그 세트를 찾지 못했어요.');
  const project = parseStore(JSON.stringify({ version: 1, revision: 1, projects: [JSON.parse(String(doc.store))] })).projects[0];
  const files = doc.files as CloudSet['files'];
  const blobs = new Map<string, Uint8Array>();
  for (const f of files) {
    const data = await cloud.download(`backups/${uid}/blobs/${f.sha256}`);
    if (sha256Hex(data) !== f.sha256) throw new Error('내려받은 파일이 손상됐어요. 다시 시도해 주세요. 기존 작품은 그대로예요.');
    blobs.set(f.path, data);
  }
  ensureRoot();
  const names = new Map<string, string>(), written: string[] = [];
  try {
    let n = 0;
    for (const [path, data] of blobs) {
      const fresh = `image-${now.getTime()}-c${(n++).toString(36)}-${Math.random().toString(36).slice(2, 8)}.${path.split('.').pop()}`;
      localFile(fresh).write(data); written.push(fresh); names.set(path, fresh);
    }
  } catch (e) {
    for (const p of written) { try { localFile(p).delete(); } catch { /* 다음 정리 */ } }
    throw new Error('기기에 저장하지 못했어요(저장 공간을 확인해 주세요). 기존 작품은 그대로예요.');
  }
  const restored = remap(project, names);
  const copy = existing.some(p => p.id === restored.id);
  const taken = new Set(existing.map(p => p.projectName));
  let name = restored.projectName;
  if (copy || taken.has(name)) { name = restored.projectName + ' (복원)'; for (let i = 2; taken.has(name); i++) name = `${restored.projectName} (복원 ${i})`; }
  return { project: { ...restored, id: copy ? `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}` : restored.id, projectName: name, updatedAt: now.toISOString(), deletedAt: undefined }, images: written.length, copy };
}
