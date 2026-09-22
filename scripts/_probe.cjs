const h = require('./_harness.cjs');
h.walk(390, async (id, title, tree) => {
  if (id !== 'export-result') return;
  const t = tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('')).filter(Boolean);
  console.log(JSON.stringify(t.slice(-8)));
}).catch(e => console.error('멈춘 곳:', e.message));
