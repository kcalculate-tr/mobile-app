// G22-S2 md.4 — Keşfet arama (profil + içerik) SAF mantığı. RN/native import YOK →
// `tsx --test` altında doğrudan test edilir. Ekran (ui/SearchScreen) yalnız çizer.
//
// Kapsamlar: Kişi · Gönderi · Tarif (FinSearch). Sunucu sözleşmesi:
// supabase/migrations/20261110100200_g22_s2_search.sql (search_profiles / search_posts).

import type { SearchPost, SearchProfile, SearchResults, SearchScope } from './types';

export const SEARCH_SCOPES: readonly SearchScope[] = ['people', 'posts', 'recipes'] as const;

/** Sunucuyla aynı alt sınır (search_like_pattern: < 2 → arama yok). */
export const SEARCH_MIN_LEN = 2;
/** Sunucuyla aynı üst sınır (left(v, 64)). */
export const SEARCH_MAX_LEN = 64;
/** Sunucu sonuç sınırı (limit 24). */
export const SEARCH_LIMIT = 24;
/**
 * Yazma → istek bekleme (ms). HAREKET DEĞİL, giriş seyreltme: her tuşta RPC
 * atılmasın. (Hareket token'ları motion.tsx'te; bu süre animasyon sürmez.)
 */
export const SEARCH_DEBOUNCE_MS = 300;
/** Son aramalar listesinde en çok kaç kayıt tutulur (FinSearch 5 satır gösterir). */
export const RECENT_MAX = 8;

/**
 * Sorguyu sadeleştir: baş/son boşluk at, iç boşlukları teke indir, en çok 64
 * karakter. Baştaki '@' KORUNUR (kişi araması ipucu; sunucu kendisi atar).
 */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LEN).trim();
}

/** '@' atılmış çekirdek — uzunluk denetimi ve eşleştirme bununla. */
export function queryCore(raw: string | null | undefined): string {
  return normalizeQuery(raw).replace(/^@+/, '').trim();
}

/** Arama atılır mı? (çekirdek ≥ 2 karakter) */
export function isSearchable(raw: string | null | undefined): boolean {
  return queryCore(raw).length >= SEARCH_MIN_LEN;
}

/** Türkçe duyarlı küçük harf anahtarı (İ/ı) — tekilleştirme ve yerel eşleştirme. */
export function queryKey(raw: string | null | undefined): string {
  return normalizeQuery(raw).toLocaleLowerCase('tr-TR');
}

/** '@' ile başlayan sorgu kişi kapsamını açar (son aramalardaki "@diyetisyen"). */
export function scopeForQuery(raw: string, current: SearchScope): SearchScope {
  return normalizeQuery(raw).startsWith('@') ? 'people' : current;
}

/**
 * ILIKE kaçışı — sunucudaki `search_like_pattern` ile birebir (`\` → `\\`,
 * `%` → `\%`, `_` → `\_`). İstemci şu an deseni sunucuya YOLLAMAZ (ham sorgu
 * gider, kaçış sunucuda); yerel/mock eşleştirme ve sözleşme testi için.
 */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ── Son aramalar ────────────────────────────────────────────────────────────

export type RecentKind = 'query' | 'person';

export interface RecentSearch {
  q: string;
  kind: RecentKind;
}

/** Başa ekle; aynı (TR küçük harf) sorgu tekrar etmez; en çok `max`. Boş/kısa → aynen. */
export function addRecent(
  list: readonly RecentSearch[],
  raw: string,
  kind: RecentKind = 'query',
  max: number = RECENT_MAX,
): RecentSearch[] {
  const q = normalizeQuery(raw);
  if (!isSearchable(q)) return [...list];
  const key = queryKey(q);
  const rest = list.filter((r) => queryKey(r.q) !== key);
  return [{ q, kind }, ...rest].slice(0, Math.max(0, max));
}

export function removeRecent(list: readonly RecentSearch[], raw: string): RecentSearch[] {
  const key = queryKey(raw);
  return list.filter((r) => queryKey(r.q) !== key);
}

export function clearRecent(): RecentSearch[] {
  return [];
}

