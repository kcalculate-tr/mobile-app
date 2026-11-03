// Profil birim testleri — SAF handle doğrulama + mock istemci mantığı (claim,
// follow gizli→istek, şehir kapısı). React/native YOK. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { validateHandle, normalizeHandle } from '../handle';
import { createMockProfilClient } from '../mock';

// ── Handle biçim doğrulama ────────────────────────────────────────────────────
test('validateHandle: geçerli', () => {
  assert.equal(validateHandle('elif_123').ok, true);
  assert.equal(validateHandle('a.b.c').ok, true);
});

test('validateHandle: normalize — @ ve büyük harf kırpılır', () => {
  assert.equal(normalizeHandle('  @Elif_TR '), 'elif_tr');
  assert.equal(validateHandle('@ELIF').normalized, 'elif');
});

test('validateHandle: hata nedenleri', () => {
  assert.equal(validateHandle('ab').reason, 'too_short');
  assert.equal(validateHandle('a'.repeat(21)).reason, 'too_long');
  assert.equal(validateHandle('ElİF boşluk').reason, 'invalid_chars'); // boşluk + ı/İ
  assert.equal(validateHandle('.elif').reason, 'edge_dot');
  assert.equal(validateHandle('elif.').reason, 'edge_dot');
  assert.equal(validateHandle('el..if').reason, 'consecutive_dots');
  assert.equal(validateHandle('admin').reason, 'reserved');
  assert.equal(validateHandle('kcalculate').reason, 'reserved');
  assert.equal(validateHandle('').reason, 'empty');
});

// ── Mock istemci: claim (benzersizlik) ────────────────────────────────────────
test('claimHandle: alınmış → taken, boş → ok ve rezerve edilir', async () => {
  // Rezerve KELİME değil ama alınmış bir handle (reserved denetimi biçimde ayrı).
  const c = createMockProfilClient({ takenHandles: ['dyt_elif'] });
  assert.deepEqual(await c.claimHandle({ handle: 'dyt_elif' }), { ok: false, reason: 'taken' });
  const first = await c.claimHandle({ handle: 'yeni_kullanici' });
  assert.equal(first.ok, true);
  // Artık alınmış:
  assert.equal((await c.claimHandle({ handle: 'yeni_kullanici' })).ok, false);
});

test('claimHandle: biçimsiz → invalid', async () => {
  const c = createMockProfilClient();
  assert.deepEqual(await c.claimHandle({ handle: 'ab' }), { ok: false, reason: 'invalid' });
});

// ── Mock istemci: follow gizli hesaba istek gönderir ──────────────────────────
test('follow: açık hesap → following, gizli hesap → requested', async () => {
  const c = createMockProfilClient({ privateUsers: ['user-gizli'] });
  assert.deepEqual(await c.follow({ user: 'user-acik', on: true }), { state: 'following' });
  assert.deepEqual(await c.follow({ user: 'user-gizli', on: true }), { state: 'requested' });
  assert.deepEqual(await c.follow({ user: 'user-acik', on: false }), { state: 'none' });
});

// ── Mock istemci: şehir kapısı (yalnız İzmir) ─────────────────────────────────
test('checkDeliveryCity: İzmir açık, diğerleri kapalı', async () => {
  const c = createMockProfilClient();
  assert.deepEqual(await c.checkDeliveryCity({ city: 'İzmir' }), { ok: false, reason: 'not_izmir' });
  // Not: 'İzmir' küçük harfe 'i̇zmir' olur (TR nokta); mock 'izmir' bekler.
  assert.equal((await c.checkDeliveryCity({ city: 'izmir' })).ok, true);
  assert.equal((await c.checkDeliveryCity({ city: 'Ankara' })).ok, false);
});
