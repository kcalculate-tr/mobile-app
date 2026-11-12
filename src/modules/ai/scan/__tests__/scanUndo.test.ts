// G21-S1 md.4 — Tara kaydı geri alma: kabuk toast'ı / sonuç ekranı aynı silmeyi kullanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteScanConsumption, rowIdOf, scanFlightUndo, type DeletableSupabase } from '../scanUndo';

const ROOT = join(__dirname, '../../../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function fakeDb(error: unknown = null) {
  const calls: Array<{ table: string; eq: Array<[string, string]> }> = [];
  const db: DeletableSupabase = {
    from(table: string) {
      const c = { table, eq: [] as Array<[string, string]> };
      calls.push(c);
      return {
        delete() {
          return {
            eq(col: string, v: string) {
              c.eq.push([col, v]);
              return {
                eq(col2: string, v2: string) {
                  c.eq.push([col2, v2]);
                  return Promise.resolve({ error });
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

test('deleteScanConsumption: kullanıcı + id ile meal_consumptions satırını siler', async () => {
  const { db, calls } = fakeDb();
  assert.equal(await deleteScanConsumption(db, 'u1', 'row-1'), true);
  assert.deepEqual(calls, [{ table: 'meal_consumptions', eq: [['user_id', 'u1'], ['id', 'row-1']] }]);
});

test('deleteScanConsumption: hata → false; id yok → çağrı yok', async () => {
  const bad = fakeDb({ message: 'x' });
  assert.equal(await deleteScanConsumption(bad.db, 'u1', 'row-1'), false);
  const none = fakeDb();
  assert.equal(await deleteScanConsumption(none.db, 'u1', ''), false);
  assert.equal(none.calls.length, 0);
});

test('scanFlightUndo: id yoksa null (kabuk Geri al çizmez); çift basış tek silme', async () => {
  const { db, calls } = fakeDb();
  assert.equal(scanFlightUndo(() => db, 'u1', null), null);
  assert.equal(scanFlightUndo(() => db, null, 'r'), null);
  const results: boolean[] = [];
  const undo = scanFlightUndo(() => db, 'u1', 'row-9', (ok) => results.push(ok))!;
  await Promise.all([undo(), undo()]);
  assert.equal(calls.length, 1);
  assert.deepEqual(results, [true]);
});

test('scanFlightUndo: silme başarısızsa yeniden denenebilir', async () => {
  const { db, calls } = fakeDb({ message: 'net' });
  const undo = scanFlightUndo(() => db, 'u1', 'row-9')!;
  await undo();
  await undo();
  assert.equal(calls.length, 2);
});

test('rowIdOf: saveAiScanEstimate dönüşünden id', () => {
  assert.equal(rowIdOf({ id: 'abc' }), 'abc');
  assert.equal(rowIdOf(null), null);
  assert.equal(rowIdOf({}), null);
});

test('statik: Tara uçuşları id + undo taşır; Keşfet kendi log toast\'ını göstermez, uçuş her yolda', () => {
  const scan = read('src/modules/ai/scan/screens/ScanScreen.tsx');
  assert.ok((scan.match(/undo: scanFlightUndo\(/g) ?? []).length >= 2, 'iki Tara uçuşu da undo taşır');
  assert.match(scan, /id: p\.rowId \?\? null/);
  assert.match(read('src/modules/ai/scan/pendingProcessor.ts'), /rowId: rowIdOf\(savedRow\)/);
  const kesfet = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  assert.doesNotMatch(kesfet, /ownToast: true/);
  assert.match(kesfet, /id: consumptionId,\s*\n\s*\/\/[^\n]*\n\s*undo: async/);
  // logla toast metni yalnız vitrin karesinde kalır (kabuk toast'ı tek toast).
  assert.equal((kesfet.match(/kesfet\.ui\.logged_to/g) ?? []).length, 1);
});

test('statik md.5: Ana sayfa listesi photo_path seçer, geri alma fotoğrafı yeniden yazar', () => {
  const tr = read('src/screens/TrackerScreen.tsx');
  assert.match(tr, /const CONSUMED_SELECT = '[^']*,photo_path'/);
  assert.doesNotMatch(tr, /'id,source,source_ref,name,meal_type,calories,protein,carbs,fat,note,consumed_at'/);
  assert.match(tr, /photo_path: r\.photo_path != null \? String\(r\.photo_path\) : null/);
  assert.match(tr, /\.\.\.\(row\.photo_path \? \{ photo_path: row\.photo_path \} : \{\}\)/);
});
