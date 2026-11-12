// G34-S1 · Tur 26o — erişim tablosu (05-akis-haritasi.png "Erişim: kim neyi görür", BAĞLAYICI).
// Saf (tsx --test). Kalori/makro hedefi, hedef tarihi eğrisi, haftalık check-in ve elle planlama
// ÜCRETSİZ. Öğün planı ücretsizde yalnız 1. gün (kalanı kilitli/bulanık + bağlamsal paywall);
// Fresh tam hafta + şablon; Balance Koç'la plan + "Koçla planımı düzenle". Alışveriş listesi Fresh+.
import type { Tier } from '../../lib/subscription/plans';

export interface PlanAccess {
  targets: true;
  targetCurve: true;
  checkin: true;
  manualPlanning: true;
  /** Oluşturulmuş öğün planında açık gün sayısı (ücretsiz 1). */
  openDays: number;
  /** Planı benim için oluştur: yok · şablon (Fresh) · Koç (Balance). */
  generate: 'paywall' | 'template' | 'coach';
  shoppingList: boolean;
  coachEdit: boolean;
}

export function planAccess(tier: Tier): PlanAccess {
  return {
    targets: true,
    targetCurve: true,
    checkin: true,
    manualPlanning: true,
    openDays: tier === 'free' ? 1 : 7,
    generate: tier === 'balance' ? 'coach' : tier === 'fresh' ? 'template' : 'paywall',
    shoppingList: tier !== 'free',
    coachEdit: tier === 'balance',
  };
}

/** Gün kilitli mi? `index` haftanın 0 tabanlı günü (0 = planın ilk günü). */
export function dayLocked(tier: Tier, index: number): boolean {
  return index >= planAccess(tier).openDays;
}

/** Bağlamsal paywall hangi planı öne çıkarsın: Koç isteği → Balance, diğerleri → Fresh. */
export function paywallPlanFor(feature: 'week' | 'shopping' | 'coach_edit' | 'generate'): 'fresh' | 'balance' {
  return feature === 'coach_edit' ? 'balance' : 'fresh';
}
