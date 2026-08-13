/* global React */
const { useState, useEffect, useRef } = React;

/* ====================================================================
   Navbar
   - Variante elegida: logo top-left, separador fino debajo, links abajo
   - Hover dropdown en MARCAS
   - Carrito a la derecha con contador
   ==================================================================== */
function Navbar({ route, navigate, cartCount, onCartClick }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownTimer = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openDropdown = () => {
    clearTimeout(dropdownTimer.current);
    setDropdownOpen(true);
  };
  const closeDropdownDeferred = () => {
    dropdownTimer.current = setTimeout(() => setDropdownOpen(false), 120);
  };

  const brands = [
    { slug: 'adidas', name: 'Adidas' },
    { slug: 'nike', name: 'Nike' },
    { slug: 'puma', name: 'Puma' },
  ];

  return (
    <header className={`bag-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="bag-nav__inner">
        <a className="bag-nav__brand" href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label="Botines Alta Gama CBA">
          <img className="bag-nav__brand-img" src="assets/logo-altagama-transparent.png" alt="Botines Alta Gama" />
        </a>

        {/* Mobile burger */}
        <button
          className="bag-nav__burger"
          aria-label="Abrir menú"
          onClick={() => setMobileOpen(v => !v)}
        >
          <span /><span /><span />
        </button>

        {/* Center nav (desktop) */}
        <nav className="bag-nav__center" aria-label="Navegación principal">
          <a
            className={`bag-nav__link ${route.startsWith('/lanzamientos') || route === '/' ? 'is-active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
          >LANZAMIENTOS</a>
          <div
            className="bag-nav__dropdown-wrap"
            onMouseEnter={openDropdown}
            onMouseLeave={closeDropdownDeferred}
          >
            <a
              className={`bag-nav__link ${route.startsWith('/marcas') ? 'is-active' : ''}`}
              href="#"
              onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}
            >
              BOTINES
              <svg viewBox="0 0 12 12" width="10" height="10" style={{ marginLeft: 6, opacity: 0.6 }} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 4 L6 8 L10 4"/></svg>
            </a>
            {dropdownOpen && (
              <div className="bag-nav__dropdown" onMouseEnter={openDropdown} onMouseLeave={closeDropdownDeferred}>
                {brands.map(b => (
                  <a
                    key={b.slug}
                    href="#"
                    className="bag-nav__dropdown-item"
                    onClick={(e) => { e.preventDefault(); setDropdownOpen(false); navigate(`/marcas/${b.slug}`); }}
                  >{b.name}</a>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right: cart */}
        <button className="bag-nav__cart" onClick={onCartClick} aria-label={`Carrito (${cartCount})`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14l-1.5 11.5a2 2 0 0 1-2 1.75h-7a2 2 0 0 1-2-1.75L5 7z"/>
            <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
          </svg>
          {cartCount > 0 && <span className="bag-nav__cart-badge">{cartCount}</span>}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="bag-nav__mobile">
          <a href="#" onClick={(e) => { e.preventDefault(); setMobileOpen(false); navigate('/'); }}>LANZAMIENTOS</a>
          <div className="bag-nav__mobile-group">
            <div className="bag-nav__mobile-group-label">BOTINES</div>
            {brands.map(b => (
              <a key={b.slug} href="#" className="bag-nav__mobile-sub" onClick={(e) => { e.preventDefault(); setMobileOpen(false); navigate(`/marcas/${b.slug}`); }}>{b.name}</a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

Object.assign(window, { Navbar });
