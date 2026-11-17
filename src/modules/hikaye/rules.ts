// G59-S1 — Hikâye saf kuralları: 24 saat görünürlük, tepsi sırası, halka durumu, görüntüleyici
// gezinmesi (dokunma bölgeleri, sonraki/önceki kişi), süreler, jest sınıflandırması, anket yüzdeleri.
// SAF — native yok; `tsx --test` ve jest altında koşar.
import type { Story, StoryReactionKind, TrayItem } from './types';

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Fotoğraf / yazılı hikâye süresi (tasarım `.seg{animation:seg 5000ms linear}`). */
export const PHOTO_STORY_MS = 5000;
export const MAX_VIDEO_STORY_MS = 60_000;

/** 24 saat dolmamış ve silinmemiş (istemci tarafı ikinci kontrol; asıl kural sunucuda). */
export function isStoryActive(s: Pick<Story, 'expires_at'>, nowMs: number = Date.now()): boolean {
  const exp = Date.parse(s.expires_at);
  return Number.isFinite(exp) && exp > nowMs;
}

/** Tepsi / görüntüleyici: yalnız aktif hikâyeler (öne çıkan modunda süzme yok). */
export function activeStories<T extends Pick<Story, 'expires_at'>>(list: readonly T[], nowMs: number = Date.now()): T[] {
  return list.filter((s) => isStoryActive(s, nowMs));
}

/** Kalan saat (yukarı yuvarlanır; 0'ın altına inmez) — Görenler "N saat daha yayında". */
export function hoursLeft(expiresAt: string, nowMs: number = Date.now()): number {
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return 0;
  return Math.max(0, Math.ceil((exp - nowMs) / 3_600_000));
}

/** "12 dk" / "3 sa" / "1 g" (TR) — "12m" / "3h" / "1d" (EN). */
export function formatAgo(createdAt: string, nowMs: number, lang: 'tr' | 'en'): string {
  const t = Date.parse(createdAt);
  const min = Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 60_000)) : 0;
  if (min < 60) return lang === 'en' ? `${Math.max(1, min)}m` : `${Math.max(1, min)} dk`;
  const h = Math.floor(min / 60);
  if (h < 24) return lang === 'en' ? `${h}h` : `${h} sa`;
  const d = Math.floor(h / 24);
  return lang === 'en' ? `${d}d` : `${d} g`;
}

/**
 * Tepsi sırası (sunucu `get_story_tray` ile aynı): ben → görülmemişi olanlar → en yeni hikâye.
 * Hikâyesi olmayan başkaları düşer; "ben" hikâyem olmasa da kalır ("Hikâyen +").
 */
export function orderTray(items: readonly TrayItem[]): TrayItem[] {
  return items
    .filter((i) => i.is_me || i.story_count > 0)
    .slice()
    .sort((a, b) => {
      if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
      const ua = a.unseen_count > 0 ? 1 : 0;
      const ub = b.unseen_count > 0 ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return (Date.parse(b.latest_at ?? '') || 0) - (Date.parse(a.latest_at ?? '') || 0);
    });
}

export type RingState = 'unseen' | 'seen' | 'none';
/** Halka: görülmemiş = lime, görülmüş = gri, hikâye yok = halka yok. Kendi hikâyem her zaman "seen" (gri değil lime değil → gri). */
export function ringState(item: Pick<TrayItem, 'story_count' | 'unseen_count' | 'is_me'>): RingState {
  if (item.story_count <= 0) return 'none';
  if (item.is_me) return 'seen';
  return item.unseen_count > 0 ? 'unseen' : 'seen';
}

/** Görüldü işaretinden sonra tepsiyi iyimser güncelle. */
export function markSeenInTray(items: readonly TrayItem[], userId: string, seenCount: number): TrayItem[] {
  return items.map((i) => (i.user_id === userId ? { ...i, unseen_count: Math.max(0, i.unseen_count - seenCount) } : i));
}

/** Bir kişinin hikâyelerinden açılış: ilk görülmemiş; hepsi görüldüyse baştan. */
export function firstUnseenIndex(stories: readonly Pick<Story, 'seen'>[]): number {
  const i = stories.findIndex((s) => !s.seen);
  return i < 0 ? 0 : i;
}

/** Hikâye süresi (ms): video = kendi süresi (≤ 60 sn), foto/yazılı = 5 sn. */
export function storyDurationMs(s: Pick<Story, 'media_type' | 'duration_s'>): number {
  if (s.media_type === 'video' && s.duration_s && s.duration_s > 0) {
    return Math.min(MAX_VIDEO_STORY_MS, Math.round(s.duration_s * 1000));
  }
  return PHOTO_STORY_MS;
}

