// G22-S2 md.4 — Keşfet arama saf mantığı + sunucu sözleşmesi (migration metni).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMPTY_RESULTS,
  RECENT_MAX,
  addRecent,
  clearRecent,
  escapeLike,
  handleLabel,
  isSearchable,
  normalizeQuery,
  otherScopes,
  parseRecent,
  postImage,
  postTitle,
  proteinGrams,
  queryCore,
  removeRecent,
  scopeCounts,
  scopeForQuery,
  searchView,
  totalCount,
  type RecentSearch,
} from '../logic';
import { createMockSearchClient } from '../mock';
import { normalizePost, normalizeProfile } from '../client';
import type { SearchPost, SearchResults } from '../types';

const ROOT = path.resolve(__dirname, '../../../../..');

function post(id: string, over: Partial<SearchPost> = {}): SearchPost {
  return {
    id,
    author: { id: 'a', display_name: 'Dyt. Elif', handle: 'dyt.elif', avatar_url: null, role: 'dietitian', verified: true },
    published_at: '2026-11-01T10:00:00.000Z',
    body: 'Gövde ilk satır\nikinci satır',
    post_type: 'ogun',
    meal_card: { name: 'Somon', kcal: 540.4, protein_g: 37.6, carbs_g: 10, fat_g: 20, portion_label: '1', photo_url: 'https://x/mc.jpg', product_id: null },
    media_url: null,
    ...over,
  };
}

// ── Sorgu normalleştirme ────────────────────────────────────────────────────
test('normalizeQuery: boşluk sadeleşir, kırpılır, 64 karakter sınırı', () => {
  assert.equal(normalizeQuery('  yüksek   protein \n kahvaltı  '), 'yüksek protein kahvaltı');
  assert.equal(normalizeQuery(null), '');
  assert.equal(normalizeQuery('a'.repeat(80)).length, 64);
  assert.equal(normalizeQuery('@dyt.elif'), '@dyt.elif');
});

test('isSearchable: @ atılmış çekirdek en az 2 karakter', () => {
  assert.equal(isSearchable(''), false);
  assert.equal(isSearchable(' s '), false);
  assert.equal(isSearchable('@a'), false);
  assert.equal(isSearchable('so'), true);
  assert.equal(isSearchable('@di'), true);
  assert.equal(queryCore('@@diyetisyen'), 'diyetisyen');
});

test('scopeForQuery: @ ile başlayan sorgu Kişi kapsamını açar', () => {
  assert.equal(scopeForQuery('@diyetisyen', 'posts'), 'people');
  assert.equal(scopeForQuery('somon', 'recipes'), 'recipes');
});

test('escapeLike: sunucu search_like_pattern ile aynı kaçış', () => {
  assert.equal(escapeLike('50%_off\\x'), '50\\%\\_off\\\\x');
  assert.equal(escapeLike('somon'), 'somon');
});

// ── Son aramalar ────────────────────────────────────────────────────────────
test('addRecent: başa ekler, TR büyük/küçük harf tekilleştirir, en yeni kazanır', () => {
  let l: RecentSearch[] = [];
  l = addRecent(l, 'somon');
  l = addRecent(l, 'kinoa salata');
  l = addRecent(l, 'SOMON');
  assert.deepEqual(l.map((r) => r.q), ['SOMON', 'kinoa salata']);
  // İ/i TR duyarlı: "İNCİR" ile "incir" aynı kayıt
  l = addRecent(l, 'incir');
  l = addRecent(l, 'İNCİR');
  assert.deepEqual(l.map((r) => r.q), ['İNCİR', 'SOMON', 'kinoa salata']);
});

test('addRecent: en çok N kayıt, kısa/boş sorgu eklenmez, kişi türü korunur', () => {
  let l: RecentSearch[] = [];
  for (let i = 0; i < RECENT_MAX + 3; i++) l = addRecent(l, `sorgu ${i}`);
  assert.equal(l.length, RECENT_MAX);
  assert.equal(l[0].q, `sorgu ${RECENT_MAX + 2}`);
  assert.equal(addRecent(l, ' a ').length, RECENT_MAX);
  const p = addRecent([], '@dyt.elif', 'person');
  assert.deepEqual(p, [{ q: '@dyt.elif', kind: 'person' }]);
  assert.equal(addRecent([], 'x', 'query', 0).length, 0);
});

test('removeRecent / clearRecent', () => {
  const l = [{ q: 'somon', kind: 'query' as const }, { q: '@dyt.elif', kind: 'person' as const }];
  assert.deepEqual(removeRecent(l, 'SOMON'), [{ q: '@dyt.elif', kind: 'person' }]);
  assert.deepEqual(clearRecent(), []);
});

test('parseRecent: bozuk depo → [], sıra korunur, tekilleşir, tür doğrulanır', () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent('{bozuk'), []);
  assert.deepEqual(parseRecent('{"q":"x"}'), []);
  const raw = JSON.stringify([
    { q: 'somon', kind: 'query' },
    { q: '@dyt.elif', kind: 'person' },
    { q: 'Somon', kind: 'query' },
    { q: 5 },
    { q: 'kinoa', kind: 'garip' },
  ]);
  assert.deepEqual(parseRecent(raw), [
    { q: 'somon', kind: 'query' },
    { q: '@dyt.elif', kind: 'person' },
    { q: 'kinoa', kind: 'query' },
  ]);
  assert.equal(parseRecent(raw, 2).length, 2);
});

// ── Sonuçlar ─────────────────────────────────────────────────────────────────
const R: SearchResults = {
  people: [normalizeProfile({ id: 'u1', handle: '@dyt.elif', display_name: 'Elif' })],
  posts: [post('p1'), post('p2')],
  recipes: [],
};

