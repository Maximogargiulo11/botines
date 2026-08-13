const { validateCoupon, COUPON_DISCOUNT } = require('./_coupons');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ valid: false, reason: 'Falta el código' });
  try {
    const v = await validateCoupon(code);
    return res.status(200).json({ valid: v.valid, discount: v.valid ? COUPON_DISCOUNT : 0, reason: v.reason });
  } catch (err) {
    console.error('validate-coupon error:', err);
    return res.status(500).json({ valid: false });
  }
};
