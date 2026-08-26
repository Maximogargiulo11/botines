// Procesador de recordatorios de carrito abandonado.
// NO es una función de Vercel: corre en GitHub Actions (cron cada ~15 min).
// Lee los carritos pendientes de Vercel Blob y envía, como máximo, UN toque
// por corrida y por carrito, según su antigüedad.
//
// Env necesarias: BLOB_READ_WRITE_TOKEN, RESEND_API_KEY, SITE_URL.

const { Resend } = require('resend');
const { listCarts, saveCart, deleteCart } = require('../api/_carts');
const { createCoupon } = require('../api/_coupons');

const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';
const FROM = 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const IG_DM = 'https://ig.me/m/botinesaltagamacba';

const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR');
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function olderThan(iso, ms) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && (Date.now() - t) >= ms;
}

// Link de recuperación de 1 clic. Codifica el carrito (id, talle, unidad, cant)
// en base64; el front lo rearma con precios actuales.
function recoverLink(cart, couponCode) {
  const payload = cart.items.map(it => ({ id: it.id, sz: it.size, u: it.unit, q: it.qty }));
  const c = Buffer.from(JSON.stringify(payload)).toString('base64');
  let url = `${SITE_URL}/recuperar?c=${encodeURIComponent(c)}`;
  if (couponCode) url += `&coupon=${encodeURIComponent(couponCode)}`;
  return url;
}

function itemsHtml(cart) {
  return cart.items.map(it => `
    <tr>
      <td style="padding:8px 12px 8px 0;width:64px;">
        ${it.image ? `<img src="${esc(it.image)}" width="60" height="60" alt="" style="border-radius:8px;object-fit:cover;display:block;">` : ''}
      </td>
      <td style="padding:8px 0;font-size:14px;color:#111827;">
        <strong>${esc(it.name)}</strong><br>
        <span style="color:#6b7280;">${esc(it.colorway)} · Talle ${esc(it.size)} ${esc(String(it.unit || 'eu').toUpperCase())}</span><br>
        <span style="color:#111827;">${fmt(it.price)}</span>
      </td>
    </tr>`).join('');
}

function ctaButton(link, label) {
  return `<p style="margin:24px 0;">
    <a href="${link}" style="display:inline-block;background:#111827;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;">${label}</a>
  </p>`;
}

function shell(name, intro, cart, link, label, extra) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px; max-width:560px;">
      <p>Hola${name ? ', ' + esc(name) : ''} 👋</p>
      ${intro}
      <table style="border-collapse:collapse;margin:16px 0;">${itemsHtml(cart)}</table>
      ${extra || ''}
      ${ctaButton(link, label)}
      <p style="font-size:13px;color:#6b7280;">Cualquier duda, escribinos por <a href="${IG_DM}">Instagram</a>.</p>
      <p style="font-size:12px;color:#9ca3af;">Si no querés recibir estos recordatorios, respondé este mail y lo damos de baja.</p>
    </div>`;
}

function emailTouch1(cart, link) {
  return {
    subject: '¿Te olvidaste de algo? 👀',
    html: shell(cart.name, `<p>Te quedaron estos botines en el carrito. Los guardamos para vos:</p>`, cart, link, 'Volver a mi carrito'),
  };
}

function emailTouch2(cart, link) {
  return {
    subject: 'Tu talle se está agotando',
    html: shell(cart.name, `<p>Seguimos guardando tu carrito, pero el stock de tu talle vuela. No te quedes sin el tuyo:</p>`, cart, link, 'Terminar mi compra'),
  };
}

function emailTouch3(cart, link, coupon) {
  const vence = new Date(coupon.expiresAt).toLocaleDateString('es-AR');
  const extra = `
    <p>Para que lo termines hoy, te dejamos un <strong>5% de descuento</strong>:</p>
    <p style="font-size:22px;font-weight:700;letter-spacing:2px;background:#f3f4f6;padding:12px 16px;border-radius:8px;display:inline-block;">${esc(coupon.code)}</p>
    <p style="font-size:13px;color:#6b7280;">Es de un solo uso y vence el ${esc(vence)}. El botón de abajo ya lo deja aplicado.</p>`;
  return {
    subject: 'Un 5% para terminar tu compra 🎟️',
    html: shell(cart.name, `<p>Última cosa: no queremos que te quedes sin estos botines.</p>`, cart, link, 'Usar mi 5% y comprar', extra),
  };
}

async function send(resend, cart, email) {
  const { error } = await resend.emails.send({ from: FROM, to: cart.email, subject: email.subject, html: email.html });
  if (error) throw new Error(error.message || 'Resend rechazó el envío');
}

async function processCart(resend, cart) {
  if (!cart || !cart.email || !Array.isArray(cart.items) || cart.items.length === 0) return 'skip';

  if (cart.status === 'recovered') {
    if (olderThan(cart.recoveredAt || cart.updatedAt, 7 * DAY)) { await deleteCart(cart.email); return 'purged'; }
    return 'skip';
  }

  const sent = cart.sent || { t1: false, t2: false, t3: false };
  const age = Date.now() - new Date(cart.createdAt).getTime();

  // Máximo un toque por corrida (if / else if).
  if (age >= 1 * HOUR && !sent.t1) {
    await send(resend, cart, emailTouch1(cart, recoverLink(cart)));
    sent.t1 = true;
  } else if (age >= 24 * HOUR && !sent.t2) {
    await send(resend, cart, emailTouch2(cart, recoverLink(cart)));
    sent.t2 = true;
  } else if (age >= 48 * HOUR && !sent.t3) {
    const coupon = await createCoupon(cart.email);
    cart.couponCode = coupon.code;
    await send(resend, cart, emailTouch3(cart, recoverLink(cart, coupon.code), coupon));
    sent.t3 = true;
  } else {
    // Nada que enviar. Si ya se envió el último toque hace +7 días, purgar.
    if (sent.t3 && olderThan(cart.updatedAt, 7 * DAY)) { await deleteCart(cart.email); return 'purged'; }
    return 'idle';
  }

  cart.sent = sent;
  cart.updatedAt = new Date().toISOString();
  await saveCart(cart);
  return 'sent';
}

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Falta BLOB_READ_WRITE_TOKEN');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const carts = await listCarts();
  const counts = { sent: 0, idle: 0, skip: 0, purged: 0, error: 0 };
  for (const cart of carts) {
    try {
      const r = await processCart(resend, cart);
      counts[r] = (counts[r] || 0) + 1;
    } catch (err) {
      counts.error++;
      console.error('cart-reminders: error con', cart && cart.email, '-', err.message);
    }
  }
  console.log(`cart-reminders: ${carts.length} carritos ·`,
    `enviados=${counts.sent} idle=${counts.idle} purgados=${counts.purged} errores=${counts.error}`);
}

// Export para tests; corre solo si se invoca directo.
module.exports = { processCart, recoverLink, emailTouch1, emailTouch2, emailTouch3, olderThan };
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
