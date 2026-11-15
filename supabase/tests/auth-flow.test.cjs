const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, modules, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, URLSearchParams, ...globals, require: name => {
    if (!(name in modules)) throw new Error('Unexpected import: ' + name);
    return modules[name];
  } });
  return exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n=0; n<6; n++) await new Promise(setImmediate); };
function flow({ initialize = async () => ({ error: null }), access = async () => 'ready', signOut = async () => ({ error: null }) } = {}) {
  return load('src/lib/auth-flow.ts', {
    '@/lib/supabase': { supabase: { auth: { initialize, signOut } } },
    '@/lib/auth-helpers': { getProfileAccess: access },
  });
}
const callback = 'https://app.example/api/auth/callback';

test('destinations allow only known app pages; external, encoded and looping destinations are rejected', () => {
  const { safeAuthDestination: safe } = flow();
  for (const value of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example',
    '/login', '/onboarding', '/api/logout', '/api/auth/callback', ' /user-lists', '/\n/user-lists', '/lists/not-a-uuid', '/user-lists/../api/logout']) {
    assert.equal(safe(value), '/landing', String(value));
  }
  for (const path of ['/user-lists', '/family-lists', '/purchased-items', '/lists/12345678-1234-1234-1234-123456789abc']) {
    assert.equal(safe(path), path);
    assert.equal(safe(path + '?access_token=private#private'), path);
  }
});
test('callback waits for SDK persistence before checking profile and honoring a safe destination', async () => {
  const pending = deferred(); let checked = false;
  const helpers = flow({ initialize: () => pending.promise, access: async () => { checked=true; return 'ready'; } });
  const request = helpers.finishAuthCallback(callback + '?next=/user-lists#access_token=synthetic');
  await flush(); assert.equal(checked, false);
  pending.resolve({ error: null }); assert.equal(await request, '/user-lists');
  assert.equal(await flow({ access: async () => 'incomplete' }).finishAuthCallback(callback), '/onboarding');
  assert.equal(await flow().finishAuthCallback(callback + '?next=https://evil.example'), '/landing');
});
test('expired, malformed, missing and wrong-format links never succeed via a previously stored session', async () => {
  for (const suffix of ['?error=access_denied', '#error_code=otp_expired', '?error_description=private', '?code=used-code']) {
    let checked = false;
    const helpers = flow({ access: async () => { checked=true; return 'ready'; } });
    await assert.rejects(helpers.finishAuthCallback(callback + suffix));
    assert.equal(checked, false);
  }
  await assert.rejects(flow({ initialize: async () => ({ error: new Error('bad token') }) }).finishAuthCallback(callback));
  await assert.rejects(flow({ access: async () => 'signed-out' }).finishAuthCallback(callback), /No sign-in session/);
  await assert.rejects(flow({ access: async () => { throw new Error('offline'); } }).finishAuthCallback(callback), /offline/);
});
test('logout deduplicates concurrent requests, preserves all-device scope, and permits retry after failure', async () => {
  const pending = deferred(); let calls = 0;
  const helpers = flow({ signOut: async options => {
    assert.equal(options.scope, 'global'); calls++;
    return calls === 1 ? pending.promise : { error: null };
  } });
  const first = helpers.signOutBrowser(); const second = helpers.signOutBrowser();
  assert.equal(first, second); assert.equal(calls, 1);
  pending.resolve({ error: new Error('offline') });
  await assert.rejects(first, /offline/); await assert.rejects(second, /offline/);
  await helpers.signOutBrowser(); assert.equal(calls, 2);
});
test('invalid sessions are signed out; temporary auth failures still propagate for retry', async () => {
  for (const error of [{ status: 401 }, { code: 'session_expired' }, { code: 'session_not_found' },
    { code: 'refresh_token_not_found' }, { code: 'refresh_token_already_used' }, { code: 'user_not_found' }, { name: 'AuthSessionMissingError' }]) {
    const helpers = load('src/lib/auth-helpers.ts', {
      '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user: null }, error }) } } },
      '@supabase/supabase-js': { isAuthSessionMissingError: e => e?.name === 'AuthSessionMissingError' },
    });
    assert.equal(await helpers.getProfileUser(), null);
  }
  const helpers = load('src/lib/auth-helpers.ts', {
    '@/lib/supabase': { supabase: { auth: { getUser: async () => ({ data: { user: null }, error: new Error('offline') }) } } },
    '@supabase/supabase-js': { isAuthSessionMissingError: () => false },
  });
  await assert.rejects(helpers.getProfileUser(), /offline/);
});

