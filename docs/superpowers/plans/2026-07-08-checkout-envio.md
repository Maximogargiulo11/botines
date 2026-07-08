# Checkout con datos de envío — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insertar un paso de captura de datos de envío (nombre, apellido, DNI, provincia, localidad, dirección, código postal, celular, descripción opcional) entre el carrito y el pago con MercadoPago, y persistir esos datos en `orders.json` cuando el pago se aprueba.

**Architecture:** Sitio estático sin build (React 18 + Babel Standalone vía CDN, sin bundler). Router hash-based casero en `app.jsx`. Se agrega una pantalla nueva (`screens/CheckoutScreen.jsx`) con dos pasos internos (`form` → `confirm`) bajo la ruta `#/checkout`. El botón del carrito deja de llamar directo a la API y navega a esa ruta. Los datos de envío viajan como `metadata` en la preferencia de MercadoPago y el webhook los recupera del pago aprobado para guardarlos en `orders.json` (persistido vía commit a GitHub, patrón ya existente).

**Tech Stack:** React 18 (UMD, sin build), Babel Standalone (transpilación en el navegador), Vercel Functions (Node, `module.exports = async function handler(req,res)`), MercadoPago Checkout Pro API, GitHub Contents API como "base de datos" de `orders.json`.

## Global Constraints

- No hay build step ni bundler: cada `.jsx` se sirve como `<script type="text/babel">` y se transpila en el navegador. No agregar dependencias npm ni introducir un build.
- Cache-busting manual: cada `<script src="...?v=N">` en `index.html`/`admin.html` debe bumpearse (`N+1`) cuando se edita ese archivo.
- No existe framework de testing en el repo. La verificación es manual: scripts Node ad-hoc para lógica de validación backend, y navegador (servidor estático local) para el frontend.
- Todo el copy visible es en español, tono consistente con el resto del sitio (mayúsculas en botones tipo `.bag-btn`, minúsculas en textos de apoyo).
- Reusar los design tokens de `colors_and_type.css` (variables `--bag-*`) y las clases ya existentes (`.bag-btn`, `.bag-eyebrow`, `.bag-cart__item*`, etc.) en vez de duplicar estilos.
- El número de WhatsApp (`5493516836569`) y el flujo del botón "CONSULTAR POR WHATSAPP" no cambian.
- Campos de envío requeridos (mismos nombres de clave en frontend y backend, camelCase): `nombre`, `apellido`, `dni`, `provincia`, `localidad`, `direccion`, `codigoPostal`, `celular`. `descripcion` es opcional.
- Solo se persiste una orden en `orders.json` si el pago fue aprobado (comportamiento actual del webhook, no cambia).

---

### Task 1: Copiar el logo de MercadoPago sin espacios en el nombre de archivo

**Files:**
- Create: `assets/logo-mercadopago.jpg` (copia de `assets/logo mercado pago.JPG`)

**Interfaces:**
- Produces: ruta de imagen `assets/logo-mercadopago.jpg`, consumida por Task 2/3 (CheckoutScreen) y Task 5 (CartDrawer).

- [ ] **Step 1: Copiar el archivo**

```bash
cp "assets/logo mercado pago.JPG" "assets/logo-mercadopago.jpg"
```

- [ ] **Step 2: Verificar que el archivo se creó y no está vacío**

Run: `ls -la "assets/logo-mercadopago.jpg"`
Expected: el archivo existe y su tamaño en bytes es igual al de `assets/logo mercado pago.JPG` (no 0 bytes).

- [ ] **Step 3: Commit**

```bash
git add "assets/logo-mercadopago.jpg"
git commit -m "assets: copiar logo de MercadoPago sin espacios en el nombre"
```

---

### Task 2: Estilos compartidos (cartel de envío gratis, opciones de pago, pantalla de checkout)

**Files:**
- Modify: `styles.css` (agregar al final del archivo, después de la línea 1300 aprox., sección `/* ============ ROUTE BAR ... */`)

**Interfaces:**
- Produces clases CSS: `.bag-shipping-banner`, `.bag-payopts`, `.bag-payopts__logo`, `.bag-checkout`, `.bag-checkout__head`, `.bag-checkout__title`, `.bag-checkout__layout`, `.bag-checkout__main`, `.bag-checkout__form`, `.bag-checkout__row`, `.bag-checkout__field`, `.bag-checkout__field-label`, `.bag-checkout__field-error`, `.bag-checkout__confirm`, `.bag-checkout__confirm-head`, `.bag-checkout__edit`, `.bag-checkout__summary-list`, `.bag-checkout__aside`, `.bag-checkout__empty`. Consumidas por Task 3 (CheckoutScreen) y Task 5 (CartDrawer).
- Consume: variables `--bag-*` de `colors_and_type.css` (ya cargado en `index.html`).

- [ ] **Step 1: Agregar el bloque CSS al final de `styles.css`**

Agregar al final del archivo (después de la última línea existente):

