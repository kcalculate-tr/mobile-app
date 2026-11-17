// G33-S1 — Öğün planı kademe kuralları (İlter kararları, 12 Kas). SAF.
//  • Ücretsiz: plan görüntüleme + elle planlama (tarif / eatkcal / kendi öğünüm, Logla) SERBEST.
//    "Planı benim için oluştur" → şablon önizleme: 1. gün açık, kalanı bulanık + Fresh paywall.
//  • Fresh: Şablonla oluştur (deterministik, "Yenile" sınırsız, maliyetsiz) + Alışveriş listesi.
//  • Balance: Koç'la oluştur (her oluşturma 1 koç mesajı kotası) + Alışveriş listesi.
import type { Tier } from './types';

export type GenerateMode = 'preview' | 'template' | 'coach';

export interface PlanAccess {
  mode: GenerateMode;
  /** Oluşturulan planda kaç gün açık (null = hepsi). */
  openDays: number | null;
  canApply: boolean;
  shopping: boolean;
  /** Yenile koç kotası düşer mi? */
  regenCostsCoach: boolean;
}

export function planAccess(tier: Tier): PlanAccess {
  if (tier === 'balance') return { mode: 'coach', openDays: null, canApply: true, shopping: true, regenCostsCoach: true };
  if (tier === 'fresh') return { mode: 'template', openDays: null, canApply: true, shopping: true, regenCostsCoach: false };
  return { mode: 'preview', openDays: 1, canApply: false, shopping: false, regenCostsCoach: false };
}

/** Bayrak + kullanıcı: Profil satırları ve rotalar yalnız `ogun_plani` açıkken. */
export function planEntryVisible(flag: boolean): boolean {
  return flag === true;
}

export type PlanScreenState = 'guest' | 'error' | 'empty' | 'content';

/**
 * G58 — Öğün planı ekranının hâli. Misafir (oturum yok) plan yazamaz → giriş kartı. Sunucu hatası ve
 * önbellek yok → hata kartı + Tekrar dene. Yükleniyorken boş plan kartı GÖSTERİLMEZ (yuvalar çizilir).
 */
export function planScreenState(p: { signedIn: boolean; status: 'idle' | 'loading' | 'ready' | 'error' | undefined; count: number }): PlanScreenState {
  if (!p.signedIn) return 'guest';
  if (p.count > 0) return 'content';
  if (p.status === 'error') return 'error';
  if (p.status === 'loading') return 'content';
  return 'empty';
}

export type ShopGate = 'wait' | 'locked' | 'open';

/**
 * G58 — Alışveriş listesi kapısı. Abonelik durumu henüz bilinmiyorken (`unknown`) Fresh kullanıcıyı
 * paywall'a atmamak için bekler; Ücretsiz ise liste HİÇ çizilmez (paywall kapatılınca içerik
 * görünmesin) → kilitli kart. Misafir de kilitli (abonelik durumu gelmez).
 */
export function shopGate(p: { tier: Tier; status: 'verified' | 'pending' | 'rc_only' | 'server_only' | 'unknown'; signedIn: boolean }): ShopGate {
  if (planAccess(p.tier).shopping) return 'open';
  if (p.signedIn && p.status === 'unknown') return 'wait';
  return 'locked';
}
