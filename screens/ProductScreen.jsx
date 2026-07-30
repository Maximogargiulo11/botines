/* global React, BAG_DATA */
const { useState: useState_prod, useEffect: useEffect_prod } = React;

const SIZE_DATA = {
  hombre: [
    { eu: '36',   us: '4',    uk: '3',    ar: '35',   cm: '22,5' },
    { eu: '37',   us: '4½',   uk: '3½',   ar: '36',   cm: '23,0' },
    { eu: '38',   us: '5½',   uk: '4½',   ar: '37',   cm: '24,0' },
    { eu: '39',   us: '6½',   uk: '5½',   ar: '38',   cm: '24,5' },
    { eu: '40',   us: '7',    uk: '6',    ar: '39',   cm: '25,0' },
    { eu: '40,5', us: '7½',   uk: '6½',   ar: '39,5', cm: '25,5' },
    { eu: '41',   us: '8',    uk: '7',    ar: '40',   cm: '26,0' },
    { eu: '42',   us: '8½',   uk: '7½',   ar: '41',   cm: '26,5' },
    { eu: '42,5', us: '9',    uk: '8',    ar: '41,5', cm: '27,0' },
    { eu: '43',   us: '9½',   uk: '8½',   ar: '42',   cm: '27,5' },
    { eu: '44',   us: '10',   uk: '9',    ar: '43',   cm: '28,0' },
    { eu: '44,5', us: '10½',  uk: '9½',   ar: '43,5', cm: '28,5' },
    { eu: '45',   us: '11',   uk: '10',   ar: '44',   cm: '29,0' },
    { eu: '46',   us: '12',   uk: '11',   ar: '45',   cm: '30,0' },
  ],
  mujer: [
    { eu: '35',   us: '5',    uk: '2½',   ar: '34',   cm: '22,5' },
    { eu: '35,5', us: '5½',   uk: '3',    ar: '34,5', cm: '23,0' },
    { eu: '36',   us: '6',    uk: '3½',   ar: '35',   cm: '23,5' },
    { eu: '37',   us: '6½',   uk: '4',    ar: '36',   cm: '24,0' },
    { eu: '38',   us: '7',    uk: '4½',   ar: '37',   cm: '24,5' },
    { eu: '38,5', us: '7½',   uk: '5',    ar: '37,5', cm: '25,0' },
    { eu: '39',   us: '8',    uk: '5½',   ar: '38',   cm: '25,5' },
    { eu: '40',   us: '9',    uk: '6½',   ar: '39',   cm: '26,0' },
    { eu: '41',   us: '9½',   uk: '7',    ar: '40',   cm: '26,5' },
  ],
};

