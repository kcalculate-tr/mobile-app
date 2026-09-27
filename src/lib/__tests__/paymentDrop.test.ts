import test from 'node:test';
import assert from 'node:assert/strict';
import { dususEtiketi, dususAciklamasi } from '../paymentDrop';

test('etiket sebep@aşama biçiminde', () => {
  assert.equal(dususEtiketi({ stage: 'provider_page', reason: 'abandoned' }), 'abandoned@provider_page');
  assert.equal(dususEtiketi({ stage: 'init', reason: 'init_error' }), 'init_error@init');
});

test('en sık beklenen durum: 3DS sayfasında vazgeçme', () => {
  // 16-25 Eylül arasındaki ölçülebilir pencerede baskın sinyal "ödeme
  // başlatıldı, sonuç hiç dönmedi" idi. Bu etiket onu ayırt edilebilir kılıyor.
  assert.equal(
    dususAciklamasi(dususEtiketi({ stage: 'provider_page', reason: 'abandoned' })),
    'Banka/3DS sayfasında vazgeçti',
  );
});

test('kayıt yoksa açıkça söylenir', () => {
  assert.equal(dususAciklamasi(null), 'Kayıt yok');
  assert.equal(dususAciklamasi(undefined), 'Kayıt yok');
  assert.equal(dususAciklamasi(''), 'Kayıt yok');
});

test('bilinmeyen etiket yutulmaz, olduğu gibi döner', () => {
  // Gelecekte yeni bir aşama eklenirse rapor "bilinmiyor"a düşmesin —
  // ham etiketi görmek, hiçbir şey görmemekten iyi.
  assert.equal(dususAciklamasi('failed@yeni_asama'), 'failed@yeni_asama');
});

test('tüm sebep × aşama kombinasyonları etiketlenebiliyor', () => {
  const asamalar = ['init', 'provider_page', 'returned'] as const;
  const sebepler = ['abandoned', 'failed', 'init_error'] as const;
  const etiketler = new Set<string>();
  for (const s of asamalar) for (const r of sebepler) {
    etiketler.add(dususEtiketi({ stage: s, reason: r }));
  }
  assert.equal(etiketler.size, 9, 'her kombinasyon benzersiz etiket üretmeli');
});
