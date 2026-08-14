# URLs reales + previews Open Graph — Diseño

**Fecha:** 2026-08-13
**Estado:** Aprobado (alcance: "Rutas reales + función OG")

## Objetivo

Dos mejoras sobre la tienda en producción, **sin introducir build step** y sin
tocar checkout / MercadoPago / admin:

1. **URLs reales** — pasar de hash routing (`/#/marcas/nike/mercurial/123`) a
   rutas History API (`/marcas/nike/mercurial/123`).
2. **Previews Open Graph** — que al compartir el link de un producto o de un
   lanzamiento en WhatsApp / redes aparezca foto + nombre + precio, sirviendo
   HTML con meta tags correctas desde una función serverless (los crawlers no
   ejecutan JS).

## Arquitectura (contexto actual)

- Sitio estático, sin build: React 18 UMD + Babel Standalone vía
  `<script type="text/babel">`. Componentes exponen globales con
  `Object.assign(window, {...})`. Cache-busting manual `?v=N` en `index.html`.
- Ruteo hash en [app.jsx](../../../app.jsx): `useHashRoute` lee
  `window.location.hash`; `navigate(path)` setea `window.location.hash`. Toda la
  navegación interna está centralizada en `navigate()` — los componentes llaman
  `navigate('/marcas/...')` y no leen la URL directamente.
- Funciones Vercel en `api/` (Node CommonJS, `module.exports = async function
  handler(req, res)`).
- Datos en `data.js` (`window.BAG_DATA`). Los precios de confianza en servidor se
  leen con [api/_products.js](../../../api/_products.js) que carga `data.js` en un
  sandbox `vm`.
- Imágenes en `data.js` como rutas relativas: `assets/xxxx.webp`.
- `SITE_URL` por defecto = `https://www.botinesaltagamacba.com`.

### Estructura de datos relevante

- Producto (`BAG_DATA.products["marca/modelo"][]`):
  `{ id, name, colorway, color, price, images: ["assets/..."] }`
- Artículo (`BAG_DATA.articles[]`):
  `{ id, slug, title, excerpt, cover: "assets/...", brand }`

## Parte 1 — URLs reales (History API)

### `app.jsx`
Reemplazar `useHashRoute` por un router basado en History API:

- Estado `route` inicializado con `window.location.pathname` (normalizado: sin
  barra final salvo la raíz).
- `useEffect` que registra un listener de `popstate` → actualiza `route` desde
  `window.location.pathname` (para que el botón "atrás/adelante" funcione).
- `navigate(path)`:
  - Si `path` es igual a la ruta actual, no hace nada.
  - `window.history.pushState({}, '', path)`.
  - Actualiza el estado `route` (pushState NO dispara `popstate`, así que hay que
    setear el estado a mano).
  - `window.scrollTo({ top: 0, behavior: 'instant' })`.
- El parseo de `route` (`route.split('/').filter(Boolean)`) queda **idéntico** —
  ya opera sobre paths sin `#`.

### Compatibilidad con links viejos (`/#/...`)
Script inline al inicio de `<head>` en `index.html`, antes de cargar React:

```html
<script>
  (function () {
    var h = window.location.hash;
    if (h && h.indexOf('#/') === 0) {
      var path = h.slice(1); // "#/marcas/x" -> "/marcas/x"
      window.history.replaceState(null, '', path + window.location.search);
    }
  })();
</script>
```

Así los links ya compartidos por WhatsApp (`/#/...`) se convierten a la ruta real
antes de que la app monte, sin recarga.

### `index.html`
- Agregar `<base href="/">` en `<head>` (antes de los `<script src>` relativos)
  para que `data.js`, `styles.css`, `colors_and_type.css` y `components/*.jsx`
  resuelvan desde la raíz aunque la URL sea profunda (`/marcas/nike/x/123`).
- Los `<a href="#">` con `onClick`+`preventDefault` no se ven afectados (son
  fragmentos, `<base>` no los altera).

### `vercel.json`
Agregar `rewrites` (Vercel sirve primero los archivos estáticos existentes como
`data.js`, `app.jsx`, `styles.css`, `assets/*`; los rewrites aplican solo cuando
no hay archivo):

```json
"rewrites": [
  { "source": "/marcas/:brand/:model/:id", "destination": "/api/page" },
  { "source": "/lanzamientos/:slug", "destination": "/api/page" },
  { "source": "/((?!api/).*)", "destination": "/index.html" }
]
```

