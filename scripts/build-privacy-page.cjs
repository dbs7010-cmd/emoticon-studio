// 개인정보처리방침 공개 페이지 만들기: docs/PRIVACY_POLICY_KO.md → site/privacy/index.html (GitHub Pages 등 정적 호스팅용).
// · 초안 안내 인용문과 '기술 근거 대조표'(게시 시 제외) 절은 빼고 옮긴다.
// · [OWNER INPUT REQUIRED] 가 하나라도 남아 있으면 게시용 파일을 만들지 않고 종료 코드 1 — 지어낸 값으로 채우지 않는다.
//   --preview 를 주면 남은 자리를 눈에 띄게 표시한 미리보기(site/privacy/preview.html)만 만든다(게시 금지).
// 사용: node scripts/build-privacy-page.cjs [--preview]
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const preview = process.argv.includes('--preview');
let md = fs.readFileSync(path.join(root, 'docs/PRIVACY_POLICY_KO.md'), 'utf8').replace(/\r\n/g, '\n');
md = md.split('\n---\n### 기술 근거 대조표')[0];
md = md.split('\n').filter(l => !l.startsWith('>')).join('\n');
const missing = (md.match(/\[OWNER INPUT REQUIRED[^\]]*\]/g) || []);
if (missing.length && !preview) {
  console.error(`게시용 페이지를 만들지 않았어요: 운영자 입력 ${missing.length}곳이 남아 있어요(docs/PRIVACY_POLICY_KO.md). 미리보기는 --preview`);
  process.exit(1);
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[OWNER INPUT REQUIRED([^\]]*)\]/g, '<mark>[운영자 입력 필요$1]</mark>');
const out = []; let list = false, table = null;
const flush = () => { if (list) { out.push('</ul>'); list = false; } if (table) { out.push(table.join('\n') + '</tbody></table>'); table = null; } };
for (const line of md.split('\n')) {
  if (/^\|/.test(line)) {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.every(c => /^-+$/.test(c))) continue;
    if (!table) { flush(); table = ['<table><thead><tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>']; }
    else table.push('<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>');
    continue;
  }
  if (table) flush();
  const h = line.match(/^(#{1,3})\s+(.*)/);
  if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
  const li = line.match(/^\s*-\s+(.*)/);
  if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
  if (!line.trim() || line.trim() === '---') { flush(); continue; }
  flush(); out.push(`<p>${inline(line)}</p>`);
}
flush();
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>emoti 이모티 · 개인정보처리방침</title>
<style>
:root{--ink:#1F1D1A;--muted:#6B655E;--line:#ECE9E3;--soft:#F6F5F2;--accent:#FFCC2E}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.7 system-ui,-apple-system,"Noto Sans KR",sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:26px;line-height:1.3;margin:0 0 16px}h2{font-size:20px;margin:36px 0 8px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:17px;margin:24px 0 6px}
table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0;display:block;overflow-x:auto}th,td{border:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}th{background:var(--soft)}
code{background:var(--soft);padding:1px 5px;border-radius:4px;font-size:.92em}mark{background:#FFF4CC;color:var(--ink);padding:0 3px}
ul{padding-left:22px}
</style></head><body><main>
${preview ? '<p><mark>미리보기 — 운영자 입력이 남아 있어 게시하면 안 됩니다.</mark></p>\n' : ''}${out.join('\n')}
</main></body></html>
`;
const dest = path.join(root, 'site/privacy', preview ? 'preview.html' : 'index.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, html);
console.log((preview ? '미리보기: ' : '게시용: ') + path.relative(root, dest) + (missing.length ? ` (운영자 입력 ${missing.length}곳 남음)` : ''));
