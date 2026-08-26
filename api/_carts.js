const { put, get, list, del } = require('@vercel/blob');

// Un carrito pendiente por email. Misma convención de clave que _subscribers.js.
function cartKey(email) {
  return Buffer.from(String(email).trim().toLowerCase()).toString('base64url');
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  try { return JSON.parse(await new Response(result.stream).text()); } catch { return null; }
}

async function getCart(email) { return readJson(`carts/${cartKey(email)}.json`); }

async function saveCart(cart) {
  await put(`carts/${cartKey(cart.email)}.json`, JSON.stringify(cart, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

async function listCarts() {
  const { blobs } = await list({ prefix: 'carts/' });
  const carts = await Promise.all(blobs.map(b => readJson(b.pathname)));
  return carts.filter(Boolean);
}

async function deleteCart(email) {
  try { await del(`carts/${cartKey(email)}.json`); } catch {}
}

// Marca el carrito de ese email como recuperado (cuando se concreta una orden).
// Tolerante a fallos: nunca lanza, para no romper el flujo de pago.
async function markRecovered(email) {
  try {
    if (!email) return;
    const cart = await getCart(email);
    if (!cart || cart.status === 'recovered') return;
    cart.status = 'recovered';
    cart.recoveredAt = new Date().toISOString();
    await saveCart(cart);
  } catch (err) {
    console.error('markRecovered error:', err.message);
  }
}

module.exports = { cartKey, getCart, saveCart, listCarts, deleteCart, markRecovered };
