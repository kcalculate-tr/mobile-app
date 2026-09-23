/**
 * Saf Macro kurallari — Supabase istemcisine DOKUNMAZ.
 *
 * 23.09.2026: bu mantik macros.ts icindeydi; o dosya './supabase'i import
 * ettigi icin birim testinden cagirildiginda gercek bir auth istemcisi ayaga
 * kalkiyordu. Kazanim formulu sunucudaki grant_macros_on_delivery() ile
 * birebir ayni olmak ZORUNDA oldugundan test altinda olmasi sart.
 */

export const FALLBACK_EARN_THRESHOLD = 500      // TL → 1 Macro
export const FALLBACK_MEAL_COST = 5             // Macro → 1 ücretsiz öğün
export const FALLBACK_REWARD_VALID_DAYS = 90    // gün

export interface MacroProfile {
  /** Kullanılabilir Macro sayısı. */
  macro_balance: number
  /** Eşiğe ulaşmayan birikmiş harcama (TL). */
  macro_points: number
}

export interface MacroSettings {
  earnThreshold: number
  mealCost: number
  rewardValidDays: number
  /** Ücretsiz öğün kuponunun GEÇMEDİĞİ ürün kategorileri. */
  excludedCategories: string[]
}

export const DEFAULT_MACRO_SETTINGS: MacroSettings = {
  earnThreshold: FALLBACK_EARN_THRESHOLD,
  mealCost: FALLBACK_MEAL_COST,
  rewardValidDays: FALLBACK_REWARD_VALID_DAYS,
  excludedCategories: ['Koliye Özel Fırsatlar'],
}

export interface MacroProgress {
  /** Kullanılabilir Macro. */
  balance: number
  /** Bir öğün için gereken Macro. */
  mealCost: number
  /** Bir sonraki ücretsiz öğüne kaç Macro kaldı. */
  macrosToNextMeal: number
  /** Bir sonraki Macro'ya kaç TL kaldı. */
  liraToNextMacro: number
  /** Öğün ilerlemesi 0..1 — halka/bar göstergesi için. */
  mealProgress: number
}

export function macroProgress(
  profile: MacroProfile | null,
  settings: MacroSettings = DEFAULT_MACRO_SETTINGS,
): MacroProgress {
  const balance = Math.max(0, profile?.macro_balance ?? 0)
  const points = Math.max(0, profile?.macro_points ?? 0)
  const mealCost = Math.max(1, settings.mealCost)
  // Bakiye mealCost'a ulaşınca sunucu kuponu üretip düşüyor; yine de savunmacı
  // davran ve modülünü al ki UI hiçbir durumda 5/5 gibi takılı kalmasın.
  const inCycle = balance % mealCost
  return {
    balance,
    mealCost,
    macrosToNextMeal: Math.max(0, mealCost - inCycle),
    liraToNextMacro: Math.max(0, Math.ceil(settings.earnThreshold - points)),
    mealProgress: inCycle / mealCost,
  }
}

/**
 * `profiles.macro_points` TANIM GEREĞİ eşiğin altındaki artıktır — sunucudaki
 * trigger her zaman `v_remainder` yazar. Eski macro modelinden devreden
 * satırlarda bu değer eşiğin çok üstünde kalmış olabiliyor (ör. 1620) ve hem
 * önizlemeyi hem gerçek kazanımı şişiriyordu. Aralık dışı bir artık 0 sayılır;
 * eski modelin puanının yeni modelde tanımlı bir karşılığı yok.
 *
 * Sunucu tarafındaki aynı koruma: migration 20260923_macro_points_range_guard.
 */
export function normalizeCarryover(points: number | null | undefined, earnThreshold: number): number {
  const p = Number(points ?? 0)
  if (!Number.isFinite(p) || p < 0 || !(earnThreshold > 0) || p >= earnThreshold) return 0
  return p
}

/**
 * Bir siparişin kazandıracağı Macro.
 *
 * Formül sunucudaki grant_macros_on_delivery() ile BİREBİR aynı olmalı:
 *   kazanç = floor((devreden artık + sipariş tutarı) / eşik)
 *
 * Devreden artık hesaba katıldığı için eşiğin altındaki bir sipariş de Macro
 * kazandırabilir. Kazanım sipariş 'delivered' + 'paid' olduğunda işlenir,
 * sipariş anında DEĞİL — arayüzde "kazanacaksın" dili kullanılmalı.
 */
export function macroEarnedForOrder(
  orderTotal: number,
  profile: MacroProfile | null,
  settings: MacroSettings = DEFAULT_MACRO_SETTINGS,
): number {
  const esik = settings.earnThreshold
  if (!(esik > 0) || !(orderTotal > 0)) return 0
  return Math.floor((normalizeCarryover(profile?.macro_points, esik) + orderTotal) / esik)
}

/** Bir sonraki Macro için gereken ek harcama (TL). */
export function liraToNextMacroAfterOrder(
  orderTotal: number,
  profile: MacroProfile | null,
  settings: MacroSettings = DEFAULT_MACRO_SETTINGS,
): number {
  const esik = settings.earnThreshold
  if (!(esik > 0)) return 0
  const birikmis = normalizeCarryover(profile?.macro_points, esik) + Math.max(orderTotal, 0)
  return Math.max(0, Math.ceil(esik - (birikmis % esik)))
}
