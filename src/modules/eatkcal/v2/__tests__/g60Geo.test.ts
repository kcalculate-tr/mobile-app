// G60-S1 md.4 — eatkcal konum kapısı: yabancı ülkede arama boşken büyük şehirler (top_cities),
// veri yok → serbest yazım, hata → tekrar dene. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TOP_CITIES_LIMIT, fetchTopCities, filterTopCities, isMissingRpc, parseCityRows } from '../model/geo';

const row = (id: number, name: string, cc = 'DE', admin1?: string) => ({
  geonameid: id, name, ascii_name: name, country_iso2: cc, population: 1000 * id, lat: 0, lng: 0, admin1: admin1 ?? null,
});

test('fetchTopCities: satırlar → ok (admin1 alt satırı), istek top_cities(p_country, 30)', async () => {
  const calls: unknown[] = [];
  const rpc = async (fn: string, args: unknown) => {
    calls.push([fn, args]);
    return { data: [row(1, 'Berlin', 'DE', 'Berlin'), row(2, 'München', 'DE', 'Bavaria'), row(3, 'Hack', 'FR')], error: null };
  };
  const r = await fetchTopCities(rpc, 'de');
  assert.deepEqual(calls, [['top_cities', { p_country: 'DE', p_limit: TOP_CITIES_LIMIT }]]);
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') {
    assert.deepEqual(r.cities.map((c) => c.name), ['Berlin', 'München']); // başka ülke satırı atılır
    assert.equal(r.cities[0].admin1, undefined); // ad = eyalet → alt satır yok
    assert.equal(r.cities[1].admin1, 'Bavaria');
  }
});

test('fetchTopCities: 0 satır → nodata (serbest yazım); RPC yok → nodata; hata → error; Türkiye → nodata', async () => {
  assert.deepEqual(await fetchTopCities(async () => ({ data: [], error: null }), 'JP'), { status: 'nodata' });
  assert.deepEqual(
    await fetchTopCities(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.top_cities' } }), 'JP'),
    { status: 'nodata' },
  );
  assert.deepEqual(await fetchTopCities(async () => ({ data: null, error: { code: '500', message: 'boom' } }), 'JP'), { status: 'error' });
  assert.deepEqual(await fetchTopCities(async () => { throw new Error('ağ yok'); }, 'JP'), { status: 'error' });
  let called = false;
  assert.deepEqual(await fetchTopCities(async () => { called = true; return { data: [], error: null }; }, 'TR'), { status: 'nodata' });
  assert.equal(called, false);
  assert.deepEqual(await fetchTopCities(async () => ({ data: [], error: null }), ''), { status: 'nodata' });
});

test('parseCityRows: üst sınır parametresi (arama 20, büyük şehirler 30)', () => {
  const many = Array.from({ length: 40 }, (_, i) => row(i + 1, `C${i}`));
  assert.equal(parseCityRows(many).length, 20);
  assert.equal(parseCityRows(many, TOP_CITIES_LIMIT).length, 30);
});

test('filterTopCities: boş → hepsi; 1 harf → ad/eyalet başı, aksansız', () => {
  const list = parseCityRows([row(1, 'Berlin', 'DE', 'Berlin'), row(2, 'München', 'DE', 'Bavaria'), row(3, 'Hamburg', 'DE', 'Hamburg')]);
  assert.equal(filterTopCities(list, '').length, 3);
  assert.deepEqual(filterTopCities(list, 'm').map((c) => c.name), ['München']);
  assert.deepEqual(filterTopCities(list, 'b').map((c) => c.name), ['Berlin', 'München']); // Bavaria
  assert.deepEqual(filterTopCities(list, ' H ').map((c) => c.name), ['Hamburg']);
});

test('isMissingRpc', () => {
  assert.equal(isMissingRpc({ code: '42883' }), true);
  assert.equal(isMissingRpc({ message: 'function public.top_cities(text, integer) does not exist' }), true);
  assert.equal(isMissingRpc({ code: '57014', message: 'timeout' }), false);
  assert.equal(isMissingRpc(null), false);
});

test('migration: top_cities anon + authenticated, search_cities değişmedi', () => {
  const sql = readFileSync(join(__dirname, '../../../../../supabase/migrations/20261117230500_g60_top_cities.sql'), 'utf8');
  assert.match(sql, /grant execute on function public\.top_cities\(text, int\) to anon, authenticated;/);
  assert.match(sql, /order by c\.population desc, c\.geonameid/);
  assert.match(sql, /least\(greatest\(coalesce\(p_limit, 30\), 1\), 50\)/);
  assert.ok(!/function public\.search_cities/.test(sql));
});
