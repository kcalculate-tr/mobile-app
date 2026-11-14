// G48-S1 md.1 — sepet hesaba özel: SAF sahip geçişi kuralları (store/cartOwner).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANON_OWNER,
  CART_PERSIST_VERSION,
  MAX_PARKED,
  forgetCartOwner,
  migrateCart,
  ownerKeyFor,
  switchCartOwner,
  type OwnedCart,
} from '../cartOwner';
import type { CartItem } from '../../types';

const item = (id: string): CartItem => ({ lineKey: `k${id}`, productId: id, name: `Ürün ${id}`, quantity: 1, unitPrice: 100 }) as CartItem;
const coupon = { code: 'X10', campaignId: '1', discountType: 'fixed', discountValue: 10, discountAmount: 10, title: 'X' } as unknown as OwnedCart['appliedCoupon'];
const start = (): OwnedCart => ({ ownerKey: ANON_OWNER, items: [], appliedCoupon: null, byOwner: {} });
const add = (s: OwnedCart, id: string): OwnedCart => ({ ...s, items: [...s.items, item(id)] });

test('(a) A ekler → çıkar → B girer: B boş; A tekrar girer: A\'nın sepeti (kuponuyla) geri gelir', () => {
  let s = switchCartOwner(start(), 'A');
  s = { ...add(s, '1'), appliedCoupon: coupon };
  s = switchCartOwner(s, ownerKeyFor(null)); // çıkış
  assert.equal(s.ownerKey, ANON_OWNER);
  assert.deepEqual(s.items, []);
  assert.equal(s.appliedCoupon, null);
  s = switchCartOwner(s, 'B');
  assert.equal(s.ownerKey, 'B');
  assert.deepEqual(s.items, [], 'B başkasının sepetini görmez');
  s = switchCartOwner(s, ANON_OWNER);
  s = switchCartOwner(s, 'A');
  assert.deepEqual(s.items.map((i) => i.productId), ['1']);
  assert.deepEqual(s.appliedCoupon, coupon);
  assert.deepEqual(Object.keys(s.byOwner), [], 'canlı sepet kutuda tutulmaz');
});

test('doğrudan hesap değişimi A → B (çıkış olayı olmadan) da A\'nın sepetini gizler', () => {
  let s = add(switchCartOwner(start(), 'A'), '1');
  s = switchCartOwner(s, 'B');
  assert.deepEqual(s.items, []);
  assert.deepEqual(s.byOwner.A.items.map((i) => i.productId), ['1']);
  s = switchCartOwner(s, 'A');
  assert.deepEqual(s.items.map((i) => i.productId), ['1']);
});

test('oturumsuz sepet girişte: hesabın sepeti boşsa taşınır (kupon düşer), doluysa atılır (birleştirme yok)', () => {
  // boş hesap → taşınır
  let s = { ...add(start(), 'g1'), appliedCoupon: coupon };
  s = switchCartOwner(s, 'A');
  assert.deepEqual(s.items.map((i) => i.productId), ['g1']);
  assert.equal(s.appliedCoupon, null);
  // dolu hesap → oturumsuz atılır
  s = switchCartOwner(s, ANON_OWNER);
  s = add(s, 'g2');
  s = switchCartOwner(s, 'A');
  assert.deepEqual(s.items.map((i) => i.productId), ['g1'], 'oturumsuz g2 atıldı, birleşmedi');
  s = switchCartOwner(s, ANON_OWNER);
  assert.deepEqual(s.items, [], 'atılan oturumsuz sepet geri gelmez');
});

test('aynı sahip → değişiklik yok (aynı nesne); oturumsuz sepet hiç saklanmaz', () => {
  const s = add(switchCartOwner(start(), 'A'), '1');
  assert.equal(switchCartOwner(s, 'A'), s);
  const out = switchCartOwner(switchCartOwner(add(start(), 'g'), 'B'), ANON_OWNER);
  assert.equal(out.byOwner[ANON_OWNER], undefined);
});

test('hesap silindi: o hesabın bekleyen sepeti silinir; canlı sepet onunsa boşalır', () => {
  let s = add(switchCartOwner(start(), 'A'), '1');
  s = switchCartOwner(s, ANON_OWNER);
  s = forgetCartOwner(s, 'A');
  assert.equal(s.byOwner.A, undefined);
  s = switchCartOwner(s, 'A');
  assert.deepEqual(s.items, []);
  const live = forgetCartOwner(add(switchCartOwner(start(), 'C'), '9'), 'C');
  assert.deepEqual(live.items, []);
});

test(`en fazla ${MAX_PARKED} hesabın sepeti cihazda bekler (en eskiler düşer)`, () => {
  let s = start();
  for (let i = 0; i < MAX_PARKED + 2; i++) {
    s = add(switchCartOwner(s, `u${i}`), String(i));
    s = switchCartOwner(s, ANON_OWNER);
  }
  assert.equal(Object.keys(s.byOwner).length, MAX_PARKED);
  assert.equal(s.byOwner.u0, undefined);
  assert.equal(s.byOwner.u1, undefined);
  assert.ok(s.byOwner[`u${MAX_PARKED + 1}`]);
});

test('(b) eski sahipsiz `kcal-cart` (v5 ve öncesi) migrate\'te temizlenir; sürüm 6', () => {
  assert.equal(CART_PERSIST_VERSION, 6);
  const old = { items: [item('1')], appliedCoupon: coupon };
  for (const v of [0, 4, 5]) {
    assert.deepEqual(migrateCart(old, v), { ownerKey: ANON_OWNER, items: [], appliedCoupon: null, byOwner: {} });
  }
});
