// 계정 · 클라우드 백업 · 공모전(vc4, 2026-10-07). 2026-10-08부터 아래 탭(공모전 · 내 정보) 안에 그대로 들어간다(inline).
// 서버 설정이 없는 빌드(cloud=null)에서는 '준비 중'만 보이고 아무 요청도 보내지 않는다 — 제출·백업이 된 것처럼 표시하지 않는다.
// 로그인 버튼은 그 회사 로그인 SDK·키가 들어간 빌드에서만 눌린다(providerReady). 클라우드 백업은 **서버가 기록한** PRO 만 쓴다.
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Glyph, T } from './ui';
import type { Cloud } from '../services/cloud/firebase';
import { deleteAccount, providerReady, register, signOutAll, type Provider, type ServerUser } from '../services/cloud/account';
import { backupSet, listSets, restoreSet, type CloudSet } from '../services/cloud/backup';
import { contestPackage, newSubmissionKey, openContests, precheck, status as submissionStatus, submit, type ContestInfo } from '../services/cloud/contest';
import type { HandoffFrames } from '../services/export';
import type { ContestEntry, Project, Store } from '../types';

const C = T;
type Props = {
  visible: boolean; onClose: () => void;
  // 2026-10-08 토스식 개편: 아래 탭 안에 그대로 넣는다(inline). part 로 한 갈래만 — 공모전 탭은 'contest', 내 정보 탭은 'account'.
  inline?: boolean; part?: 'contest' | 'account';
  cloud: Cloud | null; extra: unknown; device: string;
  store: Store; projects: Project[];
  commit: (transform: (s: Store) => Store) => void;
  task: (label: string, work: () => Promise<void>) => Promise<void>;
  login: (provider: Provider) => Promise<void>;
  bakeHandoff: (project: Project) => Promise<{ handoff: HandoffFrames[]; failed: number[] }>;
};
const PROVIDERS: { id: Provider; label: string }[] = [{ id: 'kakao', label: '카카오로 로그인' }, { id: 'naver', label: '네이버로 로그인' }, { id: 'google', label: '구글로 로그인' }];
const when = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const STATUS: Record<string, string> = { uploading: '올리는 중', received: '접수됨', rejected: '접수 안 됨', withdrawn: '철회함', expired: '만료', timeout: '확인 중' };

