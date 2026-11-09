// G19-S1 — PGlite kontrolü: 20261109190100_g19_ai_scan_hardening (2 kez + rollback + yeniden)
// ve reserve_ai_scan davranışı (önbellek, gece yarısı, idempotency, sahiplik, kota).
//
// Çalıştırma (PGlite pakete EKLENMEZ):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> node supabase/tests/g19_s1.check.mjs
// Başarı: "G19-S1 PGLITE: TUM KONTROLLER GECTI" ve çıkış kodu 0.
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
const MIG = 'supabase/migrations/20261109190100_g19_ai_scan_hardening.sql';
const RB = 'supabase/rollbacks/20261109190100_g19_ai_scan_hardening_rollback.sql';

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

// Asgari Supabase ortamı: auth.users, auth.uid() (request.jwt.claim.sub), roller.
const BASE = `
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

// release_ai_scan: g5_rpcs içinden yalnız bu fonksiyon.
function extractFn(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3;
  return sql.slice(start, end);
}

const db = new PGlite();
await db.exec(BASE);
await db.exec(read('supabase/migrations/20261104000600_ai_scan_quota.sql'));
// g6_fixes §9: 'consumed' durumu (yalnız CHECK).
await db.exec(`
  alter table public.ai_scan_reservations drop constraint if exists ai_scan_reservations_status_check;
  alter table public.ai_scan_reservations add constraint ai_scan_reservations_status_check
    check (status in ('reserved', 'released', 'consumed'));`);
await db.exec(extractFn(read('supabase/migrations/20261104000800_g5_rpcs.sql'), 'release_ai_scan') + ';');
// D-S1 olay sözlüğü (varsa bloğu sınamak için asgari tablo).
await db.exec(`create table public.analytics_event_names (
  name text primary key, category text not null, source text not null default 'client',
  description_tr text not null, description_en text not null, props_hint text, alias_of text,
  is_kpi boolean not null default false);
  insert into public.analytics_event_names values
   ('scan_start','tracking','client','x','x',null,null,false),
   ('scan_success','tracking','client','x','x','kcal',null,true),
   ('scan_failed','tracking','client','x','x','reason',null,false);`);

console.log('migration 2 kez + rollback + yeniden:');
await db.exec(read(MIG));
await db.exec(read(MIG));
await db.exec(read(RB));
const cols0 = await db.query(`select column_name from information_schema.columns
  where table_name='ai_scan_reservations' and column_name in ('result','attempts','last_attempt_at')`);
check('rollback sütunları kaldırır', cols0.rows.length === 0);
await db.exec(read(MIG));
const cols = await db.query(`select column_name from information_schema.columns
  where table_name='ai_scan_reservations' and column_name in ('result','attempts','last_attempt_at')`);
check('3 yeni sütun var', cols.rows.length === 3);
const ev = await db.query(`select name, props_hint from public.analytics_event_names order by name`);
const evMap = Object.fromEntries(ev.rows.map((r) => [r.name, r.props_hint]));
check('sözlüğe scan_open + scan_limit eklendi', 'scan_open' in evMap && 'scan_limit' in evMap);
check('scan_success props_hint güncellendi', evMap.scan_success === 'n_items, kcal, cached');
const st = await db.query(`select key, value from public.app_settings where key like 'ai_scan_%' order by key`);
check('ayarlar: per_minute=4, max_key_attempts=4', JSON.stringify(st.rows.map((r) => [r.key, r.value])).includes('"ai_scan_per_minute",4'));

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
const as = (uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
const reserve = async (k) => (await db.query(`select public.reserve_ai_scan($1) as r`, [k])).rows[0].r;
const used = async (uid, dayExpr = `(now() at time zone 'Europe/Istanbul')::date`) =>
  (await db.query(`select coalesce((select used from public.ai_scan_usage where user_id=$1 and day=${dayExpr}),0) as u`, [uid])).rows[0].u;

console.log('reserve_ai_scan davranışı:');
await as(U1);
let r = await reserve('k1');
check('ilk rezervasyon ok, kalan 2', r.ok === true && r.remaining === 2 && !r.cached);
r = await reserve('k1');
check('aynı anahtar (reserved, bugün) tekrar saymaz', r.ok && r.remaining === 2 && (await used(U1)) === 1);

await db.exec(`update public.ai_scan_reservations set status='consumed', result='{"items":[],"total":{"kcal":1},"lang":"tr"}' where idempotency_key='k1'`);
r = await reserve('k1');
check('TÜKETİLMİŞ + sonuç: cached, hak DÜŞMEZ (eski hata: ikinci kez düşüyordu)', r.ok && r.cached === true && (await used(U1)) === 1);
const k1 = (await db.query(`select status, result from public.ai_scan_reservations where idempotency_key='k1'`)).rows[0];
check('önbellek satırı bozulmaz', k1.status === 'consumed' && k1.result.total.kcal === 1);

await db.exec(`update public.ai_scan_reservations set result=null where idempotency_key='k1'`);
r = await reserve('k1');
check('sonuçsuz eski "consumed" (migration öncesi) → yeniden ayrılır, hak düşer', r.ok && !r.cached && (await used(U1)) === 2);

// Gece yarısı: dün ayrılmış anahtar.
const Y = `((now() at time zone 'Europe/Istanbul')::date - 1)`;
await db.exec(`insert into public.ai_scan_usage (user_id, day, used) values ('${U1}', ${Y}, 1)`);
await db.exec(`insert into public.ai_scan_reservations (idempotency_key, user_id, day, status) values ('k2', '${U1}', ${Y}, 'reserved')`);
r = await reserve('k2');
const k2 = (await db.query(`select status, day = (now() at time zone 'Europe/Istanbul')::date as today from public.ai_scan_reservations where idempotency_key='k2'`)).rows[0];
check('dünden kalan anahtar BUGÜNE taşınır (eski hata: sonsuza dek expired)', r.ok && k2.status === 'reserved' && k2.today === true);
check('dünkü sayaç iade edildi', (await used(U1, Y)) === 0);
check('bugünkü sayaç +1', (await used(U1)) === 3);

// İade edilmiş anahtar yeniden ayrılır (Tekrar dene).
await db.exec(`select public.release_ai_scan('k2')`);
check('release → sayaç 2', (await used(U1)) === 2);
r = await reserve('k2');
check('released anahtar yeniden ayrılır (net 1 hak)', r.ok && (await used(U1)) === 3);

r = await reserve('k3');
check('kota dolu → ok:false, kalan 0', r.ok === false && r.remaining === 0);

await as(U2);
let threw = false;
try {
  await reserve('k1');
} catch (e) {
  threw = /baskasinin_anahtari/.test(String(e.message));
}
check('başkasının anahtarı → hata (G10 korunur)', threw);
r = await reserve('u2-a');
check('U2 kendi kotası bağımsız', r.ok && r.remaining === 2);

// Negatif kontrol: rollback (G10 RPC) ile hata GERÇEKTEN vardı.
console.log('negatif kontrol (eski RPC):');
await db.exec(read(RB));
await as(U2);
await db.exec(`update public.ai_scan_reservations set status='consumed' where idempotency_key='u2-a'`);
const before = await used(U2);
await reserve('u2-a');
check('eski RPC tüketilmiş anahtarda hakkı İKİNCİ kez düşürüyordu', (await used(U2)) === before + 1);
await db.exec(`insert into public.ai_scan_reservations (idempotency_key, user_id, day, status) values ('old', '${U2}', ${Y}, 'released')`);
await reserve('old');
const oldDay = (await db.query(`select day = (now() at time zone 'Europe/Istanbul')::date as today from public.ai_scan_reservations where idempotency_key='old'`)).rows[0];
check('eski RPC yeniden ayrılan anahtarın gününü güncellemiyordu (→ expired döngüsü)', oldDay.today === false);

console.log(`\n${passed} geçti, ${failures.length} kaldı`);
if (failures.length) {
  console.log('KALANLAR:', failures.join(' | '));
  process.exit(1);
}
console.log('G19-S1 PGLITE: TUM KONTROLLER GECTI');
