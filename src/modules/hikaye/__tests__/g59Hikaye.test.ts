// G59-S1 — Hikâye: katman serileştirme, 24 sa görünürlük, gizli hesap / engel, görüldü, tepki, anket,
// öne çıkanlar, bayrak kapısı (mock = sunucu kuralları), görüntüleyici gezinmesi, migration + edge metni.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  HIDDEN_STICKER_KINDS,
  bringToFront,
  cleanOverlay,
  erasePaths,
  hasModeratedText,
  inTrashZone,
  nextZ,
  overlaysValid,
  parseOverlays,
  pathD,
  pinchTransform,
  serializeOverlays,
  snapCenter,
  sortByZ,
} from '../overlays';
import {
  activeStories,
  cameraModes,
  classifySwipe,
  firstUnseenIndex,
  formatAgo,
  hoursLeft,
  isStoryActive,
  jumpUser,
  markSeenInTray,
  nextPos,
  orderTray,
  pollPercents,
  prevPos,
  ringState,
  storiesEntryVisible,
  storyDurationMs,
  storyVideoAllowed,
  tapZone,
} from '../rules';
import { createMockStoryClient, emptyWorld, seedStory } from '../mock';
import { normalizeStory } from '../client';
import { storyImagePaths, storyModerationText } from '../../../../supabase/functions/moderate-content/story';
import type { StoryOverlay, TrayItem } from '../types';

const ROOT = join(__dirname, '..', '..', '..', '..');
const MIG = readFileSync(join(ROOT, 'supabase/migrations/20261117220100_g59_hikaye.sql'), 'utf8');
const RB = readFileSync(join(ROOT, 'supabase/rollbacks/20261117220100_g59_hikaye_rollback.sql'), 'utf8');
const EDGE = readFileSync(join(ROOT, 'supabase/functions/moderate-content/index.ts'), 'utf8');

const text = (id: string, z = 0, t = 'Koşu sonrası tabak'): StoryOverlay =>
  ({ id, kind: 'text', x: 0.5, y: 0.4, scale: 1, rotation: 0, z, data: { text: t, font: 'modern', color: 'white', align: 'center', box: true } });
const meal = (id: string): StoryOverlay =>
  ({ id, kind: 'meal', x: 0.4, y: 0.3, scale: 1, rotation: -6, z: 1, data: { name: 'Somon kinoa kase', meal_type: 'lunch', kcal: 520, protein_g: 38, carbs_g: 52, fat_g: 16, image_url: null, show_macros: true, skin: 'light' } });
const poll = (id: string): StoryOverlay =>
  ({ id, kind: 'poll', x: 0.5, y: 0.2, scale: 1, rotation: 0, z: 2, data: { question: 'Bugün meal prep yaptın mı?', options: ['Evet', 'Hayır'], skin: 'light' } });

// ── Katman serileştirme ─────────────────────────────────────────────────────
test('katman: gidiş-dönüş (serialize → JSON → parse) aynı kalır, z sıralı', () => {
  const list = [poll('p1'), text('t1', 0), meal('m1')];
  const out = serializeOverlays(list);
  assert.deepEqual(out.map((o) => o.id), ['t1', 'm1', 'p1']);
  const back = parseOverlays(JSON.parse(JSON.stringify(out)));
  assert.deepEqual(back, out);
  assert.ok(overlaysValid(out));
});

