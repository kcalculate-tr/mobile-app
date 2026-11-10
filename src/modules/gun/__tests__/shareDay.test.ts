// G22-S2 md.5 (FinShareDay) — önizleme kartı verisi + gönderim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareDayCard,
  canShareDay,
  clampShareNote,
  shareDayToastKey,
  submitShareDay,
  SHARE_NOTE_MAX,
  type ShareDayMealInput,
} from '../shareDay';
import { translate } from '../../../core/i18n/core';

const meals: ShareDayMealInput[] = [
  { id: 'c2', meal_type: 'ogle', kcal: 520.4, consumed_at: '2026-11-10T12:30:00Z', protein_g: 40, carbs_g: 50, fat_g: 15, photo_url: 'https://x/l.jpg' },
  { id: 'c1', meal_type: 'kahvalti', kcal: 310, consumed_at: '2026-11-10T08:00:00Z', protein_g: 18, carbs_g: 30, fat_g: 10, photo_url: null },
  { id: 'c3', meal_type: 'breakfast', kcal: 90, consumed_at: '2026-11-10T09:00:00Z', photo_url: 'https://x/b2.jpg' },
  { id: 'c4', meal_type: 'aksam', kcal: 600, consumed_at: '2026-11-10T19:00:00Z' },
];

test('buildShareDayCard: sunucu özeti varsa toplam + yüzde + makro ondan', () => {
  const card = buildShareDayCard({
    meals,
    summary: { targetKcal: 2000, consumedKcal: 1520, consumedProtein: 80.4, consumedCarb: 150.6, consumedFat: 40 },
  });
  assert.equal(card.kcal, 1520);
  assert.equal(card.targetKcal, 2000);
  assert.equal(card.pct, 76);
  assert.equal(card.progress, 0.76);
  assert.deepEqual(card.macros, { p: 80, c: 151, f: 40 });
  assert.deepEqual(card.consumptionIds, ['c2', 'c1', 'c3', 'c4']);
});

test('buildShareDayCard: özet yoksa öğün toplamı, hedef/yüzde yok, makro öğünlerden', () => {
  const card = buildShareDayCard({ meals });
  assert.equal(card.kcal, 1520);
  assert.equal(card.targetKcal, null);
  assert.equal(card.pct, null);
  assert.equal(card.progress, 0);
  assert.deepEqual(card.macros, { p: 58, c: 80, f: 25 });
});

test('buildShareDayCard: makro verisi hiç yoksa null (uydurma yok)', () => {
  const card = buildShareDayCard({ meals: [{ id: 'a', meal_type: 'ogle', kcal: 100, consumed_at: '2026-11-10T12:00:00Z' }] });
  assert.equal(card.macros, null);
});

test('buildShareDayCard: hedef aşılınca halka 1’de durur, yüzde gerçek', () => {
  const card = buildShareDayCard({
    meals,
    summary: { targetKcal: 1000, consumedKcal: 1250, consumedProtein: 0, consumedCarb: 0, consumedFat: 0 },
  });
  assert.equal(card.progress, 1);
  assert.equal(card.pct, 125);
});

test('buildShareDayCard: öğün kutucukları tür sırasıyla, tür başına bir, ilk foto, kcal toplamı', () => {
  const card = buildShareDayCard({ meals });
  assert.deepEqual(
    card.meals.map((m) => m.meal),
    ['breakfast', 'lunch', 'dinner'],
  );
  // kahvaltı: 08:00 fotosuz, 09:00 fotolu → ilk BULUNAN foto
  assert.equal(card.meals[0].photo_url, 'https://x/b2.jpg');
  assert.equal(card.meals[0].kcal, 400);
  assert.equal(card.meals[1].kcal, 520);
  assert.equal(card.meals[2].photo_url, null);
});

test('buildShareDayCard: etkinlik = günün en uzun etkinliği', () => {
  const card = buildShareDayCard({
    meals,
    activity: {
      items: [
        { id: '1', type: 'yuruyus', minutes: 20, distance_km: null, kcal_est: 60, source: 'manual', logged_at: '' },
        { id: '2', type: 'kosu', minutes: 45, distance_km: 7, kcal_est: 400, source: 'manual', logged_at: '' },
      ],
      total_kcal_est: 460,
      total_minutes: 65,
    },
  });
  assert.deepEqual(card.activity, { type: 'kosu', minutes: 45 });
  assert.equal(buildShareDayCard({ meals }).activity, null);
});

test('canShareDay: öğün yoksa paylaşılamaz', () => {
  assert.equal(canShareDay(null), false);
  assert.equal(canShareDay(buildShareDayCard({ meals: [] })), false);
  assert.equal(canShareDay(buildShareDayCard({ meals })), true);
});

test('shareDayToastKey + metinler (FinShareDaySuccess)', () => {
  assert.equal(shareDayToastKey('followers'), 'share_day.toast_fol');
  assert.equal(shareDayToastKey('public'), 'share_day.toast_pub');
  assert.equal(translate('tr', 'share_day.toast_fol'), 'Günün takipçilerinle paylaşıldı');
  assert.equal(translate('en', 'share_day.toast_pub'), 'Your day was shared on Explore');
  assert.equal(translate('tr', 'share_day.title'), 'Günümü Keşfet’te paylaş');
  assert.equal(translate('en', 'share_day.kcal_of', { kcal: '1,520', target: '2,000' }), '1,520 / 2,000 kcal');
});

test('clampShareNote: en çok 80 karakter', () => {
  assert.equal(clampShareNote('a'.repeat(100)).length, SHARE_NOTE_MAX);
  assert.equal(clampShareNote('kısa'), 'kısa');
});

test('submitShareDay: her öğün için share_meal_to_day', async () => {
  const calls: string[] = [];
  const res = await submitShareDay({ shareMealToDay: async ({ consumption }) => void calls.push(consumption) }, ['a', 'b']);
  assert.deepEqual(res, { shared: 2 });
  assert.deepEqual(calls.sort(), ['a', 'b']);
});

test('submitShareDay: biri başarısızsa fırlatır (satır içi hata + Tekrar dene)', async () => {
  await assert.rejects(
    submitShareDay(
      {
        shareMealToDay: async ({ consumption }) => {
          if (consumption === 'b') throw new Error('share_meal_to_day: network');
        },
      },
      ['a', 'b'],
    ),
    /share_day_failed:1\/2/,
  );
});

test('submitShareDay: boş liste → fırlatır', async () => {
  await assert.rejects(submitShareDay({ shareMealToDay: async () => {} }, []), /share_day_empty/);
});
