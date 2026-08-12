// tests/subscribe.test.js
const assert = require('assert');
const path = require('path');

const subsPath = require.resolve('../api/_subscribers.js');
const state = { saved: null, tokenSaved: null, existing: null };
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  emailKey: (e) => 'K:' + e.trim().toLowerCase(),
  getSubscriber: async () => state.existing,
  saveSubscriber: async (s) => { state.saved = s; },
  saveToken: async (t, k) => { state.tokenSaved = { t, k }; },
}};
const emailPath = require.resolve('../api/_email.js');
let mailSentTo = null;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
  sendConfirmSubscription: async (email) => { mailSentTo = email; return { sent: true }; },
}};

const handler = require('../api/subscribe.js');

function mockRes() { return { code: 200, body: null, status(c){ this.code=c; return this; }, json(b){ this.body=b; return this; } }; }

(async () => {
  let res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana', website: 'bot' } }, res);
  assert.strictEqual(state.saved, null, 'honeypot corta');

  res = mockRes();
  await handler({ method: 'POST', body: { email: 'nope', name: 'Ana' } }, res);
  assert.strictEqual(res.code, 400);

  state.saved = null; mailSentTo = null; state.existing = null;
  res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(state.saved.status, 'pending');
  assert.strictEqual(mailSentTo, 'a@b.com');
  assert.ok(state.tokenSaved.t.length > 10, 'token generado');

  state.saved = null; mailSentTo = null; state.existing = { status: 'confirmed', email: 'a@b.com' };
  res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana' } }, res);
  assert.strictEqual(mailSentTo, null, 'no reenvía a confirmado');

  console.log('OK subscribe');
})().catch(e => { console.error(e); process.exit(1); });