/** Dokunma bölgeleri (tasarım): sol üçte bir = önceki, sağ üçte iki = sonraki. */
export function tapZone(x: number, width: number): 'prev' | 'next' {
  return x < width / 3 ? 'prev' : 'next';
}

export interface ViewerPos {
  user: number;
  story: number;
}
/** Sonraki hikâye; kişinin sonuysa sonraki kişinin başı; hepsi bittiyse 'end'. */
export function nextPos(pos: ViewerPos, counts: readonly number[]): ViewerPos | 'end' {
  const n = counts[pos.user] ?? 0;
  if (pos.story + 1 < n) return { user: pos.user, story: pos.story + 1 };
  for (let u = pos.user + 1; u < counts.length; u++) if ((counts[u] ?? 0) > 0) return { user: u, story: 0 };
  return 'end';
}
/** Önceki hikâye; kişinin başıysa önceki kişinin SONU; en baştaysa aynı yerde (yeniden başlar). */
export function prevPos(pos: ViewerPos, counts: readonly number[]): ViewerPos {
  if (pos.story > 0) return { user: pos.user, story: pos.story - 1 };
  for (let u = pos.user - 1; u >= 0; u--) if ((counts[u] ?? 0) > 0) return { user: u, story: (counts[u] ?? 1) - 1 };
  return { user: pos.user, story: 0 };
}
/** Yana kaydırma: sonraki / önceki KİŞİ (başından). */
export function jumpUser(pos: ViewerPos, counts: readonly number[], dir: 1 | -1): ViewerPos | 'end' | null {
  for (let u = pos.user + dir; u >= 0 && u < counts.length; u += dir) if ((counts[u] ?? 0) > 0) return { user: u, story: 0 };
  return dir === 1 ? 'end' : null;
}

export type ViewerSwipe = 'down' | 'up' | 'left' | 'right' | null;
/** Jest sınıflandırma: eşik 80 pt ya da hızlı fiske (|v| > 0,6 pt/ms) — baskın eksen. */
export function classifySwipe(dx: number, dy: number, vx = 0, vy = 0): ViewerSwipe {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 12 && ay < 12) return null;
  if (ay >= ax) {
    if (dy > 80 || vy > 0.6) return 'down';
    if (dy < -80 || vy < -0.6) return 'up';
    return null;
  }
  if (dx < -60 || vx < -0.6) return 'left';
  if (dx > 60 || vx > 0.6) return 'right';
  return null;
}

/** Hızlı tepkiler (tasarım FinStoryViewer `rx`, sıra birebir). Serbest metin DM'e kadar YOK. */
export const QUICK_REACTIONS: readonly StoryReactionKind[] = ['like', 'congrats', 'enjoy', 'recipe', 'great', 'join'];

/** Anket yüzdeleri (toplam 0 → hepsi 0); yuvarlama farkı en büyük seçeneğe eklenir (toplam 100). */
export function pollPercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (Math.max(0, c) / total) * 100);
  const out = raw.map((r) => Math.floor(r));
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (const o of order) {
    if (rest <= 0) break;
    out[o.i] += 1;
    rest -= 1;
  }
  return out;
}

/** Hikâye girişleri görünür mü? Bayrak kapalıyken HİÇBİR giriş yok (tepsi, kamera sekmesi, halka, öne çıkanlar). */
export function storiesEntryVisible(flags: { hikaye: boolean; kesfet?: boolean }): boolean {
  return flags.hikaye === true && flags.kesfet !== false;
}

/** Kamera mod sekmeleri: Gönderi (paylaşım açıksa) · Hikâye · Reels (yalnız kesfet_video). */
export function cameraModes(flags: { kesfet_paylasim: boolean; kesfet_video: boolean }): Array<'post' | 'story' | 'reels'> {
  const m: Array<'post' | 'story' | 'reels'> = [];
  if (flags.kesfet_paylasim) m.push('post');
  m.push('story');
  if (flags.kesfet_video) m.push('reels');
  return m;
}

/** Video hikâye izni: hikaye + kesfet_video birlikte. */
export function storyVideoAllowed(flags: { hikaye: boolean; kesfet_video: boolean }): boolean {
  return flags.hikaye && flags.kesfet_video;
}

/** Basılı tutarak video: en fazla 60 sn (G58-S1 sınırı). Kayıt süresi → ilerleme oranı. */
export function recordProgress(elapsedMs: number): number {
  return Math.max(0, Math.min(1, elapsedMs / MAX_VIDEO_STORY_MS));
}

/** Kamera yakınlaştırma (tasarım 0,5 / 1 / 2×) → expo-camera `zoom` (0..1). Tek objektifli kamerada 0,5 = 0. */
export function zoomFor(level: 0.5 | 1 | 2): number {
  return level === 2 ? 0.25 : 0;
}
