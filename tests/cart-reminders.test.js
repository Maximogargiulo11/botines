// tests/cart-reminders.test.js — procesador de recordatorios.
const assert = require('assert');
const path = require('path');

// _carts mockeado en memoria.
const cartsPath = require.resolve('../api/_carts.js');
const saved = {};
const deleted = [];
require.cache[cartsPath] = { id: cartsPath, filename: cartsPath, loaded: true, exports: {
  saveCart: async (c) => { saved[c.email] = c; },
  deleteCart: async (email) => { deleted.push(email); },
  listCarts: async () => [],
}};

// _coupons mockeado.
const coupPath = require.resolve('../api/_coupons.js');
let couponsCreated = 0;
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  createCoupon: async (email) => { couponsCreated++; return { code: 'BAG-TEST1', email, expiresAt: '2099-01-01T00:00:00.000Z' }; },
}};

// resend mockeado.
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
const sentEmails = [];
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: class { constructor(){ this.emails = { send: async (m) => { sentEmails.push(m); return { error: null }; } }; } },
}};

const { processCart, recoverLink } = require('../scripts/cart-reminders.js');

const HOUR = 60 * 60 * 1000;
const resend = new (require('resend').Resend)('x');
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const baseCart = (over) => ({
  email: 'u@x.com', name: 'U', status: 'pending',
  items: [{ id: 'p1', name: 'Bota', colorway: 'Negro', size: '42', unit: 'us', qty: 1, price: 100000, image: 'i.jpg' }],
  createdAt: ago(0), updatedAt: ago(0), sent: { t1:false, t2:false, t3:false }, couponCode: null,
  ...over,
});

(async () => {
  // Recién creado (<1h): no envía nada.
  sentEmails.length = 0;
  let r = await processCart(resend, baseCart({ createdAt: ago(10 * 60 * 1000) }));
  assert.strictEqual(r, 'idle', '<1h no envía');
  assert.strictEqual(sentEmails.length, 0);

  // >=1h y sin t1: envía toque 1, marca t1.
  sentEmails.length = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(2 * HOUR) }));
  assert.strictEqual(r, 'sent');
  assert.strictEqual(sentEmails.length, 1);
  assert.ok(/olvidaste/i.test(sentEmails[0].subject), 'asunto del toque 1');
  assert.strictEqual(saved['u@x.com'].sent.t1, true);

  // >=24h con t1 ya enviado: envía toque 2 (un solo toque por corrida).
  sentEmails.length = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(25 * HOUR), sent: { t1:true, t2:false, t3:false } }));
  assert.strictEqual(r, 'sent');
  assert.strictEqual(sentEmails.length, 1, 'un solo mail por corrida');
  assert.ok(/agotando/i.test(sentEmails[0].subject), 'asunto del toque 2');
  assert.strictEqual(saved['u@x.com'].sent.t2, true);

  // >=48h con t1,t2 enviados: crea cupón y envía toque 3 con el código.
  sentEmails.length = 0; couponsCreated = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(50 * HOUR), sent: { t1:true, t2:true, t3:false } }));
  assert.strictEqual(r, 'sent');
  assert.strictEqual(couponsCreated, 1, 'crea un cupón en el toque 3');
  assert.ok(sentEmails[0].html.includes('BAG-TEST1'), 'el mail incluye el cupón');
  assert.strictEqual(saved['u@x.com'].couponCode, 'BAG-TEST1');
  assert.strictEqual(saved['u@x.com'].sent.t3, true);

  // Todos los toques enviados y no vencido: idle, no reenvía.
  sentEmails.length = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(60 * HOUR), updatedAt: ago(1 * HOUR), sent: { t1:true, t2:true, t3:true } }));
  assert.strictEqual(r, 'idle');
  assert.strictEqual(sentEmails.length, 0, 'nunca repite un toque');

  // t3 enviado hace +7 días: purga.
  deleted.length = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(30 * 24 * HOUR), updatedAt: ago(8 * 24 * HOUR), sent: { t1:true, t2:true, t3:true } }));
  assert.strictEqual(r, 'purged');
  assert.ok(deleted.includes('u@x.com'), 'purga carritos viejos ya completados');

  // Recuperado: no envía nada.
  sentEmails.length = 0;
  r = await processCart(resend, baseCart({ status: 'recovered', recoveredAt: ago(1 * HOUR), createdAt: ago(50 * HOUR), sent: { t1:true, t2:false, t3:false } }));
  assert.strictEqual(r, 'skip');
  assert.strictEqual(sentEmails.length, 0, 'no escribe a quien ya compró');

  // Muy viejo sin ningún toque (script estuvo caído): arranca por el toque 1.
  sentEmails.length = 0;
  r = await processCart(resend, baseCart({ createdAt: ago(100 * HOUR), sent: { t1:false, t2:false, t3:false } }));
  assert.strictEqual(r, 'sent');
  assert.ok(/olvidaste/i.test(sentEmails[0].subject), 'aunque viejo, arranca por el toque 1');

  // recoverLink codifica el carrito y arma la URL.
  const link = recoverLink(baseCart(), 'BAG-XYZ');
  assert.ok(link.includes('/recuperar?c='), 'link de recuperación válido');
  assert.ok(link.includes('coupon=BAG-XYZ'), 'incluye el cupón');
  const c = decodeURIComponent(link.split('c=')[1].split('&')[0]);
  const payload = JSON.parse(Buffer.from(c, 'base64').toString());
  assert.deepStrictEqual(payload, [{ id: 'p1', sz: '42', u: 'us', q: 1 }], 'payload correcto');

  console.log('OK cart-reminders');
})().catch(e => { console.error(e); process.exit(1); });
