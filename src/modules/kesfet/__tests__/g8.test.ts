// G8 birim testleri — composer doğrulama, etkinlik kcal, yorum iyimser ekle/
// geri al, okunmamış bildirim sayısı, "ben de yaptım" + gönderi silme (iyimser).
// Mock istemci enjekte edilir; native/React render YOK. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { useKesfetStore } from '../store';
import { useCommentsStore } from '../commentsStore';
import { useNotificationsStore } from '../notificationsStore';
import { setKesfetClient, resetKesfetClient } from '../client';
import { createMockKesfetClient } from '../mock';
import { estimateActivityKcal, MET_TABLE, DEFAULT_WEIGHT_KG } from '../activity';
import { validateComposer, activityDraftCard, type ComposerDraft } from '../composer';
import type { AddCommentResult, KesfetClient } from '../types';

// ── Etkinlik kcal (saf) ──────────────────────────────────────────────────────
test('estimateActivityKcal: MET × kilo × saat', () => {
  // koşu 60 dk, 70 kg → 9.8 × 70 × 1 = 686
  assert.equal(estimateActivityKcal('kosu', 60), 686);
  // yürüyüş 30 dk → 3.5 × 70 × 0.5 = 122.5 → 123
  assert.equal(estimateActivityKcal('yuruyus', 30), 123);
  // kilo override
  assert.equal(estimateActivityKcal('kosu', 60, 80), Math.round(MET_TABLE.kosu * 80));
  // varsayılan kilo
  assert.equal(estimateActivityKcal('fitness', 60), Math.round(MET_TABLE.fitness * DEFAULT_WEIGHT_KG));
  // geçersiz / sıfır süre → 0
  assert.equal(estimateActivityKcal('kosu', 0), 0);
  assert.equal(estimateActivityKcal('kosu', -10), 0);
  assert.equal(estimateActivityKcal('kosu', NaN), 0);
});

// ── Composer doğrulama (saf) ─────────────────────────────────────────────────
function draft(over: Partial<ComposerDraft> = {}): ComposerDraft {
  return { type: 'serbest', body: '', photoCount: 0, meal: null, activity: null, ...over };
}

test('validateComposer: serbest metin ya da foto ister', () => {
  assert.equal(validateComposer(draft()), 'empty');
  assert.equal(validateComposer(draft({ body: 'merhaba' })), null);
  assert.equal(validateComposer(draft({ photoCount: 1 })), null);
});

test('validateComposer: öğün ad + kcal ister', () => {
  const m = { name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '', portionLabel: '', productId: null };
  assert.equal(validateComposer(draft({ type: 'ogun', meal: { ...m } })), 'meal_incomplete');
  assert.equal(validateComposer(draft({ type: 'ogun', meal: { ...m, name: 'Tavuk' } })), 'meal_incomplete');
  assert.equal(validateComposer(draft({ type: 'ogun', meal: { ...m, name: 'Tavuk', kcal: '0' } })), 'meal_incomplete');
  assert.equal(validateComposer(draft({ type: 'ogun', meal: { ...m, name: 'Tavuk', kcal: '520' } })), null);
});

test('validateComposer: etkinlik süre ister', () => {
  const a = { type: 'kosu' as const, minutes: '', distanceKm: '', note: '' };
  assert.equal(validateComposer(draft({ type: 'etkinlik', activity: { ...a } })), 'activity_incomplete');
  assert.equal(validateComposer(draft({ type: 'etkinlik', activity: { ...a, minutes: '0' } })), 'activity_incomplete');
  assert.equal(validateComposer(draft({ type: 'etkinlik', activity: { ...a, minutes: '45' } })), null);
});

test('validateComposer: foto üst sınırı + metin uzunluğu', () => {
  assert.equal(validateComposer(draft({ body: 'x', photoCount: 5 })), 'too_many_photos');
  assert.equal(validateComposer(draft({ body: 'a'.repeat(2001) })), 'too_long');
});

