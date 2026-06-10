#!/usr/bin/env node
/**
 * KCAL → Adisyo Toplu Fiyat Güncelleme
 *
 * Akış:
 *   1) Public API'den productCode → productId mapping'i çek
 *   2) Her ürün için GetProductViewModel ile güncel payload'ı çek
 *   3) prices[*].price alanlarını hedef fiyatla değiştir (her 3 orderType)
 *   4) SaveProduct'a yolla
 *
 * Çalıştırma:
 *   cd adisyo-price-update
 *   cp .env.example .env       # ve doldur
 *   npm install                 # bağımlılık yok, sadece dotenv
 *   node update-prices.mjs
 *
 *   # sadece 1-2 ürünü test etmek için:
 *   node update-prices.mjs --only KCAL-7,KCAL-8
 *
 *   # gerçekten yazmadan ne olacağını görmek için:
 *   node update-prices.mjs --dry-run
 */

import 'dotenv/config';
import process from 'node:process';

// =====================================================================
// HEDEF FİYATLAR (KCAL-{products.id} → Tek Fiyat TL)
// =====================================================================
const TARGET_PRICES = {
  // Ana yemekler
  'KCAL-6': 375, 'KCAL-7': 375, 'KCAL-8': 375, 'KCAL-11': 375,
  'KCAL-9': 350, 'KCAL-10': 350,
  'KCAL-12': 395, 'KCAL-13': 395, 'KCAL-15': 395, 'KCAL-16': 395,
  'KCAL-14': 425,
  // Detoks & Shake
  'KCAL-17': 160, 'KCAL-18': 160, 'KCAL-19': 160,
  'KCAL-20': 160, 'KCAL-21': 160, 'KCAL-22': 160,
  // Koliye Özel + Protein Shake'ler
  'KCAL-23': 800, 'KCAL-28': 800,
  'KCAL-24': 220, 'KCAL-25': 220, 'KCAL-26': 220, 'KCAL-27': 220,
};

// =====================================================================
// API BAĞLANTILARI
// =====================================================================
const PUBLIC_API   = 'https://ext.adisyo.com/api/External/v2';
const INTERNAL_API = 'https://api.adisyo.com/api/menus';

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`❌ .env'de ${k} eksik`); process.exit(1); }
  return v;
};

const publicHeaders = {
  'x-api-key':      need('ADISYO_PUBLIC_API_KEY'),
  'x-api-secret':   need('ADISYO_PUBLIC_API_SECRET'),
  'x-api-consumer': need('ADISYO_PUBLIC_API_CONSUMER'),
  'Content-Type':   'application/json',
  'Accept':         'application/json',
};

const internalHeaders = {
  'Authorization': `Bearer ${need('ADISYO_BEARER_TOKEN')}`,
  'devicekey':     need('ADISYO_DEVICE_KEY'),
  'restaurant':    need('ADISYO_RESTAURANT_ID'),
  'origin':        'https://pos.adisyo.com',
  'referer':       'https://pos.adisyo.com/',
  'source':        'mill',
  'timezone':      '-180',
  'Content-Type':  'application/json;charset=UTF-8',
  'Accept':        'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR',
};

// =====================================================================
// CLI ARGS
// =====================================================================
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map(s => s.trim())) : null;

// =====================================================================
// HELPERS
// =====================================================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}\n${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return json ?? text;
}

// Adisyo public API response'u tipik olarak şu formatlarda gelir:
//   { data: { products: [...] } }   veya
//   { products: [...] }              veya
//   [ ... ]
function extractProducts(json) {
  if (Array.isArray(json)) return json;
  if (json?.data?.products) return json.data.products;
  if (json?.products) return json.products;
  if (Array.isArray(json?.data)) return json.data;
  // fallback: dump structure
  console.error('Beklenmedik public API response yapısı:',
    JSON.stringify(json, null, 2).slice(0, 1000));
  throw new Error('Public API products array bulunamadı');
}

// GetProductViewModel response'u da `{ data: {...} }` veya direkt obje gelebilir
function extractViewModel(json) {
  if (json?.data && typeof json.data === 'object') return json.data;
  return json;
}

