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
const ADMIN_SECRET_KEY = 'bag:admin:apisecret';

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
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </Field>
  );
}

function ImageField({ label, value, onChange, token, hint, width, onWidthChange, height, onHeightChange }) {
  const { upload, uploading } = useUpload(token);
  const ref = useRef();
  const showDims = onWidthChange !== undefined || onHeightChange !== undefined;
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
        {showDims && (
          <div className="adm-row adm-row--sm" style={{ marginTop: 6 }}>
            <input className="adm-input" value={width || ''} onChange={e => onWidthChange?.(e.target.value)} placeholder="Ancho px (ej: 1080)" style={{ flex: 1 }} />
            <input className="adm-input" value={height || ''} onChange={e => onHeightChange?.(e.target.value)} placeholder="Alto px (ej: 1350)" style={{ flex: 1 }} />
          </div>
        )}
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
function ContentBlocks({ blocks, onChange, token, products }) {
  const { upload, uploading } = useUpload(token);
  const fileRefs = useRef({});

  const add = (type) => {
    let b;
    if      (type === 'text')       b = { type, id: genId(), content: '' };
    else if (type === 'image')      b = { type, id: genId(), src: '', width: '', height: '' };
    else if (type === 'image-pair') b = { type, id: genId(), left: { src: '' }, right: { src: '' } };
    else if (type === 'video')      b = { type, id: genId(), src: '' };
    else if (type === 'product-card') b = { type, id: genId(), brand: '', model: '', colorwayId: '' };
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
                {b.type === 'text' ? 'T' : b.type === 'image' ? '▣' : b.type === 'image-pair' ? '▣▣' : b.type === 'video' ? '▶' : b.type === 'product-card' ? 'P' : 'IG'}
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
              {b.type === 'product-card' && (
                <div className="adm-block__product-fields">
                  <RelatedProductPicker
                    value={b.colorwayId ? { brand: b.brand, model: b.model, colorwayId: b.colorwayId } : null}
                    onChange={v => upd(b.id, v ? { brand: v.brand, model: v.model, colorwayId: v.colorwayId } : { brand: '', model: '', colorwayId: '' })}
                    products={products || {}}
                  />
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
        <Btn variant="ghost" size="sm" onClick={() => add('product-card')}>+ Producto</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SIZES EDITOR
// ─────────────────────────────────────────
const ALL_EU = ['38','38.5','39','39.5','40','40.5','41','42','42.5','43','44','44.5','45','46'];
const ALL_US = ['7','7.5','8','8.5','9','9.5','10','10.5','11','11.5','12','12.5','13'];
const ALL_UK = ['6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','11.5','12'];

function SizesEditor({ sizes, onSizesChange }) {
  const toggleUnit = (unit, all, s) => {
    const cur = sizes[unit] || [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    onSizesChange({ ...sizes, [unit]: next });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Talles US" hint="Seleccioná los talles US disponibles para este colorway">
        <div className="adm-sizes">
          {ALL_US.map(s => (
            <button key={s} type="button" className={`adm-size-btn ${(sizes.us || []).includes(s) ? 'is-active' : ''}`} onClick={() => toggleUnit('us', ALL_US, s)}>{s}</button>
          ))}
        </div>
      </Field>
      <Field label="Talles UK" hint="Seleccioná los talles UK disponibles para este colorway">
        <div className="adm-sizes">
          {ALL_UK.map(s => (
            <button key={s} type="button" className={`adm-size-btn ${(sizes.uk || []).includes(s) ? 'is-active' : ''}`} onClick={() => toggleUnit('uk', ALL_UK, s)}>{s}</button>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─────────────────────────────────────────
// SIZES FIELD
// ─────────────────────────────────────────
function SizesField({ label, sizes, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v || sizes.includes(v)) { setInput(''); return; }
    onChange([...sizes, v]);
    setInput('');
  };
  const remove = (s) => onChange(sizes.filter(x => x !== s));
  return (
    <Field label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="adm-sizes" style={{ minHeight: 28 }}>
          {sizes.map(s => (
            <button key={s} className="adm-size-btn is-active" onClick={() => remove(s)} title="Quitar talle" type="button">
              {s} ✕
            </button>
          ))}
          {sizes.length === 0 && <span style={{ fontSize: 12, color: 'var(--a-fg3)' }}>Sin talles cargados</span>}
        </div>
        <div className="adm-row">
          <input
            className="adm-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
            placeholder="Ej: 8.5 — Enter para agregar"
          />
          <Btn variant="ghost" size="sm" onClick={add}>+ Agregar</Btn>
        </div>
      </div>
    </Field>
  );
}

// ─────────────────────────────────────────
// RELATED PRODUCT PICKER
// ─────────────────────────────────────────
function RelatedProductPicker({ value, onChange, products }) {
  const keys = Object.keys(products || {});
  const brands = [...new Set(keys.map(k => k.split('/')[0]))];

  const [brand, setBrand] = useState(() => value?.brand || '');
  const [model, setModel] = useState(() => value?.model || '');
  const [colorwayId, setColorwayId] = useState(() => value?.colorwayId || '');

  const models = brand ? keys.filter(k => k.startsWith(brand + '/')).map(k => k.split('/')[1]) : [];
  const colorways = (brand && model) ? (products[`${brand}/${model}`] || []) : [];
  const selectedProduct = colorways.find(p => p.id === colorwayId);

  const handleBrand = b => { setBrand(b); setModel(''); setColorwayId(''); onChange(null); };
  const handleModel = m => { setModel(m); setColorwayId(''); onChange(null); };
  const handleColorway = id => {
    setColorwayId(id);
    if (brand && model && id) onChange({ brand, model, colorwayId: id });
    else onChange(null);
  };
  const clear = () => { setBrand(''); setModel(''); setColorwayId(''); onChange(null); };

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <SelectInput label="Marca" value={brand} onChange={handleBrand}
            options={[{ value: '', label: '— Sin producto —' }, ...brands.map(b => ({ value: b, label: cap(b) }))]} />
        </div>
        <div style={{ flex: 1 }}>
          <SelectInput label="Modelo" value={model} onChange={handleModel}
            options={[{ value: '', label: brand ? '— Elegir modelo —' : '— Primero marca —' }, ...models.map(m => ({ value: m, label: m }))]} />
        </div>
        <div style={{ flex: 1 }}>
          <SelectInput label="Colorway" value={colorwayId} onChange={handleColorway}
            options={[{ value: '', label: model ? '— Elegir colorway —' : '— Primero modelo —' }, ...colorways.map(p => ({ value: p.id, label: p.colorway || p.name }))]} />
        </div>
      </div>
      {selectedProduct && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--a-bg2)', borderRadius: 4, padding: '8px 12px' }}>
          {selectedProduct.images?.[0] && (
            <img src={rawUrl(selectedProduct.images[0])} alt="" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 4, background: '#111' }} onError={e => e.target.style.display='none'} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedProduct.name}</div>
            <div style={{ color: 'var(--a-fg3)', fontSize: 12 }}>{selectedProduct.colorway} · $ {Number(selectedProduct.price).toLocaleString('es-AR')}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={clear}>✕ Quitar</Btn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ARTICLE EDITOR
// ─────────────────────────────────────────
const CATEGORIES = ['LANZAMIENTO', 'CAMPAÑA', 'NOVEDAD', 'EDITORIAL'];
const BRANDS_LIST = ['Nike', 'Adidas', 'Puma'];
// Opciones de marca para un lanzamiento. "General" (valor vacío) = noticia que no
// pertenece a ninguna marca puntual (o abarca a todas).
const ARTICLE_BRAND_OPTIONS = [
  { value: '', label: 'General (todas / ninguna)' },
  { value: 'Nike', label: 'Nike' },
  { value: 'Adidas', label: 'Adidas' },
  { value: 'Puma', label: 'Puma' },
];

function ArticleEditor({ article, onSave, onCancel, token, data, adminSecret, notify }) {
  const [f, setF] = useState(() => {
    const a = migrateArticle(article);
    return {
      id: a.id || genId(),
      slug: a.slug || '',
      brand: a.brand == null ? 'Nike' : a.brand,
      category: a.category || 'LANZAMIENTO',
      title: a.title || '',
      excerpt: a.excerpt || '',
      date: a.date || '',
      cover: a.cover || '',
      coverWidth: a.coverWidth || '',
      coverHeight: a.coverHeight || '',
      imagenCard: a.imagenCard || '',
      imagenCardWidth: a.imagenCardWidth || '',
      imagenCardHeight: a.imagenCardHeight || '',
      imagenCarrusel: a.imagenCarrusel || '',
      imagenCarruselWidth: a.imagenCarruselWidth || '',
      imagenCarruselHeight: a.imagenCarruselHeight || '',
      coverVideo: a.coverVideo || '',
      featured: !!a.featured,
      sizesUS: a.sizesUS || [],
      sizesUK: a.sizesUK || [],
      contentBlocks: a.contentBlocks || [],
      relatedProduct: a.relatedProduct || null,
      showFeaturedOnHome: !!a.showFeaturedOnHome,
      showInHome: a.showInHome !== false,
      featuredWide: !!a.featuredWide,
    };
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const autoSlug = () => set('slug',
    f.title.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  );

  // ── Enviar el lanzamiento como noticia por mail a los suscriptores ──
  const [nlSentAt, setNlSentAt] = useState(null);
  const [nlSending, setNlSending] = useState(false);
  useEffect(() => {
    if (!article.id || !adminSecret) { setNlSentAt(null); return; }
    fetch('/api/send-newsletter', { headers: { 'X-Admin-Secret': adminSecret } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.sent) setNlSentAt(d.sent[article.id] || null); })
      .catch(() => {});
  }, [article.id, adminSecret]);

  const sendNewsletter = async (forceResend) => {
    if (!article.id) { notify('Guardá el lanzamiento primero para poder enviarlo por mail.', 'error'); return; }
    if (!f.title.trim() || !f.slug.trim()) { notify('El lanzamiento necesita título y slug.', 'error'); return; }
    const msg = nlSentAt
      ? `Este lanzamiento ya se envió el ${new Date(nlSentAt).toLocaleString('es-AR')}.\n\n¿Reenviarlo igual a los suscriptores confirmados?`
      : `¿Enviar "${f.title}" por mail a los suscriptores confirmados?\n\nAsegurate de haber GUARDADO el lanzamiento y esperado el deploy (~1-2 min) para que el link funcione.`;
    if (!window.confirm(msg)) return;

    const SITE = 'https://www.botinesaltagamacba.com';
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const absCover = f.cover ? (/^https?:/i.test(f.cover) ? f.cover : SITE + '/' + f.cover.replace(/^\/+/, '')) : '';
    const emailImage = absCover ? 'https://images.weserv.nl/?url=' + encodeURIComponent(absCover.replace(/^https?:\/\//, '')) + '&w=600&output=jpg&q=82' : '';
    const bodyHtml = `<h2 style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;margin:0 0 10px;color:#111827;">${esc(f.title)}</h2>`
      + (f.excerpt ? `<p style="margin:0;color:#374151;">${esc(f.excerpt)}</p>` : '');

    setNlSending(true);
    try {
      const res = await fetch('/api/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({
          subject: f.title.trim(), bodyHtml, imageUrl: emailImage,
          linkUrl: `${SITE}/lanzamientos/${f.slug}`, linkLabel: 'Leer la noticia',
          articleId: article.id, force: !!forceResend || !!nlSentAt,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.alreadySent) {
        setNlSentAt(d.sentAt);
        setNlSending(false);
        if (window.confirm(`Ya se había enviado el ${new Date(d.sentAt).toLocaleString('es-AR')}. ¿Forzar reenvío?`)) return sendNewsletter(true);
        return;
      }
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      notify(`Enviado a ${d.sent} suscriptor(es)${d.failed ? `, ${d.failed} fallaron` : ''} ✓`, 'success');
      setNlSentAt(new Date().toISOString());
    } catch (e) {
      notify(`Error al enviar: ${e.message}`, 'error');
    } finally {
      setNlSending(false);
    }
  };

  return (
    <div className="adm-editor">
      <div className="adm-editor__header">
        <div>
          <h2>{article.id ? 'Editar lanzamiento' : 'Nuevo lanzamiento'}</h2>
          {nlSentAt && <div className="adm-text" style={{ fontSize: 12, color: 'var(--a-muted, #9ca3af)', marginTop: 2 }}>📧 Enviado a suscriptores el {new Date(nlSentAt).toLocaleString('es-AR')}</div>}
        </div>
        <div className="adm-editor__actions">
          <Btn
            variant="ghost"
            disabled={nlSending || !article.id}
            title={!article.id ? 'Guardá el lanzamiento primero para poder enviarlo por mail' : 'Enviar este lanzamiento por mail a los suscriptores'}
            onClick={() => sendNewsletter()}
          >
            {nlSending ? 'Enviando…' : (nlSentAt ? '📧 Reenviar a suscriptores' : '📧 Enviar a suscriptores')}
          </Btn>
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
            <SelectInput label="Marca" value={f.brand} onChange={v => set('brand', v)} options={ARTICLE_BRAND_OPTIONS} />
            <SelectInput label="Categoría" value={f.category} onChange={v => set('category', v)} options={CATEGORIES} />
          </div>
          <TextInput label="Título" value={f.title} onChange={v => set('title', v)} required placeholder="Puma lanza el Showtime Pack..." />
          <div className="adm-row">
            <div style={{ flex: 1 }}><TextInput label="Slug (URL)" value={f.slug} onChange={v => set('slug', v)} placeholder="puma-showtime-pack" /></div>
            <Btn variant="ghost" size="sm" style={{ marginTop: 20 }} onClick={autoSlug}>Auto</Btn>
          </div>
          <TextInput label="Fecha" value={f.date} onChange={v => set('date', v)} placeholder="24 MAY 2026" />
          <Textarea label="Bajada / Excerpt" value={f.excerpt} onChange={v => set('excerpt', v)} rows={3} placeholder="Resumen del artículo que aparece en las tarjetas..." />
          <ImageField label="Imagen de portada" value={f.cover} onChange={v => set('cover', v)} token={token} hint="Imagen que aparece en el hero del artículo. Obligatoria."
            width={f.coverWidth} onWidthChange={v => set('coverWidth', v)}
            height={f.coverHeight} onHeightChange={v => set('coverHeight', v)} />
          <ImageField label="Imagen para Card (opcional)" value={f.imagenCard} onChange={v => set('imagenCard', v)} token={token} hint="Imagen que se muestra en las cards del listado. Si no se completa, se usa la imagen principal."
            width={f.imagenCardWidth} onWidthChange={v => set('imagenCardWidth', v)}
            height={f.imagenCardHeight} onHeightChange={v => set('imagenCardHeight', v)} />
          <ImageField label="Imagen para Carrusel del Home (opcional)" value={f.imagenCarrusel} onChange={v => set('imagenCarrusel', v)} token={token} hint="Imagen que se muestra en el carrusel principal del home. Si no se completa, se usa la imagen de portada."
            width={f.imagenCarruselWidth} onWidthChange={v => set('imagenCarruselWidth', v)}
            height={f.imagenCarruselHeight} onHeightChange={v => set('imagenCarruselHeight', v)} />
          <VideoField label="Video de portada (opcional)" value={f.coverVideo} onChange={v => set('coverVideo', v)} token={token} hint="YouTube, Vimeo o archivo. Se muestra en el hero del artículo en lugar de la imagen." />
          <Field>
            <label className="adm-checkbox">
              <input type="checkbox" checked={f.showInHome} onChange={e => set('showInHome', e.target.checked)} />
              <span>Mostrar en el home</span>
            </label>
          </Field>
          <Field>
            <label className="adm-checkbox">
              <input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} />
              <span>Mostrar en el carrusel principal del home (arriba de todo)</span>
            </label>
          </Field>
          <Field>
            <label className="adm-checkbox">
              <input type="checkbox" checked={f.featuredWide} onChange={e => set('featuredWide', e.target.checked)} />
              <span>Mostrar como artículo ancho destacado (imagen grande, sin tarjeta de producto)</span>
            </label>
          </Field>
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Card de colorway</div>
          <p className="adm-text" style={{ marginBottom: 12, fontSize: 13 }}>
            Elegí un colorway para asociar a este lanzamiento. Se mostrará como panel lateral cuando aparezca en el carrusel del home.
          </p>
          <RelatedProductPicker
            value={f.relatedProduct}
            onChange={v => { set('relatedProduct', v); if (!v) set('showFeaturedOnHome', false); }}
            products={(data && data.products) || {}}
          />
          {f.relatedProduct && (
            <Field>
              <label className="adm-checkbox" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={!!f.showFeaturedOnHome} onChange={e => set('showFeaturedOnHome', e.target.checked)} />
                <span>Mostrar como bloque destacado grande, con la tarjeta del colorway (si ya está en el carrusel, no se repite acá)</span>
              </label>
            </Field>
          )}
        </div>
        <div className="adm-section">
          <div className="adm-section__title">Contenido del artículo</div>
          <ContentBlocks blocks={f.contentBlocks} onChange={v => set('contentBlocks', v)} token={token} products={(data && data.products) || {}} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ARTICLES SECTION
// ─────────────────────────────────────────
function ArticlesSection({ data, onDataChange, token, adminSecret, notify, homepageCount, onHomepageCountChange }) {
  const [editing, setEditing] = useState(null);

  if (editing !== null) {
    return (
      <ArticleEditor
        article={editing}
        token={token}
        data={data}
        adminSecret={adminSecret}
        notify={notify}
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
              {Array.from({ length: (data.articles || []).length }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
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
                <span className="adm-badge adm-badge--muted">{article.brand || 'General'}</span>
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
  const videoRef = useRef();
  const [f, setF] = useState({
    id: product.id || genId(),
    name: product.name || '',
    colorway: product.colorway || '',
    color: product.color || '#ffffff',
    price: product.price || 0,
    availableSizes: product.availableSizes || [],
    sizes: product.sizes || { eu: ALL_EU, us: [], uk: [] },
    images: product.images || [],
    videos: product.videos || [],
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
          <SizesEditor
            sizes={f.sizes}
            onSizesChange={v => set('sizes', v)}
          />
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
          <div className="adm-section__title">Videos del producto</div>
          <div className="adm-images-grid">
            {f.videos.map((vid, i) => (
              <div key={i} className="adm-thumb adm-thumb--video">
                <video src={rawUrl(vid)} className="adm-thumb__video-preview" />
                <button className="adm-thumb__remove" onClick={() => set('videos', f.videos.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div className="adm-thumb adm-thumb--add">
              <input type="file" ref={videoRef} style={{ display: 'none' }} accept="video/*"
                onChange={async e => {
                  const file = e.target.files[0]; if (!file) return;
                  try { set('videos', [...f.videos, await upload(file)]); } catch (err) { alert('Error: ' + err.message); }
                  e.target.value = '';
                }} />
              <button onClick={() => videoRef.current?.click()} disabled={uploading}>{uploading ? '…' : '▶ +'}</button>
            </div>
          </div>
          <span className="adm-hint">Los videos se muestran al final de la galería de imágenes del producto.</span>
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
                      <div className="adm-product-card__sizes">{((prod.sizes?.us || []).length + (prod.sizes?.uk || []).length)} talles cargados</div>
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
function SettingsSection({ token, onTokenChange, adminSecret, onAdminSecretChange }) {
  const [draft, setDraft] = useState(token || '');
  const [ok, setOk] = useState(false);
  const save = () => { onTokenChange(draft); localStorage.setItem(TOKEN_KEY, draft); setOk(true); setTimeout(() => setOk(false), 2000); };

  const [secretDraft, setSecretDraft] = useState(adminSecret || '');
  const [secretOk, setSecretOk] = useState(false);
  const saveSecret = () => { onAdminSecretChange(secretDraft); localStorage.setItem(ADMIN_SECRET_KEY, secretDraft); setSecretOk(true); setTimeout(() => setSecretOk(false), 2000); };

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
        <div className="adm-section__title">Pedidos (Vercel Blob)</div>
        <p className="adm-text">Los pedidos se guardan en un almacenamiento privado, separado del código público del sitio. Este secreto tiene que ser igual a la variable de entorno <code>ADMIN_API_SECRET</code> configurada en Vercel para poder leerlos acá.</p>
        <TextInput label="Admin API Secret" value={secretDraft} onChange={setSecretDraft} type="password" placeholder="mismo valor que ADMIN_API_SECRET en Vercel" hint="Guardado en localStorage de este navegador." />
        <Btn onClick={saveSecret}>{secretOk ? '✓ Guardado' : 'Guardar secreto'}</Btn>
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
          <img src="assets/logo-altagama-transparent.png" alt="Botines Alta Gama" style={{ height: 60 }} />
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
// ORDERS SECTION
// ─────────────────────────────────────────
function OrdersSection({ adminSecret, notify, products }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const confirmOrder = async (orderId) => {
    setConfirming(orderId);
    try {
      const res = await fetch('/api/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al confirmar el pedido');
      if (data.emailSent) {
        notify('Pago confirmado. Mail de confirmación enviado al cliente ✓', 'success');
      } else {
        notify(`Pago confirmado, pero el mail NO se envió: ${data.emailReason || 'motivo desconocido'}`, 'warn');
      }
      loadOrders();
    } catch (e) {
      notify(`Error al confirmar el pedido: ${e.message}`, 'error');
    } finally {
      setConfirming(null);
    }
  };

  const deleteOrder = async (order) => {
    const quien = order.payer_name || order.payer_email || order.id;
    if (!window.confirm(`¿Eliminar el pedido de ${quien}?\n\nEsta acción no se puede deshacer.`)) return;
    setDeleting(order.id);
    try {
      const res = await fetch('/api/delete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el pedido');
      notify('Pedido eliminado.', 'success');
      loadOrders();
    } catch (e) {
      notify(`Error al eliminar el pedido: ${e.message}`, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const loadOrders = () => {
    setLoading(true);
    setError(null);
    fetch('/api/orders', { headers: { 'X-Admin-Secret': adminSecret } })
      .then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Falta configurar el secreto de admin en Ajustes' : `HTTP ${r.status}`); return r.json(); })
      .then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { loadOrders(); }, [adminSecret]);

  const fmt = n => '$ ' + Number(n).toLocaleString('es-AR');

  // Mapa id de producto -> primera foto del catálogo, para identificar el pedido de un vistazo.
  const productImg = {};
  for (const key of Object.keys(products || {})) {
    for (const v of (products[key] || [])) {
      if (v && v.id && v.images && v.images[0]) productImg[v.id] = v.images[0];
    }
  }

  const STATUS = {
    approved:  { label: 'Pagado',                        cls: 'success' },
    pending:   { label: 'Pendiente',                      cls: 'warn'    },
    pendiente: { label: 'Pendiente (transferencia)',      cls: 'warn'    },
    rejected:  { label: 'Rechazado',                      cls: 'danger'  },
    cancelled: { label: 'Cancelado',                      cls: 'muted'   },
  };

  return (
    <div>
      <div className="adm-section-header">
        <h2>Órdenes</h2>
        <Btn variant="ghost" size="sm" onClick={loadOrders}>↺ Actualizar</Btn>
      </div>

      {loading && <div className="adm-loading"><div className="adm-spinner" /><span>Cargando órdenes...</span></div>}
      {!loading && error && <p className="adm-text" style={{ color: 'var(--a-danger)' }}>Error: {error}</p>}
      {!loading && !error && orders.length === 0 && (
        <div className="adm-section">
          <p className="adm-text">Todavía no hay órdenes. Aparecerán acá una vez que se realice el primer pago con MercadoPago.</p>
        </div>
      )}
      {!loading && orders.length > 0 && (
        <div className="adm-orders-list">
          {orders.map(o => {
            const st = STATUS[o.status] || { label: o.status, cls: 'muted' };
            const isExpanded = expandedId === o.id;
            const toggle = () => {
              if (window.getSelection && String(window.getSelection())) return; // no togglear si está seleccionando texto
              setExpandedId(id => id === o.id ? null : o.id);
            };
            return (
              <div key={o.id} className="adm-order">
              <div className="adm-order-row" onClick={toggle} style={{ cursor: 'pointer' }}>
                <span className={`adm-status adm-status--${st.cls}`}>{st.label}</span>
                <div className="adm-order-row__info">
                  <div className="adm-order-row__name">
                    <span style={{ display: 'inline-block', width: 12, marginRight: 6, color: 'var(--a-fg3)', transition: 'transform .15s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▸</span>
                    {o.payer_name || o.payer_email || '—'}
                  </div>
                  {o.payer_email && <div className="adm-order-row__email">{o.payer_email}</div>}
                  <div className="adm-order-row__items">
                    {(o.items || []).map((it, i) => {
                      const img = productImg[it.id];
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i ? 6 : 0 }}>
                          {img
                            ? <img src={img} alt="" loading="lazy" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#111' }} />
                            : <div style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👟</div>}
                          <span>{it.title}{Number(it.quantity) > 1 ? ` ×${it.quantity}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                  {o.shipping && (
                    <div className="adm-order-row__shipping">
                      <div>{o.shipping.nombre} {o.shipping.apellido} · DNI {o.shipping.dni}</div>
                      <div>{o.shipping.direccion}, {o.shipping.localidad}, {o.shipping.provincia} (CP {o.shipping.codigoPostal})</div>
                      <div>Cel: {o.shipping.celular}</div>
                      {o.shipping.descripcion && <div>Nota: {o.shipping.descripcion}</div>}
                    </div>
                  )}
                </div>
                <div className="adm-order-row__meta">
                  <div className="adm-order-row__amount">{fmt(o.amount)}</div>
                  <div className="adm-order-row__date">{o.date ? new Date(o.date).toLocaleDateString('es-AR') : '—'}</div>
                  <div className="adm-order-row__id">{o.payment_method === 'transferencia' ? 'Transferencia' : `MP #${o.mp_payment_id}`}</div>
                  {o.status === 'pendiente' && (
                    <Btn size="sm" onClick={(e) => { e.stopPropagation(); confirmOrder(o.id); }} disabled={confirming === o.id} style={{ marginTop: 6 }}>
                      {confirming === o.id ? 'Confirmando...' : 'Confirmar pago'}
                    </Btn>
                  )}
                  <Btn variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); deleteOrder(o); }} disabled={deleting === o.id} style={{ marginTop: 6 }}>
                    {deleting === o.id ? 'Eliminando...' : 'Eliminar'}
                  </Btn>
                </div>
              </div>
              {isExpanded && (
                <div style={{ marginTop: 8, background: 'var(--a-surface2)', border: '1px solid var(--a-border)', borderRadius: 8, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {(o.items || []).map((it, i) => {
                    const img = productImg[it.id];
                    return (
                      <div key={i} style={{ width: 220, maxWidth: '100%' }}>
                        {img
                          ? <img src={img} alt="" style={{ width: '100%', borderRadius: 8, display: 'block', background: '#111' }} />
                          : <div style={{ width: '100%', height: 220, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>👟</div>}
                        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4 }}>{it.title}{Number(it.quantity) > 1 ? ` ×${it.quantity}` : ''}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
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
// TYPOGRAPHY SECTION
// ─────────────────────────────────────────
function TypographySection({ data, onDataChange }) {
  const typo   = (data.config && data.config.typography) || {};
  const serif  = typo.serif  || 'playfair';
  const accent = typo.accent || '#ffffff';

  const update = (patch) => {
    onDataChange({
      ...data,
      config: { ...(data.config || {}), typography: { ...typo, ...patch } },
    });
  };

  const serifOpts = [
    { value: 'playfair',  label: 'Playfair Display',   family: "'Playfair Display', Georgia, serif",  desc: 'Clásica y editorial' },
    { value: 'cormorant', label: 'Cormorant Garamond',  family: "'Cormorant Garamond', Georgia, serif", desc: 'Elegante y ligera'   },
    { value: 'bebas',     label: 'Bebas Neue',          family: "'Bebas Neue', sans-serif",             desc: 'Deportiva y condensada' },
    { value: 'unna',      label: 'Unna',                family: "'Unna', Georgia, serif",               desc: 'Serif clásica legible'  },
  ];

  const accentOpts = [
    { value: '#ffffff', label: 'Blanco',  fg: '#0a0a0a' },
    { value: '#e63946', label: 'Rojo',    fg: '#ffffff' },
    { value: '#d4ff00', label: 'Lima',    fg: '#0a0a0a' },
    { value: '#ff6b00', label: 'Naranja', fg: '#ffffff' },
  ];

  const previewSerif  = (serifOpts.find(o => o.value === serif)  || serifOpts[0]).family;
  const previewAccent = accentOpts.find(o => o.value === accent) || accentOpts[0];

  return (
    <div>
      <div className="adm-section-header"><h2>Tipografía</h2></div>

      <div className="adm-section">
        <div className="adm-section__title">Fuente de titulares</div>
        <p className="adm-text">Afecta títulos principales, nombres de productos y encabezados del sitio.</p>
        <div className="adm-typo-opts">
          {serifOpts.map(opt => (
            <button
              key={opt.value}
              className={`adm-typo-opt${serif === opt.value ? ' is-active' : ''}`}
              onClick={() => update({ serif: opt.value })}
            >
              <span className="adm-typo-opt__preview" style={{ fontFamily: opt.family }}>Ag</span>
              <span className="adm-typo-opt__name">{opt.label}</span>
              <span className="adm-typo-opt__desc">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Color de acento</div>
        <p className="adm-text">Se aplica en botones de compra, estados activos y elementos interactivos.</p>
        <div className="adm-accent-opts">
          {accentOpts.map(opt => (
            <button
              key={opt.value}
              className={`adm-accent-opt${accent === opt.value ? ' is-active' : ''}`}
              onClick={() => update({ accent: opt.value })}
            >
              <span className="adm-accent-opt__swatch" style={{ background: opt.value }} />
              <span>{opt.label}</span>
              {accent === opt.value && <span className="adm-accent-opt__check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Vista previa</div>
        <div className="adm-typo-preview">
          <span className="adm-typo-preview__eyebrow">LANZAMIENTO · ADIDAS</span>
          <span className="adm-typo-preview__title" style={{ fontFamily: previewSerif }}>
            Predator Elite SG<br />"Road to Glory"
          </span>
          <span className="adm-typo-preview__colorway">Colorway "Cloud White / Core Black"</span>
          <span className="adm-typo-preview__price">$ 189.990</span>
          <span className="adm-typo-preview__btn" style={{ background: previewAccent.value, color: previewAccent.fg }}>
            AGREGAR AL CARRITO
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
function SubscribersSection({ adminSecret, notify }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    fetch('/api/subscribers', { headers: { 'X-Admin-Secret': adminSecret } })
      .then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Falta el secreto de admin en Ajustes' : `HTTP ${r.status}`); return r.json(); })
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { load(); }, [adminSecret]);

  const confirmed = subs.filter(s => s.status === 'confirmed');

  const send = async () => {
    if (!subject.trim() || !body.trim()) { notify('Completá asunto y contenido.', 'error'); return; }
    if (!window.confirm(`¿Enviar este aviso a ${confirmed.length} suscripto(s) confirmado(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ subject: subject.trim(), bodyHtml: body, imageUrl: imageUrl.trim(), linkUrl: linkUrl.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al enviar');
      notify(`Enviado a ${d.sent} suscripto(s)${d.failed ? `, ${d.failed} fallaron` : ''}.`, 'success');
      setSubject(''); setBody(''); setImageUrl(''); setLinkUrl('');
    } catch (e) { notify(`Error: ${e.message}`, 'error'); }
    finally { setSending(false); }
  };

  const resendConfirm = async (email) => {
    setResending(email);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      notify('Mail de confirmación reenviado ✓', 'success');
      load();
    } catch (e) { notify(`Error: ${e.message}`, 'error'); }
    finally { setResending(null); }
  };

  return (
    <div>
      <div className="adm-section-header">
        <h2>Suscriptos</h2>
        <Btn variant="ghost" size="sm" onClick={load}>↺ Actualizar</Btn>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Enviar aviso de lanzamiento</div>
        <p className="adm-text">Se envía a los {confirmed.length} suscripto(s) confirmado(s).</p>
        <TextInput label="Asunto" value={subject} onChange={setSubject} placeholder="Nuevo lanzamiento 🔥" />
        <Textarea label="Contenido (podés usar HTML simple)" value={body} onChange={setBody} rows={6} placeholder="<p>Ya llegaron los nuevos...</p>" />
        <TextInput label="URL de imagen (opcional)" value={imageUrl} onChange={setImageUrl} placeholder="https://..." />
        <TextInput label="URL del botón (opcional)" value={linkUrl} onChange={setLinkUrl} placeholder="https://www.botinesaltagamacba.com/..." />
        <Btn onClick={send} disabled={sending}>{sending ? 'Enviando...' : 'Enviar a todos'}</Btn>
      </div>

      <div className="adm-section">
        <div className="adm-section__title">Lista ({subs.length})</div>
        {loading && <div className="adm-loading"><div className="adm-spinner" /><span>Cargando...</span></div>}
        {!loading && error && <p className="adm-text" style={{ color: 'var(--a-danger)' }}>Error: {error}</p>}
        {!loading && !error && subs.length === 0 && <p className="adm-text">Todavía no hay suscriptos.</p>}
        {!loading && subs.length > 0 && (
          <div className="adm-orders-list">
            {subs.map((s, i) => (
              <div key={i} className="adm-order-row">
                <span className={`adm-status adm-status--${s.status === 'confirmed' ? 'success' : 'warn'}`}>{s.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</span>
                <div className="adm-order-row__info">
                  <div className="adm-order-row__name">{s.name || '—'}</div>
                  <div className="adm-order-row__email">{s.email}</div>
                  {s.couponCode && <div className="adm-order-row__items">Cupón {s.couponCode}</div>}
                </div>
                <div className="adm-order-row__meta">
                  <div className="adm-order-row__date">{s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString('es-AR') : '—'}</div>
                  {s.status !== 'confirmed' && (
                    <Btn variant="ghost" size="sm" disabled={resending === s.email} onClick={() => resendConfirm(s.email)}>
                      {resending === s.email ? 'Enviando...' : 'Reenviar confirmación'}
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { id: 'articles',   label: 'Lanzamientos', icon: '◈' },
  { id: 'brands',     label: 'Marcas',        icon: '◉' },
  { id: 'products',   label: 'Catálogo',       icon: '▣' },
  { id: 'orders',     label: 'Órdenes',        icon: '◍' },
  { id: 'subscribers', label: 'Suscriptos',   icon: '✉' },
  { id: 'pages',      label: 'Páginas',        icon: '◧' },
  { id: 'typography', label: 'Tipografía',     icon: '◑' },
  { id: 'settings',   label: 'Ajustes',        icon: '◎' },
];

function AdminApp() {
  const [authed, setAuthed]           = useState(() => localStorage.getItem(AUTH_KEY) === '1');
  const [token, setToken]             = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem(ADMIN_SECRET_KEY) || '');
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
      const low = msg.toLowerCase();
      if (low.includes('bad credentials') || msg.includes('401')) {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
        notify('Token inválido. Actualizá el token en Ajustes.', 'error');
      } else if (low.includes('not found') || msg.includes('404')) {
        notify('El token no tiene permiso de escritura sobre el repositorio. Creá un token clásico con el scope "repo" desde la cuenta dueña del repo (Maximogargiulo11) y guardalo en Ajustes.', 'error');
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
          <a href="https://www.botinesaltagamacba.com/" target="_blank" rel="noreferrer" className="adm-nav__item">
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
              adminSecret={adminSecret} notify={notify}
              homepageCount={homepageCount} onHomepageCountChange={setHomepageCount} />
          )}
          {!loading && data && section === 'brands' && (
            <BrandsSection data={data} onDataChange={handleDataChange} token={token} />
          )}
          {!loading && data && section === 'products' && (
            <ProductsSection data={data} onDataChange={handleDataChange} token={token} />
          )}
          {section === 'orders' && <OrdersSection adminSecret={adminSecret} notify={notify} products={(data && data.products) || null} />}
          {section === 'subscribers' && <SubscribersSection adminSecret={adminSecret} notify={notify} />}
          {!loading && data && section === 'pages' && (
            <PagesSection data={data} onDataChange={handleDataChange} />
          )}
          {!loading && data && section === 'typography' && (
            <TypographySection data={data} onDataChange={handleDataChange} />
          )}
          {section === 'settings' && (
            <SettingsSection token={token} onTokenChange={t => setToken(t)}
              adminSecret={adminSecret} onAdminSecretChange={s => setAdminSecret(s)} />
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
