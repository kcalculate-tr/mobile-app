// G22-S2 md.3 — eatkcal konum (Avrupa + Amerika): saf mantık.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CITY_QUERY_MAX,
  CITY_RESULTS_MAX,
  filterCountries,
  findCountry,
  foldText,
  geoGateTarget,
  normalizeCityQuery,
  orderedCountries,
  parseCityRows,
  searchCities,
  trLocativeKi,
  typedCity,
  countryName,
} from '../model/geo';
import { GEO_COUNTRIES } from '../model/geoCountries';
import { translations } from '../../../../core/i18n/dictionaries';

const ROOT = path.resolve(__dirname, '../../../../..');

test('foldText: küçük harf + aksan katlama (SQL geo_fold ile aynı)', () => {
  assert.equal(foldText('München'), 'munchen');
  assert.equal(foldText('İzmir'), 'izmir');
  assert.equal(foldText('Kraków'), 'krakow');
  assert.equal(foldText('São Paulo'), 'sao paulo');
  assert.equal(foldText('Łódź'), 'lodz');
  assert.equal(foldText('Straße'), 'strasse');
  assert.equal(foldText('Ørsta'), 'orsta');
  assert.equal(foldText('ISTANBUL'), 'istanbul');
});

test('normalizeCityQuery: kırp, boşluk tekle, kısa → boş, üst sınır', () => {
  assert.equal(normalizeCityQuery('  new   york '), 'new york');
  assert.equal(normalizeCityQuery('b'), '');
  assert.equal(normalizeCityQuery('   '), '');
  assert.equal(normalizeCityQuery('be'), 'be');
  assert.equal(normalizeCityQuery('x'.repeat(200)).length, CITY_QUERY_MAX);
});

test('ülke listesi: Türkiye var (AS), diğerleri yalnız EU/NA/SA; her ülkenin TR ve EN adı var', () => {
  const tr = findCountry('TR');
  assert.ok(tr);
  assert.equal(tr!.continent, 'AS');
  assert.equal(tr!.tr, 'Türkiye');
  for (const c of GEO_COUNTRIES) {
    assert.match(c.iso2, /^[A-Z]{2}$/);
    assert.ok(c.tr.length > 0 && c.en.length > 0, c.iso2);
    if (c.iso2 !== 'TR') assert.ok(['EU', 'NA', 'SA'].includes(c.continent), c.iso2);
  }
  // Örnekler: Avrupa, Kuzey, Orta, Güney Amerika, Karayipler
  for (const iso of ['DE', 'FR', 'GB', 'US', 'CA', 'MX', 'GT', 'PA', 'BR', 'AR', 'CL', 'CU', 'JM']) {
    assert.ok(findCountry(iso), iso);
  }
  // Asya/Afrika/Okyanusya ülkeleri yok
  for (const iso of ['JP', 'CN', 'EG', 'AU', 'AE']) assert.equal(findCountry(iso), undefined, iso);
  assert.equal(new Set(GEO_COUNTRIES.map((c) => c.iso2)).size, GEO_COUNTRIES.length);
});

test('orderedCountries: Türkiye başta, kalan seçili dilde alfabetik', () => {
  const trList = orderedCountries('tr');
  assert.equal(trList[0].iso2, 'TR');
  assert.equal(trList.length, GEO_COUNTRIES.length);
  const rest = trList.slice(1).map((c) => countryName(c, 'tr'));
  assert.deepEqual(rest, rest.slice().sort((a, b) => a.localeCompare(b, 'tr')));
  const en = orderedCountries('en');
  assert.equal(en[0].iso2, 'TR');
  assert.equal(countryName(findCountry('DE')!, 'en'), 'Germany');
  assert.equal(countryName(findCountry('DE')!, 'tr'), 'Almanya');
});

test('filterCountries: TR/EN ad, aksansız, ISO kodu; ad başı önce', () => {
  const list = orderedCountries('tr');
  assert.equal(filterCountries(list, 'alman', 'tr')[0].iso2, 'DE');
  assert.equal(filterCountries(list, 'germany', 'tr')[0].iso2, 'DE');
  assert.equal(filterCountries(list, 'turkiye', 'tr')[0].iso2, 'TR');
  assert.equal(filterCountries(list, 'us', 'en')[0].iso2, 'US');
  assert.equal(filterCountries(list, 'zzzz', 'tr').length, 0);
  assert.equal(filterCountries(list, '', 'tr').length, list.length);
});

