/* global React */
const { useState: useState_cart, useEffect: useEffect_cart, useRef: useRef_cart } = React;

const CART_EMAIL_KEY = 'bag:cart:email';

function CartDrawer({ open, onClose, items, onRemove, navigate, clearCart }) {
  useEffect_cart(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Captura de carrito abandonado: si el visitante deja su email acá, guardamos
  // el carrito en el servidor y el cron dispara el recordatorio (toque 1 a los
  // 30 min), aunque nunca llegue al checkout. Es la misma acción save-cart que
  // usa la pantalla de checkout.
  const [email, setEmail] = useState_cart(() => {
    try { return localStorage.getItem(CART_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [saved, setSaved] = useState_cart(false);
  const lastSavedRef = useRef_cart('');

  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

  const saveCartRemote = async () => {
    const em = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em) || items.length === 0) return;
    try { localStorage.setItem(CART_EMAIL_KEY, em); } catch {}
    // Evita re-postear si no cambió email ni items.
    const sig = em + '|' + JSON.stringify(items.map(it => [it.id, it.size, it.qty]));
    if (sig === lastSavedRef.current) { setSaved(true); return; }
    lastSavedRef.current = sig;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-cart', email: em, items }),
      });
      if (res.ok) setSaved(true);
    } catch {}
  };

  const goToCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  const contactIG = () => {
    window.open('https://ig.me/m/botinesaltagamacba', '_blank', 'noopener');
  };

  return (
    <React.Fragment>
      <div className={`bag-cart-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`bag-cart ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <header className="bag-cart__head">
          <div className="bag-eyebrow">CARRITO · {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}</div>
          <button className="bag-cart__close" onClick={onClose} aria-label="Cerrar carrito">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
          </button>
        </header>

        <div className="bag-cart__items">
          {items.length === 0 && (
            <div className="bag-cart__empty">
              <div className="bag-eyebrow bag-eyebrow--muted">Carrito vacío</div>
              <p>Aún no añadiste productos. Explora el catálogo para encontrar tu próximo par.</p>
              <button className="bag-btn bag-btn--ghost bag-btn--block" onClick={() => { onClose(); navigate('/marcas'); }}>IR A LA TIENDA</button>
            </div>
          )}
          {items.map((it, idx) => (
            <div className="bag-cart__item" key={`${it.id}-${it.size}-${idx}`}>
              <div className="bag-cart__item-media"><img src={it.image || 'assets/placeholder-product.svg'} alt="" /></div>
              <div className="bag-cart__item-body">
                <div className="bag-cart__item-name">{it.name}</div>
                <div className="bag-cart__item-meta">{it.colorway} · Talle {it.size} {(it.unit || 'eu').toUpperCase()}</div>
                <div className="bag-cart__item-price">{window.formatPrice(it.price)}</div>
              </div>
              <button className="bag-cart__item-remove" onClick={() => onRemove(idx)} aria-label="Eliminar">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
              </button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <footer className="bag-cart__foot">
            <div className="bag-cart__subtotal">
              <span className="bag-eyebrow bag-eyebrow--muted">SUBTOTAL</span>
              <span className="bag-cart__subtotal-value">{window.formatPrice(subtotal)}</span>
            </div>
            <div className="bag-shipping-banner">🚚 Envío gratis</div>

            {/* Captura de carrito: dejá tu email y te lo guardamos (recordatorio) */}
            <div className="bag-cart__save" style={{ margin: '12px 0' }}>
              <label className="bag-eyebrow bag-eyebrow--muted" htmlFor="bag-cart-email">¿NO LLEGÁS A COMPRAR AHORA?</label>
              <p className="bag-cart__note" style={{ margin: '4px 0 8px' }}>Dejanos tu email y te guardamos el carrito.</p>
              <input
                id="bag-cart-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
                onBlur={saveCartRemote}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 14,
                  background: '#fff', color: '#111', outline: 'none',
                }}
              />
              {saved && (
                <div className="bag-cart__save-ok" style={{ marginTop: 6, fontSize: 12, color: '#059669' }}>
                  ✓ Te guardamos el carrito. Si no completás la compra, te lo recordamos por email.
                </div>
              )}
            </div>

            <button className="bag-btn bag-btn--primary bag-btn--block" onClick={(e) => { e.currentTarget.blur(); saveCartRemote(); goToCheckout(); }}>
              IR A PAGAR
            </button>
            <div className="bag-payopts">
              <span className="bag-eyebrow bag-eyebrow--muted">OPCIONES DE PAGO</span>
              <div className="bag-payopts__row">
                <img src="assets/logo-mercadopago-v2.jpg" alt="MercadoPago" className="bag-payopts__logo" />
                <span className="bag-payopts__discount">-10% pagando por transferencia</span>
              </div>
            </div>
            <button className="bag-btn bag-btn--ghost bag-btn--block bag-cart__ig-btn" onClick={contactIG}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>
              CONSULTAR POR INSTAGRAM
            </button>
            <p className="bag-cart__note">Cargá tus datos de envío en el siguiente paso.</p>
          </footer>
        )}
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { CartDrawer });
