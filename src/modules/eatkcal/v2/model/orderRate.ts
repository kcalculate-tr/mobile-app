// G62-S1 — Sipariş değerlendirme v2: SAF kurallar (native / ağ yok; birim testi __tests__/g62OrderRate.test.ts).
//
// Tasarım: docs/g62/design/FinEkRateSheet.dc.html — üç başlık (Teslimat · Kalori uyumu · Lezzet), her biri 1–5
// yıldız; üçü de puanlanınca "Gönder" etkin. Genel puan (reviews.rating) = üçünün yuvarlanmış ortalaması
// (sunucu submit_order_rating ile aynı formül) → restoran puanı kuralı (son 3 ay, <10 → "Yeni") değişmeden beslenir.
// İstem: sipariş "teslim edildi" → 7 gün boyunca, sipariş başına bir kez.

export const RATE_WINDOW_DAYS = 7;
export const RATE_WINDOW_MS = RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const COMMENT_MAX = 500;
export const LOW_RATING_MAX = 2;

/** Sayfadaki sıra = tasarımdaki sıra. */
export const RATE_DIMS = ['delivery', 'calorie_fit', 'taste'] as const;
export type RateDim = (typeof RATE_DIMS)[number];
export type RateDims = Record<RateDim, number>;
export const EMPTY_DIMS: RateDims = { delivery: 0, calorie_fit: 0, taste: 0 };

/** Ürün etiketleri — sunucu beyaz listesi (submit_order_rating c_tags) ile birebir. */
export const ITEM_TAGS = {
  liked: ['lezzetli', 'doyurucu', 'taze', 'porsiyon_iyi', 'kalori_tutarli'],
  disliked: ['soguk', 'az_porsiyon', 'tuzlu_yagli', 'eksik_urun', 'kalori_tutmadi'],
} as const;
export type ItemTag = (typeof ITEM_TAGS)['liked'][number] | (typeof ITEM_TAGS)['disliked'][number];
export const ALL_ITEM_TAGS: readonly ItemTag[] = [...ITEM_TAGS.liked, ...ITEM_TAGS.disliked];

export interface RateItem {
  productId: number;
  name: string;
}

export interface ItemVote {
  liked: boolean;
  tags: ItemTag[];
}
export type ItemVotes = Record<number, ItemVote>;

export interface RateOrderRow {
  id: number;
  status: string | null;
  delivered_at?: string | null;
  updated_at?: string | null;
}

/** Teslim anı: delivered_at; eski satırlarda updated_at (v1 ile aynı kaynak). */
export function deliveredAtOf(row: Pick<RateOrderRow, 'delivered_at' | 'updated_at'>): number | null {
  const raw = row.delivered_at || row.updated_at;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * İstem görünür mü? teslim edildi + teslimden bu yana ≤ 7 gün + henüz değerlendirilmedi.
 * (Gelecek tarihli teslim — saat kayması — görünür sayılır.)
 */
export function isRatePromptVisible(
  row: RateOrderRow | null | undefined,
  opts: { reviewed: boolean; now: number },
): boolean {
  if (!row || row.status !== 'delivered' || opts.reviewed) return false;
  const at = deliveredAtOf(row);
  if (at == null) return false;
  return opts.now - at <= RATE_WINDOW_MS;
}

/** Değerlendirilmemiş, pencere içindeki EN YENİ teslim edilmiş sipariş (Ana sayfa kartı). */
export function pickPromptOrder<T extends RateOrderRow>(
  rows: readonly T[] | null | undefined,
  reviewedIds: ReadonlySet<number>,
  now: number,
  dismissedIds: ReadonlySet<number> = new Set(),
): T | null {
  let best: T | null = null;
  let bestAt = -Infinity;
  for (const r of rows ?? []) {
    if (dismissedIds.has(Number(r.id))) continue;
    if (!isRatePromptVisible(r, { reviewed: reviewedIds.has(Number(r.id)), now })) continue;
    const at = deliveredAtOf(r) ?? 0;
    if (at > bestAt) {
      best = r;
      bestAt = at;
    }
  }
  return best;
}

export function isComplete(d: RateDims): boolean {
  return RATE_DIMS.every((k) => d[k] >= 1 && d[k] <= 5);
}

/** Genel puan = üç başlığın ortalaması, en yakın tam sayıya (sunucu: round(numeric) — .5 yukarı). */
export function overallRating(d: RateDims): number {
  if (!isComplete(d)) return 0;
  const avg = (d.delivery + d.calorie_fit + d.taste) / 3;
  return Math.max(1, Math.min(5, Math.round(avg)));
}

export function isLowRating(d: RateDims): boolean {
  const r = overallRating(d);
  return r > 0 && r <= LOW_RATING_MAX;
}

/** orders.items JSON → ürün listesi (aynı ürün bir kez; v1 parseItems ile aynı kural). */
export function rateItemsFromOrderItems(raw: unknown, fallbackName = 'Ürün'): RateItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: RateItem[] = [];
  for (const row of raw) {
    const r = (row ?? {}) as Record<string, unknown>;
    const productId = Number(r.id);
    if (!Number.isFinite(productId) || productId <= 0 || seen.has(productId)) continue;
    seen.add(productId);
    out.push({ productId, name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : fallbackName });
  }
  return out;
}

