#!/usr/bin/env node
/**
 * KCAL → Adisyo Toplu Fiyat Senkronizasyonu (v4)
 *
 * v3'ten farkı: TARGET_PRICES artık Supabase products tablosundan dinamik
 * çekiliyor. Mobil uygulamadaki fiyatları Adisyo'ya push eder.
 *
 * Akış:
 *   1) Supabase products tablosundan adisyo_product_code='KCAL-*' satırları çek
 *   2) Internal API GetCustomerMenuLight ile Adisyo'daki KCAL → productId mapping
 *   3) Her ürün için GetProductViewModel → fiyat patch → SaveProduct
 *
 * Çalıştırma:
 *   cd tools/adisyo-prices
 *   node update-prices-v4.mjs --dry-run
 *   node update-prices-v4.mjs --only KCAL-7
 *   node update-prices-v4.mjs
 *
 * Token süresi dolduğunda (HTTP 401):
 *   pos.adisyo.com → F12 → Network → SaveProduct request → headers'tan
 *   Authorization (Bearer ...), devicekey, restaurant değerlerini al,
 *   .env'deki ADISYO_BEARER_TOKEN/DEVICE_KEY/RESTAURANT_ID'yi güncelle.
 */

import 'dotenv/config';
import process from 'node:process';

const INTERNAL_API = 'https://api.adisyo.com/api/menus';

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`❌ .env'de ${k} eksik`); process.exit(1); }
  return v;
};

const adisyoHeaders = {
  'Authorization':   `Bearer ${need('ADISYO_BEARER_TOKEN')}`,
  'devicekey':       need('ADISYO_DEVICE_KEY'),
  'restaurant':      need('ADISYO_RESTAURANT_ID'),
  'origin':          'https://pos.adisyo.com',
  'referer':         'https://pos.adisyo.com/',
  'source':          'mill',
  'timezone':        '-180',
  'Content-Type':    'application/json;charset=UTF-8',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR',
};

const SUPABASE_URL = need('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = need('SUPABASE_SERVICE_ROLE_KEY');

const supabaseHeaders = {
  'apikey':        SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Accept':        'application/json',
};

// =====================================================================
// CLI
// =====================================================================
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map(s => s.trim())) : null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url.split('/').pop()}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return json ?? text;
}

// JWT exp kontrolü: süresi dolmuşsa erken çık, kullanıcıya net yönerge ver
function checkTokenExpiry() {
  const token = process.env.ADISYO_BEARER_TOKEN;
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const expMs = decoded.exp * 1000;
    const now = Date.now();
    const remaining = expMs - now;
    if (remaining <= 0) {
      console.error(`❌ ADISYO_BEARER_TOKEN expired ${new Date(expMs).toISOString()}`);
      console.error('   Yeni token almak için:');
      console.error('   1) pos.adisyo.com → login');
      console.error('   2) F12 → Network → herhangi bir ürünün fiyatını değiştir (Kaydet)');
      console.error('   3) SaveProduct request → Headers → Authorization, devicekey, restaurant');
      console.error('   4) .env\'de ADISYO_BEARER_TOKEN/DEVICE_KEY/RESTAURANT_ID güncelle');
      process.exit(1);
    }
    const hoursLeft = Math.floor(remaining / 3_600_000);
    console.log(`🔑 Token geçerli — ${hoursLeft} saat kaldı (exp: ${new Date(expMs).toISOString()})`);
  } catch (e) {
    console.warn(`⚠️  Token decode edilemedi: ${e.message}`);
  }
}

// =====================================================================
// 1) Supabase products tablosundan KCAL ürünlerini çek
// =====================================================================
async function fetchTargetPrices() {
  console.log('🔍 Supabase: KCAL ürünleri çekiliyor…');
  const url = `${SUPABASE_URL}/rest/v1/products?select=id,price,name,adisyo_product_code&adisyo_product_code=like.KCAL-*`;
  const rows = await fetchJSON(url, { headers: supabaseHeaders });
  if (!Array.isArray(rows)) {
    throw new Error(`Beklenmeyen Supabase response: ${JSON.stringify(rows).slice(0, 200)}`);
  }
  const targets = {};
  for (const r of rows) {
    if (!r.adisyo_product_code) continue;
    const priceNum = Number(r.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      console.warn(`⚠️  ${r.adisyo_product_code} (${r.name}): geçersiz fiyat (${r.price}), atlanıyor`);
      continue;
    }
    targets[r.adisyo_product_code] = { price: priceNum, name: r.name };
  }
  console.log(`   → ${Object.keys(targets).length} ürün`);
  return targets;
}

