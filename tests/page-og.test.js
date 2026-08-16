// tests/page-og.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
process.env.SITE_URL = 'https://www.botinesaltagamacba.com';

// Mock del catálogo.
const catPath = require.resolve('../api/_catalog.js');
require.cache[catPath] = { id: catPath, filename: catPath, loaded: true, exports: {
  getProductById: (id) => id === 'p1'
    ? { product: { id: 'p1', name: 'Nike Mercurial', colorway: 'Rosa', price: 599999, images: ['assets/a.webp'] }, brandKey: 'nike/mercurial' }
    : null,
  getArticleBySlug: (s) => s === 'mi-lanzamiento'
    ? { id: 'a1', slug: 'mi-lanzamiento', title: 'Mi Lanzamiento', excerpt: 'Resumen', cover: 'assets/c.webp' }
    : null,
}};

// Mock del index.html en disco.
const FAKE_INDEX = '<!doctype html><html><head><title>Botines Alta Gama CBA · X</title></head><body><div id="root"></div></body></html>';
const origRead = fs.readFileSync;
fs.readFileSync = (p, enc) => (String(p).endsWith('index.html') ? FAKE_INDEX : origRead(p, enc));

const handler = require('../api/page.js');
function mockRes() {
  return { statusCode: 200, headers: {}, body: '',
    setHeader(k, v){ this.headers[k] = v; },
    end(b){ this.body = b; return this; } };
}

(async () => {
  // Producto
  let res = mockRes();
  await handler({ url: '/marcas/nike/mercurial/p1' }, res);
  assert.ok(res.body.includes('property="og:title" content="Nike Mercurial — Rosa"'), 'og:title producto');
  assert.ok(res.body.includes('images.weserv.nl') && res.body.includes('output=jpg'), 'og:image convertida a jpg');
  assert.ok(res.body.includes(encodeURIComponent('www.botinesaltagamacba.com/assets/a.webp')), 'og:image apunta a la foto del producto');
  assert.ok(res.body.includes('property="og:url" content="https://www.botinesaltagamacba.com/marcas/nike/mercurial/p1"'), 'og:url');
  assert.ok(res.body.includes('property="product:price:amount" content="599999"'), 'precio');
  assert.ok(res.body.includes('name="twitter:card" content="summary_large_image"'), 'twitter card');

  // Lanzamiento
  res = mockRes();
  await handler({ url: '/lanzamientos/mi-lanzamiento' }, res);
  assert.ok(res.body.includes('property="og:title" content="Mi Lanzamiento"'), 'og:title artículo');
  assert.ok(res.body.includes(encodeURIComponent('www.botinesaltagamacba.com/assets/c.webp')), 'og:image artículo');

  // Producto inexistente → index.html sin tocar
  res = mockRes();
  await handler({ url: '/marcas/nike/mercurial/nope' }, res);
  assert.ok(!res.body.includes('og:title'), 'sin og:title si no existe');
  assert.strictEqual(res.body, FAKE_INDEX, 'devuelve el index sin modificar');

  fs.readFileSync = origRead;
  console.log('OK page-og');
})().catch(e => { console.error(e); process.exit(1); });
