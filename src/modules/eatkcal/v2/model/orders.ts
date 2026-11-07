// eatkcal v2 (G13-S2 md.6) — Siparişlerim / Sipariş detayı SAF modeli.
// Native/Supabase YOK → birim testinden import edilir. Sorgular ordersData.ts'te.
//
// Durum kümeleri ve etiketler BUGÜNKÜ ekranlardan birebir:
//  - src/screens/profile/OrdersScreen.tsx:46-54 (ACTIVE / PAST / HIDDEN) ve
//    :120-125 (sekme → durum kümesi; "Tümü" = ACTIVE + PAST — 'cancelled'
//    bugünkü "Tümü"de YOK, v2'de de yok)
//  - src/screens/profile/OrderDetailScreen.tsx:64 (STATUS_LABELS),
//    :116 (getTrackingProgress: aşama indeksi)
//  - src/lib/reorder.ts:38 (REORDERABLE_STATUSES), :40 (toItems)
// Yeni durum adı UYDURULMAZ.
import type { CartSelectedOptions, SelectedOption } from '../../../../types';
import type { PastOrder, PastOrderItem } from '../../../../lib/reorder';

export type OrdersFilter = 'all' | 'active' | 'past' | 'cancelled';

export const ORDERS_FILTERS: readonly OrdersFilter[] = ['all', 'active', 'past', 'cancelled'];

/** OrdersScreen.tsx:46 */
export const ACTIVE_STATUSES = ['pending', 'pending_payment', 'confirmed', 'preparing', 'on_way', 'ready'] as const;
/** OrdersScreen.tsx:50 */
export const PAST_STATUSES = ['delivered', 'payment_failed', 'refunded'] as const;
/** OrdersScreen.tsx:54 */
export const HIDDEN_FROM_CUSTOMER_HISTORY = ['expired'] as const;

/** OrdersScreen.tsx:120-125 — sekme → durum kümesi (aynen). */
export function statusesForFilter(filter: OrdersFilter): string[] {
  let statuses: string[];
  if (filter === 'active') statuses = [...ACTIVE_STATUSES];
  else if (filter === 'past') statuses = ['delivered'];
  else if (filter === 'cancelled') statuses = ['cancelled', 'payment_failed', 'refunded'];
  else statuses = [...ACTIVE_STATUSES, ...PAST_STATUSES];
  return statuses.filter((s) => !(HIDDEN_FROM_CUSTOMER_HISTORY as readonly string[]).includes(s));
}

/**
 * v2 tek sorguda tüm sekmelerin birleşimini çeker (filtre-boş durumunu
 * "hiç sipariş yok"tan ayırabilmek için), sekmeyi istemcide süzer. Sonuç
 * kümesi her sekme için bugünkü sekme sorgusuyla aynı.
 */
export function allTabStatuses(): string[] {
  return Array.from(new Set(ORDERS_FILTERS.flatMap(statusesForFilter)));
}

export interface OrderListRow {
  id: number;
  order_code: string | null;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status: string | null;
  /** G15-S5: satır fotoğrafı için ilk ürün id'si (orders.items). */
  first_product_id?: string | null;
}

/** orders.items JSON'undaki ilk ürün id'si (satır fotoğrafı). */
export function firstProductId(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  for (const it of items) {
    const id = (it as Record<string, unknown> | null)?.id;
    if (id != null && String(id) !== '') return String(id);
  }
  return null;
}

export function filterOrders<T extends { status: string }>(rows: readonly T[], filter: OrdersFilter): T[] {
  const set = new Set(statusesForFilter(filter));
  return rows.filter((r) => set.has(r.status));
}

/** Satır görünümü: 'empty' (hiç sipariş yok) · 'filter_empty' · 'list'. */
export function ordersViewState(all: readonly { status: string }[], filter: OrdersFilter): 'empty' | 'filter_empty' | 'list' {
  if (all.length === 0) return 'empty';
  return filterOrders(all, filter).length === 0 ? 'filter_empty' : 'list';
}

/** Rozet: i18n anahtarı (eatkcal.v2.orders.status.<status>) + ton. Aktifler lime dolgu. */
export function statusBadge(status: string): { key: string; tone: 'active' | 'neutral' | 'negative' } {
  const known = [
    'pending',
    'pending_payment',
    'confirmed',
    'preparing',
    'on_way',
    'ready',
    'delivered',
    'cancelled',
    'payment_failed',
    'refunded',
  ];
  const key = known.includes(status) ? status : 'unknown';
  const tone =
    status === 'confirmed' || status === 'preparing' || status === 'on_way' || status === 'ready'
      ? 'active'
      : status === 'cancelled' || status === 'payment_failed'
        ? 'negative'
        : 'neutral';
  return { key, tone };
}

/** OrdersScreen.tsx:283 — kod yoksa id'den. */
export function orderCodeLabel(row: { order_code: string | null; id: number }): string {
  return row.order_code ?? `#${String(row.id).slice(0, 8).toUpperCase()}`;
}

/**
 * FinEkOrderDetail aşamaları (4): Alındı · Hazırlanıyor · Yola çıktı · Teslim edildi.
 * İndeks getTrackingProgress (OrderDetailScreen.tsx:116) ile aynı eşlemeden
 * türetilir (confirmed=1, preparing=2, on_way/ready=3, delivered=4); panoda
 * "Sipariş verildi" (0) adımı yok → v2 adım = progress - 1.
 */
export const DETAIL_STEPS = ['received', 'preparing', 'on_way', 'delivered'] as const;
export type DetailStep = (typeof DETAIL_STEPS)[number];

export function trackingProgress(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    pending_payment: 0,
    confirmed: 1,
    preparing: 2,
    on_way: 3,
    ready: 3,
    delivered: 4,
  };
  return map[status] ?? -1;
}

