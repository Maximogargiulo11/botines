const { Resend } = require('resend');

const IG_PROFILE = 'https://instagram.com/botinesaltagamacba';
const IG_DM = 'https://ig.me/m/botinesaltagamacba';
const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';

const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Los items se guardan con el título "Nombre — Colorway — Talle X US".
// Separamos el talle (con su unidad, ej. "9 US") para mostrarlo en su línea.
function parseItem(title) {
  const parts = String(title ?? '').split(' — Talle ');
  if (parts.length === 2) {
    return { producto: parts[0], talle: parts[1].trim() };
  }
  return { producto: String(title ?? ''), talle: null };
}

async function sendConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY no configurado, no se pudo enviar el mail de confirmación para', order.id);
    return { sent: false, reason: 'Resend no está configurado (falta RESEND_API_KEY en Vercel).' };
  }
  if (!order.shipping || !order.shipping.email) {
    console.error('Pedido sin email, no se pudo enviar el mail de confirmación:', order.id);
    return { sent: false, reason: 'El pedido no tiene email de contacto.' };
  }

  const itemsDetailsHtml = (order.items || []).map(it => {
    const { producto, talle } = parseItem(it.title);
    const qty = Number(it.quantity) || 0;
    return `<li>Producto: ${esc(producto)}</li>`
      + (talle ? `<li>Talle: ${esc(talle)}</li>` : '')
      + `<li>Cantidad: ${qty}</li>`;
  }).join('');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px;">
      <p>Hola, ${esc(order.shipping.nombre)}</p>
      <p>¡Gracias por confiar en <strong>Botines Alta Gama Córdoba</strong>!</p>
      <p>Te confirmamos que hemos recibido y verificado correctamente tu comprobante de pago, por lo que <strong>tu compra ha sido confirmada</strong>.</p>
      <p><strong>Detalles de tu pedido:</strong></p>
      <ul>
        <li>Número de pedido: #${esc(order.id)}</li>
        ${itemsDetailsHtml}
        <li>Total: ${fmt(order.amount)}</li>
      </ul>
      <p>A partir de este momento, comenzaremos a preparar tu pedido para el envío.</p>
      <p>Te enviaremos una nueva notificación cuando tu pedido haya sido despachado, junto con la información necesaria para realizar su seguimiento.</p>
      <p>Si tenés alguna consulta, podés <a href="${IG_DM}">comunicarte con nuestro equipo</a>.</p>
      <p>¡Muchas gracias por elegir Botines Alta Gama Córdoba!</p>
      <p style="margin-top:24px;">
        Saludos,<br>
        <strong>Equipo de Botines Alta Gama Córdoba</strong><br>
        <a href="${IG_PROFILE}">Instagram @botinesaltagamacba</a> · <a href="${SITE_URL}">Sitio web</a>
      </p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
      to: order.shipping.email,
      subject: '¡Tu compra fue confirmada! — Botines Alta Gama Córdoba',
      html,
    });
    if (error) {
      console.error('email send error:', error.message || error);
      return { sent: false, reason: error.message || 'Resend rechazó el envío (¿dominio sin verificar?).' };
    }
    return { sent: true };
  } catch (err) {
    console.error('email send error:', err.message);
    return { sent: false, reason: err.message || 'Error inesperado al enviar el mail.' };
  }
}

async function sendConfirmSubscription(email, name, token) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY no configurado (confirm subscription)'); return { sent: false, reason: 'Resend no configurado' }; }
  const link = `${SITE_URL}/api/confirm-subscription?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px;">
      <p>¡Hola, ${esc(name)}!</p>
      <p>Gracias por sumarte a <strong>Botines Alta Gama Córdoba</strong>.</p>
      <p>Confirmá tu email para recibir tu <strong>cupón de 5% de descuento</strong> y enterarte de los nuevos lanzamientos:</p>
      <p><a href="${link}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Confirmar mi email</a></p>
      <p style="font-size:13px;color:#6b7280;">Si no fuiste vos, ignorá este mail.</p>
    </div>`;
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(apiKey).emails.send({
      from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
      to: email, subject: 'Confirmá tu email — Botines Alta Gama Córdoba', html,
    });
    if (error) { console.error('confirm sub email error:', error.message || error); return { sent: false, reason: error.message || 'error' }; }
    return { sent: true };
  } catch (err) { console.error('confirm sub email error:', err.message); return { sent: false, reason: err.message }; }
}

async function sendCouponEmail(email, name, code, expiresAt) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY no configurado (coupon email)'); return { sent: false, reason: 'Resend no configurado' }; }
  const vence = new Date(expiresAt).toLocaleDateString('es-AR');
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px;">
      <p>¡Listo, ${esc(name)}! Tu email quedó confirmado.</p>
      <p>Este es tu cupón de <strong>5% de descuento</strong> en tu compra:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px;background:#f3f4f6;padding:14px 18px;border-radius:8px;display:inline-block;">${esc(code)}</p>
      <p>Ingresalo en el checkout, en el campo <strong>"Código de descuento"</strong>. Es de un solo uso y vence el <strong>${esc(vence)}</strong>.</p>
      <p>💡 Pagando por <strong>transferencia</strong> el descuento se suma al 10% habitual: <strong>15% off en total</strong>.</p>
      <p>Cualquier consulta, escribinos por Instagram: <a href="https://ig.me/m/botinesaltagamacba">@botinesaltagamacba</a></p>
    </div>`;
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(apiKey).emails.send({
      from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
      to: email, subject: 'Tu cupón de 5% — Botines Alta Gama Córdoba', html,
    });
    if (error) { console.error('coupon email error:', error.message || error); return { sent: false, reason: error.message || 'error' }; }
    return { sent: true };
  } catch (err) { console.error('coupon email error:', err.message); return { sent: false, reason: err.message }; }
}

module.exports = { sendConfirmationEmail, sendConfirmSubscription, sendCouponEmail };
