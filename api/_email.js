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
  const itemsHtml = (order.items || [])
    .map(it => `<li>${it.title} x${it.quantity} — ${fmt(it.unit_price * it.quantity)}</li>`)
    .join('');

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Botines Alta Gama CBA <pedidos@botinesaltagamacba.com>',
      to: order.shipping.email,
      subject: '¡Tu compra fue confirmada! — Botines Alta Gama CBA',
      html: `
        <h1>¡Gracias por tu compra, ${order.shipping.nombre}!</h1>
        <p>Confirmamos tu pedido:</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total: ${fmt(order.amount)}</strong></p>
        <p>Te lo enviamos a: ${order.shipping.direccion}, ${order.shipping.localidad}, ${order.shipping.provincia} (CP ${order.shipping.codigoPostal})</p>
        <p>Cualquier consulta, escribinos por WhatsApp: <a href="https://wa.me/5493516836569">+54 9 351 683-6569</a></p>
      `,
    });
  } catch (err) {
    console.error('email send error:', err.message);
  }
}

module.exports = { sendConfirmationEmail };
