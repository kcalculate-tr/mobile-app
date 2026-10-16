#!/usr/bin/env node
/**
 * KCAL menüsünü BİR ŞUBENİN Adisyo hesabına toplu oluşturur.
 *
 * create-products.mjs'ten farkı:
 *   · Ürün listesi Supabase'den CANLI okunur (hardcoded dizi yok, isim/fiyat şaşmaz).
 *   · Şablon ürün HEDEF hesaptan seçilir — categoryId/taxGroupId/kitchenGroupId
 *     hesaba özel, Basın Sitesi'nin şablonu başka hesapta geçersiz.
 *   · --env ile ayrı .env: Basın Sitesi'nin token'ı ellenmez.
 *   · Hedef hesapta zaten KCAL-<kod> varsa atlanır (duplicate yok).
 *
 * KULLANIM
 *   1) pos.adisyo.com → HEDEF şube hesabıyla giriş → F12 → Network →
 *      herhangi bir menü isteği → Headers'tan al:
 *        Authorization: Bearer <...>   → ADISYO_BEARER_TOKEN
 *        devicekey: <...>              → ADISYO_DEVICE_KEY
 *        restaurant: <...>             → ADISYO_RESTAURANT_ID
 *      tools/adisyo-prices/.env.bayrakli içine yaz.
 *
 *   2) node create-products-branch.mjs --env .env.bayrakli --list
 *      → hesaptaki kategoriler + ürün id'leri. Şablon olarak ANA YEMEK
 *        kategorisinde, KDV'si doğru bir ürün seç, productId'sini al.
 *
 *   3) node create-products-branch.mjs --env .env.bayrakli --template <pid> --dry-run
 *      → ne oluşturulacağını gösterir, YAZMAZ.
 *
 *   4) node create-products-branch.mjs --env .env.bayrakli --template <pid>
 *      → CANLI. Sonra Adisyo'da 3 dk bekle, eşlemeyi ben alırım.
 *
 * NOT: Bu uç (api.adisyo.com/api/menus/SaveProduct) Adisyo'nun DAHİLİ panel
 * ucudur, belgesiz. External v2 API'de ürün yazma yok. Şema create-products.mjs
 * ile Basın Sitesi'nde kanıtlandı (KCAL-52…84 bu yolla açıldı).
 */

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const has  = (n) => args.includes(n);

const ENV_FILE = flag('--env') ?? '.env';
const LIST     = has('--list');
const DRY_RUN  = has('--dry-run');
const TEMPLATE = flag('--template');
const ONLY     = flag('--only') ? new Set(flag('--only').split(',').map(s => s.trim())) : null;

// --- .env yükle (dotenv'e bağımlı olmadan, --env desteklemesi için) ---
const envPath = path.resolve(ENV_FILE);
if (!fs.existsSync(envPath)) { console.error(`❌ ${ENV_FILE} yok`); process.exit(1); }
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`❌ ${ENV_FILE} içinde ${k} eksik`); process.exit(1); } return v; };

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xtjakvinklthlvsfcncu.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';

const INTERNAL_API = 'https://api.adisyo.com/api/menus';
const H = {
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function jfetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) { const e = new Error(`HTTP ${res.status} ${url.split('/').pop()}: ${text.slice(0, 300)}`); e.status = res.status; throw e; }
  return json ?? text;
}

function tokenKontrol() {
  try {
    const [, p] = process.env.ADISYO_BEARER_TOKEN.split('.');
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    const kalan = d.exp * 1000 - Date.now();
    if (kalan <= 0) { console.error('❌ Token süresi dolmuş — pos.adisyo.com\'dan yenile'); process.exit(1); }
    console.log(`🔑 Token geçerli — ${Math.floor(kalan / 3_600_000)} saat kaldı`);
    console.log(`🏪 restaurant=${process.env.ADISYO_RESTAURANT_ID}`);
  } catch { console.warn('⚠️  Token decode edilemedi, devam ediliyor'); }
}

async function hedefMenu() {
  const j = await jfetch(`${INTERNAL_API}/GetCustomerMenuLight`, { method: 'POST', headers: H, body: '{}' });
  return { urunler: j?.products ?? [], kategoriler: j?.categories ?? [] };
}

async function viewModel(productId) {
  const j = await jfetch(`${INTERNAL_API}/GetProductViewModel`, {
    method: 'POST', headers: H, body: JSON.stringify({ Value: String(productId) }),
  });
  if (!j?.product) throw new Error(`ViewModel'de 'product' yok: ${Object.keys(j || {}).join(', ')}`);
  return j.product;
}

async function kcalMenusu() {
  const url = `${SUPABASE_URL}/rest/v1/products`
    + '?select=id,name,price,adisyo_product_code,is_available'
    + '&adisyo_product_code=not.is.null&order=id.asc';
  const rows = await jfetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  return rows
    .filter(r => r.is_available !== false)
    .map(r => ({ code: r.adisyo_product_code, name: r.name, price: Number(r.price) }));
}

const nulla = (o, ks) => { if (o) for (const k of ks) if (k in o) o[k] = null; };

