// Endpoint temporal para restaurar el pedido de prueba que quedó en el
// orders.json viejo antes de migrar a Vercel Blob. Se borra después de usarlo.
const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const secret = process.env.ADMIN_API_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const order = req.body;
  if (!order || !order.mp_payment_id) {
    return res.status(400).json({ error: 'Falta mp_payment_id' });
  }

  await put(`orders/${order.mp_payment_id}.json`, JSON.stringify(order, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });

  return res.status(200).json({ ok: true });
};
