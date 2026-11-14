// What PRO is allowed to do, and what losing it is not allowed to do.
// No browser and no store here: this is the rule layer, which is where a mistake would quietly
// hand out a paid feature or quietly take someone's work away.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data) { files.set(this.uri, data); }
  textSync() { return files.get(this.uri); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } }, 'react-native': { Platform: { OS: 'android' } }, 'expo-constants': { default: { expoConfig: { extra: {} } } } });
const { createProject, parseStore, usesPro } = load('src/project.ts');
const { loadStore, saveStore } = load('src/services/storage.ts');
const pro = load('src/services/pro.ts');
const adapter = load('src/services/purchase-adapter.ts');

const now = new Date('2026-09-12T00:00:00Z');
const future = new Date('2026-10-12T00:00:00Z').toISOString();
const past = new Date('2026-08-12T00:00:00Z').toISOString();

// ---------- who is PRO ----------
assert.equal(pro.isPro(undefined, now), false, '아무것도 없으면 무료');
assert.equal(pro.isPro({ plan: 'free', source: 'none' }, now), false, '무료 플랜은 무료');
assert.equal(pro.devBuild(), false, '테스트는 출시 빌드와 같은 조건에서 돈다');
assert.equal(pro.isPro({ plan: 'monthly', source: 'store', expiresAt: future }, now), false, '서버가 확인하지 않은 영수증만으로는 출시 빌드에서 PRO가 열리지 않는다');
assert.ok(/영수증 확인 서버/.test(pro.proBlockedReason({ plan: 'monthly', source: 'store', expiresAt: future }) || ''), '왜 막혔는지 사용자에게 말할 수 있다');
assert.equal(pro.isPro({ plan: 'monthly', source: 'store', verified: true, expiresAt: future }, now), true, '서버가 확인한 영수증이면 기간 안에서 PRO');
assert.equal(pro.isPro({ plan: 'monthly', source: 'store', verified: true, expiresAt: past }, now), false, '기간이 지나면 PRO 아님');
assert.equal(pro.isPro({ plan: 'yearly', source: 'store', verified: true }, now), true, '만료일이 없으면 유효한 것으로 본다');
// A file anyone can edit must not be able to claim a purchase that never happened.
assert.equal(pro.isPro({ plan: 'yearly', source: 'none', verified: true, expiresAt: future }, now), false, '출처가 스토어가 아니면 verified를 적어 넣어도 통하지 않는다');
assert.equal(pro.expiredButRemembered({ plan: 'monthly', source: 'store', verified: true, expiresAt: past }, now), true, '만료는 기억된다');
assert.equal(pro.expiredButRemembered({ plan: 'free', source: 'none' }, now), false, '무료는 만료가 아니다');

// ---------- 오프라인 ----------
// Being unable to ask the store is not the same as being told no: a live term stays live.
const offlineTerm = { plan: 'yearly', source: 'store', verified: true, expiresAt: future, checkedAt: past };
assert.equal(pro.isPro(offlineTerm, now), true, '스토어에 못 물어봐도 남은 기간은 유지된다');

