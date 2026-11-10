// G23-S1 — geo_cities.admin1 (eyalet/bölge adı) güncelleme tohumu üretici.
// Kullanım: node scripts/geo/build-admin1-seed.mjs <cities15000.txt> <admin1CodesASCII.txt>
//   (GeoNames dump: https://download.geonames.org/export/dump/, CC BY 4.0)
// Girdi şehir kümesi: supabase/seed/geo_cities.sql (geonameid'ler). Çıktı:
// supabase/seed/geo_cities_admin1.sql (UPDATE … FROM VALUES, idempotent).
import fs from 'node:fs';

const [citiesPath, admin1Path] = process.argv.slice(2);
if (!citiesPath || !admin1Path) {
  console.error('kullanım: build-admin1-seed.mjs <cities15000.txt> <admin1CodesASCII.txt>');
  process.exit(1);
}
const seed = fs.readFileSync('supabase/seed/geo_cities.sql', 'utf8');
const ids = new Set([...seed.matchAll(/^\s+\((\d+), /gm)].map((m) => Number(m[1])));

const admin1 = new Map();
for (const line of fs.readFileSync(admin1Path, 'utf8').split('\n')) {
  const [code, name] = line.split('\t');
  if (code && name) admin1.set(code, name.trim());
}

const rows = [];
for (const line of fs.readFileSync(citiesPath, 'utf8').split('\n')) {
  const f = line.split('\t');
  const id = Number(f[0]);
  if (!ids.has(id)) continue;
  const cc = f[8];
  const a1 = f[10];
  const name = a1 ? admin1.get(`${cc}.${a1}`) : undefined;
  if (!name) continue;
  rows.push([id, name.slice(0, 200)]);
}
rows.sort((a, b) => a[0] - b[0]);
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const out = [
  '-- G23-S1 — geo_cities.admin1 (eyalet / bölge adı; aynı adlı şehirleri ayırt etmek için).',
  '-- Kaynak: GeoNames cities15000 + admin1CodesASCII (https://www.geonames.org/, CC BY 4.0).',
  '-- ÖNKOŞUL: 20261110190100_g23_geo_admin1.sql + supabase/seed/geo_cities.sql.',
  '-- İdempotent (yalnız UPDATE). ÜRETİLDİ — scripts/geo/build-admin1-seed.mjs; elle düzenleme.',
  `-- ${rows.length} / ${ids.size} şehir admin1 adı taşır (eşleşmeyenler NULL kalır).`,
  'begin;',
  'update public.geo_cities c set admin1 = v.admin1',
  'from (values',
  rows.map(([id, n]) => `  (${id}, ${q(n)})`).join(',\n'),
  ') as v (geonameid, admin1)',
  'where c.geonameid = v.geonameid and c.admin1 is distinct from v.admin1;',
  'commit;',
  '',
].join('\n');
fs.writeFileSync('supabase/seed/geo_cities_admin1.sql', out);
console.log(`admin1: ${rows.length} / ${ids.size}`);
