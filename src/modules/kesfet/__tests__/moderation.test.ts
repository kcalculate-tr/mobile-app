// Keşfet store moderasyon testleri — engelle (akıştan düşme + hatada geri alma)
// ve şikayet. Mock istemci enjekte edilir. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { useKesfetStore } from '../store';
import { setKesfetClient, resetKesfetClient } from '../client';
import { createMockKesfetClient } from '../mock';
import type { KesfetClient } from '../types';

function freshStore() {
  useKesfetStore.getState().reset();
}

// ── Engelle: yazarın gönderileri akıştan anında düşer ─────────────────────────
test('blockAuthor: yazarın tüm gönderileri listeden kalkar', async () => {
  freshStore();
  // 7 gönderi; mock yazar id'leri author-0/1/2 döngüsel → author-0 = index 0,3,6.
  setKesfetClient(createMockKesfetClient({ count: 7 }));
  await useKesfetStore.getState().load();
  const before = useKesfetStore.getState().posts.length;
  const byAuthor0 = useKesfetStore.getState().posts.filter((p) => p.author.id === 'author-0').length;
  assert.ok(byAuthor0 > 0, 'önce author-0 gönderileri olmalı');

  const ok = await useKesfetStore.getState().blockAuthor('author-0');
  assert.equal(ok, true);
  const posts = useKesfetStore.getState().posts;
  assert.equal(posts.filter((p) => p.author.id === 'author-0').length, 0, 'author-0 düşmeli');
  assert.equal(posts.length, before - byAuthor0);
  resetKesfetClient();
});

// ── Engelle: RPC hatasında liste geri yüklenir ────────────────────────────────
test('blockAuthor: sunucu hatası → liste geri gelir', async () => {
  freshStore();
  const base = createMockKesfetClient({ count: 7 });
  const failing: KesfetClient = {
    ...base,
    blockUser: async () => {
      throw new Error('ağ hatası');
    },
  };
  setKesfetClient(failing);
  await useKesfetStore.getState().load();
  const before = useKesfetStore.getState().posts.length;
  const ok = await useKesfetStore.getState().blockAuthor('author-1');
  assert.equal(ok, false);
  assert.equal(useKesfetStore.getState().posts.length, before, 'liste geri yüklenmeli');
  assert.ok(useKesfetStore.getState().error, 'hata set edilmeli');
  resetKesfetClient();
});

// ── Şikayet: başarıda true, liste değişmez ────────────────────────────────────
test('report: başarıda true döner, liste değişmez (moderasyon sunucuda)', async () => {
  freshStore();
  setKesfetClient(createMockKesfetClient({ count: 3 }));
  await useKesfetStore.getState().load();
  const before = useKesfetStore.getState().posts.length;
  const ok = await useKesfetStore.getState().report('post', 'post-0', 'spam');
  assert.equal(ok, true);
  assert.equal(useKesfetStore.getState().posts.length, before);
  resetKesfetClient();
});

test('report: sunucu hatası → false + error', async () => {
  freshStore();
  const base = createMockKesfetClient({ count: 3 });
  const failing: KesfetClient = {
    ...base,
    reportContent: async () => {
      throw new Error('red');
    },
  };
  setKesfetClient(failing);
  await useKesfetStore.getState().load();
  const ok = await useKesfetStore.getState().report('post', 'post-0', 'spam');
  assert.equal(ok, false);
  assert.ok(useKesfetStore.getState().error);
  resetKesfetClient();
});
