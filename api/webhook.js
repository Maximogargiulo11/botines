const { put, get, del } = require('@vercel/blob');
const crypto = require('crypto');
const { sendConfirmationEmail } = require('./_email');
const { markCouponUsed } = require('./_coupons');
const { markRecovered } = require('./_carts');

async function readJsonBlob(pathname) {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text());
  } catch { return null; }
}

// Resuelve a qué comprador/pedido corresponde un pago, SIN adivinar por monto.
// Usa la metadata del pago y, como respaldo confiable, el registro que guardó
// create-preference (identificado por external_reference). Devuelve null si no
// se puede identificar al comprador — en ese caso NO se manda ningún mail, para
// no enviarle la confirmación a la persona equivocada.
function resolveOrder(payment, pref) {
  const meta = payment.metadata || {};
  const ref = payment.external_reference || '';

  let shipping = meta.nombre ? {
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

  let items = ((payment.additional_info && payment.additional_info.items) || []).map(it => ({
    id: it.id,
    title: it.title,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
  }));

  let coupon = meta.coupon || '';

  // Respaldo: lo que guardamos al crear la preferencia (atado a este pedido por
  // external_reference). Cubre el caso en que MP no propaga la metadata.
  if (pref) {
    if (!shipping && pref.shipping) shipping = pref.shipping;
    if (!items.length && Array.isArray(pref.items)) items = pref.items;
    if (!coupon && pref.coupon) coupon = pref.coupon;
  }

  if (!shipping || !shipping.email) return null;

  const orderId = ref || String(payment.id);
  const payerName = `${shipping.nombre || ''} ${shipping.apellido || ''}`.trim()
    || `${(payment.payer && payment.payer.first_name) || ''} ${(payment.payer && payment.payer.last_name) || ''}`.trim();

  return {
    id: orderId,
    mp_payment_id: String(payment.id),
    status: payment.status,
    amount: payment.transaction_amount,
    payer_name: payerName,
    payer_email: shipping.email,
    shipping,
    items,
    coupon: coupon || null,
  };
}

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

    const ref = payment.external_reference || '';
    const pref = ref ? await readJsonBlob(`prefs/${ref}.json`) : null;
    const order = resolveOrder(payment, pref);

    if (!order) {
      console.error(`webhook: pago ${payment.id} sin comprador identificable (ref=${ref || '-'}); no se envía mail para evitar cruces`);
      return res.status(200).end();
    }

    const pathname = `orders/${order.id}.json`;
    const existing = await readJsonBlob(pathname);
    order.date = (existing && existing.date) || new Date().toISOString();
    if (existing && existing.confirmationSentAt) order.confirmationSentAt = existing.confirmationSentAt;

    await markRecovered(order.shipping.email);

    // Confirmación de compra: se manda UNA sola vez, al email de este pedido.
    if (payment.status === 'approved' && !order.confirmationSentAt) {
      const r = await sendConfirmationEmail(order);
      if (r && r.sent) order.confirmationSentAt = new Date().toISOString();
      else console.error(`webhook: no se pudo enviar confirmación a ${order.payer_email}: ${(r && r.reason) || 'motivo desconocido'}`);
    }

    await saveOrder(pathname, order);

    if (payment.status === 'approved') {
      await trackGA4Purchase(order);
      if (order.coupon) await markCouponUsed(order.coupon);
      if (ref) { try { await del(`prefs/${ref}.json`); } catch {} }
    }
  } catch (err) {
    console.error('webhook error:', err.message);
  }

  return res.status(200).end();
};

async function trackGA4Purchase(order) {
  // Credenciales del Measurement Protocol de GA4. Se leen de variables de
  // entorno (configuralas en Vercel); el fallback mantiene el tracking hasta
  // que estén seteadas. El api_secret es sensible: rotalo en GA4 y movelo a
  // GA4_API_SECRET para dejar de tenerlo en el código.
  const measurementId = process.env.GA4_MEASUREMENT_ID || 'G-EY02HQBMZJ';
  const apiSecret = process.env.GA4_API_SECRET || 'rB-0yIapRsW-xkMNpp3wvw';
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
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

async function saveOrder(pathname, order) {
  // Un blob privado por pedido, identificado por su orderId (== external_reference).
  // allowOverwrite hace idempotente el reenvío del mismo webhook. Nunca queda
  // servido públicamente.
  await put(pathname, JSON.stringify(order, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

module.exports.resolveOrder = resolveOrder;
