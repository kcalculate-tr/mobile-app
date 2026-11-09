// G19-S1 — Tara herkese açılış denetiminde bulunan hataların regresyon testleri.
// SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAnalyzeBody, mapAnalyzeResponse, ANALYZE_CLIENT_TIMEOUT_MS } from '../client';
import { computeAdjusted, manualRow, productRow, rowKcal, rowsFromEstimate, type Estimate } from '../adjust';
import { effectiveRemaining } from '../quotaStore';
import { runAiScan } from '../runScan';
import { createMockAiScanClient } from '../mock';
import { classifyScanFailure, scanFailureInfo } from '../scanError';
import { SCAN_EVENT_NAMES, scanEventProps, setScanEventSink, trackScan } from '../scanEvents';
import { ORPHAN_TTL_MS, clearOrphanResult, keepOrphanResult, takeOrphanResult } from '../orphanResult';
import { QUEUE_DIR_NAME, isQueuedImageUri, judgeLocalImage } from '../localImage';
import { saveAiScanEstimate, isUniqueViolation, type InsertableSupabase } from '../saveEstimate';
import type { AiScanClient } from '../types';

// ── md.3: edge yanıtı → öğe başına kcal/makro korunur ───────────────────────
const EDGE = {
  items: [
    { name: 'Ezogelin çorbası', grams: 250, kcal: 180, protein_g: 9, carb_g: 28, fat_g: 4 },
    { name: 'Pilav', grams: 150, kcal: 210, protein_g: 4, carb_g: 45, fat_g: 3 },
    { name: 'Ayran', grams: 200, kcal: 70, protein_g: 4, carb_g: 6, fat_g: 3 },
  ],
  total: { kcal: 460, protein_g: 17, carb_g: 79, fat_g: 10 },
  is_estimate: true,
  lang: 'tr',
};

test('mapAnalyzeResponse: öğe kcal + makrolar korunur (önceden atılıyordu → satırlar 0 kcal)', () => {
  const e = mapAnalyzeResponse(EDGE, 'tr');
  assert.equal(e.kcal, 460);
  assert.equal(e.carbs_g, 79, 'carb_g → carbs_g');
  assert.deepEqual(e.ingredients[0], { name: 'Ezogelin çorbası', grams: 250, kcal: 180, protein_g: 9, carbs_g: 28, fat_g: 4 });
  assert.equal(e.name, 'Ezogelin çorbası, Pilav, Ayran');
});

test('mapAnalyzeResponse: bozuk/negatif sayılar 0, boş ad dilde yedek (EN → Food)', () => {
  const e = mapAnalyzeResponse({ items: [{ name: ' ', grams: -5, kcal: 'x' }], total: { kcal: NaN }, lang: 'en' });
  assert.equal(e.ingredients[0].name, 'Food');
  assert.equal(e.ingredients[0].grams, 0);
  assert.equal(e.ingredients[0].kcal, 0);
  assert.equal(e.kcal, 0);
  assert.equal(mapAnalyzeResponse(null, 'en').name, 'Food');
  assert.equal(mapAnalyzeResponse({}, 'tr').name, 'Yemek');
});

test('buildAnalyzeBody: lang HER ZAMAN gider (EN cihaz → EN adlar); hint yalnız doluysa', () => {
  assert.deepEqual(buildAnalyzeBody({ idempotencyKey: 'k', imageRef: 'u/scans/k.jpg', lang: 'en' }), {
    reservation_id: 'k',
    image_path: 'u/scans/k.jpg',
    lang: 'en',
  });
  const b = buildAnalyzeBody({ idempotencyKey: 'k', imageRef: 'p', hint: 'yarım porsiyon' });
  assert.equal(b.lang, 'tr');
  assert.equal(b.hint, 'yarım porsiyon');
  assert.ok(ANALYZE_CLIENT_TIMEOUT_MS >= 25_000 && ANALYZE_CLIENT_TIMEOUT_MS <= 60_000, 'edge 20 sn + pay');
});

