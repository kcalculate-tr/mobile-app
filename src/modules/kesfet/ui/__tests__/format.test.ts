// Keşfet arayüzü SAF yardımcı + görünüm modeli testleri — "kart render" bir
// gerçek renderer gerektirmeden model seviyesinde doğrulanır (tsx --test).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  postCardModel,
  relativeTime,
  scaleMacros,
  roleBadgeKey,
  mediaItems,
  postLink,
} from '../format';
import type { FeedPost } from '../../types';

function samplePost(over: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'post-1',
    author: {
      id: 'author-7',
      display_name: 'Dyt. Elif',
      handle: 'dyt.elif',
      avatar_url: null,
      role: 'dietitian',
      verified: true,
    },
    published_at: '2026-11-03T09:00:00.000Z',
    lang: 'tr',
    body: 'Dengeli bir tabak.',
    media: [
      { url: 'https://x.invalid/1.jpg', width: 1, height: 1 },
      { url: 'https://x.invalid/2.jpg', width: 1, height: 1 },
    ],
    meal_card: {
      name: 'Tavuk kinoa',
      kcal: 540,
      protein_g: 42,
      carbs_g: 48,
      fat_g: 18,
      portion_label: '1 porsiyon',
      photo_url: null,
      product_id: 'p1',
    },
    quote: null,
    thread: null,
    stats: { likes: 12, saves: 3, adds: 5 },
    me: { liked: false, saved: false },
    ...over,
  };
}

// ── Göreli zaman ──────────────────────────────────────────────────────────────
test('relativeTime: dk / sa / g eşikleri (TR)', () => {
  const base = Date.parse('2026-11-03T12:00:00.000Z');
  assert.equal(relativeTime('2026-11-03T11:59:40.000Z', base, 'tr'), 'şimdi'); // <1 dk
  assert.equal(relativeTime('2026-11-03T11:45:00.000Z', base, 'tr'), '15 dk');
  assert.equal(relativeTime('2026-11-03T09:00:00.000Z', base, 'tr'), '3 sa');
  assert.equal(relativeTime('2026-10-31T12:00:00.000Z', base, 'tr'), '3 g');
});

test('relativeTime: EN birimleri ve geçersiz tarih', () => {
  const base = Date.parse('2026-11-03T12:00:00.000Z');
  assert.equal(relativeTime('2026-11-03T09:00:00.000Z', base, 'en'), '3 h');
  assert.equal(relativeTime('gecersiz', base, 'en'), '');
});

// ── Makro ölçekleme ─────────────────────────────────────────────────────────
test('scaleMacros: porsiyona göre kcal tam, makro 0,1 çözünürlük', () => {
  const card = samplePost().meal_card!;
  assert.deepEqual(scaleMacros(card, 1), { kcal: 540, protein_g: 42, carbs_g: 48, fat_g: 18 });
  assert.deepEqual(scaleMacros(card, 0.5), { kcal: 270, protein_g: 21, carbs_g: 24, fat_g: 9 });
  assert.deepEqual(scaleMacros(card, 1.5), { kcal: 810, protein_g: 63, carbs_g: 72, fat_g: 27 });
});

// ── Rozet eşlemesi ──────────────────────────────────────────────────────────
test('roleBadgeKey: kurum/dietitian/uretici → anahtar; diğer → null', () => {
  assert.equal(roleBadgeKey('kurum'), 'official');
  assert.equal(roleBadgeKey('dietitian'), 'dietitian');
  assert.equal(roleBadgeKey('uretici'), 'producer');
  assert.equal(roleBadgeKey('user'), null);
  assert.equal(roleBadgeKey('pt'), null);
});

// ── Görsel sınırı ───────────────────────────────────────────────────────────
test('mediaItems: en fazla 4', () => {
  const m = (n: number) => ({ url: `${n}`, width: 1, height: 1 });
  const post = samplePost({ media: [m(1), m(2), m(3), m(4), m(5)] });
  assert.equal(mediaItems(post).length, 4);
});

// ── Bağlantı ────────────────────────────────────────────────────────────────
test('postLink: kısa alan adı /p/<id>', () => {
  assert.equal(postLink('abc'), 'https://l.eatkcal.com/p/abc');
});

// ── Kart görünüm modeli ("kart render") ───────────────────────────────────────
test('postCardModel: alanları doğru eşler', () => {
  const now = Date.parse('2026-11-03T12:00:00.000Z');
  const vm = postCardModel(samplePost(), now, 'tr');
  assert.equal(vm.authorName, 'Dyt. Elif');
  assert.equal(vm.handle, 'dyt.elif');
  assert.equal(vm.verified, true);
  assert.equal(vm.badgeKey, 'dietitian');
  assert.equal(vm.isOfficial, false);
  assert.equal(vm.time, '3 sa');
  assert.equal(vm.media.length, 2);
  assert.equal(vm.meal?.name, 'Tavuk kinoa');
  assert.equal(vm.stats.likes, 12);
  assert.equal(vm.link, 'https://l.eatkcal.com/p/post-1');
});

test('postCardModel: kurum rozeti isOfficial=true, metin-only gönderi', () => {
  const now = Date.parse('2026-11-03T12:00:00.000Z');
  const vm = postCardModel(
    samplePost({
      author: { id: 'a', display_name: 'kcal', handle: 'kcal', avatar_url: null, role: 'kurum', verified: true },
      media: [],
      meal_card: null,
    }),
    now,
    'tr',
  );
  assert.equal(vm.badgeKey, 'official');
  assert.equal(vm.isOfficial, true);
  assert.equal(vm.media.length, 0);
  assert.equal(vm.meal, null);
});
