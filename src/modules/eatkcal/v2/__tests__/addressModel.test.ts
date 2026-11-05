// eatkcal v2 md.5 — adres saf mantığı: bugünkü AddressesScreen /
// AddressVerificationSheet kurallarıyla BİREBİR (kaynak satırlar model
// dosyasında). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAddressPayload,
  buildFullAddressAuto,
  buildZoneIndex,
  chipFromTitle,
  composeFullAddress,
  directionsFromFullAddress,
  EMPTY_FORM,
  formatAddressLine,
  formFromAddress,
  fromNativeGeocode,
  getMissingColumnName,
  isOutOfZone,
  matchReverseGeo,
  mergeReverseGeo,
  parseGoogleComponents,
  splitName,
  titleFromForm,
  validateAddressForm,
  zoneStatusFor,
  type AddressFormV2,
} from '../model/addressModel';
import {
  deleteAddress,
  insertAddress,
  setDefaultAddress,
  updateAddress,
} from '../model/addressSave';
import type { Address } from '../../../../types';

const ZONES: Record<string, unknown>[] = [
  { district: 'Konak', neighborhood: 'Alsancak', is_active: true, allow_immediate: true, allow_scheduled: true, estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 55 },
  { district: 'Konak', neighborhood: 'Göztepe', is_active: true, allow_immediate: false, allow_scheduled: true },
  { district: 'Urla', neighbourhood: 'İskele', is_active: false, allow_immediate: false, allow_scheduled: true },
  { district: 'Bornova', mahalle: 'Erzene' },
  { district: 'Buca' }, // mahallesiz satır: ilçe listesine girer, mahalle yok
];

const FORM: AddressFormV2 = {
  ...EMPTY_FORM,
  first_name: 'Ada',
  last_name: 'Yılmaz',
  contact_phone: '05550000000',
  contact_email: 'ada@example.com',
  district: 'Konak',
  neighborhood: 'Alsancak',
  street: 'Kıbrıs Şehitleri Cd.',
  building_no: '12',
  floor: '3',
  apartment_no: '5',
};

test('bölge dizini: ilçe/mahalle seçenekleri, üç kolon adı, aktif anahtar is_active !== false', () => {
  const idx = buildZoneIndex(ZONES);
  assert.deepEqual(idx.districtOptions.map((o) => o.value), ['Bornova', 'Buca', 'Konak', 'Urla']);
  assert.deepEqual(idx.neighbourhoodsByDistrict.Konak.map((o) => o.value), ['Alsancak', 'Göztepe']);
  assert.deepEqual(idx.neighbourhoodsByDistrict.Urla.map((o) => o.value), ['İskele']);
  assert.deepEqual(idx.neighbourhoodsByDistrict.Bornova.map((o) => o.value), ['Erzene']);
  assert.equal(idx.neighbourhoodsByDistrict.Buca, undefined);
  assert.equal(idx.activeKeys.has('urla|iskele'), false); // is_active=false
  assert.equal(idx.activeKeys.has('bornova|erzene'), true); // is_active tanımsız → aktif
});

test('ters geocode: native + Google birleşir; Apple mahallesi eşleşmezse Google adayı', () => {
  const native = fromNativeGeocode({ subregion: 'Konak', district: 'Yeşilyurt', street: 'Kıbrıs Şehitleri Cd.', streetNumber: '12' });
  const google = parseGoogleComponents([
    { long_name: 'Konak', types: ['administrative_area_level_2'] },
    { long_name: 'Alsancak Mahallesi', types: ['administrative_area_level_4'] },
    { long_name: 'Kıbrıs Şehitleri Caddesi', types: ['route'] },
  ]);
  const merged = mergeReverseGeo(native, google);
  assert.equal(merged?.neighbourhood, 'Yeşilyurt');
  assert.equal(merged?.neighbourhoodAlt, 'Alsancak Mahallesi');
  assert.equal(merged?.street, 'Kıbrıs Şehitleri Cd.'); // native öncelikli
  const m = matchReverseGeo(merged, buildZoneIndex(ZONES));
  assert.deepEqual(m, { district: 'Konak', neighbourhood: 'Alsancak', needsNeighbourhood: false });
  assert.equal(mergeReverseGeo(native, null), native);
});

test('ters geocode: ilçe var mahalle yok → mevcut ipucu (needsNeighbourhood)', () => {
  const m = matchReverseGeo({ district: 'Konak', neighbourhood: 'Bilinmeyen' }, buildZoneIndex(ZONES));
  assert.deepEqual(m, { district: 'Konak', neighbourhood: null, needsNeighbourhood: true });
  assert.deepEqual(matchReverseGeo(null, buildZoneIndex(ZONES)), { district: null, neighbourhood: null, needsNeighbourhood: false });
});

