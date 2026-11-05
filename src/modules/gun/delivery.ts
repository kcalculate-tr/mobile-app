// delivery — eatkcal teslim → otomatik log anı (FinHomeDelivered + FinMoDeliver).
// SAF; sipariş/ödeme dosyalarına DOKUNMAZ, yalnız MEVCUT sipariş kaydından
// (orders + order_items) sunum amaçlı bir "otomatik loglandı" kartı türetir.
// Gerçek consumption kaydı sipariş akışının kendi işidir; burada yalnız Ana
// sayfadaki teslim anını (kase cam nesnesi + "…'a loglandı" zaman hapı)
// beslemek için en son siparişi okuruz.

import { slotFromHour, type SlotKey } from './homeData';

export interface DeliveryProduct {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface DeliveryOrderItem {
  quantity: number;
  products: DeliveryProduct | null;
}
export interface DeliveryOrder {
  id: string;
  order_code: string | null;
  created_at: string; // ISO
  order_items: DeliveryOrderItem[];
}

export interface DeliveredCard {
  orderId: string;
  /** Birden çok ürün varsa "İlk ürün +N" biçimi. */
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: SlotKey;
  createdAt: string;
}

function orderMacros(o: DeliveryOrder): { kcal: number; protein: number; carbs: number; fat: number } {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  for (const it of o.order_items ?? []) {
    const p = it.products;
    if (!p) continue;
    const q = it.quantity || 1;
    kcal += (p.calories || 0) * q;
    protein += (p.protein || 0) * q;
    carbs += (p.carbs || 0) * q;
    fat += (p.fat || 0) * q;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}

function orderName(o: DeliveryOrder): string {
  const names = (o.order_items ?? [])
    .map((it) => it.products?.name)
    .filter((n): n is string => !!n);
  if (names.length === 0) return o.order_code ? `Sipariş ${o.order_code}` : 'eatkcal siparişi';
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

/** En son siparişi otomatik-log kartına çevir. Sipariş yoksa null. */
export function deliveredAutoLog(orders: DeliveryOrder[]): DeliveredCard | null {
  if (!orders || orders.length === 0) return null;
  const sorted = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const o = sorted[0];
  const m = orderMacros(o);
  return {
    orderId: o.id,
    name: orderName(o),
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    mealType: slotFromHour(new Date(o.created_at).getHours()),
    createdAt: o.created_at,
  };
}

/** Teslim "taze" mi — son `withinMs` içinde (Ana sayfada kase + toast anı). */
export function isFreshDelivery(card: DeliveredCard | null, nowMs: number, withinMs = 2 * 60 * 60 * 1000): boolean {
  if (!card) return false;
  const t = new Date(card.createdAt).getTime();
  return Number.isFinite(t) && nowMs - t >= 0 && nowMs - t <= withinMs;
}

// ─── Yeni kabuk: teslim edilen sipariş otomatik loglanır (G13-S1 m.1) ──────────
// Yeni kabukta "Dolabındakiler" şeridi YOK; bugün teslim edilen siparişin
// dolap kopyaları (pantryStore, backfill ile gelir) Ana sayfaya kendiliğinden
// loglanır. Kayıt biçimi bugünkü "Tükettim" ile AYNI (source='pantry',
// source_ref=instanceId) → eski kabuk/raporlar aynı veriyi görür.

export interface AutoLogPantryItem {
  id: string;
  orderItemId?: string;
  quantity: number;
}

export interface AutoLogCandidate<T extends AutoLogPantryItem> {
  instanceId: string;
  item: T;
  /** Teslim zamanı (ISO) — kaydın consumed_at'i; öğün yuvası buradan çıkar. */
  deliveredAt: string;
}

/**
 * Otomatik loglanacak dolap kopyaları. Yalnız:
 *  - siparişi BUGÜN teslim edilmiş (`deliveredToday`: orderItemId → delivered_at),
 *  - henüz tüketilmemiş (`consumed`: instanceId kümesi, DB'den),
 *  - daha önce otomatik loglanmamış (`done`: kalıcı küme — kullanıcı kaydı
 *    "Kaldır"dıysa bir daha geri gelmesin)
 * kopyalar. instanceId biçimi TrackerScreen ile aynı: `${item.id}-${i}`.
 */
export function pickAutoLogInstances<T extends AutoLogPantryItem>(
  items: readonly T[],
  deliveredToday: ReadonlyMap<string, string>,
  consumed: ReadonlySet<string>,
  done: ReadonlySet<string>,
): AutoLogCandidate<T>[] {
  const out: AutoLogCandidate<T>[] = [];
  for (const item of items) {
    const at = item.orderItemId ? deliveredToday.get(item.orderItemId) : undefined;
    if (!at) continue;
    const n = Math.max(1, Math.floor(item.quantity || 1));
    for (let i = 0; i < n; i++) {
      const instanceId = `${item.id}-${i}`;
      if (consumed.has(instanceId) || done.has(instanceId)) continue;
      out.push({ instanceId, item, deliveredAt: at });
    }
  }
  return out;
}
