const { put, get } = require('@vercel/blob');

const COUPON_DISCOUNT = 0.05;      // 5%
const COUPON_VALID_DAYS = 30;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1

function generateCouponCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `BAG-${s}`;
}

async function getCoupon(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const result = await get(`coupons/${clean}.json`, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  try { return JSON.parse(await new Response(result.stream).text()); } catch { return null; }
}

async function createCoupon(email) {
  const now = Date.now();
  const coupon = {
    code: generateCouponCode(),
    email: String(email).trim().toLowerCase(),
    used: false,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
  await put(`coupons/${coupon.code}.json`, JSON.stringify(coupon, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
  return coupon;
}

async function validateCoupon(code) {
  const coupon = await getCoupon(code);
  if (!coupon) return { valid: false, reason: 'Cupón inexistente' };
  if (coupon.used) return { valid: false, reason: 'Cupón ya usado' };
  if (new Date(coupon.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'Cupón vencido' };
  return { valid: true, coupon };
}

async function markCouponUsed(code) {
  const coupon = await getCoupon(code);
  if (!coupon || coupon.used) return;
  coupon.used = true;
  coupon.usedAt = new Date().toISOString();
  await put(`coupons/${coupon.code}.json`, JSON.stringify(coupon, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

module.exports = { COUPON_DISCOUNT, generateCouponCode, createCoupon, getCoupon, validateCoupon, markCouponUsed };
