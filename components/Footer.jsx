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
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>LANZAMIENTOS</a>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}>MARCAS</a>
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
              <path d="M22 2 11 13"/>
              <path d="M22 2 15 22l-4-9-9-4 20-7z"/>
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
          Desarrollado por <a href="https://maga-agency.vercel.app/" target="_blank" rel="noreferrer">MAGA</a>
        </div>
        <div className="bag-footer__copy">© 2026 BOTINES ALTA GAMA CBA · CÓRDOBA · ARGENTINA</div>
      </div>
    </footer>
  );
}

Object.assign(window, { Footer });
