#!/usr/bin/env node
/**
 * Tek seferlik debug: Adisyo Public API GET /Products response'unun
 * yapısını yazdırır, ki parser'ı doğru field'a yönlendirebilelim.
 */

import 'dotenv/config';

const headers = {
  'x-api-key':      process.env.ADISYO_PUBLIC_API_KEY,
  'x-api-secret':   process.env.ADISYO_PUBLIC_API_SECRET,
  'x-api-consumer': process.env.ADISYO_PUBLIC_API_CONSUMER,
  'Content-Type':   'application/json',
  'Accept':         'application/json',
};

const url = 'https://ext.adisyo.com/api/External/v2/Products';

console.log(`GET ${url}`);
console.log('Headers:', { ...headers, 'x-api-key': '***', 'x-api-secret': '***' });

const res = await fetch(url, { headers });
const text = await res.text();

console.log(`\nHTTP ${res.status} ${res.statusText}`);
console.log('Response Content-Type:', res.headers.get('content-type'));
console.log('Response length:', text.length, 'chars\n');

let json;
try { json = JSON.parse(text); }
catch {
  console.log('NOT JSON. Raw response:\n', text.slice(0, 2000));
  process.exit(0);
}

// Top-level structure
console.log('=== TOP-LEVEL KEYS ===');
console.log(Object.keys(json));

// First-level recursive structure (depth 2)
console.log('\n=== STRUCTURE (depth 2) ===');
function summarize(obj, depth = 0, maxDepth = 2) {
  if (depth >= maxDepth) return Array.isArray(obj) ? `[Array len=${obj.length}]` : typeof obj;
  if (Array.isArray(obj)) {
    return `Array(len=${obj.length})${obj.length > 0 ? ' first=' + summarize(obj[0], depth + 1, maxDepth) : ''}`;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = summarize(obj[k], depth + 1, maxDepth);
    }
    return out;
  }
  return typeof obj === 'string' ? `"${obj.slice(0, 50)}"` : obj;
}
console.log(JSON.stringify(summarize(json), null, 2));

// Try to find any array of objects that has productCode field
console.log('\n=== productCode AVI ===');
function findProductsArray(obj, path = '$') {
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object') {
      const sample = obj[0];
      const keys = Object.keys(sample);
      const hasCode = keys.some(k => k.toLowerCase() === 'productcode');
      const hasId = keys.some(k => k.toLowerCase() === 'id' || k.toLowerCase() === 'productid');
      console.log(`  ${path}: Array(len=${obj.length}), keys: ${keys.slice(0, 10).join(', ')}${hasCode && hasId ? '  ← MATCHES' : ''}`);
    }
    if (obj.length > 0) findProductsArray(obj[0], path + '[0]');
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      findProductsArray(obj[k], `${path}.${k}`);
    }
  }
}
findProductsArray(json);

// First product sample (full JSON)
console.log('\n=== FIRST PRODUCT (if found) ===');
function firstProduct(obj) {
  if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
    const keys = Object.keys(obj[0]);
    if (keys.some(k => k.toLowerCase() === 'productcode')) return obj[0];
  }
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const found = firstProduct(v);
      if (found) return found;
    }
  }
  return null;
}
const fp = firstProduct(json);
if (fp) {
  console.log(JSON.stringify(fp, null, 2));
} else {
  console.log('(productCode field içeren array bulunamadı)');
  console.log('\n=== RAW RESPONSE (ilk 3000 char) ===');
  console.log(text.slice(0, 3000));
}
