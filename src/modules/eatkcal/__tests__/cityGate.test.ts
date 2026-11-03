// eatkcal şehir kapısı katalog testleri (G6-S4 md.2, md.5). Native yok.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { CITY_CATALOG, findCity, isActiveCity } from '../cityGate';

test('CITY_CATALOG: yalnız İzmir aktif, diğerleri "Çok yakında"', () => {
  assert.equal(isActiveCity('izmir'), true);
  assert.equal(isActiveCity('istanbul'), false);
  assert.equal(isActiveCity('ankara'), false);
  assert.equal(isActiveCity('antalya'), false);
});

test('CITY_CATALOG: tam 4 şehir, anahtarlar ascii/küçük harf (TR "İ" sorunu yok)', () => {
  assert.equal(CITY_CATALOG.length, 4);
  for (const c of CITY_CATALOG) {
    assert.equal(c.key, c.key.toLowerCase());
    assert.ok(/^[a-z]+$/.test(c.key), `${c.key} ascii/küçük harf olmalı`);
  }
});

test('findCity: bilinmeyen anahtar → undefined, aktiflik varsayılan false', () => {
  assert.equal(findCity('xyz'), undefined);
  assert.equal(isActiveCity('xyz'), false);
});
