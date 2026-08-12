const { listSubscribers } = require('./_subscribers');

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'No autorizado' });

  const { subject, bodyHtml, imageUrl, linkUrl } = req.body || {};
  if (!subject || !bodyHtml) return res.status(400).json({ error: 'Faltan asunto o contenido' });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Resend no configurado (falta RESEND_API_KEY)' });

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px; max-width:600px;">
      ${imageUrl ? `<img src="${esc(imageUrl)}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px;" />` : ''}
      <div>${bodyHtml}</div>
      ${linkUrl ? `<p style="margin-top:20px;"><a href="${esc(linkUrl)}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Ver más</a></p>` : ''}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Recibís este mail porque te suscribiste en Botines Alta Gama Córdoba.</p>
    </div>`;

  try {
    const { Resend } = require('resend');
    const resend = new Resend(apiKey);
    const recipients = (await listSubscribers()).filter(s => s.status === 'confirmed');
    let sent = 0, failed = 0;
    for (const s of recipients) {
      const { error } = await resend.emails.send({
        from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
        to: s.email, subject, html,
      });
      if (error) { failed++; console.error('newsletter send error a', s.email, error.message || error); }
      else sent++;
    }
    return res.status(200).json({ sent, failed, total: recipients.length });
  } catch (err) {
    console.error('send-newsletter error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
