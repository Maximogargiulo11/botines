// tests/coupons.test.js
const assert = require('assert');
const path = require('path');

// Mock en memoria de @vercel/blob
const store = {};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (pathname, body) => { store[pathname] = body; return { pathname }; },
  get: async (pathname) => store[pathname] !== undefined
    ? { statusCode: 200, stream: new Response(store[pathname]).body }
    : { statusCode: 404, stream: null },
  list: async () => ({ blobs: [] }),
  del: async () => {},
}};

const C = require('../api/_coupons.js');

(async () => {
  const code = C.generateCouponCode();
  assert.match(code, /^BAG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/, 'formato de código');

  const cp = await C.createCoupon('a@b.com');
  assert.strictEqual(cp.used, false);
  let v = await C.validateCoupon(cp.code);
  assert.strictEqual(v.valid, true, 'cupón nuevo es válido');

  v = await C.validateCoupon('  ' + cp.code.toLowerCase() + ' ');
  assert.strictEqual(v.valid, true, 'valida con espacios y minúsculas');

  await C.markCouponUsed(cp.code);
  v = await C.validateCoupon(cp.code);
  assert.strictEqual(v.valid, false, 'usado no es válido');
  assert.strictEqual(v.reason, 'Cupón ya usado');

  v = await C.validateCoupon('BAG-ZZZZZZ');
  assert.strictEqual(v.valid, false);
  assert.strictEqual(v.reason, 'Cupón inexistente');

  console.log('OK coupons');
})().catch(e => { console.error(e); process.exit(1); });
