// G60-S1 — Keşfet sıralaması v2: puan (SQL ≡ TS), sıra kurma (keşif yuvası, çeşitlilik), sayfalama
// (tekrar/kayıp yok), dil önceliği, gizlilik süzgeci, bayrak kapalı = eski davranış (store), görüntülenme
// izleyicisi, composer dili. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RANK_CONFIG,
  buildSequence,
  canViewAuthor,
  datasetCandidates,
  orderCandidates,
  pageFrom,
  rankScore,
  rankedFeedPage,
  type DsDataset,
  type RankCandidate,
  type RankCursor,
} from '../ranking';
import { useKesfetStore, feedRequestLang, usesRankedFeed } from '../store';
import { setKesfetClient, resetKesfetClient } from '../client';
import { createMockKesfetClient } from '../mock';
import { createImpressionTracker } from '../impressions';
import { buildCreateInput, defaultPostLang, togglePostLang, type ComposerDraft } from '../composer';
import { FLAG_DEFAULTS } from '../../../core/flags/registry';
import { translate } from '../../../core/i18n/core';
import type { FeedPage, KesfetClient, PostViewItem } from '../types';

const ROOT = join(__dirname, '..', '..', '..', '..');
const MIG = readFileSync(join(ROOT, 'supabase/migrations/20261117230300_g60_get_feed_ranked.sql'), 'utf8');
const FIX = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'g60RankCases.json'), 'utf8')) as {
  cases: Array<{ name: string; input: Parameters<typeof rankScore>[0]; sql: number }>;
};

// ── 1) Puan: SQL ile aynı sonuç (örnek veri seti PGlite'ta SQL ile üretildi) ─────
test('puan: TS rankScore ≡ SQL kesfet_rank_score (14 örnek, |fark| < 1e-12)', () => {
  assert.ok(FIX.cases.length >= 10);
  for (const c of FIX.cases) {
    const got = rankScore(c.input);
    assert.ok(Math.abs(got - c.sql) < 1e-12, `${c.name}: ts=${got} sql=${c.sql}`);
  }
});

test('puan: ağırlıklar SQL ile aynı (kesfet_rank_config + kesfet_rank_score sabitleri)', () => {
  const cfg = MIG.match(/create or replace function public\.kesfet_rank_config[\s\S]*?\$\$;/)![0];
  const num = (k: string) => Number(cfg.match(new RegExp(`'${k}',\\s*([0-9.]+)`))![1]);
  assert.equal(num('fresh_tau_h'), RANK_CONFIG.freshTauH);
  assert.equal(num('new_bonus_h'), RANK_CONFIG.newBonusH);
  assert.equal(num('new_bonus'), RANK_CONFIG.newBonus);
  assert.equal(num('w_add'), RANK_CONFIG.wAdd);
  assert.equal(num('w_save'), RANK_CONFIG.wSave);
  assert.equal(num('w_comment'), RANK_CONFIG.wComment);
  assert.equal(num('w_like'), RANK_CONFIG.wLike);
  assert.equal(num('follow'), RANK_CONFIG.follow);
  assert.equal(num('interacted'), RANK_CONFIG.interacted);
  assert.equal(num('same_city'), RANK_CONFIG.sameCity);
  assert.equal(num('lang_other'), RANK_CONFIG.langOther);
  assert.equal(num('report_penalty'), RANK_CONFIG.reportPenalty);
  assert.equal(num('report_cap'), RANK_CONFIG.reportCap);
  assert.equal(num('max_candidates'), RANK_CONFIG.maxCandidates);
  assert.equal(num('explore_every'), RANK_CONFIG.exploreEvery);
  assert.equal(num('explore_min_weighted'), RANK_CONFIG.exploreMinWeighted);
  assert.equal(num('official_per_page'), RANK_CONFIG.officialPerPage);
  assert.equal(num('page_size'), RANK_CONFIG.pageSize);
  assert.equal(num('lookahead'), RANK_CONFIG.lookahead);
  const fn = MIG.match(/create or replace function public\.kesfet_rank_score[\s\S]*?\$\$;/)![0];
  for (const lit of ['48.0', '< 24', '0.5', '4 *', '3 *', '2 *', '1.5', '1.2', '1.3', '0.35', '0.2', ', 5)']) {
    assert.ok(fn.includes(lit), `SQL puan fonksiyonunda ${lit} yok`);
  }
  // Sıra kurma sabitleri get_feed_ranked gövdesinde.
  for (const lit of ['% 10 = 0', '>= 3', '/ 20', '>= 50', 'limit 500', "interval '30 days'"]) {
    assert.ok(MIG.includes(lit), `get_feed_ranked'te ${lit} yok`);
  }
});