// Deterministic hook harness exercises actual page effects and request completion.
function screen(path, { finish = async () => '/landing', logout = async () => {}, user = async () => null } = {}) {
  let cursor=0, authCallback;
  const slots=[], pending=[], effects=[], cleanups=[], redirects=[], history=[], stateWrites=[];
  const hooks = {
    useState(initial) { const key=cursor++; if (!(key in slots)) slots[key]=initial;
      return [slots[key], value => { slots[key]=typeof value==='function' ? value(slots[key]) : value; stateWrites.push(key); }]; },
    useRef(initial) { const key=cursor++; if (!(key in slots)) slots[key]={ current: initial }; return slots[key]; },
    useEffect(effect, deps) { const key=cursor++;
      if (!(key in slots) || deps.some((value,i) => value!==slots[key][i])) {
        slots[key]=deps; effects[key]=effect; pending.push(() => { cleanups[key]?.(); cleanups[key]=effect(); });
      }
    },
  };
  const router={ replace: url => redirects.push(url) };
  const jsx=(type, props) => ({ type, props: props ?? {} });
  const window={ location: { href: callback + '?next=/user-lists#error_description=private', replace: router.replace },
    history: { state: null, replaceState: (_state,_title,url) => history.push(url) } };
  const component=load(path, {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/brand/cybersanta-brand': { CyberSantaBrand: 'Brand' },
    '@/components/brand/profile-avatar': { ProfileAvatar: 'Avatar' }, 'next/navigation': { useRouter: () => router }, 'next/link': { default: 'Link' },
    '@/lib/auth-flow': { finishAuthCallback: finish, signOutBrowser: logout }, '@/lib/auth-helpers': { getProfileUser: user },
    '@/lib/supabase': { supabase: { auth: { onAuthStateChange(fn) { authCallback=fn; return { data: { subscription: { unsubscribe() {} } } }; } } } },
    '@supabase/auth-ui-react': { Auth: 'Auth' }, '@supabase/auth-ui-shared': { ThemeSupa: {} }, 'motion/react': { motion: { div: 'motion.div' } },
    '@/components/ui/stars-background': { StarsBackground: 'Stars' }, '@/components/ui/snowfall': { default: 'Snow' }, '@/components/ui/border-beam': { BorderBeam: 'Beam' },
  }, { window }).default;
  function render() { cursor=0; const tree=component(); while (pending.length) pending.shift()(); return tree; }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node && typeof node==='object' ? [node,...nodes(node.props?.children)] : []; }
  const all=() => nodes(render()); render();
  return { render, all, redirects, history, stateWrites,
    retry: () => all().find(node => node.type==='button' && node.props.children==='Try again').props.onClick(),
    event: event => authCallback(event), unmount: () => cleanups.forEach(fn => fn?.()),
    replay: () => { cleanups.forEach(fn => fn?.()); effects.forEach((effect,key) => { cleanups[key]=effect(); }); },
  };
}
const callbackPage='src/app/api/auth/callback/page.tsx';
const logoutPage='src/app/api/logout/page.tsx';
test('callback failure shows generic recovery, scrubs private URL data and retries the original destination', async () => {
  let calls=0;
  const page=screen(callbackPage, { finish: async url => {
    assert.equal(url, callback + '?next=/user-lists#error_description=private');
    if (++calls===1) throw new Error('private provider details'); return '/user-lists';
  } });
  await flush();
  const alert=page.all().find(node => node.props.role==='alert'); assert.ok(alert); assert.doesNotMatch(alert.props.children, /private provider/);
  assert.deepEqual(page.redirects, []); assert.deepEqual(page.history, ['/api/auth/callback']);
  page.retry(); page.render(); await flush(); assert.deepEqual(page.redirects, ['/user-lists']); page.unmount();
});
test('logout waits for success, offers retry on failure, and never claims success prematurely', async () => {
  const pending=deferred(); let calls=0;
  const page=screen(logoutPage, { logout: () => ++calls===1 ? pending.promise : Promise.resolve() });
  assert.deepEqual(page.redirects, []); pending.reject(new Error('offline')); await flush();
  assert.ok(page.all().some(node => node.props.role==='alert')); assert.deepEqual(page.redirects, []);
  page.retry(); page.render(); await flush(); assert.deepEqual(page.redirects, ['/login']); page.unmount();
});
test('callback and logout ignore late completions after leaving; effect replay retains the active completion', async () => {
  for (const path of [callbackPage, logoutPage]) {
    for (const reject of [false,true]) {
      const pending=deferred(); const page=screen(path, { finish: () => pending.promise, logout: () => pending.promise });
      page.unmount(); const count=page.stateWrites.length;
      if (reject) pending.reject(new Error('offline')); else pending.resolve('/landing'); await flush();
      assert.deepEqual(page.redirects, []); assert.equal(page.stateWrites.length,count); assert.deepEqual(page.history, []);
    }
    const pending=deferred(); const page=screen(path, { finish: () => pending.promise, logout: () => pending.promise });
    page.replay(); pending.resolve('/landing'); await flush();
    assert.deepEqual(page.redirects, [path===callbackPage ? '/landing' : '/login']); page.unmount();
  }
});
test('login keeps expired sessions on the form, validates returning users and ignores pre-signout results', async () => {
  const expired=screen('src/app/login/page.tsx'); await flush(); assert.deepEqual(expired.redirects, []);
  assert.ok(expired.all().some(node => node.type==='Auth')); expired.unmount();
  const returning=screen('src/app/login/page.tsx', { user: async () => ({ id:'A' }) });
  await flush(); assert.deepEqual(returning.redirects, ['/']); returning.unmount();
  const pending=deferred(); const old=screen('src/app/login/page.tsx', { user: () => pending.promise });
  old.event('SIGNED_OUT'); pending.resolve({ id:'A' }); await flush(); assert.deepEqual(old.redirects, []); old.unmount();
});
test('login auth request failure shows retry instead of redirecting on an unchecked stored session', async () => {
  let calls=0;
  const page=screen('src/app/login/page.tsx', { user: async () => { if (++calls===1) throw new Error('offline'); return { id:'A' }; } });
  await flush(); assert.ok(page.all().some(node => node.props.role==='alert')); assert.deepEqual(page.redirects, []);
  page.retry(); page.render(); await flush(); assert.deepEqual(page.redirects, ['/']); page.unmount();
});