test('parseCityRows: bozuk satırları atar, en çok 20', () => {
  const rows = [
    { geonameid: 2950159, name: 'Berlin', ascii_name: 'Berlin', country_iso2: 'DE', population: 3426354 },
    { geonameid: 'x', name: 'Bad', country_iso2: 'DE' },
    { geonameid: 5, name: '', country_iso2: 'DE' },
    { geonameid: 6, name: 'NoCountry', country_iso2: 'germany' },
    null,
  ];
  assert.deepEqual(parseCityRows(rows), [{ geonameid: 2950159, name: 'Berlin', country: 'DE', population: 3426354 }]);
  assert.deepEqual(parseCityRows(null), []);
  const many = Array.from({ length: 30 }, (_, i) => ({ geonameid: i + 1, name: `C${i}`, country_iso2: 'US', population: 1 }));
  assert.equal(parseCityRows(many).length, CITY_RESULTS_MAX);
});

test('searchCities: ok / empty / error (RPC hatası, istisna) ve kısa sorguda RPC çağrılmaz', async () => {
  const calls: unknown[] = [];
  const ok = async (_fn: 'search_cities', args: { q: string; country: string | null }) => {
    calls.push(args);
    return { data: [{ geonameid: 1, name: 'Paris', country_iso2: 'FR', population: 2 }], error: null };
  };
  const r = await searchCities(ok, '  par ', 'FR');
  assert.equal(r.status, 'ok');
  assert.deepEqual(calls, [{ q: 'par', country: 'FR' }]);
  assert.equal((await searchCities(ok, 'p', 'FR')).status, 'empty');
  assert.equal(calls.length, 1);
  const none = async () => ({ data: [], error: null });
  assert.equal((await searchCities(none, 'xyz', null)).status, 'empty');
  const fail = async () => ({ data: null, error: { code: 'PGRST202' } });
  assert.equal((await searchCities(fail, 'xyz', null)).status, 'error');
  const boom = async () => {
    throw new Error('offline');
  };
  assert.equal((await searchCities(boom, 'xyz', null)).status, 'error');
});

test('typedCity: ağ yokken yazılan adla devam (kimliksiz)', () => {
  assert.deepEqual(typedCity('  Lyon ', 'FR'), { geonameid: 0, name: 'Lyon', country: 'FR', population: 0 });
  assert.equal(typedCity('L', 'FR'), null);
});

test('geoGateTarget: Türkiye il akışı AYNEN (İzmir sipariş, diğer il bekleme), diğer ülke şehir seçilince "soon"', () => {
  const berlin = { geonameid: 2950159, name: 'Berlin', country: 'DE', population: 1 };
  assert.equal(geoGateTarget('TR', 'İzmir', null), 'order');
  assert.equal(geoGateTarget('TR', 'Ankara', null), 'waitlist');
  assert.equal(geoGateTarget('TR', null, null), null);
  assert.equal(geoGateTarget('TR', null, berlin), null); // TR'de yabancı şehir sayılmaz
  assert.equal(geoGateTarget('DE', null, null), null);
  assert.equal(geoGateTarget('DE', null, berlin), 'soon');
  // Yabancı "Izmir" adı sipariş açmaz
  assert.equal(geoGateTarget('US', null, { geonameid: 0, name: 'İzmir', country: 'US', population: 0 }), 'soon');
});

test("trLocativeKi: ünlü uyumu + sert ünsüz (Berlin'deki, Paris'teki, Roma'daki, New York'taki)", () => {
  assert.equal(trLocativeKi('Berlin'), "Berlin'deki");
  assert.equal(trLocativeKi('Paris'), "Paris'teki");
  assert.equal(trLocativeKi('Roma'), "Roma'daki");
  assert.equal(trLocativeKi('New York'), "New York'taki");
  assert.equal(trLocativeKi('Lyon'), "Lyon'daki");
  assert.equal(trLocativeKi('Montréal'), "Montréal'daki"); // yazıma göre (son ünlü a)
  assert.equal(trLocativeKi('München'), "München'deki");
  assert.equal(trLocativeKi('Madrid'), "Madrid'deki");
  assert.equal(trLocativeKi('Bogotá'), "Bogotá'daki");
  assert.equal(trLocativeKi('Helsinki'), "Helsinki'deki");
  assert.equal(trLocativeKi('Utrecht'), "Utrecht'teki");
});

