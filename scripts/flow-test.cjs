// The product flow, run for real: a real browser draws on the real canvas engine, the real
// services write real PNGs to a real directory, and the exported archive is opened again by a
// tool that is not ours. Screens are captured as evidence under verification/flow/.
// Scope: engine + services + files. React Native screens and Android delivery are NOT covered.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

const out = path.resolve('verification/flow');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const documents = path.join(out, 'documents');
fs.mkdirSync(documents, { recursive: true });

// expo-file-system, backed by the actual disk instead of a Map.
const real = uri => path.join(documents, uri.replace(/^document\/?/, ''));
class Directory {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  create() { fs.mkdirSync(real(this.uri), { recursive: true }); }
}
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return fs.existsSync(real(this.uri)); }
  write(data, options) {
    fs.mkdirSync(path.dirname(real(this.uri)), { recursive: true });
    fs.writeFileSync(real(this.uri), options?.encoding === 'base64' ? Buffer.from(data, 'base64') : Buffer.isBuffer(data) || data instanceof Uint8Array ? Buffer.from(data) : data);
  }
  textSync() { return fs.readFileSync(real(this.uri), 'utf8'); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(fs.readFileSync(real(this.uri))); }
  async base64() { return fs.readFileSync(real(this.uri)).toString('base64'); }
  delete() { fs.unlinkSync(real(this.uri)); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } }, 'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-constants': { __esModule: true, default: { expoConfig: { extra: {} } } }, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } } });
const { canvasHtml } = load('src/painter/canvas-html.ts');
const { createProject, isDone, doneCount, nextUnfinished, previousDrawn } = load('src/project.ts');
const { loadStore, saveStore, localFile } = load('src/services/storage.ts');
const { savePainterWork, saveMotionLoop, dataUrl } = load('src/services/images.ts');
const { inspectImage } = load('src/services/qa.ts');
const { exportSet, readZipNames, decodeDataUrl } = load('src/services/export.ts');
const SPEC = load('src/constants/kakao-spec.ts').KAKAO_STATIC_SPEC;

