// 보관 기간(2026-10-08). 값은 설정(환경변수)으로 바꾸고, **정책 확정 전에는 지우지 않는다** — 매일 '지울 대상'만 세어 ops/retention 에 남긴다.
//  RETENTION_PRO_LAPSE_DAYS            PRO(체험 포함)가 끝난 뒤 개인 클라우드 백업을 남겨 두는 날 수(제안 90)
//  RETENTION_CONTEST_NOT_SELECTED_DAYS 결과 발표 뒤 비선정 접수 묶음을 남겨 두는 날 수(제안 90)
//  RETENTION_CONTEST_SELECTED_DAYS     결과 발표 뒤 선정 접수 묶음을 남겨 두는 날 수(제안 365)
//  RETENTION_AUTO_DELETE               'true' 일 때만 실제로 지운다. 기본 false(운영자가 정책을 확정하고 처리방침에 적은 뒤에만 켠다).
// 지울 때도 사용자가 다시 PRO 가 되면(그 사이) 대상에서 빠진다. 공모전은 묶음 파일만 지우고 접수 기록(접수번호·심사 결과)은 남긴다.
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const settings = () => ({
  proLapseDays: num(process.env.RETENTION_PRO_LAPSE_DAYS, 90),
  contestNotSelectedDays: num(process.env.RETENTION_CONTEST_NOT_SELECTED_DAYS, 90),
  contestSelectedDays: num(process.env.RETENTION_CONTEST_SELECTED_DAYS, 365),
  autoDelete: process.env.RETENTION_AUTO_DELETE === 'true',
});
const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : Date.parse(v));

async function scan({ db, now, proActive }) {
  const s = settings(), day = 864e5;
  const backups = [];
  const users = await db.collection('users').where('backupBytes', '>', 0).get();
  for (const u of users.docs) {
    const d = u.data(); if (proActive(d)) continue;
    const ended = d.pro?.endedAt ?? d.pro?.until ?? null;   // 끝난 시각(관리자가 끝냄) 또는 체험 만료 시각
    if (ended == null) continue;                              // PRO 였던 적이 없는데 백업이 있으면(옛 자료) 운영자가 직접 본다
    if (now - ms(ended) >= s.proLapseDays * day) backups.push({ uid: u.id, bytes: Number(d.backupBytes || 0), endedAt: ms(ended) });
  }
  const contests = [];
  const announced = await db.collection('contests').where('status', '==', 'announced').get();
  for (const c of announced.docs) {
    const at = ms(c.data().announcedAt); if (!Number.isFinite(at)) continue;
    const subs = await db.collection(`contests/${c.id}/submissions`).where('status', '==', 'received').get();
    for (const sub of subs.docs) {
      const x = sub.data(); if (x.purgedAt) continue;
      const selected = x.review?.state === 'selected';
      if (now - at >= (selected ? s.contestSelectedDays : s.contestNotSelectedDays) * day) contests.push({ contestId: c.id, uid: sub.id, selected, path: x.path, bytes: Number(x.file?.bytes || 0) });
    }
  }
  return { settings: s, backups, contests };
}

// apply=true 이고 RETENTION_AUTO_DELETE=true 일 때만 지운다. 그 밖에는 세기만.
async function run({ db, bucket, now = Date.now(), apply = false, proActive, FieldValue }) {
  const r = await scan({ db, now, proActive });
  const doDelete = apply && r.settings.autoDelete;
  let deleted = 0;
  if (doDelete) {
    for (const b of r.backups) {
      const fresh = (await db.doc(`users/${b.uid}`).get()).data();
      if (proActive(fresh)) continue;
      await bucket().deleteFiles({ prefix: `backups/${b.uid}/` });
      const sets = await db.collection(`backups/${b.uid}/sets`).get(); for (const d of sets.docs) await d.ref.delete();
      deleted++;
    }
    for (const c of r.contests) {
      await bucket().file(c.path).delete({ ignoreNotFound: true });
      await db.doc(`contests/${c.contestId}/submissions/${c.uid}`).update({ purgedAt: FieldValue.serverTimestamp() });
      deleted++;
    }
  }
  const report = {
    at: now, settings: r.settings, applied: doDelete, deleted,
    backups: { count: r.backups.length, bytes: r.backups.reduce((t, x) => t + x.bytes, 0), sample: r.backups.slice(0, 50).map(x => x.uid) },
    contests: { count: r.contests.length, bytes: r.contests.reduce((t, x) => t + x.bytes, 0), selected: r.contests.filter(x => x.selected).length },
  };
  await db.doc('ops/retention').set(report);
  return report;
}
module.exports = { settings, scan, run };
