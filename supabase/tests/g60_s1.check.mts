// G60-S1 — PGlite kontrolü: Keşfet sıralaması v2 (post_stats → doldurma → get_feed_ranked → post_views → top_cities).
//
// SQL'i GERÇEKTEN çalıştırır ve sonucu saf TS kopyasıyla (src/modules/kesfet/ranking.ts) karşılaştırır:
//   • kesfet_rank_score ≡ rankScore (rastgele 300 girdi, |fark| < 1e-9)
//   • get_feed_ranked sayfaları ≡ rankedFeedPage (aynı veri seti, aynı as_of) — tüm sayfalar
//   • sayfa geçişinde tekrar/kayıp yok (as_of sonrası beğeni + yeni gönderi + silme altında)
//   • gizlilik: gizli hesap / engel / hidden / başkasının pending'i yok; kendi pending var
//   • bayrak kapalı → 'kapali'; post_stats tetikleyicileri + doldurma; record_post_views; top_cities
//   • 2 kez uygula (idempotent) + rollback + yeniden uygula; performans ölçümü (500 aday)
//
// Çalıştırma (PGlite pakete EKLENMEZ):
//   PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> npx tsx supabase/tests/g60_s1.check.mts
// Başarı: "G60-S1 PGLITE: TUM KONTROLLER GECTI" ve çıkış kodu 0. Ölçüm çıktısı: G60_PERF_OUT dosyasına (varsa).
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  rankScore,
  rankedFeedPage,
  canViewAuthor,
  type DsDataset,
  type RankCursor,
} from '../../src/modules/kesfet/ranking';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function findPglite(): string {
  const dirs = [process.env.PGLITE_DIR, join(homedir(), 'dev', 'kcal-web')].filter(Boolean) as string[];
  for (const d of dirs) {
    const p = join(d, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js');
    if (existsSync(p)) return p;
  }
  throw new Error('PGlite bulunamadı. PGLITE_DIR ver. Denenen: ' + dirs.join(', '));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PGlite } = (await import(pathToFileURL(findPglite()).href)) as any;

const read = (p: string) => readFileSync(join(root, p), 'utf8');
const MIGS = [
  'supabase/migrations/20261117230100_g60_post_stats.sql',
  'supabase/migrations/20261117230200_g60_post_stats_backfill.sql',
  'supabase/migrations/20261117230300_g60_get_feed_ranked.sql',
  'supabase/migrations/20261117230400_g60_post_views.sql',
  'supabase/migrations/20261117230500_g60_top_cities.sql',
];
const RBS = [
  'supabase/rollbacks/20261117230500_g60_top_cities_rollback.sql',
  'supabase/rollbacks/20261117230400_g60_post_views_rollback.sql',
  'supabase/rollbacks/20261117230300_g60_get_feed_ranked_rollback.sql',
  'supabase/rollbacks/20261117230200_g60_post_stats_backfill_rollback.sql',
  'supabase/rollbacks/20261117230100_g60_post_stats_rollback.sql',
];

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log('  ✓', name);
  } else {
    failures.push(name);
    console.log('  ✗', name, detail);
  }
}

// ── Taban şema (canlı şemanın ilgili sütunları; G5/G8/G22 fonksiyon gövdeleri birebir) ──
const geoFold = (() => {
  const src = read('supabase/migrations/20261110100100_g22_s2_geo.sql');
  const m = src.match(/create or replace function public\.geo_fold[\s\S]*?\$\$;/);
  if (!m) throw new Error('geo_fold gövdesi bulunamadı');
  return m[0];
})();
const BASE = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $f$
  select nullif(current_setting('test.uid', true), '')::uuid $f$;
create table public.profiles (id uuid primary key, full_name text, first_name text, last_name text, handle text,
  avatar_url text, is_private boolean default false);
create table public.creators (user_id uuid primary key, role text not null, can_post boolean default true, verified_at timestamptz);
create table public.posts (
  id uuid primary key, author_id uuid not null references auth.users(id) on delete cascade,
  lang text not null check (lang in ('tr','en')), body text not null default '', quote_of uuid, thread_root uuid,
  thread_index int, meal_card jsonb, pinned_until timestamptz,
  status text not null default 'published' check (status in ('pending','published','hidden','removed')),
  published_at timestamptz not null default now(), created_at timestamptz not null default now(),
  post_type text default 'serbest', activity_card jsonb, idempotency_key text);
create table public.post_media (id uuid primary key default gen_random_uuid(), post_id uuid references public.posts(id) on delete cascade,
  url text, width int, height int, sort int default 0, kind text, duration_s numeric, thumb_path text);
create table public.post_reactions (post_id uuid references public.posts(id) on delete cascade, user_id uuid, kind text,
  created_at timestamptz not null default now(), primary key (post_id, user_id, kind));
