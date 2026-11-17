// G60-S1 — Keşfet sıralaması v2: SQL `get_feed_ranked` / `kesfet_rank_score` SAF TS KOPYASI.
//
// Neden: (1) puan formülü ve sıra kurma kuralları testlenebilir olsun (tsx --test, jest);
// (2) supabase/tests/g60_s1.check.mts aynı veri setini PGlite'ta SQL ile koşturup bu dosyanın
// sonucuyla BİREBİR karşılaştırır. Uygulama akışı sıralamayı SUNUCUDAN alır; bu dosya istemcide
// yalnız test/vitrin içindir (canlı ekran buradan sıra üretmez).
//
// Ağırlıklar TEK yerde: SQL tarafında kesfet_rank_score + kesfet_rank_config
// (supabase/migrations/20261117230300_g60_get_feed_ranked.sql). Test iki tarafın sabitlerini karşılaştırır.
import { foldText } from '../eatkcal/v2/model/geo';

export const RANK_CONFIG = {
  version: 1,
  freshTauH: 48,
  newBonusH: 24,
  newBonus: 0.5,
  wAdd: 4,
  wSave: 3,
  wComment: 2,
  wLike: 1,
  follow: 1.5,
  interacted: 1.2,
  interactWindowDays: 30,
  sameCity: 1.3,
  langMatch: 1.0,
  langOther: 0.35,
  reportPenalty: 0.2,
  reportCap: 5,
  windowDays: 30,
  maxCandidates: 500,
  exploreEvery: 10,
  exploreMinWeighted: 3,
  maxAuthorRun: 2,
  officialPerPage: 3,
  pageSize: 20,
  lookahead: 50,
} as const;

const H = 3600 * 1000;
const DAY = 24 * H;

// ── 1) Puan ─────────────────────────────────────────────────────────────────
export interface RankInput {
  ageH: number;
  adds: number;
  saves: number;
  comments: number;
  likes: number;
  follows: boolean;
  interacted: boolean;
  sameCity: boolean;
  langMatch: boolean;
  reports: number;
}

const nn = (v: number) => Math.max(Number.isFinite(v) ? v : 0, 0);

/** Ağırlıklı etkileşim (ln öncesi): 4·ekleme + 3·kaydetme + 2·yorum + 1·beğeni. */
export function weightedEngagement(i: Pick<RankInput, 'adds' | 'saves' | 'comments' | 'likes'>): number {
  const c = RANK_CONFIG;
  return c.wAdd * nn(i.adds) + c.wSave * nn(i.saves) + c.wComment * nn(i.comments) + c.wLike * nn(i.likes);
}

/** puan = yenilik × (1 + etkileşim) × ilişki × yerellik × dil − ceza (SQL kesfet_rank_score ile aynı). */
export function rankScore(i: RankInput): number {
  const c = RANK_CONFIG;
  const age = nn(i.ageH);
  const fresh = Math.exp(-age / c.freshTauH) + (age < c.newBonusH ? c.newBonus : 0);
  const engagement = Math.log(1 + weightedEngagement(i));
  const relation = (i.follows ? c.follow : 1) * (i.interacted ? c.interacted : 1);
  const local = i.sameCity ? c.sameCity : 1;
  const lang = i.langMatch ? c.langMatch : c.langOther;
  const penalty = c.reportPenalty * Math.min(nn(i.reports), c.reportCap);
  return fresh * (1 + engagement) * relation * local * lang - penalty;
}

// ── 2) Sıra kurma (sabitlenmiş → puan; keşif yuvası + çeşitlilik) ──────────────
export interface RankCandidate {
  id: string;
  authorId: string;
  official: boolean;
  pinned: boolean;
  publishedAtMs: number;
  score: number;
  /** Ağırlıklı etkileşim (keşif eşiği ve keşif sırası için). */
  weighted: number;
  /** Başka dil ya da (izleyenin şehri varken) başka şehir. */
  otherPlace: boolean;
}