test('puan: formül parçaları (yenilik bonusu, etkileşim, ilişki, yerellik, dil, ceza)', () => {
  const base = { ageH: 0, adds: 0, saves: 0, comments: 0, likes: 0, follows: false, interacted: false, sameCity: false, langMatch: true, reports: 0 };
  assert.equal(rankScore(base), 1.5); // exp(0) + 0,5
  assert.ok(Math.abs(rankScore({ ...base, ageH: 24 }) - Math.exp(-0.5)) < 1e-12); // bonus biter
  assert.ok(Math.abs(rankScore({ ...base, langMatch: false }) - 1.5 * 0.35) < 1e-12); // gizlenmez, ×0,35
  assert.ok(rankScore({ ...base, langMatch: false }) > 0);
  assert.equal(rankScore({ ...base, adds: 1 }), rankScore({ ...base, likes: 4 })); // ekleme = 4 beğeni
  assert.ok(Math.abs(rankScore({ ...base, follows: true, interacted: true, sameCity: true }) - 1.5 * 1.5 * 1.2 * 1.3) < 1e-12);
  assert.ok(Math.abs(rankScore({ ...base, reports: 99 }) - (1.5 - 1.0)) < 1e-12); // ceza en çok 5×0,2
});

// ── 2) Sıra kurma ──────────────────────────────────────────────────────────
const cand = (k: number, p: Partial<RankCandidate> = {}): RankCandidate => ({
  id: `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`,
  authorId: `a${k}`,
  official: false,
  pinned: false,
  publishedAtMs: 1_000_000 + k,
  score: 100 - k,
  weighted: 0,
  otherPlace: false,
  ...p,
});
const ids = (ordered: RankCandidate[], seq: number[]) => seq.map((i) => ordered[i]);

test('sıra: sabitlenmiş her zaman üstte, kendi aralarında yeniye göre', () => {
  const list = [cand(1), cand(2, { pinned: true, publishedAtMs: 5, score: 0 }), cand(3, { pinned: true, publishedAtMs: 9, score: -1 })];
  const o = orderCandidates(list);
  assert.deepEqual(o.map((c) => c.authorId), ['a3', 'a2', 'a1']);
});

test('çeşitlilik: aynı yazardan arka arkaya en çok 2 (uygun aday varken)', () => {
  const list = [
    ...Array.from({ length: 6 }, (_, i) => cand(i, { authorId: 'X' })),
    ...Array.from({ length: 6 }, (_, i) => cand(10 + i)),
  ];
  const o = orderCandidates(list);
  const seq = ids(o, buildSequence(o, o.length));
  for (let i = 2; i < seq.length; i++) {
    const run3 = seq[i].authorId === seq[i - 1].authorId && seq[i].authorId === seq[i - 2].authorId;
    assert.ok(!run3, `konum ${i}: ${seq.map((c) => c.authorId).join(',')}`);
  }
  assert.equal(seq.length, list.length); // kayıp yok
});

test('çeşitlilik: tek yazar kaldıysa akış durmaz (sıradaki alınır)', () => {
  const list = Array.from({ length: 5 }, (_, i) => cand(i, { authorId: 'X' }));
  const o = orderCandidates(list);
  assert.equal(buildSequence(o, 5).length, 5);
});

test('çeşitlilik: resmi hesap (sabitlenmiş dışı) 20\'lik sayfada en çok 3', () => {
  const list = [
    ...Array.from({ length: 10 }, (_, i) => cand(i, { authorId: `off${i}`, official: true, score: 200 - i })),
    ...Array.from({ length: 40 }, (_, i) => cand(100 + i, { score: 100 - i })),
  ];
  const o = orderCandidates(list);
  const seq = ids(o, buildSequence(o, 40));
  assert.equal(seq.slice(0, 20).filter((c) => c.official).length, 3);
  assert.equal(seq.slice(20, 40).filter((c) => c.official).length, 3);
  // Sabitlenmiş resmi gönderiler sınırdan muaf.
  const pinned = [cand(900, { official: true, pinned: true, publishedAtMs: 9e9 }), cand(901, { official: true, pinned: true, publishedAtMs: 8e9 })];
  const o2 = orderCandidates([...pinned, ...list]);
  const s2 = ids(o2, buildSequence(o2, 20));
  assert.equal(s2.slice(0, 2).every((c) => c.pinned), true);
  assert.equal(s2.filter((c) => c.official && !c.pinned).length, 3);
});

