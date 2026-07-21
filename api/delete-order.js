const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const secret = process.env.ADMIN_API_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Falta orderId' });

  // orderId sólo puede contener caracteres seguros: así el pathname a borrar
  // queda siempre acotado a orders/<id>.json y no se puede apuntar a otro blob.
  if (!/^[a-zA-Z0-9_-]+$/.test(orderId)) {
    return res.status(400).json({ error: 'orderId inválido' });
  }

  try {
    await del(`orders/${orderId}.json`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete-order error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
