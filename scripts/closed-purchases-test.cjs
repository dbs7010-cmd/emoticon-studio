const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const rc = require('./release-check.cjs');
const status = rows => Object.fromEntries(rows.map(r => [r.id, r.status]));

(async () => {
  const constants = { expoConfig: { extra: { purchases: 'closed', internalReview: false } } };
  const load = loader({ 'expo-constants': { __esModule: true, default: constants }, 'react-native': { Platform: { OS: 'android' } } });
  const pro = load('src/services/pro.ts'), adapter = load('src/services/purchase-adapter.ts');
  let calls = 0;
  adapter.useStoreModuleForTests(Object.fromEntries(['initConnection', 'fetchProducts', 'requestPurchase', 'getAvailablePurchases', 'finishTransaction', 'purchaseUpdatedListener', 'purchaseErrorListener'].map(k => [k, () => { calls++; throw Error('Store must not be called'); }])));
  const opts = { endpoint: 'https://verify.example', fetchImpl: async () => { calls++; throw Error('Server must not be called'); } };
  assert.equal((await pro.purchase(opts)).problem, 'purchases-closed');
  assert.equal((await pro.restore(opts)).problem, 'purchases-closed');
  assert.equal((await pro.storePrices()).problem, 'purchases-closed');
  assert.equal((await pro.refreshEntitlement({ plan: 'lifetime', source: 'store', verified: true }, opts)).state, 'unchanged');
  assert.equal((await adapter.buy()).problem, 'purchases-closed');
  assert.equal((await adapter.ownedPurchase()).problem, 'purchases-closed');
  assert.equal((await adapter.listProducts()).problem, 'purchases-closed');
  assert.equal(await adapter.finishPurchase({ productId: 'pro_lifetime' }), false);
  assert.equal(adapter.storeModuleAvailable(), false);
  assert.equal(calls, 0, 'all public entry points: no native store or receipt requests');
  global.__DEV__ = true;
  constants.expoConfig.extra.internalReview = true;
  assert.equal(pro.reviewUnlocked({ reviewUnlock: true }), false, 'closed test cannot use review PRO even with stale review flags');
  global.__DEV__ = false;
  constants.expoConfig.extra.internalReview = false;
  for (const mode of [undefined, '', 'close', false]) {
    constants.expoConfig.extra.purchases = mode;
    assert.equal(pro.purchasesClosed(), false, 'only exact explicit closed selects test mode');
    assert.equal(pro.reviewUnlocked({ reviewUnlock: true }), false);
  }
  const cfg = { extra: { internalReview: false, purchases: 'closed' } };
  assert.equal(status(rc.checkConfig(cfg)).receipt_endpoint, 'WARN');
  for (const mode of [undefined, '', 'close', false]) {
    assert.equal(status(rc.checkConfig({ extra: { purchases: mode } })).receipt_endpoint, 'FAIL');
  }
  assert.equal(status(rc.checkConfig({ extra: { purchases: 'closed', receiptEndpoint: 'http://invalid' } })).receipt_endpoint, 'FAIL');
  assert.equal(status(rc.checkConfig({ extra: { purchases: 'closed', internalReview: true } })).internal_review_off, 'FAIL');
  const info = { appConfig: cfg };
  const artifact = status(rc.checkArtifact(info, cfg));
  assert.equal(artifact.bundle_purchases, 'PASS');
  assert.equal(artifact.bundle_receipt_endpoint, 'WARN');
  assert.equal(artifact.billing_permission, 'FAIL');
  assert.equal(artifact.release_js_bundle, 'FAIL');
  assert.equal(status(rc.checkArtifact(info, { extra: {} })).bundle_purchases_match, 'FAIL');
  assert.equal(status(rc.checkArtifact({ appConfig: { extra: {} } })).bundle_receipt_endpoint, 'FAIL');
  assert.equal(status(rc.checkArtifact({ appConfig: null })).bundle_purchases, 'FAIL');
  const unsigned = rc.checkCertificate([], { debug: 'unused', dryRun: [] });
  assert.equal(unsigned[0].status, 'FAIL');
  assert.equal(rc.summarize([...rc.checkConfig(cfg), ...unsigned]).exitCode, 1);
  const saved = { purchases: process.env.EMOTICON_PURCHASES, review: process.env.EMOTICON_INTERNAL_REVIEW };
  const configPath = require.resolve('../app.config.js');
  function config(mode, review) {
    if (mode === undefined) delete process.env.EMOTICON_PURCHASES; else process.env.EMOTICON_PURCHASES = mode;
    if (review === undefined) delete process.env.EMOTICON_INTERNAL_REVIEW; else process.env.EMOTICON_INTERNAL_REVIEW = review;
    delete require.cache[configPath]; return require(configPath)();
  }
  try {
    assert.equal(config(undefined).extra.purchases, undefined);
    assert.equal(config('closed').extra.purchases, 'closed');
    assert.equal(config('closed').extra.internalReview, false);
    for (const mode of ['', 'close', 'false']) assert.throws(() => config(mode), /must be closed or unset/);
    assert.throws(() => config('closed', '1'), /cannot enable internalReview/);
  } finally {
    config(saved.purchases, saved.review);
  }
  console.log('PASS: closed purchases — zero store/server calls, explicit opt-in, no review bypass, server-only exception, signing/BILLING guards retained');
})().catch(e => { console.error(e); process.exitCode = 1; });
