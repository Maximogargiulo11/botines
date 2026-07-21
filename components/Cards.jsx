/* global React, BAG_DATA */

/* Hero card (full-bleed, text overlay bottom-left) */
function HeroArticle({ article, onClick, onProductClick, slideIndex, totalSlides }) {
  let relProduct = null, relBrand = null, relModel = null;
  if (article.relatedProduct && BAG_DATA && BAG_DATA.products) {
    const { brand, model, colorwayId } = article.relatedProduct;
    const list = BAG_DATA.products[`${brand}/${model}`] || [];
    relProduct = list.find(p => p.id === colorwayId) || null;
    relBrand = brand;
    relModel = model;
  }
  const pad = n => String(n).padStart(2, '0');

  return (
    <article className="bag-hero" onClick={onClick}>
      <div className="bag-hero__media">
        <img src={article.imagenCarrusel || article.cover} alt="" />
      </div>
      <div className="bag-hero__overlay">
        <div className="bag-hero__body">
          <div className="bag-eyebrow">{article.category} · {article.brand?.toUpperCase()}</div>
          <h1 className="bag-hero__title">{article.title}</h1>
          <p className="bag-hero__excerpt">{article.excerpt}</p>
        </div>
      </div>
      {relProduct && (
        <div className="bag-hero-drop" onClick={e => e.stopPropagation()}>
          <div className="bag-hero-drop__head">
            <span className="bag-hero-drop__badge">NUEVO DROP</span>
            {totalSlides > 1 && (
              <span className="bag-hero-drop__count">{pad(slideIndex + 1)} / {pad(totalSlides)}</span>
            )}
          </div>
          <div className="bag-hero-drop__img">
            <img src={relProduct.images?.[0] || ''} alt="" />
          </div>
          <div className="bag-hero-drop__info">
            <div className="bag-hero-drop__eyebrow">{relBrand?.toUpperCase()} · {relModel?.toUpperCase()}</div>
            <div className="bag-hero-drop__name">{relProduct.name}</div>
            <div className="bag-hero-drop__price">{window.formatPrice(relProduct.price)}</div>
            <button
              className="bag-hero-drop__cta"
              onClick={() => onProductClick && onProductClick(relBrand, relModel, relProduct.id)}
            >
              VER FICHA →
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* Standard article card (image top, eyebrow, title, date) */
function ArticleCard({ article, size = 'md', onClick }) {
  const cardImg = article.imagenCard || article.cover;
  return (
    <article className={`bag-article-card bag-article-card--${size}`} onClick={onClick}>
      <div className="bag-article-card__media">
        <img src={cardImg} alt="" />
      </div>
      <div className="bag-article-card__body">
        <div className="bag-eyebrow bag-eyebrow--muted">{article.category}</div>
        <h3 className="bag-article-card__title">{article.title}</h3>
        <div className="bag-meta">{article.date}</div>
      </div>
    </article>
  );
}

/* Wide split article (image right 60%, text left 40%) */
function SplitArticle({ article, onClick }) {
  return (
    <article className="bag-split" onClick={onClick}>
      <div className="bag-split__text">
        <div className="bag-eyebrow">{article.category} · {article.brand?.toUpperCase()}</div>
        <h2 className="bag-split__title">{article.title}</h2>
        <p className="bag-split__excerpt">{article.excerpt}</p>
        <div className="bag-meta">{article.date}</div>
      </div>
      <div className="bag-split__media">
        <img src={article.cover} alt="" />
      </div>
    </article>
  );
}

/* Small article card — grid of 4 */
function SmallArticleCard({ article, onClick }) {
  const cardImg = article.imagenCard || article.cover;
  return (
    <article className="bag-small-card" onClick={onClick}>
      <div className="bag-small-card__media"><img src={cardImg} alt="" /></div>
      <div className="bag-eyebrow bag-eyebrow--muted">{article.category}</div>
      <h4 className="bag-small-card__title">{article.title}</h4>
    </article>
  );
}

/* Product preview card (catalog) */
function ProductPreviewCard({ product, brand, model, onClick }) {
  return (
    <article className="bag-product-preview" onClick={onClick}>
      <div className="bag-product-preview__media">
        <img src={product.images?.[0] || 'assets/placeholder-product.svg'} alt="" />
      </div>
      <div className="bag-product-preview__body">
        <div className="bag-eyebrow bag-eyebrow--muted">{brand}</div>
        <div className="bag-product-preview__name">{product.name}</div>
        <div className="bag-product-preview__colorway">{product.colorway}</div>
        <div className="bag-product-preview__price">{window.formatPrice(product.price)}</div>
      </div>
    </article>
  );
}

/* Featured launch — full-width card with article bg + related product panel */
function FeaturedLaunch({ article, onClick, onProductClick }) {
  let relProduct = null, relBrand = null, relModel = null;
  if (article.relatedProduct && BAG_DATA && BAG_DATA.products) {
    const { brand, model, colorwayId } = article.relatedProduct;
    const list = BAG_DATA.products[`${brand}/${model}`] || [];
    relProduct = list.find(p => p.id === colorwayId) || null;
    relBrand = brand;
    relModel = model;
  }

  const sizes = (relProduct?.sizes?.us?.length ? relProduct.sizes.us : relProduct?.sizes?.uk) || [];
  const sizeRange = sizes.length > 1
    ? `${sizes[0]} – ${sizes[sizes.length - 1]}`
    : sizes[0] || '';

  return (
    <article className="bag-featured-launch" onClick={onClick}>
      <div className="bag-featured-launch__bg">
        <img src={article.imagenCarrusel || article.cover} alt="" />
        <div className="bag-featured-launch__overlay" />
      </div>

      <div className="bag-featured-launch__content">
        <div className="bag-eyebrow">{article.category} · {article.date}</div>
        <h2 className="bag-featured-launch__title">{article.title}</h2>
        {article.excerpt && <p className="bag-featured-launch__excerpt">{article.excerpt}</p>}
        <div className="bag-featured-launch__actions">
          <button
            className="bag-btn"
            onClick={onClick}
          >
            VER LANZAMIENTO →
          </button>
          {relProduct && (
            <button
              className="bag-btn bag-btn--ghost"
              onClick={e => { e.stopPropagation(); onProductClick && onProductClick(relBrand, relModel, relProduct.id); }}
            >
              VER FICHA
            </button>
          )}
        </div>
        {relProduct && (
          <div className="bag-featured-launch__meta">
            {relProduct.colorway && <span>COLORWAY: {relProduct.colorway}</span>}
            {sizeRange && <span>TALLES: {sizeRange}</span>}
            <span>PRECIO: {window.formatPrice(relProduct.price)}</span>
          </div>
        )}
      </div>

      {relProduct && (
        <div
          className="bag-featured-launch__card"
          onClick={e => { e.stopPropagation(); onProductClick && onProductClick(relBrand, relModel, relProduct.id); }}
        >
          <div className="bag-featured-launch__card-head">
            <span className="bag-featured-launch__card-badge">NUEVO DROP</span>
          </div>
          <div className="bag-featured-launch__card-img">
            <img src={relProduct.images?.[0] || ''} alt="" />
          </div>
          <div className="bag-featured-launch__card-info">
            <div className="bag-featured-launch__card-eyebrow">{relBrand?.toUpperCase()} · {relModel?.toUpperCase()}</div>
            <div className="bag-featured-launch__card-name">{relProduct.name}</div>
            <div className="bag-featured-launch__card-price">{window.formatPrice(relProduct.price)}</div>
            <span className="bag-featured-launch__card-cta">VER FICHA →</span>
          </div>
        </div>
      )}
    </article>
  );
}

/* Section rule with title in the middle */
function SectionRule({ label }) {
  return (
    <div className="bag-section-rule">
      <span className="bag-section-rule__label">{label}</span>
    </div>
  );
}

Object.assign(window, { HeroArticle, ArticleCard, SplitArticle, SmallArticleCard, ProductPreviewCard, SectionRule, FeaturedLaunch });