test('bölge hapı: hemen (süre veriden) / ertesi gün / yok / bilinmiyor', () => {
  const idx = buildZoneIndex(ZONES);
  const now = zoneStatusFor(idx, 'Konak', 'Alsancak', null);
  assert.equal(now.kind, 'now');
  assert.equal(now.eta, '30-55 dk');
  assert.equal(now.free, true); // ücret tanımsız → 0
  const paid = zoneStatusFor(idx, 'Konak', 'Alsancak', {
    immediate: { min_order: 0, shipping_fee: 40, free_shipping_above: 500 },
    scheduled: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  });
  assert.equal(paid.free, false);
  assert.equal(zoneStatusFor(idx, 'Konak', 'Göztepe', null).kind, 'next_day');
  assert.equal(zoneStatusFor(idx, 'Urla', 'İskele', null).kind, 'none');
  assert.equal(zoneStatusFor(idx, 'Konak', '', null).kind, 'unknown');
  assert.equal(zoneStatusFor(idx, 'Bornova', 'Erzene', null).kind, 'now'); // allow_* tanımsız → açık
});

test('doğrulama: AddressesScreen sırası ve mesajları', () => {
  const idx = buildZoneIndex(ZONES);
  assert.equal(validateAddressForm(FORM, idx), null);
  assert.equal(validateAddressForm({ ...FORM, building_no: ' ' }, idx), 'err_required');
  assert.equal(validateAddressForm({ ...FORM, contact_email: '' }, idx), 'err_required');
  assert.equal(validateAddressForm({ ...FORM, district: 'Çeşme' }, idx), 'err_district');
  assert.equal(validateAddressForm({ ...FORM, district: 'Buca', neighborhood: 'X' }, idx), 'err_no_neighbourhoods');
  assert.equal(validateAddressForm({ ...FORM, neighborhood: 'Bostanlı' }, idx), 'err_neighbourhood');
  assert.equal(isOutOfZone(FORM, idx), false);
  assert.equal(isOutOfZone({ ...FORM, district: 'Urla', neighborhood: 'İskele' }, idx), true);
});

test('payload: AddressesScreen ile aynı sütunlar; koordinat yalnız harita onayıyla', () => {
  const p = buildAddressPayload(FORM, 'u1', null);
  assert.deepEqual(Object.keys(p).sort(), [
    'apartment_no', 'building_name', 'building_no', 'city', 'contact_email', 'contact_name',
    'contact_phone', 'district', 'first_name', 'floor', 'full_address', 'last_name',
    'neighbourhood', 'street', 'title', 'user_id',
  ]);
  assert.equal(p.contact_name, 'Ada Yılmaz');
  assert.equal(p.full_address, 'Kıbrıs Şehitleri Cd. No:12 Kat:3 D:5');
  assert.equal(p.building_name, null);
  assert.equal(p.city, 'İzmir');
  assert.equal(p.title, 'Ev');
  const withCoords = buildAddressPayload(FORM, 'u1', { latitude: 38.43, longitude: 27.14 }, '2026-11-06T00:00:00.000Z');
  assert.equal(withCoords.latitude, 38.43);
  assert.equal(withCoords.verified_at, '2026-11-06T00:00:00.000Z');
});

test('adres tarifi: otomatik adresin SONUNA eklenir, düzenlemede geri ayrılır', () => {
  const f = { ...FORM, directions: 'Zil çalışmıyor' };
  assert.equal(composeFullAddress(f), 'Kıbrıs Şehitleri Cd. No:12 Kat:3 D:5 — Zil çalışmıyor');
  const addr = {
    id: 'a', title: 'Ev', contact_name: '', contact_phone: '', contact_email: '', city: 'İzmir',
    district: 'Konak', neighbourhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.', building_no: '12',
    floor: '3', apartment_no: '5', full_address: composeFullAddress(f),
  } as Address;
  assert.equal(directionsFromFullAddress(addr), 'Zil çalışmıyor');
  assert.equal(directionsFromFullAddress({ ...addr, full_address: buildFullAddressAuto(FORM) }), '');
  assert.equal(directionsFromFullAddress({ ...addr, full_address: 'eski serbest metin' }), 'eski serbest metin');
  assert.equal(formFromAddress(addr, 'x@y.z').contact_email, 'x@y.z');
});

