const fs = require('fs/promises');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

// Android 자동 백업(Google 계정)에서 **내보낸 사본 폴더만** 뺀다(2026-10-06).
// 앱 데이터 폴더(Paths.document = filesDir)의 emoticon-studio/exports/ 에는 이미 사용자가 고른 앱으로 보낸 사본(제출 묶음·백업 ZIP·
// 한 칸 공유)이 쌓인다. 자동 백업은 앱당 25MB 를 넘으면 그 앱 백업 전체를 건너뛰므로, 사본이 쌓이면 작품 원본까지 백업되지 않는다.
// 원본(그림·저장본)은 그대로 백업된다 — exclude 만 쓰고 include 는 쓰지 않는다(include 를 쓰면 적힌 것만 백업된다).
// 기기 간 직접 옮기기(device-transfer)는 용량 한도가 없어 손대지 않는다.
const EXPORTS = 'emoticon-studio/exports/';
const FULL_BACKUP = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 11 이하 자동 백업 규칙. plugins/withBackupRules.js 가 만든다. -->
<full-backup-content>
    <exclude domain="file" path="${EXPORTS}" />
</full-backup-content>
`;
const EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 이상 클라우드 백업 규칙. plugins/withBackupRules.js 가 만든다. -->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="file" path="${EXPORTS}" />
    </cloud-backup>
</data-extraction-rules>
`;

function applyBackupRules(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.$ = { ...app.$, 'android:allowBackup': 'true', 'android:fullBackupContent': '@xml/emoti_backup_rules', 'android:dataExtractionRules': '@xml/emoti_data_extraction_rules' };
  return manifest;
}

module.exports = config => {
  config = withAndroidManifest(config, mod => { mod.modResults = applyBackupRules(mod.modResults); return mod; });
  return withDangerousMod(config, ['android', async mod => {
    const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'emoti_backup_rules.xml'), FULL_BACKUP);
    await fs.writeFile(path.join(dir, 'emoti_data_extraction_rules.xml'), EXTRACTION);
    return mod;
  }]);
};
module.exports.applyBackupRules = applyBackupRules;
module.exports.FULL_BACKUP = FULL_BACKUP;
module.exports.EXTRACTION = EXTRACTION;
module.exports.EXPORTS = EXPORTS;
