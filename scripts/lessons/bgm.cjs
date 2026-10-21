// 강좌 유튜브 영상용 배경음악(2026-10-15). 저작권 걱정이 없게 직접 만든다 — 부드러운 화음 + 오르골 같은 짧은 음.
// 출력: 44.1kHz 16bit 스테레오 WAV. 사용: node scripts/lessons/bgm.cjs <초> <out.wav>
const fs = require('fs');
const secs = +(process.argv[2] || 60), out = process.argv[3] || 'bgm.wav';
const SR = 44100, n = Math.round(secs * SR);
const L = new Float32Array(n), R = new Float32Array(n);
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// C – Am – F – G (밝고 순한 진행), 한 화음 2초.
const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const bar = 2;
function tone(start, dur, f, amp, pan, attack, decay, bright) {
  const s0 = Math.floor(start * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len && s0 + i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    const v = amp * env * (Math.sin(2 * Math.PI * f * t) + bright * Math.sin(4 * Math.PI * f * t) * .3 + bright * Math.sin(6 * Math.PI * f * t) * .1);
    L[s0 + i] += v * (1 - pan); R[s0 + i] += v * pan;
  }
}
// 깔리는 화음(느린 시작, 길게)
for (let t = 0, k = 0; t < secs; t += bar, k++) {
  const c = chords[k % 4];
  c.forEach((m, j) => tone(t, bar + 1.2, hz(m), .055, .35 + j * .15, .5, 2.2, .2));
  tone(t, bar + .5, hz(c[0] - 12), .06, .5, .08, 1.4, .1);   // 낮은 음
  // 오르골: 화음 음을 반 박자마다 하나씩(위 옥타브)
  const arp = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 12];
  arp.forEach((m, j) => tone(t + j * .5, .9, hz(m), .045, j % 2 ? .7 : .3, .005, .35, .6));
}
// 시작·끝 부드럽게
const fade = SR * 2;
for (let i = 0; i < n; i++) { const g = Math.min(1, i / fade, (n - i) / fade); L[i] *= g; R[i] *= g; }
let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const k = .5 / (peak || 1);
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
fs.writeFileSync(out, buf);
console.log('bgm', secs + 's', out);
