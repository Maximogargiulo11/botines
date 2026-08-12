const { put, get, list, del } = require('@vercel/blob');

function emailKey(email) {
  return Buffer.from(String(email).trim().toLowerCase()).toString('base64url');
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  try { return JSON.parse(await new Response(result.stream).text()); } catch { return null; }
}

async function getSubscriberByKey(key) { return readJson(`subscribers/${key}.json`); }
async function getSubscriber(email) { return getSubscriberByKey(emailKey(email)); }

async function saveSubscriber(sub) {
  await put(`subscribers/${emailKey(sub.email)}.json`, JSON.stringify(sub, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

async function saveToken(token, key) {
  await put(`subtokens/${token}.json`, JSON.stringify({ key }), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

async function getKeyByToken(token) {
  const clean = String(token || '').trim();
  if (!clean) return null;
  const data = await readJson(`subtokens/${clean}.json`);
  return data ? data.key : null;
}

async function deleteToken(token) {
  try { await del(`subtokens/${String(token).trim()}.json`); } catch {}
}

async function listSubscribers() {
  const { blobs } = await list({ prefix: 'subscribers/' });
  const subs = await Promise.all(blobs.map(b => readJson(b.pathname)));
  return subs.filter(Boolean);
}

module.exports = { emailKey, getSubscriber, getSubscriberByKey, saveSubscriber, saveToken, getKeyByToken, deleteToken, listSubscribers };
