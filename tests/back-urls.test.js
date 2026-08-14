// tests/back-urls.test.js
const assert = require('assert');
process.env.SITE_URL = 'https://www.botinesaltagamacba.com';
process.env.MP_ACCESS_TOKEN = 'TEST';

const prodPath = require.resolve('../api/_products.js');
require.cache[prodPath] = { id: prodPath, filename: prodPath, loaded: true, exports: {
  getTrustedPrice: (id) => (id === 'p1' ? 100000 : undefined),
}};
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  COUPON_DISCOUNT: 0.05,
  validateCoupon: async () => ({ valid: false, reason: 'x' }),
}};

let sentBody = null;
global.fetch = async (u, opts) => {
  sentBody = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ id: 'pref1', init_point: 'https://mp/init' }) };
};

const handler = require('../api/create-preference.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;}, setHeader(){}, end(){return this;} }; }
const shipping = { nombre:'A', apellido:'B', email:'a@b.com', dni:'1', provincia:'X', localidad:'Y', direccion:'Z', codigoPostal:'1', celular:'1' };

(async () => {
  const res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping } }, res);
  assert.ok(sentBody.back_urls.success.endsWith('/pago-exitoso'), 'success sin #');
  assert.ok(sentBody.back_urls.failure.endsWith('/pago-fallido'), 'failure sin #');
  assert.ok(sentBody.back_urls.pending.endsWith('/pago-pendiente'), 'pending sin #');
  assert.ok(!JSON.stringify(sentBody.back_urls).includes('#'), 'ninguna back_url tiene #');
  console.log('OK back-urls');
})().catch(e => { console.error(e); process.exit(1); });
