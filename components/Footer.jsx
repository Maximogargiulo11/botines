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
          <a href="https://wa.me/5493516836569" target="_blank" rel="noreferrer" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3.4-7.04L21 4l-.96 3.4A8.96 8.96 0 0 1 21 12z"/>
              <path d="M8.6 9.3c.15-.5.55-.8 1-.85.4 0 .8.04 1 .5.2.45.6 1.55.65 1.65.05.15-.05.3-.2.45-.15.15-.4.4-.55.5-.15.15-.25.3-.1.5.95 1.6 2.2 2.7 3.7 3.45.25.1.4.05.5-.1.1-.15.4-.5.55-.7.15-.2.3-.15.5-.1.2.1 1.3.6 1.5.7.2.1.35.15.4.25.05.1.05.55-.15 1.1-.2.55-1.1 1.05-1.6 1.1-.45.05-1.05.05-1.7-.1-.45-.1-.95-.3-1.55-.6-2.7-1.2-4.55-3.95-4.7-4.15-.15-.2-1.1-1.45-1.1-2.8 0-1.35.7-2 .95-2.25.25-.25.5-.25.7-.25h.45c.15 0 .35-.05.55.4.2.5.7 1.65.75 1.8.05.1.05.25 0 .4z"/>
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
        <div className="bag-footer__copy">© 2026 BOTINES ALTA GAMA CBA · CÓRDOBA · ARGENTINA</div>
      </div>
    </footer>
  );
}

Object.assign(window, { Footer });