/** uuid sırası = küçük harfli onaltılık metin sırası (Postgres uuid karşılaştırmasıyla aynı). */
function idDesc(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? 1 : x > y ? -1 : 0;
}

/** SQL `ordered`: sabitlenmiş önce (yeniye göre), sonra puan azalan; eşitlikte id azalan. */
export function orderCandidates(list: readonly RankCandidate[]): RankCandidate[] {
  return list.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ka = a.pinned ? a.publishedAtMs / 1000 : a.score;
    const kb = b.pinned ? b.publishedAtMs / 1000 : b.score;
    if (ka !== kb) return kb - ka;
    return idDesc(a.id, b.id);
  });
}

/**
 * SQL (a)+(b) adımları: `ordered` listesinden ilk `target` konumu kurar; dizin dizisi döner.
 * Açgözlü: her 10. (sabitlenmiş dışı) yuvada keşif adayı; aynı yazardan arka arkaya en çok 2;
 * resmi hesap 20'lik blokta en çok 3; ileriye en çok 50 kullanılmamış aday bakılır; uygun yoksa sıradaki.
 */
export function buildSequence(ordered: readonly RankCandidate[], target: number): number[] {
  const c = RANK_CONFIG;
  const n = ordered.length;
  const goal = Math.min(n, Math.max(0, target));
  const used = new Array<boolean>(n).fill(false);
  const seq: number[] = [];
  let i = 0;
  while (i < n && ordered[i].pinned && seq.length < n) {
    seq.push(i);
    used[i] = true;
    i += 1;
  }
  let ptr = i;
  const explore = ordered
    .map((cand, idx) => ({ cand, idx }))
    .filter((x) => !x.cand.pinned && x.cand.otherPlace && x.cand.weighted >= c.exploreMinWeighted)
    .sort((a, b) => {
      if (a.cand.weighted !== b.cand.weighted) return b.cand.weighted - a.cand.weighted;
      if (a.cand.score !== b.cand.score) return b.cand.score - a.cand.score;
      return idDesc(a.cand.id, b.cand.id);
    })
    .map((x) => x.idx);
  let eptr = 0;
  let npSlot = 0;
  let block = -1;
  let offCnt = 0;

  const ok = (k: number): boolean => {
    const len = seq.length;
    const run =
      len >= c.maxAuthorRun &&
      ordered[seq[len - 1]].authorId === ordered[k].authorId &&
      ordered[seq[len - 2]].authorId === ordered[k].authorId;
    const offFull = ordered[k].official && offCnt >= c.officialPerPage;
    return !run && !offFull;
  };

  while (seq.length < goal) {
    const slot = seq.length + 1;
    npSlot += 1;
    const b = Math.floor((slot - 1) / c.pageSize);
    if (b !== block) {
      block = b;
      offCnt = 0;
    }
    let pick: number | null = null;
    if (npSlot % c.exploreEvery === 0 && explore.length > 0) {
      while (eptr < explore.length && used[explore[eptr]]) eptr += 1;
      for (let j = eptr; j < explore.length; j++) {
        const k = explore[j];
        if (!used[k] && ok(k)) {
          pick = k;
          break;
        }
      }
    }
    if (pick == null) {
      let cnt = 0;
      for (let k = ptr; k < n; k++) {
        if (used[k]) continue;
        cnt += 1;
        if (ok(k)) {
          pick = k;
          break;
        }
        if (cnt >= c.lookahead) break;
      }
    }
    if (pick == null) {
      for (let k = ptr; k < n; k++) {
        if (!used[k]) {
          pick = k;
          break;
        }
      }
    }
    if (pick == null) break;
    used[pick] = true;
    seq.push(pick);
    if (ordered[pick].official) offCnt += 1;
    while (ptr < n && used[ptr]) ptr += 1;
  }
  return seq;
}

// ── 3) İmleç + sayfa ─────────────────────────────────────────────────────────
export interface RankCursor {
  asOfMs: number;
  /** Bu imlece kadar dönen konum sayısı (1 tabanlı son konum). */
  pos: number;
  score: number;
  lastId: string;
}

