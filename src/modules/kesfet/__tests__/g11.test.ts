// G11-S3 birim testleri (saf mantık; React/native YOK) — ürün arama + gönderi
// düzenleme istemci sözleşmesi, store.editPost, bayrak kapalı varsayılanı.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { useKesfetStore } from '../store';
import { setKesfetClient, resetKesfetClient } from '../client';
import { createMockKesfetClient } from '../mock';
import { FLAG_DEFAULTS } from '../../../core/flags/registry';

// ── Bayrak kapalı → Keşfet'e giriş yok ───────────────────────────────────────
// AppNavigator `Kesfet` ekranını YALNIZ `kesfet` bayrağı açıkken (ya da __DEV__)
// kaydeder. Yerel varsayılan false olduğu için üretimde bayrak kapalı = giriş yok.
test('kesfet (+ alt) bayrakları yerelde kapalı (bayrak kapalıyken giriş yok)', () => {
  assert.equal(FLAG_DEFAULTS.kesfet, false);
  assert.equal(FLAG_DEFAULTS.kesfet_takip, false);
  assert.equal(FLAG_DEFAULTS.kesfet_paylasim, false);
  assert.equal(FLAG_DEFAULTS.kesfet_yorum, false);
  assert.equal(FLAG_DEFAULTS.kesfet_video, false);
  assert.equal(FLAG_DEFAULTS.sosyal_bildirim, false);
});

// ── Ürün arama (search_products) sözleşmesi ──────────────────────────────────
test('searchProducts: RPC varsa { available:true, items } döner', async () => {
  const client = createMockKesfetClient();
  const res = await client.searchProducts({ q: 'avokado' });
  assert.equal(res.available, true);
  assert.ok(res.items.length > 0);
  // İstemci yalnız sözleşmedeki dönüş şekline güvenir.
  const first = res.items[0];
  for (const k of ['id', 'name', 'image_url', 'kcal', 'protein_g', 'carbs_g', 'fat_g']) {
    assert.ok(k in first, `ürün alanı eksik: ${k}`);
  }
});

test('searchProducts: 2 karakterden kısa sorgu boş döner', async () => {
  const client = createMockKesfetClient();
  const res = await client.searchProducts({ q: 'a' });
  assert.equal(res.available, true);
  assert.equal(res.items.length, 0);
});

test('searchProducts: RPC yoksa { available:false } (düğme gizlenir)', async () => {
  const client = createMockKesfetClient({ productSearchUnavailable: true });
  const res = await client.searchProducts({ q: 'avokado' });
  assert.equal(res.available, false);
  assert.equal(res.items.length, 0);
});

// ── Gönderi düzenleme (update_my_post) + store.editPost ──────────────────────
test('editPost: yayındaki gönderi düzenlenince status pending (İncelemede)', async () => {
  const client = createMockKesfetClient({ count: 3 });
  setKesfetClient(client);
  try {
    const store = useKesfetStore.getState();
    store.reset();
    await store.load();
    const target = useKesfetStore.getState().posts[0];
    assert.equal(target.status, 'published');
    const res = await useKesfetStore.getState().editPost(target.id, 'Güncellenmiş gövde');
    assert.equal(res.available, true);
    assert.equal(res.ok, true);
    assert.equal(res.status, 'pending');
    const after = useKesfetStore.getState().posts.find((p) => p.id === target.id)!;
    assert.equal(after.body, 'Güncellenmiş gövde');
    assert.equal(after.status, 'pending');
  } finally {
    resetKesfetClient();
    useKesfetStore.getState().reset();
  }
});

test('editPost: RPC yoksa { available:false } ve liste değişmez', async () => {
  const client = createMockKesfetClient({ count: 3, postEditUnavailable: true });
  setKesfetClient(client);
  try {
    const store = useKesfetStore.getState();
    store.reset();
    await store.load();
    const target = useKesfetStore.getState().posts[0];
    const originalBody = target.body;
    const res = await useKesfetStore.getState().editPost(target.id, 'Değişmemeli');
    assert.equal(res.available, false);
    const after = useKesfetStore.getState().posts.find((p) => p.id === target.id)!;
    assert.equal(after.body, originalBody);
    assert.equal(after.status, 'published');
  } finally {
    resetKesfetClient();
    useKesfetStore.getState().reset();
  }
});