test('keşif yuvası: her 10. konumda başka dil/şehir + yüksek etkileşim (zengin daha zengin olmasın)', () => {
  const list = [
    ...Array.from({ length: 30 }, (_, i) => cand(i, { score: 100 - i })),
    cand(500, { score: 1, otherPlace: true, weighted: 40 }), // puanı düşük ama etkileşimi yüksek, başka dil
    cand(501, { score: 0.5, otherPlace: true, weighted: 12 }),
    cand(502, { score: 0.4, otherPlace: true, weighted: 2 }), // eşik altı (< 3) → keşif değil
  ];
  const o = orderCandidates(list);
  const seq = ids(o, buildSequence(o, 25));
  assert.equal(seq[9].authorId, 'a500');
  assert.equal(seq[19].authorId, 'a501');
  assert.ok(!seq.slice(0, 25).some((c) => c.authorId === 'a502'));
});

// ── 3) Veri seti: sayfalama, dil önceliği, gizlilik ─────────────────────────
const H = 3600_000;
const NOW = 1_763_400_000_000;
function dataset(): DsDataset {
  const posts: DsDataset['posts'] = [];
  const authors = ['A', 'B', 'C', 'D', 'E', 'OFF', 'PRIV', 'BLK'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 90; k++) {
    posts.push({
      id: `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`,
      authorId: authors[k % authors.length],
      lang: k % 3 === 0 ? 'en' : 'tr',
      status: k === 5 ? 'hidden' : 'published',
      publishedAtMs: NOW - Math.round(rnd() * 25 * 24 * H) - k,
      pinnedUntilMs: k === 7 ? NOW + H : null,
    });
  }
  posts.push({ id: '00000000-0000-4000-8000-000000009001', authorId: 'V', lang: 'tr', status: 'pending', publishedAtMs: NOW - H });
  posts.push({ id: '00000000-0000-4000-8000-000000009002', authorId: 'A', lang: 'tr', status: 'pending', publishedAtMs: NOW - H });
  const reactions: DsDataset['reactions'] = [];
  for (const p of posts) for (let u = 0; u < 12; u++) if (rnd() < 0.25) reactions.push({ postId: p.id, userId: `u${u}`, kind: rnd() < 0.7 ? 'like' : 'save', createdAtMs: p.publishedAtMs + 1000 });
  return {
    posts,
    reactions,
    adds: [],
    comments: [],
    reports: [],
    follows: [{ follower: 'V', following: 'B', createdAtMs: NOW - 100 * H }],
    blocks: [{ blocker: 'V', blocked: 'BLK' }],
    privateUsers: ['PRIV'],
    addresses: [
      { userId: 'V', city: 'İzmir', isDefault: true, createdAtMs: 0 },
      { userId: 'C', city: 'izmir', isDefault: true, createdAtMs: 0 },
      { userId: 'D', city: 'Berlin', isDefault: true, createdAtMs: 0 },
    ],
    creators: [{ userId: 'OFF', role: 'kurum' }],
  };
}

function allPages(ds: DsDataset, lang: string, limit: number, mutate?: (page: number) => void): string[] {
  const out: string[] = [];
  let cur: RankCursor | null = null;
  for (let page = 0; page < 50; page++) {
    const p = rankedFeedPage(ds, 'V', lang, cur, limit, NOW + page * 60_000);
    out.push(...p.ids);
    if (!p.next) break;
    cur = p.next;
    mutate?.(page);
  }
  return out;
}