test('katman: gizli türler (müzik / soru / challenge) ve bozuk öğeler düşer; sayılar sınıra çekilir', () => {
  assert.deepEqual([...HIDDEN_STICKER_KINDS], ['music', 'question', 'challenge']);
  const raw = [
    { id: 'm', kind: 'music', x: 0.5, y: 0.5, data: {} },
    { id: 'q', kind: 'question', x: 0.5, y: 0.5, data: {} },
    { id: 'c', kind: 'challenge', x: 0.5, y: 0.5, data: {} },
    { id: 't', kind: 'text', x: 5, y: -1, scale: 99, rotation: 999, z: 3, data: { text: 'merhaba', font: 'x', color: 'nope' } },
    { id: 't2', kind: 'text', x: 0.5, y: 0.5, data: { text: '   ' } },
    { id: 'p', kind: 'poll', x: 0.5, y: 0.5, data: { question: 'S?', options: ['tek'] } },
    'çöp',
  ];
  const out = parseOverlays(raw);
  assert.equal(out.length, 1);
  const t = out[0];
  assert.equal(t.kind, 'text');
  assert.deepEqual([t.x, t.y, t.scale, t.rotation], [1, 0, 4, 360]);
  if (t.kind === 'text') assert.deepEqual([t.data.font, t.data.color, t.data.align], ['modern', 'white', 'center']);
  assert.equal(overlaysValid(raw), false);
});

test('katman: etiket/bahset biçimlenir; anket ≤ 4 seçenek; aynı kimlik bir kez', () => {
  const h = cleanOverlay({ id: 'h', kind: 'hashtag', x: 0.5, y: 0.5, data: { text: 'meal prep' } });
  assert.equal(h?.kind === 'hashtag' && h.data.text, '#mealprep');
  const m = cleanOverlay({ id: 'm', kind: 'mention', x: 0.5, y: 0.5, data: { text: 'Ayşe_K' } });
  assert.ok(m?.kind === 'mention' && m.data.text === '@Ayşe_K' && m.data.handle === 'aye_k');
  const p = cleanOverlay({ id: 'p', kind: 'poll', x: 0.5, y: 0.5, data: { question: 'Q', options: ['a', 'b', 'c', 'd', 'e'] } });
  assert.equal(p?.kind === 'poll' && p.data.options.length, 4);
  assert.equal(parseOverlays([text('a'), text('a')]).length, 1);
});

test('katman: çizim yolları kırpılır (3 ondalık) ve 64 KB tavanı korunur', () => {
  const pts = Array.from({ length: 1600 }, (_, i) => (i % 2 ? 0.123456 : 0.654321));
  const draw: StoryOverlay = { id: 'd', kind: 'draw', x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 0, data: { paths: Array.from({ length: 60 }, () => ({ pts, color: '#B9EF14', width: 10, brush: 'pen' as const })) } };
  const out = serializeOverlays([draw]);
  assert.ok(JSON.stringify(out).length <= 65536);
  const d = out[0];
  assert.ok(d && d.kind === 'draw' && d.data.paths[0].pts[0] === 0.654);
  assert.ok(pathD([0, 0, 0.5, 0.5], 100, 200).startsWith('M0 0 L50 100'));
});

test('katman: silgi yol bazlı; çöp alanı; iki parmak ölçek/açı; ortaya yapışma; öne getir', () => {
  const paths = [{ pts: [0.1, 0.1, 0.2, 0.2], color: '#FFFFFF', width: 6, brush: 'pen' as const }, { pts: [0.8, 0.8], color: '#FFFFFF', width: 6, brush: 'pen' as const }];
  assert.equal(erasePaths(paths, 0.79, 0.8, 0.03).length, 1);
  assert.ok(inTrashZone(0.5, 0.9));
  assert.ok(!inTrashZone(0.2, 0.9));
  assert.deepEqual(pinchTransform({ scale: 1, rotation: 170, dist: 100, angle: 0 }, { dist: 200, angle: 20 }), { scale: 2, rotation: -170 });
  assert.deepEqual(snapCenter(0.51), { v: 0.5, snapped: true });
  const list = [text('a', 0), text('b', 1)];
  assert.equal(nextZ(list), 2);
  assert.deepEqual(sortByZ(bringToFront(list, 'a')).map((o) => o.id), ['b', 'a']);
});

