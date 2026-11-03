// Keşfet arayüzü — SAF yardımcılar ve görünüm modeli (view-model).
//
// Burası React Native'den BAĞIMSIZDIR: hiçbir native import yok, böylece
// `tsx --test` (Node) altında doğrudan test edilebilir ("kart render" testi
// bu modelin üstünde koşar, gerçek bir renderer gerektirmez). Bileşenler bu
// modeli alır ve yalnız çizer; metin/sayı biçimi burada belirlenir.

import type { FeedMedia, FeedPost, MealCard } from '../types';

export type UiLang = 'tr' | 'en';

/** Bir gönderi bağlantısı — kopyala/paylaş tek kaynaktan (G5-S4 kısa alan adı). */
export function postLink(postId: string): string {
  return `https://l.eatkcal.com/p/${postId}`;
}

/** Rozet anahtarı — rol → i18n `kesfet.ui.badge.*` anahtarı (yoksa null). */
export function roleBadgeKey(role: string): 'official' | 'dietitian' | 'producer' | null {
  switch (role) {
    case 'kurum':
    case 'official':
      return 'official';
    case 'dietitian':
    case 'dyt':
      return 'dietitian';
    case 'uretici':
    case 'producer':
      return 'producer';
    default:
      return null;
  }
}

const TIME_UNITS: Record<UiLang, { now: string; min: string; hour: string; day: string }> = {
  tr: { now: 'şimdi', min: 'dk', hour: 'sa', day: 'g' },
  en: { now: 'now', min: 'min', hour: 'h', day: 'd' },
};

/**
 * Göreli zaman — "şimdi", "5 dk", "3 sa", "2 g". `nowMs` dışarıdan verilir
 * (Date.now YOK → test kararlı). Geçersiz tarih → ''.
 */
export function relativeTime(fromISO: string, nowMs: number, lang: UiLang): string {
  const then = Date.parse(fromISO);
  if (Number.isNaN(then)) return '';
  const u = TIME_UNITS[lang];
  const diffMin = Math.max(0, Math.floor((nowMs - then) / 60_000));
  if (diffMin < 1) return u.now;
  if (diffMin < 60) return `${diffMin} ${u.min}`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ${u.hour}`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ${u.day}`;
}

export interface ScaledMacros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Porsiyona göre makroları ölçekle. kcal tam sayı, makrolar 0,1 çözünürlükte. */
export function scaleMacros(card: MealCard, portion: number): ScaledMacros {
  const r1 = (n: number) => Math.round(n * portion * 10) / 10;
  return {
    kcal: Math.round(card.kcal * portion),
    protein_g: r1(card.protein_g),
    carbs_g: r1(card.carbs_g),
    fat_g: r1(card.fat_g),
  };
}

/** Akışta gösterilecek görseller — en fazla 4 (sözleşme: 1–4 görsel). */
export function mediaItems(post: FeedPost, max = 4): FeedMedia[] {
  return post.media.slice(0, max);
}

export interface PostCardModel {
  id: string;
  authorId: string;
  authorName: string;
  handle: string;
  verified: boolean;
  badgeKey: 'official' | 'dietitian' | 'producer' | null;
  /** kcal dairesel logo yerine kurumsal avatar baloncuğu gösterilsin mi. */
  isOfficial: boolean;
  time: string;
  body: string;
  avatarUrl: string | null;
  media: FeedMedia[];
  meal: MealCard | null;
  stats: { likes: number; saves: number; adds: number };
  me: { liked: boolean; saved: boolean };
  link: string;
}

/**
 * Bir gönderiyi karta hazır görünüm modeline çevirir. Saf: aynı girdi →
 * aynı çıktı (nowMs ile zaman da kararlı). Bileşen bu modeli alıp çizer.
 */
export function postCardModel(post: FeedPost, nowMs: number, lang: UiLang): PostCardModel {
  const badgeKey = roleBadgeKey(post.author.role);
  return {
    id: post.id,
    authorId: post.author.id,
    authorName: post.author.display_name,
    handle: post.author.handle,
    verified: post.author.verified,
    badgeKey,
    isOfficial: badgeKey === 'official',
    time: relativeTime(post.published_at, nowMs, lang),
    body: post.body,
    avatarUrl: post.author.avatar_url,
    media: mediaItems(post),
    meal: post.meal_card,
    stats: post.stats,
    me: post.me,
    link: postLink(post.id),
  };
}

/** AddToDaySheet porsiyon seçenekleri (sözleşme: 0,5 / 1 / 1,5 / 2). */
export const PORTION_OPTIONS = [0.5, 1, 1.5, 2] as const;

/** Öğün seçenekleri — görünüm sırası + MealType değeri (İngilizce kanonik ad). */
export const MEAL_OPTIONS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Şikayet nedenleri — i18n `kesfet.ui.report_reason.*` + RPC'ye giden kod. */
export const REPORT_REASONS = [
  'spam',
  'wrong_info',
  'inappropriate',
  'harassment',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
