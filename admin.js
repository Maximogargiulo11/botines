/* global React, ReactDOM */
const { useState, useEffect, useCallback, useRef } = React;

// ─────────────────────────────────────────
// CONFIG — cambiar contraseña acá
// ─────────────────────────────────────────
const REPO_OWNER = 'Maximogargiulo11';
const REPO_NAME  = 'botines';
const REPO_BRANCH = 'master';
const ADMIN_PASSWORD = 'botines2026';
const AUTH_KEY  = 'bag:admin:auth';
const TOKEN_KEY = 'bag:admin:token';

// ─────────────────────────────────────────
// GITHUB API
// ─────────────────────────────────────────
const GH_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

function ghHeaders(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function ghGet(path, token) {
  const r = await fetch(`${GH_BASE}/${path}`, { headers: ghHeaders(token) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `Error ${r.status}`);
  }
  return r.json();
}

async function ghPut(path, token, contentStr, sha, message) {
  const encoded = btoa(unescape(encodeURIComponent(contentStr)));
  const body = { message, content: encoded, branch: REPO_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_BASE}/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `Error ${r.status}`);
  }
  return r.json();
}

async function ghPutBinary(path, token, base64Data, sha, message) {
  const body = { message, content: base64Data, branch: REPO_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_BASE}/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `Error ${r.status}`);
  }
  return r.json();
}

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${path}`;
}

// ─────────────────────────────────────────
// DATA PARSING / GENERATION
// ─────────────────────────────────────────
function parseDataJs(code) {
  // Primary: extract JSON directly (works even under strict CSP that blocks eval/new Function)
  try {
    const s = 'window.BAG_DATA = ';
    const si = code.indexOf(s);
    if (si >= 0) {
      const e = code.indexOf('\n\nwindow.formatPrice', si);
      const raw = (e >= 0 ? code.slice(si + s.length, e) : code.slice(si + s.length))
        .replace(/;\s*$/, '').trim();
      const result = JSON.parse(raw);
      if (result && typeof result === 'object') return result;
    }
  } catch (_) {}
  // Fallback: eval via new Function
  const w = {};
  try { (new Function('window', code))(w); } catch (e) { console.warn('parseDataJs fallback failed:', e.message); }
  return w.BAG_DATA || null;
}

function generateDataJs(data) {
  return `/* ====================================================================
   BAG · Datos — gestionado via panel admin
   ==================================================================== */

window.BAG_DATA = ${JSON.stringify(data, null, 2)};

window.formatPrice = function(n) {
  return '$ ' + Number(n).toLocaleString('es-AR');
};
`;
}

// Convierte artículo viejo (body + gallery) a contentBlocks
function migrateArticle(article) {
  if (article.contentBlocks) return { ...article };
  const blocks = [];
  const body = article.body || [];
  const gallery = article.gallery || [];
  body.forEach((para, i) => {
    blocks.push({ type: 'text', id: genId(), content: para });
    if (i === 0 && gallery[0]) blocks.push({ type: 'image', id: genId(), src: gallery[0], width: '', height: '' });
    if (i === 2 && gallery[1]) blocks.push({ type: 'image', id: genId(), src: gallery[1], width: '', height: '' });
  });
  if (article.instagramUrl) blocks.push({ type: 'instagram', id: genId(), url: article.instagramUrl });
  const { body: _b, gallery: _g, instagramUrl: _ig, ...rest } = article;
  return { ...rest, contentBlocks: blocks };
}

function genId() { return Math.random().toString(36).slice(2, 9); }

// ─────────────────────────────────────────
// IMAGE UPLOAD HOOK
// ─────────────────────────────────────────
function useUpload(token) {
  const [uploading, setUploading] = useState(false);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const upload = useCallback(async (file) => {
    let tkn = tokenRef.current;
    if (!tkn) {
      // Pedir token via modal si no está guardado aún
      if (window.__admRequestToken) {
        tkn = await new Promise((res, rej) => {
          window.__admRequestToken(t => t ? res(t) : rej(new Error('Cancelado')));
        });
      } else {
        throw new Error('Token no configurado. Andá a Ajustes para guardarlo.');
      }
    }
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${Date.now()}-${safeName}`;
      const path = `assets/${filename}`;
      let sha;
      try { sha = (await ghGet(path, tkn)).sha; } catch {}
      await ghPutBinary(path, tkn, base64, sha, `admin: subir ${filename}`);
      setUploading(false);
      return path;
    } catch (e) {
      setUploading(false);
      throw e;
    }
  }, []);
  return { upload, uploading };
}

// ─────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────
function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style }) {
  return <button type={type} onClick={onClick} disabled={disabled} style={style} className={`adm-btn adm-btn--${variant} adm-btn--${size}`}>{children}</button>;
}

