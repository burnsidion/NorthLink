const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-product-lookup.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const found = (title = 'Coffee grinder', cents = 2499) => ({ status: 'ready', details: {
 title, priceCents: cents, currency: cents === null ? null : 'USD', imageUrl: 'https://cdn.example/grinder.jpg',
} });

function formState(lookup, initial = {}) {
 let cursor = 0;
 const slots = [], effects = [], writes = [], timers = new Map();
 const fields = { open: true, submitting: false, title: '', price: '', link: 'https://shop.example/product', notes: 'Large, blue', imageUrl: null, ...initial };
 const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
 const react = {
  useState(value) { const key = cursor++; if (!(key in slots)) slots[key] = typeof value === 'function' ? value() : value;
   return [slots[key], next => { slots[key] = typeof next === 'function' ? next(slots[key]) : next; writes.push(key); }]; },
  useRef(value) { const key = cursor++; slots[key] ??= { current: value }; return slots[key]; },
  useCallback(fn, deps) { const key = cursor++; if (!equal(slots[key]?.deps, deps)) slots[key] = { fn, deps }; return slots[key].fn; },
  useEffect(fn, deps) { const key = cursor++; if (!equal(slots[key]?.deps, deps)) effects.push(() => {
   slots[key]?.cleanup?.(); slots[key] = { deps, cleanup: fn() };
  }); },
 };
 const { useProductAutofill } = load('src/lib/use-product-autofill.ts', {
  react, '@/lib/product-lookup-client': { getProductSuggestions: lookup },
 }, {
  setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
 });
 const setters = Object.fromEntries(['title', 'price', 'imageUrl'].map(field => ['set' + field[0].toUpperCase() + field.slice(1), next => {
  fields[field] = typeof next === 'function' ? next(fields[field]) : next;
 }]));
 function render(patch = {}) { Object.assign(fields, patch); cursor = 0; const result = useProductAutofill({ ...fields, ...setters }); while (effects.length) effects.shift()(); return result; }
 render();
 return { fields, render, writes, timers,
  edit(field, value) { render().markEdited(field); fields[field] = value; render(); },
  unmount() { for (const slot of slots) slot?.cleanup?.(); },
 };
}

test('lookup runs only on request, fills empty fields and leaves notes entirely alone', async () => {
 let calls = 0;
 const form = formState(async (url, signal) => { calls++; assert.equal(url, 'https://shop.example/product'); assert.equal(signal.aborted, false); return found(); });
 assert.equal(calls, 0); await form.render().fill();
 assert.equal(calls, 1); assert.equal(form.fields.title, 'Coffee grinder'); assert.equal(form.fields.price, '24.99');
 assert.equal(form.fields.notes, 'Large, blue'); assert.equal(form.render().loading, false);
 assert.equal(form.render().feedback.kind, 'success'); assert.equal(form.timers.size, 0); form.unmount();
});

test('existing entries and edits made during lookup win, including a field typed and then cleared', async () => {
 const prefilled = formState(async () => found(), { title: 'My name', price: '29.00' });
 await prefilled.render().fill(); assert.equal(prefilled.fields.title, 'My name'); assert.equal(prefilled.fields.price, '29.00'); prefilled.unmount();
 const pending = deferred(); const form = formState(() => pending.promise);
 const lookup = form.render().fill(); form.edit('title', 'My name'); form.edit('title', '');
 pending.resolve(found()); await lookup;
 assert.equal(form.fields.title, ''); assert.equal(form.fields.price, '24.99'); form.unmount();
 const pricePending = deferred(); const editedPrice = formState(() => pricePending.promise);
 const work = editedPrice.render().fill(); editedPrice.edit('price', '15.50');
 pricePending.resolve(found()); await work;
 assert.equal(editedPrice.fields.price, '15.50'); assert.equal(editedPrice.fields.title, 'Coffee grinder'); editedPrice.unmount();
});

test('duplicate clicks do not start duplicate work; changed URLs and late responses cannot overwrite newer suggestions', async () => {
 const old = deferred(), next = deferred(); let calls = 0; const signals = [];
 const form = formState((url, signal) => { calls++; signals.push(signal); return calls === 1 ? old.promise : next.promise; });
 const first = form.render().fill(); await form.render().fill(); assert.equal(calls, 1);
 form.render({ link: 'https://shop.example/new-product' });
 assert.equal(signals[0].aborted, true); assert.equal(form.render().loading, false);
 const second = form.render().fill(); next.resolve(found('New gift', 0)); await second;
 old.resolve(found('Old gift', 9999)); await first;
 assert.equal(calls, 2); assert.equal(form.fields.title, 'New gift'); assert.equal(form.fields.price, '0.00');
 assert.equal(form.render().feedback.kind, 'success'); form.unmount();
});

test('stopping, closing, submitting or leaving cancels work and ignores late completion', async () => {
 for (const action of ['stop', 'close', 'save', 'unmount']) {
  const pending = deferred(); let signal;
  const form = formState((url, next) => { signal = next; return pending.promise; });
  const work = form.render().fill();
  if (action === 'stop') form.render().cancel();
  if (action === 'close') form.render({ open: false });
  if (action === 'save') form.render({ submitting: true });
  if (action === 'unmount') form.unmount();
  const count = form.writes.length;
  assert.equal(signal.aborted, true); pending.resolve(found()); await work;
  assert.equal(form.fields.title, ''); assert.equal(form.fields.price, ''); assert.equal(form.writes.length, count);
  if (action !== 'unmount') { assert.equal(form.render().loading, false); form.unmount(); }
 }
});

