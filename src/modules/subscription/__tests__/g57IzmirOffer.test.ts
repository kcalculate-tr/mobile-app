// G57 — İzmir teklifi görünürlük kuralı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IZMIR_OFFER_INTERVAL_MS, izmirOfferDue, shouldShowIzmirOffer } from '../izmirOffer';

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

test('18 Kas: 2 günde bir — hiç gösterilmedi / 48 sa geçti → göster; 48 sa dolmadı → gösterme', () => {
  const now = 1_800_000_000_000;
  assert.equal(izmirOfferDue(null, now), true);
  assert.equal(izmirOfferDue('bozuk', now), true);
  assert.equal(izmirOfferDue(String(now - IZMIR_OFFER_INTERVAL_MS), now), true);
  assert.equal(izmirOfferDue(String(now - IZMIR_OFFER_INTERVAL_MS + 60_000), now), false);
  assert.equal(izmirOfferDue(String(now - 60_000), now), false);
});
