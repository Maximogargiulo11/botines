const { get, put } = require('@vercel/blob');
const { sendConfirmationEmail } = require('./_email');
const { markCouponUsed } = require('./_coupons');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const secret = process.env.ADMIN_API_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Falta orderId' });

  const pathname = `orders/${orderId}.json`;

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const text = await new Response(result.stream).text();
    const order = JSON.parse(text);

    if (order.status !== 'pendiente') {
      return res.status(400).json({ error: 'El pedido no está pendiente' });
    }

    order.status = 'approved';
    await put(pathname, JSON.stringify(order, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    if (order.coupon) await markCouponUsed(order.coupon);

    const emailResult = (await sendConfirmationEmail(order)) || { sent: false, reason: 'Motivo desconocido.' };

    return res.status(200).json({ ok: true, emailSent: emailResult.sent, emailReason: emailResult.reason || null });
  } catch (err) {
    console.error('confirm-order error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