// =====================================================================
// 1) PUBLIC API: productCode → productId mapping'i çek
// =====================================================================
async function fetchProductIdMap() {
  console.log('🔍 Public API: ürün listesi çekiliyor…');
  const json = await fetchJSON(`${PUBLIC_API}/Products`, { headers: publicHeaders });
  const products = extractProducts(json);

  const map = {};
  for (const p of products) {
    const code = p.productCode ?? p.ProductCode;
    const id   = p.id ?? p.Id ?? p.productId ?? p.ProductId;
    if (code && id && code.startsWith('KCAL-')) {
      map[code] = id;
    }
  }
  console.log(`   → ${Object.keys(map).length} KCAL ürünü bulundu`);
  return map;
}

// =====================================================================
// 2) INTERNAL API: tek ürünün full payload'ını çek
// =====================================================================
async function getProductViewModel(productId) {
  const json = await fetchJSON(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST',
    headers: internalHeaders,
    body: JSON.stringify({ Value: String(productId) }),
  });
  return extractViewModel(json);
}

// =====================================================================
// 3) Payload'da tüm prices[*].price'ları yeni fiyatla değiştir
//    Adisyo "Tek Fiyat" davranışı: tüm orderType'lara aynı fiyat
// =====================================================================
function patchPayloadPrices(payload, newPrice) {
  const priceStr = String(newPrice);
  let touched = 0;

  // defaultProductUnit altında prices[]
  if (payload?.defaultProductUnit?.prices?.length) {
    for (const p of payload.defaultProductUnit.prices) {
      p.price = priceStr;
      touched++;
    }
  }

  // productUnits[].prices[] (genelde defaultProductUnit ile aynı array referansı ama olsun)
  if (Array.isArray(payload?.productUnits)) {
    for (const unit of payload.productUnits) {
      if (unit?.prices?.length) {
        for (const p of unit.prices) {
          p.price = priceStr;
          touched++;
        }
      }
    }
  }

  return touched;
}

// =====================================================================
// 4) SaveProduct
// =====================================================================
async function saveProduct(payload) {
  return await fetchJSON(`${INTERNAL_API}/SaveProduct`, {
    method: 'POST',
    headers: internalHeaders,
    body: JSON.stringify(payload),
  });
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  if (DRY_RUN)  console.log('🔸 DRY-RUN modu: hiçbir şey kaydedilmeyecek\n');
  if (ONLY)     console.log(`🔸 Sadece ${[...ONLY].join(', ')} işlenecek\n`);

  const productIdMap = await fetchProductIdMap();

  const targets = Object.entries(TARGET_PRICES)
    .filter(([code]) => !ONLY || ONLY.has(code));

  const results = { ok: [], fail: [], skip: [] };

  for (const [code, targetPrice] of targets) {
    const productId = productIdMap[code];
    if (!productId) {
      console.warn(`⚠️  ${code}: Adisyo'da bulunamadı (productCode eşleşmiyor)`);
      results.skip.push(code);
      continue;
    }

    process.stdout.write(`→ ${code.padEnd(9)} pid=${String(productId).padEnd(9)} → ${targetPrice} TL ... `);

    try {
      const payload = await getProductViewModel(productId);
      const touched = patchPayloadPrices(payload, targetPrice);
      if (touched === 0) {
        console.log('⚠️  prices[] boş, atlanıyor');
        results.skip.push(code);
        continue;
      }

      if (!DRY_RUN) {
        await saveProduct(payload);
      }
      console.log(`✅ ${touched} fiyat güncellendi${DRY_RUN ? ' (DRY-RUN)' : ''}`);
      results.ok.push(code);

      // Adisyo backend'i nazikçe rahat bırak
      await sleep(250);
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
      if (e.body) console.log(`   body: ${e.body.slice(0, 200)}`);
      results.fail.push({ code, error: e.message });
    }
  }

  console.log('\n========================');
  console.log(`✅ Başarılı: ${results.ok.length}/${targets.length}`);
  console.log(`❌ Hatalı:   ${results.fail.length}`);
  console.log(`⚠️  Atlanan:  ${results.skip.length}`);
  if (results.fail.length) {
    console.log('\nHatalar:');
    for (const f of results.fail) console.log(`  ${f.code}: ${f.error.split('\n')[0]}`);
  }
  if (DRY_RUN) console.log('\n🔸 DRY-RUN modunda çalıştı — hiçbir şey değişmedi');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