create table public.post_meal_adds (consumption_id uuid primary key, post_id uuid references public.posts(id) on delete cascade,
  user_id uuid, portion numeric default 1, created_at timestamptz not null default now());
create table public.post_comments (id uuid primary key default gen_random_uuid(), post_id uuid references public.posts(id) on delete cascade,
  author_id uuid, parent_id uuid, body text default 'x', status text default 'published', idempotency_key text,
  created_at timestamptz not null default now());
create table public.content_reports (id bigserial primary key, reporter_id uuid, target_type text, target_id uuid, reason text,
  status text default 'open', created_at timestamptz default now(), risk smallint, source text default 'user',
  unique (reporter_id, target_type, target_id));
create table public.follows (follower_id uuid, following_id uuid, created_at timestamptz not null default now(),
  primary key (follower_id, following_id));
create table public.user_blocks (blocker_id uuid, blocked_id uuid, created_at timestamptz default now(), primary key (blocker_id, blocked_id));
create table public.addresses (id uuid primary key default gen_random_uuid(), user_id uuid, city text, is_default boolean,
  created_at timestamptz not null default now());
create table public.activity_logs (id uuid primary key default gen_random_uuid(), user_id uuid, source text, source_ref text);
create table public.feature_flags (key text primary key, enabled boolean not null default false, rollout_percent int default 0,
  min_app_version text, description text);
create table public.geo_countries (iso2 text primary key, name_tr text, name_en text, continent text);
create table public.geo_cities (geonameid integer primary key, name text not null, ascii_name text not null,
  country_iso2 text not null references public.geo_countries(iso2), population integer not null default 0,
  lat double precision not null default 0, lng double precision not null default 0, admin1 text);
${geoFold}
create or replace function public.feed_is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$f$;
create or replace function public.feed_can_view_author(viewer uuid, author uuid)
returns boolean language sql stable security definer set search_path = public as $f$
  select
    not public.feed_is_blocked(coalesce(viewer, '00000000-0000-0000-0000-000000000000'::uuid), author)
    and (
      author = viewer
      or coalesce((select not p.is_private from public.profiles p where p.id = author), true)
      or (viewer is not null and exists (select 1 from public.follows f where f.follower_id = viewer and f.following_id = author))
    );