function Field({ label, required, hint, children }) {
  return (
    <div className="adm-field">
      {label && <label className="adm-label">{label}{required && <span className="adm-required">*</span>}</label>}
      {children}
      {hint && <span className="adm-hint">{hint}</span>}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = 'text', required, hint }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <input type={type} className="adm-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}

function Textarea({ label, value, onChange, rows = 4, placeholder }) {
  return (
    <Field label={label}>
      <textarea className="adm-input adm-textarea" value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
    </Field>
  );
}

function SelectInput({ label, value, onChange, options, hint, small }) {
  return (
    <Field label={label} hint={hint}>
      <select className={`adm-input adm-select${small ? ' adm-select--sm' : ''}`} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </Field>
  );
}

function ImageField({ label, value, onChange, token, hint }) {
  const { upload, uploading } = useUpload(token);
  const ref = useRef();
  return (
    <Field label={label} hint={hint}>
      <div className="adm-image-field">
        {value && <div className="adm-image-preview"><img src={rawUrl(value)} alt="" onError={e => e.target.style.display='none'} /></div>}
        <div className="adm-image-controls">
          <input className="adm-input" value={value} onChange={e => onChange(e.target.value)} placeholder="assets/imagen.jpg" />
          <input type="file" ref={ref} style={{ display: 'none' }} accept="image/*" onChange={async e => {
            const f = e.target.files[0];
            if (!f) return;
            try { onChange(await upload(f)); } catch (err) { alert('Error: ' + err.message); }
            e.target.value = '';
          }} />
          <Btn variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
            {uploading ? '...' : 'Subir'}
          </Btn>
        </div>
      </div>
    </Field>
  );
}

function VideoField({ label, value, onChange, token, hint }) {
  const { upload, uploading } = useUpload(token);
  const ref = useRef();
  return (
    <Field label={label} hint={hint}>
      <div className="adm-image-field">
        <div className="adm-image-controls">
          <input className="adm-input" value={value} onChange={e => onChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=... o assets/video.mp4" />
          <input type="file" ref={ref} style={{ display: 'none' }} accept="video/*"
            onChange={async e => {
              const f = e.target.files[0]; if (!f) return;
              try { onChange(await upload(f)); } catch (err) { alert('Error: ' + err.message); }
              e.target.value = '';
            }} />
          <Btn variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
            {uploading ? '...' : 'Subir'}
          </Btn>
        </div>
        {value && (
          <div className="adm-video-preview">
            {value.startsWith('http') ? (
              <div className="adm-video-preview__url">▶ {value.slice(0, 60)}{value.length > 60 ? '…' : ''}</div>
            ) : (
              <video src={rawUrl(value)} className="adm-video-preview__player" controls />
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`adm-toast adm-toast--${type}`}>
      <span>{message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
}

// ─────────────────────────────────────────
// CONTENT BLOCKS EDITOR
// ─────────────────────────────────────────
function ContentBlocks({ blocks, onChange, token }) {
  const { upload, uploading } = useUpload(token);
  const fileRefs = useRef({});

  const add = (type) => {
    let b;
    if      (type === 'text')       b = { type, id: genId(), content: '' };
    else if (type === 'image')      b = { type, id: genId(), src: '', width: '', height: '' };
    else if (type === 'image-pair') b = { type, id: genId(), left: { src: '' }, right: { src: '' } };
    else if (type === 'video')      b = { type, id: genId(), src: '' };
    else                            b = { type, id: genId(), url: '' }; // instagram
    onChange([...blocks, b]);
  };

  const upd = (id, patch) => onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const del = (id) => onChange(blocks.filter(b => b.id !== id));
  const move = (id, dir) => {
    const i = blocks.findIndex(b => b.id === id);
    if (i + dir < 0 || i + dir >= blocks.length) return;
    const a = [...blocks];
    [a[i], a[i + dir]] = [a[i + dir], a[i]];
    onChange(a);
  };

  return (
    <div className="adm-content-blocks">
      <div className="adm-content-blocks__list">
        {blocks.map((b, i) => (
          <div key={b.id} className={`adm-block adm-block--${b.type}`}>
            <div className="adm-block__handle">
              <span className="adm-block__type">
                {b.type === 'text' ? 'T' : b.type === 'image' ? '▣' : b.type === 'image-pair' ? '▣▣' : b.type === 'video' ? '▶' : 'IG'}
              </span>
              <div className="adm-block__move">
                <button onClick={() => move(b.id, -1)} disabled={i === 0}>↑</button>
                <button onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}>↓</button>
              </div>
            </div>
            <div className="adm-block__content">
              {b.type === 'text' && (
                <textarea className="adm-input adm-textarea" value={b.content}
                  onChange={e => upd(b.id, { content: e.target.value })} rows={4} placeholder="Párrafo de texto..." />
              )}
              {b.type === 'image' && (
                <div className="adm-block__image-fields">
                  {b.src && <div className="adm-block__image-preview"><img src={rawUrl(b.src)} alt="" onError={e => e.target.style.display='none'} /></div>}
                  <div className="adm-row">
                    <input className="adm-input" value={b.src} onChange={e => upd(b.id, { src: e.target.value })} placeholder="assets/imagen.jpg" />
                    <input type="file" ref={el => fileRefs.current[b.id] = el} style={{ display: 'none' }} accept="image/*"
                      onChange={async e => {
                        const f = e.target.files[0]; if (!f) return;
                        try { upd(b.id, { src: await upload(f) }); } catch (err) { alert('Error: ' + err.message); }
                        e.target.value = '';
                      }} />
                    <Btn variant="ghost" size="sm" onClick={() => fileRefs.current[b.id]?.click()} disabled={uploading}>Subir</Btn>
                  </div>
                  <div className="adm-row adm-row--sm">
                    <input className="adm-input" value={b.width} onChange={e => upd(b.id, { width: e.target.value })} placeholder="Ancho px (ej: 1080)" style={{ flex: 1 }} />
                    <input className="adm-input" value={b.height} onChange={e => upd(b.id, { height: e.target.value })} placeholder="Alto px (ej: 1350)" style={{ flex: 1 }} />
                  </div>
                </div>
              )}
              {b.type === 'instagram' && (
                <div className="adm-block__ig-fields">
                  <input className="adm-input" value={b.url} onChange={e => upd(b.id, { url: e.target.value })} placeholder="https://www.instagram.com/p/..." />
                  {b.url && <div className="adm-block__ig-preview">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>
                    <a href={b.url} target="_blank" rel="noreferrer">{b.url}</a>
                  </div>}
                </div>
              )}
              {b.type === 'image-pair' && (
                <div className="adm-block__pair-fields">
                  {['left', 'right'].map(side => (
                    <div key={side} className="adm-block__pair-side">
                      <span className="adm-label">{side === 'left' ? 'Izquierda' : 'Derecha'}</span>
                      {b[side].src && (
                        <div className="adm-block__pair-preview">
                          <img src={rawUrl(b[side].src)} alt="" onError={e => e.target.style.display='none'} />
                        </div>
                      )}
                      <div className="adm-row">
                        <input className="adm-input" value={b[side].src}
                          onChange={e => upd(b.id, { [side]: { ...b[side], src: e.target.value } })}
                          placeholder="assets/imagen.jpg" />
                        <input type="file" ref={el => fileRefs.current[`${b.id}-${side}`] = el}
                          style={{ display: 'none' }} accept="image/*"
                          onChange={async e => {
                            const f = e.target.files[0]; if (!f) return;
                            try { upd(b.id, { [side]: { ...b[side], src: await upload(f) } }); }
                            catch (err) { alert('Error: ' + err.message); }
                            e.target.value = '';
                          }} />
                        <Btn variant="ghost" size="sm" onClick={() => fileRefs.current[`${b.id}-${side}`]?.click()} disabled={uploading}>
                          Subir
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {b.type === 'video' && (
                <div className="adm-block__video-fields">
                  <div className="adm-row">
                    <input className="adm-input" value={b.src}
                      onChange={e => upd(b.id, { src: e.target.value })}
                      placeholder="https://youtube.com/watch?v=... o assets/video.mp4" />
                    <input type="file" ref={el => fileRefs.current[`${b.id}-vid`] = el}
                      style={{ display: 'none' }} accept="video/*"
                      onChange={async e => {
                        const f = e.target.files[0]; if (!f) return;
                        try { upd(b.id, { src: await upload(f) }); }
                        catch (err) { alert('Error: ' + err.message); }
                        e.target.value = '';
                      }} />
                    <Btn variant="ghost" size="sm" onClick={() => fileRefs.current[`${b.id}-vid`]?.click()} disabled={uploading}>
                      Subir
                    </Btn>
                  </div>
                  {b.src && (
                    <div className="adm-video-preview">
                      {b.src.startsWith('http') ? (
                        <div className="adm-video-preview__url">▶ {b.src.slice(0, 60)}{b.src.length > 60 ? '…' : ''}</div>
                      ) : (
                        <video src={rawUrl(b.src)} className="adm-video-preview__player" controls />
                      )}
                    </div>
                  )}
                  <span className="adm-hint">YouTube, Vimeo, o archivo MP4/WebM subido a assets/</span>
                </div>
              )}
            </div>
            <button className="adm-block__remove" onClick={() => del(b.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="adm-content-blocks__add">
        <Btn variant="ghost" size="sm" onClick={() => add('text')}>+ Párrafo</Btn>
        <Btn variant="ghost" size="sm" onClick={() => add('image')}>+ Imagen</Btn>
        <Btn variant="ghost" size="sm" onClick={() => add('image-pair')}>+ Dúo</Btn>
        <Btn variant="ghost" size="sm" onClick={() => add('video')}>+ Video</Btn>
        <Btn variant="ghost" size="sm" onClick={() => add('instagram')}>+ Instagram</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SIZES EDITOR
// ─────────────────────────────────────────
const ALL_EU = ['38','38.5','39','39.5','40','40.5','41','42','42.5','43','44','44.5','45','46'];

function SizesEditor({ availableSizes, onChange }) {
  const toggle = (s) => {
    const next = availableSizes.includes(s) ? availableSizes.filter(x => x !== s) : [...availableSizes, s];
    onChange(next);
  };
  return (
    <Field label="Talles disponibles (EU)" hint="Verde = disponible">
      <div className="adm-sizes">
        {ALL_EU.map(s => (
          <button key={s} type="button" className={`adm-size-btn ${availableSizes.includes(s) ? 'is-active' : ''}`} onClick={() => toggle(s)}>{s}</button>
        ))}
      </div>
    </Field>
  );
}

// ─────────────────────────────────────────
// ARTICLE EDITOR
// ─────────────────────────────────────────
const CATEGORIES = ['LANZAMIENTO', 'CAMPAÑA', 'NOVEDAD', 'EDITORIAL'];
const BRANDS_LIST = ['Nike', 'Adidas', 'Puma', 'New Balance'];

function ArticleEditor({ article, onSave, onCancel, token }) {
  const [f, setF] = useState(() => {
    const a = migrateArticle(article);
    return {
      id: a.id || genId(),
      slug: a.slug || '',
      brand: a.brand || 'Nike',
      category: a.category || 'LANZAMIENTO',
      title: a.title || '',
      excerpt: a.excerpt || '',
      date: a.date || '',
      cover: a.cover || '',
      coverVideo: a.coverVideo || '',
      featured: !!a.featured,
      contentBlocks: a.contentBlocks || [],
      relatedProduct: a.relatedProduct || null,
    };
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const autoSlug = () => set('slug',
    f.title.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  );

  return (
    <div className="adm-editor">
      <div className="adm-editor__header">
        <h2>{article.id ? 'Editar lanzamiento' : 'Nuevo lanzamiento'}</h2>
        <div className="adm-editor__actions">
          <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => {
            if (!f.title.trim()) { alert('El título es obligatorio'); return; }
            if (!f.slug.trim()) { alert('El slug es obligatorio'); return; }
            onSave(f);
          }}>Guardar</Btn>
        </div>
      </div>
      <div className="adm-editor__body">
        <div className="adm-section">
          <div className="adm-section__title">Información básica</div>
          <div className="adm-grid-2">
            <SelectInput label="Marca" value={f.brand} onChange={v => set('brand', v)} options={BRANDS_LIST} />
            <SelectInput label="Categoría" value={f.category} onChange={v => set('category', v)} options={CATEGORIES} />
          </div>
          <TextInput label="Título" value={f.title} onChange={v => set('title', v)} required placeholder="Puma lanza el Showtime Pack..." />
          <div className="adm-row">
            <div style={{ flex: 1 }}><TextInput label="Slug (URL)" value={f.slug} onChange={v => set('slug', v)} placeholder="puma-showtime-pack" /></div>
            <Btn variant="ghost" size="sm" style={{ marginTop: 20 }} onClick={autoSlug}>Auto</Btn>
          </div>
          <TextInput label="Fecha" value={f.date} onChange={v => set('date', v)} placeholder="24 MAY 2026" />
          <Textarea label="Bajada / Excerpt" value={f.excerpt} onChange={v => set('excerpt', v)} rows={3} placeholder="Resumen del artículo que aparece en las tarjetas..." />
          <ImageField label="Imagen de portada" value={f.cover} onChange={v => set('cover', v)} token={token} hint="Imagen que aparece en tarjetas. Obligatoria." />
          <VideoField label="Video de portada (opcional)" value={f.coverVideo} onChange={v => set('coverVideo', v)} token={token} hint="YouTube, Vimeo o archivo. Se muestra en el hero del artículo en lugar de la imagen." />
          <Field>
            <label className="adm-checkbox">
              <input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} />
              <span>Destacado (aparece como hero en el home)</span>
            </label>
          </Field>
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Contenido del artículo</div>
          <ContentBlocks blocks={f.contentBlocks} onChange={v => set('contentBlocks', v)} token={token} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ARTICLES SECTION
// ─────────────────────────────────────────
function ArticlesSection({ data, onDataChange, token, homepageCount, onHomepageCountChange }) {
  const [editing, setEditing] = useState(null);

  if (editing !== null) {
    return (
      <ArticleEditor
        article={editing}
        token={token}
        onCancel={() => setEditing(null)}
        onSave={updated => {
          const list = data.articles || [];
          const idx = list.findIndex(a => a.id === updated.id);
          const next = idx >= 0 ? list.map((a, i) => i === idx ? updated : a) : [updated, ...list];
          onDataChange({ ...data, articles: next });
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="adm-section-header">
        <h2>Lanzamientos</h2>
        <div className="adm-section-header__right">
          <div className="adm-field-inline">
            <span className="adm-label">Mostrar en home:</span>
            <select className="adm-input adm-select adm-select--sm" value={homepageCount}
              onChange={e => onHomepageCountChange(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Btn size="sm" onClick={() => setEditing({ id: '', slug: '', title: '', excerpt: '', date: '', brand: 'Nike', category: 'LANZAMIENTO', cover: '', featured: false, contentBlocks: [] })}>
            + Nuevo lanzamiento
          </Btn>
        </div>
      </div>
      <div className="adm-list">
        {(data.articles || []).map(article => (
          <div key={article.id} className="adm-list-item">
            <div className="adm-list-item__cover">
              {article.cover && <img src={rawUrl(article.cover)} alt="" onError={e => e.target.style.display='none'} />}
            </div>
            <div className="adm-list-item__info">
              <div className="adm-list-item__meta">
                <span className="adm-badge">{article.category}</span>
                <span className="adm-badge adm-badge--muted">{article.brand}</span>
                {article.featured && <span className="adm-badge adm-badge--accent">DESTACADO</span>}
              </div>
              <div className="adm-list-item__title">{article.title}</div>
              <div className="adm-list-item__sub">{article.date} · /{article.slug}</div>
            </div>
            <div className="adm-list-item__actions">
              <Btn variant="ghost" size="sm" onClick={() => setEditing(article)}>Editar</Btn>
              <Btn variant="danger" size="sm" onClick={() => {
                if (!confirm(`¿Eliminar "${article.title}"?`)) return;
                onDataChange({ ...data, articles: data.articles.filter(a => a.id !== article.id) });
              }}>Eliminar</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BRANDS SECTION
// ─────────────────────────────────────────
function BrandsSection({ data, onDataChange, token }) {
  const [open, setOpen] = useState(null);

  const updBrand = (slug, patch) =>
    onDataChange({ ...data, brands: data.brands.map(b => b.slug === slug ? { ...b, ...patch } : b) });

  const updModel = (bSlug, mSlug, patch) =>
    onDataChange({
      ...data,
      brands: data.brands.map(b => b.slug !== bSlug ? b : {
        ...b, models: b.models.map(m => m.slug === mSlug ? { ...m, ...patch } : m)
      })
    });

  return (
    <div>
      <div className="adm-section-header"><h2>Marcas</h2></div>
      <div className="adm-brands-grid">
        {(data.brands || []).map(brand => (
          <div key={brand.slug} className="adm-brand-card">
            <div className="adm-brand-card__header" onClick={() => setOpen(open === brand.slug ? null : brand.slug)}>
              <div className="adm-brand-card__cover">
                {brand.cover && <img src={rawUrl(brand.cover)} alt={brand.name} onError={e => e.target.style.display='none'} />}
              </div>
              <div className="adm-brand-card__info">
                <strong>{brand.name}</strong>
                <span>{brand.tagline}</span>
              </div>
              <span className="adm-brand-card__toggle">{open === brand.slug ? '▲' : '▼'}</span>
            </div>
            {open === brand.slug && (
              <div className="adm-brand-card__body">
                <ImageField label="Portada de marca" value={brand.cover} onChange={v => updBrand(brand.slug, { cover: v })} token={token} />
                <TextInput label="Tagline de marca" value={brand.tagline} onChange={v => updBrand(brand.slug, { tagline: v })} />
                <div className="adm-subsection-title">Modelos</div>
                {brand.models.map(model => (
                  <div key={model.slug} className="adm-model-row">
                    <div className="adm-model-row__preview">
                      {model.image && <img src={rawUrl(model.image)} alt={model.name} onError={e => e.target.style.display='none'} />}
                    </div>
                    <div className="adm-model-row__fields">
                      <div className="adm-label">{model.name}</div>
                      <ImageField label="Imagen del modelo" value={model.image} onChange={v => updModel(brand.slug, model.slug, { image: v })} token={token} />
                      <TextInput label="Tagline" value={model.tagline} onChange={v => updModel(brand.slug, model.slug, { tagline: v })} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PRODUCT EDITOR
// ─────────────────────────────────────────
function ProductEditor({ product, onSave, onCancel, token }) {
  const { upload, uploading } = useUpload(token);
  const fileRef = useRef();
  const [f, setF] = useState({
    id: product.id || genId(),
    name: product.name || '',
    colorway: product.colorway || '',
    color: product.color || '#ffffff',
    price: product.price || 0,
    availableSizes: product.availableSizes || [],
    sizes: product.sizes || { eu: ALL_EU, us: [], uk: [] },
    images: product.images || [],
    spec: product.spec || { suela: 'FG (Firm Ground)', terreno: 'Césped natural firme', peso: '', coleccion: '' },
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setSpec = (k, v) => setF(p => ({ ...p, spec: { ...p.spec, [k]: v } }));

  return (
    <div className="adm-editor">
      <div className="adm-editor__header">
        <h2>{product.id ? 'Editar producto' : 'Nuevo colorway'}</h2>
        <div className="adm-editor__actions">
          <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => {
            if (!f.name.trim()) { alert('El nombre es obligatorio'); return; }
            onSave(f);
          }}>Guardar</Btn>
        </div>
      </div>
      <div className="adm-editor__body">
        <div className="adm-section">
          <div className="adm-section__title">Información del producto</div>
          <TextInput label="Nombre completo" value={f.name} onChange={v => set('name', v)} required placeholder="Mercurial Vapor 16 Elite FG" />
          <div className="adm-grid-2">
            <TextInput label="Colorway" value={f.colorway} onChange={v => set('colorway', v)} placeholder="Mad Bullet" />
            <Field label="Color (referencia visual)">
              <div className="adm-color-row">
                <input type="color" className="adm-color-input" value={f.color} onChange={e => set('color', e.target.value)} />
                <input type="text" className="adm-input" value={f.color} onChange={e => set('color', e.target.value)} placeholder="#ffffff" />
              </div>
            </Field>
          </div>
          <TextInput label="Precio (ARS)" value={String(f.price)} onChange={v => set('price', Number(v) || 0)} type="number" placeholder="529990" />
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Talles disponibles</div>
          <SizesEditor availableSizes={f.availableSizes} onChange={v => set('availableSizes', v)} />
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Imágenes</div>
          <div className="adm-images-grid">
            {f.images.map((img, i) => (
              <div key={i} className="adm-thumb">
                <img src={rawUrl(img)} alt="" onError={e => e.target.style.display='none'} />
                <button className="adm-thumb__remove" onClick={() => set('images', f.images.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div className="adm-thumb adm-thumb--add">
              <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*"
                onChange={async e => {
                  const file = e.target.files[0]; if (!file) return;
                  try { set('images', [...f.images, await upload(file)]); } catch (err) { alert('Error: ' + err.message); }
                  e.target.value = '';
                }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '…' : '+'}</button>
            </div>
          </div>
          <span className="adm-hint">Primera imagen = imagen principal.</span>
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Especificaciones técnicas</div>
          <div className="adm-grid-2">
            <TextInput label="Suela" value={f.spec.suela} onChange={v => setSpec('suela', v)} placeholder="FG (Firm Ground)" />
            <TextInput label="Terreno" value={f.spec.terreno} onChange={v => setSpec('terreno', v)} placeholder="Césped natural firme" />
            <TextInput label="Peso" value={f.spec.peso} onChange={v => setSpec('peso', v)} placeholder="186 g" />
            <TextInput label="Colección" value={f.spec.coleccion} onChange={v => setSpec('coleccion', v)} placeholder="Mad Bullet Pack" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PRODUCTS SECTION
// ─────────────────────────────────────────
function ProductsSection({ data, onDataChange, token }) {
  const allKeys = Object.keys(data.products || {});
  const [selected, setSelected] = useState(() => allKeys[0] || '');
  const [editingKey, setEditingKey] = useState(null);
  const [editingProd, setEditingProd] = useState(null);

  if (editingProd) {
    return (
      <ProductEditor
        product={editingProd}
        token={token}
        onCancel={() => { setEditingProd(null); setEditingKey(null); }}
        onSave={updated => {
          const prods = { ...data.products };
          const list = [...(prods[editingKey] || [])];
          const idx = list.findIndex(p => p.id === updated.id);
          if (idx >= 0) list[idx] = updated; else list.push(updated);
          prods[editingKey] = list;
          onDataChange({ ...data, products: prods });
          setEditingProd(null);
          setEditingKey(null);
        }}
      />
    );
  }

  const products = data.products || {};
  const fmtPrice = n => '$ ' + Number(n).toLocaleString('es-AR');

  return (
    <div>
      <div className="adm-section-header"><h2>Catálogo / Stock</h2></div>
      <div className="adm-products-layout">
        <div className="adm-products-sidebar">
          {allKeys.map(key => (
            <button key={key} className={`adm-model-tab ${selected === key ? 'is-active' : ''}`} onClick={() => setSelected(key)}>
              <span className="adm-model-tab__key">{key}</span>
              <span className="adm-model-tab__count">{(products[key] || []).length}</span>
            </button>
          ))}
        </div>
        <div className="adm-products-main">
          {selected && (
            <>
              <div className="adm-section-header adm-section-header--sub">
                <h3>{selected}</h3>
                <Btn size="sm" onClick={() => {
                  setEditingKey(selected);
                  setEditingProd({ id: '', name: '', colorway: '', color: '#ffffff', price: 0, availableSizes: [], images: [], spec: {} });
                }}>+ Colorway</Btn>
              </div>
              <div className="adm-products-grid">
                {(products[selected] || []).map(prod => (
                  <div key={prod.id} className="adm-product-card">
                    <div className="adm-product-card__image">
                      {prod.images?.[0] && <img src={rawUrl(prod.images[0])} alt="" onError={e => e.target.style.display='none'} />}
                      {prod.color && <div className="adm-product-card__color" style={{ background: prod.color }} />}
                    </div>
                    <div className="adm-product-card__info">
                      <div className="adm-product-card__name">{prod.name}</div>
                      <div className="adm-product-card__colorway">{prod.colorway}</div>
                      <div className="adm-product-card__price">{fmtPrice(prod.price)}</div>
                      <div className="adm-product-card__sizes">{prod.availableSizes?.length || 0} talles disponibles</div>
                    </div>
                    <div className="adm-product-card__actions">
                      <Btn variant="ghost" size="sm" onClick={() => { setEditingKey(selected); setEditingProd(prod); }}>Editar</Btn>
                      <Btn variant="danger" size="sm" onClick={() => {
                        if (!confirm(`¿Eliminar "${prod.name} — ${prod.colorway}"?`)) return;
                        const updated = { ...data.products, [selected]: products[selected].filter(p => p.id !== prod.id) };
                        onDataChange({ ...data, products: updated });
                      }}>Eliminar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SETTINGS SECTION
// ─────────────────────────────────────────
function SettingsSection({ token, onTokenChange }) {
  const [draft, setDraft] = useState(token || '');
  const [ok, setOk] = useState(false);
  const save = () => { onTokenChange(draft); localStorage.setItem(TOKEN_KEY, draft); setOk(true); setTimeout(() => setOk(false), 2000); };
  return (
    <div>
      <div className="adm-section-header"><h2>Ajustes</h2></div>
      <div className="adm-section">
        <div className="adm-section__title">Conexión GitHub</div>
        <p className="adm-text">El token se usa para publicar cambios directamente en el repositorio. Necesitás un <strong>Personal Access Token</strong> con permisos <code>repo</code>.</p>
        <a className="adm-link" href="https://github.com/settings/tokens/new?description=botines-admin&scopes=repo" target="_blank" rel="noreferrer">
          Crear token en GitHub →
        </a>
        <TextInput label="GitHub Personal Access Token" value={draft} onChange={setDraft} type="password" placeholder="ghp_..." hint="Guardado en localStorage de este navegador." />
        <Btn onClick={save}>{ok ? '✓ Guardado' : 'Guardar token'}</Btn>
      </div>
      <div className="adm-section">
        <div className="adm-section__title">Repositorio</div>
        <div className="adm-info-grid">
          <div><strong>Repo:</strong> {REPO_OWNER}/{REPO_NAME}</div>
          <div><strong>Branch:</strong> {REPO_BRANCH}</div>
          <div><strong>Deploy:</strong> Automático en Vercel al publicar</div>
        </div>
      </div>
      <div className="adm-section">
        <div className="adm-section__title">Seguridad</div>
        <p className="adm-text">La contraseña del admin está en <code>admin.js</code>, variable <code>ADMIN_PASSWORD</code>.</p>
        <Btn variant="ghost" size="sm" onClick={() => { localStorage.removeItem(AUTH_KEY); window.location.reload(); }}>
          Cerrar sesión
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SETUP TOKEN (primera vez / token no guardado)
// ─────────────────────────────────────────
function SetupToken({ onConnect }) {
  const [draft, setDraft] = useState('');
  const handle = () => {
    const t = draft.trim();
    if (!t) return;
    localStorage.setItem(TOKEN_KEY, t);
    onConnect(t);
  };
  return (
    <div className="adm-setup">
      <div className="adm-setup__box">
        <h1>Conectar con GitHub</h1>
        <p className="adm-text">Necesitás un Personal Access Token de GitHub con permisos <code>repo</code> para que el admin pueda guardar cambios.</p>
        <a className="adm-link" href="https://github.com/settings/tokens/new?description=botines-admin&scopes=repo" target="_blank" rel="noreferrer">
          Crear token en GitHub →
        </a>
        <TextInput
          label="Token"
          value={draft}
          onChange={setDraft}
          type="password"
          placeholder="ghp_..."
          hint="Se guarda en este navegador. Solo necesitás hacerlo una vez."
        />
        <Btn onClick={handle} disabled={!draft.trim()}>Continuar</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
function Login({ onLogin }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);
  const submit = e => {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) { localStorage.setItem(AUTH_KEY, '1'); onLogin(); }
    else { setErr(true); setPwd(''); setTimeout(() => setErr(false), 2000); }
  };
  return (
    <div className="adm-login">
      <div className="adm-login__box">
        <div className="adm-login__logo">
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>BOTINES</span>
        </div>
        <h1>Panel de administración</h1>
        <form onSubmit={submit}>
          <input type="password" className={`adm-input adm-login__input ${err ? 'is-error' : ''}`}
            value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Contraseña" autoFocus />
          <Btn type="submit" size="lg" style={{ width: '100%', marginTop: 4 }}>Entrar</Btn>
          {err && <p className="adm-login__error">Contraseña incorrecta</p>}
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TOKEN MODAL (se muestra al publicar sin token guardado)
// ─────────────────────────────────────────
function TokenModal({ onSave, onCancel }) {
  const [draft, setDraft] = useState('');
  const handle = () => {
    const t = draft.trim();
    if (!t) return;
    localStorage.setItem(TOKEN_KEY, t);
    onSave(t);
  };
  return (
    <div className="adm-modal-overlay" onClick={onCancel}>
      <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-head">
          <h3>Token de GitHub</h3>
          <button onClick={onCancel}>×</button>
        </div>
        <p className="adm-text">Para publicar necesitás un Personal Access Token con permisos <code>repo</code>. Se guarda en este navegador — solo lo pedimos una vez.</p>
        <a className="adm-link" href="https://github.com/settings/tokens/new?description=botines-admin&scopes=repo" target="_blank" rel="noreferrer">
          Crear token en GitHub →
        </a>
        <TextInput label="Token" value={draft} onChange={setDraft} type="password" placeholder="ghp_..." />
        <div className="adm-modal-actions">
          <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
          <Btn onClick={handle} disabled={!draft.trim()}>Guardar y publicar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PAGES SECTION (Política + FAQ)
// ─────────────────────────────────────────
function PagesSection({ data, onDataChange }) {
  const [tab, setTab] = useState('politica');

  const pages    = data.pages || { politica: { intro: '', sections: [] }, faq: { intro: '', items: [] } };
  const politica = pages.politica || { intro: '', sections: [] };
  const faq      = pages.faq      || { intro: '', items: [] };

  const updPolitica = (patch) => onDataChange({ ...data, pages: { ...pages, politica: { ...politica, ...patch } } });
  const updFaq      = (patch) => onDataChange({ ...data, pages: { ...pages, faq:      { ...faq,      ...patch } } });

  // ── Política helpers ──────────────────────────────────────────
  const updSection = (id, patch) =>
    updPolitica({ sections: politica.sections.map(s => s.id === id ? { ...s, ...patch } : s) });
  const delSection = (id) =>
    updPolitica({ sections: politica.sections.filter(s => s.id !== id) });
  const addSection = () =>
    updPolitica({ sections: [...politica.sections, { id: genId(), title: '', content: '' }] });
  const moveSection = (id, dir) => {
    const arr = [...politica.sections];
    const i = arr.findIndex(s => s.id === id);
    if (i + dir < 0 || i + dir >= arr.length) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    updPolitica({ sections: arr });
  };

  // ── FAQ helpers ───────────────────────────────────────────────
  const updItem = (id, patch) =>
    updFaq({ items: faq.items.map(it => it.id === id ? { ...it, ...patch } : it) });
  const delItem = (id) =>
    updFaq({ items: faq.items.filter(it => it.id !== id) });
  const addItem = () =>
    updFaq({ items: [...faq.items, { id: genId(), q: '', a: '' }] });
  const moveItem = (id, dir) => {
    const arr = [...faq.items];
    const i = arr.findIndex(it => it.id === id);
    if (i + dir < 0 || i + dir >= arr.length) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    updFaq({ items: arr });
  };

  return (
    <div>
      <div className="adm-section-header"><h2>Páginas</h2></div>

      <div className="adm-pages-tabs">
        <button className={`adm-pages-tab${tab === 'politica' ? ' is-active' : ''}`} onClick={() => setTab('politica')}>
          Política de devoluciones
        </button>
        <button className={`adm-pages-tab${tab === 'faq' ? ' is-active' : ''}`} onClick={() => setTab('faq')}>
          Preguntas frecuentes
        </button>
      </div>

      {tab === 'politica' && (
        <div className="adm-section">
          <Textarea label="Introducción" value={politica.intro} onChange={v => updPolitica({ intro: v })} rows={3}
            placeholder="Texto introductorio de la página..." />
          <div className="adm-subsection-title" style={{ marginTop: 24 }}>Secciones</div>
          {politica.sections.map((s, i) => (
            <div key={s.id} className="adm-page-item">
              <div className="adm-page-item__move">
                <button onClick={() => moveSection(s.id, -1)} disabled={i === 0}>↑</button>
                <button onClick={() => moveSection(s.id, 1)} disabled={i === politica.sections.length - 1}>↓</button>
              </div>
              <div className="adm-page-item__fields">
                <TextInput label="Título" value={s.title} onChange={v => updSection(s.id, { title: v })} placeholder="Plazo de cambio" />
                <Textarea label="Contenido" value={s.content} onChange={v => updSection(s.id, { content: v })} rows={3} placeholder="Descripción de la política..." />
              </div>
              <button className="adm-page-item__remove" onClick={() => delSection(s.id)}>×</button>
            </div>
          ))}
          <Btn variant="ghost" size="sm" onClick={addSection} style={{ marginTop: 12 }}>+ Agregar sección</Btn>
        </div>
      )}

      {tab === 'faq' && (
        <div className="adm-section">
          <Textarea label="Introducción" value={faq.intro} onChange={v => updFaq({ intro: v })} rows={2}
            placeholder="Texto introductorio del FAQ..." />
          <div className="adm-subsection-title" style={{ marginTop: 24 }}>Preguntas</div>
          {faq.items.map((it, i) => (
            <div key={it.id} className="adm-page-item">
              <div className="adm-page-item__move">
                <button onClick={() => moveItem(it.id, -1)} disabled={i === 0}>↑</button>
                <button onClick={() => moveItem(it.id, 1)} disabled={i === faq.items.length - 1}>↓</button>
              </div>
              <div className="adm-page-item__fields">
                <TextInput label="Pregunta" value={it.q} onChange={v => updItem(it.id, { q: v })} placeholder="¿Los botines son originales?" />
                <Textarea label="Respuesta" value={it.a} onChange={v => updItem(it.id, { a: v })} rows={3} placeholder="Respuesta..." />
              </div>
              <button className="adm-page-item__remove" onClick={() => delItem(it.id)}>×</button>
            </div>
          ))}
          <Btn variant="ghost" size="sm" onClick={addItem} style={{ marginTop: 12 }}>+ Agregar pregunta</Btn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
const NAV = [
  { id: 'articles', label: 'Lanzamientos', icon: '◈' },
  { id: 'brands',   label: 'Marcas',        icon: '◉' },
  { id: 'products', label: 'Catálogo',       icon: '▣' },
  { id: 'pages',    label: 'Páginas',        icon: '◧' },
  { id: 'settings', label: 'Ajustes',        icon: '◎' },
];

function AdminApp() {
  const [authed, setAuthed]           = useState(() => localStorage.getItem(AUTH_KEY) === '1');
  const [token, setToken]             = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [section, setSection]         = useState('articles');
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [dirty, setDirty]             = useState(false);
  const [toast, setToast]             = useState(null);
  const [loadError, setLoadError]     = useState(null);
  const [retryCount, setRetryCount]   = useState(0);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [tokenCallback, setTokenCallback]   = useState(null);

  const notify = (message, type = 'success') => setToast({ message, type });

  // Expone función global para que useUpload pueda pedir el token desde cualquier componente
  useEffect(() => {
    window.__admRequestToken = (cb) => {
      setTokenCallback(() => cb);
      setShowTokenModal(true);
    };
    return () => { delete window.__admRequestToken; };
  }, []);

  // Carga datos directamente desde raw.githubusercontent.com — no requiere token
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    setLoadError(null);
    fetch(rawUrl('data.js') + '?t=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(code => {
        const parsed = parseDataJs(code);
        if (parsed) {
          if (!parsed.config) parsed.config = { homepageArticleCount: 8 };
          setData(parsed);
        } else {
          setLoadError('No se pudo parsear data.js. Verificá el archivo en GitHub.');
        }
      })
      .catch(e => setLoadError(`Error al cargar datos: ${e.message}`))
      .finally(() => setLoading(false));
  }, [authed, retryCount]);

  const handleDataChange = d => { setData(d); setDirty(true); };

  const doPublish = async (tkn) => {
    setSaving(true);
    try {
      const fileInfo = await ghGet('data.js', tkn);
      const content = generateDataJs(data);
      await ghPut('data.js', tkn, content, fileInfo.sha, 'admin: actualizar datos del sitio');
      setDirty(false);
      notify('¡Publicado! Vercel redeploya automáticamente.');
    } catch (e) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('bad credentials') || msg.includes('401')) {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
        notify('Token inválido. Actualizá el token en Ajustes.', 'error');
      } else {
        notify(`Error al publicar: ${msg}`, 'error');
      }
    }
    setSaving(false);
  };

  const handlePublish = () => {
    if (!dirty) return;
    if (!token) { setShowTokenModal(true); return; }
    doPublish(token);
  };

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const homepageCount = (data?.config || {}).homepageArticleCount || 8;
  const setHomepageCount = n => handleDataChange({ ...data, config: { ...(data?.config || {}), homepageArticleCount: n } });

  return (
    <div className="adm-app">
      {sidebarOpen && <div className="adm-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`adm-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="adm-sidebar__brand">
          <div className="adm-sidebar__brand-row">
            <div>
              <span>BAG</span>
              <span className="adm-sidebar__sub">Admin Panel</span>
            </div>
            <button className="adm-sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">✕</button>
          </div>
        </div>
        <nav className="adm-nav">
          {NAV.map(n => (
            <button key={n.id} className={`adm-nav__item ${section === n.id ? 'is-active' : ''}`} onClick={() => { setSection(n.id); setSidebarOpen(false); }}>
              <span className="adm-nav__icon">{n.icon}</span>
              <span className="adm-nav__label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="adm-sidebar__footer">
          <a href="index.html" target="_blank" rel="noreferrer" className="adm-nav__item">
            <span className="adm-nav__icon">↗</span>
            <span className="adm-nav__label">Ver sitio</span>
          </a>
          <button className="adm-nav__item" onClick={() => { localStorage.removeItem(AUTH_KEY); setAuthed(false); }}>
            <span className="adm-nav__icon">⎋</span>
            <span className="adm-nav__label">Salir</span>
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <button className="adm-menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <h1 className="adm-topbar__title">{NAV.find(n => n.id === section)?.label}</h1>
          <div className="adm-topbar__right">
            {dirty && <span className="adm-dirty-badge">Cambios sin publicar</span>}
            <Btn disabled={!dirty || saving} onClick={handlePublish}>
              {saving ? 'Publicando...' : dirty ? 'Publicar en GitHub' : '✓ Publicado'}
            </Btn>
          </div>
        </header>

        <div className="adm-content">
          {loading && <div className="adm-loading"><div className="adm-spinner" /><span>Cargando datos desde GitHub...</span></div>}

          {!loading && loadError && (
            <div className="adm-load-error">
              <p className="adm-load-error__msg">{loadError}</p>
              <div className="adm-load-error__actions">
                <Btn onClick={() => setRetryCount(c => c + 1)}>Reintentar</Btn>
                <Btn variant="ghost" onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(''); }}>Cambiar token</Btn>
              </div>
            </div>
          )}

          {!loading && data && section === 'articles' && (
            <ArticlesSection data={data} onDataChange={handleDataChange} token={token}
              homepageCount={homepageCount} onHomepageCountChange={setHomepageCount} />
          )}
          {!loading && data && section === 'brands' && (
            <BrandsSection data={data} onDataChange={handleDataChange} token={token} />
          )}
          {!loading && data && section === 'products' && (
            <ProductsSection data={data} onDataChange={handleDataChange} token={token} />
          )}
          {!loading && data && section === 'pages' && (
            <PagesSection data={data} onDataChange={handleDataChange} />
          )}
          {section === 'settings' && (
            <SettingsSection token={token} onTokenChange={t => setToken(t)} />
          )}
        </div>
      </div>

      {showTokenModal && (
        <TokenModal
          onCancel={() => {
            setShowTokenModal(false);
            if (tokenCallback) { tokenCallback(null); setTokenCallback(null); }
          }}
          onSave={t => {
            setToken(t);
            setShowTokenModal(false);
            if (tokenCallback) {
              tokenCallback(t);
              setTokenCallback(null);
            } else {
              doPublish(t);
            }
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('admin-root')).render(<AdminApp />);
