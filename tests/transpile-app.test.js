// tests/transpile-app.test.js
const assert = require('assert');
const fs = require('fs');
const babel = require('@babel/standalone');

const code = fs.readFileSync('app.jsx', 'utf8');
babel.transform(code, { presets: ['react'] }); // lanza si hay error de sintaxis

// El router debe usar History API, no hash.
assert.ok(!/window\.location\.hash\s*=/.test(code), 'navigate ya no debe setear window.location.hash');
assert.ok(/history\.pushState/.test(code), 'navigate debe usar history.pushState');
assert.ok(/window\.location\.pathname/.test(code), 'el router debe leer window.location.pathname');
console.log('OK transpile-app');
