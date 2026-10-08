// 계정·클라우드 화면(vc4, 2026-10-07): 서버 설정 없음 → '준비 중'만(요청 0회) · 로그인 SDK 없음 → 버튼 잠김 ·
// 무료 회원은 개인 클라우드 공간 없음 · PRO 백업 기록 · 공모전 세트 전체 제출(첫 업로드 끊김 → 같은 제출 키로 재시도 → 서버가 접수했다고 할 때만 접수번호).
// 서버는 메모리 가짜(Cloud 모양). 실제 서버 규칙·함수 검사는 server/firebase(에뮬레이터)가 맡는다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const files = new Map();
class Directory { constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); } create() {} list() { return []; } }
class File {
  constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(d) { files.set(this.uri, d); }
  bytesSync() { return files.get(this.uri); }
  delete() { files.delete(this.uri); }
}
const alerts = [];
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), Alert: { alert: (...a) => alerts.push(a) }, Animated: require('./_rn-animated-mock.cjs') });
const load = loader({
  'react-native': rn, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, '@expo/ui': { Host: 'Host' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
});
const { CloudScreen } = load('src/components/cloud-screen.tsx');
const { createProject } = load('src/project.ts');
const { localFile } = load('src/services/storage.ts');

const png = Buffer.alloc(40); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
const project = createProject('몽이의 하루', '몽');
project.slots.forEach((s, i) => { const path = `image-f${i}.png`; localFile(path).write(new Uint8Array(png)); s.finalImage = { path, width: 360, height: 360 }; s.done = true; });

// ── 가짜 서버 ───────────────────────────────────────────────────────────────────────────────
function fakeCloud() {
  const st = { uid: null, pro: false, calls: [], uploads: 0, failNext: 0, subs: new Map(), docs: new Map(), seq: 0 };
  const contestsList = [{ id: 'c1', data: { title: '첫 공모전', status: 'open', notice: '가을 공모전', rules: '세트 전체를 받아요', consentVersion: 'v1', startsAt: 0, endsAt: Date.now() + 1e9, requirements: { kind: 'still', cuts: 32, minAnimated: 0 }, maxBytes: 120 * 1024 * 1024 } }];
  return {
    st,
    uid: () => st.uid,
    call: async (name, data) => {
      st.calls.push([name, data]);
      if (name === 'registerUser') return { pro: { active: st.pro, source: 'trial', verified: false }, backupBytes: 0, artistName: '몽이작가' };
      if (name === 'createSubmission') {
        const cur = st.subs.get(data.contestId);
        if (cur && cur.status === 'received') return { status: 'received', receiptNo: cur.receiptNo, path: cur.path };
        const sub = { key: data.submissionKey, status: 'uploading', path: `contests/${data.contestId}/${st.uid}/${data.submissionKey}.zip`, attempts: (cur?.key === data.submissionKey ? cur.attempts : 0) + 1 };
        st.subs.set(data.contestId, sub); return { status: 'uploading', path: sub.path };
      }
      throw new Error('unknown ' + name);
    },
    upload: async (path, bytes, type, onProgress) => {
      st.uploads++;
      if (st.failNext > 0) { st.failNext--; onProgress?.(.4); throw new Error('연결이 끊겼어요'); }
      onProgress?.(1);
      const m = /^contests\/([^/]+)\//.exec(path);
      if (m) { const s = st.subs.get(m[1]); s.status = 'received'; s.receiptNo = 'X-' + String(++st.seq).padStart(5, '0'); s.bytes = bytes.length; }
      else st.docs.set(path, bytes);
    },
    exists: async path => st.docs.has(path),
    download: async path => st.docs.get(path),
    readDoc: async path => {
      const m = /^contests\/([^/]+)\/submissions\//.exec(path);
      if (m) { const s = st.subs.get(m[1]); return s ? { status: s.status, receiptNo: s.receiptNo, submissionKey: s.key } : null; }
      return st.docs.get(path) ?? null;
    },
    writeDoc: async (path, data) => { st.docs.set(path, data); },
    listDocs: async path => [...st.docs.keys()].filter(k => k.startsWith(path + '/')).map(k => ({ id: k.split('/').pop(), data: st.docs.get(k) })),
    listWhereIn: async () => contestsList,
    signInWithToken: async () => st.uid,
    signOut: async () => { st.uid = null; },
  };
}

let tree, store = { version: 1, revision: 1, projects: [project] };
const commit = fn => { store = fn(store); };
const task = async (label, work) => { try { await work(); } catch (e) { alerts.push(['하지 못했어요', String(e.message)]); } };
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [].concat(n.props.children).join(''));
const btn = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const b = btn(label); assert.equal(b.length, 1, label + ' (' + b.length + ')'); assert.ok(!b[0].props.disabled, label + ' 눌림'); await act(async () => { await b[0].props.onPress(); await new Promise(r => setTimeout(r, 0)); }); };
const render = async props => { await act(async () => { tree = create(React.createElement(CloudScreen, { visible: true, onClose() {}, device: 'test', projects: store.projects, store, commit, task, bakeHandoff: async () => ({ handoff: [], failed: [] }), login: async () => {}, extra: {}, ...props })); await new Promise(r => setTimeout(r, 0)); }); };