```css

/* ============ SHIPPING BANNER + PAYMENT OPTIONS (compartido: carrito + checkout) ============ */
.bag-shipping-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--bag-line);
  font-size: var(--bag-fs-xs);
  letter-spacing: var(--bag-ls-wide);
  text-transform: uppercase;
  color: var(--bag-fg);
}
.bag-payopts {
  display: flex; flex-direction: column; gap: 8px;
  align-items: flex-start;
}
.bag-payopts__logo {
  height: 28px; width: auto;
  background: #fff;
  padding: 3px 8px;
}

/* ============ CHECKOUT SCREEN ============ */
.bag-checkout {
  max-width: var(--bag-content-max);
  margin: 0 auto;
  padding: var(--bag-s-10) var(--bag-gutter) var(--bag-s-32);
}
.bag-checkout__head {
  padding: var(--bag-s-6) 0 var(--bag-s-10);
  border-bottom: 1px solid var(--bag-line);
  margin-bottom: var(--bag-s-10);
}
.bag-checkout__title {
  font-family: var(--bag-font-serif);
  font-size: clamp(28px, 4vw, 44px);
  margin-top: var(--bag-s-3);
}
.bag-checkout__layout {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: var(--bag-s-16);
  align-items: start;
}
.bag-checkout__main { display: flex; flex-direction: column; gap: var(--bag-s-8); }
.bag-checkout__form { display: flex; flex-direction: column; gap: var(--bag-s-5); }
.bag-checkout__row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--bag-s-5); }
.bag-checkout__field { display: flex; flex-direction: column; gap: 6px; }
.bag-checkout__field-label {
  font-size: var(--bag-fs-xs);
  letter-spacing: var(--bag-ls-wide);
  text-transform: uppercase;
  color: var(--bag-fg-muted);
}
.bag-checkout__field input,
.bag-checkout__field select,
.bag-checkout__field textarea {
  background: var(--bag-bg-elev);
  border: 1px solid var(--bag-line-strong);
  color: var(--bag-fg);
  padding: 12px 14px;
  font-family: var(--bag-font-sans);
  font-size: var(--bag-fs-base);
}
.bag-checkout__field input:focus,
.bag-checkout__field select:focus,
.bag-checkout__field textarea:focus {
  outline: none;
  border-color: var(--bag-fg);
}
.bag-checkout__field textarea { resize: vertical; min-height: 72px; }
.bag-checkout__field-error { font-size: 11px; color: #ff4455; }
.bag-checkout__confirm { display: flex; flex-direction: column; gap: var(--bag-s-6); }
.bag-checkout__confirm-head { display: flex; justify-content: space-between; align-items: center; }
.bag-checkout__edit {
  background: transparent; border: 0; color: var(--bag-fg-muted);
  text-decoration: underline; cursor: pointer; font-size: var(--bag-fs-sm);
}
.bag-checkout__edit:hover { color: var(--bag-fg); }
.bag-checkout__summary-list { display: flex; flex-direction: column; gap: var(--bag-s-3); }
.bag-checkout__summary-list > div { display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid var(--bag-line-faint); padding-bottom: var(--bag-s-3); }
.bag-checkout__summary-list dt { font-size: 10px; letter-spacing: var(--bag-ls-wide); text-transform: uppercase; color: var(--bag-fg-muted); margin: 0; }
.bag-checkout__summary-list dd { margin: 0; font-size: var(--bag-fs-base); }
.bag-checkout__aside {
  background: var(--bag-bg-elev);
  border: 1px solid var(--bag-line);
  padding: var(--bag-s-6);
  display: flex; flex-direction: column; gap: var(--bag-s-5);
}
.bag-checkout__empty {
  max-width: 420px; margin: var(--bag-s-24) auto; text-align: center;
  display: flex; flex-direction: column; gap: var(--bag-s-4); align-items: center;
}

@media (max-width: 860px) {
  .bag-checkout__layout { grid-template-columns: 1fr; }
  .bag-checkout__row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Verificar que el CSS es sintácticamente válido**

Run: `node -e "const css=require('fs').readFileSync('styles.css','utf8'); const open=(css.match(/{/g)||[]).length; const close=(css.match(/}/g)||[]).length; if(open!==close) throw new Error('llaves desbalanceadas: '+open+' vs '+close); console.log('OK', open, close)"`
Expected: `OK <N> <N>` (mismo número de `{` y `}`, sin error).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: agregar estilos de checkout, cartel de envío gratis y opciones de pago"
```

---

### Task 3: Crear `screens/CheckoutScreen.jsx`

**Files:**
- Create: `screens/CheckoutScreen.jsx`

**Interfaces:**
- Consumes: prop `cart` (array de `{ id, name, colorway, price, size, image, qty }`, mismo shape que ya arma `addToCart` en `app.jsx`), prop `navigate(path: string)`. Clases CSS de Task 2. Global `window.formatPrice(n)` (ya existe en `data.js`). Endpoint `POST /api/create-preference` (modificado en Task 6).
- Produces: componente global `window.CheckoutScreen`, registrado por Task 4 en la ruta `#/checkout`.

