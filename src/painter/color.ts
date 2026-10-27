// 색 값 하나를 여러 방식으로 읽고 쓴다. 저장·캔버스로 가는 형식은 `#RRGGBB` 또는 `#RRGGBBAA` 하나뿐이다.
// 불투명한 색은 예전과 똑같이 6자리로 남는다 — 그래서 이미 저장된 최근 색·문구 색·세트가 그대로 맞는다.
export type Rgba = { r: number; g: number; b: number; a: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
export const HEX_COLOR = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

export function parseHex(hex: string): Rgba {
  let v = String(hex ?? '').replace('#', '');
  if (v.length === 3) v = v.split('').map(c => c + c).join('');
  const n = parseInt(v.slice(0, 6), 16);
  const a = v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255;
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0, a: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: Number.isFinite(a) ? a : 255 };
}
export function toHex({ r, g, b, a }: Rgba): string {
  const h = (n: number) => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return ('#' + h(r) + h(g) + h(b) + (clamp(a, 0, 255) >= 255 ? '' : h(a))).toUpperCase();
}
export const withAlpha = (hex: string, a: number) => toHex({ ...parseHex(hex), a });
export const alphaOf = (hex: string) => parseHex(hex).a;

// 입력칸에 친 값. 무료는 6자리, PRO 는 투명도 2자리까지 받는다. 틀린 값은 null — 칠 때마다 색이 튀지 않게.
export function typedHex(input: string, allowAlpha: boolean): string | null {
  const raw = input.trim().toUpperCase();
  const full = raw.startsWith('#') ? raw : '#' + raw;
  if (/^#[0-9A-F]{6}$/.test(full)) return full;
  if (allowAlpha && /^#[0-9A-F]{8}$/.test(full)) return toHex(parseHex(full));
  return null;
}

// 색상환에서 한 칸을 꺼낸다(h 0~360, s·v 0~1).
export function hsv(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x]
    : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return toHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a: 255 });
}
// 반대 방향. 스포이드·HEX·RGB 로 정한 색의 계열을 채도·명도 면이 따라가게 하는 데 쓴다.
export function hsvOf(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = parseHex(hex);
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d) h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
  if (h < 0) h += 360;
  return { h: Math.round(h) % 360, s: max ? d / max : 0, v: max };
}
// 체크 표시를 색 위에 올릴 때 어느 쪽이 읽히는지. 많이 투명한 색은 흰 바탕이 비치므로 밝은 쪽으로 본다.
export function light(hex: string): boolean {
  const { r, g, b, a } = parseHex(hex);
  if (a < 128) return true;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
