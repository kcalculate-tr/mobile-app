// G21-S1 md.2 — Barkod → Open Food Facts (SAF; sahte fetch/depolama).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  OFF_CACHE_PREFIX,
  OFF_CACHE_TTL_MS,
  barcodeEstimate,
  lookupBarcode,
  offUrl,
  offUserAgent,
  parseOffResponse,
  productDisplayName,
  type KeyValueStore,
} from '../barcode/off';
import { saveAiScanEstimate, type InsertableSupabase } from '../saveEstimate';
import { scanEventProps, SCAN_EVENT_NAMES } from '../scanEvents';
import { logSourceOf } from '../../../../lib/metrics/logSource';
import { EVENTS } from '../../../../lib/metrics/events';
import { sourceInfo } from '../../../gun/homeData';

const ROOT = join(__dirname, '../../../../..');
const CODE = '8690504011012';

const PRODUCT = {
  code: CODE,
  product_name: 'Ayran',
  product_name_tr: 'Ayran (TR)',
  product_name_en: 'Yogurt drink',
  brands: 'Sütaş, Başka',
  serving_quantity: 250,
  image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
  nutriments: { 'energy-kcal_100g': 38, proteins_100g: 1.7, carbohydrates_100g: 2.4, fat_100g: 2.3 },
};

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(k) {
      return data.get(k) ?? null;
    },
    async setItem(k, v) {
      data.set(k, v);
    },
  };
}

type Call = { url: string; headers: Record<string, string>; signal?: AbortSignal };
function fakeFetch(respond: (c: Call) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>) {
  const calls: Call[] = [];
  const fn = async (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => {
    const c = { url, headers: init.headers, signal: init.signal };
    calls.push(c);
    return respond(c);
  };
  return { fn, calls };
}
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

test('istek: v2 uç noktası + alan listesi + User-Agent Kcalculate/<sürüm> (support@eatkcal.com)', async () => {
  assert.equal(
    offUrl(CODE),
    `https://world.openfoodfacts.org/api/v2/product/${CODE}.json?fields=code,product_name,product_name_tr,product_name_en,brands,nutriments,serving_size,serving_quantity,image_front_small_url`,
  );
  assert.equal(offUserAgent('1.1.0'), 'Kcalculate/1.1.0 (support@eatkcal.com)');
  assert.equal(offUserAgent(''), 'Kcalculate/0.0.0 (support@eatkcal.com)');
  const f = fakeFetch(() => ok({ status: 1, product: PRODUCT }));
  await lookupBarcode(CODE, { fetch: f.fn, storage: memStore(), version: '1.1.0' });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers['User-Agent'], 'Kcalculate/1.1.0 (support@eatkcal.com)');
});

test('bulundu: ad (dile göre), ilk marka, 100 g değerleri, porsiyon = serving_quantity, önbelleğe yazılır', async () => {
  const store = memStore();
  const f = fakeFetch(() => ok({ status: 1, product: PRODUCT }));
  const res = await lookupBarcode(CODE, { fetch: f.fn, storage: store, version: '1.1.0', now: () => 1000 });
  assert.equal(res.status, 'found');
  if (res.status !== 'found') return;
  assert.equal(res.cached, false);
  assert.equal(res.product.brand, 'Sütaş');
  assert.deepEqual(res.product.per100, { kcal: 38, p: 1.7, c: 2.4, f: 2.3 });
  assert.equal(res.product.servingGrams, 250);
  assert.equal(productDisplayName(res.product, 'tr'), 'Ayran (TR)');
  assert.equal(productDisplayName(res.product, 'en'), 'Yogurt drink');
  assert.ok(store.data.has(OFF_CACHE_PREFIX + CODE));
});

test('bulunamadı: status 0 ve HTTP 404 → not_found·missing; önbelleğe YAZILMAZ', async () => {
  const store = memStore();
  const a = await lookupBarcode(CODE, { fetch: fakeFetch(() => ok({ status: 0, status_verbose: 'product not found' })).fn, storage: store });
  assert.deepEqual(a, { status: 'not_found', reason: 'missing' });
  const b = await lookupBarcode(CODE, { fetch: fakeFetch(() => ok({ status: 0 }, 404)).fn, storage: store });
  assert.deepEqual(b, { status: 'not_found', reason: 'missing' });
  assert.equal(store.data.size, 0);
});

