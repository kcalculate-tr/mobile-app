#!/usr/bin/env node
/**
 * KCAL → Adisyo productUnitId ÇÖZÜCÜ  (READ-ONLY — hiçbir yere YAZMAZ)
 *
 * create-products.mjs Adisyo'da ürün açar ama Supabase eşlemesini yazmaz.
 * Bu script sadece TEŞHİS amaçlı: verilen KCAL kodları için Adisyo'daki
 * default productUnitId'yi çözüp ekrana basar. Supabase'e / Adisyo'ya HİÇBİR
 * yazma yapmaz — çıktıyı elle veya başka bir adımda kullanırsın.
 *
 * Akış:
 *   1) GetCustomerMenuLight → code → productId (update-prices-v4 kalıbı)
 *   2) Her kod için GetProductViewModel(productId) → default productUnitId
 *      (defaultProductUnitId ?? defaultProductUnit.id ?? productUnits[0].id)
 *   3) Satır satır bas: "KCAL-77 productUnitId=XXXXX"
 *
 * Çalıştırma:
 *   cd tools/adisyo-prices
 *   node sync-adisyo-map.mjs                                  # tüm KCAL-* kodları
 *   node sync-adisyo-map.mjs --only KCAL-75,KCAL-76,KCAL-77,KCAL-78,KCAL-79
 *
 * Token: create-products/update-prices-v4 ile aynı .env.
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

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map(s => s.trim())) : null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url.split('/').pop()}: ${text.slice(0, 300)}`);
    err.status = res.status; err.body = text; throw err;
  }
  return json ?? text;
}

function checkTokenExpiry() {
  const token = process.env.ADISYO_BEARER_TOKEN;
  try {
    const [, payload] = token.split('.');
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const expMs = d.exp * 1000;
    if (expMs <= Date.now()) {
      console.error(`❌ ADISYO_BEARER_TOKEN expired ${new Date(expMs).toISOString()} — yenile (update-prices-v4 yönergesi).`);
      process.exit(1);
    }
    console.log(`🔑 Token geçerli — ${Math.floor((expMs - Date.now()) / 3_600_000)} saat kaldı`);
  } catch (e) { console.warn(`⚠️  Token decode edilemedi: ${e.message}`); }
}

async function fetchAdisyoProductIdMap() {
  console.log('🔍 Adisyo: GetCustomerMenuLight…');
  const json = await fetchJSON(`${INTERNAL_API}/GetCustomerMenuLight`, {
    method: 'POST', headers: adisyoHeaders, body: JSON.stringify({}),
  });
  const products = json?.products ?? [];
  const map = {};
  for (const p of products) {
    if (typeof p?.code === 'string' && p.code.startsWith('KCAL-')) map[p.code] = p.id;
  }
  console.log(`   → ${Object.keys(map).length} KCAL ürünü Adisyo'da`);
  return map;
}

async function getDefaultUnitId(productId) {
  const json = await fetchJSON(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST', headers: adisyoHeaders, body: JSON.stringify({ Value: String(productId) }),
  });
  const p = json?.product;
  if (!p) throw new Error(`ViewModel'de 'product' yok. Top-level: ${Object.keys(json || {}).join(', ')}`);
  const unitId =
    p.defaultProductUnitId ??
    p.defaultProductUnit?.id ??
    (Array.isArray(p.productUnits) ? p.productUnits[0]?.id : null);
  if (unitId == null) {
    throw new Error(`default productUnitId çözülemedi (defaultProductUnitId/defaultProductUnit.id/productUnits[0].id hepsi boş)`);
  }
  return unitId;
}

// KCAL-<n> sayısal sıra (çıktıyı düzenli sıralamak için)
const codeNum = (c) => { const m = /^KCAL-(\d+)$/.exec(c); return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; };

async function main() {
  console.log('🔎 READ-ONLY — hiçbir yere yazılmaz, yalnız productUnitId çözülür\n');
  checkTokenExpiry();

  const adisyoMap = await fetchAdisyoProductIdMap();

  const codes = Object.keys(adisyoMap)
    .filter(c => !ONLY || ONLY.has(c))
    .sort((a, b) => codeNum(a) - codeNum(b));

  // --only ile istenip Adisyo'da bulunamayan kodları da bildir
  if (ONLY) {
    for (const c of ONLY) {
      if (!(c in adisyoMap)) console.warn(`⚠️  ${c}: Adisyo'da bulunamadı (önce create-products ile aç)`);
    }
  }
  if (codes.length === 0) { console.log('⚠️  İşlenecek kod yok'); return; }

  console.log('');
  const results = { ok: [], fail: [] };
  for (const code of codes) {
    const productId = adisyoMap[code];
    try {
      const unitId = await getDefaultUnitId(productId);
      console.log(`${code.padEnd(9)} productUnitId=${unitId}   (adisyoProductId=${productId})`);
      results.ok.push({ code, unitId, productId });
      await sleep(200);
    } catch (e) {
      console.log(`${code.padEnd(9)} ❌ ${e.message.split('\n')[0]}`);
      results.fail.push(code);
      if (e.status === 401) { console.error('🔑 Token expired — yenile'); break; }
    }
  }

  console.log('\n========================');
  console.log(`✅ Çözülen: ${results.ok.length}   ❌ Hatalı: ${results.fail.length}`);
  console.log('ℹ️  Bu script hiçbir yere yazmadı — çıktıyı eşleme için elle kullan.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