test('activityDraftCard: geçersiz süre null, geçerliyse kcal tahmini', () => {
  assert.equal(activityDraftCard({ type: 'kosu', minutes: '', distanceKm: '', note: '' }), null);
  const card = activityDraftCard({ type: 'kosu', minutes: '60', distanceKm: '10', note: 'sabah' });
  assert.ok(card);
  assert.equal(card!.kcal_est, 686);
  assert.equal(card!.distance_km, 10);
  assert.equal(card!.note, 'sabah');
});

// ── Yorum: iyimser ekle / geri al ────────────────────────────────────────────
test('commentsStore.add: iyimser ekleme sunucu onayıyla kalır', async () => {
  useCommentsStore.getState().reset();
  setKesfetClient(createMockKesfetClient({ count: 3 }));
  await useCommentsStore.getState().open('post-0'); // post-0 → 0 yorum
  assert.equal(useCommentsStore.getState().items.length, 0);
  const author = { id: 'me', display_name: 'Ben', handle: 'ben', avatar_url: null, verified: false };
  const id = await useCommentsStore.getState().add('harika', author, null, 'k1');
  assert.ok(id);
  const items = useCommentsStore.getState().items;
  assert.equal(items.length, 1);
  assert.equal(items[0].body, 'harika');
  assert.ok(!items[0].id.startsWith('temp-'), 'geçici id gerçek id ile değişmeli');
  resetKesfetClient();
});

test('commentsStore.add: sunucu hatası → iyimser yorum geri alınır', async () => {
  useCommentsStore.getState().reset();
  const base = createMockKesfetClient({ count: 3 });
  const failing: KesfetClient = {
    ...base,
    addComment: async (): Promise<AddCommentResult> => {
      throw new Error('ağ hatası');
    },
  };
  setKesfetClient(failing);
  await useCommentsStore.getState().open('post-0');
  const before = useCommentsStore.getState().items.length;
  const author = { id: 'me', display_name: 'Ben', handle: 'ben', avatar_url: null, verified: false };
  const id = await useCommentsStore.getState().add('olmaz', author, null, 'k2');
  assert.equal(id, null);
  assert.equal(useCommentsStore.getState().items.length, before, 'geçici yorum kaldırılmalı');
  assert.ok(useCommentsStore.getState().error);
  resetKesfetClient();
});

// ── Bildirim: okunmamış sayısı ───────────────────────────────────────────────
test('notificationsStore: okunmamış sayısı + hepsini okundu yap', async () => {
  useNotificationsStore.getState().reset();
  setKesfetClient(createMockKesfetClient({ unreadCount: 4 }));
  await useNotificationsStore.getState().load();
  assert.equal(useNotificationsStore.getState().unread, 4);
  assert.ok(useNotificationsStore.getState().items.length >= 4);
  await useNotificationsStore.getState().markAllRead();
  assert.equal(useNotificationsStore.getState().unread, 0);
  resetKesfetClient();
});

// ── "Ben de yaptım" + gönderi silme (iyimser) ────────────────────────────────
test('store.didIt: iyimser sayaç + sunucu kcal', async () => {
  useKesfetStore.getState().reset();
  setKesfetClient(createMockKesfetClient({ count: 3, withActivityPost: true }));
  await useKesfetStore.getState().load();
  const activityPost = useKesfetStore.getState().posts.find((p) => p.post_type === 'etkinlik');
  assert.ok(activityPost, 'etkinlik gönderisi olmalı');
  const before = activityPost!.stats.did_it;
  const kcal = await useKesfetStore.getState().didIt(activityPost!.id, null, 'didit-1');
  assert.ok(kcal != null && kcal > 0);
  const after = useKesfetStore.getState().posts.find((p) => p.id === activityPost!.id)!;
  assert.equal(after.stats.did_it, before + 1);
  resetKesfetClient();
});

test('store.deletePost: iyimser olarak akıştan düşer', async () => {
  useKesfetStore.getState().reset();
  setKesfetClient(createMockKesfetClient({ count: 3 }));
  await useKesfetStore.getState().load();
  const n = useKesfetStore.getState().posts.length;
  const ok = await useKesfetStore.getState().deletePost('post-1');
  assert.equal(ok, true);
  assert.equal(useKesfetStore.getState().posts.length, n - 1);
  assert.equal(useKesfetStore.getState().posts.find((p) => p.id === 'post-1'), undefined);
  resetKesfetClient();
});
