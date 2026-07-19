const { Resend } = require('resend');

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

  const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR');
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const itemsHtml = (order.items || [])
    .map(it => `<li>${esc(it.title)} x${Number(it.quantity) || 0} — ${fmt(it.unit_price * it.quantity)}</li>`)
    .join('');
  const subtotal = (order.items || []).reduce((sum, it) => sum + it.unit_price * (Number(it.quantity) || 0), 0);
  const discount = subtotal - order.amount;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'Botines Alta Gama CBA <pedidos@botinesaltagamacba.com>',
      to: order.shipping.email,
      subject: '¡Tu compra fue confirmada! — Botines Alta Gama CBA',
      html: `
        <h1>¡Gracias por tu compra, ${esc(order.shipping.nombre)}!</h1>
        <p>Confirmamos tu pedido:</p>
        <ul>${itemsHtml}</ul>
        ${discount > 0 ? `<p>Descuento por transferencia (10%): -${fmt(discount)}</p>` : ''}
        <p><strong>Total: ${fmt(order.amount)}</strong></p>
        <p>Te lo enviamos a: ${esc(order.shipping.direccion)}, ${esc(order.shipping.localidad)}, ${esc(order.shipping.provincia)} (CP ${esc(order.shipping.codigoPostal)})</p>
        <p>Cualquier consulta, escribinos por WhatsApp: <a href="https://wa.me/5493516836569">+54 9 351 683-6569</a></p>
      `,
    });
    if (error) {
      console.error('email send error:', error.message || error);
    }
  } catch (err) {
    console.error('email send error:', err.message);
  }
}

module.exports = { sendConfirmationEmail };
