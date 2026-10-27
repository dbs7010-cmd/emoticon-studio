// 공모전·체험단 제출은 앱에서 직접 그린 칸만(2026-10-21 대표 결정).
// ① 캔버스 엔진: '그림 가져오기'로 들인 레이어에 imported 표시가 붙고, 복제·저장·되돌리기에서도 남는다. 직접 그린 새 레이어는 표시가 없다.
// ② 제출 점검: 가져온 그림이 보이는 칸 번호를 찾는다(숨긴 레이어·빈 칸은 묻지 않음, 애니메이션 장도 본다).
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/contest-inapp-test.cjs
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const load = loader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-file-system': { File: class {}, Directory: class {}, Paths: { document: 'document' } } });
const { canvasHtml } = load('src/painter/canvas-html.ts');
const { importedCuts } = load('src/services/cloud/contest.ts');

// ── ② 제출 점검 ──
const L = (id, extra = {}) => ({ id, name: id, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, ...extra });
const img = { path: 'image-1.png', width: 360, height: 360 };
const slot = (work, finalImage = img) => ({ referenceImages: [], status: 'done', finalImage, work: work && { version: 1, activeLayerId: 'a', references: [], ...work } });
const project = { slots: [
  slot({ layers: [L('a')] }),                                                         // 01 직접 그림
  slot({ layers: [L('a'), L('b', { imported: true })] }),                             // 02 가져온 그림 보임 → 걸림
  slot({ layers: [L('a'), L('b', { imported: true, visible: false })] }),             // 03 숨김 → 통과
  slot({ layers: [L('a')], frames: [{ id: 'f1', duration: .5, layers: [L('a')] }, { id: 'f2', duration: .5, layers: [L('c', { imported: true })] }] }), // 04 애니메이션 장 → 걸림
  slot({ layers: [L('b', { imported: true })] }, null),                               // 05 저장 안 된 칸 → 묻지 않음
] };
assert.deepEqual(importedCuts(project), ['02', '04'], '가져온 그림이 보이는 저장된 칸만');
assert.deepEqual(importedCuts({ slots: [slot({ layers: [L('a')] })] }), [], '직접 그린 칸만이면 통과');

// ── ① 캔버스 엔진 ──
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = t => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), t);
    const dot = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#333'; g.fillRect(30, 30, 60, 60); return c.toDataURL('image/png'); });
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '레이어 1' }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(200);
    await cmd({ type: 'importDrawing', data: dot }); await page.waitForTimeout(300);
    let st = await last('state');
    const got = st.layers.find(l => l.id !== 'draw-1');
    assert.equal(got.imported, true, '가져온 레이어에 표시');
    assert.ok(!st.layers.find(l => l.id === 'draw-1').imported, '원래 레이어는 표시 없음');
    await cmd({ type: 'duplicateLayer', id: got.id }); await page.waitForTimeout(200);
    st = await last('state');
    assert.equal(st.layers.filter(l => l.imported).length, 2, '가져온 레이어를 복제해도 표시가 따라간다');
    await cmd({ type: 'addLayer' }); await page.waitForTimeout(100);
    st = await last('state');
    assert.equal(st.layers.filter(l => !l.imported).length, 2, '새로 만든 레이어는 표시 없음');
    await cmd({ type: 'undo' }); await cmd({ type: 'undo' }); await page.waitForTimeout(200);
    st = await last('state');
    assert.equal(st.layers.filter(l => l.imported).length, 1, '되돌려도 남은 가져온 레이어의 표시는 유지');
    await cmd({ type: 'save', token: 't1' }); await page.waitForTimeout(300);
    const saved = await last('save');
    assert.equal(saved.layers.filter(l => l.imported).length, 1, '저장 데이터에 표시가 실린다');
    // 다시 열기: 저장된 표시가 그대로 돌아온다
    await cmd({ type: 'init', layers: saved.layers.map(l => ({ ...l })), activeLayerId: saved.activeLayerId }); await page.waitForTimeout(300);
    st = await last('state');
    assert.equal(st.layers.filter(l => l.imported).length, 1, '다시 열어도 표시 유지');
    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('PASS: contest in-app — imported layers flagged (duplicate · undo · save · reopen), submit check lists only visible imported cuts on saved slots incl. animation frames');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
