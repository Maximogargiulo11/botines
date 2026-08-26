// tests/checkout-coupon.test.js
const assert = require('assert');
const path = require('path');

const prodPath = require.resolve('../api/_products.js');
require.cache[prodPath] = { id: prodPath, filename: prodPath, loaded: true, exports: {
  getTrustedPrice: (id) => (id === 'p1' ? 100000 : undefined),
}};
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  COUPON_DISCOUNT: 0.05,
  validateCoupon: async (c) => c === 'BAG-OK' ? { valid: true, coupon: { code: 'BAG-OK' } } : { valid: false, reason: 'x' },
  markCouponUsed: async () => {},
}};
const cartsPath = require.resolve('../api/_carts.js');
let markedRecovered = null;
require.cache[cartsPath] = { id: cartsPath, filename: cartsPath, loaded: true, exports: {
  markRecovered: async (email) => { markedRecovered = email; },
}};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
let putBody = null;
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (p, body) => { putBody = JSON.parse(body); return { pathname: p }; },
}};

const handler = require('../api/create-transfer-order.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const shipping = { nombre:'A', apellido:'B', email:'a@b.com', dni:'1', provincia:'X', localidad:'Y', direccion:'Z', codigoPostal:'1', celular:'1' };

(async () => {
  let res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping } }, res);
  assert.strictEqual(putBody.amount, 90000, 'transferencia sin cupón = 90.000');
  assert.strictEqual(putBody.coupon || null, null);

  res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping, coupon:'BAG-OK' } }, res);
  assert.strictEqual(putBody.amount, 85000, 'transferencia con cupón = 85.000');
  assert.strictEqual(putBody.coupon, 'BAG-OK', 'guarda el cupón en el pedido');
  assert.strictEqual(markedRecovered, 'a@b.com', 'marca el carrito como recuperado con el email de envío');
  console.log('OK checkout-coupon');
})().catch(e => { console.error(e); process.exit(1); });
