// 대체 렌더: 실제 App 을 그린 뒤, 그려진 노드와 스타일을 그대로 HTML 로 옮긴다.
// **꾸민 시안이 아니다** — 여기 나오는 상자·글자·색·간격은 전부 소스가 만든 값이고, 이 파일은 옮기기만 한다.
// **실기기 캡처도 아니다** — 아래 '이 그림의 한계'를 읽어라.
const fs = require('node:fs');
const path = require('node:path');
const { walk, SCREENS, viewport } = require('./_harness.cjs');

const OUT = 'verification/round45_23/screens';
const WIDTH = 390, HEIGHT = 844;

// ── RN 스타일 → CSS ───────────────────────────────────────────────────────────────────────
const PX = new Set(['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'top', 'left', 'right', 'bottom', 'gap', 'rowGap', 'columnGap',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'borderRadius', 'fontSize', 'lineHeight', 'letterSpacing']);
const PAIRS = { marginHorizontal: ['margin-left', 'margin-right'], marginVertical: ['margin-top', 'margin-bottom'], paddingHorizontal: ['padding-left', 'padding-right'], paddingVertical: ['padding-top', 'padding-bottom'] };
const RENAME = { backgroundColor: 'background-color', borderColor: 'border-color', borderRadius: 'border-radius', borderWidth: 'border-width', borderTopWidth: 'border-top-width', borderBottomWidth: 'border-bottom-width', borderLeftWidth: 'border-left-width', borderRightWidth: 'border-right-width', flexDirection: 'flex-direction', justifyContent: 'justify-content', alignItems: 'align-items', alignSelf: 'align-self', flexWrap: 'flex-wrap', flexGrow: 'flex-grow', flexShrink: 'flex-shrink', flexBasis: 'flex-basis', fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height', letterSpacing: 'letter-spacing', textAlign: 'text-align', zIndex: 'z-index', aspectRatio: 'aspect-ratio', minWidth: 'min-width', minHeight: 'min-height', maxWidth: 'max-width', maxHeight: 'max-height', marginTop: 'margin-top', marginBottom: 'margin-bottom', marginLeft: 'margin-left', marginRight: 'margin-right', paddingTop: 'padding-top', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left', paddingRight: 'padding-right', textDecorationLine: 'text-decoration-line', textTransform: 'text-transform' };
const SKIP = new Set(['resizeMode', 'shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation', 'textAlignVertical', 'includeFontPadding', 'fontFamily', 'transform', 'borderStyle', 'borderCurve', 'objectFit']);

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
  if (style.flex === 1 && style.minHeight === undefined) out.push('min-height:0', 'min-width:0');
  // 그림자는 층을 가르는 용도라 옅게 옮긴다.
  if (style.shadowOpacity) out.push(`box-shadow:0 ${(style.shadowOffset?.height ?? 1)}px ${(style.shadowRadius ?? 2) * 2}px rgba(23,25,29,${style.shadowOpacity})`);
  return out.join(';');
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 노드 → HTML ──────────────────────────────────────────────────────────────────────────
const BOX = new Set(['View', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'SafeAreaView', 'SafeAreaProvider', 'Modal', 'Host']);
let modals = [];
function render(node, flat) {
  if (node === null || node === undefined || node === false) return '';
  if (Array.isArray(node)) return node.map(c => render(c, flat)).join('');
  if (typeof node === 'string' || typeof node === 'number') return esc(node);
  const type = node.type, p = node.props ?? {};
  const kids = () => (node.children ?? []).map(c => render(c, flat)).join('');
  if (typeof type !== 'string') return kids();           // 합성 컴포넌트는 자식만 본다
  const style = flat(typeof p.style === 'function' ? p.style({ pressed: false }) : p.style);
  const title = p.accessibilityLabel ? ` title="${esc(p.accessibilityLabel)}"` : '';

  if (type === 'Text') {
    const s = css({ fontFamily: null, ...style });
    return `<span class="t" style="${s}">${kids()}</span>`;
  }
  if (type === 'Icon') {
    const size = p.size ?? 20;
    return `<i class="mdi mdi-${esc(p.name)}" style="font-size:${size}px;line-height:${size}px;color:${p.color ?? 'currentColor'};flex-shrink:0"></i>`;
  }
  if (type === 'Image') {
    // 그림 자체는 이 렌더에 없다(번들 에셋·기기 파일). 자리와 크기만 정직하게 표시한다.
    return `<div class="img" style="${css(style)}"${title}><span>그림</span></div>`;
  }
  if (type === 'TextInput') {
    const shown = p.value || p.placeholder || '';
    return `<div class="input" style="${css(style)}"${title}>${esc(shown)}</div>`;
  }
  if (type === 'WebView') {
    return `<div class="canvas"><span>그리기 캔버스<br><small>실제 그림은 기기의 WebView 가 그린다</small></span></div>`;
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
    return `<div class="${cls}" style="${css(style)}"${title}>${inner}</div>`;
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
  .img { display:flex; align-items:center; justify-content:center; background:#EFF1F5; color:#8B93A0; font-size:10px; box-sizing:border-box; }
  .input { display:flex; align-items:center; color:#17191D; box-sizing:border-box; }
  .canvas { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; color:#8B93A0; font-size:12px; line-height:1.6;
            background:repeating-conic-gradient(#F2F3F6 0% 25%, #FFFFFF 0% 50%) 50%/16px 16px; }
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
    modals = [];
    const main = render(tree.toJSON(), flat);
    const body = main + modals.map(m => `<div class="modal">${m}</div>`).join('');
    const file = path.join(OUT, id + '.html');
    fs.writeFileSync(file, PAGE(id, title, body));
    made.push({ id, title, file: id + '.html', bytes: fs.statSync(file).size });
    console.log('  ' + id.padEnd(16) + title);
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
