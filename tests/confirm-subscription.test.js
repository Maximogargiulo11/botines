// tests/confirm-subscription.test.js
const assert = require('assert');
process.env.SITE_URL = 'https://ejemplo.test';

const subsPath = require.resolve('../api/_subscribers.js');
const state = { sub: { email: 'a@b.com', name: 'Ana', status: 'pending' }, saved: null, tokenDeleted: false };
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  getKeyByToken: async (t) => t === 'good' ? 'K1' : null,
  getSubscriberByKey: async () => state.sub,
  saveSubscriber: async (s) => { state.saved = s; },
  deleteToken: async () => { state.tokenDeleted = true; },
}};
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  createCoupon: async (email) => ({ code: 'BAG-ABC123', email, expiresAt: '2026-09-09T00:00:00.000Z' }),
}};
const emailPath = require.resolve('../api/_email.js');
let couponMailedCode = null;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
  sendCouponEmail: async (email, name, code) => { couponMailedCode = code; return { sent: true }; },
}};

const handler = require('../api/confirm-subscription.js');
function mockRes() { return { headers: null, ended: false, writeHead(c, h){ this.code=c; this.headers=h; return this; }, end(){ this.ended=true; } }; }

(async () => {
  let res = mockRes();
  await handler({ query: { token: 'bad' } }, res);
  assert.ok(res.headers.Location.endsWith('/suscripcion-error'), 'token malo → error');

  res = mockRes();
  await handler({ query: { token: 'good' } }, res);
  assert.strictEqual(state.saved.status, 'confirmed');
  assert.strictEqual(state.saved.couponCode, 'BAG-ABC123');
  assert.strictEqual(couponMailedCode, 'BAG-ABC123');
  assert.strictEqual(state.tokenDeleted, true);
  assert.ok(res.headers.Location.endsWith('/suscripcion-confirmada'));
  console.log('OK confirm-subscription');
})().catch(e => { console.error(e); process.exit(1); });
