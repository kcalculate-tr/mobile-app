import { getSupabaseClient } from './supabase'

/**
 * Macro modeli v2 — "harcadıkça kazan, öğün olarak kullan".
 *
 * Eski model (coin satın al → 15 coin → 30 gün %20 ayrıcalıklı üyelik) hiç
 * kullanılmadı ve kaldırıldı. Yeni model:
 *   • Her `earnThreshold` TL net ödeme = 1 Macro
 *   • `mealCost` Macro birikince otomatik "Ücretsiz Öğün" kuponu üretilir
 *
 * KRİTİK: kazanım ve kupon üretimi TAMAMEN sunucuda. Sipariş 'delivered'
 * olduğunda orders üzerindeki trg_grant_macros_on_delivery trigger'ı çalışır.
 * İstemcinin profiles.macro_balance / macro_points üzerinde UPDATE yetkisi
 * YOK (migration 20260922100000 kolon yetkisini kaldırdı). Bu dosya yalnızca
 * OKUR ve gösterim mantığı üretir — buraya yazma fonksiyonu eklenmemeli.
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

export async function fetchMacroProfile(userId: string): Promise<MacroProfile | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('macro_balance, macro_points')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    macro_balance: Number((data as any).macro_balance ?? 0),
    macro_points: Number((data as any).macro_points ?? 0),
  }
}

export async function fetchMacroSettings(): Promise<MacroSettings> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('macro_earn_threshold, macro_meal_cost, macro_reward_valid_days, macro_meal_excluded_categories')
    .eq('id', 1)
    .maybeSingle()
  if (!data) return DEFAULT_MACRO_SETTINGS
  const row = data as Record<string, unknown>
  const threshold = Number(row.macro_earn_threshold)
  const mealCost = Number(row.macro_meal_cost)
  const validDays = Number(row.macro_reward_valid_days)
  const excluded = row.macro_meal_excluded_categories
  return {
    earnThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : FALLBACK_EARN_THRESHOLD,
    mealCost: Number.isFinite(mealCost) && mealCost > 0 ? mealCost : FALLBACK_MEAL_COST,
    rewardValidDays: Number.isFinite(validDays) && validDays > 0 ? validDays : FALLBACK_REWARD_VALID_DAYS,
    excludedCategories: Array.isArray(excluded)
      ? (excluded as unknown[]).map(String)
      : DEFAULT_MACRO_SETTINGS.excludedCategories,
  }
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

export interface MealRewardCoupon {
  id: string
  code: string
  description: string | null
  end_date: string | null
}

/** Macro karşılığı üretilmiş, henüz kullanılmamış ücretsiz öğün kuponları. */
export async function fetchMealRewardCoupons(): Promise<MealRewardCoupon[]> {
  const supabase = getSupabaseClient()
  // RLS zaten kullanıcıya ait ve limiti dolmamış kuponları filtreliyor.
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, code, description, end_date')
    .eq('source', 'macro_reward')
    .order('end_date', { ascending: true })
  if (error || !data) return []
  return data as MealRewardCoupon[]
}

export interface MacroTransaction {
  id: number
  type: string
  amount: number
  note: string | null
  created_at: string
}

export async function fetchMacroTransactions(userId: string, limit = 30): Promise<MacroTransaction[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('macro_transactions')
    .select('id, type, amount, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as MacroTransaction[]
}
