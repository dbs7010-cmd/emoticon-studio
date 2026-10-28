// Idempotent, AST-scoped migration of reviewed app copy. Never edits painter or services.
const fs = require('node:fs');
const ts = require('typescript');
const rows = require('../src/i18n/reviewed-copy.json');
const mapping = new Map(rows.map(([key, ko]) => [ko, key]));
for (const [file, column] of [['ko', 1], ['ja', 2], ['zh-Hant', 3]]) {
  const path = 'src/i18n/' + file + '.ts'; let text = fs.readFileSync(path, 'utf8');
  const marker = file === 'ko' ? '} as const;' : '};';
  const missing = rows.filter(([key]) => !text.includes("'" + key + "':") && !text.includes(JSON.stringify(key) + ':'));
  const add = missing.map(row => '  ' + JSON.stringify(row[0]) + ': ' + JSON.stringify(row[column]) + ',').join('\n');
  if (add) text = text.slice(0, text.lastIndexOf(marker)) + '\n' + add + '\n' + text.slice(text.lastIndexOf(marker));
  fs.writeFileSync(path, text);
}
const paths = ['App.tsx', 'src/components/app-ui.tsx', 'src/components/cloud-screen.tsx', 'src/components/onboarding.tsx', 'src/components/lesson-view.tsx', 'src/components/notice-carousel.tsx', 'src/constants/guidebook.ts', 'src/constants/lessons.ts'];
const props = new Set(['title', 'label', 'message', 'body', 'subtitle', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'actionLabel', 'actionTitle', 'nextLabel', 'text', 'closeLabel', 'section']);
const dataProps = new Set(['title', 'summary', 'body', 'hint', 'short', 'label', 'action']);
const counts = [];
for (const path of paths) {
  let text = fs.readFileSync(path, 'utf8'); const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true); const edits = [];
  const eligible = n => {
    if (ts.isJsxText(n)) return true;
    if (n.text === '새 이모티콘 세트') return true;
    if (path.includes('/constants/') && ts.isPropertyAssignment(n.parent) && dataProps.has(n.parent.name.getText(sf))) return true;
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return props.has(p.name.getText(sf));
      if (ts.isJsxExpression(p) && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent))) return true;
      if (ts.isFunctionLike(p) || ts.isStatement(p)) break;
    }
    return false;
  };
  function walk(n) {
    if ((ts.isStringLiteral(n) || ts.isJsxText(n) || ts.isNoSubstitutionTemplateLiteral(n)) && mapping.has(n.text.trim()) && eligible(n)) {
      const call = "t('" + mapping.get(n.text.trim()) + "')";
      const padded = ts.isJsxText(n) ? call : (n.text.match(/^\s+/)?.[0] ? JSON.stringify(n.text.match(/^\s+/)[0]) + ' + ' : '') + call + (n.text.match(/\s+$/)?.[0] ? ' + ' + JSON.stringify(n.text.match(/\s+$/)[0]) : '');
      const replacement = ts.isJsxText(n) || ts.isJsxAttribute(n.parent) ? '{' + padded + '}' : padded;
      edits.push({ start: n.getStart(sf), end: n.end, replacement });
    }
    ts.forEachChild(n, walk);
  }
  walk(sf); for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  if (edits.length && !/import\s*\{[^}]*\bt\b[^}]*\}\s*from ['"][^'"]*i18n\/index['"]/.test(text)) text = "import { t } from '../i18n/index';\n" + text;
  fs.writeFileSync(path, text); counts.push({ file: path, translatedOccurrences: edits.length });
}
console.log(JSON.stringify(counts, null, 2));
