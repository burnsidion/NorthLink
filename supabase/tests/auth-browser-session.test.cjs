const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthClient } = require('@supabase/auth-js');

// Exercise the installed SDK, with browser storage and a fake Auth transport.
// No hosted project, email, credentials, or network calls are used.
test('SDK consumes the existing email-link format in the browser and logout clears that same session', async () => {
  const previousWindow = global.window, previousDocument = global.document;
  const values = new Map(), requests = [];
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: 'test-user', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'synthetic-signature'].join('.');
  global.window = { location: new URL('https://app.example/api/auth/callback#' + new URLSearchParams({
    access_token: token, refresh_token: 'synthetic-refresh', expires_in: '3600', token_type: 'bearer', type: 'signup',
  })), addEventListener() {}, removeEventListener() {} };
  global.document = { visibilityState: 'hidden' };
  const client = new AuthClient({ url: 'https://auth.example.test', storageKey: 'test-email-link', storage,
    persistSession: true, autoRefreshToken: false, detectSessionInUrl: true, flowType: 'implicit',
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init.method });
      if (String(input) === 'https://auth.example.test/user') {
        return Response.json({ id: 'test-user', aud: 'authenticated', role: 'authenticated', created_at: '2026-11-14T00:00:00Z' });
      }
      assert.equal(String(input), 'https://auth.example.test/logout?scope=global');
      return new Response(null, { status: 204 });
    },
  });
  try {
    assert.equal((await client.initialize()).error, null);
    // The SDK schedules its SIGNED_IN notification after persisting the session.
    await new Promise(resolve => setTimeout(resolve, 0));
    const { data: { session } } = await client.getSession();
    assert.equal(session.user.id, 'test-user');
    assert.ok(values.has('test-email-link'));
    assert.equal(window.location.hash, '');
    assert.equal((await client.signOut({ scope: 'global' })).error, null);
    assert.equal((await client.getSession()).data.session, null);
    assert.equal(values.has('test-email-link'), false);
    assert.deepEqual(requests.map(request => request.method), ['GET', 'POST']);
  } finally {
    await client.stopAutoRefresh(); client.broadcastChannel?.close();
    global.window = previousWindow; global.document = previousDocument;
  }
});
