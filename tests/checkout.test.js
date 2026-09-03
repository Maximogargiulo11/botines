// tests/checkout.test.js — endpoint consolidado del checkout.
const assert = require('assert');
const path = require('path');

// Mock del catálogo: p1 existe, p2 no.
const prodPath = require.resolve('../api/_products.js');
require.cache[prodPath] = { id: prodPath, filename: prodPath, loaded: true, exports: {
  getTrustedPrice: (id) => (id === 'p1' ? 100000 : undefined),
}};

const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  COUPON_DISCOUNT: 0.05,
  validateCoupon: async (c) => c === 'BAG-OK' ? { valid: true, coupon: { code: 'BAG-OK' } } : { valid: false, reason: 'no' },
}};

// Store de blob en memoria para _carts real.
const store = {};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (pathname, body) => { store[pathname] = body; return { pathname }; },
  get: async (pathname) => store[pathname] !== undefined
    ? { statusCode: 200, stream: new Response(store[pathname]).body }
    : { statusCode: 404, stream: null },
  list: async ({ prefix }) => ({ blobs: Object.keys(store).filter(k => k.startsWith(prefix)).map(k => ({ pathname: k })) }),
  del: async (p) => { delete store[p]; },
}};

const handler = require('../api/checkout.js');
const { cartKey } = require('../api/_carts.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const cartJson = (email) => JSON.parse(store[`carts/${cartKey(email)}.json`]);

(async () => {
  // --- validate-coupon ---
  let res = mockRes();
  await handler({ method:'POST', body:{ action:'validate-coupon', code:'BAG-OK' } }, res);
  assert.deepStrictEqual(res.body, { valid: true, discount: 0.05, reason: undefined });

  res = mockRes();
  await handler({ method:'POST', body:{ action:'validate-coupon', code:'NOPE' } }, res);
  assert.strictEqual(res.body.valid, false);
  assert.strictEqual(res.body.discount, 0);

  // --- save-cart: email inválido ---
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'noesmail', items:[{id:'p1'}] } }, res);
  assert.strictEqual(res.code, 400, 'email inválido → 400');

  // --- save-cart: descarta items desconocidos, usa precio confiable ---
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'A@B.com', name:'Ana',
    items:[{ id:'p1', name:'N', colorway:'C', size:'42', unit:'us', qty:2, price:1 }, { id:'p2', name:'X' }] } }, res);
  assert.strictEqual(res.code, 200);
  let cart = cartJson('a@b.com');
  assert.strictEqual(cart.items.length, 1, 'p2 (desconocido) se descarta');
  assert.strictEqual(cart.items[0].price, 100000, 'precio confiable del servidor, no el del cliente');
  assert.strictEqual(cart.items[0].qty, 2);
  assert.strictEqual(cart.status, 'pending');
  assert.deepStrictEqual(cart.sent, { t1:false, t2:false, t3:false });
  const createdAt = cart.createdAt;

  // --- save-cart de nuevo: NO resetea sent, conserva createdAt ---
  store[`carts/${cartKey('a@b.com')}.json`] = JSON.stringify({ ...cart, sent:{ t1:true, t2:false, t3:false } });
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'a@b.com',
    items:[{ id:'p1', name:'N', colorway:'C', size:'43', unit:'us', qty:1 }] } }, res);
  cart = cartJson('a@b.com');
  assert.strictEqual(cart.sent.t1, true, 'no resetea toques ya enviados');
  assert.strictEqual(cart.createdAt, createdAt, 'conserva createdAt original');
  assert.strictEqual(cart.items[0].size, '43', 'actualiza items');

  // --- save-cart tras ciclo COMPLETO (t3 enviado): reinicia la secuencia ---
  // Regresión: un carrito cuyo ciclo de 3 toques ya terminó quedaba pegado en
  // 'idle' para siempre y no volvía a mandar recordatorios al re-abandonarse.
  store[`carts/${cartKey('a@b.com')}.json`] = JSON.stringify({
    ...cart, sent:{ t1:true, t2:true, t3:true }, createdAt:'2000-01-01T00:00:00.000Z',
    updatedAt:'2000-01-01T00:00:00.000Z',
  });
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'a@b.com',
    items:[{ id:'p1', name:'N', colorway:'C', size:'44', unit:'us', qty:1 }] } }, res);
  cart = cartJson('a@b.com');
  assert.deepStrictEqual(cart.sent, { t1:false, t2:false, t3:false }, 'ciclo completo → resetea toques');
  assert.notStrictEqual(cart.createdAt, '2000-01-01T00:00:00.000Z', 'ciclo completo → createdAt nuevo');
  assert.strictEqual(cart.status, 'pending');

  // --- save-cart con createdAt inválido: reinicia (no arrastra NaN) ---
  store[`carts/${cartKey('a@b.com')}.json`] = JSON.stringify({
    ...cart, sent:{ t1:false, t2:false, t3:false }, createdAt:'no-es-fecha',
  });
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'a@b.com',
    items:[{ id:'p1', name:'N', colorway:'C', size:'45', unit:'us', qty:1 }] } }, res);
  cart = cartJson('a@b.com');
  assert.ok(Number.isFinite(new Date(cart.createdAt).getTime()), 'createdAt inválido → se reemplaza por uno válido');

  // --- save-cart sin items válidos → 400 ---
  res = mockRes();
  await handler({ method:'POST', body:{ action:'save-cart', email:'c@d.com', items:[{ id:'zzz' }] } }, res);
  assert.strictEqual(res.code, 400, 'sin productos válidos → 400');

  // --- acción desconocida ---
  res = mockRes();
  await handler({ method:'POST', body:{ action:'foo' } }, res);
  assert.strictEqual(res.code, 400);

  console.log('OK checkout');
})().catch(e => { console.error(e); process.exit(1); });
