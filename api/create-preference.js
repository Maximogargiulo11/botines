const SITE_URL = process.env.SITE_URL || 'https://botinesweb.vercel.app';

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

  const { items } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const preference = {
    items: items.map(item => ({
      id: item.id,
      title: `${item.name} — ${item.colorway} — Talle ${item.size} EU`,
      quantity: item.qty || 1,
      unit_price: Number(item.price),
      currency_id: 'ARS',
      ...(item.image ? { picture_url: `${SITE_URL}/${item.image}` } : {}),
    })),
    back_urls: {
      success: `${SITE_URL}/#/pago-exitoso`,
      failure: `${SITE_URL}/#/pago-fallido`,
      pending: `${SITE_URL}/#/pago-pendiente`,
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
