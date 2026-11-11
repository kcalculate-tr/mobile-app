/**
 * G27-S1 md.2 — Mağaza fiyatlarının TEK test / ekran görüntüsü kaynağı (İlter 11 Kas).
 * G31-S1 md.3 — TL fiyatlar ,99'lu; USD güncellendi.
 *
 * TL: Fresh aylık 199,99 · Fresh yıllık 999,99 · Balance aylık 499,99 · Balance yıllık 2999,99.
 * USD: Fresh aylık $5.99 · Fresh yıllık $29.99 · Balance aylık $12.99 · Balance yıllık $59.99.
 *
 * UYGULAMA BUNU KULLANMAZ: gerçek fiyat yalnız RevenueCat'ten (plans.ts — yedek/sabit
 * fiyat YOK, fiyat yoksa hata ekranı). Bu dosya yalnız testler ve vitrin/ekran görüntüsü
 * sahneleri içindir; bekçi testi (g27Prices) üretim kodundan içe aktarılmadığını denetler.
 * İndirim rozeti ve haftalık karşılık buradan değil, mağaza fiyatından HESAPLANIR
 * (yearlyDiscountPct, weeklyPrice): 199,99×12 = 2399,88 → 999,99 ⇒ %58;
 * 499,99×12 = 5999,88 → 2999,99 ⇒ %50.
 */
import type { PlanKey } from './plans';

export const DEMO_PRICES_TRY: Readonly<Record<PlanKey, number>> = {
  fresh_monthly: 199.99,
  fresh_yearly: 999.99,
  balance_monthly: 499.99,
  balance_yearly: 2999.99,
};

/** USD: Fresh aylık / yıllık (G31: aylık $5.99). */
export const DEMO_PRICES_USD_FRESH = { monthly: 5.99, yearly: 29.99 } as const;

/** USD: Balance aylık / yıllık. */
export const DEMO_PRICES_USD_BALANCE = { monthly: 12.99, yearly: 59.99 } as const;