// =====================================================================
// 2) Adisyo'da productCode → productId mapping
// =====================================================================
async function fetchAdisyoProductIdMap() {
  console.log('🔍 Adisyo: GetCustomerMenuLight…');
  const json = await fetchJSON(`${INTERNAL_API}/GetCustomerMenuLight`, {
    method: 'POST',
    headers: adisyoHeaders,
    body: JSON.stringify({}),
  });
  const products = json?.products ?? [];
  const map = {};
  for (const p of products) {
    if (typeof p?.code === 'string' && p.code.startsWith('KCAL-')) {
      map[p.code] = p.id;
    }
  }
  console.log(`   → ${Object.keys(map).length} KCAL ürünü Adisyo'da`);
  return map;
}

// =====================================================================
// 3) Tek ürünün full payload'ı (SaveProduct'a yollamak için)
// =====================================================================
async function getProductViewModel(productId) {
  const json = await fetchJSON(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST',
    headers: adisyoHeaders,
    body: JSON.stringify({ Value: String(productId) }),
  });
  if (!json?.product) {
    throw new Error(`GetProductViewModel response'unda 'product' yok. Top-level: ${Object.keys(json || {}).join(', ')}`);
  }
  return json.product;
}

// Fiyatı 4 farklı yerde set et (Adisyo "Tek Fiyat" davranışı)
function patchPayloadPrices(payload, newPrice) {
  const priceNum = Number(newPrice);
  const priceStr = String(newPrice);
  let touched = { topLevel: 0, perOrderType: 0 };

  const dpu = payload?.defaultProductUnit;
  if (dpu) {
    dpu.price = priceNum;
    touched.topLevel++;
    if (Array.isArray(dpu.prices)) {
      for (const p of dpu.prices) { p.price = priceStr; touched.perOrderType++; }
    }
  }

  if (Array.isArray(payload?.productUnits)) {
    for (const unit of payload.productUnits) {
      if (!unit) continue;
      unit.price = priceNum;
      touched.topLevel++;
      if (Array.isArray(unit.prices)) {
        for (const p of unit.prices) { p.price = priceStr; touched.perOrderType++; }
      }
    }
  }

  return touched;
}

async function saveProduct(payload) {
  // Adisyo kategoriyi değiştirmediğimizi anlamak için oldCategoryId bekliyor
  payload.oldCategoryId = payload.categoryId;
  return await fetchJSON(`${INTERNAL_API}/SaveProduct`, {
    method: 'POST',
    headers: adisyoHeaders,
    body: JSON.stringify(payload),
  });
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  if (DRY_RUN) console.log('🔸 DRY-RUN: hiçbir şey kaydedilmeyecek\n');
  if (ONLY)    console.log(`🔸 Sadece: ${[...ONLY].join(', ')}\n`);

  checkTokenExpiry();

  const [targets, adisyoMap] = await Promise.all([
    fetchTargetPrices(),
    fetchAdisyoProductIdMap(),
  ]);

  const codes = Object.keys(targets).filter(c => !ONLY || ONLY.has(c));
  if (codes.length === 0) {
    console.log('⚠️  İşlenecek ürün yok');
    return;
  }

  const results = { ok: [], fail: [], skip: [] };

  for (const code of codes) {
    const target = targets[code];
    const productId = adisyoMap[code];
    if (!productId) {
      console.warn(`⚠️  ${code} (${target.name}): Adisyo'da bulunamadı`);
      results.skip.push(code);
      continue;
    }

    process.stdout.write(`→ ${code.padEnd(9)} pid=${String(productId).padEnd(9)} → ${target.price} TL  (${target.name})  `);

    try {
      const payload = await getProductViewModel(productId);
      const touched = patchPayloadPrices(payload, target.price);
      if (touched.topLevel === 0) {
        console.log('⚠️  defaultProductUnit yok');
        results.skip.push(code);
        continue;
      }
      if (!DRY_RUN) await saveProduct(payload);
      console.log(`✅ ${touched.topLevel} top-level + ${touched.perOrderType} orderType${DRY_RUN ? ' (DRY)' : ''}`);
      results.ok.push(code);
      await sleep(250);
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
      results.fail.push({ code, error: e.message });
      if (e.status === 401) {
        console.error('\n🔑 Token expired — yeni token gerekli (yukarıdaki yönergeye bak)');
        break;
      }
    }
  }

  console.log('\n========================');
  console.log(`✅ Başarılı: ${results.ok.length}/${codes.length}`);
  console.log(`❌ Hatalı:   ${results.fail.length}`);
  console.log(`⚠️  Atlanan:  ${results.skip.length}`);
  if (results.fail.length) {
    console.log('\nHatalar:');
    for (const f of results.fail) console.log(`  ${f.code}: ${f.error.split('\n')[0]}`);
  }
  if (DRY_RUN) console.log('\n🔸 DRY-RUN — hiçbir şey değişmedi');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