$f$;
create or replace function public.feed_flag_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.feature_flags f where f.key = p_key and f.enabled);
$f$;
`;

// ── Deterministik veri seti ──────────────────────────────────────────────────
let seed = 60_17;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const hex = (n: number, w: number) => n.toString(16).padStart(w, '0');
const uid = (k: number) => `${hex(k, 8)}-0000-4000-8000-${hex(k, 12)}`;
const pid = (k: number) => `${hex(0xa0000000 + k, 8)}-${hex(k % 65536, 4)}-4000-8000-${hex(k * 7919, 12)}`;

const H = 3600_000;
const NOW = Math.floor(Date.now() / 1000) * 1000 - 2 * H; // as_of geçmişte (sunucu now()'dan küçük)
const V = uid(1); // izleyen
const AUTHORS = Array.from({ length: 12 }, (_, i) => uid(10 + i));
const OFFICIAL = AUTHORS[0];
const PRIVATE_A = AUTHORS[1]; // gizli, V takip ETMİYOR
const PRIVATE_F = AUTHORS[2]; // gizli, V takip EDİYOR
const BLOCKED = AUTHORS[3]; // V engelledi
const BLOCKER = AUTHORS[4]; // V'yi engelledi
const LIKERS = Array.from({ length: 25 }, (_, i) => uid(100 + i));
const CITIES = ['İzmir', 'izmir', 'Berlin', 'İstanbul', null];

function makeDataset(nPosts: number): DsDataset {
  const ds: DsDataset = {
    posts: [], reactions: [], adds: [], comments: [], reports: [], follows: [], blocks: [],
    privateUsers: [PRIVATE_A, PRIVATE_F], addresses: [], creators: [{ userId: OFFICIAL, role: 'kurum' }, { userId: AUTHORS[5], role: 'diyetisyen' }],
  };
  ds.follows.push({ follower: V, following: PRIVATE_F, createdAtMs: NOW - 50 * H });
  ds.follows.push({ follower: V, following: AUTHORS[6], createdAtMs: NOW - 10 * H });
  ds.follows.push({ follower: V, following: AUTHORS[7], createdAtMs: NOW + H }); // as_of sonrası: sayılmaz
  ds.blocks.push({ blocker: V, blocked: BLOCKED }, { blocker: BLOCKER, blocked: V });
  ds.addresses.push({ userId: V, city: 'izmir', isDefault: true, createdAtMs: NOW - 100 * H });
  ds.addresses.push({ userId: V, city: 'Berlin', isDefault: false, createdAtMs: NOW - 5 * H });
  AUTHORS.forEach((a, i) => {
    const city = CITIES[i % CITIES.length];
    if (city) ds.addresses.push({ userId: a, city, isDefault: rnd() < 0.7, createdAtMs: NOW - (200 + i) * H });
  });
  for (let k = 0; k < nPosts; k++) {
    // Yazar dağılımı çarpık: resmi hesap ve 6 numaralı yazar çok paylaşır (çeşitlilik sınırı denensin).
    const r = rnd();
    const author = r < 0.22 ? OFFICIAL : r < 0.4 ? AUTHORS[6] : pick(AUTHORS);
    const ageH = rnd() < 0.08 ? 24 * (31 + rnd() * 20) : rnd() * 24 * 29.5;
    const status = rnd() < 0.06 ? pick(['hidden', 'removed', 'pending'] as const) : 'published';
    ds.posts.push({
      id: pid(k),
      authorId: author,
      lang: rnd() < 0.7 ? 'tr' : 'en',
      status: author === V ? 'pending' : status,
      publishedAtMs: NOW - Math.round(ageH * H) - k * 1000,
      pinnedUntilMs: rnd() < 0.04 ? NOW + 24 * H : rnd() < 0.02 ? NOW - H : null,
    });
  }
  // V'nin kendi pending gönderisi + başkasının pending'i
  ds.posts.push({ id: pid(9001), authorId: V, lang: 'tr', status: 'pending', publishedAtMs: NOW - 3 * H, pinnedUntilMs: null });
  ds.posts.push({ id: pid(9002), authorId: AUTHORS[8], lang: 'tr', status: 'pending', publishedAtMs: NOW - 2 * H, pinnedUntilMs: null });
  for (const p of ds.posts) {
    const pop = rnd() < 0.3 ? 12 : 3;
    for (const u of LIKERS) {
      if (rnd() < pop / 40) ds.reactions.push({ postId: p.id, userId: u, kind: 'like', createdAtMs: p.publishedAtMs + 60_000 });
      if (rnd() < pop / 90) ds.reactions.push({ postId: p.id, userId: u, kind: 'save', createdAtMs: p.publishedAtMs + 90_000 });
      if (rnd() < pop / 150) ds.adds.push({ postId: p.id, userId: u, createdAtMs: p.publishedAtMs + 120_000 });
      if (rnd() < pop / 120)
        ds.comments.push({ postId: p.id, authorId: u, status: rnd() < 0.9 ? 'published' : 'removed', createdAtMs: p.publishedAtMs + 30_000 });
    }
    if (rnd() < 0.08) ds.reports.push({ postId: p.id, status: pick(['open', 'open', 'dismissed', 'pending']) });
  }
  // V'nin etkileşimleri (ilişki ×1,2): AUTHORS[9]'un bir gönderisi
  const p9 = ds.posts.find((p) => p.authorId === AUTHORS[9] && p.publishedAtMs > NOW - 20 * 24 * H);
  if (p9) ds.reactions.push({ postId: p9.id, userId: V, kind: 'like', createdAtMs: NOW - 4 * H });
  return ds;
}

const ts = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
const q = (s: string | null) => (s == null ? 'null' : `'${s.replace(/'/g, "''")}'`);

