# Popup de suscripción con cupón de 10% y newsletter — Diseño

Fecha: 2026-08-10

## Contexto

El sitio (Botines Alta Gama, SPA React UMD + Babel, sin build, en Vercel) ya tiene:
- **Resend** configurado para mails transaccionales (`api/_email.js`, dominio verificado).
- **Vercel Blob** privado para guardar pedidos (`api/orders.js`, patrón `new Response(stream).text()`).
- **Checkout propio** con dos métodos: MercadoPago (`api/create-preference.js`, precio calculado en el servidor con `getTrustedPrice`) y transferencia con 10% off (`api/create-transfer-order.js`).
- **Panel admin** (`admin.js`) protegido por contraseña + `ADMIN_API_SECRET` para endpoints privados.

Se quiere sumar un **cartel emergente (popup)** que capte email + nombre para: (1) entregar un **cupón único de 10%** como incentivo de compra, y (2) armar una **lista de newsletter** para avisar lanzamientos, con envío desde el panel.

## Decisiones tomadas (con el dueño)

- **Descuento:** cupón **único por persona, de un solo uso**, ingresado en el checkout y validado/aplicado **en el servidor**.
- **Validez del cupón:** **30 días** desde que se emite.
- **Doble opt-in:** se valida el email (mail con link de confirmación) **antes** de entregar el cupón y sumar a la lista.
- **No acumula:** el cupón da 10%; **no se suma** al 10% de transferencia (máximo 10% en cualquier caso). En la práctica el cupón sirve para pagos con **MercadoPago**.
- **Newsletter:** guardar la lista **y** una pantalla en el admin para redactar y enviar el aviso de lanzamiento a todos.
- **Popup:** aparece a los **8 segundos** o al scrollear (lo que ocurra primero), **una vez por visitante**.
- **Enfoque:** todo a medida sobre el stack actual (Resend + Vercel Blob + Vercel Functions + panel admin). No se usa herramienta externa de marketing.

## Flujo del cliente

1. **Popup** (`components/SubscribePopup.jsx`): aparece a los 8 s o al primer scroll significativo, salvo que el visitante ya se haya suscripto o lo haya cerrado (flag en `localStorage`). No aparece en el checkout (`#/checkout`) ni afecta al admin. Campos: **Email** y **Nombre**. Botón "Suscribirme". Se cierra con la X.
2. Al enviar → `POST /api/subscribe`. El popup pasa a un estado "Revisá tu mail para confirmar y recibir tu cupón." Se marca `localStorage` como "suscripto" para no volver a mostrarlo.
3. Llega un mail **"Confirmá tu email"** con un link a `GET /api/confirm-subscription?token=…`.
4. Al hacer clic: el servidor confirma, genera el **cupón único** (ej. `BAG-7K3M9Q`), lo guarda, envía un segundo mail con el cupón ("válido por 30 días") y redirige a `#/suscripcion-confirmada` (pantalla de éxito). Si el token es inválido/vencido → `#/suscripcion-error`.
5. En el **checkout** (paso confirmar), un campo **"Código de descuento"** permite pegar el cupón. Al confirmar el pago, el código viaja al servidor, que valida y aplica el 10%.

## Reglas de descuento (servidor)

- El precio **siempre** se calcula en el servidor desde el catálogo (`getTrustedPrice`), nunca desde el navegador.
- **MercadoPago:** si viene un `coupon` válido (existe, no usado, no vencido), el subtotal se multiplica por `0.9` (`Math.round(subtotal * 0.9)`) y el código se guarda en `metadata`. El cupón se marca **usado** cuando el pago llega a `approved` (en `api/webhook.js`), para no consumirlo si el pago no se concreta. La ventana entre validar (al crear la preferencia) y marcar usado (al aprobarse) permite en teoría reusarlo dos veces si el cliente inicia dos pagos casi simultáneos; es aceptable dado el bajo volumen (mismo criterio que la carrera aceptada en el matching de transferencias).
- **Transferencia:** ya aplica 10%. Para respetar "no acumular", si viene un cupón en una compra por transferencia **no se aplica descuento extra ni se consume el cupón** (el cliente lo conserva para una compra con MercadoPago). El total sigue siendo el 10% de transferencia.
- Un cupón inválido/vencido/usado → el checkout muestra un aviso y sigue sin descuento (no bloquea la compra).

## Modelo de datos (Vercel Blob, privado)

- `subscribers/<emailKey>.json` — un registro por email (unicidad). `emailKey` = base64url del email en minúsculas.
  ```
  { email, name, status: "pending" | "confirmed",
    confirmToken, subscribedAt, confirmedAt,
    couponCode, couponExpiresAt, couponUsed }
  ```
- `subtokens/<token>.json` — puntero para confirmar sin escanear: `{ emailKey }`.
- `coupons/<CODE>.json` — índice para validar rápido en el checkout: `{ code, email, used, createdAt, expiresAt }`.

Todo con `access: "private"`, mismo patrón que los pedidos.

## Backend (Vercel Functions)

