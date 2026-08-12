/* global React */
const { useState: useState_sub, useEffect: useEffect_sub } = React;

const SUB_DONE_KEY = 'bag:sub:done';
const SUB_DISMISS_KEY = 'bag:sub:dismissedUntil';

function SubscribePopup({ route }) {
  const [visible, setVisible] = useState_sub(false);
  const [status, setStatus] = useState_sub('form'); // form | sending | sent
  const [email, setEmail] = useState_sub('');
  const [name, setName] = useState_sub('');
  const [website, setWebsite] = useState_sub(''); // honeypot
  const [error, setError] = useState_sub(null);

  const onCheckout = (route || '').indexOf('checkout') === 0;

  useEffect_sub(() => {
    if (onCheckout) return;
    if (localStorage.getItem(SUB_DONE_KEY)) return;
    const until = Number(localStorage.getItem(SUB_DISMISS_KEY) || 0);
    if (until && Date.now() < until) return;

    let shown = false;
    const show = () => { if (!shown) { shown = true; setVisible(true); } };
    const timer = setTimeout(show, 8000);
    const onScroll = () => { if (window.scrollY > 400) show(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, [onCheckout]);

  const close = () => {
    setVisible(false);
    localStorage.setItem(SUB_DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Ingresá un email válido.'); return; }
    if (!name.trim()) { setError('Ingresá tu nombre.'); return; }
    setStatus('sending');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), website }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      localStorage.setItem(SUB_DONE_KEY, '1');
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'No se pudo suscribir. Probá de nuevo.');
      setStatus('form');
    }
  };

  if (!visible) return null;

  return (
    <div className="bag-sub-backdrop" onClick={close}>
      <div className="bag-sub" onClick={(e) => e.stopPropagation()}>
        <button className="bag-sub__close" onClick={close} aria-label="Cerrar">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>
        </button>
        {status === 'sent' ? (
          <div className="bag-sub__body">
            <div className="bag-sub__eyebrow">¡Casi listo!</div>
            <h2 className="bag-sub__title">Revisá tu email</h2>
            <p className="bag-sub__text">Te mandamos un correo para confirmar tu email. Al confirmarlo recibís tu <strong>cupón de 5%</strong>.</p>
            <button className="bag-btn bag-btn--primary bag-btn--block" onClick={close}>Listo</button>
          </div>
        ) : (
          <div className="bag-sub__body">
            <div className="bag-sub__eyebrow">Ofertas y novedades</div>
            <h2 className="bag-sub__title">5% de descuento en tu compra</h2>
            <p className="bag-sub__text">Suscribite y recibí un cupón de 5%. Pagando por transferencia se suma al 10% → <strong>15% off</strong>.</p>
            <form onSubmit={submit}>
              <input className="bag-sub__input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="bag-sub__input" type="text" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="bag-sub__hp" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
              {error && <div className="bag-sub__error">{error}</div>}
              <button className="bag-btn bag-btn--primary bag-btn--block" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando…' : 'Suscribirme'}
              </button>
            </form>
            <p className="bag-sub__note">Recibirás un correo para validar tu email.</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SubscribePopup });
