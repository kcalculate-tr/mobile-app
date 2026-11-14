// G49-S1 md.1 — konum kapısı: şehir değişince posta kodu temizlenir; konumdan gelen posta kodu şehirle tutarlı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consistentPostal, selectionFromGeocode, trPlateCode, withCity, type DistrictOption } from '../gateRule';

const LIST: DistrictOption[] = [
  { name: 'Bornova', served: true },
  { name: 'Karşıyaka', served: true },
];

test('withCity: ilçe VE posta kodu temizlenir, ülke korunur', () => {
  assert.deepEqual(withCity({ country: 'TR', city: 'İzmir', district: 'Bornova', postalCode: '35160' }, 'İstanbul'), {
    country: 'TR', city: 'İstanbul', district: null, postalCode: null,
  });
  assert.deepEqual(withCity({ country: 'DE', city: 'Berlin', district: 'Mitte', postalCode: '10115' }, 'Hamburg'), {
    country: 'DE', city: 'Hamburg', district: null, postalCode: null,
  });
});

test('trPlateCode: 81 il, Türkçe karakter/ek/takma ad toleranslı', () => {
  assert.equal(trPlateCode('İzmir'), '35');
  assert.equal(trPlateCode('izmir'), '35');
  assert.equal(trPlateCode('İstanbul'), '34');
  assert.equal(trPlateCode('Adana'), '01');
  assert.equal(trPlateCode('Düzce'), '81');
  assert.equal(trPlateCode('Ankara ili'), '06');
  assert.equal(trPlateCode('Afyon'), '03');
  assert.equal(trPlateCode('Şanlıurfa'), '63');
  assert.equal(trPlateCode('Berlin'), null);
  assert.equal(trPlateCode(null), null);
});

test('consistentPostal: TR plaka eşleşmesi + 5 hane; şehir yoksa yok; yabancı şehirde biçim serbest', () => {
  assert.equal(consistentPostal('TR', 'İzmir', '35160'), '35160');
  assert.equal(consistentPostal('TR', 'İstanbul', '35160'), null);
  assert.equal(consistentPostal('TR', 'İstanbul', '3416'), null);
  assert.equal(consistentPostal('TR', null, '35160'), null);
  assert.equal(consistentPostal('TR', 'Bilinmeyenköy', '12345'), '12345'); // plaka bilinmiyorsa yalnız biçim
  assert.equal(consistentPostal('DE', 'Berlin', '10115'), '10115');
  assert.equal(consistentPostal('GB', 'London', 'SW1A 1AA'), 'SW1A 1AA');
  assert.equal(consistentPostal('DE', null, '10115'), null);
  assert.equal(consistentPostal('TR', 'İzmir', '  '), null);
});

test('selectionFromGeocode: konum düğmesi tutarsız posta kodu bırakmaz', () => {
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İstanbul', subregion: 'Kadıköy', postalCode: '35160' }, LIST), {
    country: 'TR', city: 'İstanbul', district: 'Kadıköy', postalCode: null,
  });
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İzmir', subregion: 'Bornova', postalCode: '35040' }, LIST), {
    country: 'TR', city: 'İzmir', district: 'Bornova', postalCode: '35040',
  });
  // il çözülemezse posta kodu da yazılmaz
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', postalCode: '35040' }, LIST), {
    country: 'TR', city: null, district: null, postalCode: null,
  });
  // yabancı: şehir yoksa posta kodu yok
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'DE', postalCode: '10115' }, LIST), {
    country: 'DE', city: null, district: null, postalCode: null,
  });
});