test('sayfalama: tekrar yok, kayıp yok (limit 7 ve 20)', () => {
  const ds = dataset();
  const visible = ds.posts.filter(
    (p) => (p.status === 'published' || (p.authorId === 'V' && p.status === 'pending')) && canViewAuthor(ds, 'V', p.authorId),
  ).length;
  for (const limit of [7, 20]) {
    const all = allPages(ds, 'tr', limit);
    assert.equal(new Set(all).size, all.length, 'tekrar');
    assert.equal(all.length, visible, 'kayıp');
  }
});

test('sayfalama: as_of sonrası beğeni, yeni gönderi ve silme altında tekrar/kayıp yok', () => {
  const ds = dataset();
  const before = new Set(ds.posts.map((p) => p.id));
  const all = allPages(ds, 'tr', 10, (page) => {
    if (page === 0) {
      // ikinci sayfanın sonundaki bir adaya çok beğeni (as_of sonrası) + yeni gönderi + silme
      const tail = ds.posts.find((p) => p.status === 'published' && p.authorId === 'E')!;
      for (let u = 0; u < 30; u++) ds.reactions.push({ postId: tail.id, userId: `z${u}`, kind: 'like', createdAtMs: NOW + 10_000 });
      ds.posts.push({ id: '00000000-0000-4000-8000-000000007777', authorId: 'A', lang: 'tr', status: 'published', publishedAtMs: NOW + 5_000 });
      ds.posts.splice(ds.posts.findIndex((p) => p.authorId === 'C' && p.status === 'published'), 1);
    }
  });
  assert.equal(new Set(all).size, all.length, 'tekrar');
  assert.ok(!all.includes('00000000-0000-4000-8000-000000007777'), 'as_of sonrası yeni gönderi bu oturuma girmez');
  const stillVisible = ds.posts.filter(
    (p) => before.has(p.id) && (p.status === 'published' || (p.authorId === 'V' && p.status === 'pending')) && canViewAuthor(ds, 'V', p.authorId),
  );
  for (const p of stillVisible) assert.ok(all.includes(p.id), `kayıp: ${p.id}`);
});

test('pageFrom: son_id bulunamazsa konumdan devam; tam sayfa değilse imleç yok', () => {
  const o = orderCandidates(Array.from({ length: 25 }, (_, i) => cand(i)));
  const p1 = pageFrom(o, null, 10, NOW);
  assert.equal(p1.ids.length, 10);
  assert.ok(p1.next);
  const lost = pageFrom(o, { pos: 10, lastId: 'yok' }, 10, NOW);
  assert.deepEqual(lost.ids, pageFrom(o, p1.next, 10, NOW).ids);
  const last = pageFrom(o, { pos: 20, lastId: o[19].id }, 10, NOW);
  assert.equal(last.ids.length, 5);
  assert.equal(last.next, null);
});

test('dil önceliği: filtre değil öncelik (TR isteği EN gönderiyi gizlemez, ama TR önce)', () => {
  const ds = dataset();
  const byId = new Map(ds.posts.map((p) => [p.id, p] as const));
  const tr = allPages(ds, 'tr', 20);
  const en = allPages(ds, 'en', 20);
  assert.equal(tr.length, en.length); // aynı içerik kümesi
  const share = (list: string[], lang: string) => list.slice(0, 15).filter((id) => byId.get(id)!.lang === lang).length;
  assert.ok(share(tr, 'tr') > share(en, 'tr'), 'TR isteğinde TR daha önde');
  assert.ok(share(en, 'en') > share(tr, 'en'), 'EN isteğinde EN daha önde');
});

test('yerellik + ilişki: aynı şehir ve takip puanı yükseltir', () => {
  const ds = dataset();
  const c = datasetCandidates(ds, 'V', 'tr', NOW);
  const s = (author: string) => c.filter((x) => x.authorId === author);
  const p = ds.posts.find((x) => x.authorId === 'C' && x.status === 'published')!;
  const sameCity = c.find((x) => x.id === p.id)!;
  const ds2 = { ...ds, addresses: ds.addresses.filter((a) => a.userId !== 'C') };
  const noCity = datasetCandidates(ds2, 'V', 'tr', NOW).find((x) => x.id === p.id)!;
  assert.ok(Math.abs(sameCity.score / noCity.score - 1.3) < 1e-9);
  assert.ok(s('B').length > 0);
});