- [ ] **Step 1: Escribir el componente**

```jsx
/* global React */
const { useState: useState_checkout } = React;

const PROVINCIAS_AR = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
  'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

function validateShipping(form) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Ingresá tu nombre.';
  if (!form.apellido.trim()) errors.apellido = 'Ingresá tu apellido.';
  if (!/^\d{7,8}$/.test(form.dni.trim())) errors.dni = 'DNI inválido (7 u 8 dígitos, sin puntos).';
  if (!form.provincia) errors.provincia = 'Elegí tu provincia.';
  if (!form.localidad.trim()) errors.localidad = 'Ingresá tu localidad.';
  if (!form.direccion.trim()) errors.direccion = 'Ingresá tu dirección.';
  if (!/^\d{4}$/.test(form.codigoPostal.trim())) errors.codigoPostal = 'Código postal inválido (4 dígitos).';
  if (!/^\d{8,15}$/.test(form.celular.replace(/\D/g, ''))) errors.celular = 'Celular inválido.';
  return errors;
}

function CheckoutField({ label, error, children }) {
  return (
    <label className="bag-checkout__field">
      <span className="bag-checkout__field-label">{label}</span>
      {children}
      {error && <span className="bag-checkout__field-error">{error}</span>}
    </label>
  );
}

function CheckoutScreen({ cart, navigate }) {
  const [step, setStep] = useState_checkout('form');
  const [form, setForm] = useState_checkout({
    nombre: '', apellido: '', dni: '', provincia: '', localidad: '',
    direccion: '', codigoPostal: '', celular: '', descripcion: '',
  });
  const [errors, setErrors] = useState_checkout({});
  const [loading, setLoading] = useState_checkout(false);
  const [payError, setPayError] = useState_checkout(null);

  const subtotal = cart.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleNext = (e) => {
    e.preventDefault();
    const errs = validateShipping(form);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep('confirm');
  };

  const handlePay = async () => {
    setLoading(true);
    setPayError(null);
    const gaItems = cart.map(it => ({ item_id: it.id, item_name: it.name, item_variant: it.colorway, price: it.price, quantity: it.qty || 1 }));
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'begin_checkout', { currency: 'ARS', value: subtotal, items: gaItems });
    }
    try {
      sessionStorage.setItem('bag:checkout_snapshot', JSON.stringify({
        transaction_id: Date.now().toString(), value: subtotal, items: gaItems,
      }));
    } catch {}
    try {
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, shipping: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar el pago');
      window.location.href = data.init_point;
    } catch (err) {
      setPayError(err.message);
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="bag-checkout">
        <div className="bag-checkout__empty">
          <div className="bag-eyebrow bag-eyebrow--muted">Carrito vacío</div>
          <p>Aún no añadiste productos. Explorá el catálogo para encontrar tu próximo par.</p>
          <button className="bag-btn bag-btn--ghost" onClick={() => navigate('/marcas')}>EXPLORAR CATÁLOGO</button>
        </div>
      </main>
    );
  }

  return (
    <main className="bag-checkout">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
        <span>›</span>
        <span className="is-current">Checkout</span>
      </nav>

      <header className="bag-checkout__head">
        <div className="bag-eyebrow bag-eyebrow--muted">CHECKOUT</div>
        <h1 className="bag-checkout__title">{step === 'form' ? 'Datos de envío' : 'Confirmar y pagar'}</h1>
      </header>

      <div className="bag-checkout__layout">
        <div className="bag-checkout__main">
          {step === 'form' ? (
            <form className="bag-checkout__form" onSubmit={handleNext}>
              <div className="bag-checkout__row">
                <CheckoutField label="Nombre" error={errors.nombre}>
                  <input value={form.nombre} onChange={e => updateField('nombre', e.target.value)} />
                </CheckoutField>
                <CheckoutField label="Apellido" error={errors.apellido}>
                  <input value={form.apellido} onChange={e => updateField('apellido', e.target.value)} />
                </CheckoutField>
              </div>
              <CheckoutField label="DNI" error={errors.dni}>
                <input value={form.dni} onChange={e => updateField('dni', e.target.value)} inputMode="numeric" placeholder="Ej. 30123456" />
              </CheckoutField>
              <div className="bag-checkout__row">
                <CheckoutField label="Provincia" error={errors.provincia}>
                  <select value={form.provincia} onChange={e => updateField('provincia', e.target.value)}>
                    <option value="">Elegí tu provincia</option>
                    {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </CheckoutField>
                <CheckoutField label="Localidad" error={errors.localidad}>
                  <input value={form.localidad} onChange={e => updateField('localidad', e.target.value)} />
                </CheckoutField>
              </div>
              <div className="bag-checkout__row">
                <CheckoutField label="Dirección" error={errors.direccion}>
                  <input value={form.direccion} onChange={e => updateField('direccion', e.target.value)} placeholder="Calle y número" />
                </CheckoutField>
                <CheckoutField label="Código Postal" error={errors.codigoPostal}>
                  <input value={form.codigoPostal} onChange={e => updateField('codigoPostal', e.target.value)} inputMode="numeric" placeholder="Ej. 5000" />
                </CheckoutField>
              </div>
              <CheckoutField label="Celular" error={errors.celular}>
                <input value={form.celular} onChange={e => updateField('celular', e.target.value)} type="tel" placeholder="Ej. 3511234567" />
              </CheckoutField>
              <CheckoutField label="Descripción (opcional)">
                <textarea value={form.descripcion} onChange={e => updateField('descripcion', e.target.value)} rows={3} placeholder="Referencias de entrega, horarios, etc." />
              </CheckoutField>

              <button className="bag-btn bag-btn--primary bag-btn--block" type="submit">SIGUIENTE</button>
            </form>
          ) : (
            <div className="bag-checkout__confirm">
              <div className="bag-checkout__confirm-head">
                <div className="bag-eyebrow bag-eyebrow--muted">DATOS DE ENVÍO</div>
                <button className="bag-checkout__edit" onClick={() => setStep('form')}>Editar</button>
              </div>
              <dl className="bag-checkout__summary-list">
                <div><dt>Nombre</dt><dd>{form.nombre} {form.apellido}</dd></div>
                <div><dt>DNI</dt><dd>{form.dni}</dd></div>
                <div><dt>Dirección</dt><dd>{form.direccion}, {form.localidad}, {form.provincia} (CP {form.codigoPostal})</dd></div>
                <div><dt>Celular</dt><dd>{form.celular}</dd></div>
                {form.descripcion && <div><dt>Descripción</dt><dd>{form.descripcion}</dd></div>}
              </dl>

              <div className="bag-shipping-banner">🚚 Envío gratis</div>
              <div className="bag-payopts">
                <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
                <img src="assets/logo-mercadopago.jpg" alt="MercadoPago" className="bag-payopts__logo" />
              </div>

              {payError && <p className="bag-cart__error">{payError}</p>}
              <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handlePay} disabled={loading}>
                {loading ? 'Redirigiendo...' : 'PAGAR CON MERCADOPAGO'}
              </button>
            </div>
          )}
        </div>

        <aside className="bag-checkout__aside">
          <div className="bag-eyebrow bag-eyebrow--muted">TU PEDIDO</div>
          <div className="bag-cart__items" style={{ padding: 0 }}>
            {cart.map((it, idx) => (
              <div className="bag-cart__item" key={`${it.id}-${it.size}-${idx}`}>
                <div className="bag-cart__item-media"><img src={it.image || 'assets/placeholder-product.svg'} alt="" /></div>
                <div className="bag-cart__item-body">
                  <div className="bag-cart__item-name">{it.name}</div>
                  <div className="bag-cart__item-meta">{it.colorway} · Talle {it.size} EU</div>
                  <div className="bag-cart__item-price">{window.formatPrice(it.price)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="bag-cart__subtotal">
            <span className="bag-eyebrow bag-eyebrow--muted">SUBTOTAL</span>
            <span className="bag-cart__subtotal-value">{window.formatPrice(subtotal)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

Object.assign(window, { CheckoutScreen });
```