- **`api/subscribe.js`** (nuevo) — `POST { email, name, website? }`.
  - Valida formato de email. **Honeypot:** si el campo oculto `website` viene lleno → responde 200 sin hacer nada (bot).
  - Throttle anti-spam: si ya existe un `subscribers/<emailKey>` con `status: "confirmed"` → responde ok sin reenviar. Si está `pending` y el último envío fue hace < 10 min → no reenvía el mail (evita ser relay de spam).
  - Crea/actualiza el registro `pending` con `confirmToken` nuevo + puntero `subtokens/<token>`, y envía el mail de confirmación (Resend).
- **`api/confirm-subscription.js`** (nuevo) — `GET ?token=…`.
  - Busca el puntero `subtokens/<token>` → subscriber. Si no existe/expiró → redirige a `#/suscripcion-error`.
  - Marca `confirmed`, genera cupón único (`api/_coupons.js`), guarda `coupons/<CODE>` (`expiresAt` = ahora + 30 días), envía el mail con el cupón, borra el puntero de token usado y redirige (302) a `#/suscripcion-confirmada`.
- **`api/_coupons.js`** (nuevo, helper) — `generateCode()`, `validateCoupon(code)` → `{ valid, reason }`, `markUsed(code)`. Reutilizado por el checkout.
- **`api/create-preference.js`** (modificar) — acepta `coupon` opcional; si es válido aplica `*0.9` y lo agrega a `metadata.coupon`.
- **`api/webhook.js`** (modificar) — al procesar un pago `approved` con `meta.coupon`, marca el cupón usado.
- **`api/create-transfer-order.js`** (modificar) — acepta `coupon` opcional pero **no** lo aplica ni consume (regla de no acumular); se conserva.
- **`api/subscribers.js`** (nuevo, protegido por `ADMIN_API_SECRET`) — `GET` lista de suscriptos (email, nombre, estado, cupón, usado, fecha), ordenada por fecha desc.
- **`api/send-newsletter.js`** (nuevo, protegido por `ADMIN_API_SECRET`) — `POST { subject, bodyHtml, imageUrl?, linkUrl? }` → arma el HTML y envía a todos los suscriptos `confirmed` vía Resend (en lotes, con manejo de error por destinatario; loguea cuántos se enviaron). Devuelve `{ sent, failed }`.
- **`api/_email.js`** (extender) — nuevas plantillas: `sendConfirmSubscription(email, token)` y `sendCouponEmail(email, name, code, expiresAt)`. Todo user-controlled escapado con el `esc()` existente.

## Frontend

- **`components/SubscribePopup.jsx`** (nuevo, `window.SubscribePopup`) — modal con overlay, timer 8 s + listener de scroll, gating por `localStorage` (`bag:sub:done` y `bag:sub:dismissedUntil`), formulario email + nombre + honeypot oculto, estados: form → enviando → "revisá tu mail". Estilo acorde al sitio (variables `--bag-*`).
- **`app.jsx`** (modificar) — montar `<SubscribePopup>` fuera del checkout; agregar rutas `#/suscripcion-confirmada` y `#/suscripcion-error` (pantallas simples de éxito/error).
- **`screens/CheckoutScreen.jsx`** (modificar) — input "Código de descuento" en el paso confirmar; el código se envía a `create-preference` / `create-transfer-order` en el body. Mostrar el total con el descuento aplicado (o el aviso si el cupón no es válido).
- **`admin.js`** (modificar) — nueva sección **"Suscriptos"** en la nav: lista (desde `api/subscribers.js`) + formulario para redactar y enviar el aviso (`api/send-newsletter.js`). Bump de `admin.js?v=`.
- **`index.html`** (modificar) — `<script>` de `components/SubscribePopup.jsx` + bumps de cache-busting de los archivos tocados. Estilos nuevos en `styles.css` (bump de versión).

## Manejo de errores

- Endpoints devuelven JSON `{ error }` con status apropiado; el front muestra mensajes claros y **nunca bloquea la compra** por un cupón inválido.
- Envío de mails: si Resend falla, se loguea y se devuelve el motivo (patrón ya usado en `_email.js`), sin romper el flujo (el estado del suscripto/pedido es la fuente de verdad).
- Blob: lecturas con `new Response(stream).text()`; escrituras con `allowOverwrite: true`.

## Seguridad

- Precio y descuento **siempre** en el servidor (nunca se confía en montos ni "válido" del cliente).
- Endpoints de admin (`subscribers`, `send-newsletter`) exigen `X-Admin-Secret === ADMIN_API_SECRET` (fail-closed).
- `api/subscribe.js` con honeypot + throttle por email para no ser relay de spam (captcha queda como mejora futura si hiciera falta).
- Datos de suscriptos en Blob privado, nunca públicos.

## Fuera de alcance (YAGNI)

- Sin captcha (honeypot + throttle alcanzan para el volumen actual).
- Sin segmentación ni analytics de campañas (se puede sumar después).
- Sin baja automática por link de "unsubscribe" en v1 (se puede sumar; el dueño puede quitar de la lista desde el admin). *Nota: conviene sumar un link de baja pronto por buenas prácticas de email.*
- El cupón no acumula con transferencia (decisión explícita).
