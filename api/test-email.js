const { sendConfirmationEmail } = require('./_email');

// ⚠️ ENDPOINT TEMPORAL DE PRUEBA — BORRAR después de verificar el envío de mails.
// Manda un mail de confirmación de ejemplo a una dirección fija (el dueño).
// Protegido con un token en la query para que no lo dispare cualquiera.
module.exports = async function handler(req, res) {
  if (req.query.key !== 'tk_9f3a2c7e51_prueba') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const sampleOrder = {
    id: 'test-' + Date.now().toString(36),
    payment_method: 'transferencia',
    status: 'approved',
    amount: 440999,
    date: new Date().toISOString(),
    payer_name: 'Maximo Gargiulo',
    payer_email: 'maximogargiulo0@gmail.com',
    shipping: {
      nombre: 'Maximo',
      apellido: 'Gargiulo',
      email: 'maximogargiulo0@gmail.com',
      dni: '43371064',
      provincia: 'Córdoba',
      localidad: 'Córdoba',
      direccion: 'Bermudas 819',
      codigoPostal: '5000',
      celular: '3512394623',
      descripcion: '',
    },
    items: [
      { id: 'test', title: 'Adidas Predator Elite FT FG — Gris / Rojo — Talle 8.5 EU', quantity: 1, unit_price: 489999 },
    ],
  };

  const result = await sendConfirmationEmail(sampleOrder);
  return res.status(200).json({ triggered: true, to: sampleOrder.shipping.email, result });
};
