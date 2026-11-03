// Etkinlik kcal — SAF yardımcı (React Native'den bağımsız, `tsx --test` altında
// doğrudan test edilir). Sunucudaki `activity_kcal(p_type, p_minutes, p_weight_kg)`
// fonksiyonunun istemci AYNASI: kcal ≈ MET × kilo(kg) × süre(saat). Composer ve
// etkinlik kaydı CANLI önizleme için bunu kullanır; KAYIT anındaki yetkili değer
// her zaman sunucudan (did_it / log_activity → kcal_est) gelir. Sonuç "tahmini".
//
// MET tablosu Compendium of Physical Activities'ten alınmış makul orta değerler.
// Sunucudaki tabloyla eşleşmesi gerekir (bkz. G8-S2-LOG SORULAR — S1 ile uzlaş).
import type { ActivityType } from './types';

export const DEFAULT_WEIGHT_KG = 70;

export const MET_TABLE: Record<ActivityType, number> = {
  kosu: 9.8, // koşu ~8–9 km/s
  yuruyus: 3.5, // tempolu yürüyüş
  bisiklet: 7.5, // orta tempo bisiklet
  yuzme: 7.0,
  fitness: 5.0, // ağırlık/direnç antrenmanı (genel)
  yoga: 2.5,
  pilates: 3.0,
  futbol: 7.0,
  basketbol: 6.5,
  tenis: 7.0,
  dans: 5.0,
  diger: 4.0, // sınıflanmamış orta yoğunluk
};

/**
 * Tahmini yakılan kcal. Negatif/geçersiz süre → 0. Kilo verilmezse
 * DEFAULT_WEIGHT_KG (sunucu `user_nutrition_profiles` yoksa aynısını yapar).
 * Sonuç tam sayıya yuvarlanır.
 */
export function estimateActivityKcal(
  type: ActivityType,
  minutes: number,
  weightKg: number | null = null,
): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  const met = MET_TABLE[type] ?? MET_TABLE.diger;
  const kg = weightKg != null && Number.isFinite(weightKg) && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  const hours = minutes / 60;
  return Math.round(met * kg * hours);
}
