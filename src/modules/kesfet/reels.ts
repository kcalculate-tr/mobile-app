// G58-S2 md.2–3 — tam ekran görüntüleyici + Reels akışı için SAF kurallar (native import YOK,
// `tsx --test` altında koşar). Bileşenler (ImageViewer, ReelsScreen) yalnız bu kararları çağırır.
import type { FeedPost } from './types';

// ── Ortak dokunma kuralı ─────────────────────────────────────────────────────

/** Çift dokunma penceresi (PostCard ile aynı: 300 ms). */
export const DOUBLE_TAP_MS = 300;

/** İkinci dokunuş pencerede geldiyse 'double' (beğeni + kalp), değilse 'single' (gecikmeli tek eylem). */
export function classifyTap(now: number, lastTap: number, windowMs = DOUBLE_TAP_MS): 'single' | 'double' {
  return lastTap > 0 && now - lastTap < windowMs ? 'double' : 'single';
}

/** Çift dokunma beğenir ama beğeniyi GERİ ALMAZ (Instagram/X): zaten beğenildiyse yalnız kalp damgası. */
export function doubleTapShouldLike(alreadyLiked: boolean): boolean {
  return !alreadyLiked;
}

// ── Görüntüleyici (ImageViewer) ──────────────────────────────────────────────

/** Aşağı kaydırma kapatma eşiği (pt) ve hız eşiği (pt/ms). */
export const VIEWER_DISMISS_DY = 120;
export const VIEWER_DISMISS_VY = 1.0;

/** Aşağı sürükleme bırakıldı → kapanır mı? Yukarı sürükleme ve yatay ağırlıklı hareket kapatmaz. */
export function viewerShouldDismiss(dy: number, vy: number, dx = 0): boolean {
  if (dy <= 0) return false;
  if (Math.abs(dx) > Math.abs(dy)) return false;
  return dy > VIEWER_DISMISS_DY || vy > VIEWER_DISMISS_VY;
}

/** Dikey sürükleme yakalansın mı (yatay sayfa kaydırmayı ezmemek için dikey ağırlıklı ve > 8 pt). */
export function viewerCapturesPan(dx: number, dy: number): boolean {
  return dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.2;
}

/** Görüntüleyicinin gösterdiği görseller: videolar hariç (video Reels'te oynar). */
export function viewerImageUrls(post: Pick<FeedPost, 'media'> | null | undefined): string[] {
  return (post?.media ?? []).filter((m) => m.kind !== 'video').map((m) => m.url);
}

// ── Reels ────────────────────────────────────────────────────────────────────

/** Tasarım (FinReelsPlayer): kaydırma 330 ms standart eğri, eşik 140 pt; Reduce Motion'da 220 ms solma. */
export const REELS_SWIPE_MS = 330;
export const REELS_FADE_MS = 220;
export const REELS_THRESHOLD_PT = 140;
/** Hızlı fiske de sayfa çevirir (pt/ms). */
export const REELS_FLICK_VY = 0.8;

export function isVideoPost(p: Pick<FeedPost, 'media'>): boolean {
  return p.media.some((m) => m.kind === 'video');
}

/**
 * Reels kuyruğu: dokunulan video İLK sırada, ardından akıştaki diğer videolu gönderiler (sıra korunur,
 * tekrar yok). `startId` yoksa/bulunamazsa akıştaki ilk video başlar (Keşfet başlığındaki Reels girişi).
 */
export function buildReelsQueue(posts: readonly FeedPost[], startId?: string | null, extra: readonly FeedPost[] = []): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  const push = (p: FeedPost | undefined) => {
    if (!p || seen.has(p.id) || !isVideoPost(p)) return;
    seen.add(p.id);
    out.push(p);
  };
  if (startId) push(posts.find((p) => p.id === startId) ?? extra.find((p) => p.id === startId));
  for (const p of posts) push(p);
  for (const p of extra) push(p);
  return out;
}

/**
 * Sürükleme bırakıldı → yeni sayfa. dy < 0 = yukarı kaydırma = SONRAKİ. Eşik 140 pt ya da hızlı fiske;
 * uçlarda sınırda kalır (ilk videodan geri, son videodan ileri gidilmez).
 */
export function reelsSnapIndex(index: number, count: number, dy: number, vy = 0): number {
  if (count <= 0) return 0;
  const passed = Math.abs(dy) > REELS_THRESHOLD_PT || Math.abs(vy) > REELS_FLICK_VY;
  let next = index;
  if (passed && dy < 0) next = index + 1;
  else if (passed && dy > 0) next = index - 1;
  return Math.max(0, Math.min(count - 1, next));
}

/** Uçta mıyız (sürüklemeyi direnerek göster): ilk sayfada aşağı, son sayfada yukarı. */
export function reelsAtEdge(index: number, count: number, dy: number): boolean {
  return (index === 0 && dy > 0) || (index >= count - 1 && dy < 0);
}

export type ReelSlot = 'play' | 'preload' | 'none';

/**
 * Tek oynatıcı kuralı: yalnız ekrandaki sayfa OYNAR; bir sonraki sayfa önceden yüklenir (duraklatılmış
 * oynatıcı); diğer tüm sayfalar oynatıcısızdır (native decoder serbest — yalnız kapak). Ekran arka
 * plandaysa (yorum sayfası açık değil, uygulama/sekme arka planda) ekrandaki de duraklar ama bırakılmaz.
 */
export function reelSlot(i: number, active: number): ReelSlot {
  if (i === active) return 'play';
  if (i === active + 1) return 'preload';
  return 'none';
}

/** Aynı anda en çok kaç native oynatıcı var (test + belge): ekrandaki + sonraki = 2. */
export function mountedPlayerCount(count: number, active: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) if (reelSlot(i, active) !== 'none') n += 1;
  return n;
}

/** Oynatıcı gerçekten çalmalı mı: ekrandaki sayfa + kullanıcı duraklatmamış + uzun basılı değil + ekran önde. */
export function reelShouldPlay(slot: ReelSlot, opts: { paused: boolean; holding: boolean; focused: boolean }): boolean {
  return slot === 'play' && !opts.paused && !opts.holding && opts.focused;
}

/** Akışın sonuna yaklaşınca (son 2 sayfa) yeni sayfa iste. */
export function reelsShouldLoadMore(index: number, count: number, hasMore: boolean): boolean {
  return hasMore && count > 0 && index >= count - 2;
}
