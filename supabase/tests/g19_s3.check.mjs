// G19-S3 — PGlite kontrolü: 20261109110000_g19_s3_event_names.sql
//   (a) D-S1 tablosu YOKKEN hata vermez (NOTICE, no-op)
//   (b) D-S1 sözlük bölümü + bu migration 2 kez → 38 + 14 = 52 ad, D-S1 açıklamaları değişmez
//   (c) alias hedefleri tabloda var, ad CHECK'i geçer
//   (d) rollback → yalnız 14 ad silinir (38 kalır), 2 kez çalışır
//
// Çalıştırma (PGlite pakete EKLENMEZ):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> \
//   D_S1_KPI=<night19/data'daki 20261109100300_d_s1_kpi.sql yolu> \
//     node supabase/tests/g19_s3.check.mjs
// D_S1_KPI için: git show night19/data:supabase/migrations/20261109100300_d_s1_kpi.sql > /tmp/d_s1_kpi.sql
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const pgliteEntry = join(process.env.PGLITE_DIR ?? '', 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js');
if (!existsSync(pgliteEntry)) throw new Error('PGLITE_DIR geçersiz: ' + pgliteEntry);
if (!process.env.D_S1_KPI || !existsSync(process.env.D_S1_KPI)) throw new Error('D_S1_KPI yolu yok');
const { PGlite } = await import(pathToFileURL(pgliteEntry).href);

const MIG = readFileSync(join(root, 'supabase/migrations/20261109110000_g19_s3_event_names.sql'), 'utf8');
const RB = readFileSync(join(root, 'supabase/rollbacks/20261109110000_g19_s3_event_names_rollback.sql'), 'utf8');
const ds1 = readFileSync(process.env.D_S1_KPI, 'utf8');
// D-S1'den yalnız "1) Olay sözlüğü" bölümü (tablo + CHECK + RLS + 38 ad).
const start = ds1.indexOf('-- ── 1) Olay sözlüğü');
const end = ds1.indexOf('-- ── 2) analytics_events');
if (start < 0 || end < 0) throw new Error('D-S1 sözlük bölümü bulunamadı');
const DS1_DICT = ds1.slice(start, end);

let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log('  ✓', name); } else { failures.push(name); console.log('  ✗', name, detail); }
};
const count = async (db) => (await db.query('select count(*)::int as n from public.analytics_event_names')).rows[0].n;

// (a) tablo yokken
{
  const db = new PGlite();
  let ok = true;
  try { await db.exec(MIG); } catch (e) { ok = false; console.log(e); }
  check('(a) D-S1 tablosu yokken migration hata vermez (no-op)', ok);
  try { await db.exec(RB); } catch { ok = false; }
  check('(a) D-S1 tablosu yokken rollback hata vermez', ok);
}

// (b)(c)(d)
{
  const db = new PGlite();
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;`);
  await db.exec(DS1_DICT);
  const base = await count(db);
  check('(b) D-S1 sözlüğü 38 ad', base === 38, `n=${base}`);
  const before = (await db.query(`select description_tr from public.analytics_event_names where name = 'onb_step'`)).rows[0].description_tr;

  await db.exec(MIG);
  await db.exec(MIG);
  const after = await count(db);
  check('(b) migration 2 kez → 52 ad (idempotent)', after === 52, `n=${after}`);
  const kept = (await db.query(`select description_tr from public.analytics_event_names where name = 'onb_step'`)).rows[0].description_tr;
  check('(b) D-S1 açıklamaları korunur (ON CONFLICT DO NOTHING)', kept === before, `${before} → ${kept}`);

  const dangling = (await db.query(`
    select n.name, n.alias_of from public.analytics_event_names n
     where n.alias_of is not null
       and not exists (select 1 from public.analytics_event_names t where t.name = n.alias_of)`)).rows;
  check('(c) alias hedeflerinin hepsi tabloda', dangling.length === 0, JSON.stringify(dangling));
  const fresh = (await db.query(`select name, alias_of from public.analytics_event_names where name in ('scan_capture','scan_fail','log_add','water_add','activity_add') order by name`)).rows;
  check('(c) yeni alias eşleşmeleri', JSON.stringify(fresh) === JSON.stringify([
    { name: 'activity_add', alias_of: 'log_activity' },
    { name: 'log_add', alias_of: 'log_meal' },
    { name: 'scan_capture', alias_of: 'scan_start' },
    { name: 'scan_fail', alias_of: 'scan_failed' },
    { name: 'water_add', alias_of: 'log_water' },
  ]), JSON.stringify(fresh));

  await db.exec(RB);
  await db.exec(RB);
  const rolled = await count(db);
  check('(d) rollback 2 kez → 38 ad (D-S1 adlarına dokunmaz)', rolled === 38, `n=${rolled}`);
}

console.log(failures.length ? `G19-S3 PGLITE: ${failures.length} HATA` : `G19-S3 PGLITE: TUM KONTROLLER GECTI (${passed})`);
process.exit(failures.length ? 1 : 0);
