// screens 폴더를 ZIP 하나로 묶는다. 항목 이름은 반드시 '/' 로 쓴다 — 역슬래시로 쓰면
// 푸는 쪽에 따라 폴더가 생기지 않고 'assets\x.png' 라는 이름의 파일 하나가 되어 index.html 이 그림을 잃는다.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const SRC = process.argv[2] || 'verification/round45_23/screens';
const DEST = process.argv[3] || 'verification/round45_23/screens-390dp.zip';
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
const files = [];
(function walk(dir, prefix) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, prefix + name + '/');
    else files.push({ name: prefix + name, data: fs.readFileSync(full) });
  }
})(SRC, '');
const chunks = [], central = [];
let offset = 0;
for (const f of files) {
  const store = /\.(png|jpg|webp|gif)$/i.test(f.name);          // 이미 압축된 것은 그대로 담는다
  const body = store ? f.data : zlib.deflateRawSync(f.data, { level: 9 });
  const name = Buffer.from(f.name, 'utf8'), crc = CRC(f.data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6);
  head.writeUInt16LE(store ? 0 : 8, 8); head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(body.length, 18); head.writeUInt32LE(f.data.length, 22); head.writeUInt16LE(name.length, 26);
  chunks.push(head, name, body);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(store ? 0 : 8, 10); c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(body.length, 20); c.writeUInt32LE(f.data.length, 24); c.writeUInt16LE(name.length, 28);
  c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += head.length + name.length + body.length;
}
const dir = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(DEST, Buffer.concat([...chunks, dir, end]));
console.log('  ' + DEST + '  ' + files.length + '개 · ' + Math.round(fs.statSync(DEST).size / 1024) + 'KB');
for (const f of files.filter(f => f.name.includes('/')).slice(0, 2)) console.log('    예: ' + f.name);
