/* global React, BAG_DATA */
const { useState: useState_prod } = React;

function ProductScreen({ brandSlug, modelSlug, productId, navigate, addToCart }) {
  const brand = BAG_DATA.brands.find(b => b.slug === brandSlug) || BAG_DATA.brands[0];
  const model = brand.models.find(m => m.slug === modelSlug) || brand.models[0];
  const products = BAG_DATA.products[`${brandSlug}/${modelSlug}`] || [];
  const product = products.find(p => p.id === productId) || products[0];

  const [activeImage, setActiveImage] = useState_prod(0);
  const [unit, setUnit] = useState_prod('eu');
  const [size, setSize] = useState_prod(null);
  const [showSizeModal, setShowSizeModal] = useState_prod(false);
  const [feedback, setFeedback] = useState_prod(null);

  if (!product) return <div style={{ padding: 80 }}>Producto no encontrado.</div>;

  const handleAdd = () => {
    if (!size) {
      setFeedback({ type: 'error', text: 'Selecciona un talle primero.' });
      setTimeout(() => setFeedback(null), 2400);
      return;
    }
    addToCart({ ...product, size, brand: brand.name, model: model.name });
    setFeedback({ type: 'success', text: 'Agregado al carrito.' });
    setTimeout(() => setFeedback(null), 2400);
  };

  const whatsappLink = () => {
    const t = size || '—';
    const msg = encodeURIComponent(`Hola! Me interesa el ${product.name} colorway ${product.colorway} en talle ${t} ${unit.toUpperCase()}. ¿Está disponible?`);
    return `https://wa.me/5493516836569?text=${msg}`;
  };

  const currentSizes = product.sizes[unit];
  const eqAvailable = (idx) => product.availableSizes.includes(product.sizes.eu[idx]);

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
          <div className="bag-product-gallery__main">
            <img src={product.images[activeImage]} alt="" />
          </div>
          {product.images.length > 1 && (
            <div className="bag-product-gallery__thumbs">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  className={`bag-product-gallery__thumb ${i === activeImage ? 'is-active' : ''}`}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Imagen ${i + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
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
            {['us','uk','eu'].map(u => (
              <button key={u} className={`bag-unit-toggle__btn ${unit === u ? 'is-active' : ''}`} onClick={() => setUnit(u)}>{u.toUpperCase()}</button>
            ))}
          </div>
          <div className="bag-size-grid">
            {currentSizes.map((sz, i) => {
              const available = eqAvailable(i);
              const euSize = product.sizes.eu[i];
              return (
                <button
                  key={sz}
                  className={`bag-size ${size === euSize ? 'is-active' : ''}`}
                  onClick={() => available && setSize(euSize)}
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
            <a className="bag-btn bag-btn--ghost bag-btn--block" href={whatsappLink()} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 12a9 9 0 1 1-3.4-7.04L21 4l-.96 3.4A8.96 8.96 0 0 1 21 12z"/></svg>
              CONSULTAR POR WHATSAPP
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

      {/* Size modal */}
      {showSizeModal && (
        <div className="bag-modal" onClick={() => setShowSizeModal(false)}>
          <div className="bag-modal__card" onClick={(e) => e.stopPropagation()}>
            <header className="bag-modal__head">
              <div className="bag-eyebrow">TABLA DE TALLES UNIVERSAL</div>
              <button className="bag-modal__close" onClick={() => setShowSizeModal(false)} aria-label="Cerrar">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
              </button>
            </header>
            <table className="bag-size-table">
              <thead>
                <tr><th>US</th><th>UK</th><th>EU</th><th>CM</th></tr>
              </thead>
              <tbody>
                {[
                  ['6','5','38','24'],['6.5','5.5','39','24.5'],['7','6','40','25'],
                  ['7.5','6.5','40.5','25.5'],['8','7','41','26'],['9','8','42','27'],
                  ['9.5','8.5','42.5','27.5'],['10','9','43','28'],['10.5','9.5','44','28.5'],
                  ['11','10','45','29'],
                ].map(([u, k, e, cm]) => (
                  <tr key={e}><td>{u}</td><td>{k}</td><td>{e}</td><td>{cm}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="bag-modal__note">Tabla de referencia universal. Los talles disponibles pueden variar por modelo y colorway.</p>
          </div>
        </div>
      )}
    </main>
  );
}

Object.assign(window, { ProductScreen });
