// G19-S2 md.3 — Su ve etkinlik SINIRLARI (sunucuyla aynı). Saf; birim testli.
//
// Su (public.log_water, 20261106000100_g15_water.sql):
//  · tek istek |ml| ≤ 2000 ve ≠ 0, aksi 'invalid_ml'.
//  · gün toplamı [0, 20000] aralığına sıkıştırılır.
//  · geri al = aynı miktarın negatifi; tavanda eklenen kısmı kadar geri alınır
//    (19.900 + 250 → 20.000 ise geri al −100, toplam yine 19.900).
// Etkinlik (public.log_activity, 20261104002000_g8_social.sql):
//  · sunucu yalnız `minutes > 0` denetliyor; üst sınır YOK → istemci 1–600 dk,
//    mesafe 0–300 km. Sunucu tarafı CHECK için migration dosyası:
//    supabase/migrations/20261109200100_g19_s2_track_limits.sql (UYGULANMADI).

export const WATER_MAX_STEP_ML = 2000;
export const WATER_DAY_MAX_ML = 20000;

export function validWaterDelta(delta: number): boolean {
  return Number.isFinite(delta) && delta !== 0 && Math.abs(Math.round(delta)) <= WATER_MAX_STEP_ML;
}

/** İyimser yeni toplam (sunucu sıkıştırmasıyla aynı). */
export function applyWater(current: number, delta: number): number {
  const cur = Number.isFinite(current) ? current : 0;
  return Math.min(WATER_DAY_MAX_ML, Math.max(0, Math.round(cur + delta)));
}

/** Geri alınacak gerçek miktar: tavanda/tabanda kırpılan kısım geri alınmaz. */
export function waterUndoDelta(before: number, after: number): number {
  return Math.round(before - after);
}

export const ACTIVITY_MIN_MINUTES = 1;
export const ACTIVITY_MAX_MINUTES = 600;
export const ACTIVITY_MAX_KM = 300;

export type ActivityLimitError = 'minutes_low' | 'minutes_high' | 'distance_high' | null;

export function activityLimitError(minutes: number, distanceKm: number | null | undefined): ActivityLimitError {
  if (!Number.isFinite(minutes) || minutes < ACTIVITY_MIN_MINUTES) return 'minutes_low';
  if (minutes > ACTIVITY_MAX_MINUTES) return 'minutes_high';
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm > ACTIVITY_MAX_KM) return 'distance_high';
  return null;
}
