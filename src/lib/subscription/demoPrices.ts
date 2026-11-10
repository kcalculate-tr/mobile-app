/**
 * G27-S1 md.2 — Mağaza fiyatlarının TEK test / ekran görüntüsü kaynağı (İlter 11 Kas).
 *
 * Fresh aylık 199 TL · Fresh yıllık 999 TL · Balance aylık 499 TL · Balance yıllık 2999 TL.
 * USD aynı kaldı (Fresh $4.99 / $29.99).
 *
 * UYGULAMA BUNU KULLANMAZ: gerçek fiyat yalnız RevenueCat'ten (plans.ts — yedek/sabit
 * fiyat YOK, fiyat yoksa hata ekranı). Bu dosya yalnız testler ve vitrin/ekran görüntüsü
 * sahneleri içindir; bekçi testi (g27Prices) üretim kodundan içe aktarılmadığını denetler.
 * İndirim rozeti ve haftalık karşılık buradan değil, mağaza fiyatından HESAPLANIR
 * (yearlyDiscountPct, weeklyPrice): 199×12 = 2388 → 999 ⇒ %58; 499×12 = 5988 → 2999 ⇒ %50.
 */
import type { PlanKey } from './plans';

export const DEMO_PRICES_TRY: Readonly<Record<PlanKey, number>> = {
  fresh_monthly: 199,
  fresh_yearly: 999,
  balance_monthly: 499,
  balance_yearly: 2999,
};

/** USD (değişmedi): Fresh aylık / yıllık. */
export const DEMO_PRICES_USD_FRESH = { monthly: 4.99, yearly: 29.99 } as const;