- [ ] **Step 2: Verificar que el JSX no tiene tags sin cerrar (chequeo básico)**

Run: `node -e "const s=require('fs').readFileSync('screens/CheckoutScreen.jsx','utf8'); const open=(s.match(/</g)||[]).length; const close=(s.match(/>/g)||[]).length; console.log('lt:',open,'gt:',close); if(open!==close) throw new Error('tags desbalanceados')"`
Expected: `lt: <N> gt: <N>` con los dos números iguales, sin error (chequeo aproximado — la verificación real ocurre en el navegador vía Babel Standalone en Task 4/9).

- [ ] **Step 3: Commit**

```bash
git add screens/CheckoutScreen.jsx
git commit -m "feat: agregar pantalla de checkout con formulario de envío"
```

---

### Task 4: Registrar la ruta `#/checkout`

**Files:**
- Modify: `index.html:47` (agregar script tag después de `screens/InfoScreens.jsx`)
- Modify: `app.jsx:90-94` (agregar branch de ruta), `app.jsx:1-4` (agregar `CheckoutScreen` a los globals declarados)

**Interfaces:**
- Consumes: `window.CheckoutScreen` (Task 3), `cart` y `navigate` ya existentes en `app.jsx`.
- Produces: ruta `#/checkout` navegable desde cualquier lugar del sitio.

- [ ] **Step 1: Registrar el script en `index.html`**

En `index.html`, después de la línea:
```html
  <script type="text/babel" src="screens/InfoScreens.jsx?v=5"></script>
```
agregar:
```html
  <script type="text/babel" src="screens/CheckoutScreen.jsx?v=1"></script>
```

- [ ] **Step 2: Declarar el global en `app.jsx`**

