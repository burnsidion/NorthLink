const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function card({ showOwner = false, hideManageButton = false, currentUserId = 'owner', owner_user_id = 'owner' } = {}) {
  let expanded = false, managed, unshared;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: { useId: () => 'scroll-details-test', useState: () => [expanded, value => { expanded = typeof value === 'function' ? value(expanded) : value; }] },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' },
    '@/components/brand/profile-avatar': { ProfileAvatar: 'Avatar' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/lists/list-card.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { if (!(name in modules)) throw new Error('Unexpected dependency: ' + name); return modules[name]; } });
  const props = { list: { id: 'list', title: 'A long family Christmas list', created_at: '2026-11-15', total: 6, purchased: 2,
    owner_display_name: 'Family member', owner_user_id, group_id: 'group' }, showOwner, hideManageButton, currentUserId,
    onManage: (...args) => { managed = args; }, onUnshare: (...args) => { unshared = args; } };
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
  const all = () => nodes(exports.default(props));
  const toggle = () => all().find(node => node.props['aria-controls'] === 'scroll-details-test');
  return { all, toggle, managed: () => managed, unshared: () => unshared };
}
test('rolled cards retain the name, progress and working View list destination', () => {
  const page = card();
  assert.equal(page.toggle().props['aria-expanded'], false);
  assert.ok(page.all().some(node => node.type === 'h2' && node.props.children === 'A long family Christmas list'));
  assert.ok(page.all().some(node => node.props.role === 'progressbar' && node.props['aria-valuenow'] === 2));
  assert.equal(page.all().find(node => node.type === 'Link').props.href, '/lists/list');
  const details = page.all().find(node => node.props.id === 'scroll-details-test');
  assert.equal(details.props.inert, true); assert.equal(details.props['aria-hidden'], true);
});
test('unrolling makes extra details operable; rolling up hides them without changing navigation', () => {
  const page = card();
  page.toggle().props.onClick();
  assert.equal(page.toggle().props['aria-expanded'], true);
  const details = page.all().find(node => node.props.id === 'scroll-details-test');
  assert.equal(details.props.inert, false); assert.equal(details.props['aria-hidden'], false);
  page.all().find(node => node.props['aria-label'] === 'Manage list A long family Christmas list').props.onClick();
  assert.deepEqual(page.managed(), ['list', 'A long family Christmas list']);
  page.toggle().props.onClick(); assert.equal(page.toggle().props['aria-expanded'], false);
  assert.equal(page.all().find(node => node.type === 'Link').props.href, '/lists/list');
});
test('family owner identity remains visible when requested and management controls preserve their existing visibility rules', () => {
  const page = card({ showOwner: true, hideManageButton: true, currentUserId: 'shopper' });
  assert.ok(page.all().some(node => node.type === 'span' && Array.isArray(node.props.children) && node.props.children.includes('Family member')));
  assert.equal(page.all().some(node => node.props['aria-label']?.startsWith('Manage list')), false);
  assert.equal(page.all().some(node => node.type === 'button' && node.props.children === 'Unshare from family'), false);
  const owner = card(); owner.toggle().props.onClick();
  owner.all().find(node => node.type === 'button' && node.props.children === 'Unshare from family').props.onClick();
  assert.deepEqual(owner.unshared(), ['list', 'group']);
});
