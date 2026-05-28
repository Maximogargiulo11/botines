/* global React, BAG_DATA, HeroArticle, ArticleCard, SplitArticle, SmallArticleCard, ProductPreviewCard, SectionRule */

function HomeScreen({ navigate }) {
  const articles = BAG_DATA.articles;
  const hero = articles[0];
  const secondary = articles.slice(1, 5);
  const wide = articles[5];
  const small = articles.slice(2, 6);

  // Catalog preview: take first 4 products across brands
  const catalogPreview = [];
  Object.entries(BAG_DATA.products).forEach(([key, list]) => {
    if (catalogPreview.length < 4 && list.length) {
      const [brand, model] = key.split('/');
      catalogPreview.push({ product: list[0], brand, model });
    }
  });

  return (
    <main className="bag-home">
      {/* BLOQUE 1 — Hero */}
      <HeroArticle article={hero} onClick={() => navigate(`/lanzamientos/${hero.slug}`)} />

      {/* BLOQUE 2 — Grid 4 secundarios */}
      <section className="bag-grid-4">
        {secondary.map(a => (
          <ArticleCard key={a.id} article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
        ))}
      </section>

      {/* BLOQUE 3 — Split article */}
      {wide && <SplitArticle article={wide} onClick={() => navigate(`/lanzamientos/${wide.slug}`)} />}

      {/* BLOQUE 4 — Grid 4 small cards */}
      <section className="bag-grid-4 bag-grid-4--small">
        {small.map(a => (
          <SmallArticleCard key={a.id} article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
        ))}
      </section>

      {/* BLOQUE 5 — Section rule */}
      <SectionRule label="CATÁLOGO" />

      {/* BLOQUE 6 — Catalog preview */}
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