- Rutas de producto (4 segmentos) y de lanzamiento → función OG.
- Cualquier otra ruta profunda → `index.html` (la app la resuelve client-side).
- `/api/...` nunca se reescribe.

## Parte 2 — Función OG (`api/page.js`)

Función serverless que sirve HTML con meta tags Open Graph inyectadas.

### Carga de datos
Nuevo helper compartido `api/_catalog.js` (o extender `_products.js`) que exponga
los objetos completos, no solo el precio. Carga `data.js` con el mismo patrón
`vm` sandbox y expone:
- `getProductById(id)` → `{ product, brandKey }` o `null`
- `getArticleBySlug(slug)` → artículo o `null`

`api/_products.js` sigue funcionando igual (puede reusar el nuevo loader
internamente o quedar tal cual; no se rompe su interfaz `getTrustedPrice`).

### `api/page.js` — handler
1. Parsear `req.url` → determinar tipo (producto o artículo) y el identificador
   (id del último segmento para producto; slug para lanzamiento).
2. Buscar la entidad. Si no existe → servir `index.html` tal cual (meta por
   defecto), status 200.
3. Si existe, construir las meta:
   - **Producto:** `og:title` = `name` + ` — ` + `colorway`; `og:description` =
     texto con precio formateado (`$ 599.999`); `og:image` = `SITE_URL + '/' +
     images[0]`; `og:type` = `product`; `product:price:amount` = price;
     `product:price:currency` = `ARS`.
   - **Artículo:** `og:title` = `title`; `og:description` = `excerpt`;
     `og:image` = `SITE_URL + '/' + cover`; `og:type` = `article`.
   - Comunes: `og:url` = `SITE_URL + req.url` (sin querystring), `og:site_name`,
     `twitter:card` = `summary_large_image`, `twitter:title/description/image`.
   - Todos los valores pasan por escape HTML de atributos.
4. Leer `index.html` de disco (`fs.readFileSync(path.join(process.cwd(),
   'index.html'))`), reemplazar el `<title>` e inyectar el bloque de meta OG
   dentro de `<head>` (después de `<title>`), devolver con
   `Content-Type: text/html`.
5. La página resultante incluye todos los `<script>` de siempre → la app React se
   monta y muestra la pantalla real client-side.

### og:image absoluta
Las imágenes son relativas (`assets/...`). Se prefija con `SITE_URL`. Si el
producto/artículo **no tiene imagen**, se usa como fallback el logo de la marca:
`SITE_URL + '/assets/logo-altagama-transparent.png'` (nombre URL-safe, ya
versionado). Siempre se emite una `og:image` (nunca vacía).

## Manejo de errores
- Producto/artículo inexistente → `index.html` por defecto (no 404, la app decide).
- Error leyendo `data.js` o `index.html` → devolver `index.html` crudo si se
  puede; si ni eso, 500 con mensaje mínimo. Nunca romper la navegación del
  usuario por un fallo de meta tags.

## Testing
- **Frontend (manual + transpile):** `@babel/standalone` transpila `app.jsx` sin
  errores; server local; verificar: navegación con clicks (pushState), deep link
  directo (`/marcas/nike/mercurial/merc-002` monta ProductScreen), botón atrás,
  y redirect de hash viejo (`/#/marcas/...` → `/marcas/...`).
- **`api/page.js` (node assert):** mockear `fs`/loader vía `require.cache`;
  llamar al handler con un path de producto y assert de que el HTML contiene
  `og:title` con el nombre, `og:image` con URL absoluta, y el precio; ídem para
  artículo; y que un id inexistente devuelve el `index.html` por defecto.
- **Post-deploy (manual):** Facebook Sharing Debugger / previsualización de
  WhatsApp sobre una URL real de producto → aparece foto + título + precio.

## Fuera de alcance (YAGNI)
- Migración a Next.js / Vite SSG.
- Prerender de SEO para Google (Google renderiza JS; con URLs reales alcanza).
- OG para páginas de marca/modelo (solo producto y lanzamiento, que son las que
  se comparten).
- Sitemap.xml (se puede sumar después).

## Riesgo
No se toca checkout, MercadoPago ni admin. El único cambio no-aditivo es el
router en `app.jsx`, centralizado en un archivo. `api/page.js` y `_catalog.js`
son nuevos. `index.html` y `vercel.json` reciben cambios acotados y reversibles.
</content>