/** Tamamlanan son v2 adımın indeksi (-1: hiçbiri; ör. ödeme bekliyor / iptal). */
export function reachedStepIndex(status: string): number {
  const p = trackingProgress(status);
  return p <= 0 ? -1 : p - 1;
}

/** OrderDetailScreen.tsx:319-320 — terminal durumlar (zaman çizelgesi yerine durum). */
export function isTerminalStatus(status: string): boolean {
  return status === 'cancelled' || status === 'payment_failed' || status === 'delivered' || status === 'refunded';
}

/** Zaman çizelgesinde gösterilecek saat kaynağı: yalnız veri olan adımlar. */
export function stepTimes(order: { created_at: string; delivered_at?: string | null; status: string }): Partial<Record<DetailStep, string>> {
  const out: Partial<Record<DetailStep, string>> = {};
  if (reachedStepIndex(order.status) >= 0 && order.created_at) out.received = order.created_at;
  if (order.status === 'delivered' && order.delivered_at) out.delivered = order.delivered_at;
  return out;
}

/** reorder.ts:38 — tekrar sipariş verilebilir durumlar (fetchPastOrders filtresi). */
export const REORDERABLE_STATUSES = ['delivered', 'on_way', 'preparing', 'confirmed'] as const;
export function canReorder(status: string): boolean {
  return (REORDERABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * reorder.ts:40 `toItems` ile BİREBİR (dışa verilmediği için port; İLTER'E:
 * tek kaynağa indirme). orders.items JSON → PastOrderItem[].
 */
export function pastOrderItemsFromJson(raw: unknown): PastOrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const id = r.id != null ? String(r.id) : '';
      if (!id) return null;
      return {
        id,
        name: typeof r.name === 'string' ? r.name : 'Ürün',
        quantity: Number(r.quantity) > 0 ? Number(r.quantity) : 1,
        options: (r.legacy_selected_options ?? {}) as Partial<CartSelectedOptions>,
        calories: Math.max(0, Number(r.calories) || 0),
        imageUrl: null,
      } as PastOrderItem;
    })
    .filter((it): it is PastOrderItem => it !== null);
}

/** reorder.ts:78-88 ile aynı PastOrder şekli (reorderToCart'a verilir). */
export function pastOrderFromRow(row: {
  id: number;
  order_code: string | null;
  created_at: string;
  total_amount: number;
  items?: unknown;
}): PastOrder {
  const items = pastOrderItemsFromJson(row.items);
  return {
    id: row.id,
    orderCode: row.order_code,
    createdAt: row.created_at,
    totalAmount: row.total_amount,
    items,
    totalCalories: items.reduce((n, it) => n + it.calories * it.quantity, 0),
  };
}

export interface DetailLine {
  name: string;
  /** G15-S5: satır fotoğrafı için ürün id'si (orders.items[].id; yoksa null). */
  productId: string | null;
  quantity: number;
  totalPrice: number;
  /** "Basmati · Izgara Tavuk 150 g · Maş Fasulye" — yoksa boş. */
  summary: string;
}

/**
 * Seçim özeti: orders.items JSON'undaki `legacy_selected_options.labels` +
 * `selected_options[].value_name` (CartScreen.tsx:463-480'in gösterdiği aynı
 * iki kaynak), " · " ile. Veri yoksa boş → satır gizlenir.
 */
export function selectionSummary(item: Record<string, unknown>): string {
  const parts: string[] = [];
  const legacy = (item.legacy_selected_options ?? null) as Partial<CartSelectedOptions> | null;
  if (legacy && Array.isArray(legacy.labels)) {
    for (const l of legacy.labels) if (typeof l === 'string' && l.trim()) parts.push(l.trim());
  }
  const tmpl = Array.isArray(item.selected_options) ? (item.selected_options as SelectedOption[]) : [];
  for (const o of tmpl) if (o && typeof o.value_name === 'string' && o.value_name.trim()) parts.push(o.value_name.trim());
  return Array.from(new Set(parts)).join(', ');
}

/**
 * Ürün satırları: önce orders.items JSON (seçim özeti taşır), yoksa
 * order_items ilişkisi (OrderDetailScreen.tsx:212'un kaynağı).
 */
export function detailLines(raw: { items?: unknown; order_items?: unknown }): DetailLine[] {
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return (raw.items as Record<string, unknown>[]).map((it) => {
      const quantity = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const unit = Number(it.unit_price ?? 0);
      const total = it.total_price != null ? Number(it.total_price) : Number((unit * quantity).toFixed(2));
      return {
        name: typeof it.name === 'string' && it.name ? it.name : 'Ürün',
        productId: it.id != null && String(it.id) !== '' ? String(it.id) : null,
        quantity,
        totalPrice: Number.isFinite(total) ? total : 0,
        summary: selectionSummary(it),
      };
    });
  }
  const rows = Array.isArray(raw.order_items) ? (raw.order_items as Record<string, unknown>[]) : [];
  return rows.map((item) => ({
    name: String(item.product_name ?? 'Ürün'),
    productId: null,
    quantity: Number(item.quantity ?? 0),
    totalPrice: Number(item.total_price ?? 0),
    summary: '',
  }));
}

/**
 * "Değerlendir" görünür mü? Mevcut akışın kuralı: fetchPendingFeedbackOrder
 * (src/lib/orderFeedback.ts:48) bu siparişi döndürüyorsa (teslim + 30 dk geçmiş
 * + 48 saati aşmamış + yorumlanmamış). Başka koşul UYDURULMAZ.
 */
export function canReview(orderId: number, pending: { id: number } | null): boolean {
  return !!pending && pending.id === orderId;
}
