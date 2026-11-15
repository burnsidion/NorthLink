const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, modules) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in modules)) throw new Error('Unexpected import: ' + name);
    return modules[name];
  } });
  return exports;
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
const complete = { display_name: 'Name', avatar_url: 'https://example.com/avatar.png' };
function service({ user = { id: 'A' }, authError = null, profile = complete, lookupError = null, saveError = null, saved = complete } = {}) {
  const writes = [];
  const query = {
    select() { return query; }, eq() { return query; },
    maybeSingle: async () => ({ data: profile, error: lookupError }),
    upsert(data, options) { writes.push({ data, options }); return query; },
    single: async () => ({ data: saved, error: saveError }),
  };
  const helpers = load('src/lib/auth-helpers.ts', {
    '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user }, error: authError }) }, from: () => query } },
    '@supabase/supabase-js': { isAuthSessionMissingError: error => error?.name === 'AuthSessionMissingError' },
  });
  return { ...helpers, writes };
}

test('access distinguishes signed-out, missing/incomplete profile, and returning users', async () => {
  assert.equal(await service({ user: null, authError: { name: 'AuthSessionMissingError' } }).getProfileAccess(), 'signed-out');
  for (const profile of [null, {}, { ...complete, display_name: '  ' }, { ...complete, avatar_url: '' }]) {
    assert.equal(await service({ profile }).getProfileAccess(), 'incomplete');
  }
  assert.equal(await service().getProfileAccess(), 'ready');
});
test('lookup and auth failures are retryable errors, never mistaken for missing profiles', async () => {
  for (const options of [{ authError: new Error('offline') }, { lookupError: new Error('offline') }]) {
    await assert.rejects(service(options).getProfileAccess(), /offline/);
  }
});
test('save verifies the account, trims the name, and confirms persistence', async () => {
  const helpers = service();
  await helpers.saveSetupProfile('A', '  Name  ', complete.avatar_url);
  assert.equal(helpers.writes[0].data.id, 'A');
  assert.equal(helpers.writes[0].data.display_name, 'Name');
  for (const options of [{ user: null }, { user: { id: 'B' } }, { authError: new Error('offline') }]) {
    const other = service(options);
    await assert.rejects(other.saveSetupProfile('A', 'Name', complete.avatar_url));
    assert.equal(other.writes.length, 0);
  }
  await assert.rejects(service({ saveError: new Error('denied') }).saveSetupProfile('A', 'Name', complete.avatar_url), /denied/);
  await assert.rejects(service({ saved: null }).saveSetupProfile('A', 'Name', complete.avatar_url), /not confirmed/);
  await assert.rejects(helpers.saveSetupProfile('A', '  ', complete.avatar_url), /incomplete/);
});

// Run the actual components with deterministic hooks and request timing.
function screen(path, helpers, props = {}) {
  let cursor = 0, callback;
  const slots = [], pending = [], cleanups = [], redirects = [], stateWrites = [];
  const hooks = {
    useState(initial) {
      const key = cursor++;
      if (!(key in slots)) slots[key] = initial;
      return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; stateWrites.push(key); }];
    },
    useRef(initial) { const key = cursor++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key]; },
    useEffect(effect, deps) {
      const key = cursor++;
      if (!(key in slots) || deps.some((value, i) => value !== slots[key][i])) {
        slots[key] = deps; pending.push(() => { cleanups[key]?.(); cleanups[key] = effect(); });
      }
    },
  };
  const router = { replace: url => redirects.push(url) };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const component = load(path, {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => router },
    '@/lib/supabase': { supabase: { auth: { onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; } } } },
    '@/lib/auth-helpers': helpers,
    '@/lib/avatars': { AVATARS: ['https://example.com/default.png', 'https://example.com/other.png'] },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/components/ui/stars-background': { StarsBackground: 'Stars' }, '@/components/ui/snowfall': { default: 'Snow' },
  }).default;
  function render() { cursor = 0; const tree = component(props); while (pending.length) pending.shift()(); return tree; }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  }
  const all = () => nodes(render());
  const button = label => all().find(node => node.type === 'button' && node.props.children === label);
  render();
  return {
    render, all, button, redirects, stateWrites,
    event: (event, session) => callback(event, session),
    unmount: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}
