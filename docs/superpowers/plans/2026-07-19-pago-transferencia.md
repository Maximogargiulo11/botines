# Pago por transferencia con 10% de descuento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar transferencia bancaria como segunda forma de pago, con 10% de descuento, confirmación híbrida (matching automático por monto exacto + botón manual en el admin), y mail de confirmación al cliente vía Resend.

**Architecture:** Se extiende el checkout existente (`screens/CheckoutScreen.jsx`) con un segundo camino de pago que no pasa por MercadoPago: un nuevo endpoint (`api/create-transfer-order.js`) crea el pedido directo en Vercel Blob con `status: "pendiente"`. La confirmación llega por dos vías posibles: (a) el webhook de MercadoPago existente (`api/webhook.js`), extendido para intentar matchear pagos sin metadata propia contra pedidos pendientes por monto exacto, o (b) un botón "Confirmar pago" en el panel admin que llama a un nuevo endpoint protegido (`api/confirm-order.js`). Ambos caminos de confirmación terminan enviando el mismo mail vía un helper compartido (`api/_email.js`).

**Tech Stack:** Mismo stack del resto del sitio (React 18 UMD + Babel Standalone, sin build step; Vercel Functions en Node con `@vercel/blob` ya instalado). Se agrega `resend` como nueva dependencia npm (solo usada server-side, en las Functions — no afecta el "no build step" del frontend).

## Global Constraints

- No hay build step en el frontend; cache-busting manual (`?v=N` en `index.html`/`admin.html`, bumpear al tocar cada archivo).
- No existe framework de testing; verificación manual con scripts Node ad-hoc (que se borran después de usarlos) + navegador.
- El precio de cada producto y el total de cada pedido se calculan siempre server-side desde `api/_products.js` (`getTrustedPrice(id)`) — nunca se confía en un precio o monto que mande el navegador.
- Campos de envío requeridos (camelCase, mismos en frontend y backend): `nombre`, `apellido`, `email` (nuevo), `dni`, `provincia`, `localidad`, `direccion`, `codigoPostal`, `celular`. `descripcion` es opcional.
- Alias: `botinesaltagamacba`. CBU: `0000003100097898780738`. Mail para comprobantes: `botinesaltagamacordoba@gmail.com`. Usar estos valores exactos en la UI.
- Descuento por transferencia: 10% sobre el subtotal (precios reales del catálogo × cantidad), redondeado al peso más cercano (`Math.round`).
- Estados de pedido por transferencia: `"pendiente"` y `"approved"` (en español, para no confundir con los estados propios de MercadoPago que ya usan inglés — `pending`, `approved`, `rejected`, `cancelled` — y significan algo distinto).
- Matching automático: solo contra pedidos con `payment_method: "transferencia"` y `status: "pendiente"` creados en las últimas 72 horas, por `amount` exactamente igual. Si hay 0 o más de 1 candidato, no se confirma nada automáticamente (se loguea con `console.log`, sin UI nueva para eso).
- El número de WhatsApp (`5493516836569`) y el flujo de MercadoPago existente no cambian.
- Los pedidos siguen viviendo en Vercel Blob (`orders/<id>.json`, `access: "private"`), mismo mecanismo que ya existe.

---

### Task 1: Agregar el campo `email` al formulario de checkout

**Files:**
- Modify: `screens/CheckoutScreen.jsx`

**Interfaces:**
- Produces: `form.email` (string) disponible en el estado de `CheckoutScreen`, incluido en el `shipping` que se manda a `/api/create-preference` y (en tasks futuras) a `/api/create-transfer-order`.

- [ ] **Step 1: Agregar `email` al estado inicial del formulario**

En `screens/CheckoutScreen.jsx`, reemplazar:
```jsx
  const [form, setForm] = useState_checkout({
    nombre: '', apellido: '', dni: '', provincia: '', localidad: '',
    direccion: '', codigoPostal: '', celular: '', descripcion: '',
  });
```
por:
```jsx
  const [form, setForm] = useState_checkout({
    nombre: '', apellido: '', email: '', dni: '', provincia: '', localidad: '',
    direccion: '', codigoPostal: '', celular: '', descripcion: '',
  });
```

- [ ] **Step 2: Validar el email en `validateShipping`**

Reemplazar:
```js
function validateShipping(form) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Ingresá tu nombre.';
  if (!form.apellido.trim()) errors.apellido = 'Ingresá tu apellido.';
  if (!/^\d{7,8}$/.test(form.dni.trim())) errors.dni = 'DNI inválido (7 u 8 dígitos, sin puntos).';
```
por:
```js
function validateShipping(form) {
  const errors = {};
  if (!form.nombre.trim()) errors.nombre = 'Ingresá tu nombre.';
  if (!form.apellido.trim()) errors.apellido = 'Ingresá tu apellido.';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Email inválido.';
  if (!/^\d{7,8}$/.test(form.dni.trim())) errors.dni = 'DNI inválido (7 u 8 dígitos, sin puntos).';
```

- [ ] **Step 3: Agregar el campo al formulario (paso `form`)**

Reemplazar:
```jsx
              <div className="bag-checkout__row">
                <CheckoutField label="Nombre" error={errors.nombre}>
                  <input value={form.nombre} onChange={e => updateField('nombre', e.target.value)} autoComplete="given-name" />
                </CheckoutField>
                <CheckoutField label="Apellido" error={errors.apellido}>
                  <input value={form.apellido} onChange={e => updateField('apellido', e.target.value)} autoComplete="family-name" />
                </CheckoutField>
              </div>
              <CheckoutField label="DNI" error={errors.dni}>
```
por:
```jsx
              <div className="bag-checkout__row">
                <CheckoutField label="Nombre" error={errors.nombre}>
                  <input value={form.nombre} onChange={e => updateField('nombre', e.target.value)} autoComplete="given-name" />
                </CheckoutField>
                <CheckoutField label="Apellido" error={errors.apellido}>
                  <input value={form.apellido} onChange={e => updateField('apellido', e.target.value)} autoComplete="family-name" />
                </CheckoutField>
              </div>
              <CheckoutField label="Email" error={errors.email}>
                <input value={form.email} onChange={e => updateField('email', e.target.value)} type="email" placeholder="tu@email.com" autoComplete="email" />
              </CheckoutField>
              <CheckoutField label="DNI" error={errors.dni}>
```

