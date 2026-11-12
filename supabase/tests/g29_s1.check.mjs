// G29-S1 — PGlite kontrolü: 20261111233100_g29_sticker_path (2 kez + rollback + yeniden) ve
// sahiplik CHECK'i (yol yalnız sahibinin <uid>/stickers/ klasöründe).
//
// Çalıştırma (PGlite pakete EKLENMEZ):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> node supabase/tests/g29_s1.check.mjs
// Başarı: "G29-S1 PGLITE: TUM KONTROLLER GECTI" ve çıkış kodu 0.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function findPglite() {
  const dirs = [process.env.PGLITE_DIR, join(homedir(), 'dev', 'kcal-web')].filter(Boolean);
  for (const d of dirs) {
    const p = join(d, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js');
    if (existsSync(p)) return p;
  }
  throw new Error('PGlite bulunamadı. PGLITE_DIR ver. Denenen: ' + dirs.join(', '));
}
const { PGlite } = await import(pathToFileURL(findPglite()).href);

const read = (p) => readFileSync(join(root, p), 'utf8');
const MIG = 'supabase/migrations/20261111233100_g29_sticker_path.sql';
const RB = 'supabase/rollbacks/20261111233100_g29_sticker_path_rollback.sql';

let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log('  ✓', name);
  } else {
    failures.push(name);
    console.log('  ✗', name, detail);
  }
}

// Canlı şema (CANLI_SEMA_2026-11-09) meal_consumptions sütunları.
const BASE = `
create table public.meal_consumptions (
  id uuid primary key, user_id uuid not null, source text not null, source_ref text,
  name text not null, meal_type text, calories int4 not null, protein numeric not null default 0,
  carbs numeric not null default 0, fat numeric not null default 0, note text,
  consumed_at timestamptz not null default now(), created_at timestamptz not null default now(),
  photo_path text);
`;
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const R1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const db = new PGlite();
await db.exec(BASE);
await db.exec(`insert into public.meal_consumptions (id, user_id, source, name, calories, photo_path)
  values ('${R1}', '${U1}', 'ai_scan', 'Tavuk kinoa bowl', 540, '${U1}/scans/k.jpg')`);

async function cols() {
  const r = await db.query(`select column_name from information_schema.columns where table_name = 'meal_consumptions'`);
  return r.rows.map((x) => x.column_name);
}
async function tryUpdate(path) {
  try {
    await db.query(`update public.meal_consumptions set sticker_path = $1 where id = '${R1}'`, [path]);
    return true;
  } catch {
    return false;
  }
}

await db.exec(read(MIG));
await db.exec(read(MIG)); // idempotent
check('sticker_path sütunu eklendi (2 kez uygulandı)', (await cols()).includes('sticker_path'));
check('mevcut satır bozulmadı (sticker_path boş)', (await db.query(`select sticker_path from public.meal_consumptions`)).rows[0].sticker_path === null);
check('sahibinin yolu kabul', await tryUpdate(`${U1}/stickers/${R1}.webp`));
check('PNG yedeği kabul', await tryUpdate(`${U1}/stickers/${R1}.png`));
check('null kabul', await tryUpdate(null));
check('başka kullanıcının klasörü RED', !(await tryUpdate(`${U2}/stickers/${R1}.webp`)));
check('stickers dışı klasör RED', !(await tryUpdate(`${U1}/scans/${R1}.webp`)));
check('".." RED', !(await tryUpdate(`${U1}/stickers/../x.webp`)));
check('çok uzun yol RED', !(await tryUpdate(`${U1}/stickers/${'x'.repeat(220)}.webp`)));
const c = await db.query(`select count(*)::int as n from pg_constraint where conname = 'meal_consumptions_sticker_path_owner'`);
check('CHECK tek kez (idempotent)', c.rows[0].n === 1);

await db.exec(read(RB));
check('rollback: sütun kalktı', !(await cols()).includes('sticker_path'));
check('rollback: photo_path duruyor', (await cols()).includes('photo_path'));
await db.exec(read(MIG));
check('rollback sonrası yeniden uygulanır', (await cols()).includes('sticker_path') && (await tryUpdate(`${U1}/stickers/${R1}.webp`)));

console.log(`\n${passed} geçti, ${failures.length} kaldı`);
if (failures.length) {
  console.log('KALANLAR:', failures.join(' | '));
  process.exit(1);
}
console.log('G29-S1 PGLITE: TUM KONTROLLER GECTI');
