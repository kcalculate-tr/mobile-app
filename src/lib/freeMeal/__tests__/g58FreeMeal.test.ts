// G58-S2 md.4 — ücretsiz öğün kuponu: free_item hesabı (sunucuyla birebir), davet ödülü (iki tarafa
// 1 öğün, ilk teslimatta), uygulama içi bildirim metni, eski TL'li davet dosyasının etkisizleştirilmesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  FREE_MEAL_DEFAULT_EXCLUDED,
  FREE_MEAL_VALID_DAYS,
  IZMIR_FREE_MEALS,
  freeMealDiscount,
  freeMealNoticeKey,
  parseFreeMealNotices,
} from '../rules';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIG = 'supabase/migrations/20261117210100_g58s2_ucretsiz_ogun_kuponu.sql';

test('free_item: sepetteki EN PAHALI 1 ana öğün; içecek + yan ürün hariç', () => {
  const cart = [
    { price: 285, category: "Bowl's" },
    { price: 340, category: 'Yüksek Protein' },
    { price: 420, category: 'Detoks & Shake' }, // içecek — daha pahalı ama hariç
    { price: 60, category: 'Soslar' }, // yan ürün
  ];
  assert.equal(freeMealDiscount(cart, { cartTotal: 1105 }), 340);
});

test('free_item: üst sınır (free_meal_max_tl) kırpar; boş/0 = sınırsız; sepet tutarını aşamaz', () => {
  const cart = [{ price: 480, category: "Wrap's" }];
  assert.equal(freeMealDiscount(cart, { cartTotal: 480, maxTl: 350 }), 350);
  assert.equal(freeMealDiscount(cart, { cartTotal: 480, maxTl: null }), 480);
  assert.equal(freeMealDiscount(cart, { cartTotal: 480, maxTl: 0 }), 480);
  assert.equal(freeMealDiscount(cart, { cartTotal: 300 }), 300);
});

test('free_item: uygun kalem yoksa indirim yok (sunucu no_eligible_item)', () => {
  assert.equal(freeMealDiscount([{ price: 120, category: 'Detoks & Shake' }, { price: 40, category: 'Soslar' }], { cartTotal: 160 }), null);
  assert.equal(freeMealDiscount([], { cartTotal: 0 }), null);
  assert.equal(freeMealDiscount([{ price: 0, category: "Bowl's" }], { cartTotal: 0 }), null);
});

test('kural sunucuyla aynı: varsayılan hariç kategoriler, 30 gün, tek kullanım, max_discount ← free_meal_max_tl', () => {
  const sql = read(MIG);
  assert.deepEqual([...FREE_MEAL_DEFAULT_EXCLUDED], ['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar']);
  for (const c of FREE_MEAL_DEFAULT_EXCLUDED) assert.ok(sql.includes(`'${c}'`), c);
  assert.equal(FREE_MEAL_VALID_DAYS, 30);
  assert.match(sql, /free_meal_valid_days integer not null default 30/);
  assert.match(sql, /free_meal_max_tl numeric;/);
  assert.match(sql, /'free_item', 0, coalesce\(s\.free_meal_max_tl, 0\), 0/);
  // validate_coupon_v2 (ödemede kullanılan) en pahalı uygun kalem + max_discount kırpma kuralını taşır.
  const v2 = read('supabase/migrations/20260922173642_validate_coupon_v2_server_side_items.sql');
  assert.match(v2, /select max\(pr\.price\)/);
  assert.match(v2, /c\.max_discount is not null and c\.max_discount > 0 and v_discount > c\.max_discount/);
  assert.match(read('supabase/functions/paynkolay-payment-init/index.ts'), /rpc\('validate_coupon_v2'/);
  assert.equal(IZMIR_FREE_MEALS, 2);
});

test('davet ödülü: davet edilenin İLK siparişi teslim edilince İKİ tarafa 1 ücretsiz öğün (TL kuponu yok)', () => {
  const sql = read(MIG);
  const fn = sql.slice(sql.indexOf('create or replace function public.referral_on_delivery()'), sql.indexOf('create or replace function public.my_referral()'));
  assert.match(fn, /if new\.status <> 'delivered' then return new; end if;/);
  assert.match(fn, /payment_status, ''\) <> 'paid'/);
  assert.match(fn, /o\.status = 'delivered' and o\.id <> new\.id/, 'yalnız ilk teslim edilen sipariş');
  assert.match(fn, /foreach v_user in array array\[r\.referrer_id, r\.referee_id\] loop\s+perform public\.grant_free_meals\(v_user, 'referral', r\.id::text, 1\);/);
  assert.doesNotMatch(fn, /'fixed'/, 'TL (fixed) kupon üretilmez');
  assert.doesNotMatch(fn, /referral_reward_tl/, 'ödül TL ayarına bağlı değil');
  assert.match(fn, /exception when others then/, 'davet hatası teslimi durdurmaz');
});

test('eski TL davet dosyası _superseded ve etkisiz; davet bayrağı hiçbir G58 dosyasında açılmaz', () => {
  const old = read('supabase/migrations/20261116210100_davet_canli_kampanya_hedef.sql');
  assert.match(old, /^-- _superseded/);
  const live = old.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--'));
  assert.deepEqual(live, ['select 1; -- no-op']);
  const v2 = read('supabase/migrations/20261117210200_davet_canli_kampanya_hedef_v2.sql');
  const v2live = v2.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(v2live, /feature_flags/);
  assert.doesNotMatch(read(MIG), /feature_flags/);
  assert.ok(fs.existsSync(path.join(ROOT, 'supabase/rollbacks/20261117210100_g58s2_ucretsiz_ogun_kuponu_rollback.sql')));
  assert.ok(fs.existsSync(path.join(ROOT, 'supabase/rollbacks/20261117210200_davet_canli_kampanya_hedef_v2_rollback.sql')));
});

test('uygulama içi bildirim: İzmir "2 öğünün kupon kısmına tanımlandı"; davet ayrı metin; bilinmeyen satır atlanır', () => {
  const n = parseFreeMealNotices([{ id: 'g1', source: 'izmir_fresh', count: 2 }, { id: 'x', source: 'weird' }, null]);
  assert.deepEqual(n, [{ id: 'g1', source: 'izmir_fresh', count: 2 }]);
  assert.deepEqual(freeMealNoticeKey(n), { key: 'free_meal.notice', n: 2 });
  assert.deepEqual(freeMealNoticeKey([{ id: 'r', source: 'referral', count: 1 }]), { key: 'free_meal.notice_referral', n: 1 });
  assert.equal(freeMealNoticeKey([]), null);
  assert.deepEqual(parseFreeMealNotices('nope'), []);
  const tr = read('src/core/i18n/g58.ts');
  assert.match(tr, /notice: '%\{n\} öğünün kupon kısmına tanımlandı'/);
});
