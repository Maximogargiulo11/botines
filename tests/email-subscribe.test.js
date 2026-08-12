// tests/email-subscribe.test.js
const assert = require('assert');
const path = require('path');
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
let sent = [];
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: function () { this.emails = { send: async (o) => { sent.push(o); return { error: null }; } }; },
}};
process.env.RESEND_API_KEY = 'test';
process.env.SITE_URL = 'https://ejemplo.test';

const E = require('../api/_email.js');

(async () => {
  await E.sendConfirmSubscription('a@b.com', '<Ana>', 'TOK1');
  let m = sent.pop();
  assert.strictEqual(m.to, 'a@b.com');
  assert.ok(m.html.includes('https://ejemplo.test/api/confirm-subscription?token=TOK1'), 'link de confirmación');
  assert.ok(m.html.includes('&lt;Ana&gt;'), 'nombre escapado');

  await E.sendCouponEmail('a@b.com', 'Ana', 'BAG-ABC123', '2026-09-09T00:00:00.000Z');
  m = sent.pop();
  assert.ok(m.html.includes('BAG-ABC123'), 'incluye el código');
  assert.ok(m.html.includes('5%'), 'menciona 5%');
  console.log('OK email-subscribe');
})().catch(e => { console.error(e); process.exit(1); });
