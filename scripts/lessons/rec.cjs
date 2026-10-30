// 강좌 영상 녹화 도우미(에뮬레이터 전용, 2026-10-15). 사용자 기기에는 쓰지 않는다(-s 로 대상 고정).
// 녹화는 adb screenrecord, 손가락 표시는 에뮬레이터 '터치 표시'를 켠다. 다듬기(자르기·속도·크기)는 ffmpeg.
//   const r = require('./rec.cjs'); r.start('first-set-1'); r.tap(540, 1200); ... r.stop(); r.pull('first-set-1');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ADB = 'C:\\Android\\Sdk\\platform-tools\\adb.exe';
const SERIAL = process.env.EMU_SERIAL || 'emulator-5554';
const FFMPEG = fs.readdirSync(path.join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Packages')).filter(d => d.startsWith('Gyan.FFmpeg'))
  .map(d => { const root = path.join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Packages', d); const sub = fs.readdirSync(root).find(x => x.startsWith('ffmpeg-')); return path.join(root, sub, 'bin', 'ffmpeg.exe'); })[0];
const RAW = 'C:\\build-temp\\lesson-raw';
fs.mkdirSync(RAW, { recursive: true });
const adb = (args, opts = {}) => execFileSync(ADB, ['-s', SERIAL, ...args], { maxBuffer: 64 << 20, ...opts });
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let rec = null;
// 일본어·번체 녹화(LESSON_LANG)는 같은 강좌 폴더 아래 언어 폴더에 둔다(assets/lessons/motion/ja/step1.mp4). 한국어는 지금 자리 그대로.
const lang = process.env.LESSON_LANG || 'ko';
function langOut(file) { if (lang === 'ko') return file; const dir = path.join(path.dirname(file), lang); fs.mkdirSync(dir, { recursive: true }); return path.join(dir, path.basename(file)); }
module.exports = {
  adb, sleep, FFMPEG, langOut,
  touches(on) { adb(['shell', 'settings', 'put', 'system', 'show_touches', on ? '1' : '0']); },
  start(name, seconds = 150) {
    adb(['shell', 'rm', '-f', `/sdcard/${name}.mp4`]);
    rec = spawn(ADB, ['-s', SERIAL, 'shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', String(seconds), `/sdcard/${name}.mp4`], { stdio: 'ignore', detached: true }); rec.unref();
    sleep(1200);
  },
  // 녹화가 시간 제한으로 먼저 끝났으면 pkill 이 실패한다 — 그래도 파일은 있으니 넘어간다.
  stop() { try { adb(['shell', 'pkill', '-INT', 'screenrecord'], { stdio: 'ignore' }); } catch { /* 이미 끝남 */ } sleep(3000); rec = null; },
  pull(name) { const out = path.join(RAW, name + '.mp4'); adb(['pull', `/sdcard/${name}.mp4`, out]); return out; },
  tap(x, y, wait = 900) { adb(['shell', 'input', 'tap', String(x), String(y)]); sleep(wait); },
  swipe(x1, y1, x2, y2, ms = 400, wait = 700) { adb(['shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(ms)]); sleep(wait); },
  // 곡선 한 획: 점 목록을 손가락 한 번으로(DOWN · MOVE… · UP). 한 셸에 이어 보내 끊기지 않게.
  stroke(points) {
    const cmds = [`input motionevent DOWN ${points[0][0] | 0} ${points[0][1] | 0}`, ...points.slice(1).map(([x, y]) => `input motionevent MOVE ${x | 0} ${y | 0}`), `input motionevent UP ${points.at(-1)[0] | 0} ${points.at(-1)[1] | 0}`];
    // 긴 획은 셸 한 줄 길이 제한에 걸려 뒤가 잘렸다(2026-10-28) — 손을 떼지 않은 채 40개씩 나눠 보낸다.
    for (let i = 0; i < cmds.length; i += 40) adb(['shell', cmds.slice(i, i + 40).join(';')]);
    sleep(250);
  },
  arc(cx, cy, rx, ry, a0, a1, n = 18) { const pts = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return pts; },
  shot(file) { fs.writeFileSync(file, adb(['exec-out', 'screencap', '-p'])); },
  // 다듬기: from~to 초만, speed 배속, 폭 540, 소리 없음, H.264(앱 안 재생용), 빠른 시작.
  // squeeze: 같은 화면이 이어지는 기다림(화면 읽기 대기)을 줄인다 — 10fps로 펴고 같은 장은 8장까지만 건너뛰어 멈춤을 1초 안쪽으로.
  cut(name, { from = 0, to, speed = 1, out, crop, squeeze = false }) {
    const src = path.join(RAW, name + '.mp4');
    const args = ['-y', '-ss', String(from), '-i', src, ...(to ? ['-t', String(to - from)] : []), '-an',
      '-vf', `${crop ? `crop=1080:${crop[1]}:0:${crop[0]},` : ''}${squeeze ? 'fps=10,mpdecimate=max=8,setpts=N/10/TB,' : ''}setpts=PTS/${speed},scale=540:-2,fps=30`, '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-movflags', '+faststart', out];
    execFileSync(FFMPEG, args, { stdio: 'ignore' });
    return fs.statSync(out).size;
  },
};
