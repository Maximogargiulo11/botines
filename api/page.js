const fs = require('fs');
const path = require('path');
const { getProductById, getArticleBySlug } = require('./_catalog');

const SITE_URL = process.env.SITE_URL || 'https://www.botinesaltagamacba.com';
const FALLBACK_IMAGE = '/assets/logo-altagama-transparent.png';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const fmtPrice = (n) => '$ ' + Number(n).toLocaleString('es-AR');

function absImage(rel) {
  if (!rel) return SITE_URL + FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(rel)) return rel;
  return SITE_URL + '/' + String(rel).replace(/^\/+/, '');
}

function metaFor(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'marcas' && parts[3]) {
    const found = getProductById(parts[3]);
    if (found) {
      const p = found.product;
      const title = p.colorway ? `${p.name} — ${p.colorway}` : p.name;
      return {
        title,
        description: `${title}. ${fmtPrice(p.price)}. Comprá online en Botines Alta Gama Córdoba.`,
        image: absImage(p.images && p.images[0]),
        type: 'product',
        price: p.price,
      };
    }
  } else if (parts[0] === 'lanzamientos' && parts[1]) {
    const a = getArticleBySlug(parts[1]);
    if (a) {
      return {
        title: a.title,
        description: a.excerpt || 'Nuevo lanzamiento en Botines Alta Gama Córdoba.',
        image: absImage(a.cover),
        type: 'article',
        price: null,
      };
    }
  }
  return null;
}

function buildMetaTags(meta, url) {
  const tags = [
    `<meta property="og:site_name" content="Botines Alta Gama Córdoba">`,
    `<meta property="og:type" content="${esc(meta.type)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:image" content="${esc(meta.image)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    `<meta name="twitter:image" content="${esc(meta.image)}">`,
    `<meta name="description" content="${esc(meta.description)}">`,
  ];
  if (meta.type === 'product' && meta.price != null) {
    tags.push(`<meta property="product:price:amount" content="${esc(meta.price)}">`);
    tags.push(`<meta property="product:price:currency" content="ARS">`);
  }
  return tags.join('\n  ');
}

module.exports = async function handler(req, res) {
  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (err) {
    console.error('page.js: no se pudo leer index.html', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><title>Botines Alta Gama CBA</title>');
  }

  try {
    const pathname = (req.url || '/').split('?')[0];
    const meta = metaFor(pathname);
    if (meta) {
      const url = SITE_URL + pathname;
      const block = buildMetaTags(meta, url);
      html = html.replace(/<title>[\s\S]*?<\/title>/i,
        `<title>${esc(meta.title)} · Botines Alta Gama CBA</title>\n  ${block}`);
    }
  } catch (err) {
    console.error('page.js: error armando meta OG', err);
    // Se continúa con el html sin meta; nunca romper la navegación por el preview.
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return res.end(html);
};
