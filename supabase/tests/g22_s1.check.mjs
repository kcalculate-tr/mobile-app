// G22-S1 — PGlite kontrolü: 20261110100100_g22_s1_subscriptions + 20261110100200_g22_s1_restaurant_rating
// (2 kez + rollback + yeniden) ve davranış: kademeli AI hakkı (free 2 · fresh 15 · balance 100
// adil kullanım), G19 korumaları (önbellek/idempotency/kapatma/tavan), barkod sayacı (free 5,
// ücretli sınırsız, aynı kod tekrar saymaz), my_entitlement, RLS yazma yasağı, restoran puanı.
//
// Çalıştırma (PGlite pakete EKLENMEZ):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> node supabase/tests/g22_s1.check.mjs
// Başarı: "G22-S1 PGLITE: TUM KONTROLLER GECTI" ve çıkış kodu 0.
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

const MIG = 'supabase/migrations/20261110100100_g22_s1_subscriptions.sql';
const RB = 'supabase/rollbacks/20261110100100_g22_s1_subscriptions_rollback.sql';
const MIG_R = 'supabase/migrations/20261110100200_g22_s1_restaurant_rating.sql';
const RB_R = 'supabase/rollbacks/20261110100200_g22_s1_restaurant_rating_rollback.sql';

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

const BASE = `
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.feature_flags (
  key text primary key, enabled boolean not null default false,
  rollout_percent integer not null default 0, min_app_version text, platforms text[],
  description text, updated_at timestamptz not null default now());
create table public.analytics_event_names (
  name text primary key, category text not null, source text not null default 'client',
  description_tr text not null, description_en text not null, props_hint text, alias_of text,
  is_kpi boolean not null default false);
create table public.orders (id bigint primary key, branch_id uuid);
create table public.reviews (id bigint generated always as identity primary key, order_id integer not null,
  user_id uuid not null, rating smallint not null, comment text, is_approved boolean not null default false,
  created_at timestamptz not null default now());
`;

function extractFn(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start)) + 3;
  return sql.slice(start, end);
}

const db = new PGlite();
await db.exec(BASE);
await db.exec(read('supabase/migrations/20261104000600_ai_scan_quota.sql'));
await db.exec(`
  alter table public.ai_scan_reservations drop constraint if exists ai_scan_reservations_status_check;
  alter table public.ai_scan_reservations add constraint ai_scan_reservations_status_check
    check (status in ('reserved', 'released', 'consumed'));`);
await db.exec(extractFn(read('supabase/migrations/20261104000800_g5_rpcs.sql'), 'release_ai_scan') + ';');
await db.exec(read('supabase/migrations/20261109190100_g19_ai_scan_hardening.sql'));

console.log('migration 2 kez + rollback + yeniden:');
await db.exec(read(MIG));
await db.exec(read(MIG));
await db.exec(read(MIG_R));
await db.exec(read(MIG_R));
await db.exec(read(RB));
await db.exec(read(RB_R));
const t0 = await db.query(`select to_regclass('public.user_entitlements') as e, to_regclass('public.barcode_scan_usage') as b`);
check('rollback tabloları kaldırır', t0.rows[0].e === null && t0.rows[0].b === null);
const f0 = await db.query(`select count(*)::int as n from pg_proc where proname in ('my_entitlement','reserve_barcode_scan','restaurant_rating','_entitlement_tier')`);
check('rollback fonksiyonları kaldırır', f0.rows[0].n === 0);
await db.exec(read(MIG));
await db.exec(read(MIG_R));

const st = await db.query(`select key, value from public.app_settings where key in ('ai_daily_free','ai_daily_fresh','ai_daily_balance','barcode_daily_free') order by key`);
const stMap = Object.fromEntries(st.rows.map((r) => [r.key, r.value]));
check('ayarlar: free 2 · fresh 15 · balance 100 · barkod 5',
  stMap.ai_daily_free === 2 && stMap.ai_daily_fresh === 15 && stMap.ai_daily_balance === 100 && stMap.barcode_daily_free === 5);
const flag = (await db.query(`select enabled, min_app_version from public.feature_flags where key='abonelik'`)).rows[0];
check("bayrak 'abonelik' kapalı", flag && flag.enabled === false && flag.min_app_version === '1.2.0');
const ev = await db.query(`select count(*)::int as n from public.analytics_event_names where name in ('voice_start','paywall_view','barcode_limit')`);
check('olay adları eklendi', ev.rows[0].n === 3);

