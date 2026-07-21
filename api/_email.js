const { Resend } = require('resend');

const IG_PROFILE = 'https://instagram.com/botinesaltagamacba';
const IG_DM = 'https://ig.me/m/botinesaltagamacba';
const SITE_URL = 'https://botinesweb.vercel.app';

const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Los items se guardan con el título "Nombre — Colorway — Talle X EU".
// Separamos el talle para poder mostrarlo en su propia línea.
function parseItem(title) {
  const parts = String(title ?? '').split(' — Talle ');
  if (parts.length === 2) {
    return { producto: parts[0], talle: parts[1].replace(/\s*EU\s*$/i, '').trim() };
  }
  return { producto: String(title ?? ''), talle: null };
}

async function sendConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY no configurado, no se pudo enviar el mail de confirmación para', order.id);
    return;
  }
  if (!order.shipping || !order.shipping.email) {
    console.error('Pedido sin email, no se pudo enviar el mail de confirmación:', order.id);
    return;
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
    }
  } catch (err) {
    console.error('email send error:', err.message);
  }
}

module.exports = { sendConfirmationEmail };
