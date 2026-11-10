// G22-S1 md.3 — revenuecat-webhook saf eşleme (supabase/functions/revenuecat-webhook/mapping.ts).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorized,
  mapRevenueCatEvent,
  resolveUserId,
  tierFromEvent,
  tierFromProduct,
  type EntitlementRow,
} from '../../../../supabase/functions/revenuecat-webhook/mapping';

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
