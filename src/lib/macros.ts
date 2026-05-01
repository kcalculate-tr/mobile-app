import { getSupabaseClient } from './supabase'

// Fallback değerler — settings tablosundan okunamazsa kullanılır.
// Admin BossMacro panelinden değiştirilir (settings.macro_price vs).
export const FALLBACK_MACRO_PRICE = 1500      // TL / macro (admin default ile align)
export const FALLBACK_THRESHOLD = 15          // macro → ayrıcalıklı üye
export const FALLBACK_MEMBERSHIP_DAYS = 30    // gün
export const MACRO_MEMBER_DISCOUNT_PERCENT = 20 // ayrıcalıklı üye sepet indirimi

// Legacy isimler — mevcut consumer'lar kırılmadan yaşasın.
// Yeni kod useMacroSettings() üzerinden canlı değer okusun.
export const MACRO_PRICE = FALLBACK_MACRO_PRICE
export const MEMBERSHIP_THRESHOLD = FALLBACK_THRESHOLD
export const MEMBERSHIP_DAYS = FALLBACK_MEMBERSHIP_DAYS

export interface MacroProfile {
  macro_balance: number
  macro_points: number
  privileged_until: string | null
  total_macros_purchased: number
}

export async function fetchMacroProfile(userId: string): Promise<MacroProfile | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('macro_balance, macro_points, privileged_until, total_macros_purchased')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as MacroProfile
}

export function isPrivileged(profile: MacroProfile | null): boolean {
  if (!profile?.privileged_until) return false
  return new Date(profile.privileged_until) > new Date()
}

export function isMacroMemberFromUntil(privilegedUntil: string | null | undefined): boolean {
  if (!privilegedUntil) return false
  return new Date(privilegedUntil) > new Date()
}

export function calculateMacroDiscount(subtotal: number, isMember: boolean): number {
  if (!isMember || subtotal <= 0) return 0
  return Number((subtotal * (MACRO_MEMBER_DISCOUNT_PERCENT / 100)).toFixed(2))
}

export function privilegedUntilFormatted(profile: MacroProfile | null): string {
  if (!profile?.privileged_until) return '';
  return new Date(profile.privileged_until).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function privilegedDaysLeft(profile: MacroProfile | null): number {
  if (!profile?.privileged_until) return 0
  const diff = new Date(profile.privileged_until).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export async function createMacroPurchaseOrder(params: {
  userId: string
  quantity: number
  totalAmount: number
}): Promise<{ orderId: string; orderCode: string } | null> {
  const supabase = getSupabaseClient()
  const orderCode = `MCR-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: params.userId,
      status: 'pending_payment',
      payment_status: 'pending',
      delivery_type: 'immediate',
      total_price: params.totalAmount,
      items: JSON.stringify([{
        name: `Macro Coin x${params.quantity}`,
        quantity: params.quantity,
        unit_price: MACRO_PRICE,
        price: MACRO_PRICE,
        product_type: 'macro',
      }]),
      order_code: orderCode,
      type: 'macro_purchase',
      macro_quantity: params.quantity,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Macro order create error:', error)
    return null
  }

  return { orderId: String(data.id), orderCode }
}

export async function completeMacroPurchase(params: {
  userId: string
  orderId: string
  quantity: number
  pricePaid: number
}): Promise<boolean> {
  const supabase = getSupabaseClient()

  // Mevcut profili çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('macro_balance, total_macros_purchased, privileged_until')
    .eq('id', params.userId)
    .maybeSingle()

  if (!profile) return false

  const newBalance = (profile.macro_balance || 0) + params.quantity
  const newTotal   = (profile.total_macros_purchased || 0) + params.quantity

  // Üyelik kontrolü
  let privilegedUntil = profile.privileged_until
  if (newBalance >= MEMBERSHIP_THRESHOLD) {
    const base = privilegedUntil && new Date(privilegedUntil) > new Date()
      ? new Date(privilegedUntil)
      : new Date()
    base.setDate(base.getDate() + MEMBERSHIP_DAYS)
    privilegedUntil = base.toISOString()
  }

  // Profil güncelle
  await supabase.from('profiles').update({
    macro_balance: newBalance,
    total_macros_purchased: newTotal,
    ...(privilegedUntil !== profile.privileged_until ? { privileged_until: privilegedUntil } : {}),
  }).eq('id', params.userId)

  // Transaction kaydet
  await supabase.from('macro_transactions').insert({
    user_id: params.userId,
    type: 'purchase',
    amount: params.quantity,
    price_paid: params.pricePaid,
    order_id: Number(params.orderId),
    note: `${params.quantity} Macro Coin satın alındı`,
  })

  if (privilegedUntil !== profile.privileged_until) {
    await supabase.from('macro_transactions').insert({
      user_id: params.userId,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayrıcalıklı üyelik aktifleşti — ${MEMBERSHIP_DAYS} gün`,
    })
  }

  return true
}

