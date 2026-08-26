const { getSubscriberByKey, saveSubscriber, getKeyByToken, deleteToken } = require('./_subscribers');

const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';

module.exports = async function handler(req, res) {
  const token = req.query && req.query.token;
  const redirect = (path) => { res.writeHead(302, { Location: `${SITE_URL}/${path}` }); res.end(); };
  try {
    const key = await getKeyByToken(token);
    if (!key) return redirect('suscripcion-error');
    const sub = await getSubscriberByKey(key);
    if (!sub) return redirect('suscripcion-error');

    if (sub.status !== 'confirmed') {
      sub.status = 'confirmed';
      sub.confirmedAt = new Date().toISOString();
      sub.confirmToken = null;
      await saveSubscriber(sub);
      await deleteToken(token);
    }
    return redirect('suscripcion-confirmada');
  } catch (err) {
    console.error('confirm-subscription error:', err);
    return redirect('suscripcion-error');
  }
};
