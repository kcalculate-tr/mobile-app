// G18-S2 — Ana sayfa Tur 26 saf mantık testleri (native yok).
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCity, isIzmirCoords, resolveHomeRegion } from '../region';
import { buildHomeBanners, bannerIndexFromOffset } from '../banner';
import { pickEatkcalSuggestion } from '../suggest';
import { placePopover, POP_H, POP_W } from '../popoverGeometry';
import { formatPrice } from '../../../../utils/formatPrice';
import type { FeedPost } from '../../../kesfet/types';
import type { Product } from '../../../../types';

// ── Bölge (md.4) ────────────────────────────────────────────────────────────
test('normalizeCity: İzmir yazımları tek anahtara iner', () => {
  for (const c of ['İzmir', 'IZMIR', ' izmir ', 'İZMİR', 'Izmir']) assert.equal(normalizeCity(c), 'izmir');
  assert.equal(normalizeCity(null), '');
});

test('resolveHomeRegion: sıra kayıtlı adres → seçilen il → izinli konum', () => {
  const kordon = { latitude: 38.43, longitude: 27.14 };
  const ankara = { latitude: 39.93, longitude: 32.86 };
  assert.equal(resolveHomeRegion({ addressCity: 'İzmir', chosenCity: 'other', coords: ankara }), 'izmir');
  assert.equal(resolveHomeRegion({ addressCity: 'Ankara', chosenCity: 'izmir', coords: kordon }), 'other');
  assert.equal(resolveHomeRegion({ addressCity: null, chosenCity: 'other', coords: kordon }), 'other');
  assert.equal(resolveHomeRegion({ addressCity: '', chosenCity: null, coords: kordon }), 'izmir');
  assert.equal(resolveHomeRegion({ coords: ankara }), 'other');
  assert.equal(resolveHomeRegion({}), 'unknown');
});

test('isIzmirCoords: Çeşme ve Bergama içeride, Manisa merkez/Aydın dışarıda', () => {
  assert.equal(isIzmirCoords({ latitude: 38.32, longitude: 26.3 }), true);
  assert.equal(isIzmirCoords({ latitude: 39.12, longitude: 27.18 }), true);
  assert.equal(isIzmirCoords({ latitude: 38.61, longitude: 28.6 }), false);
  assert.equal(isIzmirCoords({ latitude: 37.84, longitude: 27.84 }), true);
  assert.equal(isIzmirCoords({ latitude: 37.6, longitude: 27.84 }), false);
});

// ── Banner (md.3 + md.6b) ───────────────────────────────────────────────────
function post(p: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    author: { id: 'a', display_name: 'Ayşe', handle: 'ayse', avatar_url: null, role: 'user', verified: false },
    published_at: '2026-11-09T08:00:00Z',
    lang: 'tr',
    body: '',
    media: [{ url: `https://x/${p.id}.jpg`, width: 1, height: 1, kind: 'image' }],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
    me: {} as FeedPost['me'],
    post_type: 'serbest',
    status: 'published',
    activity_card: null,
    ...p,
  } as FeedPost;
}
const meal = { name: 'Mercimek çorbası', kcal: 220, protein_g: 12, carbs_g: 30, fat_g: 5, portion_label: '1 kase' } as FeedPost['meal_card'];
const posts = [
  post({ id: 'r1', post_type: 'ogun', meal_card: meal, stats: { likes: 9, saves: 0, adds: 0, comments: 0, did_it: 0 } }),
  post({ id: 'f1', body: 'Tavuk kinoa bowl\nayrıntı', stats: { likes: 20, saves: 0, adds: 0, comments: 0, did_it: 0 } }),
  post({ id: 'a1', post_type: 'etkinlik', body: 'Kordon boyunca sabah koşusu' }),
  post({ id: 'nomedia', body: 'Görselsiz', media: [] }),
];
const campaign = { id: 'c1', title: 'Hafta sonu bowl', subtitle: null, image: 'https://x/c.jpg', link: null };

test('banner: sıra tarif → Keşfet → etkinlik → kampanya (İzmir); hedefler doğru', () => {
  const b = buildHomeBanners({ posts, campaign, izmir: true, isNew: false });
  assert.deepEqual(b.map((x) => x.kind), ['recipe', 'featured', 'activity', 'campaign']);
  assert.equal(b[0].title, 'Mercimek çorbası');
  assert.deepEqual(b[0].target, { type: 'post', postId: 'r1' });
  assert.equal(b[1].title, 'Tavuk kinoa bowl');
  assert.equal(b[1].meta, 'Ayşe');
  assert.deepEqual(b[3].target, { type: 'eatkcal', link: null });
});

test('banner: İzmir dışı kampanya yok; yeni kullanıcıya yalnız tarif + Keşfet', () => {
  assert.deepEqual(buildHomeBanners({ posts, campaign, izmir: false, isNew: false }).map((x) => x.kind), ['recipe', 'featured', 'activity']);
  assert.deepEqual(buildHomeBanners({ posts, campaign, izmir: true, isNew: true }).map((x) => x.kind), ['recipe', 'featured']);
});