/** Beğendim/beğenmedim: aynı oya tekrar basmak kaldırır; yön değişince etiketler sıfırlanır. */
export function toggleVote(votes: ItemVotes, productId: number, liked: boolean): ItemVotes {
  const cur = votes[productId];
  const next = { ...votes };
  if (cur && cur.liked === liked) delete next[productId];
  else next[productId] = { liked, tags: [] };
  return next;
}

/** Etiket aç/kapa — yalnız oyun yönüne ait etiketler; en fazla 6. */
export function toggleTag(votes: ItemVotes, productId: number, tag: ItemTag): ItemVotes {
  const cur = votes[productId];
  if (!cur) return votes;
  const allowed: readonly string[] = cur.liked ? ITEM_TAGS.liked : ITEM_TAGS.disliked;
  if (!allowed.includes(tag)) return votes;
  const has = cur.tags.includes(tag);
  const tags = has ? cur.tags.filter((t) => t !== tag) : cur.tags.length >= 6 ? cur.tags : [...cur.tags, tag];
  return { ...votes, [productId]: { ...cur, tags } };
}

export function clampComment(s: string): string {
  return s.length > COMMENT_MAX ? s.slice(0, COMMENT_MAX) : s;
}

export interface SubmitArgs {
  p_order_id: number;
  p_delivery: number;
  p_calorie_fit: number;
  p_taste: number;
  p_comment: string | null;
  p_photo_path: string | null;
  p_items: { product_id: number; liked: boolean; tags: ItemTag[] }[];
}

/** RPC gövdesi (submit_order_rating). Boş yorum → null; ≤ 500. */
export function buildSubmitArgs(input: {
  orderId: number;
  dims: RateDims;
  comment: string;
  photoPath: string | null;
  votes: ItemVotes;
}): SubmitArgs {
  const comment = clampComment(input.comment.trim());
  return {
    p_order_id: input.orderId,
    p_delivery: input.dims.delivery,
    p_calorie_fit: input.dims.calorie_fit,
    p_taste: input.dims.taste,
    p_comment: comment ? comment : null,
    p_photo_path: input.photoPath || null,
    p_items: Object.entries(input.votes).map(([id, v]) => ({ product_id: Number(id), liked: v.liked, tags: [...v.tags] })),
  };
}

export type RateSurface = 'home' | 'order_detail';

/** order_rate_submit olay özellikleri (metin/fotoğraf İÇERİĞİ yok). */
export function submitEventProps(args: SubmitArgs, surface: RateSurface) {
  const dims: RateDims = { delivery: args.p_delivery, calorie_fit: args.p_calorie_fit, taste: args.p_taste };
  return {
    order_id: String(args.p_order_id),
    rating: overallRating(dims),
    delivery: args.p_delivery,
    calorie_fit: args.p_calorie_fit,
    taste: args.p_taste,
    item_count: args.p_items.length,
    has_comment: !!args.p_comment,
    has_photo: !!args.p_photo_path,
    surface,
  };
}

/** RPC hata metni → istemci kodu. */
export type SubmitError = 'already_rated' | 'expired' | 'not_delivered' | 'not_found' | 'network' | 'unknown';
export function submitErrorCode(message: string | null | undefined): SubmitError {
  const m = String(message ?? '');
  for (const k of ['already_rated', 'expired', 'not_delivered', 'not_found'] as const) if (m.includes(k)) return k;
  if (/network|fetch|timeout/i.test(m)) return 'network';
  return 'unknown';
}

/** Fotoğraf yolu: `<uid>/reviews/<sipariş>-<zaman>.jpg` (user-media; sunucu kontrolüyle aynı önek). */
export function reviewPhotoPath(userId: string, orderId: number, now: number): string {
  if (!userId) throw new Error('review_photo: no_user');
  return `${userId}/reviews/${orderId}-${now}.jpg`;
}

/** "18 Kasım 2026" / "18 November 2026" (EkOrdersScreen.formatOrderDate ile aynı biçim). */
export function formatRateDate(iso: string, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Kart etiketi: sipariş kodu; yoksa #id (orders.orderCodeLabel ile aynı kural). */
export function rateOrderLabel(o: { orderCode: string | null; id: number }): string {
  return o.orderCode ?? `#${String(o.id).slice(0, 8).toUpperCase()}`;
}

/** order_rate_prompt oturumda sipariş+yüzey başına bir kez. */
const promptSeen = new Set<string>();
export function shouldTrackPrompt(orderId: number, surface: RateSurface): boolean {
  const k = `${surface}:${orderId}`;
  if (promptSeen.has(k)) return false;
  promptSeen.add(k);
  return true;
}
export function resetPromptTracking(): void {
  promptSeen.clear();
}
