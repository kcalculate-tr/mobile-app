// G28-S1 md.4 — Logla'nın yazdığı kayıt sonuç ekranında gösterilenle BİREBİR aynı
// (ad, kcal, makro). SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeAdjusted, manualRow, rowsFromEstimate, type Estimate } from '../adjust';
import {
  loggedValues,
  sameLoggedValues,
  saveAiScanEstimate,
  type InsertableSupabase,
  type MealConsumptionRow,
} from '../saveEstimate';
import { scanImagePath } from '../scanPath';

// Ekranda gösterilen sonuç (TestFlight örneği): modelin adı öğe adından FARKLI olabilir
// (öksüz sonuç, ses, gelecekteki edge "dish" adı) — Logla adı yeniden üretmemeli.
const shown: Estimate = {
  name: 'Americano (büyük fincan, sütsüz)',
  kcal: 8,
  protein_g: 1,
  carbs_g: 1,
  fat_g: 0,
  portion: 1,
  ingredients: [{ name: 'Americano', grams: 350, kcal: 8, protein_g: 1, carbs_g: 1, fat_g: 0 }],
  photo_url: null,
};

test('adjustedName: hiçbir öğe değişmediyse gösterilen ad AYNEN gider (yeniden adlandırma yok)', () => {
  const a = computeAdjusted(shown, rowsFromEstimate(shown));
  assert.equal(a.name, 'Americano (büyük fincan, sütsüz)');
  assert.equal(a.kcal, 8);
  assert.equal(a.protein_g, 1);
  assert.equal(a.carbs_g, 1);
  assert.equal(a.fat_g, 0);
});

test('adjustedName: öğe eklenince/silinince ad öğelerden kurulur (ekran da aynı adjusted.name)', () => {
  const rows = rowsFromEstimate(shown);
  const extra = manualRow('Süt', '40', '100');
  assert.ok(extra);
  const a = computeAdjusted(shown, [...rows, extra!]);
  assert.equal(a.name, 'Americano, Süt');
});

type Call = { op: 'insert' | 'select' | 'update'; row?: Record<string, unknown> };

/** Sahte istemci: insert → benzersizlik çakışması; mevcut satır `existing`. */
function conflictingSupabase(existing: MealConsumptionRow, calls: Call[], updateOk = true): InsertableSupabase {
  const db = {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ op: 'insert', row });
          return { select: () => ({ single: async () => ({ data: null, error: { message: 'duplicate key', code: '23505' } }) }) };
        },
        select() {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => {
              calls.push({ op: 'select' });
              return { data: existing, error: null };
            },
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          calls.push({ op: 'update', row: patch });
          const chain = {
            eq: () => chain,
            select: () => ({
              single: async () =>
                updateOk ? { data: { ...existing, ...patch } as MealConsumptionRow, error: null } : { data: null, error: { message: 'rls' } },
            }),
          };
          return chain;
        },
      };
    },
  };
  return db as unknown as InsertableSupabase;
}

const queuedRow: MealConsumptionRow = {
  id: 'row-q',
  name: 'Amerikano (sade kahve), 1 büyük fincan',
  meal_type: 'ogle',
  calories: 5,
  protein: 0,
  carbs: 1,
  fat: 0,
  consumed_at: '2026-11-11T08:00:00.000Z',
};

test('çakışmada mevcut satır EKRANDAKİNDEN farklıysa ekrandaki değerlerle güncellenir (TestFlight hatası)', async () => {
  const calls: Call[] = [];
  const row = await saveAiScanEstimate(conflictingSupabase(queuedRow, calls), {
    userId: 'u1',
    mealType: 'lunch',
    sourceRef: 'u1-file:///k.jpg',
    estimate: shown,
  });
  assert.equal(row.id, 'row-q', 'ikinci kayıt yok — aynı satır');
  assert.equal(row.name, 'Americano (büyük fincan, sütsüz)');
  assert.equal(row.calories, 8);
  assert.equal(row.protein, 1);
  assert.equal(row.carbs, 1);
  assert.equal(row.fat, 0);
  assert.deepEqual(
    calls.map((c) => c.op),
    ['insert', 'select', 'update'],
  );
});