test('mock istemci lang=en → yiyecek adları EN', async () => {
  const c = createMockAiScanClient();
  const out = await runAiScan(c, { idempotencyKey: 'k', imageRef: 'file://a.jpg', lang: 'en' });
  assert.equal(out.status, 'ok');
  if (out.status === 'ok') assert.deepEqual(out.estimate.ingredients.map((i) => i.name), ['Chicken', 'Rice']);
});

// ── md.3: düzeltme → Logla'ya giden değer ───────────────────────────────────
const est: Estimate = mapAnalyzeResponse(EDGE, 'tr');

test('computeAdjusted: hiçbir şey değişmezse modelin toplamı aynen', () => {
  const a = computeAdjusted(est, rowsFromEstimate(est));
  assert.deepEqual([a.kcal, a.protein_g, a.carbs_g, a.fat_g], [460, 17, 79, 10]);
  assert.equal(a.ingredients.length, 3);
  assert.equal(a.ingredients[1].kcal, 210, 'satır kcal (önceden 0)');
});

test('computeAdjusted: öğe SİL → toplam o öğe kadar düşer (makro makro), addan da çıkar', () => {
  const rows = rowsFromEstimate(est);
  rows[2] = { ...rows[2], removed: true }; // Ayran
  const a = computeAdjusted(est, rows);
  assert.equal(a.kcal, 390);
  assert.equal(a.protein_g, 13);
  assert.equal(a.carbs_g, 73);
  assert.equal(a.fat_g, 7);
  assert.equal(a.name, 'Ezogelin çorbası, Pilav');
  assert.equal(a.ingredients.length, 2);
});

test('computeAdjusted: gram düzeltme (Pilav 150 → 300 g) ve porsiyon ½', () => {
  const rows = rowsFromEstimate(est);
  rows[1] = { ...rows[1], grams: 300, portion: 0 };
  assert.equal(computeAdjusted(est, rows).kcal, 670);
  assert.equal(Math.round(rowKcal(rows[1])), 420);
  const half = rowsFromEstimate(est).map((r) => ({ ...r, portion: 0.5, grams: r.baseGrams * 0.5 }));
  const h = computeAdjusted(est, half);
  assert.deepEqual([h.kcal, h.protein_g, h.carbs_g, h.fat_g], [230, 9, 40, 5]);
});

test('computeAdjusted: hepsi silinip yalnız elle eklenen kalırsa yalnız o', () => {
  const rows = rowsFromEstimate(est).map((r) => ({ ...r, removed: true }));
  const m = manualRow('Salata', '120', '200');
  assert.ok(m);
  const a = computeAdjusted(est, [...rows, m!]);
  assert.equal(a.kcal, 120);
  assert.equal(a.name, 'Salata');
});

test('computeAdjusted: ürün aramasından eklenen (100 g başına) makrosuyla eklenir', () => {
  const p = productRow({ name: 'Yoğurt', kcal: 60, protein_g: 4, carbs_g: 5, fat_g: 3 });
  const a = computeAdjusted(est, [...rowsFromEstimate(est), { ...p, grams: 200 }]);
  assert.deepEqual([a.kcal, a.protein_g, a.carbs_g, a.fat_g], [580, 25, 89, 16]);
});

test('computeAdjusted: öğe kcal yoksa gram oranı; öğe hiç yoksa tabak porsiyonu', () => {
  const noKcal: Estimate = { ...est, ingredients: est.ingredients.map((i) => ({ name: i.name, grams: i.grams })) };
  const rows = rowsFromEstimate(noKcal);
  rows[0] = { ...rows[0], removed: true }; // 250 / 600 g düştü
  assert.equal(computeAdjusted(noKcal, rows).kcal, Math.round(460 * (350 / 600)));
  const empty: Estimate = { ...est, ingredients: [] };
  assert.equal(computeAdjusted(empty, [], 1.5).kcal, 690);
  assert.equal(computeAdjusted(empty, [], 1.5).portion, 1.5);
});

