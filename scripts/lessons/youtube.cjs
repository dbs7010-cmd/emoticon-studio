// 강좌 → 유튜브 영상(세로 1080×1920 · 쇼츠 규격) 만들기(2026-10-15 사용자: "나레이션 대신 배경음악 + 자막").
// 한 강좌 = 제목 카드 → 단계마다(앱 영상 또는 사진 + 큰 자막) → 핵심 정리 카드. 배경음악은 bgm.cjs 가 직접 만든 곡.
// 실행: node scripts/lessons/youtube.cjs [강좌 id ...]   (없으면 전부) → C:\build-temp\yt\<id>.mp4 · <id>.srt
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { loader } = require('../load-ts.cjs');
const { FFMPEG } = require('./rec.cjs');
const { LESSONS } = loader()('src/constants/lessons.ts');
const OUT = 'C:\\build-temp\\yt', TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const FONT_B = 'C\\:/Windows/Fonts/malgunbd.ttf', FONT = 'C\\:/Windows/Fonts/malgun.ttf';
const W = 1080, H = 1920, STEP = 6;            // 사진 단계는 6초
const ff = args => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
// drawtext 에 넣을 글: 줄바꿈은 글자 폭 기준으로 직접 나눈다(한 줄 16자 안팎).
const wrap = (t, n) => { const out = []; let line = ''; for (const w of t.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; };
const txtFile = (name, text) => { const f = path.join(TMP, name); fs.writeFileSync(f, text, 'utf8'); return f.replace(/\\/g, '/').replace(':', '\\:'); };
const assetPath = a => a && a.__asset;
const BG = 'color=c=0xFFFFFF:s=1080x1920';
const YEL = '0xFFE14D', SOFT = '0xFFF1BF', INK = '0x191F28', PT = '0x5B57D9', MUTED = '0x4E5968';

function card(file, lines, secs) {
  // lines: [{text, size, color, y, font}]
  const draws = lines.map((l, i) => `drawtext=fontfile='${l.font || FONT_B}':textfile='${txtFile(path.basename(file) + i + '.txt', l.text)}':fontsize=${l.size}:fontcolor=${l.color}:x=(w-text_w)/2:y=${l.y}`).join(',');
  ff(['-f', 'lavfi', '-i', `${BG}:d=${secs}:r=30`, '-vf', `drawbox=x=0:y=0:w=1080:h=12:color=${YEL}:t=fill,${draws}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '22', file]);
}
function stepClip(file, lesson, i, step) {
  const src = step.video ? assetPath(step.video) : step.image ? assetPath(step.image) : null;
  const title = `${i + 1}. ${step.title}`, body = wrap(step.body, 22);
  const head = `drawbox=x=0:y=0:w=1080:h=12:color=${YEL}:t=fill,` +
    `drawtext=fontfile='${FONT}':textfile='${txtFile(`h${lesson.id}${i}.txt`, lesson.title)}':fontsize=40:fontcolor=${MUTED}:x=60:y=70,` +
    `drawtext=fontfile='${FONT_B}':textfile='${txtFile(`t${lesson.id}${i}.txt`, title)}':fontsize=64:fontcolor=${INK}:x=60:y=130`;
  const sub = body.map((l, k) => `drawtext=fontfile='${FONT}':textfile='${txtFile(`b${lesson.id}${i}_${k}.txt`, l)}':fontsize=46:fontcolor=${INK}:x=(w-text_w)/2:y=${1560 + k * 66}`).join(',');
  const subBox = `drawbox=x=40:y=1520:w=1000:h=${body.length * 66 + 70}:color=${SOFT}:t=fill`;
  if (!src) { card(file, [{ text: title, size: 72, color: INK, y: 760 }, ...body.map((l, k) => ({ text: l, size: 48, color: MUTED, y: 900 + k * 70, font: FONT }))], STEP); return STEP; }
  // 화면 가운데에 앱 영상/사진(폭 900, 높이 1300 안), 위에 제목, 아래 자막
  const fit = `scale=900:1300:force_original_aspect_ratio=decrease`;
  if (step.video) {
    const dur = +execFileSync(FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString().trim();
    const secs = Math.max(STEP, Math.min(14, dur));   // 짧은 영상은 한 번 더 돌려 6초를 채운다
    ff(['-stream_loop', '-1', '-t', String(secs), '-i', src, '-f', 'lavfi', '-i', `${BG}:d=${secs}:r=30`, '-filter_complex',
      `[0:v]${fit},fps=30[v];[1:v][v]overlay=(W-w)/2:200+(1300-h)/2,${head},${subBox},${sub}`, '-t', String(secs), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '22', file]);
    return secs;
  }
  ff(['-loop', '1', '-t', String(STEP), '-i', src, '-f', 'lavfi', '-i', `${BG}:d=${STEP}:r=30`, '-filter_complex',
    `[0:v]${fit},fps=30[v];[1:v][v]overlay=(W-w)/2:200+(1300-h)/2,${head},${subBox},${sub}`, '-t', String(STEP), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '22', file]);
  return STEP;
}
const srtTime = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

const want = process.argv.slice(2);
for (const lesson of LESSONS.filter(l => !want.length || want.includes(l.id))) {
  const parts = [], srt = []; let t = 0;
  const add = (file, secs, text) => { parts.push(file); srt.push(`${srt.length + 1}\n${srtTime(t)} --> ${srtTime(t + secs)}\n${text}\n`); t += secs; };
  const intro = path.join(TMP, `${lesson.id}-0.mp4`);
  card(intro, [{ text: 'emoti 강좌', size: 44, color: PT, y: 700 }, ...wrap(lesson.title, 12).map((l, k) => ({ text: l, size: 92, color: INK, y: 780 + k * 120 })), { text: lesson.summary, size: 46, color: MUTED, y: 1050, font: FONT }], 3);
  add(intro, 3, lesson.title);
  lesson.steps.forEach((st, i) => { const f = path.join(TMP, `${lesson.id}-${i + 1}.mp4`); const secs = stepClip(f, lesson, i, st); add(f, secs, `${i + 1}. ${st.title}\n${st.body}`); });
  const outro = path.join(TMP, `${lesson.id}-z.mp4`);
  card(outro, [{ text: '핵심 정리', size: 50, color: PT, y: 640 }, ...lesson.points.map((p, k) => ({ text: `${k + 1}.  ${p}`, size: 58, color: INK, y: 760 + k * 110 })), { text: 'emoti 이모티 · 앱에서 바로 따라 해 보세요', size: 40, color: MUTED, y: 1300, font: FONT }], 5);
  add(outro, 5, '핵심 정리\n' + lesson.points.join('\n'));
  const list = path.join(TMP, `${lesson.id}-list.txt`);
  fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const bgm = path.join(OUT, `bgm-${lesson.id}.wav`);
  execFileSync(process.execPath, [path.join(__dirname, 'bgm.cjs'), String(Math.ceil(t) + 1), bgm]);
  const out = path.join(OUT, `${lesson.id}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', bgm, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${Math.max(0, t - 2)}:d=2`, '-shortest', '-movflags', '+faststart', out]);
  fs.writeFileSync(path.join(OUT, `${lesson.id}.srt`), srt.join('\n'), 'utf8');
  console.log(lesson.id, t.toFixed(1) + 's', (fs.statSync(out).size / 1048576).toFixed(1) + 'MB');
}
