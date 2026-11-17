// G60-S1 md.4 — geo_cities TAMAMLAMA tohumu: canlıda şehri olmayan ülkeler için GeoNames cities15000.
//
// Neden: geo_cities 17 Kas'ta 14.327 şehir / 107 ülke (yalnız EU/NA/SA; ör. JP, AE hiç yok).
// Bu betik eksik ülkelerin ülke + şehir (admin1 dâhil) satırlarını İDEMPOTENT bir SQL dosyasına yazar.
// Canlıya yükleme İlter'de (psql). Bu betik ağdan bir şey indirmez, DB'ye bağlanmaz.
//
// Kullanım (dosyalar https://download.geonames.org/export/dump/ — CC BY 4.0):
//   node scripts/geo/build-missing-cities-seed.mjs \
//     --cities cities15000.txt --countries countryInfo.txt --admin1 admin1CodesASCII.txt \
//     [--have have.txt] [--exclude RU,BY] [--continents EU,NA,SA,AS,AF,OC] \
//     [--out supabase/seed/geo_cities_missing.sql] [--client-out /tmp/geoCountries.next.ts]
//
//   --have     : canlıda şehri OLAN ülke kodları (satır başına bir ISO2). Üretmek için:
//                psql "$DB_URL" -At -c "select distinct country_iso2 from public.geo_cities order by 1" > have.txt
//                Verilmezse supabase/seed/geo_cities.sql içindeki ülkeler kullanılır.
//   --exclude  : hiç eklenmeyecek ülkeler (varsayılan RU,BY — G23-S1 İlter kararı).
//   --client-out: istemci ülke listesi önerisi (TR adları Intl.DisplayNames 'tr'); İNCELEME içindir,
//                src/modules/eatkcal/v2/model/geoCountries.ts'e elle/onayla kopyalanır (SORULAR).
//
// Çıktı SQL: begin; geo_countries INSERT … ON CONFLICT DO NOTHING; geo_cities INSERT … ON CONFLICT DO NOTHING; commit;
// Önkoşul: 20261110100100_g22_s2_geo.sql + 20261110190100_g23_geo_admin1.sql (admin1 kolonu).
import fs from 'node:fs';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const citiesPath = arg('cities');
const countriesPath = arg('countries');
const admin1Path = arg('admin1');
if (!citiesPath || !countriesPath || !admin1Path) {
  console.error('kullanım: build-missing-cities-seed.mjs --cities cities15000.txt --countries countryInfo.txt --admin1 admin1CodesASCII.txt [--have have.txt] [--out …]');
  process.exit(1);
}
const outPath = arg('out', 'supabase/seed/geo_cities_missing.sql');
const clientOut = arg('client-out');
const exclude = new Set((arg('exclude', 'RU,BY') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
const continents = new Set((arg('continents', 'EU,NA,SA,AS,AF,OC') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));

// Canlıda şehri olan ülkeler
const have = new Set();
const havePath = arg('have');
if (havePath) {
  for (const l of fs.readFileSync(havePath, 'utf8').split('\n')) if (/^[A-Z]{2}$/.test(l.trim())) have.add(l.trim());
} else {
  const seed = fs.readFileSync('supabase/seed/geo_cities.sql', 'utf8');
  for (const m of seed.matchAll(/^\s+\(\d+, '(?:[^']|'')*', '(?:[^']|'')*', '([A-Z]{2})'/gm)) have.add(m[1]);
}
have.add('TR'); // Türkiye il/ilçe akışında kalır (geo_cities'e şehir yazılmaz)

// countryInfo: ISO, ISO3, ISO-Numeric, fips, Country, Capital, Area, Population, Continent, …
const countries = new Map();
for (const line of fs.readFileSync(countriesPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  const iso2 = f[0];
  if (!/^[A-Z]{2}$/.test(iso2)) continue;
  countries.set(iso2, { iso2, en: f[4], continent: f[8] });
}

const admin1 = new Map();
for (const line of fs.readFileSync(admin1Path, 'utf8').split('\n')) {
  const [code, name] = line.split('\t');
  if (code && name) admin1.set(code, name.trim());
}

// G22-S2 ile aynı yerleşim süzgeci (PPLX semt/bölüm, tarihî/terk edilmiş hariç).
const FEATURE_OK = /^(PPL|PPLA\d?|PPLC|PPLG|PPLS|PPLL|PPLF|PPLR)$/;
const rows = [];
const perCountry = new Map();
for (const line of fs.readFileSync(citiesPath, 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f.length < 15) continue;
  const id = Number(f[0]);
  const cc = f[8];
  const c = countries.get(cc);
  if (!c || have.has(cc) || exclude.has(cc) || !continents.has(c.continent)) continue;
  if (!FEATURE_OK.test(f[7])) continue;
  const name = (f[1] || '').trim().slice(0, 200);
  const ascii = ((f[2] || '').trim() || name).slice(0, 200);
  const lat = Number(f[4]);
  const lng = Number(f[5]);
  const pop = Math.max(0, Math.trunc(Number(f[14]) || 0));
  if (!Number.isInteger(id) || id <= 0 || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const a1 = f[10] ? admin1.get(`${cc}.${f[10]}`) : undefined;
  rows.push({ id, name, ascii, cc, pop, lat, lng, a1: a1 ? a1.slice(0, 200) : null });
  perCountry.set(cc, (perCountry.get(cc) || 0) + 1);
}
rows.sort((a, b) => a.cc.localeCompare(b.cc) || b.pop - a.pop || a.id - b.id);

const trNames = new Intl.DisplayNames(['tr'], { type: 'region' });
const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const newCountries = [...perCountry.keys()].sort().map((cc) => {
  const c = countries.get(cc);
  const tr = trNames.of(cc) || c.en;
  const en = enNames.of(cc) || c.en;
  return { iso2: cc, tr: tr.slice(0, 120), en: en.slice(0, 120), continent: c.continent };
});

const out = [
  '-- G60-S1 md.4 — geo_cities TAMAMLAMA (canlıda şehri olmayan ülkeler).',
  '-- Kaynak: GeoNames cities15000 + countryInfo + admin1CodesASCII (https://www.geonames.org/, CC BY 4.0).',
  '-- ÜRETİLDİ — scripts/geo/build-missing-cities-seed.mjs; elle düzenleme. İdempotent (ON CONFLICT DO NOTHING).',
  '-- ÖNKOŞUL: 20261110100100_g22_s2_geo.sql + 20261110190100_g23_geo_admin1.sql.',
  `-- ${newCountries.length} ülke, ${rows.length} şehir. Hariç: ${[...exclude].join(', ') || '—'}.`,
  'begin;',
];
if (newCountries.length) {
  out.push('insert into public.geo_countries (iso2, name_tr, name_en, continent) values');
  out.push(newCountries.map((c) => `  (${q(c.iso2)}, ${q(c.tr)}, ${q(c.en)}, ${q(c.continent)})`).join(',\n') + '\non conflict (iso2) do nothing;');
}
const CHUNK = 1000;
for (let i = 0; i < rows.length; i += CHUNK) {
  out.push('insert into public.geo_cities (geonameid, name, ascii_name, country_iso2, population, lat, lng, admin1) values');
  out.push(
    rows
      .slice(i, i + CHUNK)
      .map((r) => `  (${r.id}, ${q(r.name)}, ${q(r.ascii)}, ${q(r.cc)}, ${r.pop}, ${r.lat}, ${r.lng}, ${q(r.a1)})`)
      .join(',\n') + '\non conflict (geonameid) do nothing;',
  );
}
out.push('commit;', '');
fs.writeFileSync(outPath, out.join('\n'));
console.log(`yazıldı: ${outPath} · ${newCountries.length} ülke · ${rows.length} şehir`);
for (const c of newCountries) console.log(`  ${c.iso2}  ${c.tr} / ${c.en}  (${c.continent})  ${perCountry.get(c.iso2)} şehir`);

if (clientOut) {
  const mod = fs.readFileSync('src/modules/eatkcal/v2/model/geoCountries.ts', 'utf8');
  const existing = [...mod.matchAll(/\{ iso2: "([A-Z]{2})", tr: "([^"]*)", en: "([^"]*)", continent: "([A-Z]{2})" \}/g)].map((m) => ({
    iso2: m[1], tr: m[2], en: m[3], continent: m[4],
  }));
  const all = [...existing.filter((c) => !perCountry.has(c.iso2)), ...newCountries].sort((a, b) => a.iso2.localeCompare(b.iso2));
  const lines = all.map((c) => `  { iso2: ${JSON.stringify(c.iso2)}, tr: ${JSON.stringify(c.tr)}, en: ${JSON.stringify(c.en)}, continent: ${JSON.stringify(c.continent)} },`);
  fs.writeFileSync(clientOut, `// ÖNERİ (G60-S1): geoCountries.ts için genişletilmiş liste — incele, onaylanırsa kopyala.\n// GeoContinent tipine 'AF' | 'OC' eklenmeli.\nexport const GEO_COUNTRIES_NEXT = [\n${lines.join('\n')}\n] as const;\n`);
  console.log(`istemci önerisi: ${clientOut} · ${all.length} ülke`);
}
