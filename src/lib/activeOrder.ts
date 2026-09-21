import { getSupabaseClient } from './supabase';

export type ActiveOrderStatus = 'confirmed' | 'preparing' | 'on_way' | 'delivered';

export type ActiveOrder = {
  id: number;
  orderCode: string | null;
  status: ActiveOrderStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string | null;
  district: string | null;
  deliveryMethod: string | null;
};

// Kartta gösterilen kademeler — orders.status'un doğrudan karşılığı.
export const ORDER_STEPS: { key: ActiveOrderStatus; label: string }[] = [
  { key: 'confirmed', label: 'Onaylandı' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'on_way',    label: 'Teslimatta' },
  { key: 'delivered', label: 'Teslim edildi' },
];

export const stepIndexOf = (status: ActiveOrderStatus): number =>
  Math.max(0, ORDER_STEPS.findIndex((s) => s.key === status));

// Teslim edildikten sonra kart hemen kaybolmuyor: müşteri son kademeyi
// görebilsin diye kısa bir süre daha duruyor, sonra kendiliğinden gidiyor.
// 15 dk fazla uzun geldi (kart teslimattan sonra ekranda takılı duruyor gibi
// hissettiriyordu) → 3 dk.
export const DELIVERED_VISIBLE_MINUTES = 3;

const ACTIVE_STATUSES: ActiveOrderStatus[] = ['confirmed', 'preparing', 'on_way', 'delivered'];

const toActiveOrder = (row: Record<string, unknown>): ActiveOrder | null => {
  const status = String(row.status ?? '') as ActiveOrderStatus;
  if (!ACTIVE_STATUSES.includes(status)) return null;

  const items = Array.isArray(row.items) ? row.items : [];
  const itemCount = items.reduce((n: number, it: unknown) => {
    const q = Number((it as Record<string, unknown>)?.quantity);
    return n + (Number.isFinite(q) && q > 0 ? q : 1);
  }, 0);

  return {
    id: Number(row.id),
    orderCode: (row.order_code as string | null) ?? null,
    status,
    totalAmount: Number(row.total_amount ?? 0),
    itemCount,
    createdAt: String(row.created_at ?? ''),
    updatedAt: (row.updated_at as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    deliveryMethod: (row.delivery_method as string | null) ?? null,
  };
};

/** Teslim edilmiş sipariş kartının görünme süresi dolmuş mu? */
export const isDeliveredExpired = (order: ActiveOrder): boolean => {
  if (order.status !== 'delivered') return false;
  const ts = Date.parse(order.updatedAt || order.createdAt);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > DELIVERED_VISIBLE_MINUTES * 60_000;
};

/**
 * Kullanıcının takip edilebilir EN SON siparişi.
 * Sadece ödemesi alınmış siparişler; iptal/başarısız/beklemede olanlar değil.
 */
export const fetchActiveOrder = async (userId: string): Promise<ActiveOrder | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, status, total_amount, items, created_at, updated_at, district, delivery_method')
    .eq('user_id', userId)
    .eq('payment_status', 'paid')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const order = toActiveOrder(data as Record<string, unknown>);
  if (!order || isDeliveredExpired(order)) return null;
  return order;
};

/**
 * Sipariş satırındaki değişiklikleri canlı dinler (Realtime).
 * Realtime kapalı/erişilemezse sessizce çalışmaz — kart yine de ekran her
 * odaklandığında yeniden çekiliyor (bkz. HomeScreen useFocusEffect).
 */
export const subscribeToOrder = (
  orderId: number,
  onChange: (order: ActiveOrder | null) => void,
): (() => void) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        onChange(toActiveOrder(row));
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};
