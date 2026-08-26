// tests/newsletter-article.test.js
const assert = require('assert');
const path = require('path');
process.env.ADMIN_API_SECRET = 'sec';
process.env.RESEND_API_KEY = 'test';

const subsPath = require.resolve('../api/_subscribers.js');
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  listSubscribers: async () => ([{ email: 'a@b.com', status: 'confirmed' }]),
}};
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: function () { this.emails = { send: async () => ({ error: null }) }; },
}};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
const store = {};
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (p, body) => { store[p] = body; return { pathname: p }; },
  get: async (p) => store[p] !== undefined ? { statusCode: 200, stream: new Response(store[p]).body } : { statusCode: 404, stream: null },
  list: async ({ prefix }) => ({ blobs: Object.keys(store).filter(k => k.startsWith(prefix)).map(k => ({ pathname: k })) }),
}};

const send = require('../api/send-newsletter.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const AUTH = { 'x-admin-secret': 'sec' };
const payload = { subject: 'Nueva noticia', bodyHtml: '<p>hola</p>', articleId: 'art123' };

(async () => {
  // 1) primer envío → 200 y registra
  let res = mockRes();
  await send({ method:'POST', headers: AUTH, body: payload }, res);
  assert.strictEqual(res.code, 200, 'primer envío ok');
  assert.strictEqual(res.body.sent, 1);

  // 2) segundo envío sin force → 409 alreadySent
  res = mockRes();
  await send({ method:'POST', headers: AUTH, body: payload }, res);
  assert.strictEqual(res.code, 409, 'bloquea duplicado');
  assert.ok(res.body.alreadySent, 'marca alreadySent');
  assert.ok(res.body.sentAt, 'devuelve la fecha del envío previo');

  // 3) con force → vuelve a enviar
  res = mockRes();
  await send({ method:'POST', headers: AUTH, body: { ...payload, force: true } }, res);
  assert.strictEqual(res.code, 200, 'force reenvía');

  // 4) GET → mapa de enviados
  res = mockRes();
  await send({ method:'GET', headers: AUTH }, res);
  assert.strictEqual(res.code, 200);
  assert.ok(res.body.sent && res.body.sent['art123'], 'el mapa incluye el lanzamiento enviado');

  // 5) sin auth → 401
  res = mockRes();
  await send({ method:'GET', headers: {} }, res);
  assert.strictEqual(res.code, 401);

  console.log('OK newsletter-article');
})().catch(e => { console.error(e); process.exit(1); });
