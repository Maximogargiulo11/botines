# Popup de suscripción con cupón 5% y newsletter — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Sumar un popup que capte email+nombre, entregue (con doble opt-in) un cupón único de 5% de un solo uso aplicable en el checkout, y arme una lista de newsletter administrable desde el panel.

**Architecture:** Todo sobre el stack actual — componentes React UMD (globals en `window`), Vercel Functions (CommonJS) en `api/`, almacenamiento en Vercel Blob privado, mails con Resend. El descuento se valida y aplica **siempre en el servidor**. Sin framework de tests: la lógica de backend se prueba con scripts Node + `assert` mockeando `@vercel/blob` y `resend`; el frontend se valida transpilando con `@babel/standalone` y con verificación manual.

**Tech Stack:** React 18 UMD + Babel Standalone, Vercel Functions (Node ≥18 CommonJS), `@vercel/blob` 2.6.1, `resend`, Node `crypto`.

## Global Constraints

- Cupón: **5%** de descuento (`COUPON_DISCOUNT = 0.05`), **un solo uso**, validez **30 días** (`COUPON_VALID_DAYS = 30`).
- Formato de código: `BAG-XXXXXX` (6 chars del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sin caracteres ambiguos).
- Descuentos **aditivos** sobre el subtotal calculado en el servidor (`getTrustedPrice`):
  - MercadoPago con cupón: `× 0.95`.
  - Transferencia sin cupón: `× 0.90` (ya existe). Con cupón: `× 0.85` (15%).
- El cupón se marca **usado** solo cuando el pedido pasa a `approved` (webhook MP / auto-match / `confirm-order`), nunca al crear la preferencia/pedido.
- Popup: aparece a los **8 s** o al primer scroll, **una vez por visitante**; nunca en `#/checkout` ni en el admin.
- Doble opt-in: no se entrega cupón ni se suma a la lista hasta confirmar el email.
- Blob siempre `access: 'private'`; lectura con `new Response(result.stream).text()`; escritura con `allowOverwrite: true`.
- Endpoints de admin exigen `req.headers['x-admin-secret'] === process.env.ADMIN_API_SECRET` (fail-closed).
- Spec de referencia: `docs/superpowers/specs/2026-08-10-popup-suscripcion-descuento-design.md`.

---

### Task 1: Helper de cupones (`api/_coupons.js`)

**Files:**
- Create: `api/_coupons.js`
- Test: `tests/coupons.test.js`

**Interfaces:**
- Produce: `COUPON_DISCOUNT` (0.05), `generateCouponCode() → "BAG-XXXXXX"`, `createCoupon(email) → coupon`, `getCoupon(code) → coupon|null`, `validateCoupon(code) → {valid, coupon?|reason}`, `markCouponUsed(code) → void`.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/coupons.test.js
const assert = require('assert');
const path = require('path');

// Mock en memoria de @vercel/blob
const store = {};
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (pathname, body) => { store[pathname] = body; return { pathname }; },
  get: async (pathname) => store[pathname] !== undefined
    ? { statusCode: 200, stream: new Response(store[pathname]).body }
    : { statusCode: 404, stream: null },
  list: async () => ({ blobs: [] }),
  del: async () => {},
}};

const C = require('../api/_coupons.js');

