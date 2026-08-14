// tests/vercel-json.test.js
const assert = require('assert');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); // lanza si el JSON es inválido
assert.ok(Array.isArray(cfg.rewrites), 'debe existir rewrites');
const dests = cfg.rewrites.map(r => r.destination);
const sources = cfg.rewrites.map(r => r.source);
assert.ok(sources.some(s => s.includes(':id')) && dests.includes('/api/page'), 'producto → /api/page');
assert.ok(sources.some(s => s.includes('lanzamientos')) && dests.includes('/api/page'), 'lanzamiento → /api/page');
assert.strictEqual(cfg.rewrites[cfg.rewrites.length - 1].destination, '/index.html', 'catch-all al final → index.html');
console.log('OK vercel-json');
