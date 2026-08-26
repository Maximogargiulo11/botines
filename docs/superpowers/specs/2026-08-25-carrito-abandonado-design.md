# Recuperación de carrito abandonado — Diseño

**Fecha:** 2026-08-25
**Estado:** En revisión

## Objetivo

Recuperar ventas de quienes **llegaron al checkout, ingresaron su email pero no
completaron la compra**, mediante una **secuencia automatizada de 3 mails** con
**link de recuperación de 1 clic**, sin agregar funciones a Vercel (tope de 12) y
sin costo (el "reloj" corre en GitHub Actions).

## Decisiones (ya tomadas con el usuario)

- **A quién:** solo a quienes ingresaron su email en el checkout y no compraron.
  (No se puede a visitantes anónimos: sin email no hay a quién escribirle.)
- **Secuencia de 3 toques:**
  | Toque | Cuándo (desde la captura) | Contenido |
  |---|---|---|
  | 1 | ~1 h | Recordatorio suave: "Te quedó esto en el carrito" + productos |
  | 2 | ~24 h | Urgencia / stock: "Últimas unidades de tu talle" + productos |
  | 3 | ~48–72 h | Incentivo: **cupón único de 5%** (solo en este mail) |
- **Link de recuperación:** cada mail trae un link que **reconstruye el carrito
  con 1 clic** (rearma el carrito en el navegador y lleva al checkout). El del
  toque 3 además pre-carga el cupón.
- **Corte:** si se concreta una orden con ese email, la secuencia se detiene.
- **Reloj:** GitHub Actions (gratis), cada ~15 min. La imprecisión de unos
  minutos es irrelevante para ventanas de 1h/24h/48h.

## Arquitectura (contexto actual)

- Sitio estático (React UMD), carrito en `localStorage` (`bag:cart:v1`), sin
  cuentas de usuario. El servidor no conoce el carrito hasta el checkout.
- Funciones Vercel en `api/` (12/12 en Hobby — **no se pueden agregar más**).
- Almacenamiento: Vercel Blob. Emails: Resend. Cupones: `api/_coupons.js`.
- El checkout ([screens/CheckoutScreen.jsx](../../../screens/CheckoutScreen.jsx))
  ya tiene el email en el form y llama a `/api/validate-coupon` (cupón) y a
  `create-preference` / `create-transfer-order` al pagar.

### Restricción de las 12 funciones → consolidación

Se **elimina** `api/validate-coupon.js` y se crea `api/checkout.js` que maneja
ambas cosas por `action`. Neto: sigue en **12 funciones**.

- `POST /api/checkout {action:'validate-coupon', code}` → igual que hoy.
- `POST /api/checkout {action:'save-cart', email, name, items}` → guarda el
  carrito pendiente en Blob.

## Componentes

### 1. Captura del carrito pendiente
- **`api/checkout.js`** (nuevo, reemplaza validate-coupon): en `save-cart`
  valida email, y guarda en Blob `carts/<emailKey>.json`:
  ```
  {
    email, name,
    items: [{ id, name, colorway, price, image, size, qty, brand, model }],
    createdAt, updatedAt,
    status: 'pending',          // 'pending' | 'recovered'
    sent: { t1: false, t2: false, t3: false },
    couponCode: null            // se completa al enviar el toque 3
  }
  ```
  `emailKey` = base64url del email (mismo criterio que `_subscribers.js`). Un
  carrito pendiente por email; si vuelve a guardar, se actualiza (`updatedAt`,
  items nuevos) **sin resetear** los `sent` ya enviados.
- **CheckoutScreen.jsx**: cuando el email es válido (onBlur del campo email, con
  el carrito no vacío), hace `POST /api/checkout {action:'save-cart', ...}`.
  Enriquece cada item con `brand`/`model` buscando `item.id` en
  `BAG_DATA.products` (los items del carrito no guardan brand/model).
  Throttle: no re-postear si no cambió el email ni el carrito.

### 2. Procesador de recordatorios (GitHub Actions)
- **`scripts/cart-reminders.mjs`** (nuevo, NO es función Vercel): corre en el
  Action. Usa `@vercel/blob` (leer/escribir carts) y `resend` (enviar).
  - Lista `carts/` con status `pending`.
  - Para cada uno calcula la antigüedad (`now - createdAt`) y envía el toque que
    corresponda **si no fue enviado**:
    - `>= 1h` y `!sent.t1` → mail 1, marca `sent.t1`.
    - `>= 24h` y `!sent.t2` → mail 2, marca `sent.t2`.
    - `>= 48h` y `!sent.t3` → genera cupón con `createCoupon(email)`
      (`api/_coupons.js`), guarda `couponCode`, envía mail 3 con el cupón, marca
      `sent.t3`.
  - Envía **como máximo un toque por corrida** por carrito (evita ráfagas).
  - Purga: carritos con `sent.t3` o `status==='recovered'` con +7 días → borrar.