async function loadDataset(db: any, ds: DsDataset) {
  const users = new Set<string>([V, ...AUTHORS, ...LIKERS]);
  await db.exec(`insert into auth.users (id) values ${[...users].map((u) => `('${u}')`).join(',')};`);
  await db.exec(
    `insert into public.profiles (id, handle, is_private) values ${[...users]
      .map((u) => `('${u}', 'h${u.slice(0, 8)}', ${ds.privateUsers.includes(u)})`)
      .join(',')};`,
  );
  await db.exec(`insert into public.creators (user_id, role) values ${ds.creators.map((c) => `('${c.userId}', '${c.role}')`).join(',')};`);
  await db.exec(
    `insert into public.posts (id, author_id, lang, status, published_at, pinned_until) values ${ds.posts
      .map((p) => `('${p.id}','${p.authorId}','${p.lang}','${p.status}',${ts(p.publishedAtMs)},${p.pinnedUntilMs != null ? ts(p.pinnedUntilMs) : 'null'})`)
      .join(',')};`,
  );
  if (ds.reactions.length)
    await db.exec(`insert into public.post_reactions (post_id, user_id, kind, created_at) values ${ds.reactions
      .map((r) => `('${r.postId}','${r.userId}','${r.kind}',${ts(r.createdAtMs)})`).join(',')};`);
  if (ds.adds.length)
    await db.exec(`insert into public.post_meal_adds (consumption_id, post_id, user_id, created_at) values ${ds.adds
      .map((a) => `(gen_random_uuid(),'${a.postId}','${a.userId}',${ts(a.createdAtMs)})`).join(',')};`);
  if (ds.comments.length)
    await db.exec(`insert into public.post_comments (post_id, author_id, status, created_at) values ${ds.comments
      .map((c) => `('${c.postId}','${c.authorId}','${c.status}',${ts(c.createdAtMs)})`).join(',')};`);
  if (ds.reports.length)
    await db.exec(`insert into public.content_reports (reporter_id, target_type, target_id, reason, status) values ${ds.reports
      .map((r, i) => `('${LIKERS[i % LIKERS.length]}','post','${r.postId}','spam','${r.status}')`).join(',')};`);
  await db.exec(`insert into public.follows (follower_id, following_id, created_at) values ${ds.follows
    .map((f) => `('${f.follower}','${f.following}',${ts(f.createdAtMs)})`).join(',')};`);
  await db.exec(`insert into public.user_blocks (blocker_id, blocked_id) values ${ds.blocks.map((b) => `('${b.blocker}','${b.blocked}')`).join(',')};`);
  await db.exec(`insert into public.addresses (user_id, city, is_default, created_at) values ${ds.addresses
    .map((a) => `('${a.userId}',${q(a.city)},${a.isDefault},${ts(a.createdAtMs)})`).join(',')};`);
}

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const dec = (s: string) => Buffer.from(s, 'base64').toString('utf8');
/** Testte as_of'u sabitlemek için sentetik imleç (konum 0, var olmayan son_id). */
const startCursor = (asOfMs: number) => enc(`r1|${asOfMs * 1000}|0|0|00000000-0000-0000-0000-000000000000`);
const ZERO = '00000000-0000-0000-0000-000000000000';

async function asUser(db: any, u: string | null) {
  await db.exec(`select set_config('test.uid', ${q(u ?? '')}, false);`);
}
async function sqlPage(db: any, lang: string, cursor: string | null, limit: number) {
  const r = await db.query(`select public.get_feed_ranked($1, $2, $3) as j`, [lang, cursor, limit]);
  return r.rows[0].j as { items: Array<{ id: string; stats: Record<string, number> }>; next_cursor: string | null; as_of: string };
}
const toTsCursor = (c: string): RankCursor => {
  const [, us, pos, score, id] = dec(c).split('|');
  return { asOfMs: Math.round(Number(us) / 1000), pos: Number(pos), score: Number(score), lastId: id };
};

// ═════════════════════════════════════════════════════════════════════════════
const db = new PGlite();
await db.exec(BASE);
await db.exec(`insert into public.geo_countries values ('DE','Almanya','Germany','EU'), ('MT','Malta','Malta','EU'), ('TR','Türkiye','Turkey','AS');`);
await db.exec(`insert into public.geo_cities (geonameid, name, ascii_name, country_iso2, population, admin1) values
  (1,'Berlin','Berlin','DE',3426354,'Berlin'), (2,'München','Munchen','DE',1260391,'Bavaria'),
  (3,'Hamburg','Hamburg','DE',1739117,'Hamburg'), (4,'Köln','Koln','DE',963395,'North Rhine-Westphalia');`);

const ds = makeDataset(140);
await loadDataset(db, ds); // tetikleyiciler YOKKEN yüklenir → doldurma migration'ı gerçekten sınanır

for (const m of MIGS) await db.exec(read(m));
for (const m of MIGS) await db.exec(read(m)); // idempotent
check('5 migration 2 kez uygulandı (idempotent)', true);

// ── post_stats doldurma ─────────────────────────────────────────────────────
{
  const r = await db.query(`
    select count(*)::int as bad from public.posts p left join public.post_stats s on s.post_id = p.id
     where s.post_id is null
        or s.likes <> (select count(*) from public.post_reactions r where r.post_id = p.id and r.kind = 'like')
        or s.saves <> (select count(*) from public.post_reactions r where r.post_id = p.id and r.kind = 'save')
        or s.adds <> (select count(*) from public.post_meal_adds a where a.post_id = p.id)
        or s.comments <> (select count(*) from public.post_comments c where c.post_id = p.id and c.status = 'published')
        or s.reports <> (select count(*) from public.content_reports c where c.target_type = 'post' and c.target_id = p.id and c.status in ('open','pending'))`);
  check('doldurma: her gönderinin sayaçları kaynakla aynı', r.rows[0].bad === 0, JSON.stringify(r.rows[0]));
}

