const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { compileModsAsync, AndroidConfig } = require('expo/config-plugins');
const rc = require('./release-check.cjs');
const plugin = require('../plugins/withReleasePermissions');
const values = require('../release/config-values.cjs');
const statuses = rows => Object.fromEntries(rows.map(r => [r.id, r.status]));
(async () => {
  const good = { extra: { privacyPolicyUrl: 'https://privacy.example/policy', supportEmail: 'support@example.com' } };
  for (const [value, ok] of [['https://privacy.example/p', true], ['http://privacy.example', false], ['https://', false], ['https://a b', false], ['https://user:pass@host', false], [undefined, false]]) assert.equal(values.httpsUrl(value), ok);
  for (const [value, ok] of [['support@example.com', true], ['a+support@example.co.kr', true], ['a@', false], ['a@b', false], ['a@example.com\nBcc:x@y.z', false], [undefined, false]]) assert.equal(values.email(value), ok);
  for (const purchases of [undefined, 'closed']) {
    for (const extra of [{}, { privacyPolicyUrl: 'http://invalid', supportEmail: 'bad' }]) {
      const config = { extra: { ...extra, purchases } };
      const result = rc.checkConfig(config);
      assert.equal(statuses(result).privacy_url, 'FAIL'); assert.equal(statuses(result).support_email, 'FAIL');
      assert.ok(result.find(r => r.id === 'privacy_url').owner);
      const artifact = statuses(rc.checkArtifact({ appConfig: config }));
      assert.equal(artifact.bundle_privacy_url, 'FAIL'); assert.equal(artifact.bundle_support_email, 'FAIL');
    }
  }
  assert.equal(statuses(rc.checkConfig(good)).privacy_url, 'PASS');
  assert.equal(statuses(rc.checkConfig(good)).support_email, 'PASS');
  assert.equal(statuses(rc.checkArtifact({ appConfig: good })).bundle_privacy_url, 'PASS');
  assert.equal(statuses(rc.checkArtifact({ appConfig: good })).bundle_support_email, 'PASS');
  const configPath = require.resolve('../app.config.js');
  const names = ['EMOTICON_PRIVACY_URL', 'EMOTICON_SUPPORT_EMAIL'];
  const old = names.map(n => process.env[n]);
  try {
    process.env.EMOTICON_PRIVACY_URL = 'http://invalid'; process.env.EMOTICON_SUPPORT_EMAIL = 'bad';
    delete require.cache[configPath]; let cfg = require(configPath)();
    assert.equal(cfg.extra.privacyPolicyUrl, undefined); assert.equal(cfg.extra.supportEmail, undefined);
    process.env.EMOTICON_PRIVACY_URL = good.extra.privacyPolicyUrl; process.env.EMOTICON_SUPPORT_EMAIL = good.extra.supportEmail;
    cfg = require(configPath)(); assert.equal(cfg.extra.privacyPolicyUrl, good.extra.privacyPolicyUrl); assert.equal(cfg.extra.supportEmail, good.extra.supportEmail);
  } finally { names.forEach((n, i) => old[i] === undefined ? delete process.env[n] : process.env[n] = old[i]); delete require.cache[configPath]; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-permissions-'));
  try {
    const release = path.join(tmp, 'android/app/src/release/AndroidManifest.xml');
    const debug = path.join(tmp, 'android/app/src/debug/AndroidManifest.xml');
    fs.mkdirSync(path.dirname(debug), { recursive: true });
    const debugXml = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/></manifest>';
    fs.writeFileSync(debug, debugXml);
    const apply = () => compileModsAsync(plugin({ name: 'test', slug: 'test' }), { projectRoot: tmp, platforms: ['android'] });
    await apply(); const once = fs.readFileSync(release, 'utf8'); await apply();
    assert.equal(fs.readFileSync(release, 'utf8'), once, 'prebuild repeats safely');
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(release);
    assert.equal(manifest.manifest['uses-permission'][0].$['tools:node'], 'remove');
    assert.equal(fs.readFileSync(debug, 'utf8'), debugXml, 'debug dev menu permission preserved');
    const permission = Buffer.from('android.permission.SYSTEM_ALERT_WINDOW');
    assert.equal(statuses(rc.checkArtifact({ manifest: permission })).no_overlay_permission, 'FAIL');
    assert.equal(statuses(rc.checkArtifact({ manifest: Buffer.from('com.android.vending.BILLING') })).no_overlay_permission, 'PASS');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log('PASS: C2/C4 config — contact validation/config/artifact owner gates, idempotent release-only overlay removal');
})().catch(e => { console.error(e); process.exitCode = 1; });