function SizeChart() {
  const [tab, setTab] = React.useState('hombre');
  const rows = SIZE_DATA[tab];
  const ACCENT = '#CCFF00';
  const thStyle = {
    textAlign: 'left', padding: '16px 0 12px',
    fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
    fontWeight: 700, borderBottom: '1px solid #1c1c1c', color: '#fff',
  };
  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '24px 20px', fontFamily: 'var(--bag-font-sans)' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>Tabla de Talles</h2>
      <div style={{ display: 'flex', borderBottom: '1px solid #1c1c1c', marginBottom: 0 }}>
        {['hombre', 'mujer'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 0', marginRight: 24,
            fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            fontFamily: 'inherit', fontWeight: 600,
            color: tab === t ? '#fff' : '#444',
            borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '15%' }}>EU</th>
            <th style={{ ...thStyle, width: '18%' }}>US</th>
            <th style={{ ...thStyle, width: '18%' }}>UK</th>
            <th style={{ ...thStyle, width: '18%', color: ACCENT }}>AR</th>
            <th style={{ ...thStyle, width: '31%' }}>CM del pie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.eu} style={{ borderBottom: '1px solid #141414' }}>
              <td style={{ padding: '13px 0', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>{r.eu}</td>
              <td style={{ padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#e8e8e8' }}>{r.us}</td>
              <td style={{ padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#e8e8e8' }}>{r.uk}</td>
              <td style={{ padding: '13px 0', fontSize: 15, fontWeight: 600, color: ACCENT }}>{r.ar}</td>
              <td style={{ padding: '13px 0' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{r.cm}</span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>cm</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: '20px 0 0', fontSize: 10, color: '#555', textAlign: 'center', letterSpacing: '0.06em', lineHeight: 1.8 }}>
        Los talles son orientativos · Pueden variar según fabricante y modelo
      </p>
    </div>
  );
}

function ProductScreen({ brandSlug, modelSlug, productId, navigate, addToCart }) {
  const brand = BAG_DATA.brands.find(b => b.slug === brandSlug) || BAG_DATA.brands[0];
  const model = brand.models.find(m => m.slug === modelSlug) || brand.models[0];
  const products = BAG_DATA.products[`${brandSlug}/${modelSlug}`] || [];
  const product = products.find(p => p.id === productId) || products[0];
  // Guía de talles propia de la marca (misma imagen que usa la página del modelo).
  const brandChart = (window.SIZE_CHART_IMAGES || {})[brandSlug];

  const [activeItem, setActiveItem] = useState_prod(0);
  const [unit, setUnit] = useState_prod(() => {
    const s = (product && product.sizes) || {};
    return (s.us && s.us.length) ? 'us' : ((s.uk && s.uk.length) ? 'uk' : 'us');
  });
  const [size, setSize] = useState_prod(null);
  const [showSizeModal, setShowSizeModal] = useState_prod(false);
  const [showSizeFull, setShowSizeFull] = useState_prod(false);
  const [lightbox, setLightbox] = useState_prod(false);
  const [feedback, setFeedback] = useState_prod(null);

  // Combine images and videos into a single gallery list
  const galleryItems = [
    ...(product ? product.images.map(src => ({ type: 'image', src })) : []),
    ...(product && product.videos ? product.videos.map(src => ({ type: 'video', src })) : []),
  ];
  const current = galleryItems[activeItem] || galleryItems[0];

  useEffect_prod(() => {
    if (product && typeof window.gtag === 'function') {
      window.gtag('event', 'view_item', {
        currency: 'ARS',
        value: product.price,
        items: [{ item_id: product.id, item_name: product.name, item_brand: brand.name, item_category: model.name, item_variant: product.colorway, price: product.price, quantity: 1 }],
      });
    }
  }, [product && product.id]);

  // Close lightbox on Escape
  useEffect_prod(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setLightbox(false); setShowSizeModal(false); setShowSizeFull(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!product) return <div style={{ padding: 80 }}>Producto no encontrado.</div>;

  const handleAdd = () => {
    if (!size) {
      setFeedback({ type: 'error', text: 'Selecciona un talle primero.' });
      setTimeout(() => setFeedback(null), 2400);
      return;
    }
    addToCart({ ...product, size, unit, brand: brand.name, model: model.name });
    setFeedback({ type: 'success', text: 'Agregado al carrito.' });
    setTimeout(() => setFeedback(null), 2400);
  };

  const instagramLink = 'https://ig.me/m/botinesaltagamacba';

  // US/UK: se muestran los talles cargados para la unidad elegida; todos disponibles.
  const currentSizes = (product.sizes && product.sizes[unit]) || [];
  const isAvailable = () => true;

  return (
    <main className="bag-product-page">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/marcas'); }}>Marcas</a>
        <span>›</span>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/marcas/${brand.slug}`); }}>{brand.name}</a>
        <span>›</span>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/marcas/${brand.slug}/${model.slug}`); }}>{model.name}</a>
        <span>›</span>
        <span className="is-current">{product.colorway}</span>
      </nav>

      <div className="bag-product-page__grid">
        {/* GALLERY */}
        <section className="bag-product-gallery">
          {/* Thumbs — left strip */}
          {galleryItems.length > 1 && (
            <div className="bag-product-gallery__thumbs">
              {galleryItems.map((item, i) => (
                <button
                  key={i}
                  className={`bag-product-gallery__thumb ${i === activeItem ? 'is-active' : ''} ${item.type === 'video' ? 'bag-product-gallery__thumb--video' : ''}`}
                  onClick={() => setActiveItem(i)}
                  aria-label={item.type === 'video' ? `Video ${i + 1}` : `Imagen ${i + 1}`}
                >
                  {item.type === 'video' ? (
                    <span className="bag-gallery-play-icon">
                      <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M7 5l10 5-10 5V5z"/></svg>
                    </span>
                  ) : (
                    <img src={item.src} alt="" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Main viewer */}
          <div className="bag-product-gallery__main">
            {current && current.type === 'video' ? (
              <AutoplayVideo
                key={current.src}
                src={current.src}
                className="bag-product-gallery__video"
              />
            ) : current ? (
              <img
                src={current.src}
                alt=""
                onClick={() => setLightbox(true)}
                className="bag-product-gallery__main-img"
              />
            ) : null}
          </div>
        </section>

        {/* INFO */}
        <section className="bag-product-info">
          <div className="bag-tag">{brand.name.toUpperCase()}</div>
          <h1 className="bag-product-info__name">{product.name}</h1>
          <div className="bag-product-info__colorway">{product.colorway}</div>
          <div className="bag-product-info__price">{window.formatPrice(product.price)}</div>

          <hr className="bag-rule" />

          {/* Size selector */}
          <div className="bag-eyebrow">SELECCIONA TU TALLE</div>
          <div className="bag-unit-toggle">
            {['us','uk'].map(u => (
              <button key={u} className={`bag-unit-toggle__btn ${unit === u ? 'is-active' : ''}`} onClick={() => setUnit(u)}>{u.toUpperCase()}</button>
            ))}
          </div>
          <div className="bag-size-grid">
            {currentSizes.length === 0 && (
              <p style={{ fontSize: 'var(--bag-fs-sm)', color: 'var(--bag-fg-muted)', margin: 0 }}>
                No hay talles {unit.toUpperCase()} cargados para este modelo. Consultanos por Instagram.
              </p>
            )}
            {currentSizes.map((sz, i) => {
              const available = isAvailable(sz, i);
              return (
                <button
                  key={sz}
                  className={`bag-size ${size === sz ? 'is-active' : ''}`}
                  onClick={() => available && setSize(sz)}
                  disabled={!available}
                >{sz}</button>
              );
            })}
          </div>
          <a className="bag-product-info__size-link" href="#" onClick={(e) => { e.preventDefault(); setShowSizeModal(true); }}>
            Ver tabla de talles completa →
          </a>

          {/* CTA */}
          <div className="bag-product-info__ctas">
            <button className="bag-btn bag-btn--primary bag-btn--block" onClick={handleAdd}>AGREGAR AL CARRITO</button>
            <a className="bag-btn bag-btn--ghost bag-btn--block" href={instagramLink} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>
              CONSULTAR POR INSTAGRAM
            </a>
            {feedback && (
              <div className={`bag-feedback bag-feedback--${feedback.type}`}>{feedback.text}</div>
            )}
          </div>

          <hr className="bag-rule" />

          {/* Technical details */}
          <div className="bag-eyebrow">DETALLES TÉCNICOS</div>
          <table className="bag-spec">
            <tbody>
              <tr><th>Suela</th><td>{product.spec.suela}</td></tr>
              <tr><th>Terreno</th><td>{product.spec.terreno}</td></tr>
              <tr><th>Peso</th><td>{product.spec.peso}</td></tr>
              <tr><th>Colección</th><td>{product.spec.coleccion}</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      {/* Lightbox */}
      {lightbox && current && current.type === 'image' && (
        <div className="bag-lightbox" onClick={() => setLightbox(false)}>
          <button className="bag-lightbox__close" onClick={() => setLightbox(false)} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
          </button>
          <img src={current.src} alt="" className="bag-lightbox__img" onClick={(e) => e.stopPropagation()} />
          {galleryItems.filter(i => i.type === 'image').length > 1 && (
            <div className="bag-lightbox__nav">
              <button className="bag-lightbox__arrow" onClick={(e) => { e.stopPropagation(); const images = galleryItems.map((it,i) => it.type==='image'?i:-1).filter(i=>i>=0); const pos = images.indexOf(activeItem); setActiveItem(images[(pos - 1 + images.length) % images.length]); }}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4 L6 8 L10 12"/></svg>
              </button>
              <button className="bag-lightbox__arrow" onClick={(e) => { e.stopPropagation(); const images = galleryItems.map((it,i) => it.type==='image'?i:-1).filter(i=>i>=0); const pos = images.indexOf(activeItem); setActiveItem(images[(pos + 1) % images.length]); }}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4 L10 8 L6 12"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Size modal */}
      {showSizeModal && (
        <div className="bag-modal" onClick={() => setShowSizeModal(false)}>
          <div className="bag-modal__card" onClick={(e) => e.stopPropagation()}>
            <header className="bag-modal__head">
              <div className="bag-eyebrow">TABLA DE TALLES · {brand.name.toUpperCase()}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="bag-modal__close" onClick={() => setShowSizeFull(true)} aria-label="Pantalla completa" title="Ver en pantalla completa">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"/></svg>
                </button>
                <button className="bag-modal__close" onClick={() => setShowSizeModal(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
                </button>
              </div>
            </header>
            <div style={{ cursor: 'zoom-in' }} onClick={() => setShowSizeFull(true)}>
              {brandChart
                ? <img src={brandChart} alt={`Tabla de talles ${brand.name}`} className="bag-size-chart__img" />
                : <SizeChart />}
            </div>
          </div>
        </div>
      )}

      {/* Size chart fullscreen */}
      {showSizeFull && (
        <div className="bag-sizefull" onClick={() => setShowSizeFull(false)}>
          <button className="bag-sizefull__close" onClick={() => setShowSizeFull(false)} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
          </button>
          <div className="bag-sizefull__inner" onClick={(e) => e.stopPropagation()}>
            {brandChart
              ? <img src={brandChart} alt={`Tabla de talles ${brand.name}`} className="bag-size-chart__img" />
              : <SizeChart />}
          </div>
        </div>
      )}
    </main>
  );
}

Object.assign(window, { ProductScreen });
