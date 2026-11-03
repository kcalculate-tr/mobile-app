// Keşfet store birim testleri — sekme, imleç sayfalama, iyimser geri alma,
// idempotency. Mock istemci enjekte edilir; native/React render YOK (getState).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { useKesfetStore } from '../store';
import { setKesfetClient, resetKesfetClient } from '../client';
import { createMockKesfetClient } from '../mock';
import type { KesfetClient, ReactResult } from '../types';

function freshStore() {
  useKesfetStore.getState().reset();
}

// ── Sayfalama ────────────────────────────────────────────────────────────────
test('load + loadMore: imleç sayfalama ve hasMore', async () => {
  freshStore();
  // 25 gönderi, sayfa 20 → ilk sayfa 20 + ikinci sayfa 5.
  setKesfetClient(createMockKesfetClient({ count: 25 }));
  await useKesfetStore.getState().load();
  assert.equal(useKesfetStore.getState().posts.length, 20);
  assert.equal(useKesfetStore.getState().hasMore, true);
  await useKesfetStore.getState().loadMore();
  assert.equal(useKesfetStore.getState().posts.length, 25);
  assert.equal(useKesfetStore.getState().hasMore, false);
  // Daha fazla yükleme no-op.
  await useKesfetStore.getState().loadMore();
  assert.equal(useKesfetStore.getState().posts.length, 25);
  resetKesfetClient();
});

test('setTab: sekme değişince liste sıfırlanır ve yeniden yüklenir', async () => {
  freshStore();
  setKesfetClient(createMockKesfetClient({ count: 7, followingIndexes: [0, 1] }));
  await useKesfetStore.getState().load();
  assert.equal(useKesfetStore.getState().posts.length, 7); // for_you = hepsi
  await useKesfetStore.getState().setTab('following');
  assert.equal(useKesfetStore.getState().tab, 'following');
  assert.equal(useKesfetStore.getState().posts.length, 2); // yalnız takip edilenler
  resetKesfetClient();
});

// ── İyimser beğeni + geri alma ────────────────────────────────────────────────
test('react: iyimser beğeni sunucu onayıyla kalıcı', async () => {
  freshStore();
  const mock = createMockKesfetClient({ count: 3 });
  setKesfetClient(mock);
  await useKesfetStore.getState().load();
  const before = useKesfetStore.getState().posts[0].stats.likes;
  await useKesfetStore.getState().react('post-0', 'like', true);
  const p = useKesfetStore.getState().posts.find((x) => x.id === 'post-0')!;
  assert.equal(p.me.liked, true);
  assert.equal(p.stats.likes, before + 1);
  resetKesfetClient();
});

test('react: sunucu hatası → iyimser değişiklik geri alınır', async () => {
  freshStore();
  // getFeed çalışsın ama reactPost patlasın.
  const base = createMockKesfetClient({ count: 3 });
  const failing: KesfetClient = {
    ...base,
    reactPost: async (): Promise<ReactResult> => {
      throw new Error('ağ hatası');
    },
  };
  setKesfetClient(failing);
  await useKesfetStore.getState().load();
  const before = useKesfetStore.getState().posts[0];
  const likedBefore = before.me.liked;
  const likesBefore = before.stats.likes;
  await useKesfetStore.getState().react('post-0', 'like', true);
  const after = useKesfetStore.getState().posts.find((x) => x.id === 'post-0')!;
  assert.equal(after.me.liked, likedBefore, 'me.liked geri alınmalı');
  assert.equal(after.stats.likes, likesBefore, 'stats.likes geri alınmalı');
  assert.ok(useKesfetStore.getState().error, 'hata set edilmeli');
  resetKesfetClient();
});

// ── Günüme ekle: idempotency ──────────────────────────────────────────────────
test('addToDay: aynı anahtar iki kez → tek kayıt, aynı id', async () => {
  freshStore();
  const mock = createMockKesfetClient({ count: 3 });
  setKesfetClient(mock);
  await useKesfetStore.getState().load();
  const key = 'idem-abc';
  const id1 = await useKesfetStore.getState().addToDay('post-1', 'lunch', 1, key);
  const id2 = await useKesfetStore.getState().addToDay('post-1', 'lunch', 1, key);
  assert.equal(id1, id2);
  assert.equal(mock._addedKeys.size, 1, 'sunucuda yalnız bir kayıt');
  resetKesfetClient();
});

test('addToDay: eşzamanlı aynı anahtar → istemci tek kez çağrılır', async () => {
  freshStore();
  let calls = 0;
  const base = createMockKesfetClient({ count: 3 });
  const counting: KesfetClient = {
    ...base,
    addPostMealToDay: async (args) => {
      calls += 1;
      return base.addPostMealToDay(args);
    },
  };
  setKesfetClient(counting);
  await useKesfetStore.getState().load();
  const key = 'idem-concurrent';
  const [a, b] = await Promise.all([
    useKesfetStore.getState().addToDay('post-0', 'dinner', 2, key),
    useKesfetStore.getState().addToDay('post-0', 'dinner', 2, key),
  ]);
  assert.equal(a, b);
  assert.equal(calls, 1, 'eşzamanlı çağrı tek RPC’ye indirgenmeli');
  resetKesfetClient();
});

test('addToDay: farklı anahtar → ayrı kayıt', async () => {
  freshStore();
  const mock = createMockKesfetClient({ count: 3 });
  setKesfetClient(mock);
  await useKesfetStore.getState().load();
  const id1 = await useKesfetStore.getState().addToDay('post-0', 'lunch', 1, 'k1');
  const id2 = await useKesfetStore.getState().addToDay('post-0', 'lunch', 1, 'k2');
  assert.notEqual(id1, id2);
  assert.equal(mock._addedKeys.size, 2);
  resetKesfetClient();
});
