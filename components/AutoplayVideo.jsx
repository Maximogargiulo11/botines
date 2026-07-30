/* global React */

// Video que se reproduce solo cuando entra en pantalla y se pausa al salir.
// Usa IntersectionObserver. Arranca muteado porque los navegadores bloquean
// el autoplay con sonido; el usuario puede activar el sonido con los controles.
function AutoplayVideo({ src, className, style, controls = true, loop = true, muted = true, poster }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const v = ref.current;
    if (!v) return;

    // React no siempre fija la propiedad `muted` del DOM vía atributo → la seteamos a mano.
    v.muted = muted;

    const tryPlay = () => {
      const p = v.play();
      if (p && p.catch) {
        p.catch(() => {           // autoplay con sonido bloqueado → muteamos y reintentamos
          v.muted = true;
          const p2 = v.play();
          if (p2 && p2.catch) p2.catch(() => {});
        });
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      v.muted = true;
      tryPlay();
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) tryPlay();
        else v.pause();
      });
    }, { threshold: 0.25 });

    io.observe(v);
    return () => io.disconnect();
  }, [src, muted]);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      style={style}
      poster={poster}
      controls={controls}
      loop={loop}
      muted={muted}
      playsInline
      preload="metadata"
    />
  );
}

Object.assign(window, { AutoplayVideo });
