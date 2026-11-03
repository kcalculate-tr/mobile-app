// saveAiScanEstimate birim testi — sahte Supabase istemcisi (native yok).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { saveAiScanEstimate, type InsertableSupabase } from '../saveEstimate';

function fakeSupabase(onInsert: (table: string, row: Record<string, unknown>) => void): InsertableSupabase {
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          onInsert(table, row);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: {
                      id: 'row-1',
                      name: String(row.name),
                      meal_type: String(row.meal_type),
                      calories: Number(row.calories),
                      protein: Number(row.protein),
                      carbs: Number(row.carbs),
                      fat: Number(row.fat),
                      consumed_at: String(row.consumed_at),
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('saveAiScanEstimate: meal_consumptions tablosuna source=manual, source_ref=ai_scan yazar', async () => {
  const captured: { row: Record<string, unknown> | null } = { row: null };
  const supabase = fakeSupabase((table, row) => {
    assert.equal(table, 'meal_consumptions');
    captured.row = row;
  });

  const row = await saveAiScanEstimate(supabase, {
    userId: 'user-1',
    mealType: 'lunch',
    estimate: {
      name: 'Tabak (tahmini)',
      kcal: 640.4,
      protein_g: 35.2,
      carbs_g: 60.9,
      fat_g: 22.1,
      portion: 1,
      ingredients: [{ name: 'Tavuk', grams: 120 }],
      photo_url: null,
    },
  });

  assert.equal(captured.row?.source, 'manual');
  assert.equal(captured.row?.source_ref, 'ai_scan');
  assert.equal(captured.row?.user_id, 'user-1');
  assert.equal(row.calories, 640, 'kalori yuvarlanmalı');
  assert.equal(row.protein, 35);
});

test('saveAiScanEstimate: hata fırlatınca anlaşılır mesajla patlar', async () => {
  const supabase: InsertableSupabase = {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return { data: null, error: { message: 'boom' } };
                },
              };
            },
          };
        },
      };
    },
  };
  await assert.rejects(
    saveAiScanEstimate(supabase, {
      userId: 'u',
      mealType: 'lunch',
      estimate: { name: 'x', kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1, portion: 1, ingredients: [], photo_url: null },
    }),
    /boom/,
  );
});
