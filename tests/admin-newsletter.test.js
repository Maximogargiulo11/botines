// tests/admin-newsletter.test.js
const assert = require('assert');
const path = require('path');
process.env.ADMIN_API_SECRET = 'sec';

const subsPath = require.resolve('../api/_subscribers.js');
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  listSubscribers: async () => ([
    { email: 'a@b.com', name: 'Ana', status: 'confirmed' },
    { email: 'c@d.com', name: 'Caro', status: 'pending' },
  ]),
}};
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
let sentTo = [];
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: function () { this.emails = { send: async (o) => { sentTo.push(o.to); return { error: null }; } }; },
}};
process.env.RESEND_API_KEY = 'test';

function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }

(async () => {
  const list = require('../api/subscribers.js');
  let res = mockRes();
  await list({ method:'GET', headers:{} }, res);
  assert.strictEqual(res.code, 401);
  res = mockRes();
  await list({ method:'GET', headers:{ 'x-admin-secret':'sec' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.body.length, 2);

  const send = require('../api/send-newsletter.js');
  res = mockRes();
  await send({ method:'POST', headers:{ 'x-admin-secret':'sec' }, body:{ subject:'Nuevo', bodyHtml:'<p>hola</p>' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.body.sent, 1, 'solo manda a confirmados');
  assert.deepStrictEqual(sentTo, ['a@b.com']);
  console.log('OK admin-newsletter');
})().catch(e => { console.error(e); process.exit(1); });