function createPayload(sablon, hedef) {
  const p = JSON.parse(JSON.stringify(sablon));
  const priceNum = Number(hedef.price), priceStr = String(hedef.price);

  p.id = 0;
  p.defaultProductUnitId = null;
  nulla(p, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId']);

  // Adisyo görünen adı nameLocale dizisinden türetiyor — ikisini de set et.
  p.name = hedef.name;
  if (Array.isArray(p.nameLocale)) p.nameLocale = p.nameLocale.map(x => ({ ...x, value: hedef.name }));
  else if (typeof p.nameLocale === 'string') p.nameLocale = hedef.name;
  p.code = hedef.code;
  if ('description' in p) p.description = '';
  if (Array.isArray(p.descriptionLocale)) p.descriptionLocale = p.descriptionLocale.map(x => ({ ...x, value: '' }));
  else if (typeof p.descriptionLocale === 'string') p.descriptionLocale = '';

  const unitDuzelt = (u) => {
    if (!u) return;
    u.id = 0; u.productId = 0; u.price = priceNum;
    nulla(u, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId', 'foodDeliveryId', 'barcode']);
    if (Array.isArray(u.prices)) for (const pr of u.prices) {
      pr.id = 0; pr.productId = 0; pr.productUnitId = 0; pr.price = priceStr;
      nulla(pr, ['rowVersion', 'insertDate', 'updateDate', 'insertUserId', 'updateUserId']);
    }
  };
  unitDuzelt(p.defaultProductUnit);
  if (Array.isArray(p.productUnits)) p.productUnits.forEach(unitDuzelt);

  p.oldCategoryId = 0;
  return p;
}

async function main() {
  tokenKontrol();
  const { urunler, kategoriler } = await hedefMenu();

  if (LIST) {
    console.log(`\n📋 Hedef hesapta ${urunler.length} ürün, ${kategoriler.length} kategori\n`);
    const katAd = new Map(kategoriler.map(c => [c.id, c.name]));
    const gruplu = new Map();
    for (const u of urunler) {
      const k = katAd.get(u.categoryId) ?? `kategori#${u.categoryId}`;
      if (!gruplu.has(k)) gruplu.set(k, []);
      gruplu.get(k).push(u);
    }
    for (const [k, list] of [...gruplu].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`── ${k} (${list.length})`);
      for (const u of list) console.log(`   pid=${String(u.id).padEnd(10)} kod=${(u.code ?? '-').padEnd(10)} ${u.name}`);
    }
    console.log('\n→ Şablon olarak ANA YEMEK kategorisinden bir pid seç, --template ile ver.');
    return;
  }

  if (!TEMPLATE) { console.error('❌ --template <productId> gerekli (önce --list)'); process.exit(1); }

  const mevcutKodlar = new Set(urunler.map(u => u.code).filter(Boolean));
  const tumMenu = await kcalMenusu();
  const hedefler = tumMenu
    .filter(t => !ONLY || ONLY.has(t.code))
    .filter(t => { if (mevcutKodlar.has(t.code)) { console.log(`⏭  ${t.code} hedefte zaten var, atlandı`); return false; } return true; });

  console.log(`\n📦 KCAL menüsü: ${tumMenu.length} ürün · oluşturulacak: ${hedefler.length}`);
  if (hedefler.length === 0) { console.log('✅ Yapılacak bir şey yok.'); return; }

  const sablon = await viewModel(TEMPLATE);
  console.log(`🧩 Şablon: pid=${TEMPLATE} "${sablon.name}" categoryId=${sablon.categoryId} taxRate=${sablon.taxRate ?? '?'}`);
  console.log(DRY_RUN ? '\n🔸 DRY-RUN — hiçbir şey yazılmayacak\n' : '\n🚨 CANLI — SaveProduct\'a gönderiliyor\n');

  let ok = 0; const hatalar = [];
  for (const h of hedefler) {
    process.stdout.write(`→ ${h.code.padEnd(9)} ${h.name.padEnd(45)} ${String(h.price).padStart(5)}TL  `);
    const payload = createPayload(sablon, h);
    if (DRY_RUN) { console.log(`(dry-run) name="${payload.name}" code=${payload.code} categoryId=${payload.categoryId}`); continue; }
    try {
      const r = await jfetch(`${INTERNAL_API}/SaveProduct`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
      console.log(`✅ ${JSON.stringify(r).slice(0, 120)}`);
      ok++;
      await sleep(400);
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
      hatalar.push({ code: h.code, hata: e.message.slice(0, 200) });
      if (e.status === 401) { console.error('🔑 Token süresi doldu — yenile ve kaldığı yerden devam et (var olanlar atlanır)'); break; }
    }
  }

  if (!DRY_RUN) {
    console.log(`\n✅ ${ok} ürün oluşturuldu, ${hatalar.length} hata`);
    if (hatalar.length) console.log(JSON.stringify(hatalar, null, 2));
    console.log('→ Adisyo 3 dk rate-limit uyguluyor. Sonra haber ver, eşlemeyi kodla alıp yazarım.');
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
