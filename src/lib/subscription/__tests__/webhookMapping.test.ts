// G22-S1 md.3 — revenuecat-webhook saf eşleme (supabase/functions/revenuecat-webhook/mapping.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  authorized,
  isFreshYearly,
  isProtectedManual,
  izmirOfferDecision,
  mapRevenueCatEvent,
  resolveUserId,
  tierFromEvent,
  tierFromProduct,
  type EntitlementRow,
} from '../../../../supabase/functions/revenuecat-webhook/mapping';

const ROOT = path.resolve(__dirname, '../../../..');
const UID = '0b9e0f6a-3c1d-4a8e-9f00-1234567890ab';
const T0 = Date.parse('2026-11-10T10:00:00Z');
const EXP = Date.parse('2026-12-10T10:00:00Z');

const active = (over: Partial<EntitlementRow> = {}): EntitlementRow => ({
  tier: 'fresh',
  product_id: 'kcalai_fresh_monthly',
  expires_at: new Date(EXP).toISOString(),
  trial: false,
  store: 'APP_STORE',
  will_renew: true,
  last_event_id: 'e0',
  last_event_at: new Date(T0 - 1000).toISOString(),
  ...over,
});

test('resolveUserId: UUID app_user_id; anonim atlanır, alias içinden bulunur', () => {
  assert.equal(resolveUserId({ app_user_id: UID }), UID);
  assert.equal(resolveUserId({ app_user_id: '$RCAnonymousID:abc' }), null);
  assert.equal(resolveUserId({ app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', UID.toUpperCase()] }), UID);
});

test('tierFromProduct / tierFromEvent: balance > fresh; Play taban planı soneki', () => {
  assert.equal(tierFromProduct('kcalai_fresh_yearly'), 'fresh');
  assert.equal(tierFromProduct('kcalai_balance_monthly:monthly-base'), 'balance');
  assert.equal(tierFromProduct('baska_urun'), null);
  // G23-S1: Google Play abonelik + temel plan (RevenueCat 'kcalai_fresh:monthly').
  assert.equal(tierFromProduct('kcalai_fresh:monthly'), 'fresh');
  assert.equal(tierFromProduct('kcalai_balance:yearly'), 'balance');
  assert.equal(tierFromEvent({ entitlement_ids: null, product_id: 'kcalai_balance:monthly' }), 'balance');
  assert.equal(tierFromEvent({ entitlement_ids: ['fresh', 'balance'], product_id: 'kcalai_fresh_monthly' }), 'balance');
  assert.equal(tierFromEvent({ entitlement_ids: null, product_id: 'kcalai_fresh_monthly' }), 'fresh');
});

test('INITIAL_PURCHASE (yıllık deneme) → fresh, trial, bitiş, mağaza', () => {
  const r = mapRevenueCatEvent(
    {
      id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: UID, product_id: 'kcalai_fresh_yearly',
      entitlement_ids: ['fresh'], period_type: 'TRIAL', expiration_at_ms: EXP, event_timestamp_ms: T0, store: 'APP_STORE',
    },
    null,
  );
  assert.equal(r.action, 'upsert');
  if (r.action !== 'upsert') return;
  assert.equal(r.userId, UID);
  assert.deepEqual(
    { tier: r.row.tier, trial: r.row.trial, exp: r.row.expires_at, store: r.row.store, renew: r.row.will_renew, id: r.row.last_event_id },
    { tier: 'fresh', trial: true, exp: new Date(EXP).toISOString(), store: 'APP_STORE', renew: true, id: 'e1' },
  );
});

test('RENEWAL → deneme biter (NORMAL), bitiş ileri', () => {
  const next = EXP + 30 * 864e5;
  const r = mapRevenueCatEvent(
    { id: 'e2', type: 'RENEWAL', app_user_id: UID, product_id: 'kcalai_fresh_yearly', period_type: 'NORMAL', expiration_at_ms: next, event_timestamp_ms: T0 },
    active({ trial: true }),
  );
  assert.ok(r.action === 'upsert' && r.row.trial === false && r.row.expires_at === new Date(next).toISOString());
});

test('CANCELLATION → kademe KORUNUR, will_renew=false', () => {
  const r = mapRevenueCatEvent({ id: 'e3', type: 'CANCELLATION', app_user_id: UID, product_id: 'kcalai_fresh_monthly', expiration_at_ms: EXP, event_timestamp_ms: T0 }, active());
  assert.ok(r.action === 'upsert' && r.row.tier === 'fresh' && r.row.will_renew === false);
});

test('EXPIRATION → free', () => {
  const r = mapRevenueCatEvent({ id: 'e4', type: 'EXPIRATION', app_user_id: UID, product_id: 'kcalai_fresh_monthly', expiration_at_ms: EXP, event_timestamp_ms: T0 }, active());
  assert.ok(r.action === 'upsert' && r.row.tier === 'free' && r.row.trial === false && r.row.will_renew === false);
});

test('PRODUCT_CHANGE: yükseltme hemen, düşürme bir sonraki yenilemede', () => {
  const up = mapRevenueCatEvent(
    { id: 'e5', type: 'PRODUCT_CHANGE', app_user_id: UID, product_id: 'kcalai_fresh_monthly', new_product_id: 'kcalai_balance_monthly', event_timestamp_ms: T0 },
    active(),
  );
  assert.ok(up.action === 'upsert' && up.row.tier === 'balance' && up.row.product_id === 'kcalai_balance_monthly');
  const down = mapRevenueCatEvent(
    { id: 'e6', type: 'PRODUCT_CHANGE', app_user_id: UID, product_id: 'kcalai_balance_monthly', new_product_id: 'kcalai_fresh_monthly', event_timestamp_ms: T0 },
    active({ tier: 'balance', product_id: 'kcalai_balance_monthly' }),
  );
  assert.ok(down.action === 'upsert' && down.row.tier === 'balance' && down.row.product_id === 'kcalai_balance_monthly');
});

test('sırasız / tekrar / anonim / bilinmeyen olay yok sayılır', () => {
  const stale = mapRevenueCatEvent({ id: 'e7', type: 'EXPIRATION', app_user_id: UID, event_timestamp_ms: T0 - 60_000 }, active());
  assert.deepEqual(stale, { action: 'ignore', reason: 'stale_event' });
  const dup = mapRevenueCatEvent({ id: 'e0', type: 'RENEWAL', app_user_id: UID, product_id: 'kcalai_fresh_monthly', event_timestamp_ms: T0 }, active());
  assert.deepEqual(dup, { action: 'ignore', reason: 'duplicate_event' });
  assert.deepEqual(mapRevenueCatEvent({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:x' }, null), { action: 'ignore', reason: 'anonymous_user' });
  assert.deepEqual(mapRevenueCatEvent({ type: 'TEST', app_user_id: UID }, null), { action: 'ignore', reason: 'event:TEST' });
  assert.deepEqual(
    mapRevenueCatEvent({ type: 'INITIAL_PURCHASE', app_user_id: UID, product_id: 'baska' }, null),
    { action: 'ignore', reason: 'unknown_product' },
  );
});

test('authorized: "Bearer s" ve çıplak "s" kabul; boş sır / yanlış değer red', () => {
  assert.equal(authorized('Bearer s3cret-value', 's3cret-value'), true);
  assert.equal(authorized('s3cret-value', 's3cret-value'), true);
  assert.equal(authorized('Bearer wrong-value', 's3cret-value'), false);
  assert.equal(authorized(null, 's3cret-value'), false);
  assert.equal(authorized('anything', ''), false);
});

// ── G58-S2 md.4: personel/manuel hak koruması ────────────────────────────────
const staff = (over: Partial<EntitlementRow> = {}): EntitlementRow => ({
  tier: 'balance',
  product_id: 'internal_staff',
  expires_at: null,
  trial: false,
  store: 'manual',
  will_renew: false,
  last_event_id: null,
  last_event_at: null,
  ...over,
});
const NOW = Date.parse('2026-11-23T12:00:00Z');

test('personel hakkı (store=manual, süresiz) HİÇBİR olayla ezilmez — App Store denemesi bitince EXPIRATION dahil', () => {
  for (const type of ['EXPIRATION', 'CANCELLATION', 'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']) {
    const r = mapRevenueCatEvent(
      { id: `e-${type}`, type, app_user_id: UID, product_id: 'kcalai_fresh_yearly', new_product_id: 'kcalai_balance_monthly', store: 'APP_STORE', event_timestamp_ms: NOW, expiration_at_ms: NOW },
      staff(),
      NOW,
    );
    assert.deepEqual(r, { action: 'ignore', reason: 'manual_entitlement' }, type);
  }
});

test('manuel hak süreli ve süresi geçmemiş → korunur; süresi geçmişse RevenueCat yine işler', () => {
  const future = staff({ expires_at: '2027-01-01T00:00:00Z' });
  assert.equal(isProtectedManual(future, NOW), true);
  assert.equal(mapRevenueCatEvent({ id: 'x1', type: 'EXPIRATION', app_user_id: UID, event_timestamp_ms: NOW }, future, NOW).action, 'ignore');
  const past = staff({ expires_at: '2026-11-01T00:00:00Z' });
  assert.equal(isProtectedManual(past, NOW), false);
  const r = mapRevenueCatEvent({ id: 'x2', type: 'INITIAL_PURCHASE', app_user_id: UID, product_id: 'kcalai_fresh_yearly', store: 'APP_STORE', event_timestamp_ms: NOW }, past, NOW);
  assert.equal(r.action, 'upsert');
  assert.equal(isProtectedManual(staff({ tier: 'free' }), NOW), false, 'manuel ama free → koruma yok');
  assert.equal(isProtectedManual(active(), NOW), false, 'App Store satırı korunmaz');
  assert.equal(isProtectedManual(null, NOW), false);
});

// ── G58-S2 md.4: İzmir teklifi (Fresh yıllık → 2 ücretsiz öğün) ───────────────
const izmirEv = (over: Record<string, unknown> = {}) => ({
  id: 'evt-izmir-1',
  type: 'INITIAL_PURCHASE',
  app_user_id: UID,
  product_id: 'kcalai_fresh_yearly',
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  subscriber_attributes: { offer: { value: 'izmir_fresh', updated_at_ms: NOW } },
  ...over,
});

test('İzmir: Fresh yıllık INITIAL_PURCHASE + offer=izmir_fresh → 2 kupon, ref = olay kimliği', () => {
  assert.deepEqual(izmirOfferDecision(izmirEv()), { action: 'grant', userId: UID, count: 2, ref: 'evt-izmir-1' });
  // Play Store ürün kimliği biçimi
  assert.equal(izmirOfferDecision(izmirEv({ product_id: 'kcalai_fresh:yearly', store: 'PLAY_STORE' })).action, 'grant');
  assert.equal(isFreshYearly('kcalai_fresh_monthly'), false);
  assert.equal(isFreshYearly('kcalai_balance_yearly'), false);
});

test('İzmir: teklif attribute yoksa sunucu teklif kaydı yeterli; ikisi de yoksa kupon yok', () => {
  const noAttr = izmirEv({ subscriber_attributes: {} });
  assert.deepEqual(izmirOfferDecision(noAttr), { action: 'none', reason: 'no_offer' });
  assert.equal(izmirOfferDecision(noAttr, { offerRecorded: true }).action, 'grant');
});

test('İzmir: aylık / Balance / RENEWAL / manuel-promo mağazası / sandbox / anonim → kupon yok', () => {
  assert.equal(izmirOfferDecision(izmirEv({ product_id: 'kcalai_fresh_monthly' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ product_id: 'kcalai_balance_yearly' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ type: 'RENEWAL' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ store: 'PROMOTIONAL' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ store: 'manual' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ environment: 'SANDBOX' })).action, 'none');
  assert.equal(izmirOfferDecision(izmirEv({ app_user_id: '$RCAnonymousID:x' })).action, 'none');
});

test('İzmir: iade/iptal (CANCELLATION) ve EXPIRATION → kullanılmamış kuponlar void', () => {
  assert.deepEqual(izmirOfferDecision(izmirEv({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })), { action: 'void', userId: UID, reason: 'cancel:customer_support' });
  assert.equal(izmirOfferDecision(izmirEv({ type: 'EXPIRATION' })).action, 'void');
});

test('webhook idempotensi: aynı olay iki kez → aynı ref (DB unique + grant_free_meals duplicate); kişi başı bir kez', () => {
  const a = izmirOfferDecision(izmirEv());
  const b = izmirOfferDecision(izmirEv());
  assert.deepEqual(a, b);
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261117210100_g58s2_ucretsiz_ogun_kuponu.sql'), 'utf8');
  assert.match(sql, /constraint free_meal_grants_once unique \(user_id, source, ref\)/);
  assert.match(sql, /create unique index if not exists free_meal_grants_izmir_once\s+on public\.free_meal_grants \(user_id\) where source = 'izmir_fresh'/);
  assert.match(sql, /'duplicate', true/);
  assert.match(sql, /exception when unique_violation then/);
  // Kupon: free_item, tek kullanım, 30 gün, içecek + yan ürün hariç, üst sınır ayardan.
  assert.match(sql, /'free_item', 0, coalesce\(s\.free_meal_max_tl, 0\), 0/);
  assert.match(sql, /p_user, 1, 1,/);
  assert.match(sql, /free_meal_valid_days integer not null default 30/);
  assert.match(sql, /array\['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar'\]/);
  // void yalnız kullanılmamış kuponlar
  assert.match(sql, /not exists \(select 1 from public\.campaign_uses u where u\.campaign_id = c\.id\)/);
  // Yetki ve grant yalnız service_role
  assert.match(sql, /grant execute on function public\.grant_free_meals\(uuid, text, text, integer\) to service_role/);
  const idx = fs.readFileSync(path.join(ROOT, 'supabase/functions/revenuecat-webhook/index.ts'), 'utf8');
  assert.ok(idx.indexOf("from('user_entitlements')\n      .upsert") < idx.indexOf("rpc('grant_free_meals'"), 'yetki önce yazılır; kupon hatası yetkiyi engellemez');
});