test('denetim: metin katmanı varsa hikâye pending başlar (istemci + sunucu + edge aynı türler)', () => {
  assert.equal(hasModeratedText([meal('m')]), false);
  assert.equal(hasModeratedText([meal('m'), poll('p')]), true);
  assert.equal(storyModerationText([text('t', 0, 'Merhaba'), poll('p'), meal('m')]), 'Merhaba\nBugün meal prep yaptın mı?\nEvet\nHayır');
  assert.deepEqual(storyImagePaths({ media_type: 'image', media_url: 'stories/u/1.jpg', thumb_url: null, overlays: [] }), ['stories/u/1.jpg']);
  assert.deepEqual(storyImagePaths({ media_type: 'video', media_url: 'stories/u/v.mp4', thumb_url: 'stories/u/t.jpg', overlays: [] }), ['stories/u/t.jpg']);
  assert.deepEqual(storyImagePaths({ media_type: 'image', media_url: 'posts/u/1.jpg', thumb_url: null, overlays: [] }), []);
  assert.match(EDGE, /targetType !== 'story'/);
  assert.match(EDGE, /targetType === 'story' \? 'stories'/);
});

// ── 24 saat görünürlük + kurallar ───────────────────────────────────────────
test('24 sa: süresi dolan aktif değil; kalan saat yukarı yuvarlanır; "3 sa" / "3h"', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  assert.equal(isStoryActive({ expires_at: '2026-11-17T12:00:01Z' }, now), true);
  assert.equal(isStoryActive({ expires_at: '2026-11-17T12:00:00Z' }, now), false);
  assert.equal(activeStories([{ expires_at: '2026-11-17T11:00:00Z' }, { expires_at: '2026-11-18T11:00:00Z' }], now).length, 1);
  assert.equal(hoursLeft('2026-11-17T14:10:00Z', now), 3);
  assert.equal(formatAgo('2026-11-17T09:00:00Z', now, 'tr'), '3 sa');
  assert.equal(formatAgo('2026-11-17T11:48:00Z', now, 'en'), '12m');
});

test('tepsi: ben önce, görülmemiş önce, sonra en yeni; halka lime/gri/yok', () => {
  const it = (id: string, unseen: number, latest: string, me = false, count = 1): TrayItem =>
    ({ user_id: id, display_name: id, handle: id, avatar_url: null, story_count: count, unseen_count: unseen, latest_at: latest, is_me: me, is_official: false });
  const out = orderTray([it('a', 0, '2026-11-17T11:00:00Z'), it('b', 2, '2026-11-17T08:00:00Z'), it('me', 0, '', true, 0), it('c', 1, '2026-11-17T10:00:00Z'), it('z', 0, '', false, 0)]);
  assert.deepEqual(out.map((i) => i.user_id), ['me', 'c', 'b', 'a']);
  assert.equal(ringState(out[1]), 'unseen');
  assert.equal(ringState(out[3]), 'seen');
  assert.equal(ringState(out[0]), 'none');
  assert.equal(markSeenInTray(out, 'c', 1)[1].unseen_count, 0);
});

test('görüntüleyici: dokunma bölgeleri (sol 1/3 önceki), sonraki/önceki kişi, süreler, jestler', () => {
  assert.equal(tapZone(130, 393), 'prev');
  assert.equal(tapZone(132, 393), 'next');
  const counts = [2, 0, 3];
  assert.deepEqual(nextPos({ user: 0, story: 0 }, counts), { user: 0, story: 1 });
  assert.deepEqual(nextPos({ user: 0, story: 1 }, counts), { user: 2, story: 0 });
  assert.equal(nextPos({ user: 2, story: 2 }, counts), 'end');
  assert.deepEqual(prevPos({ user: 2, story: 0 }, counts), { user: 0, story: 1 });
  assert.deepEqual(prevPos({ user: 0, story: 0 }, counts), { user: 0, story: 0 });
  assert.deepEqual(jumpUser({ user: 0, story: 1 }, counts, 1), { user: 2, story: 0 });
  assert.equal(jumpUser({ user: 0, story: 0 }, counts, -1), null);
  assert.equal(firstUnseenIndex([{ seen: true }, { seen: false }]), 1);
  assert.equal(firstUnseenIndex([{ seen: true }]), 0);
  assert.equal(storyDurationMs({ media_type: 'image', duration_s: null }), 5000);
  assert.equal(storyDurationMs({ media_type: 'video', duration_s: 75 }), 60000);
  assert.equal(classifySwipe(5, 120), 'down');
  assert.equal(classifySwipe(0, -90), 'up');
  assert.equal(classifySwipe(-80, 10), 'left');
  assert.equal(classifySwipe(4, 4), null);
  assert.deepEqual(pollPercents([1, 2]), [33, 67]);
  assert.deepEqual(pollPercents([0, 0]), [0, 0]);
});

