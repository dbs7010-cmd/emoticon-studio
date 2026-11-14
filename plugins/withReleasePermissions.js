const fs = require('fs/promises');
const path = require('path');
const { withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const PERMISSION = 'android.permission.SYSTEM_ALERT_WINDOW';

function removeReleaseOverlay(manifest) {
  manifest.manifest.$ = { ...manifest.manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
  manifest.manifest['uses-permission'] = [
    ...(manifest.manifest['uses-permission'] || []).filter(p => p.$?.['android:name'] !== PERMISSION),
    { $: { 'android:name': PERMISSION, 'tools:node': 'remove' } },
  ];
  return manifest;
}
// A release source-set manifest has higher priority than main and libraries.
// Debug's dev-client overlay permission remains untouched across prebuilds.
module.exports = config => withDangerousMod(config, ['android', async mod => {
  const file = path.join(mod.modRequest.platformProjectRoot, 'app/src/release/AndroidManifest.xml');
  await fs.mkdir(path.dirname(file), { recursive: true });
  let manifest;
  try {
    await fs.access(file);
    manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(file);
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    manifest = { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' } } };
  }
  await AndroidConfig.Manifest.writeAndroidManifestAsync(file, removeReleaseOverlay(manifest));
  return mod;
}]);
module.exports.removeReleaseOverlay = removeReleaseOverlay;