- [ ] **Step 4: Mostrar el email en el resumen del paso `confirm`**

Reemplazar:
```jsx
              <dl className="bag-checkout__summary-list">
                <div><dt>Nombre</dt><dd>{form.nombre} {form.apellido}</dd></div>
                <div><dt>DNI</dt><dd>{form.dni}</dd></div>
```
por:
```jsx
              <dl className="bag-checkout__summary-list">
                <div><dt>Nombre</dt><dd>{form.nombre} {form.apellido}</dd></div>
                <div><dt>Email</dt><dd>{form.email}</dd></div>
                <div><dt>DNI</dt><dd>{form.dni}</dd></div>
```

- [ ] **Step 5: Verificar sintácticamente (chequeo de balance de llaves)**

Run: `node -e "const s=require('fs').readFileSync('screens/CheckoutScreen.jsx','utf8'); const o=(s.match(/{/g)||[]).length; const c=(s.match(/}/g)||[]).length; console.log(o,c); if(o!==c) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 6: Commit**

```bash
git add screens/CheckoutScreen.jsx
git commit -m "feat: agregar campo email al formulario de checkout"
```

---

### Task 2: Agregar `email` al flujo de MercadoPago (metadata + reconstrucción en webhook)

**Files:**
- Modify: `api/create-preference.js`
- Modify: `api/webhook.js`

**Interfaces:**
- Consumes: `form.email` de Task 1, ya presente en `shipping` que manda `CheckoutScreen.jsx`.
- Produces: `order.shipping.email` disponible en los pedidos guardados por el flujo de MercadoPago (mismo patrón que los demás campos de `shipping`).

- [ ] **Step 1: Agregar `email` a los campos requeridos y a la metadata en `api/create-preference.js`**

Reemplazar:
```js
  const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];
```
por:
```js
  const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'email', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];
```

Reemplazar:
```js
    metadata: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      dni: shipping.dni,
```
por:
```js
    metadata: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      email: shipping.email,
      dni: shipping.dni,
```

- [ ] **Step 2: Agregar `email` a la reconstrucción de `shipping` en `api/webhook.js`**

Reemplazar:
```js
    const shipping = meta.nombre ? {
      nombre: meta.nombre,
      apellido: meta.apellido,
      dni: meta.dni,
```
por:
```js
    const shipping = meta.nombre ? {
      nombre: meta.nombre,
      apellido: meta.apellido,
      email: meta.email,
      dni: meta.dni,
```

- [ ] **Step 3: Test manual de la validación (sin llamar a la API real de MercadoPago)**

Crear `scratch-test-email-field.js` en la raíz del repo:
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
  // Falta email -> debe rechazar con 400 mencionando 'email'
  const res = mockRes();
  await handler({ method: 'POST', body: {
    items: [{ id: 'merc-002', name: 'X', colorway: 'Y', size: 40, price: 1, qty: 1 }],
    shipping: { nombre: 'Maxi', apellido: 'G', dni: '30123456', provincia: 'Córdoba', localidad: 'Córdoba', direccion: 'Calle 1', codigoPostal: '5000', celular: '3511234567' },
  } }, res);
  console.log('Caso (sin email):', res.statusCode, res.body);
  console.assert(res.statusCode === 400 && res.body.error.includes('email'), 'FALLÓ: debería rechazar por falta de email');
  console.log('OK: email es requerido en create-preference');
}
run();
```

Run: `node scratch-test-email-field.js`
Expected:
```
Caso (sin email): 400 { error: 'Faltan datos de envío: email' }
OK: email es requerido en create-preference
```

- [ ] **Step 4: Borrar el script temporal**

```bash
rm scratch-test-email-field.js
```

- [ ] **Step 5: Commit**

```bash
git add api/create-preference.js api/webhook.js
git commit -m "feat: agregar email al flujo de datos de envío de MercadoPago"
```

---

### Task 3: Instalar `resend` y crear el helper de envío de mails

**Files:**
- Modify: `package.json`, `package-lock.json` (generados por `npm install`)
- Create: `api/_email.js`

**Interfaces:**
- Produces: `sendConfirmationEmail(order)` (async function, exportada desde `api/_email.js`), consumida por Task 5 (`api/webhook.js`) y Task 6 (`api/confirm-order.js`).
  - `order` es el objeto de pedido tal como se guarda en Blob: `{ id, payment_method, status, amount, date, payer_name, payer_email, shipping: { nombre, apellido, email, dni, provincia, localidad, direccion, codigoPostal, celular, descripcion }, items: [{ id, title, quantity, unit_price }] }`.
  - La función no lanza excepción si falla el envío (loguea el error con `console.error` y retorna) — el estado del pedido es la fuente de verdad, no el mail (ver Global Constraints del spec).

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install resend --save`
Expected: el comando termina sin errores; `package.json` gana `"resend"` en `dependencies` y `package-lock.json` se actualiza.

- [ ] **Step 2: Crear `api/_email.js`**

```js
const { Resend } = require('resend');

async function sendConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY no configurado, no se pudo enviar el mail de confirmación para', order.id);
    return;
  }
  if (!order.shipping || !order.shipping.email) {
    console.error('Pedido sin email, no se pudo enviar el mail de confirmación:', order.id);
    return;
  }

  const fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR');
  const itemsHtml = (order.items || [])
    .map(it => `<li>${it.title} x${it.quantity} — ${fmt(it.unit_price * it.quantity)}</li>`)
    .join('');

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Botines Alta Gama CBA <pedidos@botinesaltagamacba.com>',
      to: order.shipping.email,
      subject: '¡Tu compra fue confirmada! — Botines Alta Gama CBA',
      html: `
        <h1>¡Gracias por tu compra, ${order.shipping.nombre}!</h1>
        <p>Confirmamos tu pedido:</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total: ${fmt(order.amount)}</strong></p>
        <p>Te lo enviamos a: ${order.shipping.direccion}, ${order.shipping.localidad}, ${order.shipping.provincia} (CP ${order.shipping.codigoPostal})</p>
        <p>Cualquier consulta, escribinos por WhatsApp: <a href="https://wa.me/5493516836569">+54 9 351 683-6569</a></p>
      `,
    });
  } catch (err) {
    console.error('email send error:', err.message);
  }
}

