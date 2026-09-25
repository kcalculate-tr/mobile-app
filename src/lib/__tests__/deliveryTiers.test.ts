import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adresKatmani,
  ilceleriKatmanlaAyir,
  katmanEtiketi,
  kiyasAnahtari,
  satirYayinda,
} from '../deliveryTiers';

const s = (
  district: string,
  neighborhood: string,
  opts: Partial<{ is_active: boolean; allow_immediate: boolean; allow_scheduled: boolean }> = {},
) => ({
  district,
  neighborhood,
  is_active: opts.is_active ?? true,
  allow_immediate: opts.allow_immediate ?? false,
  allow_scheduled: opts.allow_scheduled ?? false,
});

test('satirYayinda: pasif satır yayında değildir', () => {
  assert.equal(satirYayinda(s('Konak', 'Alsancak', { is_active: false, allow_immediate: true })), false);
});

test('satirYayinda: aktif ama iki tip de kapalıysa yayında değildir (Aliağa durumu)', () => {
  assert.equal(satirYayinda(s('Aliağa', 'Merkez')), false);
});

test('GERÇEK HATA: is_active=false + allow_scheduled=true listeye SIZMAZ (Çeşme)', () => {
  // Eski DeliveryZonesSheet yalnızca allow_* alanlarına bakıyordu; Çeşme'nin
  // 25 pasif mahallesi allow_scheduled=true olduğu için müşteriye
  // "Çeşme'ye teslimat var" deniyordu.
  const rows = [
    s('Çeşme', 'Alaçatı', { is_active: false, allow_scheduled: true }),
    s('Konak', 'Alsancak', { allow_immediate: true, allow_scheduled: true }),
  ];
  const { hizli, planli } = ilceleriKatmanlaAyir(rows);
  assert.deepEqual(hizli, ['Konak']);
  assert.deepEqual(planli, []);
  assert.equal(adresKatmani(rows, 'Çeşme', 'Alaçatı'), 'yok');
});

test('ilçeler iki katmana ayrılır ve alfabetik sıralanır', () => {
  const rows = [
    s('Karabağlar', 'Bozyaka', { allow_immediate: true, allow_scheduled: true }),
    s('Konak', 'Alsancak', { allow_immediate: true, allow_scheduled: true }),
    s('Bornova', 'Erzene', { allow_scheduled: true }),
    s('Karşıyaka', 'Bostanlı', { allow_scheduled: true }),
  ];
  const { hizli, planli } = ilceleriKatmanlaAyir(rows);
  assert.deepEqual(hizli, ['Karabağlar', 'Konak']);
  assert.deepEqual(planli, ['Bornova', 'Karşıyaka']);
});

test('karma ilçe yalnız hızlı listesinde görünür, iki başlıkta birden değil', () => {
  const rows = [
    s('Konak', 'Alsancak', { allow_immediate: true, allow_scheduled: true }),
    s('Konak', 'Uzak Mahalle', { allow_scheduled: true }),
  ];
  const { hizli, planli } = ilceleriKatmanlaAyir(rows);
  assert.deepEqual(hizli, ['Konak']);
  assert.deepEqual(planli, []);
});

test('adresKatmani: mahalle bilinirse ilçenin geneli değil O mahalle belirler', () => {
  const rows = [
    s('Konak', 'Alsancak', { allow_immediate: true, allow_scheduled: true }),
    s('Konak', 'Uzak Mahalle', { allow_scheduled: true }),
  ];
  assert.equal(adresKatmani(rows, 'Konak', 'Alsancak'), 'hizli');
  assert.equal(adresKatmani(rows, 'Konak', 'Uzak Mahalle'), 'planli');
});

test('adresKatmani: ilçe açık ama o mahalle kapalıysa yok döner', () => {
  const rows = [
    s('Konak', 'Alsancak', { allow_immediate: true }),
    s('Konak', 'Kapalı Mahalle', { is_active: false, allow_immediate: true }),
  ];
  assert.equal(adresKatmani(rows, 'Konak', 'Kapalı Mahalle'), 'yok');
});

test('adresKatmani: mahalle yoksa ilçenin en iyi katmanı döner', () => {
  const rows = [
    s('Konak', 'Uzak', { allow_scheduled: true }),
    s('Konak', 'Alsancak', { allow_immediate: true }),
  ];
  assert.equal(adresKatmani(rows, 'Konak', null), 'hizli');
});

test('adresKatmani: tanımsız ilçe ve boş girdi yok döner', () => {
  const rows = [s('Konak', 'Alsancak', { allow_immediate: true })];
  assert.equal(adresKatmani(rows, 'Bergama', null), 'yok');
  assert.equal(adresKatmani(rows, null, null), 'yok');
  assert.equal(adresKatmani(rows, '   ', null), 'yok');
  assert.equal(adresKatmani([], 'Konak', null), 'yok');
});

test('Türkçe büyük/küçük harf: İ/i ve I/ı doğru eşleşir', () => {
  assert.equal(kiyasAnahtari('İZMİR'), kiyasAnahtari('izmir'));
  assert.equal(kiyasAnahtari('KARŞIYAKA'), kiyasAnahtari('karşıyaka'));
  const rows = [s('Karşıyaka', 'Bostanlı', { allow_scheduled: true })];
  assert.equal(adresKatmani(rows, 'KARŞIYAKA', 'BOSTANLI'), 'planli');
  assert.equal(adresKatmani(rows, '  karşıyaka  ', 'bostanlı'), 'planli');
});

test('null allow_* alanları izin sayılmaz (kolon varsayılanı false)', () => {
  const rows = [{ district: 'Konak', neighborhood: 'Alsancak', is_active: true,
                  allow_immediate: null, allow_scheduled: null }];
  assert.equal(adresKatmani(rows, 'Konak', 'Alsancak'), 'yok');
  assert.deepEqual(ilceleriKatmanlaAyir(rows), { hizli: [], planli: [] });
});

test('UK yazımı neighbourhood da kabul edilir', () => {
  const rows = [{ district: 'Konak', neighbourhood: 'Alsancak', is_active: true,
                  allow_immediate: true, allow_scheduled: true }];
  assert.equal(adresKatmani(rows, 'Konak', 'Alsancak'), 'hizli');
});

test('katmanEtiketi her katman için metin döner', () => {
  assert.equal(katmanEtiketi('hizli'), 'Bugün teslimat var');
  assert.equal(katmanEtiketi('planli'), 'Gün seçerek teslimat');
  assert.equal(katmanEtiketi('yok'), 'Bu adrese teslimat yok');
});
