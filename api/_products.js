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
      byId[variant.id] = Number(variant.price);
    }
  }
  cache = byId;
  return cache;
}

function getTrustedPrice(id) {
  return loadCatalog()[id];
}

module.exports = { getTrustedPrice };