En `app.jsx:3`, cambiar:
```js
/* global HomeScreen, ArticleScreen, BrandsScreen, BrandScreen, ModelScreen, ProductScreen, PoliticaScreen, FaqScreen */
```
por:
```js
/* global HomeScreen, ArticleScreen, BrandsScreen, BrandScreen, ModelScreen, ProductScreen, PoliticaScreen, FaqScreen, CheckoutScreen */
```

- [ ] **Step 3: Agregar la rama de ruta en `app.jsx`**

En `app.jsx`, la cadena de rutas actual (alrededor de la línea 90) es:
```js
  else if (parts[0] === 'politica-cambios') screen = <PoliticaScreen navigate={navigate} />;
  else if (parts[0] === 'faq') screen = <FaqScreen navigate={navigate} />;
  else if (parts[0] === 'pago-exitoso')  screen = <PaymentResultScreen status="exitoso"  navigate={navigate} clearCart={clearCart} />;
```
Insertar una línea nueva entre la de `faq` y la de `pago-exitoso`:
```js
  else if (parts[0] === 'politica-cambios') screen = <PoliticaScreen navigate={navigate} />;
  else if (parts[0] === 'faq') screen = <FaqScreen navigate={navigate} />;
  else if (parts[0] === 'checkout') screen = <CheckoutScreen cart={cart} navigate={navigate} />;
  else if (parts[0] === 'pago-exitoso')  screen = <PaymentResultScreen status="exitoso"  navigate={navigate} clearCart={clearCart} />;
```

- [ ] **Step 4: Bumpear el cache-busting de `app.jsx` en `index.html`**

En `index.html`, cambiar:
```html
  <script type="text/babel" src="app.jsx?v=10"></script>
```
por:
```html
  <script type="text/babel" src="app.jsx?v=11"></script>
```

- [ ] **Step 5: Verificar sirviendo el sitio localmente**

Run: `npx --yes serve -l 5510 . &` (o cualquier servidor estático) y luego `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5510/screens/CheckoutScreen.jsx`
Expected: `200`

Parar el servidor: `kill %1` (o el PID correspondiente).

- [ ] **Step 6: Commit**

```bash
git add index.html app.jsx
git commit -m "feat: registrar la ruta #/checkout"
```

---

### Task 5: Actualizar `CartDrawer.jsx` — Instancia 1 (botón, cartel de envío gratis, opciones de pago)

**Files:**
- Modify: `components/CartDrawer.jsx`
- Modify: `index.html:39` (bump cache-busting)

**Interfaces:**
- Consumes: clases `.bag-shipping-banner`, `.bag-payopts`, `.bag-payopts__logo` (Task 2), ruta `#/checkout` (Task 4), prop `navigate` (ya recibido por `CartDrawer`).
- Produces: comportamiento de click en "IR A PAGAR" → `navigate('/checkout')` en vez de llamar a la API directamente. `checkoutWA` y su lógica no cambian.

- [ ] **Step 1: Quitar el estado y la función de checkout MP (ya no se llama desde acá)**

En `components/CartDrawer.jsx`, reemplazar:
```jsx
  const [loading, setLoading] = useState_cart(false);
  const [error, setError]     = useState_cart(null);

  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

  const checkoutMP = async () => {
    setLoading(true);
    setError(null);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'begin_checkout', {
        currency: 'ARS',
        value: subtotal,
        items: items.map(it => ({ item_id: it.id, item_name: it.name, item_variant: it.colorway, price: it.price, quantity: it.qty || 1 })),
      });
    }
    try {
      sessionStorage.setItem('bag:checkout_snapshot', JSON.stringify({
        transaction_id: Date.now().toString(),
        value: subtotal,
        items: items.map(it => ({ item_id: it.id, item_name: it.name, item_variant: it.colorway, price: it.price, quantity: it.qty || 1 })),
      }));
    } catch {}
    try {
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar el pago');
      window.location.href = data.init_point;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };
```
por:
```jsx
  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

  const goToCheckout = () => {
    onClose();
    navigate('/checkout');
  };
```

- [ ] **Step 2: Actualizar el footer del carrito**

Reemplazar:
```jsx
        {items.length > 0 && (
          <footer className="bag-cart__foot">
            <div className="bag-cart__subtotal">
              <span className="bag-eyebrow bag-eyebrow--muted">SUBTOTAL</span>
              <span className="bag-cart__subtotal-value">{window.formatPrice(subtotal)}</span>
            </div>
            {error && <p className="bag-cart__error">{error}</p>}
            <button
              className="bag-btn bag-btn--primary bag-btn--block"
              onClick={checkoutMP}
              disabled={loading}
            >
              {loading ? 'Redirigiendo...' : 'PAGAR CON MERCADOPAGO'}
            </button>
            <button className="bag-btn bag-btn--ghost bag-btn--block bag-cart__wa-btn" onClick={checkoutWA}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              CONSULTAR POR WHATSAPP
            </button>
            <p className="bag-cart__note">El envío se coordina por WhatsApp luego del pago.</p>
          </footer>
        )}
```
por:
```jsx
        {items.length > 0 && (
          <footer className="bag-cart__foot">
            <div className="bag-cart__subtotal">
              <span className="bag-eyebrow bag-eyebrow--muted">SUBTOTAL</span>
              <span className="bag-cart__subtotal-value">{window.formatPrice(subtotal)}</span>
            </div>
            <div className="bag-shipping-banner">🚚 Envío gratis</div>
            <button className="bag-btn bag-btn--primary bag-btn--block" onClick={goToCheckout}>
              IR A PAGAR
            </button>
            <div className="bag-payopts">
              <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
              <img src="assets/logo-mercadopago.jpg" alt="MercadoPago" className="bag-payopts__logo" />
            </div>
            <button className="bag-btn bag-btn--ghost bag-btn--block bag-cart__wa-btn" onClick={checkoutWA}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              CONSULTAR POR WHATSAPP
            </button>
            <p className="bag-cart__note">Cargá tus datos de envío en el siguiente paso.</p>
          </footer>
        )}
```

