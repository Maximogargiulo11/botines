/* global React, ReactDOM, BAG_DATA */
/* global Navbar, Footer, CartDrawer */
/* global HomeScreen, ArticleScreen, BrandsScreen, BrandScreen, ModelScreen, ProductScreen, PoliticaScreen, FaqScreen */
/* global useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor */

const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ffffff",
  "serif": "playfair"
}/*EDITMODE-END*/;

/* Cart persistence */
const CART_KEY = 'bag:cart:v1';
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
}

/* Hash-based router: #/lanzamientos/foo */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

function App() {
  const route = useHashRoute();
  const navigate = (path) => { window.location.hash = path; window.scrollTo({ top: 0, behavior: 'instant' }); };

  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const addToCart = (item) => {
    const next = [...cart, { id: item.id, name: item.name, colorway: item.colorway, price: item.price, size: item.size, image: item.images?.[0], qty: 1 }];
    setCart(next); saveCart(next);
    setCartOpen(true);
  };
  const removeFromCart = (idx) => {
    const next = cart.filter((_, i) => i !== idx);
    setCart(next); saveCart(next);
  };

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
  else screen = <HomeScreen navigate={navigate} />;

  return (
    <div className="bag-app" style={{ '--bag-accent': accent.bg, '--bag-accent-fg': accent.fg, '--bag-font-serif': serifFamily }}>
      <Navbar route={route} navigate={navigate} cartCount={cart.length} onCartClick={() => setCartOpen(true)} />
      {screen}
      <Footer navigate={navigate} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart} onRemove={removeFromCart} navigate={navigate} />

      {/* Route bar for previewing all screens */}
      <RouteBar route={route} navigate={navigate} />

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

/* Tiny route bar so reviewers can hop between screens without a real router */
function RouteBar({ route, navigate }) {
  const stops = [
    { label: 'HOME', path: '/' },
    { label: 'ARTÍCULO', path: '/lanzamientos/puma-showtime-pack-future-ultra' },
    { label: 'MARCAS', path: '/marcas' },
    { label: 'MARCA', path: '/marcas/puma' },
    { label: 'MODELO', path: '/marcas/puma/future' },
    { label: 'PRODUCTO', path: '/marcas/puma/future/fut-001' },
    { label: 'POLÍTICA', path: '/politica-cambios' },
    { label: 'FAQ', path: '/faq' },
  ];
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <button className="bag-routebar bag-routebar--collapsed" onClick={() => setCollapsed(false)} title="Mostrar barra de navegación">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5 L13 5 M3 8 L13 8 M3 11 L13 11"/></svg>
      </button>
    );
  }
  return (
    <div className="bag-routebar" aria-label="Cambiar pantalla">
      <span className="bag-routebar__label">VISTAS</span>
      <span className="bag-routebar__sep" />
      {stops.map(s => (
        <button
          key={s.path}
          className={`bag-routebar__btn ${route === s.path ? 'is-active' : ''}`}
          onClick={() => navigate(s.path)}
        >{s.label}</button>
      ))}
      <button className="bag-routebar__close" onClick={() => setCollapsed(true)} aria-label="Ocultar">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