(async () => {
  // Formato
  const code = C.generateCouponCode();
  assert.match(code, /^BAG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/, 'formato de código');

  // Crear + validar
  const cp = await C.createCoupon('a@b.com');
  assert.strictEqual(cp.used, false);
  let v = await C.validateCoupon(cp.code);
  assert.strictEqual(v.valid, true, 'cupón nuevo es válido');

  // Case-insensitive y trim
  v = await C.validateCoupon('  ' + cp.code.toLowerCase() + ' ');
  assert.strictEqual(v.valid, true, 'valida con espacios y minúsculas');

  // Marcar usado
  await C.markCouponUsed(cp.code);
  v = await C.validateCoupon(cp.code);
  assert.strictEqual(v.valid, false, 'usado no es válido');
  assert.strictEqual(v.reason, 'Cupón ya usado');

  // Inexistente
  v = await C.validateCoupon('BAG-ZZZZZZ');
  assert.strictEqual(v.valid, false);
  assert.strictEqual(v.reason, 'Cupón inexistente');

  console.log('OK coupons');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node tests/coupons.test.js`
Expected: FAIL con `Cannot find module '../api/_coupons.js'`.

- [ ] **Step 3: Implementar `api/_coupons.js`**

```js
const { put, get } = require('@vercel/blob');

const COUPON_DISCOUNT = 0.05;      // 5%
const COUPON_VALID_DAYS = 30;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1

function generateCouponCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `BAG-${s}`;
}

async function getCoupon(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const result = await get(`coupons/${clean}.json`, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  try { return JSON.parse(await new Response(result.stream).text()); } catch { return null; }
}

async function createCoupon(email) {
  const now = Date.now();
  const coupon = {
    code: generateCouponCode(),
    email: String(email).trim().toLowerCase(),
    used: false,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
  await put(`coupons/${coupon.code}.json`, JSON.stringify(coupon, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
  return coupon;
}

async function validateCoupon(code) {
  const coupon = await getCoupon(code);
  if (!coupon) return { valid: false, reason: 'Cupón inexistente' };
  if (coupon.used) return { valid: false, reason: 'Cupón ya usado' };
  if (new Date(coupon.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'Cupón vencido' };
  return { valid: true, coupon };
}

async function markCouponUsed(code) {
  const coupon = await getCoupon(code);
  if (!coupon || coupon.used) return;
  coupon.used = true;
  coupon.usedAt = new Date().toISOString();
  await put(`coupons/${coupon.code}.json`, JSON.stringify(coupon, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

module.exports = { COUPON_DISCOUNT, generateCouponCode, createCoupon, getCoupon, validateCoupon, markCouponUsed };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node tests/coupons.test.js`
Expected: `OK coupons`.

- [ ] **Step 5: Commit**

```bash
git add api/_coupons.js tests/coupons.test.js
git commit -m "feat: helper de cupones (crear/validar/marcar usado)"
```

---

### Task 2: Helper de suscriptos (`api/_subscribers.js`)

**Files:**
- Create: `api/_subscribers.js`
- Test: `tests/subscribers.test.js`

**Interfaces:**
- Produce: `emailKey(email) → base64url`, `getSubscriber(email)`, `getSubscriberByKey(key)`, `saveSubscriber(sub)`, `saveToken(token, key)`, `getKeyByToken(token)`, `deleteToken(token)`, `listSubscribers() → [sub]`.
- Consume: nada de tareas previas.

- [ ] **Step 1: Escribir el test que falla**

```js
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
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/subscribers.test.js`
Expected: FAIL con `Cannot find module '../api/_subscribers.js'`.

- [ ] **Step 3: Implementar `api/_subscribers.js`**

```js
const { put, get, list, del } = require('@vercel/blob');

function emailKey(email) {
  return Buffer.from(String(email).trim().toLowerCase()).toString('base64url');
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  try { return JSON.parse(await new Response(result.stream).text()); } catch { return null; }
}

async function getSubscriberByKey(key) { return readJson(`subscribers/${key}.json`); }
async function getSubscriber(email) { return getSubscriberByKey(emailKey(email)); }

async function saveSubscriber(sub) {
  await put(`subscribers/${emailKey(sub.email)}.json`, JSON.stringify(sub, null, 2), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

async function saveToken(token, key) {
  await put(`subtokens/${token}.json`, JSON.stringify({ key }), {
    access: 'private', contentType: 'application/json', allowOverwrite: true,
  });
}

async function getKeyByToken(token) {
  const clean = String(token || '').trim();
  if (!clean) return null;
  const data = await readJson(`subtokens/${clean}.json`);
  return data ? data.key : null;
}

async function deleteToken(token) {
  try { await del(`subtokens/${String(token).trim()}.json`); } catch {}
}

async function listSubscribers() {
  const { blobs } = await list({ prefix: 'subscribers/' });
  const subs = await Promise.all(blobs.map(b => readJson(b.pathname)));
  return subs.filter(Boolean);
}

module.exports = { emailKey, getSubscriber, getSubscriberByKey, saveSubscriber, saveToken, getKeyByToken, deleteToken, listSubscribers };
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node tests/subscribers.test.js`
Expected: `OK subscribers`.

- [ ] **Step 5: Commit**

```bash
git add api/_subscribers.js tests/subscribers.test.js
git commit -m "feat: helper de suscriptos (blob + tokens de confirmación)"
```

---

### Task 3: Plantillas de mail (`api/_email.js`)

**Files:**
- Modify: `api/_email.js` (agregar dos funciones y exportarlas; NO tocar `sendConfirmationEmail`)
- Test: `tests/email-subscribe.test.js`

**Interfaces:**
- Produce: `sendConfirmSubscription(email, name, token) → {sent, reason?}`, `sendCouponEmail(email, name, code, expiresAt) → {sent, reason?}`.
- Consume: patrón `esc`, chequeo de `RESEND_API_KEY`, y el `from` ya existentes en el archivo.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/email-subscribe.test.js
const assert = require('assert');
const path = require('path');
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
let sent = [];
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: function () { this.emails = { send: async (o) => { sent.push(o); return { error: null }; } }; },
}};
process.env.RESEND_API_KEY = 'test';
process.env.SITE_URL = 'https://ejemplo.test';

const E = require('../api/_email.js');

(async () => {
  await E.sendConfirmSubscription('a@b.com', '<Ana>', 'TOK1');
  let m = sent.pop();
  assert.strictEqual(m.to, 'a@b.com');
  assert.ok(m.html.includes('https://ejemplo.test/api/confirm-subscription?token=TOK1'), 'link de confirmación');
  assert.ok(m.html.includes('&lt;Ana&gt;'), 'nombre escapado');

  await E.sendCouponEmail('a@b.com', 'Ana', 'BAG-ABC123', '2026-09-09T00:00:00.000Z');
  m = sent.pop();
  assert.ok(m.html.includes('BAG-ABC123'), 'incluye el código');
  assert.ok(m.html.includes('5%'), 'menciona 5%');
  console.log('OK email-subscribe');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/email-subscribe.test.js`
Expected: FAIL con `E.sendConfirmSubscription is not a function`.

- [ ] **Step 3: Implementar (agregar al final de `api/_email.js`, antes del `module.exports`, y ampliar el export)**

Agregar estas dos funciones (reusan `esc` que ya existe en el archivo):

```js
const SITE_URL = process.env.SITE_URL || 'https://botinesweb.vercel.app';

async function sendConfirmSubscription(email, name, token) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY no configurado (confirm subscription)'); return { sent: false, reason: 'Resend no configurado' }; }
  const link = `${SITE_URL}/api/confirm-subscription?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px;">
      <p>¡Hola, ${esc(name)}!</p>
      <p>Gracias por sumarte a <strong>Botines Alta Gama Córdoba</strong>.</p>
      <p>Confirmá tu email para recibir tu <strong>cupón de 5% de descuento</strong> y enterarte de los nuevos lanzamientos:</p>
      <p><a href="${link}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Confirmar mi email</a></p>
      <p style="font-size:13px;color:#6b7280;">Si no fuiste vos, ignorá este mail.</p>
    </div>`;
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(apiKey).emails.send({
      from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
      to: email, subject: 'Confirmá tu email — Botines Alta Gama Córdoba', html,
    });
    if (error) { console.error('confirm sub email error:', error.message || error); return { sent: false, reason: error.message || 'error' }; }
    return { sent: true };
  } catch (err) { console.error('confirm sub email error:', err.message); return { sent: false, reason: err.message }; }
}

async function sendCouponEmail(email, name, code, expiresAt) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY no configurado (coupon email)'); return { sent: false, reason: 'Resend no configurado' }; }
  const vence = new Date(expiresAt).toLocaleDateString('es-AR');
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px;">
      <p>¡Listo, ${esc(name)}! Tu email quedó confirmado.</p>
      <p>Este es tu cupón de <strong>5% de descuento</strong> en tu compra:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px;background:#f3f4f6;padding:14px 18px;border-radius:8px;display:inline-block;">${esc(code)}</p>
      <p>Ingresalo en el checkout, en el campo <strong>"Código de descuento"</strong>. Es de un solo uso y vence el <strong>${esc(vence)}</strong>.</p>
      <p>💡 Pagando por <strong>transferencia</strong> el descuento se suma al 10% habitual: <strong>15% off en total</strong>.</p>
      <p>Cualquier consulta, escribinos por Instagram: <a href="https://ig.me/m/botinesaltagamacba">@botinesaltagamacba</a></p>
    </div>`;
  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(apiKey).emails.send({
      from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
      to: email, subject: 'Tu cupón de 5% — Botines Alta Gama Córdoba', html,
    });
    if (error) { console.error('coupon email error:', error.message || error); return { sent: false, reason: error.message || 'error' }; }
    return { sent: true };
  } catch (err) { console.error('coupon email error:', err.message); return { sent: false, reason: err.message }; }
}
```

Y cambiar el export final del archivo a:

```js
module.exports = { sendConfirmationEmail, sendConfirmSubscription, sendCouponEmail };
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node tests/email-subscribe.test.js`
Expected: `OK email-subscribe`.

- [ ] **Step 5: Commit**

```bash
git add api/_email.js tests/email-subscribe.test.js
git commit -m "feat: mails de confirmación de suscripción y de cupón"
```

---

### Task 4: Endpoint de suscripción (`api/subscribe.js`)

**Files:**
- Create: `api/subscribe.js`
- Test: `tests/subscribe.test.js`

**Interfaces:**
- Consume: `_subscribers` (Task 2), `_email.sendConfirmSubscription` (Task 3).
- Produce: `POST /api/subscribe` con body `{ email, name, website? }`.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/subscribe.test.js
const assert = require('assert');
const path = require('path');

// Mock de los helpers para aislar la lógica del endpoint
const subsPath = require.resolve('../api/_subscribers.js');
const state = { saved: null, tokenSaved: null, existing: null };
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  emailKey: (e) => 'K:' + e.trim().toLowerCase(),
  getSubscriber: async () => state.existing,
  saveSubscriber: async (s) => { state.saved = s; },
  saveToken: async (t, k) => { state.tokenSaved = { t, k }; },
}};
const emailPath = require.resolve('../api/_email.js');
let mailSentTo = null;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
  sendConfirmSubscription: async (email) => { mailSentTo = email; return { sent: true }; },
}};

const handler = require('../api/subscribe.js');

function mockRes() { return { code: 200, body: null, status(c){ this.code=c; return this; }, json(b){ this.body=b; return this; } }; }

(async () => {
  // Honeypot lleno → no hace nada
  let res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana', website: 'bot' } }, res);
  assert.strictEqual(state.saved, null, 'honeypot corta');

  // Email inválido
  res = mockRes();
  await handler({ method: 'POST', body: { email: 'nope', name: 'Ana' } }, res);
  assert.strictEqual(res.code, 400);

  // Alta OK
  state.saved = null; mailSentTo = null; state.existing = null;
  res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(state.saved.status, 'pending');
  assert.strictEqual(mailSentTo, 'a@b.com');
  assert.ok(state.tokenSaved.t.length > 10, 'token generado');

  // Ya confirmado → no reenvía
  state.saved = null; mailSentTo = null; state.existing = { status: 'confirmed', email: 'a@b.com' };
  res = mockRes();
  await handler({ method: 'POST', body: { email: 'a@b.com', name: 'Ana' } }, res);
  assert.strictEqual(mailSentTo, null, 'no reenvía a confirmado');

  console.log('OK subscribe');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/subscribe.test.js`
Expected: FAIL con `Cannot find module '../api/subscribe.js'`.

- [ ] **Step 3: Implementar `api/subscribe.js`**

```js
const crypto = require('crypto');
const { getSubscriber, saveSubscriber, saveToken, emailKey } = require('./_subscribers');
const { sendConfirmSubscription } = require('./_email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { email, name, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot: bot

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return res.status(400).json({ error: 'Email inválido' });
  if (!cleanName) return res.status(400).json({ error: 'Falta el nombre' });

  try {
    const existing = await getSubscriber(cleanEmail);
    if (existing && existing.status === 'confirmed') return res.status(200).json({ ok: true, already: true });
    if (existing && existing.status === 'pending' && existing.lastSentAt &&
        (Date.now() - new Date(existing.lastSentAt).getTime()) < 10 * 60 * 1000) {
      return res.status(200).json({ ok: true }); // throttle anti-spam
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    await saveSubscriber({
      email: cleanEmail, name: cleanName, status: 'pending', confirmToken: token,
      subscribedAt: (existing && existing.subscribedAt) || now, lastSentAt: now,
      confirmedAt: null, couponCode: null, couponExpiresAt: null, couponUsed: false,
    });
    await saveToken(token, emailKey(cleanEmail));
    await sendConfirmSubscription(cleanEmail, cleanName, token);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node tests/subscribe.test.js`
Expected: `OK subscribe`.

- [ ] **Step 5: Commit**

```bash
git add api/subscribe.js tests/subscribe.test.js
git commit -m "feat: endpoint POST /api/subscribe (honeypot + throttle + doble opt-in)"
```

---

### Task 5: Endpoint de confirmación (`api/confirm-subscription.js`)

**Files:**
- Create: `api/confirm-subscription.js`
- Test: `tests/confirm-subscription.test.js`

**Interfaces:**
- Consume: `_subscribers` (Task 2), `_coupons.createCoupon` (Task 1), `_email.sendCouponEmail` (Task 3).
- Produce: `GET /api/confirm-subscription?token=…` → 302 a `#/suscripcion-confirmada` o `#/suscripcion-error`.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/confirm-subscription.test.js
const assert = require('assert');
process.env.SITE_URL = 'https://ejemplo.test';

const subsPath = require.resolve('../api/_subscribers.js');
const state = { sub: { email: 'a@b.com', name: 'Ana', status: 'pending' }, saved: null, tokenDeleted: false };
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  getKeyByToken: async (t) => t === 'good' ? 'K1' : null,
  getSubscriberByKey: async () => state.sub,
  saveSubscriber: async (s) => { state.saved = s; },
  deleteToken: async () => { state.tokenDeleted = true; },
}};
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  createCoupon: async (email) => ({ code: 'BAG-ABC123', email, expiresAt: '2026-09-09T00:00:00.000Z' }),
}};
const emailPath = require.resolve('../api/_email.js');
let couponMailedCode = null;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
  sendCouponEmail: async (email, name, code) => { couponMailedCode = code; return { sent: true }; },
}};

const handler = require('../api/confirm-subscription.js');
function mockRes() { return { headers: null, ended: false, writeHead(c, h){ this.code=c; this.headers=h; return this; }, end(){ this.ended=true; } }; }

(async () => {
  // Token inválido → error
  let res = mockRes();
  await handler({ query: { token: 'bad' } }, res);
  assert.ok(res.headers.Location.endsWith('/#/suscripcion-error'), 'token malo → error');

  // Token bueno → confirma, cupón, mail, redirect ok
  res = mockRes();
  await handler({ query: { token: 'good' } }, res);
  assert.strictEqual(state.saved.status, 'confirmed');
  assert.strictEqual(state.saved.couponCode, 'BAG-ABC123');
  assert.strictEqual(couponMailedCode, 'BAG-ABC123');
  assert.strictEqual(state.tokenDeleted, true);
  assert.ok(res.headers.Location.endsWith('/#/suscripcion-confirmada'));
  console.log('OK confirm-subscription');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/confirm-subscription.test.js`
Expected: FAIL con `Cannot find module '../api/confirm-subscription.js'`.

- [ ] **Step 3: Implementar `api/confirm-subscription.js`**

```js
const { getSubscriberByKey, saveSubscriber, getKeyByToken, deleteToken } = require('./_subscribers');
const { createCoupon } = require('./_coupons');
const { sendCouponEmail } = require('./_email');

const SITE_URL = process.env.SITE_URL || 'https://botinesweb.vercel.app';

module.exports = async function handler(req, res) {
  const token = req.query && req.query.token;
  const redirect = (path) => { res.writeHead(302, { Location: `${SITE_URL}/#/${path}` }); res.end(); };
  try {
    const key = await getKeyByToken(token);
    if (!key) return redirect('suscripcion-error');
    const sub = await getSubscriberByKey(key);
    if (!sub) return redirect('suscripcion-error');

    if (sub.status !== 'confirmed') {
      const coupon = await createCoupon(sub.email);
      sub.status = 'confirmed';
      sub.confirmedAt = new Date().toISOString();
      sub.couponCode = coupon.code;
      sub.couponExpiresAt = coupon.expiresAt;
      sub.confirmToken = null;
      await saveSubscriber(sub);
      await deleteToken(token);
      await sendCouponEmail(sub.email, sub.name, coupon.code, coupon.expiresAt);
    }
    return redirect('suscripcion-confirmada');
  } catch (err) {
    console.error('confirm-subscription error:', err);
    return redirect('suscripcion-error');
  }
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node tests/confirm-subscription.test.js`
Expected: `OK confirm-subscription`.

- [ ] **Step 5: Commit**

```bash
git add api/confirm-subscription.js tests/confirm-subscription.test.js
git commit -m "feat: endpoint GET /api/confirm-subscription (confirma + genera cupón)"
```

---

### Task 6: Aplicar el cupón en el checkout (4 endpoints)

**Files:**
- Modify: `api/create-preference.js` (aplicar `×0.95` y meter `coupon` en metadata)
- Modify: `api/create-transfer-order.js` (aplicar `×0.85` y guardar `coupon` en el pedido)
- Modify: `api/webhook.js` (marcar cupón usado al aprobar MP y en auto-match)
- Modify: `api/confirm-order.js` (marcar cupón usado al confirmar transferencia)
- Test: `tests/checkout-coupon.test.js`

**Interfaces:**
- Consume: `_coupons.validateCoupon`, `_coupons.markCouponUsed`, `_coupons.COUPON_DISCOUNT` (Task 1).

- [ ] **Step 1: Escribir el test que falla** (verifica el cálculo del monto de transferencia con y sin cupón, que es la única aritmética nueva encapsulable)

```js
// tests/checkout-coupon.test.js
const assert = require('assert');
const path = require('path');

// Mock catálogo: getTrustedPrice
const prodPath = require.resolve('../api/_products.js');
require.cache[prodPath] = { id: prodPath, filename: prodPath, loaded: true, exports: {
  getTrustedPrice: (id) => (id === 'p1' ? 100000 : undefined),
}};
// Mock cupones
const coupPath = require.resolve('../api/_coupons.js');
require.cache[coupPath] = { id: coupPath, filename: coupPath, loaded: true, exports: {
  COUPON_DISCOUNT: 0.05,
  validateCoupon: async (c) => c === 'BAG-OK' ? { valid: true, coupon: { code: 'BAG-OK' } } : { valid: false, reason: 'x' },
  markCouponUsed: async () => {},
}};
// Mock blob (para el put del pedido)
const blobPath = require.resolve('@vercel/blob', { paths: [path.join(__dirname, '..')] });
let putBody = null;
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  put: async (p, body) => { putBody = JSON.parse(body); return { pathname: p }; },
}};

const handler = require('../api/create-transfer-order.js');
function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }
const shipping = { nombre:'A', apellido:'B', email:'a@b.com', dni:'1', provincia:'X', localidad:'Y', direccion:'Z', codigoPostal:'1', celular:'1' };

(async () => {
  // Sin cupón → 10% off (90.000)
  let res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping } }, res);
  assert.strictEqual(putBody.amount, 90000, 'transferencia sin cupón = 90.000');
  assert.strictEqual(putBody.coupon || null, null);

  // Con cupón válido → 15% off (85.000) y guarda el cupón
  res = mockRes();
  await handler({ method:'POST', body:{ items:[{ id:'p1', name:'N', colorway:'C', size:'42', qty:1 }], shipping, coupon:'BAG-OK' } }, res);
  assert.strictEqual(putBody.amount, 85000, 'transferencia con cupón = 85.000');
  assert.strictEqual(putBody.coupon, 'BAG-OK', 'guarda el cupón en el pedido');
  console.log('OK checkout-coupon');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/checkout-coupon.test.js`
Expected: FAIL (el pedido guardado no tiene `coupon` y el monto es 90.000 en ambos casos).

- [ ] **Step 3a: Modificar `api/create-transfer-order.js`**

Agregar el require arriba:

```js
const { validateCoupon } = require('./_coupons');
```

Leer `coupon` del body (junto a `items, shipping`):

```js
const { items, shipping, coupon } = req.body || {};
```

Reemplazar el cálculo del monto. Buscar:

```js
  const subtotal = orderItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const amount = Math.round(subtotal * 0.9);
```

por:

```js
  const subtotal = orderItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  let couponCode = null;
  let mult = 0.9; // transferencia: 10% off
  if (coupon) {
    const v = await validateCoupon(coupon);
    if (v.valid) { couponCode = v.coupon.code; mult = 0.85; } // + 5% cupón = 15%
  }
  const amount = Math.round(subtotal * mult);
```

Y en el objeto `order` (donde se arma), agregar el campo `coupon`:

```js
    payment_method: 'transferencia',
    status: 'pendiente',
    coupon: couponCode,
    amount,
```

- [ ] **Step 3b: Modificar `api/create-preference.js`**

Agregar el require:

```js
const { validateCoupon } = require('./_coupons');
```

Leer `coupon`:

```js
const { items, shipping, coupon } = req.body || {};
```

Antes de armar `preferenceItems`, resolver el cupón:

```js
  let couponCode = null;
  let mult = 1;
  if (coupon) {
    const v = await validateCoupon(coupon);
    if (v.valid) { couponCode = v.coupon.code; mult = 0.95; } // 5% off
  }
```

En el `.map` de `preferenceItems`, cambiar `unit_price: trustedPrice` por:

```js
      unit_price: Math.round(trustedPrice * mult),
```

Y en el objeto `metadata` agregar:

```js
      coupon: couponCode || '',
```

- [ ] **Step 3c: Modificar `api/webhook.js`**

Agregar el require:

```js
const { markCouponUsed } = require('./_coupons');
```

En el objeto `shipping` reconstruido desde `meta`, ya se leen campos con `meta.*`; agregar la lectura del cupón junto al armado del `order` (después de crear `order`), y marcar usado en la rama de pago aprobado con metadata. En el bloque:

```js
    if (shipping) {
      await saveOrder(order);
      if (payment.status === 'approved') {
        await trackGA4Purchase(order);
      }
    } else if (payment.status === 'approved') {
      await tryAutoMatchTransfer(payment);
    }
```

cambiarlo por:

```js
    if (shipping) {
      await saveOrder(order);
      if (payment.status === 'approved') {
        await trackGA4Purchase(order);
        if (meta.coupon) await markCouponUsed(meta.coupon);
      }
    } else if (payment.status === 'approved') {
      await tryAutoMatchTransfer(payment);
    }
```

Y dentro de `tryAutoMatchTransfer`, después de setear `order.status = 'approved'` y re-guardar el pedido, agregar:

```js
  if (order.coupon) await markCouponUsed(order.coupon);
```

(justo antes o después de `await sendConfirmationEmail(order);`).

- [ ] **Step 3d: Modificar `api/confirm-order.js`**

Agregar el require:

```js
const { markCouponUsed } = require('./_coupons');
```

Después de `order.status = 'approved';` y el `put` que re-guarda el pedido, y antes/después de `sendConfirmationEmail`, agregar:

```js
    if (order.coupon) await markCouponUsed(order.coupon);
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node tests/checkout-coupon.test.js`
Expected: `OK checkout-coupon`.

Además, chequear sintaxis de los 4 archivos:

Run: `node -c api/create-preference.js && node -c api/create-transfer-order.js && node -c api/webhook.js && node -c api/confirm-order.js && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add api/create-preference.js api/create-transfer-order.js api/webhook.js api/confirm-order.js tests/checkout-coupon.test.js
git commit -m "feat: aplicar cupón 5% en checkout (MP 0.95 / transferencia 0.85) y consumir al aprobar"
```

---

### Task 7: Endpoints de admin (`api/subscribers.js`, `api/send-newsletter.js`)

**Files:**
- Create: `api/subscribers.js`
- Create: `api/send-newsletter.js`
- Test: `tests/admin-newsletter.test.js`

**Interfaces:**
- Consume: `_subscribers.listSubscribers` (Task 2), `resend`.
- Produce: `GET /api/subscribers` (admin), `POST /api/send-newsletter` (admin) con `{subject, bodyHtml, imageUrl?, linkUrl?}`.

- [ ] **Step 1: Escribir el test que falla**

```js
// tests/admin-newsletter.test.js
const assert = require('assert');
const path = require('path');
process.env.ADMIN_API_SECRET = 'sec';

const subsPath = require.resolve('../api/_subscribers.js');
require.cache[subsPath] = { id: subsPath, filename: subsPath, loaded: true, exports: {
  listSubscribers: async () => ([
    { email: 'a@b.com', name: 'Ana', status: 'confirmed' },
    { email: 'c@d.com', name: 'Caro', status: 'pending' },
  ]),
}};
const resendPath = require.resolve('resend', { paths: [path.join(__dirname, '..')] });
let sentTo = [];
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: {
  Resend: function () { this.emails = { send: async (o) => { sentTo.push(o.to); return { error: null }; } }; },
}};
process.env.RESEND_API_KEY = 'test';

function mockRes(){ return { code:200, body:null, status(c){this.code=c;return this;}, json(b){this.body=b;return this;} }; }

(async () => {
  const list = require('../api/subscribers.js');
  // Sin secreto → 401
  let res = mockRes();
  await list({ method:'GET', headers:{} }, res);
  assert.strictEqual(res.code, 401);
  // Con secreto → lista
  res = mockRes();
  await list({ method:'GET', headers:{ 'x-admin-secret':'sec' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.body.length, 2);

  const send = require('../api/send-newsletter.js');
  res = mockRes();
  await send({ method:'POST', headers:{ 'x-admin-secret':'sec' }, body:{ subject:'Nuevo', bodyHtml:'<p>hola</p>' } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.body.sent, 1, 'solo manda a confirmados');
  assert.deepStrictEqual(sentTo, ['a@b.com']);
  console.log('OK admin-newsletter');
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node tests/admin-newsletter.test.js`
Expected: FAIL con `Cannot find module '../api/subscribers.js'`.

- [ ] **Step 3a: Implementar `api/subscribers.js`**

```js
const { listSubscribers } = require('./_subscribers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'No autorizado' });
  try {
    const subs = await listSubscribers();
    subs.sort((a, b) => new Date(b.subscribedAt || 0) - new Date(a.subscribedAt || 0));
    return res.status(200).json(subs);
  } catch (err) {
    console.error('subscribers error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Step 3b: Implementar `api/send-newsletter.js`**

```js
const { listSubscribers } = require('./_subscribers');

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'No autorizado' });

  const { subject, bodyHtml, imageUrl, linkUrl } = req.body || {};
  if (!subject || !bodyHtml) return res.status(400).json({ error: 'Faltan asunto o contenido' });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Resend no configurado (falta RESEND_API_KEY)' });

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111827; line-height:1.6; font-size:15px; max-width:600px;">
      ${imageUrl ? `<img src="${esc(imageUrl)}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px;" />` : ''}
      <div>${bodyHtml}</div>
      ${linkUrl ? `<p style="margin-top:20px;"><a href="${esc(linkUrl)}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Ver más</a></p>` : ''}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Recibís este mail porque te suscribiste en Botines Alta Gama Córdoba.</p>
    </div>`;

  try {
    const { Resend } = require('resend');
    const resend = new Resend(apiKey);
    const recipients = (await listSubscribers()).filter(s => s.status === 'confirmed');
    let sent = 0, failed = 0;
    for (const s of recipients) {
      const { error } = await resend.emails.send({
        from: 'Botines Alta Gama Córdoba <pedidos@botinesaltagamacba.com>',
        to: s.email, subject, html,
      });
      if (error) { failed++; console.error('newsletter send error a', s.email, error.message || error); }
      else sent++;
    }
    return res.status(200).json({ sent, failed, total: recipients.length });
  } catch (err) {
    console.error('send-newsletter error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node tests/admin-newsletter.test.js`
Expected: `OK admin-newsletter`.

- [ ] **Step 5: Commit**

```bash
git add api/subscribers.js api/send-newsletter.js tests/admin-newsletter.test.js
git commit -m "feat: endpoints admin de suscriptos (listar) y newsletter (enviar)"
```

---

### Task 8: Componente del popup (`components/SubscribePopup.jsx`) + estilos + montaje

**Files:**
- Create: `components/SubscribePopup.jsx`
- Modify: `styles.css` (estilos del popup) + bump en `index.html`
- Modify: `index.html` (agregar `<script>` del componente + bump)
- Modify: `app.jsx` (montar `<SubscribePopup>` cuando corresponda + bump)

**Interfaces:**
- Consume: `window.formatPrice` no aplica; usa `React` global. `POST /api/subscribe`.
- Produce: `window.SubscribePopup`.

- [ ] **Step 1: Crear `components/SubscribePopup.jsx`**

```jsx
/* global React */
const { useState: useState_sub, useEffect: useEffect_sub } = React;

const SUB_DONE_KEY = 'bag:sub:done';
const SUB_DISMISS_KEY = 'bag:sub:dismissedUntil';

function SubscribePopup({ route }) {
  const [visible, setVisible] = useState_sub(false);
  const [status, setStatus] = useState_sub('form'); // form | sending | sent
  const [email, setEmail] = useState_sub('');
  const [name, setName] = useState_sub('');
  const [website, setWebsite] = useState_sub(''); // honeypot
  const [error, setError] = useState_sub(null);

  const onCheckout = (route || '').indexOf('checkout') === 0;

  useEffect_sub(() => {
    if (onCheckout) return;
    if (localStorage.getItem(SUB_DONE_KEY)) return;
    const until = Number(localStorage.getItem(SUB_DISMISS_KEY) || 0);
    if (until && Date.now() < until) return;

    let shown = false;
    const show = () => { if (!shown) { shown = true; setVisible(true); } };
    const timer = setTimeout(show, 8000);
    const onScroll = () => { if (window.scrollY > 400) show(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, [onCheckout]);

  const close = () => {
    setVisible(false);
    // no volver a mostrar por 30 días si lo cerró sin suscribirse
    localStorage.setItem(SUB_DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Ingresá un email válido.'); return; }
    if (!name.trim()) { setError('Ingresá tu nombre.'); return; }
    setStatus('sending');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), website }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      localStorage.setItem(SUB_DONE_KEY, '1');
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'No se pudo suscribir. Probá de nuevo.');
      setStatus('form');
    }
  };

  if (!visible) return null;

  return (
    <div className="bag-sub-backdrop" onClick={close}>
      <div className="bag-sub" onClick={(e) => e.stopPropagation()}>
        <button className="bag-sub__close" onClick={close} aria-label="Cerrar">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
        </button>
        {status === 'sent' ? (
          <div className="bag-sub__body">
            <div className="bag-sub__eyebrow">¡Casi listo!</div>
            <h2 className="bag-sub__title">Revisá tu email</h2>
            <p className="bag-sub__text">Te mandamos un correo para confirmar tu email. Al confirmarlo recibís tu <strong>cupón de 5%</strong>.</p>
            <button className="bag-btn bag-btn--primary bag-btn--block" onClick={close}>Listo</button>
          </div>
        ) : (
          <div className="bag-sub__body">
            <div className="bag-sub__eyebrow">Ofertas y novedades</div>
            <h2 className="bag-sub__title">5% de descuento en tu compra</h2>
            <p className="bag-sub__text">Suscribite y recibí un cupón de 5%. Pagando por transferencia se suma al 10% → <strong>15% off</strong>.</p>
            <form onSubmit={submit}>
              <input className="bag-sub__input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="bag-sub__input" type="text" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="bag-sub__hp" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
              {error && <div className="bag-sub__error">{error}</div>}
              <button className="bag-btn bag-btn--primary bag-btn--block" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando…' : 'Suscribirme'}
              </button>
            </form>
            <p className="bag-sub__note">Recibirás un correo para validar tu email.</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SubscribePopup });
```

- [ ] **Step 2: Agregar estilos en `styles.css`** (al final del archivo)

```css
/* ============ POPUP DE SUSCRIPCIÓN ============ */
.bag-sub-backdrop {
  position: fixed; inset: 0; z-index: 320;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: bag-fadein-modal 220ms var(--bag-ease);
}
.bag-sub {
  position: relative; background: var(--bag-bg-elev); border: 1px solid var(--bag-line);
  max-width: 420px; width: 100%; padding: 40px 32px 28px;
}
.bag-sub__close {
  position: absolute; top: 12px; right: 12px; background: transparent; border: 0;
  color: var(--bag-fg-muted); cursor: pointer; padding: 6px;
}
.bag-sub__close:hover { color: var(--bag-fg); }
.bag-sub__body { text-align: center; }
.bag-sub__eyebrow { font-size: var(--bag-fs-xs); letter-spacing: var(--bag-ls-wide); text-transform: uppercase; color: var(--bag-accent); margin-bottom: 8px; }
.bag-sub__title { font-size: var(--bag-fs-xl); margin: 0 0 10px; }
.bag-sub__text { font-size: var(--bag-fs-sm); color: var(--bag-fg-muted); line-height: 1.6; margin: 0 0 20px; }
.bag-sub__input {
  width: 100%; background: var(--bag-bg); border: 1px solid var(--bag-line);
  color: var(--bag-fg); padding: 12px 14px; margin-bottom: 10px; font-size: var(--bag-fs-base);
}
.bag-sub__input:focus { outline: none; border-color: var(--bag-accent); }
.bag-sub__hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.bag-sub__error { color: var(--bag-danger, #ff4455); font-size: var(--bag-fs-sm); margin-bottom: 10px; }
.bag-sub__note { font-size: var(--bag-fs-xs); color: var(--bag-fg-faint); margin-top: 12px; }
```

- [ ] **Step 3: Registrar el script y el montaje**

En `index.html`, dentro de `<!-- Components -->` (después de `AutoplayVideo.jsx`):

```html
  <script type="text/babel" src="components/SubscribePopup.jsx?v=1"></script>
```

En `app.jsx`, dentro del render principal (donde se monta `<CartDrawer>` / el layout global), montar el popup pasándole la ruta actual. Buscar el nivel donde está disponible `route` (el hook `useHashRoute`) y agregar, junto a los demás elementos globales:

```jsx
        <SubscribePopup route={route} />
```

(Si `route` es un string tipo `"marcas/nike"`, pasarlo tal cual; el componente sólo chequea que no empiece con `checkout`.)

Bumps de cache-busting en `index.html`:
- `app.jsx?v=14` → `app.jsx?v=15`
- `styles.css?v=5` → `styles.css?v=6`

- [ ] **Step 4: Verificar transpilación y montaje**

Run:
```bash
node -e 'const B=require("@babel/standalone"),fs=require("fs");for(const f of ["components/SubscribePopup.jsx","app.jsx"]){B.transform(fs.readFileSync(f,"utf8"),{presets:["react"],filename:f});}console.log("JSX OK")'
```
Expected: `JSX OK`.

Verificación manual (server local): `python -m http.server 8099` y abrir `http://localhost:8099/` → a los 8 s aparece el popup; cerrar y recargar → no reaparece (localStorage). En `#/checkout` no aparece.

- [ ] **Step 5: Commit**

```bash
git add components/SubscribePopup.jsx styles.css index.html app.jsx
git commit -m "feat: popup de suscripción (8s/scroll, once por visitante, honeypot)"
```

---

### Task 9: Pantallas de confirmación/error (`app.jsx`)

**Files:**
- Modify: `app.jsx` (agregar rutas `#/suscripcion-confirmada` y `#/suscripcion-error` + bump ya hecho en Task 8; si no, bumpear ahora)

**Interfaces:**
- Consume: el switch de rutas existente (`parts[0] === '...'`) en `app.jsx`.

- [ ] **Step 1: Agregar las rutas**

En el switch de rutas de `app.jsx` (donde están `pago-exitoso`, etc.), agregar:

```jsx
  else if (parts[0] === 'suscripcion-confirmada') screen = <SubscriptionResultScreen ok navigate={navigate} />;
  else if (parts[0] === 'suscripcion-error')      screen = <SubscriptionResultScreen navigate={navigate} />;
```

Y definir el componente en `app.jsx` (cerca de `PaymentResultScreen`):

```jsx
function SubscriptionResultScreen({ ok, navigate }) {
  return (
    <main className="bag-payment-result">
      <div className="bag-payment-result__box">
        <div className="bag-payment-result__icon" style={{ color: ok ? '#22c55e' : '#ff4455' }}>{ok ? '✓' : '✕'}</div>
        <h1 className="bag-payment-result__title">{ok ? '¡Suscripción confirmada!' : 'No pudimos confirmar'}</h1>
        <p className="bag-payment-result__body">
          {ok
            ? 'Te enviamos tu cupón de 5% de descuento por email. Revisá tu bandeja (y spam).'
            : 'El link no es válido o ya expiró. Probá suscribirte de nuevo desde la página.'}
        </p>
        <div className="bag-payment-result__actions">
          <button className="bag-btn bag-btn--primary" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      </div>
    </main>
  );
}
```

Si el bump de `app.jsx` no se hizo en Task 8, bumpear `app.jsx?v=15` → `app.jsx?v=16` en `index.html`.

- [ ] **Step 2: Verificar transpilación**

Run: `node -e 'const B=require("@babel/standalone"),fs=require("fs");B.transform(fs.readFileSync("app.jsx","utf8"),{presets:["react"],filename:"app.jsx"});console.log("JSX OK")'`
Expected: `JSX OK`.

Manual: abrir `http://localhost:8099/#/suscripcion-confirmada` y `#/suscripcion-error` → se ven las dos pantallas.

- [ ] **Step 3: Commit**

```bash
git add app.jsx index.html
git commit -m "feat: pantallas de confirmación/error de suscripción"
```

---

### Task 10: Campo "Código de descuento" en el checkout (`screens/CheckoutScreen.jsx`)

**Files:**
- Modify: `screens/CheckoutScreen.jsx` (input de cupón + enviarlo a los dos handlers + mostrar total con descuento) + bump en `index.html`

**Interfaces:**
- Consume: los handlers existentes `handlePay` (→ `/api/create-preference`) y `handleTransferConfirm` (→ `/api/create-transfer-order`), y `subtotal`/`transferTotal` ya calculados en el componente.

- [ ] **Step 1: Agregar estado y campo del cupón**

En `CheckoutScreen.jsx`, agregar estado (junto a los otros `useState`):

```jsx
  const [coupon, setCoupon] = useState('');
```

(Usar el mismo alias de `useState` que ya usa el archivo.)

En el paso `confirm`, arriba del bloque de botones de pago, agregar el campo:

```jsx
            <div className="bag-coupon">
              <label className="bag-eyebrow bag-eyebrow--muted" htmlFor="bag-coupon-input">Código de descuento (opcional)</label>
              <input
                id="bag-coupon-input"
                className="bag-coupon__input"
                type="text"
                placeholder="BAG-XXXXXX"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              />
            </div>
```

- [ ] **Step 2: Enviar el cupón a los dos handlers**

En `handlePay` (el `fetch` a `/api/create-preference`), agregar `coupon` al body:

```jsx
        body: JSON.stringify({ items: cart, shipping: form, coupon: coupon.trim() || undefined }),
```

En `handleTransferConfirm` (el `fetch` a `/api/create-transfer-order`), agregar `coupon` al body:

```jsx
        body: JSON.stringify({ items: cart, shipping: form, coupon: coupon.trim() || undefined }),
```

- [ ] **Step 3: Estilos del campo (en `styles.css`, al final) y bump**

```css
.bag-coupon { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 14px; }
.bag-coupon__input {
  background: var(--bag-bg); border: 1px solid var(--bag-line); color: var(--bag-fg);
  padding: 10px 12px; font-size: var(--bag-fs-base); letter-spacing: 1px; text-transform: uppercase;
}
.bag-coupon__input:focus { outline: none; border-color: var(--bag-accent); }
```

En `index.html`: `screens/CheckoutScreen.jsx?v=6` → `?v=7`, y bumpear `styles.css` otra vez (`?v=6` → `?v=7`).

> Nota: el descuento real y el aviso de cupón inválido los resuelve el servidor (MercadoPago recalcula el total; en transferencia el monto viene con el 15%). En esta v1 el campo no valida en vivo; si el cupón no sirve, el pago sigue sin el 5% extra. (Validación en vivo = mejora futura.)

- [ ] **Step 4: Verificar transpilación**

Run: `node -e 'const B=require("@babel/standalone"),fs=require("fs");B.transform(fs.readFileSync("screens/CheckoutScreen.jsx","utf8"),{presets:["react"],filename:"CheckoutScreen.jsx"});console.log("JSX OK")'`
Expected: `JSX OK`.

- [ ] **Step 5: Commit**

```bash
git add screens/CheckoutScreen.jsx styles.css index.html
git commit -m "feat: campo de código de descuento en el checkout"
```

---

### Task 11: Sección "Suscriptos" en el admin (`admin.js`)

**Files:**
- Modify: `admin.js` (nueva sección: lista + formulario de envío; agregar item en la nav) + bump en `admin.html`

**Interfaces:**
- Consume: `api/subscribers.js`, `api/send-newsletter.js`, `adminSecret` (ya disponible en el App), `Btn`, `TextInput`, `Textarea`, `notify`.

- [ ] **Step 1: Agregar el componente `SubscribersSection`** (cerca de `OrdersSection` en `admin.js`)

```jsx
function SubscribersSection({ adminSecret, notify }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    fetch('/api/subscribers', { headers: { 'X-Admin-Secret': adminSecret } })
      .then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Falta el secreto de admin en Ajustes' : `HTTP ${r.status}`); return r.json(); })
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { load(); }, [adminSecret]);

  const confirmed = subs.filter(s => s.status === 'confirmed');

  const send = async () => {
    if (!subject.trim() || !body.trim()) { notify('Completá asunto y contenido.', 'error'); return; }
    if (!window.confirm(`¿Enviar este aviso a ${confirmed.length} suscripto(s) confirmado(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ subject: subject.trim(), bodyHtml: body, imageUrl: imageUrl.trim(), linkUrl: linkUrl.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al enviar');
      notify(`Enviado a ${d.sent} suscripto(s)${d.failed ? `, ${d.failed} fallaron` : ''}.`, 'success');
      setSubject(''); setBody(''); setImageUrl(''); setLinkUrl('');
    } catch (e) { notify(`Error: ${e.message}`, 'error'); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div className="adm-section-header">
        <h2>Suscriptos</h2>
        <Btn variant="ghost" size="sm" onClick={load}>↺ Actualizar</Btn>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Enviar aviso de lanzamiento</div>
        <p className="adm-text">Se envía a los {confirmed.length} suscripto(s) confirmado(s).</p>
        <TextInput label="Asunto" value={subject} onChange={setSubject} placeholder="Nuevo lanzamiento 🔥" />
        <Textarea label="Contenido (podés usar HTML simple)" value={body} onChange={setBody} rows={6} placeholder="<p>Ya llegaron los nuevos...</p>" />
        <TextInput label="URL de imagen (opcional)" value={imageUrl} onChange={setImageUrl} placeholder="https://..." />
        <TextInput label="URL del botón (opcional)" value={linkUrl} onChange={setLinkUrl} placeholder="https://botinesweb.vercel.app/#/..." />
        <Btn onClick={send} disabled={sending}>{sending ? 'Enviando...' : 'Enviar a todos'}</Btn>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Lista ({subs.length})</div>
        {loading && <div className="adm-loading"><div className="adm-spinner" /><span>Cargando...</span></div>}
        {!loading && error && <p className="adm-text" style={{ color: 'var(--a-danger)' }}>Error: {error}</p>}
        {!loading && !error && subs.length === 0 && <p className="adm-text">Todavía no hay suscriptos.</p>}
        {!loading && subs.length > 0 && (
          <div className="adm-orders-list">
            {subs.map((s, i) => (
              <div key={i} className="adm-order-row">
                <span className={`adm-status adm-status--${s.status === 'confirmed' ? 'success' : 'warn'}`}>{s.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</span>
                <div className="adm-order-row__info">
                  <div className="adm-order-row__name">{s.name || '—'}</div>
                  <div className="adm-order-row__email">{s.email}</div>
                  {s.couponCode && <div className="adm-order-row__items">Cupón {s.couponCode} · {s.couponUsed ? 'usado' : 'sin usar'}</div>}
                </div>
                <div className="adm-order-row__meta">
                  <div className="adm-order-row__date">{s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString('es-AR') : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Agregarlo a la navegación y al render**

En el array `NAV` de `admin.js`, agregar un item (mismo formato que los otros, p. ej. `{ id: 'subscribers', label: 'Suscriptos' }`).

En el render de secciones (donde está `{section === 'orders' && <OrdersSection .../>}`), agregar:

```jsx
          {section === 'subscribers' && <SubscribersSection adminSecret={adminSecret} notify={notify} />}
```

- [ ] **Step 3: Bump de cache-busting**

En `admin.html`: `admin.js?v=25` → `admin.js?v=26`.

- [ ] **Step 4: Verificar transpilación**

Run: `node -e 'const B=require("@babel/standalone"),fs=require("fs");B.transform(fs.readFileSync("admin.js","utf8"),{presets:["react"],filename:"admin.js"});console.log("JSX OK")'`
Expected: `JSX OK`.

- [ ] **Step 5: Commit**

```bash
git add admin.js admin.html
git commit -m "feat(admin): sección Suscriptos (lista + envío de newsletter)"
```

---

### Task 12: Verificación end-to-end y configuración

**Files:** ninguno (verificación).

- [ ] **Step 1: Correr toda la batería de tests de Node**

Run:
```bash
for t in tests/coupons tests/subscribers tests/email-subscribe tests/subscribe tests/confirm-subscription tests/checkout-coupon tests/admin-newsletter; do node "$t.test.js" || exit 1; done; echo "TODOS OK"
```
Expected: termina en `TODOS OK`.

- [ ] **Step 2: Chequear sintaxis de todos los endpoints nuevos/modificados**

Run:
```bash
for f in api/_coupons.js api/_subscribers.js api/_email.js api/subscribe.js api/confirm-subscription.js api/create-preference.js api/create-transfer-order.js api/webhook.js api/confirm-order.js api/subscribers.js api/send-newsletter.js; do node -c "$f" || exit 1; done; echo "SINTAXIS OK"
```
Expected: `SINTAXIS OK`.

- [ ] **Step 3: Verificación manual en preview de Vercel**

Tras mergear/pushear, en el deploy:
1. Abrir el sitio → esperar 8 s → aparece el popup. Suscribirse con un email propio.
2. Revisar el mail de confirmación → clic en el link → cae en `#/suscripcion-confirmada` y llega el mail con el cupón.
3. En el checkout, ingresar el cupón y pagar por MercadoPago (5% off) y, en otra prueba, por transferencia (15% off). Confirmar montos.
4. En el admin → Suscriptos: aparece el suscripto (Confirmado, con cupón). Enviar un aviso de prueba y verificar que llega.
5. Verificar que el cupón queda "usado" después de aprobar el pedido y que no se puede reusar.

- [ ] **Step 4: Recordatorio de configuración (no automatizable)**

`RESEND_API_KEY`, `ADMIN_API_SECRET`, `MP_ACCESS_TOKEN`, `SITE_URL` y el token de Blob ya están configurados en Vercel (se usan hoy). No hace falta nada nuevo. Si `SITE_URL` no estuviera seteada, los links de confirmación usan el default `https://botinesweb.vercel.app`.

---

## Self-Review (checklist del que planifica)

- **Cobertura del spec:** popup (T8), doble opt-in (T4/T5), cupón único 5% 30 días (T1), aplicación MP 0.95 / transferencia 0.85 y consumo al aprobar (T6), lista + envío admin (T7/T11), pantallas confirmación/error (T9), campo de cupón (T10), almacenamiento Blob privado (T1/T2), seguridad admin secret + honeypot/throttle (T4/T7). ✅
- **Sin placeholders:** cada paso trae código o comando concreto. ✅
- **Consistencia de nombres:** `validateCoupon`/`markCouponUsed`/`createCoupon`/`COUPON_DISCOUNT` (T1) usados igual en T5/T6; `listSubscribers`/`saveSubscriber`/`getKeyByToken`/`emailKey` (T2) usados igual en T4/T5/T7; `SubscribePopup` global (T8) montado en `app.jsx`. ✅
- **Nota de arrastre:** hay un cambio sin commitear en `styles.css` (ajuste del hero, `aspect-ratio: 3/2`). Antes de ejecutar este plan, decidir con el dueño si se commitea o se revierte, para no mezclarlo con esta feature.