const gatePath = 'src/components/auth/profile-gate.tsx';
const setupPath = 'src/app/onboarding/page.tsx';
test('direct links hold back children until complete; root and incomplete users go to the right pages', async () => {
  for (const [access, destination] of [['signed-out','/login'], ['incomplete','/onboarding'], ['ready',null]]) {
    const pending = deferred();
    const page = screen(gatePath, { getProfileAccess: () => pending.promise }, { children: 'PRIVATE' });
    assert.notEqual(page.render(), 'PRIVATE');
    pending.resolve(access); await flush();
    if (destination) assert.deepEqual(page.redirects, [destination]);
    else assert.equal(page.render(), 'PRIVATE');
    page.unmount();
  }
  const root = screen(gatePath, { getProfileAccess: async () => 'ready' }, { redirectReadyTo: '/landing' });
  await flush(); assert.deepEqual(root.redirects, ['/landing']); root.unmount();
});
test('gate failures keep children hidden, offer retry, and recover without redirecting to setup', async () => {
  let calls = 0;
  const page = screen(gatePath, { getProfileAccess: async () => { if (++calls === 1) throw new Error('offline'); return 'ready'; } }, { children: 'PRIVATE' });
  await flush(); assert.ok(page.all().some(node => node.props.role === 'alert'));
  assert.deepEqual(page.redirects, []);
  page.button('Try again').props.onClick(); page.render(); await flush();
  assert.equal(page.render(), 'PRIVATE'); page.unmount();
});
test('sign-out and unmount invalidate a pending successful profile check', async () => {
  for (const event of ['SIGNED_OUT', 'unmount']) {
    const pending = deferred();
    const page = screen(gatePath, { getProfileAccess: () => pending.promise }, { children: 'PRIVATE' });
    if (event === 'unmount') page.unmount(); else page.event(event);
    const writes = page.stateWrites.length;
    pending.resolve('ready'); await flush();
    assert.equal(page.stateWrites.length, writes);
    assert.deepEqual(page.redirects, []);
  }
});
test('setup uses a real default avatar and preserves edits after a failed save; double clicks write once', async () => {
  let calls = 0; const pending = deferred();
  const page = screen(setupPath, { getProfileUser: async () => ({ id: 'A' }), getUserProfile: async () => null,
    saveSetupProfile: async (id, name, avatar) => {
      calls++; assert.equal(id, 'A'); assert.equal(name, 'New name'); assert.equal(avatar, 'https://example.com/default.png');
      if (calls === 1) return pending.promise;
    } });
  await flush();
  page.all().find(node => node.type === 'input').props.onChange({ target: { value: 'New name' } });
  const click = page.button('Save & continue').props.onClick;
  const saving = click(); await click(); assert.equal(calls, 1);
  assert.equal(page.button('Saving…').props.disabled, true);
  pending.reject(new Error('offline')); await saving;
  assert.equal(page.all().find(node => node.type === 'input').props.value, 'New name');
  assert.ok(page.all().some(node => node.props.role === 'alert'));
  assert.deepEqual(page.redirects, []);
  await page.button('Save & continue').props.onClick();
  assert.deepEqual(page.redirects, ['/landing']); page.unmount();
});
test('setup lookup failures block editing until retry, and signed-out users go to login', async () => {
  let calls = 0;
  const page = screen(setupPath, { getProfileUser: async () => ({ id: 'A' }), getUserProfile: async () => { if (++calls === 1) throw new Error('offline'); return complete; } });
  await flush(); assert.equal(page.all().filter(node => node.type === 'input').length, 0);
  page.button('Try again').props.onClick(); page.render(); await flush();
  assert.equal(page.all().find(node => node.type === 'input').props.value, 'Name'); page.unmount();
  const signedOut = screen(setupPath, { getProfileUser: async () => null });
  await flush(); assert.deepEqual(signedOut.redirects, ['/login']); signedOut.unmount();
});
test('leaving setup during a save prevents late redirects or state updates', async () => {
  const pending = deferred();
  const page = screen(setupPath, { getProfileUser: async () => ({ id: 'A' }), getUserProfile: async () => complete, saveSetupProfile: () => pending.promise });
  await flush(); const saving = page.button('Save & continue').props.onClick(); page.unmount();
  const writes = page.stateWrites.length;
  pending.resolve(); await saving;
  assert.equal(page.stateWrites.length, writes); assert.deepEqual(page.redirects, []);
});

test('returning to the tab keeps setup edits; changing accounts discards late results', async () => {
  const pending = deferred(); let userId = 'A';
  const page = screen(setupPath, { getProfileUser: async () => ({ id: userId }),
    getUserProfile: async id => id === 'A' ? complete : pending.promise });
  await flush();
  page.all().find(node => node.type === 'input').props.onChange({ target: { value: 'Unsaved edit' } });
  page.event('SIGNED_IN', { user: { id: 'A' } }); page.render(); await flush();
  assert.equal(page.all().find(node => node.type === 'input').props.value, 'Unsaved edit');
  userId = 'B'; page.event('SIGNED_IN', { user: { id: 'B' } }); page.render(); await flush();
  assert.equal(page.all().filter(node => node.type === 'input').length, 0);
  page.event('SIGNED_OUT'); const count = page.stateWrites.length;
  pending.resolve(complete); await flush();
  assert.equal(page.stateWrites.length, count);
  page.unmount();
});
