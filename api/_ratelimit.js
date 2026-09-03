// Rate limiting best-effort para las funciones serverless públicas.
//
// Vercel ejecuta cada función en instancias efímeras y sin estado compartido,
// así que este contador vive en memoria por instancia: no es un límite global
// perfecto, pero corta ráfagas de un mismo IP contra una misma instancia
// (bots, scripts de scraping, spam de formularios) sin depender de un Redis/KV.
//
// Para un límite global y persistente conviene mover esto a Vercel KV/Upstash,
// pero esta capa ya frena el abuso más común sin infraestructura extra.

const buckets = new Map();

// Limpieza perezosa para que el Map no crezca sin control en instancias longevas.
function sweep(now) {
  if (buckets.size < 5000) return;
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => t > now - 60 * 60 * 1000);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}

function clientIp(req) {
  const headers = (req && req.headers) || {};
  const xff = headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return headers['x-real-ip'] || (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

// Devuelve true si la petición está permitida, false si superó el límite.
// - limit: cantidad máxima de peticiones dentro de la ventana.
// - windowMs: tamaño de la ventana en milisegundos.
// - bucket: nombre lógico para separar límites por endpoint.
function rateLimit(req, { limit = 20, windowMs = 60 * 1000, bucket = 'default' } = {}) {
  const now = Date.now();
  sweep(now);
  const key = `${bucket}:${clientIp(req)}`;
  const hits = (buckets.get(key) || []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

// Helper de conveniencia: aplica el límite y, si se supera, responde 429.
// Devuelve true si se debe cortar el handler (ya respondió), false si sigue.
function limited(req, res, opts) {
  if (rateLimit(req, opts)) return false;
  res.status(429).json({ error: 'Demasiadas solicitudes. Probá de nuevo en un momento.' });
  return true;
}

module.exports = { rateLimit, limited, clientIp };