export function CloudScreen(p: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<ServerUser | null>(null);
  const [cloudSets, setCloudSets] = useState<CloudSet[] | null>(null);
  const [contests, setContests] = useState<ContestInfo[] | null>(null);
  const [picked, setPicked] = useState<ContestInfo | null>(null);
  const [entrySet, setEntrySet] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const live = p.projects.filter(x => !x.deletedAt);

  const refresh = async () => {
    if (!p.cloud) return;
    const id = p.cloud.uid(); setUid(id);
    if (!id) { setUser(null); setCloudSets(null); } else {
      try { const u = await register(p.cloud); setUser(u); setCloudSets(u.pro.active ? await listSets(p.cloud) : null); } catch { setUser(null); }
    }
    try { setContests(await openContests(p.cloud)); } catch { setContests([]); }
  };
  useEffect(() => { if (p.visible) void refresh(); }, [p.visible]);

  const note = (projectId: string, patch: { ok: boolean; files: number; sent: number; error?: string }) =>
    p.commit(s => ({ ...s, cloudBackups: { ...(s.cloudBackups ?? {}), [projectId]: { at: new Date().toISOString(), ...patch } } }));
  const doBackup = (project: Project) => p.task(`클라우드에 백업하는 중 · ${project.projectName}`, async () => {
    try { const r = await backupSet(p.cloud!, project, p.device); note(project.id, { ok: true, files: r.files, sent: r.sent }); setCloudSets(await listSets(p.cloud!)); }
    catch (e) { note(project.id, { ok: false, files: 0, sent: 0, error: String((e as Error).message ?? e).slice(0, 200) }); throw e; }
  });
  const doRestore = (set: CloudSet) => p.task('클라우드에서 되살리는 중…', async () => {
    const r = await restoreSet(p.cloud!, set.id, p.projects);
    p.commit(s => ({ ...s, projects: [...s.projects, r.project] }));
    Alert.alert('되살렸어요', `${r.project.projectName}(그림 ${r.images}개)${r.copy ? ' — 기기에 같은 세트가 있어 사본으로 넣었어요.' : ''}`);
  });
  const entryOf = (contestId: string) => (p.store.contestEntries ?? []).find(e => e.contestId === contestId);
  const saveEntry = (e: ContestEntry) => p.commit(s => ({ ...s, contestEntries: [...(s.contestEntries ?? []).filter(x => x.contestId !== e.contestId), e] }));
  const doSubmit = (c: ContestInfo, project: Project) => p.task('세트 전체를 묶는 중…', async () => {
    const { handoff, failed } = await p.bakeHandoff(project);
    if (failed.length) throw new Error(`${failed.join(', ')}번 칸의 움직임 프레임을 만들지 못했어요. 그 칸을 다시 저장한 뒤 내 주세요.`);
    const pkg = contestPackage(project, handoff);
    const problem = precheck(pkg, c);
    if (problem) throw new Error(problem);
    const old = entryOf(c.id);
    if (old && old.status === 'received') throw new Error(`이미 접수했어요(${old.receiptNo ?? ''}). 다른 세트로 바꾸려면 접수를 철회한 뒤 다시 내 주세요.`);
    // 같은 공모전·같은 세트를 다시 내면 전에 쓴 제출 키를 그대로 — 끊긴 뒤 재시도해도 접수는 한 건이다.
    const key = old && old.projectId === project.id ? old.key : newSubmissionKey();
    saveEntry({ contestId: c.id, projectId: project.id, key, status: 'uploading', at: new Date().toISOString() });
    setProgress(0);
    try {
      const r = await submit(p.cloud!, c, project, pkg, key, f => setProgress(f));
      saveEntry({ contestId: c.id, projectId: project.id, key, status: r.status, receiptNo: r.receiptNo, reason: r.reason, at: new Date().toISOString() });
    } finally { setProgress(null); }
  });

  // 흰 카드 한 장 = 한 구역(토스식). 모달로 열 때는 예전처럼 구분선 목록.
  const section = (title: string, children: React.ReactNode) => <View style={p.inline
    ? { gap: 12, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper }
    : { gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
    <Text style={{ fontSize: p.inline ? 17 : 16, fontWeight: '800', color: C.ink }}>{title}</Text>{children}</View>;
  const show = (part: 'contest' | 'account') => !p.part || p.part === part;
  const muted = (text: string) => <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>{text}</Text>;

  const body = <>
        {!p.cloud ? <View testID="클라우드 준비 중" style={{ gap: 10, paddingVertical: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>준비 중이에요</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{p.part === 'contest' ? '공모전 접수는 서버를 연결한 뒤에 열려요.' : p.part === 'account' ? '로그인과 PRO 클라우드 백업은 서버를 연결한 뒤에 열려요.' : '로그인(카카오·네이버·구글), PRO 클라우드 백업, 공모전 접수는 서버를 연결한 뒤에 열려요.'} 지금은 아무것도 서버로 보내지 않아요.</Text>
          {p.part !== 'contest' && muted('그동안 작품은 이 기기에 저장되고, 아래 전체 백업 만들기로 파일 백업을 앱 밖에 보관할 수 있어요.')}
        </View> : <>
          {show('account') && section('계정', uid ? <>
            {/* 작가명(바꿀 수 없음)이 이름이고, 어느 회사로 로그인했는지는 그 아래 작게. */}
            {!!user?.artistName && <Text testID="내 작가명" style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{user.artistName}</Text>}
            <Text style={{ fontSize: user?.artistName ? 13 : 14, color: user?.artistName ? C.muted : C.ink }}>{`${({ kakao: '카카오', naver: '네이버', google: '구글' } as Record<string, string>)[uid.split(':')[0]] ?? '구글'} 로그인`}</Text>
            {muted(user ? (user.pro.active ? `PRO(${user.pro.source === 'trial' ? '체험' : user.pro.source === 'store' && user.pro.verified ? '구매 확인됨' : '관리자 부여'}) · 클라우드 백업 ${(user.backupBytes / 1048576).toFixed(1)}MB 사용` : '무료 회원 — 개인 클라우드 백업은 PRO 전용이에요. 공모전은 참가할 수 있어요.') : '회원 정보를 불러오는 중…')}
            <Action icon="logout" title="로그아웃" onPress={() => void signOutAll(p.cloud!).then(refresh)} />
            <Action danger icon="account-remove-outline" title="탈퇴(서버 데이터 삭제)" onPress={() => Alert.alert('탈퇴', '서버에 있는 클라우드 백업·회원 정보·공모전 접수가 지워져요. 이 기기 안 작품은 그대로예요.', [
              { text: '취소', style: 'cancel' },
              { text: '탈퇴', style: 'destructive', onPress: () => void p.task('탈퇴하는 중…', async () => { await deleteAccount(p.cloud!); await signOutAll(p.cloud!); await refresh(); }) },
            ])} />
          </> : <>
            {PROVIDERS.map(x => <Action key={x.id} title={providerReady(p.extra, x.id) ? x.label : `${x.label} · 준비 중`} disabled={!providerReady(p.extra, x.id)}
              onPress={() => void p.task('로그인하는 중…', async () => { await p.login(x.id); await refresh(); })} />)}
            {muted('로그인하면 공모전 접수와 PRO 클라우드 백업을 쓸 수 있어요. 기기 안 작품은 로그인과 상관없이 그대로 있어요.')}
          </>)}
          {show('account') && uid && section('클라우드 백업 · PRO', user?.pro.active ? <>
            {live.map(project => { const n = p.store.cloudBackups?.[project.id]; return <View key={project.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{project.projectName}</Text>
                <Text style={{ fontSize: 12, color: n && !n.ok ? C.danger : C.muted }}>{!n ? '아직 백업하지 않았어요' : n.ok ? `마지막 백업 ${when(n.at)} · 보낸 파일 ${n.sent}/${n.files}` : `실패 ${when(n.at)} · ${n.error ?? ''}`}</Text>
              </View>
              <Action compact title="백업" onPress={() => void doBackup(project)} />
            </View>; })}
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 6 }}>클라우드에 있는 세트</Text>
            {(cloudSets ?? []).map(set => <View key={set.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>{`${set.name} · ${when(new Date(set.updatedAt).toISOString())} · ${(set.bytes / 1048576).toFixed(1)}MB`}</Text>
              <Action compact title="되살리기" onPress={() => void doRestore(set)} />
            </View>)}
            {muted('바뀐 그림만 보내요. 되살리면 새 세트로 들어오고, 기기에 같은 세트가 있으면 덮어쓰지 않고 사본으로 넣어요.')}
          </> : muted('PRO 전용이에요. 무료 회원에게는 개인 클라우드 저장 공간을 드리지 않아요.'))}
          {show('contest') && section('공모전', <>
            {(contests ?? []).length === 0 && muted(contests ? '지금 열린 공모전이 없어요.' : '불러오는 중…')}
            {(contests ?? []).map(c => { const e = entryOf(c.id); return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'공모전 ' + c.title} onPress={() => { setPicked(c); setEntrySet(null); setAgree(false); }}
              style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: picked?.id === c.id ? C.accentBorder : C.line, backgroundColor: C.paper, gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{c.title}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{`${c.status === 'open' ? '접수 중' : c.status === 'announced' ? '결과 발표' : '접수 마감'} · ${c.requirements.kind === 'still' ? '멈춰 있는' : '움직이는'} ${c.requirements.cuts}칸 세트${e ? ` · 내 접수: ${STATUS[e.status] ?? e.status}${e.receiptNo ? ' ' + e.receiptNo : ''}` : ''}`}</Text>
            </Pressable>; })}
            {picked && <View testID="공모전 자세히" style={{ gap: 8 }}>
              {!!picked.notice && <Text style={{ fontSize: 13, lineHeight: 20, color: C.ink }}>{picked.notice}</Text>}
              {!!picked.rules && <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>{picked.rules}</Text>}
              {picked.status === 'announced' && (picked.results ?? []).map(r => <Text key={r.receiptNo} style={{ fontSize: 13, color: C.ink }}>{`선정 · ${r.receiptNo} ${r.setName}`}</Text>)}
              {picked.status === 'open' && (!uid ? muted('접수하려면 위에서 로그인해 주세요.') : <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>낼 세트</Text>
                {live.map(project => <Pressable key={project.id} accessibilityRole="radio" accessibilityLabel={'낼 세트 ' + project.projectName} accessibilityState={{ checked: entrySet === project.id }} onPress={() => setEntrySet(project.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <Glyph name={entrySet === project.id ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={C.ink} /><Text style={{ fontSize: 14, color: C.ink }}>{project.projectName}</Text>
                </Pressable>)}
                <Pressable accessibilityRole="checkbox" accessibilityLabel="참가 조건에 동의" accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <Glyph name={agree ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={20} color={C.ink} /><Text style={{ flex: 1, fontSize: 13, color: C.ink }}>위 참가 조건을 읽었고 동의해요(세트 전체가 제출돼요)</Text>
                </Pressable>
                {progress !== null && <Text testID="제출 진행" style={{ fontSize: 13, color: C.ink }}>{`올리는 중 ${Math.round(progress * 100)}%`}</Text>}
                <Action primary title="세트 전체 제출" disabled={!entrySet || !agree || progress !== null} onPress={() => { const project = live.find(x => x.id === entrySet); if (project) void doSubmit(picked, project); }} />
                {(() => { const e = entryOf(picked.id); if (!e) return null; return <Text testID="접수 상태" style={{ fontSize: 13, color: e.status === 'rejected' ? C.danger : C.ink }}>
                  {e.status === 'received' ? `접수됐어요 · 접수번호 ${e.receiptNo}` : e.status === 'timeout' || e.status === 'uploading' ? '서버가 확인하는 중이에요. 잠시 뒤 다시 열어 확인해 주세요.' : e.status === 'rejected' ? `접수되지 않았어요 · ${e.reason ?? ''}` : STATUS[e.status] ?? e.status}
                </Text>; })()}
                {!!entryOf(picked.id) && <Action compact title="접수 상태 다시 보기" onPress={() => void p.task('확인하는 중…', async () => {
                  const e = entryOf(picked.id)!, s = await submissionStatus(p.cloud!, picked.id, uid);
                  if (s) saveEntry({ ...e, status: s.status, receiptNo: s.receiptNo, reason: s.reason, at: new Date().toISOString() });
                })} />}
              </>)}
            </View>}
          </>)}
        </>}
  </>;
  if (p.inline) return <View style={{ gap: 12 }}>{!p.cloud ? <View style={{ padding: 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>{body}</View> : body}</View>;
  return <Modal visible={p.visible} animationType="slide" onRequestClose={p.onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="계정·클라우드 닫기" onPress={p.onClose} style={{ padding: 12 }}><Glyph name="close" size={22} color={C.ink} /></Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>계정 · 클라우드</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>{body}</ScrollView>
    </SafeAreaView>
  </Modal>;
}
