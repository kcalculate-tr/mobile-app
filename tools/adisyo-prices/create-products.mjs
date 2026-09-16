#!/usr/bin/env node
/**
 * KCAL → Adisyo YENİ ÜRÜN OLUŞTURMA (create)  —  klon-tabanlı
 *
 * Geçmişte create eden script YOKTU; update-prices-v4 sadece fiyat güncelliyor.
 * Bu script var olan bir KCAL ürününün (TEMPLATE_CODE) GetProductViewModel
 * payload'ını şablon alır, id/unit alanlarını sıfırlar, isim/kod/fiyat/kategori
 * değiştirir ve SaveProduct'a yollar → Adisyo'da yeni ürün oluşur.
 *
 * ⚠️ Create şeması KANITLANMADI. Bu yüzden 3 mod var, sırayla:
 *   1) --inspect   : şablon ürünün payload yapısını dök (yazma yok)
 *   2) --dry-run   : POST edilecek create payload'ını yazdır (yazma yok)
 *   3) (mod yok)   : CANLI — SaveProduct'a gönder
 *
 * Hedef seçimi:
 *   --only KCAL-52        sadece bu kodu işle (varsayılan: TODO listesindeki ilk)
 *   (PRODUCTS dizisi aşağıda — başta sadece KCAL-52 var; kanıt sonrası 53-74 eklenecek)
 *
 * Çalıştırma:
 *   cd tools/adisyo-prices
 *   node create-products.mjs --inspect --only KCAL-52
 *   node create-products.mjs --dry-run --only KCAL-52
 *   node create-products.mjs --only KCAL-52
 *
 * Token: update-prices-v4 ile aynı .env (ADISYO_BEARER_TOKEN/DEVICE_KEY/RESTAURANT_ID).
 */

import 'dotenv/config';
import process from 'node:process';

const INTERNAL_API = 'https://api.adisyo.com/api/menus';

// Şablon: var olan, fiyatı/kategorisi sağlam bir KCAL ürünü.
// KCAL-6 = "Basmati Üzeri Tavuk Fileto ve Brokoli" (categoryId'sini de miras alır).
const TEMPLATE_CODE = 'KCAL-6';

