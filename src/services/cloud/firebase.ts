// 서버(Firebase) 연결(2026-10-07). 앱 설정(extra.cloud)에 운영 프로젝트의 **공개** 웹 설정이 있을 때만 연결한다.
// 설정이 없으면 cloudConfig() 가 null — 화면은 '준비 중'으로만 보이고, 어떤 요청도 보내지 않는다(제출·백업이 된 것처럼 표시하지 않음).
// 나머지 코드(공모전·백업·계정)는 아래 Cloud 모양에만 기대어, 같은 코드를 Node 에서 로컬 에뮬레이터로 검사한다.
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, initializeAuth, onAuthStateChanged, signInWithCustomToken, signOut, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getBytes, getMetadata, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

export type CloudConfig = FirebaseOptions & { functionsRegion?: string };
export type Cloud = {
  uid(): string | null;
  call<T>(name: string, data: unknown): Promise<T>;
  upload(path: string, bytes: Uint8Array, contentType: string, onProgress?: (fraction: number) => void): Promise<void>;
  exists(path: string): Promise<boolean>;
  download(path: string): Promise<Uint8Array>;
  readDoc(path: string): Promise<Record<string, unknown> | null>;
  writeDoc(path: string, data: Record<string, unknown>): Promise<void>;
  listDocs(path: string): Promise<{ id: string; data: Record<string, unknown> }[]>;
  listWhereIn(path: string, field: string, values: string[]): Promise<{ id: string; data: Record<string, unknown> }[]>;
  signInWithToken(token: string): Promise<string>;
  signOut(): Promise<void>;
  // 로그인 상태가 정해질 때(앱을 켜 기기에 남은 로그인을 되살린 뒤 포함)와 바뀔 때마다 부른다. 돌려준 함수로 그만 듣는다.
  onAuth(listener: (uid: string | null) => void): () => void;
};

const isConfig = (x: unknown): x is CloudConfig => !!x && typeof x === 'object'
  && typeof (x as CloudConfig).apiKey === 'string' && typeof (x as CloudConfig).projectId === 'string' && typeof (x as CloudConfig).storageBucket === 'string' && typeof (x as CloudConfig).appId === 'string';
export function cloudConfig(extra: unknown): CloudConfig | null {
  const c = extra && typeof extra === 'object' ? (extra as { cloud?: unknown }).cloud : undefined;
  return isConfig(c) ? c : null;
}

// 이미 만들어진 Firebase 앱 위에 Cloud 를 얹는다(앱·검사 공통).
export function cloudFrom(app: FirebaseApp, parts: { auth: Auth; db?: Firestore; storage?: FirebaseStorage; functions?: Functions }): Cloud {
  const auth = parts.auth, db = parts.db ?? getFirestore(app), st = parts.storage ?? getStorage(app), fn = parts.functions ?? getFunctions(app);
  return {
    uid: () => auth.currentUser?.uid ?? null,
    call: async <T,>(name: string, data: unknown) => (await httpsCallable(fn, name)(data)).data as T,
    upload: (path, bytes, contentType, onProgress) => new Promise((resolve, reject) => {
      const task = uploadBytesResumable(ref(st, path), bytes, { contentType });
      task.on('state_changed', s => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
    }),
    exists: async path => { try { await getMetadata(ref(st, path)); return true; } catch (e) { if ((e as { code?: string }).code === 'storage/object-not-found') return false; throw e; } },
    download: async path => new Uint8Array(await getBytes(ref(st, path))),
    readDoc: async path => { const s = await getDoc(doc(db, path)); return s.exists() ? s.data() : null; },
    writeDoc: async (path, data) => { await setDoc(doc(db, path), data); },
    listDocs: async path => (await getDocs(collection(db, path))).docs.map(d => ({ id: d.id, data: d.data() })),
    listWhereIn: async (path, field, values) => (await getDocs(query(collection(db, path), where(field, 'in', values)))).docs.map(d => ({ id: d.id, data: d.data() })),
    signInWithToken: async token => (await signInWithCustomToken(auth, token)).user.uid,
    signOut: () => signOut(auth),
    onAuth: listener => onAuthStateChanged(auth, u => listener(u?.uid ?? null)),
  };
}

// 앱에서 쓰는 연결. 로그인 유지는 기기 저장소(AsyncStorage)에. 설정이 없으면 null.
let shared: Cloud | null = null;
export function appCloud(config: CloudConfig | null): Cloud | null {
  if (!config) return null;
  if (shared) return shared;
  const app = getApps()[0] ?? initializeApp(config);
  let auth: Auth;
  try {
    // RN 빌드의 firebase/auth 는 getReactNativePersistence 를 내보낸다(웹·Node 빌드에는 없다).
    const rn = require('firebase/auth') as { getReactNativePersistence?: (s: unknown) => Persistence };
    const storage = require('@react-native-async-storage/async-storage').default;
    auth = rn.getReactNativePersistence ? initializeAuth(app, { persistence: rn.getReactNativePersistence(storage) }) : getAuth(app);
  } catch { auth = getAuth(app); }
  shared = cloudFrom(app, { auth, functions: getFunctions(app, config.functionsRegion ?? 'us-central1') });
  return shared;
}