test('bayrak: hikaye kapalıyken giriş yok; video hikâye ayrıca kesfet_video; kamera sekmeleri', () => {
  assert.equal(storiesEntryVisible({ hikaye: false }), false);
  assert.equal(storiesEntryVisible({ hikaye: true }), true);
  assert.equal(storyVideoAllowed({ hikaye: true, kesfet_video: false }), false);
  assert.deepEqual(cameraModes({ kesfet_paylasim: true, kesfet_video: false }), ['post', 'story']);
  assert.deepEqual(cameraModes({ kesfet_paylasim: true, kesfet_video: true }), ['post', 'story', 'reels']);
});

// ── Mock = sunucu kuralları ─────────────────────────────────────────────────
function world() {
  const W = emptyWorld('me');
  W.users.push(
    { id: 'pub', name: 'Açık', handle: 'acik' },
    { id: 'priv', name: 'Gizli', handle: 'gizli', is_private: true },
    { id: 'priv2', name: 'Gizli2', handle: 'gizli2', is_private: true },
    { id: 'blk', name: 'Engelli', handle: 'engelli' },
    { id: 'kcal', name: 'Kcalculate', handle: 'kcalculate', official: true },
    { id: 'stranger', name: 'Yabancı', handle: 'yabanci' },
  );
  W.follows.push(['me', 'pub'], ['me', 'priv'], ['me', 'blk']);
  W.blocks.push(['blk', 'me']);
  seedStory(W, { id: 's-pub-old', author_id: 'pub' }, 30); // 24 saati doldu
  seedStory(W, { id: 's-pub', author_id: 'pub' }, 2);
  seedStory(W, { id: 's-priv', author_id: 'priv' }, 1);
  seedStory(W, { id: 's-priv2', author_id: 'priv2' }, 1); // takip etmiyorum
  seedStory(W, { id: 's-blk', author_id: 'blk' }, 1);
  seedStory(W, { id: 's-kcal', author_id: 'kcal' }, 3); // resmi, takip etmesem de tepside
  seedStory(W, { id: 's-str', author_id: 'stranger' }, 1); // açık ama takip yok → tepside yok
  seedStory(W, { id: 's-me-old', author_id: 'me' }, 26);
  return W;
}

test('tepsi (mock = get_story_tray): 24 sa, gizli hesap yalnız onaylı takipçi, engel, resmi hesap', async () => {
  const c = createMockStoryClient(world());
  const tray = await c.getTray();
  assert.deepEqual(tray.map((t) => t.user_id), ['me', 'priv', 'pub', 'kcal']);
  assert.equal(tray[0].story_count, 0, 'kendi süresi dolmuş hikâyem tepside sayılmaz');
  assert.equal(tray.find((t) => t.user_id === 'pub')?.story_count, 1);
  assert.equal(tray.some((t) => t.user_id === 'blk' || t.user_id === 'priv2' || t.user_id === 'stranger'), false);
  assert.deepEqual(await c.getUserStories({ user: 'priv2' }), []);
  assert.deepEqual(await c.getUserStories({ user: 'blk' }), []);
  assert.deepEqual((await c.getUserStories({ user: 'pub' })).map((s) => s.id), ['s-pub']);
});

