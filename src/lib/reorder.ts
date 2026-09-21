import { getSupabaseClient } from './supabase';
import { mapProductRow } from './products';
import type { CartSelectedOptions, Product } from '../types';

/** Bos sepet ekraninda gosterilen gecmis siparis ozeti. */
export type PastOrderItem = {
  id: string;
  name: string;
  quantity: number;
  /** Siparis anindaki normalize edilmis secenekler (cartStore.addItem'e geri verilir) */
  options: Partial<CartSelectedOptions>;
};

export type PastOrder = {
  id: number;
  orderCode: string | null;
  createdAt: string;
  totalAmount: number;
  items: PastOrderItem[];
};

// Sadece gercekten tamamlanmis siparisler tekrar edilebilir; iptal/basarisiz
// olanlar "tekrarla" teklifi olarak anlamsiz (ve yaniltici) olur.
const REORDERABLE_STATUSES = ['delivered', 'on_way', 'preparing', 'confirmed'];

const toItems = (raw: unknown): PastOrderItem[] => {
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
        // createOrderFromCart, normalize edilmis CartSelectedOptions'i
        // legacy_selected_options alanina yaziyor (bkz. src/lib/orders.ts).
        options: (r.legacy_selected_options ?? {}) as Partial<CartSelectedOptions>,
      } as PastOrderItem;
    })
    .filter((it): it is PastOrderItem => it !== null);
};

/** Kullanicinin son siparislerini (tekrar edilebilir olanlar) getirir. */
export const fetchPastOrders = async (
  userId: string,
  limit = 3,
): Promise<PastOrder[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, created_at, total_amount, items, status')
    .eq('user_id', userId)
    .in('status', REORDERABLE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      id: Number(row.id),
      orderCode: (row.order_code as string | null) ?? null,
      createdAt: String(row.created_at),
      totalAmount: Number(row.total_amount ?? 0),
      items: toItems(row.items),
    }))
    .filter((o) => o.items.length > 0);
};

export type ReorderResult = {
  /** Sepete eklenen kalem sayisi */
  added: number;
  /** Artik satista olmayan / bulunamayan urun adlari */
  unavailable: string[];
};

/**
 * Gecmis siparisin kalemlerini guncel katalogla eslestirip sepete ekler.
 * Fiyat/makro DAIMA guncel katalogdan gelir (siparis anindaki tutar degil) —
 * eski fiyati sepete tasimak yanlis tutar gosterir.
 */
export const reorderToCart = async (
  order: PastOrder,
  addItem: (
    product: Product,
    options: Partial<CartSelectedOptions>,
    quantity?: number,
  ) => void,
): Promise<ReorderResult> => {
  const supabase = getSupabaseClient();
  const ids = Array.from(
    new Set(order.items.map((it) => parseInt(it.id, 10)).filter((n) => !Number.isNaN(n))),
  );
  if (ids.length === 0) return { added: 0, unavailable: order.items.map((i) => i.name) };

  const { data, error } = await supabase.from('products').select('*').in('id', ids);
  if (error) throw error;

  const byId = new Map<number, Product>();
  for (const row of Array.isArray(data) ? data : []) {
    const product = mapProductRow(row as Record<string, unknown>);
    // Stokta olmayan / yayindan kaldirilmis urun tekrar edilemez.
    if (product.is_available === false || product.in_stock === false) continue;
    byId.set(product.id, product);
  }

  let added = 0;
  const unavailable: string[] = [];
  for (const item of order.items) {
    const product = byId.get(parseInt(item.id, 10));
    if (!product) {
      unavailable.push(item.name);
      continue;
    }
    addItem(product, item.options ?? {}, item.quantity);
    added += 1;
  }

  return { added, unavailable };
};