module.exports = { sendConfirmationEmail };
```

- [ ] **Step 3: Test manual (sin RESEND_API_KEY configurado, no debe lanzar)**

Crear `scratch-test-email-helper.js`:
```js
delete process.env.RESEND_API_KEY;
const { sendConfirmationEmail } = require('./api/_email.js');

async function run() {
  // Sin RESEND_API_KEY: debe resolver sin lanzar excepción.
  await sendConfirmationEmail({
    id: 'transfer-test1',
    shipping: { nombre: 'Maxi', email: 'test@example.com', direccion: 'Calle 1', localidad: 'Córdoba', provincia: 'Córdoba', codigoPostal: '5000' },
    amount: 1000,
    items: [{ title: 'Producto X', quantity: 1, unit_price: 1000 }],
  });
  console.log('OK: sendConfirmationEmail no lanzó excepción sin RESEND_API_KEY configurado');

  // Sin shipping.email: tampoco debe lanzar.
  await sendConfirmationEmail({ id: 'transfer-test2', shipping: null, amount: 1000, items: [] });
  console.log('OK: sendConfirmationEmail no lanzó excepción sin shipping.email');
}
run();
```

Run: `node scratch-test-email-helper.js`
Expected:
```
OK: sendConfirmationEmail no lanzó excepción sin RESEND_API_KEY configurado
OK: sendConfirmationEmail no lanzó excepción sin shipping.email
```

- [ ] **Step 4: Borrar el script temporal**

```bash
rm scratch-test-email-helper.js
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json api/_email.js
git commit -m "feat: agregar helper de envío de mails de confirmación vía Resend"
```

---

### Task 4: Crear `api/create-transfer-order.js`

**Files:**
- Create: `api/create-transfer-order.js`

**Interfaces:**
- Consumes: `getTrustedPrice(id)` de `api/_products.js` (ya existe). Body esperado: `{ items, shipping }` (mismo shape que `api/create-preference.js`, incluyendo `shipping.email` de Task 1/2).
- Produces: endpoint `POST /api/create-transfer-order`, respuesta `{ ok: true, orderId }` en éxito. Crea un blob privado en `orders/<orderId>.json` con `payment_method: "transferencia"`, `status: "pendiente"`. Consumido por Task 8 (`CheckoutScreen.jsx`) y leído después por Task 5 (matching) y Task 6 (confirmación manual).

- [ ] **Step 1: Crear el archivo**

```js
const { put } = require('@vercel/blob');
const { getTrustedPrice } = require('./_products');

const REQUIRED_SHIPPING_FIELDS = ['nombre', 'apellido', 'email', 'dni', 'provincia', 'localidad', 'direccion', 'codigoPostal', 'celular'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items, shipping } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const missingFields = REQUIRED_SHIPPING_FIELDS.filter(f => !shipping || !String(shipping[f] || '').trim());
  if (missingFields.length) {
    return res.status(400).json({ error: `Faltan datos de envío: ${missingFields.join(', ')}` });
  }

  const unknownItems = [];
  const orderItems = items.map(item => {
    const trustedPrice = getTrustedPrice(item.id);
    if (trustedPrice === undefined) {
      unknownItems.push(item.id);
      return null;
    }
    const qty = Math.max(1, Math.min(20, Math.floor(Number(item.qty)) || 1));
    return {
      id: item.id,
      title: `${item.name} — ${item.colorway} — Talle ${item.size} EU`,
      quantity: qty,
      unit_price: trustedPrice,
    };
  });

  if (unknownItems.length) {
    return res.status(400).json({ error: `Producto no encontrado en el catálogo: ${unknownItems.join(', ')}` });
  }

  const subtotal = orderItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const amount = Math.round(subtotal * 0.9);

  const orderId = `transfer-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const order = {
    id: orderId,
    payment_method: 'transferencia',
    status: 'pendiente',
    amount,
    date: new Date().toISOString(),
    payer_name: `${shipping.nombre} ${shipping.apellido}`.trim(),
    payer_email: shipping.email,
    shipping: {
      nombre: shipping.nombre,
      apellido: shipping.apellido,
      email: shipping.email,
      dni: shipping.dni,
      provincia: shipping.provincia,
      localidad: shipping.localidad,
      direccion: shipping.direccion,
      codigoPostal: shipping.codigoPostal,
      celular: shipping.celular,
      descripcion: shipping.descripcion || '',
    },
    items: orderItems,
  };

  try {
    await put(`orders/${orderId}.json`, JSON.stringify(order, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });
    return res.status(200).json({ ok: true, orderId });
  } catch (err) {
    console.error('create-transfer-order error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

- [ ] **Step 2: Test manual del cálculo de descuento y validaciones (sin llamar a Vercel Blob real)**

Crear `scratch-test-transfer-order.js`:
```js
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === '@vercel/blob') {
    return { put: async (path, body) => { global.__lastPut = { path, body: JSON.parse(body) }; } };
  }
  return originalRequire.apply(this, arguments);
};

