import { t } from '../i18n/index';
// 계정 · 클라우드 백업 · 공모전(vc4, 2026-10-07). 2026-10-08부터 아래 탭(공모전 · 내 정보) 안에 그대로 들어간다(inline).
// 서버 설정이 없는 빌드(cloud=null)에서는 '준비 중'만 보이고 아무 요청도 보내지 않는다 — 제출·백업이 된 것처럼 표시하지 않는다.
// 로그인 버튼은 그 회사 로그인 SDK·키가 들어간 빌드에서만 눌린다(providerReady). 클라우드 백업은 **서버가 기록한** PRO 만 쓴다.
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Action, Clay, Glyph, T } from './app-ui';
import { ImtiIcon, IconSize } from '../design/icons';
import type { Cloud } from '../services/cloud/firebase';
import { deleteAccount, providerReady, register, signOutAll, type Provider, type ServerUser } from '../services/cloud/account';
import { backupSet, listSets, restoreSet, type CloudSet } from '../services/cloud/backup';
import { contestPackage, newSubmissionKey, openContests, importedCuts, precheck, status as submissionStatus, submit, type ContestInfo } from '../services/cloud/contest';
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
const PROVIDERS: { id: Provider; label: string }[] = [{ id: 'kakao', label: t("ui.loginKakao") }, { id: 'naver', label: t("ui.loginNaver") }, { id: 'google', label: t("release.s0370") }];
const when = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return t("release.d085", { v0: (d.getMonth() + 1), v1: (d.getDate()), v2: (String(d.getHours()).padStart(2, '0')), v3: (String(d.getMinutes()).padStart(2, '0')) }); };
const STATUS: Record<string, string> = { uploading: t("release.s0371"), received: t("release.s0372"), rejected: t("release.s0373"), withdrawn: t("release.s0374"), expired: t("release.s0375"), timeout: t("release.s0376") };

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
  const doBackup = (project: Project) => p.task(t("release.d086", { v0: (project.projectName) }), async () => {
    try { const r = await backupSet(p.cloud!, project, p.device); note(project.id, { ok: true, files: r.files, sent: r.sent }); setCloudSets(await listSets(p.cloud!)); }
    catch (e) { note(project.id, { ok: false, files: 0, sent: 0, error: String((e as Error).message ?? e).slice(0, 200) }); throw e; }
  });
  const doRestore = (set: CloudSet) => p.task(t("release.s0377"), async () => {
    const r = await restoreSet(p.cloud!, set.id, p.projects);
    p.commit(s => ({ ...s, projects: [...s.projects, r.project] }));
    Alert.alert(t("release.s0378"), t("release.d087", { v0: (r.project.projectName), v1: (r.images), v2: (r.copy ? " " + t("release.x035") : '') }));
  });
  const entryOf = (contestId: string) => (p.store.contestEntries ?? []).find(e => e.contestId === contestId);
  const saveEntry = (e: ContestEntry) => p.commit(s => ({ ...s, contestEntries: [...(s.contestEntries ?? []).filter(x => x.contestId !== e.contestId), e] }));
  const doSubmit = (c: ContestInfo, project: Project) => p.task(t("release.s0379"), async () => {
    const outside = importedCuts(project);
    if (outside.length) throw new Error(t("release.d088", { v0: (outside.join(', ')) }));
    const { handoff, failed } = await p.bakeHandoff(project);
    if (failed.length) throw new Error(t("release.d089", { v0: (failed.join(', ')) }));
    const pkg = contestPackage(project, handoff);
    const problem = precheck(pkg, c);
    if (problem) throw new Error(problem);
    const old = entryOf(c.id);
    if (old && old.status === 'received') throw new Error(t("release.d090", { v0: (old.receiptNo ?? '') }));
    // 같은 공모전·같은 세트를 다시 내면 전에 쓴 제출 키를 그대로 — 끊긴 뒤 재시도해도 접수는 한 건이다.
    const key = old && old.projectId === project.id ? old.key : newSubmissionKey();
    saveEntry({ contestId: c.id, projectId: project.id, key, status: 'uploading', at: new Date().toISOString() });
    setProgress(0);
    try {
      const r = await submit(p.cloud!, c, project, pkg, key, f => setProgress(f));
      saveEntry({ contestId: c.id, projectId: project.id, key, status: r.status, receiptNo: r.receiptNo, reason: r.reason, at: new Date().toISOString() });
    } finally { setProgress(null); }
  });

  // 흰 클레이 카드 한 장 = 한 구역(2026-10-14 시안 Z). 모달로 열 때는 예전처럼 구분선 목록.
  const section = (title: string, children: React.ReactNode) => <View style={p.inline
    ? { gap: 12, padding: 20, borderRadius: C.radius.card, ...Clay.card }
    : { gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
    <Text style={{ fontSize: p.inline ? 17 : 16, fontWeight: '800', color: C.ink }}>{title}</Text>{children}</View>;
  const show = (part: 'contest' | 'account') => !p.part || p.part === part;
  const muted = (text: string) => <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>{text}</Text>;

  const body = <>
        {!p.cloud ? <View testID="클라우드 준비 중" style={{ gap: 10, paddingVertical: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{t('ui.preparing')}</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: C.ink }}>{p.part === 'contest' ? t("release.s0381") : p.part === 'account' ? t("release.s0382") : t("release.s0383")} {t("release.s0384")}</Text>
          {p.part !== 'contest' && muted(t("release.s0385"))}
        </View> : <>
          {show('account') && section(t('ui.account'), uid ? <>
            {/* 작가명(바꿀 수 없음)이 이름이고, 어느 회사로 로그인했는지는 그 아래 작게. */}
            {/* 시안 Z-My: 노란 얼굴 칸 · 작가명 · 로그인 회사 · PRO 알약(보라). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: C.radius.card, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><ImtiIcon name="person" size={IconSize.tab} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {!!user?.artistName && <Text testID="내 작가명" numberOfLines={1} style={{ fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{user.artistName}</Text>}
                <Text style={{ fontSize: user?.artistName ? 13 : 14, color: user?.artistName ? C.muted : C.ink }}>{t("release.d091", { v0: (({ kakao: t("release.x038"), naver: t("release.x039"), google: t("release.x040") } as Record<string, string>)[uid.split(':')[0]] ?? t("release.x040")) })}</Text>
              </View>
              {!!user?.pro.active && <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.pointSoft, justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.pointInk }}>{user.pro.source === 'trial' ? t('ui.proTrial') : 'PRO'}</Text>
              </View>}
            </View>
            {muted(user ? (user.pro.active ? t("release.d092", { v0: (user.pro.source === 'trial' ? t("release.x041") : user.pro.source === 'store' && user.pro.verified ? t("release.x042") : t("release.x043")), v1: ((user.backupBytes / 1048576).toFixed(1)) }) : t("release.s0387")) : t("release.s0388"))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Action compact icon="logout" title={t('ui.logout')} onPress={() => void signOutAll(p.cloud!).then(refresh)} /></View>
            <View style={{ flex: 1 }}><Action compact danger icon="account-remove-outline" title={t('ui.deleteAccount')} onPress={() => Alert.alert(t("ui.deletingAccount"), t("release.s0389"), [
              { text: t("ui.cancel"), style: 'cancel' },
              { text: t("ui.deletingAccount"), style: 'destructive', onPress: () => void p.task(t("release.s0390"), async () => { await deleteAccount(p.cloud!); await signOutAll(p.cloud!); await refresh(); }) },
            ])} /></View>
            </View>
          </> : <>
            {PROVIDERS.map(x => <Action key={x.id} title={providerReady(p.extra, x.id) ? x.label : t("release.d093", { v0: (x.label) })} disabled={!providerReady(p.extra, x.id)}
              onPress={() => void p.task(t("release.s0391"), async () => { await p.login(x.id); await refresh(); })} />)}
            {muted(t("release.s0392"))}
          </>)}
          {show('account') && uid && section(t('ui.backupCloud'), user?.pro.active ? <>
            {live.map(project => { const n = p.store.cloudBackups?.[project.id]; return <View key={project.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{project.projectName}</Text>
                <Text style={{ fontSize: 12, color: n && !n.ok ? C.danger : C.muted }}>{!n ? t("release.s0393") : n.ok ? t("release.d094", { v0: (when(n.at)), v1: (n.sent), v2: (n.files) }) : t("release.d095", { v0: (when(n.at)), v1: (n.error ?? '') })}</Text>
              </View>
              <Action compact title={t('ui.backup')} onPress={() => void doBackup(project)} />
            </View>; })}
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 6 }}>{t('ui.cloudSets')}</Text>
            {(cloudSets ?? []).map(set => <View key={set.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>{`${set.name} · ${when(new Date(set.updatedAt).toISOString())} · ${(set.bytes / 1048576).toFixed(1)}MB`}</Text>
              <Action compact title={t('ui.restoreShort')} onPress={() => void doRestore(set)} />
            </View>)}
            {muted(t("release.s0394"))}
          </> : muted(t("release.s0395")))}
          {show('contest') && section(t('ui.contest'), <>
            {(contests ?? []).length === 0 && muted(contests ? t('ui.contestEmpty') : t('ui.loading'))}
            {(contests ?? []).map(c => { const e = entryOf(c.id); return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={t('ui.contest') + ' ' + c.title} onPress={() => { setPicked(c); setEntrySet(null); setAgree(false); }}
              style={({ pressed }) => ({ padding: 14, borderRadius: 20, backgroundColor: picked?.id === c.id ? C.pointSoft : C.fill, borderWidth: picked?.id === c.id ? 2 : 0, borderColor: C.point, gap: 4, transform: pressed ? [{ scale: .98 }] : [] })}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.pointInk }}>{c.status === 'open' ? t('ui.receiving') : c.status === 'announced' ? t('ui.results') : t('ui.closed')}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{c.title}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{t("release.d096", { v0: (c.status === 'open' ? t('ui.receiving') : c.status === 'announced' ? t('ui.results') : t('ui.closed')), v1: (c.requirements.kind === 'still' ? t("release.x044") : t("home.kindMoving")), v2: (c.requirements.cuts), v3: (e ? t("release.d158", { v0: (STATUS[e.status] ?? e.status), v1: (e.receiptNo ? ' ' + e.receiptNo : '') }) : '') })}</Text>
            </Pressable>; })}
            {picked && <View testID="공모전 자세히" style={{ gap: 8 }}>
              {!!picked.notice && <Text style={{ fontSize: 13, lineHeight: 20, color: C.ink }}>{picked.notice}</Text>}
              {!!picked.rules && <Text style={{ fontSize: 12, lineHeight: 18, color: C.muted }}>{picked.rules}</Text>}
              {picked.status === 'announced' && (picked.results ?? []).map(r => <Text key={r.receiptNo} style={{ fontSize: 13, color: C.ink }}>{t("release.d097", { v0: (r.receiptNo), v1: (r.setName) })}</Text>)}
              {picked.status === 'open' && (!uid ? muted(t("release.s0397")) : <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{t('ui.entrySet')}</Text>
                {live.map(project => <Pressable key={project.id} accessibilityRole="radio" accessibilityLabel={t('ui.entrySet') + ' ' + project.projectName} accessibilityState={{ checked: entrySet === project.id }} onPress={() => setEntrySet(project.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <Glyph name={entrySet === project.id ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={entrySet === project.id ? C.point : C.muted} /><Text style={{ fontSize: 14, color: C.ink }}>{project.projectName}</Text>
                </Pressable>)}
                <Pressable accessibilityRole="checkbox" accessibilityLabel={t('ui.agreeEntry')} accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <Glyph name={agree ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={20} color={agree ? C.point : C.muted} /><Text style={{ flex: 1, fontSize: 13, color: C.ink }}>{t('ui.submitAgree')}</Text>
                </Pressable>
                {progress !== null && <Text testID="제출 진행" style={{ fontSize: 13, color: C.ink }}>{t("release.d098", { v0: (Math.round(progress * 100)) })}</Text>}
                <Action primary title={t('ui.submitSet')} disabled={!entrySet || !agree || progress !== null} onPress={() => { const project = live.find(x => x.id === entrySet); if (project) void doSubmit(picked, project); }} />
                {(() => { const e = entryOf(picked.id); if (!e) return null; return <Text testID="접수 상태" style={{ fontSize: 13, color: e.status === 'rejected' ? C.danger : C.ink }}>
                  {e.status === 'received' ? t("release.d099", { v0: (e.receiptNo ?? String(e.receiptNo)) }) : e.status === 'timeout' || e.status === 'uploading' ? t("release.s0400") : e.status === 'rejected' ? t("release.d100", { v0: (e.reason ?? '') }) : STATUS[e.status] ?? e.status}
                </Text>; })()}
                {!!entryOf(picked.id) && <Action compact title={t('ui.submissionStatus')} onPress={() => void p.task(t("artist.checking"), async () => {
                  const e = entryOf(picked.id)!, s = await submissionStatus(p.cloud!, picked.id, uid);
                  if (s) saveEntry({ ...e, status: s.status, receiptNo: s.receiptNo, reason: s.reason, at: new Date().toISOString() });
                })} />}
              </>)}
            </View>}
          </>)}
        </>}
  </>;
  if (p.inline) return <View style={{ gap: 12 }}>{!p.cloud ? <View style={{ padding: 20, borderRadius: C.radius.card, ...Clay.card }}>{body}</View> : body}</View>;
  // iOS: 모달 안에는 SafeAreaProvider 를 따로 둔다(바깥과 이어지지 않아 위 여백이 0, 10-29).
  return <Modal visible={p.visible} animationType="slide" onRequestClose={p.onClose}><SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("release.s0401")} onPress={p.onClose} style={{ padding: 12 }}><Glyph name="close" size={22} color={C.ink} /></Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{t("release.s0402")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>{body}</ScrollView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}
