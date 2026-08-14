# URLs reales + previews Open Graph — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el sitio de hash routing a URLs reales (History API) y servir meta tags Open Graph por producto/lanzamiento desde una función serverless, sin introducir build step.

**Architecture:** El ruteo se cambia en un único archivo (`app.jsx`) de `window.location.hash` a `history.pushState`/`popstate`. Un `rewrite` en Vercel manda las URLs de producto y lanzamiento a una función `api/page.js` que inyecta meta OG leyendo `data.js` con el mismo patrón `vm` de `api/_products.js`; el resto de las rutas sirven `index.html`. Los links viejos `/#/...` se convierten a rutas reales con un script inline.

**Tech Stack:** React 18 UMD + Babel Standalone (sin build), Vercel Functions (Node CommonJS), tests node `assert` corridos con `node tests/<archivo>.test.js`.

**Spec:** [docs/superpowers/specs/2026-08-13-urls-reales-y-og-design.md](../specs/2026-08-13-urls-reales-y-og-design.md)

## Global Constraints

- **Sin build step.** No agregar bundlers ni frameworks. Todo sigue siendo estático + funciones serverless.
- **No tocar** la lógica de checkout, MercadoPago (precios de confianza), ni admin. Los únicos cambios en el flujo de pago son las `back_urls` (de `/#/pago-*` a `/pago-*`).
- **`SITE_URL`** por defecto = `https://www.botinesaltagamacba.com` (`process.env.SITE_URL || ...`), idéntico al resto de `api/`.
- **Fallback de imagen OG** cuando no hay foto = `/assets/logo-altagama-transparent.png` (siempre se emite una `og:image`, nunca vacía).
- **Imágenes en `data.js`** son rutas relativas (`assets/...`); la `og:image` se arma absoluta con `SITE_URL + '/' + ruta`.
- **Escape HTML** obligatorio en todo valor inyectado en atributos de meta tags.
- **Handlers Vercel:** `module.exports = async function handler(req, res)` (CommonJS).
- **Tests:** node plano con `assert`, mockeando dependencias vía `require.cache`. Sin framework de test.

---

### Task 1: Helper de catálogo `api/_catalog.js`

Loader que expone los objetos completos de producto y artículo desde `data.js`. No modifica `api/_products.js` (se acepta una pequeña duplicación del patrón `vm` para no tocar el camino de precios del checkout).

**Files:**
- Create: `api/_catalog.js`
- Test: `tests/catalog.test.js`

**Interfaces:**
- Consumes: nada (lee `data.js` de disco).
- Produces:
  - `getProductById(id: string) → { product: object, brandKey: string } | null`
  - `getArticleBySlug(slug: string) → object | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/catalog.test.js`:

```js
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node tests/catalog.test.js`
Expected: FALLA con `Cannot find module '../api/_catalog.js'`.

- [ ] **Step 3: Implementar `api/_catalog.js`**

```js
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
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node tests/catalog.test.js`
Expected: `OK catalog`

- [ ] **Step 5: Commit**

```bash
git add api/_catalog.js tests/catalog.test.js
git commit -m "feat(api): helper _catalog para leer productos y artículos de data.js"
```

---

### Task 2: Función OG `api/page.js`

Sirve `index.html` con meta tags Open Graph inyectadas para producto (`/marcas/:marca/:modelo/:id`) y lanzamiento (`/lanzamientos/:slug`). Si no encuentra la entidad, sirve `index.html` sin modificar.

**Files:**
- Create: `api/page.js`
- Test: `tests/page-og.test.js`

