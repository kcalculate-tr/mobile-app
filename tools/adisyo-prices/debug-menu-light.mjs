#!/usr/bin/env node
/**
 * Tek seferlik debug: Internal API GetCustomerMenuLight response'unun
 * yapısını yazdırır. Public API rate-limited olduğu için bu yolu deniyoruz.
 */

import 'dotenv/config';

const internalHeaders = {
  'Authorization': `Bearer ${process.env.ADISYO_BEARER_TOKEN}`,
  'devicekey':     process.env.ADISYO_DEVICE_KEY,
  'restaurant':    process.env.ADISYO_RESTAURANT_ID,
  'origin':        'https://pos.adisyo.com',
  'referer':       'https://pos.adisyo.com/',
  'source':        'mill',
  'timezone':      '-180',
  'Content-Type':  'application/json;charset=UTF-8',
  'Accept':        'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR',
};

const url = 'https://api.adisyo.com/api/menus/GetCustomerMenuLight';

console.log(`POST ${url}`);
console.log('Token (ilk 30 char):', process.env.ADISYO_BEARER_TOKEN?.slice(0, 30) + '...');

const res = await fetch(url, {
  method: 'POST',
  headers: internalHeaders,
  body: JSON.stringify({}),
});
const text = await res.text();

console.log(`\nHTTP ${res.status} ${res.statusText}`);
console.log('Length:', text.length, 'chars\n');

let json;
try { json = JSON.parse(text); }
catch {
  console.log('NOT JSON:\n', text.slice(0, 1500));
  process.exit(0);
}

console.log('=== TOP-LEVEL KEYS ===');
console.log(Object.keys(json));

console.log('\n=== STRUCTURE (depth 3) ===');
function summarize(obj, depth = 0, maxDepth = 3) {
  if (depth >= maxDepth) {
    if (Array.isArray(obj)) return `[Array len=${obj.length}]`;
    if (obj && typeof obj === 'object') return `{...${Object.keys(obj).length} keys}`;
    return typeof obj;
  }
  if (Array.isArray(obj)) {
    return `Array(len=${obj.length})${obj.length > 0 ? ' first=' + JSON.stringify(summarize(obj[0], depth + 1, maxDepth)) : ''}`;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = summarize(obj[k], depth + 1, maxDepth);
    return out;
  }
  return typeof obj === 'string' ? `"${obj.slice(0, 40)}"` : obj;
}
console.log(JSON.stringify(summarize(json), null, 2));

// Find any array containing items with productCode/code/Code field
console.log('\n=== KCAL kod aranıyor ===');
let foundKCAL = null;
function deepScan(obj, path = '$') {
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      const sample = obj[0];
      const keys = Object.keys(sample);
      // Find any key whose VALUE in any item matches /^KCAL-\d+$/
      const codeKey = keys.find(k => {
        const sampleVal = obj.find(it => typeof it[k] === 'string' && /^KCAL-\d+$/.test(it[k]));
        return !!sampleVal;
      });
      if (codeKey) {
        const idKey = keys.find(k =>
          (k.toLowerCase() === 'id' || k.toLowerCase() === 'productid') &&
          typeof sample[k] === 'number'
        );
        const matchCount = obj.filter(it => typeof it[codeKey] === 'string' && it[codeKey].startsWith('KCAL-')).length;
        console.log(`  ✓ ${path}: Array(len=${obj.length}), code field='${codeKey}', id field='${idKey}', KCAL items=${matchCount}`);
        if (!foundKCAL || matchCount > foundKCAL.matchCount) {
          foundKCAL = { path, array: obj, codeKey, idKey, matchCount, sampleKeys: keys };
        }
      }
    }
    obj.forEach((item, i) => deepScan(item, `${path}[${i}]`));
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) deepScan(obj[k], `${path}.${k}`);
  }
}
deepScan(json);

if (foundKCAL) {
  console.log(`\n=== EN İYİ EŞLEŞME: ${foundKCAL.path} ===`);
  console.log(`Code field: ${foundKCAL.codeKey}, ID field: ${foundKCAL.idKey}`);
  console.log(`Tüm field'lar: ${foundKCAL.sampleKeys.join(', ')}`);
  console.log(`\n=== İLK 3 KCAL ÜRÜNÜ ===`);
  const kcals = foundKCAL.array.filter(it =>
    typeof it[foundKCAL.codeKey] === 'string' && it[foundKCAL.codeKey].startsWith('KCAL-')
  ).slice(0, 3);
  for (const item of kcals) {
    console.log(JSON.stringify(item, null, 2));
    console.log('---');
  }
  console.log(`\n=== ÖZET: code → id eşleşmesi ===`);
  const map = {};
  foundKCAL.array.forEach(it => {
    const code = it[foundKCAL.codeKey];
    const id = foundKCAL.idKey ? it[foundKCAL.idKey] : null;
    if (typeof code === 'string' && code.startsWith('KCAL-')) {
      map[code] = id;
    }
  });
  console.log(JSON.stringify(map, null, 2));
} else {
  console.log('\n  KCAL kodu içeren array bulunamadı.');
  console.log('\n=== RAW (ilk 3000 char) ===');
  console.log(text.slice(0, 3000));
}