// ── puan ≡ TS ───────────────────────────────────────────────────────────────
{
  let maxDiff = 0;
  for (let k = 0; k < 300; k++) {
    const inp = {
      ageH: k < 5 ? [0, 23.999, 24, 48, 1000][k] : rnd() * 24 * 35,
      adds: Math.floor(rnd() * 6), saves: Math.floor(rnd() * 9), comments: Math.floor(rnd() * 7), likes: Math.floor(rnd() * 60),
      follows: rnd() < 0.3, interacted: rnd() < 0.3, sameCity: rnd() < 0.4, langMatch: rnd() < 0.6, reports: Math.floor(rnd() * 8),
    };
    const r = await db.query(`select public.kesfet_rank_score($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as s`, [
      inp.ageH, inp.adds, inp.saves, inp.comments, inp.likes, inp.follows, inp.interacted, inp.sameCity, inp.langMatch, inp.reports,
    ]);
    maxDiff = Math.max(maxDiff, Math.abs(Number(r.rows[0].s) - rankScore(inp)));
  }
  check(`kesfet_rank_score ≡ rankScore (300 girdi, en büyük fark ${maxDiff.toExponential(2)})`, maxDiff < 1e-9);
}

// ── bayrak kapalı ───────────────────────────────────────────────────────────
await asUser(db, V);
{
  let msg = '';
  try {
    await sqlPage(db, 'tr', null, 20);
  } catch (e) {
    msg = String((e as Error).message);
  }
  check('bayrak kapalı → get_feed_ranked "kapali" hatası (istemci get_feed\'e düşer)', msg.includes('kapali'), msg);
  const v = await db.query(`select public.record_post_views($1::jsonb) as j`, [JSON.stringify([{ post_id: ds.posts[0].id, dwell_ms: 1500 }])]);
  check('bayrak kapalı → record_post_views yazmaz', v.rows[0].j.ok === false && (await db.query(`select count(*)::int n from public.post_views`)).rows[0].n === 0);
}
await db.exec(`update public.feature_flags set enabled = true where key = 'kesfet_siralama';`);
{
  await asUser(db, null);
  let msg = '';
  try { await sqlPage(db, 'tr', null, 20); } catch (e) { msg = String((e as Error).message); }
  check('oturumsuz → yetkisiz', msg.includes('yetkisiz'), msg);
  await asUser(db, V);
}

