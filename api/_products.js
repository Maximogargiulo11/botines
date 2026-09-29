const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cache = null;

function loadCatalog() {
  if (cache) return cache;

  const code = fs.readFileSync(path.join(process.cwd(), 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 2000 });

  const byId = {};
  const products = (sandbox.window.BAG_DATA && sandbox.window.BAG_DATA.products) || {};
  for (const key of Object.keys(products)) {
    for (const variant of products[key]) {
      byId[variant.id] = {
        price: Number(variant.price),
        name: String(variant.name || ''),
        colorway: String(variant.colorway || ''),
        image: (Array.isArray(variant.images) && variant.images[0]) ? String(variant.images[0]) : '',
      };
    }
  }
  cache = byId;
  return cache;
}

function getTrustedPrice(id) {
  const p = loadCatalog()[id];
  return p ? p.price : undefined;
}

// Datos confiables del producto (nombre, colorway, imagen) desde el catálogo.
// Devuelve undefined si el id no existe.
function getProduct(id) {
  return loadCatalog()[id];
}

module.exports = { getTrustedPrice, getProduct };
