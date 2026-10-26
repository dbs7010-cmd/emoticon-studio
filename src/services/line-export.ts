// LINE 움직이는 스티커 파일 묶음(2026-10-27, 글로벌 통합안 EM-G07). 카카오 출력(export.ts)은 건드리지 않는다.
// 규격(LINE Creators Market 공식 가이드, 2026-10-27 확인): APNG(.png) · 최대 320×270 · 한쪽 270 이상 · 5~20장 · 한 바퀴×반복 4초 이하
//   · 반복 1~4회 · 장당 1MB 이하 · 투명 바탕 · RGB · 세트 8/16/24 · 메인 240×240 APNG · 탭 96×74 PNG · ZIP 60MB 이하.
// 새 라이브러리 없이 만든다: 캔버스가 만든 PNG 프레임의 압축 데이터(IDAT)를 그대로 APNG 장(fdAT)으로 옮긴다.
// 제출·심사 통과는 앱이 보장하지 않는다 — 사용자가 LINE Creators Market 에 직접 올린다.
import { buildZip, crc32, type ExportEntry } from './export';
import { isAnimated } from '../project';
import type { Project, Slot } from '../types';

export const LINE_SPEC = {
  sticker: { w: 320, h: 270 }, main: { w: 240, h: 240 }, tab: { w: 96, h: 74 },
  minFrames: 5, maxFrames: 20, maxSeconds: 4, maxLoops: 4, maxBytes: 1024 * 1024, maxZipBytes: 60 * 1024 * 1024,
  setSizes: [8, 16, 24] as const,
};
// 그림 칸: 정사각 360 그림을 270×270 으로(높이 270 — '한쪽 270 이상' 충족). 가로를 320 으로 넓히면 양옆 투명만 늘어 용량만 커진다.
export const LINE_STICKER = { w: 270, h: 270 };

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
type Chunk = { type: string; data: Uint8Array };
function chunks(png: Uint8Array): Chunk[] {
  for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) throw new Error('PNG 가 아니에요.');
  const out: Chunk[] = [], v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 12 <= png.length;) {
    const len = v.getUint32(at), type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
    out.push({ type, data: png.subarray(at + 8, at + 8 + len) });
    at += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
function chunk(type: string, data: ArrayLike<number>): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data as ArrayLike<number>, 4);
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length), 0); out.set(body, 4); out.set(u32(crc32(body)), 8 + data.length);
  return out;
}
const join = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };

// 같은 크기 PNG 여러 장 → APNG. 모든 장이 칸 전체를 덮어쓴다(blend SOURCE) — 투명 부분에 앞 장이 남지 않는다.
export function assembleApng(frames: Uint8Array[], delayMs: number, plays: number): Uint8Array {
  if (!frames.length) throw new Error('프레임이 없어요.');
  const parsed = frames.map(chunks);
  const ihdr = parsed[0].find(c => c.type === 'IHDR')!.data;
  const w = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(0), h = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(4);
  for (const p of parsed) { const d = p.find(c => c.type === 'IHDR')!.data; if (d.some((b, i) => i < 13 && b !== ihdr[i])) throw new Error('프레임 크기·형식이 서로 달라요.'); }
  const parts: Uint8Array[] = [Uint8Array.from(SIG), chunk('IHDR', ihdr), chunk('acTL', [...u32(frames.length), ...u32(plays)])];
  const delay = Math.max(1, Math.round(delayMs));
  let seq = 0;
  parsed.forEach((p, i) => {
    parts.push(chunk('fcTL', [...u32(seq++), ...u32(w), ...u32(h), ...u32(0), ...u32(0), ...u16(delay), ...u16(1000), 0, 0]));
    for (const c of p.filter(c => c.type === 'IDAT')) parts.push(i === 0 ? chunk('IDAT', c.data) : chunk('fdAT', [...u32(seq++), ...c.data]));
  });
  parts.push(chunk('IEND', []));
  return join(parts);
}

