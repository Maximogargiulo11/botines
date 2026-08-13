/* global React, BAG_DATA, HeroArticle, ArticleCard, SplitArticle, SmallArticleCard, ProductPreviewCard, SectionRule, FeaturedLaunch */
const { useState, useEffect, useRef } = React;

function HomeScreen({ navigate }) {
  const count    = (BAG_DATA.config && BAG_DATA.config.homepageArticleCount) || 8;
  const homeArticles = BAG_DATA.articles.filter(a => a.showInHome !== false);
  const all      = homeArticles.slice(0, count);

  // Carousel: all featured articles regardless of homepageArticleCount limit
  const heroList  = homeArticles.filter(a => a.featured);
  const slides    = heroList.length > 0 ? heroList : homeArticles.slice(0, 1);

  // Featured launches with related product (separate section below grid)
  const featuredLaunches = homeArticles.filter(a => a.relatedProduct && a.showFeaturedOnHome);
  const featuredIds      = new Set(featuredLaunches.map(a => a.id));

  // Pinned wide article (SplitArticle slot)
  const wideOverride = homeArticles.find(a => a.featuredWide);

  // Grids: excluir los del carrusel (featured), los featured launches y el wide fijado.
  // Cada artículo aparece solo donde está seleccionado (carrusel / featured launch / wide).
  const gridArticles = all.filter(a => !a.featured && !featuredIds.has(a.id) && a.id !== wideOverride?.id);
  const secondary = gridArticles.slice(0, 4);
  const wide      = wideOverride || null; // el slot central grande solo si tiene featuredWide
  const small     = gridArticles.slice(4);

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

  // ── Catalog carousel ──────────────────────────────────────────
  const catalogItems = [];
  Object.entries(BAG_DATA.products).forEach(([key, list]) => {
    const [brand, model] = key.split('/');
    list.forEach(product => catalogItems.push({ product, brand, model }));
  });
  const catalogRef = useRef(null);
  const scrollCatalog = (dir) => {
    const el = catalogRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.offsetWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <main className="bag-home">

      {/* ── Hero carousel ── */}
      <div className="bag-hero-carousel">
        <div
          className="bag-hero-carousel__track"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {slides.map((a, i) => (
            <div key={a.id} className="bag-hero-carousel__slide">
              <HeroArticle
                article={a}
                onClick={() => navigate(`/lanzamientos/${a.slug}`)}
                onProductClick={(brand, model, id) => navigate(`/marcas/${brand}/${model}/${id}`)}
                slideIndex={i}
                totalSlides={slides.length}
              />
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

      {featuredLaunches.map(a => (
        <FeaturedLaunch
          key={a.id}
          article={a}
          onClick={() => navigate(`/lanzamientos/${a.slug}`)}
          onProductClick={(brand, model, id) => navigate(`/marcas/${brand}/${model}/${id}`)}
        />
      ))}

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
        <div className="bag-catalog-carousel-wrap">
          <button className="bag-catalog-carousel__arrow bag-catalog-carousel__arrow--prev" onClick={() => scrollCatalog(-1)} aria-label="Anterior">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div className="bag-catalog-carousel" ref={catalogRef}>
            {catalogItems.map(({ product, brand, model }) => (
              <div key={product.id} className="bag-catalog-carousel__item">
                <ProductPreviewCard
                  product={product}
                  brand={brand.toUpperCase()}
                  model={model}
                  onClick={() => navigate(`/marcas/${brand}/${model}/${product.id}`)}
                />
              </div>
            ))}
          </div>
          <button className="bag-catalog-carousel__arrow bag-catalog-carousel__arrow--next" onClick={() => scrollCatalog(1)} aria-label="Siguiente">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
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
