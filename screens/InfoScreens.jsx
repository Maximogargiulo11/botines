/* global React */

function PoliticaScreen({ navigate }) {
  return (
    <main className="bag-info-page">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
        <span>›</span>
        <span className="is-current">Política de cambios y devoluciones</span>
      </nav>
      <header className="bag-info-page__head">
        <div className="bag-eyebrow bag-eyebrow--muted">LEGAL · POLÍTICA</div>
        <h1 className="bag-info-page__title">Política de cambios y devoluciones</h1>
        <p className="bag-info-page__intro">Vendemos botines de alta gama originales, importados y con stock real. Estas son las condiciones bajo las que aceptamos cambios y devoluciones — diseñadas para protegerte a vos y al producto.</p>
      </header>

      <section className="bag-info-page__body">
        <article>
          <div className="bag-eyebrow">01</div>
          <h2>Plazo de cambio</h2>
          <p>Tenés <strong>siete (7) días corridos</strong> desde la recepción del paquete para solicitar un cambio de talle o modelo. El reclamo se inicia por WhatsApp al +54 9 351 683-6569.</p>
        </article>

        <article>
          <div className="bag-eyebrow">02</div>
          <h2>Estado del producto</h2>
          <p>El botín debe devolverse <strong>sin uso, sin marcas en la suela y con todos los herrajes y empaques originales</strong>: caja, bolsa interior, tarjetas y stickers. Productos con marcas de uso en césped, sintético o cancha no se aceptan.</p>
        </article>

        <article>
          <div className="bag-eyebrow">03</div>
          <h2>Cambios por talle</h2>
          <p>Si el modelo está disponible en otro talle al momento del reclamo, el cambio es directo. El costo de envío de retorno y el nuevo despacho corre por cuenta del comprador, salvo error nuestro al despachar.</p>
        </article>

        <article>
          <div className="bag-eyebrow">04</div>
          <h2>Devoluciones con reintegro</h2>
          <p>Devolvemos el <strong>100% del valor pagado</strong> en la misma forma de pago original. Transferencias bancarias se acreditan en 48 a 72hs hábiles desde la recepción y verificación del producto en nuestro depósito.</p>
        </article>

        <article>
          <div className="bag-eyebrow">05</div>
          <h2>Defectos de fábrica</h2>
          <p>Todos nuestros botines tienen garantía oficial del fabricante. Si detectás un defecto de fábrica, contactanos con fotos y descripción del problema. El reemplazo o reintegro es total y los costos de envío los cubrimos nosotros.</p>
        </article>

        <article>
          <div className="bag-eyebrow">06</div>
          <h2>Productos en liquidación</h2>
          <p>Los modelos marcados como <em>outlet</em> o <em>última unidad</em> admiten cambio por talle dentro del mismo modelo, pero <strong>no admiten devolución con reintegro</strong>. Está aclarado en la ficha del producto.</p>
        </article>

        <div className="bag-info-page__cta">
          <p className="bag-info-page__note">¿Tenés un caso particular? Escribinos por WhatsApp y lo resolvemos.</p>
          <a className="bag-btn bag-btn--primary" href="https://wa.me/5493516836569" target="_blank" rel="noreferrer">CONSULTAR POR WHATSAPP</a>
        </div>
      </section>
    </main>
  );
}

function FaqScreen({ navigate }) {
  const items = [
    {
      q: '¿Los botines son originales?',
      a: 'Sí, todos los productos son originales e importados directamente desde proveedores oficiales o mercados europeos y norteamericanos. Cada par viene con su caja, etiquetas y herrajes originales del fabricante.',
    },
    {
      q: '¿Cómo sé qué talle pedir?',
      a: 'En cada ficha de producto vas a encontrar un selector con equivalencias US, UK y EU. Si todavía tenés dudas, abrí la tabla universal completa con conversión en CM, o escribinos por WhatsApp con tu talle habitual y el modelo que querés.',
    },
    {
      q: '¿Hacen envíos a todo el país?',
      a: 'Sí. Despachamos por Andreani, Correo Argentino y Vía Cargo dentro de las 24hs hábiles posteriores al pago confirmado. Envíos a Córdoba Capital: misma tarde o día siguiente. El costo varía según destino y se calcula al cerrar el pedido.',
    },
    {
      q: '¿Qué formas de pago aceptan?',
      a: 'Transferencia bancaria (mejor precio), tarjetas de crédito con 3 y 6 cuotas sin interés, débito, MercadoPago y efectivo en sucursal Córdoba. Los precios mostrados son con transferencia; otras formas pueden tener recargo.',
    },
    {
      q: '¿Puedo retirar en una sucursal física?',
      a: 'Sí. Tenemos showroom en barrio General Paz, Córdoba Capital, con visita previa coordinada por WhatsApp. Ahí podés probar el botín antes de pagar y consultar por modelos que no estén en la web.',
    },
    {
      q: '¿Reservan stock?',
      a: 'Reservamos talle y modelo hasta por 24hs con seña del 30%. Sin seña, el stock se vende por orden de llegada — nuestro inventario es real y rota rápido.',
    },
    {
      q: '¿Tienen modelos para terreno sintético?',
      a: 'Sí. Trabajamos con FG (campo natural firme), AG (césped sintético de última generación), MG (multiground) e IC (futsal). El terreno recomendado figura en los detalles técnicos de cada producto.',
    },
    {
      q: '¿Qué pasa si llega un producto distinto al que pedí?',
      a: 'Lo solucionamos sin costo para vos. Coordinamos el retiro del producto erróneo y despachamos el correcto. Si no tenemos stock del modelo original, devolvemos el 100% del valor pagado.',
    },
  ];

  const [open, setOpen] = React.useState(0);

  return (
    <main className="bag-info-page">
      <nav className="bag-breadcrumb bag-breadcrumb--page">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Inicio</a>
        <span>›</span>
        <span className="is-current">Preguntas frecuentes</span>
      </nav>
      <header className="bag-info-page__head">
        <div className="bag-eyebrow bag-eyebrow--muted">SOPORTE · FAQ</div>
        <h1 className="bag-info-page__title">Preguntas frecuentes</h1>
        <p className="bag-info-page__intro">Lo que más nos consultan, ordenado para que lo resuelvas vos mismo. Si tu duda no está acá, escribinos por WhatsApp.</p>
      </header>

      <section className="bag-faq">
        {items.map((it, i) => (
          <article key={i} className={`bag-faq__item ${open === i ? 'is-open' : ''}`}>
            <button className="bag-faq__q" onClick={() => setOpen(open === i ? -1 : i)}>
              <span className="bag-faq__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="bag-faq__q-text">{it.q}</span>
              <span className="bag-faq__icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d={open === i ? "M3 8 L13 8" : "M3 8 L13 8 M8 3 L8 13"} />
                </svg>
              </span>
            </button>
            {open === i && (
              <div className="bag-faq__a">
                <p>{it.a}</p>
              </div>
            )}
          </article>
        ))}

        <div className="bag-info-page__cta">
          <p className="bag-info-page__note">¿No encontraste lo que buscabas?</p>
          <a className="bag-btn bag-btn--primary" href="https://wa.me/5493516836569" target="_blank" rel="noreferrer">CONSULTAR POR WHATSAPP</a>
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { PoliticaScreen, FaqScreen });