export type ApngInfo = { w: number; h: number; colorType: number; frames: number; plays: number; seconds: number; bytes: number; animated: boolean };
export function inspectPng(bytes: Uint8Array): ApngInfo {
  const list = chunks(bytes), ih = list.find(c => c.type === 'IHDR');
  if (!ih) throw new Error('PNG 머리 정보가 없어요.');
  const dv = (d: Uint8Array) => new DataView(d.buffer, d.byteOffset, d.byteLength);
  const actl = list.find(c => c.type === 'acTL');
  const seconds = list.filter(c => c.type === 'fcTL').reduce((s, c) => { const den = dv(c.data).getUint16(22) || 100; return s + dv(c.data).getUint16(20) / den; }, 0);
  return { w: dv(ih.data).getUint32(0), h: dv(ih.data).getUint32(4), colorType: ih.data[9], frames: actl ? dv(actl.data).getUint32(0) : 1,
    plays: actl ? dv(actl.data).getUint32(4) : 0, seconds, bytes: bytes.length, animated: !!actl };
}
// 규격 검사. 걸리는 이유를 사람 말로 돌려준다(빈 배열 = 통과).
export function lineProblems(info: ApngInfo, kind: 'sticker' | 'main' | 'tab'): string[] {
  const p: string[] = [], S = LINE_SPEC;
  if (info.colorType !== 6) p.push('투명 바탕(RGBA)이 아니에요');
  if (info.bytes > S.maxBytes) p.push(`파일이 1MB 를 넘어요(${(info.bytes / 1048576).toFixed(2)}MB)`);
  if (kind === 'tab') { if (info.w !== S.tab.w || info.h !== S.tab.h) p.push(`탭 그림은 ${S.tab.w}×${S.tab.h} 이어야 해요`); return p; }
  if (kind === 'main') { if (info.w !== S.main.w || info.h !== S.main.h) p.push(`메인 그림은 ${S.main.w}×${S.main.h} 이어야 해요`); }
  else {
    if (info.w > S.sticker.w || info.h > S.sticker.h) p.push(`크기가 ${S.sticker.w}×${S.sticker.h} 을 넘어요`);
    if (info.w < 270 && info.h < 270) p.push('가로나 세로 한쪽은 270 이상이어야 해요');
  }
  if (!info.animated) { p.push('움직이는 그림(APNG)이 아니에요'); return p; }
  if (info.frames < S.minFrames || info.frames > S.maxFrames) p.push(`장 수가 ${S.minFrames}~${S.maxFrames}장이어야 해요(${info.frames}장)`);
  if (info.plays < 1 || info.plays > S.maxLoops) p.push('반복은 1~4회여야 해요');
  if (info.seconds * info.plays > S.maxSeconds + 1e-6) p.push(`재생 시간이 4초를 넘어요(${(info.seconds * info.plays).toFixed(1)}초)`);
  return p;
}

// 한 바퀴 길이(초) → 장 수·한 장 시간·반복 수. 장 수는 초당 약 12장, 5~20장 안. 한 바퀴가 4초를 넘으면 만들 수 없다(null).
export function linePlan(loopSeconds: number, frames?: number): { frames: number; delayMs: number; plays: number } | null {
  if (!(loopSeconds > 0) || loopSeconds > LINE_SPEC.maxSeconds) return null;
  const n = Math.max(LINE_SPEC.minFrames, Math.min(LINE_SPEC.maxFrames, frames ?? Math.round(loopSeconds * 12)));
  return { frames: n, delayMs: (loopSeconds * 1000) / n, plays: Math.max(1, Math.min(LINE_SPEC.maxLoops, Math.floor(LINE_SPEC.maxSeconds / loopSeconds + 1e-9))) };
}
// 1MB 를 넘을 때 줄여 볼 장 수(처음 값부터 5장까지).
export const shrinkSteps = (first: number) => [...new Set([first, 16, 12, 9, 7, 5].filter(n => n <= first && n >= LINE_SPEC.minFrames))];

// 세트에 넣을 칸: 저장된 움직이는 칸만, 칸 번호 순서로. 8/16/24 중 넣을 수 있는 가장 큰 수.
export function lineCuts(project: Project): { cuts: Slot[]; size: number | null; stills: number[]; moving: number } {
  const saved = project.slots.filter(s => s.finalImage && s.work);
  const moving = saved.filter(isAnimated), stills = saved.filter(s => !isAnimated(s)).map(s => s.number);
  const size = [...LINE_SPEC.setSizes].reverse().find(n => moving.length >= n) ?? null;
  return { cuts: size ? moving.slice(0, size) : [], size, stills, moving: moving.length };
}
export type LineFile = { name: string; data: Uint8Array; kind: 'sticker' | 'main' | 'tab'; problems: string[] };
export const lineName = (index: number) => `${String(index + 1).padStart(2, '0')}.png`;
// 검사를 통과한 파일만 ZIP 으로. 하나라도 걸리면 만들지 않는다(어느 칸이 왜 걸렸는지는 files 에 남아 있다).
export function lineZip(files: LineFile[]): Uint8Array {
  const bad = files.filter(f => f.problems.length);
  if (bad.length) throw new Error(bad.map(f => `${f.name}: ${f.problems.join(', ')}`).join('\n'));
  const zip = buildZip(files.map<ExportEntry>(f => ({ name: f.name, data: f.data })));
  if (zip.length > LINE_SPEC.maxZipBytes) throw new Error('묶음이 60MB 를 넘어요.');
  return zip;
}