test('görüldü + tepki + anket (mock): kendi hikâyen sayılmaz, tek oy, sonuç oy veren/sahibine', async () => {
  const W = world();
  seedStory(W, { id: 's-poll', author_id: 'pub', overlays: [poll('p1')] }, 1);
  const c = createMockStoryClient(W);
  await c.markViewed({ story: 's-pub' });
  await c.markViewed({ story: 's-pub' });
  assert.equal(W.views.filter((v) => v.story === 's-pub').length, 1);
  W.stories.push({ ...W.stories.find((s) => s.id === 's-pub')!, id: 's-mine', author_id: 'me', created_at: new Date(W.now()).toISOString(), expires_at: new Date(W.now() + 3_600_000).toISOString() });
  await c.markViewed({ story: 's-mine' });
  assert.equal(W.views.some((v) => v.story === 's-mine'), false);
  await assert.rejects(c.markViewed({ story: 's-priv2' }), /bulunamadi/);

  await c.react({ story: 's-pub', kind: 'like', on: true });
  await c.react({ story: 's-pub', kind: 'congrats', on: true });
  await c.react({ story: 's-pub', kind: 'like', on: false });
  assert.deepEqual(W.reactions.map((r) => r.kind), ['congrats']);
  await assert.rejects(c.react({ story: 's-mine', kind: 'like', on: true }), /kendi_hikayen/);

  let st = (await c.getUserStories({ user: 'pub' })).find((s) => s.id === 's-poll')!;
  assert.deepEqual(st.poll_results, {}, 'oy vermeden sonuç yok');
  const r1 = await c.votePoll({ story: 's-poll', sticker: 'p1', option: 1 });
  const r2 = await c.votePoll({ story: 's-poll', sticker: 'p1', option: 0 });
  assert.deepEqual(r1, { option: 1, counts: [0, 1] });
  assert.deepEqual(r2, { option: 1, counts: [0, 1] }, 'oy değiştirilemez');
  st = (await c.getUserStories({ user: 'pub' })).find((s) => s.id === 's-poll')!;
  assert.deepEqual(st.poll_results, { p1: [0, 1] });
  assert.deepEqual(st.my_votes, { p1: 1 });
  await assert.rejects(c.votePoll({ story: 's-poll', sticker: 'p1', option: 5 }), /gecersiz_secenek|.*/);
});

test('öğün çıkartması → Günlüğüne ekle (source=story, tekrar-güvenli) + Görenler istatistiği (yalnız sahibi)', async () => {
  const W = world();
  W.stories.push({ ...W.stories[0], id: 's-meal', author_id: 'me', overlays: [meal('m1')], created_at: new Date(W.now()).toISOString(), expires_at: new Date(W.now() + 3_600_000).toISOString() });
  const c = createMockStoryClient(W);
  // izleyici gözünden ekle
  W.me = 'pub';
  W.follows.push(['pub', 'me']);
  await c.stickerTap({ story: 's-meal', sticker: 'm1' });
  const a = await c.addMealToDay({ story: 's-meal', sticker: 'm1', mealType: 'ogle', idempotencyKey: 'k1' });
  const b = await c.addMealToDay({ story: 's-meal', sticker: 'm1', mealType: 'ogle', idempotencyKey: 'k1' });
  assert.equal(a.consumption_id, b.consumption_id);
  assert.deepEqual(W.consumptions.map((x) => [x.source, x.kcal]), [['story', 520]]);
  await c.markViewed({ story: 's-meal' });
  await assert.rejects(c.getViewers({ story: 's-meal' }), /bulunamadi/, 'görenler yalnız sahibine');
  W.me = 'me';
  const v = await c.getViewers({ story: 's-meal' });
  assert.equal(v.views, 1);
  assert.deepEqual(v.stickers.map((s) => [s.kind, s.taps, s.adds]), [['meal', 1, 1]]);
  assert.equal((await c.getViewers({ story: 's-meal', filter: 'reacted' })).viewers.length, 0);
});

