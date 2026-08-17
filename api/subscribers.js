const crypto = require('crypto');
const { listSubscribers, getSubscriber, saveSubscriber, saveToken, deleteToken, emailKey } = require('./_subscribers');
const { sendConfirmSubscription } = require('./_email');

module.exports = async function handler(req, res) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'No autorizado' });

  // GET: listar suscriptores
  if (req.method === 'GET') {
    try {
      const subs = await listSubscribers();
      subs.sort((a, b) => new Date(b.subscribedAt || 0) - new Date(a.subscribedAt || 0));
      return res.status(200).json(subs);
    } catch (err) {
      console.error('subscribers error:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  // POST: reenviar el mail de confirmación a un suscriptor pendiente
  if (req.method === 'POST') {
    const { email } = req.body || {};
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return res.status(400).json({ error: 'Falta el email' });
    try {
      const sub = await getSubscriber(clean);
      if (!sub) return res.status(404).json({ error: 'No existe ese suscriptor' });
      if (sub.status === 'confirmed') return res.status(200).json({ ok: true, already: true });

      const token = crypto.randomBytes(24).toString('hex');
      if (sub.confirmToken) { try { await deleteToken(sub.confirmToken); } catch (e) {} }
      await saveSubscriber({ ...sub, status: 'pending', confirmToken: token, lastSentAt: new Date().toISOString() });
      await saveToken(token, emailKey(clean));

      const r = await sendConfirmSubscription(clean, sub.name || '', token);
      if (!r.sent) return res.status(502).json({ error: r.reason || 'No se pudo enviar el mail' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('resend confirmation error:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
