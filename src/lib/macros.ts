import { getSupabaseClient } from './supabase'
import { DEFAULT_MACRO_SETTINGS, FALLBACK_EARN_THRESHOLD, FALLBACK_MEAL_COST, FALLBACK_REWARD_VALID_DAYS } from './macroRules';
import type { MacroProfile, MacroSettings } from './macroRules';

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

export * from './macroRules';

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
