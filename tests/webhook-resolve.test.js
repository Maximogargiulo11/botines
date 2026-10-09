// tests/webhook-resolve.test.js — emparejamiento pago↔pedido del webhook de MP.
// Verifica que la confirmación se arme SIEMPRE para el comprador correcto y que
// nunca se adivine por monto (origen del bug de "mail de otra compra").
const assert = require('assert');
const path = require('path');

// Mock de las dependencias pesadas antes de requerir el webhook, para no
// necesitar @vercel/blob / resend / red. Sólo testeamos resolveOrder (puro).
const mock = (name, exports) => {
  const p = name.startsWith('.')
    ? path.join(__dirname, '..', 'api', name.replace(/^\.\.\/api\//, '') + '.js')
    : require.resolve(name, { paths: [path.join(__dirname, '..')] });
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
mock('@vercel/blob', { put: async () => {}, get: async () => ({ statusCode: 404 }), del: async () => {}, list: async () => ({ blobs: [] }) });
mock('resend', { Resend: class { constructor() { this.emails = { send: async () => ({ error: null }) }; } } });
mock('../api/_coupons', { markCouponUsed: async () => {} });
mock('../api/_carts', { markRecovered: async () => {} });

const { resolveOrder } = require('../api/webhook.js');

const payment = (over) => ({
  id: 987654,
  status: 'approved',
  transaction_amount: 699999,
  external_reference: 'mp-abc123',
  payer: { first_name: 'Mp', last_name: 'Payer' },
  additional_info: { items: [{ id: 'merc-002', title: 'Bota — Rojo — Talle 42 EU', quantity: 1, unit_price: 699999 }] },
  metadata: {},
  ...over,
});

const META = {
  nombre: 'Ana', apellido: 'Gómez', email: 'ana@x.com', dni: '30111222',
  provincia: 'Córdoba', localidad: 'Córdoba', direccion: 'Calle 1', codigo_postal: '5000',
  celular: '3510000000', descripcion: '', coupon: '',
};

// 1) Con metadata presente: usa ese comprador y ese email.
let o = resolveOrder(payment({ metadata: META }), null);
assert.ok(o, 'arma el pedido con metadata');
assert.strictEqual(o.payer_email, 'ana@x.com', 'mail del comprador de la metadata');
assert.strictEqual(o.shipping.codigoPostal, '5000', 'mapea codigo_postal → codigoPostal');
assert.strictEqual(o.id, 'mp-abc123', 'orderId = external_reference');

// 2) Sin metadata pero con pref (recuperado por external_reference): usa el pref.
const pref = {
  shipping: { nombre: 'Luis', apellido: 'Pérez', email: 'luis@x.com', dni: '1', provincia: 'CBA', localidad: 'CBA', direccion: 'x', codigoPostal: '5000', celular: '1', descripcion: '' },
  items: [{ id: 'merc-002', title: 'Bota — Rojo — Talle 42 EU', quantity: 1, unit_price: 699999 }],
  coupon: '',
};
o = resolveOrder(payment({ metadata: {}, additional_info: { items: [] } }), pref);
assert.ok(o, 'arma el pedido desde el pref cuando falta metadata');
assert.strictEqual(o.payer_email, 'luis@x.com', 'mail del comprador del pref');
assert.strictEqual(o.items.length, 1, 'items recuperados del pref');

// 3) Sin metadata y sin pref: NO se puede identificar → null (no se manda mail).
o = resolveOrder(payment({ metadata: {}, additional_info: { items: [] } }), null);
assert.strictEqual(o, null, 'sin comprador identificable devuelve null (no manda mail)');

// 4) Dos pagos del MISMO monto pero distinto external_reference → pedidos y
//    compradores distintos. Prueba de que NUNCA se cruzan por monto.
const pa = resolveOrder(payment({ external_reference: 'mp-AAA', metadata: { ...META, email: 'a@x.com' } }), null);
const pb = resolveOrder(payment({ external_reference: 'mp-BBB', metadata: { ...META, email: 'b@x.com' } }), null);
assert.strictEqual(pa.amount, pb.amount, 'mismo monto');
assert.notStrictEqual(pa.id, pb.id, 'orderId distinto');
assert.strictEqual(pa.payer_email, 'a@x.com');
assert.strictEqual(pb.payer_email, 'b@x.com', 'cada uno a su propio mail, sin cruce');

console.log('OK webhook-resolve');
