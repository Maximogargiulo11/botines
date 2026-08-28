/* global React */

function Footer({ navigate }) {
  return (
    <footer className="bag-footer">
      <div className="bag-footer__top">
        <a className="bag-footer__brand" href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label="Botines Alta Gama CBA">
          <img className="bag-footer__brand-img" src="assets/logo-wordmark.svg" alt="Botines Alta Gama" />
          <span className="bag-footer__brand-divider" />
          <span className="bag-footer__brand-meta">CBA</span>
        </a>
        <nav className="bag-footer__nav">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>INICIO</a>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/lanzamientos'); }}>LANZAMIENTOS</a>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}>BOTINES</a>
        </nav>
        <div className="bag-footer__social">
          <a href="https://instagram.com/botinesaltagamacba" target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>
            </svg>
          </a>
          <a href="https://ig.me/m/botinesaltagamacba" target="_blank" rel="noreferrer" aria-label="Enviar mensaje por Instagram">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </a>
        </div>
      </div>

      <div className="bag-footer__bottom">
        <div className="bag-footer__legal">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/politica-cambios'); }}>Política de cambios y devoluciones</a>
          <span className="bag-footer__sep">·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/faq'); }}>Preguntas frecuentes</a>
        </div>
        <div className="bag-footer__credit">
          <span className="bag-footer__credit-label">Desarrollado por</span>
          <a href="https://maga-agency.vercel.app/" target="_blank" rel="noreferrer">
            <img src="assets/maga-logo.png" alt="MAGA" className="bag-footer__credit-logo" />
            <span className="bag-footer__credit-url">maga-agency.vercel.app</span>
          </a>
        </div>
        <div className="bag-footer__copy">© 2026 BOTINES ALTA GAMA CBA · CÓRDOBA · ARGENTINA</div>
      </div>
    </footer>
  );
}

Object.assign(window, { Footer });
