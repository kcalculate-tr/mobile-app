// D-S1 — PGlite kontrolü: migration'lar 2 kez (idempotent) + davranış kontrolleri.
//
// Çalıştırma (PGlite pakete EKLENMEZ; var olan bir kurulumdan yüklenir):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> \
//     node supabase/tests/d_s1.check.mjs
// PGLITE_DIR verilmezse sırayla ~/dev/kcal-web ve ~/dev/kcal-web-* denenir.
// Başarı: "D-S1 PGLITE: TUM KONTROLLER GECTI" ve çıkış kodu 0.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function findPglite() {
  const dirs = [];
  if (process.env.PGLITE_DIR) dirs.push(process.env.PGLITE_DIR);
  const dev = join(homedir(), 'dev');
  dirs.push(join(dev, 'kcal-web'));
  try {
    for (const d of readdirSync(dev)) if (d.startsWith('kcal-web-')) dirs.push(join(dev, d));
  } catch { /* yok */ }
  for (const d of dirs) {
    const p = join(d, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js');
    if (existsSync(p)) return p;
  }
  throw new Error('PGlite bulunamadı. PGLITE_DIR=<node_modules üst dizini> ver. Denenen: ' + dirs.join(', '));
}

const { PGlite } = await import(pathToFileURL(findPglite()).href);

export const MIGRATIONS = [
  'supabase/migrations/20261109100100_d_s1_adisyo_orders.sql',
  'supabase/migrations/20261109100200_d_s1_adisyo_reconcile_health.sql',
  'supabase/migrations/20261109100300_d_s1_kpi.sql',
];
export const ROLLBACKS = [
  'supabase/rollbacks/20261109100300_d_s1_kpi_rollback.sql',
  'supabase/rollbacks/20261109100200_d_s1_adisyo_reconcile_health_rollback.sql',
  'supabase/rollbacks/20261109100100_d_s1_adisyo_orders_rollback.sql',
];

let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failures.push(name); console.log('  ✗', name, detail); }
}
async function expectError(db, name, sql, params = [], re = /./) {
  try { await db.query(sql, params); check(name, false, '(hata bekleniyordu)'); }
  catch (e) { check(name, re.test(String(e.message)), String(e.message)); }
}
const read = (p) => readFileSync(join(root, p), 'utf8');

const U_ADMIN = 'aaaaaaaa-0000-4000-8000-000000000001';
const U_USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const U_OTHER = 'cccccccc-0000-4000-8000-000000000003';
const B_MERKEZ = 'dddddddd-0000-4000-8000-000000000001';
const B_SUBE = 'dddddddd-0000-4000-8000-000000000002';