(async () => {
  // 1) 서버 설정 없음
  await render({ cloud: null });
  assert.ok(texts().includes('준비 중이에요'));
  assert.equal(btn('카카오로 로그인').length + btn('카카오로 로그인 · 준비 중').length, 0, '서버가 없으면 로그인 버튼도 없다');

  // 2) 서버 있음 · 로그인 SDK 없음 → 버튼 잠김(요청 없음)
  const cloud = fakeCloud();
  await render({ cloud, extra: {} });
  const locked = btn('카카오로 로그인 · 준비 중');
  assert.equal(locked.length, 1); assert.equal(locked[0].props.disabled, true, '이 빌드에 카카오 SDK·키가 없으면 누를 수 없다');
  assert.equal(cloud.st.calls.length, 0, '로그인 전에는 회원 요청을 보내지 않는다');

  // 3) 카카오 SDK 있는 빌드 → 로그인 → 무료 회원
  await render({ cloud, extra: { login: { kakao: true } }, login: async () => { cloud.st.uid = 'kakao:1'; } });
  await press('카카오로 로그인');
  assert.ok(texts().includes('카카오 로그인'), '어느 회사로 로그인했는지');
  assert.ok(texts().includes('몽이작가'), '작가명이 계정 이름');
  assert.ok(texts().some(t => t.includes('개인 클라우드 저장 공간을 드리지 않아요')), '무료 회원에게 개인 클라우드 공간 없음');
  assert.equal(btn('백업').length, 0);

  // 4) PRO(서버 기록) → 세트 백업 → 마지막 백업 시각·보낸 파일 수 기록
  cloud.st.pro = true;
  await render({ cloud, extra: { login: { kakao: true } } });
  await press('백업');
  const note = store.cloudBackups[project.id];
  assert.equal(note.ok, true); assert.equal(note.files, 32); assert.equal(note.sent, 1, '같은 내용 파일은 한 번만');
  await render({ cloud, extra: { login: { kakao: true } }, store, projects: store.projects });
  assert.ok(texts().some(t => t.startsWith('마지막 백업 ')), '마지막 백업 시각을 보여 준다');

  // 5) 공모전: 세트 전체 제출 — 첫 업로드 끊김 → 같은 키로 재시도 → 접수번호
  await press('공모전 첫 공모전');
  assert.ok(texts().includes('가을 공모전') && texts().includes('세트 전체를 받아요'), '공지·참가 조건을 먼저 보여 준다');
  assert.equal(btn('세트 전체 제출')[0].props.disabled, true, '세트·동의 전에는 못 낸다');
  await press('낼 세트 몽이의 하루');
  await press('참가 조건에 동의');
  cloud.st.failNext = 1;
  await press('세트 전체 제출');
  assert.ok(alerts.some(a => a[1].includes('연결이 끊겼어요')), '끊기면 이유를 말한다');
  const firstKey = store.contestEntries[0].key;
  assert.notEqual(store.contestEntries[0].status, 'received', '끊긴 제출을 접수됐다고 하지 않는다');
  await render({ cloud, extra: { login: { kakao: true } }, store, projects: store.projects });
  await press('공모전 첫 공모전'); await press('낼 세트 몽이의 하루'); await press('참가 조건에 동의');
  await press('세트 전체 제출');
  assert.equal(store.contestEntries.length, 1); assert.equal(store.contestEntries[0].key, firstKey, '재시도는 같은 제출 키');
  assert.equal(store.contestEntries[0].status, 'received'); assert.equal(store.contestEntries[0].receiptNo, 'X-00001');
  assert.equal(cloud.st.subs.get('c1').attempts, 2, '접수는 한 건, 시도 두 번');
  await render({ cloud, extra: { login: { kakao: true } }, store, projects: store.projects });
  await press('공모전 첫 공모전');
  assert.ok(texts().includes('접수됐어요 · 접수번호 X-00001'));
  const zipBytes = cloud.st.subs.get('c1').bytes;
  assert.ok(zipBytes > 32 * 40, '세트 전체(32칸)가 묶여 올라갔다: ' + zipBytes + 'B');

  console.log('PASS: cloud screen — no server config shows only 준비 중 with zero requests; login buttons locked without provider SDK; free members get no personal cloud space; PRO backup records time/files (same content once); contest: notice & rules first, set + consent required, interrupted upload not reported as received, retry reuses the submission key, receipt shown only after the server marks it received, whole 32-cut set uploaded');
})().catch(e => { console.error(e); process.exit(1); });
