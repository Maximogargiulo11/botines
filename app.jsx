/* global React, ReactDOM, BAG_DATA */
/* global Navbar, Footer, CartDrawer, SubscribePopup */
/* global HomeScreen, ArticleScreen, BrandsScreen, BrandScreen, ModelScreen, ProductScreen, PoliticaScreen, FaqScreen, CheckoutScreen */
/* global useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor */

const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = (() => {
  const t = (window.BAG_DATA && window.BAG_DATA.config && window.BAG_DATA.config.typography) || {};
  return { accent: t.accent || '#ffffff', serif: t.serif || 'playfair' };
})();

/* Cart persistence */
const CART_KEY = 'bag:cart:v1';
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
}

/* History-based router: /lanzamientos/foo */
function usePathRoute() {
  const [route, setRoute] = useState(() => window.location.pathname || '/');
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return [route, setRoute];
}

/* Barra de beneficios rotativa — señal de tienda arriba de todo */
const BENEFITS = [
  '🚚 Envíos a todo el país',
  '💸 10% OFF pagando por transferencia',
  '📩 Suscribite y recibí los lanzamientos antes que nadie',
];
function BenefitsBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % BENEFITS.length), 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="bag-benefits-bar" role="status" aria-live="polite">
      {BENEFITS.map((b, idx) => (
        <span key={idx} className={`bag-benefits-bar__item${idx === i ? ' is-active' : ''}`}>{b}</span>
      ))}
    </div>
  );
}

