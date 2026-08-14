// tests/catalog.test.js
const assert = require('assert');
const fs = require('fs');

// Mock del data.js que lee el loader (mismo objeto fs que usa _catalog).
const FAKE = `window.BAG_DATA = {
  products: { "nike/mercurial": [
    { id: "p1", name: "Nike Mercurial", colorway: "Rosa", price: 599999, images: ["assets/a.webp"] }
  ] },
  articles: [
    { id: "a1", slug: "mi-lanzamiento", title: "Mi Lanzamiento", excerpt: "Resumen", cover: "assets/c.webp" }
  ]
};`;
const origRead = fs.readFileSync;
fs.readFileSync = (p, enc) => (String(p).endsWith('data.js') ? FAKE : origRead(p, enc));

const { getProductById, getArticleBySlug } = require('../api/_catalog.js');

const found = getProductById('p1');
assert.ok(found, 'encuentra el producto p1');
assert.strictEqual(found.product.name, 'Nike Mercurial');
assert.strictEqual(found.brandKey, 'nike/mercurial');
assert.strictEqual(getProductById('nope'), null, 'id inexistente → null');

const art = getArticleBySlug('mi-lanzamiento');
assert.ok(art, 'encuentra el artículo');
assert.strictEqual(art.title, 'Mi Lanzamiento');
assert.strictEqual(getArticleBySlug('nope'), null, 'slug inexistente → null');

fs.readFileSync = origRead;
console.log('OK catalog');
