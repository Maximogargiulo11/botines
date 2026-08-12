const { put } = require('@vercel/blob');
const { getTrustedPrice } = require('./_products');
const { validateCoupon } = require('./_coupons');

const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'email', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items, shipping, coupon } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const missingFields = REQUIRED_SHIPPING_FIELDS.filter(f => !shipping || !String(shipping[f] || '').trim());
  if (missingFields.length) {
    return res.status(400).json({ error: `Faltan datos de envío: ${missingFields.join(', ')}` });
  }

  const unknownItems = [];
  const orderItems = items.map(item => {
    const trustedPrice = getTrustedPrice(item.id);
    if (trustedPrice === undefined) {
      unknownItems.push(item.id);
      return null;
    }
    const qty = Math.max(1, Math.min(20, Math.floor(Number(item.qty)) || 1));
    return {
      id: item.id,
      title: `${item.name} — ${item.colorway} — Talle ${item.size} ${String(item.unit || 'EU').toUpperCase()}`,
      quantity: qty,
      unit_price: trustedPrice,
    };
  });

  if (unknownItems.length) {
    return res.status(400).json({ error: `Producto no encontrado en el catálogo: ${unknownItems.join(', ')}` });
  }

  const subtotal = orderItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  let couponCode = null;
  let mult = 0.9; // transferencia: 10% off
  if (coupon) {
    const v = await validateCoupon(coupon);
    if (v.valid) { couponCode = v.coupon.code; mult = 0.85; } // + 5% cupón = 15%
  }
  const amount = Math.round(subtotal * mult);

  const orderId = `transfer-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const order = {
    id: orderId,
    payment_method: 'transferencia',
    status: 'pendiente',
    coupon: couponCode,
    amount,
    date: new Date().toISOString(),
    payer_name: `${shipping.nombre} ${shipping.apellido}`.trim(),
    payer_email: shipping.email,
    shipping: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      email: shipping.email,
      dni: shipping.dni,
      provincia: shipping.provincia,
      localidad: shipping.localidad,
      direccion: shipping.direccion,
      codigoPostal: shipping.codigoPostal,
      celular: shipping.celular,
      descripcion: shipping.descripcion || '',
    },
    items: orderItems,
  };

  try {
    await put(`orders/${orderId}.json`, JSON.stringify(order, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });
    return res.status(200).json({ ok: true, orderId });
  } catch (err) {
    console.error('create-transfer-order error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