**Interfaces:**
- Consumes: `getProductById`, `getArticleBySlug` de `api/_catalog.js` (Task 1).
- Produces: handler HTTP. Responde `text/html`. `req.url` es la URL original del visitante (Vercel preserva la ruta original al reescribir hacia la función).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/page-og.test.js`:

```js
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
  assert.ok(res.body.includes('property="og:image" content="https://www.botinesaltagamacba.com/assets/a.webp"'), 'og:image absoluta');
  assert.ok(res.body.includes('property="og:url" content="https://www.botinesaltagamacba.com/marcas/nike/mercurial/p1"'), 'og:url');
  assert.ok(res.body.includes('property="product:price:amount" content="599999"'), 'precio');
  assert.ok(res.body.includes('name="twitter:card" content="summary_large_image"'), 'twitter card');

  // Lanzamiento
  res = mockRes();
  await handler({ url: '/lanzamientos/mi-lanzamiento' }, res);
  assert.ok(res.body.includes('property="og:title" content="Mi Lanzamiento"'), 'og:title artículo');
  assert.ok(res.body.includes('property="og:image" content="https://www.botinesaltagamacba.com/assets/c.webp"'), 'og:image artículo');

  // Producto inexistente → index.html sin tocar
  res = mockRes();
  await handler({ url: '/marcas/nike/mercurial/nope' }, res);
  assert.ok(!res.body.includes('og:title'), 'sin og:title si no existe');
  assert.strictEqual(res.body, FAKE_INDEX, 'devuelve el index sin modificar');

  fs.readFileSync = origRead;
  console.log('OK page-og');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node tests/page-og.test.js`
Expected: FALLA con `Cannot find module '../api/page.js'`.

- [ ] **Step 3: Implementar `api/page.js`**

```js
const fs = require('fs');
const path = require('path');
const { getProductById, getArticleBySlug } = require('./_catalog');

const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';
const FALLBACK_IMAGE = '/assets/logo-altagama-transparent.png';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const fmtPrice = (n) => '$ ' + Number(n).toLocaleString('es-AR');

function absImage(rel) {
  if (!rel) return SITE_URL + FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(rel)) return rel;
  return SITE_URL + '/' + String(rel).replace(/^\/+/, '');
}

function metaFor(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'marcas' && parts[3]) {
    const found = getProductById(parts[3]);
    if (found) {
      const p = found.product;
      const title = p.colorway ? `${p.name} — ${p.colorway}` : p.name;
      return {
        title,
        description: `${title}. ${fmtPrice(p.price)}. Comprá online en Botines Alta Gama Córdoba.`,
        image: absImage(p.images && p.images[0]),
        type: 'product',
        price: p.price,
      };
    }
  } else if (parts[0] === 'lanzamientos' && parts[1]) {
    const a = getArticleBySlug(parts[1]);
    if (a) {
      return {
        title: a.title,
        description: a.excerpt || 'Nuevo lanzamiento en Botines Alta Gama Córdoba.',
        image: absImage(a.cover),
        type: 'article',
        price: null,
      };
    }
  }
  return null;
}

