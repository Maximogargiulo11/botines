const { put, list, get } = require('@vercel/blob');
const crypto = require('crypto');
const { sendConfirmationEmail } = require('./_email');
const { markCouponUsed } = require('./_coupons');

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

  const signatureCheck = verifyMpSignature(req);
  if (signatureCheck === false) {
    console.error('webhook: firma de MercadoPago inválida, notificación ignorada');
    return res.status(200).end();
  }

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
      email: meta.email,
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

    if (shipping) {
      await saveOrder(order);
      if (payment.status === 'approved') {
        await trackGA4Purchase(order);
        if (meta.coupon) await markCouponUsed(meta.coupon);
      }
    } else if (payment.status === 'approved') {
      await tryAutoMatchTransfer(payment);
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

// Verifica la firma que MercadoPago manda en el header x-signature.
// Devuelve true/false si MP_WEBHOOK_SECRET está configurado, o null si no
// (en ese caso no se puede verificar y se sigue procesando, igual que antes
// de tener este secreto configurado en Vercel).
function verifyMpSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return null;

  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query && req.query['data.id'];
  if (!signatureHeader || !requestId || !dataId) return false;

  const parts = {};
  for (const kv of signatureHeader.split(',')) {
    const [k, v] = kv.split('=');
    if (k) parts[k.trim()] = (v || '').trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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

async function tryAutoMatchTransfer(payment) {
  const amount = payment.transaction_amount;
  if (!amount) return;

  const cutoffMs = Date.now() - 72 * 60 * 60 * 1000;
  const { blobs } = await list({ prefix: 'orders/transfer-' });

  const candidates = [];
  for (const b of blobs) {
    const result = await get(b.pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) continue;
    const text = await new Response(result.stream).text();
    let order;
    try { order = JSON.parse(text); } catch { continue; }
    if (order.status !== 'pendiente') continue;
    if (new Date(order.date).getTime() < cutoffMs) continue;
    if (order.amount !== amount) continue;
    candidates.push({ pathname: b.pathname, order });
  }

  if (candidates.length !== 1) {
    console.log(`webhook: transferencia de $${amount} sin match único (${candidates.length} candidato(s) pendiente(s))`);
    return;
  }

  const { pathname, order } = candidates[0];
  order.status = 'approved';
  order.mp_payment_id = String(payment.id);
  await put(pathname, JSON.stringify(order, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
  await sendConfirmationEmail(order);
  if (order.coupon) await markCouponUsed(order.coupon);
}
