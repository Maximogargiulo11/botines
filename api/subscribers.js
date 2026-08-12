const { listSubscribers } = require('./_subscribers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'No autorizado' });
  try {
    const subs = await listSubscribers();
    subs.sort((a, b) => new Date(b.subscribedAt || 0) - new Date(a.subscribedAt || 0));
    return res.status(200).json(subs);
  } catch (err) {
    console.error('subscribers error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