- [ ] **Step 3: Verificar que no quedaron referencias a `checkoutMP`, `loading` ni `error`**

Run: `grep -n "checkoutMP\|setLoading\|setError\b" components/CartDrawer.jsx`
Expected: sin resultados (comando devuelve vacío / exit code 1).

- [ ] **Step 4: Bumpear cache-busting en `index.html`**

Cambiar:
```html
  <script type="text/babel" src="components/CartDrawer.jsx?v=5"></script>
```
por:
```html
  <script type="text/babel" src="components/CartDrawer.jsx?v=6"></script>
```

- [ ] **Step 5: Commit**

```bash
git add components/CartDrawer.jsx index.html
git commit -m "feat: el carrito redirige al checkout en vez de pagar directo"
```

---

### Task 6: `api/create-preference.js` — aceptar y validar `shipping`, agregarlo como metadata

**Files:**
- Modify: `api/create-preference.js`

**Interfaces:**
- Consumes: body `{ items, shipping: { nombre, apellido, dni, provincia, localidad, direccion, codigoPostal, celular, descripcion } }` (enviado por Task 3).
- Produces: preferencia de MercadoPago con `metadata: { nombre, apellido, dni, provincia, localidad, direccion, codigo_postal, celular, descripcion }` (snake_case, tal como la devuelve la API de pagos de MP). Consumido por Task 7.

- [ ] **Step 1: Modificar el handler**

Reemplazar:
```js
  const { items } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const preference = {
    items: items.map(item => ({
      id: item.id,
      title: `${item.name} — ${item.colorway} — Talle ${item.size} EU`,
      quantity: item.qty || 1,
      unit_price: Number(item.price),
      currency_id: 'ARS',
      ...(item.image ? { picture_url: `${SITE_URL}/${item.image}` } : {}),
    })),
    back_urls: {
```
por:
```js
  const { items, shipping } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];
  const missingFields = REQUIRED_SHIPPING_FIELDS.filter(f => !shipping || !String(shipping[f] || '').trim());
  if (missingFields.length) {
    return res.status(400).json({ error: `Faltan datos de envío: ${missingFields.join(', ')}` });
  }

  const preference = {
    items: items.map(item => ({
      id: item.id,
      title: `${item.name} — ${item.colorway} — Talle ${item.size} EU`,
      quantity: item.qty || 1,
      unit_price: Number(item.price),
      currency_id: 'ARS',
      ...(item.image ? { picture_url: `${SITE_URL}/${item.image}` } : {}),
    })),
    metadata: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      dni: shipping.dni,
      provincia: shipping.provincia,
      localidad: shipping.localidad,
      direccion: shipping.direccion,
      codigo_postal: shipping.codigoPostal,
      celular: shipping.celular,
      descripcion: shipping.descripcion || '',
    },
    back_urls: {
```

- [ ] **Step 2: Test manual de la validación (sin pegarle a la API real de MP)**

Crear un script temporal `scratch-test-create-preference.js` en la raíz del repo:
```js
process.env.MP_ACCESS_TOKEN = 'dummy-token-for-validation-test';
const handler = require('./api/create-preference.js');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.setHeader = () => {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.end = () => res;
  return res;
}

async function run() {
  // Caso 1: falta shipping completo -> debe dar 400
  let res = mockRes();
  await handler({ method: 'POST', body: { items: [{ id: '1', name: 'X', colorway: 'Y', size: 40, price: 1000, qty: 1 }] } }, res);
  console.assert(res.statusCode === 400, 'Caso 1 falló, statusCode=' + res.statusCode);
  console.log('Caso 1 (sin shipping):', res.statusCode, res.body);

  // Caso 2: shipping incompleto (falta dni) -> debe dar 400
  res = mockRes();
  await handler({ method: 'POST', body: { items: [{ id: '1', name: 'X', colorway: 'Y', size: 40, price: 1000, qty: 1 }], shipping: { nombre: 'Maxi', apellido: 'G', provincia: 'Córdoba', localidad: 'Córdoba', direccion: 'Calle 1', codigoPostal: '5000', celular: '3511234567' } } }, res);
  console.assert(res.statusCode === 400, 'Caso 2 falló, statusCode=' + res.statusCode);
  console.log('Caso 2 (falta dni):', res.statusCode, res.body);

  console.log('OK: validación de shipping funciona (no se llegó a llamar a la API real de MercadoPago en ningún caso)');
}
run();
```

