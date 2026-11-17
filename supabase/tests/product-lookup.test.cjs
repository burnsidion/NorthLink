const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { load } = require('./helpers/load-product-lookup.cjs');
const base = 'src/lib/server/product-lookup/';
const safe = load(base + 'safe-page.ts');
const { extractProduct } = load(base + 'extract.ts');
const { createProductLookupHandler, makeLookupLimiter } = load(base + 'handler.ts');
const publicAnswers = async () => [{ address: '93.184.216.34', family: 4 }];
const extract = html => extractProduct(html, new URL('https://store.example/products/mug'));
const structured = product => `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
const product = extra => ({ '@type': 'Product', name: 'Tea mug', image: '/images/mug.jpg', ...extra });

test('shop links reject internal/literal addresses, credentials, unusual ports and non-web schemes', () => {
 for (const input of ['file:///etc/passwd', 'ftp://shop.example/a', 'https://user:pass@shop.example/a',
  'http://127.0.0.1', 'http://0x7f000001', 'http://2130706433', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/',
  'https://93.184.216.34/', 'https://localhost/', 'https://test.local/', 'https://foo.internal/',
  'https://shop.example:8080', 'https://shop.example/a\nb', 'not a link', 'https://shop.example/' + 'x'.repeat(2048)]) {
  assert.throws(() => safe.productUrl(input), safe.InvalidProductUrl, input);
 }
 assert.equal(safe.productUrl('https://shop.example/a?variant=blue#details').href, 'https://shop.example/a?variant=blue');
 assert.equal(safe.productUrl('/new', new URL('https://shop.example/old')).href, 'https://shop.example/new');
});

test('IP classification blocks private, loopback, link-local, mapped, multicast and reserved networks', () => {
 for (const ip of ['127.1.2.3', '10.2.3.4', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.100.100.200',
  '0.0.0.0', '192.0.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
  '::1', '::', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1', '2002:0808:0808::1', 'nonsense']) {
  assert.equal(safe.publicAddress(ip), false, ip);
 }
 for (const ip of ['93.184.216.34', '8.8.8.8', '2001:4860:4860::8888']) assert.equal(safe.publicAddress(ip), true, ip);
});

test('DNS must be wholly public, and the checked address is passed to the request without a second resolution', async () => {
 const signal = new AbortController().signal;
 for (const answers of [[], [{ address: '10.0.0.1', family: 4 }],
  [{ address: '93.184.216.34', family: 4 }, { address: '::1', family: 6 }]]) {
  await assert.rejects(safe.resolvePublicAddress('shop.example', signal, async () => answers), safe.InvalidProductUrl);
 }
 let calls = 0;
 const page = await safe.fetchProductPage('https://shop.example/a', {
  resolve: async () => { calls++; return calls === 1 ? publicAnswers() : [{ address: '127.0.0.1', family: 4 }]; },
  read: async (url, address) => {
   assert.equal(url.hostname, 'shop.example'); assert.equal(address.address, '93.184.216.34');
   return { status: 200, html: '<title>Mug</title>' };
  },
 });
 assert.equal(calls, 1); assert.equal(page.html, '<title>Mug</title>');
});

test('redirects are individually validated, bounded, and cannot downgrade HTTPS', async () => {
 for (const location of ['http://127.0.0.1', 'https://user:pass@shop.example/', 'http://shop.example/']) {
  let reads = 0;
  await assert.rejects(safe.fetchProductPage('https://shop.example/a', {
   resolve: publicAnswers, read: async () => { reads++; return { status: 302, location }; },
  }), safe.InvalidProductUrl);
  assert.equal(reads, 1);
 }
 let reads = 0;
 await assert.rejects(safe.fetchProductPage('https://shop.example/a', {
  resolve: publicAnswers, read: async () => { reads++; return { status: 302, location: '/loop' }; },
 }), /redirects/);
 assert.equal(reads, 4);
 const seen = [];
 const result = await safe.fetchProductPage('https://short.example/a', {
  resolve: publicAnswers, read: async url => { seen.push(url.href); return seen.length === 1
   ? { status: 302, location: 'https://store.example/product' } : { status: 200, html: 'ok' }; },
 });
 assert.equal(result.url.href, 'https://store.example/product'); assert.equal(seen.length, 2);
 let requests = 0;
 await assert.rejects(safe.fetchProductPage('https://short.example/a', {
  resolve: async host => host === 'short.example' ? publicAnswers() : [{ address: '169.254.169.254', family: 4 }],
  read: async () => { requests++; return { status: 302, location: 'https://metadata.example/' }; },
 }), safe.InvalidProductUrl);
 assert.equal(requests, 1);
});

test('one deadline covers unresolved DNS and a stalled reader', async () => {
 for (const phase of ['dns', 'page']) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10);
  await assert.rejects(safe.fetchProductPage('https://shop.example/a', {
   signal: controller.signal, resolve: phase === 'dns' ? () => new Promise(() => {}) : publicAnswers,
   read: () => new Promise(() => {}),
  }), /stopped/);
  clearTimeout(timer);
 }
});

function readerClient({ status = 200, headers = { 'content-type': 'text/html' }, body = ['<title>Mug</title>'] } = {}) {
 let captured;
 function request(url, options, callback) {
  captured = { url, options };
  const req = new EventEmitter();
  req.end = () => queueMicrotask(() => {
   const response = Readable.from(body.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
   response.statusCode = status; response.headers = headers;
   callback(response);
  });
  req.destroy = () => {};
  return req;
 }
 const reader = load(base + 'safe-page.ts', { 'node:https': { request }, 'node:http': { request } }).readPage;
 return { reader, captured: () => captured };
}

test('transport pins the safe address while retaining the original TLS hostname and sends no credentials', async () => {
 const client = readerClient(); const address = { address: '93.184.216.34', family: 4 };
 assert.equal((await client.reader(new URL('https://shop.example/item'), address, new AbortController().signal)).html, '<title>Mug</title>');
 const { url, options } = client.captured();
 assert.equal(url.hostname, 'shop.example'); assert.equal(options.agent, false);
 assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers.Authorization, undefined);
 assert.equal(options.headers['Accept-Encoding'], 'identity');
 options.lookup('shop.example', {}, (error, ip, family) => { assert.equal(error, null); assert.equal(ip, address.address); assert.equal(family, 4); });
 options.lookup('shop.example', { all: true }, (error, addresses) => { assert.equal(error, null); assert.equal(addresses[0].address, address.address); });
});

test('transport rejects blocked responses, non-HTML, compression and oversized bodies; redirect bodies are not parsed', async () => {
 const input = [new URL('https://shop.example/item'), { address: '93.184.216.34', family: 4 }, new AbortController().signal];
 for (const options of [{ status: 403 }, { headers: { 'content-type': 'application/json' } },
  { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } },
  { headers: { 'content-type': 'text/html', 'content-length': String(safe.PAGE_BYTE_LIMIT + 1) } },
  { body: [Buffer.alloc(safe.PAGE_BYTE_LIMIT), Buffer.from('overflow')] }]) {
  await assert.rejects(readerClient(options).reader(...input));
 }
 const redirect = await readerClient({ status: 302, headers: { location: '/item' }, body: [Buffer.alloc(3_000_000)] }).reader(...input);
 assert.equal(redirect.location, '/item'); assert.equal(redirect.html, undefined);
});

test('structured product data and ordinary metadata suggest fields without executing scripts', () => {
 const details = extract(structured({ '@graph': [product({ offers: { '@type': 'Offer', price: '24.99', priceCurrency: 'USD' } })] })).details;
 assert.equal(details.title, 'Tea mug'); assert.equal(details.imageUrl, 'https://store.example/images/mug.jpg');
 assert.equal(details.priceCents, 2499); assert.equal(details.currency, 'USD');
 const tags = extract('<title>Fallback</title><meta content="Mug &amp; Saucer" property="og:title"><meta name="twitter:image" content="//cdn.example/mug.jpg"><script>throw new Error("must not run")</script>');
 assert.equal(tags.status, 'ready'); assert.equal(tags.details.title, 'Mug & Saucer');
 assert.equal(tags.details.imageUrl, 'https://cdn.example/mug.jpg');
 assert.equal(extract('<title>Only a title</title>').status, 'partial');
 assert.equal(extract('no metadata').status, 'unavailable');
 assert.equal(extract('<title>store.example</title>').status, 'unavailable');
 assert.equal(extract('<script type="application/ld+json">{broken}</script><title>Fallback</title>').details.title, 'Fallback');
});

test('prices are suggestions only for one clear USD offer; ranges, other currencies and collections stay blank', () => {
 for (const offers of [
  { '@type': 'Offer', price: 20, priceCurrency: 'EUR' },
  { '@type': 'Offer', price: 20 }, { '@type': 'Offer', price: '10-20', priceCurrency: 'USD' },
  { '@type': 'Offer', price: -1, priceCurrency: 'USD' },
  { '@type': 'Offer', price: '21474836.48', priceCurrency: 'USD' },
  { '@type': 'AggregateOffer', lowPrice: 10, highPrice: 20, priceCurrency: 'USD' },
  [{ '@type': 'Offer', price: 10, priceCurrency: 'USD' }, { '@type': 'Offer', price: 20, priceCurrency: 'USD' }],
 ]) assert.equal(extract(structured(product({ offers }))).details.priceCents, null);
 assert.equal(extract(structured(product({ offers: [{ '@type': 'Offer', price: 0, priceCurrency: 'USD' }] }))).details.priceCents, 0);
 const multiple = extract(structured([product({ name: 'One' }), product({ name: 'Two' })]) + '<meta property="og:title" content="Collection">');
 assert.equal(multiple.details.title, 'Collection'); assert.equal(multiple.details.priceCents, null);
 assert.equal(extract('<meta property="product:price:amount" content="10.99"><meta property="product:price:currency" content="USD">').details.priceCents, 1099);
 assert.equal(extract('<meta property="og:price:amount" content="44.00"><meta property="og:price:currency" content="USD">').details.priceCents, 4400);
 assert.equal(extract('<meta property="og:price:amount" content="44.00"><meta property="product:price:currency" content="USD">').details.priceCents, null);
});

test('untrusted images and blocking pages never become product previews', () => {
 for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'http://cdn.example/a', 'https://user:pass@cdn.example/a', 'https://127.0.0.1/a']) {
  assert.equal(extract(structured(product({ image: value }))).details.imageUrl, null);
 }
 for (const title of ['Access denied', 'Robot Check', 'Just a moment...', 'Are you a robot?']) {
  assert.equal(extract(`<title>${title}</title>`).status, 'unavailable');
 }
 assert.equal(extract('<title>' + 'x'.repeat(500) + '</title>').details.title.length, 120);
});

const available = { status: 'ready', details: { title: 'Tea mug', imageUrl: 'https://cdn.example/a.jpg', priceCents: 1000, currency: 'USD' } };
function handler(options = {}) {
 const calls = [];
 return { calls, handle: createProductLookupHandler({
  authenticate: async token => { calls.push(['auth', token]); return 'user-one'; },
  allow: () => true,
  lookup: async url => { calls.push(['lookup', url]); return available; }, ...options,
 }) };
}
const request = (options = {}) => new Request('https://app.example/api/products/lookup', {
 method: 'POST', headers: { authorization: 'Bearer fake-test-session', 'content-type': 'application/json', ...options.headers },
 body: options.body ?? JSON.stringify({ url: 'https://shop.example/product' }),
});

test('endpoint rejects missing/expired sign-in and cross-origin calls before any shop request', async () => {
 for (const headers of [{ authorization: '' }, { authorization: 'Basic nope' }, { origin: 'https://other.example' }]) {
  const endpoint = handler(); const response = await endpoint.handle(request({ headers }));
  assert.ok([401, 403].includes(response.status)); assert.equal(endpoint.calls.length, 0);
 }
 const expired = handler({ authenticate: async () => null });
 assert.equal((await expired.handle(request())).status, 401); assert.equal(expired.calls.length, 0);
 const offline = handler({ authenticate: async () => { throw new Error('private upstream auth detail'); } });
 const response = await offline.handle(request()); assert.equal(response.status, 503);
 assert.equal((await response.text()).includes('private upstream'), false); assert.equal(offline.calls.length, 0);
});

test('endpoint enforces JSON/body limits and never fetches malformed input', async () => {
 for (const options of [{ body: '{broken' }, { body: '{}' }, { body: '{"url":42}' },
  { body: JSON.stringify({ url: 'x'.repeat(5000) }) }, { headers: { 'content-type': 'text/plain' } }]) {
  const endpoint = handler(); const response = await endpoint.handle(request(options));
  assert.equal(response.status, 400); assert.equal(endpoint.calls.filter(call => call[0] === 'lookup').length, 0);
 }
});

test('successful lookups are private/no-store; failures reveal no URL, token or upstream error', async () => {
 const endpoint = handler(); const response = await endpoint.handle(request());
 assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.equal((await response.json()).details.title, 'Tea mug');
 for (const [error, expected] of [[new safe.InvalidProductUrl('internal address'), 400], [new Error('private details'), 502]]) {
  // Match the handler's own imported error class, not another VM's constructor.
  const own = load(base + 'handler.ts', { './safe-page': { abortable: safe.abortable, InvalidProductUrl: safe.InvalidProductUrl } });
  const handle = own.createProductLookupHandler({ authenticate: async () => 'user', allow: () => true, lookup: async () => { throw error; } });
  const failed = await handle(request()); assert.equal(failed.status, expected);
  const body = await failed.text(); assert.equal(body.includes('internal address'), false); assert.equal(body.includes('private details'), false);
 }
});

test('lookup throttle limits per user, recovers after a minute and bounds memory', async () => {
 let time = 0; const allow = makeLookupLimiter(() => time);
 for (let i = 0; i < 10; i++) assert.equal(allow('one'), true);
 assert.equal(allow('one'), false); assert.equal(allow('two'), true);
 const endpoint = handler({ allow: () => false }); assert.equal((await endpoint.handle(request())).status, 429);
 assert.equal(endpoint.calls.some(call => call[0] === 'lookup'), false);
 time = 60001; assert.equal(allow('one'), true);
 const bounded = makeLookupLimiter(() => 0);
 for (let i = 0; i < 1000; i++) assert.equal(bounded(String(i)), true);
 assert.equal(bounded('overflow'), false);
});

test('server auth validates the supplied token with Auth and rejects anonymous or invalid sessions', async () => {
 const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example';
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
 try {
  for (const [user, error, expected] of [
   [{ id: 'signed-in-user' }, null, 'signed-in-user'],
   [{ id: 'anonymous-user', is_anonymous: true }, null, null],
   [null, { status: 401 }, null],
  ]) {
   const auth = load(base + 'auth.ts', { '@supabase/supabase-js': { createClient(url, key, options) {
    assert.equal(url, 'https://auth.example'); assert.equal(key, 'public-test-key');
    assert.equal(options.auth.persistSession, false); assert.equal(options.auth.autoRefreshToken, false);
    return { auth: { async getUser(token) { assert.equal(token, 'fake-test-session'); return { data: { user }, error }; } } };
   } } });
   assert.equal(await auth.authenticateLookupUser('fake-test-session'), expected);
  }
  const offline = load(base + 'auth.ts', { '@supabase/supabase-js': { createClient() {
   return { auth: { async getUser() { return { data: { user: null }, error: { status: 503, message: 'private error' } }; } } };
  } } });
  await assert.rejects(offline.authenticateLookupUser('fake-test-session'), /Authentication unavailable/);
 } finally {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
 }
});

test('shop failures produce a manual-entry result, while unsafe URLs remain a rejected request', async () => {
 for (const error of [new Error('Timeout'), new Error('403 retailer response')]) {
  const service = load(base + 'service.ts', {
   './safe-page': { InvalidProductUrl: safe.InvalidProductUrl, fetchProductPage: async () => { throw error; } },
  });
  const result = await service.lookupProduct('https://shop.example/product');
  assert.equal(result.status, 'unavailable'); assert.equal(result.details.title, null);
 }
 const unsafe = load(base + 'service.ts', {
  './safe-page': { InvalidProductUrl: safe.InvalidProductUrl, fetchProductPage: async () => { throw new safe.InvalidProductUrl(); } },
 });
 await assert.rejects(unsafe.lookupProduct('https://localhost'), safe.InvalidProductUrl);
});
