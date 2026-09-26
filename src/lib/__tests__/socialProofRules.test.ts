import test from 'node:test';
import assert from 'node:assert/strict';
import { begeniCumlesi, yorumTarihi, EN_AZ_OY } from '../socialProofRules';

test('eşiğin altındaki oy hiçbir şey göstermez', () => {
  // 26.09.2026 canlı durum: en çok oy alan ürün 2 oy. Bu kural olmasa
  // "Deneyenlerin %100'ü beğendi" yazacaktı — iki kişiden.
  assert.equal(begeniCumlesi({ productId: 1, toplam: 1, begenen: 1, oran: 100 }), null);
  assert.equal(begeniCumlesi({ productId: 1, toplam: 2, begenen: 2, oran: 100 }), null);
  assert.equal(begeniCumlesi({ productId: 1, toplam: 4, begenen: 4, oran: 100 }), null);
});

test('eşiği geçince oy sayısıyla birlikte gösterilir', () => {
  assert.equal(
    begeniCumlesi({ productId: 1, toplam: 5, begenen: 4, oran: 80 }),
    "Deneyenlerin %80'i bu öğünü beğendi (5 kişi)",
  );
  assert.equal(
    begeniCumlesi({ productId: 1, toplam: 37, begenen: 33, oran: 89 }),
    "Deneyenlerin %89'i bu öğünü beğendi (37 kişi)",
  );
});

test('oran sıfır/negatifse gösterilmez', () => {
  assert.equal(begeniCumlesi({ productId: 1, toplam: 20, begenen: 0, oran: 0 }), null);
});

test('veri yoksa null', () => {
  assert.equal(begeniCumlesi(null), null);
  assert.equal(begeniCumlesi(undefined), null);
});

test('bozuk sayılara dayanıklı', () => {
  assert.equal(begeniCumlesi({ productId: 1, toplam: NaN, begenen: 1, oran: 90 } as any), null);
  assert.equal(begeniCumlesi({ productId: 1, toplam: 20, begenen: 1, oran: NaN } as any), null);
});

test('eşik 5 — düşürülürse testler uyarır', () => {
  assert.equal(EN_AZ_OY, 5);
});

test('yorum tarihi kısa biçimde', () => {
  assert.equal(yorumTarihi('2026-09-24T12:00:00Z'), '24 Eyl');
  assert.equal(yorumTarihi('2026-01-03T12:00:00Z'), '3 Oca');
  assert.equal(yorumTarihi(null), '');
  assert.equal(yorumTarihi('bozuk'), '');
});
