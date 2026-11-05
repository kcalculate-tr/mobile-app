// eatkcal v2 (G13-S2 md.6) — Siparişlerim / detay VERİ katmanı.
//
// Bugünkü ekranlardaki inline sorgular BİREBİR (aynı tablo, aynı select, aynı
// filtre). Kaynak: src/screens/profile/OrdersScreen.tsx loadOrders ve
// src/screens/profile/OrderDetailScreen.tsx loadOrder. Bu dosya yalnız OKUR;
// yazma yok (değerlendirme mevcut submitOrderReview ile, tekrar sipariş mevcut
// reorderToCart ile ekranda çağrılır).
// İLTER'E: iki ekranın inline sorgusu tek kaynağa (src/lib) indirilebilir —
// KİMSE dosyaları olduğundan bu oturumda yapılmadı.
import { getSupabaseClient } from '../../../../core/supabase';
import { allTabStatuses, type OrderListRow } from './orders';

/**
 * OrdersScreen.tsx loadOrders sorgusu — aynı select/sıralama. Tek fark: sekme
 * başına ayrı sorgu yerine tüm sekmelerin durum birleşimi (istemcide süzülür).
 */
export async function fetchOrdersForList(userId: string): Promise<OrderListRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, created_at, total_amount, status, payment_status')
    .eq('user_id', userId)
    .in('status', allTabStatuses())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) => ({
    id: Number(row.id ?? 0),
    order_code: String(row.order_code ?? '').trim() || null,
    created_at: String(row.created_at ?? ''),
    total_amount: Number(row.total_amount ?? 0),
    status: String(row.status ?? ''),
    payment_status: row.payment_status != null ? String(row.payment_status) : null,
  }));
}

export interface OrderDetailRow {
  id: number;
  order_code: string | null;
  created_at: string;
  delivered_at: string | null;
  total_amount: number;
  status: string;
  payment_status: string | null;
  address: string | null;
  delivery_method: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  items: unknown;
  order_items: unknown;
}

/** OrderDetailScreen.tsx loadOrder sorgusu — aynı select. */
export async function fetchOrderDetail(orderId: number): Promise<OrderDetailRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(product_name, quantity, unit_price, total_price)')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  const raw = data as Record<string, unknown>;
  return {
    id: Number(raw.id ?? 0),
    order_code: raw.order_code != null ? String(raw.order_code).trim() || null : null,
    created_at: String(raw.created_at ?? ''),
    delivered_at: raw.delivered_at ? String(raw.delivered_at) : null,
    total_amount: Number(raw.total_amount ?? 0),
    status: String(raw.status ?? ''),
    payment_status: raw.payment_status != null ? String(raw.payment_status) : null,
    address: raw.address ? String(raw.address) : null,
    delivery_method: raw.delivery_method ? String(raw.delivery_method) : null,
    scheduled_date: raw.scheduled_date ? String(raw.scheduled_date) : null,
    scheduled_time: raw.scheduled_time ? String(raw.scheduled_time) : null,
    items: raw.items,
    order_items: raw.order_items,
  };
}
