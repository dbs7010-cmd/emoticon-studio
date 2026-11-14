// vc4 서버 월 비용 **예상**(2026-10-10). 가정을 바꾸면 다시 돌린다 — 확정 비용·상한이 아니다.
// 단가: Cloud Storage Standard us-central1 · Firestore us-central1 · 인터넷 송신(아시아) — 2026-10-07 공식 가격 페이지 확인값.
// 무료 한도: Cloud Storage Always Free(미국 리전만) 5 GB-월 · Class A 5,000 · Class B 50,000 · 북미발 송신 100 GB/월, Firestore 하루 읽기 5만·쓰기 2만.
const FX = 1338.92;                          // 원/달러, exchangerate-api 2026-10-07 00:02 UTC
const P = { gbMonth: 0.020, egressGB: 0.12, classA: 0.005 / 1000, classB: 0.0004 / 1000, fsRead: 0.03 / 100000, fsWrite: 0.09 / 100000 };
const FREE = { gb: 5, egressGB: 100, classA: 5000, classB: 50000, fsRead: 50000 * 30, fsWrite: 20000 * 30 };
const MB = 1 / 1024;
// 가정(측정값 기반): 편집 원본 정지 32칸 1.2 MB · 움직임 24칸 4.7 MB(실측), 제출 묶음 정지 0.63 MB · 움직임 11.5 MB(실측)
const A = {
  backupPerUserMB: 7.1,     // PRO 1명이 클라우드에 둔 세트: 정지 2 + 움직임 1 = 1.2×2 + 4.7
  lapsedShare: 0.3,         // PRO 가 끝났지만 보관 기간(90일) 안이라 남아 있는 사람 비율(활성 대비)
  restoresPerMonth: 0.2,    // 1명당 한 달 전체 복원 횟수(5달에 한 번 — 기기 변경·재설치)
  changedFilesPerMonth: 30, // 1명당 한 달에 새로 올라가는 파일 수(바뀐 칸만)
  backupsPerMonth: 4,       // 1명당 한 달 백업 실행 횟수(실행마다 파일 존재 확인)
  filesPerUser: 100,        // 1명의 클라우드 파일 수(완성 + 레이어)
  submissionMB: 0.7 * 0.63 + 0.3 * 11.5,   // 공모전 접수 1건 평균(정지 70% · 움직임 30%) = 3.9 MB
  contestHeldMonths: 3,     // 결과 발표 뒤 비선정 90일 보관 → 대략 석 달치가 쌓여 있다
  adminDownloadsPerSubmission: 1.2,        // 심사 때 1번 + 선정작 일부 다시
};
function month(pro, subs, heavy = 1) {
  const backupGB = pro * A.backupPerUserMB * heavy * (1 + A.lapsedShare) * MB;
  const contestGB = subs * A.submissionMB * heavy * A.contestHeldMonths * MB;
  const gb = backupGB + contestGB;
  const egress = (pro * A.restoresPerMonth * A.backupPerUserMB * heavy + subs * A.submissionMB * heavy * A.adminDownloadsPerSubmission) * MB;
  const classA = pro * A.changedFilesPerMonth + subs * 2;
  const classB = pro * (A.backupsPerMonth * A.filesPerUser + A.restoresPerMonth * A.filesPerUser) + subs * 3;
  const reads = pro * 300 + subs * 50, writes = pro * 40 + subs * 10;
  const usd = {
    저장: Math.max(0, gb - FREE.gb) * P.gbMonth,
    송신: Math.max(0, egress - FREE.egressGB) * P.egressGB,
    작업: Math.max(0, classA - FREE.classA) * P.classA + Math.max(0, classB - FREE.classB) * P.classB,
    DB: Math.max(0, reads - FREE.fsRead) * P.fsRead + Math.max(0, writes - FREE.fsWrite) * P.fsWrite,
  };
  const total = Object.values(usd).reduce((a, b) => a + b, 0);
  return { gb: +gb.toFixed(1), egressGB: +egress.toFixed(1), krw: Object.fromEntries(Object.entries(usd).map(([k, v]) => [k, Math.round(v * FX)])), totalKRW: Math.round(total * FX) };
}
const rows = [];
for (const n of [100, 1000, 10000]) for (const heavy of [1, 4]) rows.push({ 시나리오: `PRO ${n.toLocaleString()}명 + 공모전 ${n.toLocaleString()}건${heavy > 1 ? ' (그림 4배 무거움)' : ''}`, ...month(n, n, heavy) });
if (require.main === module) { console.log(JSON.stringify({ assumptions: A, unitUSD: P, free: FREE, fx: FX, rows }, null, 2)); }
module.exports = { month, A, P, FREE, FX };
