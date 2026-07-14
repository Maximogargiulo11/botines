const { list, get } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const secret = process.env.ADMIN_API_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { blobs } = await list({ prefix: 'orders/' });

    const orders = await Promise.all(blobs.map(async (b) => {
      const result = await get(b.pathname, { access: 'private' });
      if (!result || result.statusCode !== 200) return null;
      const text = await streamToString(result.stream);
      try { return JSON.parse(text); } catch { return null; }
    }));

    const valid = orders.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json(valid);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}