const handler = require('./api/create-transfer-order.js');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

const shipping = { nombre: 'Maxi', apellido: 'G', email: 'maxi@example.com', dni: '30123456', provincia: 'Córdoba', localidad: 'Córdoba', direccion: 'Calle 1', codigoPostal: '5000', celular: '3511234567' };

async function run() {
  // Caso 1: producto real (merc-002, precio real 599999) -> total con 10% off = 539999
  let res = mockRes();
  await handler({ method: 'POST', body: { items: [{ id: 'merc-002', name: 'X', colorway: 'Y', size: 43, price: 1, qty: 1 }], shipping } }, res);
  console.log('Caso 1 (10% off sobre precio real):', res.statusCode, res.body, 'amount guardado:', global.__lastPut.body.amount);
  console.assert(res.statusCode === 200, 'FALLÓ: debería devolver 200');
  console.assert(global.__lastPut.body.amount === Math.round(599999 * 0.9), 'FALLÓ: el descuento no se calculó sobre el precio real');
  console.assert(global.__lastPut.body.status === 'pendiente', 'FALLÓ: el pedido debería quedar pendiente');
  console.assert(global.__lastPut.body.payment_method === 'transferencia', 'FALLÓ: payment_method incorrecto');

  // Caso 2: falta email -> 400
  res = mockRes();
  await handler({ method: 'POST', body: { items: [{ id: 'merc-002', name: 'X', colorway: 'Y', size: 43, price: 1, qty: 1 }], shipping: { ...shipping, email: '' } } }, res);
  console.log('Caso 2 (sin email):', res.statusCode, res.body);
  console.assert(res.statusCode === 400, 'FALLÓ: debería rechazar sin email');

  console.log('OK: create-transfer-order calcula el descuento sobre el precio real y valida los campos requeridos');
}
run();
```

Run: `node scratch-test-transfer-order.js`
Expected: ambos `console.assert` pasan sin imprimir "FALLÓ", termina con `OK: create-transfer-order calcula el descuento sobre el precio real y valida los campos requeridos`.

- [ ] **Step 3: Borrar el script temporal**

```bash
rm scratch-test-transfer-order.js
```

- [ ] **Step 4: Commit**

```bash
git add api/create-transfer-order.js
git commit -m "feat: crear endpoint para pedidos por transferencia"
```

---

### Task 5: Matching automático de transferencias en `api/webhook.js`

**Files:**
- Modify: `api/webhook.js`

**Interfaces:**
- Consumes: `sendConfirmationEmail` de `api/_email.js` (Task 3), pedidos con `payment_method: "transferencia"` / `status: "pendiente"` creados por Task 4.
- Produces: cuando un pago sin metadata propia (no viene de `create-preference.js`) coincide por monto exacto con exactamente un pedido pendiente creado en las últimas 72hs, ese pedido pasa a `status: "approved"`, gana `mp_payment_id`, y se le manda el mail de confirmación.

- [ ] **Step 1: Ampliar el import de `@vercel/blob` y agregar el import de `_email`**

Reemplazar:
```js
const { put } = require('@vercel/blob');
const crypto = require('crypto');
```
por:
```js
const { put, list, get } = require('@vercel/blob');
const crypto = require('crypto');
const { sendConfirmationEmail } = require('./_email');
```

- [ ] **Step 2: Ramificar el flujo cuando no hay metadata propia**

Reemplazar:
```js
    await saveOrder(order);
    if (payment.status === 'approved') {
      await trackGA4Purchase(order);
    }
  } catch (err) {
    console.error('webhook error:', err.message);
  }
```
por:
```js
    if (shipping) {
      await saveOrder(order);
      if (payment.status === 'approved') {
        await trackGA4Purchase(order);
      }
    } else if (payment.status === 'approved') {
      await tryAutoMatchTransfer(payment);
    }
  } catch (err) {
    console.error('webhook error:', err.message);
  }
```

- [ ] **Step 3: Agregar la función de matching**

Agregar después de la función `saveOrder` (al final del archivo):
```js

