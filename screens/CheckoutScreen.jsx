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
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Email inválido.';
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
    nombre: '', apellido: '', email: '', dni: '', provincia: '', localidad: '',
    direccion: '', codigoPostal: '', celular: '', descripcion: '',
  });
  const [errors, setErrors] = useState_checkout({});
  const [loading, setLoading] = useState_checkout(false);
  const [payError, setPayError] = useState_checkout(null);
  const [showTransfer, setShowTransfer] = useState_checkout(false);
  const [transferLoading, setTransferLoading] = useState_checkout(false);
  const [transferError, setTransferError] = useState_checkout(null);
  const [coupon, setCoupon] = useState_checkout('');
  const [couponState, setCouponState] = useState_checkout(null); // null | 'checking' | 'valid' | 'invalid'

  const subtotal = cart.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
  const couponValid = couponState === 'valid';
  const transferTotal = Math.round(subtotal * (couponValid ? 0.85 : 0.9));
  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const checkCoupon = async () => {
    const code = coupon.trim();
    if (!code) { setCouponState(null); return; }
    setCouponState('checking');
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      setCouponState(d.valid ? 'valid' : 'invalid');
    } catch { setCouponState('invalid'); }
  };

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
        body: JSON.stringify({ items: cart, shipping: form, coupon: coupon.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el pedido');
      navigate('/pago-transferencia');
    } catch (err) {
      setTransferError(err.message);
      setTransferLoading(false);
    }
  };

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
        body: JSON.stringify({ items: cart, shipping: form, coupon: coupon.trim() || undefined }),
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
                <input value={form.dni} onChange={e => updateField('dni', e.target.value)} inputMode="numeric" placeholder="Ej. 30123456" />
              </CheckoutField>
              <div className="bag-checkout__row">
                <CheckoutField label="Provincia" error={errors.provincia}>
                  <select value={form.provincia} onChange={e => updateField('provincia', e.target.value)} autoComplete="address-level1">
                    <option value="">Elegí tu provincia</option>
                    {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </CheckoutField>
                <CheckoutField label="Localidad" error={errors.localidad}>
                  <input value={form.localidad} onChange={e => updateField('localidad', e.target.value)} autoComplete="address-level2" />
                </CheckoutField>
              </div>
              <div className="bag-checkout__row">
                <CheckoutField label="Dirección" error={errors.direccion}>
                  <input value={form.direccion} onChange={e => updateField('direccion', e.target.value)} placeholder="Calle y número" autoComplete="street-address" />
                </CheckoutField>
                <CheckoutField label="Código Postal" error={errors.codigoPostal}>
                  <input value={form.codigoPostal} onChange={e => updateField('codigoPostal', e.target.value)} inputMode="numeric" placeholder="Ej. 5000" autoComplete="postal-code" />
                </CheckoutField>
              </div>
              <CheckoutField label="Celular" error={errors.celular}>
                <input value={form.celular} onChange={e => updateField('celular', e.target.value)} type="tel" placeholder="Ej. 3511234567" autoComplete="tel" />
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
                <div><dt>Email</dt><dd>{form.email}</dd></div>
                <div><dt>DNI</dt><dd>{form.dni}</dd></div>
                <div><dt>Dirección</dt><dd>{form.direccion}, {form.localidad}, {form.provincia} (CP {form.codigoPostal})</dd></div>
                <div><dt>Celular</dt><dd>{form.celular}</dd></div>
                {form.descripcion && <div><dt>Descripción</dt><dd>{form.descripcion}</dd></div>}
              </dl>

              <div className="bag-shipping-banner">🚚 Envío gratis</div>
              <div className="bag-payopts">
                <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
                <div className="bag-payopts__row">
                  <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
                  <span className="bag-payopts__discount">-10% pagando por transferencia</span>
                </div>
              </div>

              <div className="bag-coupon">
                <label className="bag-eyebrow bag-eyebrow--muted" htmlFor="bag-coupon-input">Código de descuento (opcional)</label>
                <input
                  id="bag-coupon-input"
                  className="bag-coupon__input"
                  type="text"
                  placeholder="BAG-XXXXXX"
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponState(null); }}
                  onBlur={checkCoupon}
                />
                {couponState === 'checking' && <span className="bag-coupon__msg">Verificando…</span>}
                {couponState === 'valid' && <span className="bag-coupon__msg bag-coupon__msg--ok">✓ Cupón válido — 5% de descuento aplicado</span>}
                {couponState === 'invalid' && <span className="bag-coupon__msg bag-coupon__msg--err">Cupón no válido o vencido</span>}
              </div>

              {payError && <p className="bag-cart__error">{payError}</p>}
              <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handlePay} disabled={loading}>
                {loading ? 'Redirigiendo...' : 'PAGAR CON MERCADOPAGO'}
              </button>

              {!showTransfer ? (
                <button className="bag-btn bag-btn--ghost bag-btn--block" onClick={() => setShowTransfer(true)}>
                  PAGAR POR TRANSFERENCIA ({couponValid ? '15' : '10'}% OFF)
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
        </div>

        <aside className="bag-checkout__aside">
          <div className="bag-eyebrow bag-eyebrow--muted">TU PEDIDO</div>
          <div className="bag-cart__items" style={{ padding: 0 }}>
            {cart.map((it, idx) => (
              <div className="bag-cart__item" key={`${it.id}-${it.size}-${idx}`}>
                <div className="bag-cart__item-media"><img src={it.image || 'assets/placeholder-product.svg'} alt="" /></div>
                <div className="bag-cart__item-body">
                  <div className="bag-cart__item-name">{it.name}</div>
                  <div className="bag-cart__item-meta">{it.colorway} · Talle {it.size} {(it.unit || 'eu').toUpperCase()}</div>
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