function buildMetaTags(meta, url) {
  const tags = [
    `<meta property="og:site_name" content="Botines Alta Gama Córdoba">`,
    `<meta property="og:type" content="${esc(meta.type)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:image" content="${esc(meta.image)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    `<meta name="twitter:image" content="${esc(meta.image)}">`,
    `<meta name="description" content="${esc(meta.description)}">`,
  ];
  if (meta.type === 'product' && meta.price != null) {
    tags.push(`<meta property="product:price:amount" content="${esc(meta.price)}">`);
    tags.push(`<meta property="product:price:currency" content="ARS">`);
  }
  return tags.join('\n  ');
}

module.exports = async function handler(req, res) {
  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (err) {
    console.error('page.js: no se pudo leer index.html', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><title>Botines Alta Gama CBA</title>');
  }

  try {
    const pathname = (req.url || '/').split('?')[0];
    const meta = metaFor(pathname);
    if (meta) {
      const url = SITE_URL + pathname;
      const block = buildMetaTags(meta, url);
      html = html.replace(/<title>[\s\S]*?<\/title>/i,
        `<title>${esc(meta.title)} · Botines Alta Gama CBA</title>\n  ${block}`);
    }
  } catch (err) {
    console.error('page.js: error armando meta OG', err);
    // Se continúa con el html sin meta; nunca romper la navegación por el preview.
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return res.end(html);
};
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node tests/page-og.test.js`
Expected: `OK page-og`

- [ ] **Step 5: Commit**

```bash
git add api/page.js tests/page-og.test.js
git commit -m "feat(api): función page.js que inyecta meta Open Graph por producto/lanzamiento"
```

---

### Task 3: Router History API en `app.jsx` + `index.html`

Cambia el ruteo de hash a History API. Toda la navegación interna ya pasa por `navigate()`, así que ningún otro componente se toca. Agrega `<base href="/">` (para que los assets relativos resuelvan en rutas profundas) y el script de compatibilidad con links viejos `/#/...`.

**Files:**
- Modify: `app.jsx:22-35` (router y navigate)
- Modify: `index.html` (`<base href>`, script de redirect de hash, bump `app.jsx?v=15` → `app.jsx?v=16`)
- Test: `tests/transpile-app.test.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `navigate(path)` con la misma firma que antes (`navigate('/marcas/...')`). El parseo `route.split('/').filter(Boolean)` queda idéntico.

- [ ] **Step 1: Escribir el test de transpile que falla**

Crear `tests/transpile-app.test.js`:

```js
// tests/transpile-app.test.js
const assert = require('assert');
const fs = require('fs');
const babel = require('@babel/standalone');

const code = fs.readFileSync('app.jsx', 'utf8');
babel.transform(code, { presets: ['react'] }); // lanza si hay error de sintaxis

// El router debe usar History API, no hash.
assert.ok(!/window\.location\.hash\s*=/.test(code), 'navigate ya no debe setear window.location.hash');
assert.ok(/history\.pushState/.test(code), 'navigate debe usar history.pushState');
assert.ok(/window\.location\.pathname/.test(code), 'el router debe leer window.location.pathname');
console.log('OK transpile-app');
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node tests/transpile-app.test.js`
Expected: FALLA en `navigate debe usar history.pushState` (el código actual usa hash).

- [ ] **Step 3: Reemplazar el router en `app.jsx`**

Reemplazar el bloque actual (líneas 22-35):

```js
/* Hash-based router: #/lanzamientos/foo */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

function App() {
  const route = useHashRoute();
  const navigate = (path) => { window.location.hash = path; window.scrollTo({ top: 0, behavior: 'instant' }); };
```

por:

```js
/* History-based router: /lanzamientos/foo */
function usePathRoute() {
  const [route, setRoute] = useState(() => window.location.pathname || '/');
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return [route, setRoute];
}

function App() {
  const [route, setRoute] = usePathRoute();
  const navigate = (path) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
      setRoute(path);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
```

- [ ] **Step 4: Agregar `<base href>` y el script de redirect en `index.html`**

En `index.html`, inmediatamente después de la línea `<meta name="viewport" content="width=device-width, initial-scale=1">`, agregar:

```html
  <base href="/">
  <script>
    /* Compatibilidad con links viejos /#/... → /... */
    (function () {
      var h = window.location.hash;
      if (h && h.indexOf('#/') === 0) {
        window.history.replaceState(null, '', h.slice(1) + window.location.search);
      }
    })();
  </script>
```

- [ ] **Step 5: Bump de versión de `app.jsx` en `index.html`**

Cambiar la línea `<script type="text/babel" src="app.jsx?v=15"></script>` por `<script type="text/babel" src="app.jsx?v=16"></script>`.

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `node tests/transpile-app.test.js`
Expected: `OK transpile-app`

- [ ] **Step 7: Verificación manual en navegador**

Levantar server local y verificar navegación:

```bash
python -m http.server 8099
```

Abrir `http://localhost:8099/` y confirmar:
- Click en un botín navega a `/marcas/.../id` (sin `#`) y muestra el producto.
- Recargar en esa URL profunda muestra el mismo producto (con `<base href>` los scripts cargan).
- El botón "atrás" del navegador vuelve a la pantalla anterior.
- Abrir `http://localhost:8099/#/marcas/...` (formato viejo) redirige a `/marcas/...`.

> Nota: servido con `python http.server` (sin los rewrites de Vercel), recargar una URL profunda da 404 localmente — eso lo resuelve el rewrite de Task 5 en producción. La verificación local del deep-link se hace navegando desde el home; el redirect de hash sí se prueba local.

- [ ] **Step 8: Commit**

```bash
git add app.jsx index.html tests/transpile-app.test.js
git commit -m "feat: ruteo con History API (URLs reales) + compat con links /#/ viejos"
```

---

### Task 4: Rutas reales en URLs generadas en servidor

Actualiza las URLs `/#/...` que se generan del lado del servidor (retornos de MercadoPago y redirect de confirmación de suscripción) a rutas reales. Con el redirect de Task 3 seguirían funcionando, pero se dejan limpias.

**Files:**
- Modify: `api/create-preference.js:72-74` (back_urls)
- Modify: `api/confirm-subscription.js:9` (redirect)
- Modify: `tests/confirm-subscription.test.js:29,37` (esperar rutas sin `#`)
- Test: `tests/back-urls.test.js` (nuevo)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `back_urls` y `Location` de redirect ahora en formato `/pago-*` y `/suscripcion-*`.

- [ ] **Step 1: Actualizar el test existente de confirm-subscription**

En `tests/confirm-subscription.test.js`, cambiar las dos aserciones de `Location`:

- Línea 29: `assert.ok(res.headers.Location.endsWith('/#/suscripcion-error'), ...)` → `assert.ok(res.headers.Location.endsWith('/suscripcion-error'), 'token malo → error');`
- Línea 37: `assert.ok(res.headers.Location.endsWith('/#/suscripcion-confirmada'));` → `assert.ok(res.headers.Location.endsWith('/suscripcion-confirmada'));`

- [ ] **Step 2: Escribir el test nuevo de back_urls (falla)**

Crear `tests/back-urls.test.js`:

```js
// tests/back-urls.test.js
const assert = require('assert');
process.env.SITE_URL = 'https://www.botinesaltagamacba.com';
process.env.MP_ACCESS_TOKEN = 'TEST';

const prodPath = require.resolve('../api/_products.js');
require.cache[prodPath] = { id: prodPath, filename: prodPath, loaded: true, exports: {
  getTrustedPrice: (id) => (id === 'p1' ? 100000 : undefined),
}};
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  COUPON_DISCOUNT: 0.05,
  validateCoupon: async () => ({ valid: false, reason: 'x' }),
}};

let sentBody = null;
global.fetch = async (u, opts) => {
  sentBody = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ id: 'pref1', init_point: 'https://mp/init' }) };
};

const handler = require('../api/create-preference.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const shipping = { nombre:'A', apellido:'B', email:'a@b.com', dni:'1', provincia:'X', localidad:'Y', direccion:'Z', codigoPostal:'1', celular:'1' };

(async () => {
  const res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping } }, res);
  assert.ok(sentBody.back_urls.success.endsWith('/pago-exitoso'), 'success sin #');
  assert.ok(sentBody.back_urls.failure.endsWith('/pago-fallido'), 'failure sin #');
  assert.ok(sentBody.back_urls.pending.endsWith('/pago-pendiente'), 'pending sin #');
  assert.ok(!JSON.stringify(sentBody.back_urls).includes('#'), 'ninguna back_url tiene #');
  console.log('OK back-urls');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `node tests/back-urls.test.js`
Expected: FALLA en `success sin #` (hoy las back_urls tienen `/#/pago-*`).

- [ ] **Step 4: Actualizar `api/create-preference.js`**

Cambiar el bloque `back_urls` (líneas 71-75):

```js
    back_urls: {
      success: `${SITE_URL}/#/pago-exitoso`,
      failure: `${SITE_URL}/#/pago-fallido`,
      pending: `${SITE_URL}/#/pago-pendiente`,
    },
```

por:

```js
    back_urls: {
      success: `${SITE_URL}/pago-exitoso`,
      failure: `${SITE_URL}/pago-fallido`,
      pending: `${SITE_URL}/pago-pendiente`,
    },
```

- [ ] **Step 5: Actualizar `api/confirm-subscription.js`**

Cambiar la línea 9:

```js
  const redirect = (path) => { res.writeHead(302, { Location: `${SITE_URL}/#/${path}` }); res.end(); };
```

por:

```js
  const redirect = (path) => { res.writeHead(302, { Location: `${SITE_URL}/${path}` }); res.end(); };
```

- [ ] **Step 6: Correr ambos tests para verificar que pasan**

Run: `node tests/back-urls.test.js && node tests/confirm-subscription.test.js`
Expected: `OK back-urls` y `OK confirm-subscription`.

- [ ] **Step 7: Commit**

```bash
git add api/create-preference.js api/confirm-subscription.js tests/back-urls.test.js tests/confirm-subscription.test.js
git commit -m "fix(api): back_urls y redirect de suscripción usan rutas reales (sin /#/)"
```

---

### Task 5: Rewrites en `vercel.json`

Conecta todo en producción: las URLs de producto y lanzamiento van a `api/page.js`; el resto de las rutas sirven `index.html`. Vercel sirve primero los archivos estáticos existentes (`data.js`, `app.jsx`, `styles.css`, `assets/*`), así que solo las rutas sin archivo caen en los rewrites.

**Files:**
- Modify: `vercel.json` (agregar `rewrites`)
- Test: `tests/vercel-json.test.js` (nuevo)

**Interfaces:**
- Consumes: `api/page.js` (Task 2).
- Produces: nada de código.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/vercel-json.test.js`:

```js
// tests/vercel-json.test.js
const assert = require('assert');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); // lanza si el JSON es inválido
assert.ok(Array.isArray(cfg.rewrites), 'debe existir rewrites');
const dests = cfg.rewrites.map(r => r.destination);
const sources = cfg.rewrites.map(r => r.source);
assert.ok(sources.some(s => s.includes(':id')) && dests.includes('/api/page'), 'producto → /api/page');
assert.ok(sources.some(s => s.includes('lanzamientos')) && dests.includes('/api/page'), 'lanzamiento → /api/page');
assert.strictEqual(cfg.rewrites[cfg.rewrites.length - 1].destination, '/index.html', 'catch-all al final → index.html');
console.log('OK vercel-json');
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node tests/vercel-json.test.js`
Expected: FALLA en `debe existir rewrites`.

- [ ] **Step 3: Agregar `rewrites` a `vercel.json`**

Agregar la propiedad `"rewrites"` al objeto raíz (por ejemplo, después de `"ignoreCommand"` y antes de `"headers"`). El orden importa: los específicos primero, el catch-all al final.

```json
  "rewrites": [
    { "source": "/marcas/:brand/:model/:id", "destination": "/api/page" },
    { "source": "/lanzamientos/:slug", "destination": "/api/page" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node tests/vercel-json.test.js`
Expected: `OK vercel-json`

- [ ] **Step 5: Correr toda la suite de tests**

Run: `node tests/catalog.test.js && node tests/page-og.test.js && node tests/transpile-app.test.js && node tests/back-urls.test.js && node tests/confirm-subscription.test.js && node tests/vercel-json.test.js`
Expected: todos imprimen `OK ...`.

- [ ] **Step 6: Commit**

```bash
git add vercel.json tests/vercel-json.test.js
git commit -m "feat: rewrites de Vercel para URLs reales y previews OG"
```

---

## Verificación post-deploy (manual, con el usuario)

Una vez mergeado y desplegado:

1. Abrir una URL real de producto directa (`https://www.botinesaltagamacba.com/marcas/nike/mercurial/<id>`) → carga el producto.
2. Pegar esa URL en el **Facebook Sharing Debugger** (https://developers.facebook.com/tools/debug/) → "Scrape Again" → debe mostrar foto + título + precio.
3. Pegar la URL en un chat de WhatsApp propio → aparece la preview con foto.
4. Probar un link viejo `/#/...` compartido antes → redirige a la ruta real.
5. Hacer una compra de prueba y confirmar que el retorno de MercadoPago cae en `/pago-exitoso` correctamente.
</content>