Run: `node scratch-test-create-preference.js`
Expected:
```
Caso 1 (sin shipping): 400 { error: 'Faltan datos de envío: nombre, apellido, dni, provincia, localidad, direccion, codigoPostal, celular' }
Caso 2 (falta dni): 400 { error: 'Faltan datos de envío: dni' }
OK: validación de shipping funciona (no se llegó a llamar a la API real de MercadoPago en ningún caso)
```

- [ ] **Step 3: Borrar el script temporal**

```bash
rm scratch-test-create-preference.js
```

- [ ] **Step 4: Commit**

```bash
git add api/create-preference.js
git commit -m "feat: create-preference valida y agrega datos de envío como metadata"
```

---

### Task 7: `api/webhook.js` — persistir `shipping` desde `payment.metadata`

**Files:**
- Modify: `api/webhook.js`

**Interfaces:**
- Consumes: `payment.metadata` con claves snake_case (producido por Task 6, ecoado por la API de pagos de MercadoPago).
- Produces: `order.shipping` con claves camelCase (`nombre`, `apellido`, `dni`, `provincia`, `localidad`, `direccion`, `codigoPostal`, `celular`, `descripcion`) o `null` si no vino metadata. Consumido por Task 8 (`admin.js`).

- [ ] **Step 1: Modificar la construcción de `order`**