/** Depodan okunan ham değeri güvenle listeye çevir (bozuk JSON / yanlış tür → []). */
export function parseRecent(raw: string | null | undefined, max: number = RECENT_MAX): RecentSearch[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  let out: RecentSearch[] = [];
  // Sondan başa ekleyerek sırayı koru + tekilleştir.
  for (const item of [...data].reverse()) {
    if (!item || typeof item !== 'object') continue;
    const q = (item as { q?: unknown }).q;
    const kind = (item as { kind?: unknown }).kind === 'person' ? 'person' : 'query';
    if (typeof q !== 'string') continue;
    out = addRecent(out, q, kind, max);
  }
  return out;
}

// ── Sonuçlar ─────────────────────────────────────────────────────────────────

export const EMPTY_RESULTS: SearchResults = { people: [], posts: [], recipes: [] };

export function scopeCounts(r: SearchResults): Record<SearchScope, number> {
  return { people: r.people.length, posts: r.posts.length, recipes: r.recipes.length };
}

export function totalCount(r: SearchResults): number {
  return r.people.length + r.posts.length + r.recipes.length;
}

/**
 * "Şurada da ara" düğmeleri: seçili dışındaki kapsamlar; sonucu OLANLAR önce
 * (sıra korunur). Hiçbirinde sonuç yoksa yine diğer ikisi (tasarım: iki düğme).
 */
export function otherScopes(current: SearchScope, r: SearchResults): SearchScope[] {
  const others = SEARCH_SCOPES.filter((s) => s !== current);
  const c = scopeCounts(r);
  return [...others.filter((s) => c[s] > 0), ...others.filter((s) => c[s] === 0)];
}

export type SearchView = 'recent' | 'loading' | 'error' | 'results' | 'empty';

/**
 * Ekran durumu. Sorgu aranabilir değilse → son aramalar. Aranabilir sorguda
 * sonuç bu sorguya ait değilse (bekleme/istek sürüyor) → yükleniyor.
 */
export function searchView(input: {
  query: string;
  scope: SearchScope;
  loading: boolean;
  error: boolean;
  resultsFor: string | null;
  results: SearchResults;
}): SearchView {
  if (!isSearchable(input.query)) return 'recent';
  const fresh = input.resultsFor != null && queryKey(input.resultsFor) === queryKey(input.query);
  if (input.error && !input.loading) return 'error';
  if (!fresh || input.loading) return 'loading';
  return input.results[input.scope].length > 0 ? 'results' : 'empty';
}

/** “sorgu” — tasarımdaki kıvrık tırnak. */
export function quoteQuery(q: string): string {
  return `“${normalizeQuery(q)}”`;
}

/** Kart başlığı: öğün adı varsa o, yoksa gövdenin ilk satırı. */
export function postTitle(p: SearchPost): string {
  const name = p.meal_card?.name?.trim();
  if (name) return name;
  const first = (p.body ?? '').split('\n')[0]?.trim() ?? '';
  return first;
}

/** Kart görseli: medya → öğün kartı fotoğrafı → yok. */
export function postImage(p: SearchPost): string | null {
  return p.media_url || p.meal_card?.photo_url || null;
}

/** Protein çipi değeri (yuvarlanmış g) — öğün kartı yoksa null. */
export function proteinGrams(p: SearchPost): number | null {
  const v = p.meal_card?.protein_g;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

export function kcalOf(p: SearchPost): number | null {
  const v = p.meal_card?.kcal;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

/** Yerel (mock) eşleştirme — TR küçük harf "içerir". */
export function matches(haystack: string | null | undefined, raw: string): boolean {
  const needle = queryCore(raw).toLocaleLowerCase('tr-TR');
  if (needle.length < SEARCH_MIN_LEN) return false;
  return (haystack ?? '').toLocaleLowerCase('tr-TR').includes(needle);
}

/** Kişi satırında handle '@' ile. */
export function handleLabel(p: Pick<SearchProfile, 'handle'>): string {
  const h = (p.handle ?? '').replace(/^@+/, '');
  return h ? `@${h}` : '';
}