- **`.github/workflows/cart-reminders.yml`**: `schedule: cron '*/15 * * * *'`
  (cada 15 min). Hace checkout del repo, `npm ci`, y corre el script con los
  secrets como env vars.
- **Secrets de GitHub necesarios** (el usuario los carga en Settings → Secrets):
  `BLOB_READ_WRITE_TOKEN` (token de Vercel Blob), `RESEND_API_KEY`, `SITE_URL`.

### 3. Link de recuperación (sin función)
- Formato: `${SITE_URL}/recuperar?c=<base64>` (toque 3:
  `&coupon=<code>`), donde `base64` = JSON de `[{ id, sz, q }]` por item.
- **app.jsx**: nueva ruta `recuperar` → componente `RecoverCartScreen` que:
  1. Decodifica `c`, y por cada `{id, sz, q}` busca el producto en
     `BAG_DATA.products` (id → `{product, brandKey}`), arma el item completo
     (name, colorway, precio ACTUAL, image) y setea `localStorage` `bag:cart:v1`.
  2. Si viene `coupon`, lo guarda para pre-cargar en el checkout
     (`sessionStorage` `bag:recover:coupon`).
  3. Redirige a `/checkout` con el carrito ya cargado.
- Ventaja: precios siempre actuales, no requiere endpoint, funciona aunque el
  navegador sea otro.

### 4. Corte de la secuencia (marcar recuperado)
- Al **crear una orden** se marca el carrito de ese email como `recovered`:
  - `create-transfer-order.js`: tras guardar la orden, marcar
    `carts/<emailKey(shipping.email)>.json` → `status:'recovered'` (si existe).
  - `webhook.js` (pago MP aprobado): ídem, con el email de la orden.
  - (No se marca en `create-preference` porque el pago MP puede no concretarse.)
- El procesador ignora los `recovered`.

## Emails (Resend, from `pedidos@botinesaltagamacba.com`)

Plantillas en el script (reusan el estilo de `api/_email.js`). Cada una:
foto+nombre+precio de los productos, botón **"Volver a mi carrito"** (link de
recuperación), y una línea de baja suave ("Si no querés estos recordatorios,
respondé este mail").

- **Toque 1** — asunto: "¿Te olvidaste de algo? 👀" — tono suave.
- **Toque 2** — asunto: "Tu talle se está agotando" — urgencia/stock.
- **Toque 3** — asunto: "Un 5% para terminar tu compra 🎟️" — muestra el cupón +
  aclaración de que vence en 30 días y es de un solo uso; el botón pre-carga el
  cupón en el checkout.

## Anti-spam / privacidad
- Máximo 3 mails por carrito; nunca se repite un toque.
- Se corta al comprar.
- Línea de opt-out suave (responder el mail). Los emails se captaron en el
  checkout (contexto de compra), uso legítimo de recuperación.

## Testing
- **`api/checkout.js`**: node assert — `validate-coupon` (igual que antes),
  `save-cart` (guarda en Blob mockeado; valida email; no resetea `sent`).
- **`scripts/cart-reminders.mjs`**: node assert con Blob/Resend mockeados —
  envía t1 a >1h, t2 a >24h, t3 a >48h (con cupón), no repite toques, respeta
  `recovered`, un toque por corrida.
- **Recuperación**: transpila app.jsx; verificación manual de que el link rearma
  el carrito y pre-carga el cupón.
- **Corte**: node assert — create-transfer-order marca `recovered`.

## Fuera de alcance (YAGNI)
- Captura de email antes del checkout (en el carrito) — descartado por fricción.
- Recuperación de visitantes anónimos (imposible sin email).
- Panel de métricas de recuperación (se puede sumar después).
- Prueba social real (no hay reviews); el toque 2 usa urgencia/stock genérica.

## Riesgo
- No se toca la lógica de pago. `create-transfer-order`/`webhook` reciben una
  línea aditiva (marcar recovered) tolerante a fallos.
- La fusión validate-coupon → checkout es el único cambio no-aditivo (con test).
- GitHub Actions puede demorarse o pausarse si el repo queda inactivo mucho
  tiempo; para este caso (ventanas de horas) es tolerable.
