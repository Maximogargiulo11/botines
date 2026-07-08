# Checkout con datos de envío — Diseño

Fecha: 2026-07-08

## Contexto

Hoy el botón "PAGAR CON MERCADOPAGO" del carrito (`components/CartDrawer.jsx`) llama directo a `POST /api/create-preference` y redirige al Checkout Pro de MercadoPago (`init_point`). No se recolectan datos de envío del cliente (nombre, DNI, dirección, etc.) — la coordinación de envío se hace manualmente por WhatsApp después del pago.

El objetivo es agregar un paso de captura de datos de envío antes de ir a MercadoPago, inspirado en el checkout de adidas.com.ar, y persistir esos datos junto con la orden cuando el pago se aprueba.

## Flujo — tres instancias

**Instancia 1 — Carrito** (`components/CartDrawer.jsx`, se mantiene como panel lateral)
- El botón "PAGAR CON MERCADOPAGO" pasa a decir **"IR A PAGAR"**. Al presionarlo, cierra el carrito y navega a `#/checkout` (ya no llama a `/api/create-preference` desde acá).
- Se agrega un cartel fijo **"🚚 Envío gratis"**.
- Se agrega una fila "Opciones de pago" con el logo de MercadoPago (`assets/logo mercado pago.JPG`, renombrado a `assets/logo-mercadopago.jpg` para evitar espacios en la URL).
- El botón "CONSULTAR POR WHATSAPP" y su lógica (`checkoutWA`) no cambian.

**Instancia 2 — Formulario de envío** (nuevo `screens/CheckoutScreen.jsx`, ruta `#/checkout`, paso interno `form`)
- Resumen breve del pedido (items + subtotal), reutilizando el cálculo que hoy vive en `CartDrawer`.
- Campos:
  - Nombre (texto, requerido)
  - Apellido (texto, requerido)
  - DNI (numérico, requerido, 7-8 dígitos)
  - Provincia (`<select>`, requerido, opciones: las 24 provincias argentinas + CABA)
  - Localidad (texto, requerido)
  - Dirección (texto, requerido)
  - Código Postal (texto, requerido, 4 dígitos)
  - Celular (tel, requerido)
  - Descripción (textarea, opcional — referencias de entrega)
- Botón **"Siguiente"**: valida los campos requeridos client-side. Si falta algo, muestra errores inline y no avanza. Si está todo OK, pasa al paso `confirm` (misma pantalla/ruta, sin recargar).
- Si el carrito está vacío (acceso directo a `#/checkout`), se muestra el mismo estado vacío que ya existe en `CartDrawer` ("Explorá el catálogo").

**Instancia 3 — Confirmar y pagar** (mismo `CheckoutScreen.jsx`, paso interno `confirm`)
- Resumen del pedido (items + subtotal).
- Resumen de los datos de envío cargados, de solo lectura, con un link **"Editar"** que vuelve al paso `form` sin perder lo tipeado (el estado del formulario vive en el mismo componente).
- Cartel **"Envío gratis"** nuevamente.
- Fila "Opciones de pago" con el logo de MercadoPago.
- Botón final **"Pagar con MercadoPago"**:
  - Dispara el mismo evento GA4 `begin_checkout` + snapshot en `sessionStorage` que hoy hace `checkoutMP` en `CartDrawer.jsx`.
  - Hace `POST /api/create-preference` con `{ items, shipping }`, donde `shipping` es el objeto con los 9 campos del formulario.
  - Redirige a `data.init_point` (MercadoPago), igual que hoy.

## Backend

**`api/create-preference.js`**
- Acepta `shipping` en el body además de `items`.
- Valida server-side que los campos requeridos de `shipping` estén presentes (nombre, apellido, dni, provincia, localidad, direccion, codigo_postal, celular); si falta alguno, responde `400 { error: 'Faltan datos de envío' }`.
- Agrega `shipping` como `metadata` de la preferencia enviada a la API de MercadoPago (`nombre`, `apellido`, `dni`, `provincia`, `localidad`, `direccion`, `codigo_postal`, `celular`, `descripcion`).
- El resto de la función (items, back_urls, notification_url, etc.) no cambia.

**`api/webhook.js`**
- Cuando el pago se aprueba y se hace `fetch` a `/v1/payments/{id}`, la respuesta incluye `payment.metadata` con los mismos campos enviados en la preferencia.
- Se agrega `order.shipping = { nombre, apellido, dni, provincia, localidad, direccion, codigoPostal, celular, descripcion }` (mapeado desde `payment.metadata`, con fallback a `null`/campos vacíos si no vino metadata — por ejemplo pagos viejos o de prueba).
- `saveOrder()` no cambia su lógica de commit a GitHub, solo el objeto `order` tiene un campo más.

**Persistencia:** solo se guarda una orden en `orders.json` si el pago es aprobado (comportamiento actual del webhook). Si el cliente completa el formulario pero abandona el pago en MercadoPago, no queda ningún registro — mismo comportamiento que hoy.

## Panel admin (`admin.js` / `admin.html`)

- En `OrdersSection`, cada fila de pedido pagado muestra (si `o.shipping` existe) un bloque adicional con: nombre y apellido, DNI, dirección completa (dirección, localidad, provincia, CP) y celular. La descripción se muestra si el cliente la cargó.
- No se agregan nuevas vistas ni filtros — solo se enriquece la fila existente.

## Fuera de alcance (YAGNI)

- No se persiste el formulario en localStorage para prefill en visitas futuras.
- No se agrega costo de envío (el envío es gratis, sin cálculo de tarifas).
- El carrito (`CartDrawer`) no se convierte en página completa — sigue siendo el panel lateral existente.
- No se tocan los flujos de `#/pago-exitoso`, `#/pago-fallido`, `#/pago-pendiente` (`PaymentResultScreen` en `app.jsx`).
- El botón de WhatsApp del carrito no pasa por el formulario de envío.

## Archivos afectados

- `components/CartDrawer.jsx` — botón "IR A PAGAR", cartel envío gratis, logo MercadoPago.
- `screens/CheckoutScreen.jsx` — nuevo.
- `app.jsx` — nueva ruta `#/checkout`.
- `index.html` — registrar `<script type="text/babel" src="screens/CheckoutScreen.jsx?v=1">`.
- `api/create-preference.js` — aceptar y validar `shipping`, agregarlo como `metadata`.
- `api/webhook.js` — leer `payment.metadata` y guardarlo en `order.shipping`.
- `admin.js` — mostrar `o.shipping` en `OrdersSection`.
- `styles.css` — estilos del formulario, banner de envío gratis, fila de opciones de pago.
- `assets/logo-mercadopago.jpg` — copia renombrada de `assets/logo mercado pago.JPG`.