export interface MacroSettings {
  macro_price: number
  macro_threshold: number
  macro_membership_days: number
}

export async function fetchMacroSettings(): Promise<MacroSettings> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('macro_price, macro_threshold, macro_membership_days')
    .eq('id', 1)
    .maybeSingle()
  return {
    macro_price: data?.macro_price ?? FALLBACK_MACRO_PRICE,
    macro_threshold: data?.macro_threshold ?? FALLBACK_THRESHOLD,
    macro_membership_days: data?.macro_membership_days ?? FALLBACK_MEMBERSHIP_DAYS,
  }
}

// ─── Sipariş bazlı Macro kazanım ──────────────────────────────────────────────
// Kural: Her 2500 TL harcamada 1 Macro kazanılır (geçmiş harcamalar birikir)
// Örnek: 5 × 500 TL = 2500 TL → 1 Macro kazanılır
export const ORDER_EARN_THRESHOLD = 2500 // TL

export async function processOrderMacroEarn(params: {
  userId: string
  orderTotal: number   // Bu siparişin tutarı (TL)
  orderId: string | number
}): Promise<{ earnedMacros: number }> {
  const supabase = getSupabaseClient()

  // Profil + birikmiş harcama çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('macro_balance, macro_points, total_macros_purchased, privileged_until')
    .eq('id', params.userId)
    .maybeSingle()

  if (!profile) return { earnedMacros: 0 }

  // macro_points = birikmiş harcama (TL cinsinden, eşiğe ulaşmayan kısım)
  const accumulated = (profile.macro_points || 0) + params.orderTotal
  const earnedMacros = Math.floor(accumulated / ORDER_EARN_THRESHOLD)
  const remainder    = accumulated % ORDER_EARN_THRESHOLD

  if (earnedMacros === 0) {
    // Henüz eşiğe ulaşmadı — sadece birikimi güncelle
    await supabase.from('profiles')
      .update({ macro_points: remainder })
      .eq('id', params.userId)
    return { earnedMacros: 0 }
  }

  // Macro kazanıldı — balance + points güncelle
  const newBalance = (profile.macro_balance || 0) + earnedMacros
  const newTotal   = (profile.total_macros_purchased || 0) + earnedMacros

  let privilegedUntil = profile.privileged_until
  if (newBalance >= MEMBERSHIP_THRESHOLD) {
    const base = privilegedUntil && new Date(privilegedUntil) > new Date()
      ? new Date(privilegedUntil)
      : new Date()
    base.setDate(base.getDate() + MEMBERSHIP_DAYS)
    privilegedUntil = base.toISOString()
  }

  await supabase.from('profiles').update({
    macro_balance: newBalance,
    macro_points: remainder,
    total_macros_purchased: newTotal,
    ...(privilegedUntil !== profile.privileged_until ? { privileged_until: privilegedUntil } : {}),
  }).eq('id', params.userId)

  // Transaction kaydet
  await supabase.from('macro_transactions').insert({
    user_id: params.userId,
    type: 'order_earn',
    amount: earnedMacros,
    price_paid: 0,
    order_id: Number(params.orderId),
    note: `Sipariş harcamasından ${earnedMacros} Macro kazanıldı (₺${params.orderTotal})`,
  })

  if (privilegedUntil !== profile.privileged_until) {
    await supabase.from('macro_transactions').insert({
      user_id: params.userId,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayrıcalıklı üyelik aktifleşti — ${MEMBERSHIP_DAYS} gün`,
    })
  }

  return { earnedMacros }
}
