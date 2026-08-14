const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cache = null;

function loadData() {
  if (cache) return cache;
  const code = fs.readFileSync(path.join(process.cwd(), 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 2000 });
  const data = (sandbox.window && sandbox.window.BAG_DATA) || { products: {}, articles: [] };

  const productsById = {};
  const products = data.products || {};
  for (const brandKey of Object.keys(products)) {
    for (const product of products[brandKey]) {
      if (product && product.id) productsById[product.id] = { product, brandKey };
    }
  }
  const articlesBySlug = {};
  for (const article of (data.articles || [])) {
    if (article && article.slug) articlesBySlug[article.slug] = article;
  }
  cache = { productsById, articlesBySlug };
  return cache;
}

function getProductById(id) {
  return loadData().productsById[id] || null;
}

function getArticleBySlug(slug) {
  return loadData().articlesBySlug[slug] || null;
}

module.exports = { getProductById, getArticleBySlug };