const U1 = '11111111-1111-1111-1111-111111111111'; // free
const U2 = '22222222-2222-2222-2222-222222222222'; // fresh
const U3 = '33333333-3333-3333-3333-333333333333'; // balance
const U4 = '44444444-4444-4444-4444-444444444444'; // süresi geçmiş fresh
await db.exec(`insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}'), ('${U4}')`);
await db.exec(`insert into public.user_entitlements (user_id, tier, product_id, expires_at, store) values
  ('${U2}', 'fresh', 'kcalai_fresh_monthly', now() + interval '20 days', 'APP_STORE'),
  ('${U3}', 'balance', 'kcalai_balance_yearly', now() + interval '300 days', 'PLAY_STORE'),
  ('${U4}', 'fresh', 'kcalai_fresh_monthly', now() - interval '1 day', 'APP_STORE')`);
const as = (uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
const reserve = async (k) => (await db.query(`select public.reserve_ai_scan($1) as r`, [k])).rows[0].r;
const barcode = async (c) => (await db.query(`select public.reserve_barcode_scan($1) as r`, [c])).rows[0].r;
const me = async () => (await db.query(`select public.my_entitlement() as r`)).rows[0].r;

console.log('reserve_ai_scan kademeli:');
await as(U1);
let r = await reserve('a1');
check('free: ilk rezervasyon kalan 1 / limit 2', r.ok && r.remaining === 1 && r.limit === 2 && r.tier === 'free' && r.unlimited === false);
r = await reserve('a1');
check('free: aynı anahtar tekrar saymaz (G19 idempotency)', r.ok && r.remaining === 1);
r = await reserve('a2');
check('free: ikinci ok, kalan 0', r.ok && r.remaining === 0);
r = await reserve('a3');
check('free: üçüncü → ok:false, reason yok (hak bitti)', r.ok === false && r.remaining === 0 && !r.reason);
await db.exec(`update public.ai_scan_reservations set status='consumed', result='{"items":[],"total":{"kcal":1}}' where idempotency_key='a1'`);
r = await reserve('a1');
check('free: tüketilmiş + sonuç → cached, hak düşmez (G19 önbellek)', r.ok && r.cached === true);
await db.exec(`select public.release_ai_scan('a2')`);
r = await reserve('a4');
check('free: iade sonrası yeniden 1 hak', r.ok && r.remaining === 0);

await as(U4);
r = await reserve('d1');
check('süresi geçmiş fresh → free limit (2)', r.ok && r.limit === 2 && r.tier === 'free');

await as(U2);
r = await reserve('b1');
check('fresh: limit 15, kalan 14', r.ok && r.limit === 15 && r.remaining === 14 && r.tier === 'fresh');
for (let i = 2; i <= 15; i++) await reserve('b' + i);
r = await reserve('b16');
check('fresh: 16. → ok:false', r.ok === false && r.remaining === 0 && !r.reason);

await as(U3);
r = await reserve('c1');
check('balance: unlimited=true, limit 100', r.ok && r.unlimited === true && r.limit === 100 && r.tier === 'balance');
await db.exec(`update public.app_settings set value='2'::jsonb where key='ai_daily_balance'`);
await reserve('c2');
r = await reserve('c3');
check('balance: adil kullanım tavanı → reason fair_use', r.ok === false && r.reason === 'fair_use' && r.unlimited === true);
await db.exec(`update public.app_settings set value='100'::jsonb where key='ai_daily_balance'`);

console.log('G19 korumaları:');
await db.exec(`update public.app_settings set value='false'::jsonb where key='ai_scan_enabled'`);
r = await reserve('c9');
check('acil kapatma → reason disabled', r.ok === false && r.reason === 'disabled');
await db.exec(`update public.app_settings set value='true'::jsonb where key='ai_scan_enabled'`);
await db.exec(`update public.app_settings set value='0'::jsonb where key='ai_scan_daily_cap'`);
r = await reserve('c9');
check('genel tavan → reason global_cap', r.ok === false && r.reason === 'global_cap');
await db.exec(`update public.app_settings set value='1000'::jsonb where key='ai_scan_daily_cap'`);
let threw = false;
try {
  await reserve('a1');
} catch (e) {
  threw = /baskasinin_anahtari/.test(String(e.message));
}
check('başkasının anahtarı → hata (G10)', threw);

console.log('reserve_barcode_scan:');
await as(U1);
for (let i = 1; i <= 5; i++) {
  r = await barcode('869000000000' + i);
}
check('free: 5. barkod ok, kalan 0', r.ok && r.remaining === 0 && r.limit === 5);
r = await barcode('8690000000001');
check('free: aynı gün aynı barkod tekrar → ok, repeat, hak düşmez', r.ok && r.repeat === true);
r = await barcode('8690000000099');
check('free: 6. farklı barkod → ok:false', r.ok === false && r.remaining === 0);
threw = false;
try {
  await barcode('abc; drop');
} catch (e) {
  threw = /gecersiz_barkod/.test(String(e.message));
}
check('geçersiz barkod reddedilir', threw);
await as(U2);
for (let i = 1; i <= 8; i++) r = await barcode('77700000000' + i);
check('fresh: barkod sınırsız (8. ok, limit null)', r.ok && r.unlimited === true && r.limit === null && r.remaining === null);

console.log('my_entitlement:');
await as(U1);
let m = await me();
check('free: ai 2 / used 2, barkod 5 / used 5', m.tier === 'free' && m.ai.limit === 2 && m.ai.used === 2 && m.barcode.limit === 5 && m.barcode.used === 5 && m.product_id === null);
await as(U3);
m = await me();
check('balance: ürün + mağaza + ai sınırsız + barkod sınırsız', m.tier === 'balance' && m.product_id === 'kcalai_balance_yearly' && m.store === 'PLAY_STORE' && m.ai.unlimited === true && m.barcode.unlimited === true);
await as(U4);
m = await me();
check('süresi geçmiş: free, ürün gizli', m.tier === 'free' && m.product_id === null && m.expires_at === null);

console.log('RLS / yetki:');
const pol = await db.query(`select polname, polcmd from pg_policy where polrelid = 'public.user_entitlements'::regclass`);
check('user_entitlements: yalnız SELECT politikası', pol.rows.length === 1 && pol.rows[0].polcmd === 'r');
const priv = await db.query(`select has_table_privilege('authenticated', 'public.user_entitlements', 'INSERT') as i,
  has_table_privilege('authenticated', 'public.user_entitlements', 'UPDATE') as u,
  has_table_privilege('authenticated', 'public.user_entitlements', 'SELECT') as s`);
check('authenticated: insert/update yok, select var', !priv.rows[0].i && !priv.rows[0].u && priv.rows[0].s);
const rls = await db.query(`select relrowsecurity from pg_class where oid = 'public.user_entitlements'::regclass`);
check('RLS açık', rls.rows[0].relrowsecurity === true);
const fx = await db.query(`select has_function_privilege('anon', 'public.my_entitlement()', 'EXECUTE') as a,
  has_function_privilege('authenticated', 'public.my_entitlement()', 'EXECUTE') as b,
  has_function_privilege('authenticated', 'public._entitlement_tier(uuid)', 'EXECUTE') as c`);
check('my_entitlement: anon yok, authenticated var; iç yardımcı kapalı', !fx.rows[0].a && fx.rows[0].b && !fx.rows[0].c);

console.log('restaurant_rating:');
const B1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const B2 = 'aaaaaaaa-0000-0000-0000-000000000002';
await db.exec(`insert into public.orders values (1, '${B1}'), (2, '${B1}'), (3, '${B2}')`);
const rating = async (b) => (await db.query(`select * from public.restaurant_rating($1)`, [b])).rows[0];
let rr = await rating(B1);
check('veri yok: sayı 0, ortalama null, is_new', rr.review_count === 0 && rr.average === null && rr.is_new === true);
const ins = [];
for (let i = 0; i < 9; i++) ins.push(`(1, '${U1}', 5, now() - interval '${i} days')`);
ins.push(`(2, '${U1}', 3, now() - interval '10 days')`);
ins.push(`(2, '${U1}', 1, now() - interval '120 days')`); // 90 gün dışı
ins.push(`(3, '${U1}', 2, now())`); // başka şube
await db.exec(`insert into public.reviews (order_id, user_id, rating, created_at) values ${ins.join(',')}`);
rr = await rating(B1);
check('B1: 10 değerlendirme (90 gün dışı ve diğer şube hariç)', rr.review_count === 10, JSON.stringify(rr));
check('B1: ortalama 4.80', Number(rr.average) === 4.8);
check('B1: 10 → is_new false', rr.is_new === false);
check('alt boyutlar NULL (canlı şemada kolon yok)', rr.taste === null && rr.delivery === null && rr.calorie_fit === null);
rr = await rating(null);
check('NULL şube = tümü (11)', rr.review_count === 11);
const rp = await db.query(`select has_function_privilege('anon', 'public.restaurant_rating(uuid)', 'EXECUTE') as a`);
check('restaurant_rating anon çağırabilir (yalnız toplu veri)', rp.rows[0].a === true);

console.log(`\n${passed} geçti, ${failures.length} kaldı`);
if (failures.length) {
  console.log('KALANLAR:', failures.join(' | '));
  process.exit(1);
}
console.log('G22-S1 PGLITE: TUM KONTROLLER GECTI');
