// Set deletion safety: which files a project owns, and which of those may actually be removed.
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
  delete() { if (!files.delete(this.uri)) throw new Error('missing ' + this.uri); }
}
const load = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'document' } } });
const { createProject, imagePaths, storeImagePaths, droppedImagePaths } = load('src/project.ts');
const { deleteLocalImages, localFile } = load('src/services/storage.ts');

const image = path => ({ path, width: 360, height: 360 });
const transform = (id, path) => ({ id, name: id, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: image(path) });

function sample(name, tag) {
  const project = createProject(name, name);
  project.canon.image = image(`image-${tag}-canon.png`);
  project.slots = project.slots.map(s => ({ ...s, referenceImages: [image(`image-${tag}-ref.png`)] }));
  project.slots[0].finalImage = image(`image-${tag}-final.png`);
  project.slots[0].work = { version: 1, activeLayerId: 'draw-1', layers: [transform('draw-1', `image-${tag}-l1.png`), transform('draw-2', `image-${tag}-l2.png`)], references: [transform('ref-1', `image-${tag}-ref.png`)] };
  return project;
}

const a = sample('가', 'a'), b = sample('나', 'b');

// Every kind of image a project can own is discovered, references counted once across 32 slots.
assert.deepEqual([...imagePaths(a)].sort(), ['image-a-canon.png', 'image-a-final.png', 'image-a-l1.png', 'image-a-l2.png', 'image-a-ref.png']);

const store = projects => ({ version: 1, revision: 1, projects });
assert.equal(storeImagePaths(store([a, b])).size, 10, 'the store sees every project\'s images');

// Two independent projects: deleting one releases only its own files.
assert.deepEqual(droppedImagePaths(store([a, b]), store([b])).sort(), ['image-a-canon.png', 'image-a-final.png', 'image-a-l1.png', 'image-a-l2.png', 'image-a-ref.png']);
assert.deepEqual(droppedImagePaths(store([a, b]), store([a])).sort(), ['image-b-canon.png', 'image-b-final.png', 'image-b-l1.png', 'image-b-l2.png', 'image-b-ref.png']);
assert.equal(droppedImagePaths(store([a]), store([])).length, 5, 'the last project releases everything it owned');
assert.deepEqual(droppedImagePaths(store([a, b]), store([a, b])), [], 'an edit that changes nothing releases nothing');

// A path another project still points at is never released, even though the deleted project owned it too.
const shared = sample('다', 'c');
shared.canon.image = image('image-a-canon.png');
shared.slots[0].finalImage = image('image-a-final.png');
assert.deepEqual(droppedImagePaths(store([a, shared]), store([shared])).sort(), ['image-a-l1.png', 'image-a-l2.png', 'image-a-ref.png'], 'shared files stay for the project that still points at them');

// Replacing a slot's drawing releases the file it replaced, and nothing else.
const resaved = JSON.parse(JSON.stringify(a));
resaved.slots[0].finalImage = image('image-a-final-2.png');
assert.deepEqual(droppedImagePaths(store([a]), store([resaved])), ['image-a-final.png'], 'a re-save leaves no orphan behind');
assert.deepEqual(droppedImagePaths(store([a, b]), store([resaved, b])), ['image-a-final.png'], 'and still touches nothing of the other project');

// Deletion only touches files newImageFile() created; store snapshots share the directory.
for (const name of ['image-a-canon.png', 'store-a.json', 'store-b.json', 'notes.txt']) files.set(localFile(name).uri, 'x');
const result = deleteLocalImages(['image-a-canon.png', 'store-a.json', 'store-b.json', 'notes.txt', '../escape.png', 'image-missing.png']);
assert.equal(files.has(localFile('image-a-canon.png').uri), false, 'owned image removed');
assert.equal(files.has(localFile('store-a.json').uri), true, 'store snapshot survives');
assert.equal(files.has(localFile('store-b.json').uri), true, 'store snapshot survives');
assert.equal(files.has(localFile('notes.txt').uri), true, 'unknown file survives');
assert.equal(result.removed, 1);
// store-a, store-b, notes.txt and the traversal attempt are refused; a path that is simply gone is not a failure.
assert.equal(result.skipped, 4, 'refused paths are reported rather than thrown');

console.log('PASS: project image ownership, orphan set difference across projects, shared-path protection, deletion guard for store snapshots and foreign files. File system mocked.');
