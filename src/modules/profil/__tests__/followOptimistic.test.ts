// G22-S2 md.5 (FinFollowError) — iyimser takip + hata anında geri alma.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTurningOn,
  optimisticFollow,
  runOptimisticFollow,
  settleFollow,
  type FollowSnapshot,
} from '../followOptimistic';
import { translate } from '../../../core/i18n/core';

const open: FollowSnapshot = { me_following: 'none', followers: 10, is_private: false };
const priv: FollowSnapshot = { me_following: 'none', followers: 10, is_private: true };

test('isTurningOn: yalnız none → aç', () => {
  assert.equal(isTurningOn('none'), true);
  assert.equal(isTurningOn('following'), false);
  assert.equal(isTurningOn('requested'), false);
});

test('optimisticFollow: açık hesap → following, sayaç +1', () => {
  assert.deepEqual(optimisticFollow(open), { me_following: 'following', followers: 11, is_private: false });
});

test('optimisticFollow: gizli hesap → requested, sayaç aynı', () => {
  assert.deepEqual(optimisticFollow(priv), { me_following: 'requested', followers: 10, is_private: true });
});

test('optimisticFollow: bırakma → none, sayaç −1 (0 altına inmez)', () => {
  assert.deepEqual(optimisticFollow({ ...open, me_following: 'following' }).me_following, 'none');
  assert.equal(optimisticFollow({ ...open, me_following: 'following' }).followers, 9);
  assert.equal(optimisticFollow({ ...open, me_following: 'following', followers: 0 }).followers, 0);
  // istek geri çekme: sayaç değişmez
  assert.equal(optimisticFollow({ ...priv, me_following: 'requested' }).followers, 10);
});

test('settleFollow: sunucu durumunu öncekinden uzlaştırır', () => {
  assert.equal(settleFollow(open, 'following').followers, 11);
  assert.equal(settleFollow(open, 'requested').followers, 10);
  assert.equal(settleFollow({ ...open, me_following: 'following' }, 'none').followers, 9);
});

test('runOptimisticFollow: başarı → iyimser sonra sunucu durumu', async () => {
  const seen: FollowSnapshot[] = [];
  const res = await runOptimisticFollow(open, async (on) => {
    assert.equal(on, true);
    return { state: 'following' };
  }, (s) => seen.push(s));
  assert.deepEqual(res, { ok: true, state: 'following', turningOn: true });
  assert.equal(seen.length, 2);
  assert.equal(seen[0].me_following, 'following'); // anında
  assert.deepEqual(seen[1], { me_following: 'following', followers: 11, is_private: false });
});

test('runOptimisticFollow: HATA → önceki durum geri gelir (iyimser "Takip ediliyor" kalmaz)', async () => {
  const seen: FollowSnapshot[] = [];
  const res = await runOptimisticFollow(open, async () => {
    throw new Error('follow: network');
  }, (s) => seen.push(s));
  assert.deepEqual(res, { ok: false, turningOn: true });
  assert.equal(seen[0].me_following, 'following');
  assert.deepEqual(seen[seen.length - 1], open);
});

test('runOptimisticFollow: bırakma hatası → yine following', async () => {
  const prev: FollowSnapshot = { ...open, me_following: 'following', followers: 11 };
  const seen: FollowSnapshot[] = [];
  const res = await runOptimisticFollow(prev, async (on) => {
    assert.equal(on, false);
    throw new Error('x');
  }, (s) => seen.push(s));
  assert.equal(res.ok, false);
  assert.equal(seen[0].me_following, 'none');
  assert.deepEqual(seen[seen.length - 1], prev);
});

test('runOptimisticFollow: sunucu gizli hesapta requested döndürürse o yazılır', async () => {
  const seen: FollowSnapshot[] = [];
  await runOptimisticFollow(open, async () => ({ state: 'requested' }), (s) => seen.push(s));
  assert.equal(seen[seen.length - 1].me_following, 'requested');
  assert.equal(seen[seen.length - 1].followers, 10);
});

test('i18n: uyarı TR + EN (FinFollowError S sözlüğü)', () => {
  assert.equal(translate('tr', 'follow_error.failed'), 'Takip edilemedi.');
  assert.equal(translate('en', 'follow_error.failed'), 'Couldn’t follow.');
  assert.equal(translate('tr', 'follow_error.retry'), 'Tekrar dene');
  assert.equal(translate('en', 'follow_error.retry'), 'Try again');
});
