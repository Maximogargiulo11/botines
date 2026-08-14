const { getTrustedPrice } = require('./_products');
const { validateCoupon } = require('./_coupons');

const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.MP_ACCESS_TOKEN) {
    console.error('MP_ACCESS_TOKEN no configurado');
    return res.status(500).json({ error: 'Configuración de pago incompleta' });
  }

  const { items, shipping, coupon } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'email', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];
  const missingFields = REQUIRED_SHIPPING_FIELDS.filter(f => !shipping || !String(shipping[f] || '').trim());
  if (missingFields.length) {
    return res.status(400).json({ error: `Faltan datos de envío: ${missingFields.join(', ')}` });
  }

  let couponCode = null;
  let mult = 1;
  if (coupon) {
    const v = await validateCoupon(coupon);
    if (v.valid) { couponCode = v.coupon.code; mult = 0.95; } // 5% off
  }

  const unknownItems = [];
  const preferenceItems = items.map(item => {
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
      unit_price: Math.round(trustedPrice * mult),
      currency_id: 'ARS',
      ...(item.image ? { picture_url: `${SITE_URL}/${item.image}` } : {}),
    };
  });

  if (unknownItems.length) {
    return res.status(400).json({ error: `Producto no encontrado en el catálogo: ${unknownItems.join(', ')}` });
  }

  const preference = {
    items: preferenceItems,
    metadata: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      email: shipping.email,
      dni: shipping.dni,
      provincia: shipping.provincia,
      localidad: shipping.localidad,
      direccion: shipping.direccion,
      codigo_postal: shipping.codigoPostal,
      celular: shipping.celular,
      descripcion: shipping.descripcion || '',
      coupon: couponCode || '',
    },
    back_urls: {
      success: `${SITE_URL}/pago-exitoso`,
      failure: `${SITE_URL}/pago-fallido`,
      pending: `${SITE_URL}/pago-pendiente`,
    },
    auto_return: 'approved',
    notification_url: `${SITE_URL}/api/webhook`,
    statement_descriptor: 'Botines Alta Gama',
    shipments: { mode: 'not_specified' },
  };

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP error status:', response.status, JSON.stringify(data));
      const msg = data.message || (data.error === 'unauthorized' ? 'Token de pago inválido' : 'Error al crear preferencia de pago');
      return res.status(400).json({ error: msg });
    }

    return res.status(200).json({ init_point: data.init_point, id: data.id });
  } catch (err) {
    console.error('create-preference error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
