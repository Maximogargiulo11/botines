# Pago por transferencia bancaria con 10% de descuento — Diseño

Fecha: 2026-07-19

## Contexto

El sitio hoy solo acepta pagos vía MercadoPago Checkout Pro (`api/create-preference.js` + `api/webhook.js`, ver spec `2026-07-08-checkout-envio-design.md`). Se pide agregar una segunda forma de pago: transferencia bancaria directa al alias/CBU de MercadoPago del negocio, con un 10% de descuento como incentivo.

**Restricción técnica central:** a diferencia de Checkout Pro (donde cada pago está atado a una preferencia que el propio backend crea, permitiendo confirmación inequívoca vía webhook), una transferencia bancaria a un alias/CBU no tiene ningún identificador que la vincule a un pedido específico — MercadoPago no documenta públicamente que su webhook de pagos se dispare de forma confiable para transferencias entrantes a la cuenta (solo hay reportes históricos de conciliación, no notificaciones en tiempo real confirmadas). Por eso el diseño es **híbrido**: intenta matching automático por monto exacto cuando sea posible, pero siempre provee una confirmación manual como red de seguridad, y nunca confirma un pedido cuando hay ambigüedad (cero o más de un pedido pendiente con el mismo monto).

## Cambio previo necesario: capturar email del cliente

El formulario de envío actual (`CheckoutScreen.jsx`) no pide email — solo nombre, apellido, DNI, provincia, localidad, dirección, código postal y celular. Sin un email no hay a dónde mandar la confirmación de compra por transferencia. Se agrega `email` como campo requerido más en el formulario (mismo paso `form`, junto a los demás), validado con una regex simple (`/^\S+@\S+\.\S+$/`). Se usa tanto para pedidos por transferencia (obligatorio, es el único mail que tenemos) como para pedidos por MercadoPago (se guarda igual, aunque MercadoPago ya provee su propio `payer_email` — tener el del formulario es redundante pero inofensivo y mantiene un solo campo `email` consistente en todos los pedidos).

Esto implica dos cambios en código ya existente (no solo en el formulario): `api/create-preference.js` agrega `email` al objeto `metadata` que manda a MercadoPago, y `api/webhook.js` agrega `email: meta.email` al objeto `shipping` que reconstruye desde `payment.metadata`. Mismo patrón que los demás campos de `shipping` ya usan.

## Flujo del cliente

**Instancia 3 (confirmar y pagar) — `screens/CheckoutScreen.jsx`, paso `confirm`**

Se agrega un segundo bloque de pago junto al existente ("PAGAR CON MERCADOPAGO"):

- Botón **"PAGAR POR TRANSFERENCIA (10% OFF)"**, mostrando el total ya con el 10% de descuento aplicado (calculado y validado en el servidor, nunca confiando en un monto que mande el navegador — mismo principio que ya rige `api/create-preference.js`).
- Al hacer click, se muestra (en el mismo paso, sin navegar): Alias (`botinesaltagamacba`), CBU (`0000003100097898780738`), el monto exacto a transferir, y el texto "Enviá el comprobante a botinesaltagamacordoba@gmail.com".
- Un botón final **"Ya transferí — confirmar pedido"** dispara `POST /api/create-transfer-order` con `{ items, shipping }` (mismo shape que ya arma el flujo de MercadoPago).
- El servidor valida los datos de envío (mismas reglas que `api/create-preference.js`), calcula el total real desde el catálogo (`api/_products.js`) y le resta 10% (redondeado al peso más cercano), genera un id de pedido, y lo guarda en Vercel Blob con `status: "pendiente"`, `payment_method: "transferencia"`.
- El frontend, al recibir éxito, navega a la misma pantalla de confirmación que ya existe para MercadoPago (`#/pago-exitoso`), mostrando "¡Compra realizada!" — aunque técnicamente el pago todavía no está verificado. Es una decisión de negocio explícita: se prioriza un mensaje tranquilizador para el cliente sobre la precisión técnica del estado.

## Modelo de datos (pedidos en Vercel Blob)

Cada pedido (`orders/<id>.json`) gana dos campos nuevos:
- `payment_method`: `"mercadopago"` | `"transferencia"` (los pedidos existentes de MercadoPago no tienen este campo — se asume `"mercadopago"` si está ausente, por compatibilidad hacia atrás).
- `status`: ya existía (`approved`, `pending`, `rejected`, etc. — viene de MercadoPago para pedidos de MP). Para transferencia, los valores posibles son `"pendiente"` y `"approved"`.