const step = [];
const say = (text) => { step.push(text); console.log('  ' + text); };

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: flow test timed out'); process.exit(1); }, 180000);
  watchdog.unref();
  const server = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    page.on('pageerror', e => { errors.push(e.message); });
    const open = async () => {
      await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
      await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
    };
    const cmd = m => page.evaluate(m => window.command(m), m);
    const state = () => page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1));
    const save = async () => { await cmd({ type: 'save' }); const result = await page.evaluate(() => window.messages.filter(m => m.type === 'save').at(-1)); await cmd({ type: 'saved' }); return result; };
    const stroke = async (points) => {
      await page.mouse.move(points[0][0], points[0][1]);
      await page.mouse.down();
      for (const [x, y] of points.slice(1)) await page.mouse.move(x, y, { steps: 12 });
      await page.mouse.up();
    };
    const shot = name => page.screenshot({ path: path.join(out, name) });
    // Decoding happens in the browser, so these are the same bytes an image viewer would see.
    const decode = (data) => page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let opaque = 0, clear = 0, minX = c.width, maxX = -1, minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (d[k + 3] === 0) { clear++; continue; }
        opaque++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { width: i.width, height: i.height, opaque, clear, minX, maxX, minY, maxY };
    }, data);
    const difference = (a, b) => page.evaluate(async pair => {
      const pixels = async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 360; c.getContext('2d').drawImage(i, 0, 0); return c.getContext('2d').getImageData(0, 0, 360, 360).data; };
      const a = await pixels(pair[0]), b = await pixels(pair[1]);
      let changed = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
      return changed;
    }, [a, b]);
    const fileUrl = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');

    let project = createProject('실행 검증 세트', '');
    const commit = () => { saveStore({ version: 1, introDone: true, revision: (loadStore().store.revision ?? 0) + 1, projects: [project], palette: palette }); };
    let palette = [];

    // ── 1. First drawing, on an empty canvas, with nothing set up first ──────────────────────
    console.log('1. 첫 그림');
    await open();
    assert.equal(nextUnfinished(project, 0), 1, 'work starts on the first cut');
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }, { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], activeLayerId: 'draw-1', caption: null, color: '#242424', penWidth: 6, eraserWidth: 24 });
    const empty = await save();
    assert.equal(empty.metrics.coverage, 0, 'the canvas really is empty to begin with');
    await cmd({ type: 'width', tool: 'pen', width: 10 });
    await stroke([[120, 150], [270, 150], [270, 300], [120, 300], [120, 150]]);  // head
    await cmd({ type: 'width', tool: 'pen', width: 14 });
    await stroke([[165, 205], [167, 207]]);                                       // eyes
    await stroke([[225, 205], [227, 207]]);
    await cmd({ type: 'width', tool: 'pen', width: 8 });
    await stroke([[175, 255], [195, 268], [215, 255]]);                           // smile
    await shot('01-first-drawing.png');
    const first = await save();
    assert.ok(first.metrics.coverage > 0, 'the first cut has ink on it');
    assert.equal(first.metrics.transparent, true, 'and a transparent background');
    say(`첫 그림 저장: coverage ${(first.metrics.coverage * 100).toFixed(1)}%`);

    // 완성 · 다음: the declaration, and only now does the count move.
    const slot1 = savePainterWork(first, []);
    project.slots[0] = { ...project.slots[0], ...slot1, qa: inspectImage(slot1.finalImage), done: true, status: 'PASS' };
    project.lastSlot = 1;
    commit();
    assert.equal(doneCount(project), 1, '완성 · 다음 counts exactly one finished cut');
    assert.equal(project.slots[0].qa.status, 'PASS', 'and the file it wrote passes the mechanical checks');
    const firstFile = path.join(documents, 'emoticon-studio', project.slots[0].finalImage.path);
    const firstBytes = fs.readFileSync(firstFile);
    assert.deepEqual([...firstBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], '01 is a real PNG on disk');
    assert.equal(firstBytes.readUInt32BE(16), SPEC.width);
    assert.equal(firstBytes.readUInt32BE(20), SPEC.height);
    say(`디스크 파일 ${project.slots[0].finalImage.path} · ${firstBytes.length}B · ${firstBytes.readUInt32BE(16)}×${firstBytes.readUInt32BE(20)}`);

    // ── 2. 완성 · 다음 hands over an empty canvas ────────────────────────────────────────────
    console.log('2. 완성 · 다음 → 빈 캔버스');
    const next = nextUnfinished(project, 1);
    assert.equal(next, 2, 'the next cut is the next unfinished one');
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }, { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], activeLayerId: 'draw-1', caption: null, color: '#242424', penWidth: 10, eraserWidth: 24 });
    assert.equal((await save()).metrics.coverage, 0, 'and it arrives empty, not pre-filled with a copy');

    // ── 3. 이전 그림 복사 — an independent document ──────────────────────────────────────────
    console.log('3. 이전 그림 복사');
    const source = previousDrawn(project, 2);
    assert.equal(source.number, 1, 'the copy comes from the cut just finished');
    const copiedLayers = await Promise.all(source.work.layers.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })));
    await cmd({ type: 'copyWork', layers: copiedLayers, caption: source.work.caption ?? null });
    await page.waitForFunction(() => window.messages.filter(m => m.type === 'state').at(-1).dirty === true);
    const afterCopy = await save();
    assert.equal(await difference(afterCopy.data, first.data), 0, 'the copy starts as the same picture, pixel for pixel');
    await shot('02-copied.png');

    // 표정 수정 + 문구 넣기
    console.log('4. 복사본 수정 · 문구 넣기');
    await cmd({ type: 'tool', tool: 'eraser' }); await cmd({ type: 'width', tool: 'eraser', width: 30 });
    await stroke([[170, 262], [220, 262]]);                                       // wipe the smile
    await cmd({ type: 'tool', tool: 'pen' }); await cmd({ type: 'color', color: '#E94F4F' }); palette = ['#E94F4F'];
    await cmd({ type: 'width', tool: 'pen', width: 8 });
    await stroke([[175, 268], [195, 255], [215, 268]]);                            // a different mouth
    await cmd({ type: 'caption', caption: { text: '고마워요', place: 'bottom', color: '#E94F4F', style: 'basic' } });
    await shot('03-edited-with-caption.png');
    const second = await save();
    assert.deepEqual(second.caption, { text: '고마워요', place: 'bottom', color: '#E94F4F', style: 'basic', layout: 'line' }, 'the words travel with the save');
    assert.ok(await difference(second.data, first.data) > 0, 'the edited copy is no longer the same picture');
    const slot2 = savePainterWork(second, []);
    project.slots[1] = { ...project.slots[1], ...slot2, qa: inspectImage(slot2.finalImage), done: true, status: 'PASS' };
    project.lastSlot = 2;
    commit();
    assert.equal(doneCount(project), 2, 'two finished cuts');

    // Independence, checked against the disk rather than against a claim.
    assert.notEqual(project.slots[1].finalImage.path, project.slots[0].finalImage.path, 'the copy was written as its own file');
    assert.deepEqual([...fs.readFileSync(firstFile)], [...firstBytes], 'and editing it did not touch a single byte of the original');
    const sharedPaths = project.slots[0].work.layers.map(l => l.image?.path).filter(Boolean)
      .filter(p => project.slots[1].work.layers.some(l => l.image?.path === p));
    assert.deepEqual(sharedPaths, [], 'the two cuts share no pixel file at all');
    say(`복사·수정본 ${project.slots[1].finalImage.path} · 원본 ${project.slots[0].finalImage.path} 무변경`);

    // The caption is in the exported picture, not in the drawing layer.
    const captionless = await decode(second.layers[0].data);
    const withCaption = await decode(second.data);
    assert.ok(withCaption.opaque > captionless.opaque, 'the exported picture carries more ink than the layer: the words are in it');
    say(`문구 포함 출력 ${withCaption.opaque}px vs 레이어 ${captionless.opaque}px`);

    // ── 4b. 문구가 화면 밖으로 나가지 않는가 ─────────────────────────────────────────────────
    console.log('4b. 긴 문구 · 위 배치');
    const blank = [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }, { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }];
    const captionOnly = async (caption) => {
      await cmd({ type: 'init', layers: blank, references: [], activeLayerId: 'draw-1', caption, color: '#242424', penWidth: 8, eraserWidth: 24 });
      return decode((await save()).data);
    };
    const short = await captionOnly({ text: '고마워요', place: 'bottom', color: '#242424' });
    const long = await captionOnly({ text: '정말정말 고마워요 오늘도 화이팅!', place: 'bottom', color: '#242424' });
    for (const [label, ink] of [['짧은 문구', short], ['긴 문구', long]]) {
      assert.ok(ink.minX >= 0 && ink.maxX < SPEC.width, `${label}가 좌우로 잘리지 않는다: ${ink.minX}..${ink.maxX}`);
      assert.ok(ink.minY >= 0 && ink.maxY < SPEC.height, `${label}가 위아래로 잘리지 않는다: ${ink.minY}..${ink.maxY}`);
      assert.ok(ink.maxY > SPEC.height * .7, `${label}는 아래쪽에 놓인다`);
      say(`${label}: 잉크 ${ink.minX}..${ink.maxX} × ${ink.minY}..${ink.maxY} · 높이 ${ink.maxY - ink.minY + 1}px`);
    }
    assert.ok(long.maxY - long.minY < short.maxY - short.minY, '긴 문구는 캔버스에 맞게 작아진다');
    const top = await captionOnly({ text: '위에도 넣어요', place: 'top', color: '#242424' });
    assert.ok(top.maxY < SPEC.height * .4, '위 배치는 위쪽에 그려진다');
    assert.ok(top.minY >= 0, '그리고 위로 잘리지 않는다');
    say(`위 배치: 잉크 ${top.minY}..${top.maxY}`);
    await shot('06-caption-top.png');
    const empty2 = await captionOnly(null);
    assert.equal(empty2.opaque, 0, '문구를 지우면 아무것도 남지 않는다');

    // Put the real cut back on the canvas before the restart step.
    await cmd({ type: 'init', layers: (await Promise.all(project.slots[1].work.layers.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })))), references: [], activeLayerId: project.slots[1].work.activeLayerId, caption: project.slots[1].work.caption, color: '#E94F4F', penWidth: 8, eraserWidth: 30 });

    // ── 5. 앱 재실행 ─────────────────────────────────────────────────────────────────────────
    console.log('5. 앱 재실행');
    await page.reload();
    await open();
    const reopened = loadStore().store;
    assert.equal(reopened.projects.length, 1, 'the set is still there after a restart');
    project = reopened.projects[0];
    assert.equal(doneCount(project), 2, 'both completions survived');
    assert.equal(project.lastSlot, 2, 'and it remembers where the work stopped');
    assert.deepEqual(project.slots[1].work.caption, { text: '고마워요', place: 'bottom', color: '#E94F4F', style: 'basic', layout: 'line' }, 'together with the words');
    const restoredLayers = await Promise.all(project.slots[1].work.layers.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })));
    await cmd({ type: 'init', layers: restoredLayers, references: [], activeLayerId: project.slots[1].work.activeLayerId, caption: project.slots[1].work.caption, color: '#E94F4F', penWidth: 8, eraserWidth: 30 });
    await shot('04-after-restart.png');
    const restored = await save();
    assert.equal(await difference(restored.data, second.data), 0, 'and the cut comes back pixel for pixel, words included');
    say('재실행 후 복원: 픽셀 차이 0');

    // ── 6. 내보내기 ──────────────────────────────────────────────────────────────────────────
    console.log('6. 내보내기');
    const result = exportSet(project);
    assert.equal(result.count, 2);
    assert.equal(result.missing, SPEC.count - 2, 'it says plainly how many cuts are still empty');
    const zipPath = path.join(documents, 'emoticon-studio', 'exports', result.path);   // 2026-10-06 사본은 exports/
    const zipBytes = fs.readFileSync(zipPath);
    assert.deepEqual(readZipNames(new Uint8Array(zipBytes)), ['01.png', '02.png'], 'named and ordered by cut');
    say(`ZIP ${result.path} · ${zipBytes.length}B`);

    // .NET's unzip reads the central directory, so the local headers need checking on their own:
    // other unzippers (Info-ZIP, Android) do read them, and a wrong size there breaks extraction.
    {
      const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
      const end = zipBytes.length - 22;
      let at = view.getUint32(end + 16, true);
      for (let i = 0; i < view.getUint16(end + 10, true); i++) {
        const nameLength = view.getUint16(at + 28, true), central = view.getUint32(at + 24, true), offset = view.getUint32(at + 42, true);
        assert.equal(view.getUint32(offset, true), 0x04034B50, 'each entry starts with a local header');
        assert.equal(view.getUint32(offset + 18, true), central, 'the local header agrees with the central directory on the compressed size');
        assert.equal(view.getUint32(offset + 22, true), central, 'and on the uncompressed size');
        assert.equal(view.getUint32(offset + 14, true), view.getUint32(at + 16, true), 'and on the checksum');
        at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
      }
      say('ZIP local header · 중앙 디렉터리 크기/CRC 일치 확인');
    }

    // Open it with something that is not our code.
    const extracted = path.join(out, 'unzipped');
    const copy = path.join(out, 'submission.zip');
    fs.copyFileSync(zipPath, copy);
    let unzipper = 'none';
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${copy}' -DestinationPath '${extracted}' -Force`], { stdio: 'pipe' });
      unzipper = 'PowerShell Expand-Archive';
    } catch (e) {
      throw new Error('독립 압축 해제 실패: ' + String(e.stderr || e.message));
    }
    const entries = fs.readdirSync(extracted).sort();
    assert.deepEqual(entries, ['01.png', '02.png'], `${unzipper} sees exactly the submission files`);
    say(`${unzipper}로 압축 해제: ${entries.join(', ')}`);

    for (const [index, name] of entries.entries()) {
      const file = path.join(extracted, name);
      const bytes = fs.readFileSync(file);
      const slot = project.slots[index];
      assert.deepEqual([...bytes], [...fs.readFileSync(path.join(documents, 'emoticon-studio', slot.finalImage.path))], `${name} is byte-identical to the file that was checked`);
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${name} is a PNG`);
      const shape = await decode(fileUrl(file));
      assert.equal(shape.width, SPEC.width, `${name} width`);
      assert.equal(shape.height, SPEC.height, `${name} height`);
      assert.ok(shape.clear > 0, `${name} keeps a transparent background`);
      assert.ok(shape.opaque > 0, `${name} actually has a drawing on it`);
      say(`${name}: ${shape.width}×${shape.height} · 그림 ${shape.opaque}px · 투명 ${shape.clear}px · ${bytes.length}B`);
    }
    // The words must be visible in the delivered file, not only in the app.
    const delivered = await decode(fileUrl(path.join(extracted, '02.png')));
    const layerOnly = await decode(second.layers[0].data);
    assert.ok(delivered.opaque > layerOnly.opaque, '02.png carries the words that were typed');
    fs.copyFileSync(path.join(extracted, '02.png'), path.join(out, '05-delivered-02.png'));

    // Nothing that is not a finished drawing may be in the bundle.
    for (const name of entries) {
      const bytes = fs.readFileSync(path.join(extracted, name));
      for (const layer of project.slots.flatMap(s => s.work?.layers ?? [])) {
        if (!layer.image) continue;
        const layerFile = path.join(documents, 'emoticon-studio', layer.image.path);
        if (project.slots.some(s => s.finalImage?.path === layer.image.path)) continue;
        // 한 장짜리 그림(문구 없음)은 작업 장과 완성본이 같은 그림이라 바이트가 같을 수 있다 — 그건 작업 파일을 보낸 게 아니다.
        const own = project.slots.find(s => (s.work?.layers ?? []).includes(layer));
        if (own?.finalImage && Buffer.compare(fs.readFileSync(layerFile), fs.readFileSync(path.join(documents, 'emoticon-studio', own.finalImage.path))) === 0) continue;
        assert.notDeepEqual([...bytes], [...fs.readFileSync(layerFile)], 'no working layer file is shipped');
      }
    }

    // ── 7. 움직이는 컷이 실제로 묶여 나가는가 ────────────────────────────────────────────────
    console.log('7. 움직이는 컷 내보내기');
    await open();
    const restored2 = await Promise.all(project.slots[1].work.layers.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })));
    await cmd({ type: 'init', layers: restored2, references: [], activeLayerId: project.slots[1].work.activeLayerId, caption: project.slots[1].work.caption, color: '#E94F4F', penWidth: 8, eraserWidth: 30 });
    const motion = { version: 1, preset: 'bounce', speed: .5, strength: .5, captionMoves: false };
    await cmd({ type: 'motion', motion });
    await cmd({ type: 'frames', fps: 12 });
    const loop = (await page.evaluate(() => window.messages.filter(m => m.type === 'frames').at(-1))).gif;
    const motionImage = saveMotionLoop(loop.data);
    project = { ...project, slots: project.slots.map(s => s.number === 2 ? { ...s, motion, motionImage } : s) };
    commit();
    say(`움직이는 컷 저장: ${motionImage.path} · ${loop.count}프레임 · ${loop.bytes}B`);
    assert.equal(motionImage.width, SPEC.width, 'the loop is the working size');
    assert.equal(motionImage.height, SPEC.height);

    const animated = exportSet(project);
    const animatedZip = path.join(documents, 'emoticon-studio', 'exports', animated.path);
    assert.deepEqual(readZipNames(new Uint8Array(fs.readFileSync(animatedZip))), ['01.png', '02.gif'], 'a moving cut ships as a loop, a still one as a picture');
    const extracted2 = path.join(out, 'unzipped-animated');
    const copy2 = path.join(out, 'submission-animated.zip');
    fs.copyFileSync(animatedZip, copy2);
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${copy2}' -DestinationPath '${extracted2}' -Force`], { stdio: 'pipe' });
    assert.deepEqual(fs.readdirSync(extracted2).sort(), ['01.png', '02.gif'], 'PowerShell sees both kinds');
    const gifOut = fs.readFileSync(path.join(extracted2, '02.gif'));
    assert.deepEqual([...gifOut.subarray(0, 6)], [...Buffer.from('GIF89a')], '02.gif really is a GIF');
    assert.deepEqual([...gifOut], [...fs.readFileSync(path.join(documents, 'emoticon-studio', motionImage.path))], 'byte identical to the file that was checked');
    const shownLoop = await decode('data:image/gif;base64,' + gifOut.toString('base64'));
    assert.equal(shownLoop.width, SPEC.width); assert.equal(shownLoop.height, SPEC.height);
    assert.ok(shownLoop.clear > 0, 'the delivered loop keeps a transparent background');
    assert.ok(shownLoop.opaque > 0, 'and has the drawing in it');
    fs.copyFileSync(path.join(extracted2, '02.gif'), path.join(out, '07-delivered-02.gif'));
    say(`ZIP 해제: 01.png, 02.gif · 02.gif ${shownLoop.width}×${shownLoop.height} · 그림 ${shownLoop.opaque}px · 투명 ${shownLoop.clear}px · ${gifOut.length}B`);

    // ── 7-1. 공식 도구로 넘길 프레임이 '지금' 만들어지고 '지금' 움직임과 맞는가 ────────────────
    // 프레임은 저장해 둔 파일이 아니라 내보내는 순간 만든다. 그래서 두 가지를 확인한다:
    // (1) 넘긴 프레임이 실제로 360×360 PNG 로 묶음에 들어간다.
    // (2) 움직임을 바꿔 다시 만들면 묶음의 프레임도 바뀐다 — 옛 프레임이 섞이지 않는다.
    const bake = async (m) => {
      await cmd({ type: 'motion', motion: m });
      await cmd({ type: 'frames', fps: 12, sheets: true });
      const built = (await page.evaluate(() => window.messages.filter(t => t.type === 'frames').at(-1))).gif;
      assert.ok(built.sheets && built.sheets.length, '프레임을 달라고 하면 실제로 온다');
      return { number: 2, frames: built.sheets.map(decodeDataUrl), delayMs: built.delayMs };
    };
    const withFrames = await bake(motion);
    const handed = exportSet(project, [withFrames]);
    const handedZip = path.join(documents, 'emoticon-studio', 'exports', handed.path);
    const handedNames = readZipNames(new Uint8Array(fs.readFileSync(handedZip)));
    assert.ok(handedNames.includes('webp-animator/02/01.png'), '컷 폴더가 지금 번호로 들어간다: ' + handedNames.join(' '));
    assert.ok(handedNames.includes('webp-animator/읽어주세요.txt'), '쪽지도 함께 들어간다');
    const extracted3 = path.join(out, 'unzipped-handoff'), copy3 = path.join(out, 'submission-handoff.zip');
    fs.copyFileSync(handedZip, copy3);
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${copy3}' -DestinationPath '${extracted3}' -Force`], { stdio: 'pipe' });
    const firstFrame = fs.readFileSync(path.join(extracted3, 'webp-animator', '02', '01.png'));
    assert.deepEqual([...firstFrame.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], '넘긴 프레임이 진짜 PNG 다');
    const shownFrame = await decode('data:image/png;base64,' + firstFrame.toString('base64'));
    assert.equal(shownFrame.width, SPEC.width, '공식 도구가 받는 360 크기다');
    assert.equal(shownFrame.height, SPEC.height);
    assert.ok(shownFrame.opaque > 0, '빈 장이 아니다');
    const noteOut = fs.readFileSync(path.join(extracted3, 'webp-animator', '읽어주세요.txt'), 'utf8');
    assert.ok(noteOut.includes(`02번 · ${withFrames.frames.length}장`), '쪽지의 장수가 실제로 넣은 장수와 같다: ' + noteOut.split('\n').pop());
    fs.copyFileSync(path.join(extracted3, 'webp-animator', '02', '01.png'), path.join(out, '07-handoff-02-01.png'));
    say(`공식 도구용 프레임: ${withFrames.frames.length}장 · ${shownFrame.width}×${shownFrame.height} · 한 장당 ${withFrames.delayMs}ms · 첫 장 ${firstFrame.length}B`);

    // 움직임을 바꾸고 다시 만든다. 같은 컷인데 나오는 프레임이 달라야 한다.
    const other = { version: 1, preset: 'spin', speed: 1, strength: 1, captionMoves: false };
    const reBaked = await bake(other);
    const reNames = readZipNames(new Uint8Array(fs.readFileSync(path.join(documents, 'emoticon-studio', 'exports', exportSet(project, [reBaked]).path))));
    assert.ok(reNames.includes('webp-animator/02/01.png'), '바꾼 뒤에도 컷 폴더가 있다');
    const changed = Buffer.compare(Buffer.from(reBaked.frames[1]), Buffer.from(withFrames.frames[1])) !== 0;
    assert.ok(changed, '움직임을 바꾸면 묶음에 실리는 프레임도 바뀐다 — 옛 프레임이 남지 않는다');
    say(`움직임 변경 후 재생성: ${reBaked.frames.length}장 · 두 번째 장 ${reBaked.frames[1].length}B (이전 ${withFrames.frames[1].length}B) · 내용 다름 ${changed}`);
    await cmd({ type: 'motion', motion });

    // 움직임을 빼면 다시 정지 파일로 나간다.
    project = { ...project, slots: project.slots.map(s => s.number === 2 ? { ...s, motion: undefined, motionImage: undefined } : s) };
    commit();
    assert.deepEqual(readZipNames(new Uint8Array(fs.readFileSync(path.join(documents, 'emoticon-studio', 'exports', exportSet(project).path)))), ['01.png', '02.png'], 'removing the movement ships the still picture again');
    say('움직임 제거 → 다시 01.png, 02.png');

    assert.deepEqual(errors, [], 'the canvas raised no errors during the whole run');
    fs.writeFileSync(path.join(out, 'run.txt'), step.join('\n') + '\n');
    console.log('PASS: 움직이는 컷 포함 · 첫 그림 → 완성·다음 → 이전 그림 복사 → 표정 수정 · 문구 → 앱 재실행 → 내보내기까지 실제 브라우저 엔진과 실제 파일로 실행. ZIP은 PowerShell Expand-Archive로 열어 PNG·GIF 규격·투명도·바이트 일치를 확인했다. 증거: verification/flow/. React Native 화면과 Android 전달은 이 테스트의 범위가 아니다.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.platform === 'win32') server.process().kill('SIGKILL');
    await server.kill(); await browser.close();
  }
})();
