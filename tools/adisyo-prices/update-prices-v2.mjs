#!/usr/bin/env node
/**
 * KCAL → Adisyo Toplu Fiyat Güncelleme (v2)
 *
 * Akış:
 *   1) Internal API GetCustomerMenuLight ile code → productId mapping çek
 *   2) Her ürün için GetProductViewModel → güncel payload al
 *   3) defaultProductUnit.price + productUnits[*].price + prices[*].price güncelle
 *   4) SaveProduct'a yolla
 *
 * Çalıştırma:
 *   cd kcal-adisyo
 *   node update-prices-v2.mjs --dry-run
 *   node update-prices-v2.mjs --only KCAL-7
 *   node update-prices-v2.mjs
 */

import 'dotenv/config';
import process from 'node:process';

// =====================================================================
// HEDEF FİYATLAR
// =====================================================================
const TARGET_PRICES = {
  'KCAL-6': 375, 'KCAL-7': 375, 'KCAL-8': 375, 'KCAL-11': 375,
  'KCAL-9': 350, 'KCAL-10': 350,
  'KCAL-12': 395, 'KCAL-13': 395, 'KCAL-15': 395, 'KCAL-16': 395,
  'KCAL-14': 425,
  'KCAL-17': 160, 'KCAL-18': 160, 'KCAL-19': 160,
  'KCAL-20': 160, 'KCAL-21': 160, 'KCAL-22': 160,
  'KCAL-23': 800, 'KCAL-28': 800,
  'KCAL-24': 220, 'KCAL-25': 220, 'KCAL-26': 220, 'KCAL-27': 220,
};

const INTERNAL_API = 'https://api.adisyo.com/api/menus';

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`❌ .env'de ${k} eksik`); process.exit(1); }
  return v;
};

const headers = {
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

// =====================================================================
// 1) GetCustomerMenuLight → code → id mapping
// =====================================================================
async function fetchProductIdMap() {
  console.log('🔍 GetCustomerMenuLight → ürün listesi çekiliyor…');
  const json = await fetchJSON(`${INTERNAL_API}/GetCustomerMenuLight`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const products = json?.products ?? [];
  const map = {};
  for (const p of products) {
    if (typeof p?.code === 'string' && p.code.startsWith('KCAL-')) {
      map[p.code] = p.id;
    }
  }
  console.log(`   → ${Object.keys(map).length} KCAL ürünü bulundu`);
  return map;
}

// =====================================================================
// 2) GetProductViewModel → tek ürünün full payload'ı
// =====================================================================
async function getProductViewModel(productId) {
  const json = await fetchJSON(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ Value: String(productId) }),
  });
  // Bazen wrapper'lı (json.data), bazen direkt obje gelebilir
  return (json?.data && typeof json.data === 'object' && json.data.id)
    ? json.data
    : json;
}

// =====================================================================
// 3) Fiyatı 4 farklı yerde set et (Adisyo'nun "Tek Fiyat" davranışı)
//    - defaultProductUnit.price  (üst seviye, number)
//    - defaultProductUnit.prices[*].price  (orderType=1,3,5 her biri, string)
//    - productUnits[*].price  (üst seviye, number)
//    - productUnits[*].prices[*].price  (string)
// =====================================================================
function patchPayloadPrices(payload, newPrice) {
  const priceNum = Number(newPrice);
  const priceStr = String(newPrice);
  let touched = { topLevel: 0, perOrderType: 0 };

  const dpu = payload?.defaultProductUnit;
  if (dpu) {
    dpu.price = priceNum;
    touched.topLevel++;
    if (Array.isArray(dpu.prices)) {
      for (const p of dpu.prices) {
        p.price = priceStr;
        touched.perOrderType++;
      }
    }
  }

  if (Array.isArray(payload?.productUnits)) {
    for (const unit of payload.productUnits) {
      if (!unit) continue;
      unit.price = priceNum;
      touched.topLevel++;
      if (Array.isArray(unit.prices)) {
        for (const p of unit.prices) {
          p.price = priceStr;
          touched.perOrderType++;
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
    headers,
    body: JSON.stringify(payload),
  });
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  if (DRY_RUN) console.log('🔸 DRY-RUN modu: hiçbir şey kaydedilmeyecek\n');
  if (ONLY)    console.log(`🔸 Sadece ${[...ONLY].join(', ')} işlenecek\n`);

  const productIdMap = await fetchProductIdMap();

  const targets = Object.entries(TARGET_PRICES)
    .filter(([code]) => !ONLY || ONLY.has(code));

  const results = { ok: [], fail: [], skip: [] };

  for (const [code, targetPrice] of targets) {
    const productId = productIdMap[code];
    if (!productId) {
      console.warn(`⚠️  ${code}: Adisyo'da bulunamadı`);
      results.skip.push(code);
      continue;
    }

    process.stdout.write(`→ ${code.padEnd(9)} pid=${String(productId).padEnd(9)} → ${targetPrice} TL ... `);

    try {
      const payload = await getProductViewModel(productId);
      const touched = patchPayloadPrices(payload, targetPrice);

      if (touched.topLevel === 0) {
        console.log('⚠️  defaultProductUnit yok, atlanıyor');
        results.skip.push(code);
        continue;
      }

      if (!DRY_RUN) {
        await saveProduct(payload);
      }

      const detail = touched.perOrderType > 0
        ? `${touched.topLevel} top-level + ${touched.perOrderType} orderType`
        : `${touched.topLevel} top-level (prices[] boş)`;

      console.log(`✅ ${detail}${DRY_RUN ? ' (DRY-RUN)' : ''}`);
      results.ok.push(code);
      await sleep(250);
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
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