test('gizlilik süzgeci: gizli hesap / engel / hidden / başkasının pending\'i yok; kendi pending var', () => {
  const ds = dataset();
  const all = new Set(allPages(ds, 'tr', 20));
  const byId = new Map(ds.posts.map((p) => [p.id, p] as const));
  const authors = new Set([...all].map((id) => byId.get(id)!.authorId));
  assert.ok(!authors.has('PRIV'), 'gizli hesap (takip yok)');
  assert.ok(!authors.has('BLK'), 'engellenen');
  assert.ok(!all.has(ds.posts[5].id), 'hidden');
  assert.ok(all.has('00000000-0000-4000-8000-000000009001'), 'kendi pending');
  assert.ok(!all.has('00000000-0000-4000-8000-000000009002'), 'başkasının pending');
  // Gizli hesabı takip edince görünür.
  ds.follows.push({ follower: 'V', following: 'PRIV', createdAtMs: NOW - H });
  const after = new Set(allPages(ds, 'tr', 20).map((id) => byId.get(id)!.authorId));
  assert.ok(after.has('PRIV'));
  // Engel iki yönlü.
  assert.equal(canViewAuthor({ ...ds, blocks: [{ blocker: 'A', blocked: 'V' }] }, 'V', 'A'), false);
});

test('SQL: gizlilik süzgeci get_feed ile aynı ifadeler; get_feed\'e dokunulmadı', () => {
  assert.ok(MIG.includes("(p.status = 'published' or (p.author_id = v_uid and p.status = 'pending'))"));
  assert.ok(MIG.includes('public.feed_can_view_author(v_uid, p.author_id)'));
  assert.ok(MIG.includes("public.feed_flag_enabled('kesfet_siralama')"));
  assert.ok(!/function\s+public\.get_feed\s*\(/i.test(MIG));
  assert.ok(MIG.includes("'kesfet_siralama', false, 0, '1.1.0'"));
});

// ── 4) Store: bayrak kapalı = eski davranış birebir; açık = yalnız Keşfet sıralı ──
type Call = { fn: 'getFeed' | 'getFeedRanked'; args: Record<string, unknown> };
function spyClient(opts: { rankedFails?: boolean; withRanked?: boolean } = {}): { client: KesfetClient; calls: Call[] } {
  const base = createMockKesfetClient({ count: 25, followingIndexes: [0, 1, 2] });
  const calls: Call[] = [];
  const client: KesfetClient = {
    ...base,
    async getFeed(p) {
      calls.push({ fn: 'getFeed', args: { ...p } });
      return base.getFeed(p);
    },
  };
  if (opts.withRanked !== false) {
    client.getFeedRanked = async (p): Promise<FeedPage> => {
      calls.push({ fn: 'getFeedRanked', args: { ...p } });
      if (opts.rankedFails) throw new Error('get_feed_ranked: kapali');
      const page = await base.getFeed({ tab: 'for_you', lang: p.lang, cursor: p.cursor ? p.cursor.replace('r:', '') : null, limit: p.limit });
      return { items: page.items.slice().reverse(), next_cursor: page.next_cursor ? `r:${page.next_cursor}` : null };
    };
  }
  return { client, calls };
}

test('store: bayrak KAPALI → yalnız get_feed, dil sabit "tr" (EN uygulamada bile) — eski davranış birebir', async () => {
  useKesfetStore.getState().reset();
  const { client, calls } = spyClient();
  setKesfetClient(client);
  await useKesfetStore.getState().setFeedOptions({ ranked: false, appLang: 'en' });
  await useKesfetStore.getState().load();
  await useKesfetStore.getState().loadMore();
  await useKesfetStore.getState().refresh();
  await useKesfetStore.getState().setTab('following');
  assert.ok(calls.every((c) => c.fn === 'getFeed'));
  assert.deepEqual(
    calls.map((c) => c.args),
    [
      { tab: 'for_you', lang: 'tr', limit: 20 },
      { tab: 'for_you', lang: 'tr', cursor: '20', limit: 20 },
      { tab: 'for_you', lang: 'tr', limit: 20 },
      { tab: 'following', lang: 'tr', limit: 20 },
    ].map((a) => ({ ...a, cursor: (a as { cursor?: string }).cursor ?? null })),
  );
  resetKesfetClient();
});

test('store: bayrak AÇIK → Keşfet get_feed_ranked(uygulama dili), "Sana Özel" kronolojik get_feed', async () => {
  useKesfetStore.getState().reset();
  const { client, calls } = spyClient();
  setKesfetClient(client);
  await useKesfetStore.getState().setFeedOptions({ ranked: true, appLang: 'en' });
  await useKesfetStore.getState().load();
  assert.equal(calls[0].fn, 'getFeedRanked');
  assert.equal(calls[0].args.lang, 'en');
  assert.equal(useKesfetStore.getState().feedSource, 'ranked');
  await useKesfetStore.getState().loadMore();
  assert.equal(calls[1].fn, 'getFeedRanked');
  assert.equal(calls[1].args.cursor, 'r:20');
  assert.equal(useKesfetStore.getState().posts.length, 25);
  assert.equal(new Set(useKesfetStore.getState().posts.map((p) => p.id)).size, 25); // id ile tekil
  await useKesfetStore.getState().setTab('following');
  const last = calls[calls.length - 1];
  assert.equal(last.fn, 'getFeed');
  assert.equal(last.args.tab, 'following');
  assert.equal(last.args.lang, 'en');
  resetKesfetClient();
});

test('store: sıralı akış hata verirse (bayrak sunucuda kapalı / RPC yok) get_feed("tr")ye düşer, sonraki sayfa da eski yoldan', async () => {
  useKesfetStore.getState().reset();
  const { client, calls } = spyClient({ rankedFails: true });
  setKesfetClient(client);
  await useKesfetStore.getState().setFeedOptions({ ranked: true, appLang: 'en' });
  await useKesfetStore.getState().load();
  assert.equal(useKesfetStore.getState().error, null);
  assert.equal(useKesfetStore.getState().feedSource, 'legacy');
  assert.deepEqual(calls.map((c) => c.fn), ['getFeedRanked', 'getFeed']);
  assert.equal(calls[1].args.lang, 'tr');
  await useKesfetStore.getState().loadMore();
  assert.equal(calls[2].fn, 'getFeed');
  assert.equal(calls[2].args.lang, 'tr');
  assert.equal(useKesfetStore.getState().posts.length, 25);
  resetKesfetClient();
});

test('store: getFeedRanked uygulamayan istemci → get_feed; seçenek değişince yüklü akış yenilenir', async () => {
  useKesfetStore.getState().reset();
  const { client, calls } = spyClient({ withRanked: false });
  setKesfetClient(client);
  await useKesfetStore.getState().setFeedOptions({ ranked: true, appLang: 'tr' });
  await useKesfetStore.getState().load();
  assert.equal(calls[0].fn, 'getFeed');
  const n = calls.length;
  await useKesfetStore.getState().setFeedOptions({ ranked: true, appLang: 'tr' }); // aynı → no-op
  assert.equal(calls.length, n);
  await useKesfetStore.getState().setFeedOptions({ ranked: false, appLang: 'tr' }); // bayrak kapandı → eski yoldan yenile
  assert.equal(calls.length, n + 1);
  assert.deepEqual(calls[n].args, { tab: 'for_you', lang: 'tr', cursor: null, limit: 20 });
  await useKesfetStore.getState().setFeedOptions({ ranked: false, appLang: 'en' }); // kapalıyken dil 'tr' kalır → no-op
  assert.equal(calls.length, n + 1);
  await useKesfetStore.getState().setTab('following');
  const m = calls.length;
  await useKesfetStore.getState().setFeedOptions({ ranked: true, appLang: 'en' }); // Sana Özel: dil değişti → yenile
  assert.equal(calls.length, m + 1);
  assert.equal(calls[m].args.lang, 'en');
  assert.equal(calls[m].args.tab, 'following');
  resetKesfetClient();
});

test('feedRequestLang / usesRankedFeed', () => {
  assert.equal(feedRequestLang({ ranked: false, appLang: 'en' }), 'tr');
  assert.equal(feedRequestLang({ ranked: true, appLang: 'en' }), 'en');
  assert.equal(usesRankedFeed({ ranked: true, appLang: 'tr' }, 'for_you'), true);
  assert.equal(usesRankedFeed({ ranked: true, appLang: 'tr' }, 'following'), false);
  assert.equal(usesRankedFeed({ ranked: false, appLang: 'tr' }, 'for_you'), false);
  assert.equal(FLAG_DEFAULTS.kesfet_siralama, false);
});

// ── 5) Görüntülenme izleyicisi ─────────────────────────────────────────────
function fakeTracker(result: 'ok' | 'off' | 'missing' = 'ok') {
  let now = 0;
  const sent: PostViewItem[][] = [];
  const timers: Array<{ fn: () => void; at: number }> = [];
  const tracker = createImpressionTracker({
    now: () => now,
    send: async (items) => {
      sent.push(items);
      return result;
    },
    setTimer: (fn, ms) => {
      const t = { fn, at: now + ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as (typeof timers)[number]);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  return {
    tracker,
    sent,
    timers,
    advance: async (ms: number) => {
      now += ms;
      for (const t of timers.slice()) if (t.at <= now) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
      await new Promise((r) => setImmediate(r));
    },
  };
}

test('görüntülenme: < 1 sn sayılmaz, ≥ 1 sn sayılır; oturumda gönderi başına bir kez', async () => {
  const f = fakeTracker();
  f.tracker.update(['a', 'b']);
  await f.advance(600);
  f.tracker.update(['b']); // a 600 ms → sayılmaz
  await f.advance(900);
  f.tracker.update([]); // b 1500 ms → sayılır
  f.tracker.update(['b', 'a']);
  await f.advance(5000);
  f.tracker.update([]); // b ikinci kez → sayılmaz; a 5000 ms → sayılır
  await f.tracker.flush();
  assert.deepEqual(f.sent.flat(), [
    { post_id: 'b', dwell_ms: 1500 },
    { post_id: 'a', dwell_ms: 5000 },
  ]);
});

test('görüntülenme: 10\'luk paket hemen, aksi hâlde 30 sn sonra gönderilir', async () => {
  const f = fakeTracker();
  for (let i = 0; i < 10; i++) {
    f.tracker.update([`p${i}`]);
    await f.advance(1000);
  }
  f.tracker.update([]);
  await new Promise((r) => setImmediate(r));
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].length, 10);
  f.tracker.update(['x']);
  await f.advance(1200);
  f.tracker.update([]);
  assert.equal(f.sent.length, 1); // beklemede
  await f.advance(30_000);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent[1], [{ post_id: 'x', dwell_ms: 1200 }]);
});

test('görüntülenme: RPC yok / bayrak kapalı → oturumda toplama durur; pause görünenleri kapatır', async () => {
  const f = fakeTracker('missing');
  f.tracker.update(['a']);
  await f.advance(2000);
  f.tracker.pause();
  await f.tracker.flush();
  assert.equal(f.sent.length, 1);
  assert.equal(f.tracker.stats.stopped, true);
  f.tracker.update(['b']);
  await f.advance(5000);
  f.tracker.pause();
  await f.tracker.flush();
  assert.equal(f.sent.length, 1);
});

// ── 6) Composer dili ───────────────────────────────────────────────────────
test('composer: gönderi dili varsayılan uygulama dili, TR/EN seçiciyle değişir, create_post\'a gider', () => {
  assert.equal(defaultPostLang('en'), 'en');
  assert.equal(defaultPostLang('tr'), 'tr');
  assert.equal(defaultPostLang('de'), 'tr');
  assert.equal(togglePostLang('tr'), 'en');
  assert.equal(togglePostLang('en'), 'tr');
  const d: ComposerDraft = { type: 'serbest', body: 'merhaba', photoCount: 0, meal: null, activity: null };
  assert.equal(buildCreateInput(d, [], togglePostLang(defaultPostLang('tr')), 'k').lang, 'en');
});

test('i18n: G60 metinleri TR + EN', () => {
  for (const k of ['compose_lang.label', 'compose_lang.tr_a11y', 'compose_lang.en_a11y', 'compose_lang.hint', 'eatkcal.gate48.top_cities', 'eatkcal.gate48.cities_error', 'eatkcal.gate48.type_city', 'eatkcal.gate48.type_city_hint']) {
    const tr = translate('tr', k);
    const en = translate('en', k);
    assert.ok(tr && !tr.includes('missing') && tr !== k, `tr ${k}`);
    assert.ok(en && !en.includes('missing') && en !== k, `en ${k}`);
    if (!k.endsWith('.tr') && !k.endsWith('.en')) assert.notEqual(tr, en, k);
  }
});