async function asRole(db, role, sub, fn) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
  try { return await fn(); }
  finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function main() {
  const db = new PGlite();
  await db.exec(read('supabase/tests/d_s1_base_stub.sql'));

  console.log('\n[1] Migration\'lar 2 kez (idempotent)');
  for (let run = 1; run <= 2; run++) {
    for (const m of MIGRATIONS) {
      if (!existsSync(join(root, m))) { check(`${m} var`, false); continue; }
      try { await db.exec(read(m)); check(`koşu ${run}: ${m.split('/').pop()}`, true); }
      catch (e) { check(`koşu ${run}: ${m.split('/').pop()}`, false, e.message); throw e; }
    }
  }

  await seed(db);
  await testAdisyoOrders(db);
  for (const t of EXTRA) await t(db);

  console.log('\n[R] Rollback\'ler + yeniden uygulama');
  for (const r of ROLLBACKS) {
    if (!existsSync(join(root, r))) { check(`${r} var`, false); continue; }
    try { await db.exec(read(r)); check(`rollback: ${r.split('/').pop()}`, true); }
    catch (e) { check(`rollback: ${r.split('/').pop()}`, false, e.message); }
  }
  const left = await db.query(`select to_regclass('public.adisyo_orders') a, to_regclass('public.analytics_event_names') b`);
  check('rollback sonrası tablolar yok', left.rows[0].a === null && left.rows[0].b === null);
  for (const m of MIGRATIONS) {
    try { await db.exec(read(m)); check(`yeniden: ${m.split('/').pop()}`, true); }
    catch (e) { check(`yeniden: ${m.split('/').pop()}`, false, e.message); }
  }

  console.log(`\n${passed} geçti, ${failures.length} kaldı`);
  if (failures.length) { console.log('KALANLAR:\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('D-S1 PGLITE: TUM KONTROLLER GECTI');
}

async function seed(db) {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U_ADMIN}', 'admin@test.local'), ('${U_USER}', 'u@test.local'), ('${U_OTHER}', 'o@test.local')
      on conflict do nothing;
    insert into public.admin_allowlist (user_id, email) values ('${U_ADMIN}', 'admin@test.local');
    insert into public.branches (id, name, is_default, adisyo_config) values
      ('${B_MERKEZ}', 'Merkez', true,  '{"restaurantKey":"rk-merkez","apiKey":"x"}'),
      ('${B_SUBE}',   'Şube',   false, '{"restaurantKeys":["rk-sube","rk-sube-2"]}');
  `);
}

// ── adisyo_orders ──────────────────────────────────────────────────────────
function row(over = {}) {
  return {
    adisyo_order_id: 9001, order_number: 'A-1', restaurant_key: 'rk-merkez', channel: 'yemeksepeti',
    channel_raw: 'Yemeksepeti', status_id: 1, order_type: 'Paket', total: 300, discount: 10, tax: 25,
    payment_method: 'Online', inserted_at: '2026-11-08T09:00:00.000Z', closed_at: null, prepared_at: null,
    is_cancelled: false, cancel_reason: null, external_ref: 'YS-1',
    items: [{ name: 'Tavuk Bowl', quantity: 2, unit_price: 150, product_id: 7 }], raw_hash: 'h1', ...over,
  };
}

async function upsert(db, r) {
  const res = await db.query('select public.adisyo_order_upsert($1::jsonb) as r', [JSON.stringify(r)]);
  return res.rows[0].r;
}

async function testAdisyoOrders(db) {
  console.log('\n[2] adisyo_orders: upsert / idempotent / beyaz liste / eşleme / RLS');
  check('ilk yazım inserted', (await upsert(db, row())) === 'inserted');
  check('aynı hash unchanged', (await upsert(db, row())) === 'unchanged');
  check('hash değişince updated', (await upsert(db, row({ raw_hash: 'h2', status_id: 7, closed_at: '2026-11-08T09:40:00Z' }))) === 'updated');
  const r1 = (await db.query('select * from public.adisyo_orders where adisyo_order_id = 9001')).rows[0];
  check('şube restaurantKey ile eşlendi (merkez)', r1.branch_id === B_MERKEZ);
  check('closed_at yazıldı', r1.closed_at !== null);
  check('kanal korunur', r1.channel === 'yemeksepeti');

  // Beyaz liste: kişisel alanlar ve fazla item alanları saklanmaz
  await upsert(db, row({
    adisyo_order_id: 9002, restaurant_key: 'rk-sube-2', raw_hash: 'p1',
    customer: { name: 'Ayşe', phone: '05321234567' }, customerLatitude: 41, orderNote: 'Kapıda ara',
    items: [{ name: 'Ayran', quantity: 1, unit_price: 25, product_id: null, productNote: '0532 111' }, { name: '' }],
    channel: 'uydurma_kanal',
  }));
  const r2 = (await db.query(`select to_jsonb(a) j from public.adisyo_orders a where adisyo_order_id = 9002`)).rows[0].j;
  const s2 = JSON.stringify(r2);
  check('kişisel veri saklanmadı', !/Ayşe|0532|Kapıda|customer|Latitude/.test(s2), s2);
  check('item yalnız 4 alan + boş ad atıldı', r2.items.length === 1 && Object.keys(r2.items[0]).sort().join() === 'name,product_id,quantity,unit_price');
  check('bilinmeyen kanal → diger', r2.channel === 'diger');
  check('restaurantKeys dizisiyle şube eşlendi', r2.branch_id === B_SUBE);

  // Uygulama siparişi: orders.adisyo_order_id eşleşmesi → channel app + app_order_id
  const o = await db.query(`insert into public.orders (status, payment_status, total_amount, branch_id, adisyo_order_id, user_id, source)
    values ('confirmed','paid',200,'${B_SUBE}',9003,'${U_USER}','app') returning id`);
  await upsert(db, row({ adisyo_order_id: 9003, restaurant_key: null, channel: 'diger', raw_hash: 'a1' }));
  const r3 = (await db.query('select * from public.adisyo_orders where adisyo_order_id = 9003')).rows[0];
  check('uygulama siparişi app_order_id eşlendi', String(r3.app_order_id) === String(o.rows[0].id));
  check('uygulama siparişi kanal=app', r3.channel === 'app');
  check('anahtar yoksa şube orders.branch_id', r3.branch_id === B_SUBE);

  // Geç gelen SaveOrder: önce webhook, sonra orders.adisyo_order_id → relink
  await upsert(db, row({ adisyo_order_id: 9004, restaurant_key: 'rk-yok', channel: 'diger', raw_hash: 'l1' }));
  check('eşleşmeyen anahtar → şube boş (fallback kapalı)',
    (await db.query('select branch_id from public.adisyo_orders where adisyo_order_id = 9004')).rows[0].branch_id === null);
  await db.exec(`insert into public.orders (status, payment_status, total_amount, branch_id, adisyo_order_id, source)
    values ('confirmed','paid',150,'${B_MERKEZ}',9004,'app')`);
  const n = (await db.query('select public.adisyo_orders_relink() n')).rows[0].n;
  const r4 = (await db.query('select * from public.adisyo_orders where adisyo_order_id = 9004')).rows[0];
  check('relink: app + şube düzeldi', n >= 1 && r4.channel === 'app' && r4.branch_id === B_MERKEZ && r4.app_order_id !== null);
  check('relink ikinci kez 0', (await db.query('select public.adisyo_orders_relink() n')).rows[0].n === 0);

  // Fallback açık → varsayılan şube
  await db.exec(`update public.app_settings set value = '{"default_branch_fallback": true}' where key = 'adisyo_orders'`);
  await upsert(db, row({ adisyo_order_id: 9005, restaurant_key: 'rk-bilinmez', raw_hash: 'f1' }));
  check('fallback açık → varsayılan şube',
    (await db.query('select branch_id from public.adisyo_orders where adisyo_order_id = 9005')).rows[0].branch_id === B_MERKEZ);
  await db.exec(`update public.app_settings set value = '{"default_branch_fallback": false}' where key = 'adisyo_orders'`);

  await expectError(db, 'adisyo_order_id yoksa hata', `select public.adisyo_order_upsert('{}'::jsonb)`, [], /gerekli/);

  // RLS / yetki
  const asAdmin = await asRole(db, 'authenticated', U_ADMIN, () => db.query('select count(*)::int c from public.adisyo_orders'));
  check('admin okur', asAdmin.rows[0].c >= 5);
  const asUser = await asRole(db, 'authenticated', U_USER, () => db.query('select count(*)::int c from public.adisyo_orders'));
  check('normal kullanıcı 0 satır görür', asUser.rows[0].c === 0);
  await asRole(db, 'anon', null, () => expectError(db, 'anon okuyamaz', 'select * from public.adisyo_orders', [], /permission/));
  await asRole(db, 'authenticated', U_ADMIN, () =>
    expectError(db, 'admin bile doğrudan yazamaz', `insert into public.adisyo_orders (adisyo_order_id, raw_hash) values (1,'x')`, [], /permission/));
  await asRole(db, 'authenticated', U_ADMIN, () =>
    expectError(db, 'authenticated upsert RPC çağıramaz', `select public.adisyo_order_upsert('{"adisyo_order_id":1}'::jsonb)`, [], /permission/));
  const sr = await asRole(db, 'service_role', null, () => db.query(`select public.adisyo_order_upsert($1::jsonb) r`, [JSON.stringify(row({ adisyo_order_id: 9006, raw_hash: 's1' }))]));
  check('service_role upsert eder', sr.rows[0].r === 'inserted');

  // Kuyruk kolonları
  const cols = (await db.query(`select column_name from information_schema.columns where table_name='adisyo_webhook_events' and column_name like 'ao_%' order by 1`)).rows.map((r) => r.column_name);
  check('webhook kuyruk kolonları', cols.join() === 'ao_attempts,ao_error,ao_next_retry_at,ao_synced_at', cols.join());
}

export const EXTRA = [];
// Diğer bölümler (reconcile / sağlık / KPI) aşağıdaki dosyalarda: aynı süreçte yüklenir.
for (const f of ['d_s1.check.reconcile.mjs', 'd_s1.check.kpi.mjs']) {
  const p = join(here, f);
  if (existsSync(p)) {
    const mod = await import(pathToFileURL(p).href);
    EXTRA.push((db) => mod.default(db, { check, expectError, asRole, upsert, row, ids: { U_ADMIN, U_USER, U_OTHER, B_MERKEZ, B_SUBE } }));
  }
}

try {
  await main();
} catch (e) {
  console.log('\nBEKLENMEYEN HATA:', e?.message ?? e, e?.where ? `\n  yer: ${e.where}` : '');
  console.log(`${passed} geçti, ${failures.length + 1} kaldı`);
  process.exit(1);
}
