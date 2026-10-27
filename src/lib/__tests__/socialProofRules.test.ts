import test from 'node:test';
import assert from 'node:assert/strict';
import { begeniCumlesi, kaynakEtiketi, yorumTarihi, EN_AZ_OY } from '../socialProofRules';

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
  const simdi = new Date('2026-10-27T12:00:00Z');
  assert.equal(yorumTarihi('2026-09-24T12:00:00Z', simdi), '24 Eyl');
  assert.equal(yorumTarihi('2026-01-03T12:00:00Z', simdi), '3 Oca');
  assert.equal(yorumTarihi(null, simdi), '');
  assert.equal(yorumTarihi('bozuk', simdi), '');
});

test('önceki yıldan bir yorumda YIL da yazılır', () => {
  // Yıl hep gizlenirse 2025'ten bir yorum dünkü gibi görünür.
  const simdi = new Date('2026-10-27T12:00:00Z');
  assert.equal(yorumTarihi('2025-12-31T12:00:00Z', simdi), '31 Ara 2025');
  assert.equal(yorumTarihi('2024-06-05T12:00:00Z', simdi), '5 Haz 2024');
  // Yıl dönünce bu yılın yorumları da yıl almaya başlar — beklenen davranış.
  assert.equal(yorumTarihi('2026-09-24T12:00:00Z', new Date('2027-01-02T12:00:00Z')), '24 Eyl 2026');
});

test('kaynak etiketi: yalnızca uygulama geri bildirimleri işaretlenir', () => {
  // Sipariş değerlendirmesi anasayfadaki VARSAYILAN durum — her karta aynı
  // etiketi basmak gürültü olurdu, o yüzden bilinçli olarak null.
  assert.equal(kaynakEtiketi('uygulama'), 'Uygulama geri bildirimi');
  assert.equal(kaynakEtiketi('siparis'), null);
  assert.equal(kaynakEtiketi(undefined), null);
});