test('scopeCounts / totalCount', () => {
  assert.deepEqual(scopeCounts(R), { people: 1, posts: 2, recipes: 0 });
  assert.equal(totalCount(R), 3);
  assert.equal(totalCount(EMPTY_RESULTS), 0);
});

test('otherScopes: seçili hariç, sonucu olan önce', () => {
  assert.deepEqual(otherScopes('recipes', R), ['people', 'posts']);
  assert.deepEqual(otherScopes('people', { ...R, recipes: [post('r1')], posts: [] }), ['recipes', 'posts']);
  assert.deepEqual(otherScopes('posts', EMPTY_RESULTS), ['people', 'recipes']);
});

test('searchView: son aramalar → yükleniyor → sonuç / sonuç yok / hata', () => {
  const base = { scope: 'posts' as const, loading: false, error: false, resultsFor: null, results: EMPTY_RESULTS };
  assert.equal(searchView({ ...base, query: '' }), 'recent');
  assert.equal(searchView({ ...base, query: 's' }), 'recent');
  assert.equal(searchView({ ...base, query: 'somon', loading: true }), 'loading');
  // eski sorgunun sonucu → hâlâ yükleniyor (bekleme)
  assert.equal(searchView({ ...base, query: 'somon', resultsFor: 'kinoa', results: R }), 'loading');
  assert.equal(searchView({ ...base, query: 'Somon', resultsFor: 'somon', results: R }), 'results');
  assert.equal(searchView({ ...base, query: 'somon', scope: 'recipes', resultsFor: 'somon', results: R }), 'empty');
  assert.equal(searchView({ ...base, query: 'somon', error: true }), 'error');
});

test('kart görünüm yardımcıları', () => {
  assert.equal(postTitle(post('a')), 'Somon');
  assert.equal(postTitle(post('b', { meal_card: null })), 'Gövde ilk satır');
  assert.equal(postImage(post('c')), 'https://x/mc.jpg');
  assert.equal(postImage(post('d', { media_url: 'https://x/m.jpg' })), 'https://x/m.jpg');
  assert.equal(postImage(post('e', { meal_card: null })), null);
  assert.equal(proteinGrams(post('f')), 38);
  assert.equal(proteinGrams(post('g', { meal_card: null })), null);
  assert.equal(handleLabel({ handle: 'dyt.elif' }), '@dyt.elif');
  assert.equal(handleLabel({ handle: '' }), '');
});

test('normalizeProfile / normalizePost: eksik/yanlış alanlar güvenli', () => {
  const p = normalizeProfile({ id: 7, handle: '@x.y', me_following: 'garip', verified: 'evet' });
  assert.deepEqual(p, {
    id: '7', display_name: 'x.y', handle: 'x.y', avatar_url: null, role: 'user',
    verified: false, is_private: false, me_following: 'none',
  });
  const q = normalizePost({ id: 'p', author: { id: 'a', handle: '' }, meal_card: 'x' });
  assert.equal(q.author.handle, null);
  assert.equal(q.author.display_name, 'Kcalculate');
  assert.equal(q.meal_card, null);
  assert.equal(q.post_type, 'serbest');
});

test('mock istemci: @ atılır, tarif yalnız öğün kartlı, hata modu', async () => {
  const c = createMockSearchClient();
  assert.deepEqual((await c.searchProfiles('@pt.c')).map((x) => x.handle), ['pt.can']);
  const posts = await c.searchPosts('protein', 'post');
  const recipes = await c.searchPosts('protein', 'recipe');
  assert.ok(posts.length > recipes.length);
  assert.ok(recipes.every((r) => r.meal_card != null && r.post_type === 'ogun'));
  assert.deepEqual(await c.searchPosts('a', 'post'), []);
  const bad = createMockSearchClient({ fail: true });
  await assert.rejects(() => bad.searchProfiles('somon'));
});

// ── Sunucu sözleşmesi (migration metni; canlıya uygulanmadı) ─────────────────
test('migration: definer + boş search_path, engel/gizlilik süzgeci, kaçış, sınır, grant', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261110100200_g22_s2_search.sql'), 'utf8');
  const rb = fs.readFileSync(path.join(ROOT, 'supabase/rollbacks/20261110100200_g22_s2_search_rollback.sql'), 'utf8');
  for (const fn of ['search_profiles(q text)', "search_posts(q text, p_kind text default 'post')"]) {
    assert.ok(sql.includes(`create or replace function public.${fn}`), fn);
  }
  assert.equal((sql.match(/security definer/g) ?? []).length, 2);
  assert.equal((sql.match(/^set search_path = ''$/gm) ?? []).length, 3);
  assert.equal((sql.match(/public\.feed_can_view_author\(v_uid, /g) ?? []).length, 2);
  assert.match(sql, /po\.status = 'published'/);
  assert.match(sql, /p\.id <> v_uid/);
  assert.match(sql, /errcode = '42501'/);
  assert.match(sql, /replace\(replace\(replace\(left\(n\.v, 64\), '\\', '\\\\'\), '%', '\\%'\), '_', '\\_'\)/);
  assert.equal((sql.match(/limit 24/g) ?? []).length, 2);
  assert.match(sql, /po\.post_type = 'ogun' and po\.meal_card is not null/);
  assert.match(sql, /revoke all on function public\.search_profiles\(text\)\s+from public, anon;/);
  assert.match(sql, /grant execute on function public\.search_profiles\(text\)\s+to authenticated;/);
  assert.match(sql, /grant execute on function public\.search_posts\(text, text\)\s+to authenticated;/);
  assert.doesNotMatch(sql, /to anon/);
  for (const fn of ['search_posts(text, text)', 'search_profiles(text)', 'search_like_pattern(text)']) {
    assert.ok(rb.includes(`drop function if exists public.${fn};`), fn);
  }
});
