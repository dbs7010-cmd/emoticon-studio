// 대체 렌더: 실제 App 을 그린 뒤, 그려진 노드와 스타일을 그대로 HTML 로 옮긴다.
// **꾸민 시안이 아니다** — 여기 나오는 상자·글자·색·간격은 전부 소스가 만든 값이고, 이 파일은 옮기기만 한다.
// **실기기 캡처도 아니다** — 아래 '이 그림의 한계'를 읽어라.
const fs = require('node:fs');
const path = require('node:path');
const { walk, SCREENS, viewport, deviceArt } = require('./_harness.cjs');

const OUT = 'verification/round45_23/screens';
const WIDTH = 390, HEIGHT = 844;

// ── RN 스타일 → CSS ───────────────────────────────────────────────────────────────────────
const PX = new Set(['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'top', 'left', 'right', 'bottom', 'gap', 'rowGap', 'columnGap',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'borderRadius', 'fontSize', 'lineHeight', 'letterSpacing']);
const PAIRS = { marginHorizontal: ['margin-left', 'margin-right'], marginVertical: ['margin-top', 'margin-bottom'], paddingHorizontal: ['padding-left', 'padding-right'], paddingVertical: ['padding-top', 'padding-bottom'] };
const RENAME = { backgroundColor: 'background-color', borderColor: 'border-color', borderRadius: 'border-radius', borderWidth: 'border-width', borderTopWidth: 'border-top-width', borderBottomWidth: 'border-bottom-width', borderLeftWidth: 'border-left-width', borderRightWidth: 'border-right-width', flexDirection: 'flex-direction', justifyContent: 'justify-content', alignItems: 'align-items', alignSelf: 'align-self', flexWrap: 'flex-wrap', flexGrow: 'flex-grow', flexShrink: 'flex-shrink', flexBasis: 'flex-basis', fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height', letterSpacing: 'letter-spacing', textAlign: 'text-align', zIndex: 'z-index', aspectRatio: 'aspect-ratio', minWidth: 'min-width', minHeight: 'min-height', maxWidth: 'max-width', maxHeight: 'max-height', marginTop: 'margin-top', marginBottom: 'margin-bottom', marginLeft: 'margin-left', marginRight: 'margin-right', paddingTop: 'padding-top', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left', paddingRight: 'padding-right', textDecorationLine: 'text-decoration-line', textTransform: 'text-transform' };
const SKIP = new Set(['resizeMode', 'shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation', 'textAlignVertical', 'includeFontPadding', 'fontFamily', 'transform', 'borderCurve', 'objectFit']);

function css(style) {
  const out = [];
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || v === null || SKIP.has(k)) continue;
    const value = typeof v === 'number' && PX.has(k) ? v + 'px' : String(v);
    if (PAIRS[k]) { for (const p of PAIRS[k]) out.push(p + ':' + value); continue; }
    out.push((RENAME[k] ?? k) + ':' + value);
  }
  // RN 기본값은 CSS 와 다르다: 세로 쌓기 · 줄어들지 않음 · 기준 위치.
  if (!('flexDirection' in style)) out.unshift('flex-direction:column');
  if (!('flexShrink' in style) && !('flex' in style)) out.unshift('flex-shrink:0');
  if (!('position' in style)) out.unshift('position:relative');
  // CSS 는 border-style 이 없으면 두께를 무시한다(기본값 none). RN 은 두께만 주면 실선이다.
  // 이것을 옮기지 않아 지금까지 **모든 테두리가 그림에서 빠져 있었다**.
  // 한쪽 두께만 준 경우(예: 아래 선 하나) 나머지 세 변은 0 으로 못 박아야 한다 —
  // CSS 는 border-style 이 켜지면 두께를 적지 않은 변에 기본값(medium)을 넣어 네모가 생긴다.
  const sides = ['borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth'];
  const anyBorder = style.borderWidth || sides.some(k => style[k]);
  if (anyBorder && !style.borderStyle) {
    out.unshift('border-style:solid');
    if (!style.borderWidth) out.unshift('border-width:0');
  }
  if (style.flex === 1 && style.minHeight === undefined) out.push('min-height:0', 'min-width:0');
  // 그림자는 층을 가르는 용도라 옅게 옮긴다.
  if (style.shadowOpacity) out.push(`box-shadow:0 ${(style.shadowOffset?.height ?? 1)}px ${(style.shadowRadius ?? 2) * 2}px rgba(23,25,29,${style.shadowOpacity})`);
  return out.join(';');
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 노드 → HTML ──────────────────────────────────────────────────────────────────────────
const BOX = new Set(['View', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'SafeAreaView', 'SafeAreaProvider', 'Modal', 'Host']);
let modals = [];
const assets = { ok: 0, missing: [] };
// 정적 require → screens/assets/ 로 복사한 뒤 상대 경로로 가리킨다. HTML 을 그대로 열어도, 서버로 띄워도 보인다.
const copied = new Map();
function assetSrc(source) {
  const one = Array.isArray(source) ? source[0] : source;
  if (!one) return null;
  if (typeof one === 'string') return one.startsWith('data:') ? one : null;
  if (one.uri) {
    const uri = String(one.uri);
    if (uri.startsWith('data:')) return uri;
    // 기기에 저장된 작품. 이 검토에서는 실제 파일을 하나 넣어 두었으므로 그것을 가리킨다.
    const real = deviceArt[uri.split('/').pop()];
    return real ? copy(real) : null;
  }
  return one.__asset ? copy(one.__asset) : null;
}
function copy(file) {
  if (!file || !fs.existsSync(file)) return null;
  if (!copied.has(file)) {
    const name = path.basename(file);
    fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
    fs.copyFileSync(file, path.join(OUT, 'assets', name));
    copied.set(file, 'assets/' + name);
  }
  return copied.get(file);
}
function describeSource(source) {
  const one = Array.isArray(source) ? source[0] : source;
  if (!one) return '그림 없음';
  if (one.uri) return '기기에 저장된 그림 (' + String(one.uri).split('/').pop() + ')';
  if (one.__asset) return '번들 파일을 찾지 못함: ' + path.basename(one.__asset);
  return '알 수 없는 원본';
}
function render(node, flat) {
  if (node === null || node === undefined || node === false) return '';
  if (Array.isArray(node)) return node.map(c => render(c, flat)).join('');
  if (typeof node === 'string' || typeof node === 'number') return esc(node);
  const type = node.type, p = node.props ?? {};
  const kids = () => (node.children ?? []).map(c => render(c, flat)).join('');
  if (typeof type !== 'string') return kids();           // 합성 컴포넌트는 자식만 본다
  const style = flat(typeof p.style === 'function' ? p.style({ pressed: false }) : p.style);
  const title = p.accessibilityLabel ? ` title="${esc(p.accessibilityLabel)}"` : '';
  const slop = typeof p.hitSlop === 'number' ? { top: p.hitSlop, bottom: p.hitSlop, left: p.hitSlop, right: p.hitSlop }
    : p.hitSlop ? { top: 0, bottom: 0, left: 0, right: 0, ...p.hitSlop } : null;
  const press = typeof p.onPress === 'function'
    ? ` data-press="1"${slop ? ` data-slop="${slop.top},${slop.right},${slop.bottom},${slop.left}"` : ''}` : '';

  if (type === 'Text') {
    const s = css({ fontFamily: null, ...style });
    return `<span class="t" style="${s}">${kids()}</span>`;
  }
  if (type === 'Icon') {
    const size = p.size ?? 20;
    return `<i class="mdi mdi-${esc(p.name)}" style="font-size:${size}px;line-height:${size}px;color:${p.color ?? 'currentColor'};flex-shrink:0"></i>`;
  }
  if (type === 'Image') {
    // 번들에 들어가는 정적 require 는 실제 파일로 풀어 그대로 보여 준다(load-ts 가 경로를 남긴다).
    // 기기에만 있는 파일(작품 썸네일 등)은 이 렌더에 존재하지 않으므로 그 사실을 적는다.
    const src = assetSrc(p.source);
    const fit = style.resizeMode === 'cover' ? 'cover' : 'contain';
    if (src) { assets.ok++; return `<img class="real" src="${src}" style="${css(style)};object-fit:${fit}"${title} alt="${esc(p.accessibilityLabel ?? '')}">`; }
    assets.missing.push(describeSource(p.source));
    return `<div class="img none" style="${css(style)}"${title}><span>이 렌더에 없는 그림<br><small>${esc(describeSource(p.source))}</small></span></div>`;
  }
  if (type === 'TextInput') {
    const shown = p.value || p.placeholder || '';
    return `<div class="input" style="${css(style)}"${title}>${esc(shown)}</div>`;
  }
  if (type === 'WebView') {
    // 캔버스 안은 기존 엔진(canvas-html.ts)에 앱과 같은 init → save 를 보내 받은 합성 PNG 다.
    // 따로 그린 가짜가 아니다. 바탕(투명 바둑판·정사각 면)은 엔진 자신의 CSS 를 옮겼다.
    const shot = fs.existsSync(path.join(OUT, 'assets', 'canvas-sample.png')) ? 'assets/canvas-sample.png' : null;
    return shot
      ? `<div class="canvas"><div class="surface"><img src="${shot}" alt="엔진이 그린 시험 그림"></div></div>`
      : `<div class="canvas nofile"><span>엔진 시험 그림이 없다<br><small>scripts/_canvas.cjs 를 먼저 돌린다</small></span></div>`;
  }
  if (type === 'Slider') return `<div class="slider"></div>`;
  if (type === 'StatusBar') return '';
  if (type === 'Modal') { modals.push(kids()); return ''; }
  if (type === 'SafeAreaProvider' || type === 'SafeAreaView') {
    return `<div class="box" style="${css({ flex: 1, ...style })}">${kids()}</div>`;
  }
  if (BOX.has(type)) {
    const cls = type === 'ScrollView' ? 'box scroll' : 'box';
    // 가로 ScrollView 는 RN 에서 내용이 가로로 선다. 안 옮기면 세로로 쌓여 실제와 달라진다.
    const content = { ...(p.horizontal ? { flexDirection: 'row' } : {}), ...flat(p.contentContainerStyle) };
    const inner = type === 'ScrollView'
      ? `<div class="box" style="${css(content)}">${kids()}</div>` : kids();
    return `<div class="${cls}" style="${css(style)}"${title}${press}>${inner}</div>`;
  }
  return `<div class="box" style="${css(style)}"${title}>${kids()}</div>`;
}

const PAGE = (id, title, body) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css">
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:24px; background:#2A2D33; font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif; display:flex; flex-direction:column; align-items:center; gap:12px; }
  h1 { color:#E7E9EE; font-size:15px; font-weight:700; margin:0; }
  .meta { color:#9BA2AE; font-size:12px; margin:0 0 4px; text-align:center; max-width:${WIDTH * 1.4}px; line-height:1.6 }
  .phone { width:${WIDTH}px; height:${HEIGHT}px; display:flex; flex-direction:column; background:#FFFFFF; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,.45); position:relative; }
  .box { display:flex; box-sizing:border-box; }
  .scroll { overflow:visible; }
  .t { display:inline; box-sizing:border-box; white-space:pre-wrap; word-break:keep-all; }
  .img { display:flex; align-items:center; justify-content:center; text-align:center; background:#EFF1F5; color:#8B93A0; font-size:9px; line-height:1.3; box-sizing:border-box; }
  .img.none { background:repeating-linear-gradient(45deg,#F6E6E6 0 6px,#EFF1F5 6px 12px); color:#B42318; }
  img.real { display:block; box-sizing:border-box; }
  .input { display:flex; align-items:center; color:#17191D; box-sizing:border-box; }
  /* 엔진 자신의 바탕: 바깥은 #F4F4F5, 정사각 그림 면은 흰색 + 투명 바둑판(28px). canvas-html.ts 에서 옮겼다. */
  .canvas { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; color:#8B93A0; font-size:12px; line-height:1.6; background:#F4F4F5; }
  .canvas .surface { aspect-ratio:1; max-width:100%; max-height:100%; height:100%; background-color:#FFFFFF;
    background-image:conic-gradient(#F1F1F3 25%, transparent 0 50%, #F1F1F3 0 75%, transparent 0); background-size:28px 28px; }
  .canvas .surface img { width:100%; height:100%; display:block; object-fit:contain; }
  .canvas.nofile { background:repeating-linear-gradient(45deg,#F6E6E6 0 6px,#EFF1F5 6px 12px); color:#B42318; }
  .slider { height:4px; background:#CBD0DA; border-radius:2px; align-self:stretch; }
  .modal { position:absolute; inset:0; display:flex; flex-direction:column; z-index:50; }
</style></head>
<body>
<h1>${esc(title)}  ·  ${WIDTH}dp</h1>
<div class="phone">${body}</div>
<p class="meta">대체 렌더입니다. 실제 소스를 그려 나온 노드와 스타일을 그대로 옮긴 것이고, 실기기 캡처가 아닙니다.<br>
그림 에셋·그리기 캔버스·글꼴 메트릭·실제 스크롤 잘림은 이 그림으로 판정할 수 없습니다. 화면 id: <code>${esc(id)}</code></p>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const made = [];
  await walk(WIDTH, async (id, title, tree, flat) => {
    modals = []; assets.ok = 0; assets.missing = [];
    const main = render(tree.toJSON(), flat);
    const body = main + modals.map(m => `<div class="modal">${m}</div>`).join('');
    const file = path.join(OUT, id + '.html');
    fs.writeFileSync(file, PAGE(id, title, body));
    made.push({ id, title, file: id + '.html', bytes: fs.statSync(file).size, realImages: assets.ok, missingImages: assets.missing.slice() });
    console.log('  ' + id.padEnd(16) + ('실제 그림 ' + assets.ok + '장').padEnd(14) + (assets.missing.length ? '· 이 렌더에 없는 그림 ' + assets.missing.length + '장' : '') + '  ' + title);
  });
  // 비교용 목록: 한 줄에 하나씩, 열어 볼 링크와 함께.
  const index = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>임티제작소 화면 목록 · 390dp</title>
<style>body{margin:0;padding:28px;background:#14161A;color:#E7E9EE;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
h1{font-size:20px;margin:0 0 4px}p{color:#9BA2AE;font-size:13px;line-height:1.7;max-width:760px}
ol{padding-left:20px;line-height:2}a{color:#FFD52A}code{color:#9BA2AE;font-size:12px}
.grid{display:flex;flex-wrap:wrap;gap:20px;margin-top:24px}
.cell{width:${WIDTH / 2}px}.cell h2{font-size:12px;font-weight:600;color:#C7CCD6;margin:0 0 6px}
img.shot{width:${WIDTH / 2}px;display:block;box-shadow:0 4px 18px rgba(0,0,0,.5);background:#fff}</style></head>
<body><h1>임티제작소 · 화면별 디자인 검토 자료 (390dp)</h1>
<p>최신 소스(<code>${process.env.HEAD_SHORT ?? 'HEAD'}</code>)를 실제로 그려 만든 <b>대체 렌더</b>입니다. 꾸민 시안이 아니라 소스가 낸 노드·스타일을 옮긴 것입니다.
<b>실기기 캡처가 아닙니다</b> — 그림 에셋, 그리기 캔버스 내용, 글꼴 메트릭, 실제 스크롤 잘림은 이 자료로 판정할 수 없습니다.</p>
<ol>${made.map(m => `<li><a href="${m.id}.png">${esc(m.title)}</a> · <a href="${m.file}">HTML</a> <code>${m.id}</code></li>`).join('')}</ol>
<div class="grid">${made.map(m => `<div class="cell"><h2>${esc(m.title)}</h2><a href="${m.id}.png"><img class="shot" src="${m.id}.png" alt="${esc(m.title)}" loading="lazy"></a></div>`).join('')}</div>
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), index);
  fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(made, null, 2));
  console.log('\n  ' + made.length + '개 화면 · ' + OUT + '/index.html');
})().catch(e => { console.error(e); process.exit(1); });