export interface RankPage {
  ids: string[];
  next: RankCursor | null;
}

/** SQL (c): son_id bulunursa ondan sonrası, yoksa konumdan; sonraki imleç yalnız tam sayfada. */
export function pageFrom(
  ordered: readonly RankCandidate[],
  cursor: Pick<RankCursor, 'pos' | 'lastId'> | null,
  limit: number,
  asOfMs: number,
): RankPage {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const n = ordered.length;
  if (n === 0) return { ids: [], next: null };
  const pos = cursor ? Math.max(cursor.pos, 0) : 0;
  const seq = buildSequence(ordered, Math.min(n, pos + 2 * lim));
  let start = pos; // 0 tabanlı
  if (cursor?.lastId) {
    const at = seq.findIndex((k) => ordered[k].id === cursor.lastId);
    if (at >= 0) start = at + 1;
  }
  if (start >= seq.length) return { ids: [], next: null };
  const end = Math.min(start + lim, seq.length); // hariç
  const slice = seq.slice(start, end);
  const last = ordered[slice[slice.length - 1]];
  const full = slice.length === lim && end < n;
  return {
    ids: slice.map((k) => ordered[k].id),
    next: full ? { asOfMs, pos: end, score: Math.round(last.score * 1e6) / 1e6, lastId: last.id } : null,
  };
}

// ── 4) Veri seti düzeyinde başvuru (SQL CTE'lerinin TS karşılığı; test + PGlite karşılaştırması) ──
export interface DsPost {
  id: string;
  authorId: string;
  lang: string;
  status: 'published' | 'pending' | 'hidden' | 'removed';
  publishedAtMs: number;
  pinnedUntilMs?: number | null;
}
export interface DsDataset {
  posts: DsPost[];
  reactions: Array<{ postId: string; userId: string; kind: 'like' | 'save'; createdAtMs: number }>;
  adds: Array<{ postId: string; userId: string; createdAtMs: number }>;
  comments: Array<{ postId: string; authorId: string; status: string; createdAtMs: number }>;
  reports: Array<{ postId: string; status: string }>;
  follows: Array<{ follower: string; following: string; createdAtMs: number }>;
  blocks: Array<{ blocker: string; blocked: string }>;
  privateUsers: string[];
  addresses: Array<{ userId: string; city: string | null; isDefault: boolean; createdAtMs: number }>;
  creators: Array<{ userId: string; role: string }>;
}

/** feed_can_view_author: engel yok VE (kendisi | açık hesap | takipçi). */
export function canViewAuthor(ds: DsDataset, viewer: string, author: string): boolean {
  const blocked = ds.blocks.some(
    (b) => (b.blocker === viewer && b.blocked === author) || (b.blocker === author && b.blocked === viewer),
  );
  if (blocked) return false;
  if (author === viewer) return true;
  if (!ds.privateUsers.includes(author)) return true;
  return ds.follows.some((f) => f.follower === viewer && f.following === author);
}

function userCity(ds: DsDataset, userId: string): string | null {
  const rows = ds.addresses
    .filter((a) => a.userId === userId && a.city != null && a.city.trim() !== '')
    .sort((a, b) => (a.isDefault !== b.isDefault ? (a.isDefault ? -1 : 1) : b.createdAtMs - a.createdAtMs));
  return rows.length ? foldText(rows[0].city!.trim()) : null;
}

