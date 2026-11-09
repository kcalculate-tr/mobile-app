// G18-S4 md.4 — Başlangıç içerikleri yalnız GERÇEK kcal (Marka/Editör) gönderilerinden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveInvitedCreators, deriveStarters, isInvitedCreatorRole, starterLabel } from '../starters';
import type { FeedPost } from '../types';

function post(id: string, role: string, opts: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    author: { id: `a-${role}-${id}`, display_name: role, handle: role, avatar_url: null, role, verified: true },
    published_at: '2026-11-08T10:00:00Z',
    lang: 'tr',
    body: 'Haftanın tabağı: tavuk kinoa\nikinci satır',
    media: [{ url: `https://x.invalid/${id}.jpg`, width: 1, height: 1 }],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
    me: {} as FeedPost['me'],
    post_type: 'post' as FeedPost['post_type'],
    status: 'published' as FeedPost['status'],
    activity_card: null,
    ...opts,
  };
}

test('starterLabel: kurum → Marka, moderator → Editör, diğerleri yok', () => {
  assert.equal(starterLabel('kurum'), 'brand');
  assert.equal(starterLabel('moderator'), 'editor');
  assert.equal(starterLabel('diyetisyen'), null);
  assert.equal(starterLabel('user'), null);
});

test('deriveStarters: yalnız kcal gönderileri, görselsiz olan atlanır, başlık ilk satır', () => {
  const out = deriveStarters([
    post('1', 'kurum'),
    post('2', 'user'),
    post('3', 'moderator', { media: [] }),
    post('4', 'moderator', { meal_card: { name: 'Mercimek çorbası', kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1, portion_label: '', photo_url: 'https://x.invalid/m.jpg', product_id: null } }),
  ]);
  assert.deepEqual(out.map((s) => [s.postId, s.label, s.title, s.hasRecipe]), [
    ['1', 'brand', 'Haftanın tabağı: tavuk kinoa', false],
    ['4', 'editor', 'Mercimek çorbası', true],
  ]);
});

test('deriveStarters: veri yoksa boş (bölüm gizli)', () => {
  assert.deepEqual(deriveStarters([]), []);
  assert.deepEqual(deriveStarters([post('1', 'user')]), []);
});

test('davetli üreticiler: rozetli yazarlar (kcal hesapları hariç), tekil', () => {
  assert.equal(isInvitedCreatorRole('diyetisyen'), true);
  assert.equal(isInvitedCreatorRole('kurum'), false);
  const c = deriveInvitedCreators([post('1', 'pt'), post('2', 'pt', { author: post('1', 'pt').author }), post('3', 'kurum')]);
  assert.equal(c.length, 1);
});