test('öne çıkanlar (mock): oluştur/düzenle/kapak/sil; süresi dolan hikâye öne çıkanda görünür; silinen düşer', async () => {
  const W = world();
  const c = createMockStoryClient(W);
  const { highlight_id } = await c.upsertHighlight({ highlight: null, title: 'Meal prep', storyIds: ['s-me-old'] });
  let hl = await c.getHighlights({ user: 'me' });
  assert.equal(hl[0].title, 'Meal prep');
  assert.equal(hl[0].cover_story_id, 's-me-old');
  assert.equal((await c.getHighlightStories({ highlight: highlight_id })).length, 1, '24 saati dolmuş hikâye öne çıkanda');
  await assert.rejects(c.upsertHighlight({ highlight: null, title: 'x'.repeat(17), storyIds: ['s-me-old'] }), /gecersiz_baslik/);
  await assert.rejects(c.upsertHighlight({ highlight: null, title: 'Başka', storyIds: ['s-pub'] }), /gecersiz_oge/, 'yalnız kendi hikâyen');
  seedStory(W, { id: 's-me-new', author_id: 'me' }, 1);
  await c.upsertHighlight({ highlight: highlight_id, title: 'Koşu', storyIds: ['s-me-new', 's-me-old'], coverStory: 's-me-old' });
  hl = await c.getHighlights({ user: 'me' });
  assert.deepEqual([hl[0].title, hl[0].cover_story_id, hl[0].story_ids], ['Koşu', 's-me-old', ['s-me-new', 's-me-old']]);
  await c.deleteMyStory({ story: 's-me-old' });
  hl = await c.getHighlights({ user: 'me' });
  assert.deepEqual([hl[0].count, hl[0].cover_story_id], [1, 's-me-new']);
  await c.deleteHighlight({ highlight: highlight_id });
  assert.deepEqual(await c.getHighlights({ user: 'me' }), []);
  // gizli + takip etmeyen → başkasının öne çıkanları görünmez
  W.highlights.push({ id: 'hx', owner: 'priv2', title: 'G', cover: null, sort: 0, items: ['s-priv2'] });
  assert.deepEqual(await c.getHighlights({ user: 'priv2' }), []);
  assert.deepEqual(await c.getHighlightStories({ highlight: 'hx' }), []);
});

test('oluşturma (mock = create_story): bayrak kapalı → ret; video ayrıca kesfet_video; yol; metin → pending', async () => {
  const W = world();
  const c = createMockStoryClient(W);
  const base = { mediaUrl: 'stories/me/a.jpg', mediaType: 'image' as const, overlays: [] as StoryOverlay[], idempotencyKey: 'i1' };
  W.flags.hikaye = false;
  await assert.rejects(c.createStory(base), /kapali/);
  await assert.rejects(c.upsertHighlight({ highlight: null, title: 'a', storyIds: ['s-me-old'] }), /kapali/);
  W.flags.hikaye = true;
  W.flags.kesfet_video = false;
  await assert.rejects(c.createStory({ ...base, mediaType: 'video', durationS: 10, idempotencyKey: 'v' }), /video_kapali/);
  await assert.rejects(c.createStory({ ...base, mediaUrl: 'posts/me/a.jpg', idempotencyKey: 'y' }), /gecersiz_yol/);
  const a = await c.createStory(base);
  const again = await c.createStory(base);
  assert.deepEqual(a, again);
  assert.ok('status' in a && a.status === 'published');
  const t = await c.createStory({ mediaUrl: null, mediaType: 'none', bg: { kind: 'solid', colors: ['#0A0A0A'] }, overlays: [text('t')], idempotencyKey: 'i2' });
  assert.ok('status' in t && t.status === 'pending');
  W.me = 'pub';
  W.follows.push(['pub', 'me']);
  assert.equal((await c.getUserStories({ user: 'me' })).length, 1, 'pending hikâye başkasına görünmez');
  W.me = 'me';
  await c.moderate({ story: (t as { story_id: string }).story_id });
  W.me = 'pub';
  assert.equal((await c.getUserStories({ user: 'me' })).length, 2, 'denetimden geçince görünür');
});

