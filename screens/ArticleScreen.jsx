/* global React, BAG_DATA, SmallArticleCard, SectionRule */
const { useState: useState_art, useRef: useRef_art } = React;

function getVideoEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}`;
  return null;
}

function ArticleScreen({ slug, navigate }) {
  const article = BAG_DATA.articles.find(a => a.slug === slug) || BAG_DATA.articles[0];
  const related = BAG_DATA.articles.filter(a => a.id !== article.id).slice(0, 6);

  const [copied, setCopied] = useState_art(false);
  const [videoMuted, setVideoMuted] = useState_art(false);
  const videoRef = useRef_art(null);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setVideoMuted(true);
      v.play().catch(() => {});
    });
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted(v.muted);
  };
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  let relProductObj = null;
  if (article.relatedProduct) {
    const list = BAG_DATA.products[`${article.relatedProduct.brand.toLowerCase()}/${article.relatedProduct.model}`] || [];
    relProductObj = list.find(p => p.id === article.relatedProduct.id) || list[0];
  }

  // Render the related product aside
  const RelatedProduct = relProductObj ? (
    <aside className="bag-related-product">
      <div className="bag-related-product__media">
        <img src={relProductObj.images?.[0]} alt="" />
      </div>
      <div className="bag-related-product__body">
        <div className="bag-eyebrow bag-eyebrow--muted">{article.brand?.toUpperCase()}</div>
        <div className="bag-related-product__name">{relProductObj.name}</div>
        <div className="bag-related-product__colorway">{relProductObj.colorway}</div>
        <div className="bag-related-product__price">{window.formatPrice(relProductObj.price)}</div>
        <button className="bag-btn bag-btn--primary" onClick={() => navigate(`/marcas/${article.relatedProduct.brand.toLowerCase()}/${article.relatedProduct.model}`)}>
          VER EN CATÁLOGO
        </button>
      </div>
    </aside>
  ) : null;

  // Render body: use contentBlocks if available, else fall back to legacy body/gallery
  function renderBody() {
    if (article.contentBlocks && article.contentBlocks.length > 0) {
      let textCount = 0;
      return article.contentBlocks.map((block, i) => {
        if (block.type === 'text') {
          textCount++;
          return (
            <React.Fragment key={block.id || i}>
              <p>{block.content}</p>
              {textCount === 2 && RelatedProduct}
            </React.Fragment>
          );
        }
        if (block.type === 'image') {
          const style = {};
          if (block.width && block.height) {
            style.aspectRatio = `${block.width} / ${block.height}`;
          }
          return (
            <figure key={block.id || i} className="bag-article-figure" style={style}>
              <img src={block.src} alt="" />
              {block.width && block.height && (
                <figcaption className="bag-article-figure__dim">{block.width}×{block.height}</figcaption>
              )}
            </figure>
          );
        }
        if (block.type === 'instagram') {
          return (
            <div key={block.id || i} className="bag-instagram-embed">
              <div className="bag-eyebrow bag-eyebrow--muted">VER EN INSTAGRAM</div>
              <div className="bag-instagram-embed__frame">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="4"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>
                </svg>
                <a className="bag-instagram-embed__link" href={block.url} target="_blank" rel="noreferrer">
                  @botinesaltagamacba
                </a>
              </div>
            </div>
          );
        }
        if (block.type === 'image-pair') {
          return (
            <div key={block.id || i} className="bag-article-figure-pair">
              {block.left?.src && (
                <figure className="bag-article-figure bag-article-figure--half">
                  <img src={block.left.src} alt="" />
                </figure>
              )}
              {block.right?.src && (
                <figure className="bag-article-figure bag-article-figure--half">
                  <img src={block.right.src} alt="" />
                </figure>
              )}
            </div>
          );
        }
        if (block.type === 'video') {
          const embedUrl = getVideoEmbedUrl(block.src);
          return (
            <div key={block.id || i} className="bag-article-video-wrap">
              {embedUrl ? (
                <div className="bag-article-video-embed">
                  <iframe src={embedUrl} allowFullScreen title="video" />
                </div>
              ) : block.src ? (
                <video src={block.src} controls playsInline className="bag-article-video" />
              ) : null}
            </div>
          );
        }
        return null;
      });
    }

    // Legacy format fallback
    return (article.body || []).map((p, i) => (
      <React.Fragment key={i}>
        <p>{p}</p>
        {i === 0 && article.gallery && article.gallery[0] && (
          <figure className="bag-article-figure">
            <img src={article.gallery[0]} alt="" />
          </figure>
        )}
        {i === 1 && RelatedProduct}
        {i === 2 && article.gallery && article.gallery[1] && (
          <figure className="bag-article-figure">
            <img src={article.gallery[1]} alt="" />
          </figure>
        )}
      </React.Fragment>
    ));
  }

  return (
    <main className="bag-article-page">
      <div className="bag-article-hero">
        <div className="bag-article-hero__blur" style={{ backgroundImage: `url(${article.cover})` }} />
        {article.coverVideo ? (
          <div className="bag-article-hero__video">
            {getVideoEmbedUrl(article.coverVideo) ? (
              <div className="bag-article-hero__video-embed">
                <iframe src={getVideoEmbedUrl(article.coverVideo)} allowFullScreen title="video portada" />
              </div>
            ) : (
              <>
                <video ref={videoRef} src={article.coverVideo} playsInline loop className="bag-article-hero__video-player" />
                <button className="bag-video-mute-btn" onClick={toggleMute} aria-label={videoMuted ? 'Activar sonido' : 'Silenciar'}>
                  {videoMuted ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bag-article-hero__image" style={article.coverWidth && article.coverHeight ? { aspectRatio: `${article.coverWidth} / ${article.coverHeight}`, overflow: 'hidden' } : {}}>
            <img src={article.cover} alt="" style={article.coverWidth && article.coverHeight ? { width: '100%', height: '100%', objectFit: 'contain', display: 'block' } : {}} />
          </div>
        )}
      </div>

      <div className="bag-article-head">
        <nav className="bag-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
          <span>›</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Lanzamientos</a>
          <span>›</span>
          <span className="is-current">{article.title}</span>
        </nav>
        <div className="bag-eyebrow">{article.category} · {article.brand?.toUpperCase()}</div>
        <h1 className="bag-article-head__title">{article.title}</h1>
        <div className="bag-article-head__meta">
          <span className="bag-meta">{article.date}</span>
          <div className="bag-article-head__share">
            <a href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 22V12h3l.5-4H14V5.5c0-1 .3-1.7 1.8-1.7H17V.3C16.7.2 15.6 0 14.4 0c-2.6 0-4.4 1.6-4.4 4.5V8H7v4h3v10h4z"/></svg>
            </a>
            <a href="#" aria-label="X / Twitter" onClick={(e) => e.preventDefault()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2H21l-6.54 7.47L22 22h-6.94l-4.94-6.5L4.6 22H2l7.03-8.03L2 2h7.1l4.46 5.95L18.24 2zm-1.22 18h1.85L7.06 4H5.1l11.92 16z"/></svg>
            </a>
            <a href="#" aria-label="WhatsApp" onClick={(e) => e.preventDefault()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.4-7.04L21 4l-.96 3.4A8.96 8.96 0 0 1 21 12z"/><path d="M8.6 9.3c.15-.5.55-.8 1-.85.4 0 .8.04 1 .5.2.45.6 1.55.65 1.65.05.15-.05.3-.2.45-.15.15-.4.4-.55.5-.15.15-.25.3-.1.5.95 1.6 2.2 2.7 3.7 3.45.25.1.4.05.5-.1.1-.15.4-.5.55-.7.15-.2.3-.15.5-.1.2.1 1.3.6 1.5.7.2.1.35.15.4.25.05.1.05.55-.15 1.1-.2.55-1.1 1.05-1.6 1.1z"/></svg>
            </a>
            <button onClick={copyLink} aria-label="Copiar link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
              {copied && <span className="bag-share-toast">Copiado</span>}
            </button>
          </div>
        </div>
      </div>

      {((article.sizesUS && article.sizesUS.length > 0) || (article.sizesUK && article.sizesUK.length > 0)) && (
        <div className="bag-article-sizes">
          {article.sizesUS && article.sizesUS.length > 0 && (
            <div className="bag-article-sizes__row">
              <span className="bag-article-sizes__label">US</span>
              <div className="bag-article-sizes__chips">
                {article.sizesUS.map(s => <span key={s} className="bag-article-sizes__chip">{s}</span>)}
              </div>
            </div>
          )}
          {article.sizesUK && article.sizesUK.length > 0 && (
            <div className="bag-article-sizes__row">
              <span className="bag-article-sizes__label">UK</span>
              <div className="bag-article-sizes__chips">
                {article.sizesUK.map(s => <span key={s} className="bag-article-sizes__chip">{s}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      <article className="bag-article-body">
        {renderBody()}
      </article>

      <SectionRule label="MÁS LANZAMIENTOS" />
      <section className="bag-grid-3">
        {related.map(a => (
          <SmallArticleCard key={a.id} article={a} onClick={() => navigate(`/lanzamientos/${a.slug}`)} />
        ))}
      </section>
    </main>
  );
}

Object.assign(window, { ArticleScreen });