Reemplazar:
```js
    const order = {
      id: Math.random().toString(36).slice(2, 9),
      mp_payment_id: String(payment.id),
      status: payment.status,
      amount: payment.transaction_amount,
      date: new Date().toISOString(),
      payer_name: `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim(),
      payer_email: payment.payer?.email || '',
      items: (payment.additional_info?.items || []).map(it => ({
        id: it.id,
        title: it.title,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    };
```
por:
```js
    const meta = payment.metadata || {};
    const shipping = meta.nombre ? {
      nombre: meta.nombre,
      apellido: meta.apellido,
      dni: meta.dni,
      provincia: meta.provincia,
      localidad: meta.localidad,
      direccion: meta.direccion,
      codigoPostal: meta.codigo_postal,
      celular: meta.celular,
      descripcion: meta.descripcion || '',
    } : null;

    const order = {
      id: Math.random().toString(36).slice(2, 9),
      mp_payment_id: String(payment.id),
      status: payment.status,
      amount: payment.transaction_amount,
      date: new Date().toISOString(),
      payer_name: `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim(),
      payer_email: payment.payer?.email || '',
      shipping,
      items: (payment.additional_info?.items || []).map(it => ({
        id: it.id,
        title: it.title,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    };
```

- [ ] **Step 2: Test manual de la construcción de `shipping` (sin llamar a GitHub ni a MercadoPago)**

Crear un script temporal `scratch-test-webhook-shipping.js`:
```js
function buildShipping(meta) {
  return meta && meta.nombre ? {
    nombre: meta.nombre,
    apellido: meta.apellido,
    dni: meta.dni,
    provincia: meta.provincia,
    localidad: meta.localidad,
    direccion: meta.direccion,
    codigoPostal: meta.codigo_postal,
    celular: meta.celular,
    descripcion: meta.descripcion || '',
  } : null;
}

const withMeta = buildShipping({
  nombre: 'Maxi', apellido: 'Gargiulo', dni: '30123456', provincia: 'Córdoba',
  localidad: 'Córdoba', direccion: 'Calle 1', codigo_postal: '5000', celular: '3511234567', descripcion: '',
});
console.assert(withMeta.codigoPostal === '5000', 'codigoPostal debería mapear desde codigo_postal');
console.log('Con metadata:', withMeta);

const withoutMeta = buildShipping({});
console.assert(withoutMeta === null, 'debería ser null sin metadata');
console.log('Sin metadata:', withoutMeta);

console.log('OK: mapeo de metadata a shipping funciona');
```

Run: `node scratch-test-webhook-shipping.js`
Expected:
```
Con metadata: {
  nombre: 'Maxi',
  ...
  codigoPostal: '5000',
  ...
}
Sin metadata: null
OK: mapeo de metadata a shipping funciona
```

- [ ] **Step 3: Borrar el script temporal**

```bash
rm scratch-test-webhook-shipping.js
```

- [ ] **Step 4: Commit**

```bash
git add api/webhook.js
git commit -m "feat: el webhook persiste los datos de envío recibidos como metadata"
```

---

### Task 8: Mostrar los datos de envío en el panel admin

**Files:**
- Modify: `admin.js` (función `OrdersSection`, alrededor de la línea 1220-1237)
- Modify: `admin.css` (agregar clase después de la línea 810)
- Modify: `admin.html:34` (bump cache-busting)

**Interfaces:**
- Consumes: `o.shipping` (Task 7), con claves `nombre`, `apellido`, `dni`, `provincia`, `localidad`, `direccion`, `codigoPostal`, `celular`, `descripcion`.

- [ ] **Step 1: Agregar el bloque de envío en `admin.js`**

Reemplazar:
```jsx
              <div key={o.id} className="adm-order-row">
                <span className={`adm-status adm-status--${st.cls}`}>{st.label}</span>
                <div className="adm-order-row__info">
                  <div className="adm-order-row__name">{o.payer_name || o.payer_email || '—'}</div>
                  {o.payer_email && <div className="adm-order-row__email">{o.payer_email}</div>}
                  <div className="adm-order-row__items">
                    {(o.items || []).map((it, i) => <span key={i}>{it.title}{i < o.items.length - 1 ? ' / ' : ''}</span>)}
                  </div>
                </div>
                <div className="adm-order-row__meta">
```
por:
```jsx
              <div key={o.id} className="adm-order-row">
                <span className={`adm-status adm-status--${st.cls}`}>{st.label}</span>
                <div className="adm-order-row__info">
                  <div className="adm-order-row__name">{o.payer_name || o.payer_email || '—'}</div>
                  {o.payer_email && <div className="adm-order-row__email">{o.payer_email}</div>}
                  <div className="adm-order-row__items">
                    {(o.items || []).map((it, i) => <span key={i}>{it.title}{i < o.items.length - 1 ? ' / ' : ''}</span>)}
                  </div>
                  {o.shipping && (
                    <div className="adm-order-row__shipping">
                      <div>{o.shipping.nombre} {o.shipping.apellido} · DNI {o.shipping.dni}</div>
                      <div>{o.shipping.direccion}, {o.shipping.localidad}, {o.shipping.provincia} (CP {o.shipping.codigoPostal})</div>
                      <div>Cel: {o.shipping.celular}</div>
                      {o.shipping.descripcion && <div>Nota: {o.shipping.descripcion}</div>}
                    </div>
                  )}
                </div>
                <div className="adm-order-row__meta">
```

- [ ] **Step 2: Agregar el estilo en `admin.css`**

Después de la línea:
```css
.adm-order-row__items { font-size: 12px; color: var(--a-fg3); margin-top: 2px; }
```
agregar:
```css
.adm-order-row__shipping { font-size: 11px; color: var(--a-fg3); margin-top: 6px; line-height: 1.6; }
```

- [ ] **Step 3: Verificar balance de llaves en `admin.js`**

Run: `node -e "const s=require('fs').readFileSync('admin.js','utf8'); const open=(s.match(/{/g)||[]).length; const close=(s.match(/}/g)||[]).length; console.log(open, close); if(open!==close) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 4: Bumpear cache-busting en `admin.html`**

Cambiar:
```html
  <script type="text/babel" src="admin.js?v=17"></script>
```
por:
```html
  <script type="text/babel" src="admin.js?v=18"></script>
```

- [ ] **Step 5: Commit**

```bash
git add admin.js admin.css admin.html
git commit -m "feat: mostrar datos de envío en el panel admin de órdenes"
```

---

### Task 9: Verificación end-to-end manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Levantar el sitio localmente**

Run: `npx --yes serve -l 5510 .`

- [ ] **Step 2: Recorrer el flujo en el navegador**

1. Abrir `http://localhost:5510`, agregar un producto al carrito.
2. Abrir el carrito: verificar que aparece el botón **"IR A PAGAR"**, el cartel **"🚚 Envío gratis"** y el logo de MercadoPago bajo "OPCIONES DE PAGO".
3. Click en "IR A PAGAR": debe navegar a `#/checkout` y mostrar el formulario (Instancia 2), sin errores en la consola del navegador.
4. Intentar click en "SIGUIENTE" con el formulario vacío: deben aparecer los mensajes de error debajo de cada campo y **no** avanzar de paso.
5. Completar todos los campos requeridos y click en "SIGUIENTE": debe pasar al paso de confirmación (Instancia 3), mostrando el resumen de envío, el cartel de envío gratis, el logo de MercadoPago y el botón "PAGAR CON MERCADOPAGO".
6. Click en "Editar": debe volver al formulario conservando los valores ya cargados.
7. (No hace falta completar el pago real de MercadoPago para esta verificación — alcanza con confirmar que el click en "PAGAR CON MERCADOPAGO" dispara el `fetch` a `/api/create-preference`, visible en la pestaña Network del navegador, aunque falle por no haber `MP_ACCESS_TOKEN` en el entorno local.)

- [ ] **Step 3: Confirmar que no quedan scripts temporales en el repo**

Run: `git status --porcelain`
Expected: no debe listar `scratch-test-*.js` (deberían haber sido borrados en los Tasks 6 y 7).

- [ ] **Step 4: Parar el servidor local**

Detener el proceso de `serve` (Ctrl+C o `kill` del PID correspondiente).
