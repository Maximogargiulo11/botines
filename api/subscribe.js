const crypto = require('crypto');
const { getSubscriber, saveSubscriber, saveToken, emailKey } = require('./_subscribers');
const { sendConfirmSubscription } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, name, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot: bot

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return res.status(400).json({ error: 'Email inválido' });
  if (!cleanName) return res.status(400).json({ error: 'Falta el nombre' });

  try {
    const existing = await getSubscriber(cleanEmail);
    if (existing && existing.status === 'confirmed') return res.status(200).json({ ok: true, already: true });
    if (existing && existing.status === 'pending' && existing.lastSentAt &&
        (Date.now() - new Date(existing.lastSentAt).getTime()) < 10 * 60 * 1000) {
      return res.status(200).json({ ok: true }); // throttle anti-spam
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    await saveSubscriber({
      email: cleanEmail, name: cleanName, status: 'pending', confirmToken: token,
      subscribedAt: (existing && existing.subscribedAt) || now, lastSentAt: now,
      confirmedAt: null, couponCode: null, couponExpiresAt: null, couponUsed: false,
    });
    await saveToken(token, emailKey(cleanEmail));
    await sendConfirmSubscription(cleanEmail, cleanName, token);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
