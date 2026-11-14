// G19-S3 md.5 — Sözlük ↔ çağrı eşleşmesi + sunucu sözlüğü (migration) eşleşmesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EVENTS, EVENT_NAMES, eventDef, isClientEvent } from '../events';

const ROOT = join(__dirname, '../../../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === '__component_tests__' || name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const FILES = [...walk(SRC), join(ROOT, 'App.tsx')];

type Call = { file: string; name: string };
function trackCalls(): Call[] {
  const calls: Call[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\btrack\(\s*'([a-z0-9_]+)'/g)) calls.push({ file: relative(ROOT, f), name: m[1] });
    // G19-S4: G19-S1 Tara (trackScan) ve G19-S2 takip (trackEvent) sarmalayıcıları da
    // aynı track()'e gider; adları sözlükte olmalı. scanMetrics sonuç eşlemesi (saf) dahil.
    for (const m of src.matchAll(/\btrackScan\(\s*'([a-z0-9_]+)'/g)) calls.push({ file: relative(ROOT, f), name: m[1] });
    for (const m of src.matchAll(/\btrackEvent\(\s*\{\s*name:\s*'([a-z0-9_]+)'/g)) calls.push({ file: relative(ROOT, f), name: m[1] });
    if (f.endsWith(join('scan', 'scanMetrics.ts'))) {
      for (const m of src.matchAll(/\{\s*name:\s*'([a-z0-9_]+)'/g)) calls.push({ file: relative(ROOT, f), name: m[1] });
    }
  }
  return calls;
}

test('sözlük: ad biçimi sunucu CHECK ile aynı, TR/EN açıklama dolu, ≥ 25 olay', () => {
  assert.ok(EVENT_NAMES.length >= 25, `olay sayısı ${EVENT_NAMES.length}`);
  for (const n of EVENT_NAMES) {
    assert.match(n, /^[a-z][a-z0-9_]{1,63}$/, n);
    const d = eventDef(n)!;
    assert.ok(d.tr.trim().length > 3, `${n} TR açıklama`);
    assert.ok(d.en.trim().length > 3, `${n} EN açıklama`);
    assert.notEqual(d.tr, d.en, `${n} TR=EN (çeviri yok)`);
  }
});

test('sözlük: alias hedefi sözlükte var, zincir yok', () => {
  for (const n of EVENT_NAMES) {
    const a = eventDef(n)!.aliasOf;
    if (!a) continue;
    assert.ok(eventDef(a), `${n} → ${a} sözlükte yok`);
    assert.equal(eventDef(a)!.aliasOf, undefined, `${n} → ${a} zincirleme alias`);
  }
});

test('Meta yalnız reklam olaylarında: 5 standart olay, hepsi ticaret/yaşam döngüsü', () => {
  const meta = EVENT_NAMES.filter((n) => eventDef(n)!.meta).sort();
  assert.deepEqual(meta, ['add_to_cart', 'begin_checkout', 'payment_success', 'product_view', 'signup']);
  for (const n of EVENT_NAMES) {
    const d = eventDef(n)!;
    if (d.category === 'tracking' || d.category === 'social') assert.equal(d.meta, undefined, `${n}: beslenme/sosyal olay Meta'ya gidemez`);
  }
});

test('beyaz listede kişisel veri anahtarı yok', () => {
  const banned = /^(email|e_?mail|mail|phone|phone_number|telefon|tel|gsm|address|adres|full_address|first_name|last_name|full_name|name|customer_name|surname|lat|lng|lon|latitude|longitude|location|card|card_number|pan|cvv|iban|tckn|password|token|note|comment|handle|user_id|author_id|post_id|target_user)$/;
  for (const n of EVENT_NAMES) {
    for (const k of Object.keys(eventDef(n)!.props)) assert.doesNotMatch(k, banned, `${n}.${k}`);
  }
});

test('her track() çağrısı sözlükte ve istemci olayı (sunucu/alias çağrılamaz)', () => {
  const calls = trackCalls();
  assert.ok(calls.length >= 46, `track çağrısı ${calls.length} (beklenen ≥ 46: G19 öncesi 36 + logEvent 10 birleşti + yeniler)`);
  const bad = calls.filter((c) => !isClientEvent(c.name));
  assert.deepEqual(bad, []);
});

test('huni olayları en az bir yerde çağrılıyor (md.2)', () => {
  const called = new Set(trackCalls().map((c) => c.name));
  const required = [
    'app_open', 'first_touch', 'signup', 'login', 'onb_step',
    'scan_open', 'scan_capture', 'scan_success', 'scan_fail', 'scan_limit', 'scan_log',
    'log_add', 'log_delete', 'log_edit', 'water_add', 'activity_add',
    'share', 'follow', 'product_view', 'add_to_cart', 'begin_checkout', 'payment_success',
    'coupon_apply', 'saha_code_apply',
  ];
  const missing = required.filter((n) => !called.has(n));
  assert.deepEqual(missing, []);
  // checkout_start / pay_success yalnız alias (kanonik ad yazılır), order_delivered sunucu tetikleyicisi.
  for (const n of ['checkout_start', 'pay_success', 'order_delivered', 'purchase']) {
    assert.equal(called.has(n), false, `${n} istemciden çağrılmamalı`);
    assert.equal(isClientEvent(n), false);
  }
});

test('eski logEvent.* (Meta doğrudan) hiçbir yerde kalmadı — tek giriş track()', () => {
  const offenders = FILES.filter((f) => /\blogEvent\.(viewContent|addToCart|initiateCheckout|purchase|completeRegistration)\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => relative(ROOT, f)), []);
  const direct = FILES.filter((f) => !f.endsWith(join('lib', 'analytics.ts')) && /AppEventsLogger\./.test(readFileSync(f, 'utf8')));
  assert.deepEqual(direct.map((f) => relative(ROOT, f)), []);
  const rawInsert = FILES.filter((f) => !f.endsWith(join('lib', 'analytics.ts')) && /from\(\s*'analytics_events'\s*\)/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(rawInsert.map((f) => relative(ROOT, f)), []);
});

test('sunucu sözlüğü (migration) istemci sözlüğünün tamamını içerir, alias/kpi aynı', () => {
  // G21-S1 md.2: barkod olayları ayrı migration'da (20261110000100_g21_s1_barcode.sql).
  const sql = [
    'supabase/migrations/20261109110000_g19_s3_event_names.sql',
    'supabase/migrations/20261110000100_g21_s1_barcode.sql',
    // G22-S1: sesle ekleme + abonelik olayları.
    'supabase/migrations/20261110100100_g22_s1_subscriptions.sql',
    // G24-S1: kcalAI Koç olayları.
    'supabase/migrations/20261111100100_g24_coach.sql',
    'supabase/migrations/20261112110100_g34_personal_plan.sql',
    // G42-S1: yeni kayıt hunisi.
    'supabase/migrations/20261113120100_g42_yeni_kayit.sql',
    // G46-S1: T1 kapatma onayı.
    'supabase/migrations/20261114100100_g46_paywall_dismiss_confirm.sql',
    // G48-S1: eatkcal konum kapısı.
    'supabase/migrations/20261114200100_g48_eatkcal_gate_events.sql',
    // G49-S1: profilsiz Ana sayfa kartı.
    'supabase/migrations/20261114220100_g49_home_plan_card_events.sql',
  ]
    .map((f) => readFileSync(join(ROOT, f), 'utf8'))
    .join('\n');
  const rows = new Map<string, { source: string; alias: string | null; kpi: boolean }>();
  for (const m of sql.matchAll(/\(\s*'([a-z0-9_]+)',\s*'([a-z]+)',\s*'(client|server)',[\s\S]*?,\s*(null|'[a-z0-9_]+'),\s*(true|false)\)/g)) {
    rows.set(m[1], { source: m[3], alias: m[4] === 'null' ? null : m[4].slice(1, -1), kpi: m[5] === 'true' });
  }
  assert.equal(rows.size, EVENT_NAMES.length, 'migration satır sayısı ≠ sözlük');
  for (const n of EVENT_NAMES) {
    const d = EVENTS[n] as { source?: string; aliasOf?: string; kpi?: boolean };
    const r = rows.get(n);
    assert.ok(r, `${n} migration'da yok`);
    assert.equal(r!.source, d.source ?? 'client', `${n} source`);
    assert.equal(r!.alias, d.aliasOf ?? null, `${n} alias`);
    assert.equal(r!.kpi, !!d.kpi, `${n} kpi`);
  }
  const rb = readFileSync(join(ROOT, 'supabase/rollbacks/20261109110000_g19_s3_event_names_rollback.sql'), 'utf8');
  assert.match(rb, /delete from public\.analytics_event_names/);
  const rb21 = readFileSync(join(ROOT, 'supabase/rollbacks/20261110000100_g21_s1_barcode_rollback.sql'), 'utf8');
  assert.match(rb21, /delete from public\.analytics_event_names/);
  const rb22 = readFileSync(join(ROOT, 'supabase/rollbacks/20261110100100_g22_s1_subscriptions_rollback.sql'), 'utf8');
  assert.match(rb22, /delete from public\.analytics_event_names/);
  const rb46 = readFileSync(join(ROOT, 'supabase/rollbacks/20261114100100_g46_paywall_dismiss_confirm_rollback.sql'), 'utf8');
  assert.match(rb46, /delete from public\.analytics_event_names where name in \('paywall_dismiss_confirm'\)/);
  const rb48 = readFileSync(join(ROOT, 'supabase/rollbacks/20261114200100_g48_eatkcal_gate_events_rollback.sql'), 'utf8');
  assert.match(rb48, /delete from public\.analytics_event_names where name in \('eatkcal_gate_view', 'eatkcal_gate_select', 'eatkcal_waitlist_submit'\)/);
  const rb49 = readFileSync(join(ROOT, 'supabase/rollbacks/20261114220100_g49_home_plan_card_events_rollback.sql'), 'utf8');
  assert.match(rb49, /delete from public\.analytics_event_names where name in \('home_plan_card_view', 'home_plan_card_tap'\)/);
});

test('D-S1 sözlüğündeki 38 ad istemci sözlüğünde de var (sözleşme)', () => {
  const ds1 = [
    'app_open', 'first_touch', 'signup', 'onb_step', 'welcome_view', 'welcome_login_click', 'welcome_skip_click',
    'scan_start', 'scan_success', 'scan_failed', 'log_meal', 'log_water', 'log_activity', 'share', 'follow',
    'home_view', 'banner_view', 'banner_click', 'announcement_strip_click', 'product_view', 'add_to_cart',
    'remove_from_cart', 'cart_view', 'begin_checkout', 'checkout_start', 'payment_attempt', 'payment_pending',
    'payment_success', 'pay_success', 'payment_failed', 'coupon_apply', 'saha_code_apply', 'reorder_from_home',
    'reorder_from_order_detail', 'reorder_from_empty_cart', 'order_review_submitted', 'purchase', 'order_delivered',
  ];
  assert.equal(ds1.length, 38);
  assert.deepEqual(ds1.filter((n) => !eventDef(n)), []);
  assert.equal(eventDef('checkout_start')!.aliasOf, 'begin_checkout');
  assert.equal(eventDef('pay_success')!.aliasOf, 'payment_success');
});
