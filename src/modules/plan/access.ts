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