test('timeouts and failures preserve fields and allow retry or manual entry', async () => {
 const pending = deferred(); const form = formState(() => pending.promise);
 const work = form.render().fill(); [...form.timers.values()][0]();
 assert.equal(form.render().loading, false); assert.equal(form.render().feedback.kind, 'error');
 pending.resolve(found()); await work; assert.equal(form.fields.title, ''); form.unmount();
 let calls = 0; const retried = formState(async () => { if (++calls === 1) throw new Error('Try manually'); return found(); });
 await retried.render().fill(); assert.equal(retried.render().feedback.kind, 'error');
 await retried.render().fill(); assert.equal(retried.fields.title, 'Coffee grinder'); retried.unmount();
 for (const details of [{ title: null, imageUrl: null, priceCents: null, currency: null }, { title: null, imageUrl: 'https://cdn.example/a.jpg', priceCents: null, currency: null }]) {
  const empty = formState(async () => ({ status: 'partial', details })); await empty.render().fill();
  assert.equal(empty.fields.title, ''); assert.equal(empty.render().feedback.kind, details.imageUrl ? 'success' : 'error'); empty.unmount();
 }
});

function client({ session = { access_token: 'fake-test-session' }, authError = null, auth, response = Response.json(found()) } = {}) {
 const calls = [];
 const api = load('src/lib/product-lookup-client.ts', {
  '@/lib/supabase': { supabase: { auth: { getSession: auth ?? (async () => ({ data: { session }, error: authError })) } } },
 }, { fetch: async (...args) => { calls.push(args); return response; } });
 return { ...api, calls };
}

test('client normalizes a pasted link and sends only that URL to our endpoint with the current session', async () => {
 const api = client(); const signal = new AbortController().signal;
 const result = await api.getProductSuggestions('shop.example/product', signal);
 assert.equal(result.details.title, 'Coffee grinder'); assert.equal(api.calls.length, 1);
 const [url, options] = api.calls[0]; assert.equal(url, '/api/products/lookup'); assert.equal(options.method, 'POST');
 assert.equal(options.headers.Authorization, 'Bearer fake-test-session'); assert.equal(options.signal, signal);
 assert.deepEqual(JSON.parse(options.body), { url: 'https://shop.example/product' });
 assert.equal(options.cache, 'no-store');
});

test('invalid links, missing sessions and canceled session reads never send lookup requests', async () => {
 for (const link of ['javascript:alert(1)', 'https://user:pass@shop.example/item']) {
  const api = client(); await assert.rejects(api.getProductSuggestions(link, new AbortController().signal)); assert.equal(api.calls.length, 0);
 }
 const unsigned = client({ session: null }); await assert.rejects(unsigned.getProductSuggestions('shop.example/item', new AbortController().signal), /sign in/);
 assert.equal(unsigned.calls.length, 0);
 const pending = deferred(); const delayed = client({ auth: () => pending.promise }); const controller = new AbortController();
 const work = delayed.getProductSuggestions('shop.example/item', controller.signal); controller.abort();
 pending.resolve({ data: { session: { access_token: 'fake-test-session' } }, error: null });
 await assert.rejects(work, error => error.name === 'AbortError'); assert.equal(delayed.calls.length, 0);
});

test('malformed suggestions, unknown currencies and server errors never become editable values or expose server details', async () => {
 for (const result of [null, { status: {}, details: {} }, { ...found(), details: { ...found().details, priceCents: -1 } },
  { ...found(), details: { ...found().details, currency: 'EUR' } }, { ...found(), details: { ...found().details, imageUrl: 'javascript:alert(1)' } },
  { ...found(), details: { ...found().details, title: 'x'.repeat(121) } }, { ...found(), status: 'unavailable' }]) {
  const api = client({ response: Response.json(result) }); await assert.rejects(api.getProductSuggestions('shop.example/item', new AbortController().signal), /manually/);
 }
 for (const [status, expected] of [[401, /sign in/], [429, /wait a minute/], [502, /manually/]]) {
  const api = client({ response: Response.json({ error: 'private server detail' }, { status }) });
  await assert.rejects(api.getProductSuggestions('shop.example/item', new AbortController().signal), error => expected.test(error.message) && !error.message.includes('private server detail'));
 }
 const brokenAuth = client({ auth: async () => { throw new Error('private auth detail'); } });
 await assert.rejects(brokenAuth.getProductSuggestions('shop.example/item', new AbortController().signal), error => /sign in/.test(error.message) && !error.message.includes('private auth detail'));
});

test('thumbnail suggestion is retained, removals during lookup win, and late canceled images are ignored', async () => {
 const form = formState(async () => found()); await form.render().fill();
 assert.equal(form.fields.imageUrl, 'https://cdn.example/grinder.jpg'); form.unmount();
 const pending = deferred(), removed = formState(() => pending.promise);
 const work = removed.render().fill(); removed.render().markEdited('image');
 pending.resolve(found()); await work; assert.equal(removed.fields.imageUrl, null); removed.unmount();
 const old = deferred(), changed = formState(() => old.promise);
 const late = changed.render().fill(); changed.render({ link:'https://shop.example/other' });
 old.resolve(found()); await late; assert.equal(changed.fields.imageUrl, null); changed.unmount();
});
