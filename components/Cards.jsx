/* global React */

/* Hero card (full-bleed, text overlay bottom-left) */
function HeroArticle({ article, onClick }) {
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

/* Section rule with title in the middle */
function SectionRule({ label }) {
  return (
    <div className="bag-section-rule">
      <span className="bag-section-rule__label">{label}</span>
    </div>
  );
}

Object.assign(window, { HeroArticle, ArticleCard, SplitArticle, SmallArticleCard, ProductPreviewCard, SectionRule });