// ---------- 구매·복원이 없는 빌드 ----------
assert.equal(adapter.storeModuleAvailable(), false, '이 빌드에는 결제 모듈이 없다');
(async () => {
  const bought = await pro.purchase('monthly');
  assert.equal(bought.state, 'failed', '모듈이 없으면 구매는 성공하지 않는다');
  assert.equal(bought.problem, 'store-missing', '왜 안 되는지 말한다: ' + bought.problem);
  assert.equal(bought.entitlement, undefined, '그리고 이용권을 만들어내지 않는다');
  const restored = await pro.restore();
  assert.equal(restored.state, 'failed', '복원도 마찬가지');
  assert.equal(restored.entitlement, undefined);

  // ---------- 저장과 복원 ----------
  const project = createProject('이용권', '콩이');
  const entitlement = { plan: 'yearly', source: 'store', verified: false, expiresAt: future };
  saveStore({ version: 1, introDone: true, revision: 1, projects: [project], entitlement });
  assert.deepEqual(loadStore().store.entitlement, entitlement, '이용권은 저장되고 그대로 돌아온다');
  assert.throws(() => parseStore(JSON.stringify({ version: 1, revision: 1, projects: [project], entitlement: { plan: 'gold', source: 'store' } })), /이용권/, '모르는 플랜은 거부한다');
  assert.throws(() => parseStore(JSON.stringify({ version: 1, revision: 1, projects: [project], entitlement: { plan: 'yearly', source: 'store', verified: 'yes' } })), /검증 표시/, '검증 표시가 망가지면 거부한다');
  assert.equal(loadStore().store.entitlement.verified, false, '서버가 확인한 적이 없으므로 verified는 false다');

  // ---------- 만료 뒤에도 작품은 그대로 ----------
  const partMotion = { version: 1, speed: .5, strength: .5, parts: [{ id: 'p', layerId: 'draw-1', effect: 'rotate', pivotX: .5, pivotY: .5, amount: 20, angle: 0, speed: .5, delay: 0 }] };
  const freeMotion = { version: 1, preset: 'bounce', speed: .5, strength: .5 };
  assert.equal(usesPro(partMotion), true, '부분 움직임은 PRO다');
  assert.equal(usesPro(freeMotion), false, '전체 움직임은 무료다');
  assert.equal(usesPro(undefined), false);
  assert.equal(usesPro({ version: 1, speed: .5, strength: .5, alternate: { poseB: ['draw-2'], interval: .4 } }), true, '두 모습 교대도 PRO다');

  const expired = { plan: 'monthly', source: 'store', expiresAt: past };
  const saved = { ...project, slots: project.slots.map(s => s.number === 1 ? { ...s, motion: partMotion, done: true } : s) };
  saveStore({ version: 1, introDone: true, revision: 2, projects: [saved], entitlement: expired });
  const reopened = loadStore().store;
  assert.equal(pro.isPro(reopened.entitlement, now), false, '기간이 끝났다');
  assert.deepEqual(reopened.projects[0].slots[0].motion, partMotion, '그래도 저장해 둔 PRO 움직임은 그대로 남아 있다');
  assert.equal(reopened.projects[0].slots[0].done, true, '작품도 그대로다');
  // The gate is about *changing* PRO content, so an unchanged one must not be stopped.
  const unchanged = JSON.stringify(reopened.projects[0].slots[0].motion) === JSON.stringify(partMotion);
  assert.equal(unchanged, true, '같은 설정 그대로면 다시 내보낼 때 막을 이유가 없다');

  // ---------- 영수증 확인 ----------
  // 스토어가 "샀다"고 해도 그것만으로는 PRO 가 아니다. 우리 서버가 스토어에 물어보고 확인해 준
  // 대답만이 이용권을 만든다. 서버가 없거나, 대답이 이상하거나, 테스트 구매면 열리지 않는다.
  const receipt = load('src/services/receipt.ts');
  const ask = { platform: 'android', productId: 'pro_monthly', purchaseToken: 'token-123' };
  const answer = body => async () => ({ ok: true, status: 200, json: async () => body });
  const yes = { verified: true, plan: 'monthly', expiresAt: future };

  let called = 0;
  const counting = async (...args) => { called++; return { ok: true, status: 200, json: async () => yes }; };
  assert.equal((await receipt.verifyReceipt(ask, { fetchImpl: counting })).state, 'not-configured', '서버 주소가 없으면 묻지도 않는다');
  assert.equal(called, 0, '그리고 네트워크를 건드리지 않는다');
  assert.equal((await receipt.verifyReceipt(ask, { endpoint: 'http://plain.example', fetchImpl: counting })).state, 'not-configured', 'https 가 아니면 보내지 않는다');
  assert.equal(called, 0);

  const ok = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer(yes), now });
  assert.equal(ok.state, 'verified', '서버가 확인해 주면 통과한다');
  assert.equal(ok.entitlement.verified, true, '그때만 verified 가 붙는다');
  assert.equal(ok.entitlement.source, 'store');
  assert.equal(pro.isPro(ok.entitlement, now), true, '그리고 그 이용권은 출시 빌드에서도 PRO 다');
  // 2026-10-13: 로그인 증명을 함께 보낸다(서버가 구매를 그 계정에 묶는다). 없으면 머리글도 없다.
  const sent = [];
  const capture = async (url, init) => { sent.push(init.headers); return { ok: true, status: 200, json: async () => yes }; };
  await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: capture, now, authToken: 'id-token-abc' });
  await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: capture, now });
  assert.equal(sent[0].authorization, 'Bearer id-token-abc', '로그인 증명을 Authorization 머리글로 보낸다');
  assert.equal(sent[1].authorization, undefined, '로그인 증명이 없으면 머리글을 지어내지 않는다');

  const no = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer({ verified: false, plan: 'monthly', reason: '스토어가 모르는 구매' }), now });
  assert.equal(no.state, 'refused', '확인해 주지 않으면 거절이다');
  assert.ok(/스토어가 모르는 구매/.test(no.reason), '이유를 그대로 전한다');

  // 테스트 구매(라이선스 테스터)는 **서버가** 받을지 정한다. 앱이 일괄 거절하면 내부 테스트가 막힌다.
  const sandbox = { verified: true, plan: 'monthly', expiresAt: future, sandbox: true };
  const tested = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer(sandbox), now });
  assert.equal(tested.state, 'verified', '서버가 확인해 준 테스트 구매는 앱이 막지 않는다');
  assert.equal(tested.entitlement.test, true, '다만 테스트 구매였다는 표시는 남는다');
  const refusedTest = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer({ verified: false, plan: 'monthly', sandbox: true, reason: '테스트 구매는 이 서버 설정에서 받지 않아요.' }), now });
  assert.equal(refusedTest.state, 'refused', '서버가 거절하면 거절이다');

  // 반쯤 맞는 대답을 믿지 않는다.
  for (const bad of [{}, { verified: true }, { verified: 'yes', plan: 'monthly' }, { verified: true, plan: 'gold' }, { verified: true, plan: 'monthly', expiresAt: '어제' }, { verified: true, plan: 'monthly', sandbox: 'no' }])
    assert.equal((await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer(bad), now })).state, 'refused', '모양이 어긋난 대답은 거절: ' + JSON.stringify(bad));
  assert.equal(receipt.readVerdict({ verified: true, plan: 'monthly' }).plan, 'monthly', '제대로 된 대답은 읽는다');

  // 이미 끝난 기간은 통과하지 않는다.
  assert.equal((await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: answer({ verified: true, plan: 'monthly', expiresAt: past }), now })).state, 'refused', '기간이 지난 구매는 거절');

  // 물어보지 못한 것은 "아니다"가 아니다 — 거절과 구분해서 알린다.
  const down = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: async () => { throw new Error('네트워크 없음'); }, now });
  assert.equal(down.state, 'unreachable', '연결 실패는 거절이 아니라 연결 실패다');
  assert.equal((await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }), now })).state, 'unreachable', '서버 오류도 마찬가지');
  const broken = await receipt.verifyReceipt(ask, { endpoint: 'https://verify.example', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('JSON 아님'); } }), now });
  assert.equal(broken.state, 'refused', '읽을 수 없는 대답은 거절');
  // 어떤 경우에도 거절·실패는 이용권을 만들지 않는다.
  for (const outcome of [no, down, broken]) assert.equal(outcome.entitlement, undefined, '거절과 실패는 이용권을 만들지 않는다');


  // ── 내부 검수 빌드 / 출시 구성 ─────────────────────────────────────────────────────────────
  // 결제 모듈이 없어도 PRO 제작 기능을 손으로 확인할 수 있어야 한다. 그러나 그 길이 출시본에
  // 들어가면 안 된다. 그래서 **빌드 구성**으로 가른다. 두 구성을 각각 불러 확인한다.
  {
    const asBuild = (internalReview) => loader({
      'expo-file-system': { Directory, File, Paths: { document: 'document' } },
      'react-native': { Platform: { OS: 'android' } },
      'expo-constants': { expoConfig: { extra: { internalReview } } },
    })('src/services/pro.ts');

    const review = asBuild(true), release = asBuild(false);

    assert.equal(review.internalReviewBuild(), true, '내부 검수 빌드는 스스로를 그렇게 안다');
    assert.equal(release.internalReviewBuild(), false, '출시 구성은 그렇지 않다');

    // 내부 빌드: 스위치를 켜면 PRO 제작 기능을 쓸 수 있다.
    assert.equal(review.reviewUnlocked({ reviewUnlock: true }), true, '내부 빌드에서 검수용 PRO 가 열린다');
    assert.equal(review.reviewUnlocked({ reviewUnlock: false }), false, '켜지 않으면 열리지 않는다');
    assert.equal(review.reviewUnlocked(undefined), false, '저장소가 없으면 열리지 않는다');

    // 출시 구성: **같은 저장 파일을 그대로 옮겨 와도** 우회가 되지 않는다.
    assert.equal(release.reviewUnlocked({ reviewUnlock: true }), false, '출시 구성에서는 같은 값이 있어도 우회할 수 없다');

    // 그리고 그 표시는 이용권이 아니다 — 이용권 판정은 어느 구성에서도 영수증만 본다.
    const handMade = { plan: 'monthly', source: 'store', verified: false };
    assert.equal(release.isPro(handMade), false, '손으로 쓴 이용권은 출시 구성에서 통하지 않는다');
    assert.equal(release.isPro({ plan: 'free', source: 'none' }), false, '무료는 무료다');
    // 검수용 해제는 Entitlement 를 만들지 않는다. 구매·영수증으로 기록되지 않는다는 뜻이다.
    assert.equal(typeof review.reviewUnlocked, 'function', '검수 해제는 이용권과 다른 함수로 분리돼 있다');
    assert.ok(!('reviewUnlock' in handMade), '이용권 모양 안에 검수 표시가 섞이지 않는다');
    assert.ok(review.REVIEW_BUILD_NOTE.includes('구매가 아니'), '화면에 구매가 아니라고 적는다');
    assert.ok(review.REVIEW_BUILD_NOTE.includes('출시 앱으로 넘어가지 않'), '출시 앱으로 넘어가지 않는다고 적는다');
  }

  console.log('PASS: 서버가 확인한 영수증만 PRO를 만들고(테스트 구매·이상한 대답·연결 실패는 전부 거절), 스토어 영수증만 PRO를 만들고, 손으로 쓴 이용권은 통하지 않으며, 오프라인에서 남은 기간이 유지되고, 모듈 없는 빌드는 구매·복원을 성공으로 처리하지 않으며, 만료 뒤에도 작품과 저장된 PRO 움직임이 남는다. 스토어 연동 자체는 개발 빌드와 상품 등록이 필요해 여기서 검증하지 않는다.');
})().catch(e => { console.error(e); process.exit(1); });
