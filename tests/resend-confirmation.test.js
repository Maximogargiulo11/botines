// tests/resend-confirmation.test.js
const assert = require('assert');
process.env.ADMIN_API_SECRET = 'SECRET';

const subsPath = require.resolve('../api/_subscribers.js');
const state = { saved: null, tokenSaved: null, tokenDeleted: null };
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  listSubscribers: async () => [],
  getSubscriber: async (email) => {
    if (email === 'pend@b.com') return { email, name: 'Pendi', status: 'pending', confirmToken: 'oldtok' };
    if (email === 'conf@b.com') return { email, name: 'Confi', status: 'confirmed', couponCode: 'BAG-X' };
    return null;
  },
  saveSubscriber: async (s) => { state.saved = s; },
  saveToken: async (t, k) => { state.tokenSaved = { t, k }; },
  deleteToken: async (t) => { state.tokenDeleted = t; },
  emailKey: (e) => 'key:' + e,
}};
const emailPath = require.resolve('../api/_email.js');
let mailedTo = null;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
  sendConfirmSubscription: async (email, name, token) => { mailedTo = { email, name, token }; return { sent: true }; },
}};

const handler = require('../api/subscribers.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const AUTH = { 'x-admin-secret': 'SECRET' };

(async () => {
  // Sin auth → 401
  let res = mockRes();
  await handler({ method:'POST', headers:{}, body:{ email:'pend@b.com' } }, res);
  assert.strictEqual(res.code, 401, 'sin secreto → 401');

  // Pendiente → reenvía y guarda token nuevo, borra el viejo
  res = mockRes();
  await handler({ method:'POST', headers: AUTH, body:{ email:'pend@b.com' } }, res);
  assert.strictEqual(res.code, 200, 'pendiente → 200');
  assert.ok(res.body.ok, 'ok');
  assert.strictEqual(mailedTo.email, 'pend@b.com', 'reenvía a la persona correcta');
  assert.ok(mailedTo.token && mailedTo.token !== 'oldtok', 'token nuevo');
  assert.strictEqual(state.tokenDeleted, 'oldtok', 'borra el token viejo');
  assert.strictEqual(state.saved.status, 'pending', 'sigue pendiente');
  assert.ok(state.saved.lastSentAt, 'actualiza lastSentAt');

  // Confirmado → no reenvía (already)
  res = mockRes(); mailedTo = null;
  await handler({ method:'POST', headers: AUTH, body:{ email:'conf@b.com' } }, res);
  assert.strictEqual(res.code, 200);
  assert.ok(res.body.already, 'confirmado → already, no reenvía');
  assert.strictEqual(mailedTo, null, 'no manda mail a confirmados');

  // Inexistente → 404
  res = mockRes();
  await handler({ method:'POST', headers: AUTH, body:{ email:'nope@b.com' } }, res);
  assert.strictEqual(res.code, 404, 'inexistente → 404');

  console.log('OK resend-confirmation');
})().catch(e => { console.error(e); process.exit(1); });
