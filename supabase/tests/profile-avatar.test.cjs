const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function avatar() {
 let failed = null;
 const jsx = (type, props) => ({ type, props });
 const modules = {
  react: { useState: () => [failed, value => { failed = value; }] },
  'react/jsx-runtime': { jsx, jsxs: jsx },
 };
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/brand/profile-avatar.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
 }).outputText, { exports, require: name => modules[name] });
 return props => exports.ProfileAvatar(props);
}
test('broken saved avatars show an accessible fallback; selecting a new image can load without changing saved data', () => {
 const render = avatar();
 const props = { src: 'https://example.com/old.gif', name: 'Holly', size: 40 };
 const before = render(props);
 assert.equal(before.props.children.type, 'img');
 before.props.children.props.onError();
 const fallback = render(props);
 assert.equal(fallback.props.role, 'img');
 assert.equal(fallback.props['aria-label'], 'Holly avatar unavailable');
 assert.equal(fallback.props.children.props.children, 'H');
 assert.equal(props.src, 'https://example.com/old.gif');
 assert.equal(render({ ...props, src: 'https://example.com/new.png' }).props.children.type, 'img');
});
test('missing or unsafe avatar sources use a deliberate fallback without sending image requests', () => {
 for (const src of [null, '', 'http://example.com/a.png', 'javascript:alert(1)']) {
  const view = avatar()({ src, name: '   ' });
  assert.equal(view.props.children.type, 'span');
  assert.equal(view.props.children.props.children, '?');
 }
});