test('banner: görselsiz içerik ve görselsiz kampanya kart olmaz; veri yoksa boş (bölüm gizli)', () => {
  assert.deepEqual(buildHomeBanners({ posts: [], campaign: null, izmir: true, isNew: false }), []);
  const noImg = buildHomeBanners({ posts: [posts[3]], campaign: { ...campaign, image: null }, izmir: true, isNew: false });
  assert.deepEqual(noImg, []);
});

test('banner: kaydırma konumundan etkin kart (adım 373)', () => {
  assert.equal(bannerIndexFromOffset(0, 373, 4), 0);
  assert.equal(bannerIndexFromOffset(380, 373, 4), 1);
  assert.equal(bannerIndexFromOffset(5000, 373, 4), 3);
  assert.equal(bannerIndexFromOffset(10, 373, 0), 0);
});

// ── İzmir öneri kartı ───────────────────────────────────────────────────────
const prods = [
  { id: 1, name: 'Izgara Somon Bowl', price: 285, img: 'a.jpg', calories: 520, protein: 42, order: 3 },
  { id: 2, name: 'Tavuklu Bowl', price: 240, img: 'b.jpg', calories: 560, protein: 38, order: 1 },
  { id: 3, name: 'Görselsiz', price: 100, calories: 300, protein: 60, order: 0 },
  { id: 4, name: 'Paket', price: 400, img: 'c.jpg', calories: 900, protein: 80, is_bundle: true },
] as Product[];

test('öneri: protein eksikse en proteinli (görselli, paket değil) + gerekçe protein', () => {
  const s = pickEatkcalSuggestion(prods, { proteinLeft: 80, proteinTarget: 140, kcalLeft: 1100, slot: 'dinner' });
  assert.equal(s?.name, 'Izgara Somon Bowl');
  assert.equal(s?.reason, 'protein');
  assert.equal(s?.price, 285);
});

test('öneri: protein yeterliyse menü sırası + yalnız öğün gerekçesi; menü yoksa null', () => {
  const s = pickEatkcalSuggestion(prods, { proteinLeft: 10, proteinTarget: 140, kcalLeft: 1100, slot: 'lunch' });
  assert.equal(s?.name, 'Tavuklu Bowl');
  assert.equal(s?.reason, 'slot');
  assert.equal(pickEatkcalSuggestion([], { proteinLeft: 1, proteinTarget: 1, kcalLeft: 1, slot: 'lunch' }), null);
});

// ── FinMoPopover yerleşimi (md.2) ───────────────────────────────────────────
const WIN = { width: 393, height: 852 };
test('popover: 240 × 293; altta yer varsa alta 4 pt, sol kenar hapla hizalı', () => {
  assert.equal(POP_W, 240);
  assert.equal(POP_H, 293);
  const p = placePopover({ x: 58, y: 200, width: 190, height: 44 }, WIN);
  assert.equal(p.up, false);
  assert.equal(p.top, 248);
  assert.equal(p.left, 58);
  assert.equal(p.originX, 58 + 190 - 22 - 58);
});

test('popover: alt kenara yakınsa (tab bar 100) yukarı açılır', () => {
  const p = placePopover({ x: 58, y: 600, width: 190, height: 44 }, WIN);
  assert.equal(p.up, true);
  assert.equal(p.top, 600 - 4 - 293);
});

test('popover: çapa ekran dışında olsa da menü ekran içinde kalır', () => {
  const p = placePopover({ x: 58, y: 1100, width: 190, height: 44 }, WIN);
  assert.equal(p.top, 852 - 100 - 293);
  const q = placePopover({ x: 58, y: -400, width: 190, height: 44 }, WIN);
  assert.equal(q.top, 48);
});

test('popover: sağa taşarsa sola kayar (16 pt pay)', () => {
  const p = placePopover({ x: 200, y: 200, width: 190, height: 44 }, WIN);
  assert.equal(p.left, 393 - 16 - 240);
});

// ── Fiyat biçimi (G18-ORTAK #12) ────────────────────────────────────────────
test('formatPrice: lira işareti yok, sonunda TL, nokta ayracı yok', () => {
  assert.equal(formatPrice(285), '285 TL');
  assert.equal(formatPrice(285.5), '285,50 TL');
  assert.equal(formatPrice(285.5, { lang: 'en' }), '285,50 TL'); // G18-S5: tek kaynak money.ts, EN aynı
  assert.equal(formatPrice(1250), '1250 TL');
  assert.equal(formatPrice(150, { sign: true }), '+150 TL');
  assert.equal(formatPrice(-20), '-20 TL');
  assert.ok(!formatPrice(99).includes('\u20BA'));
});
