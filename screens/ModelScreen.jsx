/* global React, BAG_DATA */
const { useState: useState_model } = React;

const SIZE_CHART_IMAGES = {
  nike:   'assets/tabla-de-talles-nike.jpg',
  adidas: 'assets/tabla-de-talles-adidas.jpeg',
};

function ModelScreen({ brandSlug, modelSlug, navigate }) {
  const brand = BAG_DATA.brands.find(b => b.slug === brandSlug) || BAG_DATA.brands[0];
  const model = brand.models.find(m => m.slug === modelSlug) || brand.models[0];
  const products = BAG_DATA.products[`${brandSlug}/${modelSlug}`] || [];

  const [chartOpen, setChartOpen] = useState_model(false);
  const sizeChartSrc = SIZE_CHART_IMAGES[brandSlug];

  return (
    <main className="bag-model-page">
      <header className="bag-model-page__head">
        <nav className="bag-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}>Marcas</a>
          <span>›</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/marcas/${brand.slug}`); }}>{brand.name}</a>
          <span>›</span>
          <span className="is-current">{model.name}</span>
        </nav>
        <button className="bag-back" onClick={() => navigate(`/marcas/${brand.slug}`)}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 8 L3 8 M7 4 L3 8 L7 12"/></svg>
          VOLVER
        </button>
        <div className="bag-eyebrow bag-eyebrow--muted">{brand.name.toUpperCase()} · {model.tagline.toUpperCase()}</div>
        <h1 className="bag-model-page__title">{model.name}</h1>
        <p className="bag-model-page__intro">{products.length} productos en stock · Todos los talles indicados son los disponibles en este momento.</p>

        {sizeChartSrc && (
          <div className="bag-size-chart">
            <button
              className={`bag-size-chart__toggle ${chartOpen ? 'is-open' : ''}`}
              onClick={() => setChartOpen(o => !o)}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="16" height="16" rx="2"/>
                <path d="M2 7 L18 7 M2 13 L18 13 M7 7 L7 18 M13 7 L13 18"/>
              </svg>
              TABLA DE TALLES
              <svg className="bag-size-chart__chevron" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6 L8 10 L12 6"/>
              </svg>
            </button>
            {chartOpen && (
              <div className="bag-size-chart__body">
                <img src={sizeChartSrc} alt={`Tabla de talles ${brand.name}`} className="bag-size-chart__img" />
                <p className="bag-size-chart__note">Usá esta tabla para encontrar tu equivalencia de talle (US / UK).</p>
              </div>
            )}
          </div>
        )}
      </header>

      {products.length === 0 && (
        <div className="bag-empty-state">
          <div className="bag-eyebrow bag-eyebrow--muted">Sin stock</div>
          <p>Estamos esperando reposición de este modelo. Consultá disponibilidad por Instagram.</p>
          <a className="bag-btn bag-btn--ghost" href="https://ig.me/m/botinesaltagamacba" target="_blank" rel="noreferrer">CONSULTAR POR INSTAGRAM</a>
        </div>
      )}

      <section className="bag-products-grid">
        {/* Más nuevos primero: se muestran en orden inverso al de carga (los últimos agregados arriba) */}
        {[...products].reverse().map(p => (
          <article className="bag-product-grid-card" key={p.id} onClick={() => navigate(`/marcas/${brandSlug}/${modelSlug}/${p.id}`)}>
            <div className="bag-product-grid-card__media">
              <img src={p.images[0]} alt="" />
            </div>
            <div className="bag-product-grid-card__body">
              <div className="bag-tag">{p.colorway.toUpperCase()}</div>
              <div className="bag-product-grid-card__name">{p.name}</div>
              <div className="bag-product-grid-card__price">{window.formatPrice(p.price)}</div>
              <div className="bag-product-grid-card__sizes">
                {(() => {
                  const list = (p.sizes && p.sizes.us && p.sizes.us.length) ? p.sizes.us : ((p.sizes && p.sizes.uk) || []);
                  return list.slice(0, 6).map(sz => <span key={sz} className="bag-size">{sz}</span>)
                    .concat(list.length > 6 ? [<span key="more" className="bag-product-grid-card__size-more">+{list.length - 6}</span>] : []);
                })()}
              </div>
              <button className="bag-btn bag-btn--ghost bag-btn--block">VER DETALLE</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

Object.assign(window, { ModelScreen, SIZE_CHART_IMAGES });
