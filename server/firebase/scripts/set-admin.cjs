// 관리자 권한 부여(운영자가 직접 1회 실행). 서비스 계정 키는 저장소에 두지 않는다 —
// `gcloud auth application-default login` 으로 운영자 본인 권한을 쓰거나, 키 파일 경로를 GOOGLE_APPLICATION_CREDENTIALS 로 준다.
// 사용: node scripts/set-admin.cjs <프로젝트 ID> <관리자 uid> [--remove]
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const [projectId, uid] = process.argv.slice(2);
if (!projectId || !uid) { console.error('사용: node scripts/set-admin.cjs <프로젝트 ID> <uid> [--remove]'); process.exit(1); }
initializeApp({ projectId });
getAuth().setCustomUserClaims(uid, process.argv.includes('--remove') ? {} : { admin: true })
  .then(() => console.log(process.argv.includes('--remove') ? '관리자 권한을 뺐어요.' : '관리자 권한을 줬어요. 관리자 페이지에서 다시 로그인하세요.'))
  .catch(e => { console.error(e.message); process.exit(1); });
