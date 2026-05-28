/* global React, BAG_DATA */

function BrandsScreen({ navigate }) {
  return (
    <main className="bag-brands-page">
      <header className="bag-brands-page__head">
        <nav className="bag-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
          <span>›</span>
          <span className="is-current">Marcas</span>
        </nav>
        <h1 className="bag-brands-page__title">Marcas</h1>
        <p className="bag-brands-page__intro">Las cuatro marcas que definen el fútbol moderno. Cada una con su filosofía, su tecnología y su silueta firma. Selecciona una marca para explorar sus modelos en stock.</p>
      </header>

      <section className="bag-brands-grid">
        {BAG_DATA.brands.map(b => (
          <article className="bag-brand-card" key={b.slug} onClick={() => navigate(`/marcas/${b.slug}`)}>
            <div className="bag-brand-card__media">
              <img src={b.cover} alt="" />
              <div className="bag-brand-card__overlay">
                <div className="bag-brand-card__name">{b.name}</div>
                <div className="bag-brand-card__tagline">{b.tagline}</div>
                <div className="bag-brand-card__models">
                  {b.models.map(m => m.name).join(' · ')}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function BrandScreen({ brandSlug, navigate }) {
  const brand = BAG_DATA.brands.find(b => b.slug === brandSlug) || BAG_DATA.brands[0];
  return (
    <main className="bag-brand-page">
      <header className="bag-brand-page__head">
        <nav className="bag-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}>Marcas</a>
          <span>›</span>
          <span className="is-current">{brand.name}</span>
        </nav>
        <h1 className="bag-brand-page__title">{brand.name}</h1>
        <p className="bag-brand-page__intro">{brand.tagline}</p>
      </header>

      <section className="bag-models-grid">
        {brand.models.map(m => {
          const stock = (BAG_DATA.products[`${brand.slug}/${m.slug}`] || []).length || m.stock;
          return (
            <article className="bag-model-card" key={m.slug} onClick={() => navigate(`/marcas/${brand.slug}/${m.slug}`)}>
              <div className="bag-model-card__media">
                <img src={m.image} alt="" />
              </div>
              <div className="bag-model-card__body">
                <div className="bag-eyebrow bag-eyebrow--muted">{m.tagline.toUpperCase()}</div>
                <h2 className="bag-model-card__name">{m.name}</h2>
                <div className="bag-tag">{stock} EN STOCK</div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

Object.assign(window, { BrandsScreen, BrandScreen });