test('mesaj metni: TR "Çok yakında X\'deki restoranlar burada listelenecek." / EN; ₺ yok', () => {
  const tr = (translations.tr as any).eatkcal.v2.geo;
  const en = (translations.en as any).eatkcal.v2.geo;
  const fill = (s: string, v: Record<string, string>) => s.replace(/%\{(\w+)\}/g, (_m, k) => v[k]);
  assert.equal(
    fill(tr.soon_city, { city: 'Berlin', city_ki: trLocativeKi('Berlin') }),
    "Çok yakında Berlin'deki restoranlar burada listelenecek.",
  );
  assert.equal(fill(en.soon_city, { city: 'Berlin', city_ki: '' }), 'Restaurants in Berlin will be listed here soon.');
  assert.equal(tr.attribution, 'Şehir verisi: GeoNames (CC BY 4.0)');
  assert.equal(en.attribution, 'City data: GeoNames (CC BY 4.0)');
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  assert.ok(!JSON.stringify({ tr, en }).includes('₺'));
});

test('CityGateView: şehir arama listesinde "Çok yakında" yazılmaz (yalnız TR il satırları)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/modules/eatkcal/v2/ui/gate/CityGateView.tsx'), 'utf8');
  const start = src.indexOf('testID="ek-gate-city-list"');
  const end = src.indexOf('</ScrollView>', start);
  assert.ok(start > 0 && end > start);
  assert.ok(!src.slice(start, end).includes("gate.soon'"));
});

test('migration + rollback + seed dosyaları: RLS, salt okuma politikası, RPC izinleri, ON CONFLICT', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261110100100_g22_s2_geo.sql'), 'utf8');
  assert.match(mig, /create extension if not exists pg_trgm with schema extensions/);
  assert.match(mig, /alter table public\.geo_countries enable row level security/);
  assert.match(mig, /alter table public\.geo_cities enable row level security/);
  assert.match(mig, /for select to anon, authenticated using \(true\)/);
  assert.match(mig, /create or replace function public\.search_cities\(q text, country text default null\)/);
  assert.match(mig, /security invoker\s+set search_path = public, extensions/);
  assert.match(mig, /grant execute on function public\.search_cities\(text, text\) to anon, authenticated/);
  assert.match(mig, /limit 20;/);
  // SQL ve istemci aksan katlama kümeleri aynı
  const from = mig.match(/'(áàâ[^']+)'/)![1];
  const to = mig.match(/'(a{9}c{3}d{2}[^']+)'/)![1];
  assert.equal(Array.from(from).length, Array.from(to).length);
  Array.from(from).forEach((ch, i) => assert.equal(foldText(ch), Array.from(to)[i], ch));
  assert.ok(!fs.existsSync(path.join(ROOT, 'supabase/migrations/20261110100100_g22_s2_geo_rollback.sql')));
  const rb = fs.readFileSync(path.join(ROOT, 'supabase/rollbacks/20261110100100_g22_s2_geo_rollback.sql'), 'utf8');
  assert.match(rb, /drop function if exists public\.search_cities\(text, text\)/);
  assert.match(rb, /drop table if exists public\.geo_cities/);
  const seedC = fs.readFileSync(path.join(ROOT, 'supabase/seed/geo_countries.sql'), 'utf8');
  assert.match(seedC, /on conflict \(iso2\) do nothing/);
  // seed ülke kümesi = istemci ülke kümesi
  const seedIsos = [...seedC.matchAll(/^\s+\('([A-Z]{2})', /gm)].map((m) => m[1]).sort();
  assert.deepEqual(seedIsos, GEO_COUNTRIES.map((c) => c.iso2).sort());
  const seedX = fs.readFileSync(path.join(ROOT, 'supabase/seed/geo_cities.sql'), 'utf8');
  assert.match(seedX, /on conflict \(geonameid\) do nothing/);
  assert.match(seedX, /\(2950159, 'Berlin', 'Berlin', 'DE', \d+, /);
  assert.ok(!/, 'TR', \d+, /.test(seedX), 'TR şehirleri seed edilmez (il/ilçe akışı)');
});
