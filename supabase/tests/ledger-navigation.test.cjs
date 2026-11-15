const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual navigation contract without signing in or changing family data.
function frame(pathname) {
  let focused = false;
  const details = { open: true, querySelector: selector => {
    assert.equal(selector, 'summary'); return { focus: () => { focused = true; } };
  } };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: { useRef: () => ({ current: details }) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'Link' },
    'next/navigation': { usePathname: () => pathname },
    '@/components/brand/cybersanta-brand': { CyberSantaBrand: 'Brand' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/nav/ledger-frame.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { if (!(name in modules)) throw new Error('Unexpected dependency: ' + name); return modules[name]; } });
  const tree = exports.default({ children: 'SCREEN' });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  }
  return { all: nodes(tree), details, focused: () => focused };
}
test('desktop and mobile navigation preserve destinations and mark only the current page', () => {
  for (const pathname of ['/user-lists', '/family-lists', '/purchased-items', '/landing']) {
    const page = frame(pathname);
    for (const label of ['Primary navigation', 'Mobile navigation']) {
      const nav = page.all.find(node => node.props['aria-label'] === label);
      const links = Array.from(nav.props.children.flat(Infinity)).filter(node => node?.type === 'Link');
      for (const href of ['/user-lists', '/family-lists', '/purchased-items']) assert.ok(links.some(node => node.props.href === href));
      assert.deepEqual(links.filter(node => node.props['aria-current'] === 'page').map(node => node.props.href), pathname === '/landing' ? [] : [pathname]);
    }
    for (const href of ['/onboarding', '/api/logout', '/landing']) assert.ok(page.all.some(node => node.props.href === href));
    assert.ok(page.all.some(node => node.props.href === '#page-content'));
    assert.ok(page.all.some(node => node.props.id === 'page-content' && node.props.children === 'SCREEN'));
  }
});
test('selecting a destination closes the menu; Escape closes it and returns focus to its toggle', () => {
  const page = frame('/user-lists');
  page.all.find(node => node.props.href === '/family-lists').props.onClick();
  assert.equal(page.details.open, false);
  page.details.open = true;
  page.all.find(node => node.type === 'details').props.onKeyDown({ key: 'Escape' });
  assert.equal(page.details.open, false); assert.equal(page.focused(), true);
});