// İşlenecek YENİ ürünler. Kanıt aşamasında SADECE KCAL-52.
// Tek ürün temizse 53-74 buraya eklenip toplu basılacak (henüz değil).
const PRODUCTS = [
  // KCAL-52 zaten CANLI (pilot) — tekrar create ETME (duplicate riski). Liste referans için yorumda:
  // { code: 'KCAL-52', name: 'Tera Chicken Bowl', price: 475 },
  // --- 53-74 YENİ fiyatlarla (Supabase final fiyatları, 2026-06-29) ---
  { code: 'KCAL-53', name: 'Tera Meatball Bowl', price: 525 },
  { code: 'KCAL-54', name: 'Tera Veggie Bowl', price: 475 },
  { code: 'KCAL-55', name: 'Tera Tuna Bowl', price: 475 },
  { code: 'KCAL-56', name: 'Tera Chicken Wrap', price: 425 },
  { code: 'KCAL-57', name: 'Tera Fajitas Wrap', price: 595 },
  { code: 'KCAL-58', name: 'Tera Tuna Wrap', price: 425 },
  { code: 'KCAL-59', name: 'Tera Veggie Wrap', price: 425 },
  { code: 'KCAL-60', name: 'Hindi Füme Focaccia', price: 425 },
  { code: 'KCAL-61', name: 'Dana Jambon Focaccia', price: 475 },
  { code: 'KCAL-62', name: 'Füme Kaburga Focaccia', price: 475 },
  { code: 'KCAL-63', name: 'Karabiberli İtalyan Salam Focaccia', price: 475 },
  { code: 'KCAL-64', name: 'Veggie Focaccia', price: 400 },
  { code: 'KCAL-65', name: 'Hindi Füme Ciabatta', price: 395 },
  { code: 'KCAL-66', name: 'Dana Jambon Ciabatta', price: 415 },
  { code: 'KCAL-67', name: 'Füme Kaburga Ciabatta', price: 415 },
  { code: 'KCAL-68', name: 'Karabiberli İtalyan Salam Ciabatta', price: 415 },
  { code: 'KCAL-69', name: 'Veggie Ciabatta', price: 395 },
  { code: 'KCAL-70', name: 'Hindi Füme Ekşi Maya', price: 395 },
  { code: 'KCAL-71', name: 'Dana Jambon Ekşi Maya', price: 415 },
  { code: 'KCAL-72', name: 'Füme Kaburga Ekşi Maya', price: 415 },
  { code: 'KCAL-73', name: 'Karabiberli İtalyan Salam Ekşi Maya', price: 415 },
  { code: 'KCAL-74', name: 'Veggie Ekşi Maya', price: 375 },
  // --- Bagel'lar (2026-07) ---
  { code: 'KCAL-75', name: 'Hindi Füme Bagel',              price: 425 },
  { code: 'KCAL-76', name: 'Dana Jambon Bagel',             price: 475 },
  { code: 'KCAL-77', name: 'Dana Roastbeef Bagel',          price: 475 },
  { code: 'KCAL-78', name: 'Fıstıklı Dana Mortadella Bagel', price: 475 },
  { code: 'KCAL-79', name: 'Veggie Bagel',                  price: 400 },
  // --- Omlette Box'lar (2026-08) ---
  { code: 'KCAL-80', name: 'Klasik Omlette Box',                    price: 425 },
  { code: 'KCAL-81', name: 'Hindi Füme Omlette Box',                price: 475 },
  { code: 'KCAL-82', name: 'Dana Jambon Omlette Box',                price: 525 },
  { code: 'KCAL-83', name: 'Dana Roastbeef Omlette Box',             price: 525 },
  { code: 'KCAL-84', name: 'Fıstıklı Mortadella Salam Omlette Box',  price: 525 },
];

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
const INSPECT = args.includes('--inspect');
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map(s => s.trim())) : null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url.split('/').pop()}: ${text.slice(0, 400)}`);
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
      console.error(`❌ ADISYO_BEARER_TOKEN expired ${new Date(expMs).toISOString()} — yenile (README/agent talimatı).`);
      process.exit(1);
    }
    console.log(`🔑 Token geçerli — ${Math.floor((expMs - Date.now()) / 3_600_000)} saat kaldı`);
  } catch (e) { console.warn(`⚠️  Token decode edilemedi: ${e.message}`); }
}

async function fetchAdisyoProductIdMap() {
  const json = await fetchJSON(`${INTERNAL_API}/GetCustomerMenuLight`, {
    method: 'POST', headers: adisyoHeaders, body: JSON.stringify({}),
  });
  const products = json?.products ?? [];
  const map = {};
  for (const p of products) {
    if (typeof p?.code === 'string' && p.code.startsWith('KCAL-')) map[p.code] = p.id;
  }
  return map;
}

async function getProductViewModel(productId) {
  const json = await fetchJSON(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST', headers: adisyoHeaders, body: JSON.stringify({ Value: String(productId) }),
  });
  if (!json?.product) {
    throw new Error(`ViewModel'de 'product' yok. Top-level: ${Object.keys(json || {}).join(', ')}`);
  }
  return json.product;
}

const nullIfPresent = (o, keys) => { if (o) for (const k of keys) if (k in o) o[k] = null; };