/** get_feed_ranked'in aday + puan aşaması (SQL `base` … `scored`). */
export function datasetCandidates(ds: DsDataset, viewer: string, lang: string, asOfMs: number): RankCandidate[] {
  const c = RANK_CONFIG;
  const vLang = (lang || 'tr').trim().toLowerCase() || 'tr';
  const vCity = userCity(ds, viewer);
  const pinnedAt = (p: DsPost) => p.pinnedUntilMs != null && p.pinnedUntilMs > asOfMs;
  const base = ds.posts
    .filter(
      (p) =>
        (p.status === 'published' || (p.authorId === viewer && p.status === 'pending')) &&
        p.publishedAtMs <= asOfMs &&
        (p.publishedAtMs > asOfMs - c.windowDays * DAY || pinnedAt(p)) &&
        canViewAuthor(ds, viewer, p.authorId),
    )
    .sort((a, b) => {
      const pa = pinnedAt(a);
      const pb = pinnedAt(b);
      if (pa !== pb) return pa ? -1 : 1;
      if (a.publishedAtMs !== b.publishedAtMs) return b.publishedAtMs - a.publishedAtMs;
      return idDesc(a.id, b.id);
    })
    .slice(0, c.maxCandidates);

  const follows = new Set(
    ds.follows.filter((f) => f.follower === viewer && f.createdAtMs <= asOfMs).map((f) => f.following),
  );
  const authorOf = new Map(ds.posts.map((p) => [p.id, p.authorId] as const));
  const inWin = (t: number) => t > asOfMs - c.interactWindowDays * DAY && t <= asOfMs;
  const interacted = new Set<string>();
  for (const r of ds.reactions) if (r.userId === viewer && inWin(r.createdAtMs)) interacted.add(authorOf.get(r.postId) ?? '');
  for (const a of ds.adds) if (a.userId === viewer && inWin(a.createdAtMs)) interacted.add(authorOf.get(a.postId) ?? '');
  for (const cm of ds.comments) if (cm.authorId === viewer && inWin(cm.createdAtMs)) interacted.add(authorOf.get(cm.postId) ?? '');
  const official = new Set(ds.creators.filter((cr) => cr.role === 'kurum').map((cr) => cr.userId));

  return base.map((p) => {
    // post_stats (güncel) − as_of sonrası = as_of anındaki sayaç.
    const likes = ds.reactions.filter((r) => r.postId === p.id && r.kind === 'like' && r.createdAtMs <= asOfMs).length;
    const saves = ds.reactions.filter((r) => r.postId === p.id && r.kind === 'save' && r.createdAtMs <= asOfMs).length;
    const adds = ds.adds.filter((a) => a.postId === p.id && a.createdAtMs <= asOfMs).length;
    const comments = ds.comments.filter(
      (cm) => cm.postId === p.id && cm.status === 'published' && cm.createdAtMs <= asOfMs,
    ).length;
    const reports = ds.reports.filter((r) => r.postId === p.id && (r.status === 'open' || r.status === 'pending')).length;
    const aCity = userCity(ds, p.authorId);
    const langMatch = p.lang.toLowerCase() === vLang;
    const sameCity = vCity != null && aCity != null && aCity === vCity;
    const otherPlace = !langMatch || (vCity != null && aCity != null && aCity !== vCity);
    const score = rankScore({
      ageH: (asOfMs - p.publishedAtMs) / H,
      adds,
      saves,
      comments,
      likes,
      follows: follows.has(p.authorId),
      interacted: interacted.has(p.authorId),
      sameCity,
      langMatch,
      reports,
    });
    return {
      id: p.id,
      authorId: p.authorId,
      official: official.has(p.authorId),
      pinned: pinnedAt(p),
      publishedAtMs: p.publishedAtMs,
      score,
      weighted: weightedEngagement({ adds, saves, comments, likes }),
      otherPlace,
    };
  });
}

/** Tek çağrı: get_feed_ranked(p_lang, cursor, limit) TS karşılığı (as_of imleçten ya da `nowMs`). */
export function rankedFeedPage(
  ds: DsDataset,
  viewer: string,
  lang: string,
  cursor: RankCursor | null,
  limit: number,
  nowMs: number,
): RankPage {
  const asOf = cursor ? Math.min(cursor.asOfMs, nowMs) : nowMs;
  const ordered = orderCandidates(datasetCandidates(ds, viewer, lang, asOf));
  return pageFrom(ordered, cursor, limit, asOf);
}