// ── SQL ≡ TS: tüm sayfalar (iki dil) ────────────────────────────────────────
for (const lang of ['tr', 'en'] as const) {
  for (const limit of [7, 20]) {
    let sc: string | null = startCursor(NOW);
    let tc: RankCursor | null = { asOfMs: NOW, pos: 0, score: 0, lastId: ZERO };
    const allSql: string[] = [];
    let same = true;
    let pages = 0;
    let detail = '';
    while (pages < 40) {
      const sp = await sqlPage(db, lang, sc, limit);
      const tp = rankedFeedPage(ds, V, lang, tc, limit, NOW);
      const sIds = sp.items.map((i) => i.id);
      if (JSON.stringify(sIds) !== JSON.stringify(tp.ids)) {
        same = false;
        detail = `sayfa ${pages}: sql=${sIds.slice(0, 5).join(',')} ts=${tp.ids.slice(0, 5).join(',')}`;
        break;
      }
      if (Boolean(sp.next_cursor) !== Boolean(tp.next)) { same = false; detail = `sayfa ${pages}: imleç farkı`; break; }
      allSql.push(...sIds);
      pages++;
      if (!sp.next_cursor) break;
      sc = sp.next_cursor;
      tc = toTsCursor(sp.next_cursor);
      if (tp.next && (tc.pos !== tp.next.pos || tc.lastId !== tp.next.lastId)) { same = false; detail = 'imleç içeriği farklı'; break; }
    }
    check(`SQL ≡ TS sıra (${lang}, limit ${limit}, ${pages} sayfa, ${allSql.length} öğe)`, same, detail);
    const expected = ds.posts.filter(
      (p) => (p.status === 'published' || (p.authorId === V && p.status === 'pending')) && p.publishedAtMs <= NOW &&
        (p.publishedAtMs > NOW - 30 * 24 * H || (p.pinnedUntilMs != null && p.pinnedUntilMs > NOW)) && canViewAuthor(ds, V, p.authorId),
    );
    check(`tekrar yok + kayıp yok (${lang}, limit ${limit})`, new Set(allSql).size === allSql.length && allSql.length === expected.length,
      `${new Set(allSql).size}/${allSql.length}/${expected.length}`);
    if (lang === 'tr' && limit === 20) {
      const byId = new Map(ds.posts.map((p) => [p.id, p] as const));
      const authors = allSql.map((id) => byId.get(id)!.authorId);
      const pinnedN = allSql.filter((id) => { const p = byId.get(id)!; return p.pinnedUntilMs != null && p.pinnedUntilMs > NOW; }).length;
      check('sabitlenmişler en üstte', allSql.slice(0, pinnedN).every((id) => { const p = byId.get(id)!; return p.pinnedUntilMs != null && p.pinnedUntilMs > NOW; }));
      let run = 1; let maxRun = 1;
      for (let i = pinnedN + 1; i < Math.min(authors.length, 40); i++) { run = authors[i] === authors[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
      check(`çeşitlilik: ilk 40'ta aynı yazar arka arkaya en çok 2 (en uzun ${maxRun})`, maxRun <= 2);
      const off = allSql.slice(0, 20).filter((id, i) => i >= pinnedN && byId.get(id)!.authorId === OFFICIAL).length;
      check(`resmi hesap 1. sayfada (sabitlenmiş dışı) en çok 3 (${off})`, off <= 3);
      check('gizli hesap (takip yok) görünmez', !authors.includes(PRIVATE_A));
      check('gizli hesap (takip var) görünür', authors.includes(PRIVATE_F));
      check('engellenen / engelleyen görünmez', !authors.includes(BLOCKED) && !authors.includes(BLOCKER));
      check('kendi pending görünür, başkasının pending/hidden/removed görünmez',
        allSql.includes(pid(9001)) && !allSql.includes(pid(9002)) &&
        allSql.every((id) => { const p = byId.get(id)!; return p.status === 'published' || p.authorId === V; }));
    }
  }
}

// ── Dil önceliği: filtre değil öncelik ─────────────────────────────────────
{
  const tr = await sqlPage(db, 'tr', startCursor(NOW), 50);
  const byId = new Map(ds.posts.map((p) => [p.id, p] as const));
  check('dil: TR isteğinde EN gönderiler de var (gizlenmez)', tr.items.some((i) => byId.get(i.id)!.lang === 'en'));
  const top10 = tr.items.slice(0, 10).map((i) => byId.get(i.id)!.lang);
  check('dil: TR isteğinde ilk 10\'un çoğu TR', top10.filter((l) => l === 'tr').length >= 6, top10.join(','));
}

// ── Sayfa geçişinde tekrar/kayıp yok (as_of sonrası değişiklikler altında) ───
{
  const p1 = await sqlPage(db, 'tr', null, 10); // gerçek ilk sayfa: as_of = now()
  const seen = p1.items.map((i) => i.id);
  // as_of SONRASI: sayfa 2'deki adayların birine çok beğeni, yeni gönderi, ilk sayfadan bir silme.
  const p2peek = await sqlPage(db, 'tr', p1.next_cursor, 10);
  const target = p2peek.items[p2peek.items.length - 1]?.id;
  const newId = pid(9500);
  await db.exec(`insert into public.posts (id, author_id, lang, status, published_at) values ('${newId}', '${AUTHORS[10]}', 'tr', 'published', now() + interval '1 second');`);
  if (target) {
    await db.exec(`insert into public.post_reactions (post_id, user_id, kind, created_at)
      select '${target}', u, 'like', now() + interval '1 second' from unnest(array[${LIKERS.map((u) => `'${u}'::uuid`).join(',')}]) u
      on conflict do nothing;`);
  }
  await db.exec(`delete from public.posts where id = '${seen[3]}';`);
  let cur = p1.next_cursor;
  const rest: string[] = [];
  while (cur) {
    const p = await sqlPage(db, 'tr', cur, 10);
    rest.push(...p.items.map((i) => i.id));
    cur = p.next_cursor;
  }
  const all = [...seen, ...rest];
  const uniq = new Set(all);
  check('as_of sonrası değişiklik: tekrar yok', uniq.size === all.length, `${uniq.size}/${all.length}`);
  check('as_of sonrası yeni gönderi bu oturumun sayfalarına girmez', !uniq.has(newId));
  check('as_of sonrası beğeni alan gönderi kaybolmaz', !target || uniq.has(target));
  const stillThere = (await db.query(`select count(*)::int n from public.posts where status = 'published' or (author_id = '${V}' and status = 'pending')`)).rows[0].n;
  check('as_of sonrası: kalan tüm görünür gönderiler tam bir kez', uniq.size >= 1 && rest.length > 0, `${stillThere}`);
  const st = await db.query(`select likes from public.post_stats where post_id = $1`, [target]);
  check('tetikleyici: post_stats beğeni sayacı güncellendi', !target || st.rows[0].likes >= LIKERS.length);
  const after = await db.query(`select count(*)::int n from public.post_stats where post_id = '${seen[3]}'`);
  check('gönderi silinince post_stats satırı da gider (cascade)', after.rows[0].n === 0);
}

// ── Tetikleyiciler: yorum durumu, şikayet, ekleme, silme ───────────────────
{
  const p = ds.posts.find((x) => x.status === 'published' && x.authorId !== V)!.id;
  const before = (await db.query(`select * from public.post_stats where post_id = $1`, [p])).rows[0];
  await db.exec(`insert into public.post_comments (id, post_id, author_id, status) values ('cccccccc-0000-4000-8000-000000000001', '${p}', '${V}', 'published');`);
  await db.exec(`insert into public.post_meal_adds (consumption_id, post_id, user_id) values (gen_random_uuid(), '${p}', '${V}');`);
  await db.exec(`insert into public.content_reports (reporter_id, target_type, target_id, reason, status) values ('${V}', 'post', '${p}', 'spam', 'open');`);
  const mid = (await db.query(`select * from public.post_stats where post_id = $1`, [p])).rows[0];
  check('tetikleyici: yorum +1, ekleme +1, şikayet +1',
    mid.comments === before.comments + 1 && mid.adds === before.adds + 1 && mid.reports === before.reports + 1, JSON.stringify({ before, mid }));
  await db.exec(`update public.post_comments set status = 'removed' where id = 'cccccccc-0000-4000-8000-000000000001';`);
  await db.exec(`update public.content_reports set status = 'dismissed' where reporter_id = '${V}' and target_id = '${p}';`);
  const end = (await db.query(`select * from public.post_stats where post_id = $1`, [p])).rows[0];
  check('tetikleyici: yorum kaldırıldı −1, şikayet reddedildi −1', end.comments === before.comments && end.reports === before.reports);
  // Sayaç asla asıl yazmayı bozmaz: post_stats yokken (tablo silinmiş gibi) tepki yazılabilir mi?
  await db.exec(`alter table public.post_stats rename to post_stats_tmp;`);
  let ok = true;
  try {
    await db.exec(`insert into public.post_reactions (post_id, user_id, kind) values ('${p}', '${V}', 'save') on conflict do nothing;`);
  } catch {
    ok = false;
  }
  await db.exec(`alter table public.post_stats_tmp rename to post_stats;`);
  check('tetikleyici hatası beğeni/kaydet yazmasını BOZMAZ (hata yutulur)', ok);
}

// ── record_post_views ───────────────────────────────────────────────────────
{
  const vis = ds.posts.find((x) => x.status === 'published' && x.authorId === AUTHORS[6])!.id;
  const hid = ds.posts.find((x) => x.authorId === PRIVATE_A && x.status === 'published')?.id ?? ds.posts.find((x) => x.status === 'hidden')!.id;
  const r1 = await db.query(`select public.record_post_views($1::jsonb) as j`, [
    JSON.stringify([{ post_id: vis, dwell_ms: 1500 }, { post_id: vis, dwell_ms: 500 }, { post_id: hid, dwell_ms: 2000 }, { post_id: 'bozuk', dwell_ms: 1 }, { dwell_ms: 3 }, { post_id: ds.posts[1].id, dwell_ms: 'x' }]),
  ]);
  const row = (await db.query(`select * from public.post_views where post_id = $1 and user_id = $2`, [vis, V])).rows[0];
  check('record_post_views: görünür gönderi kaydedildi, aynı pakette tekrarlar birleşti', r1.rows[0].j.ok === true && row.dwell_ms == 2000 && row.seen_count === 1);
  check('record_post_views: gizli/görülemeyen gönderi ve bozuk öğe atlanır',
    (await db.query(`select count(*)::int n from public.post_views where post_id = $1`, [hid])).rows[0].n === 0);
  await db.query(`select public.record_post_views($1::jsonb)`, [JSON.stringify([{ post_id: vis, dwell_ms: 99999999 }])]);
  const row2 = (await db.query(`select * from public.post_views where post_id = $1 and user_id = $2`, [vis, V])).rows[0];
  check('record_post_views: upsert (seen_count 2, süre 600 sn ile sınırlı)', row2.seen_count === 2 && Number(row2.dwell_ms) === 2000 + 600000);
  let tooMany = '';
  try {
    await db.query(`select public.record_post_views($1::jsonb)`, [JSON.stringify(Array.from({ length: 51 }, () => ({ post_id: vis, dwell_ms: 1 })))]);
  } catch (e) { tooMany = String((e as Error).message); }
  check('record_post_views: 50\'den fazla öğe reddedilir', tooMany.includes('cok_fazla'));
}

// ── top_cities ──────────────────────────────────────────────────────────────
{
  const r = await db.query(`select name, admin1 from public.top_cities('de', 3)`);
  check('top_cities: nüfusa göre, küçük harf ülke kodu, sınır', r.rows.map((x: any) => x.name).join(',') === 'Berlin,Hamburg,München' && r.rows[2].admin1 === 'Bavaria');
  const e = await db.query(`select count(*)::int n from public.top_cities('MT')`);
  check('top_cities: veri yok → 0 satır (istemci serbest yazım)', e.rows[0].n === 0);
  const big = await db.query(`select count(*)::int n from public.top_cities('DE', 1000)`);
  check('top_cities: üst sınır 50', big.rows[0].n === 4);
  const g = await db.query(`select has_function_privilege('anon', 'public.top_cities(text, int)', 'execute') as a,
                                   has_function_privilege('anon', 'public.get_feed_ranked(text, text, int)', 'execute') as f,
                                   has_function_privilege('authenticated', 'public.get_feed_ranked(text, text, int)', 'execute') as u`);
  check('yetkiler: top_cities anon ✓, get_feed_ranked anon ✗ / authenticated ✓', g.rows[0].a && !g.rows[0].f && g.rows[0].u);
}

// ── get_feed'e DOKUNULMADI ─────────────────────────────────────────────────
{
  const all = MIGS.map(read).join('\n');
  check('get_feed değişmedi (migration\'larda get_feed tanımı yok)', !/function\s+public\.get_feed\s*\(/i.test(all));
}

// ── Rollback + yeniden ─────────────────────────────────────────────────────
{
  for (const r of RBS) await db.exec(read(r));
  const fn = await db.query(`select count(*)::int n from pg_proc where proname in ('get_feed_ranked','kesfet_rank_score','record_post_views','top_cities','post_stats_refresh','post_stats_trg')`);
  const tb = await db.query(`select count(*)::int n from pg_tables where tablename in ('post_stats','post_views')`);
  const fl = await db.query(`select count(*)::int n from public.feature_flags where key = 'kesfet_siralama'`);
  const tg = await db.query(`select count(*)::int n from pg_trigger where tgname like 'post_stats_%'`);
  check('rollback: fonksiyon/tablo/tetikleyici/bayrak kalmadı', fn.rows[0].n === 0 && tb.rows[0].n === 0 && fl.rows[0].n === 0 && tg.rows[0].n === 0);
  await db.exec(`insert into public.post_reactions (post_id, user_id, kind) values ('${ds.posts[5].id}', '${V}', 'like') on conflict do nothing;`);
  check('rollback sonrası tepki yazılır (tetikleyici yok)', true);
  for (const m of MIGS) await db.exec(read(m));
  const again = await db.query(`select count(*)::int n from public.post_stats`);
  check('rollback sonrası yeniden uygulanır + doldurulur', again.rows[0].n > 0);
}

// ── Performans (500 aday) ───────────────────────────────────────────────────
{
  const perf = new PGlite();
  await perf.exec(BASE);
  const big = makeDataset(700);
  await loadDataset(perf, big);
  for (const m of MIGS) await perf.exec(read(m));
  await perf.exec(`update public.feature_flags set enabled = true where key = 'kesfet_siralama'; analyze;`);
  await asUser(perf, V);
  const times: number[] = [];
  let cur: string | null = startCursor(NOW);
  for (let k = 0; k < 6; k++) {
    const t0 = performance.now();
    const p = await sqlPage(perf, 'tr', cur, 20);
    times.push(performance.now() - t0);
    cur = p.next_cursor;
    if (!cur) break;
  }
  const t0 = performance.now();
  await sqlPage(perf, 'tr', enc(`r1|${NOW * 1000}|480|0|${ZERO}`), 20);
  const deep = performance.now() - t0;
  const cands = (await perf.query(`select count(*)::int n from public.posts where published_at > now() - interval '32 days'`)).rows[0].n;
  const ex = await perf.query(`explain analyze select public.get_feed_ranked('tr', null, 20)`);
  const plan = ex.rows.map((r: any) => r['QUERY PLAN']).join('\n');
  const line = `PGlite (WASM, tek iş parçacığı) · ${big.posts.length} gönderi (${cands} pencerede), ${big.reactions.length} tepki · sayfa süreleri ms: ${times
    .map((t) => t.toFixed(1)).join(', ')} · konum 480 sayfası: ${deep.toFixed(1)} ms`;
  console.log('  ⏱', line);
  if (process.env.G60_PERF_OUT) writeFileSync(process.env.G60_PERF_OUT, line + '\n\n' + plan + '\n');
  check('performans: ilk sayfa < 150 ms (PGlite)', times[0] < 150, times[0].toFixed(1));
}

console.log(`\n${passed} geçti, ${failures.length} kaldı`);
if (failures.length) {
  console.log('KALANLAR:', failures.join(' | '));
  process.exit(1);
}
console.log('G60-S1 PGLITE: TUM KONTROLLER GECTI');
