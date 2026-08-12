// tests/subscribers.test.js
const assert = require('assert');
const path = require('path');
const store = {};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (pathname, body) => { store[pathname] = body; return { pathname }; },
  get: async (pathname) => store[pathname] !== undefined
    ? { statusCode: 200, stream: new Response(store[pathname]).body }
    : { statusCode: 404, stream: null },
  list: async ({ prefix }) => ({ blobs: Object.keys(store).filter(k => k.startsWith(prefix)).map(k => ({ pathname: k, url: 'https://x/' + k })) }),
  del: async (p) => { delete store[String(p).replace('https://x/', '')]; },
}};

const S = require('../api/_subscribers.js');

(async () => {
  const k = S.emailKey('  A@B.com ');
  assert.strictEqual(k, S.emailKey('a@b.com'), 'emailKey normaliza mayúsculas/espacios');

  await S.saveSubscriber({ email: 'a@b.com', name: 'Ana', status: 'pending' });
  const got = await S.getSubscriber('a@b.com');
  assert.strictEqual(got.name, 'Ana');

  await S.saveToken('tok123', k);
  assert.strictEqual(await S.getKeyByToken('tok123'), k, 'token → key');

  await S.deleteToken('tok123');
  assert.strictEqual(await S.getKeyByToken('tok123'), null, 'token borrado');

  const all = await S.listSubscribers();
  assert.strictEqual(all.length, 1);
  console.log('OK subscribers');
})().catch(e => { console.error(e); process.exit(1); });