test('kcal eksik → not_found·no_kcal (sahte değer yok); yalnız kJ varsa kcal\'e çevrilir', async () => {
  const noKcal = { ...PRODUCT, nutriments: { proteins_100g: 3 } };
  const r = await lookupBarcode(CODE, { fetch: fakeFetch(() => ok({ status: 1, product: noKcal })).fn, storage: memStore() });
  assert.deepEqual(r, { status: 'not_found', reason: 'no_kcal' });
  const kj = parseOffResponse(CODE, { status: 1, product: { ...PRODUCT, nutriments: { 'energy-kj_100g': 418.4 } } });
  assert.ok('product' in kj && kj.product.per100.kcal === 100);
  // serving_quantity yok/bozuk → null (varsayılan 100 g ekranda)
  const ns = parseOffResponse(CODE, { status: 1, product: { ...PRODUCT, serving_quantity: '' } });
  assert.ok('product' in ns && ns.product.servingGrams === null);
});

test('zaman aşımı (6 sn → test 30 ms) → error·timeout, istek iptal edilir', async () => {
  let aborted = false;
  const f = fakeFetch(
    (c) =>
      new Promise((_res, rej) => {
        c.signal?.addEventListener('abort', () => {
          aborted = true;
          rej(new Error('aborted'));
        });
      }),
  );
  const res = await lookupBarcode(CODE, { fetch: f.fn, storage: memStore(), timeoutMs: 30 });
  assert.deepEqual(res, { status: 'error', reason: 'timeout' });
  assert.equal(aborted, true);
});

test('ağ hatası / 5xx → error (network / http); asla fırlatmaz', async () => {
  const net = await lookupBarcode(CODE, { fetch: fakeFetch(() => Promise.reject(new Error('fail'))).fn, storage: memStore() });
  assert.deepEqual(net, { status: 'error', reason: 'network' });
  const http = await lookupBarcode(CODE, { fetch: fakeFetch(() => ok({}, 503)).fn, storage: memStore() });
  assert.deepEqual(http, { status: 'error', reason: 'http' });
});

test('önbellek: 30 gün içinde istek YOK (cached:true), 30 gün sonra yeniden sorulur; çevrimdışı yalnız önbellek', async () => {
  const store = memStore();
  const f = fakeFetch(() => ok({ status: 1, product: PRODUCT }));
  const t0 = 1_000_000;
  await lookupBarcode(CODE, { fetch: f.fn, storage: store, now: () => t0 });
  const hit = await lookupBarcode(CODE, { fetch: f.fn, storage: store, now: () => t0 + OFF_CACHE_TTL_MS - 1 });
  assert.equal(hit.status, 'found');
  assert.equal(hit.status === 'found' && hit.cached, true);
  assert.equal(f.calls.length, 1);
  const offHit = await lookupBarcode(CODE, { fetch: f.fn, storage: store, now: () => t0 + 5, offline: true });
  assert.equal(offHit.status, 'found');
  const stale = await lookupBarcode(CODE, { fetch: f.fn, storage: store, now: () => t0 + OFF_CACHE_TTL_MS + 1 });
  assert.equal(stale.status === 'found' && stale.cached, false);
  assert.equal(f.calls.length, 2);
  // çevrimdışı + önbellek yok → istek atılmadan error·offline
  const miss = await lookupBarcode('4006381333931', { fetch: f.fn, storage: store, offline: true });
  assert.deepEqual(miss, { status: 'error', reason: 'offline' });
  assert.equal(f.calls.length, 2);
  // bozuk önbellek kaydı → yok sayılır
  store.data.set(OFF_CACHE_PREFIX + '96385074', '{bozuk');
  const bad = await lookupBarcode('96385074', { fetch: fakeFetch(() => ok({ status: 0 })).fn, storage: store });
  assert.equal(bad.status, 'not_found');
});

