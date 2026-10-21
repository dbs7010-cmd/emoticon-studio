// 에뮬레이터용 가짜 비밀값 파일(functions/.secret.local, 커밋 안 함)을 만든다. 실제 값은 Secret Manager 에만 둔다.
const fs = require('node:fs'), path = require('node:path');
const { SECRETS } = require('./mock-providers.cjs');
fs.writeFileSync(path.join(__dirname, '../functions/.secret.local'),
  `KAKAO_CLIENT_SECRET=${SECRETS.kakao}\nNAVER_CLIENT_SECRET=${SECRETS.naver}\nGOOGLE_CLIENT_SECRET=${SECRETS.google}\n`);
