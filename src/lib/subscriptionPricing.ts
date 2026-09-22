/**
 * Öğün aboneliği — fiyat modeli (ŞABLON).
 *
 * DİKKAT: Buradaki rakamlar ONAYLANMADI. Birim ekonomiden türetilmiş bir
 * öneridir (gıda ort. 88 TL, kurye ort. 110 TL, hedef katkı payı ~%59).
 * Abonelik satışa açılmadan önce bu dosyadaki sabitler onaylanmalı; kalıcı
 * çözümde bunlar `subscription_plans` tablosundan okunacak, uygulamaya
 * gömülü kalmayacak.
 *
 * Model iki kalemden oluşuyor:
 *   1) Öğün bedeli — toplam öğün sayısına göre kademeli birim fiyat
 *   2) Teslimat bedeli — günde 1 teslimat dahil, her EK günlük teslimat ücretli
 *
 * İkinci kalem bilinçli: gıda 88 TL iken kurye 110 TL. Günde 3 teslimat,
 * günde 1 teslimata göre 220 TL/gün daha pahalıya mal oluyor. Bu fark
 * müşteriye sebebiyle gösterilmeli, gizlenmemeli.
 */

export type Duration = 5 | 10 | 15 | 20 | 30
export type PerDay = 1 | 2 | 3

export const DURATIONS: Duration[] = [5, 10, 15, 20, 30]
export const MEALS_PER_DAY: PerDay[] = [1, 2, 3]
export const DELIVERIES_PER_DAY: PerDay[] = [1, 2, 3]

/** Toplam öğün sayısına göre birim fiyat kademeleri (büyükten küçüğe). */
export const MEAL_TIERS: { minMeals: number; unitPrice: number }[] = [
  { minMeals: 60, unitPrice: 340 },
  { minMeals: 30, unitPrice: 355 },
  { minMeals: 15, unitPrice: 375 },
  { minMeals: 0, unitPrice: 395 },
]

/** Günde 1 teslimat fiyata dahil; her ek günlük teslimat bu kadar/gün. */
export const EXTRA_DELIVERY_PER_DAY = 115

/** Tekil siparişte medyan öğün fiyatı — "ne kazandın" karşılaştırması için. */
export const SINGLE_MEAL_REFERENCE = 425

export interface SubscriptionSelection {
  durationDays: Duration
  mealsPerDay: PerDay
  deliveriesPerDay: PerDay
}

export interface SubscriptionQuote {
  totalMeals: number
  totalDeliveries: number
  unitPrice: number
  mealsTotal: number
  deliveryTotal: number
  extraDeliveriesPerDay: number
  total: number
  /** Öğün başına efektif fiyat (teslimat bedeli dahil). */
  perMeal: number
  /** Tekil sipariş fiyatına göre tasarruf yüzdesi. */
  savingPercent: number
}

export const unitPriceFor = (totalMeals: number): number =>
  MEAL_TIERS.find((t) => totalMeals >= t.minMeals)?.unitPrice
  ?? MEAL_TIERS[MEAL_TIERS.length - 1].unitPrice

/**
 * Teslimat sayısı öğün sayısını aşamaz — 2 öğünü 3 teslimata bölmek anlamsız.
 * Kurucu ekran bu kombinasyonu seçtirmez, burada da savunmacı davranıyoruz.
 */
export const isValidSelection = (sel: SubscriptionSelection): boolean =>
  sel.deliveriesPerDay <= sel.mealsPerDay

export function quote(sel: SubscriptionSelection): SubscriptionQuote {
  const deliveriesPerDay = Math.min(sel.deliveriesPerDay, sel.mealsPerDay)
  const totalMeals = sel.durationDays * sel.mealsPerDay
  const totalDeliveries = sel.durationDays * deliveriesPerDay
  const unitPrice = unitPriceFor(totalMeals)
  const mealsTotal = totalMeals * unitPrice
  const extraDeliveriesPerDay = Math.max(0, deliveriesPerDay - 1)
  const deliveryTotal = extraDeliveriesPerDay * EXTRA_DELIVERY_PER_DAY * sel.durationDays
  const total = mealsTotal + deliveryTotal
  const perMeal = Math.round(total / totalMeals)
  return {
    totalMeals,
    totalDeliveries,
    unitPrice,
    mealsTotal,
    deliveryTotal,
    extraDeliveriesPerDay,
    total,
    perMeal,
    savingPercent: Math.max(0, Math.round((1 - perMeal / SINGLE_MEAL_REFERENCE) * 100)),
  }
}

export interface DeliveryWindow {
  id: string
  label: string
  range: string
}

/** ŞABLON — kalıcı çözümde `delivery_windows` tablosundan gelecek. */
export const DELIVERY_WINDOWS: DeliveryWindow[] = [
  { id: 'morning', label: 'Sabah', range: '08:00 – 10:00' },
  { id: 'noon', label: 'Öğle', range: '12:00 – 14:00' },
  { id: 'evening', label: 'Akşam', range: '18:00 – 20:00' },
]

/**
 * Öğünlerin teslimatlara dağılımı: floor + kalan erken teslimatlara.
 * 3 öğün / 2 teslimat → [2, 1]
 */
export function mealDistribution(mealsPerDay: number, deliveriesPerDay: number): number[] {
  const d = Math.max(1, Math.min(deliveriesPerDay, mealsPerDay))
  const base = Math.floor(mealsPerDay / d)
  const remainder = mealsPerDay % d
  return Array.from({ length: d }, (_, i) => base + (i < remainder ? 1 : 0))
}

export const formatTRY = (value: number): string =>
  `₺${Math.round(value).toLocaleString('tr-TR')}`
