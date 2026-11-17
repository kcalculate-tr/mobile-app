// G57 — İzmir teklifi görünürlük kuralı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowIzmirOffer } from '../izmirOffer';

const base = { signedIn: true, inZone: true, tier: 'free' as const, tierKnown: true, subscriptionsEnabled: true, seen: false };

test('İzmir + giriş + abonelik yok + ilk kez → göster', () => {
  assert.equal(shouldShowIzmirOffer(base), true);
});

test('bölge dışı / misafir / abone / görülmüş / bilinmeyen kademe / abonelik kapalı → gösterme', () => {
  assert.equal(shouldShowIzmirOffer({ ...base, inZone: false }), false);
  assert.equal(shouldShowIzmirOffer({ ...base, signedIn: false }), false);
  assert.equal(shouldShowIzmirOffer({ ...base, tier: 'fresh' }), false);
  assert.equal(shouldShowIzmirOffer({ ...base, seen: true }), false);
  assert.equal(shouldShowIzmirOffer({ ...base, tierKnown: false }), false);
  assert.equal(shouldShowIzmirOffer({ ...base, subscriptionsEnabled: false }), false);
});
