const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // MercadoPago also sends a GET to validate the endpoint
  if (req.method === 'GET') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).end();

  const body = req.body || {};
  const { type, action, data } = body;

  const isPaymentEvent = type === 'payment' || action === 'payment.created' || action === 'payment.updated';
  if (!isPaymentEvent) return res.status(200).end();

  const paymentId = data && data.id;
  if (!paymentId) return res.status(200).end();

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) return res.status(200).end();

    const payment = await mpRes.json();

    const meta = payment.metadata || {};
    const shipping = meta.nombre ? {
      nombre: meta.nombre,
      apellido: meta.apellido,
      dni: meta.dni,
      provincia: meta.provincia,
      localidad: meta.localidad,
      direccion: meta.direccion,
      codigoPostal: meta.codigo_postal,
      celular: meta.celular,
      descripcion: meta.descripcion || '',
    } : null;

    const order = {
      id: Math.random().toString(36).slice(2, 9),
      mp_payment_id: String(payment.id),
      status: payment.status,
      amount: payment.transaction_amount,
      date: new Date().toISOString(),
      payer_name: `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim(),
      payer_email: payment.payer?.email || '',
      shipping,
      items: (payment.additional_info?.items || []).map(it => ({
        id: it.id,
        title: it.title,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    };

    await saveOrder(order);
    if (payment.status === 'approved') {
      await trackGA4Purchase(order);
    }
  } catch (err) {
    console.error('webhook error:', err.message);
  }

  return res.status(200).end();
};

async function trackGA4Purchase(order) {
  try {
    await fetch(
      'https://www.google-analytics.com/mp/collect?measurement_id=G-EY02HQBMZJ&api_secret=rB-0yIapRsW-xkMNpp3wvw',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: order.mp_payment_id,
          events: [{
            name: 'purchase',
            params: {
              transaction_id: order.mp_payment_id,
              currency: 'ARS',
              value: order.amount,
              items: order.items.map(it => ({
                item_id: it.id,
                item_name: it.title,
                price: it.unit_price,
                quantity: it.quantity,
              })),
            },
          }],
        }),
      }
    );
  } catch (err) {
    console.error('ga4 track error:', err.message);
  }
}

async function saveOrder(order) {
  // Un blob privado por pago (indexado por mp_payment_id, sin duplicados si
  // MercadoPago reenvía el mismo webhook). Nunca queda servido públicamente,
  // a diferencia del viejo orders.json comiteado al repo.
  await put(`orders/${order.mp_payment_id}.json`, JSON.stringify(order, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}