test('istemci normalizeStory: bozuk katman/zemin güvenli; sayılar', () => {
  const s = normalizeStory({ id: 1, author_id: 'u', media_type: 'none', bg: { kind: 'gradient', colors: ['#000000', 'kırmızı'] }, overlays: '[{"id":"t","kind":"text","x":0.5,"y":0.5,"data":{"text":"a"}},{"kind":"music"}]', duration_s: '12', my_votes: { p: '1' }, poll_results: { p: ['2', 3] } });
  assert.equal(s.overlays.length, 1);
  assert.deepEqual(s.bg, { kind: 'solid', colors: ['#000000'] });
  assert.equal(s.duration_s, 12);
  assert.deepEqual(s.my_votes, { p: 1 });
  assert.deepEqual(s.poll_results, { p: [2, 3] });
});

// ── Migration / rollback metni ──────────────────────────────────────────────
test('migration: bayrak KAPALI, tablolar, RLS, gizlilik/engel tek kural, 24 sa, sahibine görenler', () => {
  assert.match(MIG, /'hikaye', false, 0, '1\.1\.0'/);
  for (const t of ['stories', 'story_views', 'story_reactions', 'story_poll_votes', 'story_highlights', 'story_highlight_items', 'story_sticker_events']) {
    assert.match(MIG, new RegExp(`create table if not exists public\\.${t} \\(`));
    assert.match(MIG, new RegExp(`alter table public\\.${t}\\s+enable row level security`));
  }
  assert.match(MIG, /expires_at\s+timestamptz not null default \(now\(\) \+ interval '24 hours'\)/);
  assert.match(MIG, /public\.feed_can_view_author\(p_viewer, s\.author_id\)/, 'gizli hesap + engel = feed_can_view_author');
  assert.match(MIG, /s\.expires_at > now\(\)\s+or exists \(select 1 from public\.story_highlight_items/);
  assert.match(MIG, /if not found or v_s\.author_id <> v_uid then raise exception 'bulunamadi'/, 'get_story_viewers yalnız sahibi');
  assert.match(MIG, /if not public\.feed_flag_enabled\('hikaye'\) then raise exception 'kapali'/);
  assert.match(MIG, /p_media_type = 'video' and not public\.feed_flag_enabled\('kesfet_video'\)/);
  assert.match(MIG, /'music' — no|music \/ question \/ challenge/);
  const kinds = MIG.slice(MIG.indexOf("if k is null or k not in ("), MIG.indexOf('return false; -- music'));
  assert.ok(kinds.includes("'poll'") && kinds.includes("'meal'"));
  assert.doesNotMatch(kinds, /music|question|challenge/);
  assert.match(MIG, /'manual', 'pantry', 'post', 'ai_scan', 'day_card', 'barcode', 'story'/);
  assert.match(MIG, /check \(target_type in \('post', 'user', 'day_card', 'comment', 'story'\)\)/);
  assert.match(MIG, /\(storage\.foldername\(name\)\)\[1\] = 'stories'/);
  assert.match(MIG, /on conflict \(story_id, sticker_id, user_id\) do nothing/, 'anket tek oy');
  assert.match(MIG, /if v_author = v_uid then return jsonb_build_object\('ok', true, 'own', true\)/, 'kendi hikâyen görüldü sayılmaz');
  // dengeli begin/commit, her fonksiyon kapanıyor
  assert.equal((MIG.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((MIG.match(/^commit;$/gm) ?? []).length, 1);
  assert.equal((MIG.match(/ as \$\$/g) ?? []).length + (MIG.match(/^as \$\$$/gm) ?? []).length, (MIG.match(/^\$\$;$/gm) ?? []).length);
});

test('rollback: G10 report_content / mod_resolve_report gövdeleri birebir, tablolar + bayrak kalkar', () => {
  const g10 = readFileSync(join(ROOT, 'supabase/migrations/20261105000200_g10_fixes.sql'), 'utf8').split('\n');
  const rc = g10.slice(150, 227).join('\n');
  const mr = g10.slice(235, 292).join('\n');
  assert.ok(RB.includes(rc));
  assert.ok(RB.includes(mr));
  assert.match(RB, /drop table if exists public\.stories;/);
  assert.match(RB, /delete from public\.feature_flags where key = 'hikaye';/);
  assert.match(RB, /drop policy if exists story_media_insert on storage\.objects;/);
});