function App() {
  const [route, setRoute] = usePathRoute();
  const navigate = (path) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
      setRoute(path);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: route });
    }
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [route]);

  const addToCart = (item) => {
    const next = [...cart, { id: item.id, name: item.name, colorway: item.colorway, price: item.price, size: item.size, unit: item.unit, image: item.images?.[0], qty: 1 }];
    setCart(next); saveCart(next);
    setCartOpen(true);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'add_to_cart', {
        currency: 'ARS',
        value: item.price,
        items: [{ item_id: item.id, item_name: item.name, item_brand: item.brand, item_variant: item.colorway, price: item.price, quantity: 1 }],
      });
    }
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'AddToCart', {
        content_name: item.name,
        content_ids: [item.id],
        content_type: 'product',
        value: item.price,
        currency: 'ARS',
      });
    }
  };
  const removeFromCart = (idx) => {
    const next = cart.filter((_, i) => i !== idx);
    setCart(next); saveCart(next);
  };
  const clearCart = () => { setCart([]); saveCart([]); };

  /* Apply accent + serif to :root via inline style */
  const accentMap = {
    '#ffffff': { bg: '#ffffff', fg: '#0a0a0a' },
    '#e63946': { bg: '#e63946', fg: '#ffffff' },
    '#d4ff00': { bg: '#d4ff00', fg: '#0a0a0a' },
    '#ff6b00': { bg: '#ff6b00', fg: '#ffffff' },
  };
  const accent = accentMap[t.accent] || accentMap['#ffffff'];
  const serifFamily = t.serif === 'cormorant'
    ? `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
    : t.serif === 'bebas'
    ? `'Bebas Neue', sans-serif`
    : t.serif === 'unna'
    ? `'Unna', Georgia, serif`
    : `'Playfair Display', 'Cormorant Garamond', Georgia, serif`;

  /* Parse route */
  const parts = route.split('/').filter(Boolean);
  let screen;
  if (parts.length === 0) screen = <HomeScreen navigate={navigate} />;
  else if (parts[0] === 'lanzamientos') screen = <ArticleScreen slug={parts[1]} navigate={navigate} />;
  else if (parts[0] === 'marcas' && !parts[1]) screen = <BrandsScreen navigate={navigate} />;
  else if (parts[0] === 'marcas' && parts[1] && !parts[2]) screen = <BrandScreen brandSlug={parts[1]} navigate={navigate} />;
  else if (parts[0] === 'marcas' && parts[2] && !parts[3]) screen = <ModelScreen brandSlug={parts[1]} modelSlug={parts[2]} navigate={navigate} />;
  else if (parts[0] === 'marcas' && parts[3]) screen = <ProductScreen brandSlug={parts[1]} modelSlug={parts[2]} productId={parts[3]} navigate={navigate} addToCart={addToCart} />;
  else if (parts[0] === 'politica-cambios') screen = <PoliticaScreen navigate={navigate} />;
  else if (parts[0] === 'faq') screen = <FaqScreen navigate={navigate} />;
  else if (parts[0] === 'checkout') screen = <CheckoutScreen cart={cart} navigate={navigate} />;
  else if (parts[0] === 'pago-exitoso')  screen = <PaymentResultScreen status="exitoso"  navigate={navigate} clearCart={clearCart} />;
  else if (parts[0] === 'pago-transferencia') screen = <PaymentResultScreen status="transferencia" navigate={navigate} clearCart={clearCart} />;
  else if (parts[0] === 'pago-fallido')  screen = <PaymentResultScreen status="fallido"  navigate={navigate} />;
  else if (parts[0] === 'pago-pendiente') screen = <PaymentResultScreen status="pendiente" navigate={navigate} />;
  else if (parts[0] === 'suscripcion-confirmada') screen = <SubscriptionResultScreen ok navigate={navigate} />;
  else if (parts[0] === 'suscripcion-error')      screen = <SubscriptionResultScreen navigate={navigate} />;
  else screen = <HomeScreen navigate={navigate} />;

  return (
    <div className="bag-app" style={{ '--bag-accent': accent.bg, '--bag-accent-fg': accent.fg, '--bag-font-serif': serifFamily }}>
      <BenefitsBar />
      <Navbar route={route} navigate={navigate} cartCount={cart.length} onCartClick={() => setCartOpen(true)} />
      {screen}
      <Footer navigate={navigate} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart} onRemove={removeFromCart} navigate={navigate} clearCart={clearCart} />
      <SubscribePopup route={route} />

      {/* Botón flotante: consultar por Instagram (mensaje directo) */}
      <a
        className="bag-ig-fab"
        href="https://ig.me/m/botinesaltagamacba"
        target="_blank"
        rel="noreferrer"
        aria-label="Consultar por Instagram"
      >
        <span className="bag-ig-fab__icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </span>
        <span className="bag-ig-fab__label">Consultanos</span>
      </a>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Color de acento" />
        <TweakColor
          label="Acento"
          value={t.accent}
          options={['#ffffff', '#e63946', '#d4ff00', '#ff6b00']}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSection label="Tipografía" />
        <TweakRadio
          label="Serif"
          value={t.serif}
          options={['playfair', 'cormorant']}
          onChange={(v) => setTweak('serif', v)}
        />
      </TweaksPanel>
    </div>
  );
}


function PaymentResultScreen({ status, navigate, clearCart }) {
  useEffect(() => {
    if (status === 'exitoso' || status === 'transferencia') {
      if (clearCart) clearCart();
      try {
        const snap = JSON.parse(sessionStorage.getItem('bag:checkout_snapshot') || 'null');
        if (snap) {
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'purchase', {
              transaction_id: snap.transaction_id,
              currency: 'ARS',
              value: snap.value,
              items: snap.items,
            });
          }
          if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', {
              value: snap.value,
              currency: 'ARS',
              content_type: 'product',
              content_ids: (snap.items || []).map(i => i.item_id),
            });
          }
          sessionStorage.removeItem('bag:checkout_snapshot');
        }
      } catch {}
    }
  }, []);

  const cfg = {
    exitoso: {
      icon: '✓',
      title: '¡Pago aprobado!',
      body: 'Tu compra fue procesada con éxito. En breve te contactamos por Instagram para coordinar el envío.',
      color: '#22c55e',
    },
    transferencia: {
      icon: '⏳',
      title: '¡Pedido registrado!',
      body: 'Tu pedido quedó registrado y está pendiente de aprobación. En cuanto verifiquemos tu transferencia, te enviaremos un mail confirmando tu compra.',
      color: '#f59e0b',
    },
    pendiente: {
      icon: '⏳',
      title: 'Pago pendiente',
      body: 'Tu pago está siendo procesado. Te avisamos cuando se confirme. Si tenés dudas escribinos por Instagram.',
      color: '#f59e0b',
    },
    fallido: {
      icon: '✕',
      title: 'Pago fallido',
      body: 'No pudimos procesar tu pago. Podés intentar nuevamente o contactarnos por Instagram.',
      color: '#ff4455',
    },
  }[status] || { icon: '?', title: 'Estado desconocido', body: '', color: '#888' };

  return (
    <main className="bag-payment-result">
      <div className="bag-payment-result__box">
        <div className="bag-payment-result__icon" style={{ color: cfg.color }}>{cfg.icon}</div>
        <h1 className="bag-payment-result__title">{cfg.title}</h1>
        <p className="bag-payment-result__body">{cfg.body}</p>
        <div className="bag-payment-result__actions">
          {status !== 'exitoso' && (
            <a className="bag-btn bag-btn--ghost" href="https://ig.me/m/botinesaltagamacba" target="_blank" rel="noreferrer">Consultar por Instagram</a>
          )}
          <button className="bag-btn bag-btn--primary" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      </div>
    </main>
  );
}

function SubscriptionResultScreen({ ok, navigate }) {
  return (
    <main className="bag-payment-result">
      <div className="bag-payment-result__box">
        <div className="bag-payment-result__icon" style={{ color: ok ? '#22c55e' : '#ff4455' }}>{ok ? '✓' : '✕'}</div>
        <h1 className="bag-payment-result__title">{ok ? '¡Suscripción confirmada!' : 'No pudimos confirmar'}</h1>
        <p className="bag-payment-result__body">
          {ok
            ? '¡Listo! Ya sos parte. Vas a recibir los nuevos lanzamientos y drops antes que nadie.'
            : 'El link no es válido o ya expiró. Probá suscribirte de nuevo desde la página.'}
        </p>
        <div className="bag-payment-result__actions">
          <button className="bag-btn bag-btn--primary" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