Los pedidos de transferencia usan como pathname `orders/transfer-<id-aleatorio>.json` (no hay `mp_payment_id` hasta que, si corresponde, el matching automático lo asocie a un pago real de MercadoPago — en ese caso se agrega el campo `mp_payment_id` al mismo registro, sin cambiar el pathname).

## Backend

**`api/create-transfer-order.js`** (nuevo)
- Valida `items` (no vacío) y `shipping` (mismas reglas que `api/create-preference.js`, reutilizando `REQUIRED_SHIPPING_FIELDS`).
- Calcula el total real: para cada item, busca el precio de confianza en `api/_products.js` (mismo mecanismo que ya usa `create-preference.js`); si algún id no existe, rechaza con 400. Suma, aplica 10% de descuento, redondea al peso.
- Genera un id de pedido (`transfer-<random>`), arma el objeto de la orden (items con precios reales, shipping, `payment_method: "transferencia"`, `status: "pendiente"`, `amount` = total con descuento, `date`), lo guarda en Blob (`access: "private"`, mismo patrón que `api/webhook.js`).
- Devuelve `{ ok: true, orderId }` al frontend.

**`api/webhook.js`** (modificado)
- Se mantiene toda la lógica actual para pagos de MercadoPago Checkout Pro (metadata con datos de envío presente → pedido normal).
- Se agrega: si el pago recibido **no** trae la metadata que nuestras preferencias siempre incluyen (o sea, no fue generado por `create-preference.js` — podría ser una transferencia entrante u otro movimiento), se listan los pedidos con `status: "pendiente"` y `payment_method: "transferencia"` creados en las últimas 72 horas, y se buscan los que tengan `amount` exactamente igual al monto del pago recibido.
  - Si hay exactamente **un** match: se actualiza ese pedido a `status: "approved"`, se le agrega `mp_payment_id`, y se dispara el mail de confirmación (mismo helper que usa la confirmación manual).
  - Si hay **cero o más de uno**: no se confirma nada automáticamente — se deja un log (`console.log`) para diagnóstico manual, sin crear ninguna vista nueva en el admin.

**`api/confirm-order.js`** (nuevo, protegido por `ADMIN_API_SECRET` como `api/orders.js`)
- Recibe `{ orderId }` por POST.
- Carga el pedido de Blob, verifica que `status === "pendiente"`, lo actualiza a `"approved"`, lo re-guarda, y dispara el mail de confirmación.
- Devuelve `{ ok: true }`.

**`api/_email.js`** (nuevo, helper server-side, no es un endpoint público — sigue la convención de `api/_products.js`)
- Envía el mail de confirmación de compra vía Resend (`RESEND_API_KEY`), desde `pedidos@botinesaltagamacba.com`, al `shipping.email` guardado en el pedido (ver sección "Cambio previo necesario" más arriba).
- Contenido simple: confirmación de compra, items, total, y los datos de envío cargados.

## Frontend (admin)

**`admin.js` — `OrdersSection`**
- Cada pedido con `status === "pendiente"` muestra un botón **"Confirmar pago"** que llama a `POST /api/confirm-order` con el `orderId` y el header `X-Admin-Secret` (mismo mecanismo ya usado por `/api/orders`).
- El badge de estado ya existente (`STATUS` map) gana una entrada para `"pendiente"` (color de advertencia, ya existe el estilo `warn` reutilizado de `pending`).

## Configuración nueva requerida en Vercel

- Conectar **Resend** vía Vercel Marketplace al proyecto `botinesweb` (inyecta `RESEND_API_KEY`).
- Verificar el dominio `botinesaltagamacba.com` en Resend (agregar registros DNS que Resend indique).
- Variable de entorno adicional si hace falta: `FROM_EMAIL` (default `pedidos@botinesaltagamacba.com`, hardcodeable si se prefiere no agregar otra variable).

## Fuera de alcance (YAGNI)

- No se construye una vista de "transferencias sin identificar" en el panel admin.
- No se valida el contenido del comprobante enviado por mail — eso lo revisa el dueño del sitio manualmente.
- No se agrega un mecanismo de reintentos ni cola para el envío de mails — si Resend falla, se loguea el error pero no bloquea la confirmación del pedido (el estado del pedido es la fuente de verdad, no el mail).
- No se cambia nada del flujo de pago con MercadoPago existente.