test('manualRow: ad + 1–3000 kcal zorunlu; gram boşsa 100', () => {
  assert.equal(manualRow('', '100'), null);
  assert.equal(manualRow('Elma', '0'), null);
  assert.equal(manualRow('Elma', '5000'), null);
  assert.equal(manualRow('Elma', '80', '0'), null);
  const r = manualRow('  Elma   kırmızı ', '80');
  assert.ok(r);
  assert.equal(r!.name, 'Elma kırmızı');
  assert.equal(r!.grams, 100);
  assert.equal(Math.round(rowKcal(r!)), 80);
  assert.equal(Math.round(rowKcal({ ...r!, grams: 50 })), 40, 'gram değişince orantılı');
});

// ── md.2: hak / sayaç ──────────────────────────────────────────────────────
test('effectiveRemaining: İstanbul gece yarısı (reset_at) geçince dünkü sayı gösterilmez', () => {
  const resetAt = '2026-11-10T00:00:00+03:00';
  const before = Date.parse('2026-11-09T23:59:00+03:00');
  const after = Date.parse('2026-11-10T00:00:01+03:00');
  assert.equal(effectiveRemaining({ remaining: 0, resetAt }, before), 0);
  assert.equal(effectiveRemaining({ remaining: 0, resetAt }, after), null);
  assert.equal(effectiveRemaining({ remaining: null, resetAt }, before), null);
  assert.equal(effectiveRemaining({ remaining: 2, resetAt: null }, after), 2);
});

test('runAiScan: iade (release) başarısızsa sayaç +1 YAPILMAZ (yanlış "hakkın iade edildi" yok)', async () => {
  const base = createMockAiScanClient({ cap: 3, failAnalysis: true });
  const c: AiScanClient = {
    ...base,
    async releaseScan() {
      throw new Error('ağ yok');
    },
  };
  const out = await runAiScan(c, { idempotencyKey: 'k', imageRef: 'file://a.jpg' });
  assert.equal(out.status, 'failed');
  assert.equal(out.remaining, 2);
});

test('runAiScan: önbellekten (cached) dönen rezervasyon başarısız olursa iade çağrılmaz', async () => {
  const calls: string[] = [];
  const c: AiScanClient = {
    async reserveScan() {
      return { ok: true, cached: true, remaining: 1, reset_at: 'x' };
    },
    async releaseScan() {
      calls.push('release');
    },
    async analyzeImage() {
      throw new Error('ağ');
    },
  };
  const out = await runAiScan(c, { idempotencyKey: 'k', imageRef: 'file://a.jpg' });
  assert.equal(out.status, 'failed');
  assert.equal(out.remaining, 1);
  assert.deepEqual(calls, []);
});

test('runAiScan: aynı anahtarla "Tekrar dene" iki kez hak düşürmez (idempotent)', async () => {
  const c = createMockAiScanClient({ cap: 3 });
  await runAiScan(c, { idempotencyKey: 'same', imageRef: 'file://a.jpg' });
  await runAiScan(c, { idempotencyKey: 'same', imageRef: 'file://a.jpg' });
  assert.equal(c._remaining(), 2);
});

// ── md.4: kuyruk sınıflandırma / yerel dosya ───────────────────────────────
test('classifyScanFailure: dosya/izin kalıcı · ağ/zaman aşımı/dakika sınırı geçici · model sayılır', () => {
  assert.equal(classifyScanFailure('file_missing'), 'permanent');
  assert.equal(classifyScanFailure('image_too_large'), 'permanent');
  assert.equal(classifyScanFailure('network'), 'transient');
  assert.equal(classifyScanFailure('rate_limit'), 'transient');
  assert.equal(classifyScanFailure('timeout'), 'transient');
  assert.equal(classifyScanFailure('parse'), 'counted');
  assert.equal(classifyScanFailure(undefined), 'counted');
  assert.equal(scanFailureInfo(new Error('scan_upload: file_missing'), 'upload').code, 'file_missing');
});

