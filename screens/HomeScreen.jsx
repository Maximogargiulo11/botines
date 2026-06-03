/* global React, BAG_DATA, HeroArticle, ArticleCard, SplitArticle, SmallArticleCard, ProductPreviewCard, SectionRule */
const { useState, useEffect, useRef } = React;

function HomeScreen({ navigate }) {
  const count    = (BAG_DATA.config && BAG_DATA.config.homepageArticleCount) || 8;
  const all      = BAG_DATA.articles.slice(0, count);

  // Featured articles go to the hero carousel; the rest fill the grids below
  const heroList = all.filter(a => a.featured);
  const restList = all.filter(a => !a.featured);

  // Fallback: no featured articles → first article as hero
  const slides   = heroList.length > 0 ? heroList : all.slice(0, 1);
  const grid     = heroList.length > 0 ? restList : all.slice(1);

  const secondary = grid.slice(0, 4);
  const wide      = grid[4];
  const small     = grid.slice(5);

  // ── Carousel ──────────────────────────────────────────────────
  const [slide, setSlide]   = useState(0);
  const timerRef            = useRef(null);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    if (slides.length > 1) {
      timerRef.current = setInterval(
        () => setSlide(s => (s + 1) % slides.length),
        5000
      );
    }
  };

  useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, []);

  const goTo = (i) => { setSlide(i); resetTimer(); };
  const prev = ()  => goTo((slide - 1 + slides.length) % slides.length);
  const next = ()  => goTo((slide + 1) % slides.length);

  // ── Catalog preview ───────────────────────────────────────────
  const catalogPreview = [];
  Object.entries(BAG_DATA.products).forEach(([key, list]) => {
    if (catalogPreview.length < 4 && list.length) {
      const [brand, model] = key.split('/');
      catalogPreview.push({ product: list[0], brand, model });
    }
  });

  return (
    <main className="bag-home">

      {/* ── Hero carousel ── */}
      <div className="bag-hero-carousel">
        <div
          className="bag-hero-carousel__track"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {slides.map(a => (
            <div key={a.id} className="bag-hero-carousel__slide">
              <HeroArticle article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <>
            <button
              className="bag-hero-carousel__arrow bag-hero-carousel__arrow--prev"
              onClick={e => { e.stopPropagation(); prev(); }}
              aria-label="Anterior"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              className="bag-hero-carousel__arrow bag-hero-carousel__arrow--next"
              onClick={e => { e.stopPropagation(); next(); }}
              aria-label="Siguiente"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            <div className="bag-hero-carousel__dots">
              {slides.map((_, i) => (
                <button
                  key={i}
                  className={`bag-hero-carousel__dot${i === slide ? ' is-active' : ''}`}
                  onClick={e => { e.stopPropagation(); goTo(i); }}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {secondary.length > 0 && (
        <section className="bag-grid-4">
          {secondary.map(a => (
            <ArticleCard key={a.id} article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
          ))}
        </section>
      )}

      {wide && <SplitArticle article={wide} onClick={() => navigate(`/lanzamientos/${wide.slug}`)} />}

      {small.length > 0 && (
        <section className="bag-grid-4 bag-grid-4--small">
          {small.map(a => (
            <SmallArticleCard key={a.id} article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
          ))}
        </section>
      )}

      <SectionRule label="CATÁLOGO" />

      <section className="bag-catalog-preview">
        <div className="bag-grid-4">
          {catalogPreview.map(({ product, brand, model }) => (
            <ProductPreviewCard
              key={product.id}
              product={product}
              brand={brand.toUpperCase()}
              model={model}
              onClick={() => navigate(`/marcas/${brand}/${model}/${product.id}`)}
            />
          ))}
        </div>
        <div className="bag-catalog-preview__cta">
          <button className="bag-btn bag-btn--ghost" onClick={() => navigate('/marcas')}>
            VER CATÁLOGO COMPLETO
            <svg viewBox="0 0 16 16" width="14" height="14" style={{ marginLeft: 8 }} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8 L13 8 M9 4 L13 8 L9 12"/></svg>
          </button>
        </div>
      </section>

    </main>
  );
}

Object.assign(window, { HomeScreen });
