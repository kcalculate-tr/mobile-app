// G15-S1 Ek karar — FinSignupEat v2 saf mantık. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildZoneIndex, EMPTY_FORM, isOutOfZone, validateAddressForm } from '../../../eatkcal/v2/model/addressModel';
import {
  canContinueCity,
  formatPhoneMask,
  isValidTrMobile,
  nextStep,
  phoneDigits,
  phoneForStorage,
  prevStep,
  validateAddressStep,
  zoneIsActive,
} from '../signupEatLogic';

const INDEX = buildZoneIndex([
  { district: 'Konak', neighbourhood: 'Alsancak', is_active: true },
  { district: 'Konak', neighbourhood: 'Kemeraltı', is_active: false },
  { district: 'Bornova', neighbourhood: 'Kazımdirik' },
]);
const PIN = { latitude: 38.43, longitude: 27.14 };
const OK_FORM = { district: 'Konak', neighborhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.', building_no: '12' };

test('şehir: yalnız seçili + izinli şehirde, kontrol sürerken değil', () => {
  assert.equal(canContinueCity('İzmir', false), true);
  assert.equal(canContinueCity('İzmir', true), false);
  assert.equal(canContinueCity('İstanbul', false), false); // "Çok yakında"
  assert.equal(canContinueCity(null, false), false);
});

test('adım makinesi: şehir → adres → telefon → bitti; kayıtlı adres varsa adres+telefon atlanır', () => {
  assert.equal(nextStep('city', false), 'address');
  assert.equal(nextStep('city', true), 'done');
  assert.equal(nextStep('address', false), 'phone');
  assert.equal(nextStep('phone', false), 'done');
});

test('geri: telefon → adres → şehir → çık', () => {
  assert.equal(prevStep('phone'), 'address');
  assert.equal(prevStep('address'), 'city');
  assert.equal(prevStep('city'), null);
});

test('adres kapısı: harita doğrulaması (pin) olmadan ilerlemez', () => {
  assert.equal(validateAddressStep({ form: OK_FORM, index: INDEX, pinCoords: null, mapFailed: false }), 'needs_pin');
  assert.equal(validateAddressStep({ form: OK_FORM, index: INDEX, pinCoords: PIN, mapFailed: false }), null);
});

test('adres kapısı: harita hiç açılamazsa (mevcut akış) pin aranmaz ama bölge/sokak şart', () => {
  assert.equal(validateAddressStep({ form: OK_FORM, index: INDEX, pinCoords: null, mapFailed: true }), null);
  assert.equal(
    validateAddressStep({ form: { ...OK_FORM, neighborhood: '' }, index: INDEX, pinCoords: null, mapFailed: true }),
    'needs_zone',
  );
});

test('adres kapısı: ilçe/mahalle bölge listesinde değilse needs_zone; sokak/bina yoksa needs_street', () => {
  assert.equal(
    validateAddressStep({ form: { ...OK_FORM, neighborhood: 'Yok Mahalle' }, index: INDEX, pinCoords: PIN, mapFailed: false }),
    'needs_zone',
  );
  assert.equal(
    validateAddressStep({ form: { ...OK_FORM, district: 'Karşıyaka' }, index: INDEX, pinCoords: PIN, mapFailed: false }),
    'needs_zone',
  );
  assert.equal(
    validateAddressStep({ form: { ...OK_FORM, building_no: ' ' }, index: INDEX, pinCoords: PIN, mapFailed: false }),
    'needs_street',
  );
  assert.equal(
    validateAddressStep({ form: { ...OK_FORM, street: '' }, index: INDEX, pinCoords: PIN, mapFailed: false }),
    'needs_street',
  );
});

test('bölge dışı (aktif olmayan) mahalle: kaydı ENGELLEMEZ — adım kapısı geçer, yalnız uyarı kuralı true', () => {
  const inactive = { ...OK_FORM, neighborhood: 'Kemeraltı' };
  assert.equal(validateAddressStep({ form: inactive, index: INDEX, pinCoords: PIN, mapFailed: false }), null);
  assert.equal(zoneIsActive(inactive, INDEX), false);
  assert.equal(zoneIsActive(OK_FORM, INDEX), true);
  // addressModel.isOutOfZone ile aynı sonuç
  const full = { ...EMPTY_FORM, ...inactive };
  assert.equal(isOutOfZone(full, INDEX), !zoneIsActive(inactive, INDEX));
});

test('kayıt doğrulaması (mevcut model): ad/e-posta/telefon eksikse err_required, tamamsa geçer', () => {
  const base = { ...EMPTY_FORM, ...OK_FORM, first_name: 'Ada', last_name: 'Yılmaz', contact_email: 'a@b.co' };
  assert.equal(validateAddressForm({ ...base, contact_phone: '' }, INDEX), 'err_required');
  assert.equal(validateAddressForm({ ...base, contact_phone: phoneForStorage('532 111 22 33') }, INDEX), null);
});

test('telefon: öneklerle de olsa 10 hane; geçerli = 5 ile başlayan 10 hane', () => {
  assert.equal(phoneDigits('+90 532 111 22 33'), '5321112233');
  assert.equal(phoneDigits('0532 111 22 33'), '5321112233');
  assert.equal(phoneDigits('905321112233'), '5321112233');
  assert.equal(phoneDigits('53211122334455'), '5321112233');
  assert.equal(isValidTrMobile('532 111 22 33'), true);
  assert.equal(isValidTrMobile('0532 111 22 33'), true);
  assert.equal(isValidTrMobile('432 111 22 33'), false); // 5 ile başlamıyor
  assert.equal(isValidTrMobile('532 111 22'), false); // eksik
  assert.equal(isValidTrMobile(''), false);
});

test('telefon maskesi ve saklama biçimi', () => {
  assert.equal(formatPhoneMask(''), '+90 ');
  assert.equal(formatPhoneMask('5'), '+90 5');
  assert.equal(formatPhoneMask('5321112233'), '+90 532 111 22 33');
  assert.equal(phoneForStorage('+90 532 111 22 33'), '05321112233');
  assert.equal(phoneForStorage('123'), '');
});