test('başlık çipi: Ev / İş / Diğer (serbest başlık korunur)', () => {
  assert.deepEqual(chipFromTitle('Ev'), { titleChip: 'home', customTitle: '' });
  assert.deepEqual(chipFromTitle('İŞ'), { titleChip: 'work', customTitle: '' });
  assert.deepEqual(chipFromTitle('Yazlık'), { titleChip: 'other', customTitle: 'Yazlık' });
  assert.equal(titleFromForm({ titleChip: 'other', customTitle: 'Yazlık' }), 'Yazlık');
  assert.equal(titleFromForm({ titleChip: 'other', customTitle: '' }), 'Diğer');
  assert.equal(titleFromForm({ titleChip: 'work', customTitle: 'x' }), 'İş');
  assert.deepEqual(splitName('  Ada  Nur Yılmaz '), { first: 'Ada', last: 'Nur Yılmaz' });
});

test('kart satırı + eksik kolon adı', () => {
  assert.equal(
    formatAddressLine({ street: 'Kıbrıs Şehitleri Cd.', building_no: '12', neighbourhood: 'Alsancak', district: 'Konak', full_address: 'x' }),
    'Kıbrıs Şehitleri Cd. 12, Alsancak, Konak',
  );
  assert.equal(formatAddressLine({ neighbourhood: null, district: '', full_address: 'Serbest' }), 'Serbest');
  assert.equal(getMissingColumnName('column "building_name" of relation "addresses" does not exist'), 'building_name');
  assert.equal(getMissingColumnName('permission denied'), '');
});

// ── Yazma işlemleri: sahte istemci (canlı DB'ye yazılmaz) ───────────────────
type Call = { table: string; op: string; args: unknown[] };
function fakeClient(responses: Array<{ data: unknown; error: unknown }>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const record = (op: string) => (...args: unknown[]) => {
        calls.push({ table, op, args: JSON.parse(JSON.stringify(args)) });
        return chain;
      };
      for (const op of ['insert', 'update', 'delete', 'select', 'eq', 'order', 'maybeSingle']) chain[op] = record(op);
      chain.single = (...args: unknown[]) => {
        calls.push({ table, op: 'single', args });
        return Promise.resolve(responses.shift() ?? { data: null, error: { message: 'no response' } });
      };
      chain.then = (resolve: (v: unknown) => unknown) => resolve(responses.shift() ?? { data: null, error: null });
      return chain;
    },
  };
  return { client, calls };
}

test('ekle: ilk adres varsayılan; eksik kolon düşürülüp tekrar denenir', async () => {
  const { client, calls } = fakeClient([
    { data: null, error: { message: 'column "building_name" does not exist' } },
    { data: { id: 'new1' }, error: null },
  ]);
  const payload = buildAddressPayload(FORM, 'u1', null);
  const res = await insertAddress(client, payload, true);
  assert.deepEqual(res.droppedColumns, ['building_name']);
  assert.equal(res.row.id, 'new1');
  const inserts = calls.filter((c) => c.op === 'insert');
  assert.equal(inserts.length, 2);
  const first = (inserts[0].args[0] as Record<string, unknown>[])[0];
  const second = (inserts[1].args[0] as Record<string, unknown>[])[0];
  assert.equal(first.is_default, true);
  assert.ok('building_name' in first);
  assert.ok(!('building_name' in second));
});

test('ekle: kolon dışı hata olduğu gibi fırlar', async () => {
  const { client } = fakeClient([{ data: null, error: { message: 'network down' } }]);
  await assert.rejects(insertAddress(client, buildAddressPayload(FORM, 'u1', null), false), { message: 'network down' });
});

test('güncelle: user_id payload dışında, filtre id + user_id', async () => {
  const { client, calls } = fakeClient([{ data: { id: 'a1' }, error: null }]);
  await updateAddress(client, buildAddressPayload(FORM, 'u1', null), 'a1', 'u1');
  const upd = calls.find((c) => c.op === 'update');
  assert.ok(!('user_id' in (upd?.args[0] as Record<string, unknown>)));
  const eqs = calls.filter((c) => c.op === 'eq').map((c) => c.args);
  assert.deepEqual(eqs, [['id', 'a1'], ['user_id', 'u1']]);
});

test('varsayılan yap: önce hepsi false, sonra seçilen true; sil: id + user_id', async () => {
  const { client, calls } = fakeClient([{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }]);
  await setDefaultAddress(client, 'a2', 'u1');
  const updates = calls.filter((c) => c.op === 'update').map((c) => c.args[0]);
  assert.deepEqual(updates, [{ is_default: false }, { is_default: true }]);
  await deleteAddress(client, 'a2', 'u1');
  assert.ok(calls.some((c) => c.op === 'delete' && c.table === 'addresses'));
});