test('çakışmada mevcut satır zaten aynıysa güncelleme yok (çift dokunma)', async () => {
  const calls: Call[] = [];
  const same: MealConsumptionRow = { ...queuedRow, ...loggedValues(shown, 'lunch') };
  const row = await saveAiScanEstimate(conflictingSupabase(same, calls), {
    userId: 'u1',
    mealType: 'lunch',
    sourceRef: 'u1-file:///k.jpg',
    estimate: shown,
  });
  assert.equal(row.calories, 8);
  assert.ok(!calls.some((c) => c.op === 'update'));
});

test('eşitleme başarısızsa yanlış kayıt "loglandı" diye DÖNMEZ — hata', async () => {
  await assert.rejects(
    saveAiScanEstimate(conflictingSupabase(queuedRow, [], false), {
      userId: 'u1',
      mealType: 'lunch',
      sourceRef: 'u1-file:///k.jpg',
      estimate: shown,
    }),
    /eşitlenemedi/,
  );
});

test('kullanıcının porsiyon düzeltmesi de çakışmada kaybolmaz', async () => {
  const rows = rowsFromEstimate(shown).map((r) => ({ ...r, grams: r.baseGrams * 2 }));
  const doubled = computeAdjusted(shown, rows);
  assert.equal(doubled.kcal, 16);
  const same: MealConsumptionRow = { ...queuedRow, ...loggedValues(shown, 'lunch') };
  const calls: Call[] = [];
  const row = await saveAiScanEstimate(conflictingSupabase(same, calls), {
    userId: 'u1',
    mealType: 'lunch',
    sourceRef: 'u1-file:///k.jpg',
    estimate: doubled,
  });
  assert.equal(row.calories, 16);
});

test('sameLoggedValues: ad, öğün, kcal, makro hepsi karşılaştırılır', () => {
  const v = loggedValues(shown, 'lunch');
  assert.ok(sameLoggedValues({ ...queuedRow, ...v }, v));
  assert.ok(!sameLoggedValues({ ...queuedRow, ...v, name: 'x' }, v));
  assert.ok(!sameLoggedValues({ ...queuedRow, ...v, fat: 3 }, v));
  assert.ok(!sameLoggedValues({ ...queuedRow, ...v, meal_type: 'aksam' }, v));
});

test('md.2: fotoğraf yolu verilirse insert photo_path yazar (analizde yüklenen dosya)', async () => {
  const calls: Call[] = [];
  const same: MealConsumptionRow = { ...queuedRow, ...loggedValues(shown, 'lunch') };
  await saveAiScanEstimate(conflictingSupabase(same, calls), {
    userId: 'u1',
    mealType: 'lunch',
    sourceRef: 'u1-file:///k.jpg',
    estimate: shown,
    photoPath: scanImagePath('u1', 'u1-file:///k.jpg'),
  });
  assert.equal(calls[0].row?.photo_path, 'u1/scans/u1-file____k_jpg.jpg');
});

test('statik: Tara ön planda anahtarı kilitler, başarıda kuyruğu sahiplenir; kompakt sonuç adjusted.name gösterir', () => {
  const root = join(__dirname, '..');
  const scan = readFileSync(join(root, 'screens/ScanScreen.tsx'), 'utf8');
  assert.match(scan, /claimPendingKey\(idempotencyKey\)/);
  assert.match(scan, /releasePendingKey\(idempotencyKey\)/);
  assert.match(scan, /adoptPendingEntry\(idempotencyKey, uri\)/);
  const res = readFileSync(join(root, 'ui/FinPhotoResult.tsx'), 'utf8');
  assert.ok(!/\{estimate\.name\}/.test(res), 'sonuç ekranı Logla ile aynı adı (adjusted.name) göstermeli');
});