test('judgeLocalImage: yok → missing, 5 MB üstü → too_large, bilgi yok → ok', () => {
  assert.equal(judgeLocalImage({ exists: false }), 'missing');
  assert.equal(judgeLocalImage({ exists: true, size: 5 * 1024 * 1024 + 1 }), 'too_large');
  assert.equal(judgeLocalImage({ exists: true, size: 900_000 }), 'ok');
  assert.equal(judgeLocalImage(null), 'ok');
  assert.equal(isQueuedImageUri(`file:///doc/${QUEUE_DIR_NAME}a.jpg`, 'file:///doc/'), true);
  assert.equal(isQueuedImageUri('file:///cache/a.jpg', 'file:///doc/'), false);
  assert.equal(isQueuedImageUri('file:///doc/scan-queue/a.jpg', null), false);
});

// ── md.1: kapatılan analizin sonucu ────────────────────────────────────────
test('orphanResult: aynı kullanıcıya bir kez, 10 dk içinde; başka kullanıcıya asla', () => {
  clearOrphanResult();
  const now = 1_000_000;
  keepOrphanResult({ userId: 'u1', scanRef: 'k', photoUri: 'file://a', note: '', estimate: est }, now);
  assert.equal(takeOrphanResult('u2', now + 1), null, 'başka kullanıcı');
  keepOrphanResult({ userId: 'u1', scanRef: 'k', photoUri: 'file://a', note: '', estimate: est }, now);
  assert.equal(takeOrphanResult('u1', now + 1)?.scanRef, 'k');
  assert.equal(takeOrphanResult('u1', now + 2), null, 'tek kullanım');
  keepOrphanResult({ userId: 'u1', scanRef: 'k', photoUri: 'file://a', note: '', estimate: est }, now);
  assert.equal(takeOrphanResult('u1', now + ORPHAN_TTL_MS + 1), null, 'süre doldu');
});

// ── md.6: ölçüm olayları ───────────────────────────────────────────────────
test('scanEvents: D-S1 sözlük adları + kişisel veri beyaz listesi', () => {
  for (const n of ['scan_start', 'scan_success', 'scan_failed', 'log_meal']) {
    assert.ok((SCAN_EVENT_NAMES as readonly string[]).includes(n), `${n} sözlükte var`);
  }
  assert.deepEqual(scanEventProps('scan_success', { n_items: 3, kcal: 459.6, name: 'Pilav', photo: 'file://x' }), {
    n_items: 3,
    kcal: 460,
  });
  assert.deepEqual(scanEventProps('scan_start', { source: 'camera', has_note: true, note: 'gizli' }), {
    source: 'camera',
    has_note: true,
  });
  const got: unknown[] = [];
  setScanEventSink((name, props) => got.push([name, props]));
  trackScan('scan_failed', { reason: 'parse', stage: 'analyze', user_id: 'u1' });
  trackScan('scan_limit', { remaining: 0 });
  setScanEventSink(null);
  assert.deepEqual(got, [
    ['scan_failed', { reason: 'parse', stage: 'analyze' }],
    ['scan_limit', {}],
  ]);
});

// ── md.2: logla idempotent ─────────────────────────────────────────────────
function dupSupabase(existing: Record<string, unknown> | null, code = '23505'): InsertableSupabase {
  const q = {
    eq() {
      return q;
    },
    async maybeSingle() {
      return { data: existing, error: null };
    },
  };
  return {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return { data: null, error: { message: 'duplicate key value violates unique constraint', code } };
                },
              };
            },
          };
        },
        select() {
          return q;
        },
      };
    },
  } as unknown as InsertableSupabase;
}

test('saveAiScanEstimate: aynı tarama ikinci kez loglanırsa hata değil, mevcut satır döner', async () => {
  const row = { id: 'r1', name: 'Pilav', meal_type: 'ogle', calories: 210, protein: 4, carbs: 45, fat: 3, consumed_at: 'x' };
  const got = await saveAiScanEstimate(dupSupabase(row), { userId: 'u', mealType: 'lunch', sourceRef: 'k', estimate: est });
  assert.equal(got.id, 'r1');
  await assert.rejects(
    () => saveAiScanEstimate(dupSupabase(null), { userId: 'u', mealType: 'lunch', sourceRef: 'k', estimate: est }),
    /meal_consumptions.insert/,
  );
  assert.equal(isUniqueViolation({ message: 'x', code: '23505' }), true);
  assert.equal(isUniqueViolation({ message: 'permission denied' }), false);
});
