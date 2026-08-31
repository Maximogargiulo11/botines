const { validateCoupon, COUPON_DISCOUNT } = require('./_coupons');
const { getTrustedPrice } = require('./_products');
const { getCart, saveCart } = require('./_carts');
const { limited } = require('./_ratelimit');

// Endpoint consolidado del checkout (reemplaza a validate-coupon para no pasar
// el tope de 12 Serverless Functions de Vercel Hobby). Enruta por `action`.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (limited(req, res, { bucket: 'checkout', limit: 30, windowMs: 60 * 1000 })) return;
  const { action } = req.body || {};

  if (action === 'validate-coupon') {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ valid: false, reason: 'Falta el código' });
    try {
      const v = await validateCoupon(code);
      return res.status(200).json({ valid: v.valid, discount: v.valid ? COUPON_DISCOUNT : 0, reason: v.reason });
    } catch (err) {
      console.error('checkout validate-coupon error:', err);
      return res.status(500).json({ valid: false });
    }
  }

  if (action === 'save-cart') {
    const { email, name, items } = req.body || {};
    const clean = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return res.status(400).json({ error: 'Email inválido' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

    // Solo productos reales del catálogo, con precio confiable del servidor.
    const cleanItems = [];
    for (const it of items) {
      const price = getTrustedPrice(it.id);
      if (price === undefined) continue;
      cleanItems.push({
        id: it.id,
        name: String(it.name || ''),
        colorway: String(it.colorway || ''),
        price,
        image: String(it.image || ''),
        size: String(it.size || ''),
        unit: String(it.unit || 'eu'),
        qty: Math.max(1, Math.min(20, Math.floor(Number(it.qty)) || 1)),
      });
    }
    if (cleanItems.length === 0) return res.status(400).json({ error: 'Sin productos válidos' });

    try {
      const existing = await getCart(clean);
      const now = new Date().toISOString();
      // Si ya hay un carrito pendiente, se actualizan items/updatedAt SIN
      // resetear los toques ya enviados. Si estaba 'recovered' (ya compró),
      // arranca una secuencia nueva.
      const cart = (existing && existing.status !== 'recovered') ? {
        ...existing,
        name: name ? String(name) : existing.name,
        items: cleanItems,
        updatedAt: now,
      } : {
        email: clean,
        name: name ? String(name) : '',
        items: cleanItems,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        sent: { t1: false, t2: false, t3: false },
        couponCode: null,
      };
      await saveCart(cart);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('checkout save-cart error:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(400).json({ error: 'Acción no válida' });
};