test('tahmin: 100 g değerleri × gram / 100 (porsiyon düzenlenebilir)', () => {
  const e = barcodeEstimate('Ayran', { kcal: 38, p: 1.7, c: 2.4, f: 2.3 }, 250);
  assert.deepEqual(
    { kcal: e.kcal, p: e.protein_g, c: e.carbs_g, f: e.fat_g, g: e.ingredients[0].grams },
    { kcal: 95, p: 4, c: 6, f: 6, g: 250 },
  );
  assert.equal(barcodeEstimate('X', { kcal: 500, p: 0, c: 0, f: 0 }, 0).kcal, 0);
});

test('kayıt: source=barcode, AI rezervasyonu/analizi YOK (yalnız meal_consumptions insert)', async () => {
  const tables: string[] = [];
  let row: Record<string, unknown> = {};
  const sb: InsertableSupabase = {
    from(table) {
      tables.push(table);
      return {
        insert(r) {
          row = r;
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'r1', name: String(r.name), meal_type: String(r.meal_type), calories: 95, protein: 4, carbs: 6, fat: 6, consumed_at: 'x' },
                error: null,
              }),
            }),
          };
        },
      };
    },
  };
  await saveAiScanEstimate(sb, {
    userId: 'u1',
    mealType: 'lunch',
    sourceRef: 'barcode-1',
    estimate: barcodeEstimate('Ayran', { kcal: 38, p: 1.7, c: 2.4, f: 2.3 }, 250),
    source: 'barcode',
  });
  assert.deepEqual(tables, ['meal_consumptions']);
  assert.equal(row.source, 'barcode');
  assert.equal(row.calories, 95);
  // ScanScreen barkod yolu runAiScan / reserve çağırmaz
  const src = readFileSync(join(ROOT, 'src/modules/ai/scan/screens/ScanScreen.tsx'), 'utf8');
  const body = src.slice(src.indexOf('const handleBarcode'), src.indexOf('const closeBarcodeResult'));
  assert.ok(body.length > 100);
  assert.doesNotMatch(body, /runAiScan|reserveScan|recordQuota|aiBlocked/);
  assert.match(body, /source: 'barcode'/);
});

test('olaylar: barcode_scan / barcode_found / barcode_not_found sözlükte + beyaz liste; kaynak eşlemeleri', () => {
  for (const n of ['barcode_scan', 'barcode_found', 'barcode_not_found'] as const) {
    assert.ok(SCAN_EVENT_NAMES.includes(n), n);
    assert.ok((EVENTS as Record<string, unknown>)[n], `${n} sözlükte yok`);
  }
  assert.deepEqual(scanEventProps('barcode_found', { cached: true, has_serving: false, code: CODE }), { cached: true, has_serving: false });
  assert.deepEqual(scanEventProps('barcode_not_found', { reason: 'no_kcal', code: CODE }), { reason: 'no_kcal' });
  assert.equal(logSourceOf('barcode'), 'barcode');
  assert.equal(sourceInfo('barcode').kind, 'scan');
  const mig = readFileSync(join(ROOT, 'supabase/migrations/20261110000100_g21_s1_barcode.sql'), 'utf8');
  assert.match(mig, /meal_consumptions_source_check/);
  assert.match(mig, /'barcode'/);
  for (const n of ['barcode_scan', 'barcode_found', 'barcode_not_found']) assert.match(mig, new RegExp(`'${n}'`));
});

test('"Barkod yakında" hâli kalktı (kod ve sözlük)', () => {
  const cam = readFileSync(join(ROOT, 'src/modules/ai/scan/ui/FinScanCamera.tsx'), 'utf8');
  assert.doesNotMatch(cam, /barcode_soon/);
  const dict = readFileSync(join(ROOT, 'src/core/i18n/dictionaries.ts'), 'utf8');
  assert.doesNotMatch(dict, /barcode_soon_/);
  assert.match(dict, /barcode_source: 'Veri: Open Food Facts'/);
  assert.match(dict, /barcode_source: 'Data: Open Food Facts'/);
});