async function tryAutoMatchTransfer(payment) {
  const amount = payment.transaction_amount;
  if (!amount) return;

  const cutoffMs = Date.now() - 72 * 60 * 60 * 1000;
  const { blobs } = await list({ prefix: 'orders/transfer-' });

  const candidates = [];
  for (const b of blobs) {
    const result = await get(b.pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) continue;
    const text = await new Response(result.stream).text();
    let order;
    try { order = JSON.parse(text); } catch { continue; }
    if (order.status !== 'pendiente') continue;
    if (new Date(order.date).getTime() < cutoffMs) continue;
    if (order.amount !== amount) continue;
    candidates.push({ pathname: b.pathname, order });
  }

  if (candidates.length !== 1) {
    console.log(`webhook: transferencia de $${amount} sin match único (${candidates.length} candidato(s) pendiente(s))`);
    return;
  }

  const { pathname, order } = candidates[0];
  order.status = 'approved';
  order.mp_payment_id = String(payment.id);
  await put(pathname, JSON.stringify(order, null, 2), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
  await sendConfirmationEmail(order);
}
```

- [ ] **Step 4: Test manual de la lógica de matching (sin Vercel Blob real ni Resend real)**

Crear `scratch-test-auto-match.js`:
```js
const Module = require('module');
const originalRequire = Module.prototype.require;

const fakeOrders = {
  'orders/transfer-aaa.json': { id: 'transfer-aaa', payment_method: 'transferencia', status: 'pendiente', amount: 45000, date: new Date().toISOString(), shipping: { email: 'a@example.com', nombre: 'A' }, items: [] },
  'orders/transfer-bbb.json': { id: 'transfer-bbb', payment_method: 'transferencia', status: 'pendiente', amount: 45000, date: new Date().toISOString(), shipping: { email: 'b@example.com', nombre: 'B' }, items: [] },
  'orders/transfer-ccc.json': { id: 'transfer-ccc', payment_method: 'transferencia', status: 'pendiente', amount: 99000, date: new Date().toISOString(), shipping: { email: 'c@example.com', nombre: 'C' }, items: [] },
};
let putCalls = [];

function makeStream(text) {
  return new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
}

Module.prototype.require = function (id) {
  if (id === '@vercel/blob') {
    return {
      put: async (path, body) => { putCalls.push({ path, body: JSON.parse(body) }); },
      list: async () => ({ blobs: Object.keys(fakeOrders).map(pathname => ({ pathname })) }),
      get: async (pathname) => {
        if (!fakeOrders[pathname]) return null;
        return { statusCode: 200, stream: makeStream(JSON.stringify(fakeOrders[pathname])) };
      },
    };
  }
  if (id === './_email') {
    return { sendConfirmationEmail: async (order) => { global.__emailedOrder = order; } };
  }
  return originalRequire.apply(this, arguments);
};

delete require.cache[require.resolve('./api/webhook.js')];
const handler = require('./api/webhook.js');

function mockRes() {
  const res = { statusCode: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.end = () => res;
  return res;
}

const realFetch = global.fetch;

async function run() {
  // Caso 1: monto único (99000) -> matchea orders/transfer-ccc.json
  putCalls = [];
  global.__emailedOrder = null;
  global.fetch = async (url) => {
    if (String(url).includes('mercadopago.com')) {
      return { ok: true, json: async () => ({ id: 'mp-999', status: 'approved', transaction_amount: 99000, metadata: {}, payer: {}, additional_info: {} }) };
    }
    return realFetch(url);
  };
  await handler({ method: 'POST', body: { type: 'payment', data: { id: 'mp-999' } }, headers: {}, query: {} }, mockRes());
  console.log('Caso 1 (monto único 99000):', putCalls.length, 'put(s), pedido emailado:', global.__emailedOrder && global.__emailedOrder.id);
  console.assert(putCalls.length === 1 && putCalls[0].path === 'orders/transfer-ccc.json', 'FALLÓ: debería confirmar transfer-ccc');
  console.assert(putCalls[0].body.status === 'approved', 'FALLÓ: debería quedar approved');
  console.assert(global.__emailedOrder && global.__emailedOrder.id === 'transfer-ccc', 'FALLÓ: debería mandar mail para transfer-ccc');

  // Caso 2: monto ambiguo (45000, dos candidatos) -> no confirma nada
  putCalls = [];
  global.__emailedOrder = null;
  global.fetch = async (url) => {
    if (String(url).includes('mercadopago.com')) {
      return { ok: true, json: async () => ({ id: 'mp-888', status: 'approved', transaction_amount: 45000, metadata: {}, payer: {}, additional_info: {} }) };
    }
    return realFetch(url);
  };
  await handler({ method: 'POST', body: { type: 'payment', data: { id: 'mp-888' } }, headers: {}, query: {} }, mockRes());
  console.log('Caso 2 (monto ambiguo 45000):', putCalls.length, 'put(s)');
  console.assert(putCalls.length === 0, 'FALLÓ: no debería confirmar nada con monto ambiguo');
  console.assert(global.__emailedOrder === null, 'FALLÓ: no debería mandar mail con monto ambiguo');

  global.fetch = realFetch;
  console.log('OK: matching automático confirma solo con match único y no confirma nada con ambigüedad');
}
run();
```

Run: `node scratch-test-auto-match.js`
Expected: ambos casos pasan sin "FALLÓ", termina con `OK: matching automático confirma solo con match único y no confirma nada con ambigüedad`.

- [ ] **Step 5: Borrar el script temporal**

```bash
rm scratch-test-auto-match.js
```

- [ ] **Step 6: Commit**

```bash
git add api/webhook.js
git commit -m "feat: matching automático de transferencias por monto en el webhook"
```

---

### Task 6: Crear `api/confirm-order.js` (confirmación manual desde el admin)

**Files:**
- Create: `api/confirm-order.js`

**Interfaces:**
- Consumes: `sendConfirmationEmail` de `api/_email.js` (Task 3). Header `X-Admin-Secret` (mismo mecanismo que `api/orders.js`). Body: `{ orderId }`.
- Produces: endpoint `POST /api/confirm-order`, `{ ok: true }` en éxito. Marca `orders/<orderId>.json` como `status: "approved"` y dispara el mail. Consumido por Task 10 (botón en `admin.js`).

- [ ] **Step 1: Crear el archivo**

```js
const { get, put } = require('@vercel/blob');
const { sendConfirmationEmail } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const secret = process.env.ADMIN_API_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Falta orderId' });

  const pathname = `orders/${orderId}.json`;

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const text = await new Response(result.stream).text();
    const order = JSON.parse(text);

    if (order.status !== 'pendiente') {
      return res.status(400).json({ error: 'El pedido no está pendiente' });
    }

    order.status = 'approved';
    await put(pathname, JSON.stringify(order, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    await sendConfirmationEmail(order);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('confirm-order error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node -c api/confirm-order.js`
Expected: sin output (éxito silencioso).

- [ ] **Step 3: Test manual de las validaciones (sin Vercel Blob real)**

Crear `scratch-test-confirm-order.js`:
```js
const Module = require('module');
const originalRequire = Module.prototype.require;

const fakeOrders = {
  'orders/transfer-xyz.json': { id: 'transfer-xyz', status: 'pendiente', amount: 1000, shipping: { email: 'x@example.com', nombre: 'X' }, items: [] },
  'orders/transfer-done.json': { id: 'transfer-done', status: 'approved', amount: 1000, shipping: { email: 'y@example.com', nombre: 'Y' }, items: [] },
};
let putCalls = [];

function makeStream(text) {
  return new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
}

Module.prototype.require = function (id) {
  if (id === '@vercel/blob') {
    return {
      put: async (path, body) => { putCalls.push({ path, body: JSON.parse(body) }); },
      get: async (pathname) => {
        if (!fakeOrders[pathname]) return null;
        return { statusCode: 200, stream: makeStream(JSON.stringify(fakeOrders[pathname])) };
      },
    };
  }
  if (id === './_email') {
    return { sendConfirmationEmail: async (order) => { global.__emailedOrder = order; } };
  }
  return originalRequire.apply(this, arguments);
};

const handler = require('./api/confirm-order.js');
process.env.ADMIN_API_SECRET = 'test-secret';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

async function run() {
  // Caso 1: sin header de secreto -> 401
  let res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { orderId: 'transfer-xyz' } }, res);
  console.log('Caso 1 (sin secreto):', res.statusCode, res.body);
  console.assert(res.statusCode === 401, 'FALLÓ: debería rechazar sin secreto');

  // Caso 2: pedido pendiente -> confirma y manda mail
  putCalls = [];
  global.__emailedOrder = null;
  res = mockRes();
  await handler({ method: 'POST', headers: { 'x-admin-secret': 'test-secret' }, body: { orderId: 'transfer-xyz' } }, res);
  console.log('Caso 2 (pedido pendiente):', res.statusCode, res.body, putCalls[0] && putCalls[0].body.status);
  console.assert(res.statusCode === 200, 'FALLÓ: debería confirmar');
  console.assert(putCalls.length === 1 && putCalls[0].body.status === 'approved', 'FALLÓ: no quedó approved');
  console.assert(global.__emailedOrder && global.__emailedOrder.id === 'transfer-xyz', 'FALLÓ: no mandó el mail');

  // Caso 3: pedido ya aprobado -> 400, no reenvía mail
  putCalls = [];
  global.__emailedOrder = null;
  res = mockRes();
  await handler({ method: 'POST', headers: { 'x-admin-secret': 'test-secret' }, body: { orderId: 'transfer-done' } }, res);
  console.log('Caso 3 (ya aprobado):', res.statusCode, res.body);
  console.assert(res.statusCode === 400, 'FALLÓ: debería rechazar un pedido ya aprobado');
  console.assert(putCalls.length === 0 && global.__emailedOrder === null, 'FALLÓ: no debería tocar un pedido ya aprobado');

  console.log('OK: confirm-order valida el secreto, confirma pedidos pendientes y rechaza los ya aprobados');
}
run();
```

Run: `node scratch-test-confirm-order.js`
Expected: los tres casos pasan sin "FALLÓ", termina con `OK: confirm-order valida el secreto, confirma pedidos pendientes y rechaza los ya aprobados`.

- [ ] **Step 4: Borrar el script temporal**

```bash
rm scratch-test-confirm-order.js
```

- [ ] **Step 5: Commit**

```bash
git add api/confirm-order.js
git commit -m "feat: crear endpoint de confirmación manual de pedidos por transferencia"
```

---

### Task 7: Estilos compartidos (cartel de descuento + caja de datos de transferencia)

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Produces clases CSS: `.bag-payopts__row`, `.bag-payopts__discount`, `.bag-transfer-box`, `.bag-transfer-box__row`, `.bag-transfer-box__note`. Consumidas por Task 8 (`CheckoutScreen.jsx`) y Task 9 (`CartDrawer.jsx`).
- Consume: `--bag-success` (ya definida en `colors_and_type.css`).

- [ ] **Step 1: Agregar el bloque CSS**

Agregar en `styles.css`, inmediatamente después del bloque existente `.bag-payopts__logo { ... }` (buscar ese selector — está en la sección `/* ============ SHIPPING BANNER + PAYMENT OPTIONS ... ============ */`):

```css
.bag-payopts__row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.bag-payopts__discount {
  font-size: var(--bag-fs-xs);
  letter-spacing: var(--bag-ls-wide);
  text-transform: uppercase;
  color: var(--bag-success);
}

.bag-transfer-box {
  border: 1px solid var(--bag-line);
  padding: var(--bag-s-5);
  display: flex; flex-direction: column; gap: var(--bag-s-3);
}
.bag-transfer-box__row {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: var(--bag-fs-base);
}
.bag-transfer-box__row span {
  color: var(--bag-fg-muted);
  font-size: var(--bag-fs-xs);
  letter-spacing: var(--bag-ls-wide);
  text-transform: uppercase;
}
.bag-transfer-box__note {
  font-size: var(--bag-fs-sm);
  color: var(--bag-fg-muted);
  line-height: 1.6;
}
```

- [ ] **Step 2: Verificar balance de llaves**

Run: `node -e "const s=require('fs').readFileSync('styles.css','utf8'); const o=(s.match(/{/g)||[]).length; const c=(s.match(/}/g)||[]).length; console.log(o,c); if(o!==c) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: agregar estilos de descuento por transferencia y caja de datos bancarios"
```

---

### Task 8: UI de pago por transferencia en `CheckoutScreen.jsx`

**Files:**
- Modify: `screens/CheckoutScreen.jsx`
- Modify: `index.html` (bump cache-busting)

**Interfaces:**
- Consumes: clases CSS de Task 7, endpoint `POST /api/create-transfer-order` de Task 4, `form` con `email` de Task 1.
- Produces: en el paso `confirm`, un segundo camino de pago junto al de MercadoPago.

- [ ] **Step 1: Agregar estado para el flujo de transferencia**

Reemplazar:
```jsx
  const [errors, setErrors] = useState_checkout({});
  const [loading, setLoading] = useState_checkout(false);
  const [payError, setPayError] = useState_checkout(null);
```
por:
```jsx
  const [errors, setErrors] = useState_checkout({});
  const [loading, setLoading] = useState_checkout(false);
  const [payError, setPayError] = useState_checkout(null);
  const [showTransfer, setShowTransfer] = useState_checkout(false);
  const [transferLoading, setTransferLoading] = useState_checkout(false);
  const [transferError, setTransferError] = useState_checkout(null);
```

- [ ] **Step 2: Agregar el cálculo del total con descuento y el handler de confirmación**

Reemplazar:
```jsx
  const subtotal = cart.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));
```
por:
```jsx
  const subtotal = cart.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
  const transferTotal = Math.round(subtotal * 0.9);
  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleTransferConfirm = async () => {
    setTransferLoading(true);
    setTransferError(null);
    const gaItems = cart.map(it => ({ item_id: it.id, item_name: it.name, item_variant: it.colorway, price: it.price, quantity: it.qty || 1 }));
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'begin_checkout', { currency: 'ARS', value: transferTotal, items: gaItems });
    }
    try {
      sessionStorage.setItem('bag:checkout_snapshot', JSON.stringify({
        transaction_id: Date.now().toString(), value: transferTotal, items: gaItems,
      }));
    } catch {}
    try {
      const res = await fetch('/api/create-transfer-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, shipping: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el pedido');
      navigate('/pago-exitoso');
    } catch (err) {
      setTransferError(err.message);
      setTransferLoading(false);
    }
  };
```

- [ ] **Step 3: Agregar el cartel de descuento junto al logo de MercadoPago (paso `confirm`)**

Reemplazar:
```jsx
              <div className="bag-shipping-banner">🚚 Envío gratis</div>
              <div className="bag-payopts">
                <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
                <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
              </div>

              {payError && <p className="bag-cart__error">{payError}</p>}
              <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handlePay} disabled={loading}>
                {loading ? 'Redirigiendo...' : 'PAGAR CON MERCADOPAGO'}
              </button>
            </div>
          )}
```
por:
```jsx
              <div className="bag-shipping-banner">🚚 Envío gratis</div>
              <div className="bag-payopts">
                <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
                <div className="bag-payopts__row">
                  <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
                  <span className="bag-payopts__discount">-10% pagando por transferencia</span>
                </div>
              </div>

              {payError && <p className="bag-cart__error">{payError}</p>}
              <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handlePay} disabled={loading}>
                {loading ? 'Redirigiendo...' : 'PAGAR CON MERCADOPAGO'}
              </button>

              {!showTransfer ? (
                <button className="bag-btn bag-btn--ghost bag-btn--block" onClick={() => setShowTransfer(true)}>
                  PAGAR POR TRANSFERENCIA (10% OFF)
                </button>
              ) : (
                <div className="bag-transfer-box">
                  <div className="bag-transfer-box__row"><span>Alias</span><strong>botinesaltagamacba</strong></div>
                  <div className="bag-transfer-box__row"><span>CBU</span><strong>0000003100097898780738</strong></div>
                  <div className="bag-transfer-box__row"><span>Monto a transferir</span><strong>{window.formatPrice(transferTotal)}</strong></div>
                  <p className="bag-transfer-box__note">Enviá el comprobante a <strong>botinesaltagamacordoba@gmail.com</strong>.</p>
                  {transferError && <p className="bag-cart__error">{transferError}</p>}
                  <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handleTransferConfirm} disabled={transferLoading}>
                    {transferLoading ? 'Confirmando...' : 'YA TRANSFERÍ — CONFIRMAR PEDIDO'}
                  </button>
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 4: Verificar balance de llaves**

Run: `node -e "const s=require('fs').readFileSync('screens/CheckoutScreen.jsx','utf8'); const o=(s.match(/{/g)||[]).length; const c=(s.match(/}/g)||[]).length; console.log(o,c); if(o!==c) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 5: Bumpear cache-busting**

En `index.html`, reemplazar:
```html
  <script type="text/babel" src="screens/CheckoutScreen.jsx?v=3"></script>
```
por:
```html
  <script type="text/babel" src="screens/CheckoutScreen.jsx?v=4"></script>
```

- [ ] **Step 6: Commit**

```bash
git add screens/CheckoutScreen.jsx index.html
git commit -m "feat: agregar opción de pago por transferencia al checkout"
```

---

### Task 9: Cartel de descuento en el carrito (`CartDrawer.jsx`)

**Files:**
- Modify: `components/CartDrawer.jsx`
- Modify: `index.html` (bump cache-busting)

**Interfaces:**
- Consumes: clases CSS `.bag-payopts__row`, `.bag-payopts__discount` de Task 7.

- [ ] **Step 1: Agregar el cartel junto al logo de MercadoPago**

Reemplazar:
```jsx
            <div className="bag-payopts">
              <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
              <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
            </div>
```
por:
```jsx
            <div className="bag-payopts">
              <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
              <div className="bag-payopts__row">
                <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
                <span className="bag-payopts__discount">-10% pagando por transferencia</span>
              </div>
            </div>
```

- [ ] **Step 2: Verificar balance de llaves**

Run: `node -e "const s=require('fs').readFileSync('components/CartDrawer.jsx','utf8'); const o=(s.match(/{/g)||[]).length; const c=(s.match(/}/g)||[]).length; console.log(o,c); if(o!==c) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 3: Bumpear cache-busting**

En `index.html`, reemplazar:
```html
  <script type="text/babel" src="components/CartDrawer.jsx?v=8"></script>
```
por:
```html
  <script type="text/babel" src="components/CartDrawer.jsx?v=9"></script>
```

- [ ] **Step 4: Commit**

```bash
git add components/CartDrawer.jsx index.html
git commit -m "feat: agregar aviso de 10% off por transferencia en el carrito"
```

---

### Task 10: Botón "Confirmar pago" en el panel admin

**Files:**
- Modify: `admin.js`
- Modify: `admin.html` (bump cache-busting)

**Interfaces:**
- Consumes: `POST /api/confirm-order` de Task 6, `adminSecret` (ya disponible como prop de `OrdersSection`, ver spec `2026-07-08-checkout-envio-design.md`).

- [ ] **Step 1: Agregar estado de confirmación y el handler**

Reemplazar:
```jsx
function OrdersSection({ adminSecret }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const loadOrders = () => {
```
por:
```jsx
function OrdersSection({ adminSecret }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [confirming, setConfirming] = useState(null);

  const confirmOrder = async (orderId) => {
    setConfirming(orderId);
    try {
      const res = await fetch('/api/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al confirmar el pedido');
      loadOrders();
    } catch (e) {
      alert(`Error al confirmar el pedido: ${e.message}`);
    } finally {
      setConfirming(null);
    }
  };

  const loadOrders = () => {
```

- [ ] **Step 2: Agregar el estado `pendiente` al mapa de estados**

Reemplazar:
```jsx
  const STATUS = {
    approved:  { label: 'Pagado',     cls: 'success' },
    pending:   { label: 'Pendiente',  cls: 'warn'    },
    rejected:  { label: 'Rechazado',  cls: 'danger'  },
    cancelled: { label: 'Cancelado',  cls: 'muted'   },
  };
```
por:
```jsx
  const STATUS = {
    approved:  { label: 'Pagado',                        cls: 'success' },
    pending:   { label: 'Pendiente',                      cls: 'warn'    },
    pendiente: { label: 'Pendiente (transferencia)',      cls: 'warn'    },
    rejected:  { label: 'Rechazado',                      cls: 'danger'  },
    cancelled: { label: 'Cancelado',                      cls: 'muted'   },
  };
```

- [ ] **Step 3: Mostrar el método de pago y el botón "Confirmar pago" en cada fila**

Reemplazar:
```jsx
                <div className="adm-order-row__meta">
                  <div className="adm-order-row__amount">{fmt(o.amount)}</div>
                  <div className="adm-order-row__date">{o.date ? new Date(o.date).toLocaleDateString('es-AR') : '—'}</div>
                  <div className="adm-order-row__id">MP #{o.mp_payment_id}</div>
                </div>
              </div>
            );
          })}
```
por:
```jsx
                <div className="adm-order-row__meta">
                  <div className="adm-order-row__amount">{fmt(o.amount)}</div>
                  <div className="adm-order-row__date">{o.date ? new Date(o.date).toLocaleDateString('es-AR') : '—'}</div>
                  <div className="adm-order-row__id">{o.payment_method === 'transferencia' ? 'Transferencia' : `MP #${o.mp_payment_id}`}</div>
                  {o.status === 'pendiente' && (
                    <Btn size="sm" onClick={() => confirmOrder(o.id)} disabled={confirming === o.id}>
                      {confirming === o.id ? 'Confirmando...' : 'Confirmar pago'}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
```

- [ ] **Step 4: Verificar balance de llaves**

Run: `node -e "const s=require('fs').readFileSync('admin.js','utf8'); const o=(s.match(/{/g)||[]).length; const c=(s.match(/}/g)||[]).length; console.log(o,c); if(o!==c) throw new Error('desbalanceado')"`
Expected: dos números iguales, sin error.

- [ ] **Step 5: Bumpear cache-busting**

En `admin.html`, reemplazar:
```html
  <script type="text/babel" src="admin.js?v=19"></script>
```
por:
```html
  <script type="text/babel" src="admin.js?v=20"></script>
```

- [ ] **Step 6: Commit**

```bash
git add admin.js admin.html
git commit -m "feat: agregar confirmación manual de pedidos por transferencia en el admin"
```

---

### Task 11: Verificación end-to-end manual + configuración pendiente en Vercel

**Files:** ninguno (solo verificación y checklist de configuración externa)

- [ ] **Step 1: Confirmar que no quedan scripts temporales**

Run: `git status --porcelain`
Expected: no debe listar `scratch-test-*.js` (se borraron en cada task).

- [ ] **Step 2: Levantar el sitio localmente y recorrer el flujo**

Run: `npx --yes serve -l 5510 .` (o el servidor estático que se prefiera)

En el navegador:
1. Agregar un producto al carrito. Abrir el carrito: confirmar que ahora dice "-10% pagando por transferencia" al lado del logo de MercadoPago.
2. Click en "IR A PAGAR", completar el formulario de envío — confirmar que pide Email y lo valida (probar con un email inválido, debe mostrar error).
3. En el paso "Confirmar y pagar": confirmar que aparece el mismo aviso de descuento, el botón "PAGAR CON MERCADOPAGO" (sin cambios), y debajo el botón "PAGAR POR TRANSFERENCIA (10% OFF)".
4. Click en "PAGAR POR TRANSFERENCIA": debe mostrar el Alias, CBU, el monto con 10% de descuento ya calculado, y el mail para el comprobante.
5. Click en "YA TRANSFERÍ — CONFIRMAR PEDIDO": como el servidor local no tiene `BLOB_READ_WRITE_TOKEN`, va a fallar — alcanza con confirmar en la pestaña Network del navegador que el `fetch` a `/api/create-transfer-order` se disparó con el body correcto (`items`, `shipping` con `email` incluido).

- [ ] **Step 3: Checklist de configuración pendiente en Vercel (no automatizable desde este plan)**

Esto lo tiene que hacer el usuario, no es parte de la implementación de código:
1. Conectar **Resend** vía Vercel Marketplace al proyecto `botinesweb` (inyecta `RESEND_API_KEY`).
2. Verificar el dominio `botinesaltagamacba.com` en Resend (agregar los registros DNS que indique Resend).
3. Una vez desplegado, hacer una compra de prueba real por transferencia y confirmarla manualmente desde el admin para validar que el mail llega.

- [ ] **Step 4: Parar el servidor local**

Detener el proceso de `serve` (Ctrl+C o `kill` del PID correspondiente).
