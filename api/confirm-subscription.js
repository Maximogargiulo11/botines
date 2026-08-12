const { getSubscriberByKey, saveSubscriber, getKeyByToken, deleteToken } = require('./_subscribers');
const { createCoupon } = require('./_coupons');
const { sendCouponEmail } = require('./_email');

const SITE_URL = process.env.SITE_URL || 'https://botinesweb.vercel.app';

module.exports = async function handler(req, res) {
  const token = req.query && req.query.token;
  const redirect = (path) => { res.writeHead(302, { Location: `${SITE_URL}/#/${path}` }); res.end(); };
  try {
    const key = await getKeyByToken(token);
    if (!key) return redirect('suscripcion-error');
    const sub = await getSubscriberByKey(key);
    if (!sub) return redirect('suscripcion-error');

    if (sub.status !== 'confirmed') {
      const coupon = await createCoupon(sub.email);
      sub.status = 'confirmed';
      sub.confirmedAt = new Date().toISOString();
      sub.couponCode = coupon.code;
      sub.couponExpiresAt = coupon.expiresAt;
      sub.confirmToken = null;
      await saveSubscriber(sub);
      await deleteToken(token);
      await sendCouponEmail(sub.email, sub.name, coupon.code, coupon.expiresAt);
    }
    return redirect('suscripcion-confirmada');
  } catch (err) {
    console.error('confirm-subscription error:', err);
    return redirect('suscripcion-error');
  }
};