// Şablondan (KCAL-6) create payload üret. INSPECT ile doğrulanan GERÇEK şema:
//   top-level kimlik: id (productId yok), rowVersion, insertDate/updateDate, defaultProductUnitId(null)
//   isim/kod: name (+nameLocale), code; KDV: taxRate/taxGroupId (miras); kategori: categoryId (miras)
//   unit: defaultProductUnit + productUnits[] → her birinde id, productId, prices[]
//   prices[]: id, productId, productUnitId, orderType(1/3/5), price(str), rowVersion → sıfırla
//   KORUNAN master alanlar: categoryId, taxGroupId, kitchenGroupId, unitId, priceListId, orderType
function buildCreatePayload(template, target) {
  const p = JSON.parse(JSON.stringify(template)); // derin klon
  const priceNum = Number(target.price), priceStr = String(target.price);

  // --- top-level: yeni kayıt işareti + audit temizliği ---
  p.id = 0;
  p.defaultProductUnitId = null;
  nullIfPresent(p, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId']);

  // --- isim / kod / açıklama ---
  // ⚠️ Adisyo görünen adı `name` string'inden DEĞİL `nameLocale` dizisinden türetiyor
  // (KCAL-52 ilk denemede "Basmati" çıktı çünkü dizi güncellenmemişti). İkisini de set et.
  p.name = target.name;
  if (Array.isArray(p.nameLocale)) p.nameLocale = p.nameLocale.map(x => ({ ...x, value: target.name }));
  else if (typeof p.nameLocale === 'string') p.nameLocale = target.name;
  p.code = target.code;
  // açıklama: şablon (KCAL-6) boş; karışmasın diye boşalt
  if ('description' in p) p.description = '';
  if (Array.isArray(p.descriptionLocale)) p.descriptionLocale = p.descriptionLocale.map(x => ({ ...x, value: '' }));
  else if (typeof p.descriptionLocale === 'string') p.descriptionLocale = '';

  // --- her unit'i create'e uygunla: kimlikleri sıfırla, fiyatı 515 yap ---
  const fixUnit = (u) => {
    if (!u) return;
    u.id = 0;
    u.productId = 0;            // parent product referansı → create'te 0
    u.price = priceNum;
    // unitId (4="Tam") master → KORUNUR
    nullIfPresent(u, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId', 'foodDeliveryId', 'barcode']);
    if (Array.isArray(u.prices)) for (const pr of u.prices) {
      pr.id = 0;
      pr.productId = 0;
      pr.productUnitId = 0;     // yeni unit'e bağlanacak
      pr.price = priceStr;      // 3 orderType (1/3/5) hepsi 515
      // priceListId, orderType master/anlam → KORUNUR
      nullIfPresent(pr, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId']);
    }
  };
  fixUnit(p.defaultProductUnit);
  if (Array.isArray(p.productUnits)) p.productUnits.forEach(fixUnit);

  // --- create: kategori değişimi yok referansı ---
  p.oldCategoryId = 0;

  return p;
}

async function saveProduct(payload) {
  return await fetchJSON(`${INTERNAL_API}/SaveProduct`, {
    method: 'POST', headers: adisyoHeaders, body: JSON.stringify(payload),
  });
}

async function main() {
  if (INSPECT) console.log('🔍 INSPECT modu — sadece şablon yapısı dökülecek\n');
  else if (DRY_RUN) console.log('🔸 DRY-RUN — POST edilecek payload yazdırılacak, yazma yok\n');
  else console.log('🚨 CANLI — SaveProduct\'a gerçek create gönderilecek\n');

  checkTokenExpiry();

  console.log(`🔍 Adisyo: ${TEMPLATE_CODE} productId çözülüyor…`);
  const map = await fetchAdisyoProductIdMap();
  const templateId = map[TEMPLATE_CODE];
  if (!templateId) { console.error(`❌ Şablon ${TEMPLATE_CODE} Adisyo'da bulunamadı`); process.exit(1); }
  console.log(`   → ${TEMPLATE_CODE} pid=${templateId}`);

  const template = await getProductViewModel(templateId);

  if (INSPECT) {
    console.log('\n=== ŞABLON product TOP-LEVEL KEYS ===');
    console.log(Object.keys(template).join(', '));
    console.log('\n=== ÖNEMLİ ALANLAR ===');
    for (const k of ['productId', 'id', 'productName', 'name', 'code', 'productCode', 'categoryId', 'oldCategoryId']) {
      if (k in template) console.log(`  ${k} = ${JSON.stringify(template[k])}`);
    }
    console.log('\n=== defaultProductUnit keys ===');
    console.log(template.defaultProductUnit ? Object.keys(template.defaultProductUnit).join(', ') : '(yok)');
    console.log('\n=== productUnits[0] keys ===');
    console.log(Array.isArray(template.productUnits) && template.productUnits[0]
      ? Object.keys(template.productUnits[0]).join(', ') : '(yok)');
    console.log('\n(Tam JSON için: bu çıktıyı incele, gerekirse buildCreatePayload alan adlarını düzelt)');
    return;
  }

  const targets = PRODUCTS.filter(t => !ONLY || ONLY.has(t.code));
  if (targets.length === 0) { console.log('⚠️  İşlenecek ürün yok'); return; }

  for (const target of targets) {
    process.stdout.write(`→ CREATE ${target.code.padEnd(9)} "${target.name}" @ ${target.price}TL  `);
    const payload = buildCreatePayload(template, target);

    if (DRY_RUN) {
      console.log('(dry-run) payload:');
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }

    try {
      const resp = await saveProduct(payload);
      console.log(`✅ SaveProduct yanıtı: ${JSON.stringify(resp).slice(0, 200)}`);
      await sleep(400);
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
      if (e.status === 401) { console.error('🔑 Token expired — yenile'); break; }
    }
  }

  console.log('\n✅ Bitti. Doğrulama: public /Products\'ta kodun göründüğünü kontrol et (3dk rate limit).');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
