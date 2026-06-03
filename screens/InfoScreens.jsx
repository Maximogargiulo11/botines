/* global React, BAG_DATA */

function PoliticaScreen({ navigate }) {
  const page     = (BAG_DATA.pages && BAG_DATA.pages.politica) || {};
  const intro    = page.intro    || '';
  const sections = page.sections || [];

  return (
    <main className="bag-info-page">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
        <span>›</span>
        <span className="is-current">Política de cambios y devoluciones</span>
      </nav>
      <header className="bag-info-page__head">
        <div className="bag-eyebrow bag-eyebrow--muted">LEGAL · POLÍTICA</div>
        <h1 className="bag-info-page__title">Política de cambios y devoluciones</h1>
        {intro && <p className="bag-info-page__intro">{intro}</p>}
      </header>

      <section className="bag-info-page__body">
        {sections.map((s, i) => (
          <article key={s.id || i}>
            <div className="bag-eyebrow">{String(i + 1).padStart(2, '0')}</div>
            <h2>{s.title}</h2>
            <p>{s.content}</p>
          </article>
        ))}

        <div className="bag-info-page__cta">
          <p className="bag-info-page__note">¿Tenés un caso particular? Escribinos por WhatsApp y lo resolvemos.</p>
          <a className="bag-btn bag-btn--primary" href="https://wa.me/5493516836569" target="_blank" rel="noreferrer">CONSULTAR POR WHATSAPP</a>
        </div>
      </section>
    </main>
  );
}

function FaqScreen({ navigate }) {
  const page  = (BAG_DATA.pages && BAG_DATA.pages.faq) || {};
  const intro = page.intro || '';
  const items = page.items || [];

  const [open, setOpen] = React.useState(0);

  return (
    <main className="bag-info-page">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
        <span>›</span>
        <span className="is-current">Preguntas frecuentes</span>
      </nav>
      <header className="bag-info-page__head">
        <div className="bag-eyebrow bag-eyebrow--muted">SOPORTE · FAQ</div>
        <h1 className="bag-info-page__title">Preguntas frecuentes</h1>
        {intro && <p className="bag-info-page__intro">{intro}</p>}
      </header>

      <section className="bag-faq">
        {items.map((it, i) => (
          <article key={it.id || i} className={`bag-faq__item ${open === i ? 'is-open' : ''}`}>
            <button className="bag-faq__q" onClick={() => setOpen(open === i ? -1 : i)}>
              <span className="bag-faq__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="bag-faq__q-text">{it.q}</span>
              <span className="bag-faq__icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d={open === i ? "M3 8 L13 8" : "M3 8 L13 8 M8 3 L8 13"} />
                </svg>
              </span>
            </button>
            {open === i && (
              <div className="bag-faq__a">
                <p>{it.a}</p>
              </div>
            )}
          </article>
        ))}

        <div className="bag-info-page__cta">
          <p className="bag-info-page__note">¿No encontraste lo que buscabas?</p>
          <a className="bag-btn bag-btn--primary" href="https://wa.me/5493516836569" target="_blank" rel="noreferrer">CONSULTAR POR WHATSAPP</a>
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { PoliticaScreen, FaqScreen });
