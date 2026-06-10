#!/usr/bin/env node
/**
 * GetProductViewModel response yapısını yazdır.
 * KCAL-7 (productId=9295987) ile test eder.
 */

import 'dotenv/config';

const headers = {
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

const productId = 9295987; // KCAL-7

const res = await fetch('https://api.adisyo.com/api/menus/GetProductViewModel', {
  method: 'POST',
  headers,
  body: JSON.stringify({ Value: String(productId) }),
});
const text = await res.text();

console.log(`HTTP ${res.status}, length: ${text.length}\n`);

if (!res.ok) {
  console.log('ERROR BODY:', text);
  process.exit(1);
}

const json = JSON.parse(text);

console.log('=== TOP-LEVEL KEYS ===');
console.log(Object.keys(json));

console.log('\n=== FULL JSON ===');
console.log(JSON.stringify(json, null, 2));
